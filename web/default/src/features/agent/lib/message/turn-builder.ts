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
import type { AgentMessage, ToolCall, ToolCallStatus } from '../../types'

/**
 * A render-time grouping of the flat `AgentMessage[]` into conversational turns.
 *
 * - `user` and `system` messages are standalone cards.
 * - Consecutive `assistant` + covered `tool` messages between two user messages fold into
 *   a single `ai-turn`, so a whole AI turn (思考 → 工具调用 → 工具结果 → 正文) renders as
 *   one visual unit. A covered `tool` message (its `toolCallId` matches an assistant's
 *   `toolCalls[].id`) carries no extra render data — its result already lives on that
 *   assistant's `toolCalls[].result` — so it is only kept for copy/persistence symmetry.
 * - An **orphan** `tool` message (no matching assistant tool call, e.g. from a broken or
 *   legacy session) is emitted as a standalone `tool` item so its content is never lost,
 *   mirroring the previous render behavior.
 */
export type TurnItem =
  | { kind: 'user'; message: AgentMessage }
  | { kind: 'system'; message: AgentMessage }
  | { kind: 'tool'; message: AgentMessage }
  | { kind: 'ai-turn'; id: string; messages: AgentMessage[] }

/** A piece of an AI turn's "process" (thinking + tool calls), collected for folding. */
export type ProcessItem =
  | {
      kind: 'reasoning'
      messageId: string
      content: string
      isStreaming: boolean
    }
  | { kind: 'tools'; toolCalls: ToolCall[] }

/**
 * The flattened render plan for an AI turn. Reasoning and tool calls are collected into
 * `process` items and flushed (collapsed) ahead of each `text` segment, so the final
 * answer stays visible while the intermediate steps fold away.
 */
export type TurnDisplayItem =
  | { kind: 'process'; items: ProcessItem[] }
  | { kind: 'text'; message: AgentMessage }

/**
 * Fold the flat message list into turns. A run of `assistant` + covered `tool` messages
 * attaches to the previous ai-turn when one exists, otherwise starts a new one keyed by
 * its first message id. A `tool` message whose `toolCallId` matches no assistant tool call
 * (an orphan) is kept as a standalone item so its content is never silently dropped.
 */
export function groupTurns(messages: AgentMessage[]): TurnItem[] {
  // Every tool-call id issued by some assistant message. A `tool` message is "covered"
  // (already represented by that assistant's toolCalls[].result) only when its id is here.
  const coveredToolCallIds = new Set<string>()
  for (const message of messages) {
    if (message.role === 'assistant' && message.toolCalls) {
      for (const call of message.toolCalls) {
        coveredToolCallIds.add(call.id)
      }
    }
  }

  const items: TurnItem[] = []
  for (const message of messages) {
    if (message.role === 'tool') {
      if (!message.toolCallId || !coveredToolCallIds.has(message.toolCallId)) {
        // Orphan tool result — render standalone so the content is visible.
        items.push({ kind: 'tool', message })
        continue
      }
      const previous = items.at(-1)
      if (previous && previous.kind === 'ai-turn') {
        previous.messages.push(message)
        continue
      }
      // Covered but no ai-turn to attach to — keep visible rather than dropping it.
      items.push({ kind: 'tool', message })
      continue
    }

    if (message.role === 'assistant') {
      const previous = items.at(-1)
      if (previous && previous.kind === 'ai-turn') {
        previous.messages.push(message)
        continue
      }
      items.push({ kind: 'ai-turn', id: message.id, messages: [message] })
      continue
    }

    if (message.role === 'user') {
      items.push({ kind: 'user', message })
    } else {
      items.push({ kind: 'system', message })
    }
  }
  return items
}

/**
 * Build the interleaved render plan for a single AI turn. Only `assistant` messages
 * produce visible structure: their `reasoning` and `toolCalls` are accumulated into a
 * process buffer that is flushed as one collapsible panel whenever a non-empty `content`
 * segment appears (and once more at the end).
 */
export function buildTurnDisplayItems(
  turnMessages: AgentMessage[]
): TurnDisplayItem[] {
  const result: TurnDisplayItem[] = []
  const processItems: ProcessItem[] = []

  const flushProcess = () => {
    if (processItems.length === 0) {
      return
    }
    result.push({ kind: 'process', items: [...processItems] })
    processItems.length = 0
  }

  for (const message of turnMessages) {
    if (message.role !== 'assistant') {
      continue
    }

    const reasoning = message.reasoning?.trim()
    if (reasoning) {
      processItems.push({
        kind: 'reasoning',
        messageId: message.id,
        content: reasoning,
        isStreaming: Boolean(message.isStreaming),
      })
    }

    if (message.toolCalls && message.toolCalls.length > 0) {
      processItems.push({ kind: 'tools', toolCalls: message.toolCalls })
    }

    if (message.content.trim()) {
      flushProcess()
      result.push({ kind: 'text', message })
    }
  }

  flushProcess()
  return result
}

/** Concatenate every non-empty assistant text segment in the turn (for Copy). */
export function getTurnCopyText(turnMessages: AgentMessage[]): string {
  return turnMessages
    .filter((message) => message.role === 'assistant')
    .map((message) => message.content.trim())
    .filter(Boolean)
    .join('\n\n')
}

/**
 * Synthesize a turn-level message view so the existing `AgentMessageActions` can operate
 * on a whole turn without structural changes: `id` is the first assistant id (used by
 * regenerate/delete), `content` is the concatenated text (Copy/Source/hasContent),
 * `isStreaming`/`isError` are true when any member is.
 */
export function getTurnView(turnMessages: AgentMessage[]): AgentMessage {
  const first =
    turnMessages.find((message) => message.role === 'assistant') ??
    turnMessages[0]
  return {
    id: first.id,
    role: 'assistant',
    content: getTurnCopyText(turnMessages),
    createdAt: first.createdAt,
    isStreaming: turnMessages.some((message) => message.isStreaming),
    isError: turnMessages.some((message) => message.isError),
  }
}

/** Aggregate the lifecycle status across reasoning + tool items in a process panel. */
export function processGroupStatus(items: ProcessItem[]): ToolCallStatus {
  const statuses: ToolCallStatus[] = []
  for (const item of items) {
    if (item.kind === 'reasoning') {
      statuses.push(item.isStreaming ? 'running' : 'done')
    } else {
      for (const call of item.toolCalls) {
        statuses.push(call.status)
      }
    }
  }
  if (statuses.length === 0) {
    return 'done'
  }
  if (statuses.some((status) => status === 'running' || status === 'pending')) {
    return 'running'
  }
  if (statuses.some((status) => status === 'error')) {
    return 'error'
  }
  if (statuses.every((status) => status === 'done')) {
    return 'done'
  }
  return 'pending'
}
