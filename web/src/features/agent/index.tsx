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
import { useEffect, useRef, useState } from 'react'

import { AgentChat } from './components/agent-chat'
import { AgentHeader } from './components/agent-header'
import { AgentHistorySheet } from './components/agent-history-sheet'
import { AgentInput } from './components/agent-input'
import {
  useAgentRun,
  useAgentState,
  useExaMcp,
  useModelDocumentationTools,
} from './hooks'
import type { AgentMessage } from './types'

export function Agent() {
  const exaMcp = useExaMcp()
  const modelDocumentation = useModelDocumentationTools()
  const {
    messages,
    updateMessages,
    clearMessages,
    deleteMessage,
    config,
    updateConfig,
    status,
    setStatus,
    models,
    groups,
    isLoadingMessages,
    isLoadingConfig,
    reloadModels,
    activeSessionId,
    sessionTitle,
    sessions,
    reloadSessions,
    newSession,
    selectSession,
    deleteSessionById,
    renameSession,
  } = useAgentState()

  // Keep a ref to the latest messages so the run loop can seed from the
  // current conversation when the user sends a new turn.
  const messagesRef = useRef(messages)
  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  const { run, regenerate, editMessage, stop, isGenerating } = useAgentRun({
    config,
    status,
    setStatus,
    updateMessages,
    messagesRef,
    additionalTools: exaMcp.tools,
    toolPacks: modelDocumentation.toolPacks,
  })

  const [editingId, setEditingId] = useState<string | null>(null)
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)

  const handleRegenerate = (message: AgentMessage) => {
    setEditingId(null)
    void regenerate(message.id)
  }

  const handleEditMessage = (message: AgentMessage) => {
    setEditingId(message.id)
  }

  const handleCancelEdit = () => {
    setEditingId(null)
  }

  const handleSaveEdit = (content: string) => {
    if (!editingId) {
      return
    }
    const id = editingId
    setEditingId(null)
    void editMessage(id, content, false)
  }

  const handleSaveEditAndSubmit = (content: string) => {
    if (!editingId) {
      return
    }
    const id = editingId
    setEditingId(null)
    void editMessage(id, content, true)
  }

  const handleDeleteMessage = (message: AgentMessage) => {
    setEditingId(null)
    deleteMessage(message.id)
  }

  const handleRun = (input: string) => {
    setEditingId(null)
    void run(input)
  }

  const handleGroupChangeCommitted = (value: string) => {
    void reloadModels(value)
  }

  const handleOpenHistory = (open: boolean) => {
    setIsHistoryOpen(open)
    if (open) {
      void reloadSessions()
    }
  }

  const handleNewSession = () => {
    setEditingId(null)
    newSession()
  }

  const handleClearMessages = () => {
    setEditingId(null)
    clearMessages()
  }

  const handleSelectSession = (id: string) => {
    setEditingId(null)
    void selectSession(id).then(() => {
      setIsHistoryOpen(false)
    })
  }

  const handleDeleteSession = (id: string) => {
    void deleteSessionById(id)
  }

  const handleRenameSession = (id: string, title: string) => {
    void renameSession(id, title)
  }

  return (
    <div className='relative flex size-full min-h-0 flex-col overflow-hidden'>
      <AgentHeader
        isGenerating={isGenerating}
        onHistoryOpenChange={handleOpenHistory}
        onNewSession={handleNewSession}
        onRenameActive={(title) =>
          handleRenameSession(activeSessionId ?? '', title)
        }
        sessionTitle={sessionTitle}
      />

      <div className='flex min-h-0 flex-1 flex-col overflow-hidden'>
        <AgentChat
          editingId={editingId}
          isGenerating={isGenerating}
          isLoadingMessages={isLoadingMessages}
          messages={messages}
          onCancelEdit={handleCancelEdit}
          onDelete={handleDeleteMessage}
          onEdit={handleEditMessage}
          onRegenerate={handleRegenerate}
          onSaveEdit={handleSaveEdit}
          onSaveEditAndSubmit={handleSaveEditAndSubmit}
          onSelectPrompt={handleRun}
        />
      </div>

      <div className='mx-auto w-full max-w-4xl'>
        <AgentInput
          config={config}
          disabled={isGenerating || isLoadingMessages || isLoadingConfig}
          groups={groups}
          hasMessages={messages.length > 0}
          isGenerating={isGenerating}
          models={models}
          onClearMessages={handleClearMessages}
          modelDocumentationEnabled={modelDocumentation.enabled}
          exaMcpStatus={exaMcp.status}
          onGroupChange={(value) => updateConfig('group', value)}
          onGroupChangeCommitted={handleGroupChangeCommitted}
          onModelChange={(value) => updateConfig('model', value)}
          onToggleModelDocumentation={modelDocumentation.toggle}
          onToggleExaMcp={exaMcp.toggle}
          onStop={stop}
          onSubmit={handleRun}
        />
      </div>

      <AgentHistorySheet
        activeSessionId={activeSessionId}
        onDeleteSession={handleDeleteSession}
        onOpenChange={handleOpenHistory}
        onRenameSession={handleRenameSession}
        onSelectSession={handleSelectSession}
        open={isHistoryOpen}
        sessions={sessions}
      />
    </div>
  )
}
