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

const STREAM_UPDATE_FLUSH_MS = 50

export interface AgentStreamChunkBatch {
  content: string
  reasoning: string
}

export type AgentStreamFlushScheduler = (callback: () => void) => () => void

const scheduleStreamFlush: AgentStreamFlushScheduler = (callback) => {
  const timer = window.setTimeout(callback, STREAM_UPDATE_FLUSH_MS)
  return () => window.clearTimeout(timer)
}

/** Collects incremental stream chunks and commits them as one render update. */
export class AgentStreamChunkBuffer {
  private content = ''
  private reasoning = ''
  private cancelScheduledFlush: (() => void) | null = null

  constructor(
    private readonly onFlush: (batch: AgentStreamChunkBatch) => void,
    private readonly schedule: AgentStreamFlushScheduler = scheduleStreamFlush
  ) {}

  pushContent(chunk: string): void {
    this.content += chunk
    this.scheduleIfNeeded()
  }

  pushReasoning(chunk: string): void {
    this.reasoning += chunk
    this.scheduleIfNeeded()
  }

  flush(): void {
    this.cancelScheduledFlush?.()
    this.cancelScheduledFlush = null

    if (!this.content && !this.reasoning) {
      return
    }

    const batch = { content: this.content, reasoning: this.reasoning }
    this.content = ''
    this.reasoning = ''
    this.onFlush(batch)
  }

  clear(): void {
    this.cancelScheduledFlush?.()
    this.cancelScheduledFlush = null
    this.content = ''
    this.reasoning = ''
  }

  private scheduleIfNeeded(): void {
    if (this.cancelScheduledFlush) {
      return
    }
    this.cancelScheduledFlush = this.schedule(() => this.flush())
  }
}
