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
import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { AgentMessage, ToolCall } from '../../types'
import {
  buildTurnDisplayItems,
  getTurnCopyText,
  getTurnView,
  groupTurns,
  processGroupStatus,
} from './turn-builder'

function userMessage(id: string, content: string): AgentMessage {
  return { id, role: 'user', content, createdAt: 0 }
}

function systemMessage(id: string, content: string): AgentMessage {
  return { id, role: 'system', content, createdAt: 0 }
}

function assistantMessage(id: string, content: string): AgentMessage {
  return { id, role: 'assistant', content, createdAt: 0 }
}

function assistantWithReasoning(
  id: string,
  content: string,
  reasoning: string
): AgentMessage {
  return { id, role: 'assistant', content, reasoning, createdAt: 0 }
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

function toolCall(
  id: string,
  status: ToolCall['status'] = 'done',
  result = 'ok'
): ToolCall {
  return {
    id,
    name: id,
    argumentsRaw: '{}',
    parsedArguments: {},
    status,
    result,
  }
}

// user1 -> assistant1(reasoning+tool, empty content) -> tool-result ->
// assistant1b(text) -> user2 -> assistant2(text)
function multiTurnConversation(): AgentMessage[] {
  return [
    userMessage('u1', 'first question'),
    {
      id: 'a1',
      role: 'assistant',
      content: '',
      reasoning: 'let me compute',
      toolCalls: [toolCall('call-1', 'done', '2')],
      createdAt: 0,
    },
    toolMessage('t1', 'call-1', '2'),
    assistantMessage('a1b', 'the answer is 2'),
    userMessage('u2', 'second question'),
    assistantMessage('a2', 'second answer'),
  ]
}

describe('groupTurns', () => {
  test('folds consecutive assistant + tool messages into one ai-turn', () => {
    const items = groupTurns(multiTurnConversation())
    assert.deepEqual(
      items.map((item) => item.kind),
      ['user', 'ai-turn', 'user', 'ai-turn']
    )
  })

  test('ai-turn id is the first message id and carries all member messages', () => {
    const items = groupTurns(multiTurnConversation())
    const firstTurn = items[1]
    assert.equal(firstTurn.kind, 'ai-turn')
    if (firstTurn.kind !== 'ai-turn') return
    assert.equal(firstTurn.id, 'a1')
    assert.deepEqual(
      firstTurn.messages.map((m) => m.id),
      ['a1', 't1', 'a1b']
    )
  })

  test('system messages are standalone cards', () => {
    const items = groupTurns([
      userMessage('u1', 'hi'),
      systemMessage('s1', 'max iterations'),
      assistantMessage('a1', 'answer'),
    ])
    assert.deepEqual(
      items.map((item) => item.kind),
      ['user', 'system', 'ai-turn']
    )
  })

  test('leading assistant message starts a new ai-turn', () => {
    const items = groupTurns([assistantMessage('a1', 'hello')])
    assert.equal(items[0].kind, 'ai-turn')
  })

  test('covered tool result folds into the preceding ai-turn', () => {
    const items = groupTurns([
      assistantWithTools('a1', '', [toolCall('call-1')]),
      toolMessage('t1', 'call-1', '2'),
    ])
    assert.deepEqual(
      items.map((item) => item.kind),
      ['ai-turn']
    )
    const turn = items[0]
    if (turn.kind !== 'ai-turn') return
    assert.deepEqual(
      turn.messages.map((m) => m.id),
      ['a1', 't1']
    )
  })

  test('orphan tool message (no matching assistant) is a standalone item', () => {
    const items = groupTurns([
      assistantMessage('a1', 'answer'),
      toolMessage('t-orphan', 'call-missing', 'leftover'),
    ])
    assert.deepEqual(
      items.map((item) => item.kind),
      ['ai-turn', 'tool']
    )
    const orphan = items[1]
    if (orphan.kind !== 'tool') return
    assert.equal(orphan.message.id, 't-orphan')
  })

  test('tool message with no toolCallId is treated as an orphan', () => {
    const items = groupTurns([toolMessage('t1', '', 'r')])
    assert.equal(items[0].kind, 'tool')
  })

  test('orphan tool with no preceding assistant is standalone', () => {
    const items = groupTurns([toolMessage('t1', 'call-x', 'r')])
    assert.deepEqual(
      items.map((item) => item.kind),
      ['tool']
    )
  })

  test('tool result covered in another turn stays visible as misplaced', () => {
    const items = groupTurns([
      assistantWithTools('a1', '', [toolCall('call-1')]),
      userMessage('u1', 'next'),
      assistantMessage('a2', 'answer'),
      toolMessage('t1', 'call-1', 'late result'),
    ])

    assert.deepEqual(
      items.map((item) => item.kind),
      ['ai-turn', 'user', 'ai-turn', 'tool']
    )
  })
})

describe('buildTurnDisplayItems', () => {
  test('single assistant text -> one text item, no process panel', () => {
    const items = buildTurnDisplayItems([assistantMessage('a1', 'hello')])
    assert.deepEqual(
      items.map((item) => item.kind),
      ['text']
    )
  })

  test('reasoning + tools flush before the following text', () => {
    // Realistic round: reasoning+tool (empty content) then final text.
    const messages: AgentMessage[] = [
      {
        id: 'a1',
        role: 'assistant',
        content: '',
        reasoning: 'let me compute',
        toolCalls: [toolCall('call-1')],
        createdAt: 0,
      },
      toolMessage('t1', 'call-1', '2'),
      assistantMessage('a1b', 'the answer is 2'),
    ]
    const items = buildTurnDisplayItems(messages)
    assert.deepEqual(
      items.map((item) => item.kind),
      ['process', 'text']
    )
    const panel = items[0]
    assert.equal(panel.kind, 'process')
    if (panel.kind !== 'process') return
    assert.equal(panel.items.length, 2)
    assert.equal(panel.items[0].kind, 'reasoning')
    assert.equal(panel.items[1].kind, 'tools')
  })

  test('tool messages are skipped (results live on toolCalls)', () => {
    const messages: AgentMessage[] = [
      assistantWithTools('a1', '', [toolCall('call-1')]),
      toolMessage('t1', 'call-1', '2'),
    ]
    const items = buildTurnDisplayItems(messages)
    // No assistant text -> only the trailing process panel (tools).
    assert.deepEqual(
      items.map((item) => item.kind),
      ['process']
    )
  })

  test('multi-round turn interleaves process panels between text segments', () => {
    const messages: AgentMessage[] = [
      assistantWithTools('a1', '', [toolCall('call-1')]),
      assistantMessage('a1b', 'partial answer'),
      assistantWithReasoning('a2', '', 'rethink'),
      assistantMessage('a2b', 'final answer'),
    ]
    const items = buildTurnDisplayItems(messages)
    assert.deepEqual(
      items.map((item) => item.kind),
      ['process', 'text', 'process', 'text']
    )
  })

  test('empty turn produces nothing', () => {
    assert.deepEqual(buildTurnDisplayItems([]), [])
    assert.deepEqual(buildTurnDisplayItems([assistantMessage('a1', '')]), [])
  })
})

describe('getTurnCopyText', () => {
  test('joins non-empty assistant content with blank lines', () => {
    const messages: AgentMessage[] = [
      assistantMessage('a1', 'first'),
      toolMessage('t1', 'c', 'ignored'),
      assistantMessage('a2', 'second'),
    ]
    assert.equal(getTurnCopyText(messages), 'first\n\nsecond')
  })

  test('skips empty assistant segments', () => {
    const messages: AgentMessage[] = [
      assistantMessage('a1', ''),
      assistantMessage('a2', 'only'),
    ]
    assert.equal(getTurnCopyText(messages), 'only')
  })

  test('returns empty string when no assistant text', () => {
    assert.equal(getTurnCopyText([toolMessage('t1', 'c', 'r')]), '')
  })
})

describe('getTurnView', () => {
  test('id is the first assistant id', () => {
    const messages: AgentMessage[] = [
      assistantMessage('a1', ''),
      assistantMessage('a2', 'text'),
    ]
    assert.equal(getTurnView(messages).id, 'a1')
  })

  test('isStreaming true when any member streams', () => {
    const messages: AgentMessage[] = [
      assistantMessage('a1', 'done'),
      { ...assistantMessage('a2', 'streaming'), isStreaming: true },
    ]
    assert.equal(getTurnView(messages).isStreaming, true)
  })

  test('content is the concatenated copy text', () => {
    const messages: AgentMessage[] = [
      assistantMessage('a1', 'one'),
      assistantMessage('a2', 'two'),
    ]
    assert.equal(getTurnView(messages).content, 'one\n\ntwo')
  })
})

describe('processGroupStatus', () => {
  test('running when any reasoning streams or tool is pending', () => {
    assert.equal(
      processGroupStatus([
        { kind: 'reasoning', messageId: 'a1', content: 'x', isStreaming: true },
      ]),
      'running'
    )
    assert.equal(
      processGroupStatus([
        { kind: 'tools', toolCalls: [toolCall('c1', 'pending')] },
      ]),
      'running'
    )
  })

  test('error surfaces even when other items are done', () => {
    assert.equal(
      processGroupStatus([
        { kind: 'tools', toolCalls: [toolCall('c1', 'done')] },
        { kind: 'tools', toolCalls: [toolCall('c2', 'error')] },
      ]),
      'error'
    )
  })

  test('done when everything settled', () => {
    assert.equal(
      processGroupStatus([
        {
          kind: 'reasoning',
          messageId: 'a1',
          content: 'x',
          isStreaming: false,
        },
        { kind: 'tools', toolCalls: [toolCall('c1', 'done')] },
      ]),
      'done'
    )
  })

  test('empty panel is done', () => {
    assert.equal(processGroupStatus([]), 'done')
  })
})
