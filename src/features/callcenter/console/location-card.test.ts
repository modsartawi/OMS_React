/**
 * The location card's reading (575, BackOffice spec 2482; rows and rules: BackOffice 2468;
 * wire: contract v1.12 §3). The capture the customer sent plus the order's address as it
 * stands now → the rows, their default ticks and their notes; the ticks → the Apply body;
 * a refusal → where it is drawn.
 *
 * Every expected value is a literal worked from ticket 2468's table, never recomputed the
 * way the module computes it.
 */
import { describe, expect, it } from 'vitest'
import type { LocationCapture, SessionAddress } from '@/core/models/callcenter'
import { ApiError } from '@/core/api'
import { applyBody, applyRefusal, captureStamp, locationCard } from './location-card'

const CAPTURE: LocationCapture = {
  gpsLat: 24.774265,
  gpsLon: 46.738586,
  pinSource: 'DEVICE',
  accuracyMeters: 12,
  shortAddress: 'RIMA6904',
  addressDetails: 'Villa 4, second gate',
  capturedAt: '2026-10-26T10:14:03',
  appliedAt: '0001-01-01T00:00:00',
  appliedBy: '',
  discardedAt: '0001-01-01T00:00:00',
  discardedBy: '',
}

const ADDRESS: SessionAddress = {
  addressNumber: '77120',
  label: 'Home',
  cityCode: '0021',
  cityName: 'Riyadh',
  districtCode: 'R-114',
  districtName: 'Al Malqa',
  line: 'King Abdulaziz Rd 4',
  line2: null,
  shortAddress: 'RIMA6904',
  gpsLat: null,
  gpsLon: null,
}

const capture = (over: Partial<LocationCapture> = {}) => ({ ...CAPTURE, ...over })
const address = (over: Partial<SessionAddress> = {}) => ({ ...ADDRESS, ...over })

describe('locationCard — the pin row', () => {
  it('reads a phone pin with its accuracy, the coordinates as one string, and the Google Maps search URL', () => {
    const card = locationCard(capture(), address(), true)
    expect(card.pin).toEqual({
      source: 'DEVICE',
      accuracyMeters: 12,
      coordinates: '24.774265, 46.738586',
      mapsUrl: 'https://www.google.com/maps/search/?api=1&query=24.774265,46.738586',
      replacesEarlier: false,
    })
  })

  it('reads a hand-placed pin as MANUAL', () => {
    expect(locationCard(capture({ pinSource: 'MANUAL', accuracyMeters: 0 }), address(), true).pin.source).toBe('MANUAL')
  })

  it('says it replaces the earlier pin only when the order holds a DIFFERENT non-null pin', () => {
    expect(locationCard(capture(), address({ gpsLat: 24.7, gpsLon: 46.6 }), true).pin.replacesEarlier).toBe(true)
    expect(locationCard(capture(), address({ gpsLat: 24.774265, gpsLon: 46.738586 }), true).pin.replacesEarlier).toBe(false)
    expect(locationCard(capture(), address({ gpsLat: null, gpsLon: null }), true).pin.replacesEarlier).toBe(false)
    // A pre-1.12 server sends no pin at all: nothing to replace.
    expect(locationCard(capture(), address({ gpsLat: undefined, gpsLon: undefined }), true).pin.replacesEarlier).toBe(false)
  })

  it('keeps six decimals in the coordinates, so the pin reads as the server stores it (DECIMAL(9,6))', () => {
    const card = locationCard(capture({ gpsLat: 24.7, gpsLon: 46.7385861 }), address(), true)
    expect(card.pin.coordinates).toBe('24.700000, 46.738586')
    expect(card.pin.mapsUrl).toBe('https://www.google.com/maps/search/?api=1&query=24.700000,46.738586')
  })

  it('is ticked by default', () => {
    expect(locationCard(capture(), address(), true).ticks.pin).toBe(true)
  })
})

describe('locationCard — the Short Address row', () => {
  it('shows the captured code, ticked, with no note when the order already has the same one', () => {
    const card = locationCard(capture(), address(), true)
    expect(card.shortAddress).toEqual({ code: 'RIMA6904', orderHas: null, tickable: true })
    expect(card.ticks.shortAddress).toBe(true)
  })

  it('names the order’s code beside it when it differs', () => {
    expect(locationCard(capture(), address({ shortAddress: 'RRRD2929' }), true).shortAddress).toEqual({
      code: 'RIMA6904',
      orderHas: 'RRRD2929',
      tickable: true,
    })
  })

  it('has no note when the order has none', () => {
    expect(locationCard(capture(), address({ shortAddress: null }), true).shortAddress.orderHas).toBeNull()
  })

  it('reads "not given" with no tick when the customer skipped it — a blank never wipes', () => {
    const card = locationCard(capture({ shortAddress: '' }), address({ shortAddress: 'RRRD2929' }), true)
    expect(card.shortAddress).toEqual({ code: null, orderHas: null, tickable: false })
    expect(card.ticks.shortAddress).toBe(false)
  })

  it('treats a whitespace-only Short Address as not given', () => {
    expect(locationCard(capture({ shortAddress: '   ' }), address(), true).shortAddress.tickable).toBe(false)
  })
})

describe('locationCard — the Details row', () => {
  it('ticks "into Address line 2" when the order’s line 2 is empty', () => {
    const card = locationCard(capture(), address({ line2: null }), true)
    expect(card.details).toEqual({ text: 'Villa 4, second gate', mode: 'tick' })
    expect(card.ticks.details).toBe(true)
  })

  it('offers Copy instead, with no tick, when line 2 is already filled', () => {
    const card = locationCard(capture(), address({ line2: 'Flat 2' }), true)
    expect(card.details).toEqual({ text: 'Villa 4, second gate', mode: 'copy' })
    expect(card.ticks.details).toBe(false)
  })

  it('reads a pre-1.12 address (no line2 at all) as filled — it cannot be shown empty', () => {
    expect(locationCard(capture(), address({ line2: undefined }), true).details.mode).toBe('copy')
  })

  it('has nothing to tick or copy when the customer gave no details', () => {
    const card = locationCard(capture({ addressDetails: '  ' }), address(), true)
    expect(card.details).toEqual({ text: null, mode: 'none' })
    expect(card.ticks.details).toBe(false)
  })
})

describe('locationCard — Save to customer', () => {
  it('is shown, unticked, when a customer is attached and the order has an address', () => {
    const card = locationCard(capture(), address(), true)
    expect(card.saveToCustomer).toBe(true)
    expect(card.ticks.saveToCustomer).toBe(false)
  })

  it('is hidden with no customer attached', () => {
    expect(locationCard(capture(), address(), false).saveToCustomer).toBe(false)
  })

  it('is hidden when the order has no address', () => {
    const card = locationCard(capture(), null, true)
    expect(card.saveToCustomer).toBe(false)
    // …and with no address there is no order pin, code or line 2 to compare against.
    expect(card.pin.replacesEarlier).toBe(false)
    expect(card.shortAddress.orderHas).toBeNull()
    expect(card.details.mode).toBe('tick')
  })
})

describe('applyBody — only the ticks travel', () => {
  const card = locationCard(capture(), address(), true)

  it('is the contract’s seven fields, field for field, with no captured value in it', () => {
    const body = applyBody('TX1', 'REQ1', 'Tok000000001', card, {
      pin: true,
      shortAddress: false,
      details: true,
      saveToCustomer: true,
    })
    expect(body).toEqual({
      transactionId: 'TX1',
      requestId: 'REQ1',
      token: 'Tok000000001',
      applyPin: true,
      applyShortAddress: false,
      applyDetails: true,
      saveToCustomer: true,
    })
    const wire = JSON.stringify(body)
    for (const value of ['24.774265', '46.738586', 'RIMA6904', 'Villa 4', 'DEVICE']) expect(wire).not.toContain(value)
  })

  it('never sends a tick the card did not offer — not given, line 2 filled, save hidden', () => {
    const offered = locationCard(capture({ shortAddress: '' }), address({ line2: 'Flat 2' }), false)
    expect(
      applyBody('TX1', 'REQ1', 'T', offered, { pin: true, shortAddress: true, details: true, saveToCustomer: true }),
    ).toEqual({
      transactionId: 'TX1',
      requestId: 'REQ1',
      token: 'T',
      applyPin: true,
      applyShortAddress: false,
      applyDetails: false,
      saveToCustomer: false,
    })
  })

  it('sends everything unticked as it is — Apply with nothing still records the review', () => {
    expect(
      applyBody('TX1', 'REQ1', 'T', card, { pin: false, shortAddress: false, details: false, saveToCustomer: false }),
    ).toMatchObject({ applyPin: false, applyShortAddress: false, applyDetails: false, saveToCustomer: false })
  })
})

describe('applyRefusal — where each refusal is drawn', () => {
  const linkRefused = (code: string, message = 'Refused.') =>
    new ApiError('business', message, 409, [{ errorCode: 'LOCATION_LINK_REFUSED', internalErrorCode: '', errorMessage: message }], {
      code,
    })
  const coded = (code: string, status: number, message: string) =>
    new ApiError('business', message, status, [{ errorCode: code, internalErrorCode: '', errorMessage: message }])

  it('CCL-00031 (already applied or discarded): refetch, then show the chip or the strip', () => {
    expect(applyRefusal(linkRefused('CCL-00031'))).toEqual({ at: 'refetch' })
  })

  it('CCL-00030 (nothing captured yet): keep the card and retry once on the next poll', () => {
    expect(applyRefusal(linkRefused('CCL-00030'))).toEqual({ at: 'retry' })
  })

  it('CCL-00006 (no such link): drop the card and offer Send again', () => {
    expect(applyRefusal(linkRefused('CCL-00006'))).toEqual({ at: 'gone' })
  })

  it('CCL-00001 (not configured): drop the card and hide the action', () => {
    expect(applyRefusal(linkRefused('CCL-00001'))).toEqual({ at: 'hide' })
  })

  it('an unknown detail code keeps the card, in the server’s words', () => {
    expect(applyRefusal(linkRefused('CCL-00099', 'Something else.'))).toEqual({ at: 'card', text: 'Something else.' })
  })

  it('NO_CUSTOMER_ATTACHED is drawn on the save tick, in the console’s words', () => {
    expect(applyRefusal(coded('NO_CUSTOMER_ATTACHED', 409, 'No customer attached to session.'))).toEqual({
      at: 'save',
      key: 'location.card.refused.noCustomer',
    })
  })

  it('ADDRESS_NOT_FOR_CUSTOMER is drawn on the save tick, in the console’s words', () => {
    expect(applyRefusal(coded('ADDRESS_NOT_FOR_CUSTOMER', 403, 'Address 77120 not found for customer.'))).toEqual({
      at: 'save',
      key: 'location.card.refused.notTheirs',
    })
  })

  it('anything else is drawn on the card — the server’s sentence, else the console’s', () => {
    expect(applyRefusal(coded('SESSION_BUSY', 409, 'The order is busy.'))).toEqual({ at: 'card', text: 'The order is busy.' })
    expect(applyRefusal(new Error('boom'))).toEqual({ at: 'card', key: 'location.card.failed' })
  })
})

describe('captureStamp — has the capture already been applied or discarded?', () => {
  it('reads neither while both stamps are unset', () => {
    expect(captureStamp(capture())).toBeNull()
  })

  it('reads applied, with its time', () => {
    expect(captureStamp(capture({ appliedAt: '2026-10-26T10:16:40', appliedBy: 'a.alharbi' }))).toEqual({
      kind: 'applied',
      at: '2026-10-26T10:16:40',
    })
  })

  it('reads discarded', () => {
    expect(captureStamp(capture({ discardedAt: '2026-10-26T10:16:40' }))).toEqual({
      kind: 'discarded',
      at: '2026-10-26T10:16:40',
    })
  })
})
