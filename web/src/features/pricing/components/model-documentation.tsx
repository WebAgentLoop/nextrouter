import { RefreshIcon } from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
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
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Markdown } from '@/components/ui/markdown'
import { Skeleton } from '@/components/ui/skeleton'
import { toIntlLocale } from '@/i18n/languages'

import { getModelDocumentation } from '../api'

type ModelDocumentationProps = {
  active: boolean
  modelName: string
}

export function ModelDocumentation(props: ModelDocumentationProps) {
  const { t, i18n } = useTranslation()
  const lang = toIntlLocale(i18n.resolvedLanguage ?? i18n.language)
  const query = useQuery({
    queryKey: ['pricing', 'documentation', props.modelName, lang],
    queryFn: () => getModelDocumentation(props.modelName, lang),
    enabled: props.active,
    staleTime: 5 * 60 * 1000,
  })

  if (!props.active || query.isLoading) {
    return (
      <div className='space-y-3' aria-label={t('Loading documentation')}>
        <Skeleton className='h-7 w-2/5' />
        <Skeleton className='h-4 w-full' />
        <Skeleton className='h-4 w-5/6' />
        <Skeleton className='h-24 w-full' />
      </div>
    )
  }

  const documentation = query.data?.data?.documentation
  if (query.isError || !query.data?.success || !documentation) {
    return (
      <div className='flex min-h-48 flex-col items-center justify-center gap-3 rounded-lg border p-6 text-center'>
        <p className='text-muted-foreground text-sm'>
          {t('Failed to load model documentation.')}
        </p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => query.refetch()}
        >
          <HugeiconsIcon
            icon={RefreshIcon}
            strokeWidth={2}
            data-icon='inline-start'
          />
          {t('Retry')}
        </Button>
      </div>
    )
  }

  return (
    <article className='min-w-0 overflow-x-hidden rounded-lg border p-4 sm:p-6'>
      <Markdown>{documentation}</Markdown>
    </article>
  )
}
