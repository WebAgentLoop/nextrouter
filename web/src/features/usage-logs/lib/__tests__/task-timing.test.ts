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
import { describe, test } from 'vitest'

import { calculateTaskTiming } from '../task-timing'

describe('calculateTaskTiming', () => {
  test('separates queue and latest execution time while preserving total time', () => {
    assert.deepEqual(calculateTaskTiming(100, 130, 190), {
      totalDurationSec: 90,
      queueDurationSec: 30,
      executionDurationSec: 60,
    })
  })

  test('returns only available metrics for a queued task', () => {
    assert.deepEqual(calculateTaskTiming(100), {})
  })

  test('clamps inconsistent timestamps instead of showing negative durations', () => {
    assert.deepEqual(calculateTaskTiming(100, 90, 80), {
      totalDurationSec: 0,
      queueDurationSec: 0,
      executionDurationSec: 0,
    })
  })
})
