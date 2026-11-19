import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { isExpiredTokenRefusal, readFolders, readItemList, readPreview, TOKEN_EXPIRED_CODE } from './api'

const refusal = (code: string, status = 400) => new ApiError('business', `Refused: ${code}`, status, [{ errorCode: code, internalErrorCode: '', errorMessage: code }])

describe('isExpiredTokenRefusal: Save answered that the preview token lapsed', () => {
  it("BackOffice 4058's ANALYTICS-435 is; 433 (never certified), 434 (the file refused) or any other failure is not", () => {
    expect(TOKEN_EXPIRED_CODE).toBe('ANALYTICS-435')
    expect(isExpiredTokenRefusal(refusal('ANALYTICS-435'))).toBe(true)
    expect(isExpiredTokenRefusal(refusal('ANALYTICS-433'))).toBe(false)
    expect(isExpiredTokenRefusal(refusal('ANALYTICS-434'))).toBe(false)
    expect(isExpiredTokenRefusal(refusal('ANALYTICS-406'))).toBe(false)
    expect(isExpiredTokenRefusal(new ApiError('network', 'offline', 0))).toBe(false)
    expect(isExpiredTokenRefusal(new Error('boom'))).toBe(false)
  })
})

describe("readPreview: BackOffice 4058's preview (AnalyticsItemListPreview), read defensively", () => {
  // The wire as SIS.Api writes it (System.Text.Json, camelCase): the list as it would be kept under `definition`, the
  // problems that refuse the save, the notices that do not, and a token only when it may be saved.
  const wire = {
    token: 'tok-9',
    expiresAt: '2026-11-19T12:30:00',
    name: '',
    definition: {
      version: 1,
      members: [{ level: 'item', key: '100234', label: 'Panadol' }, { level: 'brand', key: 'NUTRI', label: 'NUTRI' }],
      periods: [{ member: 'item:100234', from: '2026-09-03', status: 'unavailable', note: 'Supplier recall' }],
      unknown: [{ level: 'item', value: '0099999', row: 3 }],
      upload: { fileName: 'shortage.xlsx', rows: 6, matched: 5, unknown: 1, who: 'msartawi', when: '2026-11-19T12:00:00' },
    },
    problems: [
      { rows: [4, 5], field: 'key', reason: 'duplicate', message: 'Rows 4 and 5 name NUTRI twice.' },
      { rows: [6], field: 'from', reason: 'from', message: "Row 6: '31/02/2026' is not a date." },
      { rows: [2, 7], field: 'from', reason: 'overlap', message: 'Rows 2 and 7 give 100234 periods that overlap.' },
      { rows: [8], field: 'note', reason: 'personalData', message: 'Row 8: a note cannot hold a phone number.' },
      { rows: [], field: 'name', reason: 'tooLong', message: 'The name is too long.' },
    ],
    notices: [{ rows: [9], field: 'note', reason: 'clamped', message: 'Row 9: the note is cut to 200 characters.' }],
    overrides: [{ item: '100234', level: 'brand', group: 'NUTRI' }],
    canSave: false,
  }
  it('reads the token, the window, the counts and the definition (a period names its member as `level:key`)', () => {
    const p = readPreview(wire)
    expect([p.token, p.expiresAt]).toEqual(['tok-9', '2026-11-19T12:30:00'])
    expect([p.fileName, p.rowCount, p.matchedRows, p.unknownRows]).toEqual(['shortage.xlsx', 6, 5, 1])
    expect(p.members).toEqual([
      { level: 'item', key: '100234', label: 'Panadol' },
      { level: 'brand', key: 'NUTRI', label: 'NUTRI' },
    ])
    expect(p.periods).toEqual([{ level: 'item', member: '100234', from: '2026-09-03', to: null, status: 'unavailable', statusText: 'unavailable', note: 'Supplier recall' }])
    expect(p.unknown).toEqual([{ row: 3, level: 'item', value: '0099999' }])
    expect(p.overrides).toEqual([{ item: '100234', level: 'brand', group: 'NUTRI' }])
  })
  it("sorts each problem into its kind by the server's reason, keeping its rows and its words", () => {
    expect(readPreview(wire).problems).toEqual([
      { kind: 'duplicate', rows: [4, 5], field: 'key', reason: 'duplicate', message: 'Rows 4 and 5 name NUTRI twice.' },
      { kind: 'badDate', rows: [6], field: 'from', reason: 'from', message: "Row 6: '31/02/2026' is not a date." },
      { kind: 'overlap', rows: [2, 7], field: 'from', reason: 'overlap', message: 'Rows 2 and 7 give 100234 periods that overlap.' },
      { kind: 'refused', rows: [8], field: 'note', reason: 'personalData', message: 'Row 8: a note cannot hold a phone number.' },
      { kind: 'refused', rows: [], field: 'name', reason: 'tooLong', message: 'The name is too long.' },
    ])
    expect(readPreview(wire).notices).toEqual([{ kind: 'notice', rows: [9], field: 'note', reason: 'clamped', message: 'Row 9: the note is cut to 200 characters.' }])
  })
  it('a preview with problems carries no token (null on the wire): it reads as none', () => {
    expect(readPreview({ ...wire, token: null, expiresAt: null }).token).toBe('')
  })
  it('an empty answer is an empty preview, never a throw', () => {
    expect(readPreview(null)).toEqual({
      token: '',
      expiresAt: '',
      name: '',
      fileName: '',
      rowCount: 0,
      matchedRows: 0,
      unknownRows: 0,
      members: [],
      periods: [],
      unknown: [],
      problems: [],
      notices: [],
      overrides: [],
    })
  })
})

describe('readItemList: the list as its audience reads it', () => {
  it('reads members, periods (an open `to` stays null), unknown values and the last upload from the definition', () => {
    const l = readItemList({
      id: 'il-1',
      kind: 'itemlist',
      title: 'Shortage Q3',
      owner: 'msartawi',
      tier: 'shared',
      revision: 4,
      updatedAt: '2026-11-19T09:00:00',
      updatedBy: 'msartawi',
      audience: { everyone: true },
      definition: {
        version: 1,
        members: [{ level: 'item', key: '100234', label: 'Panadol' }],
        periods: [{ member: 'item:100234', from: '2026-09-03', status: 'unavailable', note: 'recall' }],
        unknown: [{ row: 3, level: 'item', value: '0099999' }],
        upload: { fileName: 'shortage.xlsx', rows: 6, matched: 5, unknown: 1, who: 'msartawi', when: '2026-11-19T09:00:00' },
      },
    })
    expect(l.title).toEqual({ en: 'Shortage Q3', ar: 'Shortage Q3' })
    expect(l.members).toEqual([{ level: 'item', key: '100234', label: 'Panadol' }])
    expect(l.periods).toEqual([{ level: 'item', member: '100234', from: '2026-09-03', to: null, status: 'unavailable', statusText: 'unavailable', note: 'recall' }])
    expect(l.unknown).toEqual([{ row: 3, level: 'item', value: '0099999' }])
    expect(l.upload).toEqual({ fileName: 'shortage.xlsx', rows: 6, matched: 5, unknown: 1, by: 'msartawi', at: '2026-11-19T09:00:00' })
    expect(l.folderId).toBeNull()
  })
})

describe('readItemList: a status or level the reader does not know is never made into one it does', () => {
  it('reads a known status or level in any case, as its own', () => {
    const l = readItemList({ definition: { members: [{ level: 'Brand', key: 'Panadol' }], periods: [{ member: 'brand:Panadol', from: '2026-09-03', status: 'Limited' }] } })
    expect(l.members[0].level).toBe('brand')
    expect(l.periods[0]).toMatchObject({ level: 'brand', member: 'Panadol', status: 'limited', statusText: 'Limited' })
  })
  it('keeps an unknown status as none, with the words as sent, and an unknown level as sent', () => {
    const l = readItemList({ definition: { periods: [{ member: 'shelf:1', from: '2026-09-03', status: 'recalled' }] } })
    expect(l.periods[0]).toMatchObject({ level: 'shelf', status: null, statusText: 'recalled' })
  })
})

describe('readItemList: a period names its member as `level:key`, split at the first colon', () => {
  it('a key holding a colon keeps it; a member with no level reads its level as blank', () => {
    const l = readItemList({ definition: { periods: [{ member: 'brand:A:B', from: '2026-09-03', status: 'blocked' }, { member: 'X1', from: '2026-09-03', status: 'blocked' }] } })
    expect(l.periods.map((p) => [p.level, p.member])).toEqual([
      ['brand', 'A:B'],
      ['', 'X1'],
    ])
  })
})

describe('readFolders: the folders door, as the library reads it', () => {
  const folders = [
    { id: 'f2', name: 'Supply', order: 2 },
    { id: 'f1', name: 'Pricing', order: 1 },
    { name: 'no id' },
  ]
  it('reads a bare array and a `{ folders }` envelope alike, by order', () => {
    expect(readFolders(folders)).toEqual([
      { id: 'f1', name: 'Pricing' },
      { id: 'f2', name: 'Supply' },
    ])
    expect(readFolders({ folders })).toEqual(readFolders(folders))
  })
})
