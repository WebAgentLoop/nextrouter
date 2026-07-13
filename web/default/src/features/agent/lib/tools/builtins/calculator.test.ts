import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import { calculatorTool, evaluateExpression } from './calculator'

describe('evaluateExpression', () => {
  const cases: Array<{ expression: string; expected: number }> = [
    { expression: '1 + 1', expected: 2 },
    { expression: '2 + 3 * 4', expected: 14 },
    { expression: '(2 + 3) * 4', expected: 20 },
    { expression: '10 / 4', expected: 2.5 },
    { expression: '10 % 3', expected: 1 },
    { expression: '2 ^ 10', expected: 1024 },
    { expression: '2 ^ 3 ^ 2', expected: 512 }, // right-associative
    { expression: '-5 + 3', expected: -2 },
    { expression: '-(2 + 3)', expected: -5 },
    { expression: '3.5 * 2', expected: 7 },
    { expression: '1.5 + 2.5', expected: 4 },
    { expression: '   7   ', expected: 7 },
    { expression: '+7', expected: 7 },
    { expression: '2 * -3', expected: -6 },
    { expression: '100 / 2 / 5', expected: 10 },
  ]

  for (const { expression, expected } of cases) {
    test(`evaluates ${JSON.stringify(expression)} = ${expected}`, () => {
      assert.equal(evaluateExpression(expression), expected)
    })
  }

  test('rejects division by zero', () => {
    assert.throws(() => evaluateExpression('1 / 0'), /Division by zero/)
    assert.throws(() => evaluateExpression('5 % 0'), /Modulo by zero/)
  })

  test('rejects invalid characters', () => {
    assert.throws(() => evaluateExpression('1 + abc'), /Unexpected character/)
    assert.throws(() => evaluateExpression('1 & 2'), /Unexpected character/)
  })

  test('rejects empty expression', () => {
    assert.throws(() => evaluateExpression(''), /Empty expression/)
    assert.throws(() => evaluateExpression('   '), /Empty expression/)
  })

  test('rejects unbalanced parentheses', () => {
    assert.throws(() => evaluateExpression('(1 + 2'), /Missing closing parenthesis/)
    assert.throws(() => evaluateExpression('1 + 2)'), /Unexpected trailing token/)
  })

  test('rejects trailing tokens', () => {
    assert.throws(() => evaluateExpression('1 2'), /Unexpected trailing token/)
  })

  test('rejects malformed numbers', () => {
    assert.throws(() => evaluateExpression('1.2.3'), /Invalid number/)
  })
})

describe('calculatorTool.execute', () => {
  const signal = new AbortController().signal

  test('returns the numeric result for a valid expression', async () => {
    const result = await calculatorTool.execute(
      { expression: '(3 + 4) * 2' },
      signal
    )
    assert.equal(result.content, '14')
    assert.equal(result.isError, undefined)
  })

  test('returns isError for malformed expressions', async () => {
    const result = await calculatorTool.execute(
      { expression: '1 /' },
      signal
    )
    assert.equal(result.isError, true)
    assert.match(result.content, /Error:/)
  })

  test('returns isError when arguments do not match the schema', async () => {
    const result = await calculatorTool.execute({ wrong: 'field' }, signal)
    assert.equal(result.isError, true)
    assert.match(result.content, /Invalid arguments/)
  })

  test('exposes a valid OpenAI function definition', () => {
    assert.equal(calculatorTool.definition.type, 'function')
    assert.equal(calculatorTool.definition.function.name, 'calculator')
    const params = calculatorTool.definition.function.parameters as {
      type: string
      required: string[]
      additionalProperties: boolean
    }
    assert.equal(params.type, 'object')
    assert.deepEqual(params.required, ['expression'])
    assert.equal(params.additionalProperties, false)
  })
})
