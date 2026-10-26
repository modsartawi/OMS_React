/**
 * The Changes view's pure logic (spec 558, ticket 562): the view kept in the URL, the door's
 * query, a manifest row as cells, the drawer link's gate and the two notices. No React, no
 * network — each one is pinned by `changes-helpers.test.ts`.
 *
 * 🚩 A manifest row may hold personal data from both servers. Nothing here logs, keeps or writes a
 * row anywhere; the helpers only reshape what the screen is about to draw.
 */
import { apiErrorCode } from '@/core/api'
import {
  CHANGE_KINDS,
  DATA_SYNC_PAGE_SIZE,
  type ChangeKind,
  type ChangeManifestRow,
  type ChangesQuery,
  type ManifestValue,
  type Mode,
  type TableTask,
} from '@/core/models/data-sync'

// ── The view and its URL ────────────────────────────────────────────────────────

/** What the Changes view shows. All three live in the URL, so a filtered view can be linked. */
export interface ChangesView {
  /** A table of the job (`schema.table`), or `null` for every table. */
  table: string | null
  kind: ChangeKind | null
  page: number
}

const isChangeKind = (v: string): v is ChangeKind => (CHANGE_KINDS as readonly string[]).includes(v)

/** The view read from the address. An unknown kind is dropped (the door would refuse it with a 400). */
export function changesFromParams(params: URLSearchParams): ChangesView {
  const kind = params.get('kind') ?? ''
  const n = Number(params.get('page'))
  return {
    table: params.get('table') || null,
    kind: isChangeKind(kind) ? kind : null,
    page: Number.isInteger(n) && n >= 1 ? n : 1,
  }
}

/** The view written to the address — only what differs from the default. */
export function changesToParams(view: ChangesView): URLSearchParams {
  const out = new URLSearchParams()
  if (view.table) out.set('table', view.table)
  if (view.kind) out.set('kind', view.kind)
  if (view.page > 1) out.set('page', String(view.page))
  return out
}

/** The Changes door's query: the table, the kind by its exact name, the page, 50 a page. */
export function changesQuery(view: ChangesView): ChangesQuery {
  return { table: view.table, kind: view.kind, page: view.page, pageSize: DATA_SYNC_PAGE_SIZE }
}

// ── A row as cells ──────────────────────────────────────────────────────────────

/**
 * One side's value as the screen draws it. `null` and `""` are different values on the wire and
 * stay different here: a NULL is drawn as a NULL marker, an empty string as an empty marker,
 * never one as the other.
 */
export type ChangeValue = { kind: 'null' } | { kind: 'empty' } | { kind: 'text'; text: string }

export interface ChangeCell {
  column: string
  /** `null` when this row has no source side (TargetOnly). */
  source: ChangeValue | null
  /** `null` when this row has no store side (SourceOnly). */
  target: ChangeValue | null
}

export interface ChangeCells {
  /** The match key, column → value; a NULL key value is `text: null`. */
  key: { column: string; text: string | null }[]
  /** Only the columns that differ (Different), or the one side the row has. */
  values: ChangeCell[]
}

const scalarText = (v: ManifestValue): string | null => (v === null ? null : String(v))

function valueOf(v: ManifestValue | undefined): ChangeValue {
  if (v === null || v === undefined) return { kind: 'null' }
  if (v === '') return { kind: 'empty' }
  return { kind: 'text', text: String(v) }
}

/**
 * A manifest row as the screen draws it. Different → both sides for each column that differs (the
 * door sends only those; a column whose two sides are equal is dropped as a safeguard, and a
 * column the door sent on one side only reads as NULL on the other). SourceOnly → the source side
 * only; TargetOnly → the store side only.
 */
export function changeCells(row: ChangeManifestRow): ChangeCells {
  const key = Object.entries(row.key).map(([column, v]) => ({ column, text: scalarText(v) }))
  const src = row.sourceValues ?? {}
  const tgt = row.targetValues ?? {}

  if (row.kind === 'SourceOnly')
    return { key, values: Object.entries(src).map(([column, v]) => ({ column, source: valueOf(v), target: null })) }
  if (row.kind === 'TargetOnly')
    return { key, values: Object.entries(tgt).map(([column, v]) => ({ column, source: null, target: valueOf(v) })) }

  const columns = [...Object.keys(src), ...Object.keys(tgt).filter((c) => !(c in src))]
  const values = columns
    .filter((c) => !(c in src && c in tgt && src[c] === tgt[c]))
    .map((column) => ({ column, source: valueOf(src[column]), target: valueOf(tgt[column]) }))
  return { key, values }
}

// ── The link, the notices ───────────────────────────────────────────────────────

/**
 * The drawer's Changes link: a manifest is written only by a report-only job, and the view needs
 * `DataSync.Operate`. An unknown mode hides it (fails closed).
 */
export function showChangesLink(mode: Mode | undefined, canOperate: boolean): boolean {
  return canOperate && mode === 'ReportOnly'
}

export const changesPath = (jobId: string) => `/admin/data-sync/jobs/${encodeURIComponent(jobId)}/changes`

/**
 * The tables whose manifest stopped at the cap (counts exact, rows cut), narrowed to the filtered
 * table when there is one. The door matches a table name case-insensitively, so this does too.
 */
export function truncatedTables(tasks: readonly Pick<TableTask, 'table' | 'manifestTruncated'>[], table: string | null): string[] {
  const want = table?.toLowerCase() ?? null
  return tasks.filter((t) => t.manifestTruncated && (want === null || t.table.toLowerCase() === want)).map((t) => t.table)
}

/** 410: the rows were pruned after the retention window; the counts remain on the job. */
export const isManifestPruned = (err: unknown): boolean => apiErrorCode(err) === 'DATASYNC_MANIFEST_PRUNED'
