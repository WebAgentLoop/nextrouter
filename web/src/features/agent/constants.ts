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
import type { AgentConfig } from './types'

// API endpoints — the agent reuses the playground chat completions relay,
// which is a transparent OpenAI-format passthrough that already supports
// `tools`, `tool_calls`, and the `tool` role.
export const API_ENDPOINTS = {
  CHAT_COMPLETIONS: '/pg/chat/completions',
  USER_MODELS: '/api/user/models',
  USER_GROUPS: '/api/user/self/groups',
} as const

// Safe fallback group; auto-group is only selected when the backend confirms
// it is available for the user.
export const DEFAULT_GROUP = 'default' as const

// Hard upper bound on agent iterations. Prevents infinite tool-call loops
// when a model keeps requesting tools without converging on a final answer.
export const MAX_AGENT_ITERATIONS = 10

export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: 'gpt-4o',
  group: DEFAULT_GROUP,
  temperature: 0.7,
  max_tokens: 4096,
  stream: true,
}

// IndexedDB layout for persisting agent sessions. v2 adds the `sessions`
// store keyed by session id (multi-conversation history); the legacy
// `conversation` store is retained only to migrate the single `current`
// record from v1 on first load.
export const AGENT_DB_NAME = 'new-api-agent'
export const AGENT_DB_VERSION = 2
export const AGENT_CONVERSATION_STORE = 'conversation'
export const AGENT_CONVERSATION_KEY = 'current'
export const AGENT_SESSIONS_STORE = 'sessions'

// localStorage key holding the id of the session currently displayed.
export const ACTIVE_SESSION_STORAGE_KEY = 'agent:active-session-id'

// Soft cap on the number of persisted sessions; oldest are pruned on save.
export const MAX_STORED_SESSIONS = 50

// Error message keys. Values are English fallbacks identical to the i18n key.
// Display sites MUST wrap these with t(); they are never shown verbatim.
export const ERROR_MESSAGES = {
  API_REQUEST_ERROR: 'Request error occurred',
  NETWORK_ERROR: 'Network connection failed or server not responding',
  PARSE_ERROR: 'Error parsing response data',
  STREAM_START_ERROR: 'Error establishing connection',
  CONNECTION_CLOSED: 'Connection closed',
  INTERRUPTED: 'Generation was interrupted',
  MAX_ITERATIONS: 'Max iterations reached',
  TOOL_ARGS_INVALID: 'Tool arguments are invalid',
  TOOL_NOT_FOUND: 'Tool not found',
  TOOL_EXECUTION_FAILED: 'Tool execution failed',
} as const

// Message action labels. Values are English fallbacks identical to the i18n
// key. Display sites MUST wrap these with t(); they are never shown verbatim.
export const MESSAGE_ACTION_LABELS = {
  COPY: 'Copy',
  COPIED: 'Copied!',
  REGENERATE: 'Regenerate',
  SHOW_PREVIEW: 'Show preview',
  SHOW_SOURCE: 'Show source',
  EDIT: 'Edit',
  DELETE: 'Delete',
  NO_CONTENT: 'No content to copy',
  WAIT_GENERATION: 'Please wait for the current generation to complete',
} as const

// Message action button styles (mirrors the playground toolbar sizing).
export const MESSAGE_ACTION_BUTTON_STYLES = {
  BASE: 'size-7 text-muted-foreground hover:text-foreground',
  DELETE: 'size-7 text-muted-foreground hover:text-destructive',
  ICON: 'size-4',
} as const
