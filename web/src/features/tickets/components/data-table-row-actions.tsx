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
import type { Row } from '@tanstack/react-table'
import { Eye, MessageSquare, XCircle } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { DataTableRowActionMenu } from '@/components/data-table/core/row-action-menu'
import { Button } from '@/components/ui/button'
import {
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuShortcut,
} from '@/components/ui/dropdown-menu'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { handleServerError } from '@/lib/handle-server-error'

import { closeTicket } from '../api'
import { SUCCESS_MESSAGES, TICKET_STATUS } from '../constants'
import { ticketSchema } from '../types'
import { useTickets } from './tickets-provider'

type DataTableRowActionsProps<TData> = {
  row: Row<TData>
}

export function DataTableRowActions<TData>(props: DataTableRowActionsProps<TData>) {
  const { t } = useTranslation()
  const ticket = ticketSchema.parse(props.row.original)
  const { setOpen, setCurrentRow, triggerRefresh } = useTickets()
  const [isClosing, setIsClosing] = useState(false)

  const isClosed = ticket.status === TICKET_STATUS.CLOSED

  const handleClose = async () => {
    if (isClosed || isClosing) return
    setIsClosing(true)
    try {
      const result = await closeTicket(ticket.id)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.TICKET_CLOSED))
        triggerRefresh()
      }
    } catch (error: unknown) {
      handleServerError(error)
    } finally {
      setIsClosing(false)
    }
  }

  return (
    <div className='-ml-1.5 flex items-center gap-1'>
      <Tooltip>
        <TooltipTrigger
          render={
            <Button
              variant='ghost'
              size='icon-sm'
              onClick={() => {
                setCurrentRow(ticket)
                setOpen('view')
              }}
              aria-label={t('View')}
            />
          }
        >
          <Eye className='size-4' />
        </TooltipTrigger>
        <TooltipContent>{t('View')}</TooltipContent>
      </Tooltip>

      <DataTableRowActionMenu ariaLabel={t('Open menu')} modal={false}>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(ticket)
            setOpen('view')
          }}
        >
          {t('View')}
          <DropdownMenuShortcut>
            <Eye size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuItem
          onClick={() => {
            setCurrentRow(ticket)
            setOpen('view')
          }}
          disabled={isClosed}
        >
          {t('Reply')}
          <DropdownMenuShortcut>
            <MessageSquare size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onClick={handleClose}
          disabled={isClosed || isClosing}
          className='text-destructive focus:text-destructive'
        >
          {isClosing ? t('Closing...') : t('Close')}
          <DropdownMenuShortcut>
            <XCircle size={16} />
          </DropdownMenuShortcut>
        </DropdownMenuItem>
      </DataTableRowActionMenu>
    </div>
  )
}
