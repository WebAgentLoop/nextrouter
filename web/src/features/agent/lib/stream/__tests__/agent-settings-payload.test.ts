import assert from 'node:assert/strict'
import { describe, test } from 'node:test'

import type { AgentConfig, AgentMessage } from '../../../types'
import { buildAgentPayload } from '../payload-builder'

const message: AgentMessage = {
  id: 'user-1',
  role: 'user',
  content: 'Hello',
  createdAt: 0,
}

function config(overrides: Partial<AgentConfig> = {}): AgentConfig {
  return {
    model: 'gpt-4o',
    group: 'default',
    system_prompt: '',
    temperature: null,
    max_tokens: null,
    max_iterations: 10,
    stream: true,
    ...overrides,
  }
}

describe('buildAgentPayload Agent settings', () => {
  test('prepends the configured system prompt without mutating history', () => {
    const messages = [message]
    const payload = buildAgentPayload(
      messages,
      config({ system_prompt: 'Use tools when useful.' })
    )

    assert.deepEqual(payload.messages[0], {
      role: 'system',
      content: 'Use tools when useful.',
    })
    assert.equal(payload.messages[1].role, 'user')
    assert.equal(messages.length, 1)
  })

  test('omits empty system prompt and nullable scalar parameters', () => {
    const payload = buildAgentPayload([message], config())

    assert.equal(payload.messages[0].role, 'user')
    assert.equal('temperature' in payload, false)
    assert.equal('max_tokens' in payload, false)
  })

  test('preserves explicit zero temperature and configured max tokens', () => {
    const payload = buildAgentPayload(
      [message],
      config({ temperature: 0, max_tokens: 4096 })
    )

    assert.equal(payload.temperature, 0)
    assert.equal(payload.max_tokens, 4096)
  })
})
