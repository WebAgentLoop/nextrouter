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
  ChevronDownIcon,
  ClockIcon,
  LoaderIcon,
  TriangleAlertIcon,
  XCircleIcon,
  CheckCircle2Icon,
} from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import { cn } from '@/lib/utils'

import type { ToolCall, ToolCallStatus } from '../types'

export function StatusIcon({ status }: { status: ToolCallStatus }) {
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

interface ToolCallRowProps {
  toolCall: ToolCall
}

/** A single tool call rendered as an expandable row (arguments + result). */
export function ToolCallRow({ toolCall }: ToolCallRowProps) {
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
