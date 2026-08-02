// Nphies authorization SESSION drive (ticket 217, spec 209, contract v1.0) — drives the
// REAL app in Chromium against a MOCKED engine session.
//
// ⚠ SIS.Api is down and this slice's server dependency is the largest and riskiest term in
// the whole effort: six session verbs, a *parallel* build, being written in the other
// repository. So the network is stubbed at Playwright against the contract's own shapes —
// the same code-complete / runtime-blocked posture 211–216 shipped under. The stub is a
// small ENGINE rather than a fixture server: it holds a transaction, bumps `version` on
// every save, mints an `etag`, keeps voided lines and refuses a duplicate item, because
// every one of those is a contract assertion this drive exists to make.
//
// It verifies ticket 217's flow Proof bullet end to end:
//   open → add → refuse a duplicate → change quantity → void → leave with a warning
// plus the four things that fail silently:
//   🚩 identity renders as read-only VALUES, not disabled controls (story 24);
//   🚩 the duplicate refusal NAMES THE QUANTITY CONTROL and costs no round trip (§2.3);
//   🚩 a voided line is KEPT, not removed (law 2);
//   🚩 a stale state never replaces a newer one — `core/`s guard, in the browser (§2.1).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/nphies-authorization-session-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const ELIGIBILITY_ID = 'ELG-1'
const MEMBER_ID = 'MEM-4477'
const FORM_URL = `${BASE}/nphies/authorizations/new?from=${ELIGIBILITY_ID}&coverage=${MEMBER_ID}`

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

/** A guardrail refusal exactly as §6 kind 2 defines it: a non-2xx carrying the envelope,
 *  a human server-supplied message and a machine code. */
const refusal = (status, code, message) =>
  envelope(null, { status, success: false, message, errors: [{ errorCode: code, errorMessage: code }] })

// ---------------------------------------------------------------------------
// The catalogue the stubbed engine prices from. Not an endpoint — §1.2 keeps item search
// off this door — just what the door knows how to put on a request.
const CATALOGUE = {
  100001: { description: 'PANADOL 500MG TAB', unitPrice: 25, group: 'Generic' },
  100002: { description: 'AMOXICILLIN 500MG CAP', unitPrice: 12.5, group: 'Brand' },
  100003: { description: 'VENTOLIN INHALER', unitPrice: 31, group: 'Brand-IR' },
}

// §2's `reference` — fetched from the eligibility at Open, read-only forever.
const REFERENCE = {
  eligibilityId: ELIGIBILITY_ID,
  memberId: MEMBER_ID,
  patientId: '0000000003',
  patientName: 'Ahmad Ali',
  patientGender: 'male',
  patientBirthDate: '1988-04-02',
  patientIdType: 'NI',
  payerCode: 'PAY-9',
  providerCode: 'P001',
  policyNumber: 'POL-77',
  policyStartDate: '2026-01-01',
  policyEndDate: '2026-12-31',
  policyHolder: 'ACME INSURANCE',
}

let scenario = {
  access: { canOpenNphies: true },
  accessDown: false,
  contractVersion: '1.0',
  actingStore: '1101',
  /** Serve the State read a DELIBERATELY OLDER projection — the slow-response race §2.1
   *  exists for, reproduced on demand. */
  staleRead: false,
  /** Refuse every session verb with §6's `SESSION_CLOSED`, reason `swept`. */
  sessionClosed: false,
}

const calls = { open: [], addItem: [], changeQty: [], voidLine: [], abandon: [], state: 0 }

/** The stubbed engine's one transaction. */
let tx = null

const save = () => {
  tx.version += 1
  tx.etag = `E${tx.version}`
}

const projection = () => ({
  contractVersion: scenario.contractVersion,
  transactionId: tx.transactionId,
  version: tx.version,
  etag: tx.etag,
  status: tx.status,
  // 🚩 The acting store, bound at Open and never accepted from a body (law 8 / law 7).
  plant: tx.plant,
  reference: REFERENCE,
  header: {
    serviceDate: '2026-08-02',
    diagnoses: [],
    exceptionPrescription: false,
    daysSupplyDefault: 30,
    reasonForVisit: '',
  },
  insurance: {
    g1: { rate: 20, max: 500, paid: 0 },
    g2: { rate: 30, max: 500, paid: 200 },
    g3: { rate: 100, max: 0, paid: 0 },
  },
  lines: tx.lines,
  submitBlockers: [{ code: 'NO_ATTACHMENTS', message: 'Attach the prescription before submitting.' }],
  replayed: false,
})

/** A line as the engine lands it: **pending**, with no money yet — which is what lets the
 *  row price IN PLACE and say so while it waits (story 27). */
function landLine(itemNumber, qty) {
  const item = CATALOGUE[itemNumber]
  tx.sequence += 1
  tx.lines.push({
    lineId: `L${tx.sequence}`,
    sequence: tx.sequence,
    voided: false,
    itemNumber,
    itemDescription: item.description,
    quantity: qty,
    unitPrice: 0,
    extendedPrice: 0,
    amount: 0,
    netAmount: 0,
    vat: 0,
    discountPercentage: 0,
    discountAmount: 0,
    actualPatientShare: 0,
    deductibleG: 0,
    deductibleGroupName: item.group,
    maxCoverage: 0,
    daysSupply: 30,
    selectionReason: '',
    selectionReasonEditable: item.group !== 'Generic',
    pricing: 'pending',
  })
}

/** The engine finishing its pricing run. Every amount below is the SERVER's; the browser
 *  computes none of them and the drive asserts the rendered figures against these. */
function priceLines() {
  for (const line of tx.lines) {
    const unitPrice = CATALOGUE[line.itemNumber].unitPrice
    const extended = Number((unitPrice * line.quantity).toFixed(2))
    line.unitPrice = unitPrice
    line.extendedPrice = extended
    line.amount = extended
    line.discountPercentage = 0
    line.discountAmount = 0
    line.netAmount = extended
    line.vat = Number((extended * 0.15).toFixed(2))
    line.actualPatientShare = Number((extended * 0.2).toFixed(2))
    line.deductibleG = line.actualPatientShare
    line.pricing = 'settled'
  }
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1700, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  // ⚠ `Failed to load resource: … 409/404` is Chromium narrating the refusals this drive
  // DELIBERATELY serves. Counting them as defects would make the taxonomy's own happy
  // path look like a crash.
  page.on(
    'console',
    (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const path = url.split('/api/')[1].split('?')[0]
    const query = new URLSearchParams(url.split('?')[1] || '')
    const body = () => JSON.parse(route.request().postData() || '{}')

    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({
          authenticated: true,
          userId: 'msartawi',
          currentStoreCode: scenario.actingStore,
        }),
      )
    if (path === 'Nphies/Access') {
      if (scenario.accessDown)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'down' }))
      return route.fulfill(envelope(scenario.access))
    }

    // The eligibility 217 is raised FROM — 213's seam, so the drive can prove the two
    // features meet at a URL rather than at an object.
    if (path === `Nphies/EligibilityResponse/${ELIGIBILITY_ID}`)
      return route.fulfill(
        envelope({
          id: ELIGIBILITY_ID,
          eligibilityPurpose: 'benefits',
          providerCode: REFERENCE.providerCode,
          payerCode: REFERENCE.payerCode,
          patientId: REFERENCE.patientId,
          patientIdType: 'NI',
          patientGender: 'male',
          patientName: REFERENCE.patientName,
          patientBirthDate: REFERENCE.patientBirthDate,
          actionDateTime: '2026-08-02T09:15:00',
          errorMessage: '',
          inforce: true,
          outcome: 'complete',
          disposition: 'Eligible',
          notInForceReason: '',
          success: true,
          coverage: true,
          coverageId: 'COV-1',
          network: 'GOLD',
          class: 'A',
          statusCode: 200,
          isEligible: true,
          siteEligibility: 'eligible',
          transfer: false,
          newborn: false,
          occupation: '',
          maritalStatus: '',
          coverages: [
            {
              id: 'COV-1',
              sequence: 1,
              coverageId: 'COV-1',
              memberId: MEMBER_ID,
              subscriberId: 'SUB-1',
              network: 'GOLD',
              coveragePlan: 'PLAN-A',
              coverageClass: 'A',
              coverageGroup: 'G1',
              policyHolderName: REFERENCE.policyHolder,
              inForce: true,
              benefitStart: '2026-01-01',
              benefitEnd: '2026-12-31',
              periodStart: '2026-01-01',
              periodEnd: '2026-12-31',
            },
          ],
        }),
      )

    // ---- The session verbs (§1.2) ----------------------------------------
    if (path === 'Nphies/Session/Open') {
      calls.open.push(body())
      tx = {
        transactionId: '01JC8ABCDEFGHJKMNPQRSTVWXY',
        version: 1,
        etag: 'E1',
        status: 'open',
        // Bound from the agent's own session server-side — never from the body.
        plant: scenario.actingStore,
        lines: [],
        sequence: 0,
      }
      return route.fulfill(envelope({ outcome: 'opened', state: projection() }))
    }
    if (path === 'Nphies/Session/State') {
      calls.state += 1
      if (!tx || query.get('transactionId') !== tx.transactionId)
        return route.fulfill(refusal(409, 'SESSION_CLOSED', 'This request is no longer open.'))
      // 🚩 The race: a read that arrives carrying an OLDER version than what is on
      // screen. `core/`s guard must discard it, or the request goes backwards.
      if (scenario.staleRead) {
        const stale = projection()
        return route.fulfill(
          envelope({ ...stale, version: 1, etag: 'E1', lines: [], submitBlockers: [] }),
        )
      }
      // The engine has finished pricing whatever landed since the last read.
      priceLines()
      save()
      return route.fulfill(envelope(projection()))
    }
    if (path === 'Nphies/Session/AddItem') {
      const sent = body()
      calls.addItem.push(sent)
      if (!CATALOGUE[sent.itemNumber])
        return route.fulfill(refusal(404, 'ITEM_NOT_FOUND', 'No item with that number exists.'))
      // §2.3 — the door's own duplicate refusal, over LIVE lines only.
      if (tx.lines.some((l) => !l.voided && l.itemNumber === sent.itemNumber))
        return route.fulfill(
          refusal(
            409,
            'ITEM_ALREADY_ON_REQUEST',
            'That item is already on this request. Change its quantity instead.',
          ),
        )
      landLine(sent.itemNumber, sent.qty)
      save()
      return route.fulfill(envelope(projection()))
    }
    // §6: the transaction was submitted, abandoned or swept. The refusal carries
    // its `reason` in the envelope's own `data`, which is where `readSessionFault`
    // looks for it.
    if (scenario.sessionClosed && path.startsWith('Nphies/Session/')) {
      return route.fulfill(
        envelope(
          { reason: 'swept' },
          {
            status: 409,
            success: false,
            message: 'This request was swept by the service after being left open.',
            errors: [{ errorCode: 'SESSION_CLOSED', errorMessage: 'swept' }],
          },
        ),
      )
    }
    if (path === 'Nphies/Session/ChangeQty') {
      const sent = body()
      calls.changeQty.push(sent)
      const line = tx.lines.find((l) => l.lineId === sent.lineId)
      if (!line) return route.fulfill(refusal(404, 'LINE_NOT_FOUND', 'That line is gone.'))
      line.quantity = sent.newQty
      line.pricing = 'pending'
      save()
      return route.fulfill(envelope(projection()))
    }
    if (path === 'Nphies/Session/VoidLine') {
      const sent = body()
      calls.voidLine.push(sent)
      const line = tx.lines.find((l) => l.lineId === sent.lineId)
      if (!line) return route.fulfill(refusal(404, 'LINE_NOT_FOUND', 'That line is gone.'))
      // 🚩 KEPT, not removed. The whole reason the form drives a transaction.
      line.voided = true
      save()
      return route.fulfill(envelope(projection()))
    }
    if (path === 'Nphies/Session/Abandon') {
      calls.abandon.push(body())
      if (tx) tx.status = 'abandoned'
      return route.fulfill(
        envelope({ outcome: 'abandoned', transactionId: tx ? tx.transactionId : '' }),
      )
    }

    if (path === 'Nphies/AuthResponses')
      return route.fulfill(envelope({ rows: [], total: 0, page: 1, pageSize: 50 }))
    if (path === 'Nphies/Providers') return route.fulfill(envelope({ contractVersion: '1.0', items: [] }))
    // Any other probe → benign empty success so no other leaf crashes.
    return route.fulfill(envelope({}))
  })

  const main = () => page.locator('main')
  const text = () => main().innerText()
  const addForm = () => page.locator('main form').first()
  const itemBox = () => addForm().locator('input').first()
  const addQtyBox = () => addForm().locator('input[type="number"]').first()
  const rows = () => page.locator('main table tbody tr')

  // ---- Scenario 1: the seam — an agent reaches the form FROM an eligibility --
  await page.goto(`${BASE}/nphies/eligibility/${ELIGIBILITY_ID}`)
  await page.getByRole('link', { name: /Raise authorization/ }).waitFor({ timeout: 20000 })
  await page.getByRole('link', { name: /Raise authorization/ }).click()
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  check(
    'an agent reaches the form FROM an eligibility, and the URL carries both ids',
    page.url().includes('from=' + ELIGIBILITY_ID) && page.url().includes('coverage=' + MEMBER_ID),
    page.url().replace(BASE, ''),
  )

  // ---- Scenario 2: the form OPENS a real transaction ------------------------
  await page.waitForTimeout(400)
  check('the form opens a transaction — exactly one Open', calls.open.length === 1, JSON.stringify(calls.open))
  const openBody = calls.open[0] || {}
  check(
    'Open carries the eligibility id and the chosen member id — 213s seam, verbatim',
    openBody.eligibilityId === ELIGIBILITY_ID && openBody.memberId === MEMBER_ID,
    JSON.stringify(openBody),
  )
  check(
    'and a requestId, so a retried open is absorbed rather than doubled (law 3)',
    typeof openBody.requestId === 'string' && openBody.requestId.length === 26,
    String(openBody.requestId),
  )
  check(
    '🚩 the browser sends NO plant, store, provider or channel — the server stamps identity (law 7 / law 8)',
    !('plant' in openBody) &&
      !('storeCode' in openBody) &&
      !('providerCode' in openBody) &&
      !('distributionChannel' in openBody) &&
      !('staffId' in openBody) &&
      !('shift' in openBody),
    JSON.stringify(openBody),
  )

  // ---- Scenario 3: identity is read-only VALUES, not disabled controls ------
  const opened = await text()
  check(
    'the patient, payer, policy and provider come across filled',
    /Ahmad Ali/.test(opened) &&
      /PAY-9/.test(opened) &&
      /P001/.test(opened) &&
      new RegExp(MEMBER_ID).test(opened) &&
      /POL-77/.test(opened),
  )
  const controls = await page.locator('main input, main select, main textarea').count()
  check(
    '🚩 identity renders as VALUES, not disabled controls — the only inputs on the page are the add-row s two',
    controls === 2,
    `${controls} controls`,
  )
  check(
    '🚩 the provider is INHERITED, not re-pickable — there is no provider control at all',
    (await page.locator('main select').count()) === 0,
  )
  check(
    'the acting store is stated as the pricing plant, bound for the life of the request',
    /Priced at store 1101/.test(opened),
    (opened.match(/Priced at store[^\n]*/) || [''])[0],
  )
  check('🚩 no modal opens anywhere in this flow', (await page.locator('dialog').count()) === 0)

  // ---- Scenario 4: add an item — it prices IN PLACE -------------------------
  await itemBox().fill('100001')
  await addQtyBox().fill('2')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await rows().first().waitFor({ timeout: 15000 })
  check('adding an item appends a line', (await rows().count()) === 1)
  check(
    '🚩 ONE press is ONE add — a doubled submit would race a duplicate onto the wire',
    calls.addItem.length === 1,
    `${calls.addItem.length} calls`,
  )
  const addBody = calls.addItem[0] || {}
  check(
    '🚩 the add sends an item number and a quantity and NEVER a price (law 1)',
    addBody.itemNumber === '100001' &&
      addBody.qty === 2 &&
      !('unitPrice' in addBody) &&
      !('price' in addBody) &&
      !('amount' in addBody) &&
      !('extendedPrice' in addBody),
    JSON.stringify(addBody),
  )
  check(
    'and carries the transaction and its own request id',
    addBody.transactionId === '01JC8ABCDEFGHJKMNPQRSTVWXY' &&
      typeof addBody.requestId === 'string' &&
      addBody.requestId !== openBody.requestId,
  )
  check(
    '🚩 the line PRICES IN PLACE and says so while it waits (story 27)',
    /Pricing…/.test(await rows().first().innerText()),
    (await rows().first().innerText()).replace(/\n/g, ' | '),
  )
  // The engine finishes; the agent asks for the request as it now stands.
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(400)
  const priced = await rows().first().innerText()
  check(
    'and the money that arrives is the ENGINEs, rendered as sent',
    /25\.00/.test(priced) && /50\.00/.test(priced) && /7\.50/.test(priced) && /10\.00/.test(priced),
    priced.replace(/\n/g, ' | '),
  )
  check('the add-row clears itself on its own success', (await itemBox().inputValue()) === '')

  // ---- Scenario 5: 🚩 the duplicate, refused AT THE MOMENT OF ADDING --------
  const addsBefore = calls.addItem.length
  await itemBox().fill('100001')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(300)
  const refused = await text()
  check(
    '🚩 a second add of an item already on the request is REFUSED',
    /already on this request/.test(refused),
    (refused.match(/Item 100001[^\n]*/) || [''])[0],
  )
  check(
    '🚩 and the refusal NAMES THE QUANTITY CONTROL as the remedy (§2.3)',
    /quantity/i.test((refused.match(/Item 100001[^\n]*/) || [''])[0]),
  )
  check(
    'and points at the line that already holds it',
    /line 1/.test((refused.match(/Item 100001[^\n]*/) || [''])[0]),
  )
  check(
    '🚩 it costs no round trip — the refusal is stated before the door is asked',
    calls.addItem.length === addsBefore,
    `${calls.addItem.length - addsBefore} calls`,
  )
  check(
    '🚩 the refusal moves the caret to the control it names',
    await addQtyBox().evaluate((el) => el === document.activeElement),
  )
  check(
    'and the row keeps what was typed, so the number need not be read off the prescription again',
    (await itemBox().inputValue()) === '100001',
  )
  check('no line was added by the refused add', (await rows().count()) === 1)

  // ---- Scenario 6: the DOOR's own refusal reads the same way ----------------
  // A screen that has fallen behind sends an add the door refuses. The client's forward
  // check is not a second opinion: the same sentence, the same named remedy.
  tx.lines.push({
    ...tx.lines[0],
    lineId: 'L99',
    sequence: 99,
    itemNumber: '100002',
    itemDescription: CATALOGUE['100002'].description,
  })
  await itemBox().fill('100002')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(400)
  const serverRefused = await text()
  check(
    '🚩 the DOORs `ITEM_ALREADY_ON_REQUEST` renders as the same refusal, with the same remedy',
    /already on this request/.test(serverRefused) &&
      /quantity/i.test((serverRefused.match(/Item 100002[^\n]*/) || [''])[0]),
    (serverRefused.match(/Item 100002[^\n]*/) || [''])[0],
  )
  check(
    'and it carries the servers own sentence beside it, passed through as data (§6 kind 2)',
    /Change its quantity instead/.test(serverRefused),
  )
  // Put the request back as the agent sees it.
  tx.lines = tx.lines.filter((l) => l.lineId !== 'L99')
  save()
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(300)

  // ---- Scenario 7: an unknown item is a refusal the row states -------------
  await itemBox().fill('NOPE')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(400)
  check(
    'an unknown item number is a business outcome in words, not a crash',
    /No item with that number exists/.test(await text()),
  )

  // ---- Scenario 8: change a quantity --------------------------------------
  await itemBox().fill('100002')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await page.waitForTimeout(400)
  check('a second, different item is an ordinary add', (await rows().count()) === 2)

  const qtyCell = page.locator('main table tbody tr').first().locator('input[type="number"]')
  await qtyCell.fill('5')
  await qtyCell.press('Enter')
  await page.waitForTimeout(400)
  const qtyBody = calls.changeQty[0] || {}
  check(
    'changing a quantity sends a NEW quantity, never a delta',
    qtyBody.newQty === 5 && qtyBody.lineId === 'L1' && !('delta' in qtyBody),
    JSON.stringify(qtyBody),
  )
  check('and the grid shows what the engine came back with', (await qtyCell.inputValue()) === '5')
  check(
    'a quantity that did not change sends nothing at all',
    await (async () => {
      const before = calls.changeQty.length
      await qtyCell.fill('5')
      await qtyCell.press('Enter')
      await page.waitForTimeout(250)
      return calls.changeQty.length === before
    })(),
  )

  // ---- Scenario 9: 🚩 a voided line is KEPT, not removed -------------------
  const rowsBefore = await rows().count()
  await page.locator('main table tbody tr').nth(1).getByRole('button', { name: /^Void$/ }).click()
  await page.waitForTimeout(400)
  check('voiding sends the line id and nothing else the engine owns', calls.voidLine.length === 1)
  check(
    '🚩 THE VOIDED LINE IS STILL THERE — the audit trail is the whole point (law 2)',
    (await rows().count()) === rowsBefore,
    `${await rows().count()} rows`,
  )
  const voidedRow = await page.locator('main table tbody tr').nth(1).innerText()
  check('and it says what it is', /Voided/.test(voidedRow), voidedRow.replace(/\n/g, ' | '))
  check(
    'a voided line offers no further acts — there is no un-void verb',
    (await page.locator('main table tbody tr').nth(1).getByRole('button', { name: /^Void$/ }).count()) === 0,
  )
  check(
    'the heading counts what the payer is being asked for, not what is on the screen',
    /1 item on the request/.test(await text()),
    (await text()).match(/\d+ items? on the request/)?.[0] || '',
  )
  check(
    '🚩 and the voided line does not block its own item — it can be added again',
    await (async () => {
      await itemBox().fill('100002')
      await addQtyBox().fill('1')
      await page.getByRole('button', { name: /^Add$/ }).click()
      await page.waitForTimeout(400)
      return (await rows().count()) === rowsBefore + 1 && !/already on this request/.test(await text())
    })(),
  )

  // ---- Scenario 10: 🚩 a stale state never replaces a newer one ------------
  scenario.staleRead = true
  const linesBefore = await rows().count()
  await page.getByRole('button', { name: /^Refresh$/ }).click()
  await page.waitForTimeout(400)
  check(
    '🚩 a state arriving with an OLDER version is DISCARDED — the request never goes backwards',
    (await rows().count()) === linesBefore,
    `${await rows().count()} rows, was ${linesBefore}`,
  )
  scenario.staleRead = false

  // ---- Scenario 10b: 🚩 the transaction is no longer this tab's to write to --
  // §6's `SESSION_CLOSED`. `core/`s session-fault reader is what makes the answer
  // the same for every verb — ticket 210 moved it precisely because this contract
  // names the same two codes with the same three reasons.
  scenario.sessionClosed = true
  await page.locator('main table tbody tr').first().locator('input[type="number"]').fill('9')
  await page.locator('main table tbody tr').first().locator('input[type="number"]').press('Enter')
  await page.waitForTimeout(500)
  const closed = await text()
  check(
    '🚩 a closed transaction stops the form and says so in the servers own words',
    /no longer open/.test(closed) && /swept by the service/.test(closed),
    (closed.match(/This request is no longer open[^\n]*/) || [''])[0],
  )
  check(
    '🚩 and nothing is left pointing at it — no add-row over a request that is gone',
    (await addForm().count()) === 0 && (await rows().count()) === 0,
  )
  check(
    'the way back is the list, not a retry there is nothing to retry against',
    (await page.getByRole('link', { name: /Back to authorizations/ }).count()) >= 1,
  )
  scenario.sessionClosed = false

  // Back to a live request for the leave scenarios.
  await page.goto(FORM_URL)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  await itemBox().fill('100001')
  await addQtyBox().fill('1')
  await page.getByRole('button', { name: /^Add$/ }).click()
  await rows().first().waitFor({ timeout: 15000 })
  const linesAfterReopen = await rows().count()

  // ---- Scenario 11: leaving warns, and the warning is honest ---------------
  const abandonsBefore = calls.abandon.length
  await page.getByRole('link', { name: /Back to authorizations/ }).click()
  await page.waitForTimeout(300)
  // Scoped to the banner itself, not to the page: the page's own subtitle also says
  // that leaving discards the request, and an assertion that matched it would pass
  // with the warning deleted.
  const warnBanner = page.getByRole('alert').filter({ hasText: 'Leave and discard' })
  const warned = (await warnBanner.count()) ? await warnBanner.first().innerText() : ''
  check(
    '🚩 leaving a part-built request WARNS first (story 64)',
    /Leaving discards this request/.test(warned),
    warned.replace(/\n/g, ' | '),
  )
  check(
    'and it says what is actually true — discarded, not merely unsaved',
    /no draft to come back to/.test(warned),
  )
  check('🚩 the warning is INLINE — still no modal in this flow', (await page.locator('dialog').count()) === 0)
  check('nothing was abandoned while the agent decides', calls.abandon.length === abandonsBefore)
  check(
    'and the request is still on screen behind the warning',
    (await rows().count()) === linesAfterReopen,
  )

  await page.getByRole('button', { name: /Stay on the request/ }).click()
  await page.waitForTimeout(300)
  check(
    'Stay keeps the agent on the request, with everything on it',
    page.url().includes('/nphies/authorizations/new') &&
      (await rows().count()) === linesAfterReopen,
  )

  await page.getByRole('link', { name: /Back to authorizations/ }).click()
  await page.waitForTimeout(200)
  await page.getByRole('button', { name: /Leave and discard/ }).click()
  // Wait for the landing rather than for a clock: the abandon is a round trip, and a
  // fixed timeout would make this assertion a race rather than a check.
  await page.waitForURL(/\/nphies\/authorizations$/, { timeout: 15000 }).catch(() => {})
  check(
    '🚩 leaving ABANDONS the transaction — nothing lingers half-built (story 65)',
    calls.abandon.length === abandonsBefore + 1,
    JSON.stringify(calls.abandon[calls.abandon.length - 1] || {}),
  )
  const abandonBody = calls.abandon[calls.abandon.length - 1] || {}
  check(
    'the abandon carries the transaction and its OWN request id',
    abandonBody.transactionId === '01JC8ABCDEFGHJKMNPQRSTVWXY' &&
      typeof abandonBody.requestId === 'string' &&
      abandonBody.requestId !== openBody.requestId,
  )
  check(
    'and the agent lands somewhere — an abandon with no follow-on leaves them holding nothing',
    /\/nphies\/authorizations$/.test(page.url()),
    page.url().replace(BASE, ''),
  )

  // ---- Scenario 12: an EMPTY session leaves silently, and still abandons ---
  const abandons2 = calls.abandon.length
  await page.goto(FORM_URL)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  await page.getByRole('link', { name: /Back to authorizations/ }).click()
  await page.waitForURL(/\/nphies\/authorizations$/, { timeout: 15000 }).catch(() => {})
  check(
    'an EMPTY request leaves with no warning — the warning is kept for what it is worth',
    /\/nphies\/authorizations$/.test(page.url()),
    page.url().replace(BASE, ''),
  )
  check(
    '🚩 and it is STILL abandoned — an OPEN transaction is never left for the sweeper',
    calls.abandon.length === abandons2 + 1,
  )

  // ---- Scenario 13: no polling anywhere -----------------------------------
  await page.goto(FORM_URL)
  await page.getByRole('heading', { name: /New authorization/ }).waitFor({ timeout: 20000 })
  await page.waitForTimeout(400)
  const readsBefore = calls.state
  const opensBefore = calls.open.length
  await page.waitForTimeout(3500)
  check(
    '🚩 nothing polls — the state is read when the agent asks and never on a timer',
    calls.state === readsBefore && calls.open.length === opensBefore,
    `${calls.state - readsBefore} reads, ${calls.open.length - opensBefore} opens`,
  )

  // ---- Scenario 14: a half-addressed URL cannot open a transaction ---------
  const opens14 = calls.open.length
  await page.goto(`${BASE}/nphies/authorizations/new?from=${ELIGIBILITY_ID}`)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    'a URL with no coverage says which half is missing, in the agents words',
    /No policy was chosen/.test(await text()),
  )
  check(
    '🚩 and NO transaction is opened — an engine document is not raised to report a bad link',
    calls.open.length === opens14,
  )

  // ---- Scenario 15: no acting store, no session ---------------------------
  scenario.actingStore = ''
  const opens15 = calls.open.length
  await page.goto(FORM_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    '🚩 the session will not open until the PLANT is resolved — it is bound at Open and never moves',
    /acting store is not resolved/.test(await text()) && calls.open.length === opens15,
    (await text()).match(/Your acting store[^\n]*/)?.[0] || '',
  )
  scenario.actingStore = '1101'

  // ---- Scenario 16: a contract major this client cannot speak -------------
  scenario.contractVersion = '9.0'
  await page.goto(FORM_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  const stopped = await text()
  check(
    '🚩 a MAJOR contract mismatch is a hard stop, before any state is rendered (law 10)',
    /out of date/.test(stopped) && (await rows().count()) === 0,
  )
  check(
    'and it states both versions, because "update the portal" has to be actionable',
    /9\.0/.test(stopped) && /1\.1/.test(stopped),
    (stopped.match(/The server answered[^\n]*/) || [''])[0],
  )
  scenario.contractVersion = '1.0'

  // ---- Scenario 17: the area's one grant, failing closed ------------------
  scenario.access = { canOpenNphies: false }
  const opens17 = calls.open.length
  await page.goto(FORM_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    'no grant → the form is shut, and no transaction is opened',
    /No access to Nphies/.test(await text()) && calls.open.length === opens17,
  )
  scenario.access = { canOpenNphies: true }

  scenario.accessDown = true
  await page.goto(FORM_URL)
  await page.waitForSelector('[role="alert"]', { timeout: 15000 })
  check(
    '🚩 an ERRORED probe fails closed — the form stays shut and says UNAVAILABLE, not "you lack the grant"',
    /Nphies is unavailable/.test(await text()) && !/does not hold the Nphies grant/.test(await text()),
  )
  scenario.accessDown = false

  check('no uncaught page errors anywhere in the drive', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
  if (failed.length) {
    console.log('FAILED:\n' + failed.map((f) => '  - ' + f.name).join('\n'))
    process.exit(1)
  }
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
