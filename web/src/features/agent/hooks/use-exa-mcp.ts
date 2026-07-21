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
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import type { ExaMcpConnection } from '../lib/tools/mcp/exa-client'
import type { RegisteredTool } from '../lib/tools/registry'

export type ExaMcpStatus = 'disconnected' | 'connecting' | 'connected'

export function useExaMcp() {
  const { t } = useTranslation()
  const connectionRef = useRef<ExaMcpConnection | null>(null)
  const connectControllerRef = useRef<AbortController | null>(null)
  const [status, setStatus] = useState<ExaMcpStatus>('disconnected')
  const [tools, setTools] = useState<RegisteredTool[]>([])

  const disconnect = useCallback(() => {
    connectControllerRef.current?.abort()
    connectControllerRef.current = null
    const connection = connectionRef.current
    connectionRef.current = null
    setTools([])
    setStatus('disconnected')
    if (connection) {
      void connection.close()
    }
  }, [])

  const connect = useCallback(async () => {
    if (connectControllerRef.current || connectionRef.current) {
      return
    }

    const controller = new AbortController()
    connectControllerRef.current = controller
    setStatus('connecting')

    try {
      const { connectExaMcp } = await import('../lib/tools/mcp/exa-client')
      const connection = await connectExaMcp(controller.signal)
      if (controller.signal.aborted) {
        await connection.close()
        return
      }
      connectionRef.current = connection
      setTools(connection.tools)
      setStatus('connected')
    } catch {
      if (!controller.signal.aborted) {
        setStatus('disconnected')
        toast.error(t('Connection failed'))
      }
    } finally {
      if (connectControllerRef.current === controller) {
        connectControllerRef.current = null
      }
    }
  }, [t])

  const toggle = useCallback(() => {
    if (status === 'connected' || status === 'connecting') {
      disconnect()
      return
    }
    void connect()
  }, [connect, disconnect, status])

  useEffect(() => disconnect, [disconnect])
  useEffect(() => {
    void connect()
  }, [connect])

  return { status, tools, toggle }
}
