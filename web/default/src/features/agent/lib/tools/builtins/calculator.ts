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
import { z } from 'zod'

import type { ToolDefinition } from '../../../types'

/**
 * Result returned by a tool executor. `content` is always a string so it can be
 * sent back to the model as the `tool` message body verbatim.
 */
export interface ToolExecuteResult {
  content: string
  isError?: boolean
}

export type ToolExecutor = (
  args: unknown,
  signal: AbortSignal
) => Promise<ToolExecuteResult>

export const calculatorArgsSchema = z.object({
  expression: z.string().min(1),
})

export type CalculatorArgs = z.infer<typeof calculatorArgsSchema>

// --------------------------------------------------------------------------
// Safe arithmetic evaluator (no eval / no Function constructor).
// Grammar (recursive descent):
//   expression := term (('+' | '-') term)*
//   term       := factor (('*' | '/' | '%') factor)*
//   factor     := unary ('^' factor)?          // right associative
//   unary      := ('+' | '-') unary | primary
//   primary    := number | '(' expression ')'
// Supports decimal numbers and operators + - * / % ^ plus parentheses and
// unary minus. Any other character is rejected.
// --------------------------------------------------------------------------

type TokenType =
  | 'number'
  | 'plus'
  | 'minus'
  | 'star'
  | 'slash'
  | 'percent'
  | 'caret'
  | 'lparen'
  | 'rparen'

interface Token {
  type: TokenType
  value?: number
}

const OPERATOR_CHARS: Record<string, TokenType> = {
  '+': 'plus',
  '-': 'minus',
  '*': 'star',
  '/': 'slash',
  '%': 'percent',
  '^': 'caret',
  '(': 'lparen',
  ')': 'rparen',
}

function isDigit(ch: string): boolean {
  return ch >= '0' && ch <= '9'
}

function isWhitespace(ch: string): boolean {
  return ch === ' ' || ch === '\t' || ch === '\n' || ch === '\r'
}

function tokenize(expression: string): Token[] {
  const tokens: Token[] = []
  let i = 0
  const n = expression.length

  while (i < n) {
    const ch = expression[i]

    if (isWhitespace(ch)) {
      i++
      continue
    }

    if (isDigit(ch) || ch === '.') {
      let num = ''
      let sawDot = false
      while (i < n && (isDigit(expression[i]) || expression[i] === '.')) {
        if (expression[i] === '.') {
          if (sawDot) {
            throw new Error('Invalid number: multiple decimal points')
          }
          sawDot = true
        }
        num += expression[i]
        i++
      }
      const value = Number(num)
      if (Number.isNaN(value)) {
        throw new Error(`Invalid number: ${num}`)
      }
      tokens.push({ type: 'number', value })
      continue
    }

    const op = OPERATOR_CHARS[ch]
    if (!op) {
      throw new Error(`Unexpected character: ${ch}`)
    }
    tokens.push({ type: op })
    i++
  }

  if (tokens.length === 0) {
    throw new Error('Empty expression')
  }

  return tokens
}

class ArithmeticParser {
  private pos = 0

  constructor(private readonly tokens: Token[]) {}

  parseExpression(): number {
    let left = this.parseTerm()
    for (;;) {
      const tok = this.peek()
      if (!tok) break
      if (tok.type === 'plus') {
        this.next()
        left = left + this.parseTerm()
        continue
      }
      if (tok.type === 'minus') {
        this.next()
        left = left - this.parseTerm()
        continue
      }
      break
    }
    return left
  }

  private parseTerm(): number {
    let left = this.parseFactor()
    for (;;) {
      const tok = this.peek()
      if (!tok) break
      if (tok.type === 'star') {
        this.next()
        left = left * this.parseFactor()
        continue
      }
      if (tok.type === 'slash') {
        this.next()
        const right = this.parseFactor()
        if (right === 0) {
          throw new Error('Division by zero')
        }
        left = left / right
        continue
      }
      if (tok.type === 'percent') {
        this.next()
        const right = this.parseFactor()
        if (right === 0) {
          throw new Error('Modulo by zero')
        }
        left = left % right
        continue
      }
      break
    }
    return left
  }

  // Power is right-associative: 2 ^ 3 ^ 2 == 2 ^ (3 ^ 2).
  private parseFactor(): number {
    const base = this.parseUnary()
    const tok = this.peek()
    if (tok && tok.type === 'caret') {
      this.next()
      const exponent = this.parseFactor()
      return Math.pow(base, exponent)
    }
    return base
  }

  private parseUnary(): number {
    const tok = this.peek()
    if (tok && tok.type === 'minus') {
      this.next()
      return -this.parseUnary()
    }
    if (tok && tok.type === 'plus') {
      this.next()
      return this.parseUnary()
    }
    return this.parsePrimary()
  }

  private parsePrimary(): number {
    const tok = this.next()
    if (!tok) {
      throw new Error('Unexpected end of expression')
    }
    if (tok.type === 'number') {
      return tok.value as number
    }
    if (tok.type === 'lparen') {
      const value = this.parseExpression()
      const close = this.next()
      if (!close || close.type !== 'rparen') {
        throw new Error('Missing closing parenthesis')
      }
      return value
    }
    throw new Error(`Unexpected token: ${tok.type}`)
  }

  expectEnd(): void {
    const tok = this.peek()
    if (tok) {
      throw new Error(`Unexpected trailing token: ${tok.type}`)
    }
  }

  private peek(): Token | undefined {
    return this.tokens[this.pos]
  }

  private next(): Token | undefined {
    return this.tokens[this.pos++]
  }
}

/**
 * Evaluate an arithmetic expression. Throws on any malformed input, division by
 * zero, or non-finite result.
 */
export function evaluateExpression(expression: string): number {
  const tokens = tokenize(expression)
  const parser = new ArithmeticParser(tokens)
  const result = parser.parseExpression()
  parser.expectEnd()
  if (!Number.isFinite(result)) {
    throw new Error('Result is not finite')
  }
  return result
}

export const calculatorTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'calculator',
      description:
        'Evaluate a mathematical expression. Supports addition (+), subtraction (-), multiplication (*), division (/), modulo (%), exponentiation (^), parentheses, and decimals. Use this for any numeric calculation.',
      parameters: {
        type: 'object',
        properties: {
          expression: {
            type: 'string',
            description:
              'The mathematical expression to evaluate, e.g. "2 + 3 * 4" or "(1.5 + 2.5) / 2".',
          },
        },
        required: ['expression'],
        additionalProperties: false,
      },
    },
  } satisfies ToolDefinition,
  execute: async (
    args: unknown,
    _signal: AbortSignal
  ): Promise<ToolExecuteResult> => {
    const parsed = calculatorArgsSchema.safeParse(args)
    if (!parsed.success) {
      return {
        content: `Invalid arguments: ${parsed.error.message}`,
        isError: true,
      }
    }

    try {
      const result = evaluateExpression(parsed.data.expression)
      return { content: String(result) }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Evaluation failed'
      return { content: `Error: ${message}`, isError: true }
    }
  },
}
