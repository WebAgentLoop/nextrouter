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
import { Check, Clock3, Copy, Info, TriangleAlert } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { Dialog } from '@/components/dialog'
import { StatusBadge } from '@/components/status-badge'
import { Button } from '@/components/ui/button'
import { IconBadge } from '@/components/ui/icon-badge'
import { Label } from '@/components/ui/label'
import { useCopyToClipboard } from '@/hooks/use-copy-to-clipboard'
import { formatTimestampToDate, formatUseTime } from '@/lib/format'

import { taskActionMapper, taskStatusMapper } from '../../lib/mappers'
import { calculateTaskTiming } from '../../lib/task-timing'
import type { TaskLog } from '../../types'

type TaskDetailsDialogProps = {
  log: TaskLog
  open: boolean
  onOpenChange: (open: boolean) => void
}

function DetailRow(props: { label: string; value: ReactNode; mono?: boolean }) {
  return (
    <div className='grid min-w-0 grid-cols-[7rem_minmax(0,1fr)] gap-3 text-xs'>
      <span className='text-muted-foreground'>{props.label}</span>
      <span className={props.mono ? 'min-w-0 font-mono break-all' : 'min-w-0'}>
        {props.value}
      </span>
    </div>
  )
}

function DetailSection(props: {
  title: string
  icon: ReactNode
  children: ReactNode
  destructive?: boolean
}) {
  return (
    <section className='flex flex-col gap-2'>
      <Label className='flex items-center gap-1.5 text-xs font-semibold'>
        <IconBadge
          tone={props.destructive ? 'destructive' : 'neutral'}
          size='xs'
        >
          {props.icon}
        </IconBadge>
        {props.title}
      </Label>
      <div className='bg-muted/30 flex min-w-0 flex-col gap-2 rounded-md border p-3'>
        {props.children}
      </div>
    </section>
  )
}

export function TaskDetailsDialog(props: TaskDetailsDialogProps) {
  const { t } = useTranslation()
  const { copiedText, copyToClipboard } = useCopyToClipboard({ notify: false })
  const timing = calculateTaskTiming(
    props.log.submit_time,
    props.log.start_time,
    props.log.finish_time
  )
  const status = t(
    taskStatusMapper.getLabel(
      props.log.status,
      props.log.status || 'Submitting'
    )
  )

  return (
    <Dialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title={t('Task details')}
      description={t('Task timing from submission through completion.')}
      contentClassName='sm:max-w-xl'
      contentHeight='auto'
      bodyClassName='flex flex-col gap-4'
    >
      <DetailSection title={t('Basic Information')} icon={<Info />}>
        <DetailRow label={t('Task ID')} value={props.log.task_id} mono />
        <DetailRow label={t('Platform')} value={t(props.log.platform)} />
        <DetailRow
          label={t('Action')}
          value={t(taskActionMapper.getLabel(props.log.action))}
        />
        <DetailRow
          label={t('Status')}
          value={
            <StatusBadge
              label={status}
              variant={taskStatusMapper.getVariant(props.log.status)}
              size='sm'
              copyable={false}
            />
          }
        />
        {props.log.attempts ? (
          <DetailRow
            label={t('Execution attempts')}
            value={props.log.attempts}
            mono
          />
        ) : null}
      </DetailSection>

      <DetailSection title={t('Timing')} icon={<Clock3 />}>
        <DetailRow
          label={t('Submit Time')}
          value={formatTimestampToDate(props.log.submit_time, 'seconds')}
          mono
        />
        <DetailRow
          label={t('Start Time')}
          value={formatTimestampToDate(props.log.start_time, 'seconds')}
          mono
        />
        <DetailRow
          label={t('Finish Time')}
          value={formatTimestampToDate(props.log.finish_time, 'seconds')}
          mono
        />
        <DetailRow
          label={t('Total duration')}
          value={
            timing.totalDurationSec == null
              ? '-'
              : formatUseTime(timing.totalDurationSec)
          }
          mono
        />
        <DetailRow
          label={t('Queue duration')}
          value={
            timing.queueDurationSec == null
              ? '-'
              : formatUseTime(timing.queueDurationSec)
          }
          mono
        />
        <DetailRow
          label={t('Execution duration (latest attempt)')}
          value={
            timing.executionDurationSec == null
              ? '-'
              : formatUseTime(timing.executionDurationSec)
          }
          mono
        />
      </DetailSection>

      {props.log.fail_reason ? (
        <DetailSection
          title={t('Fail Reason')}
          icon={<TriangleAlert />}
          destructive
        >
          <div className='flex min-w-0 items-start gap-2'>
            <p className='text-destructive min-w-0 flex-1 text-xs leading-relaxed break-all whitespace-pre-wrap'>
              {props.log.fail_reason}
            </p>
            <Button
              variant='ghost'
              size='icon-sm'
              className='shrink-0'
              onClick={() => copyToClipboard(props.log.fail_reason ?? '')}
              title={t('Copy to clipboard')}
              aria-label={t('Copy to clipboard')}
            >
              {copiedText === props.log.fail_reason ? <Check /> : <Copy />}
            </Button>
          </div>
        </DetailSection>
      ) : null}
    </Dialog>
  )
}
