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
import { zodResolver } from '@hookform/resolvers/zod'
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'

import {
  SideDrawerSection,
  sideDrawerContentClassName,
  sideDrawerFooterClassName,
  sideDrawerFormClassName,
  sideDrawerHeaderClassName,
} from '@/components/drawer-layout'
import { Button } from '@/components/ui/button'
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Textarea } from '@/components/ui/textarea'
import { handleServerError } from '@/lib/handle-server-error'

import { createTicket } from '../api'
import { SUCCESS_MESSAGES } from '../constants'
import {
  getTicketFormSchema,
  TICKET_FORM_DEFAULT_VALUES,
  type TicketFormValues,
} from '../lib/ticket-form'
import { useTickets } from './tickets-provider'

export function TicketsMutateDrawer(props: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation()
  const { triggerRefresh } = useTickets()
  const [isSubmitting, setIsSubmitting] = useState(false)

  const form = useForm<TicketFormValues>({
    resolver: zodResolver(getTicketFormSchema(t)),
    defaultValues: TICKET_FORM_DEFAULT_VALUES,
  })

  const onSubmit = async (data: TicketFormValues) => {
    setIsSubmitting(true)
    try {
      const result = await createTicket({
        title: data.title.trim(),
        content: data.content.trim(),
        priority: data.priority,
      })
      if (result.success) {
        toast.success(t(SUCCESS_MESSAGES.TICKET_CREATED))
        form.reset(TICKET_FORM_DEFAULT_VALUES)
        props.onOpenChange(false)
        triggerRefresh()
      }
    } catch (error: unknown) {
      handleServerError(error)
    } finally {
      setIsSubmitting(false)
    }
  }

  let submitButtonLabel = t('Create')
  if (isSubmitting) {
    submitButtonLabel = t('Creating...')
  }

  return (
    <Sheet
      open={props.open}
      onOpenChange={(v) => {
        props.onOpenChange(v)
        if (!v) {
          form.reset(TICKET_FORM_DEFAULT_VALUES)
        }
      }}
    >
      <SheetContent className={sideDrawerContentClassName('sm:max-w-[520px]')}>
        <SheetHeader className={sideDrawerHeaderClassName()}>
          <SheetTitle>{t('Create Ticket')}</SheetTitle>
          <SheetDescription>
            {t('Create a new support ticket. Our team will respond soon.')}
          </SheetDescription>
        </SheetHeader>
        <Form {...form}>
          <form
            id='ticket-form'
            onSubmit={(e) => {
              void form.handleSubmit(onSubmit)(e)
            }}
            className={sideDrawerFormClassName()}
          >
            <SideDrawerSection>
              <FormField
                control={form.control}
                name='title'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Title')}</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder={t('Enter ticket title')} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='content'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Content')}</FormLabel>
                    <FormControl>
                      <Textarea
                        {...field}
                        placeholder={t('Describe your issue in detail...')}
                        rows={6}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name='priority'
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t('Priority')}</FormLabel>
                    <Select
                      value={String(field.value)}
                      onValueChange={(value) => field.onChange(Number(value))}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder={t('Select priority')} />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value='0'>{t('Low')}</SelectItem>
                        <SelectItem value='1'>{t('Medium')}</SelectItem>
                        <SelectItem value='2'>{t('High')}</SelectItem>
                        <SelectItem value='3'>{t('Urgent')}</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </SideDrawerSection>
          </form>
        </Form>
        <SheetFooter className={sideDrawerFooterClassName()}>
          <SheetClose render={<Button variant='outline' />}>
            {t('Cancel')}
          </SheetClose>
          <Button
            form='ticket-form'
            type='submit'
            disabled={isSubmitting}
          >
            {submitButtonLabel}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  )
}
