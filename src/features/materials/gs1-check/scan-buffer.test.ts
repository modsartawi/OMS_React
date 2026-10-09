/**
 * Ticket 454 — `scanBuffer`: Enter commits a scan; FNC1/GS and `#` are preserved byte for byte;
 * pasted lines become separate scans; a duplicate is flagged on its own row, never merged; the
 * 501st is refused.
 */
import { describe, expect, it } from 'vitest'
import { GS, GS1_LIST_CAP, addScans, commitBox, emptyScanList, scanBatches, splitScans, visibleScan } from './scan-buffer'

// Fixed-length AIs (01 GTIN, 17 expiry) need no separator; the variable-length lot (10) is closed
// by GS on a scan and by # on a pasted string, before the serial (21).
const RAW = `01062812345678901727033110A12${GS}21X9`
const HASHED = '01062812345678901727033110A12#21X9'

describe('scanBuffer — Enter commits a scan', () => {
  it('a box with one scan adds one entry, the code exactly as read', () => {
    const { list, added, refused } = commitBox(emptyScanList, RAW)
    expect(added).toEqual([{ id: 1, code: RAW, duplicate: false }])
    expect(list.entries).toEqual(added)
    expect(refused).toEqual([])
  })

  it('an empty or blank box commits nothing', () => {
    expect(commitBox(emptyScanList, '').added).toEqual([])
    expect(commitBox(emptyScanList, '   ').added).toEqual([])
  })
})

describe('scanBuffer — FNC1/GS and # are preserved', () => {
  it('the GS character stays in the stored scan', () => {
    const { list } = commitBox(emptyScanList, RAW)
    expect(list.entries[0].code).toBe(RAW)
    expect([...list.entries[0].code].filter((c) => c === '\u001d')).toHaveLength(1)
  })

  it('a pasted string with # separators is kept as typed', () => {
    expect(commitBox(emptyScanList, HASHED).list.entries[0].code).toBe(HASHED)
  })

  it('nothing is trimmed or rewritten — the scan travels byte for byte', () => {
    expect(splitScans(` ${HASHED} `)).toEqual([` ${HASHED} `])
  })

  it('visibleScan shows GS as <GS> for display and export, and leaves # alone', () => {
    expect(visibleScan(RAW)).toBe('01062812345678901727033110A12<GS>21X9')
    expect(visibleScan(HASHED)).toBe(HASHED)
  })
})

describe('scanBuffer — pasted lines become separate scans', () => {
  it('splits on \\n and \\r\\n and skips blank lines', () => {
    expect(splitScans(`${RAW}\r\n${HASHED}\n\n  \nABC`)).toEqual([RAW, HASHED, 'ABC'])
  })

  it('each line is its own entry, in order, with its own id', () => {
    const { added } = commitBox(emptyScanList, `${RAW}\n${HASHED}`)
    expect(added.map((e) => [e.id, e.code])).toEqual([
      [1, RAW],
      [2, HASHED],
    ])
  })
})

describe('scanBuffer — a duplicate is flagged, never merged', () => {
  it('the same code again is a second row, flagged', () => {
    const first = addScans(emptyScanList, [RAW])
    const second = addScans(first.list, [RAW])
    expect(second.list.entries).toEqual([
      { id: 1, code: RAW, duplicate: false },
      { id: 2, code: RAW, duplicate: true },
    ])
  })

  it('a repeat inside one pasted block is flagged too', () => {
    expect(addScans(emptyScanList, [HASHED, RAW, HASHED]).added.map((e) => e.duplicate)).toEqual([false, false, true])
  })

  it('a code that differs by one byte (GS vs #) is not a duplicate', () => {
    expect(addScans(emptyScanList, [RAW, RAW.split(GS).join('#')]).added.map((e) => e.duplicate)).toEqual([false, false])
  })
})

describe('scanBuffer — the cap', () => {
  const full = addScans(
    emptyScanList,
    Array.from({ length: GS1_LIST_CAP }, (_, i) => `CODE${i}`),
  )

  it('is 500, the door’s own limit', () => {
    expect(GS1_LIST_CAP).toBe(500)
    expect(full.list.entries).toHaveLength(500)
    expect(full.refused).toEqual([])
  })

  it('refuses the 501st, and adds nothing', () => {
    const more = addScans(full.list, ['CODE500'])
    expect(more.added).toEqual([])
    expect(more.refused).toEqual(['CODE500'])
    expect(more.list.entries).toHaveLength(500)
  })

  it('a block that crosses the cap adds up to 500 and refuses the rest', () => {
    const near = addScans(emptyScanList, Array.from({ length: 498 }, (_, i) => `C${i}`))
    const more = addScans(near.list, ['A', 'B', 'C', 'D'])
    expect(more.added.map((e) => e.code)).toEqual(['A', 'B'])
    expect(more.refused).toEqual(['C', 'D'])
  })

  it('a duplicate counts against the cap like any scan', () => {
    expect(addScans(full.list, ['CODE0']).refused).toEqual(['CODE0'])
  })
})

describe('scanBuffer — batches of up to 500', () => {
  it('splits a set of scans into batches, in order', () => {
    const { added } = addScans(emptyScanList, ['A', 'B', 'C'])
    expect(scanBatches(added, 2).map((b) => b.map((e) => e.code))).toEqual([['A', 'B'], ['C']])
    expect(scanBatches(added)).toHaveLength(1)
    expect(scanBatches([])).toEqual([])
  })
})
