import { describe, expect, test } from 'vitest'

import {
  getTool,
  listToolDefinitions,
  type RegisteredTool,
} from '../../registry'
import { formatMcpToolResult } from '../exa-client'

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
  test('exposes a connected MCP tool to payload creation and execution', async () => {
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

    expect(
      listToolDefinitions([remoteTool]).map((tool) => tool.function.name)
    ).toEqual(['calculator', 'web_search_exa'])

    const registered = getTool('web_search_exa', [remoteTool])
    expect(registered).toBe(remoteTool)
    await expect(
      registered?.execute({}, new AbortController().signal)
    ).resolves.toEqual({ content: 'result' })
  })
})
