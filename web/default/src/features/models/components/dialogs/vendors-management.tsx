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

import type { Vendor } from '../../types'
import { VendorMutateDialog } from './vendor-mutate-dialog'
import { VendorsManagementDialog } from './vendors-management-dialog'

type VendorsManagementProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
}

type VendorsView = 'list' | 'form'

export function VendorsManagement({
  open,
  onOpenChange,
}: VendorsManagementProps) {
  const [view, setView] = useState<VendorsView>('list')
  const [currentVendor, setCurrentVendor] = useState<Vendor | null>(null)

  useEffect(() => {
    if (!open) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setView('list')

      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCurrentVendor(null)
    }
  }, [open])

  const handleListOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      setView('list')
      setCurrentVendor(null)
      onOpenChange(false)
    }
  }

  const handleFormOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      // Return to the list instead of closing the whole management flow
      setView('list')
      setCurrentVendor(null)
    }
  }

  const handleShowForm = (vendor: Vendor | null) => {
    setCurrentVendor(vendor)
    setView('form')
  }

  return (
    <>
      <VendorsManagementDialog
        open={open && view === 'list'}
        onOpenChange={handleListOpenChange}
        onCreateVendor={() => handleShowForm(null)}
        onEditVendor={(vendor) => handleShowForm(vendor)}
      />
      <VendorMutateDialog
        open={open && view === 'form'}
        onOpenChange={handleFormOpenChange}
        currentVendor={currentVendor}
      />
    </>
  )
}
