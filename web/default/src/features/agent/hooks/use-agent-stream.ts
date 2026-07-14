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
import { useCallback, useRef } from 'react'
import { SSE } from 'sse.js'

import { getCommonHeaders } from '@/lib/api'

import { API_ENDPOINTS, ERROR_MESSAGES } from '../constants'
import {
  getStreamReadyStateError,
  isStreamClosedReadyState,
  isStreamDoneMessage,
  parseChunkUpdate,
  parseStreamErrorDetails,
  ToolCallAccumulator,
} from '../lib'
import type { ChatCompletionRequest, ToolCall } from '../types'

export interface StreamRoundHandlers {
  onContent: (chunk: string) => void
  onReasoning: (chunk: string) => void
}

export interface StreamRoundResult {
  finishReason: string | null
  toolCalls: ToolCall[]
}

export class AgentStreamError extends Error {
  errorCode?: string

  constructor(message: string, errorCode?: string) {
    super(message)
    this.name = 'AgentStreamError'
    this.errorCode = errorCode
  }
}

/**
 * Drives a single streaming chat-completion round against `/pg/chat/completions`.
 *
 * Returns a promise that resolves with the final finish_reason and the fully
 * accumulated (parsed) tool calls, or rejects with `AgentStreamError` on
 * network/parse errors and on abort. `onContent` / `onReasoning` deliver
 * incremental updates as the stream progresses.
 */
export function useAgentStream() {
  const sseSourceRef = useRef<SSE | null>(null)

  const closeStream = useCallback(() => {
    sseSourceRef.current?.close()
    sseSourceRef.current = null
  }, [])

  const streamOneRound = useCallback(
    (
      payload: ChatCompletionRequest,
      handlers: StreamRoundHandlers,
      signal: AbortSignal
    ): Promise<StreamRoundResult> => {
      return new Promise<StreamRoundResult>((resolve, reject) => {
        if (signal.aborted) {
          reject(new AgentStreamError(ERROR_MESSAGES.INTERRUPTED))
          return
        }

        sseSourceRef.current?.close()
        const accumulator = new ToolCallAccumulator()
        let lastFinishReason: string | null = null
        let isComplete = false

        const source = new SSE(API_ENDPOINTS.CHAT_COMPLETIONS, {
          headers: getCommonHeaders(),
          method: 'POST',
          payload: JSON.stringify(payload),
        })
        sseSourceRef.current = source

        const teardown = () => {
          source.close()
          if (sseSourceRef.current === source) {
            sseSourceRef.current = null
          }
        }

        const finish = (result: StreamRoundResult) => {
          if (isComplete) {
            return
          }
          isComplete = true
          teardown()
          signal.removeEventListener('abort', onAbort)
          resolve(result)
        }

        const fail = (error: AgentStreamError) => {
          if (isComplete) {
            return
          }
          isComplete = true
          teardown()
          signal.removeEventListener('abort', onAbort)
          reject(error)
        }

        const onAbort = () => {
          fail(new AgentStreamError(ERROR_MESSAGES.INTERRUPTED))
        }
        signal.addEventListener('abort', onAbort, { once: true })

        source.addEventListener('message', (event: MessageEvent) => {
          if (isStreamDoneMessage(event.data)) {
            finish({
              finishReason: lastFinishReason,
              toolCalls: accumulator.build(),
            })
            return
          }

          try {
            const update = parseChunkUpdate(event.data)
            if (update.finishReason) {
              lastFinishReason = update.finishReason
            }
            if (update.content) {
              handlers.onContent(update.content)
            }
            if (update.reasoning) {
              handlers.onReasoning(update.reasoning)
            }
            if (update.toolCallDeltas) {
              accumulator.apply(update.toolCallDeltas)
            }
          } catch {
            fail(new AgentStreamError(ERROR_MESSAGES.PARSE_ERROR))
          }
        })

        source.addEventListener('error', (event: Event & { data?: string }) => {
          if (isStreamClosedReadyState(source.readyState)) {
            return
          }
          const { errorCode, errorMessage } = parseStreamErrorDetails(
            event.data
          )
          fail(new AgentStreamError(errorMessage, errorCode))
        })

        source.addEventListener(
          'readystatechange',
          (event: Event & { readyState?: number }) => {
            const errorMessage = getStreamReadyStateError(
              event.readyState,
              source
            )
            if (errorMessage) {
              fail(new AgentStreamError(errorMessage))
              return
            }
            if (
              isStreamClosedReadyState(event.readyState) &&
              (source as { status?: number }).status === 200
            ) {
              finish({
                finishReason: lastFinishReason,
                toolCalls: accumulator.build(),
              })
            }
          }
        )

        try {
          source.stream()
        } catch {
          fail(new AgentStreamError(ERROR_MESSAGES.STREAM_START_ERROR))
        }
      })
    },
    []
  )

  return { streamOneRound, closeStream }
}
