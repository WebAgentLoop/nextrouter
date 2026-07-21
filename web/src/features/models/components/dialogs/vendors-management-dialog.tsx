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
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  AlertCircle,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
} from 'lucide-react'
import { useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { Button } from '@/components/ui/button'
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import { getLobeIcon } from '@/lib/lobe-icon'

import { getVendors } from '../../api'
import { handleDeleteVendor, vendorsQueryKeys } from '../../lib'
import type { Vendor } from '../../types'

type VendorsManagementDialogProps = {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateVendor: () => void
  onEditVendor: (vendor: Vendor) => void
}

export function VendorsManagementDialog({
  open,
  onOpenChange,
  onCreateVendor,
  onEditVendor,
}: VendorsManagementDialogProps) {
  const { t } = useTranslation()
  const queryClient = useQueryClient()
  const [searchTerm, setSearchTerm] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: vendorsQueryKeys.list(),
    queryFn: () => getVendors({ page_size: 1000 }),
    enabled: open,
  })

  const vendors = useMemo(() => data?.data?.items || [], [data?.data?.items])

  const filteredVendors = useMemo(() => {
    if (!searchTerm.trim()) {
      return vendors
    }
    const keyword = searchTerm.toLowerCase().trim()
    return vendors.filter(
      (v) =>
        v.name.toLowerCase().includes(keyword) ||
        (v.description || '').toLowerCase().includes(keyword)
    )
  }, [vendors, searchTerm])

  const renderContent = () => {
    if (isLoading) {
      return (
        <div className='flex items-center justify-center py-12'>
          <Loader2 className='h-8 w-8 animate-spin' />
        </div>
      )
    }

    if (isError) {
      return (
        <div className='flex flex-col items-center justify-center gap-3 py-12'>
          <AlertCircle className='text-muted-foreground h-8 w-8' />
          <p className='text-muted-foreground text-sm'>{t('Failed to load')}</p>
          <Button variant='outline' size='sm' onClick={() => refetch()}>
            <RefreshCw className='h-4 w-4' />
            {t('Retry')}
          </Button>
        </div>
      )
    }

    if (vendors.length === 0) {
      return (
        <div className='text-muted-foreground py-12 text-center'>
          <p>{t('No vendors found')}</p>
          <p className='text-sm'>
            {t('Click "Add Vendor" to create your first vendor.')}
          </p>
        </div>
      )
    }

    return (
      <div className='flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto'>
        <div className='relative w-full sm:w-64'>
          <Search className='text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2' />
          <Input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder={t('Search vendors...')}
            className='pl-9'
            aria-label={t('Search vendors')}
          />
        </div>

        {filteredVendors.length === 0 ? (
          <Empty className='border'>
            <EmptyHeader>
              <EmptyMedia variant='icon'>
                <Search className='h-5 w-5' />
              </EmptyMedia>
              <EmptyTitle>{t('No matches found')}</EmptyTitle>
              <EmptyDescription>
                {t('Try adjusting your search to locate a vendor.')}
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        ) : (
          <div className='flex-shrink-0 overflow-hidden rounded-lg border'>
            <div className='divide-y'>
              {filteredVendors.map((vendor) => {
                const isEnabled = vendor.status === 1
                const statusClass = isEnabled
                  ? 'text-success text-xs'
                  : 'text-muted-foreground text-xs'
                const statusLabel = isEnabled ? t('Enabled') : t('Disabled')
                return (
                  <div key={vendor.id} className='flex items-center gap-3 p-3'>
                    <span className='flex h-7 w-7 flex-shrink-0 items-center justify-center'>
                      {getLobeIcon(vendor.icon, 20)}
                    </span>
                    <div className='min-w-0 flex-1'>
                      <div className='flex items-center gap-2'>
                        <span className='truncate font-medium'>
                          {vendor.name}
                        </span>
                        <span className={statusClass}>{statusLabel}</span>
                      </div>
                      {vendor.description ? (
                        <p className='text-muted-foreground truncate text-sm'>
                          {vendor.description}
                        </p>
                      ) : null}
                    </div>
                    <div className='flex flex-shrink-0 items-center gap-1'>
                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant='ghost'
                              size='icon-sm'
                              onClick={() => onEditVendor(vendor)}
                              aria-label={t('Edit')}
                            />
                          }
                        >
                          <Pencil />
                        </TooltipTrigger>
                        <TooltipContent>{t('Edit')}</TooltipContent>
                      </Tooltip>

                      <Tooltip>
                        <TooltipTrigger
                          render={
                            <Button
                              variant='ghost'
                              size='icon-sm'
                              onClick={() => setDeleteTarget(vendor)}
                              aria-label={t('Delete')}
                              className='text-destructive hover:text-destructive'
                            />
                          }
                        >
                          <Trash2 />
                        </TooltipTrigger>
                        <TooltipContent>{t('Delete')}</TooltipContent>
                      </Tooltip>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>
    )
  }

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={t('Manage Vendors')}
      description={t('Add, edit, or remove vendors')}
      contentClassName='flex max-h-[85vh] max-w-2xl flex-col gap-3 p-4'
      headerClassName='flex-shrink-0 text-start'
      contentHeight='min(74vh, 760px)'
      bodyClassName='space-y-4'
      footer={
        <Button type='button' onClick={onCreateVendor} size='sm'>
          <Plus className='h-4 w-4' />
          {t('Add Vendor')}
        </Button>
      }
    >
      {renderContent()}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(v) => !v && setDeleteTarget(null)}
        title={t('Delete Vendor')}
        desc={t(
          'Are you sure you want to delete vendor "{{name}}"? This action cannot be undone.',
          { name: deleteTarget?.name }
        )}
        confirmText={t('Delete')}
        destructive
        handleConfirm={() => {
          if (deleteTarget) {
            handleDeleteVendor(deleteTarget.id, queryClient)
          }
          setDeleteTarget(null)
        }}
      />
    </Dialog>
  )
}
