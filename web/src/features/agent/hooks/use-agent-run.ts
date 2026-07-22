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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { ABSOLUTE_MAX_AGENT_ITERATIONS, ERROR_MESSAGES } from '../constants'
import {
  applyAgentEdit,
  AgentStreamChunkBuffer,
  buildAgentPayload,
  computeRegenerateSeed,
  getTool,
  getToolPackSystemInstructions,
  getToolPackTools,
  listToolDefinitions,
} from '../lib'
import type { AgentToolPack } from '../lib/tools/registry'
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
  toolPacks?: AgentToolPack[]
}

function createId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function isToolCallRound(result: StreamRoundResult): boolean {
  return result.toolCalls.length > 0
}

function cancelIncompleteToolCalls(message: AgentMessage): AgentMessage {
  if (!message.toolCalls) {
    return message
  }
  return {
    ...message,
    toolCalls: message.toolCalls.map((call) =>
      call.status === 'pending' || call.status === 'running'
        ? { ...call, status: 'cancelled' }
        : call
    ),
  }
}

/**
 * Orchestrates the agent loop. A shared `runLoop(seed)` drives the streaming
 * tool-call cycle from a given starting history; `run`, `regenerate`, and
 * edit-and-submit each compute a seed then invoke it.
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
  toolPacks = [],
}: UseAgentRunOptions) {
  const { t } = useTranslation()
  const { streamOneRound, closeStream } = useAgentStream()
  const abortControllerRef = useRef<AbortController | null>(null)
  const activeChunkBufferRef = useRef<AgentStreamChunkBuffer | null>(null)
  const isRunningRef = useRef(false)
  const [isRunning, setIsRunning] = useState(false)

  const isGenerating = isRunning || status === 'running'

  const runLoop = useCallback(
    async (seed: AgentMessage[]) => {
      const controller = new AbortController()
      abortControllerRef.current = controller
      isRunningRef.current = true
      setIsRunning(true)
      setStatus('running')

      let roundMessages: AgentMessage[] = seed
      const commit = () => {
        updateMessages(() => roundMessages)
      }

      commit()

      try {
        const activeTools = getToolPackTools(toolPacks)
        const toolPackSystemInstructions =
          getToolPackSystemInstructions(toolPacks)
        const iterationLimit = Math.min(
          config.max_iterations,
          ABSOLUTE_MAX_AGENT_ITERATIONS
        )
        for (let iteration = 0; iteration < iterationLimit; iteration++) {
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
            listToolDefinitions(activeTools),
            toolPackSystemInstructions
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

          const chunkBuffer = new AgentStreamChunkBuffer((batch) => {
            updateAssistant((message) => ({
              ...message,
              content: message.content + batch.content,
              reasoning: batch.reasoning
                ? (message.reasoning ?? '') + batch.reasoning
                : message.reasoning,
            }))
          })
          activeChunkBufferRef.current = chunkBuffer

          let result: StreamRoundResult
          try {
            result = await streamOneRound(
              payload,
              {
                onContent: (chunk) => chunkBuffer.pushContent(chunk),
                onReasoning: (chunk) => chunkBuffer.pushReasoning(chunk),
              },
              controller.signal
            )
          } catch (error) {
            chunkBuffer.flush()
            activeChunkBufferRef.current = null
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
            const displayMessage = t(message)
            updateAssistant((current) => ({
              ...current,
              isStreaming: false,
              isError: true,
              content: current.content || displayMessage,
            }))
            setStatus('error')
            toast.error(displayMessage)
            return
          }

          chunkBuffer.flush()
          activeChunkBufferRef.current = null
          const toolCalls: ToolCall[] = result.toolCalls
          updateAssistant((current) => ({
            ...current,
            isStreaming: false,
            toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
          }))

          // No emitted tool calls means this round produced the terminal answer.
          if (!isToolCallRound(result)) {
            setStatus('done')
            return
          }

          // Execute each requested tool and append its result as a `tool`
          // message, so the next round carries the full contract.
          for (const call of toolCalls) {
            if (controller.signal.aborted) {
              updateAssistant(cancelIncompleteToolCalls)
              setStatus('stopped')
              return
            }

            updateAssistant((current) => ({
              ...current,
              toolCalls: (current.toolCalls ?? []).map((item) =>
                item.id === call.id ? { ...item, status: 'running' } : item
              ),
            }))

            const tool = getTool(call.name, activeTools)
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
              updateAssistant(cancelIncompleteToolCalls)
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
        activeChunkBufferRef.current?.clear()
        activeChunkBufferRef.current = null
        setIsRunning(false)
        isRunningRef.current = false
        abortControllerRef.current = null
      }
    },
    [config, setStatus, streamOneRound, t, toolPacks, updateMessages]
  )

  const run = useCallback(
    async (userInput: string) => {
      if (isRunningRef.current) {
        return
      }
      const trimmed = userInput.trim()
      if (!trimmed) {
        return
      }
      const seed: AgentMessage[] = [
        ...messagesRef.current,
        {
          id: createId(),
          role: 'user',
          content: trimmed,
          createdAt: Date.now(),
        },
      ]
      await runLoop(seed)
    },
    [messagesRef, runLoop]
  )

  const regenerate = useCallback(
    async (targetId: string) => {
      if (isRunningRef.current) {
        return
      }
      const seed = computeRegenerateSeed(messagesRef.current, targetId)
      if (!seed) {
        return
      }
      await runLoop(seed)
    },
    [messagesRef, runLoop]
  )

  const editMessage = useCallback(
    async (targetId: string, content: string, submit: boolean) => {
      if (isRunningRef.current) {
        return
      }
      const result = applyAgentEdit(
        messagesRef.current,
        targetId,
        content,
        submit
      )
      if (!result) {
        return
      }
      updateMessages(() => result.messages)
      if (result.seed) {
        await runLoop(result.seed)
      }
    },
    [messagesRef, runLoop, updateMessages]
  )

  const stop = useCallback(() => {
    abortControllerRef.current?.abort()
    closeStream()
  }, [closeStream])

  useEffect(
    () => () => {
      activeChunkBufferRef.current?.clear()
      activeChunkBufferRef.current = null
      abortControllerRef.current?.abort()
      closeStream()
    },
    [closeStream]
  )

  return { run, regenerate, editMessage, stop, isGenerating }
}
