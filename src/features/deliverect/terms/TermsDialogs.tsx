import { useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle } from 'lucide-react'
import { DELIVERECT_PLATFORMS_KEY } from '@/core/deliverect/api'
import ReasonDialog, { InlineRefusal } from '@/core/deliverect/ReasonDialog'
import { fieldRefusal } from '@/core/deliverect/reason'
import { DELIVERECT_ERRORS, type DeliverectPlatform } from '@/core/models/deliverect'
import { notify } from '@/core/services/notify'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { TERMS_KEY, termsApi } from './api'
import {
  EMPTY_PLATFORM_DRAFT,
  parsePlatformDraft,
  parsePlatformKey,
  platformDraftOf,
  samePlatform,
  type PlatformDraft,
} from './platform-edit'
import {
  TERMS_NUMBER_FIELDS,
  currentRow,
  dayBefore,
  parseTermsDraft,
  termsConflict,
  termsCurrency,
  termsDraftFrom,
  type TermsDraft,
  type TermsEntry,
  type TermsField,
} from './terms-timeline'

const FIELD = 'flex flex-col gap-1 text-xs font-medium'
const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm font-normal text-foreground outline-none focus:border-primary/60 disabled:opacity-60'

/** A platform as `display name` (free text) beside its key (a machine value), each isolated. */
function PlatformLine({ platform }: { platform: DeliverectPlatform }) {
  return (
    <p className="flex items-center gap-2 text-sm" data-dialog-platform="">
      <bdi className="font-medium">{platform.displayName}</bdi>
      <span className="font-mono text-xs text-muted-foreground">
        <Ltr>{platform.platformKey}</Ltr>
      </span>
    </p>
  )
}

function Problem({ text, data }: { text: string; data: string }) {
  return (
    <span role="alert" className="flex items-center gap-1 font-normal text-danger-800" data-field-problem={data}>
      <AlertTriangle className="h-3 w-3 shrink-0" aria-hidden />
      {text}
    </span>
  )
}

/**
 * **Edit a delivery platform** (ticket 482; `PUT Platforms/{key}`): display name, Deliverect channel
 * id, credit customer and active, with a reason. 🚩 With no credit customer the Active box cannot be
 * ticked, and the dialog says why — its orders would be refused. An already-ticked box stays
 * untickable, so the user can clear it; it is never flipped for them. Save waits for a change.
 *
 * With `platform` null it **adds** one (`POST Platforms`, behind `canAddPlatform`): the same fields
 * plus the new key, which is never edited afterwards. A key that exists (DLV-00014) shows inline.
 */
export function PlatformDialog({ platform, onClose }: { platform: DeliverectPlatform | null; onClose: () => void }) {
  const { t } = useTranslation('deliverect-terms')
  const qc = useQueryClient()
  const adding = platform === null
  const [draft, setDraft] = useState<PlatformDraft>(() => (platform ? platformDraftOf(platform) : EMPTY_PLATFORM_DRAFT))
  const [keyText, setKeyText] = useState('')
  const key = parsePlatformKey(keyText)
  const parsed = parsePlatformDraft(draft)
  const unchanged = platform !== null && parsed.value !== null && samePlatform(parsed.value, platform)

  const send = useMutation({
    mutationFn: (reason: string) =>
      platform
        ? termsApi.updatePlatform(platform.platformKey, { ...parsed.value!, reason })
        : termsApi.addPlatform({ platformKey: key.value!, ...parsed.value!, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: DELIVERECT_PLATFORMS_KEY })
      const which = fsi(platform?.platformKey ?? key.value!)
      notify.success(t(adding ? 'addPlatform.done' : 'edit.done'), t(adding ? 'addPlatform.doneDetail' : 'edit.doneDetail', { platform: which }))
      onClose()
    },
  })
  const exists = fieldRefusal(send.error, [DELIVERECT_ERRORS.platformExists], t('failedHint'))
  const set = <K extends keyof PlatformDraft>(key: K, value: PlatformDraft[K]) => {
    send.reset()
    setDraft((d) => ({ ...d, [key]: value }))
  }
  const problem = (field: 'displayName' | 'channelId') =>
    parsed.problems[field] ? <Problem text={t(`edit.problems.${parsed.problems[field]}`)} data={field} /> : null

  return (
    <ReasonDialog
      open
      title={t(adding ? 'addPlatform.title' : 'edit.title')}
      note={t('edit.note')}
      busy={send.isPending}
      error={send.error}
      handledCodes={adding ? [DELIVERECT_ERRORS.platformExists] : undefined}
      confirmLabel={t(adding ? 'addPlatform.confirm' : 'edit.confirm')}
      confirmDisabled={parsed.value === null || unchanged || (adding && key.value === null)}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      {platform && <PlatformLine platform={platform} />}
      <div className="grid grid-cols-2 gap-3" data-platform-dialog={adding ? 'add' : 'edit'}>
        {adding && (
          <label className={FIELD + ' col-span-2'}>
            {t('addPlatform.platformKey')}
            <input
              value={keyText}
              onChange={(e) => {
                send.reset()
                setKeyText(e.target.value)
              }}
              disabled={send.isPending}
              autoFocus
              dir="ltr"
              className={INPUT + ' font-mono uppercase'}
              aria-invalid={exists !== null || undefined}
              data-add-platform-key=""
            />
            {keyText !== '' && key.problem && <Problem text={t(`addPlatform.problems.${key.problem}`)} data="platformKey" />}
            <span className="font-normal text-muted-foreground">{t('addPlatform.platformKeyHint')}</span>
            {exists && <InlineRefusal message={exists.message} code={exists.code} />}
          </label>
        )}
        <label className={FIELD + ' col-span-2'}>
          {t('edit.displayName')}
          <input
            value={draft.displayName}
            onChange={(e) => set('displayName', e.target.value)}
            disabled={send.isPending}
            dir="auto"
            className={INPUT}
            data-edit-display-name=""
          />
          {problem('displayName')}
        </label>
        <label className={FIELD}>
          {t('edit.channelId')}
          <input
            value={draft.channelId}
            onChange={(e) => set('channelId', e.target.value)}
            disabled={send.isPending}
            dir="ltr"
            inputMode="numeric"
            className={INPUT + ' font-mono'}
            data-edit-channel-id=""
          />
          {problem('channelId')}
        </label>
        <label className={FIELD}>
          {t('edit.creditCustomer')}
          <input
            value={draft.creditCustomer}
            onChange={(e) => set('creditCustomer', e.target.value)}
            disabled={send.isPending}
            dir="ltr"
            className={INPUT + ' font-mono'}
            data-edit-credit-customer=""
          />
          <span className="font-normal text-muted-foreground">{t('edit.creditCustomerHint')}</span>
        </label>
        <div className="col-span-2 flex flex-col gap-1 text-xs">
          <label className="flex items-center gap-2 font-medium">
            <input
              type="checkbox"
              checked={draft.active}
              // Cannot be ticked without a credit customer — but a ticked box can still be cleared.
              disabled={send.isPending || (parsed.activeBlocked && !draft.active)}
              onChange={(e) => set('active', e.target.checked)}
              data-edit-active=""
            />
            {t('edit.active')}
          </label>
          {parsed.activeBlocked && (
            <p
              role={parsed.problems.active ? 'alert' : 'note'}
              className={'flex items-start gap-1 ' + (parsed.problems.active ? 'text-danger-800' : 'text-muted-foreground')}
              data-edit-active-blocked={parsed.problems.active ? 'problem' : 'note'}
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                {t('edit.activeBlocked')}
                {parsed.problems.active && <> {t('edit.problems.noCreditCustomer')}</>}
              </span>
            </p>
          )}
        </div>
      </div>
    </ReasonDialog>
  )
}

/**
 * **Add terms** (ticket 482; `POST Terms`): a new row from a date, with a reason. The dialog says the
 * current row closes the day before the new one starts (the date it will close on, once a date is
 * typed). A `validFrom` that would overlap a row is flagged as the client's hint; it does not block —
 * the server's DLV-00008 is the authority and shows inline at the date.
 */
export function AddTermsDialog({ platform, timeline, onClose }: { platform: DeliverectPlatform; timeline: readonly TermsEntry[]; onClose: () => void }) {
  const { t } = useTranslation('deliverect-terms')
  const qc = useQueryClient()
  const [draft, setDraft] = useState<TermsDraft>(() => termsDraftFrom(timeline))
  const [touched, setTouched] = useState<Partial<Record<TermsField, boolean>>>({})
  const open = currentRow(timeline)
  const currencyKey = termsCurrency(timeline)
  const parsed = parseTermsDraft(draft, currencyKey)
  const conflict = termsConflict(timeline, draft.validFrom)
  const closeOn = dayBefore(draft.validFrom)

  const send = useMutation({
    mutationFn: (reason: string) => termsApi.add({ platformKey: platform.platformKey, ...parsed.value!, reason }),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: TERMS_KEY })
      notify.success(t('add.done'), t('add.doneDetail', { platform: fsi(platform.platformKey), from: fsi(draft.validFrom) }))
      onClose()
    },
  })
  const overlap = fieldRefusal(send.error, [DELIVERECT_ERRORS.termsOverlap], t('failedHint'))
  const set = (key: TermsField, value: string) => {
    send.reset()
    setTouched((s) => ({ ...s, [key]: true }))
    setDraft((d) => ({ ...d, [key]: value }))
  }
  // A field's problem shows once it was edited or holds a value — never a wall of "Required." on opening.
  const problem = (field: TermsField) =>
    (touched[field] || draft[field].trim() !== '') && parsed.problems[field] ? <Problem text={t(`add.problems.${parsed.problems[field]}`)} data={field} /> : null

  const note = (
    <span className="flex flex-col gap-1" data-terms-note="">
      <span>{t('add.neverEdited')}</span>
      {timeline.length === 0 ? (
        <span data-terms-closes="first">{t('add.first')}</span>
      ) : (
        open && (
          // The closing date is named only for a date the open row can close before; a flagged date
          // gets the general sentence, never "closes on" a day before the row even starts.
          <span data-terms-closes={closeOn && conflict === null ? closeOn : ''}>
            {closeOn && conflict === null ? (
              <Trans t={t} i18nKey="add.closesOn" values={{ from: open.validFrom, closeOn }} components={{ from: <Ltr />, closeOn: <Ltr /> }} />
            ) : (
              t('add.closesDayBefore')
            )}
          </span>
        )
      )}
    </span>
  )

  return (
    <ReasonDialog
      open
      title={t('add.title')}
      note={note}
      busy={send.isPending}
      error={send.error}
      confirmLabel={t('add.confirm')}
      confirmDisabled={parsed.value === null}
      handledCodes={[DELIVERECT_ERRORS.termsOverlap]}
      onEdit={() => send.reset()}
      onConfirm={(reason) => send.mutate(reason)}
      onClose={onClose}
    >
      <PlatformLine platform={platform} />
      <div className="grid grid-cols-2 gap-3" data-terms-dialog="">
        <label className={FIELD + ' col-span-2'}>
          {t('add.validFrom')}
          <input
            type="date"
            value={draft.validFrom}
            onChange={(e) => set('validFrom', e.target.value)}
            disabled={send.isPending}
            autoFocus
            className={INPUT + ' w-48'}
            aria-invalid={overlap !== null || undefined}
            data-terms-valid-from=""
          />
          {problem('validFrom')}
          {conflict && (
            <span role="note" className="flex items-start gap-1 font-normal text-attention-800" data-terms-conflict={conflict.kind}>
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
              <span>
                <Trans
                  t={t}
                  i18nKey={conflict.kind === 'before' ? 'add.conflict.before' : conflict.row.validTo === null ? 'add.conflict.insideOpen' : 'add.conflict.inside'}
                  values={{ date: draft.validFrom, from: conflict.row.validFrom }}
                  components={{ date: <Ltr />, from: <Ltr /> }}
                />
              </span>
            </span>
          )}
          {overlap && <InlineRefusal message={overlap.message} code={overlap.code} />}
        </label>
        {TERMS_NUMBER_FIELDS.map((field) => (
          <label key={field} className={FIELD}>
            {t(`add.${field}`)}
            <input
              value={draft[field]}
              onChange={(e) => set(field, e.target.value)}
              disabled={send.isPending}
              dir="ltr"
              inputMode="decimal"
              className={INPUT + ' tabular-nums'}
              data-terms-field={field}
            />
            {problem(field)}
          </label>
        ))}
        <p className="col-span-2 flex items-center gap-2 text-xs text-muted-foreground" data-terms-currency="">
          {t('add.currency')}
          <span className="font-mono text-foreground">
            <Ltr>{currencyKey}</Ltr>
          </span>
        </p>
      </div>
    </ReasonDialog>
  )
}
