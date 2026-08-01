import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, FilePlus2, Loader2, ShieldAlert, TriangleAlert } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { NPHIES_ACCESS_KEY, nphiesAccessApi } from '@/core/nphies/api'
import { eligibilityApi } from './api'
import CheckResult from './CheckResult'
import CoverageList from './CoverageList'
import { formatStamp } from '@/core/nphies/format'
import {
  coveragePickerIsShown,
  raiseAuthorizationHref,
  raiseBlockers,
  resolveCoveragePick,
} from './coverage-choice'

/**
 * One eligibility response, as its own page (ticket 213, spec 209 stories 9 and
 * 18–23) — and the seam out of it.
 *
 * **A route, not a modal.** No modal opens anywhere in this feature: the detail
 * must survive a refresh and be linkable, which is half the reason the seam to the
 * authorization form is a URL as well.
 *
 * The page's one decision is **which policy an authorization is raised under**,
 * and it is keyed on the count rather than on in-force: exactly one is
 * auto-selected (a lone expired one included — the Verdict says what it is), two
 * or more force a pick with no default. The rule itself is the pure
 * `./coverage-choice`; this file is the controlled shell over it, which is what
 * makes it testable with no React Testing Library in the repo.
 *
 * **Raise authorization** navigates to `/nphies/authorizations/new` carrying the
 * eligibility id and the chosen member id. That route lands in 217; the seam is
 * built here, pointing at it.
 */
export default function EligibilityDetailPage() {
  const { t } = useTranslation('eligibility')
  const { id = '' } = useParams<{ id: string }>()

  // The area's ONE probe, on the key the nav leaf and both other screens share →
  // one network call for the whole area. Fails closed: pending and errored both
  // draw something other than the response.
  const access = useQuery({
    queryKey: NPHIES_ACCESS_KEY,
    queryFn: () => nphiesAccessApi.access(),
  })
  const allowed = access.data?.canOpenNphies === true

  const detail = useQuery({
    queryKey: ['nphies', 'eligibility', 'response', id],
    queryFn: () => eligibilityApi.response(id),
    enabled: allowed && id !== '',
    // 🚩 No `refetchInterval` (spec 209 §6): a stored response does not change,
    // and the service's own worker is what polls the exchange.
  })

  // What the agent has clicked, which is NOT the selection — `resolveCoveragePick`
  // is. A lone coverage is selected with this still null, and an out-of-range
  // index (a stale click after a refetch) resolves to no pick rather than to
  // somebody's other policy.
  //
  // 🚩 **It is stamped with the response it was made on.** Nothing today links
  // one detail straight to another, so every arrival here is a remount and the
  // state starts empty either way — but the moment such a link exists (a
  // patient's other checks, a "next" control) the id would change under a mounted
  // component, and a bare index that happened to be in range would silently
  // select one of the NEXT patient's policies, with no click and no prompt. That
  // is this ticket's own failure mode, produced by the screen itself, and it
  // costs one comparison to make unreachable rather than to remember later.
  const [picked, setPicked] = useState<{ id: string; index: number } | null>(null)
  const pickedHere = picked && picked.id === id ? picked.index : null

  const response = detail.data
  const coverages = useMemo(() => response?.coverages ?? [], [response])
  const pick = resolveCoveragePick(coverages, pickedHere)
  const blockers = raiseBlockers(coverages, pick)
  const href = raiseAuthorizationHref(id, pick.memberId)
  // One sentence, read twice: under the coverages and as the withheld action's
  // own reason on hover/focus, so the two can never drift apart.
  const blockerSentence = blockers.map((b) => t(`raise.blockers.${b}`)).join(t('blockers.separator'))

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
    // The in-page backstop behind the hidden nav leaf, distinguishing the two
    // reasons: an unreachable probe is a retry, a refused one is an
    // administrator. Same rule as the list and the check form.
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

  return (
    <section className="flex w-full flex-col gap-4">
      <header className="flex flex-col gap-1">
        <Link
          to="/nphies/eligibility"
          className="inline-flex w-fit items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
        >
          {/* Logical: rtl:rotate-180 mirrors the arrow with the text direction. */}
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
          {t('detail.backToList')}
        </Link>
        <h1 className="text-lg font-semibold tracking-tight">{t('detail.title')}</h1>
        <p className="text-sm text-muted-foreground">{t('detail.subtitle')}</p>
      </header>

      {detail.isError && (
        <ErrorBanner
          title={t('errors.detailTitle')}
          message={apiErrorMessage(detail.error, t('errors.detailFailed'))}
          className="p-3"
        />
      )}

      {detail.isPending && (
        <div className="flex flex-col gap-2" role="status" aria-label={t('detail.loading')}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-8 animate-pulse rounded-md bg-muted" />
          ))}
        </div>
      )}

      {response && (
        <>
          {/* Who was asked about, and as whom. Read-only values rather than
              disabled controls (spec 209 story 24): this is a record of what was
              asked, and nothing on this page edits it. */}
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 rounded-lg border border-border/60 bg-card/40 p-4 sm:grid-cols-3 lg:grid-cols-4">
            <Fact label={t('form.patientName')} value={response.patientName} />
            <Fact label={t('form.patientId')} value={response.patientId} />
            <Fact label={t('form.payer')} value={response.payerCode} />
            <Fact label={t('form.provider')} value={response.providerCode} />
            <Fact label={t('detail.checkedAt')} value={formatStamp(response.actionDateTime)} />
          </dl>

          {/* The same two axes, from the same shared derivation, as the check
              result and the list — one vocabulary, not three. The coverages are
              suppressed here because they are the picker below. */}
          <CheckResult response={response} coverages={false} />

          <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-sm font-semibold tracking-tight">
                {t('result.coverages', { count: coverages.length })}
              </h2>
              {/* 🚩 The prompt appears only when there is genuinely a choice.
                  One coverage is selected silently — the 99% case costs no
                  click — and saying "choose one" over a single row would be
                  asking for a decision that has already been made. */}
              {coveragePickerIsShown(coverages) && (
                <span className="text-xs text-muted-foreground">{t('raise.pickPrompt')}</span>
              )}
            </div>

            <CoverageList
              coverages={coverages}
              pick={pick.index}
              // Selectable only when there is something to select between: a lone
              // coverage renders read-only because its selection is not the
              // agent's to give.
              onPick={
                coveragePickerIsShown(coverages)
                  ? (index) => setPicked({ id, index })
                  : undefined
              }
            />

            {blockers.length > 0 && (
              <div
                role="status"
                className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-[0.8125rem] text-attention-800"
              >
                <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
                <span>
                  {t('raise.blockers.intro')} {blockerSentence}
                </span>
              </div>
            )}

            <div>
              {/* The seam. A real link when it is live — right-clickable,
                  copyable, and the whole reason the authorization form is
                  addressed by ids rather than handed an object.

                  🚩 Withheld as a `<span>` with `aria-disabled` rather than a
                  dead `<a>`: a link that navigates nowhere is worse than one that
                  states why it will not. It stays focusable so it can say so
                  (`@/core/ui/Button`'s rule). */}
              {href && blockers.length === 0 ? (
                <Link
                  to={href}
                  className="inline-flex h-9 w-fit items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  <FilePlus2 className="h-3.5 w-3.5" aria-hidden />
                  {t('raise.action')}
                </Link>
              ) : (
                <span
                  role="link"
                  aria-disabled="true"
                  tabIndex={0}
                  title={blockerSentence}
                  className="inline-flex h-9 w-fit cursor-not-allowed items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground opacity-50"
                >
                  <FilePlus2 className="h-3.5 w-3.5" aria-hidden />
                  {t('raise.action')}
                </span>
              )}
            </div>
          </section>
        </>
      )}
    </section>
  )
}

/** One read-only fact. A value, not a disabled control (spec 209 story 24). */
function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
      <dd className="text-sm text-foreground">{value}</dd>
    </div>
  )
}
