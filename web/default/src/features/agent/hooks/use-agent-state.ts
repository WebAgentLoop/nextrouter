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
import { clearConversation, loadConversation, saveConversation } from '../lib'
import type {
  AgentConfig,
  AgentMessage,
  AgentRunStatus,
  GroupOption,
  ModelOption,
} from '../types'

const SAVE_DEBOUNCE_MS = 500

/**
 * Owns all agent conversation state: messages (with IndexedDB persistence),
 * config, run status, and the model/group option lists.
 */
export function useAgentState() {
  const [messages, setMessages] = useState<AgentMessage[]>([])
  const [config, setConfig] = useState<AgentConfig>(DEFAULT_AGENT_CONFIG)
  const [status, setStatus] = useState<AgentRunStatus>('idle')
  const [models, setModels] = useState<ModelOption[]>([])
  const [groups, setGroups] = useState<GroupOption[]>([])
  const [isLoadingMessages, setIsLoadingMessages] = useState(true)

  const saveTimerRef = useRef<number | null>(null)
  const latestMessagesRef = useRef<AgentMessage[]>(messages)
  const hasLoadedRef = useRef(false)

  // Load the persisted conversation on mount. Deferred via setTimeout so the
  // initial empty state renders first (mirrors the playground pattern).
  useEffect(() => {
    let cancelled = false

    window.setTimeout(async () => {
      const loaded = await loadConversation()
      if (cancelled) {
        return
      }
      if (loaded && loaded.length > 0) {
        const sanitized = loaded.map((message) => ({
          ...message,
          isStreaming: false,
        }))
        latestMessagesRef.current = sanitized
        setMessages(sanitized)
      }
      hasLoadedRef.current = true
      setIsLoadingMessages(false)
    }, 0)

    return () => {
      cancelled = true
    }
  }, [])

  const persist = useCallback((messagesToSave: AgentMessage[]) => {
    latestMessagesRef.current = messagesToSave

    if (!hasLoadedRef.current) {
      return
    }

    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
    }

    saveTimerRef.current = window.setTimeout(() => {
      saveTimerRef.current = null
      void saveConversation(latestMessagesRef.current)
    }, SAVE_DEBOUNCE_MS)
  }, [])

  // Flush pending saves on unmount.
  useEffect(
    () => () => {
      if (saveTimerRef.current !== null) {
        window.clearTimeout(saveTimerRef.current)
        void saveConversation(latestMessagesRef.current)
      }
    },
    []
  )

  const updateMessages = useCallback(
    (updater: (prev: AgentMessage[]) => AgentMessage[]) => {
      setMessages((prev) => {
        const next = updater(prev)
        persist(next)
        return next
      })
    },
    [persist]
  )

  const updateConfig = useCallback(
    <K extends keyof AgentConfig>(key: K, value: AgentConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }))
    },
    []
  )

  const clearMessages = useCallback(() => {
    if (saveTimerRef.current !== null) {
      window.clearTimeout(saveTimerRef.current)
      saveTimerRef.current = null
    }
    latestMessagesRef.current = []
    void clearConversation()
    setMessages([])
  }, [])

  // Load groups + models on mount.
  useEffect(() => {
    let cancelled = false

    void (async () => {
      const loadedGroups = await getUserGroups()
      if (cancelled) {
        return
      }
      setGroups(loadedGroups)

      const group = loadedGroups.some((g) => g.value === DEFAULT_GROUP)
        ? DEFAULT_GROUP
        : (loadedGroups[0]?.value ?? DEFAULT_GROUP)

      const loadedModels = await getUserModels(group)
      if (cancelled) {
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
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Reload the model list whenever the user picks a different group.
  const reloadModels = useCallback(async (group: string) => {
    setModels([])
    const loaded = await getUserModels(group)
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
    config,
    updateConfig,
    status,
    setStatus,
    models,
    groups,
    isLoadingMessages,
    reloadModels,
  }
}
