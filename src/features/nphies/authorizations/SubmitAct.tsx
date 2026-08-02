import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, Clock, Loader2, ShieldAlert, TriangleAlert } from 'lucide-react'

import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  SUBMIT_TIMEOUT_SECONDS,
  blockerLabel,
  type ClinicalEditGate,
  type SubmitBlocker,
  type SubmitLanding,
} from './submit-gate'

/**
 * **Submit, as a gated path** (ticket 220, spec 209 stories 57–63, contract v1.0
 * §3.5 / §3.7 / §7.3).
 *
 * Four surfaces in the order the agent meets them, all inline on the same
 * scrolling page — 🚩 **no modal opens anywhere in this flow**, including the
 * clinical-edit gate, which the ticket calls a dialog and which the spec's own
 * ruling makes a panel. It is still *one surface in two shapes*: the fatal one is
 * the warning one with the confirm button removed.
 *
 * 1. **The blockers** — every reason Submit is unavailable, each naming itself.
 * 2. **The gate** — what the clinical-edit check found, and whether it may be
 *    overridden.
 * 3. **The wait** — 🚩 visibly working for its full window (story 63), with the
 *    elapsed time and the window stated, because an agent who gives up on a slow
 *    submission is an agent about to raise a second authorization.
 * 4. **The landing** — lodged, refused, or in flight. 🚩 **In flight is never
 *    failed** and offers exactly one act: a status check. Submit does not come
 *    back.
 */
export default function SubmitAct({
  blockers,
  gate,
  landing,
  submitting,
  elapsedSeconds,
  checking,
  headerReasons,
  refusalCount,
  patientId,
  disabled,
  onSubmit,
  onConfirm,
  onBackToForm,
}: {
  /** Every reason Submit is unavailable, from the one module that states them. */
  blockers: SubmitBlocker[]
  /** The clinical-edit answer, once it has come back. `null` before it is asked. */
  gate: ClinicalEditGate | null
  /** Where the submission left the agent. `null` until one has answered. */
  landing: SubmitLanding | null
  /** The submit leg is open. */
  submitting: boolean
  /** How long it has been open, in whole seconds. */
  elapsedSeconds: number
  /** The clinical-edit check is in flight. */
  checking: boolean
  /** Refusal reasons that belong to no row — the header-only case (§3.9). */
  headerReasons: string[]
  /** How many reasons the refusal carried in total, including the placed ones. */
  refusalCount: number
  /** Named in the in-flight sentence, because the agent has to find the row on
   *  the list and the patient id is what they will look for. */
  patientId: string
  disabled: boolean
  onSubmit: () => void
  /** **Submit anyway** — offered on a warning only. */
  onConfirm: () => void
  /** Back to the form: dismiss the gate and change something. */
  onBackToForm: () => void
}) {
  const { t } = useTranslation('authorizations')

  // 🚩 Lodged. The transaction is closed and the agent's next step is the
  // authorization itself — the page navigates there, and this panel is what the
  // transition renders over and what stands if the navigation does not happen.
  if (landing?.kind === 'submitted') {
    return (
      <section
        role="status"
        className="flex flex-col gap-2 rounded-lg border border-success-border bg-success-050 p-4 text-sm text-success-800"
      >
        <div className="flex items-center gap-2 font-medium">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          {t('form.submit.lodged.title')}
        </div>
        <p>{t('form.submit.lodged.detail', { preAuthRef: landing.preAuthRef })}</p>
        <div>
          <Link
            to={`/nphies/authorizations/${encodeURIComponent(landing.authId)}`}
            className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
          >
            {t('form.submit.lodged.openDetail')}
          </Link>
        </div>
      </section>
    )
  }

  // 🚩 **In flight, never failed** (law 6). The window elapsed and the request
  // may well be with the payer, so the one act offered is a status check on the
  // list — and Submit is gone, not merely disabled, because an enabled-looking
  // button here is how a second authorization gets raised for a request that
  // already reached a national exchange.
  if (landing?.kind === 'inFlight') {
    return (
      <section
        role="status"
        className="flex flex-col gap-2 rounded-lg border border-attention-border bg-attention-050 p-4 text-sm text-attention-800"
      >
        <div className="flex items-center gap-2 font-medium">
          <Clock className="h-4 w-4 shrink-0" aria-hidden />
          {t('form.submit.inFlight.title')}
        </div>
        <p>{t('form.submit.inFlight.detail', { seconds: SUBMIT_TIMEOUT_SECONDS })}</p>
        <p className="font-medium">{t('form.submit.inFlight.neverResubmit')}</p>
        {/* The list holds its filters in page state and reads none from the URL,
            so the link goes to the list and the patient is named in words rather
            than promised as a filter the destination would not apply. */}
        <p>{t('form.submit.inFlight.find', { patientId })}</p>
        <div>
          <Link
            to="/nphies/authorizations"
            className="inline-flex h-8 items-center rounded-full border border-border bg-background px-3 text-xs font-medium hover:bg-accent"
          >
            {t('form.submit.inFlight.statusCheck')}
          </Link>
        </div>
      </section>
    )
  }

  return (
    <section className="flex flex-col gap-3">
      {/* 🚩 Every reason Submit is unavailable, listed. A live region so a reason
          that appears while the agent is elsewhere on the page is announced, and
          a real list inside it so the count and the item boundaries survive. */}
      {blockers.length > 0 && (
        <div role="status">
          <p className="text-xs font-medium text-muted-foreground">
            {t('form.submit.blockers.intro', { count: blockers.length })}
          </p>
          <ul className="mt-1 flex flex-col gap-1 text-xs text-attention-800">
            {blockers.map((blocker) => {
              const label = blockerLabel(blocker)
              return (
                <li key={blocker.source + blocker.code} className="flex items-start gap-2">
                  <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{label.kind === 'key' ? t(label.key, label.params) : label.text}</span>
                </li>
              )
            })}
          </ul>
        </div>
      )}

      {/* 🚩 **A refused submit keeps the agent on the form.** `Failed` is not a
          transport blip — the request was refused before the payer saw it and is
          fixable here. The reasons that name a row are drawn ON that row; these
          are the ones that name none, which is the header-only case where the
          service's guards threw before a single line was built. */}
      {landing?.kind === 'refused' && (
        <ErrorBanner
          title={t('form.submit.refused.title')}
          message={t('form.submit.refused.detail', { count: refusalCount })}
          className="p-3"
        >
          {headerReasons.length > 0 && (
            <ul className="mt-2 flex list-disc flex-col gap-1 ps-4 text-xs">
              {headerReasons.map((reason, index) => (
                <li key={index}>{reason}</li>
              ))}
            </ul>
          )}
          {refusalCount > headerReasons.length && (
            <p className="mt-2 text-xs">{t('form.submit.refused.onTheRows')}</p>
          )}
        </ErrorBanner>
      )}

      {/* §6 kind 2 — a guardrail refusal that never left SIS.Api. Its own words,
          server-supplied, passed through as data. */}
      {landing?.kind === 'blocked' && (
        <ErrorBanner
          title={t('form.submit.blocked.title')}
          message={landing.message ?? t('form.submit.blocked.detail')}
          className="p-3"
        />
      )}

      {/* 🚩 **The clinical-edit gate — one surface, two shapes.** The list is
          identical; the fatal shape simply has no confirm button. */}
      {gate && gate.shape !== 'clear' && (
        <section
          role="group"
          aria-label={t(
            gate.overridable ? 'form.submit.clinicalEdit.warningTitle' : 'form.submit.clinicalEdit.fatalTitle',
          )}
          className={
            'flex flex-col gap-3 rounded-lg border p-4 text-sm ' +
            (gate.overridable
              ? 'border-attention-border bg-attention-050 text-attention-800'
              : 'border-danger-border bg-danger-050 text-danger-800')
          }
        >
          <div className="flex items-center gap-2 font-medium">
            <ShieldAlert className="h-4 w-4 shrink-0" aria-hidden />
            {t(
              gate.overridable
                ? 'form.submit.clinicalEdit.warningTitle'
                : 'form.submit.clinicalEdit.fatalTitle',
            )}
          </div>
          <p className="text-xs">
            {t(
              gate.overridable
                ? 'form.submit.clinicalEdit.warningDetail'
                : 'form.submit.clinicalEdit.fatalDetail',
            )}
          </p>
          {/* The findings, in the service's own words (§6: server text is data). */}
          <ul className="flex list-disc flex-col gap-1 ps-4 text-xs">
            {gate.findings.map((finding, index) => (
              <li key={index}>{finding.message}</li>
            ))}
          </ul>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" disabled={submitting} onClick={onBackToForm}>
              {t('form.submit.clinicalEdit.backToForm')}
            </Button>
            {/* 🚩 The one difference between the two shapes. A fatal restriction
                is not overridable, so the button does not exist — it is never
                merely disabled, which would read as "ask someone for the right". */}
            {gate.overridable && (
              <Button variant="primary" disabled={submitting || disabled} onClick={onConfirm}>
                {t('form.submit.clinicalEdit.submitAnyway')}
              </Button>
            )}
          </div>
        </section>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="primary"
          disabled={disabled || submitting || checking || blockers.length > 0}
          onClick={onSubmit}
        >
          {t('form.submit.action')}
        </Button>

        {checking && (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('form.submit.checking')}
          </span>
        )}

        {/* 🚩 **Visibly working for its full window** (story 63). A submission is
            synchronous at 100 s by design; an agent watching a still screen for
            ninety of them concludes it has died. */}
        {submitting && (
          <span className="inline-flex items-center gap-2 text-xs text-muted-foreground" role="status">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            {t('form.submit.working', {
              seconds: elapsedSeconds,
              window: SUBMIT_TIMEOUT_SECONDS,
            })}
          </span>
        )}
      </div>

      {!submitting && blockers.length === 0 && landing === null && gate === null && (
        <p className="text-xs text-muted-foreground">{t('form.submit.willCheckFirst')}</p>
      )}
    </section>
  )
}
