// The route from an offer the caller nearly qualified for to the rules behind it.
//
//   1. run the app:  npx vite --port 5199
//   2. DRIVE_PORT=5199 node tools/bby-link-drive.mjs
//
// Two screens, one address (`bbyDetailHref`):
//   theCardLinksOut
//     1. an open guidance card carries *Bonus buy details* pointing at the
//        inquiry screen's deep link for THAT offer;
//     2. 🚩 it opens a NEW TAB — the console is a live call, and a link that
//        replaced it would take the basket the agent is reading out;
//     3. an offer the wire named with a blank id (859, which is every offer in
//        dev master data) draws NO link — never one to an unfiltered grid;
//     4. a closed card does not carry it: the rules are the follow-up question,
//        not the card's answer.
//   theLinkLands
//     5. arriving on `?bby=<number>` opens that bonus buy's detail modal, with
//        no click;
//     6. the grid behind it is searched to that record and NOT active-only — an
//        expired bonus buy somebody was sent to look at must still be there;
//     7. closing the modal leaves an ordinary inquiry screen on that record, and
//        the param is gone so a refresh does not reopen it.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const OFFER = 'BBY-5510'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

/** A near-miss the agent can act on — one material short of the offer. */
const nearMiss = (offerId) => ({
  offerId,
  description: '70% 2nd PCS',
  isReady: false,
  progress: { have: 1, need: 2 },
  prereq: { kind: 'material', materialNumber: '200021', eligibleCount: 1 },
  skipReason: null,
})

const STATE = (offerId) => ({
  contractVersion: '1.10',
  transactionId: 'T-LINK-0001',
  version: 3,
  etag: 'e3',
  status: 'open',
  replayed: false,
  header: {
    plant: '1001',
    plantName: 'King AbdelAziz Road',
    plantSource: 'agent',
    deliveryType: 'Delivery',
    documentSource: 'CLCN',
    sourceReference: 'CALL-857-02',
    customer: { customerId: 'C1', name: 'Redacted Customer', mobile: '9665000', loyaltyAttached: true },
    address: null,
    slot: null,
    paymentType: 'CashOnDelivery',
    coupons: [],
    note: null,
  },
  lines: [],
  totals: { net: 0, vat: 0, payable: 0, deliveryFee: null },
  firedPromotions: [],
  nearMisses: [nearMiss(offerId)],
  pendingConfirmation: null,
  capabilities: {
    canAddItem: true,
    canSubmit: false,
    canChangeStore: true,
    canOpenAddressBook: true,
    canChangePaymentType: true,
    canChangeFulfilment: true,
    submitBlockers: ['NO_LINES'],
  },
})

const BBY_ROW = {
  bbyNumber: OFFER,
  description: '70% 2nd PCS',
  bbyProfile: 'HEALTH_PROMO',
  validFrom: '20260101',
  validTo: '20261231',
  bbyStatus: 'A',
  salesOrganization: '1000',
  distributionChannel: '10',
  plant: '1001',
  createdBy: 'msartawi',
  isActive: true,
}

const DETAIL = {
  header: {
    bbyNumber: OFFER,
    description: '70% 2nd PCS',
    bbyProfile: 'HEALTH_PROMO',
    validFrom: '20260101',
    validTo: '20261231',
    validFromTime: '000000',
    validToTime: '235959',
    promoNumber: 'PR-24817',
    offerId: OFFER,
    linkCategoryBuy: 'A',
    linkCategoryGet: 'O',
    bbyStatus: 'A',
    condTargetType: 'M',
    minValue: 0,
    maxValue: 0,
    limitNumber: 1,
    score: 100,
    isStackable: false,
    allowNestedStacking: false,
    loyGroups: '',
    loyTiers: '',
    includes: '',
    excludes: '',
  },
  org: { salesOrganization: '1000', distributionChannel: '10', plant: '1001', currency: 'SAR' },
  buy: [
    {
      lineItemPos: '10',
      prereqType: 'MAT',
      isGrouping: false,
      identifier: '200021',
      materialNumber: '200021',
      description: 'DEO SPRAY MODN CHARM',
      qty: 2,
      uom: 'EA',
      minValue: 0,
      memberCount: 0,
    },
  ],
  get: [],
  totalDiscount: null,
}

/** Every list query this drive saw, so the deep link's own search can be read. */
let listQueries = []

async function open(browser, { offerId = OFFER } = {}) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  listQueries = []
  await page.route('**/api/**', (route) => {
    const url = route.request().url()
    const path = new URL(url).pathname.replace(/^\/api\//, '').split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({
          authenticated: true,
          userId: 'a.alharbi',
          displayName: 'A. Alharbi',
          currentStoreCode: '1001',
        }),
      )
    if (path === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (path === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state: STATE(offerId), existing: null }))
    if (path === 'CallCenterWeb/State') return route.fulfill(envelope(STATE(offerId)))
    if (path === 'CallCenterWeb/MyDocumentSources')
      return route.fulfill(envelope([{ documentSource: 'CLCN', name: 'Call centre' }]))
    if (path === 'CallCenterWeb/ResolvePrereq')
      return route.fulfill(envelope({ offerId, topN: [], eligibleCount: 1 }))
    if (path === 'Bby/List') {
      listQueries.push(url.includes('?') ? url.split('?')[1] : '')
      return route.fulfill(envelope({ rows: [BBY_ROW], capReached: false }))
    }
    if (path === 'Bby/Detail') return route.fulfill(envelope(DETAIL))
    if (/Access$/.test(path))
      return route.fulfill(
        envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }),
      )
    return route.fulfill(envelope([]))
  })
  return { context, page }
}

async function run() {
  const browser = await chromium.launch()

  // ---- 1–2, 4. the card links out ----
  {
    const { context, page } = await open(browser)
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-guidance]').waitFor({ timeout: 15_000 })

    const link = page.locator(`[data-cc-bby-details="${OFFER}"]`)
    await link.waitFor({ timeout: 5_000 })
    check('the open card carries *Bonus buy details*', await link.isVisible())
    check('...pointing at that offer\'s record on the inquiry screen',
      (await link.getAttribute('href')) === `/pricing/bonus-buy-inquiry?bby=${OFFER}`,
      await link.getAttribute('href'))
    check('🚩 ...in a NEW TAB — the console is a live call, not a page to leave',
      (await link.getAttribute('target')) === '_blank' &&
        (await link.getAttribute('rel'))?.includes('noopener'))

    // 4. close the card — the rules are the follow-up question, not the answer.
    await page.locator(`[data-cc-card="${OFFER}"] button[aria-expanded]`).first().click()
    await page.locator(`[data-cc-card="${OFFER}"][data-cc-card-open="closed"]`).waitFor({ timeout: 5_000 })
    check('a closed card does not carry it',
      (await page.locator('[data-cc-bby-details]').count()) === 0)
    await context.close()
  }

  // ---- 3. the offer with no id (859) ----
  {
    const { context, page } = await open(browser, { offerId: '' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-guidance]').waitFor({ timeout: 15_000 })
    await page.locator('[data-cc-qualifying-unaddressable]').waitFor({ timeout: 5_000 })
    check('🚩 an offer that arrived without an id draws no link at all',
      (await page.locator('[data-cc-bby-details]').count()) === 0,
      'never a link to an unfiltered grid')
    await context.close()
  }

  // ---- 5–7. the link lands ----
  {
    const { context, page } = await open(browser)
    await page.goto(`${BASE}/pricing/bonus-buy-inquiry?bby=${OFFER}`)
    await page.locator('[data-bby-detail-modal], dialog[open]').first().waitFor({ timeout: 15_000 })
    check('arriving on the link opens that bonus buy, with no click',
      (await page.locator('dialog[open]').count()) === 1)
    check('...on the record it names',
      (await page.locator('dialog[open]').innerText()).includes(OFFER))
    const q = new URLSearchParams(listQueries[0] ?? '')
    check('the grid behind it is searched to that number',
      q.get('bbyNumber') === OFFER, listQueries[0])
    check('🚩 ...and NOT active-only — an expired bonus buy must still be there',
      q.get('activeOnly') !== 'true', `activeOnly=${q.get('activeOnly')}`)

    await page.keyboard.press('Escape')
    await page.waitForTimeout(300)
    check('closing it leaves an ordinary inquiry screen',
      (await page.locator('dialog[open]').count()) === 0)
    check('...with the link\'s instruction spent, so a refresh does not reopen it',
      !page.url().includes('bby='), page.url())
    await context.close()
  }

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((error) => {
  console.error(error)
  process.exit(1)
})
