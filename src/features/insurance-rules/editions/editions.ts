/**
 * Reference editions, pure (BackOffice 3138; oms ticket 613): the SFDA Human Drug List and the CHI Drug
 * Formulary are uploaded as editions, diffed against the live one, published by a SECOND user, and each
 * carries a gap report for the master-file team. Old editions are read-only.
 *
 * ⚠️ The brief spells only the doors and the diff's top level; every field below that it does not spell is a
 * guess recorded on ticket 613 (618 reconciles). `diffCounts` therefore reads a count OR rows.
 */
import type { Says } from '@/core/insurance-rules/model'
import { INSURANCE_RULES_PATH } from '@/core/insurance-rules/model'

export const EDITION_LISTS = ['sfda', 'chi'] as const
export type EditionList = (typeof EDITION_LISTS)[number]

export const EDITION_STATES = ['pending', 'live', 'retired'] as const
export type EditionState = (typeof EDITION_STATES)[number]

/** A row of `GET InsuranceRules/Editions?list=` (guessed shape). */
export interface Edition {
  id: string
  list: EditionList
  fileName?: string | null
  rows?: number | null
  uploadedBy: string
  uploadedAt?: string | null
  state: EditionState
  publishedBy?: string | null
  publishedAt?: string | null
}

export interface UnmatchedItem {
  item: string
  itemName?: Says | null
  sfdaCode?: string | null
}

/** `GET InsuranceRules/Editions/{id}/Diff`. */
export interface EditionDiff {
  added: number | unknown[]
  dropped: number | unknown[]
  changed: number | unknown[]
  newlyUnmatched: number | UnmatchedItem[]
  rulesAffected: { ruleId: string; backtestFires: number }[]
}

export const GAP_KINDS = ['noMatch', 'junk', 'gtinMismatch', 'withdrawn'] as const
export type GapKind = (typeof GAP_KINDS)[number]

/** A row of `GET InsuranceRules/Editions/{id}/Gaps` (guessed shape). */
export interface GapRow {
  kind: GapKind
  item?: string | null
  itemName?: Says | null
  sfdaCode?: string | null
  gtin?: string | null
  /** The other side of a mismatch (the SFDA row's GTIN). */
  detail?: string | null
}

// ── the address ───────────────────────────────────────────────────────────────────────────────

export interface EditionsQuery {
  list: EditionList
}

export const isEditionList = (v: unknown): v is EditionList => (EDITION_LISTS as readonly unknown[]).includes(v)

export function editionsFromParams(params: URLSearchParams): EditionsQuery {
  const list = params.get('list')
  return { list: isEditionList(list) ? list : 'sfda' }
}

export function editionsToParams(q: EditionsQuery): URLSearchParams {
  const p = new URLSearchParams()
  if (q.list !== 'sfda') p.set('list', q.list)
  return p
}

export const editionsPath = (list: EditionList = 'sfda'): string =>
  `${INSURANCE_RULES_PATH}/editions${list === 'sfda' ? '' : `?list=${list}`}`
export const editionPath = (list: EditionList, id: string): string =>
  `${INSURANCE_RULES_PATH}/editions/${list}/${encodeURIComponent(id)}`

// ── the diff ──────────────────────────────────────────────────────────────────────────────────

export interface DiffCounts {
  added: number
  dropped: number
  changed: number
  newlyUnmatched: number
  rules: number
  fires: number
}

const countOf = (v: number | unknown[] | null | undefined): number => (Array.isArray(v) ? v.length : typeof v === 'number' ? v : 0)

export function diffCounts(diff: EditionDiff): DiffCounts {
  const rules = diff.rulesAffected ?? []
  return {
    added: countOf(diff.added),
    dropped: countOf(diff.dropped),
    changed: countOf(diff.changed),
    newlyUnmatched: countOf(diff.newlyUnmatched),
    rules: rules.length,
    fires: rules.reduce((n, r) => n + (r.backtestFires ?? 0), 0),
  }
}

export const unmatchedRows = (diff: EditionDiff): UnmatchedItem[] => (Array.isArray(diff.newlyUnmatched) ? diff.newlyUnmatched : [])

// ── who publishes ─────────────────────────────────────────────────────────────────────────────

export type PublishBlock = 'uploader' | 'readOnly'
export interface PublishGate {
  can: boolean
  why: PublishBlock | null
}

/**
 * A pending edition is published by anyone but its uploader (the server refuses the uploader too; this is
 * only what the screen shows). A live or retired edition is read-only. With no session yet, nobody publishes.
 */
export function publishGate(edition: Pick<Edition, 'state' | 'uploadedBy'>, userId: string | null): PublishGate {
  if (edition.state !== 'pending') return { can: false, why: 'readOnly' }
  if (!userId || userId.toLowerCase() === edition.uploadedBy.toLowerCase()) return { can: false, why: 'uploader' }
  return { can: true, why: null }
}

export const liveEdition = (editions: readonly Edition[]): Edition | null => editions.find((e) => e.state === 'live') ?? null

// ── the gap report ────────────────────────────────────────────────────────────────────────────

export function gapCounts(rows: readonly GapRow[]): Record<GapKind, number> {
  const out = { noMatch: 0, junk: 0, gtinMismatch: 0, withdrawn: 0 } satisfies Record<GapKind, number>
  for (const r of rows) if (r.kind in out) out[r.kind] += 1
  return out
}

export const gapsOfKind = (rows: readonly GapRow[], kind: GapKind | null): GapRow[] => (kind ? rows.filter((r) => r.kind === kind) : [...rows])

// ── the upload ────────────────────────────────────────────────────────────────────────────────

/** `POST InsuranceRules/Editions` multipart `{ list, file }`. */
export function uploadForm(list: EditionList, file: File): FormData {
  const form = new FormData()
  form.append('list', list)
  form.append('file', file, file.name)
  return form
}

/** The export's name when the server sends none. */
export const gapsFileName = (id: string): string => `${id}-gaps.xlsx`
