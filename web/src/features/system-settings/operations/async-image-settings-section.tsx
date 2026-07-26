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
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import * as z from 'zod'

import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'

import {
  SettingsForm,
  SettingsFormGrid,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'
import { safeNumberFieldProps } from '../utils/numeric-field'

const asyncImageSettingsSchema = z.object({
  max_pending_per_user: z.number().int().min(1).max(1000),
  upstream_timeout_seconds: z.number().int().min(1).max(3600),
  task_retention_hours: z.number().int().min(1).max(720),
})

type AsyncImageSettingsFormValues = z.infer<typeof asyncImageSettingsSchema>

type AsyncImageSettingsSectionProps = {
  defaultValues: AsyncImageSettingsFormValues
}

export function AsyncImageSettingsSection(
  props: AsyncImageSettingsSectionProps
) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<AsyncImageSettingsFormValues>({
    resolver: zodResolver(asyncImageSettingsSchema),
    defaultValues: props.defaultValues,
  })
  useResetForm(form, props.defaultValues)

  const onSubmit = async (values: AsyncImageSettingsFormValues) => {
    const updates = Object.entries(values).filter(([key, value]) => {
      return (
        value !== props.defaultValues[key as keyof AsyncImageSettingsFormValues]
      )
    })
    for (const [key, value] of updates) {
      await updateOption.mutateAsync({
        key: `async_image_setting.${key}`,
        value,
      })
    }
  }

  return (
    <SettingsSection title={t('Async image tasks')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <SettingsFormGrid>
            <FormField
              control={form.control}
              name='max_pending_per_user'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Maximum pending tasks per user')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={1000}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Limits how many queued or running image generation tasks each user can have.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='upstream_timeout_seconds'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Upstream timeout (seconds)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={3600}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'Maximum time allowed for one upstream image generation request.'
                    )}
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='task_retention_hours'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Task retention (hours)')}</FormLabel>
                  <FormControl>
                    <Input
                      type='number'
                      min={1}
                      max={720}
                      step={1}
                      {...safeNumberFieldProps(field)}
                    />
                  </FormControl>
                  <FormDescription>
                    {t(
                      'How long completed and failed task results remain available.'
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
