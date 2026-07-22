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
import type { ToolDefinition } from '../../types'
import { calculatorTool, type ToolExecuteResult } from './builtins/calculator'

export type { ToolExecuteResult, ToolExecutor } from './builtins/calculator'

export interface RegisteredTool {
  definition: ToolDefinition
  execute: (args: unknown, signal: AbortSignal) => Promise<ToolExecuteResult>
}

export interface AgentToolPack {
  id: string
  tools: RegisteredTool[]
  systemInstructions?: string
}

export function getToolPackTools(toolPacks: AgentToolPack[]): RegisteredTool[] {
  return toolPacks.flatMap((toolPack) => toolPack.tools)
}

export function getToolPackSystemInstructions(
  toolPacks: AgentToolPack[]
): string[] {
  return toolPacks.flatMap((toolPack) => {
    const instructions = toolPack.systemInstructions?.trim()
    return instructions ? [instructions] : []
  })
}

// Static, deterministic registry of built-in tools. Add new tools here.
const tools: RegisteredTool[] = [calculatorTool]

const toolsByName = new Map<string, RegisteredTool>(
  tools.map((tool) => [tool.definition.function.name, tool])
)

/**
 * Look up a registered tool by its function name.
 */
export function getTool(
  name: string,
  additionalTools: RegisteredTool[] = []
): RegisteredTool | undefined {
  return (
    additionalTools.find((tool) => tool.definition.function.name === name) ??
    toolsByName.get(name)
  )
}

/**
 * Return the OpenAI function-calling definitions for every registered tool.
 */
export function listToolDefinitions(
  additionalTools: RegisteredTool[] = []
): ToolDefinition[] {
  return [...tools, ...additionalTools].map((tool) => tool.definition)
}
