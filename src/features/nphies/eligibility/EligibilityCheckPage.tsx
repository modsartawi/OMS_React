import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search, ShieldAlert, TriangleAlert } from 'lucide-react'

import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import StatusBadge from '@/core/ui/StatusBadge'
import { NPHIES_ACCESS_KEY, nphiesAccessApi } from '@/core/nphies/api'
import {
  deriveEligibilityAxes,
  eligibilityVerdictSeverity,
  requestSeverity,
  showsFailureMessage,
  verdictCellKeys,
} from '@/core/nphies/status'
import type { EligibilityCheckResponse } from '@/core/models/nphies'
import { PROVIDERS_KEY, eligibilityApi } from './api'
import {
  EMPTY_CHECK_DRAFT,
  checkBlockers,
  fillFromLastEligibility,
  toCheckRequest,
  type CheckDraft,
} from './check-form'

/**
 * The eligibility check form (ticket 211, spec 209) — slice 0 of the Nphies area
 * and the tracer through its whole spine: area → namespace → route → nav →
 * access probe → envelope → model → render.
 *
 * Three things it does that the till's dialog does not. **The provider is a free
 * per-act pick** with no default and no memory, and submit is held until one is
 * chosen — visibly, on the form, rather than as a refusal from a national
 * exchange. **Fill works on a cold form**, from a patient id alone. And the
 * answer arrives as **two axes** — Request (did we get an answer) and Verdict
 * (what they said, blank until Complete), with site eligibility folded into the
 * verdict inline at result time rather than surfacing later when a button
 * refuses.
 *
 * No claim-type or request-type selector exists anywhere: v1 is one of each, both
 * pinned server-side.
 *
 * Every derivation is in a pure module (`@/core/nphies/status`, `./check-form`);
 * this file is the controlled shell over them, which is what makes the rules
 * testable with no React Testing Library in the repo.
 */
export default function EligibilityCheckPage() {
  const { t } = useTranslation('eligibility')

  // The area's ONE probe, on the same key the nav leaf uses → one network call.
  // Fails closed: pending and errored both draw something other than the form.
  const access = useQuery({
    queryKey: NPHIES_ACCESS_KEY,
    queryFn: () => nphiesAccessApi.access(),
  })
  const allowed = access.data?.canOpenNphies === true

  const providers = useQuery({
    queryKey: PROVIDERS_KEY,
    queryFn: () => eligibilityApi.providers(),
    enabled: allowed,
  })

  const [draft, setDraft] = useState<CheckDraft>(EMPTY_CHECK_DRAFT)
  const patch = (next: Partial<CheckDraft>) => setDraft((d) => ({ ...d, ...next }))

  const blockers = useMemo(() => checkBlockers(draft), [draft])

  // Fill — a deliberate press, never a side effect of typing an id. A patient
  // with no previous check answers `null`, which is an ordinary outcome and says
  // so rather than reading as a failure.
  const fill = useMutation({
    mutationFn: () => eligibilityApi.lastEligibility(draft.patientId.trim()),
    onSuccess: (last) => {
      if (last) setDraft((d) => fillFromLastEligibility(d, last))
    },
  })

  const check = useMutation({
    mutationFn: () => eligibilityApi.check(toCheckRequest(draft)),
  })

  if (access.isPending) {
    return (
      <div
        className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground"
        role="status"
      >
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }
  if (!allowed) {
    // The in-page backstop behind the hidden nav leaf: a direct URL refuses
    // cleanly rather than landing on a screen whose every call would fail.
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
      >
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">{t('access.deniedTitle')}</div>
        <p className="mt-2 text-sm text-muted-foreground">{t('access.deniedHint')}</p>
      </div>
    )
  }

  const fillMissed = fill.isSuccess && fill.data === null

  return (
    <section className="flex w-full flex-col gap-4">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('subtitle')}</p>
      </header>

      <form
        className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/40 p-4"
        onSubmit={(e) => {
          e.preventDefault()
          if (blockers.length === 0) check.mutate()
        }}
      >
        {/* Who we are asking as, and who we are asking. */}
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('form.provider')}>
            <select
              value={draft.providerCode}
              onChange={(e) => patch({ providerCode: e.target.value })}
              aria-label={t('form.provider')}
              className="h-9 w-56 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            >
              {/* No default and no memory: the empty option is the state the form
                  opens in and the one the gate below refuses to submit from. */}
              <option value="">{t('form.providerUnchosen')}</option>
              {(providers.data ?? []).map((p) => (
                <option key={p.providerCode} value={p.providerCode}>
                  {p.providerCode} — {p.license}
                </option>
              ))}
            </select>
          </Field>
          <Field label={t('form.payer')}>
            <input
              type="text"
              value={draft.payerCode}
              onChange={(e) => patch({ payerCode: e.target.value })}
              aria-label={t('form.payer')}
              className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </Field>
        </div>

        {providers.isError && (
          <ErrorBanner
            message={apiErrorMessage(providers.error, t('errors.providersFailed'))}
            className="p-3"
          />
        )}

        {/* The identity block — typed once, or completed by Fill from the last check. */}
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('form.patientId')}>
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={draft.patientId}
                onChange={(e) => patch({ patientId: e.target.value })}
                aria-label={t('form.patientId')}
                className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => fill.mutate()}
                disabled={draft.patientId.trim() === '' || fill.isPending}
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50"
              >
                {fill.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                ) : (
                  <Search className="h-3.5 w-3.5" aria-hidden />
                )}
                {t('form.fill')}
              </button>
            </div>
          </Field>
          <Field label={t('form.patientIdType')}>
            <select
              value={draft.patientIdType}
              onChange={(e) => patch({ patientIdType: e.target.value })}
              aria-label={t('form.patientIdType')}
              className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            >
              <option value="NI">{t('idType.NI')}</option>
              <option value="PRC">{t('idType.PRC')}</option>
              <option value="PN">{t('idType.PN')}</option>
              <option value="Other">{t('idType.Other')}</option>
            </select>
          </Field>
          <Field label={t('form.patientName')}>
            <input
              type="text"
              value={draft.patientName}
              onChange={(e) => patch({ patientName: e.target.value })}
              aria-label={t('form.patientName')}
              className="h-9 w-64 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </Field>
          <Field label={t('form.patientGender')}>
            <select
              value={draft.patientGender}
              onChange={(e) => patch({ patientGender: e.target.value })}
              aria-label={t('form.patientGender')}
              className="h-9 w-32 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            >
              <option value="male">{t('gender.male')}</option>
              <option value="female">{t('gender.female')}</option>
            </select>
          </Field>
          <Field label={t('form.patientBirthDate')}>
            <input
              type="date"
              value={draft.patientBirthDate}
              onChange={(e) => patch({ patientBirthDate: e.target.value })}
              aria-label={t('form.patientBirthDate')}
              className="h-9 w-44 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </Field>
          <Field label={t('form.memberId')}>
            <input
              type="text"
              value={draft.memberId}
              onChange={(e) => patch({ memberId: e.target.value })}
              aria-label={t('form.memberId')}
              className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-end gap-4">
          <Field label={t('form.occupation')}>
            <input
              type="text"
              value={draft.occupation}
              onChange={(e) => patch({ occupation: e.target.value })}
              aria-label={t('form.occupation')}
              className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </Field>
          <Field label={t('form.maritalStatus')}>
            <input
              type="text"
              value={draft.maritalStatus}
              onChange={(e) => patch({ maritalStatus: e.target.value })}
              aria-label={t('form.maritalStatus')}
              className="h-9 w-40 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            />
          </Field>
          <label className="flex select-none items-center gap-1.5 pb-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={draft.transfer}
              onChange={(e) => patch({ transfer: e.target.checked })}
              className="h-4 w-4 rounded border-border/60 accent-primary"
            />
            {t('form.transfer')}
          </label>
          <label className="flex select-none items-center gap-1.5 pb-2 text-xs font-medium text-muted-foreground">
            <input
              type="checkbox"
              checked={draft.newborn}
              onChange={(e) => patch({ newborn: e.target.checked })}
              className="h-4 w-4 rounded border-border/60 accent-primary"
            />
            {t('form.newborn')}
          </label>
        </div>

        {fillMissed && (
          <p role="status" className="text-sm text-muted-foreground">
            {t('form.fillNoPreviousCheck')}
          </p>
        )}
        {fill.isError && (
          <ErrorBanner
            message={apiErrorMessage(fill.error, t('errors.fillFailed'))}
            className="p-3"
          />
        )}

        {/* The gate, stated where it applies: every unmet condition named, with
            Submit held until none is left. */}
        {blockers.length > 0 && (
          <div
            role="status"
            className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
          >
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            <span>
              {t('blockers.intro')}{' '}
              {blockers.map((b) => t(`blockers.${b}`)).join(t('blockers.separator'))}
            </span>
          </div>
        )}

        <div>
          <button
            type="submit"
            disabled={blockers.length > 0 || check.isPending}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {check.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
            {t('form.submit')}
          </button>
        </div>
      </form>

      {/* A guardrail refusal explains itself from the server's own message + code
          (PROVIDER_NOT_CONFIGURED, PAYER_NOT_CONFIGURED); only a transport
          failure reads as "unexpected". A payer saying no never lands here — it
          is a 200 and renders below as the answer it is. */}
      {check.isError && (
        <ErrorBanner
          title={t('errors.checkTitle')}
          message={apiErrorMessage(check.error, t('errors.checkFailed'))}
          className="p-3"
        />
      )}
      {check.isError && apiErrorCode(check.error) && (
        <p className="text-xs text-muted-foreground">
          {t('errors.code', { code: apiErrorCode(check.error) })}
        </p>
      )}

      {check.data && <CheckResult response={check.data} />}
    </section>
  )
}

/** A labelled control. One shape for every field on the form. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

/**
 * The answer, in two axes.
 *
 * 🚩 The Verdict is ONE cell. Site eligibility is rendered inside the same badge
 * as the verdict it qualifies — "Eligible · outside network" — because an agent
 * who reads a verdict and learns about the network later has learned it too late
 * (§3.1). The keys come from `verdictCellKeys`, so the decision about what that
 * cell contains is not made here.
 */
function CheckResult({ response }: { response: EligibilityCheckResponse }) {
  const { t } = useTranslation('eligibility')
  const axes = deriveEligibilityAxes(response)
  const cell = verdictCellKeys(axes)

  return (
    <section className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4">
      <div className="flex flex-wrap items-center gap-6">
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('result.request')}</span>
          <StatusBadge sev={requestSeverity(axes.request)}>
            {t(`request.${axes.request}`)}
          </StatusBadge>
        </div>
        <div className="flex flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">{t('result.verdict')}</span>
          {axes.verdict ? (
            <StatusBadge sev={eligibilityVerdictSeverity(axes.verdict)}>
              {cell.map((key) => t(key)).join(' · ')}
            </StatusBadge>
          ) : (
            // Blank until Complete — the honest rendering of "nothing to report
            // yet", and never an implied refusal.
            <span className="text-sm text-muted-foreground" aria-label={t('result.verdictBlank')}>
              —
            </span>
          )}
        </div>
      </div>

      {/* The dual-meaning field, read in exactly one branch and labelled for it. */}
      {showsFailureMessage(axes.request) && response.errorMessage && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{t('result.failureLabel')}</div>
          <p className="text-sm text-foreground">{response.errorMessage}</p>
        </div>
      )}

      {axes.verdict === 'notInForce' && response.notInForceReason && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">
            {t('result.notInForceReason')}
          </div>
          <p className="text-sm text-foreground">{response.notInForceReason}</p>
        </div>
      )}

      {axes.request === 'complete' && response.disposition && (
        <div>
          <div className="text-xs font-medium text-muted-foreground">{t('result.disposition')}</div>
          <p className="text-sm text-foreground">{response.disposition}</p>
        </div>
      )}

      {/* Every policy the patient holds. Choosing between them is 213's ticket;
          here they are simply listed under the answer they belong to. */}
      <div>
        <div className="text-xs font-medium text-muted-foreground">
          {t('result.coverages', { count: response.coverages?.length ?? 0 })}
        </div>
        {(response.coverages ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground">{t('result.noCoverages')}</p>
        ) : (
          <ul className="mt-2 flex flex-col gap-2">
            {response.coverages.map((c) => (
              <li
                key={c.id || c.memberId}
                className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-md border border-border/60 p-2 text-sm"
              >
                <span className="font-medium">{c.memberId}</span>
                <StatusBadge sev={c.inForce ? 'ok' : 'mute'}>
                  {c.inForce ? t('coverage.inForce') : t('coverage.notInForce')}
                </StatusBadge>
                <span className="text-muted-foreground">
                  {t('coverage.network', { network: c.network })}
                </span>
                <span className="text-muted-foreground">
                  {t('coverage.plan', { plan: c.coveragePlan })}
                </span>
                <span className="text-muted-foreground">
                  {t('coverage.class', { className: c.coverageClass })}
                </span>
                <span className="text-muted-foreground">
                  {t('coverage.policyHolder', { policyHolder: c.policyHolderName })}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
