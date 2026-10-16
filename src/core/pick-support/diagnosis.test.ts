/**
 * The Pick support diagnosis panel's pure readings (ticket 496, brief 2691): which state the
 * verdict card takes, how a stamp reads, what a donor request's transfer is, and how the timeline
 * narrows. The panel is a thin renderer over these.
 */
import { describe, expect, it } from 'vitest'
import type { PickSupportDiagnosis, PickSupportTimelineEntry } from '@/core/models/pick-support'
import { stuckDiagnosis, timelineEntry, donorRequest } from './__fixtures__/brief'
import { filterTimeline, holdView, readStamp, timelineSources, transferView, verdictView } from './diagnosis'

const withVerdict = (verdict: string, over: Partial<PickSupportDiagnosis> = {}): PickSupportDiagnosis => ({
  ...stuckDiagnosis(),
  verdict,
  ...over,
})

describe('verdictView', () => {
  it('STUCK yields one card per shape, in the server order', () => {
    const d = stuckDiagnosis()
    const two = { ...d, shapes: [d.shapes[0], { ...d.shapes[0], shape: 'ENDED_STILL_HOLDS' }] }
    const view = verdictView(two)
    expect(view.kind).toBe('stuck')
    if (view.kind !== 'stuck') return
    expect(view.cards.map((c) => c.shape)).toEqual(['DONOR_AT_OLD_ORDER_STORE', 'ENDED_STILL_HOLDS'])
    expect(view.cards[0]).toBe(two.shapes[0])
  })

  it('HEALTHY is the quiet state', () => {
    expect(verdictView(withVerdict('HEALTHY', { shapes: [] }))).toEqual({ kind: 'healthy' })
  })

  it('UNKNOWN reads as escalate, with no fix slot', () => {
    const view = verdictView(withVerdict('UNKNOWN', { shapes: [] }))
    expect(view).toEqual({ kind: 'escalate' })
    expect('cards' in view).toBe(false)
  })

  it('an unlisted verdict reads as escalate, never as an error', () => {
    expect(verdictView(withVerdict('SOMETHING_NEW'))).toEqual({ kind: 'escalate' })
  })

  it('STUCK with no shapes reads as escalate: there is no fix to offer', () => {
    expect(verdictView(withVerdict('STUCK', { shapes: [] }))).toEqual({ kind: 'escalate' })
  })

  it('the verdict is matched exactly as sent', () => {
    expect(verdictView(withVerdict('healthy', { shapes: [] })).kind).toBe('escalate')
  })
})

describe('readStamp', () => {
  it.each(['0001-01-01T00:00:00', '0001-01-01', '1900-01-01T00:00:00', '1753-01-01T00:00:00', '0001-01-01T00:00:00Z'])(
    'the floor %s reads as the dash (null)',
    (v) => expect(readStamp(v)).toBeNull(),
  )

  it.each([null, undefined, '', '   '])('a blank stamp (%s) reads as the dash', (v) => {
    expect(readStamp(v)).toBeNull()
  })

  it('a real stamp is shown as sent, never converted', () => {
    expect(readStamp('2026-10-02T14:03:11')).toBe('2026-10-02T14:03:11')
    expect(readStamp('1901-01-01T00:00:00')).toBe('1901-01-01T00:00:00')
    // Even one carrying a zone is shown as sent: the estate's clock is the server's.
    expect(readStamp('2026-10-02T14:03:11Z')).toBe('2026-10-02T14:03:11Z')
  })

  it('a value it cannot read a year from is shown as sent', () => {
    expect(readStamp('yesterday')).toBe('yesterday')
  })
})

describe('transferView', () => {
  it('an STO with a floor posted time reads "started"', () => {
    expect(transferView(donorRequest({ transferStoNo: '4500001234', transferredAt: '0001-01-01T00:00:00' }))).toEqual({
      kind: 'started',
      stoNo: '4500001234',
    })
  })

  it('no STO reads none', () => {
    expect(transferView(donorRequest({ transferStoNo: '', transferredAt: '0001-01-01T00:00:00' }))).toEqual({ kind: 'none' })
    expect(transferView(donorRequest({ transferStoNo: '  ', transferredAt: '2026-10-01T11:00:00' }))).toEqual({ kind: 'none' })
  })

  it('both set read posted, with the time as sent and the SAP document', () => {
    expect(
      transferView(
        donorRequest({ transferStoNo: '4500001234', transferredAt: '2026-10-01T11:00:00', transferSapDocumentNo: '4900000077' }),
      ),
    ).toEqual({ kind: 'posted', stoNo: '4500001234', at: '2026-10-01T11:00:00', sapDocumentNo: '4900000077' })
  })
})

describe('filterTimeline', () => {
  const rows: PickSupportTimelineEntry[] = [
    timelineEntry({ source: 'DONOR_REQUEST', key: 'DR0000123', eventType: 'RAISE', reconstructed: true }),
    timelineEntry({ source: 'PICK_DOCUMENT', key: 'PD0000999', eventType: 'PICK', seq: 1 }),
    timelineEntry({ source: 'DELIVERY_LOG', key: '8006777365', eventType: 'DCST' }),
    timelineEntry({ source: 'PICK_DOCUMENT', key: 'PD0001234', eventType: 'VOID', seq: 2 }),
    timelineEntry({ source: 'DONOR_REQUEST', key: 'DR0000123', eventType: 'TRANSFERRED', seq: 3 }),
  ]

  it('no filter keeps every row in the server order', () => {
    expect(filterTimeline(rows, { source: '', key: '' })).toEqual(rows)
  })

  it('the source filter narrows and keeps the order', () => {
    expect(filterTimeline(rows, { source: 'PICK_DOCUMENT', key: '' }).map((r) => r.key)).toEqual(['PD0000999', 'PD0001234'])
  })

  it('the key text narrows by a trimmed, case-blind contains', () => {
    expect(filterTimeline(rows, { source: '', key: ' pd0001 ' }).map((r) => r.eventType)).toEqual(['VOID'])
    expect(filterTimeline(rows, { source: '', key: '123' }).map((r) => r.eventType)).toEqual(['RAISE', 'VOID', 'TRANSFERRED'])
  })

  it('both together narrow to their intersection', () => {
    expect(filterTimeline(rows, { source: 'DONOR_REQUEST', key: 'dr' }).map((r) => r.eventType)).toEqual(['RAISE', 'TRANSFERRED'])
  })

  it('reconstructed is carried through untouched', () => {
    const out = filterTimeline(rows, { source: 'DONOR_REQUEST', key: '' })
    expect(out.map((r) => r.reconstructed)).toEqual([true, false])
    expect(out[0]).toBe(rows[0])
  })

  it('the source options are the three known sources, then any unlisted one present', () => {
    expect(timelineSources(rows)).toEqual(['PICK_DOCUMENT', 'DONOR_REQUEST', 'DELIVERY_LOG'])
    expect(timelineSources([...rows, timelineEntry({ source: 'NEW_SOURCE' })])).toEqual([
      'PICK_DOCUMENT',
      'DONOR_REQUEST',
      'DELIVERY_LOG',
      'NEW_SOURCE',
    ])
  })
})

describe('holdView', () => {
  it.each(['LIVE_PICK', 'PUT_BACK_BASKET', 'CENTRAL_INVOICED'])('%s is neutral', (hold) => {
    expect(holdView(hold)).toBe('neutral')
  })

  it('STUCK is a warning that links to its delivery', () => {
    expect(holdView('STUCK')).toBe('stuck')
  })

  it.each(['UNKNOWN', 'SOMETHING_NEW', ''])('%s reads as escalate', (hold) => {
    expect(holdView(hold)).toBe('escalate')
  })
})
