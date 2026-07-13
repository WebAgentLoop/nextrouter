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
import type { ChatCompletionToolCallDelta, ToolCall } from '../../types'

interface AccumulatedEntry {
  id: string
  name: string
  argumentsRaw: string
}

/**
 * Best-effort parse of the streamed tool-call arguments JSON. Returns `{}` for
 * an empty string (some models emit empty arguments for nullary calls) and
 * `undefined` when the JSON is malformed; callers re-validate via the tool's
 * own Zod schema before execution, so malformed JSON never crashes the loop.
 */
export function parseToolCallArguments(raw: string): unknown {
  if (!raw) {
    return {}
  }
  try {
    return JSON.parse(raw)
  } catch {
    return undefined
  }
}

/**
 * Accumulates streamed `tool_calls` deltas across SSE chunks.
 *
 * OpenAI streams tool calls fragmented by `index`: the first chunk for an
 * index usually carries the `id` and `function.name`, while subsequent chunks
 * append fragments to `function.arguments`. We merge per-index and only parse
 * arguments to JSON once the stream is complete.
 */
export class ToolCallAccumulator {
  private readonly entries = new Map<number, AccumulatedEntry>()

  apply(deltas: ChatCompletionToolCallDelta[] | undefined): void {
    if (!deltas || deltas.length === 0) {
      return
    }

    for (const delta of deltas) {
      const existing = this.entries.get(delta.index)
      const id = delta.id ?? existing?.id ?? ''
      const name = delta.function?.name ?? existing?.name ?? ''
      const argumentsRaw =
        (existing?.argumentsRaw ?? '') + (delta.function?.arguments ?? '')

      this.entries.set(delta.index, { id, name, argumentsRaw })
    }
  }

  /**
   * Produce the final, ordered list of parsed tool calls. Safe to call
   * multiple times; returns fresh arrays each time.
   */
  build(): ToolCall[] {
    const sorted = [...this.entries.entries()].sort(([a], [b]) => a - b)

    return sorted.map(([, entry]) => ({
      id: entry.id,
      name: entry.name,
      argumentsRaw: entry.argumentsRaw,
      parsedArguments: parseToolCallArguments(entry.argumentsRaw),
      status: 'pending' as const,
    }))
  }

  get isEmpty(): boolean {
    return this.entries.size === 0
  }
}
