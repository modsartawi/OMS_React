import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Search, ShieldAlert, TriangleAlert } from 'lucide-react'

import { apiErrorCode, apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  NPHIES_ACCESS_KEY,
  PROVIDERS_KEY,
  nphiesAccessApi,
  nphiesLookupApi,
} from '@/core/nphies/api'
import { eligibilityApi } from './api'
import CheckResult from './CheckResult'
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
    queryFn: () => nphiesLookupApi.providers(),
    enabled: allowed,
  })

  const [draft, setDraft] = useState<CheckDraft>(EMPTY_CHECK_DRAFT)

  const blockers = useMemo(() => checkBlockers(draft), [draft])
  // One sentence, read twice: in the banner and as the withheld Submit's own
  // reason on hover/focus. Built here so the two can never drift apart.
  const blockerSentence = blockers.map((b) => t(`blockers.${b}`)).join(t('blockers.separator'))

  const check = useMutation({
    mutationFn: () => eligibilityApi.check(toCheckRequest(draft)),
  })

  // Fill — a deliberate press, never a side effect of typing an id. A patient
  // with no previous check answers `null`, which is an ordinary outcome and says
  // so rather than reading as a failure.
  //
  // 🚩 The id it asked about travels with the request and is checked again when
  // the answer lands. Without that, an agent who spots a typo and corrects the id
  // while the first read is in flight gets the FIRST patient's name, gender, date
  // of birth and member id written over their correction — and that identity is
  // what would reach the national exchange, under an id they believe they fixed.
  const fill = useMutation({
    mutationFn: (patientId: string) => eligibilityApi.lastEligibility(patientId),
    onSuccess: (last, askedAbout) => {
      if (!last) return
      setDraft((d) => (d.patientId.trim() === askedAbout ? fillFromLastEligibility(d, last) : d))
    },
  })

  /**
   * Every edit to the form, and the one place the previous answer is dropped.
   *
   * A result belongs to the identity it was asked about. Leaving it on screen
   * while the agent types the next patient's id would leave one patient's verdict
   * sitting under another patient's name — the single worst misreading this
   * screen could offer.
   */
  const patch = (next: Partial<CheckDraft>) => {
    check.reset()
    setDraft((d) => ({ ...d, ...next }))
  }

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
    //
    // 🚩 An UNREACHABLE probe fails closed exactly like a refused one — but it
    // says something different. Both hide the screen; only one of them is the
    // agent's grant. Telling someone whose probe 500'd that they lack a
    // permission sends them to an administrator for a problem a retry fixes.
    const unreachable = access.isError
    return (
      <div
        className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center"
        role="alert"
      >
        <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
        <div className="text-base font-semibold tracking-tight">
          {unreachable ? t('access.unreachableTitle') : t('access.deniedTitle')}
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {unreachable
            ? apiErrorMessage(access.error, t('access.unreachableHint'))
            : t('access.deniedHint')}
        </p>
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
          // 🚩 `isPending` is guarded HERE, not only on the button: Enter inside
          // any text input submits the form, and a second act while the first is
          // in flight is a second real request at a national exchange — two
          // records for one question the agent asked once.
          if (blockers.length === 0 && !check.isPending) check.mutate()
        }}
      >
        {/* Who we are asking as, and who we are asking. */}
        <div className="flex flex-wrap items-end gap-3">
          <Field label={t('form.provider')}>
            <select
              value={draft.providerCode}
              onChange={(e) => patch({ providerCode: e.target.value })}
              aria-label={t('form.provider')}
              className={`w-56 ${CONTROL}`}
            >
              {/* No default and no memory: the empty option is the state the form
                  opens in and the one the gate below refuses to submit from. */}
              <option value="">{t('form.providerUnchosen')}</option>
              {(providers.data ?? []).map((p) => (
                <option key={p.providerCode} value={p.providerCode}>
                  {t('form.providerOption', { code: p.providerCode, license: p.license })}
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
              className={`w-40 ${CONTROL}`}
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
                className={`w-44 ${CONTROL}`}
              />
              <button
                type="button"
                onClick={() => fill.mutate(draft.patientId.trim())}
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
              className={`w-44 ${CONTROL}`}
            >
              {/* Unchosen, like the provider: an ID type nobody picked still
                  reaches the exchange inside the FHIR Patient. */}
              <option value="">{t('form.unchosen')}</option>
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
              className={`w-64 ${CONTROL}`}
            />
          </Field>
          <Field label={t('form.patientGender')}>
            <select
              value={draft.patientGender}
              onChange={(e) => patch({ patientGender: e.target.value })}
              aria-label={t('form.patientGender')}
              className={`w-32 ${CONTROL}`}
            >
              <option value="">{t('form.unchosen')}</option>
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
              className={`w-44 ${CONTROL}`}
            />
          </Field>
          <Field label={t('form.memberId')}>
            <input
              type="text"
              value={draft.memberId}
              onChange={(e) => patch({ memberId: e.target.value })}
              aria-label={t('form.memberId')}
              className={`w-40 ${CONTROL}`}
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
              className={`w-40 ${CONTROL}`}
            />
          </Field>
          <Field label={t('form.maritalStatus')}>
            <input
              type="text"
              value={draft.maritalStatus}
              onChange={(e) => patch({ maritalStatus: e.target.value })}
              aria-label={t('form.maritalStatus')}
              className={`w-40 ${CONTROL}`}
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
              {t('blockers.intro')} {blockerSentence}
            </span>
          </div>
        )}

        <div>
          {/* 🚩 `aria-disabled`, not `disabled`, while the gate holds — a command
              withheld WITH a reason must stay focusable to be able to state it
              (`@/core/ui/Button`'s own note). The form's `onSubmit` is the
              enforcement; this is only how it reads. `disabled` is honest for
              the in-flight case, where the reason is visible as a spinner. */}
          <button
            type="submit"
            aria-disabled={blockers.length > 0}
            disabled={check.isPending}
            title={blockers.length > 0 ? blockerSentence : undefined}
            className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50 aria-disabled:cursor-not-allowed aria-disabled:opacity-50 aria-disabled:hover:bg-primary"
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
        <>
          <ErrorBanner
            title={t('errors.checkTitle')}
            message={apiErrorMessage(check.error, t('errors.checkFailed'))}
            className="p-3"
          />
          {/* The code is what the client BRANCHES on (api-envelope rule), not
              something to show an agent: each of §6's reachable refusals names
              the control that fixes it. The server's own sentence stays above as
              the message — it is data, and it says what happened. */}
          {remedyKey(apiErrorCode(check.error)) && (
            <p className="text-sm text-muted-foreground">{t(remedyKey(apiErrorCode(check.error))!)}</p>
          )}
        </>
      )}

      {check.data && <CheckResult response={check.data} />}
    </section>
  )
}

/**
 * A refusal's machine code → the remedy key that names the control to fix
 * (contract §6: `apiErrorCode()` is how the client branches). Only the codes
 * this act can actually answer with are here; an unlisted code renders the
 * server's message alone rather than an invented instruction.
 */
const REMEDY_KEYS: Record<string, string> = {
  PROVIDER_NOT_CONFIGURED: 'errors.remedy.provider',
  PAYER_NOT_CONFIGURED: 'errors.remedy.payer',
  NPHIES_NOT_GRANTED: 'errors.remedy.notGranted',
}
const remedyKey = (code: string | null) => (code ? (REMEDY_KEYS[code] ?? null) : null)

/**
 * The control chrome, spelled once. Every input and select on this form is the
 * same height, border and focus ring and differs only in width — so the string
 * lives here rather than eight times, where one edit would drift.
 */
const CONTROL =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/** A labelled control. One shape for every field on the form. */
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}

