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

import { Message, MessageContent } from '@/components/ai-elements/message'
import { Markdown } from '@/components/ui/markdown'
import { cn } from '@/lib/utils'

import type { AgentMessage } from '../types'
import { ToolCallCard } from './tool-call-card'

interface AgentMessageItemProps {
  message: AgentMessage
}

export function AgentMessageItem({ message }: AgentMessageItemProps) {
  const isUser = message.role === 'user'
  const isAssistant = message.role === 'assistant'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'

  // System notes (e.g. max-iterations) render as a muted inline banner.
  if (isSystem) {
    return (
      <div className='border-border/60 bg-muted/30 my-2 flex items-center gap-2 rounded-md border px-3 py-2 text-xs text-muted-foreground'>
        <TerminalIcon className='size-3.5 shrink-0' aria-hidden='true' />
        <span>{message.content}</span>
      </div>
    )
  }

  return (
    <Message
      className='group flex-row-reverse py-2.5'
      from={isUser ? 'user' : 'assistant'}
    >
      <div className='w-full min-w-0 flex-1 basis-full'>
        {isTool ? (
          <div className='bg-muted/30 rounded-md border px-3 py-2 text-xs'>
            <div className='text-muted-foreground mb-1 flex items-center gap-1.5 font-medium'>
              <TerminalIcon className='size-3.5' aria-hidden='true' />
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
        ) : (
          <MessageContent
            variant={isAssistant ? 'flat' : 'contained'}
            className={cn(
              isAssistant && 'max-w-none px-0 py-0',
              message.isError && 'text-destructive'
            )}
          >
            {message.content ? (
              <Markdown>{message.content}</Markdown>
            ) : (
              isAssistant &&
              message.isStreaming && (
                <span className='text-muted-foreground text-sm'>
                  …
                </span>
              )
            )}
          </MessageContent>
        )}

        {/* Tool calls attached to an assistant message. */}
        {isAssistant &&
          message.toolCalls &&
          message.toolCalls.length > 0 && (
            <div className='mt-2'>
              {message.toolCalls.map((toolCall) => (
                <ToolCallCard
                  key={toolCall.id}
                  toolCall={toolCall}
                />
              ))}
            </div>
          )}
      </div>
    </Message>
  )
}
