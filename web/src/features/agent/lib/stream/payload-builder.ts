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
import type {
  AgentConfig,
  AgentMessage,
  ApiChatMessage,
  ChatCompletionRequest,
  ToolDefinition,
} from '../../types'
import { listToolDefinitions } from '../tools/registry'

/**
 * Convert an in-app agent message to the OpenAI wire format.
 */
function toApiMessage(message: AgentMessage): ApiChatMessage | null {
  switch (message.role) {
    case 'user':
    case 'system':
      return { role: message.role, content: message.content }
    case 'assistant': {
      if (message.toolCalls && message.toolCalls.length > 0) {
        return {
          role: 'assistant',
          content: message.content || null,
          tool_calls: message.toolCalls.map((call) => ({
            id: call.id,
            type: 'function',
            function: {
              name: call.name,
              arguments: call.argumentsRaw || '{}',
            },
          })),
        }
      }
      if (!message.content.trim()) {
        return null
      }
      return { role: 'assistant', content: message.content }
    }
    case 'tool': {
      if (!message.toolCallId) {
        return null
      }
      return {
        role: 'tool',
        content: message.content,
        tool_call_id: message.toolCallId,
      }
    }
    default:
      return null
  }
}

/**
 * Repair a conversation so it is always safe to send upstream.
 *
 * OpenAI requires that an assistant message carrying `tool_calls` be followed
 * by exactly one `tool` message per call id. When a run is interrupted (user
 * pressed Stop) after the model emitted tool_calls but before all tools
 * finished, the stored conversation is dangling. This pass:
 *   - keeps an assistant+tool_calls group only if every call id has a tool
 *     result immediately after it; otherwise strips the tool_calls, and
 *   - drops orphan `tool` messages that no longer follow a tool_calls group.
 */
export function repairMessageSequence(
  messages: AgentMessage[]
): AgentMessage[] {
  const result: AgentMessage[] = []

  for (let i = 0; i < messages.length; i++) {
    const message = messages[i]

    if (
      message.role === 'assistant' &&
      message.toolCalls &&
      message.toolCalls.length > 0
    ) {
      const expectedIds = message.toolCalls.map((call) => call.id)
      const toolMessages: AgentMessage[] = []
      let j = i + 1
      while (j < messages.length && messages[j].role === 'tool') {
        toolMessages.push(messages[j])
        j++
      }

      const answeredIds = new Set(toolMessages.map((m) => m.toolCallId))
      const hasValidCallIds =
        expectedIds.every(Boolean) &&
        new Set(expectedIds).size === expectedIds.length
      const fullyAnswered =
        hasValidCallIds &&
        toolMessages.length === expectedIds.length &&
        answeredIds.size === expectedIds.length &&
        expectedIds.every((id) => answeredIds.has(id))

      if (fullyAnswered) {
        result.push(message)
        result.push(...toolMessages)
      } else {
        result.push({ ...message, toolCalls: undefined })
      }
      i = j - 1
      continue
    }

    if (message.role === 'tool') {
      // Orphan tool message (its assistant group was stripped or never existed).
      continue
    }

    result.push(message)
  }

  return result
}

/**
 * Build the chat-completion request payload for one agent round.
 */
export function buildAgentPayload(
  messages: AgentMessage[],
  config: AgentConfig,
  tools?: ToolDefinition[],
  toolPackSystemInstructions: string[] = []
): ChatCompletionRequest {
  const apiMessages = repairMessageSequence(
    messages.filter((message) => !message.isError)
  )
    .map(toApiMessage)
    .filter((message): message is ApiChatMessage => message !== null)

  const systemSections = [config.system_prompt, ...toolPackSystemInstructions]
    .map((section) => section.trim())
    .filter(Boolean)
  if (systemSections.length > 0) {
    apiMessages.unshift({
      role: 'system',
      content: systemSections.join('\n\n'),
    })
  }

  const payload: ChatCompletionRequest = {
    model: config.model,
    group: config.group,
    messages: apiMessages,
    stream: config.stream,
    tools: tools ?? listToolDefinitions(),
  }

  if (config.temperature !== null) {
    payload.temperature = config.temperature
  }
  if (config.max_tokens !== null) {
    payload.max_tokens = config.max_tokens
  }

  return payload
}
