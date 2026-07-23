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
import { afterEach, describe, expect, test, vi } from 'vitest'

import type { PricingData, PricingModel } from '@/features/pricing/types'
import { api } from '@/lib/api'

import {
  buildModelCatalogPage,
  getModelDocumentationTool,
  listAvailableModelsTool,
  MODEL_DOCUMENTATION_SYSTEM_INSTRUCTIONS,
} from '../model-documentation'

function pricingModel(
  modelName: string,
  overrides: Partial<PricingModel> = {}
): PricingModel {
  return {
    id: 0,
    model_name: modelName,
    has_documentation: false,
    quota_type: 0,
    model_ratio: 1,
    completion_ratio: 1,
    enable_groups: ['default'],
    ...overrides,
  }
}

function pricingData(models: PricingModel[]): PricingData {
  return {
    success: true,
    data: models,
    vendors: [{ id: 1, name: 'Vendor One' }],
    group_ratio: {},
    usable_group: {},
    supported_endpoint: {
      chat: { path: '/v1/chat/completions', method: 'post' },
      embeddings: { path: '/v1/embeddings', method: 'POST' },
    },
    auto_groups: [],
  }
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('buildModelCatalogPage', () => {
  test('filters before applying stable sorted pagination', () => {
    const data = pricingData([
      pricingModel('zeta', {
        description: 'Chat model',
        has_documentation: true,
        supported_endpoint_types: ['chat'],
      }),
      pricingModel('alpha', {
        description: 'Chat model',
        has_documentation: true,
        supported_endpoint_types: ['chat'],
      }),
      pricingModel('embedding-model', {
        supported_endpoint_types: ['embeddings'],
      }),
    ])

    const firstPage = buildModelCatalogPage(data, {
      endpoint_type: 'CHAT',
      has_documentation: true,
      skip: 0,
      limit: 1,
    })
    const secondPage = buildModelCatalogPage(data, {
      endpoint_type: 'chat',
      has_documentation: true,
      skip: firstPage.next_skip ?? 0,
      limit: 1,
    })

    expect(firstPage).toMatchObject({
      total: 2,
      has_more: true,
      next_skip: 1,
    })
    expect(firstPage.models.map((model) => model.name)).toEqual(['alpha'])
    expect(secondPage.models.map((model) => model.name)).toEqual(['zeta'])
    expect(secondPage).toMatchObject({ has_more: false, next_skip: null })
  })

  test('joins vendor and endpoint metadata into the compact result', () => {
    const page = buildModelCatalogPage(
      pricingData([
        pricingModel('documented-model', {
          description: 'Reasoning model',
          tags: 'reasoning,tools',
          vendor_id: 1,
          has_documentation: true,
          supported_endpoint_types: ['chat'],
        }),
      ]),
      { query: 'vendor one', skip: 0, limit: 20 }
    )

    expect(page.models).toEqual([
      {
        name: 'documented-model',
        description: 'Reasoning model',
        vendor: 'Vendor One',
        tags: 'reasoning,tools',
        supported_endpoint_types: ['chat'],
        endpoints: [
          { type: 'chat', path: '/v1/chat/completions', method: 'POST' },
        ],
        enable_groups: ['default'],
        has_documentation: true,
      },
    ])
  })
})

describe('model documentation tools', () => {
  test('defaults unspecified integration examples to cURL with a safe API key placeholder', () => {
    expect(MODEL_DOCUMENTATION_SYSTEM_INSTRUCTIONS).toContain(
      'If none is specified, provide a minimal cURL example.'
    )
    expect(MODEL_DOCUMENTATION_SYSTEM_INSTRUCTIONS).toContain('$NEW_API_KEY')
  })

  test('validates catalog pagination before making a request', async () => {
    const get = vi.spyOn(api, 'get')

    const result = await listAvailableModelsTool.execute(
      { skip: -1, limit: 100 },
      new AbortController().signal
    )

    expect(result.isError).toBe(true)
    expect(result.content).toContain('Invalid arguments')
    expect(get).not.toHaveBeenCalled()
  })

  test('returns the paginated catalog from the platform API', async () => {
    const data = pricingData([pricingModel('model-b'), pricingModel('model-a')])
    vi.spyOn(api, 'get').mockResolvedValue({ data } as never)
    const controller = new AbortController()

    const result = await listAvailableModelsTool.execute(
      { skip: 0, limit: 1 },
      controller.signal
    )

    expect(result.isError).toBeUndefined()
    expect(JSON.parse(result.content)).toMatchObject({
      total: 2,
      has_more: true,
      next_skip: 1,
      models: [{ name: 'model-a' }],
    })
    expect(api.get).toHaveBeenCalledWith('/api/pricing', {
      signal: controller.signal,
      skipErrorHandler: true,
    })
  })

  test('returns authoritative Markdown and reports unavailable documents', async () => {
    const get = vi.spyOn(api, 'get')
    get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { model_name: 'model-a', documentation: '# Model A' },
      },
    } as never)
    get.mockRejectedValueOnce(new Error('not found'))

    const available = await getModelDocumentationTool.execute(
      { model_name: 'model-a' },
      new AbortController().signal
    )
    const unavailable = await getModelDocumentationTool.execute(
      { model_name: 'missing' },
      new AbortController().signal
    )

    expect(JSON.parse(available.content)).toEqual({
      model_name: 'model-a',
      documentation: '# Model A',
    })
    expect(unavailable).toEqual({
      content: 'Documentation is not available for model missing.',
      isError: true,
    })
  })
})
