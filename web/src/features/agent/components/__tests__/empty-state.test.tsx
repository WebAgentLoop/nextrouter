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
import { renderToStaticMarkup } from 'react-dom/server'
import { beforeAll, describe, expect, test } from 'vitest'

import i18n from '@/i18n/config'

import { AgentEmptyState } from '../empty-state'

beforeAll(async () => {
  await i18n.changeLanguage('en')
})

describe('AgentEmptyState', () => {
  test('presents gateway documentation, API integration, and web search tasks', () => {
    const markup = renderToStaticMarkup(
      <AgentEmptyState onSelectPrompt={() => undefined} />
    )

    expect(markup).toContain('Explore your AI gateway')
    expect(markup).toContain('Which models are available on this gateway?')
    expect(markup).toContain('How do I call a chat model with cURL?')
    expect(markup).toContain(
      'Find a documented model and summarize its capabilities and limitations'
    )
    expect(markup).toContain(
      'Search the web and summarize today&#x27;s top technology news'
    )
  })
})
