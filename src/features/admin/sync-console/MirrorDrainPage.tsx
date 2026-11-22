import { useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Loader2 } from 'lucide-react'
import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from 'recharts'
import { apiErrorMessage } from '@/core/api'
import { CHART_TOOLTIP_STYLE } from '@/core/charts/chrome'
import { CHART_BOX_DIR, chartMirror } from '@/core/charts/direction'
import { CHART_INK } from '@/core/charts/slots'
import { MIRROR_DRAIN_WINDOWS, type MirrorDrain, type MirrorDrainWindow } from '@/core/models/sync-console'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { mirrorDrainQuery } from './api'
import ConsoleNav from './ConsoleNav'
import { figure } from './helpers'
import MirrorDrainChart from './MirrorDrainChart'
import {
  SEVERITY_INK,
  VERDICT_SEVERITY,
  chartRows,
  lagTile,
  etaView,
  pieView,
  reasonLine,
  sinceMarker,
  verdictLine,
  when,
  type DrainLine,
  type EtaView,
} from './mirror-drain-helpers'

/**
 * The Mirror drain page (oms 931, BackOffice 4091): is the mirror winning, how much of today's pull is left,
 * and since when has there been trouble — without SQL. One read of `ActionSync/Mirror/Inbox`, every minute.
 *
 * 1. The verdict sentence, in its colour, and the door's reasons under it.
 * 2. The pie: the rows pulled in the last 24 h, applied / waiting / parked, the share applied in the centre;
 *    beside it what the stores still hold and the pull has not fetched (it ages while the pull is paused).
 * 3. The bars: pulled against applied, the waiting line under them, the bad slots banded and the "since" marker.
 * 4. The tiles; 5. what waits by type and what is parked by reason.
 *
 * No controls: retry and acknowledge stay on each store's Mirror tab (458). Every judgement is the door's.
 */
export default function MirrorDrainPage() {
  const { t } = useTranslation('sync-console')
  const [span, setSpan] = useState<MirrorDrainWindow>('6h')
  const query = useQuery({ ...mirrorDrainQuery(span), placeholderData: keepPreviousData })
  // A failed read draws nothing old: the last answer beside an error would read as a live one.
  const d = query.isError ? undefined : query.data

  return (
    <div className="flex min-w-0 flex-col gap-4" data-mirror-drain="">
      <ConsoleNav />
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h1 className="text-lg font-semibold">{t('drain.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('drain.subtitle')}</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-muted-foreground" data-as-of="">
          {query.isFetching && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
          {d && <Trans t={t} i18nKey="drain.readAt" values={{ at: when(d.asOf, d.asOf) }} components={{ at: <Ltr /> }} />}
        </div>
      </header>

      {query.isError && <ErrorBanner className="p-3" message={apiErrorMessage(query.error, t('drain.failed'))} />}

      {d && (
        <>
          <Verdict d={d} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
            <PieCard d={d} />
            <BarsCard d={d} span={span} onSpan={setSpan} />
          </div>
          <Tiles d={d} />
          <div className="grid gap-4 lg:grid-cols-2">
            <ByType d={d} />
            <Parks d={d} />
          </div>
        </>
      )}
    </div>
  )
}

function useLine() {
  const { t } = useTranslation('sync-console')
  return (line: DrainLine) => t(`drain.${line.key}`, line.values)
}

function Card({ title, children, data }: { title: string; children: ReactNode; data: string }) {
  return (
    <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-drain-card={data}>
      <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{title}</h2>
      {children}
    </section>
  )
}

/** 1. The sentence on top, in the verdict's colour, and the door's reasons, worst first. */
function Verdict({ d }: { d: MirrorDrain }) {
  const { t } = useTranslation('sync-console')
  const say = useLine()
  const sev = VERDICT_SEVERITY[d.verdict]
  return (
    <section
      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-4"
      data-verdict={d.verdict}
      aria-live="polite"
    >
      <div className="flex flex-wrap items-center gap-3">
        <StatusBadge sev={sev}>{t(`drain.verdictLabel.${d.verdict}`)}</StatusBadge>
        {/* `dir="auto"`: a sentence takes its own language's direction, so English copy reads whole under RTL. */}
        <p dir="auto" className={`text-xl font-semibold ${SEVERITY_INK[sev]}`} data-verdict-line="">
          {say(verdictLine(d))}
        </p>
      </div>
      {d.reasons.length > 0 && (
        <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm" data-reasons="">
          {d.reasons.map((r, i) => (
            <li key={`${r.code}-${i}`} data-reason={r.code} data-level={r.level} className={SEVERITY_INK[VERDICT_SEVERITY[r.level]]}>
              <bdi>{say(reasonLine(r, d.asOf, d.businessFirst))}</bdi>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

/** 2. The pie of the last 24 h's pull, the share applied in the centre, and the till backlog not pulled yet. */
function PieCard({ d }: { d: MirrorDrain }) {
  const { t } = useTranslation('sync-console')
  const view = pieView(d.window24h)
  const [startAngle, endAngle] = chartMirror.rtl ? [90, 450] : [90, -270]
  const size = 200
  return (
    <Card title={t('drain.pie.title')} data="pie">
      {view.total === 0 ? (
        <p className="text-sm text-muted-foreground">{t('drain.pie.none')}</p>
      ) : (
        <div className="flex flex-wrap items-center gap-6">
          {/* 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the chart box is always LTR (`@/core/charts/direction`). */}
          <div dir={CHART_BOX_DIR} className="relative shrink-0" style={{ width: size, height: size }} role="figure" aria-label={t('drain.pie.title')}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart accessibilityLayer>
                <Pie
                  data={view.slices.map((s) => ({ ...s, label: t(`drain.pie.${s.part}`) }))}
                  dataKey="value"
                  nameKey="label"
                  innerRadius="62%"
                  outerRadius="95%"
                  startAngle={startAngle}
                  endAngle={endAngle}
                  stroke={CHART_INK.card}
                  isAnimationActive={false}
                >
                  {view.slices.map((s) => (
                    <Cell key={s.part} fill={s.ink} data-part={s.part} />
                  ))}
                </Pie>
                <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(v, name) => [figure(typeof v === 'number' ? v : 0), String(name)]} />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center" data-pie-centre="">
              <span className="text-3xl font-semibold tabular-nums">
                <Ltr>{view.appliedPct == null ? '' : `${view.appliedPct}%`}</Ltr>
              </span>
              <span className="text-xs text-muted-foreground">{t('drain.pie.centre')}</span>
            </div>
          </div>
          <ul className="flex min-w-44 flex-1 flex-col gap-1.5 text-sm" data-pie-legend="">
            {view.slices.map((s) => (
              <li key={s.part} className="flex items-center gap-2" data-part={s.part}>
                <span className="size-2.5 shrink-0 rounded-full" style={{ background: s.ink }} aria-hidden />
                <span className="flex-1">{t(`drain.pie.${s.part}`)}</span>
                <span className="tabular-nums">
                  <Ltr>{figure(s.value)}</Ltr>
                </span>
              </li>
            ))}
            <li className="mt-1 flex items-center gap-2 border-t border-divider pt-1.5 font-medium">
              <span className="size-2.5 shrink-0" aria-hidden />
              <span className="flex-1">{t('drain.pie.total')}</span>
              <span className="tabular-nums">
                <Ltr>{figure(view.total)}</Ltr>
              </span>
            </li>
          </ul>
        </div>
      )}
      <p dir="auto" className="text-xs text-muted-foreground" data-till-backlog="">
        {d.tillBacklogKnown == null
          ? t('drain.pie.notPulledNone')
          : t('drain.pie.notPulled', {
              n: fsi(figure(d.tillBacklogKnown)),
              at: fsi(when(d.tillBacklogOldestMeasuredAt, d.asOf)),
            })}
      </p>
    </Card>
  )
}

/** 3. The bars, with the window switch. */
function BarsCard({ d, span, onSpan }: { d: MirrorDrain; span: MirrorDrainWindow; onSpan: (w: MirrorDrainWindow) => void }) {
  const { t } = useTranslation('sync-console')
  const rows = chartRows(d)
  const marker = sinceMarker(d.slots, d.troubleSince)
  const markerLabel = marker
    ? t(marker.before ? 'drain.bars.sinceBefore' : 'drain.bars.since', { at: when(d.troubleSince, d.asOf) })
    : ''
  return (
    <Card title={t('drain.bars.title')} data="bars">
      <div className="flex flex-wrap items-center gap-2" role="group" aria-label={t('drain.bars.window')} data-drain-window={span}>
        {MIRROR_DRAIN_WINDOWS.map((w) => (
          <Button key={w} variant={w === span ? 'secondary' : 'outlined'} aria-pressed={w === span} onClick={() => onSpan(w)} data-window={w}>
            <bdi>{t(`drain.bars.windows.${w}`)}</bdi>
          </Button>
        ))}
      </div>
      {marker && (
        <p dir="auto" className="flex items-center gap-2 text-sm font-medium text-danger" data-since-caption="">
          <span className="inline-block w-4 border-t-2 border-dashed border-danger" aria-hidden />
          {markerLabel}
        </p>
      )}
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('drain.bars.empty')}</p>
      ) : (
        <MirrorDrainChart rows={rows} threshold={d.backpressureThreshold} marker={marker} />
      )}
    </Card>
  )
}

/** 4. The tiles: a null ETA reads "not draining" in the danger ink. */
function Tiles({ d }: { d: MirrorDrain }) {
  const { t } = useTranslation('sync-console')
  const say = useLine()
  const lag = lagTile(d)
  const eta = (v: EtaView) =>
    v.kind === 'at' ? (
      <Ltr>{v.at}</Ltr>
    ) : (
      <span className={v.kind === 'notDraining' ? 'text-danger' : 'text-muted-foreground'}>
        {t(v.kind === 'notDraining' ? 'drain.tiles.notDraining' : 'drain.tiles.notPaused')}
      </span>
    )
  return (
    <section className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7" data-drain-tiles="">
      <Tile label={t('drain.tiles.pending')} data="pending"
        sub={d.backpressureThreshold != null ? t('drain.tiles.pendingOf', { limit: fsi(figure(d.backpressureThreshold)) }) : null}
        note={d.waitingForRetry > 0 ? t('drain.tiles.waitingRetry', { n: fsi(figure(d.waitingForRetry)) }) : null}>
        <Ltr>{figure(d.pending)}</Ltr>
      </Tile>
      <Tile label={t(`drain.${lag.label}`)} data="lag" note={lag.note ? say(lag.note) : null}>
        {lag.value == null
          ? <span className="text-muted-foreground">{t('drain.tiles.lagNone')}</span>
          : say(lag.value)}
      </Tile>
      <Tile label={t('drain.tiles.rates')} data="rates">
        <Ltr>{`${figure(d.applyPerMinute)} / ${figure(d.arrivePerMinute)}`}</Ltr>
      </Tile>
      <Tile label={t('drain.tiles.pull')} data="pull">
        {d.pullPaused ? (
          <span className="text-danger">
            {d.pullPausedSince
              ? t('drain.tiles.pullPausedSince', { since: fsi(when(d.pullPausedSince, d.asOf)) })
              : t('drain.tiles.pullPaused')}
          </span>
        ) : (
          t('drain.tiles.pullRunning')
        )}
      </Tile>
      <Tile label={t('drain.tiles.resumes')} data="resumes">
        {eta(etaView(d.etaPullResumesAt, d.asOf, d.pullPaused))}
      </Tile>
      <Tile label={t('drain.tiles.empty')} data="empty">
        {eta(etaView(d.etaEmptyAt, d.asOf))}
      </Tile>
      <Tile label={t('drain.tiles.parks')} data="parks"
        note={d.parkedLast30Min > 0 ? t('drain.tiles.parksRecent', { n: fsi(figure(d.parkedLast30Min)) }) : null}>
        <span className={d.parkedOpen > 0 ? 'text-danger' : undefined}>
          <Ltr>{figure(d.parkedOpen)}</Ltr>
        </span>
      </Tile>
    </section>
  )
}

function Tile({ label, children, sub = null, note = null, data }: {
  label: string
  children: ReactNode
  sub?: string | null
  note?: string | null
  data: string
}) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5 rounded-lg border border-border/60 bg-card p-3" data-drain-tile={data}>
      <span className="text-xs text-muted-foreground">{label}</span>
      <span dir="auto" className="text-lg font-semibold tabular-nums">{children}</span>
      {sub && <span dir="auto" className="text-xs text-muted-foreground">{sub}</span>}
      {note && <span dir="auto" className="text-xs text-attention-800">{note}</span>}
    </div>
  )
}

/** 5a. What waits, by entity type and action. */
function ByType({ d }: { d: MirrorDrain }) {
  const { t } = useTranslation('sync-console')
  return (
    <Card title={t('drain.byType.title')} data="by-type">
      {d.pendingByType.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('drain.byType.none')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-xs text-muted-foreground">
                <th className="pe-4 text-start font-medium">{t('drain.byType.entityType')}</th>
                <th className="pe-4 text-start font-medium">{t('drain.byType.action')}</th>
                <th className="pe-4 text-end font-medium">{t('drain.byType.pending')}</th>
                <th className="text-end font-medium">{t('drain.byType.oldest')}</th>
              </tr>
            </thead>
            <tbody>
              {d.pendingByType.map((p) => (
                <tr key={`${p.entityType}/${p.action}`} className="border-t border-divider" data-pending-type={p.entityType}>
                  <td className="pe-4 font-mono"><Ltr>{p.entityType}</Ltr></td>
                  <td className="pe-4 font-mono"><Ltr>{p.action}</Ltr></td>
                  <td className="pe-4 text-end tabular-nums"><Ltr>{figure(p.pending)}</Ltr></td>
                  <td className="text-end tabular-nums"><Ltr>{when(p.oldestPulledAt, d.asOf)}</Ltr></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  )
}

/** 5b. The open parks by reason; retry and acknowledge stay on each store's Mirror tab (458). */
function Parks({ d }: { d: MirrorDrain }) {
  const { t } = useTranslation('sync-console')
  return (
    <Card title={t('drain.parks.title')} data="parks">
      {d.parkedByReason.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('drain.parks.none')}</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-muted-foreground">
                  <th className="pe-4 text-start font-medium">{t('drain.parks.reason')}</th>
                  <th className="pe-4 text-start font-medium">{t('drain.parks.error')}</th>
                  <th className="pe-4 text-end font-medium">{t('drain.parks.count')}</th>
                  <th className="text-end font-medium">{t('drain.parks.lastAt')}</th>
                </tr>
              </thead>
              <tbody>
                {d.parkedByReason.map((p, i) => (
                  <tr key={`${p.parkReason}-${i}`} className="border-t border-divider" data-park-reason={p.parkReason}>
                    <td className="pe-4">{t(`mirrorTab.reasons.${p.parkReason}`)}</td>
                    <td className="pe-4 text-muted-foreground"><bdi>{p.errorPrefix ?? ''}</bdi></td>
                    <td className="pe-4 text-end tabular-nums"><Ltr>{figure(p.count)}</Ltr></td>
                    <td className="text-end tabular-nums"><Ltr>{when(p.lastAt, d.asOf)}</Ltr></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p dir="auto" className="text-xs text-muted-foreground">
            {t('drain.parks.open')}{' '}
            <Link to="/admin/sync" className="text-primary underline-offset-2 hover:underline">
              {t('drain.parks.toFleet')}
            </Link>
          </p>
        </>
      )}
    </Card>
  )
}
