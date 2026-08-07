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

import {
  CHANNEL_FORM_DEFAULT_VALUES,
  MAX_CHANNEL_RATE_LIMIT_REQUESTS,
  MAX_CHANNEL_RATE_LIMIT_WINDOW_SECONDS,
  channelFormSchema,
  transformChannelToFormDefaults,
  transformFormDataToCreatePayload,
} from '../channel-form'
import type { Channel } from '../../types'

function rateLimitForm(overrides: Record<string, unknown> = {}) {
  return {
    ...CHANNEL_FORM_DEFAULT_VALUES,
    name: 'Rate limited channel',
    type: 1,
    key: 'sk-test',
    models: 'gpt-5',
    ...overrides,
  }
}

function parseSettings(payload: { channel: Partial<Channel> }): {
  rate_limit?: {
    enabled?: boolean
    requests?: number
    window_seconds?: number
  }
} {
  return JSON.parse(payload.channel.settings || '{}')
}

describe('channel rate limit form validation', () => {
  test('accepts a valid enabled rate limit', () => {
    const result = channelFormSchema.safeParse(
      rateLimitForm({
        rate_limit_enabled: true,
        rate_limit_requests: 10,
        rate_limit_window_seconds: 60,
      })
    )
    assert.equal(result.success, true)
  })

  test('accepts disabled rate limit with untouched numeric defaults', () => {
    const result = channelFormSchema.safeParse(
      rateLimitForm({ rate_limit_enabled: false })
    )
    assert.equal(result.success, true)
  })

  test('rejects non-positive requests when enabled', () => {
    for (const requests of [0, -5]) {
      const result = channelFormSchema.safeParse(
        rateLimitForm({
          rate_limit_enabled: true,
          rate_limit_requests: requests,
          rate_limit_window_seconds: 60,
        })
      )
      assert.equal(result.success, false)
      if (!result.success) {
        assert.equal(
          result.error.issues.some(
            (issue) => issue.path[0] === 'rate_limit_requests'
          ),
          true
        )
      }
    }
  })

  test('rejects requests above the backend cap when enabled', () => {
    const result = channelFormSchema.safeParse(
      rateLimitForm({
        rate_limit_enabled: true,
        rate_limit_requests: MAX_CHANNEL_RATE_LIMIT_REQUESTS + 1,
        rate_limit_window_seconds: 60,
      })
    )
    assert.equal(result.success, false)
    if (!result.success) {
      assert.equal(
        result.error.issues.some(
          (issue) => issue.path[0] === 'rate_limit_requests'
        ),
        true
      )
    }
  })

  test('rejects non-positive or oversized windows when enabled', () => {
    for (const windowSeconds of [0, MAX_CHANNEL_RATE_LIMIT_WINDOW_SECONDS + 1]) {
      const result = channelFormSchema.safeParse(
        rateLimitForm({
          rate_limit_enabled: true,
          rate_limit_requests: 10,
          rate_limit_window_seconds: windowSeconds,
        })
      )
      assert.equal(result.success, false)
      if (!result.success) {
        assert.equal(
          result.error.issues.some(
            (issue) => issue.path[0] === 'rate_limit_window_seconds'
          ),
          true
        )
      }
    }
  })
})

describe('channel rate limit serialization', () => {
  test('writes the rate_limit block into settings when enabled', () => {
    const payload = transformFormDataToCreatePayload(
      rateLimitForm({
        rate_limit_enabled: true,
        rate_limit_requests: 30,
        rate_limit_window_seconds: 5,
      }) as Parameters<typeof transformFormDataToCreatePayload>[0]
    )
    assert.deepEqual(parseSettings(payload).rate_limit, {
      enabled: true,
      requests: 30,
      window_seconds: 5,
    })
  })

  test('omits rate_limit when disabled and removes a previously stored block', () => {
    const payload = transformFormDataToCreatePayload(
      rateLimitForm({
        rate_limit_enabled: false,
        rate_limit_requests: 30,
        rate_limit_window_seconds: 5,
        settings: JSON.stringify({
          rate_limit: { enabled: true, requests: 30, window_seconds: 5 },
        }),
      }) as Parameters<typeof transformFormDataToCreatePayload>[0]
    )
    assert.equal(
      'rate_limit' in parseSettings(payload),
      false,
      'a disabled rate limit must clear the stored block'
    )
  })

  test('round-trips the rate limit through form defaults', () => {
    const payload = transformFormDataToCreatePayload(
      rateLimitForm({
        rate_limit_enabled: true,
        rate_limit_requests: 120,
        rate_limit_window_seconds: 300,
      }) as Parameters<typeof transformFormDataToCreatePayload>[0]
    )
    const defaults = transformChannelToFormDefaults({
      settings: payload.channel.settings,
      channel_info: { multi_key_mode: 'random' },
    } as Channel)

    assert.equal(defaults.rate_limit_enabled, true)
    assert.equal(defaults.rate_limit_requests, 120)
    assert.equal(defaults.rate_limit_window_seconds, 300)
  })

  test('defaults to disabled when the channel has no rate_limit settings', () => {
    const defaults = transformChannelToFormDefaults({
      settings: '{}',
      channel_info: { multi_key_mode: 'random' },
    } as Channel)

    assert.equal(defaults.rate_limit_enabled, false)
    assert.equal(defaults.rate_limit_requests, 10)
    assert.equal(defaults.rate_limit_window_seconds, 60)
  })
})
