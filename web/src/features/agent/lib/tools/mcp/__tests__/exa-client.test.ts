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
import { describe, expect, test } from 'vitest'

import { modelDocumentationToolPack } from '../../builtins/model-documentation'
import {
  getTool,
  getToolPackSystemInstructions,
  getToolPackTools,
  listToolDefinitions,
  type AgentToolPack,
  type RegisteredTool,
} from '../../registry'
import {
  formatMcpToolResult,
  WEB_SEARCH_SYSTEM_INSTRUCTIONS,
} from '../exa-client'

describe('formatMcpToolResult', () => {
  test('joins MCP text blocks for the next agent round', () => {
    expect(
      formatMcpToolResult({
        content: [
          { type: 'text', text: 'Search result' },
          { type: 'text', text: 'https://example.com' },
        ],
      })
    ).toEqual({
      content: 'Search result\n\nhttps://example.com',
      isError: undefined,
    })
  })

  test('preserves structured output and MCP error state', () => {
    expect(
      formatMcpToolResult({
        content: [],
        structuredContent: { results: [] },
        isError: true,
      })
    ).toEqual({
      content: '{"results":[]}',
      isError: true,
    })
  })
})

describe('Agent tool registry MCP extensions', () => {
  test('exposes a connected MCP tool pack to payload creation and execution', async () => {
    const remoteTool: RegisteredTool = {
      definition: {
        type: 'function',
        function: {
          name: 'web_search_exa',
          description: 'Search the web',
          parameters: { type: 'object' },
        },
      },
      execute: async () => ({ content: 'result' }),
    }
    const toolPack: AgentToolPack = {
      id: 'web-search',
      tools: [remoteTool],
      systemInstructions: WEB_SEARCH_SYSTEM_INSTRUCTIONS,
    }
    const tools = getToolPackTools([toolPack])

    expect(
      listToolDefinitions(tools).map((tool) => tool.function.name)
    ).toEqual(['calculator', 'web_search_exa'])
    expect(getToolPackSystemInstructions([toolPack])).toEqual([
      WEB_SEARCH_SYSTEM_INSTRUCTIONS,
    ])

    const combinedNames = listToolDefinitions([
      ...modelDocumentationToolPack.tools,
      ...tools,
    ]).map((tool) => tool.function.name)
    expect(combinedNames).toEqual([
      'calculator',
      'list_available_models',
      'get_model_documentation',
      'web_search_exa',
    ])
    expect(new Set(combinedNames).size).toBe(combinedNames.length)

    const registered = getTool('web_search_exa', tools)
    expect(registered).toBe(remoteTool)
    await expect(
      registered?.execute({}, new AbortController().signal)
    ).resolves.toEqual({ content: 'result' })
  })
})
