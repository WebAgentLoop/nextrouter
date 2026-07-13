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

interface ToolCallCardProps {
  toolCall: ToolCall
}

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
      return <LoaderIcon className='size-4 animate-spin' />
    case 'done':
      return <CheckCircle2Icon className='text-success size-4' />
    case 'error':
      return <XCircleIcon className='text-destructive size-4' />
    case 'cancelled':
      return <XCircleIcon className='text-warning size-4' />
    default:
      return <ClockIcon className='text-muted-foreground size-4' />
  }
}

export function ToolCallCard({ toolCall }: ToolCallCardProps) {
  const { t } = useTranslation()
  const [open, setOpen] = useState(false)

  const labelKey = STATUS_LABEL_KEY[toolCall.status]
  const isError = toolCall.status === 'error'

  return (
    <Collapsible
      className='bg-muted/30 mb-2 w-full rounded-md border'
      data-panel-open={open ? '' : undefined}
      open={open}
      onOpenChange={setOpen}
    >
      <CollapsibleTrigger className='group flex w-full items-center justify-between gap-3 p-2.5'>
        <div className='flex min-w-0 items-center gap-2'>
          <WrenchIcon className='text-muted-foreground size-4 shrink-0' />
          <span className='truncate text-sm font-medium'>
            {toolCall.name}
          </span>
          <Badge
            className='gap-1.5 text-xs'
            variant='secondary'
          >
            <StatusIcon status={toolCall.status} />
            {t(labelKey)}
          </Badge>
        </div>
        <ChevronDownIcon
          aria-hidden='true'
          className='text-muted-foreground size-4 shrink-0 transition-transform group-data-[panel-open]:rotate-180'
        />
      </CollapsibleTrigger>
      <CollapsibleContent className='outline-none'>
        <div className='space-y-2 border-t p-3 text-xs'>
          <div>
            <p className='text-muted-foreground mb-1 font-medium tracking-wide uppercase'>
              {t('Tool call')}
            </p>
            <pre
              className='bg-background/60 overflow-x-auto rounded-md p-2 text-xs'
            >
              {toolCall.argumentsRaw || '{}'}
            </pre>
          </div>
          {toolCall.result !== undefined && (
            <div>
              <p className='text-muted-foreground mb-1 flex items-center gap-1 font-medium tracking-wide uppercase'>
                {isError && (
                  <TriangleAlertIcon className='text-destructive size-3.5' />
                )}
                {isError ? t('Error') : t('Tool result')}
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
