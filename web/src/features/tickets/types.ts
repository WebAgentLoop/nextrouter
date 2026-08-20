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

// ============================================================================
// Ticket Schema & Types
// ============================================================================

export const ticketSchema = z.object({
  id: z.number(),
  user_id: z.number(),
  username: z.string(),
  title: z.string(),
  content: z.string(),
  status: z.string(),
  priority: z.number(),
  created_at: z.number(),
  updated_at: z.number(),
  closed_at: z.number(),
})

export type Ticket = z.infer<typeof ticketSchema>

export const ticketMessageSchema = z.object({
  id: z.number(),
  ticket_id: z.number(),
  user_id: z.number(),
  username: z.string(),
  role: z.string(),
  content: z.string(),
  created_at: z.number(),
})

export type TicketMessage = z.infer<typeof ticketMessageSchema>

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface ApiResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
}

export interface GetTicketsParams {
  p?: number
  page_size?: number
  status?: string
  keyword?: string
}

export interface GetTicketsResponse {
  success: boolean
  message?: string
  data?: {
    items: Ticket[]
    total: number
    page: number
    page_size: number
  }
}

export interface GetTicketDetailResponse {
  success: boolean
  message?: string
  data?: {
    ticket: Ticket
    messages: TicketMessage[]
  }
}

export interface AdminGetTicketsParams extends GetTicketsParams {
  user_id?: number
}

export interface TicketFormData {
  title: string
  content: string
  priority: number
}

// ============================================================================
// Dialog Types
// ============================================================================

export type TicketsDialogType = 'create' | 'view' | 'reply'
