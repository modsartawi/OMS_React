/**
 * IDF priority masters, pure (BackOffice spec 3157, door 3161; oms ticket 619). A master is an insurer's (by the
 * insurer's customer id — `insurerCustomerId`, the key `ItemCustomer` uses, e.g. `0001100336` — optionally scoped to a
 * store list) or a store master (a store list: the operation pharmacies). Its
 * thresholds read "hard above N, reminder above M", defaulting to 4 and 1. The live version is the one in force; a
 * master may have none yet.
 *
 * Resolution order is fixed (the brief): insurer master scoped to a store list → insurer master → operation
 * pharmacy (store) master → general master.
 *
 * 🧭 Layout for 620–627: this file is the masters' model (619 list, 621 form, 622 upload and 623 versions READ
 * these types). Each later leaf keeps its OWN types and logic in its OWN file beside this one — `store-lists.ts`
 * (620), `master-form.ts` (621), `upload.ts` (622), `versions.ts` (623), `exceptions.ts` (624), `lookup.ts` (625),
 * `events.ts` (626), `swap-report.ts` (627) — so parallel slices never edit the same hunk here.
 */

/** The kinds a master is created / edited as (621's kind radios). */
export const IDF_MASTER_KINDS = ['insurer', 'store'] as const
export type IdfMasterKind = (typeof IDF_MASTER_KINDS)[number]

/**
 * 647 · every kind the masters list shows: the editable ones plus `general` — the general master (tier 4,
 * BackOffice 3191), always sent by `GET IdfPriority/masters` as `{ masterId: 'general', kind: 'general', … }` with no
 * version and no thresholds. It is not created, edited, versioned or restored here; its page is
 * `/insurance-rules/idf/general`.
 */
export const IDF_LISTED_KINDS = [...IDF_MASTER_KINDS, 'general'] as const
export type IdfListedKind = (typeof IDF_LISTED_KINDS)[number]

/** 647 · the general master's own page. */
export const IDF_GENERAL_PATH = '/insurance-rules/idf/general'

/** The thresholds a master falls back to when it sends none (the brief). */
export const DEFAULT_HARD_THRESHOLD = 4
export const DEFAULT_REMINDER_THRESHOLD = 1

/**
 * A version row (3161: `{ versionId, number, by, at, note, entryCount, isLive }`), also a master's `liveVersion` and
 * the answer to publish / restore. `at` is local wall-clock, no `Z`.
 */
export interface IdfMasterVersion {
  versionId: string
  number: number
  by: string
  at: string
  note?: string | null
  entryCount?: number | null
  isLive?: boolean | null
}

/** A row of `GET IdfPriority/masters`. */
export interface IdfMaster {
  masterId: string
  kind: IdfListedKind
  /** The insurer's customer id (3161 D4), e.g. `0001100336`; empty on a store master. Never upper-cased or reshaped. */
  insurerCustomerId?: string | null
  storeListId?: string | null
  nameEn: string
  nameAr: string
  hardThreshold?: number | null
  reminderThreshold?: number | null
  liveVersion?: IdfMasterVersion | null
}

/** What the masters list draws for one master. */
export interface IdfMasterRow {
  masterId: string
  kind: IdfListedKind
  insurerCustomerId: string | null
  storeListId: string | null
  name: string
  /** null on the general master (647): it has no thresholds. */
  hard: number | null
  reminder: number | null
  live: { number: number; by: string; at: string; note: string | null } | null
  /** 647 · false on the general master: no Edit on its row. */
  editable: boolean
  /** Where its name links: the master's page, or the General page. */
  href: string
}

/** The master's name in the reader's language; English when the Arabic is blank. */
export function masterName(m: Pick<IdfMaster, 'nameEn' | 'nameAr'>, lang: string): string {
  return lang.startsWith('ar') && m.nameAr ? m.nameAr : m.nameEn || m.nameAr
}

export function masterRow(m: IdfMaster, lang: string): IdfMasterRow {
  if (m.kind === 'general')
    return {
      masterId: m.masterId,
      kind: 'general',
      insurerCustomerId: null,
      storeListId: null,
      name: masterName(m, lang),
      hard: null,
      reminder: null,
      live: null,
      editable: false,
      href: IDF_GENERAL_PATH,
    }
  const v = m.liveVersion
  return {
    masterId: m.masterId,
    kind: m.kind,
    insurerCustomerId: m.insurerCustomerId || null,
    storeListId: m.storeListId || null,
    name: masterName(m, lang),
    hard: m.hardThreshold ?? DEFAULT_HARD_THRESHOLD,
    reminder: m.reminderThreshold ?? DEFAULT_REMINDER_THRESHOLD,
    live: v ? { number: v.number, by: v.by, at: v.at, note: v.note ?? null } : null,
    editable: true,
    href: `/insurance-rules/idf/masters/${encodeURIComponent(m.masterId)}`,
  }
}

/** 647 · a master the list edits (621): an insurer or store master, never the general one. */
export type EditableIdfMaster = IdfMaster & { kind: IdfMasterKind }

/** 647 · the masters a ranking picker offers (events' master filter, an exception's master): the general one left out. */
export function rankedMasters<M extends Pick<IdfMaster, 'kind'>>(masters: readonly M[]): M[] {
  return masters.filter((m) => m.kind !== 'general')
}
