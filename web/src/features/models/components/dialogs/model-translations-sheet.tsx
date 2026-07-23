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
  Delete02Icon,
  Edit02Icon,
  TranslateIcon,
} from '@hugeicons/core-free-icons'
import { HugeiconsIcon } from '@hugeicons/react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Separator } from '@/components/ui/separator'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'

import {
  deleteModelTranslation,
  generateModelTranslations,
  getModelTranslations,
  updateModelTranslation,
} from '../../api'
import {
  getModelContentLanguageLabel,
  MODEL_CONTENT_LANGUAGES,
} from '../../lib/model-translations'
import type {
  Model,
  ModelTranslation,
  ModelTranslationStatus,
} from '../../types'

type ModelTranslationsSheetProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  model: Model | null
}

const statusLabels: Record<ModelTranslationStatus, string> = {
  '': 'Not generated',
  pending: 'Pending',
  translating: 'Translating',
  completed: 'Completed',
  failed: 'Failed',
  stale: 'Outdated',
}

function statusVariant(status: ModelTranslationStatus) {
  if (status === 'failed') return 'destructive' as const
  if (status === 'stale') return 'outline' as const
  return 'secondary' as const
}

function statusClassName(status: ModelTranslationStatus): string | undefined {
  if (status === 'completed') return 'text-success'
  if (status === 'stale') return 'text-warning-foreground dark:text-warning'
  return undefined
}

export function ModelTranslationsSheet(props: ModelTranslationsSheetProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const modelId = props.model?.id ?? 0
  const queryKey = ['models', 'translations', modelId]
  const [selectedLocales, setSelectedLocales] = useState<string[]>([])
  const [translateDescription, setTranslateDescription] = useState(true)
  const [translateDocumentation, setTranslateDocumentation] = useState(true)
  const [editingLocale, setEditingLocale] = useState<string | null>(null)
  const [editedDescription, setEditedDescription] = useState('')
  const [editedDocumentation, setEditedDocumentation] = useState('')
  const [initialDescription, setInitialDescription] = useState('')
  const [initialDocumentation, setInitialDocumentation] = useState('')
  const [editingSourceVersions, setEditingSourceVersions] = useState({
    description: '',
    documentation: '',
  })

  const translationsQuery = useQuery({
    queryKey,
    queryFn: () => getModelTranslations(modelId),
    enabled: props.open && modelId > 0,
    refetchInterval: (query) => {
      const translations = query.state.data?.data?.translations ?? []
      return translations.some(
        (translation) =>
          translation.description_status === 'pending' ||
          translation.description_status === 'translating' ||
          translation.documentation_status === 'pending' ||
          translation.documentation_status === 'translating'
      )
        ? 2000
        : false
    },
  })

  const source = translationsQuery.data?.data?.model ?? props.model
  const sourceId = source?.id
  const sourceLanguage = source?.source_language
  const translations = translationsQuery.data?.data?.translations ?? []
  const settings = translationsQuery.data?.data?.settings
  const sourceVersions = translationsQuery.data?.data?.source_versions
  const targetLanguages = MODEL_CONTENT_LANGUAGES.filter(
    (language) => language.code !== source?.source_language
  )

  useEffect(() => {
    if (!props.open || !sourceId || !sourceLanguage) return
    setSelectedLocales(
      MODEL_CONTENT_LANGUAGES.filter(
        (language) => language.code !== sourceLanguage
      ).map((language) => language.code)
    )
  }, [props.open, sourceId, sourceLanguage])

  const generateMutation = useMutation({
    mutationFn: () => {
      const contents = [
        ...(translateDescription ? ['description'] : []),
        ...(translateDocumentation ? ['documentation'] : []),
      ]
      return generateModelTranslations(modelId, {
        locales: selectedLocales,
        contents,
      })
    },
    onSuccess: async () => {
      toast.success(t('Translation task started'))
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  const saveMutation = useMutation({
    mutationFn: () => {
      const descriptionChanged = editedDescription !== initialDescription
      const documentationChanged = editedDocumentation !== initialDocumentation
      return updateModelTranslation(modelId, editingLocale ?? '', {
        ...(descriptionChanged
          ? {
              description: editedDescription,
              description_source_version: editingSourceVersions.description,
            }
          : {}),
        ...(documentationChanged
          ? {
              documentation: editedDocumentation,
              documentation_source_version: editingSourceVersions.documentation,
            }
          : {}),
      })
    },
    onSuccess: async () => {
      toast.success(t('Translation saved'))
      setEditingLocale(null)
      await queryClient.invalidateQueries({ queryKey })
    },
    onError: async () => {
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (locale: string) => deleteModelTranslation(modelId, locale),
    onSuccess: async () => {
      toast.success(t('Translation deleted'))
      await queryClient.invalidateQueries({ queryKey })
    },
  })

  const translationByLocale = new Map(
    translations.map((translation) => [translation.locale, translation])
  )

  const toggleLocale = (locale: string, checked: boolean) => {
    setSelectedLocales((current) =>
      checked
        ? [...new Set([...current, locale])]
        : current.filter((value) => value !== locale)
    )
  }

  const openEditor = (locale: string, translation?: ModelTranslation) => {
    if (!sourceVersions) return
    const description = translation?.description ?? ''
    const documentation = translation?.documentation ?? ''
    setEditingLocale(locale)
    setEditedDescription(description)
    setEditedDocumentation(documentation)
    setInitialDescription(description)
    setInitialDocumentation(documentation)
    setEditingSourceVersions(sourceVersions)
  }

  const hasEditorChanges =
    editedDescription !== initialDescription ||
    editedDocumentation !== initialDocumentation

  const canGenerate =
    Boolean(settings?.enabled) &&
    selectedLocales.length > 0 &&
    (translateDescription || translateDocumentation) &&
    !generateMutation.isPending

  return (
    <>
      <Sheet open={props.open} onOpenChange={props.onOpenChange}>
        <SheetContent className={sideDrawerContentClassName('sm:max-w-3xl')}>
          <SheetHeader className={sideDrawerHeaderClassName()}>
            <SheetTitle>{t('Model translations')}</SheetTitle>
            <SheetDescription>
              {source?.model_name ?? props.model?.model_name}
            </SheetDescription>
          </SheetHeader>

          <div className='flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-4 py-4 sm:px-6'>
            {!settings?.enabled && !translationsQuery.isLoading ? (
              <Alert>
                <AlertTitle>{t('Translation is disabled')}</AlertTitle>
                <AlertDescription>
                  {t(
                    'Enable model content translation in system settings before generating translations.'
                  )}
                </AlertDescription>
              </Alert>
            ) : null}

            <FieldGroup className='gap-3'>
              <Field>
                <FieldLabel>{t('Content to translate')}</FieldLabel>
                <div className='flex flex-wrap gap-x-6 gap-y-3'>
                  <Field orientation='horizontal' className='w-auto'>
                    <Checkbox
                      id='translate-description'
                      checked={translateDescription}
                      onCheckedChange={(checked) =>
                        setTranslateDescription(Boolean(checked))
                      }
                    />
                    <FieldLabel htmlFor='translate-description'>
                      {t('Description')}
                    </FieldLabel>
                  </Field>
                  <Field orientation='horizontal' className='w-auto'>
                    <Checkbox
                      id='translate-documentation'
                      checked={translateDocumentation}
                      onCheckedChange={(checked) =>
                        setTranslateDocumentation(Boolean(checked))
                      }
                    />
                    <FieldLabel htmlFor='translate-documentation'>
                      {t('Documentation')}
                    </FieldLabel>
                  </Field>
                </div>
              </Field>
            </FieldGroup>

            <Separator />

            <div className='space-y-1'>
              {targetLanguages.map((language) => {
                const translation = translationByLocale.get(language.code)
                const descriptionStatus = translation?.description_status ?? ''
                const documentationStatus =
                  translation?.documentation_status ?? ''
                const errors = [
                  descriptionStatus === 'failed' &&
                  translation?.description_error
                    ? `${t('Description')}: ${translation.description_error}`
                    : '',
                  documentationStatus === 'failed' &&
                  translation?.documentation_error
                    ? `${t('Documentation')}: ${translation.documentation_error}`
                    : '',
                ].filter(Boolean)
                return (
                  <div
                    key={language.code}
                    className='flex min-w-0 flex-col gap-3 py-3 sm:flex-row sm:items-center'
                  >
                    <div className='flex min-w-0 flex-1 items-center gap-3'>
                      <Checkbox
                        aria-label={t('Select {{language}}', {
                          language: language.label,
                        })}
                        checked={selectedLocales.includes(language.code)}
                        onCheckedChange={(checked) =>
                          toggleLocale(language.code, Boolean(checked))
                        }
                      />
                      <div className='min-w-0'>
                        <p className='truncate text-sm font-medium'>
                          {language.label}
                        </p>
                        <div className='mt-1 flex flex-wrap gap-1.5'>
                          <Badge
                            variant={statusVariant(descriptionStatus)}
                            className={statusClassName(descriptionStatus)}
                          >
                            {t('Description')}:{' '}
                            {t(statusLabels[descriptionStatus])}
                          </Badge>
                          <Badge
                            variant={statusVariant(documentationStatus)}
                            className={statusClassName(documentationStatus)}
                          >
                            {t('Documentation')}:{' '}
                            {t(statusLabels[documentationStatus])}
                          </Badge>
                        </div>
                        {errors.length > 0 ? (
                          <p
                            className='text-destructive mt-1 line-clamp-2 text-xs'
                            title={errors.join('\n')}
                          >
                            {errors.join(' | ')}
                          </p>
                        ) : null}
                      </div>
                    </div>
                    <div className='flex shrink-0 items-center gap-1 self-end sm:self-auto'>
                      <Button
                        type='button'
                        variant='ghost'
                        size='icon-sm'
                        aria-label={t('Edit {{language}} translation', {
                          language: language.label,
                        })}
                        disabled={!sourceVersions}
                        onClick={() => openEditor(language.code, translation)}
                      >
                        <HugeiconsIcon icon={Edit02Icon} strokeWidth={2} />
                      </Button>
                      {translation ? (
                        <Button
                          type='button'
                          variant='ghost'
                          size='icon-sm'
                          aria-label={t('Delete {{language}} translation', {
                            language: language.label,
                          })}
                          disabled={deleteMutation.isPending}
                          onClick={() => deleteMutation.mutate(language.code)}
                        >
                          <HugeiconsIcon icon={Delete02Icon} strokeWidth={2} />
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          <SheetFooter className={sideDrawerFooterClassName()}>
            <Button
              type='button'
              disabled={!canGenerate}
              onClick={() => generateMutation.mutate()}
            >
              {generateMutation.isPending ? (
                <Spinner data-icon='inline-start' />
              ) : (
                <HugeiconsIcon
                  icon={TranslateIcon}
                  strokeWidth={2}
                  data-icon='inline-start'
                />
              )}
              {t('Generate translations')}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>

      <Dialog
        open={editingLocale !== null}
        onOpenChange={(open) => !open && setEditingLocale(null)}
      >
        <DialogContent className='sm:max-w-2xl'>
          <DialogHeader>
            <DialogTitle>{t('Edit translation')}</DialogTitle>
            <DialogDescription>
              {editingLocale ? getModelContentLanguageLabel(editingLocale) : ''}
            </DialogDescription>
          </DialogHeader>
          <FieldGroup>
            <Field>
              <FieldLabel htmlFor='translated-description'>
                {t('Description')}
              </FieldLabel>
              <Textarea
                id='translated-description'
                rows={4}
                value={editedDescription}
                onChange={(event) => setEditedDescription(event.target.value)}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor='translated-documentation'>
                {t('Documentation')}
              </FieldLabel>
              <Textarea
                id='translated-documentation'
                className='min-h-64 font-mono text-sm'
                value={editedDocumentation}
                onChange={(event) => setEditedDocumentation(event.target.value)}
              />
            </Field>
          </FieldGroup>
          <DialogFooter>
            <Button
              type='button'
              variant='outline'
              onClick={() => setEditingLocale(null)}
            >
              {t('Cancel')}
            </Button>
            <Button
              type='button'
              disabled={saveMutation.isPending || !hasEditorChanges}
              onClick={() => saveMutation.mutate()}
            >
              {saveMutation.isPending ? (
                <Spinner data-icon='inline-start' />
              ) : null}
              {t('Save')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
