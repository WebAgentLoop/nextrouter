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
import { Check, MessageSquare, Pencil, Trash2, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import dayjs from '@/lib/dayjs'
import { cn } from '@/lib/utils'

import { DEFAULT_SESSION_TITLE } from '../lib'
import type { AgentSessionSummary } from '../types'

interface AgentHistorySheetProps {
  open: boolean
  sessions: AgentSessionSummary[]
  activeSessionId: string | null
  onOpenChange: (open: boolean) => void
  onSelectSession: (id: string) => void
  onDeleteSession: (id: string) => void
  onRenameSession: (id: string, title: string) => void
}

export function AgentHistorySheet({
  open,
  sessions,
  activeSessionId,
  onOpenChange,
  onSelectSession,
  onDeleteSession,
  onRenameSession,
}: AgentHistorySheetProps) {
  const { t } = useTranslation()
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [draft, setDraft] = useState('')

  useEffect(() => {
    if (!open) {
      setRenamingId(null)
    }
  }, [open])

  const startRename = (session: AgentSessionSummary) => {
    setRenamingId(session.id)
    setDraft(session.title)
  }

  const commitRename = () => {
    if (!renamingId) {
      return
    }
    const trimmed = draft.trim()
    setRenamingId(null)
    if (trimmed) {
      onRenameSession(renamingId, trimmed)
    }
  }

  const cancelRename = () => {
    setRenamingId(null)
  }

  const handleDelete = (session: AgentSessionSummary) => {
    if (
      window.confirm(t('Are you sure you want to delete this conversation?'))
    ) {
      onDeleteSession(session.id)
    }
  }

  return (
    <Sheet onOpenChange={onOpenChange} open={open}>
      <SheetContent className='w-full sm:max-w-md'>
        <SheetHeader>
          <SheetTitle>{t('History')}</SheetTitle>
          <SheetDescription>
            {t('Past conversations saved on this device')}
          </SheetDescription>
        </SheetHeader>

        {sessions.length === 0 ? (
          <div className='text-muted-foreground flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center text-sm'>
            <MessageSquare className='size-8 opacity-40' />
            <span>{t('No conversations yet')}</span>
          </div>
        ) : (
          <ScrollArea className='-mx-4 flex-1 px-4'>
            <div className='flex flex-col gap-1 pb-4'>
              {sessions.map((session) => {
                const isActive = session.id === activeSessionId
                const isRenaming = renamingId === session.id
                const displayTitle =
                  session.title === DEFAULT_SESSION_TITLE
                    ? t(DEFAULT_SESSION_TITLE)
                    : session.title

                return (
                  <div
                    className={cn(
                      'group flex items-center gap-2 rounded-md border border-transparent px-2 py-2 transition-colors',
                      isActive
                        ? 'bg-muted/60 border-border/60'
                        : 'hover:bg-muted/40'
                    )}
                    key={session.id}
                  >
                    {isRenaming ? (
                      <>
                        <Input
                          autoFocus
                          className='h-8 flex-1'
                          onChange={(event) => setDraft(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') {
                              event.preventDefault()
                              commitRename()
                            } else if (event.key === 'Escape') {
                              event.preventDefault()
                              cancelRename()
                            }
                          }}
                          value={draft}
                        />
                        <Button
                          aria-label={t('Save')}
                          onClick={commitRename}
                          size='icon-sm'
                          variant='ghost'
                        >
                          <Check className='size-4' />
                        </Button>
                        <Button
                          aria-label={t('Cancel')}
                          onClick={cancelRename}
                          size='icon-sm'
                          variant='ghost'
                        >
                          <X className='size-4' />
                        </Button>
                      </>
                    ) : (
                      <>
                        <button
                          className='flex min-w-0 flex-1 flex-col items-start gap-0.5 text-left'
                          onClick={() => onSelectSession(session.id)}
                          type='button'
                        >
                          <span className='w-full truncate text-sm font-medium'>
                            {displayTitle}
                          </span>
                          <span className='text-muted-foreground flex items-center gap-1.5 text-xs'>
                            <span>{dayjs(session.updatedAt).fromNow()}</span>
                            <span aria-hidden='true'>·</span>
                            <span>
                              {t('{{count}} messages', {
                                count: session.messageCount,
                              })}
                            </span>
                          </span>
                        </button>
                        <div className='flex items-center opacity-0 transition-opacity group-hover:opacity-100 max-md:opacity-100'>
                          <Button
                            aria-label={t('Rename')}
                            onClick={() => startRename(session)}
                            size='icon-sm'
                            variant='ghost'
                          >
                            <Pencil className='size-4' />
                          </Button>
                          <Button
                            aria-label={t('Delete')}
                            onClick={() => handleDelete(session)}
                            size='icon-sm'
                            variant='ghost'
                          >
                            <Trash2 className='size-4' />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                )
              })}
            </div>
          </ScrollArea>
        )}
      </SheetContent>
    </Sheet>
  )
}
