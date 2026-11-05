// Insurance section drive (ticket 787, BackOffice spec 3389, door 3390).
//
// Drives the REAL app in Chromium against a STUB of 3390's `GET SdDocumentWeb/Document/{no}/Insurance`
// (not built yet: the stub answers the 1006358459 shape from
// `src/features/oms/document/__fixtures__/insurance-1006358459.json` — current 63.65 / 2.66, engine
// 13.26 / 53.05). The order's header is the ticket-078 ERX capture 2000000551, renumbered. In LTR and
// RTL (`oms.locale = 'ar'` sets dir="rtl"), it asserts:
//   1. `/oms/document/1006358459#insurance` draws the section above the two columns and scrolls to it;
//   2. Money: the CHANNEL badge and its line; Received / Current / Engine per figure; patient
//      63.65 · 63.65 · 13.26 with the ⚠ on the engine cell and the gap note; money in ltr isolates;
//   3. Lines: sent SFDA → dispensed item; engine deductible 13.26 ⚠ beside applied 63.65;
//      "How it was priced" lists the steps in step order (PR00, ZDED, MWST);
//      the header conditions read DFEE's rate 15.00 as its money, never 0.00;
//   4. unpriced engine money reads Unpriced (never 0.00) with the unpriced lines named; a voided line
//      is struck through;
//   5. no section on a non-insurance order (400 NOT_INSURANCE_ORDER), without the grant (and no read
//      asked), or on the delivery route (no read asked); a failing read is said in place;
//   6. nothing in the section is a control: read-only.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/insurance-section-drive.mjs   (DRIVE_PORT=<port> for another port)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.insurance-section-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', code } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: code ? [{ errorCode: code, errorMessage: message }] : [], data }),
})

const orderDoc = JSON.parse(readFileSync('.issues/assets/078-document-payloads/2000000551-erx.json', 'utf8')).data
const deliveryDoc = JSON.parse(readFileSync('.issues/assets/078-document-payloads/8000000253-delivery.json', 'utf8')).data
const READ = JSON.parse(readFileSync('src/features/oms/document/__fixtures__/insurance-1006358459.json', 'utf8'))

/** 1006358460: its one line unresolved and a second voided line — the engine has no total. */
const unpricedRead = () => {
  const r = structuredClone(READ)
  r.documentNo = '1006358460'
  r.lines[0] = {
    ...r.lines[0],
    engineDeductible: null,
    unresolvedReason: 'SFDA code matches no item',
    engine: { priced: false, unpricedReason: 'No price for the item', deductible: null, deductibleVat: null, patient: null, insurer: null },
  }
  r.lines.push({ ...structuredClone(READ.lines[0]), lineNumber: 20, voided: true })
  r.money.engine = { priced: false, unpricedLines: [10], patient: null, deductible: null, deductibleVat: null, uncovered: null, insurer: null, amountDue: null }
  return r
}

const GRANTED = { canOpenList: true, canOpenDetail: true, canViewInsurance: true }

const browser = await chromium.launch()

async function drive(dir) {
  const rtl = dir === 'rtl'
  const label = dir
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (400|404|500)|net::ERR_FAILED/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  let access = GRANTED
  const reads = []
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope(access))
    const ins = p.match(/^SdDocumentWeb\/Document\/(\d+)\/Insurance$/)
    if (ins) {
      reads.push(ins[1])
      if (ins[1] === '1006358459') return route.fulfill(envelope(READ))
      if (ins[1] === '1006358460') return route.fulfill(envelope(unpricedRead()))
      if (ins[1] === '1006358499') return route.fulfill(envelope(null, { status: 500, success: false, message: 'Pricer unavailable' }))
      const message = `Document ${ins[1]} is not an insurance order.`
      return route.fulfill(envelope(null, { status: 400, success: false, message, code: 'NOT_INSURANCE_ORDER' }))
    }
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    if (/\/PrescriptionSessions$/.test(p)) return route.fulfill(envelope({ sessions: [] }))
    const doc = p.match(/^SdDocumentWeb\/(Document|Delivery)\/(\d+)$/)
    if (doc) {
      if (doc[1] === 'Delivery') return route.fulfill(envelope({ ...deliveryDoc, documentNo: doc[2] }))
      return route.fulfill(envelope({ ...orderDoc, documentNo: doc[2], documentCategory: 'O' }))
    }
    return route.fulfill(envelope({}))
  })

  const open = async (path) => {
    await page.goto(`${BASE}${path}`)
    await page.locator('[data-spine]').waitFor({ timeout: 20000 })
    await page.waitForTimeout(600)
  }
  const section = () => page.locator('[data-insurance-section]')

  // ── 1–3: the 1006358459 shape ────────────────────────────────────────────────────────────────
  await open('/oms/document/1006358459#insurance')
  check(`${label}: the page runs ${rtl ? 'right-to-left' : 'left-to-right'}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  await section().waitFor({ timeout: 10000 })
  const top = await section().evaluate((s) => ({
    top: s.getBoundingClientRect().top,
    beforeColumns: !!(s.compareDocumentPosition(document.querySelector('[data-spine]')) & Node.DOCUMENT_POSITION_FOLLOWING),
    id: s.id,
  }))
  check(`${label}: #insurance scrolls to the section, drawn above the two columns`, top.id === 'insurance' && top.top < 120 && top.beforeColumns, JSON.stringify(top))

  const money = await section().evaluate((s) => {
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
    const row = (f) => {
      const tr = s.querySelector(`[data-money-row="${f}"]`)
      const col = (c) => tr.querySelector(`[data-money-col="${c}"]`)
      return {
        channel: text(col('channel')),
        current: text(col('current')),
        engine: text(col('engine')),
        engineGap: !!col('engine').querySelector('[data-money-gap]'),
        ltr: !!col('current').querySelector('bdi[dir="ltr"]'),
      }
    }
    return {
      source: s.querySelector('[data-money-source]')?.getAttribute('data-money-source'),
      sourceText: text(s.querySelector('[data-money-source]')),
      meaning: text(s.querySelector('[data-money-meaning]')),
      headers: [...s.querySelectorAll('[data-money-table] thead th')].map(text),
      patient: row('patient'),
      insurer: row('insurer'),
      vat: row('deductibleVat'),
      gapNote: !!s.querySelector('[data-money-gap-note]'),
      controls: s.querySelectorAll('button, input, select, textarea').length,
    }
  })
  check(`${label} money: the CHANNEL badge and its one line`, money.source === 'CHANNEL' && money.sourceText === 'Channel' && money.meaning === 'The patient pays what the insurer sent.', `${money.sourceText} | ${money.meaning}`)
  check(`${label} money: Received · Current · Engine side by side`, JSON.stringify(money.headers) === JSON.stringify(['Figure', 'Received', 'Current', 'Engine']), money.headers.join(','))
  check(
    `${label} money: patient 63.65 · 63.65 · 13.26 with the gap flagged, in ltr isolates`,
    money.patient.channel === '63.65' && money.patient.current === '63.65' && money.patient.engine === '13.26' && money.patient.engineGap && money.patient.ltr && money.gapNote,
    JSON.stringify(money.patient),
  )
  check(`${label} money: insurer 2.66 against engine 53.05 flagged; VAT 0.00 = 0.00 not`, money.insurer.engine === '53.05' && money.insurer.engineGap && !money.vat.engineGap, JSON.stringify([money.insurer, money.vat]))
  check(`${label}: the section is read-only, no control in it`, money.controls === 0, String(money.controls))

  const lines = await section().evaluate((s) => {
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
    const l = s.querySelector('[data-insurance-line="10"]')
    return {
      sent: text(l.querySelector('[data-line-col="sent"]')),
      dispensed: text(l.querySelector('[data-line-col="dispensed"]')),
      engineDed: text(l.querySelector('[data-line-engine-deductible]')),
      engineDedGap: !!l.querySelector('[data-line-engine-deductible] [data-money-gap]'),
      deductible: text(l.querySelector('[data-line-col="deductible"]')),
      sfdaLtr: !!l.querySelector('[data-line-col="sent"] bdi[dir="ltr"]'),
    }
  })
  check(`${label} lines: sent SFDA · text → dispensed item`, /0507230119/.test(lines.sent) && /Augmentin 1g tablets/.test(lines.sent) && /100245/.test(lines.dispensed) && lines.sfdaLtr, `${lines.sent} → ${lines.dispensed}`)
  check(`${label} lines: engine deductible 13.26 ⚠ beside applied 63.65`, lines.engineDed === '13.26' && lines.engineDedGap && /Applied\s*63\.65/.test(lines.deductible), lines.deductible)

  await section().locator('[data-line-priced="10"] summary').click()
  const steps = await section().locator('[data-line-priced="10"] [data-priced-step]').evaluateAll((trs) => trs.map((tr) => tr.getAttribute('data-priced-step')))
  check(`${label} lines: How it was priced lists the steps in step order`, JSON.stringify(steps) === JSON.stringify(['PR00', 'ZDED', 'MWST']), steps.join(','))
  await section().locator('[data-header-conditions] summary').click()
  const fee = await section().locator('[data-header-conditions] [data-priced-step="DFEE"] [data-priced-value]').textContent()
  check(`${label} header conditions: DFEE reads its rate 15.00 as its money`, fee.trim() === '15.00', fee)
  await page.screenshot({ path: `${SHOTS}/${dir}-1006358459.png`, fullPage: true })

  // ── 4: unpriced, voided ─────────────────────────────────────────────────────────────────────
  await open('/oms/document/1006358460')
  await section().waitFor({ timeout: 10000 })
  const unp = await section().evaluate((s) => {
    const text = (el) => (el ? el.textContent.replace(/\s+/g, ' ').trim() : null)
    return {
      engine: [...s.querySelectorAll('[data-money-col="engine"]')].map(text),
      named: text(s.querySelector('[data-money-unpriced-lines]')),
      gapNote: !!s.querySelector('[data-money-gap-note]'),
      lineEngine: text(s.querySelector('[data-insurance-line="10"] [data-line-engine-deductible]')),
      voidedStrike: getComputedStyle(s.querySelector('[data-insurance-line="20"] tr')).textDecorationLine,
    }
  })
  check(`${label} unpriced: every engine figure reads Unpriced, no gap flagged`, unp.engine.every((e) => e === 'Unpriced') && !unp.gapNote, unp.engine.join(','))
  check(`${label} unpriced: the unpriced lines are named; the line's engine deductible reads Unpriced`, /10$/.test(unp.named ?? '') && unp.lineEngine === 'Unpriced', `${unp.named} | ${unp.lineEngine}`)
  check(`${label} voided: the voided line is struck through, not hidden`, unp.voidedStrike.includes('line-through'), unp.voidedStrike)

  // ── 5: absent ───────────────────────────────────────────────────────────────────────────────
  await open('/oms/document/2000000551')
  check(`${label}: no section on a non-insurance order (refused by name)`, (await section().count()) === 0 && reads.includes('2000000551'))
  await open('/oms/document/1006358499')
  const failed = await section().locator('[role="alert"], [data-error-banner]').count()
  check(`${label}: a failing read is said in place`, (await section().count()) === 1 && (failed > 0 || /Pricer unavailable/.test(await section().textContent())))
  reads.length = 0
  await open('/oms/delivery/8000000253')
  check(`${label}: no section and no read on the delivery route`, (await section().count()) === 0 && reads.length === 0, reads.join(','))
  access = { canOpenList: true, canOpenDetail: true }
  await context.clearCookies()
  const page2 = page
  await page2.reload()
  await open('/oms/document/1006358459')
  check(`${label}: without the grant, no section and no read`, (await section().count()) === 0 && reads.length === 0, reads.join(','))

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
