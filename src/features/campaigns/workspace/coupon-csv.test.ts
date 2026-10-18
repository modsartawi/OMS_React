import { describe, expect, it } from 'vitest'
import { codeCounts, importCsv, importTally, readBatchCsv, readCouponCsv, statusFromParam, visibleCodes } from './coupon-csv'

const BOM = String.fromCharCode(0xfeff)

describe('the coupon CSV import', () => {
  it('couponCsv_rowCheck_flagsDuplicatesAndBadCodes', () => {
    const text = [
      'code,member',
      'wknd-7q2m4x,',
      'WKND-K9P3RT,M-100231',
      '',
      'WKND 8D6WA,', // a space inside: not a code HQ takes
      'WKND-7Q2M4X,M-1', // twice in the file (any case)
      'AB,', // short is fine: HQ takes any length up to 64
      ',M-2', // no code
      'WKND-OK,M 3', // a member id HQ would not take
      'ÄBCD-1,', // not a letter or digit it takes
      '"WKND_QUOTED.1",M-3',
    ].join('\r\n')
    const read = readCouponCsv(text)
    expect(read.header).toBe(true)
    expect(read.noCodeColumn).toBe(false)
    expect(read.rows.map((r) => [r.line, r.code, r.member, r.problem])).toEqual([
      [2, 'WKND-7Q2M4X', null, null],
      [3, 'WKND-K9P3RT', 'M-100231', null],
      [5, 'WKND 8D6WA', null, 'badCode'],
      [6, 'WKND-7Q2M4X', 'M-1', 'repeated'],
      [7, 'AB', null, null],
      [8, '', 'M-2', 'noCode'],
      [9, 'WKND-OK', 'M 3', 'badMember'],
      [10, 'ÄBCD-1', null, 'badCode'],
      [11, 'WKND_QUOTED.1', 'M-3', null],
    ])
    // What is sent: the good rows as HQ reads them, `code[,customerId]` per line, no header.
    expect(importCsv(read.rows)).toBe('WKND-7Q2M4X\nWKND-K9P3RT,M-100231\nAB\nWKND_QUOTED.1,M-3')
    expect(importTally(read.rows)).toEqual({ rows: 9, ok: 4, rejected: 5 })
  })

  it('reads a file with no header by position, a semicolon or a tab, and named columns in any order', () => {
    expect(readCouponCsv('A-001;M-1\nA-002').rows.map((r) => [r.line, r.code, r.member, r.problem])).toEqual([
      [1, 'A-001', 'M-1', null],
      [2, 'A-002', null, null],
    ])
    expect(readCouponCsv(BOM + 'member_id\tcoupon_code\tnote\nM-9\tz-100\tx').rows.map((r) => [r.code, r.member])).toEqual([['Z-100', 'M-9']])
    // HQ's own export reads back as an import: `customerId` is the member column.
    expect(readCouponCsv('code,customerId,validFrom,validTo,used,disabled\r\nK-1,M-1,,,no,no\r\n').rows.map((r) => [r.code, r.member])).toEqual([['K-1', 'M-1']])
    const noCode = readCouponCsv('member,store\nM-1,S1')
    expect(noCode.noCodeColumn).toBe(true)
    expect(noCode.rows).toEqual([])
    expect(readCouponCsv('  \n').rows).toEqual([])
    // The separator is read over the first lines, not the first alone (a row with no member has none).
    expect(readCouponCsv('A-001\nA-002;M-1\nA-003;M-2').rows.map((r) => [r.code, r.member, r.problem])).toEqual([
      ['A-001', null, null],
      ['A-002', 'M-1', null],
      ['A-003', 'M-2', null],
    ])
    expect(readCouponCsv('A-001\nA-002').header).toBe(false)
  })

  it('flags the good rows past one batch of 10,000', () => {
    const many = Array.from({ length: 10002 }, (_, i) => `C-${String(i).padStart(5, '0')}`)
    // A bad row does not take a place in the batch.
    const rows = readCouponCsv(['C BAD', ...many].join('\n')).rows
    expect(rows.filter((r) => r.problem === 'tooMany').map((r) => r.line)).toEqual([10002, 10003])
    expect(importTally(rows)).toEqual({ rows: 10003, ok: 10000, rejected: 3 })
  })
})

describe('a batch read from HQ’s export', () => {
  const CSV =
    'code,customerId,validFrom,validTo,used,disabled\r\n' +
    'WKND-4F7K2Q,,,,no,no\r\n' +
    'WKND-9XH3PL,M-100231,2026-10-01,2026-10-31,yes,no\r\n' +
    'WKND-P5R8ZD,,,2026-10-10,no,yes\r\n' +
    'WKND-USEDOFF,,,,yes,yes\r\n' +
    'WKND-B3N6QW,,,2026-10-15,no,no\r\n' +
    'WKND-LASTDAY,,,2026-10-16,no,no\r\n'
  /** The reader's local day. */
  const TODAY = '2026-10-16'

  it('reads each code, its member, its local days and its status', () => {
    expect(readBatchCsv(CSV, TODAY)).toEqual([
      { code: 'WKND-4F7K2Q', customerId: null, validFrom: null, validTo: null, status: 'unused' },
      { code: 'WKND-9XH3PL', customerId: 'M-100231', validFrom: '2026-10-01', validTo: '2026-10-31', status: 'used' },
      { code: 'WKND-P5R8ZD', customerId: null, validFrom: null, validTo: '2026-10-10', status: 'disabled' },
      { code: 'WKND-USEDOFF', customerId: null, validFrom: null, validTo: null, status: 'disabled' },
      // Past its own last day: expired. Its last day is inclusive, so today it still works.
      { code: 'WKND-B3N6QW', customerId: null, validFrom: null, validTo: '2026-10-15', status: 'expired' },
      { code: 'WKND-LASTDAY', customerId: null, validFrom: null, validTo: '2026-10-16', status: 'unused' },
    ])
    // Columns by name: a column HQ adds later is ignored, a reordered one still read.
    expect(readBatchCsv('used,code,extra\nyes,K-1,x\n', TODAY)).toEqual([{ code: 'K-1', customerId: null, validFrom: null, validTo: null, status: 'used' }])
    expect(readBatchCsv('', TODAY)).toEqual([])
    expect(readBatchCsv('customerId\nM-1', TODAY)).toEqual([])
    expect(readBatchCsv('code,customerId,validFrom,validTo,used,disabled\r\n', TODAY)).toEqual([])
  })

  it('filters the codes by search and status, and counts them', () => {
    const codes = readBatchCsv(CSV, TODAY)
    expect(visibleCodes(codes, { q: '9xh', status: 'all' }).map((k) => k.code)).toEqual(['WKND-9XH3PL'])
    expect(visibleCodes(codes, { q: 'm-1002', status: 'all' }).map((k) => k.code)).toEqual(['WKND-9XH3PL'])
    expect(visibleCodes(codes, { q: '', status: 'disabled' }).map((k) => k.code)).toEqual(['WKND-P5R8ZD', 'WKND-USEDOFF'])
    expect(visibleCodes(codes, { q: '', status: 'expired' }).map((k) => k.code)).toEqual(['WKND-B3N6QW'])
    expect(codeCounts(codes)).toEqual({ unused: 2, used: 1, disabled: 2, expired: 1 })
    expect(statusFromParam('used')).toBe('used')
    expect(statusFromParam('expired')).toBe('expired')
    expect(statusFromParam('gone')).toBe('all')
    expect(statusFromParam(null)).toBe('all')
  })
})
