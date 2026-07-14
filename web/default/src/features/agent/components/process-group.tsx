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
import { BrainIcon, ChevronDownIcon, WrenchIcon } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Reasoning,
  ReasoningContent,
  ReasoningTrigger,
} from '@/components/ai-elements/reasoning'
import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'

import {
  processGroupStatus,
  type ProcessItem,
} from '../lib/message/turn-builder'
import { StatusIcon, ToolCallRow } from './tool-call-group'
import type { ToolCallStatus } from '../types'

const STATUS_LABEL_KEY: Record<ToolCallStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Completed',
  error: 'Failed',
  cancelled: 'Cancelled',
}

const AUTO_CLOSE_DELAY = 600

interface ProcessGroupProps {
  items: ProcessItem[]
  /** True while the whole AI turn is still running (more rounds may arrive). */
  turnInProgress: boolean
}

/**
 * One collapsible "Process" panel aggregating the thinking + tool calls of an AI turn.
 *
 * Reasoning items reuse the ai-elements `<Reasoning>` primitive (streaming animation +
 * "Thought for Ns" + auto open/close); tool items reuse `<ToolCallRow>`. The panel stays
 * open while the turn is in progress and auto-collapses once — shortly after the ENTIRE
 * turn settles (not after each intermediate round), so all steps remain visible until the
 * final answer arrives.
 */
export function ProcessGroup({ items, turnInProgress }: ProcessGroupProps) {
  const { t } = useTranslation()
  const status = processGroupStatus(items)
  const [open, setOpen] = useState(status !== 'done' || turnInProgress)
  // Track whether the panel was ever in flight, so auto-close only happens after the panel
  // genuinely settles. Auto-close is additionally suppressed while `turnInProgress` is true:
  // in a multi-round turn each round's items settle between rounds, but the panel must stay
  // open until the whole turn finishes.
  const wasActiveRef = useRef(status !== 'done')
  const autoClosedRef = useRef(false)

  useEffect(() => {
    if (status !== 'done') {
      wasActiveRef.current = true
      return
    }
    if (!wasActiveRef.current || autoClosedRef.current || turnInProgress) {
      return
    }
    const timer = window.setTimeout(() => {
      setOpen(false)
      autoClosedRef.current = true
    }, AUTO_CLOSE_DELAY)
    return () => window.clearTimeout(timer)
  }, [status, turnInProgress])

  const thoughtCount = items.filter((item) => item.kind === 'reasoning').length
  const toolCount = items
    .filter((item): item is Extract<ProcessItem, { kind: 'tools' }> => item.kind === 'tools')
    .reduce((sum, item) => sum + item.toolCalls.length, 0)

  return (
    <Collapsible
      className='bg-muted/30 w-full rounded-md border'
      data-panel-open={open ? '' : undefined}
      open={open}
      onOpenChange={setOpen}
    >
      <CollapsibleTrigger className='group flex w-full items-center justify-between gap-3 p-2.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <WrenchIcon className='text-muted-foreground size-4 shrink-0' />
          <span className='text-sm font-medium'>{t('Process')}</span>
          {thoughtCount === 0 && toolCount === 0 ? (
            <span className='text-muted-foreground truncate text-xs'>
              {t('Process')}
            </span>
          ) : (
            <span className='text-muted-foreground flex shrink-0 items-center gap-2 text-xs'>
              {thoughtCount > 0 && (
                <span className='inline-flex items-center gap-1'>
                  <BrainIcon className='size-3.5' />
                  {thoughtCount}
                </span>
              )}
              {toolCount > 0 && (
                <span className='inline-flex items-center gap-1'>
                  <WrenchIcon className='size-3.5' />
                  {toolCount}
                </span>
              )}
            </span>
          )}
        </div>
        <div className='flex items-center gap-2'>
          <Badge
            className='gap-1.5 text-xs'
            variant='secondary'
          >
            <StatusIcon status={status} />
            {t(STATUS_LABEL_KEY[status])}
          </Badge>
          <ChevronDownIcon
            aria-hidden='true'
            className='text-muted-foreground size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180'
          />
        </div>
      </CollapsibleTrigger>
      <CollapsibleContent className='outline-none'>
        <div className='divide-y divide-border/50 border-t'>
          {items.flatMap((item) => {
            if (item.kind === 'reasoning') {
              return [
                <div
                  className='px-2 py-1.5'
                  key={`reasoning-${item.messageId}`}
                >
                  <Reasoning isStreaming={item.isStreaming}>
                    <ReasoningTrigger />
                    <ReasoningContent>{item.content}</ReasoningContent>
                  </Reasoning>
                </div>,
              ]
            }
            return item.toolCalls.map((toolCall) => (
              <ToolCallRow
                key={toolCall.id}
                toolCall={toolCall}
              />
            ))
          })}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
