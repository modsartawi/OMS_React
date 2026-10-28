/**
 * "Why this priority" — the IDF lookup, pure (BackOffice spec 3157, door 3168; oms ticket 625). For an item, store,
 * payer and (optionally) document type, the door runs the tills' own resolver and answers the deciding master, the
 * tiers skipped before it with their reasons, the item's priority and thresholds, and the ranked IDF group with each
 * row's source tier.
 *
 * Resolution order is fixed (the brief): insurer master scoped to a store list → insurer master → operation pharmacy
 * (store) master → general master. The screen READS that order; it never re-resolves. The cash rule (cash never
 * forces a pick) is the server's: shown only when the answer carries it.
 *
 * 🚩 The brief does not spell the tier values; `IDF_TIERS` is this ticket's spelling (camelCase, like `kind`) and
 * 628 reconciles with 3168. Nor does it name the deciding master: the page joins it to the masters list (619's door)
 * by `masterId`, and shows the version's number when it is that master's live one, else the version id.
 */
import { DEFAULT_HARD_THRESHOLD, DEFAULT_REMINDER_THRESHOLD, masterName, type IdfMaster, type IdfMasterKind } from './masters'

export const IDF_TIERS = ['insurerStoreList', 'insurer', 'operationPharmacy', 'general'] as const
export type IdfTier = (typeof IDF_TIERS)[number]

/** `GET IdfPriority/lookup` (3168). */
export interface IdfLookupAnswer {
  /** null when the general master (the item's own priority) decided. */
  /** `tier`, when the answer carries it (not in the brief's sketch; 628 reconciles), is preferred if it fits the kind. */
  decidingMaster: { masterId: string; kind: IdfMasterKind; versionId?: string | null; tier?: string | null } | null
  skippedTiers: { tier: string; reasonEn: string; reasonAr: string }[]
  priority: number | null
  hardThreshold?: number | null
  reminderThreshold?: number | null
  group: { itemNumber: string; descriptionEn: string; descriptionAr: string; priority: number; sourceTier: string }[]
  /** The server's cash rule, when it says it applies (not in the brief's sketch; 628 reconciles). */
  cashNeverForces?: boolean | null
}

/** The search, kept in the URL. */
export interface IdfLookupQuery {
  item: string
  store: string
  payer: string
  documentType: string
}

const FIELDS = ['item', 'store', 'payer', 'documentType'] as const

export function lookupFromParams(params: URLSearchParams): IdfLookupQuery {
  const read = (k: string) => (params.get(k) ?? '').trim()
  return { item: read('item'), store: read('store'), payer: read('payer'), documentType: read('documentType') }
}

export function lookupToParams(q: IdfLookupQuery): URLSearchParams {
  const out = new URLSearchParams()
  for (const k of FIELDS) if (q[k].trim()) out.set(k, q[k].trim())
  return out
}

/** The door is asked only when item, store and payer are all given. */
export function isLookupReady(q: IdfLookupQuery): boolean {
  return Boolean(q.item && q.store && q.payer)
}

export interface IdfLookupView {
  decidingTier: string
  /** null when the general master decided. `name` null when the masters list does not know it. */
  master: { masterId: string; kind: IdfMasterKind; name: string | null; version: string | null } | null
  priority: number | null
  hard: number
  reminder: number
  skipped: { tier: string; reason: string }[]
  group: { itemNumber: string; description: string; priority: number; sourceTier: string; isLookedUp: boolean }[]
  cashNeverForces: boolean
}

const byLang = (en: string, ar: string, lang: string) => (lang.startsWith('ar') && ar ? ar : en || ar)
/** A tier's place in the fixed order; a tier this screen does not know goes last. */
const rank = (tier: string) => {
  const i = (IDF_TIERS as readonly string[]).indexOf(tier)
  return i < 0 ? IDF_TIERS.length : i
}

/**
 * The tier that decided, read off the deciding master — never inferred from the skipped list, so it never contradicts
 * the kind badge: none → general; a store master → operation pharmacy; an insurer master → insurer + store list when
 * the answer says so or the masters list has it scoped to a store list, else insurer.
 */
export function decidingTierOf(d: IdfLookupAnswer['decidingMaster'], masters: IdfMaster[] = []): IdfTier {
  if (!d) return 'general'
  if (d.kind === 'store') return 'operationPharmacy'
  if (d.tier === 'insurerStoreList' || d.tier === 'insurer') return d.tier
  return masters.find((m) => m.masterId === d.masterId)?.storeListId ? 'insurerStoreList' : 'insurer'
}

export function lookupView(a: IdfLookupAnswer, q: IdfLookupQuery, lang: string, masters: IdfMaster[] = []): IdfLookupView {
  const skipped = [...a.skippedTiers]
    .map((s, i) => ({ s, i }))
    .sort((x, y) => rank(x.s.tier) - rank(y.s.tier) || x.i - y.i)
    .map(({ s }) => ({ tier: s.tier, reason: byLang(s.reasonEn, s.reasonAr, lang) }))
  const decidingTier = decidingTierOf(a.decidingMaster, masters)

  let master: IdfLookupView['master'] = null
  if (a.decidingMaster) {
    const known = masters.find((m) => m.masterId === a.decidingMaster!.masterId)
    const versionId = a.decidingMaster.versionId || null
    const live = known?.liveVersion
    master = {
      masterId: a.decidingMaster.masterId,
      kind: a.decidingMaster.kind,
      name: known ? masterName(known, lang) : null,
      version: live && versionId && live.versionId === versionId ? String(live.number) : versionId,
    }
  }

  const item = q.item.trim()
  return {
    decidingTier,
    master,
    priority: a.priority ?? null,
    hard: a.hardThreshold ?? DEFAULT_HARD_THRESHOLD,
    reminder: a.reminderThreshold ?? DEFAULT_REMINDER_THRESHOLD,
    skipped,
    group: (a.group ?? []).map((g) => ({
      itemNumber: g.itemNumber,
      description: byLang(g.descriptionEn, g.descriptionAr, lang),
      priority: g.priority,
      sourceTier: g.sourceTier,
      isLookedUp: g.itemNumber.trim() === item,
    })),
    cashNeverForces: a.cashNeverForces === true,
  }
}
