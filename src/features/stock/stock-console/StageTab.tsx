import { useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { ColDef } from 'ag-grid-community'
import type { TFunction } from 'i18next'
import { Trans, useTranslation } from 'react-i18next'
import type { StockConsoleGates, StockConsoleSeedRun, StockConsoleStageMove } from '@/core/models/stock-console'
import Ltr from '@/core/ui/Ltr'
import LtrCell from '@/core/ui/LtrCell'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime } from '@/core/util/date-format'
import { formatFigure } from '@/core/util/number-format'
import { stageQuery } from './api'
import { MONO, formatTime } from './columns'
import { rowKey } from './row-ids'
import HowRead from './HowRead'
import { HOW_STAGE } from './how-sections'
import ListGrid from './ListGrid'
import Loading from './Loading'
import RefusalBanner from './RefusalBanner'

const KNOWN_STAGES = ['Shadow', 'Seeding', 'Seeded', 'Blocking']

/** A stage in words when the console knows it; otherwise as it came. */
const stageWord = (t: TFunction, stage: string) => (KNOWN_STAGES.includes(stage) ? t(`stage.${stage}`) : stage)

/** One move per row: newest first, as the server sends them. Module-level, as AG Grid wants. */
const moveRowId = (m: StockConsoleStageMove) => rowKey(m.movedAt, m.from, m.to)

/**
 * A store's Stage and count tab (oms 942, spec 4157 story 50), read on opening, behind the console's grant: the stage
 * and since when, the stage log, the last seed run and the gates toward Blocking. Read-only — moves are made on Store
 * stages, not here.
 */
export default function StageTab({ store }: { store: string }) {
  const { t } = useTranslation('stock-console')
  const read = useQuery(stageQuery(store))
  const stage = read.isError ? undefined : read.data
  const columns = useMemo(() => buildMoveColumns(t), [t])

  return (
    <div className="flex min-w-0 flex-col gap-4" data-stage-tab={store}>
      {read.isPending && <Loading label={t('stageTab.loading')} />}
      {read.isError && <RefusalBanner error={read.error} />}
      {stage && (
        <>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <span data-stage={stage.stage}>
              <StatusBadge sev="mute">{KNOWN_STAGES.includes(stage.stage) ? stageWord(t, stage.stage) : <bdi>{stage.stage}</bdi>}</StatusBadge>
            </span>
            {stage.updatedAt && (
              <span className="text-xs text-muted-foreground">
                <Trans t={t} i18nKey="stageTab.since" values={{ at: formatDateTime(stage.updatedAt) }} components={{ at: <Ltr /> }} />
              </span>
            )}
            <span className="ms-auto text-xs text-muted-foreground">{t('stageTab.readOnly')}</span>
          </div>

          <Section title={t('stageTab.log')}>
            {stage.moves.length === 0 ? (
              <p className="text-sm text-muted-foreground">{t('stageTab.noMoves')}</p>
            ) : (
              <ListGrid rows={stage.moves} columns={columns} rowId={moveRowId} name="stage-log" />
            )}
          </Section>

          <Section title={t('stageTab.seed.title')}>
            {stage.lastSeed ? <SeedRun run={stage.lastSeed} /> : <p className="text-sm text-muted-foreground">{t('stageTab.seed.none')}</p>}
          </Section>

          <Section title={t('stageTab.gates.title')}>
            {stage.gates ? (
              <Gates gates={stage.gates} />
            ) : (
              <span data-gates="noAnswer">
                <StatusBadge sev="bad">{t('stageTab.gates.noAnswer')}</StatusBadge>
              </span>
            )}
          </Section>
        </>
      )}
      <HowRead section="stage" paragraphs={HOW_STAGE} />
    </div>
  )
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-sm font-medium">{title}</h3>
      {children}
    </section>
  )
}

function buildMoveColumns(t: TFunction): ColDef<StockConsoleStageMove>[] {
  return [
    { headerName: t('stageTab.column.movedAt'), field: 'movedAt', width: 140, cellClass: MONO, valueFormatter: formatTime, cellRenderer: LtrCell },
    { headerName: t('stageTab.column.from'), field: 'from', width: 110, valueFormatter: (p) => stageWord(t, String(p.value ?? '')) },
    { headerName: t('stageTab.column.to'), field: 'to', width: 110, valueFormatter: (p) => stageWord(t, String(p.value ?? '')) },
    // A person's name, or their login when the name is not known: free text, isolated by the base cell.
    { headerName: t('stageTab.column.by'), colId: 'by', width: 180, valueGetter: (p) => (p.data ? p.data.whoName || p.data.who : '') },
    { headerName: t('stageTab.column.mover'), field: 'mover', width: 110 },
    { headerName: t('stageTab.column.why'), field: 'why', width: 280 },
  ]
}

function SeedRun({ run }: { run: StockConsoleSeedRun }) {
  const { t } = useTranslation('stock-console')
  const time = (at: string | null) => (at ? <Ltr>{formatDateTime(at)}</Ltr> : t('store.never'))
  return (
    <dl className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm sm:grid-cols-3" data-seed-run={run.state}>
      <Pair label={t('stageTab.seed.state')}>
        <bdi>{run.state}</bdi>
      </Pair>
      <Pair label={t('stageTab.seed.kind')}>
        <bdi>{run.kind}</bdi>
      </Pair>
      <Pair label={t('stageTab.seed.batchRows')}>
        <Ltr>{formatFigure(run.batchRows)}</Ltr>
      </Pair>
      <Pair label={t('stageTab.seed.askedAt')}>
        <span className="font-mono">{time(run.askedAt)}</span>
      </Pair>
      <Pair label={t('stageTab.seed.endedAt')}>
        <span className="font-mono">{time(run.endedAt)}</span>
      </Pair>
      {run.reason && (
        <Pair label={t('stageTab.seed.reason')}>
          <bdi>{run.reason}</bdi>
        </Pair>
      )}
    </dl>
  )
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-col">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function Gates({ gates }: { gates: StockConsoleGates }) {
  const { t } = useTranslation('stock-console')
  return (
    <div className="flex flex-col gap-2 text-sm" data-gates={gates.hold ? 'hold' : 'notYet'}>
      <span className="inline-flex flex-wrap items-center gap-2">
        <Trans
          t={t}
          i18nKey="stageTab.gates.toward"
          values={{ from: stageWord(t, gates.from), to: stageWord(t, gates.to) }}
          components={{ s: <bdi /> }}
        />
        <StatusBadge sev={gates.hold ? 'ok' : 'warn'}>{t(gates.hold ? 'stageTab.gates.allHold' : 'stageTab.gates.notAllHold')}</StatusBadge>
      </span>
      {gates.measured.length > 0 && (
        <ul className="flex flex-col gap-1">
          {gates.measured.map((g) => (
            <li key={g.gate} className="flex flex-wrap items-center gap-2" data-gate={g.gate}>
              <StatusBadge sev={g.holds ? 'ok' : 'bad'}>{t(g.holds ? 'stageTab.gates.holds' : 'stageTab.gates.doesNotHold')}</StatusBadge>
              <bdi className="font-medium">{g.gate}</bdi>
              {g.figure && (
                <span className="text-muted-foreground">
                  <bdi>{g.figure}</bdi>
                </span>
              )}
            </li>
          ))}
        </ul>
      )}
      <Names label={t('stageTab.gates.confirmed')} names={gates.confirmed} />
      <Names label={t('stageTab.gates.notConfirmed')} names={gates.notConfirmed} />
    </div>
  )
}

function Names({ label, names }: { label: string; names: string[] }) {
  if (names.length === 0) return null
  return (
    <span className="flex flex-wrap gap-x-2 gap-y-1">
      <span className="text-muted-foreground">{label}</span>
      {names.map((n) => (
        <span key={n} className="rounded-full border border-border/60 px-2 text-xs">
          <bdi>{n}</bdi>
        </span>
      ))}
    </span>
  )
}
