import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import type { RuleApprovalStep, RuleDraft } from '@/core/models/rule-campaign'
import { isBareDenial, apiErrorMessage } from '@/core/api'
import { ruleApprovalHistoryQuery } from '@/core/rules/api'
import CampaignStateBadge from '@/core/rules/CampaignStateBadge'
import { campaignPath, campaignState, scheduleRelative, setAt, type CampaignState } from '@/core/rules/campaign-state'
import { RULE_WEEKDAYS } from '@/core/models/rule-campaign'
import Ltr from '@/core/ui/Ltr'
import { formatRange } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { draftGate, preActivationSteps, showsSteps } from './approval'
import ApprovalPanel from './ApprovalPanel'
import CampaignActionsMenu from './CampaignActionsMenu'
import { useWorkspace } from './context'
import PreActivationSteps from './PreActivationSteps'
import { draftStateInput } from './settings-form'

/**
 * A campaign's dashboard (ticket 501): Details, State and Schedule; the State cell's ⋯ menu copies
 * the campaign (ticket 502), and its approval acts follow its state (tickets 511, 524), above them
 * the pre-activation steps while the campaign was never published; under the cells, the approval
 * trail (`Approvals/History`). Every date is the campaign's own local day or the local
 * wall clock — never UTC — and "starts in N days" counts local calendar days (`scheduleRelative`).
 */
export default function DashboardPage() {
  const { t } = useTranslation('campaign-workspace')
  const { draft: d } = useWorkspace()
  const c = d.campaign
  const now = new Date()
  const state = campaignState(draftStateInput(d), now)
  // HQ's validation of the saved draft (Drafts/Load answers it, ticket 522) — what the builder's
  // pill reads too: its errors gate "Ask for approval" and "Activate", and tick the rules step. A
  // draft HQ answered without one is "unavailable" (fail closed).
  const blocked = d.validation ? d.validation.errors.length > 0 : null
  const gate = draftGate(c.rules.length, { failed: !d.validation, blocked })

  return (
    <section className="flex flex-col gap-4" data-dashboard="">
      <header>
        <h1 className="text-lg font-semibold tracking-tight">
          <bdi>{c.name.en || t('untitled')}</bdi>
        </h1>
        {c.name.ar && (
          <p className="mt-1 text-sm text-muted-foreground" data-dashboard-name-ar="">
            <bdi>{c.name.ar}</bdi>
          </p>
        )}
      </header>
      {showsSteps(d) && <PreActivationSteps steps={preActivationSteps(c, blocked)} base={campaignPath(d.code)} />}
      <div className="grid gap-3 lg:grid-cols-3">
        <Cell title={t('dashboard.details.title')} data="details">
          <Details d={d} />
        </Cell>
        <Cell title={t('dashboard.state.title')} data="state">
          <CampaignStateBadge state={state} />
          <StateSentence d={d} state={state} />
          <LiveUnderDraft d={d} state={state} />
          <ApprovalPanel draft={d} gate={gate} />
          <CampaignActionsMenu draft={d} />
        </Cell>
        <Cell title={t('dashboard.schedule.title')} data="schedule">
          <Schedule d={d} now={now} live={d.campaignStatus === 'Published'} />
        </Cell>
      </div>
      <ApprovalTrail code={d.code} />
    </section>
  )
}

/**
 * The campaign's approval trail (`Approvals/History`, oldest first): who asked, sent back, activated
 * or disabled, when (local) and with what note; an activation or a disable names the version it made.
 */
function ApprovalTrail({ code }: { code: string }) {
  const { t } = useTranslation('campaign-workspace')
  const history = useQuery(ruleApprovalHistoryQuery(code))
  let body
  if (history.isPending) body = <p className="text-sm text-muted-foreground">{t('dashboard.trail.loading')}</p>
  else if (history.isError)
    body = (
      <p className="text-sm text-danger-800" data-trail-failed="">
        {isBareDenial(history.error) ? t('dashboard.trail.denied') : <bdi>{apiErrorMessage(history.error, t('dashboard.trail.failed'))}</bdi>}
      </p>
    )
  else if (!history.data.length)
    body = (
      <p className="text-sm text-muted-foreground" data-trail-empty="">
        {t('dashboard.trail.empty')}
      </p>
    )
  else
    body = (
      <ol className="flex flex-col gap-2" data-trail="">
        {history.data.map((step, i) => (
          <TrailStep key={i} step={step} />
        ))}
      </ol>
    )
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4" data-dashboard-cell="trail">
      <h2 className="text-sm font-semibold">{t('dashboard.trail.title')}</h2>
      {body}
    </section>
  )
}

function TrailStep({ step }: { step: RuleApprovalStep }) {
  const { t } = useTranslation('campaign-workspace')
  const at = setAt(step.at)
  return (
    <li className="flex flex-col gap-0.5 border-s-2 border-border ps-2 text-sm" data-trail-step={step.action}>
      <span>
        <Trans
          t={t}
          i18nKey={`dashboard.trail.action.${step.action}`}
          values={{ by: step.by, version: step.versionNo }}
          components={{ by: <bdi className="font-medium" />, version: <Ltr /> }}
        />
        {at && (
          <span className="ms-2 text-xs text-muted-foreground">
            <Ltr>{formatDateTime(at)}</Ltr>
          </span>
        )}
      </span>
      {step.note && (
        <span className="text-xs text-muted-foreground" data-trail-note="">
          <bdi>{step.note}</bdi>
        </span>
      )}
    </li>
  )
}

function Cell({ title, data, children }: { title: string; data: string; children: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-2 rounded-lg border border-border/60 bg-card p-4" data-dashboard-cell={data}>
      <h2 className="text-sm font-semibold">{title}</h2>
      {children}
    </div>
  )
}

/** One label / value line of a cell's definition list. */
function Line({ label, data, children }: { label: string; data: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[8rem_1fr] gap-2 text-sm" data-line={data}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  )
}

function Details({ d }: { d: RuleDraft }) {
  const { t } = useTranslation('campaign-workspace')
  const c = d.campaign
  const updatedAt = setAt(d.updatedAt)
  return (
    <dl className="flex w-full flex-col gap-1.5">
      <Line label={t('dashboard.details.nameEn')} data="nameEn">
        <bdi>{c.name.en}</bdi>
      </Line>
      <Line label={t('dashboard.details.nameAr')} data="nameAr">
        {c.name.ar ? <bdi>{c.name.ar}</bdi> : <span className="text-muted-foreground">{t('dashboard.details.noArabicName')}</span>}
      </Line>
      <Line label={t('dashboard.details.code')} data="code">
        <Ltr>{d.code}</Ltr>
      </Line>
      <Line label={t('dashboard.details.features')} data="features">
        {d.features.length ? (
          <span className="flex flex-wrap gap-1">
            {d.features.map((f) => (
              <span key={f} className="rounded-full bg-muted px-2 py-0.5 text-xs" data-feature={f}>
                {t(`dashboard.details.feature.${f}`)}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">{t('dashboard.details.noFeatures')}</span>
        )}
      </Line>
      {updatedAt && (
        <Line label={t('dashboard.details.updated')} data="updated">
          <Trans t={t} i18nKey="dashboard.stamp" values={{ at: formatDateTime(updatedAt), by: d.updatedBy }} components={{ at: <Ltr />, by: <bdi /> }} />
        </Line>
      )}
    </dl>
  )
}

/** What the state means for this campaign, in a sentence. */
function StateSentence({ d, state }: { d: RuleDraft; state: CampaignState }) {
  const { t } = useTranslation('campaign-workspace')
  const requestedAt = setAt(d.requestedAt)
  const reviewedAt = setAt(d.reviewedAt)
  const p = (children: ReactNode) => (
    <p className="text-sm" data-state-sentence={state}>
      {children}
    </p>
  )
  if (state === 'waitingForApproval' && requestedAt) {
    return (
      <>
        {p(
          <Trans
            t={t}
            i18nKey="dashboard.state.waitingForApproval"
            values={{ at: formatDateTime(requestedAt), by: d.requestedBy }}
            components={{ at: <Ltr />, by: <bdi /> }}
          />,
        )}
        {d.requestNote && (
          <blockquote className="border-s-2 border-border ps-2 text-sm text-muted-foreground" data-approval-note="">
            <bdi>{d.requestNote}</bdi>
          </blockquote>
        )}
      </>
    )
  }
  if ((state === 'running' || state === 'scheduled' || state === 'expired' || state === 'disabled') && d.publishedVersionNo > 0) {
    return (
      <>
        {p(t(`dashboard.state.${state}`))}
        <p className="text-xs text-muted-foreground" data-live-version="">
          <Trans
            t={t}
            i18nKey="dashboard.state.liveVersionNo"
            values={{ version: d.publishedVersionNo }}
            components={{ version: <Ltr /> }}
          />
        </p>
      </>
    )
  }
  if (d.source === 'draft' && d.state === 'sentBack' && reviewedAt) {
    return (
      <>
        {p(
          <Trans
            t={t}
            i18nKey="dashboard.state.sentBack"
            values={{ at: formatDateTime(reviewedAt), by: d.reviewedBy }}
            components={{ at: <Ltr />, by: <bdi /> }}
          />,
        )}
        {d.reviewNote && (
          <blockquote className="border-s-2 border-border ps-2 text-sm text-muted-foreground" data-sent-back-note="">
            <bdi>{d.reviewNote}</bdi>
          </blockquote>
        )}
      </>
    )
  }
  return p(t(`dashboard.state.${state === 'waitingForApproval' ? 'waitingNoStamp' : state}`))
}

/**
 * A draft or a request over a published version (511's changes waiting, 512's restored version):
 * tills still run the live version until the draft is activated, so the State says which one.
 */
function LiveUnderDraft({ d, state }: { d: RuleDraft; state: CampaignState }) {
  const { t } = useTranslation('campaign-workspace')
  // A draft over a published version (changes waiting, a restored version): tills run the live one.
  if (d.publishedVersionNo === 0 || d.source !== 'draft' || state === 'disabled') return null
  return (
    <p className="text-xs text-muted-foreground" data-live-under-draft="">
      <Trans
        t={t}
        i18nKey="dashboard.state.liveUnderDraftNo"
        values={{ version: d.publishedVersionNo }}
        components={{ version: <Ltr /> }}
      />
    </p>
  )
}

function Schedule({ d, now, live }: { d: RuleDraft; now: Date; live: boolean }) {
  const { t } = useTranslation('campaign-workspace')
  const s = d.campaign.window ?? {}
  const rel = scheduleRelative(s, now)
  const n = (key: string, days: number) => (
    <Trans t={t} i18nKey={key} count={days} values={{ n: days }} components={{ n: <Ltr /> }} />
  )
  const headline =
    rel.kind === 'startsIn'
      ? n(live ? 'dashboard.schedule.startsIn' : 'dashboard.schedule.wouldStartIn', rel.days)
      : rel.kind === 'endsIn'
        ? n('dashboard.schedule.endsIn', rel.days)
        : rel.kind === 'endedAgo'
          ? n('dashboard.schedule.endedAgo', rel.days)
          : t(`dashboard.schedule.${rel.kind}`)
  const days = RULE_WEEKDAYS.flatMap((day, i) => ((s.days ?? []).includes(day) ? [i] : []))
  return (
    <>
      <p className="text-lg font-semibold" data-schedule-relative={rel.kind}>
        {headline}
      </p>
      {rel.kind === 'noLimit' ? (
        <p className="text-sm text-muted-foreground">{t('dashboard.schedule.noLimitHint')}</p>
      ) : (
        <dl className="flex w-full flex-col gap-1.5">
          <Line label={t('dashboard.schedule.start')} data="start">
            {s.from ? <Ltr>{s.from}</Ltr> : t('dashboard.schedule.immediately')}
          </Line>
          <Line label={t('dashboard.schedule.end')} data="end">
            {s.until ? <Ltr>{s.until}</Ltr> : t('dashboard.schedule.openEnded')}
          </Line>
          <Line label={t('dashboard.schedule.days')} data="days">
            {days.length ? <bdi>{days.map((d) => t(`weekdays.${d}`)).join(t('dashboard.schedule.daySeparator'))}</bdi> : t('dashboard.schedule.everyDay')}
          </Line>
          <Line label={t('dashboard.schedule.hours')} data="hours">
            {s.hours ? (
              <Ltr>{formatRange(s.hours.from, s.hours.until)}</Ltr>
            ) : (
              t('dashboard.schedule.allDay')
            )}
          </Line>
        </dl>
      )}
      <p className="text-xs text-muted-foreground">{t('dashboard.schedule.localTime')}</p>
    </>
  )
}
