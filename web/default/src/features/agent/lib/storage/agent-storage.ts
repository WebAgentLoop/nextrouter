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
} from '../../constants'
import type { AgentMessage } from '../../types'

let dbPromise: Promise<IDBPDatabase> | null = null

function getDB(): Promise<IDBPDatabase> {
  if (typeof indexedDB === 'undefined') {
    return Promise.reject(new Error('IndexedDB is not available'))
  }
  if (!dbPromise) {
    dbPromise = openDB(AGENT_DB_NAME, AGENT_DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(AGENT_CONVERSATION_STORE)) {
          db.createObjectStore(AGENT_CONVERSATION_STORE)
        }
      },
    })
  }
  return dbPromise
}

/**
 * Load the persisted conversation. Returns null when no conversation exists,
 * the value is not an array, or storage is unavailable.
 */
export async function loadConversation(): Promise<AgentMessage[] | null> {
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
 * Persist the conversation best-effort. Storage failures are swallowed so they
 * never break the agent loop.
 */
export async function saveConversation(
  messages: AgentMessage[]
): Promise<void> {
  try {
    const db = await getDB()
    await db.put(AGENT_CONVERSATION_STORE, messages, AGENT_CONVERSATION_KEY)
  } catch {
    /* best-effort persistence */
  }
}

/**
 * Remove the persisted conversation.
 */
export async function clearConversation(): Promise<void> {
  try {
    const db = await getDB()
    await db.delete(AGENT_CONVERSATION_STORE, AGENT_CONVERSATION_KEY)
  } catch {
    /* best-effort cleanup */
  }
}
