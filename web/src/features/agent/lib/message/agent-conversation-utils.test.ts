import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { AgentMessage, ToolCall } from '../../types'
import {
  applyAgentEdit,
  computeRegenerateSeed,
  createSessionId,
  deriveSessionTitle,
  removeMessageTurn,
  sanitizePersistedMessages,
} from './agent-conversation-utils'

function userMessage(id: string, content: string): AgentMessage {
  return { id, role: 'user', content, createdAt: 0 }
}

function assistantMessage(id: string, content: string): AgentMessage {
  return { id, role: 'assistant', content, createdAt: 0 }
}

function assistantWithTools(
  id: string,
  content: string,
  toolCalls: ToolCall[]
): AgentMessage {
  return { id, role: 'assistant', content, toolCalls, createdAt: 0 }
}

function toolMessage(
  id: string,
  toolCallId: string,
  content: string
): AgentMessage {
  return { id, role: 'tool', content, toolCallId, createdAt: 0 }
}

// user1 -> assistant1(tool) -> tool-result -> assistant1b -> user2 -> assistant2
function multiTurnConversation(): AgentMessage[] {
  return [
    userMessage('u1', 'first question'),
    assistantWithTools('a1', '', [
      {
        id: 'call-1',
        name: 'calculator',
        argumentsRaw: '{"expression":"1+1"}',
        parsedArguments: { expression: '1+1' },
        status: 'done',
        result: '2',
      },
    ]),
    toolMessage('t1', 'call-1', '2'),
    assistantMessage('a1b', 'the answer is 2'),
    userMessage('u2', 'second question'),
    assistantMessage('a2', 'second answer'),
  ]
}

describe('deriveSessionTitle', () => {
  test('uses the first user message content', () => {
    const title = deriveSessionTitle([
      assistantMessage('a1', 'hi'),
      userMessage('u1', 'Hello world'),
    ])
    assert.equal(title, 'Hello world')
  })

  test('collapses whitespace', () => {
    const title = deriveSessionTitle([
      userMessage('u1', '  hello\n\n  world  '),
    ])
    assert.equal(title, 'hello world')
  })

  test('truncates long content with an ellipsis', () => {
    const long = 'x'.repeat(80)
    const title = deriveSessionTitle([userMessage('u1', long)])
    assert.equal(title.length, 41)
    assert.ok(title.endsWith('…'))
  })

  test('falls back when no user message exists', () => {
    assert.equal(deriveSessionTitle([assistantMessage('a1', 'hi')]), 'New chat')
    assert.equal(deriveSessionTitle([]), 'New chat')
  })
})

describe('createSessionId', () => {
  test('returns unique ids', () => {
    const ids = new Set(Array.from({ length: 50 }, () => createSessionId()))
    assert.equal(ids.size, 50)
  })
})

describe('sanitizePersistedMessages', () => {
  test('settles interrupted streams and unfinished tools without mutating input', () => {
    const messages: AgentMessage[] = [
      {
        ...assistantWithTools('a1', '', [
          {
            id: 'pending',
            name: 'calculator',
            argumentsRaw: '{}',
            parsedArguments: {},
            status: 'pending',
          },
          {
            id: 'done',
            name: 'calculator',
            argumentsRaw: '{}',
            parsedArguments: {},
            status: 'done',
          },
        ]),
        isStreaming: true,
      },
    ]

    const sanitized = sanitizePersistedMessages(messages)

    assert.equal(sanitized[0].isStreaming, false)
    assert.equal(sanitized[0].toolCalls?.[0].status, 'cancelled')
    assert.equal(sanitized[0].toolCalls?.[1].status, 'done')
    assert.equal(messages[0].isStreaming, true)
    assert.equal(messages[0].toolCalls?.[0].status, 'pending')
  })
})

describe('computeRegenerateSeed', () => {
  test('user target keeps through the user and drops the rest', () => {
    const seed = computeRegenerateSeed(multiTurnConversation(), 'u1')
    assert.deepEqual(
      seed?.map((m) => m.id),
      ['u1']
    )
  })

  test('assistant target drops the target and everything after', () => {
    const seed = computeRegenerateSeed(multiTurnConversation(), 'a1b')
    assert.deepEqual(
      seed?.map((m) => m.id),
      ['u1', 'a1', 't1']
    )
  })

  test('unknown id returns null', () => {
    assert.equal(computeRegenerateSeed(multiTurnConversation(), 'nope'), null)
  })
})

describe('removeMessageTurn', () => {
  test('delete a user message drops its whole turn but keeps later turns', () => {
    const result = removeMessageTurn(multiTurnConversation(), 'u1')
    assert.deepEqual(
      result.map((m) => m.id),
      ['u2', 'a2']
    )
  })

  test('delete a tool-calling assistant drops it, its tool results, and the final assistant', () => {
    const result = removeMessageTurn(multiTurnConversation(), 'a1')
    assert.deepEqual(
      result.map((m) => m.id),
      ['u1', 'u2', 'a2']
    )
  })

  test('delete the last assistant truncates the tail', () => {
    const result = removeMessageTurn(multiTurnConversation(), 'a2')
    assert.deepEqual(
      result.map((m) => m.id),
      ['u1', 'a1', 't1', 'a1b', 'u2']
    )
  })

  test('delete never leaves an orphan tool message', () => {
    const result = removeMessageTurn(multiTurnConversation(), 'a1b')
    // a1b removed along with its turn tail; tool t1 belongs to a1 which stays,
    // so t1 must remain attached to its assistant.
    const hasOrphanTool = result.some(
      (m) => m.role === 'tool' && !result.some((r) => r.id === 'a1')
    )
    assert.equal(hasOrphanTool, false)
  })

  test('unknown id leaves messages unchanged', () => {
    const original = multiTurnConversation()
    const result = removeMessageTurn(original, 'nope')
    assert.equal(result, original)
  })
})

describe('applyAgentEdit', () => {
  test('user edit with submit truncates and returns a seed', () => {
    const result = applyAgentEdit(
      multiTurnConversation(),
      'u1',
      'edited first question',
      true
    )
    assert.deepEqual(
      result?.messages.map((m) => m.id),
      ['u1']
    )
    assert.equal(result?.messages[0].content, 'edited first question')
    assert.notEqual(result?.seed, null)
    assert.deepEqual(
      result?.seed?.map((m) => m.id),
      ['u1']
    )
  })

  test('user edit without submit mutates content only and returns no seed', () => {
    const result = applyAgentEdit(
      multiTurnConversation(),
      'u2',
      'edited second',
      false
    )
    assert.deepEqual(
      result?.messages.map((m) => m.id),
      ['u1', 'a1', 't1', 'a1b', 'u2', 'a2']
    )
    assert.equal(result?.seed, null)
    const edited = result?.messages.find((m) => m.id === 'u2')
    assert.equal(edited?.content, 'edited second')
  })

  test('assistant edit is save-only and returns no seed even when submit is true', () => {
    const result = applyAgentEdit(
      multiTurnConversation(),
      'a1b',
      'rewritten answer',
      true
    )
    assert.equal(result?.seed, null)
    const edited = result?.messages.find((m) => m.id === 'a1b')
    assert.equal(edited?.content, 'rewritten answer')
    assert.equal(result?.messages.length, 6)
  })

  test('unknown id returns null', () => {
    assert.equal(
      applyAgentEdit(multiTurnConversation(), 'nope', 'x', false),
      null
    )
  })
})
