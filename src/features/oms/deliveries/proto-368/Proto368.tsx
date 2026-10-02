/* PROTOTYPE 368 — three arrangements of the Deliveries list, `?variant=A|B|C`,
 * on the real /oms/deliveries route, B "Navy-led" tokens, stub data.
 * ←/→ variant · ↑/↓ scenario (the floating bar; ignored while the grid has focus).
 *
 *   A — Three panes: Far as drawn, corrected — views rail · tokens · grid · inspector.
 *   B — Grid first: no left column — views menu + tokens on top, lens tabs over the grid.
 *   C — Labelled panel: the 14 criteria as labelled fields in a collapsible left panel.
 */
import { useEffect, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { AlertTriangle, Search } from 'lucide-react'
import PrototypeSwitcher from '@/core/ui/PrototypeSwitcher'
import { c } from './copy'
import { AppliedSummary, CriteriaPanel, QueryTokens } from './Criteria'
import Grid from './Grid'
import Inspector, { Kbd } from './Inspector'
import { useListKeys } from './keys'
import { applyView, SCENARIOS, seedScenario, useProto } from './store'
import { GridTools, LensTabs, RowSummary, ViewNameDialog, ViewsMenu, ViewsRail, ViewTitle } from './Views'

type DialogState = Parameters<typeof ViewNameDialog>[0]['state']

/** The grid region: the grid stays mounted (layout + J/K need its API); states overlay it. */
function GridRegion() {
  const rows = useProto((s) => s.rows)
  const error = useProto((s) => s.error)
  const searching = useProto((s) => s.searching)
  const shown = useProto((s) => s.shown)
  let overlay: ReactNode = null
  if (error)
    overlay = (
      <div role="alert" className="flex items-start gap-2 rounded-md border border-danger-border bg-danger-050 p-3 text-xs">
        <AlertTriangle className="size-4 shrink-0 text-danger" aria-hidden />
        {error}
      </div>
    )
  else if (rows === null && !searching)
    overlay = (
      <div className="flex flex-col items-center gap-1.5 text-center text-xs text-muted-foreground">
        <Search className="size-5" aria-hidden />
        <p className="font-medium text-foreground">{c('grid.before')}</p>
        <p>{c('grid.beforeHint')}</p>
      </div>
    )
  else if (rows && rows.length === 0) overlay = <p className="text-xs text-muted-foreground">{c('grid.empty')}</p>
  else if (rows && shown === 0) overlay = <p className="text-xs text-muted-foreground">{c('grid.noneInLens')}</p>
  return (
    <div className={`relative min-h-0 flex-1 ${searching ? 'opacity-70' : ''}`}>
      <div className="absolute inset-0">
        <Grid />
      </div>
      {overlay && <div className="pointer-events-none absolute inset-x-0 top-16 flex justify-center px-4 [&>*]:pointer-events-auto">{overlay}</div>}
    </div>
  )
}

function StatusBar() {
  const rows = useProto((s) => s.rows)
  const selected = useProto((s) => s.selectedKey)
  return (
    <div className="flex h-7 shrink-0 items-center gap-3 border-t border-border bg-card-2 px-3 text-[11.5px] text-ink-3">
      <span>
        <b className="font-mono font-medium text-muted-foreground">{rows?.length ?? 0}</b> {c('grid.rows', { count: rows?.length ?? 0 }).replace(/^\d+ /, '')}
        {selected ? ' · 1 selected' : ''}
      </span>
      <span className="flex-1" />
      <Hints />
      <span className="hidden xl:inline">{c('grid.copyHint')}</span>
    </div>
  )
}

function Hints() {
  return (
    <span className="inline-flex items-center gap-1.5">
      <Kbd>J</Kbd><Kbd>K</Kbd> {c('keys.move')}
      <span className="ms-1.5" /><Kbd>↵</Kbd> {c('keys.open')}
      <span className="ms-1.5" /><Kbd>R</Kbd><Kbd>C</Kbd><Kbd>N</Kbd> {c('keys.acts')}
      <span className="ms-1.5" /><Kbd>/</Kbd> {c('keys.search')}
      <span className="ms-1.5" /><Kbd>?</Kbd> {c('keys.help')}
    </span>
  )
}

// ---------- A — Three panes ------------------------------------------------------------

function VariantA({ onDialog }: { onDialog: (d: DialogState) => void }) {
  return (
    <div className="flex h-full min-w-0">
      <ViewsRail onDialog={(d) => onDialog(d)} />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="shrink-0 border-b border-border bg-card px-3 py-2">
          <QueryTokens />
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-1 px-3 py-1.5">
          <ViewTitle />
          <RowSummary />
          <span className="flex-1" />
          <GridTools />
        </div>
        <GridRegion />
        <StatusBar />
      </div>
      <Inspector />
    </div>
  )
}

// ---------- B — Grid first ------------------------------------------------------------------

function VariantB({ onDialog }: { onDialog: (d: DialogState) => void }) {
  return (
    <div className="flex h-full min-w-0">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 items-start gap-2 border-b border-border bg-card px-3 py-2">
          <ViewsMenu onDialog={(d) => onDialog(d)} />
          <span className="mt-0.5 h-6 w-px bg-border" aria-hidden />
          <div className="min-w-0 flex-1">
            <QueryTokens />
          </div>
        </div>
        <div className="flex shrink-0 items-end gap-x-3 border-b border-border px-2">
          <div className="min-w-0 flex-1"><LensTabs /></div>
          <span className="shrink-0 pb-1.5"><RowSummary /></span>
          <span className="shrink-0 pb-0.5"><GridTools iconOnly /></span>
        </div>
        <GridRegion />
      </div>
      <Inspector />
    </div>
  )
}

// ---------- C — Labelled panel ----------------------------------------------------------------

function VariantC({ onDialog }: { onDialog: (d: DialogState) => void }) {
  const criteriaOpen = useProto((s) => s.criteriaOpen)
  return (
    <div className="flex h-full min-w-0">
      <CriteriaPanel />
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-3 py-1.5">
          <h1 className="text-[13px] font-semibold">{c('title')}</h1>
          <ViewsMenu onDialog={(d) => onDialog(d)} />
          <RowSummary />
          <span className="flex-1" />
          <GridTools />
        </div>
        {!criteriaOpen && (
          <div className="shrink-0 border-b border-divider px-3 py-1">
            <AppliedSummary />
          </div>
        )}
        <div className="flex shrink-0 flex-wrap items-end gap-x-3 border-b border-border px-2">
          <LensTabs />
        </div>
        <GridRegion />
        <StatusBar />
      </div>
      <Inspector />
    </div>
  )
}

const VARIANTS = [
  { key: 'A', name: 'Three panes (Far, corrected)' },
  { key: 'B', name: 'Grid first — lens tabs, views menu' },
  { key: 'C', name: 'Labelled criteria panel' },
]

export default function Proto368() {
  const [params, setParams] = useSearchParams()
  const variant = params.get('variant') ?? 'A'
  const scenario = params.get('scenario') ?? 'open'
  const [dialog, setDialog] = useState<DialogState>(null)
  useListKeys()

  useEffect(() => {
    const s = useProto.getState()
    // A fresh mount with no in-memory search: the starred default applies AND runs (366).
    if (!params.get('scenario') && s.rows === null && !s.applied) {
      const def = s.views.find((v) => v.starred)
      if (def) applyView(def.id)
      return
    }
    if (params.get('scenario')) void seedScenario(scenario)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenario])

  const pick = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    setParams(next, { replace: true })
  }

  return (
    <div className="-m-4 h-[calc(100dvh-3rem-1.4rem)] overflow-hidden bg-background" data-proto-368={variant}>
      {variant === 'A' && <VariantA onDialog={setDialog} />}
      {variant === 'B' && <VariantB onDialog={setDialog} />}
      {variant === 'C' && <VariantC onDialog={setDialog} />}
      <ViewNameDialog state={dialog} onClose={() => setDialog(null)} />
      <PrototypeSwitcher
        variants={VARIANTS}
        variant={variant}
        onVariant={(k) => pick('variant', k)}
        scenarios={SCENARIOS}
        scenario={scenario}
        onScenario={(k) => pick('scenario', k)}
      />
    </div>
  )
}
