/**
 * Ticket 622 — an IDF upload is publishable only when the server's report says `ok` AND names no failing row
 * (publish is all-or-nothing); a failing row reads its message in the reader's language, English when the Arabic
 * is blank.
 */
import { describe, expect, it } from 'vitest'
import { isPublishable, rowMessage, type IdfUploadReport } from './upload'

const row = { line: 4, itemNumber: '100234', rule: 'unknownItem', messageEn: 'Unknown item', messageAr: 'صنف غير معروف' }

describe('an upload is publishable only when ok and no row failed', () => {
  it('a clean report publishes', () => {
    expect(isPublishable({ uploadId: 'U-1', ok: true, rows: [] })).toBe(true)
  })
  it('a report with failing rows does not', () => {
    expect(isPublishable({ uploadId: 'U-2', ok: false, rows: [row] })).toBe(false)
  })
  it('ok with a failing row still does not (the rows win)', () => {
    expect(isPublishable({ uploadId: 'U-3', ok: true, rows: [row] })).toBe(false)
  })
  it('not ok with no rows does not (the flag wins)', () => {
    expect(isPublishable({ uploadId: 'U-4', ok: false, rows: [] })).toBe(false)
  })
  it('no report yet, or one without an id, does not', () => {
    expect(isPublishable(null)).toBe(false)
    expect(isPublishable({ uploadId: '', ok: true, rows: [] } as IdfUploadReport)).toBe(false)
  })
  it('rows missing from the envelope count as none', () => {
    expect(isPublishable({ uploadId: 'U-5', ok: true, rows: null } as unknown as IdfUploadReport)).toBe(true)
  })
})

describe('a failing row reads its message in the reader\'s language', () => {
  it('Arabic for an Arabic reader, English otherwise, English when Arabic is blank', () => {
    expect(rowMessage(row, 'ar')).toBe('صنف غير معروف')
    expect(rowMessage(row, 'en')).toBe('Unknown item')
    expect(rowMessage({ ...row, messageAr: '' }, 'ar-SA')).toBe('Unknown item')
  })
})
