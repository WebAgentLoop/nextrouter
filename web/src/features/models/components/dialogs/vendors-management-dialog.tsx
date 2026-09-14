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
import { useQuery } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { StaticDataTable } from '@/components/data-table'
import { ConfirmDialog } from '@/components/confirm-dialog'
import { Dialog } from '@/components/dialog'
import { ErrorState } from '@/components/error-state'
import { LoadingState } from '@/components/loading-state'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useDebounce } from '@/hooks/use-debounce'
import { createServerError } from '@/lib/server-error-message'

import { searchVendors } from '../../api'
import { vendorsQueryKeys } from '../../lib'
import { handleDeleteVendor } from '../../lib/vendor-actions'
import type { Vendor } from '../../types'
import { VendorMutateDialog } from './vendor-mutate-dialog'

export function VendorsManagementDialog(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCreateVendor?: () => void
  onEditVendor?: (vendor: Vendor) => void
}) {
  const { t } = useTranslation()
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [editing, setEditing] = useState(false)
  const [vendor, setVendor] = useState<Vendor | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Vendor | null>(null)
  const keyword = useDebounce(search, 250)
  const query = useQuery({
    queryKey: vendorsQueryKeys.list({ keyword, p: page }),
    queryFn: async () => {
      const response = await searchVendors({ keyword, p: page, page_size: 20 })
      if (!response.success || !response.data) {
        throw createServerError(response, t('Failed to load vendors'))
      }
      return response.data
    },
    enabled: props.open,
  })
  useEffect(() => {
    if (props.open) {
      setSearch('')
      setPage(1)
    }
  }, [props.open])
  return (
    <>
      <Dialog
        open={props.open}
        onOpenChange={props.onOpenChange}
        title={t('Manage Vendors')}
        description={t('Add, edit, or remove vendors')}
        contentClassName='sm:max-w-3xl'
        footer={
          <>
            <Button variant='outline' onClick={() => props.onOpenChange(false)}>
              {t('Close')}
            </Button>
            <Button
              onClick={() => {
                if (props.onCreateVendor) {
                  props.onCreateVendor()
                  return
                }
                setVendor(null)
                setEditing(true)
              }}
            >
              {t('Add Vendor')}
            </Button>
          </>
        }
      >
        <div className='space-y-4'>
          <Input
            aria-label={t('Search vendors')}
            placeholder={t('Search vendors')}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value)
              setPage(1)
            }}
          />
          {query.isPending ? <LoadingState /> : null}
          {query.isError && (
            <ErrorState
              description={query.error.message}
              onRetry={() => void query.refetch()}
            />
          )}
          {query.data && !query.isError && (
            <StaticDataTable
              data={query.data.items}
              columns={[
                { id: 'name', header: t('Vendor'), cell: (item) => item.name },
                {
                  id: 'description',
                  header: t('Description'),
                  cell: (item) => (
                    <span className='line-clamp-2'>
                      {item.description || '—'}
                    </span>
                  ),
                },
                {
                  id: 'actions',
                  header: t('Actions'),
                  cell: (item) => (
                    <div className='flex items-center gap-1'>
                      <Button
                        variant='ghost'
                        size='sm'
                        onClick={() => {
                          if (props.onEditVendor) {
                            props.onEditVendor(item)
                            return
                          }
                          setVendor(item)
                          setEditing(true)
                        }}
                      >
                        {t('Edit')}
                      </Button>
                      <Button
                        variant='ghost'
                        size='sm'
                        className='text-destructive hover:text-destructive'
                        onClick={() => setDeleteTarget(item)}
                      >
                        {t('Delete')}
                      </Button>
                    </div>
                  ),
                },
              ]}
            />
          )}
          <div className='flex items-center justify-end gap-3'>
            <Button
              variant='outline'
              size='sm'
              disabled={page === 1}
              onClick={() => setPage(page - 1)}
            >
              {t('Previous')}
            </Button>
            <span className='text-sm'>{page}</span>
            <Button
              variant='outline'
              size='sm'
              disabled={page * 20 >= (query.data?.total ?? 0)}
              onClick={() => setPage(page + 1)}
            >
              {t('Next')}
            </Button>
          </div>
        </div>
      </Dialog>
      <VendorMutateDialog
        open={editing}
        onOpenChange={setEditing}
        currentVendor={vendor}
      />
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
            void handleDeleteVendor(deleteTarget.id)
          }
          setDeleteTarget(null)
        }}
      />
    </>
  )
}
