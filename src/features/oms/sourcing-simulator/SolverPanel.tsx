import { Component, lazy, Suspense, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import Chip from '@/core/ui/Chip'
import FunnelDiagram from './FunnelDiagram'
import type { SimulatorTabProps } from './SimulatorTabs'
import StockPerLineTable from './StockPerLineTable'
import TradeOffChart from './TradeOffChart'
import TriedList from './TriedList'

/**
 * React Flow is a dependency of this one diagram (spec 4354 §19): its chunk, and its stylesheet, are asked for only
 * when the flow graph opens. Nothing else here imports `@xyflow/react`.
 */
const FlowGraph = lazy(() => import('./FlowGraph'))

const SOLVER_DIAGRAMS = ['funnel', 'stock', 'trade', 'tried', 'flow'] as const
type SolverDiagram = (typeof SOLVER_DIAGRAMS)[number]

/**
 * The simulator's Solver tab (ticket 966, BackOffice spec 4354 §19; SIMT "how it is drawn"): five diagrams of how the
 * solver got to the plans, from the full level of the run record — the funnel, the stock per line, the trade-off,
 * what was tried and the flow graph. One open at a time; each reads the reply, and the stock and the flow graph the
 * plan picked above the panel. Diagram ids are `sim-solver-<diagram>`; each tab carries `data-solver-diagram`, the
 * open diagram `data-solver-panel`.
 */
export default function SolverPanel({ reply, plan }: SimulatorTabProps) {
  const { t } = useTranslation('sourcing-simulator')
  const [open, setOpen] = useState<SolverDiagram>('funnel')
  return (
    <div className="flex flex-col gap-3" data-solver="">
      <h3 className="text-sm font-semibold">{t('solver.title')}</h3>
      <div role="tablist" aria-label={t('solver.diagramsLabel')} className="flex flex-wrap gap-1">
        {SOLVER_DIAGRAMS.map((d) => (
          <Chip
            key={d}
            variant="tab"
            on={open === d}
            id={`sim-solver-${d}`}
            aria-controls="sim-solver-panel"
            onClick={() => d !== open && setOpen(d)}
            data-solver-diagram={d}
          >
            {t(`solver.diagram.${d}`)}
          </Chip>
        ))}
      </div>
      <div role="tabpanel" id="sim-solver-panel" aria-labelledby={`sim-solver-${open}`} data-solver-panel={open}>
        {open === 'funnel' && <FunnelDiagram reply={reply} />}
        {open === 'stock' && <StockPerLineTable reply={reply} plan={plan} />}
        {open === 'trade' && <TradeOffChart reply={reply} />}
        {open === 'tried' && <TriedList reply={reply} />}
        {open === 'flow' && (
          <FlowGraphBoundary key={`${reply.runId}:${plan?.goal ?? ''}`}>
            <Suspense
              fallback={
                <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status" data-solver-flow-loading="">
                  <Loader2 className="size-4 animate-spin" aria-hidden />
                  {t('solver.flow.loading')}
                </p>
              }
            >
              <FlowGraph reply={reply} plan={plan} />
            </Suspense>
          </FlowGraphBoundary>
        )}
      </div>
    </div>
  )
}

/** The chunk can fail to load (a deploy replaced it, the network dropped): say so instead of blanking the tab. */
class FlowGraphBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  render() {
    return this.state.failed ? <FlowFailed /> : this.props.children
  }
}

function FlowFailed() {
  const { t } = useTranslation('sourcing-simulator')
  return (
    <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-solver-flow-failed="">
      {t('solver.flow.failed')}
    </p>
  )
}

