/**
 * Onboarding's pure logic (spec 444, ticket 449): the store code's format, the
 * paste-many parser, where the New store wizard starts, the per-row result summary,
 * the connection test's verdict, and the Edit dialogs' readiness. No React, no
 * network — pinned by `onboard-helpers.test.ts`.
 *
 * The reason, the 50-store cap and the failure labels are 447's (`control-helpers.ts`),
 * the command poll 448's (`command-helpers.ts`); they are reused, not copied.
 */
import type {
  CreateLocationResult,
  OnboardResult,
  StoreLocation,
  SyncCommand,
  SyncConsoleAccess,
} from '@/core/models/sync-console'
import { runVerdict } from './command-helpers'
import { SELECTION_CAP, controlResultSummary, type ResultSummary } from './control-helpers'

// ── The store code ──────────────────────────────────────────────────────────────

/** A NEW store code: four characters, A–Z and 0–9 (the door's `BAD_CODE` otherwise). */
const STORE_CODE_PATTERN = /^[A-Z0-9]{4}$/

/** Whether a new store code may be sent. Existing codes are shown as stored and never checked. */
export const codeIsValid = (code: string): boolean => STORE_CODE_PATTERN.test(code)

/** Why a code cannot be sent. */
export type CodeProblem = 'empty' | 'lowercase' | 'format'

/**
 * What is wrong with a typed code, or `null` when it is good. A code whose only
 * fault is its case is `lowercase` — 🚩 refused, never upper-cased (ruled, BackOffice
 * 2520 decision 2), so the person learns the rule. Anything else that is not four
 * letters or digits is `format`.
 */
export function codeProblem(code: string): CodeProblem | null {
  if (code === '') return 'empty'
  if (codeIsValid(code)) return null
  if (/^[A-Za-z0-9]{4}$/.test(code)) return 'lowercase'
  return 'format'
}

// ── Templates ───────────────────────────────────────────────────────────────────

/**
 * No door lists templates (contract): the template store and the template location
 * are code fields, preselected `P001`, with the call centre `C011` one click away for
 * the location. A wrong code comes back from the door as `NO_TEMPLATE`.
 */
export const DEFAULT_TEMPLATE_STORE = 'P001'
export const DEFAULT_LOCATION_TEMPLATE = 'P001'
export const LOCATION_TEMPLATE_CHOICES: readonly string[] = ['P001', 'C011']

// ── Where the wizard starts ─────────────────────────────────────────────────────

/** `master`: step 1 (the store master) then step 2. `location`: step 2 alone, for an existing store. */
export type WizardMode = 'master' | 'location'

/**
 * Which wizard a person gets, or `null` when they may onboard nothing (the page
 * then shows no form at all — absent, not disabled).
 *
 * - **Finish** from Sync pending names a code: that store exists, so step 2 alone
 *   (`ActionSync/Locations`, which needs `canOperate`).
 * - With `canOnboard` **and** `canOperate`: step 1 then step 2 (`Store/Onboard`,
 *   `alsoCreateLocation`).
 * - With `canOperate` only: step 2 alone, for existing stores.
 *
 * 🚩 `canOnboard` alone is no wizard (ticket 450): step 1 always sends
 * `alsoCreateLocation`, and the door answers that with a bare 403 for a caller
 * without `ActionSync.Operate` (contract, 2542).
 */
export function wizardStart(
  access: Pick<SyncConsoleAccess, 'canOperate' | 'canOnboard'> | null | undefined,
  finishCode: string | null,
): WizardMode | null {
  const canOperate = access?.canOperate === true
  const canOnboard = access?.canOnboard === true
  if (!canOperate) return null
  if (finishCode) return 'location'
  return canOnboard ? 'master' : 'location'
}

// ── Paste many ──────────────────────────────────────────────────────────────────

/** The columns of a pasted store-master row (step 1 and step 2 in one line), in order. */
export const MASTER_COLUMNS = ['code', 'description', 'city', 'area', 'address', 'phone', 'cr', 'ip'] as const
/** The columns of a pasted sync-location row (step 2 alone), in order. */
export const LOCATION_COLUMNS = ['code', 'description', 'ip'] as const

/** Why a pasted row cannot be sent. Each has an `onboard.problems.<code>` label. */
export type PasteProblem = 'COLUMN_COUNT' | 'CODE_EMPTY' | 'CODE_LOWERCASE' | 'CODE_FORMAT' | 'DUPLICATE' | 'IP_MISSING'

export interface PastedRow<K extends string> {
  /** The row's line in the pasted text, 1-based, counting blank lines and the header — where to find it. */
  line: number
  /** Every column's value, trimmed; a missing one is `''`. */
  fields: Record<K, string>
  /** Empty when the row may be sent. */
  problems: PasteProblem[]
}

export interface PastedStores<K extends string> {
  rows: PastedRow<K>[]
  /** Whether the first line was a header and was skipped. */
  headerSkipped: boolean
}

/** A header's first cell: `code`, `store`, `store code`, `store_code`… in any case. */
const HEADER_FIRST_CELL = /^(store([\s_-]*code)?|code)$/i

/** The other cells a header holds: a column's name or its common label, spaces and case ignored. */
const HEADER_NAMES = new Set([
  ...MASTER_COLUMNS,
  'desc',
  'name',
  'storename',
  'ipaddress',
  'storeip',
  'crnumber',
  'telephone',
])
const isHeaderName = (cell: string) => HEADER_NAMES.has(cell.toLowerCase().replace(/[\s_-]/g, ''))

/**
 * Whether a first row is a header: its first cell reads `code` AND another cell reads
 * like a column name. `CODE` is also a valid store code, so the first cell alone would
 * drop a real store whose code is `CODE`.
 */
const isHeader = (cells: readonly string[]) =>
  HEADER_FIRST_CELL.test((cells[0] ?? '').trim()) && cells.slice(1).some((c) => isHeaderName(c.trim()))

const CODE_PROBLEMS: Record<CodeProblem, PasteProblem> = {
  empty: 'CODE_EMPTY',
  lowercase: 'CODE_LOWERCASE',
  format: 'CODE_FORMAT',
}

/**
 * One CSV line's cells: a comma separates, a double-quoted cell may hold commas, and
 * `""` inside quotes is one quote. A quoted cell never spans lines.
 */
function splitCsv(line: string): string[] {
  const cells: string[] = []
  let cell = ''
  let quoted = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cell += '"'
        i++
      } else if (ch === '"') quoted = false
      else cell += ch
    } else if (ch === '"' && cell.trim() === '') {
      quoted = true
      cell = ''
    } else if (ch === ',') {
      cells.push(cell)
      cell = ''
    } else cell += ch
  }
  cells.push(cell)
  return cells
}

/**
 * Pasted rows — TSV copied from a sheet, or CSV — read into rows, with every bad row
 * marked BEFORE any call.
 *
 * - Tab-separated when the first line holds a tab, else comma-separated (quotes allowed).
 * - Blank lines are ignored; a first line whose first cell reads `code` (or
 *   `store code`) and whose other cells read like column names is a header and is
 *   skipped.
 * - Cells are trimmed and sent as written: a code is **never** re-cased. A lowercase
 *   code is marked `CODE_LOWERCASE`, any other bad code `CODE_FORMAT`.
 * - A row with the wrong number of cells is `COLUMN_COUNT`; a code seen on an earlier
 *   row is `DUPLICATE` (the door's `DUPLICATE_IN_BATCH`); an empty IP is `IP_MISSING`.
 *
 * Not `@/core/import/parse-import`: that is WPF's tab format with no header skip,
 * and widening it would change its current callers.
 */
export function parsePastedStores<K extends string>(text: string, columns: readonly K[]): PastedStores<K> {
  const lines = text.split(/\r?\n/).map((raw, i) => ({ raw, line: i + 1 })).filter((l) => l.raw.trim() !== '')
  if (lines.length === 0) return { rows: [], headerSkipped: false }

  const split = lines[0].raw.includes('\t') ? (s: string) => s.split('\t') : splitCsv
  const first = split(lines[0].raw)
  const headerSkipped = isHeader(first)
  const body = headerSkipped ? lines.slice(1) : lines

  const codeAt = columns.indexOf('code' as K)
  const ipAt = columns.indexOf('ip' as K)
  const seen = new Set<string>()
  const rows = body.map(({ raw, line }): PastedRow<K> => {
    const cells = split(raw).map((c) => c.trim())
    const fields = Object.fromEntries(columns.map((key, c) => [key, cells[c] ?? ''])) as Record<K, string>
    const problems: PasteProblem[] = []
    if (cells.length !== columns.length) problems.push('COLUMN_COUNT')
    if (codeAt >= 0) {
      const code = cells[codeAt] ?? ''
      const bad = codeProblem(code)
      if (bad) problems.push(CODE_PROBLEMS[bad])
      if (code !== '' && seen.has(code)) problems.push('DUPLICATE')
      seen.add(code)
    }
    if (ipAt >= 0 && (cells[ipAt] ?? '') === '') problems.push('IP_MISSING')
    return { line, fields, problems }
  })
  return { rows, headerSkipped }
}

/** At most 50 stores in one request (ruled), though the location door would take 200. */
export const PASTE_CAP = SELECTION_CAP

/**
 * Whether a paste may be previewed: at least one row, no more than 50, and none
 * marked. Never a filtered subset — what is sent is what the grid shows.
 */
export function pasteReady(rows: readonly PastedRow<string>[]): boolean {
  return rows.length > 0 && rows.length <= PASTE_CAP && rows.every((r) => r.problems.length === 0)
}

// ── The answer ──────────────────────────────────────────────────────────────────

export interface OnboardWarning {
  /** The store code. */
  id: string
  /** The door's warning, shown as it came. */
  warning: string
}

export interface OnboardSummary extends ResultSummary {
  /** Store masters created (or, on a preview, that would be). */
  created: number
  /** Stores that already existed: step 1 skipped, step 2 still tried. */
  skipped: number
  /** Sync locations created. */
  locations: number
  /** Every row with a warning — a failed connection test is one, never an error. */
  warnings: OnboardWarning[]
}

/**
 * `Store/Onboard`'s per-row answer: the created, skipped and failed counts (with
 * each failure's code, through 447's `controlResultSummary`), the locations created,
 * and the warnings. A warning does not make a row failed.
 */
export function onboardResultSummary(results: readonly OnboardResult[]): OnboardSummary {
  return {
    ...controlResultSummary(results),
    created: results.filter((r) => r.storeCreated).length,
    skipped: results.filter((r) => r.storeSkipped).length,
    locations: results.filter((r) => r.locationCreated).length,
    warnings: results.filter((r) => r.warning).map((r) => ({ id: r.code, warning: r.warning as string })),
  }
}

/** One row of the wizard's answer, whichever door gave it — what the result grid draws. */
export interface WizardResultRow {
  code: string
  /** Step 1: `null` when the wizard ran step 2 alone. */
  store: 'created' | 'skipped' | 'none' | null
  locationCreated: boolean
  ok: boolean
  error: string | null
  /** The door's own warning (`Store/Onboard`), shown as it came. */
  warning: string | null
  /** The connection test queued for a new location (`ActionSync/Locations`), followed to its end. */
  testCommandId: string | null
}

/** A `Store/Onboard` row. It names no connection test; its `warning` says how one went. */
export const onboardRow = (r: OnboardResult): WizardResultRow => ({
  code: r.code,
  store: r.storeCreated ? 'created' : r.storeSkipped ? 'skipped' : 'none',
  locationCreated: r.locationCreated,
  ok: r.ok,
  error: r.error,
  warning: r.warning,
  testCommandId: null,
})

/** An `ActionSync/Locations` row: a location is created (or, on a preview, would be) when the row is ok. */
export const locationRow = (r: CreateLocationResult): WizardResultRow => ({
  code: r.code,
  store: null,
  locationCreated: r.ok,
  ok: r.ok,
  error: r.error,
  warning: null,
  testCommandId: r.connectionTestCommandId,
})

/** The connection test queued for a new location, as the result grid draws it. */
export type TestVerdict = 'testing' | 'ok' | 'warning' | 'stillRunning'

/**
 * A new location's connection test, from 448's verdict: Done is OK; any other end
 * (Failed, Cancelled, Expired) is a 🚩 **warning**, never an error — the location is
 * created either way; a poll that timed out first is "still running".
 */
export function connectionTestVerdict(command: Pick<SyncCommand, 'status'> | undefined, timedOut: boolean): TestVerdict {
  const v = runVerdict(command, timedOut)
  return v === 'running' ? 'testing' : v === 'failed' ? 'warning' : v
}

// ── Edit location / Edit store ──────────────────────────────────────────────────

/** The four fields Edit location may change; code, template and credentials may not. */
export type LocationEdit = Pick<StoreLocation, 'description' | 'ip' | 'instance' | 'dbName'>

/** The edit as sent: every field trimmed, never re-cased. */
export const cleanLocationEdit = (e: LocationEdit): LocationEdit => ({
  description: e.description.trim(),
  ip: e.ip.trim(),
  instance: e.instance.trim(),
  dbName: e.dbName.trim(),
})

/**
 * Whether Edit location may be saved: the description, IP and database filled (a
 * blank IP or database would cut the store off), and at least one field changed from
 * what the door returned — an unchanged save would only write an empty audit row. A
 * blank instance is the default instance (contract, 2541), so it may stay blank.
 */
export function locationEditReady(current: LocationEdit, edit: LocationEdit): boolean {
  const e = cleanLocationEdit(edit)
  const was = cleanLocationEdit(current)
  const filled = e.description !== '' && e.ip !== '' && e.dbName !== ''
  // Compared trimmed on both sides: a stored value padded with spaces is not a change.
  const changed = (Object.keys(e) as (keyof LocationEdit)[]).some((k) => e[k] !== was[k])
  return filled && changed
}

/** The store master's address fields, as Edit store sends them. */
export interface StoreEdit {
  description: string
  city: string
  area: string
  address: string
  phone: string
  cr: string
}

export const STORE_EDIT_FIELDS: readonly (keyof StoreEdit)[] = ['description', 'city', 'area', 'address', 'phone', 'cr']

export const cleanStoreEdit = (e: StoreEdit): StoreEdit =>
  Object.fromEntries(STORE_EDIT_FIELDS.map((k) => [k, e[k].trim()])) as unknown as StoreEdit

/**
 * Whether Edit store may be saved: every field filled. No door reads a store's
 * address back, so a field left blank would be sent blank and wipe it — the form
 * asks for every one rather than guess.
 */
export const storeEditReady = (edit: StoreEdit): boolean =>
  STORE_EDIT_FIELDS.every((k) => edit[k].trim() !== '')
