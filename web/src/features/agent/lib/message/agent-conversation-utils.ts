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
import type { AgentMessage } from '../../types'

const TITLE_MAX_LENGTH = 40
export const DEFAULT_SESSION_TITLE = 'New chat'

export interface AgentEditResult {
  messages: AgentMessage[]
  seed: AgentMessage[] | null
}

export function sanitizePersistedMessages(
  messages: AgentMessage[]
): AgentMessage[] {
  return messages.map((message) => ({
    ...message,
    isStreaming: false,
    toolCalls: message.toolCalls?.map((call) =>
      call.status === 'pending' || call.status === 'running'
        ? { ...call, status: 'cancelled' }
        : call
    ),
  }))
}

export function createSessionId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

export function deriveSessionTitle(messages: AgentMessage[]): string {
  const firstUser = messages.find((message) => message.role === 'user')
  const raw = firstUser?.content.trim()
  if (!raw) {
    return DEFAULT_SESSION_TITLE
  }
  const single = raw.replaceAll(/\s+/g, ' ')
  return single.length > TITLE_MAX_LENGTH
    ? `${single.slice(0, TITLE_MAX_LENGTH)}…`
    : single
}

/**
 * Index of the first `user` message strictly after `fromIndex`, or
 * `messages.length` when none follows. A user message marks the start of a new
 * turn, so everything between two user messages belongs to a single turn.
 */
function nextUserBoundary(messages: AgentMessage[], fromIndex: number): number {
  for (let index = fromIndex + 1; index < messages.length; index++) {
    if (messages[index].role === 'user') {
      return index
    }
  }
  return messages.length
}

/**
 * Build the seed history for a regeneration. A user target keeps itself and
 * drops everything after it; any other role drops the target and everything
 * after it. The trailing tail is always removed because a regenerated turn
 * invalidates every turn that depended on it.
 */
export function computeRegenerateSeed(
  messages: AgentMessage[],
  targetId: string
): AgentMessage[] | null {
  const index = messages.findIndex((message) => message.id === targetId)
  if (index === -1) {
    return null
  }
  if (messages[index].role === 'user') {
    return messages.slice(0, index + 1)
  }
  return messages.slice(0, index)
}

/**
 * Remove a single turn (the target message plus any trailing assistant/tool
 * messages until the next user message) while preserving later turns. This
 * keeps the OpenAI tool contract valid: an assistant that issued `tool_calls`
 * is removed together with its `tool` results, never leaving an orphan.
 */
export function removeMessageTurn(
  messages: AgentMessage[],
  targetId: string
): AgentMessage[] {
  const index = messages.findIndex((message) => message.id === targetId)
  if (index === -1) {
    return messages
  }
  const boundary = nextUserBoundary(messages, index)
  return [...messages.slice(0, index), ...messages.slice(boundary)]
}

/**
 * Apply an inline edit. The target message content is replaced. When the
 * target is a user message and `submit` is true, the history is truncated after
 * the edited message and a `seed` is returned so the caller can re-run the
 * agent loop. Assistant edits are save-only (no seed).
 */
export function applyAgentEdit(
  messages: AgentMessage[],
  targetId: string,
  content: string,
  submit: boolean
): AgentEditResult | null {
  const index = messages.findIndex((message) => message.id === targetId)
  if (index === -1) {
    return null
  }
  const target = messages[index]
  const updated = messages.map((message) =>
    message.id === targetId ? { ...message, content } : message
  )
  if (submit && target.role === 'user') {
    const truncated = updated.slice(0, index + 1)
    return { messages: truncated, seed: truncated }
  }
  return { messages: updated, seed: null }
}
