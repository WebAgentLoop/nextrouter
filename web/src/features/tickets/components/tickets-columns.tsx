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
import type { ColumnDef } from '@tanstack/react-table'
import { useTranslation } from 'react-i18next'

import { StatusBadge } from '@/components/status-badge'
import { TableId } from '@/components/table-id'
import { Button } from '@/components/ui/button'
import { formatTimestampToDate } from '@/lib/format'
import { useAuthStore } from '@/stores/auth-store'
import { ROLE } from '@/lib/roles'

import { TICKET_PRIORITIES, TICKET_STATUSES } from '../constants'
import type { Ticket } from '../types'
import { DataTableRowActions } from './data-table-row-actions'
import { useTickets } from './tickets-provider'

export function useTicketsColumns(): ColumnDef<Ticket>[] {
  const { t } = useTranslation()
  const { setOpen, setCurrentRow } = useTickets()
  const userRole = useAuthStore((s) => s.auth.user?.role ?? 0)
  const isAdmin = userRole >= ROLE.ADMIN

  const columns: ColumnDef<Ticket>[] = [
    {
      accessorKey: 'id',
      header: t('ID'),
      meta: { mobileHidden: true },
      cell: (props) => {
        return (
          <TableId value={props.row.getValue('id') as number} className='w-[70px]' />
        )
      },
      size: 80,
    },
    {
      accessorKey: 'title',
      header: t('Title'),
      meta: { mobileTitle: true },
      cell: (props) => {
        const ticket = props.row.original
        return (
          <Button
            variant='link'
            size='sm'
            className='h-auto justify-start p-0 text-left font-medium'
            onClick={() => {
              setCurrentRow(ticket)
              setOpen('view')
            }}
          >
            <span className='truncate'>{ticket.title}</span>
          </Button>
        )
      },
      size: 280,
    },
    {
      accessorKey: 'status',
      header: t('Status'),
      meta: { mobileBadge: true },
      cell: (props) => {
        const statusValue = props.row.getValue('status') as string
        const statusConfig = TICKET_STATUSES[statusValue]
        if (!statusConfig) {
          return (
            <StatusBadge
              label={statusValue}
              variant='neutral'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }
        return (
          <StatusBadge
            label={t(statusConfig.labelKey)}
            variant={statusConfig.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 120,
    },
    {
      accessorKey: 'priority',
      header: t('Priority'),
      cell: (props) => {
        const priorityValue = props.row.getValue('priority') as number
        const priorityConfig = TICKET_PRIORITIES[priorityValue]
        if (!priorityConfig) {
          return (
            <StatusBadge
              label={String(priorityValue)}
              variant='neutral'
              copyable={false}
              className='-ml-1.5'
            />
          )
        }
        return (
          <StatusBadge
            label={t(priorityConfig.labelKey)}
            variant={priorityConfig.variant}
            copyable={false}
            className='-ml-1.5'
          />
        )
      },
      size: 110,
    },
  ]

  if (isAdmin) {
    columns.push({
      accessorKey: 'username',
      header: t('Username'),
      meta: { mobileHidden: true },
      cell: (props) => {
        const username = props.row.getValue('username') as string
        if (!username) {
          return <span className='text-muted-foreground text-sm'>-</span>
        }
        return (
          <span className='text-sm'>{username}</span>
        )
      },
      size: 140,
    })
  } else {
    // Keep username column hidden on mobile for non-admin, but include as hidden to preserve layout consistency
    // Do not push username column for regular users
  }

  columns.push(
    {
      accessorKey: 'created_at',
      header: t('Created'),
      meta: { mobileHidden: true },
      cell: (props) => {
        return (
          <div className='min-w-[160px] font-mono text-sm'>
            {formatTimestampToDate(props.row.getValue('created_at') as number)}
          </div>
        )
      },
      size: 180,
    },
    {
      id: 'actions',
      header: () => t('Actions'),
      cell: (props) => <DataTableRowActions row={props.row} />,
      meta: { pinned: 'right' as const },
      size: 80,
    }
  )

  return columns
}
