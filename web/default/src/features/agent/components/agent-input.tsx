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
import { EraserIcon, SendIcon, SquareIcon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  PromptInput,
  PromptInputButton,
  PromptInputFooter,
  PromptInputTextarea,
  type PromptInputMessage,
} from '@/components/ai-elements/prompt-input'
import { ModelGroupSelector } from '@/components/model-group-selector'
import { Button } from '@/components/ui/button'

import type { AgentConfig, GroupOption, ModelOption } from '../types'

interface AgentInputProps {
  config: AgentConfig
  onSubmit: (text: string) => void
  onStop: () => void
  onClear: () => void
  onModelChange: (value: string) => void
  onGroupChange: (value: string) => void
  onGroupChangeCommitted: (value: string) => void
  disabled?: boolean
  isGenerating?: boolean
  models: ModelOption[]
  groups: GroupOption[]
  hasMessages?: boolean
}

export function AgentInput({
  config,
  onSubmit,
  onStop,
  onClear,
  onModelChange,
  onGroupChange,
  onGroupChangeCommitted,
  disabled,
  isGenerating,
  models,
  groups,
  hasMessages = false,
}: AgentInputProps) {
  const { t } = useTranslation()
  const [text, setText] = useState('')

  const canSubmit = !disabled && text.trim().length > 0
  const isSelectorDisabled = Boolean(disabled) || isGenerating

  const handleSubmit = (message: PromptInputMessage) => {
    const submittable = message.text?.trim()
    if (!submittable) {
      return
    }
    onSubmit(submittable)
    setText('')
  }

  const handleGroupChange = (value: string) => {
    onGroupChange(value)
    onGroupChangeCommitted(value)
  }

  return (
    <div className='grid shrink-0 gap-4 px-1 md:pb-4'>
      <PromptInput
        className='relative'
        groupClassName='bg-background/95 dark:bg-background/80 border-border/70 shadow-[0_18px_60px_-32px_rgba(0,0,0,0.65)] ring-1 ring-foreground/5 rounded-xl overflow-hidden transition-all duration-200 focus-within:border-primary/45 focus-within:ring-primary/15 focus-within:shadow-[0_22px_70px_-34px_rgba(0,0,0,0.75)]'
        onSubmit={handleSubmit}
      >
        <PromptInputTextarea
          autoComplete='off'
          autoCapitalize='off'
          autoCorrect='off'
          className='min-h-20 px-5 pt-4 pb-3 leading-7 md:min-h-24 md:text-base'
          disabled={disabled}
          onChange={(event) => setText(event.target.value)}
          placeholder={t('Ask the agent anything')}
          spellCheck={false}
          value={text}
        />

        <PromptInputFooter className='border-border/60 bg-muted/20 dark:bg-muted/10 border-t px-3 py-2.5 backdrop-blur'>
          <div className='flex w-full flex-col gap-2.5 md:flex-row md:items-center md:justify-between'>
            <div className='flex min-w-0 items-center justify-end md:hidden'>
              <ModelGroupSelector
                disabled={isSelectorDisabled}
                groups={groups}
                models={models}
                onGroupChange={handleGroupChange}
                onModelChange={onModelChange}
                selectedGroup={config.group}
                selectedModel={config.model}
              />
            </div>

            <div className='flex items-center justify-between gap-2 md:justify-start'>
              {hasMessages && (
                <Button
                  className='text-muted-foreground hover:text-destructive h-8 gap-1.5 px-2.5 text-xs font-medium'
                  disabled={isGenerating}
                  onClick={onClear}
                  size='sm'
                  variant='ghost'
                >
                  <EraserIcon className='size-4' />
                  <span className='hidden sm:inline'>{t('Clear')}</span>
                </Button>
              )}
              <div className='flex items-center gap-1.5 md:hidden'>
                {isGenerating ? (
                  <PromptInputButton
                    className='border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15 font-medium'
                    onClick={onStop}
                    variant='secondary'
                  >
                    <SquareIcon className='fill-current' size={16} />
                    <span className='hidden sm:inline'>{t('Stop')}</span>
                    <span className='sr-only sm:hidden'>{t('Stop')}</span>
                  </PromptInputButton>
                ) : (
                  <PromptInputButton
                    className='bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 font-medium shadow-sm'
                    disabled={!canSubmit}
                    type='submit'
                    variant='default'
                  >
                    <SendIcon size={16} />
                    <span className='hidden sm:inline'>{t('Send')}</span>
                    <span className='sr-only sm:hidden'>{t('Send')}</span>
                  </PromptInputButton>
                )}
              </div>
            </div>

            <div className='hidden min-w-0 items-center gap-2 md:flex'>
              <ModelGroupSelector
                disabled={isSelectorDisabled}
                groups={groups}
                models={models}
                onGroupChange={handleGroupChange}
                onModelChange={onModelChange}
                selectedGroup={config.group}
                selectedModel={config.model}
              />
              {isGenerating ? (
                <PromptInputButton
                  className='border-destructive/25 bg-destructive/10 text-destructive hover:bg-destructive/15 font-medium'
                  onClick={onStop}
                  variant='secondary'
                >
                  <SquareIcon className='fill-current' size={16} />
                  <span className='hidden sm:inline'>{t('Stop')}</span>
                  <span className='sr-only sm:hidden'>{t('Stop')}</span>
                </PromptInputButton>
              ) : (
                <PromptInputButton
                  className='bg-primary text-primary-foreground hover:bg-primary/90 h-8 px-3 font-medium shadow-sm'
                  disabled={!canSubmit}
                  type='submit'
                  variant='default'
                >
                  <SendIcon size={16} />
                  <span className='hidden sm:inline'>{t('Send')}</span>
                  <span className='sr-only sm:hidden'>{t('Send')}</span>
                </PromptInputButton>
              )}
            </div>
          </div>
        </PromptInputFooter>
      </PromptInput>
    </div>
  )
}
