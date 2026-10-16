import { describe, expect, it } from 'vitest'
import type { RuleCampaignCoupon } from '@/core/models/rule-campaign'
import { FSI, PDI } from '@/core/util/bidi'
import { couponCsv, couponCsvFileName, importTally, importableRows, readCouponCsv, withHqCheck } from './coupon-csv'

const BOM = String.fromCharCode(0xfeff)

describe('the coupon CSV import', () => {
  it('couponCsv_rowCheck_flagsDuplicatesAndBadCodes', () => {
    const text = [
      'code,member',
      'wknd-7q2m4x,',
      'WKND-K9P3RT,M-100231',
      '',
      'WKND 8D6WA,', // a space inside: bad characters
      'WKND-7Q2M4X,M-1', // twice in the file (any case)
      'AB,', // too short
      ',M-2', // no code
      'WKND-4F7K2Q,', // the campaign already has it
      'ÄBCD-1,', // not a letter or digit it takes
      '"WKND-QUOTED",M-3',
    ].join('\r\n')
    const read = readCouponCsv(text, ['WKND-4F7K2Q'])
    expect(read.header).toBe(true)
    expect(read.noCodeColumn).toBe(false)
    expect(read.rows.map((r) => [r.line, r.code, r.member, r.problem])).toEqual([
      [2, 'WKND-7Q2M4X', null, null],
      [3, 'WKND-K9P3RT', 'M-100231', null],
      [5, 'WKND 8D6WA', null, 'badCode'],
      [6, 'WKND-7Q2M4X', 'M-1', 'repeated'],
      [7, 'AB', null, 'badCode'],
      [8, '', 'M-2', 'noCode'],
      [9, 'WKND-4F7K2Q', null, 'taken'],
      [10, 'ÄBCD-1', null, 'badCode'],
      [11, 'WKND-QUOTED', 'M-3', null],
    ])
  })

  it('reads a file with no header by position, a semicolon or a tab, and named columns in any order', () => {
    expect(readCouponCsv('A-001;M-1\nA-002', []).rows.map((r) => [r.line, r.code, r.member, r.problem])).toEqual([
      [1, 'A-001', 'M-1', null],
      [2, 'A-002', null, null],
    ])
    expect(readCouponCsv(BOM + 'member_id\tcoupon_code\tnote\nM-9\tz-100\tx', []).rows.map((r) => [r.code, r.member])).toEqual([['Z-100', 'M-9']])
    const noCode = readCouponCsv('member,store\nM-1,S1', [])
    expect(noCode.noCodeColumn).toBe(true)
    expect(noCode.rows).toEqual([])
    expect(readCouponCsv('  \n', []).rows).toEqual([])
    // The separator is read over the first lines, not the first alone (a row with no member has none).
    expect(readCouponCsv('A-001\nA-002;M-1\nA-003;M-2', []).rows.map((r) => [r.code, r.member, r.problem])).toEqual([
      ['A-001', null, null],
      ['A-002', 'M-1', null],
      ['A-003', 'M-2', null],
    ])
    expect(readCouponCsv('A-001\nA-002', []).header).toBe(false)
  })

  it('flags the rows past one batch, and HQ’s answer marks codes in use and unknown members', () => {
    // The cap is laid after HQ's check: a row HQ rejects frees room for a later one.
    const many = Array.from({ length: 5002 }, (_, i) => `C-${String(i).padStart(5, '0')}`).join('\n')
    const rows = readCouponCsv(many, []).rows
    expect(rows.filter((r) => r.problem)).toEqual([])
    const capped = (inUse: string[]) => withHqCheck(rows, { inUse, unknownMembers: [] }).filter((r) => r.problem === 'tooMany').map((r) => r.line)
    expect(capped([])).toEqual([5001, 5002])
    expect(capped(['C-00007'])).toEqual([5002])

    const read = readCouponCsv('code,member\nA-001,M-1\nA-002,M-404\nA-003,\nA-001,', []).rows
    expect(importableRows(read)).toEqual([
      { code: 'A-001', member: 'M-1' },
      { code: 'A-002', member: 'M-404' },
      { code: 'A-003', member: null },
    ])
    const checked = withHqCheck(read, { inUse: ['A-003'], unknownMembers: ['M-404'] })
    expect(checked.map((r) => r.problem)).toEqual([null, 'unknownMember', 'inUse', 'repeated'])
    expect(importableRows(checked)).toEqual([{ code: 'A-001', member: 'M-1' }])
    expect(importTally(checked)).toEqual({ rows: 4, ok: 1, rejected: 3 })
  })
})

const k = (o: Partial<RuleCampaignCoupon>): RuleCampaignCoupon => ({
  code: 'WKND-4F7K2Q',
  status: 'unused',
  kind: 'random',
  uses: 0,
  member: null,
  batch: 'k3m9q2xa',
  created: '2026-09-28T11:30:00',
  from: null,
  until: null,
  ...o,
})

describe('the coupon CSV export', () => {
  it('writes a header the import reads back, one code a line, quoting where needed and no isolates', () => {
    const csv = couponCsv([
      k({}),
      k({ code: 'WKND-FLYER', status: 'used', kind: 'universal', uses: 12, from: '2026-10-01', until: '2026-10-31', batch: 'u7d2w4pe' }),
      k({ code: 'P-1', kind: 'personal', member: `${FSI}M,"7"${PDI}` }),
    ])
    expect(csv).toBe(
      BOM + 'code,member,status,kind,uses,batch,valid_from,valid_until,created\r\n' +
        'WKND-4F7K2Q,,unused,random,0,k3m9q2xa,,,2026-09-28T11:30:00\r\n' +
        'WKND-FLYER,,used,universal,12,u7d2w4pe,2026-10-01,2026-10-31,2026-09-28T11:30:00\r\n' +
        'P-1,"M,""7""",unused,personal,0,k3m9q2xa,,,2026-09-28T11:30:00\r\n',
    )
    expect(csv).not.toMatch(/[⁦-⁩]/)
    // The export reads back as an import: the same codes and members.
    expect(readCouponCsv(csv, []).rows.map((r) => [r.code, r.member, r.problem])).toEqual([
      ['WKND-4F7K2Q', null, null],
      ['WKND-FLYER', null, null],
      ['P-1', 'M,"7"', null],
    ])
  })

  it('names the file by the campaign code, and the batch when it is one batch', () => {
    expect(couponCsvFileName('WKND20', '')).toBe('WKND20-coupons.csv')
    expect(couponCsvFileName('WKND20', 'nb000001')).toBe('WKND20-nb000001.csv')
  })
})
