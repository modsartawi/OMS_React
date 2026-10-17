import { useId, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { PromotionEngine, StoreEngineInFlight, StoreEngineRow } from '@/core/models/rule-campaign'
import { RULE_INPUT } from '@/core/rules/LookupPicks'
import SaysBoth from '@/core/rules/SaysBoth'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { ENGINE_SWITCH_KEY, engineSwitchApi, storeInFlightQuery } from './api'
import { engineOf, firstFlipStep, flipForm, inFlightCount, type FlipStep } from './helpers'

/**
 * Flip a store's engine (ticket 517, BackOffice 2745). A flip back to bonus buys first shows HQ's
 * in-flight warning — live campaigns, open call-center sessions, store-scope budgets — which NEVER
 * blocks: Continue is always offered, even while it loads or when it fails. Then the reason, which
 * is required, and the flip, which takes effect at the store's next shift open. A refusal shows
 * here, verbatim, with its code.
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
  onFlipped: (row: StoreEngineRow) => void
}) {
  const { t } = useTranslation('engine-switch')
  const queryClient = useQueryClient()
  const [step, setStep] = useState<FlipStep>(firstFlipStep(target))
  const [reason, setReason] = useState('')
  const [tried, setTried] = useState(false)
  const reasonId = useId()
  const store = fsi(formatPair(row.storeCode, row.storeName))

  const flip = useMutation({
    mutationFn: engineSwitchApi.flip,
    onSuccess: (flipped) => {
      void queryClient.invalidateQueries({ queryKey: ENGINE_SWITCH_KEY })
      notify.success(t(`flipped.${target}`, { store }), t('flipped.shiftOpen'))
      onFlipped(flipped)
    },
  })
  const form = flipForm(row.storeCode, engineOf(row), target, reason)
  const submit = () => {
    setTried(true)
    if (form.ok) flip.mutate(form.body)
  }
  const close = () => {
    if (!flip.isPending) onClose()
  }
  const code = flip.isError ? apiErrorCode(flip.error) : null
  const missing = tried && !form.ok

  return (
    <Modal
      open
      onClose={close}
      title={t(`flip.title.${target}`, { store })}
      width="34rem"
      footer={
        step === 'inFlight' ? (
          <>
            <Button variant="text" onClick={close}>
              {t('flip.cancel')}
            </Button>
            <Button onClick={() => setStep('reason')} data-flip-continue="">
              {t('flip.continue')}
            </Button>
          </>
        ) : (
          <>
            {firstFlipStep(target) === 'inFlight' && (
              <Button variant="text" disabled={flip.isPending} onClick={() => setStep('inFlight')} data-flip-back-step="">
                {t('flip.back')}
              </Button>
            )}
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
      <div className="flex flex-col gap-3 text-sm" data-flip-dialog={row.storeCode} data-flip-step={step}>
        {step === 'inFlight' ? (
          <InFlightStep storeCode={row.storeCode} />
        ) : (
          <>
            <p data-flip-shift-open="">{t('flip.shiftOpen')}</p>
            <div className="flex flex-col gap-1">
              <label htmlFor={reasonId} className="text-xs font-medium text-muted-foreground">
                {t('flip.reason')}
              </label>
              <textarea
                id={reasonId}
                className={`${RULE_INPUT} h-auto min-h-20 py-1.5`}
                value={reason}
                onChange={(e) => {
                  setReason(e.target.value)
                  // A refusal answered the reason as it was; an edited one has not been asked yet.
                  if (flip.isError) flip.reset()
                }}
                required
                aria-invalid={missing}
                aria-describedby={missing ? `${reasonId}-error` : undefined}
                data-flip-reason=""
              />
              {missing && (
                <p id={`${reasonId}-error`} className="text-xs text-danger-800" data-flip-reason-required="">
                  {t('flip.reasonRequired')}
                </p>
              )}
            </div>
            {flip.isError && (
              <div data-flip-refusal="">
                <ErrorBanner className="p-2.5" title={t('flip.refusedTitle')} message={apiErrorMessage(flip.error, t('flip.refused'))}>
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

/** HQ's in-flight warning for a flip back. It informs; it never blocks. */
function InFlightStep({ storeCode }: { storeCode: string }) {
  const { t } = useTranslation('engine-switch')
  const inFlight = useQuery(storeInFlightQuery(storeCode))

  if (inFlight.isPending) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground" data-in-flight-loading="">
        <Loader2 className="size-3.5 animate-spin" aria-hidden />
        {t('inFlight.loading')}
      </p>
    )
  }
  if (inFlight.isError) {
    return (
      <div data-in-flight-failed="">
        <ErrorBanner className="p-2.5" title={t('inFlight.failedTitle')} message={apiErrorMessage(inFlight.error, t('inFlight.failed'))} />
        <p className="mt-2 text-muted-foreground">{t('inFlight.failedNeverBlocks')}</p>
      </div>
    )
  }
  const w = inFlight.data
  const n = inFlightCount(w)
  if (n === 0) {
    return (
      <p data-in-flight-none="">{t('inFlight.none')}</p>
    )
  }
  return (
    <div className="flex flex-col gap-3" data-in-flight={n}>
      <div className="rounded-lg border border-attention-border bg-attention-050 p-3 text-xs text-attention-800" role="status">
        <Trans t={t} i18nKey="inFlight.lede" count={n} values={{ n }} components={{ n: <Ltr /> }} />
      </div>
      <InFlightList kind="liveCampaigns" w={w}>
        {w.liveCampaigns.map((c) => (
          <li key={c.code} className="flex gap-2" data-in-flight-item={c.code}>
            <code className="font-mono font-semibold">
              <Ltr>{c.code}</Ltr>
            </code>
            <SaysBoth says={c.name} />
          </li>
        ))}
      </InFlightList>
      <InFlightList kind="openSessions" w={w}>
        {w.openSessions.map((s) => (
          <li key={s.saleId} className="flex gap-2" data-in-flight-item={s.saleId}>
            <code className="font-mono font-semibold">
              <Ltr>{s.saleId}</Ltr>
            </code>
            <span className="text-muted-foreground">
              <Trans t={t} i18nKey="inFlight.openedAt" values={{ at: formatDateTime(s.created) }} components={{ v: <Ltr /> }} />
            </span>
          </li>
        ))}
      </InFlightList>
      <InFlightList kind="budgets" w={w}>
        {w.budgets.map((b, i) => (
          <li key={i} className="flex gap-2" data-in-flight-item={b.campaignCode}>
            <code className="font-mono font-semibold">
              <Ltr>{b.campaignCode}</Ltr>
            </code>
            <bdi>{b.budget}</bdi>
          </li>
        ))}
      </InFlightList>
    </div>
  )
}

function InFlightList({ kind, w, children }: { kind: keyof StoreEngineInFlight; w: StoreEngineInFlight; children: ReactNode }) {
  const { t } = useTranslation('engine-switch')
  return (
    <section className="flex flex-col gap-1 text-xs" data-in-flight-list={kind} data-in-flight-count={w[kind].length}>
      <h3 className="font-semibold">{t(`inFlight.${kind}`)}</h3>
      {w[kind].length === 0 ? <p className="text-muted-foreground">{t('inFlight.noneOfThese')}</p> : <ul className="flex flex-col gap-1">{children}</ul>}
    </section>
  )
}
