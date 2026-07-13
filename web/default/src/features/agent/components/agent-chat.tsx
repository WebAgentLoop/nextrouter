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
import { useTranslation } from 'react-i18next'

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'

import type { AgentMessage } from '../types'
import { AgentEmptyState } from './empty-state'
import { AgentMessageItem } from './agent-message'

interface AgentChatProps {
  messages: AgentMessage[]
  isLoadingMessages: boolean
  onSelectPrompt: (prompt: string) => void
}

export function AgentChat({
  messages,
  isLoadingMessages,
  onSelectPrompt,
}: AgentChatProps) {
  const { t } = useTranslation()

  let content: React.ReactNode = (
    <div className='divide-y divide-transparent'>
      {messages.map((message) => (
        <AgentMessageItem
          key={message.id}
          message={message}
        />
      ))}
    </div>
  )

  if (messages.length === 0 && !isLoadingMessages) {
    content = <AgentEmptyState onSelectPrompt={onSelectPrompt} />
  }

  if (isLoadingMessages) {
    content = (
      <div className='text-muted-foreground flex min-h-[min(520px,calc(100svh-18rem))] items-center justify-center gap-2 text-sm'>
        <Loader />
        <span>{t('Loading conversation...')}</span>
      </div>
    )
  }

  return (
    <Conversation>
      <ConversationContent className='p-0'>
        <div className='mx-auto w-full max-w-4xl px-4 py-4'>
          {content}
        </div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
