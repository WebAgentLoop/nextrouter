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
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import { Alert, AlertDescription } from '@/components/ui/alert'

import { SettingsSwitchField } from '../components/settings-form-layout'
import { SettingsSection } from '../components/settings-section'
import { useUpdateOption } from '../hooks/use-update-option'

type TicketSectionProps = {
  enabled: boolean
}

export function TicketSection(props: TicketSectionProps) {
  const { t } = useTranslation()
  const updateOption = useUpdateOption()
  const [isEnabled, setIsEnabled] = useState(props.enabled)

  useEffect(() => {
    setIsEnabled(props.enabled)
  }, [props.enabled])

  const handleToggleEnabled = async (checked: boolean) => {
    try {
      await updateOption.mutateAsync({
        key: 'ticket_setting.enabled',
        value: checked,
      })
      setIsEnabled(checked)
      toast.success(t('Setting saved'))
    } catch {
      toast.error(t('Failed to update setting'))
    }
  }

  return (
    <SettingsSection title={t('Support Tickets')}>
      <div className='space-y-4'>
        <SettingsSwitchField
          checked={isEnabled}
          onCheckedChange={handleToggleEnabled}
          label={t('Enable support tickets')}
          description={t(
            'When enabled, users can create and manage support tickets. Admins can view and reply to tickets.'
          )}
          disabled={updateOption.isPending}
        />
        <Alert>
          <AlertDescription>
            {t(
              'When disabled, support tickets are hidden and related APIs will return a disabled response.'
            )}
          </AlertDescription>
        </Alert>
      </div>
    </SettingsSection>
  )
}
