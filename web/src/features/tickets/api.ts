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

import type {
  ApiResponse,
  GetTicketsParams,
  GetTicketsResponse,
  GetTicketDetailResponse,
  AdminGetTicketsParams,
  Ticket,
  TicketMessage,
  TicketFormData,
} from './types'

// ============================================================================
// Ticket Management (User)
// ============================================================================

// Get paginated tickets list for current user
export async function getTickets(
  params: GetTicketsParams = {}
): Promise<GetTicketsResponse> {
  const { p = 1, page_size = 10, status, keyword } = params
  const queryParams = new URLSearchParams()
  queryParams.set('p', String(p))
  queryParams.set('page_size', String(page_size))
  if (status) queryParams.set('status', status)
  if (keyword) queryParams.set('keyword', keyword)
  const res = await api.get(`/api/ticket?${queryParams.toString()}`)
  return res.data
}

// Get single ticket detail with messages
export async function getTicket(
  id: number
): Promise<GetTicketDetailResponse> {
  const res = await api.get(`/api/ticket/${id}`)
  return res.data
}

// Create a new ticket
export async function createTicket(
  data: TicketFormData
): Promise<ApiResponse<Ticket>> {
  const res = await api.post('/api/ticket', data)
  return res.data
}

// Reply to a ticket (user)
export async function replyTicket(
  id: number,
  content: string
): Promise<ApiResponse<TicketMessage>> {
  const res = await api.post(`/api/ticket/${id}/reply`, { content })
  return res.data
}

// Close a ticket (user)
export async function closeTicket(id: number): Promise<ApiResponse> {
  const res = await api.post(`/api/ticket/${id}/close`)
  return res.data
}

// ============================================================================
// Ticket Management (Admin)
// ============================================================================

// Get paginated tickets list for admin (all users)
export async function adminGetTickets(
  params: AdminGetTicketsParams = {}
): Promise<GetTicketsResponse> {
  const { p = 1, page_size = 10, status, keyword, user_id } = params
  const queryParams = new URLSearchParams()
  queryParams.set('p', String(p))
  queryParams.set('page_size', String(page_size))
  if (status) queryParams.set('status', status)
  if (keyword) queryParams.set('keyword', keyword)
  if (user_id != null) queryParams.set('user_id', String(user_id))
  const res = await api.get(`/api/ticket/admin/list?${queryParams.toString()}`)
  return res.data
}

// Reply to a ticket as admin
export async function adminReplyTicket(
  id: number,
  content: string
): Promise<ApiResponse<TicketMessage>> {
  const res = await api.post(`/api/ticket/admin/${id}/reply`, { content })
  return res.data
}

// Update ticket status as admin
export async function adminUpdateTicketStatus(
  id: number,
  status: string
): Promise<ApiResponse> {
  const res = await api.put(`/api/ticket/admin/${id}/status`, { status })
  return res.data
}
