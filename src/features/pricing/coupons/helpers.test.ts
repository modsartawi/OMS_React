/**
 * Ticket 420 — the coupon template's origin filter takes the same paste box, normaliser and cap
 * as the bonus buy's (BackOffice spec 2396 story 39).
 */
import { describe, expect, it } from 'vitest'
import { TEMPLATE_ORIGIN_FILTER_MAX, templateOriginFilterMeter } from './helpers'

describe('the template origin filter', () => {
  it('origin filter cap follows the shipped width', () => {
    // ⚠ 50 until BackOffice 2403 ships the 3000-character column: then TEMPLATE_ORIGIN_FILTER_MAX flips.
    expect(TEMPLATE_ORIGIN_FILTER_MAX).toBe(50)
    const ten = Array.from({ length: 10 }, (_, i) => String(1180 + i)).join('\r\n') + '\r\n' // 49 stored
    expect(templateOriginFilterMeter(ten)).toMatchObject({ count: 10, length: 49, max: 50, over: false })
    expect(templateOriginFilterMeter(ten + '11')).toMatchObject({ count: 11, length: 52, over: true })
  })

  it('a pasted column normalises to a comma list, case kept', () => {
    expect(templateOriginFilterMeter('c000\r\n1186\t1188').normalised).toBe('c000,1186,1188')
  })
})
