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
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import {
  formatCacheHitPct,
  formatLatency,
  formatThroughput,
  getCacheHitDotClass,
  getSuccessRateDotClass,
} from '@/features/performance-metrics/lib/format'
import type { SuccessRatePoint } from '@/features/performance-metrics/types'
import { cn } from '@/lib/utils'

export type ModelPerfBadgeData = {
  avg_latency_ms: number
  success_rate: number
  cache_hit_rate: number | null
  avg_tps: number
  recent_success_rates?: number[]
  recent_cache_hit_rates?: (number | null)[]
  recent_success_series?: SuccessRatePoint[]
}

export interface ModelPerfBadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  perf: ModelPerfBadgeData | undefined
}

const STATUS_SLOTS = Array.from({ length: 24 }, (_, slot) => slot)

const RATE_BAR_SLOTS = [
  { id: 'oldest', heightClass: 'h-2', emptyClass: 'bg-muted-foreground/10' },
  { id: 'middle', heightClass: 'h-2.5', emptyClass: 'bg-muted-foreground/15' },
  { id: 'latest', heightClass: 'h-3', emptyClass: 'bg-muted-foreground/15' },
] as const

export const ModelPerfBadge = memo(function ModelPerfBadge(
  props: ModelPerfBadgeProps
) {
  const { t } = useTranslation()
  const latencyText = formatLatency(props.perf?.avg_latency_ms ?? 0)
  const throughputText = formatThroughput(props.perf?.avg_tps ?? 0).replace(
    ' t/s',
    't/s'
  )
  const successRate = props.perf?.success_rate
  const cache_hit_rate = props.perf?.cache_hit_rate
  const hasSuccessRate =
    successRate != null &&
    Number.isFinite(successRate) &&
    successRate >= 0 &&
    successRate <= 100
  // Hourly points with timestamps, anchored to the client's current hour.
  // Hours without traffic stay gray. Slot 23 is the current, partial hour.
  const statusRates = useMemo(() => {
    const currentHourStart = Math.floor(Date.now() / 1000 / 3600) * 3600
    const ratesByHour = new Map<number, number>()
    for (const point of props.perf?.recent_success_series ?? []) {
      ratesByHour.set(point.ts, point.success_rate)
    }
    // Fall back to the fork's plain recent-success array when the hourly
    // series is empty (e.g. legacy snapshots without timestamps).
    const legacyRates =
      props.perf?.recent_success_rates?.filter((rate) =>
        Number.isFinite(rate)
      ) ?? []
    if (ratesByHour.size === 0 && legacyRates.length > 0) {
      const tail = legacyRates.slice(-3)
      const padded: (number | undefined)[] = [
        ...Array(Math.max(0, 24 - tail.length)).fill(undefined),
        ...tail,
      ]
      return padded.slice(-24)
    }
    return STATUS_SLOTS.map((slot) => {
      const hourStart = currentHourStart - (23 - slot) * 3600
      return ratesByHour.get(hourStart)
    })
  }, [props.perf?.recent_success_series, props.perf?.recent_success_rates])

  const recentCacheRates = props.perf?.recent_cache_hit_rates ?? []
  const cacheRates =
    recentCacheRates.length > 0 ? recentCacheRates.slice(-3) : [cache_hit_rate]
  const cacheBars = [
    ...Array(Math.max(0, 3 - cacheRates.length)).fill(null),
    ...cacheRates,
  ].slice(-3)

  return (
    <div
      aria-label={t('Performance metrics for the last 24 hours')}
      className={cn(
        'flex w-full min-w-0 items-center justify-between gap-3',
        props.className
      )}
    >
      <dl className='flex min-w-0 items-start gap-5 text-xs tabular-nums'>
        <div className='w-24 shrink-0'>
          <dt
            title={t('Request success rate sampled over the last 24 hours')}
            className='text-muted-foreground flex items-center justify-between gap-1 text-[11px] leading-4'
          >
            <span>{t('Status')}</span>
            <span className='font-mono'>
              {hasSuccessRate ? `${successRate.toFixed(1)}%` : '—%'}
            </span>
          </dt>
          <dd
            role='img'
            aria-label={t(
              'Recent success-rate samples; gray bars indicate missing data.'
            )}
            title={t(
              'Recent success-rate samples; gray bars indicate missing data.'
            )}
            className='mt-1 flex h-3 w-24 items-center gap-px'
          >
            {STATUS_SLOTS.map((slot) => {
              const rate = statusRates[slot]
              return (
                <span
                  key={slot}
                  aria-hidden
                  className={cn(
                    'h-full w-[3px] shrink-0 rounded-xs',
                    rate != null &&
                      Number.isFinite(rate) &&
                      rate >= 0 &&
                      rate <= 100
                      ? getSuccessRateDotClass(rate)
                      : 'bg-muted-foreground/15'
                  )}
                />
              )
            })}
          </dd>
        </div>
        <div title={t('Average latency')} className='shrink-0'>
          <dt className='text-muted-foreground text-[11px] leading-4'>
            {t('Latency short')}
          </dt>
          <dd className='mt-1 font-mono whitespace-nowrap'>
            {latencyText === '—' ? '—s' : latencyText}
          </dd>
        </div>
        <div title={t('Throughput')} className='shrink-0'>
          <dt className='text-muted-foreground text-[11px] leading-4'>
            {t('Throughput short')}
          </dt>
          <dd className='mt-1 font-mono whitespace-nowrap'>
            {throughputText === '—' ? '—t/s' : throughputText}
          </dd>
        </div>
        <div
          title={`${t('Cache hit rate')}: ${formatCacheHitPct(cache_hit_rate)}`}
          className='shrink-0'
        >
          <dt className='text-muted-foreground text-[11px] leading-4'>
            {t('Cache short')}
          </dt>
          <dd className='mt-1 flex h-3 items-center gap-0.5'>
            {RATE_BAR_SLOTS.map((slot, index) => {
              const rate = cacheBars[index]
              return (
                <span
                  key={`cache-${slot.id}`}
                  aria-hidden
                  className={cn(
                    'w-1 rounded-full',
                    slot.heightClass,
                    rate == null ? slot.emptyClass : getCacheHitDotClass(rate)
                  )}
                />
              )
            })}
          </dd>
        </div>
      </dl>
      {props.children}
    </div>
  )
})
