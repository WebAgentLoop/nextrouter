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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { formatTimestampToDate } from '@/lib/format'
import { handleServerError } from '@/lib/handle-server-error'
import { ROLE } from '@/lib/roles'
import { useAuthStore } from '@/stores/auth-store'

import {
  adminReplyTicket,
  adminUpdateTicketStatus,
  closeTicket,
  getTicket,
  replyTicket,
} from '../api'
import {
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
  TICKET_MESSAGE_ROLE,
  TICKET_PRIORITIES,
  TICKET_STATUSES,
  TICKET_STATUS,
} from '../constants'
import { useTickets } from './tickets-provider'

export function TicketsViewDialog() {
  const { t } = useTranslation()
  const { open, setOpen, currentRow, triggerRefresh } = useTickets()
  const isOpen = open === 'view'
  const ticketId = currentRow?.id
  const queryClient = useQueryClient()
  const userRole = useAuthStore((s) => s.auth.user?.role ?? 0)
  const isAdmin = userRole >= ROLE.ADMIN

  const [replyContent, setReplyContent] = useState('')
  const [isReplying, setIsReplying] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false)

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['ticket-detail', ticketId],
    queryFn: async () => {
      if (!ticketId) return null
      const result = await getTicket(ticketId)
      if (!result.success) {
        toast.error(result.message || t('Failed to load ticket'))
        return null
      }
      return result.data
    },
    enabled: isOpen && !!ticketId,
  })

  const ticket = data?.ticket ?? currentRow
  const sortedMessages = useMemo(
    () => [...(data?.messages ?? [])].sort((a, b) => a.created_at - b.created_at),
    [data?.messages]
  )

  const canClose =
    ticket &&
    ticket.status !== TICKET_STATUS.CLOSED

  const handleReply = async () => {
    if (!ticketId) return
    const content = replyContent.trim()
    if (!content) {
      toast.error(t('Reply content cannot be empty'))
      return
    }
    if (content.length > 2000) {
      toast.error(t('Reply content is too long'))
      return
    }
    setIsReplying(true)
    try {
      const result = isAdmin
        ? await adminReplyTicket(ticketId, content)
        : await replyTicket(ticketId, content)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.TICKET_REPLIED))
        setReplyContent('')
        await queryClient.invalidateQueries({
          queryKey: ['ticket-detail', ticketId],
        })
        triggerRefresh()
      } else {
        toast.error(result.message || t(ERROR_MESSAGES.REPLY_FAILED))
      }
    } catch (error: unknown) {
      handleServerError(error)
    } finally {
      setIsReplying(false)
    }
  }

  const handleClose = async () => {
    if (!ticketId) return
    setIsClosing(true)
    try {
      const result = await closeTicket(ticketId)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.TICKET_CLOSED))
        await queryClient.invalidateQueries({
          queryKey: ['ticket-detail', ticketId],
        })
        triggerRefresh()
      } else {
        toast.error(result.message || t(ERROR_MESSAGES.CLOSE_FAILED))
      }
    } catch (error: unknown) {
      handleServerError(error)
    } finally {
      setIsClosing(false)
    }
  }

  const handleStatusChange = async (newStatus: string | null) => {
    if (!ticketId || !newStatus) return
    setIsUpdatingStatus(true)
    try {
      const result = await adminUpdateTicketStatus(ticketId, newStatus)
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.TICKET_STATUS_UPDATED))
        await queryClient.invalidateQueries({
          queryKey: ['ticket-detail', ticketId],
        })
        triggerRefresh()
      } else {
        toast.error(result.message || t(ERROR_MESSAGES.STATUS_UPDATE_FAILED))
      }
    } catch (error: unknown) {
      handleServerError(error)
    } finally {
      setIsUpdatingStatus(false)
    }
  }

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        if (!v) setReplyContent('')
        if (!v) setOpen(null)
      }}
    >
      <DialogContent className='flex max-h-[90vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-[640px]'>
        <DialogHeader className='shrink-0 border-b px-4 py-3 sm:px-6'>
          <DialogTitle className='pr-6 text-left'>
            {ticket ? ticket.title : t('Ticket Detail')}
          </DialogTitle>
          <DialogDescription className='sr-only'>
            {t('View ticket detail and reply')}
          </DialogDescription>
        </DialogHeader>

        <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
          {isLoading && (
            <div className='flex flex-1 items-center justify-center p-8'>
              <span className='text-muted-foreground text-sm'>
                {t('Loading...')}
              </span>
            </div>
          )}
          {!isLoading && !ticket && (
            <div className='flex flex-1 items-center justify-center p-8'>
              <span className='text-muted-foreground text-sm'>
                {t('Failed to load ticket')}
              </span>
            </div>
          )}
          {!isLoading && ticket && (
            <>
              <div className='flex-1 overflow-y-auto px-4 py-4 sm:px-6'>
                <div className='space-y-4'>
                  {/* Ticket meta */}
                  <div className='flex flex-wrap items-center gap-2'>
                    {(() => {
                      const statusConfig = TICKET_STATUSES[ticket.status]
                      return statusConfig ? (
                        <StatusBadge
                          label={t(statusConfig.labelKey)}
                          variant={statusConfig.variant}
                          copyable={false}
                        />
                      ) : (
                        <StatusBadge
                          label={ticket.status}
                          variant='neutral'
                          copyable={false}
                        />
                      )
                    })()}
                    {(() => {
                      const priorityConfig =
                        TICKET_PRIORITIES[ticket.priority]
                      return priorityConfig ? (
                        <StatusBadge
                          label={t(priorityConfig.labelKey)}
                          variant={priorityConfig.variant}
                          copyable={false}
                        />
                      ) : null
                    })()}
                    <span className='text-muted-foreground font-mono text-xs'>
                      {formatTimestampToDate(ticket.created_at)}
                    </span>
                    {isAdmin && ticket.username && (
                      <span className='text-muted-foreground text-xs'>
                        {t('By {{name}}', { name: ticket.username })}
                      </span>
                    )}
                  </div>

                  {/* Ticket content */}
                  <div className='bg-muted/50 rounded-lg border p-3'>
                    <p className='text-sm leading-relaxed whitespace-pre-wrap'>
                      {ticket.content}
                    </p>
                  </div>

                  {/* Admin status switcher */}
                  {isAdmin && (
                    <div className='flex items-center gap-2'>
                      <span className='text-sm font-medium'>
                        {t('Status')}:
                      </span>
                      <Select
                        value={ticket.status}
                        onValueChange={handleStatusChange}
                        disabled={isUpdatingStatus || isFetching}
                      >
                        <SelectTrigger size='sm' className='w-[140px]'>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value={TICKET_STATUS.OPEN}>
                            {t('Open')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.PENDING}>
                            {t('Pending')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.ANSWERED}>
                            {t('Answered')}
                          </SelectItem>
                          <SelectItem value={TICKET_STATUS.CLOSED}>
                            {t('Closed')}
                          </SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  )}

                  {/* Messages timeline */}
                  <div className='space-y-3'>
                    <h4 className='text-sm font-semibold'>
                      {t('Messages')} {sortedMessages.length > 0 && `(${sortedMessages.length})`}
                    </h4>
                    {sortedMessages.length === 0 ? (
                      <p className='text-muted-foreground text-sm'>
                        {t('No messages yet. Start the conversation below.')}
                      </p>
                    ) : (
                      <div className='space-y-3'>
                        {sortedMessages.map((message) => {
                          const isAdminMessage = message.role === TICKET_MESSAGE_ROLE.ADMIN
                          return (
                            <div
                              key={message.id}
                              className={`flex flex-col gap-1 rounded-lg border p-3 ${
                                isAdminMessage
                                  ? 'border-info/20 bg-info/5'
                                  : 'bg-card'
                              }`}
                            >
                              <div className='flex items-center gap-2'>
                                <span className='text-sm font-medium'>
                                  {message.username}
                                </span>
                                <StatusBadge
                                  label={
                                    isAdminMessage
                                      ? t('Admin')
                                      : t('User')
                                  }
                                  variant={
                                    isAdminMessage ? 'info' : 'neutral'
                                  }
                                  copyable={false}
                                  size='sm'
                                />
                                <span className='text-muted-foreground ml-auto font-mono text-xs'>
                                  {formatTimestampToDate(message.created_at)}
                                </span>
                              </div>
                              <p className='text-sm leading-relaxed whitespace-pre-wrap'>
                                {message.content}
                              </p>
                            </div>
                          )
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Reply area */}
              <div className='shrink-0 border-t bg-background px-4 py-3 sm:px-6'>
                {ticket.status === TICKET_STATUS.CLOSED ? (
                  <div className='flex items-center justify-between'>
                    <span className='text-muted-foreground text-sm'>
                      {t('This ticket is closed and cannot be replied to.')}
                    </span>
                    <Button variant='outline' size='sm' onClick={() => setOpen(null)}>
                      {t('Close')}
                    </Button>
                  </div>
                ) : (
                  <div className='space-y-3'>
                    <Textarea
                      value={replyContent}
                      onChange={(e) => setReplyContent(e.target.value)}
                      placeholder={t('Write a reply...')}
                      rows={3}
                      maxLength={2000}
                      disabled={isReplying}
                    />
                    <div className='flex items-center justify-between gap-2'>
                      <div className='flex gap-2'>
                        {canClose && (
                          <Button
                            variant='outline'
                            size='sm'
                            onClick={handleClose}
                            disabled={isClosing || isReplying}
                          >
                            {isClosing ? t('Closing...') : t('Close Ticket')}
                          </Button>
                        )}
                      </div>
                      <div className='flex gap-2'>
                        <Button
                          variant='outline'
                          size='sm'
                          onClick={() => setOpen(null)}
                        >
                          {t('Cancel')}
                        </Button>
                        <Button
                          size='sm'
                          onClick={handleReply}
                          disabled={isReplying || !replyContent.trim()}
                        >
                          {isReplying ? t('Sending...') : t('Send')}
                        </Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
