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
import { useMemo, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { CodeBlock } from '@/components/ai-elements/code-block'
import { Message, MessageContent } from '@/components/ai-elements/message'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'

import {
  buildTurnDisplayItems,
  getTurnView,
  type TurnItem,
} from '../lib/message/turn-builder'
import type { AgentMessage } from '../types'
import { AgentMessageActions } from './agent-message-actions'
import { AgentMessageEditor } from './agent-message-editor'
import { ProcessGroup } from './process-group'

function UserMessageBody({
  message,
  isSourceVisible,
}: {
  message: AgentMessage
  isSourceVisible: boolean
}): ReactNode {
  const { t } = useTranslation()
  if (!message.content) {
    return null
  }
  if (isSourceVisible) {
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

export interface AgentMessageItemProps {
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

/**
 * Renders a non-AI message: `user` (editable, with the bottom action bar) or `system`
 * (a muted inline banner such as the max-iterations note). AI turns are rendered by
 * `AgentTurnItem` instead.
 */
/**
 * Standalone fallback for an orphan `tool` message — one whose `toolCallId` matches no
 * assistant tool call (e.g. from a broken or legacy session). Covered tool results render
 * inside their ai-turn's Process panel, so this only surfaces content that would otherwise
 * be lost.
 */
export function AgentToolMessage({ message }: { message: AgentMessage }) {
  return (
    <Message
      className='group py-2.5'
      from='assistant'
    >
      <div className='w-full min-w-0 flex-1 basis-full'>
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
              'whitespace-pre-wrap break-words overflow-x-auto',
              message.isError && 'text-destructive'
            )}
          >
            {message.content}
          </pre>
        </div>
      </div>
    </Message>
  )
}

/**
 * Renders a non-AI message: `user` (editable, with the bottom action bar) or `system`
 * (a muted inline banner such as the max-iterations note). AI turns are rendered by
 * `AgentTurnItem` instead.
 */
export function AgentMessageItem(props: AgentMessageItemProps) {
  const { message } = props

  if (message.role === 'system') {
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
  if (props.isEditing) {
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
        variant='contained'
        className={cn(message.isError && 'text-destructive')}
      >
        <UserMessageBody
          isSourceVisible={props.isSourceVisible}
          message={message}
        />
      </MessageContent>
    )
  }

  return (
    <Message
      className='group flex-row-reverse py-2.5'
      from='user'
    >
      <div className='w-full min-w-0 flex-1 basis-full'>
        {mainBlock}
        {!props.isEditing && !message.isStreaming && (
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

export interface AgentTurnItemProps {
  turn: Extract<TurnItem, { kind: 'ai-turn' }>
  isSourceVisible: boolean
  isGenerating: boolean
  alwaysVisible: boolean
  onToggleSource: (message: AgentMessage) => void
  onRegenerate: (message: AgentMessage) => void
  onDelete: (message: AgentMessage) => void
}

/**
 * Renders a whole AI turn (思考 → 工具调用 → 工具结果 → 正文) as ONE assistant card.
 *
 * Reasoning and tool calls are folded into collapsible "Process" panels (via
 * `buildTurnDisplayItems` + `ProcessGroup`) that flush ahead of each text segment, so the
 * intermediate steps mix together yet stay visually distinct, and collapse once settled.
 * A single bottom action bar (Copy/Source/Regenerate/Delete) applies to the entire turn.
 */
export function AgentTurnItem(props: AgentTurnItemProps) {
  const { t } = useTranslation()
  const { turn } = props

  const displayItems = useMemo(
    () => buildTurnDisplayItems(turn.messages),
    [turn.messages]
  )
  const turnView = useMemo(() => getTurnView(turn.messages), [turn.messages])
  const isStreaming = Boolean(turnView.isStreaming)
  const isEmpty = displayItems.length === 0 && !turnView.content.trim()

  if (isEmpty && !isStreaming) {
    return null
  }

  return (
    <Message
      className='group flex-row-reverse py-2.5'
      from='assistant'
    >
      <div className='w-full min-w-0 flex-1 basis-full'>
        {props.isSourceVisible && turnView.content ? (
          <CodeBlock
            className='my-0 w-full max-w-[78ch]'
            code={turnView.content}
            collapsedLines={24}
            defaultCollapsed={false}
            language='markdown'
            maxExpandedLines={48}
            showLineNumbers
            showToolbar
            title={t('Raw response')}
          />
        ) : (
          <>
            {displayItems.map((item, index) => (
              <div
                className={index > 0 ? 'mt-2' : undefined}
                key={item.kind === 'process' ? `process-${index}` : item.message.id}
              >
                {item.kind === 'process' ? (
                  <ProcessGroup
                    items={item.items}
                    turnInProgress={props.isGenerating}
                  />
                ) : (
                  <MessageContent
                    variant='flat'
                    className={cn(
                      'max-w-none px-0 py-0',
                      item.message.isError && 'text-destructive'
                    )}
                  >
                    <Markdown>{item.message.content}</Markdown>
                  </MessageContent>
                )}
              </div>
            ))}
            {displayItems.length === 0 && isStreaming && (
              <span className='text-muted-foreground text-sm'>…</span>
            )}
          </>
        )}

        {!isStreaming && (
          <AgentMessageActions
            alwaysVisible={props.alwaysVisible}
            className='mt-1.5'
            isGenerating={props.isGenerating}
            isSourceVisible={props.isSourceVisible}
            message={turnView}
            onDelete={props.onDelete}
            onRegenerate={props.onRegenerate}
            onToggleSource={props.onToggleSource}
          />
        )}
      </div>
    </Message>
  )
}
