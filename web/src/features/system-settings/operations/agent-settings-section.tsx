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
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { getEnabledModels } from '@/features/channels/api'

import { getAdminGroups } from '../api'
import {
  SettingsControlChildren,
  SettingsControlGroup,
  SettingsForm,
  SettingsFormGrid,
  SettingsSwitchContent,
  SettingsSwitchRow,
} from '../components/settings-form-layout'
import { SettingsPageFormActions } from '../components/settings-page-context'
import { SettingsSection } from '../components/settings-section'
import { useResetForm } from '../hooks/use-reset-form'
import { useUpdateOption } from '../hooks/use-update-option'

const MAX_SYSTEM_PROMPT_LENGTH = 32768
const MAX_TOKENS_LIMIT = 1073741823

const agentSettingsSchema = z.object({
  system_prompt: z.string().max(MAX_SYSTEM_PROMPT_LENGTH),
  default_model: z.string(),
  default_group: z.string(),
  temperature: z.number().min(0).max(2).nullable(),
  max_tokens: z.number().int().positive().max(MAX_TOKENS_LIMIT).nullable(),
  max_iterations: z.number().int().min(1).max(50),
})

type AgentSettingsFormValues = z.infer<typeof agentSettingsSchema>

type AgentSettingsSectionProps = {
  defaultValues: AgentSettingsFormValues
  autoGroups: string
}

export function AgentSettingsSection(props: AgentSettingsSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const form = useForm<AgentSettingsFormValues>({
    resolver: zodResolver(agentSettingsSchema),
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

  const modelOptions = useMemo(() => {
    const models = enabledModelsQuery.data?.data ?? []
    return [...models]
      .sort((a, b) => a.localeCompare(b))
      .map((model) => ({ value: model, label: model }))
  }, [enabledModelsQuery.data?.data])

  const groupOptions = useMemo(() => {
    const groups = [...(groupsQuery.data ?? [])]
    try {
      const autoGroups = JSON.parse(props.autoGroups)
      if (Array.isArray(autoGroups) && autoGroups.length > 0) {
        groups.push('auto')
      }
    } catch {
      // Malformed legacy AutoGroups should not block the rest of the form.
    }
    return [...new Set(groups)]
      .sort((a, b) => a.localeCompare(b))
      .map((group) => ({ value: group, label: group }))
  }, [groupsQuery.data, props.autoGroups])

  const systemPrompt = form.watch('system_prompt')
  const temperature = form.watch('temperature')
  const maxTokens = form.watch('max_tokens')
  const selectedModel = form.watch('default_model')
  const selectedGroup = form.watch('default_group')
  const modelUnavailable =
    selectedModel !== '' &&
    !enabledModelsQuery.isLoading &&
    !modelOptions.some((option) => option.value === selectedModel)
  const groupUnavailable =
    selectedGroup !== '' &&
    !groupsQuery.isLoading &&
    !groupOptions.some((option) => option.value === selectedGroup)

  const onSubmit = async (values: AgentSettingsFormValues) => {
    const updates = Object.entries(values).filter(([key, value]) => {
      return value !== props.defaultValues[key as keyof AgentSettingsFormValues]
    })
    for (const [key, value] of updates) {
      await updateOption.mutateAsync({ key: `agent_setting.${key}`, value })
    }
  }

  return (
    <SettingsSection title={t('Agent settings')}>
      <Form {...form}>
        <SettingsForm onSubmit={form.handleSubmit(onSubmit)}>
          <SettingsPageFormActions
            onSave={form.handleSubmit(onSubmit)}
            isSaving={updateOption.isPending}
          />

          <FormField
            control={form.control}
            name='system_prompt'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('System prompt')}</FormLabel>
                <FormControl>
                  <Textarea
                    {...field}
                    rows={10}
                    maxLength={MAX_SYSTEM_PROMPT_LENGTH}
                    placeholder={t(
                      'Enter the default instructions for the Agent'
                    )}
                  />
                </FormControl>
                <div className='flex flex-wrap justify-between gap-2'>
                  <FormDescription>
                    {t(
                      'Do not include secrets; users can inspect this prompt.'
                    )}
                  </FormDescription>
                  <span className='text-muted-foreground text-xs tabular-nums'>
                    {t('{{count}} / 32768 characters', {
                      count: systemPrompt.length,
                    })}
                  </span>
                </div>
                <FormMessage />
              </FormItem>
            )}
          />

          <SettingsFormGrid>
            <FormField
              control={form.control}
              name='default_model'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default model')}</FormLabel>
                  <FormControl>
                    <ComboboxInput
                      options={modelOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('Select an enabled model')}
                      emptyText='No enabled models found'
                    />
                  </FormControl>
                  {modelUnavailable ? (
                    <p className='text-destructive text-xs'>
                      {t('The saved model is no longer enabled.')}
                    </p>
                  ) : (
                    <FormDescription>
                      {t('Users can override this model in the Agent.')}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name='default_group'
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t('Default group')}</FormLabel>
                  <FormControl>
                    <ComboboxInput
                      options={groupOptions}
                      value={field.value}
                      onValueChange={field.onChange}
                      placeholder={t('Select a group')}
                      emptyText='No groups found'
                    />
                  </FormControl>
                  {groupUnavailable ? (
                    <p className='text-destructive text-xs'>
                      {t('The saved group is no longer available.')}
                    </p>
                  ) : (
                    <FormDescription>
                      {t('Users can override this group in the Agent.')}
                    </FormDescription>
                  )}
                  <FormMessage />
                </FormItem>
              )}
            />
          </SettingsFormGrid>

          <SettingsControlGroup>
            <SettingsSwitchRow>
              <SettingsSwitchContent>
                <FormLabel>{t('Use model default temperature')}</FormLabel>
                <FormDescription>
                  {t('Omit temperature from Agent requests.')}
                </FormDescription>
              </SettingsSwitchContent>
              <Switch
                checked={temperature === null}
                onCheckedChange={(checked) =>
                  form.setValue('temperature', checked ? null : 0.7, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </SettingsSwitchRow>
            <SettingsControlChildren>
              <FormField
                control={form.control}
                name='temperature'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Temperature')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={0}
                        max={2}
                        step={0.1}
                        disabled={field.value === null}
                        value={field.value ?? ''}
                        onChange={(event) =>
                          field.onChange(Number(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsControlChildren>
          </SettingsControlGroup>

          <SettingsControlGroup>
            <SettingsSwitchRow>
              <SettingsSwitchContent>
                <FormLabel>{t('Use model default max tokens')}</FormLabel>
                <FormDescription>
                  {t('Omit max_tokens from Agent requests.')}
                </FormDescription>
              </SettingsSwitchContent>
              <Switch
                checked={maxTokens === null}
                onCheckedChange={(checked) =>
                  form.setValue('max_tokens', checked ? null : 4096, {
                    shouldDirty: true,
                    shouldValidate: true,
                  })
                }
              />
            </SettingsSwitchRow>
            <SettingsControlChildren>
              <FormField
                control={form.control}
                name='max_tokens'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Max tokens')}</FormLabel>
                    <FormControl>
                      <Input
                        type='number'
                        min={1}
                        max={MAX_TOKENS_LIMIT}
                        step={1}
                        disabled={field.value === null}
                        value={field.value ?? ''}
                        onChange={(event) =>
                          field.onChange(Number(event.target.value))
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SettingsControlChildren>
          </SettingsControlGroup>

          <FormField
            control={form.control}
            name='max_iterations'
            render={({ field }) => (
              <FormItem>
                <FormLabel>{t('Maximum Agent iterations')}</FormLabel>
                <FormControl>
                  <Input
                    type='number'
                    min={1}
                    max={50}
                    step={1}
                    value={field.value}
                    onChange={(event) =>
                      field.onChange(Number(event.target.value))
                    }
                  />
                </FormControl>
                <FormDescription>
                  {t('Limits tool-call rounds per Agent run (1-50).')}
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />
        </SettingsForm>
      </Form>
    </SettingsSection>
  )
}
