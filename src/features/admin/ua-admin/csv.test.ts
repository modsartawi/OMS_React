// The CSV writer (ticket 150, spec 147 "Tier 1 — pure"). Every guard in here
// fails SILENTLY — a mangled employee id or a shifted stamp shows up weeks later
// as a wrong number in someone's spreadsheet — so this is the suite that carries
// the slice's regression risk.
//
// The label resolver used throughout is backed by the REAL `ua-admin` locale
// file, not a stub map: that is what makes "every classification is the label the
// screen shows" an assertion rather than a comment. A missing key surfaces here
// as a raw key in a cell.
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/ua-admin.json'
import type { UaEmployeeGridRow } from '@/core/models/ua-user'
import { CSV_COLUMN_KEYS, buildUaUsersCsv, csvFileName } from './csv'

/** i18next-shaped lookup over the real namespace — `a.b.c` walks the object. */
const t = (key: string): string => {
  const hit = key.split('.').reduce<unknown>((node, part) => {
    return node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
  }, en)
  return typeof hit === 'string' ? hit : key
}

const person = (over: Partial<UaEmployeeGridRow> = {}): UaEmployeeGridRow => ({
  employeeId: '100042',
  displayName: 'Ayed Al-Qahtani',
  phone: '0501234567',
  phoneClass: 'usable',
  email: '',
  deliveryChannel: 'sms',
  isActive: true,
  isSeeded: true,
  credentialState: 'active',
  isTotpEnrolled: false,
  lastLoginAt: '2026-07-14T11:03:22',
  ...over,
})

/** The data rows, with the BOM, the `sep=,` line and the header stripped off. */
const bodyLines = (csv: string): string[] =>
  csv.replace(/^﻿/, '').split('\r\n').slice(2).filter((line) => line !== '')

const headerLine = (csv: string): string => csv.replace(/^﻿/, '').split('\r\n')[1]

describe('csvColumnsAndLabels', () => {
  it('writes 13 columns — the wire row unpacked, plus the derived Status', () => {
    // One per grid-row field, with the on-screen channel pill split back into
    // "Codes via" + "Reachable" (spec 147, story 36).
    expect(CSV_COLUMN_KEYS).toHaveLength(13)
    const csv = buildUaUsersCsv([person()], t)
    expect(headerLine(csv).split(',')).toHaveLength(13)
    expect(bodyLines(csv)).toHaveLength(1)
    expect(bodyLines(csv)[0].split(',')).toHaveLength(13)
  })

  it('names every header from the namespace, in screen order', () => {
    expect(headerLine(buildUaUsersCsv([], t))).toBe(
      'Employee,Name,Mobile,Mobile status,Email,Codes via,Reachable,Status,Seeded,Enabled,Credential,TOTP,Last login',
    )
  })

  it('spells every classification as the screen spells it, never as the code', () => {
    // Same `t()` keys the pills use, so the file reconciles against the screen
    // by construction (ticket 145).
    const cells = bodyLines(
      buildUaUsersCsv(
        [person({ credentialState: 'temporary-must-change', deliveryChannel: 'email', email: 'a@dm.sa' })],
        t,
      ),
    )[0].split(',')
    expect(cells[5]).toBe('Email') // delivery.email
    expect(cells[7]).toBe('Must change password') // status.mustChange
    expect(cells[10]).toBe('Temporary — must change at next login') // credential.mustChange
    // Not one raw wire code anywhere in the row.
    expect(cells.join('|')).not.toMatch(/temporary-must-change|awaitingActivation|mustChange/)
  })

  it('splits the channel pill into where codes go and whether that reaches them', () => {
    // "on email" and "on email with no address" must be distinguishable in a
    // filter, which one pill column cannot do.
    const reachable = bodyLines(buildUaUsersCsv([person({ deliveryChannel: 'email', email: 'a@dm.sa' })], t))[0].split(',')
    const stranded = bodyLines(buildUaUsersCsv([person({ deliveryChannel: 'email', email: '' })], t))[0].split(',')
    expect([reachable[5], reachable[6]]).toEqual(['Email', 'Yes'])
    expect([stranded[5], stranded[6]]).toEqual(['Email', 'No'])
  })

  it('keeps the seeded / enabled / TOTP facts the Status pill hides', () => {
    // A not-seeded person reads "Not seeded" on screen whatever else is true of
    // them; the analyst still gets to filter on each fact (story 35).
    const cells = bodyLines(
      buildUaUsersCsv([person({ isSeeded: false, isActive: false, isTotpEnrolled: true })], t),
    )[0].split(',')
    expect(cells[7]).toBe('Not seeded')
    expect([cells[8], cells[9], cells[11]]).toEqual(['No', 'No', 'Yes'])
  })

  it('passes a stamp through unshifted, and leaves a never-signed-in cell EMPTY', () => {
    // No `new Date()` anywhere near it — the audit surface mixes local and
    // legacy-UTC rows. And "Never" as a word would make the column text and kill
    // date sorting (story 38).
    expect(bodyLines(buildUaUsersCsv([person()], t))[0].split(',')[12]).toBe('2026-07-14 11:03')
    expect(bodyLines(buildUaUsersCsv([person({ lastLoginAt: null })], t))[0].split(',')[12]).toBe('')
  })

  it('names the file for the scope code and the day', () => {
    // The card CODE, not its label — labels don't survive sanitising. Date only,
    // no time, so a morning and an afternoon export of the same card collide on
    // purpose.
    expect(csvFileName('phoneGap', new Date(2026, 6, 27, 14, 30))).toBe('ua-users-phonegap-2026-07-27.csv')
    expect(csvFileName('all', new Date(2026, 0, 3))).toBe('ua-users-all-2026-01-03.csv')
  })
})

describe('csvSurvivesExcel', () => {
  it('opens in columns on a double-click, in any locale, with Arabic legible', () => {
    // BOM (Arabic renders), `sep=,` (Excel's double-click path uses the OS list
    // separator, `;` in Arabic locales), CRLF.
    const csv = buildUaUsersCsv([person({ displayName: 'محمد السرطاوي' })], t)
    expect(csv.startsWith('﻿sep=,\r\n')).toBe(true)
    expect(csv).toContain('محمد السرطاوي')
    expect(csv.split('\r\n').length).toBeGreaterThan(2)
    expect(csv.replace(/\r\n/g, '')).not.toContain('\n')
  })

  it('wraps employee id and mobile as formula text so a leading zero survives', () => {
    // Plain quoting does NOT stop Excel parsing "0501234567" as a number — the
    // zero is eaten and a long id becomes 1.23457E+11 (stories 31, 32).
    const csv = buildUaUsersCsv([person({ employeeId: '007', phone: '0501234567' })], t)
    expect(csv).toContain('"=""007"""')
    expect(csv).toContain('"=""0501234567"""')
  })

  it('leaves a missing mobile as an empty cell, not an empty formula', () => {
    expect(bodyLines(buildUaUsersCsv([person({ phone: '', phoneClass: 'missing' })], t))[0].split(',')[2]).toBe('')
  })

  it('makes formula-leading free text inert', () => {
    // A display name must not execute when the file is opened (story 41).
    const csv = buildUaUsersCsv([person({ displayName: '=cmd|calc', email: '+9665551234' })], t)
    expect(csv).toContain("'=cmd|calc")
    expect(csv).toContain("'+9665551234")
  })

  it('round-trips a name carrying a comma, a quote and a newline', () => {
    const csv = buildUaUsersCsv([person({ displayName: 'Smith, "Bob"\nJr' })], t)
    expect(csv).toContain('"Smith, ""Bob""\nJr"')
    // The embedded newline lives INSIDE quotes — it must not add a data row.
    expect(csv.replace(/^﻿/, '').split('\r\n').filter((l) => l !== '')).toHaveLength(3)
  })
})
