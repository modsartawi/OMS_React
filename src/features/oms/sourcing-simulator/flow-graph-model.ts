/**
 * The flow graph's boxes and lines (ticket 966, BackOffice spec 4354 §19; the run record 4242: "the flow graph needs
 * nothing of its own: it is drawn from the stock working and the selected plan"). Pure, and free of the graph library:
 * `./FlowGraph` turns these into React Flow's nodes and edges, so the library stays in its own lazily loaded chunk.
 *
 * Four columns: the cart lines → the pairs that can serve a line → the selected plan's shipments → the plan.
 * - The pairs are the candidates the search worked out (`search.whyNot[]` rows with no `removedAt`), with the selected
 *   plan's own pairs first. A pair serves a line when its store's offered stock covers the quantity
 *   (`inputs.storeLines[]`) and no step removed that pair for that line; a chosen pair serves the lines its shipment
 *   carries, a figure-short line included.
 * - A line is chosen when it is on the selected plan's path; it takes its shipment's colour slot. Every other line is
 *   grey ("could have served").
 */
import type { AdvisePlan, AdviseReply, Bilingual, DeliveryMode, PlanGoal } from '@/core/models/sourcing-run'
import { storeNames } from './stock-per-line-model'

interface NodeBase {
  id: string
  column: 0 | 1 | 2 | 3
  /** The box's place in its column, from the top. */
  row: number
}

export type FlowNode =
  | (NodeBase & { kind: 'line'; lineNo: number; item: string; quantity: number })
  | (NodeBase & { kind: 'pair'; store: string; storeName: string | null; mode: DeliveryMode | string; chosen: boolean })
  | (NodeBase & { kind: 'shipment'; no: number; store: string; mode: DeliveryMode | string; by: string; companyCost: number; slot: number })
  | (NodeBase & { kind: 'plan'; goal: PlanGoal; label: Bilingual; balanced: number | null })

export interface FlowEdge {
  id: string
  source: string
  target: string
  chosen: boolean
  /** The chosen shipment's colour slot (0 for the first shipment); `null` for a grey "could have served" line. */
  slot: number | null
}

export interface FlowGraphModel {
  nodes: FlowNode[]
  edges: FlowEdge[]
  /** The pairs drawn (serving a line) out of the candidates. */
  pairs: { serving: number; candidates: number }
}

const pairId = (store: string, mode: string) => `pair:${store}:${mode}`

/** The graph for the selected plan; `null` with no plan or without the middle level's stock working. */
export function flowGraph(reply: Pick<AdviseReply, 'lines' | 'inputs' | 'plans' | 'search' | 'filterSteps'>, plan: AdvisePlan | undefined): FlowGraphModel | null {
  const storeLines = reply.inputs?.storeLines
  if (!plan || !storeLines) return null
  const names = storeNames(reply)

  // The candidate pairs: the plan's own first, by shipment, then the search's in its order.
  const pairs: { store: string; mode: string }[] = []
  const seen = new Set<string>()
  const add = (store: string, mode: string) => {
    const id = pairId(store, mode)
    if (!seen.has(id)) {
      seen.add(id)
      pairs.push({ store, mode })
    }
  }
  plan.shipments.forEach((s) => add(s.store, s.mode))
  for (const w of reply.search?.whyNot ?? []) if (w.removedAt === undefined && !w.code) add(w.store, w.mode)

  const offered = new Map(storeLines.map((r) => [`${r.store}|${r.lineNo}`, r.offered]))
  const removedForLine = new Set(
    (reply.filterSteps ?? []).flatMap((s) => s.removed.filter((r) => r.lineNo !== undefined).map((r) => `${pairId(r.store, r.mode)}|${r.lineNo}`)),
  )
  /** The index of the selected plan's shipment from this pair carrying the line, or -1. */
  const shipmentFor = (store: string, mode: string, lineNo: number) => plan.shipments.findIndex((s) => s.store === store && s.mode === mode && s.lines.includes(lineNo))

  const lineNodes: FlowNode[] = reply.lines.map((l, row) => ({ kind: 'line', id: `line:${l.lineNo}`, column: 0, row, lineNo: l.lineNo, item: l.item, quantity: l.quantity }))
  const pairNodes: FlowNode[] = []
  const lineEdges: FlowEdge[] = []
  for (const p of pairs) {
    const id = pairId(p.store, p.mode)
    const served: FlowEdge[] = []
    for (const l of reply.lines) {
      const ship = shipmentFor(p.store, p.mode, l.lineNo)
      const covers = (offered.get(`${p.store}|${l.lineNo}`) ?? 0) >= l.quantity && !removedForLine.has(`${id}|${l.lineNo}`)
      if (ship < 0 && !covers) continue
      served.push({ id: `line:${l.lineNo}>${id}`, source: `line:${l.lineNo}`, target: id, chosen: ship >= 0, slot: ship >= 0 ? ship : null })
    }
    if (!served.length) continue
    lineEdges.push(...served)
    const chosen = plan.shipments.some((s) => s.store === p.store && s.mode === p.mode)
    pairNodes.push({ kind: 'pair', id, column: 1, row: pairNodes.length, store: p.store, storeName: names.get(p.store) ?? null, mode: p.mode, chosen })
  }

  const shipNodes: FlowNode[] = plan.shipments.map((s, i) => ({
    kind: 'shipment',
    id: `ship:${s.no}`,
    column: 2,
    row: i,
    no: s.no,
    store: s.store,
    mode: s.mode,
    by: s.promise.by,
    companyCost: s.companyCost,
    slot: i,
  }))
  const planNode: FlowNode = { kind: 'plan', id: 'plan', column: 3, row: 0, goal: plan.goal, label: plan.label, balanced: plan.sum?.total ?? null }
  const shipEdges: FlowEdge[] = plan.shipments.map((s, i) => ({ id: `${pairId(s.store, s.mode)}>ship:${s.no}`, source: pairId(s.store, s.mode), target: `ship:${s.no}`, chosen: true, slot: i }))
  const planEdges: FlowEdge[] = plan.shipments.map((s, i) => ({ id: `ship:${s.no}>plan`, source: `ship:${s.no}`, target: 'plan', chosen: true, slot: i }))

  return {
    nodes: [...lineNodes, ...pairNodes, ...shipNodes, planNode],
    edges: [...lineEdges, ...shipEdges, ...planEdges],
    pairs: { serving: pairNodes.length, candidates: pairs.length },
  }
}
