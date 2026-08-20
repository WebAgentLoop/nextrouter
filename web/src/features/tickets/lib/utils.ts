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

For commercial licensing, please contact support@quantumnous.com
*/
import type { StatusBadgeProps } from '@/components/status-badge'
import { formatTimestampToDate } from '@/lib/format'

import { TICKET_PRIORITIES, TICKET_STATUSES } from '../constants'

// ============================================================================
// Status Helpers
// ============================================================================

export function getTicketStatusVariant(
  status: string
): StatusBadgeProps['variant'] {
  return TICKET_STATUSES[status]?.variant ?? 'neutral'
}

export function getTicketPriorityVariant(
  priority: number
): StatusBadgeProps['variant'] {
  return TICKET_PRIORITIES[priority]?.variant ?? 'neutral'
}

export function isTicketClosed(status: string): boolean {
  return status === 'closed'
}

// ============================================================================
// Date Helpers
// ============================================================================

export function formatTicketDate(timestamp: number): string {
  return formatTimestampToDate(timestamp)
}
