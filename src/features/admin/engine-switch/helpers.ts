import type { PromotionEngine, StoreEngineFlip, StoreEngineInFlight, StoreEngineRow } from '@/core/models/rule-campaign'

// The store engine switch's pure logic (ticket 517): the engine a row reads, the flip's steps and
// its form, and the list's filter kept in the address.

export const ENGINES: readonly PromotionEngine[] = ['BonusBuy', 'Rule']

/** A store HQ holds no row for runs bonus buys (ADR 0093). */
export const engineOf = (row: Pick<StoreEngineRow, 'engine'>): PromotionEngine => row.engine ?? 'BonusBuy'

/** The engine a flip moves the store to: the other one. */
export const flipTarget = (engine: PromotionEngine): PromotionEngine => (engine === 'Rule' ? 'BonusBuy' : 'Rule')

export type FlipStep = 'inFlight' | 'reason'

/** A flip back to bonus buys first shows HQ's in-flight warning — which never blocks; a flip to the
 *  rule engine goes straight to the reason. */
export const firstFlipStep = (target: PromotionEngine): FlipStep => (target === 'BonusBuy' ? 'inFlight' : 'reason')

export type FlipForm = { ok: true; body: StoreEngineFlip } | { ok: false; error: 'reasonRequired' }

/** The flip as it is sent: the engine the admin saw it on (so HQ can refuse a flip another admin
 *  has overtaken), the engine it moves to, and the reason — required, and sent trimmed. */
export function flipForm(storeCode: string, from: PromotionEngine, engine: PromotionEngine, reason: string): FlipForm {
  const r = reason.trim()
  return r ? { ok: true, body: { storeCode, from, engine, reason: r } } : { ok: false, error: 'reasonRequired' }
}

/** How many things HQ says are in flight. */
export const inFlightCount = (w: StoreEngineInFlight): number => w.liveCampaigns.length + w.openSessions.length + w.budgets.length

/** The list's filter and the store whose history is open, as the address keeps them. */
export interface SwitchQuery {
  search: string
  engine: PromotionEngine | null
  store: string
}

export function switchQueryFromParams(params: URLSearchParams): SwitchQuery {
  const engine = params.get('engine')
  return {
    search: params.get('search') ?? '',
    engine: ENGINES.includes(engine as PromotionEngine) ? (engine as PromotionEngine) : null,
    store: params.get('store') ?? '',
  }
}

export function switchQueryToParams(q: SwitchQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (q.search) p.set('search', q.search)
  if (q.engine) p.set('engine', q.engine)
  if (q.store) p.set('store', q.store)
  return p
}

/** The stores the search (code or name, any case) and the engine filter keep. */
export function filterStores(rows: StoreEngineRow[], q: SwitchQuery): StoreEngineRow[] {
  const s = q.search.trim().toLowerCase()
  return rows.filter(
    (r) => (!s || r.storeCode.toLowerCase().includes(s) || r.storeName.toLowerCase().includes(s)) && (!q.engine || engineOf(r) === q.engine),
  )
}
