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
import type { TFunction } from 'i18next'

import type { StatusBadgeProps } from '@/components/status-badge'

// ============================================================================
// Ticket Status Configuration
// ============================================================================

export const TICKET_STATUS = {
  OPEN: 'open',
  PENDING: 'pending',
  ANSWERED: 'answered',
  CLOSED: 'closed',
} as const

// labelKey values are i18n keys; use t(config.labelKey) in components
export const TICKET_STATUSES: Record<
  string,
  Pick<StatusBadgeProps, 'variant'> & {
    labelKey: string
    value: string
  }
> = {
  [TICKET_STATUS.OPEN]: {
    labelKey: 'Open',
    variant: 'warning',
    value: TICKET_STATUS.OPEN,
  },
  [TICKET_STATUS.PENDING]: {
    labelKey: 'Pending',
    variant: 'warning',
    value: TICKET_STATUS.PENDING,
  },
  [TICKET_STATUS.ANSWERED]: {
    labelKey: 'Answered',
    variant: 'success',
    value: TICKET_STATUS.ANSWERED,
  },
  [TICKET_STATUS.CLOSED]: {
    labelKey: 'Closed',
    variant: 'neutral',
    value: TICKET_STATUS.CLOSED,
  },
} as const

export const TICKET_FILTER_VALUES = [
  TICKET_STATUS.OPEN,
  TICKET_STATUS.PENDING,
  TICKET_STATUS.ANSWERED,
  TICKET_STATUS.CLOSED,
] as const

export function getTicketStatusOptions(t: TFunction) {
  return Object.values(TICKET_STATUSES).map((config) => ({
    label: t(config.labelKey),
    value: config.value,
  }))
}

// ============================================================================
// Ticket Priority Configuration
// ============================================================================

export const TICKET_PRIORITY = {
  LOW: 0,
  MEDIUM: 1,
  HIGH: 2,
  URGENT: 3,
} as const

export const TICKET_PRIORITIES: Record<
  number,
  Pick<StatusBadgeProps, 'variant'> & {
    labelKey: string
    value: number
  }
> = {
  [TICKET_PRIORITY.LOW]: {
    labelKey: 'Low',
    variant: 'neutral',
    value: TICKET_PRIORITY.LOW,
  },
  [TICKET_PRIORITY.MEDIUM]: {
    labelKey: 'Medium',
    variant: 'success',
    value: TICKET_PRIORITY.MEDIUM,
  },
  [TICKET_PRIORITY.HIGH]: {
    labelKey: 'High',
    variant: 'warning',
    value: TICKET_PRIORITY.HIGH,
  },
  [TICKET_PRIORITY.URGENT]: {
    labelKey: 'Urgent',
    variant: 'danger',
    value: TICKET_PRIORITY.URGENT,
  },
} as const

export function getTicketPriorityOptions(t: TFunction) {
  return Object.values(TICKET_PRIORITIES).map((config) => ({
    label: t(config.labelKey),
    value: String(config.value),
  }))
}

// ============================================================================
// Ticket Message Role
// ============================================================================

export const TICKET_MESSAGE_ROLE = {
  USER: 'user',
  ADMIN: 'admin',
} as const

// ============================================================================
// Validation Constants
// ============================================================================

export const TICKET_VALIDATION = {
  TITLE_MIN_LENGTH: 1,
  TITLE_MAX_LENGTH: 200,
  CONTENT_MIN_LENGTH: 1,
  CONTENT_MAX_LENGTH: 2000,
  PRIORITY_MIN: 0,
  PRIORITY_MAX: 3,
} as const

// ============================================================================
// Error Messages (i18n keys; use t(ERROR_MESSAGES.xxx) when displaying)
// ============================================================================

export const ERROR_MESSAGES = {
  UNEXPECTED: 'An unexpected error occurred',
  LOAD_FAILED: 'Failed to load tickets',
  LOAD_DETAIL_FAILED: 'Failed to load ticket',
  SEARCH_FAILED: 'Failed to search tickets',
  CREATE_FAILED: 'Failed to create ticket',
  REPLY_FAILED: 'Failed to reply to ticket',
  CLOSE_FAILED: 'Failed to close ticket',
  STATUS_UPDATE_FAILED: 'Failed to update ticket status',
  TITLE_REQUIRED: 'Title is required',
  TITLE_LENGTH_INVALID: 'Title must be between 1 and 200 characters',
  CONTENT_REQUIRED: 'Content is required',
  CONTENT_LENGTH_INVALID: 'Content must be between 1 and 2000 characters',
  PRIORITY_INVALID: 'Priority must be between 0 and 3',
} as const

// ============================================================================
// Success Messages (i18n keys; use t(SUCCESS_MESSAGES.xxx) when displaying)
// ============================================================================

export const SUCCESS_MESSAGES = {
  TICKET_CREATED: 'Ticket created successfully',
  TICKET_REPLIED: 'Replied successfully',
  TICKET_CLOSED: 'Ticket closed successfully',
  TICKET_STATUS_UPDATED: 'Ticket status updated successfully',
} as const
