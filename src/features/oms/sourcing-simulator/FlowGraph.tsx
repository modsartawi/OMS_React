import { useMemo, type CSSProperties } from 'react'
import { Background, Controls, MiniMap, Position, ReactFlow, useEdgesState, useNodesState, type Edge, type Node } from '@xyflow/react'
// The library's stylesheet rides in this lazily loaded chunk with the library itself (spec 4354 §19).
import '@xyflow/react/dist/style.css'
import { CHART_BOX_DIR, chartMirror } from '@/core/charts/direction'
import { CHART_INK, slotColour } from '@/core/charts/slots'
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'
import { fsi, formatPair } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { flowGraph, type FlowNode } from './flow-graph-model'
import { clock } from './tried-model'
import { usePlanWords } from './use-plan-words'

const COLUMN_X = [0, 290, 560, 860] as const
const COLUMN_WIDTH = [220, 210, 260, 220] as const
const STEP = 52

const BASE: CSSProperties = {
  background: 'var(--card)',
  color: 'var(--foreground)',
  border: '1px solid var(--border-strong)',
  borderRadius: 4,
  fontSize: 11,
  padding: 6,
}

/** The library's own chrome, themed from the app's tokens so light and dark follow the cascade. */
const CANVAS_TOKENS = {
  '--xy-background-color': 'var(--card)',
  '--xy-background-pattern-color': 'var(--divider)',
  '--xy-minimap-background-color': 'var(--card)',
  '--xy-controls-button-background-color': 'var(--card)',
  '--xy-controls-button-background-color-hover': 'var(--accent)',
  '--xy-controls-button-color': 'var(--foreground)',
  '--xy-controls-button-color-hover': 'var(--foreground)',
  '--xy-controls-button-border-color': 'var(--border)',
  '--xy-edge-stroke': CHART_INK.other,
} as CSSProperties

/**
 * The flow graph (ticket 966, spec 4354 §19), drawn with React Flow (`@xyflow/react`, MIT; its attribution mark is
 * kept). This module is loaded only when the graph opens (`./SolverPanel`'s `lazy`), so neither the library nor its
 * stylesheet reaches the main bundle.
 *
 * Cart lines → the pairs that can serve a line → the selected plan's shipments → the plan (`./flow-graph-model`). Grey
 * for could have served; the selected plan's path coloured by its shipment's slot and animated. Boxes drag; the ground
 * zooms and pans; the controls and a mini-map stand in the corners.
 *
 * Like every chart it sits in a `dir="ltr"` box and mirrors through its own geometry: under Arabic the columns run from
 * the right, and each box's text takes its own direction.
 */
export default function FlowGraph({ reply, plan }: { reply: AdviseReply; plan: AdvisePlan | undefined }) {
  const w = usePlanWords()
  const { t } = w
  const model = useMemo(() => flowGraph(reply, plan), [reply, plan])
  const rtl = chartMirror.rtl

  const drawn = useMemo(() => {
    if (!model) return null
    const counts = [0, 0, 0, 0]
    for (const n of model.nodes) counts[n.column]++
    const rows = Math.max(...counts, 1)
    const width = COLUMN_X[3] + COLUMN_WIDTH[3]
    const x = (n: FlowNode) => (rtl ? width - COLUMN_X[n.column] - COLUMN_WIDTH[n.column] : COLUMN_X[n.column])
    const y = (n: FlowNode) => n.row * STEP + ((rows - counts[n.column]) * STEP) / 2
    const label = (n: FlowNode): string => {
      switch (n.kind) {
        case 'line':
          return t('solver.flow.lineBox', { lineNo: fsi(n.lineNo), quantity: fsi(formatFigure(n.quantity)), item: fsi(n.item) })
        case 'pair':
          return formatPair(n.store, w.mode(n.mode))
        case 'shipment':
          return t('solver.flow.shipmentBox', { no: fsi(n.no), pair: fsi(formatPair(n.store, w.mode(n.mode))), time: fsi(clock(n.by)), cost: fsi(w.money(n.companyCost)) })
        case 'plan':
          return n.balanced === null ? t('solver.flow.planBoxNoSum', { label: fsi(w.said(n.label)) }) : t('solver.flow.planBox', { label: fsi(w.said(n.label)), amount: fsi(w.money(n.balanced)) })
      }
    }
    const style = (n: FlowNode): CSSProperties => {
      const width = COLUMN_WIDTH[n.column]
      if (n.kind === 'plan') return { ...BASE, width, background: 'var(--primary)', color: 'var(--primary-foreground)', border: '1px solid var(--primary)', fontWeight: 600 }
      if (n.kind === 'shipment') return { ...BASE, width, border: `2px solid ${slotColour(n.slot)}`, background: 'var(--primary-050)', fontWeight: 600 }
      if (n.kind === 'pair' && n.chosen) {
        const slot = plan?.shipments.findIndex((s) => s.store === n.store && s.mode === n.mode) ?? 0
        return { ...BASE, width, border: `2px solid ${slotColour(Math.max(0, slot))}`, background: 'var(--primary-050)', fontWeight: 600 }
      }
      return { ...BASE, width }
    }
    const nodes: Node[] = model.nodes.map((n) => ({
      id: n.id,
      type: n.kind === 'line' ? 'input' : n.kind === 'plan' ? 'output' : 'default',
      position: { x: x(n), y: y(n) },
      sourcePosition: rtl ? Position.Left : Position.Right,
      targetPosition: rtl ? Position.Right : Position.Left,
      data: {
        label: (
          <span dir="auto" className="block text-start" data-solver-flow-node={n.id}>
            {label(n)}
          </span>
        ),
      },
      style: style(n),
    }))
    const edges: Edge[] = model.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      animated: e.chosen,
      style: e.chosen ? { stroke: slotColour(e.slot), strokeWidth: 2.5 } : { stroke: CHART_INK.other, strokeWidth: 1, opacity: 0.35 },
    }))
    return { nodes, edges, height: Math.max(440, rows * STEP + 220) }
  }, [model, plan, rtl, t, w])

  if (!model || !drawn) {
    return (
      <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-solver-flow-none="">
        {t('solver.flow.none')}
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2" data-solver-flow="" data-solver-flow-nodes={drawn.nodes.length} data-solver-flow-edges={drawn.edges.length}>
      <div className="grid grid-cols-4 gap-2 text-[11px] font-semibold text-muted-foreground">
        <span>{t('solver.flow.columns.line')}</span>
        <span>{t('solver.flow.columns.pair', { serving: fsi(formatFigure(model.pairs.serving)), candidates: fsi(formatFigure(model.pairs.candidates)) })}</span>
        <span>{t('solver.flow.columns.shipment')}</span>
        <span>{t('solver.flow.columns.plan')}</span>
      </div>
      {/* 🚩 LOGICAL EXCEPTION (logical-tailwind rule): the canvas is always LTR and mirrors through its node positions. */}
      <div dir={CHART_BOX_DIR} className="w-full overflow-hidden rounded-md border border-border" style={{ height: drawn.height }} role="figure" aria-label={t('solver.flow.aria')}>
        <Canvas nodes={drawn.nodes} edges={drawn.edges} rtl={rtl} />
      </div>
      <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-0.5 w-5" style={{ background: slotColour(0) }} aria-hidden />
          {t('solver.flow.legendChosen')}
        </li>
        <li className="flex items-center gap-1.5">
          <span className="inline-block h-px w-5 opacity-50" style={{ background: CHART_INK.other }} aria-hidden />
          {t('solver.flow.legendCould')}
        </li>
      </ul>
      <p className="text-xs text-muted-foreground">{t('solver.flow.hint')}</p>
    </div>
  )
}

/** The library's canvas: boxes that drag, a ground that zooms and pans, the controls and a mini-map. */
function Canvas({ nodes: first, edges: firstEdges, rtl }: { nodes: Node[]; edges: Edge[]; rtl: boolean }) {
  const [nodes, , onNodesChange] = useNodesState(first)
  const [edges, , onEdgesChange] = useEdgesState(firstEdges)
  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      nodesConnectable={false}
      fitView
      fitViewOptions={{ padding: 0.08, maxZoom: 1 }}
      minZoom={0.3}
      style={CANVAS_TOKENS}
    >
      <Background gap={16} />
      {/* The mini-map stands at the plan's end of the graph, the controls at the lines' end. */}
      <Controls showInteractive={false} position={rtl ? 'bottom-right' : 'bottom-left'} />
      <MiniMap pannable zoomable nodeColor="var(--primary-border)" position={rtl ? 'bottom-left' : 'bottom-right'} />
    </ReactFlow>
  )
}
