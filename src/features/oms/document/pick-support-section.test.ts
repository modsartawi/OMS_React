/**
 * Document Details' Pick support section (ticket 499, BackOffice brief 2691): whether it is drawn
 * at all, and whether its heading carries the stuck marker.
 */
import { describe, expect, it } from 'vitest'
import type { OmsAccessResult } from '@/core/models/oms-access'
import { headingShowsStuck, pickSupportSectionGate } from './pick-support-section'

const OPEN = { canOpenList: true, canOpenDetail: true, canOpenPickSupport: true } as OmsAccessResult

describe('pickSupportSectionGate', () => {
  it('draws the section for a page opened as a delivery with canOpenPickSupport', () => {
    expect(pickSupportSectionGate('delivery', OPEN)).toBe(true)
  })

  it('never draws it for a page opened as a document, even with the grant', () => {
    expect(pickSupportSectionGate('document', OPEN)).toBe(false)
  })

  it('fails closed without the flag: absent, false, or not a strict true', () => {
    const { canOpenPickSupport: _, ...without } = OPEN
    expect(pickSupportSectionGate('delivery', without as OmsAccessResult)).toBe(false)
    expect(pickSupportSectionGate('delivery', { ...OPEN, canOpenPickSupport: false })).toBe(false)
    expect(pickSupportSectionGate('delivery', { ...OPEN, canOpenPickSupport: 'true' } as unknown as OmsAccessResult)).toBe(false)
  })

  it('fails closed while the probe is pending or after it failed', () => {
    expect(pickSupportSectionGate('delivery', undefined)).toBe(false)
    expect(pickSupportSectionGate('delivery', null)).toBe(false)
  })

  it('does not need the fix grant to draw the section', () => {
    expect(pickSupportSectionGate('delivery', { ...OPEN, canFixPickSupport: false })).toBe(true)
  })
})

describe('headingShowsStuck', () => {
  it('marks the heading only once a STUCK diagnosis has been read', () => {
    expect(headingShowsStuck({ verdict: 'STUCK' })).toBe(true)
  })

  it('does not mark HEALTHY, UNKNOWN, an unlisted verdict, or nothing read yet', () => {
    expect(headingShowsStuck({ verdict: 'HEALTHY' })).toBe(false)
    expect(headingShowsStuck({ verdict: 'UNKNOWN' })).toBe(false)
    expect(headingShowsStuck({ verdict: 'SOMETHING_NEW' })).toBe(false)
    expect(headingShowsStuck(undefined)).toBe(false)
  })
})
