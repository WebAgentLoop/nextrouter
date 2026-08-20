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
import { useQuery } from '@tanstack/react-query'
import { getRouteApi } from '@tanstack/react-router'
import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTablePage, useDataTable } from '@/components/data-table'
import { useMediaQuery } from '@/hooks'
import { useTableUrlState } from '@/hooks/use-table-url-state'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'

import { adminGetTickets, getTickets } from '../api'
import { ERROR_MESSAGES, getTicketStatusOptions } from '../constants'
import { useTicketsColumns } from './tickets-columns'
import { useTickets } from './tickets-provider'

const route = getRouteApi('/_authenticated/tickets/')

export function TicketsTable() {
  const { t } = useTranslation()
  const columns = useTicketsColumns()
  const { refreshTrigger } = useTickets()
  const isMobile = useMediaQuery('(max-width: 640px)')
  const userRole = useAuthStore((s) => s.auth.user?.role ?? 0)
  const isAdmin = userRole >= ROLE.ADMIN

  const {
    globalFilter,
    onGlobalFilterChange,
    columnFilters,
    onColumnFiltersChange,
    pagination,
    onPaginationChange,
    ensurePageInRange,
  } = useTableUrlState({
    search: route.useSearch(),
    navigate: route.useNavigate(),
    pagination: { defaultPage: 1, defaultPageSize: isMobile ? 10 : 20 },
    globalFilter: { enabled: true, key: 'keyword' },
    columnFilters: [{ columnId: 'status', searchKey: 'status', type: 'array' }],
  })
  const statusFilter =
    (columnFilters.find((filter) => filter.id === 'status')?.value as
      | string[]
      | undefined) ?? []
  const statusFilterValue = statusFilter[0] ?? ''

  const ticketStatusOptions = useMemo(
    () => getTicketStatusOptions(t),
    [t]
  )

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      'tickets',
      pagination.pageIndex + 1,
      pagination.pageSize,
      globalFilter,
      statusFilterValue,
      refreshTrigger,
      isAdmin,
    ],
    queryFn: async () => {
      const keyword = globalFilter?.trim() ?? ''
      const params = {
        p: pagination.pageIndex + 1,
        page_size: pagination.pageSize,
        status: statusFilterValue,
        keyword,
      }

      const result = isAdmin
        ? await adminGetTickets(params)
        : await getTickets(params)

      if (!result.success) {
        toast.error(
          result.message ||
            t(
              keyword || statusFilterValue
                ? ERROR_MESSAGES.SEARCH_FAILED
                : ERROR_MESSAGES.LOAD_FAILED
            )
        )
        return { items: [], total: 0 }
      }

      return {
        items: result.data?.items || [],
        total: result.data?.total || 0,
      }
    },
    placeholderData: (previousData) => previousData,
  })

  const tickets = data?.items || []

  const { table } = useDataTable({
    data: tickets,
    columns,
    columnFilters,
    globalFilter,
    pagination,
    globalFilterFn: (row, _columnId, filterValue) => {
      const title = String(row.getValue('title')).toLowerCase()
      const id = String(row.getValue('id'))
      const searchValue = String(filterValue).toLowerCase()
      return title.includes(searchValue) || id.includes(searchValue)
    },
    onPaginationChange,
    onGlobalFilterChange,
    onColumnFiltersChange,
    manualPagination: true,
    manualFiltering: true,
    totalCount: data?.total || 0,
    ensurePageInRange,
  })

  return (
    <DataTablePage
      table={table}
      columns={columns}
      isLoading={isLoading}
      isFetching={isFetching}
      emptyTitle={t('No Tickets Found')}
      emptyDescription={t(
        'No support tickets available. Create your first ticket to get started.'
      )}
      skeletonKeyPrefix='tickets-skeleton'
      applyHeaderSize
      toolbarProps={{
        searchPlaceholder: t('Search by title or ID...'),
        searchDebounceMs: 500,
        filters: [
          {
            columnId: 'status',
            title: t('Status'),
            options: ticketStatusOptions,
            singleSelect: true,
          },
        ],
      }}
    />
  )
}
