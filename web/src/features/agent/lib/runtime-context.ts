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
import { normalizeInterfaceLanguage, toIntlLocale } from '@/i18n/languages'

export interface AgentRuntimeContextInput {
  now: Date
  timeZone: string
  locale: string
  requestedModel: string
  checkinEnabled: boolean | null
  checkedInToday: boolean | null
}

function formatDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const values = new Map(parts.map((part) => [part.type, part.value]))
  return `${values.get('year')}-${values.get('month')}-${values.get('day')}`
}

function safeModelName(value: string): string {
  return value
    .replaceAll(/[^A-Za-z0-9._:/@+-]+/g, '_')
    .replaceAll(/^_+|_+$/g, '')
    .slice(0, 255)
}

export function buildAgentRuntimeContext(
  input: AgentRuntimeContextInput
): string {
  let timeZone = input.timeZone
  let currentDate: string
  try {
    currentDate = formatDate(input.now, timeZone)
  } catch {
    timeZone = 'UTC'
    currentDate = formatDate(input.now, timeZone)
  }

  const locale = toIntlLocale(normalizeInterfaceLanguage(input.locale)) ?? 'en'
  const requestedModel = safeModelName(input.requestedModel) || 'unknown'
  const checkinEnabled =
    input.checkinEnabled === null
      ? 'UNKNOWN'
      : String(input.checkinEnabled).toUpperCase()
  let checkedInToday = 'UNKNOWN'
  if (input.checkinEnabled === false) {
    checkedInToday = 'NOT_APPLICABLE'
  } else if (input.checkedInToday !== null) {
    checkedInToday = String(input.checkedInToday).toUpperCase()
  }

  return `<AUTO_GEN_INFO>
CURRENT_DATE: ${currentDate}
TIME_ZONE: ${timeZone}
UI_LOCALE: ${locale}
REQUESTED_MODEL: ${requestedModel}
CHECKIN_ENABLED: ${checkinEnabled}
CHECKED_IN_TODAY: ${checkedInToday}
</AUTO_GEN_INFO>`
}
