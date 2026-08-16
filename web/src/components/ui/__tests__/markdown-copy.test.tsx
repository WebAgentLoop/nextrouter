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
import { afterAll, describe, test } from 'vitest'

import { Window } from 'happy-dom'

const domWindow = new Window()
domWindow.document.write(
  '<!doctype html><html><head></head><body></body></html>'
)
const domGlobals = [
  'window',
  'document',
  'navigator',
  'HTMLElement',
  'Node',
  'Element',
  'Event',
  'CustomEvent',
  'MutationObserver',
  'requestAnimationFrame',
  'cancelAnimationFrame',
  'getComputedStyle',
] as const

for (const key of domGlobals) {
  Object.defineProperty(globalThis, key, {
    configurable: true,
    value: domWindow[key],
  })
}

const copiedValues: string[] = []
Object.defineProperty(globalThis.navigator, 'clipboard', {
  configurable: true,
  value: {
    writeText: async (value: string) => {
      copiedValues.push(value)
    },
  },
})

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const i18next = (await import('i18next')).default
const { initReactI18next } = await import('react-i18next')
await i18next.use(initReactI18next).init({
  lng: 'en',
  resources: {
    en: {
      translation: {
        Copied: 'Copied',
        'Copied!': 'Copied!',
        'Copy code': 'Copy code',
        'Copied to clipboard': 'Copied to clipboard',
        'Failed to copy to clipboard': 'Failed to copy to clipboard',
      },
    },
  },
})
const { Markdown } = await import('../markdown')
const { CodeBlock } = await import('../../ai-elements/code-block')
const reactTestGlobals = globalThis as typeof globalThis & {
  IS_REACT_ACT_ENVIRONMENT?: boolean
}
reactTestGlobals.IS_REACT_ACT_ENVIRONMENT = true

describe('Markdown code block copy action', () => {
  afterAll(() => {
    domWindow.close()
  })

  test('copies only the fenced code block content', async () => {
    copiedValues.length = 0
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(
        <Markdown>
          {'Before\n\n```js\nconst answer = 42\n```\n\nAfter'}
        </Markdown>
      )
    })

    const copyButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy code"]'
    )
    assert.ok(copyButton, document.body.innerHTML)

    await act(async () => copyButton.click())
    assert.deepEqual(copiedValues, ['const answer = 42\n'])
    assert.equal(copyButton.getAttribute('aria-label'), 'Copied')

    await act(async () => root.unmount())
    container.remove()
  })

  test('gives a standalone code block a default copy action', async () => {
    copiedValues.length = 0
    const container = document.createElement('div')
    document.body.append(container)
    const root = createRoot(container)

    await act(async () => {
      root.render(<CodeBlock code='{"model":"gpt"}' language='json' />)
    })

    const copyButton = document.querySelector<HTMLButtonElement>(
      'button[aria-label="Copy code"]'
    )
    assert.ok(copyButton)

    await act(async () => copyButton.click())
    assert.deepEqual(copiedValues, ['{"model":"gpt"}'])

    await act(async () => root.unmount())
    container.remove()
  })
})
