/**
 * The caller bar's two derivations (ticket 409, spec 380 C7/C8): which of the rail's
 * fields it shows and in what order, and which requests chip it carries.
 *
 * Shape comes from the contract's fixtures; every value below is set by the test.
 */
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import i18next from 'i18next'
import { Trans } from 'react-i18next'
import { describe, expect, it } from 'vitest'
import type { LoyaltyMember } from '@/core/models/callcenter'
import callcenter from '@/locales/en/callcenter.json'
import { ATTACHED_SESSION } from './__fixtures__/payloads'
import { BAR_ORDER, OPEN_REQUESTS_SHORT, barFields, requestsChip } from './caller-bar'
import type { LinkedCard } from './linked-request'
import { MAX_RAIL_FIELDS, railFields } from './rail-view'

const CUSTOMER = ATTACHED_SESSION.header.customer!

const MEMBER: LoyaltyMember = {
  loyId: CUSTOMER.customerId,
  mobile: CUSTOMER.mobile,
  fullName: CUSTOMER.name,
  tier: 'Gold',
  pointsBalance: 4120,
  email: 'caller@example.com',
}

const CARD: LinkedCard = {
  documentNo: '1000004417',
  reason: 'Out of stock at the branch',
  storeCode: '1101',
  note: 'Call before arrival',
  href: '/oms/document/1000004417',
}

const ids = (fields: { id: string }[]) => fields.map((f) => f.id)

describe('barFields', () => {
  it('🚩 bar shows the same six railFields in order', () => {
    const bar = barFields(CUSTOMER, MEMBER)
    const rail = railFields(CUSTOMER, MEMBER)
    expect(bar.length).toBeLessThanOrEqual(MAX_RAIL_FIELDS)
    // The same fields with the same values — the bar only re-seats them.
    expect([...bar].sort((a, b) => a.id.localeCompare(b.id))).toEqual(
      [...rail].sort((a, b) => a.id.localeCompare(b.id)),
    )
    expect(ids(bar)).toEqual(['name', 'tier', 'points', 'mobile', 'member', 'email'])
    expect(ids(bar)).toEqual(BAR_ORDER)
  })

  it('keeps the order when the lookup is not to hand: name, mobile, member', () => {
    expect(ids(barFields(CUSTOMER, null))).toEqual(['name', 'mobile', 'member'])
  })

  it('a member for a different caller decorates nobody', () => {
    expect(ids(barFields(CUSTOMER, { ...MEMBER, loyId: '9999999999' }))).toEqual(['name', 'mobile', 'member'])
  })

  it('takes identity from the order, not from the lookup', () => {
    const bar = barFields(CUSTOMER, { ...MEMBER, fullName: 'Someone Else' })
    expect(bar.find((f) => f.id === 'name')?.value).toBe(CUSTOMER.name)
  })

  it('shows nothing before a caller is attached', () => {
    expect(barFields(null, MEMBER)).toEqual([])
  })
})

describe('requestsChip', () => {
  it('the linked request replaces the count — one order converts at most one', () => {
    expect(requestsChip({ count: 2 }, CARD)).toEqual({ kind: 'linked', card: CARD })
  })

  it('a count alone is the offer chip', () => {
    expect(requestsChip({ count: 2 }, null)).toEqual({ kind: 'offer', count: 2 })
  })

  it('silence when there is neither', () => {
    expect(requestsChip(null, null)).toBeNull()
  })
})

describe('🚩 the requests chip uses the plural short form', () => {
  const instance = i18next.createInstance()
  instance.init({ lng: 'en', resources: { en: { callcenter } }, ns: ['callcenter'], defaultNS: 'callcenter', initAsync: false })
  const render = (count: number) =>
    renderToStaticMarkup(
      createElement(Trans, {
        i18n: instance,
        ns: 'callcenter',
        i18nKey: OPEN_REQUESTS_SHORT,
        count,
        components: { n: createElement('b') },
      }),
    )

  it('says "N open requests · View", plural by count', () => {
    expect(render(1)).toBe('<b>1</b> open request · View')
    expect(render(2)).toBe('<b>2</b> open requests · View')
  })

  it('isolates the count in its own slot, never glued into the words', () => {
    for (const form of ['_one', '_other'])
      expect(instance.getResource('en', 'callcenter', `${OPEN_REQUESTS_SHORT}${form}`)).toMatch(/^<n>\{\{count\}\}<\/n> /)
  })
})
