/**
 * Ticket 572 (BackOffice spec 3042, stories 22–24) — a callout's duty-removed count, as the board's inspector
 * (541) and a delivery's Callout sub-tab (542) show it, and the two new not-competed reasons' words. Pure. (The
 * callout's serving list is `core/serving-list/view.test.ts`.)
 */
import { describe, expect, it } from 'vitest'
import enBoard from '@/locales/en/dispatch-board.json'
import arBoard from '@/locales/ar/dispatch-board.json'
import enDoc from '@/locales/en/document.json'
import arDoc from '@/locales/ar/document.json'
import { CALLOUT_NOT_OPENED_REASONS } from '@/core/models/delivery-callout'
import type { DispatchCallout } from '@/core/models/dispatch-board'
import { localeAt as at } from '@/core/test/locale'
import { dutyRemovedView } from './view'

describe('dutyRemovedView', () => {
  it('shows the count only above 0', () => {
    expect(dutyRemovedView({ dutyRemovedCount: 3 })).toBe(3)
    expect(dutyRemovedView({ dutyRemovedCount: 0 })).toBeNull()
  })
})

describe('an older payload without the four fields', () => {
  it('still parses: no list, no duty count', () => {
    const older = JSON.parse('{"calloutId":"C1","candidateCount":3}') as Partial<DispatchCallout>
    expect(dutyRemovedView(older)).toBeNull()
  })
})

describe('the not-competed reasons', () => {
  it('include the serving list and duty reasons', () => {
    expect(CALLOUT_NOT_OPENED_REASONS).toContain('ServingListInactive')
    expect(CALLOUT_NOT_OPENED_REASONS).toContain('DutyLeftFewerThanTwo')
  })

  it('every reason has words on the board and the timeline, EN and AR', () => {
    for (const r of CALLOUT_NOT_OPENED_REASONS) {
      for (const [bundle, key] of [
        [enBoard, `notOpened.${r}`],
        [arBoard, `notOpened.${r}`],
        [enDoc, `callout.notOpened.${r}`],
        [arDoc, `callout.notOpened.${r}`],
      ] as const) {
        expect(typeof at(bundle, key), key).toBe('string')
      }
    }
    expect(at(enBoard, 'notOpened.ServingListInactive')).toBe('serving list inactive or empty')
    expect(at(enDoc, 'callout.notOpened.DutyLeftFewerThanTwo')).toBe('fewer than two stores on duty')
  })
})
