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

import { groupTurns } from '../lib/message/turn-builder'
import type { AgentMessage } from '../types'
import {
  AgentMessageItem,
  AgentToolMessage,
  AgentTurnItem,
} from './agent-message'
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

  // Fold covered tool results into their AI turn. Orphan or misplaced tool messages stay
  // standalone so malformed and legacy histories never lose visible content.
  const turns = useMemo(() => groupTurns(messages), [messages])

  const lastAiTurnIndex = (() => {
    for (let index = turns.length - 1; index >= 0; index--) {
      if (turns[index].kind === 'ai-turn') {
        return index
      }
    }
    return -1
  })()

  let content: React.ReactNode = (
    <div className='divide-y divide-transparent'>
      {turns.map((turn, index) => {
        if (turn.kind === 'ai-turn') {
          return (
            <AgentTurnItem
              alwaysVisible={index === lastAiTurnIndex}
              isGenerating={isGenerating}
              isSourceVisible={sourceMessageIds.has(turn.id)}
              key={turn.id}
              onDelete={onDelete}
              onRegenerate={onRegenerate}
              onToggleSource={handleToggleSource}
              turn={turn}
              turnInProgress={isGenerating && index === turns.length - 1}
            />
          )
        }

        if (turn.kind === 'tool') {
          return (
            <AgentToolMessage key={turn.message.id} message={turn.message} />
          )
        }

        const message = turn.message
        return (
          <AgentMessageItem
            alwaysVisible={false}
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
        )
      })}
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
