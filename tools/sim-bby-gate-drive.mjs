// Bonus-buy details affordance + its gate (ticket 118, spec 110) — drives the REAL app
// in Chromium, serving the captured `Pricing/Simulate` response from
// `.issues/assets/098-simulate-payloads/` as the wire and STUBBING the one `Auth/Permissions`
// answer (oms 914) with and without `BbyInquiry:03`. The app is not stubbed, only the wire.
//
// Its own file and its own port (5202) rather than an extension of 117's, so this slice
// and 119 run in the same wave without contending for either.
//
// The gate itself is one boolean — it needs no pure test. Its CONSEQUENCE is a mount
// decision, and only a rendered tree shows that, which is why the whole slice is proved
// here. Asserts the ticket's Done-when:
//
//   1. the control is ABSENT when the answer lacks BbyInquiry:03, PRESENT on both card kinds
//      when it holds it (the old probe's 404 "unprobed" trap went with the probe);
//   2. (gone with 914: the rail cannot render before the answer, since the screen's own
//      PosSimulation:03 gate reads the same answer);
//   3. the control opens the bonus-buy modal in place, over the basket, and closing it
//      returns to exactly that basket — on a fired card AND on a near-miss.
//
//   1. run the app:  npx vite --port 5202
//   2. node tools/sim-bby-gate-drive.mjs
import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5202}`
const DIR = '.issues/assets/098-simulate-payloads/'

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// 03-applied-and-potential: ONE fired bonus buy and ONE near-miss in a single basket —
// so "both cards carry the control" is testable on one run rather than asserted twice
// on two baskets.
const CAPTURE = JSON.parse(
  readFileSync(DIR + '03-applied-and-potential-owner-supplied.json', 'utf8'),
).response.data

// The Bby/Detail payload (contract 058, the same shape tools/bby-inquiry-drive.mjs
// serves). ⚠️ The endpoint does NOT exist in SIS.Api — which is the whole reason the
// affordance ships dark behind BbyInquiry:03.
const DETAIL = {
  header: {
    bbyNumber: '000100000131', description: 'Buy 2 Panadol, get 1 free', bbyProfile: 'HEALTH_PROMO',
    validFrom: '20260101', validTo: '20261231', validFromTime: '000000', validToTime: '235959',
    promoNumber: 'PR-24817', offerId: 'OFR-6621', linkCategoryBuy: 'A', linkCategoryGet: 'O',
    bbyStatus: 'A', condTargetType: 'M', minValue: 0, maxValue: 0, limitNumber: 1, score: 100,
    isStackable: false, allowNestedStacking: false, loyGroups: '', loyTiers: '',
    includes: '', excludes: '',
  },
  org: { salesOrganization: '1000', distributionChannel: '10', plant: '1201', currency: 'SAR' },
  buy: [
    { lineItemPos: '10', prereqType: 'MAT', isGrouping: false, identifier: '107255',
      materialNumber: '107255', description: 'Panadol Extra 24s', qty: 2, uom: 'EA',
      minValue: 0, memberCount: 0 },
  ],
  get: [
    { condNumber: '01', isGrouping: false, identifier: '107255', materialNumber: '107255',
      description: 'Panadol Extra 24s', discountType: '%', conditionType: 'ZB03', condValue: 0,
      condValueP: 100, scaleType: 'A', qty: 1, uom: 'EA', pricingUnit: 1, pricingUnitUom: 'EA',
      memberCount: 0 },
  ],
  totalDiscount: null,
}

/**
 * The grant under test, as the `Auth/Permissions` answer carries it:
 *
 * - `granted`  — BbyInquiry:03 held → control PRESENT.
 * - `denied`   — BbyInquiry:03 absent → control ABSENT.
 */
let accessState = 'granted'

async function run() {
  const browser = await chromium.launch()
  // 1600 px: the work area clears the 900 px container breakpoint, so the rail sits
  // beside the results. The stacked arrangement is ticket 119's drive.
  const page = await browser.newPage({ viewport: { width: 1600, height: 1100 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    errors.push(m.text())
  })

  let detailCalls = 0
  // The `bbyNumber` the modal actually asked for — the proof that it is keyed on the
  // CARD that opened it rather than on whatever the rail listed first.
  let lastDetailBby = null

  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (p === 'Auth/Permissions')
      return route.fulfill(permissions(['PosSimulation:03', ...(accessState === 'granted' ? ['BbyInquiry:03'] : [])]))
    if (p === 'Pricing/Simulate') return route.fulfill(envelope(CAPTURE))
    if (p === 'Bby/Detail') {
      detailCalls++
      lastDetailBby = new URL(route.request().url()).searchParams.get('bbyNumber')
      return route.fulfill(
        envelope({ ...DETAIL, header: { ...DETAIL.header, bbyNumber: lastDetailBby } }),
      )
    }
    return route.fulfill(envelope({}))
  })

  const rail = () => page.locator('[data-promotions-rail]')
  const controls = () => page.locator('[data-bby-details]')
  const dialog = () => page.locator('dialog[open]')

  /** Load the screen fresh (a reload, so the query cache carries nothing over from the
   *  previous grant), type a basket and Process it. */
  const runBasket = async () => {
    await page.goto(`${BASE}/pricing/simulation`)
    await page.locator('[data-run-strip]').waitFor()
    await page.locator('table').first().locator('tbody input').first().fill('107255')
    await page.locator('table').first().locator('tbody input').nth(1).fill('1')
    await page.getByRole('button', { name: /Process/ }).first().click()
    await rail().waitFor()
    await page.waitForTimeout(300)
  }

  /** How many controls each card kind carries. */
  const controlsByCard = () =>
    rail().evaluate((el) =>
      [...el.querySelectorAll('[data-promo-card]')].map((c) => ({
        kind: c.getAttribute('data-promo-card'),
        bby: c.getAttribute('data-bby'),
        control: c.querySelector('[data-bby-details]')?.innerText.trim() ?? null,
        // The control must be LAST on the card, below the amount — and must not have
        // borrowed the chip treatment (no chip on this screen is ever clickable).
        isLast: c.lastElementChild?.hasAttribute('data-bby-details') ?? false,
        // "Never a chip" is a claim about the CHIP TREATMENT, not about one utility
        // class — so the test is the shared chip ground itself (`KIND_CHIP` =
        // `bg-muted text-muted-foreground`, promo-kind.ts) plus the pill radius. A
        // control built chip-shaped by some other route still fails this.
        //  A `hover:` tint is not the chip ground, so the class must be RESTING —
        //  hence the leading start-or-space rather than a bare word boundary.
        chipShaped: [/(^|\s)rounded-full\b/, /(^|\s)bg-muted\b/, /(^|\s)text-muted-foreground\b/].some(
          (re) => re.test(c.querySelector('[data-bby-details]')?.className ?? ''),
        ),
      })),
    )

  /** The other half of the same rule: nothing chip-shaped anywhere in the rail is
   *  clickable. That is what makes "a chip is a readout" enforceable rather than a
   *  convention only this one control happens to honour. */
  const clickableChips = () =>
    rail().evaluate((el) =>
      [...el.querySelectorAll('*')].filter(
        (n) =>
          typeof n.className === 'string' &&
          /\brounded-full\b/.test(n.className) &&
          (n.tagName === 'BUTTON' || n.tagName === 'A' || n.closest('button,a') !== null),
      ).length,
    )

  // ============================================================== 2 · denied — absent
  accessState = 'denied'
  await runBasket()
  let cards = await controlsByCard()
  check(
    'the capture puts one FIRED and one NEAR-MISS card in the rail — both kinds under test',
    cards.length === 2 && cards.some((c) => c.kind === 'fired') && cards.some((c) => c.kind === 'missed'),
    cards.map((c) => c.kind).join(', ') || '(no cards)',
  )
  check(
    'grant DENIED (no BbyInquiry:03): no control on any card',
    (await controls().count()) === 0,
    `${await controls().count()} control(s)`,
  )
  check('so no click can reach Bby/Detail', detailCalls === 0, `${detailCalls} Bby/Detail call(s)`)
  check(
    'the rail itself is unaffected by the denial — the cards are the verdict, not the grant',
    (await rail().count()) === 1 && (await controlsByCard()).length === 2,
  )

  // ========================================= 3 · confirmed — present on BOTH card kinds
  accessState = 'granted'
  await runBasket()
  cards = await controlsByCard()
  check(
    'grant HELD (BbyInquiry:03): both cards carry the control',
    cards.length === 2 && cards.every((c) => c.control === 'Bonus buy details'),
    cards.map((c) => `${c.kind}:${c.control}`).join(' · '),
  )
  check(
    'and the near-miss carries it too — the STRONGER case, since the wire sends a miss no prerequisites at all',
    cards.find((c) => c.kind === 'missed')?.control === 'Bonus buy details',
    String(cards.find((c) => c.kind === 'missed')?.control),
  )
  check(
    'it is LAST on each card, below the amount',
    cards.every((c) => c.isLast),
    cards.map((c) => `${c.kind}:${c.isLast}`).join(' · '),
  )
  check(
    'and it is never a chip — it borrows neither the pill radius nor the shared chip ground',
    cards.every((c) => !c.chipShaped),
    cards.map((c) => `${c.kind}:${c.chipShaped}`).join(' · '),
  )
  check(
    'the rule holds the other way too — nothing chip-shaped in the rail is clickable',
    (await clickableChips()) === 0,
    `${await clickableChips()} clickable chip(s)`,
  )

  // ================================= 5 · it opens the record in place, and closes back
  const openFrom = async (kind) => {
    await page.locator(`[data-promo-card="${kind}"]`).first().locator('[data-bby-details]').click()
    await dialog().waitFor()
    await page.waitForTimeout(300)
  }

  const basketBefore = await page.locator('table').first().innerText()

  await openFrom('fired')
  check(
    'clicking the control on a FIRED card opens the bonus-buy record as a modal',
    (await dialog().count()) === 1 && detailCalls === 1,
    `${await dialog().count()} dialog(s), ${detailCalls} Bby/Detail call(s)`,
  )
  check(
    'the modal shows the RECORD — its number, its buy side and its get side',
    new RegExp(lastDetailBby).test(await dialog().innerText()) &&
      /Buy/.test(await dialog().innerText()) &&
      /then/i.test(await dialog().innerText()),
    (await dialog().innerText()).replace(/\s+/g, ' ').slice(0, 160),
  )
  check(
    'it opens IN PLACE, over the basket — the results and the rail are still mounted behind it',
    (await rail().count()) === 1 && (await page.locator('[data-work-area="results"]').count()) === 1,
  )

  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
  check(
    'closing it returns to the basket exactly as it was — nothing re-ran, nothing collapsed',
    (await dialog().count()) === 0 &&
      (await page.locator('table').first().innerText()) === basketBefore &&
      (await controlsByCard()).length === 2,
  )

  // The core Modal carries no close button (title bar + body only), so its two dismissal
  // paths are Escape and the backdrop — and BOTH have to land back on the basket, not
  // just the one a keyboard takes. A backdrop click is a click whose target IS the
  // <dialog> element; anything over the content bubbles from a child instead.
  await openFrom('fired')
  // Top-left of the viewport: outside the centred dialog's box, so the click lands on
  // the backdrop — which reports the <dialog> itself as its target.
  await page.mouse.click(5, 5)
  await page.waitForTimeout(300)
  check(
    'the BACKDROP dismisses it too, back to the same basket — not only Escape',
    (await dialog().count()) === 0 &&
      (await page.locator('table').first().innerText()) === basketBefore &&
      (await controlsByCard()).length === 2,
    `${await dialog().count()} dialog(s) after a backdrop click`,
  )

  const missedBby = (await controlsByCard()).find((c) => c.kind === 'missed').bby
  // Relative, not absolute: re-opening the SAME bonus buy is served from the query cache
  // and issues no second request, so only the DELTA for a new bby is a real claim.
  const callsBefore = detailCalls
  await openFrom('missed')
  check(
    'and the control on a NEAR-MISS card opens the same modal — the only route to a miss\'s rules',
    (await dialog().count()) === 1,
    `${await dialog().count()} dialog(s), ${detailCalls} Bby/Detail call(s)`,
  )
  check(
    'it asked for THAT card\'s bonus buy, not the fired one — the modal is keyed on the card',
    lastDetailBby === missedBby && detailCalls === callsBefore + 1,
    `asked ${lastDetailBby} · card ${missedBby}`,
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  check('closing the near-miss modal returns to the basket too', (await dialog().count()) === 0)

  check('no page errors while driving the gate', errors.length === 0, errors.join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
