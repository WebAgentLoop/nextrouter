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
import { BookOpenIcon, GlobeIcon, Trash2Icon } from 'lucide-react'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  PromptInputButton,
  PromptInputTools,
} from '@/components/ai-elements/prompt-input'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Spinner } from '@/components/ui/spinner'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'

import type { ExaMcpStatus } from '../hooks/use-exa-mcp'

interface AgentInputToolsProps {
  disabled?: boolean
  hasMessages: boolean
  modelDocumentationEnabled: boolean
  onClearMessages: () => void
  onToggleModelDocumentation: () => void
  exaMcpStatus: ExaMcpStatus
  onToggleExaMcp: () => void
}

export function AgentInputTools(props: AgentInputToolsProps) {
  const { t } = useTranslation()
  const [clearConfirmOpen, setClearConfirmOpen] = useState(false)

  const handleClearMessages = () => {
    props.onClearMessages()
    setClearConfirmOpen(false)
    toast.success(t('Conversation cleared'))
  }

  let searchLabel = t('Connect web search')
  if (props.exaMcpStatus === 'connecting') {
    searchLabel = t('Connecting to web search')
  } else if (props.exaMcpStatus === 'connected') {
    searchLabel = t('Disconnect web search')
  }

  const documentationLabel = props.modelDocumentationEnabled
    ? t('Disable model documentation')
    : t('Enable model documentation')

  return (
    <>
      <PromptInputTools className='bg-background/70 border-border/60 rounded-lg border p-1 shadow-xs'>
        <Tooltip>
          <TooltipTrigger
            render={
              <PromptInputButton
                aria-label={documentationLabel}
                aria-pressed={props.modelDocumentationEnabled}
                className='text-muted-foreground hover:text-foreground hover:bg-muted/70 aria-pressed:bg-primary/10 aria-pressed:text-primary font-medium'
                disabled={props.disabled}
                onClick={props.onToggleModelDocumentation}
                variant='ghost'
              >
                <BookOpenIcon size={16} />
              </PromptInputButton>
            }
          />
          <TooltipContent>
            <p>{documentationLabel}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <PromptInputButton
                aria-label={searchLabel}
                aria-pressed={props.exaMcpStatus === 'connected'}
                className='text-muted-foreground hover:text-foreground hover:bg-muted/70 aria-pressed:bg-primary/10 aria-pressed:text-primary font-medium'
                disabled={props.disabled || props.exaMcpStatus === 'connecting'}
                onClick={props.onToggleExaMcp}
                variant='ghost'
              >
                {props.exaMcpStatus === 'connecting' ? (
                  <Spinner />
                ) : (
                  <GlobeIcon size={16} />
                )}
              </PromptInputButton>
            }
          />
          <TooltipContent>
            <p>{searchLabel}</p>
          </TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger
            render={
              <PromptInputButton
                aria-label={t('Clear chat history')}
                className='text-muted-foreground hover:text-destructive hover:bg-destructive/10 font-medium'
                disabled={props.disabled || !props.hasMessages}
                onClick={() => setClearConfirmOpen(true)}
                variant='ghost'
              >
                <Trash2Icon size={16} />
              </PromptInputButton>
            }
          />
          <TooltipContent>
            <p>{t('Clear chat history')}</p>
          </TooltipContent>
        </Tooltip>
      </PromptInputTools>

      <ConfirmDialog
        destructive
        desc={t(
          'All messages in this conversation will be removed. This cannot be undone.'
        )}
        confirmText={t('Clear')}
        handleConfirm={handleClearMessages}
        onOpenChange={setClearConfirmOpen}
        open={clearConfirmOpen}
        title={t('Clear chat history?')}
      />
    </>
  )
}
