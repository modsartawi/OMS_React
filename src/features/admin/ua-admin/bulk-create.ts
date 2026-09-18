// Bulk create (External identities from a CSV) — the pure half. Text in, a plan
// out; the dialog owns the network. Nothing here knows about `t`, the DOM or the
// api: every classification is a KEY (`bulk.issue.<key>`, `bulk.outcome.<key>`)
// the dialog resolves.
//
// The shape of a run, and why each rule is here:
//
// 1. **Headers are matched by name, not position.** The source sheet is whatever
//    the contractor's vendor sent (`ID Number, Full Name, Email Address, ROLE`),
//    so a handful of aliases per column beats making someone rearrange it.
// 2. **Every row is email-channel, active, no phone.** External people have no
//    number on file, and the server has no cross-channel fallback — an sms row
//    with a blank phone could never activate. So the address is mandatory and
//    checked with the server's own `UaEmailFormat` rule before anything is sent.
// 3. **Admin power is never granted by spreadsheet.** A protected role in the
//    file blocks the row; it is assigned by hand on the Authz screen or not at all.
// 4. **An id that already exists is skipped, never written.** The create door is
//    an UPSERT — it would rename a real employee and blank their phone. That check
//    is a server read, so it happens in the dialog; this module only carries the
//    outcome.

import type { RoleCatalogEntry } from '@/core/models/authz-admin'

// ----- CSV reading -------------------------------------------------------------

/**
 * RFC-4180 rows out of a CSV string: quoted fields, doubled quotes, commas and
 * line breaks inside quotes, CRLF or LF. A leading BOM is dropped, as is Excel's
 * `sep=,` hint line (our own export writes one). Blank lines are dropped.
 */
export function parseCsv(text: string): string[][] {
  // The hint line holds the separator itself, so it is cut before the comma could split it.
  const src = text.replace(/^\uFEFF/, '').replace(/^sep=.\r?\n/i, '')
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let quoted = false

  const endCell = () => {
    row.push(cell)
    cell = ''
  }
  const endRow = () => {
    endCell()
    if (row.some((c) => c.trim() !== '')) rows.push(row)
    row = []
  }

  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else quoted = false
      } else cell += ch
    } else if (ch === '"') quoted = true
    else if (ch === ',') endCell()
    else if (ch === '\n') endRow()
    else if (ch === '\r') {
      if (src[i + 1] !== '\n') endRow()
    } else cell += ch
  }
  if (cell !== '' || row.length > 0) endRow()

  return rows
}

// ----- columns -----------------------------------------------------------------

export type BulkColumn = 'employeeId' | 'name' | 'email' | 'role'

/** Header spellings each column answers to, compared lower-case, letters+digits only. */
const ALIASES: Record<BulkColumn, string[]> = {
  employeeId: ['employeeid', 'idnumber', 'id', 'staffid', 'userid', 'employee'],
  name: ['fullname', 'name', 'displayname'],
  email: ['emailaddress', 'email', 'mail'],
  role: ['role', 'rolename'],
}

/** The columns a file cannot do without. Role may be absent — the row then gets none. */
const REQUIRED: BulkColumn[] = ['employeeId', 'name', 'email']

const headerKey = (h: string) => h.toLowerCase().replace(/[^a-z0-9]/g, '')

// ----- the plan ----------------------------------------------------------------

/** Why a row will not be sent (→ `bulk.issue.<key>`). */
export type BulkIssue =
  | 'missingId'
  | 'missingName'
  | 'missingEmail'
  | 'badEmail'
  | 'duplicateId'
  | 'unknownRole'
  | 'protectedRole'

/** Where a row ended up (→ `bulk.outcome.<key>`). */
export type BulkOutcome =
  | 'ready' // valid, not yet sent
  | 'blocked' // failed validation — never sent
  | 'exists' // id already an identity — skipped, never written
  | 'created' // identity created and role assigned (or no role asked for)
  | 'roleFailed' // identity created, role NOT assigned — retryable
  | 'failed' // identity not created

export interface BulkRow {
  /** 1-based line in the file, header included — what the admin looks up in Excel. */
  line: number
  employeeId: string
  displayName: string
  email: string
  /** The role as written in the file ('' = none asked for). */
  roleInput: string
  /** The catalog's own spelling of the role, when it resolved; '' otherwise. */
  roleName: string
  issues: BulkIssue[]
  outcome: BulkOutcome
  /** The server's message for a failed/roleFailed row. */
  message: string
}

export type BulkReadResult =
  | { ok: true; rows: BulkRow[] }
  | { ok: false; error: 'empty' | 'missingColumns'; missing: BulkColumn[] }

/**
 * Mirror of the server's `UaEmailFormat.IsWellFormed` — printable ASCII, one `@`,
 * no leading/trailing/double dot in the local part, a dotted host of letter/digit/
 * hyphen labels, and a letters-only (or `xn--`) TLD of two or more. It must never
 * be looser than the server: a row this passes and the server refuses is a
 * `failed` row mid-run instead of a `blocked` one in the preview.
 */
export function isWellFormedEmail(raw: string): boolean {
  const s = raw.trim()
  if (s.length === 0 || s.length > 256 || !/^[\x21-\x7e]+$/.test(s)) return false
  const at = s.indexOf('@')
  if (at <= 0 || at !== s.lastIndexOf('@') || at === s.length - 1) return false
  const local = s.slice(0, at)
  if (local.startsWith('.') || local.endsWith('.') || local.includes('..')) return false
  const labels = s.slice(at + 1).split('.')
  if (labels.length < 2) return false
  if (!labels.every((l) => /^[A-Za-z0-9-]+$/.test(l) && !l.startsWith('-') && !l.endsWith('-'))) return false
  const tld = labels[labels.length - 1]
  return tld.length >= 2 && (/^[A-Za-z]+$/.test(tld) || /^xn--/i.test(tld))
}

/**
 * Read a CSV into the validated plan. `roles` is the live catalog: a role is
 * matched case-insensitively and sent in the catalog's spelling.
 */
export function readBulkFile(text: string, roles: RoleCatalogEntry[]): BulkReadResult {
  const table = parseCsv(text)
  if (table.length < 2) return { ok: false, error: 'empty', missing: [] }

  const header = table[0].map(headerKey)
  const index = {} as Record<BulkColumn, number>
  for (const col of Object.keys(ALIASES) as BulkColumn[]) {
    index[col] = header.findIndex((h) => ALIASES[col].includes(h))
  }
  const missing = REQUIRED.filter((c) => index[c] < 0)
  if (missing.length > 0) return { ok: false, error: 'missingColumns', missing }

  const byName = new Map(roles.map((r) => [r.roleName.toLowerCase(), r]))
  const cellOf = (cells: string[], col: BulkColumn) => (index[col] < 0 ? '' : (cells[index[col]] ?? '').trim())

  const rows: BulkRow[] = table.slice(1).map((cells, i) => {
    const employeeId = cellOf(cells, 'employeeId')
    const displayName = cellOf(cells, 'name')
    const email = cellOf(cells, 'email')
    const roleInput = cellOf(cells, 'role')
    const role = roleInput === '' ? undefined : byName.get(roleInput.toLowerCase())

    const issues: BulkIssue[] = []
    if (employeeId === '') issues.push('missingId')
    if (displayName === '') issues.push('missingName')
    if (email === '') issues.push('missingEmail')
    else if (!isWellFormedEmail(email)) issues.push('badEmail')
    if (roleInput !== '' && role === undefined) issues.push('unknownRole')
    if (role?.isProtected) issues.push('protectedRole')

    return {
      line: i + 2,
      employeeId,
      displayName,
      email,
      roleInput,
      roleName: role && !role.isProtected ? role.roleName : '',
      issues,
      outcome: 'ready',
      message: '',
    }
  })

  // An id twice in one file is ambiguous — which name wins? Both copies block.
  const counts = new Map<string, number>()
  for (const r of rows) if (r.employeeId !== '') counts.set(r.employeeId, (counts.get(r.employeeId) ?? 0) + 1)
  for (const r of rows) if ((counts.get(r.employeeId) ?? 0) > 1) r.issues.push('duplicateId')

  for (const r of rows) if (r.issues.length > 0) r.outcome = 'blocked'
  return { ok: true, rows }
}

/** How many rows sit in each outcome — the dialog's summary line. */
export function tally(rows: BulkRow[]): Record<BulkOutcome, number> {
  const out: Record<BulkOutcome, number> = { ready: 0, blocked: 0, exists: 0, created: 0, roleFailed: 0, failed: 0 }
  for (const r of rows) out[r.outcome]++
  return out
}

// ----- the results file --------------------------------------------------------

/** Anything that can resolve an `ua-admin` key to its label — in the app, `t`. */
export type LabelResolver = (key: string) => string

function escape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/** Free text must not execute when the file is opened in Excel. */
function freeText(value: string): string {
  return escape(/^[=+\-@]/.test(value) ? `'${value}` : value)
}

/** `="50385"` keeps a numeric id as text in Excel (see csv.ts). */
function idText(value: string): string {
  return value === '' ? '' : escape(`="${value.replace(/"/g, '""')}"`)
}

/**
 * The run's record: the file's four columns back, plus Outcome and Message. It is
 * the only record of who was brought in — nothing on an External identity marks
 * it as one — so a blocked row's message names its issues rather than going blank.
 */
export function buildResultsCsv(rows: BulkRow[], t: LabelResolver): string {
  const header = ['employeeId', 'name', 'email', 'role', 'outcome', 'message'].map((k) =>
    freeText(t(`bulk.csv.${k}`)),
  )
  const lines = rows.map((r) =>
    [
      idText(r.employeeId),
      freeText(r.displayName),
      freeText(r.email),
      freeText(r.roleName || r.roleInput),
      escape(t(`bulk.outcome.${r.outcome}`)),
      freeText(r.outcome === 'blocked' ? r.issues.map((k) => t(`bulk.issue.${k}`)).join('; ') : r.message),
    ].join(','),
  )
  return '\uFEFF' + ['sep=,', header.join(','), ...lines].join('\r\n') + '\r\n'
}

/** `ua-external-identities-YYYY-MM-DD.csv`; `now` is a parameter to stay pure. */
export function resultsFileName(now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `ua-external-identities-${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}.csv`
}
