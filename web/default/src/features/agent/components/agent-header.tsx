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
import { Check, History, Pencil, Plus, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import { DEFAULT_SESSION_TITLE } from '../lib'

interface AgentHeaderProps {
  sessionTitle: string
  isGenerating: boolean
  onNewSession: () => void
  onRenameActive: (title: string) => void
  onHistoryOpenChange: (open: boolean) => void
}

export function AgentHeader({
  sessionTitle,
  isGenerating,
  onNewSession,
  onRenameActive,
  onHistoryOpenChange,
}: AgentHeaderProps) {
  const { t } = useTranslation()
  const [isEditing, setIsEditing] = useState(false)
  const [draft, setDraft] = useState(sessionTitle)

  useEffect(() => {
    if (!isEditing) {
      setDraft(sessionTitle)
    }
  }, [sessionTitle, isEditing])

  const commitRename = () => {
    const trimmed = draft.trim()
    setIsEditing(false)
    if (trimmed && trimmed !== sessionTitle) {
      onRenameActive(trimmed)
    } else {
      setDraft(sessionTitle)
    }
  }

  const cancelRename = () => {
    setIsEditing(false)
    setDraft(sessionTitle)
  }

  const displayTitle =
    sessionTitle === DEFAULT_SESSION_TITLE ? t(DEFAULT_SESSION_TITLE) : sessionTitle

  return (
    <div className='border-border/60 bg-background/95 supports-backdrop-filter:backdrop-blur relative z-10 flex h-12 shrink-0 items-center gap-2 border-b px-3'>
      <div className='flex min-w-0 flex-1 items-center gap-1.5'>
        {isEditing ? (
          <>
            <Input
              autoFocus
              className='h-8 max-w-xs'
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
          <button
            className='group/title flex min-w-0 items-center gap-1.5 rounded px-1 py-0.5 text-left hover:bg-muted/60'
            onClick={() => setIsEditing(true)}
            title={t('Rename')}
            type='button'
          >
            <span className='truncate text-sm font-medium'>{displayTitle}</span>
            <Pencil className='text-muted-foreground size-3.5 opacity-0 group-hover/title:opacity-100' />
          </button>
        )}
      </div>

      <div className='flex items-center gap-1'>
        <Button
          className='h-8 gap-1.5 px-2.5 text-xs font-medium'
          disabled={isGenerating}
          onClick={onNewSession}
          size='sm'
          variant='ghost'
        >
          <Plus className='size-4' />
          <span className='hidden sm:inline'>{t('New chat')}</span>
        </Button>
        <Button
          aria-label={t('History')}
          className='h-8 gap-1.5 px-2.5 text-xs font-medium'
          disabled={isGenerating}
          onClick={() => onHistoryOpenChange(true)}
          size='sm'
          variant='ghost'
        >
          <History className='size-4' />
          <span className='hidden sm:inline'>{t('History')}</span>
        </Button>
      </div>
    </div>
  )
}
