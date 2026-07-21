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
export {
  calculatorArgsSchema,
  calculatorTool,
  evaluateExpression,
} from './tools/builtins/calculator'
export type {
  CalculatorArgs,
  ToolExecuteResult,
  ToolExecutor,
} from './tools/builtins/calculator'
export { getTool, listToolDefinitions } from './tools/registry'
export {
  resolveAgentModel,
  resolveInitialAgentGroup,
} from './config/resolve-agent-config'
export {
  ToolCallAccumulator,
  parseToolCallArguments,
} from './stream/parse-tool-calls'
export {
  getStreamReadyStateError,
  isStreamClosedReadyState,
  isStreamDoneMessage,
  parseChunkUpdate,
  parseStreamErrorDetails,
  type ChunkUpdate,
  type StreamErrorDetails,
} from './stream/stream-utils'
export {
  AgentStreamChunkBuffer,
  type AgentStreamChunkBatch,
  type AgentStreamFlushScheduler,
} from './stream/stream-chunk-buffer'
export {
  buildAgentPayload,
  repairMessageSequence,
} from './stream/payload-builder'
export {
  clearLegacyConversation,
  deleteSession,
  getSession,
  listSessionSummaries,
  listSessions,
  loadLegacyConversation,
  saveSession,
} from './storage/agent-storage'
export {
  clearActiveSessionId,
  getActiveSessionId,
  setActiveSessionId,
} from './storage/active-session'
export {
  applyAgentEdit,
  computeRegenerateSeed,
  createSessionId,
  deriveSessionTitle,
  removeMessageTurn,
  sanitizePersistedMessages,
  DEFAULT_SESSION_TITLE,
  type AgentEditResult,
} from './message/agent-conversation-utils'
