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
import { useCallback, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ERROR_MESSAGES, MAX_AGENT_ITERATIONS } from '../constants'
import { buildAgentPayload, getTool, listToolDefinitions } from '../lib'
import type {
  AgentConfig,
  AgentMessage,
  AgentRunStatus,
  ToolCall,
} from '../types'
import {
  AgentStreamError,
  useAgentStream,
  type StreamRoundResult,
} from './use-agent-stream'

interface UseAgentRunOptions {
  config: AgentConfig
  status: AgentRunStatus
  setStatus: (status: AgentRunStatus) => void
  updateMessages: (updater: (prev: AgentMessage[]) => AgentMessage[]) => void
  // Seed messages at run start (the persisted conversation before this turn).
  messagesRef: { current: AgentMessage[] }
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isToolCallRound(result: StreamRoundResult): boolean {
  return result.finishReason === 'tool_calls' && result.toolCalls.length > 0
}

/**
 * Orchestrates the agent loop: send -> stream -> if tool_calls, execute tools
 * and feed results back -> repeat until the model emits a final answer or the
 * iteration bound is hit.
 *
 * A local `roundMessages` array is the single source of truth for the duration
 * of a run; every mutation is committed to React state via `updateMessages`.
 * This keeps the streaming content, attached tool_calls, and appended tool
 * results perfectly in sync with the payload we send on the next round.
 */
export function useAgentRun({
  config,
  status,
  setStatus,
  updateMessages,
  messagesRef,
}: UseAgentRunOptions) {
  const { t } = useTranslation()
  const { streamOneRound, closeStream } = useAgentStream()
  const abortControllerRef = useRef<AbortController | null>(null)
  const isRunningRef = useRef(false)
  const [isRunning, setIsRunning] = useState(false)

  const isGenerating = isRunning || status === 'running'

  const run = useCallback(
    async (userInput: string) => {
      if (isRunningRef.current) {
        return
      }
      const trimmed = userInput.trim()
      if (!trimmed) {
        return
      }

      const controller = new AbortController()
      abortControllerRef.current = controller
      isRunningRef.current = true
      setIsRunning(true)
      setStatus('running')

      // Local source of truth for this run, seeded with the current
      // conversation + the new user message.
      let roundMessages: AgentMessage[] = [
        ...messagesRef.current,
        {
          id: createId(),
          role: 'user',
          content: trimmed,
          createdAt: Date.now(),
        },
      ]
      const commit = () => {
        updateMessages(() => roundMessages)
      }

      commit()

      try {
        for (let iteration = 0; iteration < MAX_AGENT_ITERATIONS; iteration++) {
          if (controller.signal.aborted) {
            setStatus('stopped')
            return
          }

          // Build the payload from history BEFORE appending the streaming
          // assistant target (the model generates into that slot, it must not
          // appear in the request).
          const payload = buildAgentPayload(
            roundMessages,
            config,
            listToolDefinitions()
          )

          const assistantId = createId()
          roundMessages = [
            ...roundMessages,
            {
              id: assistantId,
              role: 'assistant',
              content: '',
              isStreaming: true,
              createdAt: Date.now(),
            },
          ]
          commit()

          const updateAssistant = (
            mutate: (message: AgentMessage) => AgentMessage
          ) => {
            roundMessages = roundMessages.map((message) =>
              message.id === assistantId ? mutate(message) : message
            )
            commit()
          }

          let result: StreamRoundResult
          try {
            result = await streamOneRound(
              payload,
              {
                onContent: (chunk) => {
                  updateAssistant((message) => ({
                    ...message,
                    content: message.content + chunk,
                  }))
                },
                onReasoning: (chunk) => {
                  updateAssistant((message) => ({
                    ...message,
                    reasoning: (message.reasoning ?? '') + chunk,
                  }))
                },
              },
              controller.signal
            )
          } catch (error) {
            if (controller.signal.aborted) {
              updateAssistant((current) => ({
                ...current,
                isStreaming: false,
              }))
              setStatus('stopped')
              return
            }
            const message =
              error instanceof AgentStreamError
                ? error.message
                : ERROR_MESSAGES.API_REQUEST_ERROR
            updateAssistant((current) => ({
              ...current,
              isStreaming: false,
              isError: true,
              content: current.content || message,
            }))
            setStatus('error')
            toast.error(t(message))
            return
          }

          const toolCalls: ToolCall[] = result.toolCalls
          updateAssistant((current) => ({
            ...current,
            isStreaming: false,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          }))

          // No tool calls (or non-tool_calls finish_reason) -> terminal answer.
          if (!isToolCallRound(result)) {
            setStatus('done')
            return
          }

          // Execute each requested tool and append its result as a `tool`
          // message, so the next round carries the full contract.
          for (const call of toolCalls) {
            if (controller.signal.aborted) {
              updateAssistant((current) => ({
                ...current,
                toolCalls: (current.toolCalls ?? []).map((item) =>
                  item.id === call.id
                    ? { ...item, status: 'cancelled' }
                    : item
                ),
              }))
              setStatus('stopped')
              return
            }

            updateAssistant((current) => ({
              ...current,
              toolCalls: (current.toolCalls ?? []).map((item) =>
                item.id === call.id ? { ...item, status: 'running' } : item
              ),
            }))

            const tool = getTool(call.name)
            let execResult: {
              content: string
              isError?: boolean
            }
            if (!tool) {
              execResult = {
                content: `${t(ERROR_MESSAGES.TOOL_NOT_FOUND)}: ${call.name}`,
                isError: true,
              }
            } else {
              try {
                execResult = await tool.execute(
                  call.parsedArguments,
                  controller.signal
                )
              } catch (err) {
                const msg =
                  err instanceof Error
                    ? err.message
                    : t(ERROR_MESSAGES.TOOL_EXECUTION_FAILED)
                execResult = { content: msg, isError: true }
              }
            }

            if (controller.signal.aborted) {
              updateAssistant((current) => ({
                ...current,
                toolCalls: (current.toolCalls ?? []).map((item) =>
                  item.id === call.id
                    ? { ...item, status: 'cancelled' }
                    : item
                ),
              }))
              setStatus('stopped')
              return
            }

            updateAssistant((current) => ({
              ...current,
              toolCalls: (current.toolCalls ?? []).map((item) =>
                item.id === call.id
                  ? {
                      ...item,
                      status: execResult.isError ? 'error' : 'done',
                      result: execResult.content,
                      isError: execResult.isError,
                    }
                  : item
              ),
            }))

            roundMessages = [
              ...roundMessages,
              {
                id: createId(),
                role: 'tool',
                content: execResult.content,
                toolCallId: call.id,
                toolCallName: call.name,
                isError: execResult.isError,
                createdAt: Date.now(),
              },
            ]
            commit()
          }
          // Loop: the next iteration sends the updated history including the
          // assistant tool_calls and all tool results.
        }

        // Iteration bound reached — surface a system note and stop.
        roundMessages = [
          ...roundMessages,
          {
            id: createId(),
            role: 'system',
            content: t(ERROR_MESSAGES.MAX_ITERATIONS),
            createdAt: Date.now(),
          },
        ]
        commit()
        setStatus('done')
      } catch {
        if (controller.signal.aborted) {
          setStatus('stopped')
        } else {
          setStatus('error')
          toast.error(t(ERROR_MESSAGES.API_REQUEST_ERROR))
        }
      } finally {
        setIsRunning(false)
        isRunningRef.current = false
        abortControllerRef.current = null
      }
    },
    [config, setStatus, streamOneRound, t, updateMessages, messagesRef]
  )

  const stop = useCallback(() => {
    closeStream()
    abortControllerRef.current?.abort()
  }, [closeStream])

  return { run, stop, isGenerating }
}
