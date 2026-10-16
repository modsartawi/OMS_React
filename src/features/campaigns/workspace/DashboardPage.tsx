import type { ReactNode } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import type { RuleCampaign } from '@/core/models/rule-campaign'
import CampaignStateBadge from '@/core/rules/CampaignStateBadge'
import { campaignState, scheduleRelative, type CampaignState } from '@/core/rules/campaign-state'
import Ltr from '@/core/ui/Ltr'
import { formatRange } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { useWorkspace } from './context'

/**
 * A campaign's dashboard (ticket 501): Details, State and Schedule, read-only in this slice. Every
 * date is the campaign's own local day or the local wall clock — never UTC — and "starts in N
 * days" counts local calendar days (`scheduleRelative`).
 */
export default function DashboardPage() {
  const { t } = useTranslation('campaign-workspace')
  const { campaign: c } = useWorkspace()
  const now = new Date()
  const state = campaignState(c, now)

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
      <div className="grid gap-3 lg:grid-cols-3">
        <Cell title={t('dashboard.details.title')} data="details">
          <Details c={c} />
        </Cell>
        <Cell title={t('dashboard.state.title')} data="state">
          <CampaignStateBadge state={state} />
          <StateSentence c={c} state={state} />
        </Cell>
        <Cell title={t('dashboard.schedule.title')} data="schedule">
          <Schedule c={c} now={now} live={c.status === 'live'} />
        </Cell>
      </div>
    </section>
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

function Details({ c }: { c: RuleCampaign }) {
  const { t } = useTranslation('campaign-workspace')
  const features = [c.features.coupons && 'coupons', c.features.points && 'points'].filter(Boolean) as string[]
  return (
    <dl className="flex w-full flex-col gap-1.5">
      <Line label={t('dashboard.details.nameEn')} data="nameEn">
        <bdi>{c.name.en}</bdi>
      </Line>
      <Line label={t('dashboard.details.nameAr')} data="nameAr">
        {c.name.ar ? <bdi>{c.name.ar}</bdi> : <span className="text-muted-foreground">{t('dashboard.details.noArabicName')}</span>}
      </Line>
      <Line label={t('dashboard.details.code')} data="code">
        <Ltr>{c.code}</Ltr>
      </Line>
      <Line label={t('dashboard.details.description')} data="description">
        {c.description ? <bdi>{c.description}</bdi> : <span className="text-muted-foreground">{t('dashboard.details.noDescription')}</span>}
      </Line>
      <Line label={t('dashboard.details.features')} data="features">
        {features.length ? (
          <span className="flex flex-wrap gap-1">
            {features.map((f) => (
              <span key={f} className="rounded-full bg-muted px-2 py-0.5 text-xs" data-feature={f}>
                {t(`dashboard.details.feature.${f}`)}
              </span>
            ))}
          </span>
        ) : (
          <span className="text-muted-foreground">{t('dashboard.details.noFeatures')}</span>
        )}
      </Line>
      {c.tags.length > 0 && (
        <Line label={t('dashboard.details.tags')} data="tags">
          <span className="flex flex-wrap gap-1">
            {c.tags.map((tag) => (
              <span key={tag} className="rounded-full border border-border/60 px-2 py-0.5 text-xs">
                <bdi>{tag}</bdi>
              </span>
            ))}
          </span>
        </Line>
      )}
      {c.created && (
        <Line label={t('dashboard.details.created')} data="created">
          <Trans
            t={t}
            i18nKey="dashboard.stamp"
            values={{ at: formatDateTime(c.created.at), by: c.created.by }}
            components={{ at: <Ltr />, by: <bdi /> }}
          />
        </Line>
      )}
    </dl>
  )
}

/** What the state means for this campaign, in a sentence. */
function StateSentence({ c, state }: { c: RuleCampaign; state: CampaignState }) {
  const { t } = useTranslation('campaign-workspace')
  const p = (children: ReactNode) => (
    <p className="text-sm" data-state-sentence={state}>
      {children}
    </p>
  )
  if (state === 'waitingForApproval' && c.approval) {
    return (
      <>
        {p(
          <Trans
            t={t}
            i18nKey="dashboard.state.waitingForApproval"
            values={{ at: formatDateTime(c.approval.at), by: c.approval.by }}
            components={{ at: <Ltr />, by: <bdi /> }}
          />,
        )}
        {c.approval.note && (
          <blockquote className="border-s-2 border-border ps-2 text-sm text-muted-foreground" data-approval-note="">
            <bdi>{c.approval.note}</bdi>
          </blockquote>
        )}
      </>
    )
  }
  if ((state === 'running' || state === 'scheduled' || state === 'expired' || state === 'disabled') && c.live) {
    return (
      <>
        {p(t(`dashboard.state.${state}`))}
        <p className="text-xs text-muted-foreground" data-live-version="">
          <Trans
            t={t}
            i18nKey="dashboard.state.liveVersion"
            values={{ version: c.live.version, at: formatDateTime(c.live.at), by: c.live.by }}
            components={{ version: <Ltr />, at: <Ltr />, by: <bdi /> }}
          />
        </p>
      </>
    )
  }
  return p(t(`dashboard.state.${state === 'waitingForApproval' ? 'waitingNoStamp' : state}`))
}

function Schedule({ c, now, live }: { c: RuleCampaign; now: Date; live: boolean }) {
  const { t } = useTranslation('campaign-workspace')
  const s = c.schedule
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
  const days = [...s.days].sort((a, b) => a - b)
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
            {s.hoursFrom || s.hoursTo ? (
              <Ltr>{formatRange(s.hoursFrom || '00:00', s.hoursTo || '24:00')}</Ltr>
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
