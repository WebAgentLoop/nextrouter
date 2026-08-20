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
import type { TFunction } from 'i18next'
import { z } from 'zod'

import { TICKET_VALIDATION } from '../constants'

// ============================================================================
// Form Schema (use getTicketFormSchema(t) in components for i18n messages)
// ============================================================================

export function getTicketFormSchema(t: TFunction) {
  return z.object({
    title: z
      .string()
      .min(
        TICKET_VALIDATION.TITLE_MIN_LENGTH,
        t('Title must be between 1 and 200 characters')
      )
      .max(
        TICKET_VALIDATION.TITLE_MAX_LENGTH,
        t('Title must be between 1 and 200 characters')
      ),
    content: z
      .string()
      .min(
        TICKET_VALIDATION.CONTENT_MIN_LENGTH,
        t('Content must be between 1 and 2000 characters')
      )
      .max(
        TICKET_VALIDATION.CONTENT_MAX_LENGTH,
        t('Content must be between 1 and 2000 characters')
      ),
    priority: z
      .number()
      .min(TICKET_VALIDATION.PRIORITY_MIN, t('Priority must be between 0 and 3'))
      .max(TICKET_VALIDATION.PRIORITY_MAX, t('Priority must be between 0 and 3')),
  })
}

export type TicketFormValues = z.infer<ReturnType<typeof getTicketFormSchema>>

// ============================================================================
// Form Defaults
// ============================================================================

export const TICKET_FORM_DEFAULT_VALUES: TicketFormValues = {
  title: '',
  content: '',
  priority: TICKET_VALIDATION.PRIORITY_MIN,
}
