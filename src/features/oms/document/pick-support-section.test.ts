/**
 * Document Details' Pick support section (ticket 499, BackOffice brief 2691): whether it is drawn
 * at all, and whether its heading carries the stuck marker.
 */
import { describe, expect, it } from 'vitest'
import { permissionsOf } from '@/core/permissions'
import { headingShowsStuck, pickSupportSectionGate } from './pick-support-section'

const OPEN = permissionsOf({ screens: ['DocumentList:03', 'DocumentDetails:03', 'PickSupport:03'] })

describe('pickSupportSectionGate', () => {
  it('draws the section for a page opened as a delivery with PickSupport:03', () => {
    expect(pickSupportSectionGate('delivery', OPEN)).toBe(true)
  })

  it('never draws it for a page opened as a document, even with the grant', () => {
    expect(pickSupportSectionGate('document', OPEN)).toBe(false)
  })

  it('fails closed without the key — the fix grant alone does not open it', () => {
    expect(pickSupportSectionGate('delivery', permissionsOf({ screens: ['DocumentList:03', 'DocumentDetails:03', 'PickSupport:06'] }))).toBe(false)
  })

  it('fails closed while the answer is pending or after it failed', () => {
    expect(pickSupportSectionGate('delivery', permissionsOf(null))).toBe(false)
  })

  it('does not need the fix grant to draw the section', () => {
    expect(pickSupportSectionGate('delivery', OPEN)).toBe(true)
    expect(OPEN.has('PickSupport:06')).toBe(false)
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
