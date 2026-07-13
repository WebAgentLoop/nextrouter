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
import { useEffect, useRef } from 'react'

import { useAgentRun, useAgentState } from './hooks'
import { AgentChat } from './components/agent-chat'
import { AgentInput } from './components/agent-input'

export function Agent() {
  const {
    messages,
    updateMessages,
    clearMessages,
    config,
    updateConfig,
    status,
    setStatus,
    models,
    groups,
    isLoadingMessages,
    reloadModels,
  } = useAgentState()

  // Keep a ref to the latest messages so the run loop can seed from the
  // current conversation when the user sends a new turn.
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const { run, stop, isGenerating } = useAgentRun({
    config,
    status,
    setStatus,
    updateMessages,
    messagesRef,
  })

  const handleGroupChangeCommitted = (value: string) => {
    void reloadModels(value)
  }

  return (
    <div className='relative flex size-full min-h-0 flex-col overflow-hidden'>
      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <AgentChat
          isLoadingMessages={isLoadingMessages}
          messages={messages}
          onSelectPrompt={run}
        />
      </div>

      <div className='mx-auto w-full max-w-4xl'>
        <AgentInput
          config={config}
          disabled={isGenerating}
          groups={groups}
          hasMessages={messages.length > 0}
          isGenerating={isGenerating}
          models={models}
          onClear={clearMessages}
          onGroupChange={(value) => updateConfig('group', value)}
          onGroupChangeCommitted={handleGroupChangeCommitted}
          onModelChange={(value) => updateConfig('model', value)}
          onStop={stop}
          onSubmit={run}
        />
      </div>
    </div>
  )
}
