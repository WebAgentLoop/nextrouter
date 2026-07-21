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
import { afterEach, describe, test } from 'node:test'

import {
  formatPaymentAmount,
  formatTopupCredit,
  topupAmountToUSD,
} from './currency'
import { useSystemConfigStore } from '../stores/system-config-store'

function setCurrencyConfig(
  displayType: 'USD' | 'CNY' | 'TOKENS' | 'CUSTOM',
  overrides: Record<string, number | string> = {}
): void {
  useSystemConfigStore.setState({
    config: {
      systemName: 'Test',
      logo: '',
      currency: {
        displayInCurrency: true,
        quotaDisplayType: displayType,
        quotaPerUnit: 500000,
        usdExchangeRate: 7,
        customCurrencySymbol: '\u00A4',
        customCurrencyExchangeRate: 7,
        ...overrides,
      },
    },
  })
}

afterEach(() => {
  setCurrencyConfig('USD', {
    usdExchangeRate: 1,
    customCurrencyExchangeRate: 1,
  })
})

describe('topupAmountToUSD', () => {
  test('returns amount unchanged for USD', () => {
    setCurrencyConfig('USD')
    assert.equal(topupAmountToUSD(10), 10)
  })

  test('returns amount unchanged for CUSTOM', () => {
    setCurrencyConfig('CUSTOM')
    assert.equal(topupAmountToUSD(10), 10)
  })

  test('divides by quotaPerUnit for TOKENS', () => {
    setCurrencyConfig('TOKENS', { quotaPerUnit: 500000 })
    assert.equal(topupAmountToUSD(500000), 1)
    assert.equal(topupAmountToUSD(5000000), 10)
  })
})

describe('formatTopupCredit', () => {
  test('TOKENS: shows token count, not double-multiplied', () => {
    setCurrencyConfig('TOKENS', { quotaPerUnit: 500000 })
    // Regression: formatCurrencyFromUSD(500000) would produce 250 billion.
    const result = formatTopupCredit(500000, { abbreviate: false })
    assert.equal(result, '500000')
    assert.ok(!result.includes('250000000'))
  })

  test('CUSTOM: shows display-currency value', () => {
    setCurrencyConfig('CUSTOM', {
      customCurrencySymbol: '\u20AC',
      customCurrencyExchangeRate: 7,
    })
    const result = formatTopupCredit(10)
    assert.ok(result.includes('70'))
    assert.ok(result.includes('\u20AC'))
  })

  test('returns dash for null', () => {
    assert.equal(formatTopupCredit(null), '-')
  })
})

describe('formatPaymentAmount fallback', () => {
  test('valid ISO code works', () => {
    const result = formatPaymentAmount(10, 'USD')
    assert.ok(result.includes('10'))
  })

  test('invalid code USDT does not throw', () => {
    assert.doesNotThrow(() => formatPaymentAmount(10, 'USDT'))
    const result = formatPaymentAmount(10, 'USDT')
    assert.ok(result.includes('10'))
  })

  test('unknown code ZZZ does not throw', () => {
    assert.doesNotThrow(() => formatPaymentAmount(10, 'ZZZ'))
  })
})
