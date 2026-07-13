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
import { openDB, type IDBPDatabase } from 'idb'

import {
  AGENT_CONVERSATION_KEY,
  AGENT_CONVERSATION_STORE,
  AGENT_DB_NAME,
  AGENT_DB_VERSION,
  AGENT_SESSIONS_STORE,
  MAX_STORED_SESSIONS,
} from '../../constants'
import type {
  AgentMessage,
  AgentSession,
  AgentSessionSummary,
} from '../../types'

let dbPromise: Promise<IDBPDatabase> | null = null

const DB_OPEN_TIMEOUT_MS = 3000

function getDB(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'))
  }
  if (!dbPromise) {
    const openPromise = openDB(AGENT_DB_NAME, AGENT_DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          if (!db.objectStoreNames.contains(AGENT_CONVERSATION_STORE)) {
            db.createObjectStore(AGENT_CONVERSATION_STORE)
          }
        }
        if (oldVersion < 2) {
          if (!db.objectStoreNames.contains(AGENT_SESSIONS_STORE)) {
            db.createObjectStore(AGENT_SESSIONS_STORE, { keyPath: 'id' })
          }
        }
      },
      // Cooperate with other tabs: if our connection blocks a version upgrade
      // elsewhere, close it so the other tab can proceed.
      blocking() {
        void openPromise.then((db) => db.close()).catch(() => {})
      },
      // Connection was forcibly closed (e.g. after another tab upgraded); drop
      // the cache so the next call reopens.
      terminated() {
        dbPromise = null
      },
    })

    // If the open is BLOCKED by a stale connection holding an older version
    // (a very common dev pitfall after a version bump), idb's promise never
    // settles. Race it against a timeout so callers degrade gracefully
    // instead of hanging the UI forever.
    const timeout = new Promise<IDBPDatabase>((_, reject) => {
      const id = setTimeout(() => {
        reject(new Error('IndexedDB open timed out'))
      }, DB_OPEN_TIMEOUT_MS)
      void openPromise.then(
        () => clearTimeout(id),
        () => clearTimeout(id)
      )
    })

    dbPromise = Promise.race([openPromise, timeout])

    // Do NOT reset on rejection: a blocked/broken DB should fail fast for
    // every subsequent call this page load (avoids cascading timeouts). A
    // page reload re-tries from scratch.
  }
  return dbPromise
}

function isSession(value: unknown): value is AgentSession {
  if (!value || typeof value !== 'object') {
    return false
  }
  const record = value as Record<string, unknown>
  return (
    typeof record.id === 'string' &&
    typeof record.title === 'string' &&
    typeof record.createdAt === 'number' &&
    typeof record.updatedAt === 'number' &&
    Array.isArray(record.messages)
  )
}

function toSummary(session: AgentSession): AgentSessionSummary {
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    messageCount: session.messages.length,
  }
}

async function pruneOldSessions(db: IDBPDatabase): Promise<void> {
  const all = (await db.getAll(AGENT_SESSIONS_STORE)) as unknown[]
  const sessions = all.filter(isSession) as AgentSession[]
  if (sessions.length <= MAX_STORED_SESSIONS) {
    return
  }
  const sorted = [...sessions].sort((a, b) => a.updatedAt - b.updatedAt)
  const removable = sorted.slice(0, sessions.length - MAX_STORED_SESSIONS)
  const tx = db.transaction(AGENT_SESSIONS_STORE, 'readwrite')
  await Promise.all(
    removable.map((session) => tx.store.delete(session.id))
  )
  await tx.done
}

/**
 * Read the legacy single `current` conversation record (v1 schema). Used once
 * on first load to migrate an existing conversation into a session. Returns
 * null when absent or storage is unavailable.
 */
export async function loadLegacyConversation(): Promise<AgentMessage[] | null> {
  try {
    const db = await getDB()
    const value = await db.get(
      AGENT_CONVERSATION_STORE,
      AGENT_CONVERSATION_KEY
    )
    if (!Array.isArray(value)) {
      return null
    }
    return value as AgentMessage[]
  } catch {
    return null
  }
}

/**
 * Remove the legacy `current` conversation record after it has been migrated.
 */
export async function clearLegacyConversation(): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(AGENT_CONVERSATION_STORE, AGENT_CONVERSATION_KEY)
  } catch {
    /* best-effort cleanup */
  }
}

/**
 * Return all sessions with the most recently updated first.
 */
export async function listSessions(): Promise<AgentSession[]> {
  try {
    const db = await getDB()
    const all = (await db.getAll(AGENT_SESSIONS_STORE)) as AgentSession[]
    return all
      .filter(isSession)
      .sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    return []
  }
}

/**
 * Return session summaries (no message bodies) for the history list.
 */
export async function listSessionSummaries(): Promise<AgentSessionSummary[]> {
  const sessions = await listSessions()
  return sessions.map(toSummary)
}

/**
 * Load a single session by id, or null when it does not exist.
 */
export async function getSession(id: string): Promise<AgentSession | null> {
  try {
    const db = await getDB()
    const value = await db.get(AGENT_SESSIONS_STORE, id)
    return isSession(value) ? value : null
  } catch {
    return null
  }
}

/**
 * Persist a session (create or replace) and prune the oldest over the cap.
 */
export async function saveSession(session: AgentSession): Promise<void> {
  try {
    const db = await getDB()
    await db.put(AGENT_SESSIONS_STORE, session)
    await pruneOldSessions(db)
  } catch {
    /* best-effort persistence */
  }
}

/**
 * Delete a session by id.
 */
export async function deleteSession(id: string): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(AGENT_SESSIONS_STORE, id)
  } catch {
    /* best-effort cleanup */
  }
}
