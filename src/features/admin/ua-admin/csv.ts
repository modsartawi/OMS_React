// The Ua Users CSV writer (ticket 150). Pure: rows in, string out — no DOM, no
// network, no `t` instance, just a label resolver. The download and the paged
// walk that feeds it live in `export.ts`.
//
// Two rules shape everything here.
//
// 1. **The file is the wire row unpacked, not the grid screenshotted.** 13
//    columns: one per grid-row field plus the derived Status, with the on-screen
//    channel pill split back into "Codes via" + "Reachable", and the seeded /
//    enabled / TOTP facts kept even though the Status precedence chain hides them
//    on screen. An analyst filtering on "not seeded" should not have to
//    reverse-engineer it out of a status word (spec 147, story 35).
// 2. **Every classification is the screen's label, through the screen's own
//    `t()` key** — never a raw wire code — and the derivations are the screen's
//    own helpers, not a second copy. Two derivations of "what status is this
//    person" is exactly how the file and the screen start disagreeing. Accepted
//    price: the export is localised, headers included (ticket 145).

import type { UaEmployeeGridRow } from '@/core/models/ua-user'
import { credentialKey, deriveStatus, formatStamp, hasDestination, normalizeChannel } from './helpers'

/** Anything that can resolve an `ua-admin` key to its label — in the app, `t`. */
export type LabelResolver = (key: string) => string

/**
 * The 13 columns, in order. Each name is both the header's i18n key
 * (`csv.headers.<key>`) and the identity of the column in the tests.
 */
export const CSV_COLUMN_KEYS = [
  'employeeId',
  'name',
  'mobile',
  'mobileStatus',
  'email',
  'codesVia',
  'reachable',
  'status',
  'seeded',
  'enabled',
  'credential',
  'totp',
  'lastLogin',
] as const

// The phone classes the server emits (UaPhoneClasses). An unrecognised code is
// passed through as data rather than silently read as one of these — a new
// server class must not arrive labelled as an old one.
const PHONE_CLASSES = ['missing', 'placeholder', 'usable']

const BOM = '﻿'
const EOL = '\r\n'

/**
 * Quote a cell only when it needs it. A comma, a quote or a line break inside a
 * display name is escaped RFC-4180 style (doubled quotes inside a quoted field),
 * so a name with a newline stays one row.
 */
function escape(value: string): string {
  return /[",\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value
}

/**
 * `="0501234567"` — the only wrapping Excel honours for "this is text". Plain
 * quoting does NOT stop it parsing the cell as a number: the leading zero is
 * eaten and a long numeric employee id arrives as `1.23457E+11` (stories 31/32).
 * An empty value stays an empty cell, not an empty formula.
 */
function formulaText(value: string): string {
  return value === '' ? '' : escape(`="${value.replace(/"/g, '""')}"`)
}

/**
 * A display name or an address must not EXECUTE when the file is opened. Excel
 * treats a cell opening `=`, `+`, `-` or `@` as a formula whatever the quoting,
 * so free text gets an apostrophe that Excel eats on display (story 41).
 */
function freeText(value: string): string {
  return escape(/^[=+\-@]/.test(value) ? `'${value}` : value)
}

function csvRow(cells: string[]): string {
  return cells.join(',')
}

/** The 13 cells of one person, already escaped. */
function personCells(r: UaEmployeeGridRow, t: LabelResolver): string[] {
  const yesNo = (fact: boolean) => t(fact ? 'csv.yes' : 'csv.no')
  const channel = normalizeChannel(r.deliveryChannel)
  return [
    formulaText(r.employeeId),
    freeText(r.displayName),
    formulaText(r.phone),
    escape(PHONE_CLASSES.includes(r.phoneClass) ? t(`csv.phoneClass.${r.phoneClass}`) : r.phoneClass),
    freeText(r.email),
    escape(t(`delivery.${channel}`)),
    escape(yesNo(hasDestination(r))),
    escape(t(`status.${deriveStatus(r).key}`)),
    escape(yesNo(r.isSeeded)),
    escape(yesNo(r.isActive)),
    escape(t(`credential.${credentialKey(r.credentialState)}`)),
    escape(yesNo(r.isTotpEnrolled)),
    // As stored, through the screen's own formatter — no `new Date()` anywhere
    // near it. `null` is an EMPTY cell: the word "Never" would make the column
    // text and kill date sorting (story 38).
    escape(formatStamp(r.lastLoginAt) ?? ''),
  ]
}

/**
 * The whole file as one string.
 *
 * Opens in columns on a double-click in any regional setting: the BOM is what
 * makes Arabic names render, and the leading `sep=,` line is because Excel's
 * double-click path uses the OS list separator — `;` in Arabic locales — not the
 * comma. Accepted cost: one junk first row in non-Excel tools (ticket 145).
 */
export function buildUaUsersCsv(rows: UaEmployeeGridRow[], t: LabelResolver): string {
  const header = csvRow(CSV_COLUMN_KEYS.map((key) => freeText(t(`csv.headers.${key}`))))
  const lines = ['sep=,', header, ...rows.map((r) => csvRow(personCells(r, t)))]
  return BOM + lines.join(EOL) + EOL
}

/**
 * `ua-users-{scope}-{YYYY-MM-DD}.csv`, where scope is the card CODE — labels
 * don't survive sanitising, and a search exports under the scope `search`. Date
 * only, no time: three exports in one week don't collide, three in one day
 * deliberately do.
 *
 * `now` is a parameter so the name is testable and the module stays pure.
 */
export function csvFileName(scope: string, now: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  const day = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  const safe = scope.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'export'
  return `ua-users-${safe}-${day}.csv`
}
