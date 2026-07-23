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
import { zodResolver } from '@hookform/resolvers/zod'
import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import { ComboboxInput } from '@/components/ui/combobox-input'
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { getEnabledModels } from '@/features/channels/api'
import { MODEL_CONTENT_LANGUAGES } from '@/features/models/lib/model-translations'

import { getAdminGroups } from '../api'
import {
  SettingsForm,
  SettingsFormGrid,
  SettingsSwitchContent,
  SettingsSwitchRow,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const translationSettingsSchema = z.object({
  enabled: z.boolean(),
  default_source_language: z.string().min(1),
  fallback_language: z.string().min(1),
  model: z.string().min(1),
  group: z.string().min(1),
})

type TranslationSettingsFormValues = z.infer<typeof translationSettingsSchema>

type TranslationSettingsSectionProps = {
  defaultValues: TranslationSettingsFormValues
  autoGroups: string
}

export function TranslationSettingsSection(
  props: TranslationSettingsSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<TranslationSettingsFormValues>({
    resolver: zodResolver(translationSettingsSchema),
    defaultValues: props.defaultValues,
  })
  useResetForm(form, props.defaultValues)

  const enabledModelsQuery = useQuery({
    queryKey: ['enabled-models'],
    queryFn: getEnabledModels,
  })
  const groupsQuery = useQuery({
    queryKey: ['admin-groups'],
    queryFn: getAdminGroups,
  })

  const modelOptions = useMemo(
    () =>
      [...(enabledModelsQuery.data?.data ?? [])]
        .sort((a, b) => a.localeCompare(b))
        .map((model) => ({ value: model, label: model })),
    [enabledModelsQuery.data?.data]
  )
  const groupOptions = useMemo(() => {
    const groups = [...(groupsQuery.data ?? [])]
    try {
      const autoGroups = JSON.parse(props.autoGroups)
      if (Array.isArray(autoGroups) && autoGroups.length > 0) {
        groups.push('auto')
      }
    } catch {
      // Malformed legacy settings should not block translation configuration.
    }
    return [...new Set(groups)]
      .sort((a, b) => a.localeCompare(b))
      .map((group) => ({ value: group, label: group }))
  }, [groupsQuery.data, props.autoGroups])

  const onSubmit = async (values: TranslationSettingsFormValues) => {
    const updates = Object.entries(values).filter(([key, value]) => {
      return (
        value !==
        props.defaultValues[key as keyof TranslationSettingsFormValues]
      )
    })
    for (const [key, value] of updates) {
      await updateOption.mutateAsync({
        key: `translation_setting.${key}`,
        value,
      })
    }
  }

  return (
    <SettingsSection title={t('Content translation')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <SettingsSwitchRow>
            <SettingsSwitchContent>
              <FormLabel>{t('Enable model content translation')}</FormLabel>
              <FormDescription>
                {t(
                  'Administrators can generate persistent translations for model descriptions and documentation.'
                )}
              </FormDescription>
            </SettingsSwitchContent>
            <Switch
              checked={form.watch('enabled')}
              onCheckedChange={(checked) =>
                form.setValue('enabled', checked, { shouldDirty: true })
              }
            />
          </SettingsSwitchRow>

          <SettingsFormGrid>
            <FormField
              control={form.control}
              name='model'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Translation model')}</FormLabel>
                  <FormControl>
                    <ComboboxInput
                      options={modelOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('Select an enabled model')}
                      emptyText={t('No enabled models found')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='group'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Translation group')}</FormLabel>
                  <FormControl>
                    <ComboboxInput
                      options={groupOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('Select a group')}
                      emptyText={t('No groups found')}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='default_source_language'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default source language')}</FormLabel>
                  <Select
                    items={MODEL_CONTENT_LANGUAGES.map((language) => ({
                      value: language.code,
                      label: language.label,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {MODEL_CONTENT_LANGUAGES.map((language) => (
                          <SelectItem key={language.code} value={language.code}>
                            {language.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t('Used when a new model does not specify its language.')}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='fallback_language'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Preferred fallback language')}</FormLabel>
                  <Select
                    items={MODEL_CONTENT_LANGUAGES.map((language) => ({
                      value: language.code,
                      label: language.label,
                    }))}
                    value={field.value}
                    onValueChange={field.onChange}
                  >
                    <FormControl>
                      <SelectTrigger className='w-full'>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent alignItemWithTrigger={false}>
                      <SelectGroup>
                        {MODEL_CONTENT_LANGUAGES.map((language) => (
                          <SelectItem key={language.code} value={language.code}>
                            {language.label}
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                  <FormDescription>
                    {t(
                      'Used before falling back to the original model content.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsFormGrid>
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
