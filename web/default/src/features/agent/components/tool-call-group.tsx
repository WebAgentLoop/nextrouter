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
import {
  CheckCircle2Icon,
  ChevronDownIcon,
  ClockIcon,
  LoaderIcon,
  TriangleAlertIcon,
  WrenchIcon,
  XCircleIcon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Badge } from '@/components/ui/badge'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

import type { ToolCall, ToolCallStatus } from '../types'

const STATUS_LABEL_KEY: Record<ToolCallStatus, string> = {
  pending: 'Pending',
  running: 'Running',
  done: 'Completed',
  error: 'Failed',
  cancelled: 'Cancelled',
}

function StatusIcon({ status }: { status: ToolCallStatus }) {
  switch (status) {
    case 'running':
      return <LoaderIcon className='size-3.5 animate-spin' />
    case 'done':
      return <CheckCircle2Icon className='text-success size-3.5' />
    case 'error':
      return <XCircleIcon className='text-destructive size-3.5' />
    case 'cancelled':
      return <XCircleIcon className='text-warning size-3.5' />
    default:
      return <ClockIcon className='text-muted-foreground size-3.5' />
  }
}

function groupStatus(toolCalls: ToolCall[]): ToolCallStatus {
  if (toolCalls.some((c) => c.status === 'running' || c.status === 'pending')) {
    return 'running'
  }
  if (toolCalls.some((c) => c.status === 'error')) {
    return 'error'
  }
  if (toolCalls.every((c) => c.status === 'done')) {
    return 'done'
  }
  return 'pending'
}

interface ToolCallRowProps {
  toolCall: ToolCall
}

function ToolCallRow({ toolCall }: ToolCallRowProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)
  const isError = toolCall.status === 'error'

  return (
    <Collapsible
      data-panel-open={open ? '' : undefined}
      open={open}
      onOpenChange={setOpen}
    >
      <CollapsibleTrigger className='group/row hover:bg-muted/40 flex w-full items-center gap-2 rounded px-2 py-1.5 text-left'>
        <StatusIcon status={toolCall.status} />
        <span className='text-sm font-medium truncate'>{toolCall.name}</span>
        <ChevronDownIcon
          aria-hidden='true'
          className='text-muted-foreground ml-auto size-3.5 shrink-0 transition-transform group-data-[panel-open]/row:rotate-180'
        />
      </CollapsibleTrigger>
      <CollapsibleContent className='outline-none'>
        <div className='space-y-2 px-2 py-2 text-xs'>
          <div>
            <p className='text-muted-foreground mb-1 font-medium tracking-wide uppercase'>
              {t('Arguments')}
            </p>
            <pre className='bg-background/60 overflow-x-auto rounded-md p-2 text-xs'>
              {toolCall.argumentsRaw || '{}'}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <p className='text-muted-foreground mb-1 flex items-center gap-1 font-medium tracking-wide uppercase'>
                {isError && (
                  <TriangleAlertIcon className='text-destructive size-3.5' />
                )}
                {isError ? t('Error') : t('Result')}
              </p>
              <pre
                className={cn(
                  'bg-background/60 overflow-x-auto rounded-md p-2 text-xs',
                  isError && 'text-destructive'
                )}
              >
                {toolCall.result}
              </pre>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

interface ToolCallGroupProps {
  toolCalls: ToolCall[]
}

export function ToolCallGroup({ toolCalls }: ToolCallGroupProps) {
  const { t } = useTranslation()
  const status = groupStatus(toolCalls)
  // Auto-expand while any call is in flight or errored so progress is visible;
  // collapse once everything has settled.
  const [open, setOpen] = useState(
    status === 'running' || status === 'error' || status === 'pending'
  )

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
          <span className='text-sm font-medium'>
            {t('Tool calls')}{' '}
            <span className='text-muted-foreground'>({toolCalls.length})</span>
          </span>
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
          {toolCalls.map((toolCall) => (
            <ToolCallRow
              key={toolCall.id}
              toolCall={toolCall}
            />
          ))}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}
