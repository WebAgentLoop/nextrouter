import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { AgentConfig, AgentMessage } from '../../types'
import { buildAgentPayload, repairMessageSequence } from './payload-builder'

const config: AgentConfig = {
  model: 'gpt-4o',
  group: 'default',
  temperature: 0.7,
  max_tokens: 4096,
  stream: true,
}

function userMessage(content: string): AgentMessage {
  return { id: `u-${content}`, role: 'user', content, createdAt: 0 }
}

function assistantWithTools(
  content: string,
  toolCalls: AgentMessage['toolCalls']
): AgentMessage {
  return {
    id: 'a-1',
    role: 'assistant',
    content,
    toolCalls,
    createdAt: 0,
  }
}

function toolMessage(toolCallId: string, content: string): AgentMessage {
  return {
    id: `t-${toolCallId}`,
    role: 'tool',
    content,
    toolCallId,
    createdAt: 0,
  }
}

describe('repairMessageSequence', () => {
  test('keeps a fully-answered tool_calls group intact', () => {
    const messages: AgentMessage[] = [
      userMessage('hi'),
      assistantWithTools('', [
        {
          id: 'call_1',
          name: 'calculator',
          argumentsRaw: '{}',
          parsedArguments: {},
          status: 'done',
        },
      ]),
      toolMessage('call_1', '42'),
    ]

    const repaired = repairMessageSequence(messages)

    assert.equal(repaired.length, 3)
    assert.equal(repaired[1].toolCalls?.length, 1)
  })

  test('strips dangling tool_calls when results are missing', () => {
    // User stopped after the model emitted tool_calls but before results.
    const messages: AgentMessage[] = [
      userMessage('hi'),
      assistantWithTools('', [
        {
          id: 'call_1',
          name: 'calculator',
          argumentsRaw: '{}',
          parsedArguments: {},
          status: 'running',
        },
      ]),
    ]

    const repaired = repairMessageSequence(messages)

    assert.equal(repaired.length, 2)
    assert.equal(repaired[1].role, 'assistant')
    assert.equal(repaired[1].toolCalls, undefined)
  })

  test('drops orphan tool messages with no preceding tool_calls group', () => {
    // An assistant without tool_calls, followed by a stray tool message.
    const messages: AgentMessage[] = [
      userMessage('hi'),
      {
        id: 'a-1',
        role: 'assistant',
        content: 'hi back',
        createdAt: 0,
      },
      toolMessage('call_1', 'orphan'),
    ]

    const repaired = repairMessageSequence(messages)

    assert.equal(repaired.length, 2)
    assert.equal(repaired[1].role, 'assistant')
    assert.equal(
      repaired.find((m) => m.role === 'tool'),
      undefined
    )
  })

  test('strips tool_calls when only some results are present', () => {
    const messages: AgentMessage[] = [
      userMessage('hi'),
      assistantWithTools('', [
        {
          id: 'call_1',
          name: 'calculator',
          argumentsRaw: '{}',
          parsedArguments: {},
          status: 'done',
        },
        {
          id: 'call_2',
          name: 'calculator',
          argumentsRaw: '{}',
          parsedArguments: {},
          status: 'running',
        },
      ]),
      toolMessage('call_1', '1'),
    ]

    const repaired = repairMessageSequence(messages)

    // assistant tool_calls stripped because call_2 has no result; the lone
    // tool message becomes orphan and is dropped too.
    assert.equal(repaired.length, 2)
    assert.equal(repaired[1].toolCalls, undefined)
    assert.equal(
      repaired.find((m) => m.role === 'tool'),
      undefined
    )
  })

  test('strips tool_calls when results contain duplicate or unexpected ids', () => {
    const call = {
      id: 'call_1',
      name: 'calculator',
      argumentsRaw: '{}',
      parsedArguments: {},
      status: 'done' as const,
    }
    const duplicate = repairMessageSequence([
      userMessage('hi'),
      assistantWithTools('', [call]),
      toolMessage('call_1', 'first'),
      toolMessage('call_1', 'duplicate'),
    ])
    const unexpected = repairMessageSequence([
      userMessage('hi'),
      assistantWithTools('', [call]),
      toolMessage('call_1', 'answer'),
      toolMessage('call_2', 'unexpected'),
    ])

    assert.equal(duplicate[1].toolCalls, undefined)
    assert.equal(unexpected[1].toolCalls, undefined)
    assert.equal(
      duplicate.some((message) => message.role === 'tool'),
      false
    )
    assert.equal(
      unexpected.some((message) => message.role === 'tool'),
      false
    )
  })
})

describe('buildAgentPayload', () => {
  test('maps user/assistant/system messages to the wire format and attaches tools', () => {
    const messages: AgentMessage[] = [
      userMessage('hello'),
      {
        id: 'a-1',
        role: 'assistant',
        content: 'hi there',
        createdAt: 0,
      },
    ]

    const payload = buildAgentPayload(messages, config)

    assert.equal(payload.model, 'gpt-4o')
    assert.equal(payload.group, 'default')
    assert.equal(payload.stream, true)
    assert.equal(payload.temperature, 0.7)
    assert.equal(payload.max_tokens, 4096)
    assert.ok(Array.isArray(payload.tools))
    assert.ok(
      (payload.tools ?? []).some((tool) => tool.function.name === 'calculator')
    )
    assert.equal(payload.messages.length, 2)
    assert.equal(payload.messages[0].role, 'user')
    assert.equal(payload.messages[0].content, 'hello')
    assert.equal(payload.messages[1].role, 'assistant')
    assert.equal(payload.messages[1].content, 'hi there')
  })

  test('emits assistant tool_calls and matching tool messages in order', () => {
    const messages: AgentMessage[] = [
      userMessage('calc 1+1'),
      assistantWithTools('', [
        {
          id: 'call_1',
          name: 'calculator',
          argumentsRaw: '{"expression":"1+1"}',
          parsedArguments: { expression: '1+1' },
          status: 'done',
          result: '2',
        },
      ]),
      toolMessage('call_1', '2'),
      {
        id: 'a-2',
        role: 'assistant',
        content: 'The answer is 2',
        createdAt: 0,
      },
    ]

    const payload = buildAgentPayload(messages, config)

    assert.equal(payload.messages.length, 4)
    assert.equal(payload.messages[1].role, 'assistant')
    assert.equal(payload.messages[1].tool_calls?.[0].id, 'call_1')
    assert.equal(
      payload.messages[1].tool_calls?.[0].function.name,
      'calculator'
    )
    assert.equal(payload.messages[2].role, 'tool')
    assert.equal(payload.messages[2].tool_call_id, 'call_1')
    assert.equal(payload.messages[2].content, '2')
  })

  test('drops empty/missing tool_call_id tool messages', () => {
    const messages: AgentMessage[] = [
      userMessage('hi'),
      {
        id: 't-bad',
        role: 'tool',
        content: 'orphan',
        createdAt: 0,
      },
    ]

    const payload = buildAgentPayload(messages, config)

    assert.equal(payload.messages.length, 1)
    assert.equal(payload.messages[0].role, 'user')
  })
})
