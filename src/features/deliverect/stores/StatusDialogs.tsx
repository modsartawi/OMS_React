import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ReasonDialog, { InlineRefusal } from '@/core/deliverect/ReasonDialog'
import { fieldRefusal } from '@/core/deliverect/reason'
import {
  DELIVERECT_ERRORS,
  type DeliverectStoreAction,
  type DeliverectStoreRow,
  type DeliverectStoreStatusBody,
} from '@/core/models/deliverect'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { STORES_KEY, statusHistoryKey, storesApi } from './api'
import { STATUS_ACTIONS, actionOffered, dayKey, hoursLabel, parseDelay, statusBody } from './store-status'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'

/** The two store-status refusals the contract names, each shown inline with its own lead sentence. */
const STATUS_REFUSALS = [DELIVERECT_ERRORS.notLinked, DELIVERECT_ERRORS.deliverectFailed] as const

/**
 * DLV-00010 (the store is not linked) or DLV-00011 (Deliverect refused, or was unreachable — its
 * answer is the envelope message), inline: what it means in our words, then the server's own
 * `"<English> / <Arabic>"` sentence and its code. Nothing for any other refusal.
 */
function StatusRefusal({ error }: { error: unknown }) {
  const { t } = useTranslation('deliverect-stores')
  const refusal = fieldRefusal(error, STATUS_REFUSALS, t('dialog.failedHint'))
  if (!refusal) return null
  const lead = refusal.code === DELIVERECT_ERRORS.notLinked ? t('statusAction.notLinked') : t('statusAction.deliverectFailed')
  return (
    <div className="flex flex-col gap-1" data-status-refusal={refusal.code}>
      <p className="text-xs font-medium text-danger-800">{lead}</p>
      <InlineRefusal message={refusal.message} code={refusal.code} />
    </div>
  )
}

/**
 * Set a store busy (with a preparation delay), closed for now, or reopened on Deliverect, with a
 * reason (ticket 481; contract § Store status). The action is chosen in the dialog — none is
 * preselected, so nothing is sent by a stray Confirm — and an open store is not offered reopen, a
 * closed one only reopen (`actionOffered`, read from the row as the dialog opened). The delay is asked for busy ONLY and is sent for busy
 * only (`statusBody`). DLV-00010 and DLV-00011 show inline; DLV-00009 at the reason.
 */
export function StatusActionDialog({ row, onClose, onDone }: { row: DeliverectStoreRow; onClose: () => void; onDone: () => void }) {
  const { t } = useTranslation('deliverect-stores')
  const qc = useQueryClient()
  const [action, setAction] = useState<DeliverectStoreAction | null>(null)
  const [delay, setDelay] = useState('')
  const delayBad = action === 'busy' && delay.trim() !== '' && parseDelay(delay) === null
  const send = useMutation({
    mutationFn: (body: DeliverectStoreStatusBody) => storesApi.setStatus(row.storeCode, body),
    onSuccess: (_, { action: act }) => {
      void qc.invalidateQueries({ queryKey: STORES_KEY })
      void qc.invalidateQueries({ queryKey: statusHistoryKey(row.storeCode) })
      notify.success(t('statusAction.done'), t(`statusAction.doneDetail.${act}`, { store: fsi(row.storeCode) }))
      onDone()
    },
  })

  return (
    <ReasonDialog
      open
      title={t('statusAction.title')}
      note={
        <span data-status-note={action ?? 'none'}>
          <Trans
            t={t}
            i18nKey={`statusAction.notes.${action ?? 'none'}`}
            values={{ store: row.storeCode }}
            components={{ store: <Ltr /> }}
          />
        </span>
      }
      busy={send.isPending}
      error={send.error}
      confirmLabel={t(`statusAction.confirm.${action ?? 'none'}`)}
      danger={action === 'close'}
      confirmDisabled={action === null || (action === 'busy' && parseDelay(delay) === null)}
      handledCodes={STATUS_REFUSALS}
      onEdit={() => send.reset()}
      onConfirm={(reason) => {
        // Confirm is enabled only once the body is sendable.
        const body = action && statusBody(action, delay, reason)
        if (body) send.mutate(body)
      }}
      onClose={onClose}
    >
      <fieldset className="flex flex-col gap-1.5" data-status-actions="">
        <legend className="mb-1 text-xs font-medium">{t('statusAction.choose')}</legend>
        <div className="flex flex-wrap gap-3">
          {STATUS_ACTIONS.map((a) => (
            <label key={a} className="flex items-center gap-1.5 text-sm has-[:disabled]:opacity-50">
              <input
                type="radio"
                name="store-status-action"
                value={a}
                checked={action === a}
                disabled={send.isPending || !actionOffered(row.status?.state, a)}
                onChange={() => {
                  setAction(a)
                  send.reset()
                }}
                data-status-action={a}
              />
              {t(`statusAction.actions.${a}`)}
            </label>
          ))}
        </div>
      </fieldset>
      {action === 'busy' && (
        <div className="flex flex-col gap-1">
          <Field
            label={t('statusAction.delay')}
            error={delayBad ? <span data-status-delay-invalid="">{t('statusAction.delayInvalid')}</span> : undefined}
          >
            <Input
              type="text"
              inputMode="numeric"
              value={delay}
              onChange={(e) => {
                setDelay(e.target.value)
                send.reset()
              }}
              disabled={send.isPending}
              dir="ltr"
              placeholder={t('statusAction.delayPlaceholder')}
              aria-invalid={delayBad || undefined}
              className="w-32 font-mono"
              data-status-delay=""
            />
          </Field>
        </div>
      )}
      <StatusRefusal error={send.error} />
    </ReasonDialog>
  )
}

/**
 * **Push hours now** (ticket 481; contract `POST StoreStatus/{store}/Hours`): re-push the store's
 * opening hours from the duty roster, then show the week that was sent — one row per day, an
 * overnight shift marked "next day" (`hoursLabel`, one string isolated once). The door takes no
 * reason. DLV-00010 / DLV-00011 show inline, as in the status dialog.
 */
export function PushHoursDialog({ row, onClose }: { row: DeliverectStoreRow; onClose: () => void }) {
  const { t } = useTranslation('deliverect-stores')
  const qc = useQueryClient()
  const push = useMutation({
    mutationFn: () => storesApi.pushHours(row.storeCode),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: statusHistoryKey(row.storeCode) })
      notify.success(t('hours.done'), t('hours.doneDetail', { store: fsi(row.storeCode) }))
    },
  })
  const code = push.error ? apiErrorCode(push.error) : null
  const banner = push.isError && !(code !== null && (STATUS_REFUSALS as readonly string[]).includes(code))

  return (
    <Modal
      open
      onClose={() => !push.isPending && onClose()}
      title={t('hours.title')}
      width="30rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={push.isPending} data-hours-close="">
            {push.isSuccess ? t('hours.close') : t('dialog.cancel')}
          </Button>
          {!push.isSuccess && (
            <Button onClick={() => push.mutate()} disabled={push.isPending} data-hours-push="">
              {push.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {push.isPending ? t('dialog.sending') : t('hours.confirm')}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-3" data-hours-dialog={row.storeCode}>
        <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-hours-note="">
          <Trans t={t} i18nKey="hours.note" values={{ store: row.storeCode }} components={{ store: <Ltr /> }} />
        </p>
        <StatusRefusal error={push.error} />
        {banner && (
          <ErrorBanner className="p-2" title={t('dialog.failed')} message={apiErrorMessage(push.error, t('dialog.failedHint'))}>
            {code && (
              <span className="font-mono text-xs" data-hours-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
        {push.isSuccess &&
          (push.data.length === 0 ? (
            <p className="text-sm text-muted-foreground" data-hours-empty="">
              {t('hours.empty')}
            </p>
          ) : (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs font-medium">{t('hours.sent')}</p>
              <table className="w-full border-collapse text-sm" data-hours-sent="">
                <thead className="border-b border-border/60 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-2 py-1 text-start font-medium">{t('hours.columns.day')}</th>
                    <th className="px-2 py-1 text-start font-medium">{t('hours.columns.hours')}</th>
                  </tr>
                </thead>
                <tbody>
                  {push.data.map((h, i) => {
                    const day = dayKey(h.day)
                    return (
                      // A day may hold two shifts, so the index keeps the key unique.
                      <tr key={`${h.day}-${i}`} className="border-b border-border/40" data-hours-row={h.day}>
                        <td className="px-2 py-1" data-hours-day="">
                          {day ? t(`hours.days.${day}`) : <Ltr>{h.day}</Ltr>}
                        </td>
                        <td className="px-2 py-1 tabular-nums" data-hours-label="" data-hours-overnight={h.overnight ? '' : undefined}>
                          {/* One string, isolated once (bidi rule) — never one isolate per end. A plain
                              range is a machine value (Ltr); an overnight one is a range written with
                              words, so its range is isolated inside (`fsi`) and the sentence takes
                              the direction of its own words (`<bdi>`), "next day" after the times. */}
                          {h.overnight ? <bdi>{hoursLabel(t, h)}</bdi> : <Ltr>{hoursLabel(t, h)}</Ltr>}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          ))}
      </div>
    </Modal>
  )
}
