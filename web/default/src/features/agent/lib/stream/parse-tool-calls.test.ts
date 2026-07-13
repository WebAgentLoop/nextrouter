import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  parseToolCallArguments,
  ToolCallAccumulator,
} from './parse-tool-calls'

describe('parseToolCallArguments', () => {
  test('empty string yields empty object', () => {
    assert.deepEqual(parseToolCallArguments(''), {})
  })

  test('valid JSON parses to its value', () => {
    assert.deepEqual(parseToolCallArguments('{"expression":"1+1"}'), {
      expression: '1+1',
    })
  })

  test('malformed JSON yields undefined (never throws)', () => {
    assert.equal(parseToolCallArguments('{not json'), undefined)
    assert.equal(parseToolCallArguments('{"unclosed":'), undefined)
  })
})

describe('ToolCallAccumulator', () => {
  test('accumulates a single tool call fragmented across chunks', () => {
    const acc = new ToolCallAccumulator()

    // First chunk: id + name, empty arguments start.
    acc.apply([
      {
        index: 0,
        id: 'call_1',
        type: 'function',
        function: { name: 'calculator', arguments: '' },
      },
    ])
    // Subsequent chunks: only argument fragments.
    acc.apply([
      { index: 0, function: { arguments: '{"expression":' } },
    ])
    acc.apply([{ index: 0, function: { arguments: ' "1+1"}' } }])

    const result = acc.build()

    assert.equal(result.length, 1)
    assert.equal(result[0].id, 'call_1')
    assert.equal(result[0].name, 'calculator')
    assert.equal(result[0].argumentsRaw, '{"expression": "1+1"}')
    assert.deepEqual(result[0].parsedArguments, { expression: '1+1' })
    assert.equal(result[0].status, 'pending')
  })

  test('tracks multiple tool calls by index and orders by index', () => {
    const acc = new ToolCallAccumulator()

    acc.apply([
      { index: 1, id: 'call_b', function: { name: 'calculator', arguments: '{}' } },
      { index: 0, id: 'call_a', function: { name: 'calculator', arguments: '{}' } },
    ])

    const result = acc.build()

    assert.equal(result.length, 2)
    assert.equal(result[0].id, 'call_a')
    assert.equal(result[1].id, 'call_b')
  })

  test('preserves first-seen id and name when later deltas omit them', () => {
    const acc = new ToolCallAccumulator()

    acc.apply([
      { index: 0, id: 'call_x', function: { name: 'calculator' } },
    ])
    acc.apply([{ index: 0, function: { arguments: 'broken' } }])

    const result = acc.build()

    assert.equal(result[0].id, 'call_x')
    assert.equal(result[0].name, 'calculator')
    assert.equal(result[0].argumentsRaw, 'broken')
    assert.equal(result[0].parsedArguments, undefined)
  })

  test('ignores empty/undefined deltas', () => {
    const acc = new ToolCallAccumulator()
    acc.apply(undefined)
    acc.apply([])

    assert.equal(acc.isEmpty, true)
    assert.deepEqual(acc.build(), [])
  })

  test('build can be called repeatedly producing fresh arrays', () => {
    const acc = new ToolCallAccumulator()
    acc.apply([{ index: 0, id: 'c', function: { name: 'calculator', arguments: '{}' } }])

    const first = acc.build()
    const second = acc.build()

    assert.notEqual(first, second)
    assert.deepEqual(first, second)
  })
})
