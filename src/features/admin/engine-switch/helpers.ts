import type { PromotionEngine, RuleEngineInFlight, StoreEngineChange, StoreEngineFlip, StoreEngineLookupItem } from '@/core/models/rule-campaign'

// The store engine switch's pure logic (ticket 517, re-pointed in 528): the engine a store reads,
// the flip's form and what follows it, and the list's filter kept in the address.

export const ENGINES: readonly PromotionEngine[] = ['BonusBuy', 'Rule']

/** The most stores one search answers (HQ's lookup cap): the list asks the admin to narrow. */
export const STORES_CAP = 50

/** One store as the switch lists it. */
export interface StoreEngineRow {
  storeCode: string
  storeName: string
  engine: PromotionEngine
}

/** The engine a stored value means (ADR 0093): only an exact `Rule` is the rule engine; anything
 *  else, a missing row included, is bonus buys. */
export const engineOf = (value: string | null | undefined): PromotionEngine => (value === 'Rule' ? 'Rule' : 'BonusBuy')

/** The stores lookup's answers as the list's rows: the engine is the answer's `detail`; the name is
 *  the English one (HQ's store master has no other), the Arabic only when it is all there is. */
export const storeRows = (items: StoreEngineLookupItem[]): StoreEngineRow[] =>
  items.map((s) => ({ storeCode: s.code, storeName: s.name.en || s.name.ar, engine: engineOf(s.detail) }))

/** The engine a flip moves the store to: the other one. */
export const flipTarget = (engine: PromotionEngine): PromotionEngine => (engine === 'Rule' ? 'BonusBuy' : 'Rule')

export type FlipForm = { ok: true; body: StoreEngineFlip } | { ok: false; error: 'reasonRequired' }

/** The flip as it is sent: the store, the engine it moves to, and the reason — required, and sent
 *  trimmed. No `from`: HQ reads it itself, under a lock. */
export function flipForm(storeCode: string, engine: PromotionEngine, reason: string): FlipForm {
  const r = reason.trim()
  return r ? { ok: true, body: { storeCode, engine, reason: r } } : { ok: false, error: 'reasonRequired' }
}

/** HQ's refusal of a blank reason: the reason box is the field to mark. */
export const REASON_REQUIRED = 'RULES_REASON_REQUIRED'

/** How many things HQ says are in flight; none when it warned of nothing. */
export const inFlightCount = (w: RuleEngineInFlight | null): number =>
  w ? w.liveCampaigns.length + w.openSessions.length + w.storeBudgets.length : 0

/** A flip HQ answered from the engine it moved to: another admin had already flipped the store. */
export const wasAlreadyOn = (change: StoreEngineChange): boolean => change.fromEngine === change.engine

/** What follows a flip: the in-flight list when HQ warned of something still in flight (only ever on
 *  Rule → BonusBuy), else the dialog closes. */
export const afterFlip = (change: StoreEngineChange): 'inFlight' | 'done' => (inFlightCount(change.inFlight) > 0 ? 'inFlight' : 'done')

/** The list's filter and the store whose history is open, as the address keeps them. The search is
 *  HQ's (code prefix or name); the engine filter narrows its answer here. */
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

/** The stores the engine filter keeps. */
export const filterByEngine = (rows: StoreEngineRow[], engine: PromotionEngine | null): StoreEngineRow[] =>
  engine ? rows.filter((r) => r.engine === engine) : rows
