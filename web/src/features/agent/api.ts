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
import { api } from '@/lib/api'

import { API_ENDPOINTS, DEFAULT_AGENT_SETTINGS } from './constants'
import type { AgentSettings, GroupOption, ModelOption } from './types'

export async function getAgentSettings(): Promise<AgentSettings> {
  const res = await api.get(API_ENDPOINTS.SETTINGS)
  const data = res.data?.data as Partial<AgentSettings> | undefined

  if (!res.data?.success || !data) {
    throw new Error('Failed to load agent settings')
  }

  return {
    system_prompt:
      typeof data.system_prompt === 'string' ? data.system_prompt : '',
    default_model:
      typeof data.default_model === 'string'
        ? data.default_model
        : DEFAULT_AGENT_SETTINGS.default_model,
    default_group:
      typeof data.default_group === 'string'
        ? data.default_group
        : DEFAULT_AGENT_SETTINGS.default_group,
    temperature: typeof data.temperature === 'number' ? data.temperature : null,
    max_tokens: typeof data.max_tokens === 'number' ? data.max_tokens : null,
    max_iterations:
      typeof data.max_iterations === 'number'
        ? data.max_iterations
        : DEFAULT_AGENT_SETTINGS.max_iterations,
  }
}

export async function getAgentCheckinStatus(
  signal: AbortSignal
): Promise<boolean | null> {
  const res = await api.get('/api/user/checkin', {
    signal,
    skipErrorHandler: true,
  })
  const checkedInToday = res.data?.data?.stats?.checked_in_today
  return typeof checkedInToday === 'boolean' ? checkedInToday : null
}

/**
 * Fetch the models available to the current user for a given group.
 */
export async function getUserModels(group: string): Promise<ModelOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_MODELS, {
    params: { group },
  })
  const { data } = res

  if (!data.success || !Array.isArray(data.data)) {
    return []
  }

  return data.data.map((model: string) => ({
    label: model,
    value: model,
  }))
}

/**
 * Fetch the groups available to the current user, with ratio and description.
 */
export async function getUserGroups(): Promise<GroupOption[]> {
  const res = await api.get(API_ENDPOINTS.USER_GROUPS)
  const { data } = res

  if (!data.success || !data.data) {
    return []
  }

  const groupData = data.data as Record<string, { desc: string; ratio: number }>

  return Object.entries(groupData).map(([group, info]) => ({
    label: group,
    value: group,
    ratio: info.ratio,
    desc: info.desc,
  }))
}
