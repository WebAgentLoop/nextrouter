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
// Message roles — note the `tool` role for function-call results.
export type AgentRole = 'user' | 'assistant' | 'system' | 'tool'

// High-level run state of the agent loop.
export type AgentRunStatus =
  | 'idle'
  | 'running'
  | 'done'
  | 'error'
  | 'stopped'

// Lifecycle of a single tool call within an assistant message.
export type ToolCallStatus =
  | 'pending'
  | 'running'
  | 'done'
  | 'error'
  | 'cancelled'

// A parsed tool call. `argumentsRaw` is the verbatim JSON string emitted by the
// model (may be malformed); `parsedArguments` is the result of JSON.parse, or
// `undefined` when parsing failed. The registry re-validates via Zod before
// execution, so malformed arguments never crash the loop.
export interface ToolCall {
  id: string
  name: string
  argumentsRaw: string
  parsedArguments: unknown
  status: ToolCallStatus
  result?: string
  isError?: boolean
}

// A single conversation message. Assistant messages carry `toolCalls` when the
// model requested function calls; `role: 'tool'` messages carry the results and
// reference the originating call via `toolCallId`.
export interface AgentMessage {
  id: string
  role: AgentRole
  content: string
  reasoning?: string
  toolCalls?: ToolCall[]
  toolCallId?: string
  toolCallName?: string
  createdAt: number
  isStreaming?: boolean
  isError?: boolean
}

// ---- Tool definitions (OpenAI function-calling schema) ----

export interface ToolFunctionDef {
  name: string
  description: string
  parameters: Record<string, unknown>
}

export interface ToolDefinition {
  type: 'function'
  function: ToolFunctionDef
}

// ---- Configuration ----

export interface AgentConfig {
  model: string
  group: string
  temperature: number
  max_tokens: number
  stream: boolean
}

export interface ModelOption {
  label: string
  value: string
}

export interface GroupOption {
  label: string
  value: string
  ratio: number
  desc?: string
}

// ---- Streaming (OpenAI chat completion chunk with tool_calls delta) ----

export interface ChatCompletionToolCallDelta {
  index: number
  id?: string
  type?: string
  function?: {
    name?: string
    arguments?: string
  }
}

export interface ChatCompletionDelta {
  role?: AgentRole
  content?: string
  reasoning_content?: string
  tool_calls?: ChatCompletionToolCallDelta[]
}

export interface ChatCompletionChunk {
  id: string
  object: string
  created: number
  model: string
  choices: Array<{
    index: number
    delta: ChatCompletionDelta
    finish_reason: string | null
  }>
}

// ---- Request payload (OpenAI chat completion with tools) ----

export interface ApiToolCall {
  id: string
  type: 'function'
  function: { name: string; arguments: string }
}

export interface ApiChatMessage {
  role: AgentRole
  content: string | null
  tool_calls?: ApiToolCall[]
  tool_call_id?: string
}

export interface ChatCompletionRequest {
  model: string
  group?: string
  messages: ApiChatMessage[]
  stream: boolean
  tools?: ToolDefinition[]
  temperature?: number
  max_tokens?: number
}

// ---- Sessions (history / archive) ----

export interface AgentSession {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messages: AgentMessage[]
}

export interface AgentSessionSummary {
  id: string
  title: string
  createdAt: number
  updatedAt: number
  messageCount: number
}
