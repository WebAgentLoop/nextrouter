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

import { Alert, AlertDescription } from '@/components/ui/alert'
import { SectionPageLayout } from '@/components/layout'
import { useStatus } from '@/hooks/use-status'

import { TicketsDialogs } from './components/tickets-dialogs'
import { TicketsPrimaryButtons } from './components/tickets-primary-buttons'
import { TicketsProvider } from './components/tickets-provider'
import { TicketsTable } from './components/tickets-table'

export function Tickets() {
  const { t } = useTranslation()
  const { status } = useStatus()
  const rawEnabled = (status as Record<string, unknown> | null)?.ticket_enabled
  const ticketDisabled = status != null && rawEnabled === false

  if (ticketDisabled) {
    return (
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Support Tickets')}</SectionPageLayout.Title>
        <SectionPageLayout.Content>
          <Alert>
            <AlertDescription>
              {t(
                'Support tickets are disabled. Please contact the administrator to enable it in System Settings.'
              )}
            </AlertDescription>
          </Alert>
        </SectionPageLayout.Content>
      </SectionPageLayout>
    )
  }

  return (
    <TicketsProvider>
      <SectionPageLayout fixedContent>
        <SectionPageLayout.Title>{t('Support Tickets')}</SectionPageLayout.Title>
        <SectionPageLayout.Actions>
          <TicketsPrimaryButtons />
        </SectionPageLayout.Actions>
        <SectionPageLayout.Content>
          <TicketsTable />
        </SectionPageLayout.Content>
      </SectionPageLayout>

      <TicketsDialogs />
    </TicketsProvider>
  )
}

export default Tickets
