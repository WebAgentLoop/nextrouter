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
import { TerminalIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CodeBlock } from '@/components/ai-elements/code-block'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'

import type { AgentMessage } from '../types'
import { AgentMessageActions } from './agent-message-actions'
import { AgentMessageEditor } from './agent-message-editor'
import { ToolCallGroup } from './tool-call-group'

function AgentMessageBody({
  message,
  isSourceVisible,
}: {
  message: AgentMessage
  isSourceVisible: boolean
}): ReactNode {
  const { t } = useTranslation()
  if (!message.content) {
    if (message.role === 'assistant' && message.isStreaming) {
      return <span className='text-muted-foreground text-sm'>…</span>
    }
    return null
  }
  if (message.role === 'assistant' && isSourceVisible) {
    return (
      <CodeBlock
        className='my-0 w-full max-w-[78ch]'
        code={message.content}
        collapsedLines={24}
        defaultCollapsed={false}
        language='markdown'
        maxExpandedLines={48}
        showLineNumbers
        showToolbar
        title={t('Raw response')}
      />
    )
  }
  return <Markdown>{message.content}</Markdown>
}

interface AgentMessageItemProps {
  message: AgentMessage
  isSourceVisible: boolean
  isGenerating: boolean
  isEditing: boolean
  alwaysVisible: boolean
  editText: string
  originalText: string
  onToggleSource: (message: AgentMessage) => void
  onEditTextChange: (text: string) => void
  onRegenerate: (message: AgentMessage) => void
  onEdit: (message: AgentMessage) => void
  onDelete: (message: AgentMessage) => void
  onSaveEdit: (content: string) => void
  onSaveEditAndSubmit: (content: string) => void
  onCancelEdit: () => void
}

export function AgentMessageItem(props: AgentMessageItemProps) {
  const { message } = props
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'

  // System notes (e.g. max-iterations) render as a muted inline banner.
  if (isSystem) {
    return (
      <div className='border-border/60 bg-muted/30 my-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground'>
        <TerminalIcon
          aria-hidden='true'
          className='size-3.5 shrink-0'
        />
        <span>{message.content}</span>
      </div>
    )
  }

  let mainBlock: ReactNode
  if (isTool) {
    mainBlock = (
      <div className='bg-muted/30 rounded-md border px-3 py-2 text-xs'>
        <div className='text-muted-foreground mb-1 flex items-center gap-1.5 font-medium'>
          <TerminalIcon
            aria-hidden='true'
            className='size-3.5'
          />
          {message.toolCallName}
        </div>
        <pre
          className={cn(
            'overflow-x-auto whitespace-pre-wrap break-words',
            message.isError && 'text-destructive'
          )}
        >
          {message.content}
        </pre>
      </div>
    )
  } else if (props.isEditing) {
    mainBlock = (
      <AgentMessageEditor
        editText={props.editText}
        message={message}
        onCancelEdit={props.onCancelEdit}
        onEditTextChange={props.onEditTextChange}
        onSaveEdit={props.onSaveEdit}
        onSaveEditAndSubmit={props.onSaveEditAndSubmit}
        originalText={props.originalText}
      />
    )
  } else {
    mainBlock = (
      <MessageContent
        variant={isAssistant ? 'flat' : 'contained'}
        className={cn(
          isAssistant && 'max-w-none px-0 py-0',
          message.isError && 'text-destructive'
        )}
      >
        <AgentMessageBody
          isSourceVisible={props.isSourceVisible}
          message={message}
        />
      </MessageContent>
    )
  }

  return (
    <Message
      className='group flex-row-reverse py-2.5'
      from={isUser ? 'user' : 'assistant'}
    >
      <div className='w-full min-w-0 flex-1 basis-full'>
        {mainBlock}

        {/* Tool calls attached to an assistant message (grouped). */}
        {isAssistant &&
          message.toolCalls &&
          message.toolCalls.length > 0 &&
          !props.isEditing && (
            <div className='mt-2'>
              <ToolCallGroup toolCalls={message.toolCalls} />
            </div>
          )}

        {/* Action toolbar (user & assistant only, hidden while streaming). */}
        {(isUser || isAssistant) &&
          !props.isEditing &&
          !message.isStreaming && (
            <AgentMessageActions
              alwaysVisible={props.alwaysVisible}
              className='mt-1.5'
              isGenerating={props.isGenerating}
              isSourceVisible={props.isSourceVisible}
              message={message}
              onDelete={props.onDelete}
              onEdit={props.onEdit}
              onRegenerate={props.onRegenerate}
              onToggleSource={props.onToggleSource}
            />
          )}
      </div>
    </Message>
  )
}
