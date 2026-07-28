import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarClock, Inbox, Loader2 } from 'lucide-react'
import Modal from '@/core/ui/Modal'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { apiErrorMessage } from '@/core/api'
import { lookupQueries } from '@/core/services/lookups'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import type { RescheduleDocumentModel } from '@/core/models/slots'
import { buildRescheduleModel, selectableDays, selectableTimes } from './reschedule'

/**
 * Screen 2 — Reschedule slot picker.
 *
 * On open it loads the store's available slots and the reschedule reasons, then
 * offers Day / Time / Reason. A non-urgent document sees only available
 * (`status === true`) windows; an urgent document sees every window.
 *
 * The dialog opens directly from the command panel and its primary button is the
 * deliberate confirmation (D-20); the parent posts and refreshes.
 */
export default function RescheduleDialog({
  open,
  onClose,
  document,
  onConfirmed,
}: {
  open: boolean
  onClose: () => void
  document: SdDocumentHeaderModel
  onConfirmed: (model: RescheduleDocumentModel) => void
}) {
  const { t } = useTranslation('document')
  const storeCode = (document.storeCode ?? '').trim()
  const isUrgent = document.isUrgent === true

  const [dayIndex, setDayIndex] = useState('')
  const [slotId, setSlotId] = useState('')
  const [reasonCode, setReasonCode] = useState('')

  // Slots are store- AND time-specific: a window free two minutes ago may be
  // full now. Never cached, always refetched on open — the query options carry
  // that (`core/services/lookups`), where the console's slot chip shares them.
  const slots = useQuery({ ...lookupQueries.availableSlots(storeCode), enabled: open && storeCode !== '' })
  const reasons = useQuery({ ...lookupQueries.rescheduleReasons(), enabled: open })

  const loading = slots.isPending || reasons.isPending
  const error = slots.error ?? reasons.error
  const days = selectableDays(slots.data?.slots ?? [], isUrgent)
  const selectedDay = days[Number(dayIndex)] ?? null
  const times = selectableTimes(selectedDay, isUrgent)
  const selectedTime = times.find((w) => w.slotId === slotId) ?? null
  const reasonList = reasons.data ?? []

  // Seed once the data lands: first day (and its first window), first reason.
  useEffect(() => {
    if (!open || loading || error) return
    setDayIndex((current) => (current === '' && days.length > 0 ? '0' : current))
    setReasonCode((current) => (current === '' ? (reasonList[0]?.reasonCode ?? '') : current))
  }, [open, loading, error, days.length, reasonList])

  // The chosen day's windows are not the previous day's: re-seed the time
  // whenever the day changes, so the pair on screen is always coherent.
  useEffect(() => {
    setSlotId(selectableTimes(selectedDay, isUrgent)[0]?.slotId ?? '')
  }, [selectedDay, isUrgent])

  const canSubmit = !loading && !error && !!selectedDay && !!selectedTime && !!reasonCode

  function submit() {
    if (!selectedDay || !selectedTime || !reasonCode) return
    onConfirmed(buildRescheduleModel(document.documentNo, selectedDay, selectedTime, reasonCode))
    onClose()
  }

  const SELECT = 'h-8 w-full rounded-lg border border-input bg-background px-2 text-[0.8125rem]'
  const LABEL = 'text-xs font-semibold text-muted-foreground'

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={t('actions.reschedule')}
      width="30rem"
      onShow={() => {
        setDayIndex('')
        setSlotId('')
        setReasonCode('')
      }}
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('dialog.cancel')}
          </Button>
          <Button variant="primary" disabled={!canSubmit} onClick={submit}>
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            {t('actions.reschedule')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-2.5">
        {loading ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-[0.8125rem] text-muted-foreground" role="status">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('reschedule.loading')}
          </div>
        ) : error ? (
          <ErrorBanner center message={apiErrorMessage(error, t('reschedule.failed'))} className="p-6" />
        ) : days.length === 0 ? (
          <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-border p-6 text-[0.8125rem] text-muted-foreground">
            <Inbox className="h-4 w-4" aria-hidden />
            <span>{t('reschedule.noSlots')}</span>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="reschedule-day">
                {t('reschedule.day')}
              </label>
              <select
                id="reschedule-day"
                className={SELECT}
                value={dayIndex}
                onChange={(e) => setDayIndex(e.target.value)}
              >
                {days.map((day, index) => (
                  <option key={day.fullDay || index} value={String(index)}>
                    {day.fullDay || `${day.date} ${day.day}`}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="reschedule-time">
                {t('reschedule.time')}
              </label>
              <select
                id="reschedule-time"
                className={SELECT}
                value={slotId}
                onChange={(e) => setSlotId(e.target.value)}
              >
                {times.length === 0 && <option value="">{t('reschedule.noWindows')}</option>}
                {times.map((window) => (
                  <option key={window.slotId} value={window.slotId}>
                    {window.time}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className={LABEL} htmlFor="reschedule-reason">
                {t('reschedule.reason')}
              </label>
              <select
                id="reschedule-reason"
                className={SELECT}
                value={reasonCode}
                onChange={(e) => setReasonCode(e.target.value)}
              >
                {reasonList.map((reason) => (
                  <option key={reason.reasonCode} value={reason.reasonCode}>
                    {reason.reasonDescription}
                  </option>
                ))}
              </select>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
