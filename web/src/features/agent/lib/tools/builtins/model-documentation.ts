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
import { z } from 'zod'

import type {
  ModelDocumentationResponse,
  PricingData,
  PricingEndpoint,
  PricingModel,
} from '@/features/pricing/types'
import { api } from '@/lib/api'

import type { ToolDefinition } from '../../../types'
import type { AgentToolPack } from '../registry'
import type { ToolExecuteResult } from './calculator'

const DEFAULT_MODEL_CATALOG_LIMIT = 20
const MAX_MODEL_CATALOG_LIMIT = 50

export const modelCatalogArgsSchema = z.object({
  query: z.string().trim().max(200).optional(),
  endpoint_type: z.string().trim().min(1).max(100).optional(),
  has_documentation: z.boolean().optional(),
  skip: z.number().int().min(0).default(0),
  limit: z
    .number()
    .int()
    .min(1)
    .max(MAX_MODEL_CATALOG_LIMIT)
    .default(DEFAULT_MODEL_CATALOG_LIMIT),
})

export const modelDocumentationArgsSchema = z.object({
  model_name: z.string().trim().min(1).max(255),
})

export type ModelCatalogArgs = z.infer<typeof modelCatalogArgsSchema>

interface ModelCatalogEndpoint extends PricingEndpoint {
  type: string
}

interface ModelCatalogItem {
  name: string
  description?: string
  vendor?: string
  tags?: string
  supported_endpoint_types: string[]
  endpoints: ModelCatalogEndpoint[]
  enable_groups: string[]
  has_documentation: boolean
}

export interface ModelCatalogPage {
  models: ModelCatalogItem[]
  total: number
  skip: number
  limit: number
  has_more: boolean
  next_skip: number | null
}

function toCatalogItem(
  model: PricingModel,
  vendorNames: Map<number, string>,
  endpointMap: Record<string, PricingEndpoint>
): ModelCatalogItem {
  const supportedEndpointTypes = model.supported_endpoint_types ?? []
  const endpoints = supportedEndpointTypes.map((type) => {
    const endpoint = endpointMap[type]
    return {
      type,
      ...(endpoint?.path ? { path: endpoint.path } : {}),
      ...(endpoint?.method ? { method: endpoint.method.toUpperCase() } : {}),
    }
  })

  return {
    name: model.model_name,
    ...(model.description ? { description: model.description } : {}),
    ...(model.vendor_id && vendorNames.has(model.vendor_id)
      ? { vendor: vendorNames.get(model.vendor_id) }
      : {}),
    ...(model.tags ? { tags: model.tags } : {}),
    supported_endpoint_types: supportedEndpointTypes,
    endpoints,
    enable_groups: model.enable_groups,
    has_documentation: model.has_documentation,
  }
}

export function buildModelCatalogPage(
  pricing: PricingData,
  args: ModelCatalogArgs
): ModelCatalogPage {
  const vendorNames = new Map(
    pricing.vendors.map((vendor) => [vendor.id, vendor.name])
  )
  const query = args.query?.toLocaleLowerCase()
  const endpointType = args.endpoint_type?.toLocaleLowerCase()

  const filtered = pricing.data
    .map((model) =>
      toCatalogItem(model, vendorNames, pricing.supported_endpoint)
    )
    .filter((model) => {
      if (
        args.has_documentation !== undefined &&
        model.has_documentation !== args.has_documentation
      ) {
        return false
      }
      if (
        endpointType &&
        !model.supported_endpoint_types.some(
          (type) => type.toLocaleLowerCase() === endpointType
        )
      ) {
        return false
      }
      if (!query) {
        return true
      }
      return [model.name, model.description, model.vendor, model.tags]
        .filter((value): value is string => Boolean(value))
        .some((value) => value.toLocaleLowerCase().includes(query))
    })
    .sort((left, right) => left.name.localeCompare(right.name, 'en'))

  const models = filtered.slice(args.skip, args.skip + args.limit)
  const hasMore = args.skip + models.length < filtered.length

  return {
    models,
    total: filtered.length,
    skip: args.skip,
    limit: args.limit,
    has_more: hasMore,
    next_skip: hasMore ? args.skip + models.length : null,
  }
}

function invalidArgumentsResult(message: string): ToolExecuteResult {
  return {
    content: `Invalid arguments: ${message}`,
    isError: true,
  }
}

export const listAvailableModelsTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'list_available_models',
      description:
        'List models available on this platform with descriptions, supported endpoint types, endpoint paths, groups, vendors, and documentation availability. Use filters and pagination to keep results focused.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description:
              'Optional case-insensitive search across model name, description, vendor, and tags.',
          },
          endpoint_type: {
            type: 'string',
            description: 'Optional exact supported endpoint type filter.',
          },
          has_documentation: {
            type: 'boolean',
            description:
              'Optional filter for models with or without dedicated documentation.',
          },
          skip: {
            type: 'integer',
            minimum: 0,
            default: 0,
            description: 'Number of matching models to skip.',
          },
          limit: {
            type: 'integer',
            minimum: 1,
            maximum: MAX_MODEL_CATALOG_LIMIT,
            default: DEFAULT_MODEL_CATALOG_LIMIT,
            description: 'Maximum number of models to return.',
          },
        },
        additionalProperties: false,
      },
    },
  } satisfies ToolDefinition,
  execute: async (
    args: unknown,
    signal: AbortSignal
  ): Promise<ToolExecuteResult> => {
    const parsed = modelCatalogArgsSchema.safeParse(args)
    if (!parsed.success) {
      return invalidArgumentsResult(parsed.error.message)
    }

    try {
      const response = await api.get('/api/pricing', {
        signal,
        skipErrorHandler: true,
      })
      const pricing = response.data as PricingData
      if (!pricing.success || !Array.isArray(pricing.data)) {
        return { content: 'Failed to load the model catalog.', isError: true }
      }
      return {
        content: JSON.stringify(buildModelCatalogPage(pricing, parsed.data)),
      }
    } catch {
      if (signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      return { content: 'Failed to load the model catalog.', isError: true }
    }
  },
}

export const getModelDocumentationTool = {
  definition: {
    type: 'function' as const,
    function: {
      name: 'get_model_documentation',
      description:
        'Get the authoritative Markdown documentation for one exact platform model name. Use this before answering model-specific parameter, limitation, or integration questions.',
      parameters: {
        type: 'object',
        properties: {
          model_name: {
            type: 'string',
            description: 'Exact model name returned by list_available_models.',
          },
        },
        required: ['model_name'],
        additionalProperties: false,
      },
    },
  } satisfies ToolDefinition,
  execute: async (
    args: unknown,
    signal: AbortSignal
  ): Promise<ToolExecuteResult> => {
    const parsed = modelDocumentationArgsSchema.safeParse(args)
    if (!parsed.success) {
      return invalidArgumentsResult(parsed.error.message)
    }

    try {
      const response = await api.get('/api/pricing/documentation', {
        params: { model: parsed.data.model_name },
        signal,
        skipErrorHandler: true,
      })
      const result = response.data as ModelDocumentationResponse
      if (!result.success || !result.data?.documentation) {
        return {
          content: `Documentation is not available for model ${parsed.data.model_name}.`,
          isError: true,
        }
      }
      return {
        content: JSON.stringify(result.data),
      }
    } catch {
      if (signal.aborted) {
        throw new DOMException('The operation was aborted.', 'AbortError')
      }
      return {
        content: `Documentation is not available for model ${parsed.data.model_name}.`,
        isError: true,
      }
    }
  },
}

export const MODEL_DOCUMENTATION_SYSTEM_INSTRUCTIONS = `## Model documentation capability

- Before answering questions about models available on this platform, their capabilities, or API access, query the model catalog.
- When a model has documentation, read it before answering model-specific parameter, limitation, or integration questions.
- Do not invent models, endpoints, parameters, or capabilities that are absent from tool results.
- If documentation is unavailable, clearly distinguish general API guidance from verified model-specific information.
- When the catalog reports has_more as true, use next_skip to continue only when more results are needed.`

export const modelDocumentationToolPack: AgentToolPack = {
  id: 'model-documentation',
  tools: [listAvailableModelsTool, getModelDocumentationTool],
  systemInstructions: MODEL_DOCUMENTATION_SYSTEM_INSTRUCTIONS,
}
