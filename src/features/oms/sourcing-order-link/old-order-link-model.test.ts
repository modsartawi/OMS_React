/**
 * Ticket 974 (BackOffice 4397, spec 4354 §20): the old advisor's order link opens that order's stored run in the
 * simulator, or says it has none and offers a replay. Fed the door's replies as its own test reads them
 * (`OldOrderLinkTests.OldOrderLink_OpensTheStoredRun_OrOffersAReplay`).
 */
import { describe, expect, it } from 'vitest'
import type { ResultsOrderRunReply } from '@/core/models/sourcing-order-run'
import en from '@/locales/en/sourcing-order-link.json'
import ar from '@/locales/ar/sourcing-order-link.json'
import { askedNumber, oldOrderLinkAnswer, storedLineKey } from './old-order-link-model'

describe('the stored run\'s sentence (review 3 #5)', () => {
  it('names when the run was made, and with no time leaves the "made …" clause out, in English and Arabic', () => {
    expect(storedLineKey('2026-11-24T10:15:00')).toBe('stored.line')
    const key = storedLineKey(null)
    expect(key).toBe('stored.lineUndated')
    for (const locale of [en, ar]) {
      const line = (locale.stored as Record<string, string>)[key.split('.')[1]]
      expect(line).toContain('<order>{{order}}</order>')
      expect(line).not.toContain('ranAt')
    }
  })
})

const reply = (over: Partial<ResultsOrderRunReply> = {}): ResultsOrderRunReply => ({
  asked: '4500718264',
  orderNumber: '4500718264',
  orderKnown: true,
  runId: '94397R01',
  state: 'COMPARISON',
  ranAt: '2026-11-24T10:15:00',
  hasSummary: true,
  offerReplay: false,
  ...over,
})
const RUN = { canOpenRun: true, canReplay: true }
const VIEW_ONLY = { canOpenRun: false, canReplay: false }

describe('the number the old link carries', () => {
  it('is trimmed, and a blank one asks nothing', () => {
    expect(askedNumber(' 8000000253 ')).toBe('8000000253')
    expect(askedNumber('   ')).toBeNull()
    expect(askedNumber(undefined)).toBeNull()
  })
})

describe('a stored run opens the simulator', () => {
  it('opens the order’s stored run by its link, for a holder of the run grant', () => {
    expect(oldOrderLinkAnswer(reply(), RUN)).toEqual({ kind: 'open', to: '/oms/sourcing-simulator?run=94397R01' })
  })

  it('a delivery’s number opens its order’s run too', () => {
    expect(oldOrderLinkAnswer(reply({ asked: '8000000253' }), RUN)).toEqual({ kind: 'open', to: '/oms/sourcing-simulator?run=94397R01' })
  })

  it('under the view grant alone, says the run is stored but does not open the simulator', () => {
    expect(oldOrderLinkAnswer(reply({ runId: '94397R04', state: 'KEPT', hasSummary: false }), VIEW_ONLY)).toEqual({
      kind: 'stored',
      orderNumber: '4500718264',
      ranAt: '2026-11-24T10:15:00',
      hasSummary: false,
    })
  })
})

describe('none offers a replay', () => {
  const none = reply({ runId: null, state: null, ranAt: null, hasSummary: false, offerReplay: true })

  it('says the order has none and offers to replay it in the simulator', () => {
    expect(oldOrderLinkAnswer(none, RUN)).toEqual({
      kind: 'none',
      orderNumber: '4500718264',
      replayTo: '/oms/sourcing-simulator?replay=4500718264',
      hasSummary: false,
    })
  })

  it('replays the order, not the delivery number the link carried', () => {
    const answer = oldOrderLinkAnswer({ ...none, asked: '8000000253' }, RUN)
    expect(answer).toMatchObject({ kind: 'none', replayTo: '/oms/sourcing-simulator?replay=4500718264' })
  })

  it('keeps the results page’s order card when its summary is still kept (the record is past its 90 days)', () => {
    expect(oldOrderLinkAnswer({ ...none, hasSummary: true }, RUN)).toMatchObject({ kind: 'none', hasSummary: true })
  })

  it('offers no replay without the run grant', () => {
    expect(oldOrderLinkAnswer(none, VIEW_ONLY)).toMatchObject({ kind: 'none', replayTo: null })
  })
})

describe('a number that names no order', () => {
  it('says so, with nothing to open or replay', () => {
    const unknown = reply({ asked: '943979999', orderNumber: '', orderKnown: false, runId: null, state: null, ranAt: null, hasSummary: false })
    expect(oldOrderLinkAnswer(unknown, RUN)).toEqual({ kind: 'unknown', asked: '943979999' })
  })
})
