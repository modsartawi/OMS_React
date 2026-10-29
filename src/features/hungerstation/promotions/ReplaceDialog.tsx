import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ReasonDialog, { InlineRefusal } from '@/core/hungerstation/ReasonDialog'
import {
  HUNGERSTATION_PROMOTION_ERRORS,
  type HungerStationPromotionDetail,
  type HungerStationPromotionStoreChoice,
} from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { notify } from '@/core/services/notify'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { PROMOTIONS_KEY, promotionKey, promotionsApi, promotionStoresKey } from './api'
import { pickEndDay, windowProblem, type LocalWindow } from './local-window'
import { replaceBody, replaceFormFromDetail, replaceNeeded, replaceProblems, type ReplaceForm } from './replace-form'

const { replaceStopped, nameInUse, sending, promotionSent } = HUNGERSTATION_PROMOTION_ERRORS

/**
 * **Replace** a sent promotion (ticket 671; `POST Promotions/{id}/Replace`, BackOffice 3216): a new
 * name, stores, start or end — the things HungerStation keys a promotion by — with a reason. The
 * dialog says in words what happens; the ORDER (switch the old one off first, send the new one only
 * if every switch-off was accepted) is the server's.
 *
 * The body carries only what changed (a `null` keeps the old value, contract 3216). On success the
 * answer is the NEW promotion: it is cached and opened (`onReplaced`), linking back to this one,
 * which reads Sending until its switch-off jobs complete, then Replaced. A refused switch-off
 * (DHS-00020, 409) stays in the dialog with the server's message — it names the part and
 * HungerStation's answer; there is no structured data — and this promotion is re-read, unchanged.
 * The stores picker is the chain's (`Promotions/Stores`), ticked as sent; a sent store the picker no
 * longer offers stays listed.
 */
export default function ReplaceDialog({
  promotion,
  onClose,
  onReplaced,
}: {
  promotion: HungerStationPromotionDetail
  onClose: () => void
  onReplaced: (promotionId: string) => void
}) {
  const { t } = useTranslation('hungerstation-promotions')
  const qc = useQueryClient()
  const [form, setForm] = useState<ReplaceForm>(() => replaceFormFromDetail(promotion))
  const set = <K extends keyof ReplaceForm>(key: K, value: ReplaceForm[K]) => {
    replace.reset()
    setForm((f) => ({ ...f, [key]: value }))
  }
  const setWindow = (w: LocalWindow) => set('window', w)

  const picker = useQuery({
    queryKey: promotionStoresKey(promotion.chainKey),
    queryFn: () => promotionsApi.stores(promotion.chainKey),
    retry: false,
  })
  // The chain's stores, then any sent store it no longer offers (still ticked, so it can be dropped).
  const choices = useMemo<HungerStationPromotionStoreChoice[]>(() => {
    const offered = picker.data ?? []
    const known = new Set(offered.map((s) => s.storeCode))
    const gone = (promotion.stores ?? [])
      .filter((s) => !known.has(s.storeCode))
      .map((s) => ({ storeCode: s.storeCode, storeName: s.storeName, vendorId: s.vendorId, syncActive: true }))
    return [...offered, ...gone]
  }, [picker.data, promotion.stores])

  const replace = useMutation({
    mutationFn: (reason: string) => promotionsApi.replace(promotion.promotionId, replaceBody(promotion, form, reason)),
    onSuccess: (next) => {
      qc.setQueryData(promotionKey(next.promotionId), next)
      void qc.invalidateQueries({ queryKey: PROMOTIONS_KEY })
      notify.success(t('replace.done'), t('replace.doneDetail', { name: fsi(next.name) }))
      onReplaced(next.promotionId)
    },
    onError: (err) => {
      // A refused switch-off left the old one as it was (an earlier part of it may be switched off);
      // DHS-00017 means a part is Sending after all; HungerStationPromotionSent that it closed
      // meanwhile. Each way the sheet behind re-reads what is true now.
      const code = apiErrorCode(err)
      if (code === replaceStopped || code === sending || code === promotionSent) void qc.invalidateQueries({ queryKey: promotionKey(promotion.promotionId) })
    },
  })

  const code = replace.error ? apiErrorCode(replace.error) : null
  const now = new Date()
  const problems = replaceProblems(form, now)
  const changed = replaceNeeded(promotion, form)
  const windowIssue = windowProblem(form.window, now)
  const ticked = new Set(form.stores)
  const toggle = (storeCode: string) =>
    set('stores', ticked.has(storeCode) ? form.stores.filter((c) => c !== storeCode) : choices.map((c) => c.storeCode).filter((c) => c === storeCode || ticked.has(c)))

  return (
    <ReasonDialog
      open
      title={t('replace.title')}
      note={t('replace.note')}
      busy={replace.isPending}
      error={replace.error}
      confirmLabel={t('replace.confirm')}
      confirmDisabled={problems.length > 0 || !changed}
      handledCodes={[replaceStopped, nameInUse]}
      onEdit={() => replace.reset()}
      onConfirm={(reason) => replace.mutate(reason)}
      onClose={onClose}
    >
      <div className="flex flex-col gap-3" data-replace-dialog={promotion.promotionId}>
        <Field label={t('editor.name')} error={problems.includes('name') ? t('replace.nameRequired') : undefined}>
          <Input value={form.name} onChange={(e) => set('name', e.target.value)} dir="auto" maxLength={100} disabled={replace.isPending} data-replace-name="" />
        </Field>
        {code === nameInUse && replace.error != null && (
          <div data-replace-name-refusal="">
            <InlineRefusal message={apiErrorMessage(replace.error, t('editor.failedHint'))} code={code} />
          </div>
        )}
        <div className="grid grid-cols-2 gap-2">
          <Field label={t('editor.startDate')}>
            <Input type="date" value={form.window.startDate} onChange={(e) => setWindow({ ...form.window, startDate: e.target.value })} data-replace-start-date="" />
          </Field>
          <Field label={t('editor.startTime')} hint={t('editor.saudiTime')}>
            <Input type="time" value={form.window.startTime} onChange={(e) => setWindow({ ...form.window, startTime: e.target.value })} data-replace-start-time="" />
          </Field>
          <Field label={t('editor.endDate')}>
            <Input type="date" value={form.window.endDate} onChange={(e) => setWindow(pickEndDay(form.window, e.target.value))} data-replace-end-date="" />
          </Field>
          <Field label={t('editor.endTime')} hint={t('editor.saudiTime')}>
            <Input type="time" value={form.window.endTime} onChange={(e) => setWindow({ ...form.window, endTime: e.target.value })} data-replace-end-time="" />
          </Field>
          {windowIssue && (
            <p role="alert" className="col-span-full text-xs text-danger-800" data-replace-window-problem={windowIssue}>
              {t(`editor.windowProblems.${windowIssue}`)}
            </p>
          )}
        </div>

        <section className="flex flex-col gap-1.5" data-replace-stores="">
          <div className="flex items-center justify-between gap-2">
            <h3 className="text-xs font-semibold tracking-tight">{t('editor.storesTitle')}</h3>
            <span className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground" data-replace-stores-count="">
                <Trans t={t} i18nKey="editor.storesTicked" values={{ count: formatCount(figure(form.stores.length), figure(choices.length)) }} components={{ count: <Ltr /> }} />
              </span>
              <Button variant="text" onClick={() => set('stores', choices.map((c) => c.storeCode))} disabled={choices.every((c) => ticked.has(c.storeCode))} data-replace-stores-all="">
                {t('editor.storesAll')}
              </Button>
            </span>
          </div>
          {picker.isPending ? (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
              {t('editor.storesLoading')}
            </p>
          ) : (
            picker.isError && <ErrorBanner className="p-2" title={t('editor.storesFailed')} message={apiErrorMessage(picker.error, t('results.failed'))} />
          )}
          {problems.includes('stores') && (
            <p role="alert" className="text-xs text-danger-800" data-replace-stores-problem="">
              {t('editor.storesAtLeastOne')}
            </p>
          )}
          <ul className="grid max-h-40 grid-cols-1 gap-x-4 overflow-auto rounded-md border border-border/60 p-2 sm:grid-cols-2" data-replace-store-list="">
            {choices.map((s) => (
              <li key={s.storeCode} data-replace-store={s.storeCode} data-replace-store-on={String(ticked.has(s.storeCode))}>
                <label className="flex items-center gap-2 py-0.5 text-xs">
                  <input type="checkbox" checked={ticked.has(s.storeCode)} onChange={() => toggle(s.storeCode)} disabled={replace.isPending} data-replace-store-tick="" />
                  <span className="font-mono">
                    <Ltr>{s.storeCode}</Ltr>
                  </span>
                  <span className="min-w-0 truncate">{s.storeName ? <bdi>{s.storeName}</bdi> : null}</span>
                  {!s.syncActive && <StatusBadge sev="warn">{t('editor.storePaused')}</StatusBadge>}
                </label>
              </li>
            ))}
          </ul>
        </section>

        {!changed && (
          <p className="text-xs text-muted-foreground" data-replace-unchanged="">
            {t('replace.unchanged')}
          </p>
        )}

        {code === replaceStopped && replace.error != null && (
          <div role="alert" className="flex flex-col gap-1 rounded-md border border-danger-border bg-danger-050 p-2.5 text-xs text-danger-800" data-replace-refused="">
            <p className="flex items-start gap-1.5 font-medium">
              <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
              <span>{t('replace.refusedNoPart')}</span>
            </p>
            <p>{t('replace.refusedUnchanged')}</p>
            {/* The server's words name the part and HungerStation's answer (English / Arabic). */}
            <p data-replace-refused-answer="">
              <bdi>{apiErrorMessage(replace.error, t('editor.failedHint'))}</bdi>
              <span className="ms-1.5 font-mono">
                <Ltr>{code}</Ltr>
              </span>
            </p>
          </div>
        )}
      </div>
    </ReasonDialog>
  )
}
