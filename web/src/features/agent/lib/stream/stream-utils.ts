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
import { ERROR_MESSAGES } from '../../constants'
import type {
  ChatCompletionChunk,
  ChatCompletionToolCallDelta,
} from '../../types'

const STREAM_DONE_MESSAGE = '[DONE]'
const STREAM_CLOSED_READY_STATE = 2

export type StreamErrorDetails = {
  errorCode?: string
  errorMessage: string
}

export function isStreamDoneMessage(data: string): boolean {
  return data === STREAM_DONE_MESSAGE
}

export function isStreamClosedReadyState(readyState?: number): boolean {
  return readyState === STREAM_CLOSED_READY_STATE
}

export function parseStreamErrorDetails(data?: string): StreamErrorDetails {
  const fallbackMessage = data || ERROR_MESSAGES.API_REQUEST_ERROR

  if (!data) {
    return { errorMessage: fallbackMessage }
  }

  try {
    const parsed = JSON.parse(data) as {
      error?: { code?: string; message?: string }
    }

    if (!parsed?.error) {
      return { errorMessage: fallbackMessage }
    }

    return {
      errorCode: parsed.error.code || undefined,
      errorMessage: parsed.error.message || fallbackMessage,
    }
  } catch {
    return { errorMessage: fallbackMessage }
  }
}

export function getStreamReadyStateError(
  eventReadyState: number | undefined,
  source: unknown
): string | null {
  const status = (source as { status?: number }).status

  if (
    eventReadyState !== undefined &&
    eventReadyState >= STREAM_CLOSED_READY_STATE &&
    status !== undefined &&
    status !== 200
  ) {
    return `HTTP ${status}: ${ERROR_MESSAGES.CONNECTION_CLOSED}`
  }

  return null
}

export interface ChunkUpdate {
  content?: string
  reasoning?: string
  toolCallDeltas?: ChatCompletionToolCallDelta[]
  finishReason?: string | null
}

/**
 * Parse a single SSE `data` payload into the fields the agent loop cares about.
 * Throws on malformed JSON; the caller decides how to surface that.
 */
export function parseChunkUpdate(data: string): ChunkUpdate {
  const chunk = JSON.parse(data) as ChatCompletionChunk
  const choice = chunk.choices?.[0]
  const delta = choice?.delta

  const update: ChunkUpdate = { finishReason: choice?.finish_reason ?? null }

  if (delta) {
    if (delta.reasoning_content) {
      update.reasoning = delta.reasoning_content
    }
    if (delta.content) {
      update.content = delta.content
    }
    if (delta.tool_calls && delta.tool_calls.length > 0) {
      update.toolCallDeltas = delta.tool_calls
    }
  }

  return update
}
