import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import {
  AgentStreamChunkBuffer,
  type AgentStreamChunkBatch,
  type AgentStreamFlushScheduler,
} from './stream-chunk-buffer'

function createScheduler() {
  let callback: (() => void) | null = null
  let scheduledCount = 0
  let cancelledCount = 0

  const schedule: AgentStreamFlushScheduler = (nextCallback) => {
    callback = nextCallback
    scheduledCount++
    return () => {
      callback = null
      cancelledCount++
    }
  }

  return {
    schedule,
    run: () => callback?.(),
    get scheduledCount() {
      return scheduledCount
    },
    get cancelledCount() {
      return cancelledCount
    },
  }
}

describe('AgentStreamChunkBuffer', () => {
  test('coalesces content and reasoning into one scheduled flush', () => {
    const scheduler = createScheduler()
    const batches: AgentStreamChunkBatch[] = []
    const buffer = new AgentStreamChunkBuffer(
      (batch) => batches.push(batch),
      scheduler.schedule
    )

    buffer.pushContent('Hello')
    buffer.pushReasoning('Think')
    buffer.pushContent(' world')

    assert.equal(scheduler.scheduledCount, 1)
    assert.deepEqual(batches, [])

    scheduler.run()

    assert.deepEqual(batches, [{ content: 'Hello world', reasoning: 'Think' }])
  })

  test('flush drains pending chunks and starts a fresh batch', () => {
    const scheduler = createScheduler()
    const batches: AgentStreamChunkBatch[] = []
    const buffer = new AgentStreamChunkBuffer(
      (batch) => batches.push(batch),
      scheduler.schedule
    )

    buffer.pushContent('first')
    buffer.flush()
    buffer.pushContent('second')
    buffer.flush()

    assert.equal(scheduler.scheduledCount, 2)
    assert.equal(scheduler.cancelledCount, 2)
    assert.deepEqual(batches, [
      { content: 'first', reasoning: '' },
      { content: 'second', reasoning: '' },
    ])
  })

  test('clear cancels pending work without committing it', () => {
    const scheduler = createScheduler()
    const batches: AgentStreamChunkBatch[] = []
    const buffer = new AgentStreamChunkBuffer(
      (batch) => batches.push(batch),
      scheduler.schedule
    )

    buffer.pushReasoning('discard me')
    buffer.clear()
    scheduler.run()

    assert.equal(scheduler.cancelledCount, 1)
    assert.deepEqual(batches, [])
  })
})
