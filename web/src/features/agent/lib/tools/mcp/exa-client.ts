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
import { Client } from '@modelcontextprotocol/sdk/client/index.js'
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js'

import type { ToolDefinition } from '../../../types'
import type { ToolExecuteResult } from '../builtins/calculator'
import type { RegisteredTool } from '../registry'

const EXA_MCP_URL = 'https://mcp.exa.ai/mcp?tools=web_search_exa,web_fetch_exa'
const EXA_TOOL_NAMES = new Set(['web_search_exa', 'web_fetch_exa'])

interface McpContentItem {
  type?: unknown
  text?: unknown
  resource?: unknown
}

export function formatMcpToolResult(result: unknown): ToolExecuteResult {
  if (!result || typeof result !== 'object') {
    return { content: JSON.stringify(result) ?? String(result) }
  }

  const toolResult = result as Record<string, unknown>
  const content = Array.isArray(toolResult.content) ? toolResult.content : []
  const parts = content.flatMap((item: unknown) => {
    if (!item || typeof item !== 'object') {
      return []
    }
    const contentItem = item as McpContentItem
    if (contentItem.type === 'text' && typeof contentItem.text === 'string') {
      return [contentItem.text]
    }
    if (contentItem.type === 'resource' && contentItem.resource !== undefined) {
      return [JSON.stringify(contentItem.resource)]
    }
    return []
  })

  if (parts.length === 0 && toolResult.structuredContent !== undefined) {
    parts.push(JSON.stringify(toolResult.structuredContent))
  }

  return {
    content: parts.join('\n\n') || JSON.stringify(result) || String(result),
    isError: toolResult.isError === true ? true : undefined,
  }
}

export interface ExaMcpConnection {
  tools: RegisteredTool[]
  close: () => Promise<void>
}

export async function connectExaMcp(
  signal?: AbortSignal
): Promise<ExaMcpConnection> {
  const client = new Client({ name: 'nextrouter-agent', version: '1.0.0' })
  const transport = new StreamableHTTPClientTransport(new URL(EXA_MCP_URL))

  try {
    await client.connect(transport, { signal })
    const result = await client.listTools(undefined, { signal })
    const tools = result.tools
      .filter((tool) => EXA_TOOL_NAMES.has(tool.name))
      .map((tool): RegisteredTool => {
        const definition: ToolDefinition = {
          type: 'function',
          function: {
            name: tool.name,
            description: tool.description ?? tool.name,
            parameters: tool.inputSchema,
          },
        }

        return {
          definition,
          execute: async (args, executionSignal) => {
            const toolResult = await client.callTool(
              {
                name: tool.name,
                arguments:
                  args && typeof args === 'object'
                    ? (args as Record<string, unknown>)
                    : {},
              },
              undefined,
              { signal: executionSignal }
            )
            return formatMcpToolResult(toolResult)
          },
        }
      })

    if (tools.length !== EXA_TOOL_NAMES.size) {
      throw new Error('Exa MCP did not provide the expected tools')
    }

    return {
      tools,
      close: () => client.close(),
    }
  } catch (error) {
    await client.close().catch(() => undefined)
    throw error
  }
}
