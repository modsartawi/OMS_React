// Bulk create's pure half: reading the vendor's sheet into a plan. The regression
// risk here is silent — a header alias that stops matching, or an email rule
// looser than the server's, turns into rows that fail mid-run instead of being
// blocked in the preview.
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/ua-admin.json'
import type { RoleCatalogEntry } from '@/core/models/authz-admin'
import { buildResultsCsv, isWellFormedEmail, parseCsv, readBulkFile, tally } from './bulk-create'

const t = (key: string): string => {
  const hit = key.split('.').reduce<unknown>((node, part) => {
    return node !== null && typeof node === 'object' ? (node as Record<string, unknown>)[part] : undefined
  }, en)
  return typeof hit === 'string' ? hit : key
}

const role = (roleName: string, isProtected = false): RoleCatalogEntry => ({
  roleName,
  description: '',
  isComposite: false,
  directHolderCount: 0,
  isProtected,
})
const ROLES = [role('CALL_CENTER_AGENT'), role('AUTHZ_ADMIN', true)]

const VENDOR_HEADER = 'ID Number,Full Name,Email Address,ROLE'

describe('parseCsv', () => {
  it('handles a BOM, CRLF, quoted commas, doubled quotes and blank lines', () => {
    const text = '﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2\n'
    expect(parseCsv(text)).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
      ['1', '2'],
    ])
  })

  it("drops Excel's sep= hint line", () => {
    expect(parseCsv('sep=,\r\nh1,h2\r\nv1,v2')).toEqual([
      ['h1', 'h2'],
      ['v1', 'v2'],
    ])
  })

  it('keeps a line break inside a quoted cell in one row', () => {
    expect(parseCsv('a\n"one\ntwo"')).toEqual([['a'], ['one\ntwo']])
  })
})

describe('isWellFormedEmail — mirrors UaEmailFormat', () => {
  it.each(['ramdanemad716@gmail.com', 'a.b-c@sub.example.co', 'x@xn--mgbh0fb.xn--kgbechtv'])('accepts %s', (e) =>
    expect(isWellFormedEmail(e)).toBe(true),
  )
  it.each([
    '',
    'no-at.example.com',
    'two@@example.com',
    'a@b@example.com',
    '.lead@example.com',
    'trail.@example.com',
    'dou..ble@example.com',
    'user@localhost',
    'user@example.c',
    'user@example.c0m',
    'user@-bad.com',
    'user@exa_mple.com',
    'sp ace@example.com',
    'عربي@example.com',
  ])('refuses %j', (e) => expect(isWellFormedEmail(e)).toBe(false))
})

describe('readBulkFile', () => {
  it("reads the vendor's own headers and resolves the role to the catalog spelling", () => {
    const read = readBulkFile(`${VENDOR_HEADER}\n50385,Emad Ramadan,ramdanemad716@gmail.com,call_center_agent`, ROLES)
    expect(read.ok).toBe(true)
    if (!read.ok) return
    expect(read.rows).toEqual([
      {
        line: 2,
        employeeId: '50385',
        displayName: 'Emad Ramadan',
        email: 'ramdanemad716@gmail.com',
        roleInput: 'call_center_agent',
        roleName: 'CALL_CENTER_AGENT',
        issues: [],
        outcome: 'ready',
        message: '',
      },
    ])
  })

  it('matches headers regardless of order, case and punctuation', () => {
    const read = readBulkFile('e-mail,ROLE NAME,Display Name,Employee Id\nx@y.com,,Name,7', ROLES)
    expect(read.ok && read.rows[0]).toMatchObject({ employeeId: '7', displayName: 'Name', email: 'x@y.com' })
  })

  it('names the missing required columns; Role is optional', () => {
    expect(readBulkFile('ID Number,ROLE\n1,X', ROLES)).toEqual({
      ok: false,
      error: 'missingColumns',
      missing: ['name', 'email'],
    })
    const noRole = readBulkFile('ID Number,Full Name,Email Address\n1,A,a@b.co', ROLES)
    expect(noRole.ok && noRole.rows[0]).toMatchObject({ outcome: 'ready', roleName: '' })
  })

  it('refuses a file with no data rows', () => {
    expect(readBulkFile(VENDOR_HEADER, ROLES)).toEqual({ ok: false, error: 'empty', missing: [] })
  })

  it('blocks empty cells, a malformed email, an unknown role and an admin role', () => {
    const read = readBulkFile(
      [
        VENDOR_HEADER,
        ',Name,a@b.co,CALL_CENTER_AGENT',
        '2,,not-an-email,NOPE',
        '3,C,,AUTHZ_ADMIN',
      ].join('\n'),
      ROLES,
    )
    if (!read.ok) throw new Error('expected rows')
    expect(read.rows.map((r) => [r.outcome, r.issues, r.roleName])).toEqual([
      ['blocked', ['missingId'], 'CALL_CENTER_AGENT'],
      ['blocked', ['missingName', 'badEmail', 'unknownRole'], ''],
      // A protected role never survives into roleName — nothing can send it.
      ['blocked', ['missingEmail', 'protectedRole'], ''],
    ])
  })

  it('blocks BOTH copies of an id that appears twice', () => {
    const read = readBulkFile(`${VENDOR_HEADER}\n9,A,a@b.co,\n9,B,b@b.co,\n10,C,c@b.co,`, ROLES)
    if (!read.ok) throw new Error('expected rows')
    expect(read.rows.map((r) => r.outcome)).toEqual(['blocked', 'blocked', 'ready'])
    expect(read.rows[0].issues).toEqual(['duplicateId'])
  })

  it('numbers rows by their line in the file, header included', () => {
    const read = readBulkFile(`${VENDOR_HEADER}\n1,A,a@b.co,\n2,B,b@b.co,`, ROLES)
    expect(read.ok && read.rows.map((r) => r.line)).toEqual([2, 3])
  })
})

describe('buildResultsCsv', () => {
  it('writes the four input columns plus Outcome and Message, ids as text, blocked rows explained', () => {
    const read = readBulkFile(`${VENDOR_HEADER}\n50385,=Evil,a@b.co,CALL_CENTER_AGENT\n2,B,bad,`, ROLES)
    if (!read.ok) throw new Error('expected rows')
    read.rows[0] = { ...read.rows[0], outcome: 'roleFailed', message: 'Not allowed, sorry' }
    const lines = buildResultsCsv(read.rows, t).replace(/^﻿/, '').split('\r\n')
    expect(lines[0]).toBe('sep=,')
    expect(lines[1]).toBe('Employee id,Name,Email,Role,Outcome,Message')
    expect(lines[2]).toBe(`"=""50385""",'=Evil,a@b.co,CALL_CENTER_AGENT,Created — role not assigned,"Not allowed, sorry"`)
    expect(lines[3]).toBe('"=""2""",B,bad,,Blocked,Email is not well-formed')
  })

  it('has a label for every outcome and issue key', () => {
    for (const k of ['ready', 'blocked', 'exists', 'created', 'roleFailed', 'failed'])
      expect(t(`bulk.outcome.${k}`)).not.toBe(`bulk.outcome.${k}`)
    for (const k of ['missingId', 'missingName', 'missingEmail', 'badEmail', 'duplicateId', 'unknownRole', 'protectedRole'])
      expect(t(`bulk.issue.${k}`)).not.toBe(`bulk.issue.${k}`)
  })
})

describe('tally', () => {
  it('counts every outcome, zeros included', () => {
    const read = readBulkFile(`${VENDOR_HEADER}\n1,A,a@b.co,\n2,B,bad,`, ROLES)
    if (!read.ok) throw new Error('expected rows')
    expect(tally(read.rows)).toEqual({ ready: 1, blocked: 1, exists: 0, created: 0, roleFailed: 0, failed: 0 })
  })
})
