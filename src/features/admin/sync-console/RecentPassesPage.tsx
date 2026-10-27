import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'

import Field from '@/core/ui/Field'
import GridPager from '@/core/ui/GridPager'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import type { Severity } from '@/core/ui/severity'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { PASS_KINDS, type FleetPass, type PassKind, type RecentPassesSummary, type SyncLoop } from '@/core/models/sync-console'
import { formatDateTime } from '@/core/util/date-format'
import { canOpenSyncConsole, recentPassesQueryOptions, syncConsoleAccessQuery } from './api'
import { figure } from './helpers'
import {
  DEFAULT_RECENT_PASSES_FILTER,
  RECENT_PASSES_PAGE_SIZE,
  RECENT_WINDOWS,
  okShare,
  passKindBadge,
  passMix,
  reachShare,
  shareSeverity,
  toggleKind,
  type RecentPassesFilter,
  type RecentWindow,
} from './recent-passes-helpers'
import { buildRecentPassColumns } from './recent-passes-columns'
import ConsoleNav from './ConsoleNav'
import PassDetailModal from './PassDetailModal'
import TabGrid from './TabGrid'

/**
 * The fleet's Recent passes — `/admin/sync/passes`. One look answers "is the sync
 * mostly green, or are the stores out of reach?": two headline shares (finished
 * passes that went well; stores reached by their last connect), the window's mix as
 * one bar, a tile per kind that filters the list, and the passes themselves, newest
 * first, each opening its detail. Rides the fleet's 30 s refresh.
 */
export default function RecentPassesPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('recentPasses.title')}
      subtitle={t('recentPasses.subtitle')}
    >
      <RecentPasses />
    </ScreenGate>
  )
}

/** A severity as a solid fill (the mix bar) and as a tile's top border, from the app tokens. */
const FILL: Record<Severity, string> = {
  ok: 'bg-success',
  go: 'bg-primary',
  warn: 'bg-attention',
  bad: 'bg-danger',
  mute: 'bg-muted-foreground/40',
}
const ACCENT: Record<Severity, string> = {
  ok: 'border-t-success',
  go: 'border-t-primary',
  warn: 'border-t-attention',
  bad: 'border-t-danger',
  mute: 'border-t-border',
}

/** The code box waits this long after the last keystroke before it asks the door. */
const CODE_DEBOUNCE_MS = 400

const passId = (p: FleetPass) => p.processId

function RecentPasses() {
  const { t } = useTranslation('sync-console')
  const [filter, setFilter] = useState<RecentPassesFilter>(DEFAULT_RECENT_PASSES_FILTER)
  const [code, setCode] = useState('')
  const [opened, setOpened] = useState<FleetPass | null>(null)

  useEffect(() => {
    const id = setTimeout(() => {
      const c = code.trim()
      setFilter((f) => (f.code === c ? f : { ...f, code: c, page: 1 }))
    }, CODE_DEBOUNCE_MS)
    return () => clearTimeout(id)
  }, [code])

  const passes = useQuery({ ...recentPassesQueryOptions(filter), placeholderData: keepPreviousData })
  const columns = useMemo(() => buildRecentPassColumns(t, setOpened), [t])
  // As on the Fleet table: a failed read draws none of the previous filter's rows or mix.
  const shown = passes.isError ? undefined : passes.data
  const total = shown?.items.total ?? 0

  // The window moves on each refresh: an emptied inner page falls back to the new last page.
  const settled = shown && !passes.isPlaceholderData ? shown.items : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: RECENT_PASSES_PAGE_SIZE,
    })
    if (last !== settled.page) setFilter((f) => (f.page === settled.page ? { ...f, page: last } : f))
  }, [settled])

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConsoleNav />

      <div className="flex flex-wrap items-end gap-2" role="group" aria-label={t('recentPasses.filters')} data-recent-filters="">
        <Field label={t('recentPasses.window')}>
          <Select
            value={filter.minutes}
            onChange={(e) => setFilter((f) => ({ ...f, minutes: Number(e.target.value) as RecentWindow, page: 1 }))}
            data-recent-window=""
          >
            {RECENT_WINDOWS.map((m) => (
              <option key={m} value={m}>
                {t(`recentPasses.windows.${m}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('recentPasses.loop')}>
          <Select
            value={filter.loop ?? ''}
            onChange={(e) => setFilter((f) => ({ ...f, loop: (e.target.value || null) as SyncLoop | null, page: 1 }))}
            data-recent-loop=""
          >
            <option value="">{t('recentPasses.loopAny')}</option>
            <option value="push">{t('loops.push')}</option>
            <option value="pull">{t('loops.pull')}</option>
          </Select>
        </Field>
        <Field label={t('recentPasses.code')}>
          <Input
            type="search"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder={t('recentPasses.codeHint')}
            wrapperClassName="w-28 font-mono"
            dir="ltr"
            data-recent-code=""
          />
        </Field>
        <div className="ms-auto flex items-center gap-2 text-xs text-muted-foreground">
          {passes.isFetching && (
            <span className="inline-flex items-center gap-1" role="status">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('refreshing')}
            </span>
          )}
          {shown && (
            <span data-recent-since="">
              <Trans t={t} i18nKey="recentPasses.since" values={{ at: formatDateTime(shown.since) }} components={{ at: <Ltr /> }} />
            </span>
          )}
        </div>
      </div>

      {shown && (
        <Overview
          summary={shown.summary}
          kind={filter.kind}
          onKind={(k) => setFilter((f) => toggleKind(f, k))}
        />
      )}

      <section className="flex min-w-0 flex-col gap-2" data-recent-table="">
        {shown && (
          <span className="text-xs text-muted-foreground" data-recent-count="">
            <Trans t={t} i18nKey="recentPasses.count" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
          </span>
        )}
        <TabGrid
          rows={shown?.items.items}
          columns={columns}
          rowId={passId}
          pending={passes.isPending}
          error={passes.error}
          failed={t('recentPasses.failed')}
          empty={t(filter.page > 1 ? 'recentPasses.emptyPage' : 'recentPasses.empty')}
          loading={t('recentPasses.loading')}
          data="recent-passes"
        />
        {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
        {((shown && showsPager(total, RECENT_PASSES_PAGE_SIZE)) || filter.page > 1) && (
          <div className="overflow-hidden rounded-md border border-border/60">
            <GridPager
              page={filter.page}
              pageSize={RECENT_PASSES_PAGE_SIZE}
              totalMatches={total}
              busy={passes.isPlaceholderData}
              onPage={(page) => setFilter((f) => ({ ...f, page }))}
            />
          </div>
        )}
      </section>
      <PassDetailModal pass={opened} onClose={() => setOpened(null)} />
    </div>
  )
}

/** The headline shares, the mix bar and the kind tiles. */
function Overview({
  summary,
  kind,
  onKind,
}: {
  summary: RecentPassesSummary
  kind: PassKind | null
  onKind: (kind: PassKind) => void
}) {
  const { t } = useTranslation('sync-console')
  const ok = okShare(summary)
  const reach = reachShare(summary)
  const mix = passMix(summary)
  return (
    <section className="flex flex-col gap-3" data-recent-overview="">
      <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-2">
        <Headline
          label={t('recentPasses.okShare')}
          sev={shareSeverity(ok)}
          value={ok === null ? t('recentPasses.noShare') : t('recentPasses.percent', { n: ok })}
          hint={t('recentPasses.okShareHint')}
          data="ok"
        />
        <Headline
          label={t('recentPasses.reachShare')}
          sev={shareSeverity(reach)}
          value={reach === null ? t('recentPasses.noShare') : t('recentPasses.percent', { n: reach })}
          hint={
            <Trans
              t={t}
              i18nKey="recentPasses.reachShareHint"
              values={{ reached: figure(summary.reachedStores), unreached: figure(summary.unreachedStores) }}
              components={{ n: <Ltr />, bad: <Ltr /> }}
            />
          }
          data="reach"
        />
        <Headline
          label={t('recentPasses.passes')}
          sev="mute"
          value={figure(summary.passes)}
          hint={<Trans t={t} i18nKey="recentPasses.passesHint" values={{ stores: figure(summary.stores) }} components={{ n: <Ltr /> }} />}
          data="passes"
        />
      </div>

      <div aria-label={t('recentPasses.mix')} role="img" data-recent-mix="">
        {mix.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('recentPasses.mixEmpty')}</p>
        ) : (
          <div className="flex h-3 w-full overflow-hidden rounded-full bg-muted">
            {mix.map((s) => (
              <div
                key={s.kind}
                className={FILL[passKindBadge(s.kind).sev]}
                // A sliver still shows: a single connect failure in a thousand passes is worth seeing.
                style={{ width: `${Math.max(s.percent, 0.5)}%` }}
                title={t('recentPasses.mixSegment', { kind: t(`passKinds.${s.kind}`), n: figure(s.count), percent: s.percent })}
              />
            ))}
          </div>
        )}
      </div>

      <div
        className="grid grid-cols-[repeat(auto-fit,minmax(8rem,1fr))] gap-2"
        role="group"
        aria-label={t('recentPasses.kinds')}
        data-recent-kinds=""
      >
        {PASS_KINDS.map((k) => {
          const sev = passKindBadge(k).sev
          const on = kind === k
          return (
            <button
              key={k}
              type="button"
              onClick={() => onKind(k)}
              aria-pressed={on}
              data-recent-kind={k}
              className={
                'flex flex-col items-start gap-0.5 rounded-lg border border-t-4 border-border px-3 py-2 text-start transition-colors hover:bg-accent ' +
                ACCENT[sev] +
                (on ? ' bg-muted ring-2 ring-primary/60' : ' bg-card')
              }
            >
              <span className="font-mono text-xl font-medium tabular-nums">
                <Ltr>{figure(summary.kinds[k] ?? 0)}</Ltr>
              </span>
              <span className="text-xs text-muted-foreground">{t(`passKinds.${k}`)}</span>
            </button>
          )
        })}
      </div>
      <p className="text-xs text-muted-foreground">{t('recentPasses.connectNote')}</p>
    </section>
  )
}

function Headline({
  label,
  sev,
  value,
  hint,
  data,
}: {
  label: string
  sev: Severity
  value: string
  hint: ReactNode
  data: string
}) {
  return (
    <div
      className={'flex flex-col gap-0.5 rounded-lg border border-t-4 border-border/60 bg-card px-4 py-3 ' + ACCENT[sev]}
      data-recent-headline={data}
    >
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className="font-mono text-3xl font-semibold tabular-nums">
        <Ltr>{value}</Ltr>
      </span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </div>
  )
}
