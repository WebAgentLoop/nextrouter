/*
Copyright (C) 2023-2026 QuantumNous

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

You should have received a copy of the GNU Affero General Public License
along with this program. If not, see <https://www.gnu.org/licenses/>.

For commercial licensing, please contact support@quantumnous.com
*/
import { useCallback, useEffect, useRef, useState } from 'react'

import { getUserGroups, getUserModels } from '../api'
import { DEFAULT_AGENT_CONFIG, DEFAULT_GROUP } from '../constants'
import {
  clearActiveSessionId,
  clearLegacyConversation,
  createSessionId,
  DEFAULT_SESSION_TITLE,
  deleteSession,
  deriveSessionTitle,
  getActiveSessionId,
  getSession,
  listSessionSummaries,
  loadLegacyConversation,
  removeMessageTurn,
  sanitizePersistedMessages,
  saveSession,
  setActiveSessionId,
} from '../lib'
import type {
  AgentConfig,
  AgentMessage,
  AgentRunStatus,
  AgentSessionSummary,
  GroupOption,
  ModelOption,
} from '../types'

const SAVE_DEBOUNCE_MS = 500

/**
 * Owns all agent conversation state. The active conversation is one entry in a
 * multi-session history persisted to IndexedDB; its id lives in localStorage.
 * Messages are persisted (debounced) under the active session id, and the
 * title auto-derives from the first user message until the user renames it.
 */
export function useAgentState() {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [status, setStatus] = useState<AgentRunStatus>('idle')
  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)
  const [activeSessionId, setActiveSessionIdState] = useState<string | null>(
    null
  )
  const [sessionTitle, setSessionTitle] = useState<string>(
    DEFAULT_SESSION_TITLE
  )
  const [sessions, setSessions] = useState<AgentSessionSummary[]>([])

  const saveTimerRef = useRef<number | null>(null)
  const latestMessagesRef = useRef<AgentMessage[]>(messages)
  const hasLoadedRef = useRef(false)
  const activeSessionIdRef = useRef<string | null>(null)
  const sessionCreatedAtRef = useRef<number>(Date.now())
  const titleCustomRef = useRef(false)
  const sessionTitleRef = useRef<string>(DEFAULT_SESSION_TITLE)
  const statusRef = useRef<AgentRunStatus>(status)
  const modelRequestIdRef = useRef(0)

  useEffect(() => {
    statusRef.current = status
  }, [status])

  const reloadSessions = useCallback(async () => {
    const summaries = await listSessionSummaries()
    setSessions(summaries)
  }, [])

  const activateSession = useCallback((id: string, createdAt: number) => {
    activeSessionIdRef.current = id
    sessionCreatedAtRef.current = createdAt
    setActiveSessionIdState(id)
    setActiveSessionId(id)
  }, [])

  // Load the active session on mount (migrating any legacy single-conversation
  // record, or creating a fresh empty session). Deferred so the initial empty
  // state renders first (mirrors the playground pattern).
  useEffect(() => {
    let cancelled = false

    const loadTimer = window.setTimeout(async () => {
      const existingId = getActiveSessionId()
      let chosenId: string | null = null

      if (existingId) {
        const session = await getSession(existingId)
        if (cancelled) {
          return
        }
        if (session) {
          chosenId = session.id
          const sanitized = sanitizePersistedMessages(session.messages)
          latestMessagesRef.current = sanitized
          setMessages(sanitized)
          const derived = deriveSessionTitle(sanitized)
          sessionTitleRef.current = session.title
          setSessionTitle(session.title)
          titleCustomRef.current = session.title !== derived
          activateSession(session.id, session.createdAt)
        }
      }

      if (!chosenId) {
        const legacy = await loadLegacyConversation()
        if (cancelled) {
          return
        }
        if (legacy && legacy.length > 0) {
          const sanitized = sanitizePersistedMessages(legacy)
          const now = Date.now()
          const id = createSessionId()
          const title = deriveSessionTitle(sanitized)
          await saveSession({
            id,
            title,
            createdAt: now,
            updatedAt: now,
            messages: sanitized,
          })
          await clearLegacyConversation()
          if (cancelled) {
            return
          }
          chosenId = id
          latestMessagesRef.current = sanitized
          setMessages(sanitized)
          sessionTitleRef.current = title
          setSessionTitle(title)
          titleCustomRef.current = false
          activateSession(id, now)
        }
      }

      if (!chosenId) {
        const now = Date.now()
        const id = createSessionId()
        const title = DEFAULT_SESSION_TITLE
        await saveSession({
          id,
          title,
          createdAt: now,
          updatedAt: now,
          messages: [],
        })
        if (cancelled) {
          return
        }
        chosenId = id
        sessionTitleRef.current = title
        setSessionTitle(title)
        activateSession(id, now)
      }

      if (cancelled) {
        return
      }

      hasLoadedRef.current = true
      setIsLoadingMessages(false)
      await reloadSessions()
    }, 0)

    return () => {
      cancelled = true
      window.clearTimeout(loadTimer)
    }
  }, [activateSession, reloadSessions])

  const persist = useCallback((messagesToSave: AgentMessage[]) => {
    if (!hasLoadedRef.current) {
      return
    }

    const id = activeSessionIdRef.current
    if (!id) {
      return
    }

    // Auto-derive the title from the first user message until the user
    // explicitly renames the session.
    if (!titleCustomRef.current) {
      const derived = deriveSessionTitle(messagesToSave)
      if (derived !== sessionTitleRef.current) {
        sessionTitleRef.current = derived
        setSessionTitle(derived)
      }
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void saveSession({
        id,
        title: sessionTitleRef.current,
        createdAt: sessionCreatedAtRef.current,
        updatedAt: Date.now(),
        messages: latestMessagesRef.current,
      })
    }, SAVE_DEBOUNCE_MS)
  }, [])

  // Persist messages (debounced) + auto-derive the title whenever the
  // conversation commits. Side effects live in this effect rather than inside
  // the setMessages updater so the updater stays pure (StrictMode-safe); the
  // ref is kept current synchronously inside the updater.
  useEffect(() => {
    persist(messages)
  }, [messages, persist])

  // Flush any pending debounced save for the CURRENT session, writing it to
  // IndexedDB immediately. Must run BEFORE session refs are reassigned (on
  // switch / unmount), otherwise the previous session loses its trailing edit.
  const flushPendingSave = useCallback(() => {
    if (saveTimerRef.current === null) {
      return
    }
    window.clearTimeout(saveTimerRef.current)
    saveTimerRef.current = null
    const id = activeSessionIdRef.current
    if (id) {
      void saveSession({
        id,
        title: sessionTitleRef.current,
        createdAt: sessionCreatedAtRef.current,
        updatedAt: Date.now(),
        messages: latestMessagesRef.current,
      })
    }
  }, [])

  // Flush pending saves on unmount.
  useEffect(
    () => () => {
      flushPendingSave()
    },
    [flushPendingSave]
  )

  const updateMessages = useCallback(
    (updater: (prev: AgentMessage[]) => AgentMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev)
        // Keep the ref current synchronously so flush/unmount always read the
        // latest messages; the debounced save itself runs in the persist
        // effect below (no side effects inside this pure updater).
        latestMessagesRef.current = next
        return next
      })
    },
    []
  )

  const updateConfig = useCallback(
    <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const clearMessages = useCallback(() => {
    if (statusRef.current === 'running') {
      return
    }
    titleCustomRef.current = false
    sessionTitleRef.current = DEFAULT_SESSION_TITLE
    setSessionTitle(DEFAULT_SESSION_TITLE)
    setStatus('idle')
    updateMessages(() => [])
  }, [updateMessages])

  const newSession = useCallback(() => {
    if (statusRef.current === 'running') {
      return
    }
    flushPendingSave()
    const now = Date.now()
    const id = createSessionId()
    const title = DEFAULT_SESSION_TITLE
    latestMessagesRef.current = []
    setMessages([])
    setStatus('idle')
    titleCustomRef.current = false
    sessionTitleRef.current = title
    setSessionTitle(title)
    activateSession(id, now)
    void saveSession({
      id,
      title,
      createdAt: now,
      updatedAt: now,
      messages: [],
    })
    void reloadSessions()
  }, [activateSession, flushPendingSave, reloadSessions])

  const selectSession = useCallback(
    async (id: string) => {
      if (statusRef.current === 'running') {
        return
      }
      if (id === activeSessionIdRef.current) {
        return
      }
      flushPendingSave()
      const session = await getSession(id)
      if (!session) {
        return
      }
      const sanitized = sanitizePersistedMessages(session.messages)
      latestMessagesRef.current = sanitized
      setMessages(sanitized)
      setStatus('idle')
      const derived = deriveSessionTitle(sanitized)
      sessionTitleRef.current = session.title
      setSessionTitle(session.title)
      titleCustomRef.current = session.title !== derived
      activateSession(session.id, session.createdAt)
    },
    [activateSession, flushPendingSave]
  )

  const deleteSessionById = useCallback(
    async (id: string) => {
      const isActive = id === activeSessionIdRef.current
      if (isActive && saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        saveTimerRef.current = null
      }
      await deleteSession(id)
      if (isActive) {
        clearActiveSessionId()
        const now = Date.now()
        const newId = createSessionId()
        const title = DEFAULT_SESSION_TITLE
        latestMessagesRef.current = []
        setMessages([])
        setStatus('idle')
        titleCustomRef.current = false
        sessionTitleRef.current = title
        setSessionTitle(title)
        activateSession(newId, now)
        await saveSession({
          id: newId,
          title,
          createdAt: now,
          updatedAt: now,
          messages: [],
        })
      }
      await reloadSessions()
    },
    [activateSession, reloadSessions]
  )

  const renameSession = useCallback(
    async (id: string, title: string) => {
      const trimmed = title.trim()
      if (!trimmed) {
        return
      }
      if (id === activeSessionIdRef.current) {
        titleCustomRef.current = true
        sessionTitleRef.current = trimmed
        setSessionTitle(trimmed)
        // The explicit save below supersedes any pending debounced save; just
        // cancel the timer so it cannot fire afterwards.
        if (saveTimerRef.current !== null) {
          window.clearTimeout(saveTimerRef.current)
          saveTimerRef.current = null
        }
        await saveSession({
          id,
          title: trimmed,
          createdAt: sessionCreatedAtRef.current,
          updatedAt: Date.now(),
          messages: latestMessagesRef.current,
        })
      } else {
        const session = await getSession(id)
        if (session) {
          await saveSession({
            ...session,
            title: trimmed,
            updatedAt: Date.now(),
          })
        }
      }
      await reloadSessions()
    },
    [reloadSessions]
  )

  const deleteMessage = useCallback(
    (targetId: string) => {
      updateMessages((prev) => removeMessageTurn(prev, targetId))
    },
    [updateMessages]
  )

  // Load groups + models on mount.
  useEffect(() => {
    let cancelled = false
    const requestId = ++modelRequestIdRef.current

    void (async () => {
      try {
        const loadedGroups = await getUserGroups()
        if (cancelled) {
          return
        }
        setGroups(loadedGroups)

        const group = loadedGroups.some((g) => g.value === DEFAULT_GROUP)
          ? DEFAULT_GROUP
          : (loadedGroups[0]?.value ?? DEFAULT_GROUP)

        const loadedModels = await getUserModels(group)
        if (cancelled || requestId !== modelRequestIdRef.current) {
          return
        }
        setModels(loadedModels)

        setConfig((prev) => {
          const modelStillAvailable = loadedModels.some(
            (m) => m.value === prev.model
          )
          return {
            ...prev,
            group,
            model: modelStillAvailable
              ? prev.model
              : (loadedModels[0]?.value ?? prev.model),
          }
        })
      } catch {
        if (!cancelled && requestId === modelRequestIdRef.current) {
          setGroups([])
          setModels([])
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Reload the model list whenever the user picks a different group.
  const reloadModels = useCallback(async (group: string) => {
    const requestId = ++modelRequestIdRef.current
    setModels([])
    let loaded: ModelOption[]
    try {
      loaded = await getUserModels(group)
    } catch {
      if (requestId === modelRequestIdRef.current) {
        setModels([])
      }
      return
    }
    if (requestId !== modelRequestIdRef.current) {
      return
    }
    setModels(loaded)
    setConfig((prev) => {
      const modelStillAvailable = loaded.some((m) => m.value === prev.model)
      return {
        ...prev,
        model: modelStillAvailable
          ? prev.model
          : (loaded[0]?.value ?? prev.model),
      }
    })
  }, [])

  return {
    messages,
    updateMessages,
    clearMessages,
    deleteMessage,
    config,
    updateConfig,
    status,
    setStatus,
    models,
    groups,
    isLoadingMessages,
    reloadModels,
    activeSessionId,
    sessionTitle,
    sessions,
    reloadSessions,
    newSession,
    selectSession,
    deleteSessionById,
    renameSession,
  }
}
