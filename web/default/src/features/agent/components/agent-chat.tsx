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
import { useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from '@/components/ai-elements/conversation'
import { Loader } from '@/components/ai-elements/loader'

import type { AgentMessage } from '../types'
import { AgentMessageItem } from './agent-message'
import { AgentEmptyState } from './empty-state'

interface AgentChatProps {
  messages: AgentMessage[]
  isLoadingMessages: boolean
  isGenerating: boolean
  editingId: string | null
  onSelectPrompt: (prompt: string) => void
  onRegenerate: (message: AgentMessage) => void
  onEdit: (message: AgentMessage) => void
  onDelete: (message: AgentMessage) => void
  onSaveEdit: (content: string) => void
  onSaveEditAndSubmit: (content: string) => void
  onCancelEdit: () => void
}

export function AgentChat({
  messages,
  isLoadingMessages,
  isGenerating,
  editingId,
  onSelectPrompt,
  onRegenerate,
  onEdit,
  onDelete,
  onSaveEdit,
  onSaveEditAndSubmit,
  onCancelEdit,
}: AgentChatProps) {
  const { t } = useTranslation()
  const [editText, setEditText] = useState('')
  const [originalText, setOriginalText] = useState('')
  const [sourceMessageIds, setSourceMessageIds] = useState<ReadonlySet<string>>(
    () => new Set()
  )

  useEffect(() => {
    if (!editingId) {
      return
    }
    const editing = messages.find((message) => message.id === editingId)
    const content = editing?.content ?? ''
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEditText(content)
    setOriginalText(content)
  }, [editingId, messages])

  function handleToggleSource(message: AgentMessage): void {
    setSourceMessageIds((current) => {
      const next = new Set(current)
      if (next.has(message.id)) {
        next.delete(message.id)
      } else {
        next.add(message.id)
      }
      return next
    })
  }

  // Tool results are already shown inside the preceding assistant message's
  // ToolCallGroup (arguments + result + status), so rendering the standalone
  // `tool` message blocks would duplicate them. Hide every `tool` message
  // whose call id is covered by an assistant's toolCalls; keep orphans
  // (no matching call) visible as a fallback so their content is never lost.
  const visibleMessages = useMemo(() => {
    const coveredToolCallIds = new Set<string>()
    for (const message of messages) {
      if (message.role === 'assistant' && message.toolCalls) {
        for (const call of message.toolCalls) {
          coveredToolCallIds.add(call.id)
        }
      }
    }
    return messages.filter(
      (message) =>
        message.role !== 'tool' ||
        !message.toolCallId ||
        !coveredToolCallIds.has(message.toolCallId)
    )
  }, [messages])

  const lastAssistantIndex = (() => {
    for (let index = visibleMessages.length - 1; index >= 0; index--) {
      if (visibleMessages[index].role === 'assistant') {
        return index
      }
    }
    return -1
  })()

  let content: React.ReactNode = (
    <div className='divide-y divide-transparent'>
      {visibleMessages.map((message, index) => (
        <AgentMessageItem
          alwaysVisible={index === lastAssistantIndex}
          editText={editText}
          isEditing={editingId === message.id}
          isGenerating={isGenerating}
          isSourceVisible={sourceMessageIds.has(message.id)}
          key={message.id}
          message={message}
          onCancelEdit={onCancelEdit}
          onDelete={onDelete}
          onEdit={onEdit}
          onEditTextChange={setEditText}
          onRegenerate={onRegenerate}
          onSaveEdit={onSaveEdit}
          onSaveEditAndSubmit={onSaveEditAndSubmit}
          onToggleSource={handleToggleSource}
          originalText={originalText}
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
        <div className='mx-auto w-full max-w-4xl px-4 py-4'>{content}</div>
      </ConversationContent>
      <ConversationScrollButton />
    </Conversation>
  )
}
