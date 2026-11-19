import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, History, Loader2, RotateCcw } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { PatternCaseDetail } from '@/core/models/insurance-patterns'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatRange, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'
import { canOpenPatternCases } from './access'
import { caseKey, patternsApi } from './api'
import CaseMarks from './CaseMarks'
import CaseRouteSection from './CaseRouteSection'
import CaseTimeline from './CaseTimeline'
import { casePath, PATTERNS_PATH } from './paths'
import RevealPatient from './RevealPatient'
import { severitySev, severityText, signalText, statusSev, statusText, unitWords } from './words'
// 924 · the header's block action (its own file and predicate; it renders nothing unless offered)
import CaseBlockAction from './CaseBlockAction'

/**
 * **A pattern case** (oms 922; BackOffice spec 4050, door 4053 — STUBBED, the door is not built): one patient's run of
 * dispenses across our pharmacies, WITHOUT the patient. The route on Google's map, the signals in English and Arabic,
 * the timeline, the marks, a previous clearance of the same patient at the top, and the patient's earlier cases.
 *
 * 🔌 The header holds the case's actions (`pattern-case-actions`): 923's "Show patient" and 924's "Add to blocked-patient
 * list" go there, each behind its own predicate in `./access`. Nothing of the patient is read or held by this page.
 */
export default function PatternCasePage() {
  const { t } = useTranslation('insurance-patterns')
  const { caseId = '' } = useParams()
  return (
    <ScreenGate can={canOpenPatternCases} ns="insurance-patterns" title={t('case.pageTitle')} subtitle={t('case.pageSubtitle')}>
      {/* Keyed by case (review 1): Previous cases, Back and Forward reuse this route for another case, which starts
          afresh — no mark drafted, dialog left open or map refusal of the last case is carried to it (a cached case
          renders at once, so a reused body would post the last case's draft or reason to this one). */}
      <CaseBody key={caseId} caseId={caseId} />
    </ScreenGate>
  )
}

function CaseBody({ caseId }: { caseId: string }) {
  const { t } = useTranslation('insurance-patterns')
  const read = useQuery({ queryKey: caseKey(caseId), queryFn: () => patternsApi.detail(caseId), retry: false })

  const back = (
    <Link to={PATTERNS_PATH} className="inline-flex items-center gap-1 self-start text-sm text-primary underline-offset-2 hover:underline" data-testid="pattern-case-back">
      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      {t('case.back')}
    </Link>
  )

  const detail = read.data
  // The whole screen says the case could not be read only when nothing of it was ever read (review 7).
  if (!detail && read.isError)
    return (
      <div className="flex flex-col gap-3">
        {back}
        <ErrorBanner title={t('case.failed')} message={apiErrorMessage(read.error, t('case.failed'))} className="p-3" />
      </div>
    )
  if (!detail)
    return (
      <div className="flex flex-col gap-3">
        {back}
        <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('case.reading')}
        </p>
      </div>
    )

  return (
    <div className="flex flex-col gap-3" data-testid="pattern-case" data-case={detail.caseId} data-status={detail.status}>
      {back}
      {/* A failed re-read (after a mark, a block) keeps the case as last read, says so, and offers to read it again. */}
      {read.isError && (
        <div data-testid="pattern-case-stale">
          <ErrorBanner title={t('case.stale')} message={apiErrorMessage(read.error, t('case.stale'))} className="p-2">
            <Button variant="outlined" className="mt-2" onClick={() => void read.refetch()} disabled={read.isFetching} data-testid="pattern-case-retry">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('case.readAgain')}
            </Button>
          </ErrorBanner>
        </div>
      )}
      <CaseHeader detail={detail} />
      {detail.previousClearance && <ClearanceBanner clearance={detail.previousClearance} />}
      <CaseFacts detail={detail} />
      <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-3 xl:col-span-2">
          <CaseRouteSection detail={detail} />
        </div>
        <div className="flex min-w-0 flex-col gap-3">
          <CaseSignals detail={detail} />
          <CaseMarks detail={detail} />
          <PreviousCases detail={detail} />
        </div>
      </div>
      <CaseTimeline dispenses={detail.dispenses} />
    </div>
  )
}

function CaseHeader({ detail }: { detail: PatternCaseDetail }) {
  const { t } = useTranslation('insurance-patterns')
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-card p-3" data-testid="pattern-case-header">
      <div className="flex min-w-0 flex-col gap-1.5">
        <h2 className="text-base font-semibold" data-testid="pattern-case-number">
          {t('case.heading', { caseNumber: fsi(detail.caseNumber) })}
        </h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <StatusBadge sev={statusSev(detail.status)}>{statusText(t, detail.status)}</StatusBadge>
          <StatusBadge sev={severitySev(detail.severity)}>{severityText(t, detail.severity)}</StatusBadge>
          <span className="text-muted-foreground">{t('case.scoreLine', { score: fsi(detail.score) })}</span>
          {detail.signals.map((s) => (
            <StatusBadge key={s} sev="mute">
              {signalText(t, s)}
            </StatusBadge>
          ))}
        </div>
      </div>
      {/* The case's actions, at the header's reading end. Each later slice adds ONE child under its own slot comment. */}
      <div className="flex flex-wrap items-center gap-2" data-testid="pattern-case-actions">
        {/* 923 · "Show patient": visible with canRevealPatient only; the reason dialog posts …/Reveal and holds the answer in
            its own state (never useQuery/useMutation, the URL, storage, a log or a toast). */}
        <RevealPatient caseId={detail.caseId} caseNumber={detail.caseNumber} />

        {/* 924 · "Add to blocked-patient list": only when detail.status === 'confirmed' && canRevealPatient && canBlockPatient. */}
        <CaseBlockAction detail={detail} />
      </div>
    </div>
  )
}

function ClearanceBanner({ clearance }: { clearance: NonNullable<PatternCaseDetail['previousClearance']> }) {
  const { t } = useTranslation('insurance-patterns')
  return (
    <div role="note" className="flex items-start gap-2 rounded-lg border border-attention-border bg-attention-050 p-3 text-sm text-attention-800" data-testid="pattern-clearance">
      <History className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <p className="font-semibold">{t('case.clearance.title')}</p>
        <p>{t('case.clearance.body', { caseNumber: fsi(clearance.caseNumber), by: fsi(clearance.by), at: fsi(formatDateTime(clearance.at)) })}</p>
        {clearance.note && (
          <p className="whitespace-pre-line" data-testid="pattern-clearance-note">
            <bdi>{clearance.note}</bdi>
          </p>
        )}
        <Link to={casePath(clearance.caseId)} className="w-fit text-primary underline-offset-2 hover:underline" data-testid="pattern-clearance-link">
          {t('case.clearance.open', { caseNumber: fsi(clearance.caseNumber) })}
        </Link>
      </div>
    </div>
  )
}

function CaseFacts({ detail }: { detail: PatternCaseDetail }) {
  const { t } = useTranslation('insurance-patterns')
  const units = unitWords(t)
  const closed = formatDateTime(detail.closedAt)
  const facts: [string, ReactNode][] = [
    ['stores', <Ltr>{detail.stores.length}</Ltr>],
    ['dispenses', <Ltr>{detail.dispenseCount}</Ltr>],
    ['span', <bdi>{units.duration(detail.spanMinutes)}</bdi>],
    ['longestLeg', detail.longestLegKm !== null && <bdi>{units.km(detail.longestLegKm)}</bdi>],
    ['shortestGap', detail.shortestGapMinutes !== null && <bdi>{units.duration(detail.shortestGapMinutes)}</bdi>],
    ['value', <Ltr>{formatMoney(detail.totalValue)}</Ltr>],
    ['opened', <Ltr>{formatDateTime(detail.openedAt)}</Ltr>],
    ['lastDispense', <Ltr>{formatDateTime(detail.lastDispenseAt)}</Ltr>],
    ['closed', closed ? <Ltr>{closed}</Ltr> : <span className="text-muted-foreground">{t('case.facts.stillOpen')}</span>],
  ]
  return (
    <dl
      className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-lg border border-border/60 bg-card p-3 text-sm sm:grid-cols-3 lg:grid-cols-5 2xl:grid-cols-9"
      aria-label={t('case.facts.label')}
      data-testid="pattern-facts"
    >
      {facts.map(([key, value]) => (
        <div key={key} className="flex min-w-0 flex-col" data-fact={key}>
          <dt className="text-xs text-muted-foreground">{t(`case.facts.${key}`)}</dt>
          <dd className="font-medium">{value}</dd>
        </div>
      ))}
    </dl>
  )
}

function CaseSignals({ detail }: { detail: PatternCaseDetail }) {
  const { t, i18n } = useTranslation('insurance-patterns')
  // The server's words in both languages (4053); the screen's own language first.
  const arFirst = i18n.language?.split('-')[0] === 'ar'
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-labelledby="pattern-signals-title" data-testid="pattern-signals">
      <h3 id="pattern-signals-title" className="text-sm font-semibold">
        {t('case.signals.title')}
      </h3>
      {detail.signalWords.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('case.signals.none')}</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {detail.signalWords.map((s, i) => {
            const en = (
              <p key="en" lang="en" className="text-sm" data-lang="en">
                <bdi>{s.en}</bdi>
              </p>
            )
            const ar = (
              <p key="ar" lang="ar" dir="rtl" className="text-sm text-muted-foreground" data-lang="ar">
                <bdi>{s.ar}</bdi>
              </p>
            )
            return (
              <li key={`${s.kind}-${i}`} className="flex flex-col gap-1" data-testid="pattern-signal" data-signal={s.kind}>
                <StatusBadge sev={s.kind === 'travel' ? 'warn' : 'mute'}>{signalText(t, s.kind)}</StatusBadge>
                {arFirst ? [ar, en] : [en, ar]}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function PreviousCases({ detail }: { detail: PatternCaseDetail }) {
  const { t } = useTranslation('insurance-patterns')
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-labelledby="pattern-previous-title" data-testid="pattern-previous">
      <h3 id="pattern-previous-title" className="text-sm font-semibold">
        {t('case.previous.title')}
      </h3>
      {detail.previousCases.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('case.previous.none')}</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {detail.previousCases.map((c) => (
            <li key={c.caseId} className="flex flex-wrap items-center gap-2 text-sm" data-testid="pattern-previous-case">
              <Link
                to={casePath(c.caseId)}
                title={t('case.previous.open', { caseNumber: fsi(c.caseNumber) })}
                className="font-medium text-primary underline-offset-2 hover:underline"
              >
                <Ltr>{c.caseNumber}</Ltr>
              </Link>
              <StatusBadge sev={statusSev(c.status)}>{statusText(t, c.status)}</StatusBadge>
              <span className="text-xs text-muted-foreground">
                <Ltr>{formatRange(formatDateTime(c.openedAt), formatDateTime(c.closedAt))}</Ltr>
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
