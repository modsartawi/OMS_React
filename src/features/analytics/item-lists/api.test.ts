import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { isExpiredTokenRefusal, readItemList, readPreview, TOKEN_EXPIRED_CODE } from './api'

const refusal = (code: string, status = 400) => new ApiError('business', `Refused: ${code}`, status, [{ errorCode: code, internalErrorCode: '', errorMessage: code }])

describe('isExpiredTokenRefusal: Save answered that the preview token lapsed', () => {
  it('the expired-token code is; any other refusal or failure is not', () => {
    expect(isExpiredTokenRefusal(refusal(TOKEN_EXPIRED_CODE))).toBe(true)
    expect(isExpiredTokenRefusal(refusal('ANALYTICS-406'))).toBe(false)
    expect(isExpiredTokenRefusal(new ApiError('network', 'offline', 0))).toBe(false)
    expect(isExpiredTokenRefusal(new Error('boom'))).toBe(false)
  })
})

describe('readPreview: the proposed preview wire (BackOffice 4058), read defensively', () => {
  it('reads the token, the matched rows and each problem list into one problem model, with row numbers', () => {
    const p = readPreview({
      token: 'tok-9',
      expiresAt: '2026-11-19T12:30:00Z',
      fileName: 'shortage.xlsx',
      rows: 6,
      matched: [{ row: 2, level: 'item', key: '100234', label: 'Panadol', from: '2026-09-03', to: null, status: 'unavailable', note: 'Supplier recall' }],
      unknown: [{ row: 3, level: 'item', value: '0099999' }],
      duplicates: [{ rows: [4, 5], level: 'brand', key: 'Panadol' }],
      badDates: [{ row: 6, value: '31/02/2026' }],
      overlaps: [{ rows: [2, 7], level: 'item', key: '100234' }],
      refused: [{ row: 8, level: 'item', key: '100235', reason: 'A phone number in the note.' }],
    })
    expect(p.token).toBe('tok-9')
    expect(p.rowCount).toBe(6)
    expect(p.matched).toEqual([{ row: 2, level: 'item', key: '100234', label: 'Panadol', from: '2026-09-03', to: null, status: 'unavailable', note: 'Supplier recall' }])
    expect(p.problems).toEqual([
      { kind: 'unknown', rows: [3], level: 'item', value: '0099999', reason: '' },
      { kind: 'duplicate', rows: [4, 5], level: 'brand', value: 'Panadol', reason: '' },
      { kind: 'badDate', rows: [6], level: '', value: '31/02/2026', reason: '' },
      { kind: 'overlap', rows: [2, 7], level: 'item', value: '100234', reason: '' },
      { kind: 'refused', rows: [8], level: 'item', value: '100235', reason: 'A phone number in the note.' },
    ])
  })
  it('an empty answer is an empty preview, never a throw', () => {
    expect(readPreview(null)).toEqual({ token: '', expiresAt: '', fileName: '', rowCount: 0, matched: [], problems: [] })
  })
  it('a row with an unknown level or status keeps the row, the status read as none', () => {
    const p = readPreview({ matched: [{ row: 2, level: 'item', key: '1', status: 'gone' }] })
    expect(p.matched[0].status).toBeNull()
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
        periods: [{ member: '100234', level: 'item', from: '2026-09-03', status: 'unavailable', note: 'recall' }],
        unknown: [{ row: 3, level: 'item', value: '0099999' }],
        upload: { fileName: 'shortage.xlsx', rows: 6, matched: 5, by: 'msartawi', at: '2026-11-19T09:00:00' },
      },
    })
    expect(l.title).toEqual({ en: 'Shortage Q3', ar: 'Shortage Q3' })
    expect(l.members).toEqual([{ level: 'item', key: '100234', label: 'Panadol' }])
    expect(l.periods).toEqual([{ level: 'item', member: '100234', from: '2026-09-03', to: null, status: 'unavailable', note: 'recall' }])
    expect(l.unknown).toEqual([{ row: 3, level: 'item', value: '0099999' }])
    expect(l.upload).toEqual({ fileName: 'shortage.xlsx', rows: 6, matched: 5, by: 'msartawi', at: '2026-11-19T09:00:00' })
    expect(l.folderId).toBeNull()
  })
})
