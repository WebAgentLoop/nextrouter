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
  getModelDocumentationByteLength,
  isModelDocumentationWithinLimit,
  MAX_MODEL_DOCUMENTATION_BYTES,
} from '../model-documentation'

describe('model documentation size validation', () => {
  test('accepts documentation at the UTF-8 byte limit', () => {
    const documentation = 'a'.repeat(MAX_MODEL_DOCUMENTATION_BYTES)

    assert.equal(
      getModelDocumentationByteLength(documentation),
      MAX_MODEL_DOCUMENTATION_BYTES
    )
    assert.equal(isModelDocumentationWithinLimit(documentation), true)
  })

  test('rejects multibyte documentation above the UTF-8 byte limit', () => {
    const documentation = '界'.repeat(
      Math.floor(MAX_MODEL_DOCUMENTATION_BYTES / 3) + 1
    )

    assert.equal(
      getModelDocumentationByteLength(documentation) >
        MAX_MODEL_DOCUMENTATION_BYTES,
      true
    )
    assert.equal(isModelDocumentationWithinLimit(documentation), false)
  })
})
