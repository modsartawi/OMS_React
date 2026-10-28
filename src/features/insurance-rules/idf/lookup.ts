/**
 * "Why this priority" — the IDF lookup, pure (BackOffice spec 3157, door 3168; oms ticket 625). For an item, store,
 * and optionally a payer (the insurer's customer id, e.g. `0001100336`), a document type, a sub-document type and a
 * Nphies claim type, the door runs the tills' own resolver and answers: the item (descriptions, IDF group), the tier
 * that decided (`sourceTier`) and its master, the tiers skipped before it with their reasons, the item's priority and
 * thresholds, any exception row that applied (3166), and the whole ranked IDF group with each row's source tier.
 *
 * Resolution order is fixed (the brief): insurer master scoped to a store list → insurer master → store (operation
 * pharmacy) master → general master. The screen READS the answer; it never re-resolves. `documentTypeCanForcePick` is
 * the server's cash rule: false (a cash-like type) means the till only reminds.
 *
 * Doors as built (3168, 3166): tiers are `insurerAtStoreList | insurer | store | general`, plus `exceptionMaster` when
 * an exception row's master decided; a skipped tier's `reason` is one of `notOnPilotList | notAnIdfItem | noPayer |
 * noMaster | masterDoesNotNameItem | unreadable | exceptionRow`, with `reasonEn` / `reasonAr` from the server.
 */
import { DEFAULT_HARD_THRESHOLD, DEFAULT_REMINDER_THRESHOLD, masterName, type IdfMaster, type IdfMasterKind } from './masters'
import type { IdfExceptionHandling, IdfExceptionKeyKind } from './exceptions'

/** The fixed resolution order, most specific first — the master form's help lists it. */
export const IDF_RESOLUTION_ORDER = ['insurerAtStoreList', 'insurer', 'store', 'general'] as const
/** Every tier the door can name: the order, and an exception row's master (3166). */
export const IDF_TIERS = [...IDF_RESOLUTION_ORDER, 'exceptionMaster'] as const
export type IdfTier = (typeof IDF_TIERS)[number]

/** Why a tier was skipped (3168, plus 3166's `exceptionRow`). */
export const IDF_SKIP_REASONS = ['notOnPilotList', 'notAnIdfItem', 'noPayer', 'noMaster', 'masterDoesNotNameItem', 'unreadable', 'exceptionRow'] as const

/** `GET IdfPriority/lookup` (3168). */
export interface IdfLookupAnswer {
  itemNumber: string
  descriptionEn?: string | null
  descriptionAr?: string | null
  idfNumber?: string | null
  storeCode?: string | null
  insurerCustomerId?: string | null
  documentType?: string | null
  /** null without a document type; false for a cash-like type (the till only reminds). */
  documentTypeCanForcePick?: boolean | null
  /** null when the general master decided. */
  decidingMaster: { masterId: string; kind: IdfMasterKind; versionId?: string | null; nameEn?: string | null; nameAr?: string | null } | null
  /** The exception row that applied (3166), or null. */
  exception?: { exceptionId: string; keyKind: IdfExceptionKeyKind | string; key: string; handling: IdfExceptionHandling | string; masterId?: string | null; allStores?: boolean | null } | null
  sourceTier: string
  skippedTiers: { tier: string; reason?: string | null; masterId?: string | null; reasonEn: string; reasonAr: string }[]
  priority: number | null
  hardThreshold?: number | null
  reminderThreshold?: number | null
  group: { itemNumber: string; descriptionEn: string; descriptionAr: string; priority: number; sourceTier: string }[]
}

/** The search, kept in the URL. `payer` is the insurer's customer id ('' = no payer). */
export interface IdfLookupQuery {
  item: string
  store: string
  payer: string
  documentType: string
  subDocumentType: string
  nphiesClaimType: string
}

export const IDF_LOOKUP_FIELDS = ['item', 'store', 'payer', 'documentType', 'subDocumentType', 'nphiesClaimType'] as const

export function lookupFromParams(params: URLSearchParams): IdfLookupQuery {
  const read = (k: string) => (params.get(k) ?? '').trim()
  return {
    item: read('item'),
    store: read('store'),
    payer: read('payer'),
    documentType: read('documentType'),
    subDocumentType: read('subDocumentType'),
    nphiesClaimType: read('nphiesClaimType'),
  }
}

export function lookupToParams(q: IdfLookupQuery): URLSearchParams {
  const out = new URLSearchParams()
  for (const k of IDF_LOOKUP_FIELDS) if (q[k].trim()) out.set(k, q[k].trim())
  return out
}

/** The door is asked once item and store are given; the payer is optional (blank = none, 3168). */
export function isLookupReady(q: IdfLookupQuery): boolean {
  return Boolean(q.item && q.store)
}

/** The door's params: every field named, blanks as '' (core `buildQuery` drops them). */
export function lookupDoorParams(q: IdfLookupQuery): Record<string, string> {
  return {
    item: q.item,
    store: q.store,
    payer: q.payer,
    documentType: q.documentType,
    subDocumentType: q.subDocumentType,
    nphiesClaimType: q.nphiesClaimType,
  }
}

export interface IdfLookupView {
  item: { itemNumber: string; description: string; idfNumber: string | null }
  insurerCustomerId: string | null
  decidingTier: string
  /** null when the general master decided. `name` null when neither the answer nor the masters list names it. */
  master: { masterId: string; kind: IdfMasterKind; name: string | null; version: string | null } | null
  priority: number | null
  hard: number
  reminder: number
  skipped: { tier: string; reason: string; reasonCode: string | null; masterId: string | null }[]
  exception: NonNullable<IdfLookupAnswer['exception']> | null
  group: { itemNumber: string; description: string; priority: number; sourceTier: string; isLookedUp: boolean }[]
  /** The server's cash rule applies: a document type was given and it cannot force a pick. */
  cashNeverForces: boolean
}

const byLang = (en: string | null | undefined, ar: string | null | undefined, lang: string) =>
  (lang.startsWith('ar') && ar ? ar : en || ar) ?? ''
/** A tier's place: an exception's master first, then the fixed order; a tier this screen does not know goes last. */
const RANK: readonly string[] = ['exceptionMaster', ...IDF_RESOLUTION_ORDER]
const rank = (tier: string) => {
  const i = RANK.indexOf(tier)
  return i < 0 ? RANK.length : i
}

/** A version shown by its number when it is the master's live one, else by its id. */
export function versionLabel(masters: IdfMaster[], masterId: string | null | undefined, versionId: string | null | undefined): string | null {
  if (!versionId) return null
  const live = masters.find((m) => m.masterId === masterId)?.liveVersion
  return live && live.versionId === versionId ? String(live.number) : versionId
}

export function lookupView(a: IdfLookupAnswer, q: IdfLookupQuery, lang: string, masters: IdfMaster[] = []): IdfLookupView {
  const skipped = [...(a.skippedTiers ?? [])]
    .map((s, i) => ({ s, i }))
    .sort((x, y) => rank(x.s.tier) - rank(y.s.tier) || x.i - y.i)
    .map(({ s }) => ({ tier: s.tier, reason: byLang(s.reasonEn, s.reasonAr, lang), reasonCode: s.reason || null, masterId: s.masterId || null }))

  let master: IdfLookupView['master'] = null
  const d = a.decidingMaster
  if (d) {
    const known = masters.find((m) => m.masterId === d.masterId)
    const own = d.nameEn || d.nameAr ? byLang(d.nameEn, d.nameAr, lang) : null
    master = {
      masterId: d.masterId,
      kind: d.kind,
      name: own ?? (known ? masterName(known, lang) : null),
      version: versionLabel(masters, d.masterId, d.versionId),
    }
  }

  const item = (q.item || a.itemNumber || '').trim()
  return {
    item: { itemNumber: a.itemNumber || q.item, description: byLang(a.descriptionEn, a.descriptionAr, lang), idfNumber: a.idfNumber || null },
    insurerCustomerId: a.insurerCustomerId || null,
    decidingTier: a.sourceTier || 'general',
    master,
    priority: a.priority ?? null,
    hard: a.hardThreshold ?? DEFAULT_HARD_THRESHOLD,
    reminder: a.reminderThreshold ?? DEFAULT_REMINDER_THRESHOLD,
    skipped,
    exception: a.exception ?? null,
    group: (a.group ?? []).map((g) => ({
      itemNumber: g.itemNumber,
      description: byLang(g.descriptionEn, g.descriptionAr, lang),
      priority: g.priority,
      sourceTier: g.sourceTier,
      isLookedUp: g.itemNumber.trim() === item,
    })),
    cashNeverForces: a.documentTypeCanForcePick === false,
  }
}
