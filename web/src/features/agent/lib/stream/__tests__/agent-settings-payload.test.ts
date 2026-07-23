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

  test('combines the admin prompt and enabled tool pack instructions', () => {
    const payload = buildAgentPayload(
      [message],
      config({ system_prompt: 'Follow the administrator policy.' }),
      undefined,
      ['Use the model documentation tools before making model claims.']
    )

    assert.deepEqual(payload.messages[0], {
      role: 'system',
      content:
        'Follow the administrator policy.\n\nUse the model documentation tools before making model claims.',
    })
  })

  test('uses tool pack instructions without requiring an admin prompt', () => {
    const payload = buildAgentPayload([message], config(), undefined, [
      'Use web search for current information.',
    ])

    assert.deepEqual(payload.messages[0], {
      role: 'system',
      content: 'Use web search for current information.',
    })
  })

  test('appends generated runtime context after administrator and tool instructions', () => {
    const runtimeContext = `<AUTO_GEN_INFO>
CURRENT_DATE: 2026-07-23
</AUTO_GEN_INFO>`
    const payload = buildAgentPayload(
      [message],
      config({ system_prompt: 'Follow the administrator policy.' }),
      undefined,
      ['Use available tools when needed.'],
      runtimeContext
    )

    assert.deepEqual(payload.messages[0], {
      role: 'system',
      content: `Follow the administrator policy.

Use available tools when needed.

${runtimeContext}`,
    })
  })
})
