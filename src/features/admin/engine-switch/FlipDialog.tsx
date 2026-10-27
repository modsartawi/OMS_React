import { useId, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type { PromotionEngine, RuleEngineInFlight, StoreEngineChange } from '@/core/models/rule-campaign'
import SaysBoth from '@/core/rules/SaysBoth'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Textarea from '@/core/ui/Textarea'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { ENGINE_SWITCH_KEY, engineSwitchApi } from './api'
import { afterFlip, flipForm, inFlightCount, REASON_REQUIRED, wasAlreadyOn, type StoreEngineRow } from './helpers'

/**
 * Flip a store's engine (ticket 517, re-pointed in 528; `POST Rules/Switch/Flip`). The reason is
 * required; the flip takes effect at the store's next shift open. A refusal shows here, verbatim,
 * with its code. A flip back to bonus buys answers what is still in flight at the store — live
 * campaigns, its paying sessions, its store-scope budgets — and the dialog then shows that list:
 * the flip has already happened, nothing was blocked. HQ has no read of it before the flip (BO ask C).
 */
export default function FlipDialog({
  row,
  target,
  onClose,
  onFlipped,
}: {
  row: StoreEngineRow
  target: PromotionEngine
  onClose: () => void
  onFlipped: (storeCode: string) => void
}) {
  const { t } = useTranslation('engine-switch')
  const queryClient = useQueryClient()
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  // The flip's reply, when it warned of something still in flight.
  const [flipped, setFlipped] = useState<StoreEngineChange | null>(null)
  const reasonId = useId()
  const store = fsi(formatPair(row.storeCode, row.storeName))

  const flip = useMutation({
    mutationFn: engineSwitchApi.flip,
    onSuccess: (change) => {
      void queryClient.invalidateQueries({ queryKey: ENGINE_SWITCH_KEY })
      // The list may have been stale: HQ names the engine the store was on.
      if (wasAlreadyOn(change)) notify.info(t(`flipped.already.${change.engine}`, { store }))
      else notify.success(t(`flipped.${target}`, { store }), t('flipped.shiftOpen'))
      if (afterFlip(change) === 'inFlight') setFlipped(change)
      else onFlipped(change.storeCode)
    },
  })
  const form = flipForm(row.storeCode, target, reason)
  const submit = () => {
    setTried(true)
    if (form.ok) flip.mutate(form.body)
  }
  const close = () => {
    if (flipped) onFlipped(flipped.storeCode)
    else if (!flip.isPending) onClose()
  }
  const code = flip.isError ? apiErrorCode(flip.error) : null
  const missing = (tried && !form.ok) || code === REASON_REQUIRED

  return (
    <Modal
      open
      onClose={close}
      title={t(`flip.title.${target}`, { store })}
      width="34rem"
      footer={
        flipped ? (
          <Button onClick={close} data-flip-done="">
            {t('flip.done')}
          </Button>
        ) : (
          <>
            <Button variant="text" disabled={flip.isPending} onClick={close}>
              {t('flip.cancel')}
            </Button>
            <Button disabled={flip.isPending} onClick={submit} data-flip-confirm="">
              {flip.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
              {t(`flip.confirm.${target}`)}
            </Button>
          </>
        )
      }
    >
      <div className="flex flex-col gap-3 text-sm" data-flip-dialog={row.storeCode} data-flip-step={flipped ? 'inFlight' : 'reason'}>
        {flipped?.inFlight ? (
          <InFlightAfter w={flipped.inFlight} />
        ) : (
          <>
            <p data-flip-shift-open="">{t('flip.shiftOpen')}</p>
            {target === 'BonusBuy' && <p className="text-muted-foreground" data-flip-in-flight-after="">{t('flip.inFlightAfter')}</p>}
            <Field
              id={reasonId}
              label={t('flip.reason')}
              error={missing ? <span data-flip-reason-required="">{t('flip.reasonRequired')}</span> : undefined}
            >
              <Textarea
                className="min-h-20"
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  // A refusal answered the reason as it was; an edited one has not been asked yet.
                  if (flip.isError) flip.reset()
                }}
                required
                aria-invalid={missing}
                data-flip-reason=""
              />
            </Field>
            {flip.isError && (
              <div data-flip-refusal="">
                <ErrorBanner
                  className="p-2.5"
                  title={t('flip.refusedTitle')}
                  message={isBareDenial(flip.error) ? t('flip.denied') : apiErrorMessage(flip.error, t('flip.refused'))}
                >
                  {code && (
                    <p className="mt-1 text-xs" data-refusal-code={code}>
                      {t('flip.refusalCode')}{' '}
                      <span className="font-mono">
                        <Ltr>{code}</Ltr>
                      </span>
                    </p>
                  )}
                </ErrorBanner>
              </div>
            )}
          </>
        )}
      </div>
    </Modal>
  )
}

/** What the flip back left in flight, from HQ's reply. It informs; the flip is already made. */
function InFlightAfter({ w }: { w: RuleEngineInFlight }) {
  const { t } = useTranslation('engine-switch')
  const n = inFlightCount(w)
  return (
    <div className="flex flex-col gap-3" data-in-flight={n}>
      <div className="rounded-lg border border-attention-border bg-attention-050 p-3 text-xs text-attention-800" role="status">
        <Trans t={t} i18nKey="inFlight.lede" count={n} values={{ n }} components={{ n: <Ltr /> }} />
        {w.truncated && (
          <p className="mt-1" data-in-flight-truncated="">
            {t('inFlight.truncated')}
          </p>
        )}
      </div>
      <InFlightList kind="liveCampaigns" count={w.liveCampaigns.length}>
        {w.liveCampaigns.map((c) => (
          <li key={c.code} className="flex gap-2" data-in-flight-item={c.code}>
            <code className="font-mono font-semibold">
              <Ltr>{c.code}</Ltr>
            </code>
            <SaysBoth says={{ en: c.nameEn, ar: c.nameAr }} />
          </li>
        ))}
      </InFlightList>
      <InFlightList kind="openSessions" count={w.openSessions.length}>
        {w.openSessions.map((s) => (
          <li key={s.sessionId} className="flex flex-wrap gap-x-2" data-in-flight-item={s.sessionId}>
            <code className="font-mono font-semibold">
              <Ltr>{s.sessionId}</Ltr>
            </code>
            <Ltr>{s.channel}</Ltr>
            <span className="text-muted-foreground">
              <Trans
                t={t}
                i18nKey="inFlight.session"
                values={{ opened: formatDateTime(s.openedAt) || t('none'), paid: formatDateTime(s.paidAt) || t('none') }}
                components={{ v: <Ltr /> }}
              />
            </span>
          </li>
        ))}
      </InFlightList>
      <InFlightList kind="storeBudgets" count={w.storeBudgets.length}>
        {w.storeBudgets.map((b) => (
          <li key={`${b.campaignId}\u0000${b.budgetId}\u0000${b.periodKey}`} className="flex flex-wrap gap-x-2" data-in-flight-item={b.campaignId}>
            <code className="font-mono font-semibold">
              <Ltr>{formatPair(b.campaignId, b.budgetId)}</Ltr>
            </code>
            <Ltr>{b.periodKey}</Ltr>
            <span className="text-muted-foreground">
              <Trans t={t} i18nKey="inFlight.budget" values={{ used: formatNumber(b.used), held: formatNumber(b.held) }} components={{ v: <Ltr /> }} />
            </span>
          </li>
        ))}
      </InFlightList>
    </div>
  )
}

function InFlightList({ kind, count, children }: { kind: 'liveCampaigns' | 'openSessions' | 'storeBudgets'; count: number; children: ReactNode }) {
  const { t } = useTranslation('engine-switch')
  return (
    <section className="flex flex-col gap-1 text-xs" data-in-flight-list={kind} data-in-flight-count={count}>
      <h3 className="font-semibold">{t(`inFlight.${kind}`)}</h3>
      {count === 0 ? <p className="text-muted-foreground">{t('inFlight.noneOfThese')}</p> : <ul className="flex flex-col gap-1">{children}</ul>}
    </section>
  )
}
