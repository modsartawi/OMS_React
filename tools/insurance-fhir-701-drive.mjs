// A monitor's communication and payment scopes (BackOffice spec 3271, A11; doors 3299 / 3300; oms ticket 701).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/fhir-rules-stubs-701.mjs`): never a live SIS.Api.
// In LTR and RTL: the scope picker; each scope's catalog holds only its own facts and no $previous; the editor says what
// reads unknown; one monitor is written, saved and reopened on each scope; no payload text is offered.
//
//   1. npx vite --port 5211 --strictPort
//   2. DRIVE_PORT=5211 node tools/insurance-fhir-701-drive.mjs
import { createRequire } from 'node:module'
import { envelope, guardEditorStub, insuranceRulesStub, newGuardStore } from './insurance-rules-stubs.mjs'
import { monitorScopesStub } from './fhir-rules-stubs-701.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5211}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const browser = await chromium.launch()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const UNDERPAID = 'paymentReconciliation.detail.payment < paymentReconciliation.detail.amount'

for (const dir of ['ltr', 'rtl']) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newGuardStore()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await context.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    const body = req.method() === 'GET' ? null : req.postDataJSON()
    const hit = monitorScopesStub(req.method(), p, store) ?? guardEditorStub(req.method(), p, body, { store, reads: {} }) ?? insuranceRulesStub(req.method(), p, body, {})
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })

  const pickScope = (s) => page.locator(`[data-monitor-scope-pick="${s}"]`).click()
  const addBlock = (check) => page.locator('select[data-add-condition=""]').selectOption(check)
  const catalogRows = () => page.locator('[data-catalog-row]').evaluateAll((e) => e.map((x) => x.getAttribute('data-catalog-row')))
  const closeCatalog = () => page.keyboard.press('Escape')
  const fillText = async (en, ar) => {
    await page.locator('[data-input="name.en"]').fill(en)
    await page.locator('[data-input="name.ar"]').fill(ar)
    await page.locator('[data-input="says.en"]').fill(en)
    await page.locator('[data-input="says.ar"]').fill(ar)
  }
  const savedRule = (id) => (store.puts?.at?.(-1) ?? store.draft).rules?.find((r) => r.id === id)

  // ── the picker ────────────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/new?kind=monitor`)
  await page.locator('[data-editor-header]').waitFor({ timeout: 60000 })
  const scopes = await page.locator('[data-monitor-scope-pick]').evaluateAll((e) => e.map((x) => x.getAttribute('data-monitor-scope-pick')))
  check(`${dir} the picker offers the three scopes`, same(scopes, ['claimResponse', 'communicationRequest', 'paymentReconciliation']), scopes.join())
  check(`${dir} a new monitor starts on the claim response, with its uses`, (await page.locator('[data-monitor-scope="claimResponse"]').count()) === 1 && (await page.locator('[data-monitor-use]').count()) === 2)

  // ── a change of scope says what it dropped ────────────────────────────────────────────────────
  await addBlock('fact')
  await pickScope('communicationRequest')
  check(`${dir} a change of scope drops the old message's fact, and says so`, (await page.locator('[data-block="0"]').count()) === 0 && (await page.locator('[data-monitor-scope-dropped]').count()) === 1)

  // ── communication request ─────────────────────────────────────────────────────────────────────
  check(`${dir} communication: no use to choose`, (await page.locator('[data-monitor-use]').count()) === 0)
  check(`${dir} communication: the note says the text is never read`, (await page.locator('[data-monitor-scope-note="communicationRequest"]').count()) === 1)
  const commPalette = await page.locator('select[data-add-condition=""] option').evaluateAll((e) => e.map((x) => x.value).filter(Boolean))
  check(`${dir} communication: the palette has no history`, same(commPalette, ['fact', 'formula', 'group']), commPalette.join())
  await addBlock('fact')
  const commFact = page.locator('[data-block="0"]')
  check(`${dir} communication: a fact starts on the reason`, (await commFact.locator('[data-fact-key="$communicationRequest.reason"]').count()) === 1)
  await commFact.locator('[data-catalog-open]').click()
  await page.locator('[data-catalog]').waitFor()
  const commRows = await catalogRows()
  check(`${dir} communication: the catalog offers only its own three facts`, same(commRows, ['$communicationRequest.reason', '$communicationRequest.category', '$communicationRequest.payloadTextPresent']), commRows.join())
  check(`${dir} communication: no $previous group`, (await page.locator('[data-catalog-message="previous"]').count()) === 0)
  check(`${dir} communication: the payload is a yes or no`, (await page.locator('[data-catalog-row="$communicationRequest.payloadTextPresent"] [data-catalog-type="flag"]').count()) === 1)
  await page.locator('[data-catalog-row="$communicationRequest.payloadTextPresent"] [data-catalog-pick]').click()
  check(`${dir} communication: the flag can be picked`, (await commFact.locator('[data-fact-key="$communicationRequest.payloadTextPresent"]').count()) === 1)
  await fillText('Payer asked with text', 'طلبت الجهة بنص')
  await page.locator('[data-save]').click()
  await page.waitForURL('**/insurance-rules/guards/M-001/edit', { timeout: 30000 })
  const comm = savedRule('M-001')
  check(`${dir} communication: saved on its scope, with no use`, comm?.kind === 'monitor' && comm?.scope === 'communicationRequest' && !('uses' in comm), JSON.stringify(comm))
  check(`${dir} communication: the wire reads the flag`, same(comm?.when, [{ check: 'communicationRequest', field: 'payloadTextPresent', is: true }]), JSON.stringify(comm?.when))

  await page.goto(`${BASE}/insurance-rules/guards/M-001/edit`)
  await page.locator('[data-editor-header]').waitFor({ timeout: 60000 })
  check(`${dir} communication: reopens on its scope and fact`, (await page.locator('[data-monitor-scope="communicationRequest"]').count()) === 1 && (await page.locator('[data-block="0"] [data-fact-key="$communicationRequest.payloadTextPresent"]').count()) === 1)
  await page.goto(`${BASE}/insurance-rules/guards/M-001`)
  await page.locator('[data-rule-header]').waitFor({ timeout: 60000 })
  const commWhen = await page.locator('[data-block-when]').innerText()
  check(`${dir} communication: reads as a communication request, not an answer to a claim`, /communication request|طلب مراسلة/.test(commWhen) && !/pre-authorization|موافقة مسبقة/.test(commWhen), commWhen)
  check(`${dir} no raw key on the page`, !/\b(sentence|monitor|editor)\.[a-zA-Z]/.test(await page.locator('main').innerText()))

  // ── payment reconciliation ────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/new?kind=monitor`)
  await page.locator('[data-editor-header]').waitFor({ timeout: 60000 })
  await pickScope('paymentReconciliation')
  check(`${dir} payment: nothing dropped, nothing said`, (await page.locator('[data-monitor-scope-dropped]').count()) === 0)
  const unknown = await page.locator('[data-monitor-unknown]').innerText()
  check(`${dir} payment: the editor says facts read unknown on no match or an ambiguous one`, /no authorization|لا يطابق/.test(unknown) && /ambiguous|ملتبسة/.test(unknown), unknown)
  check(`${dir} payment: the note says it reads per detail`, (await page.locator('[data-monitor-scope-note="paymentReconciliation"]').count()) === 1)
  await addBlock('fact')
  const payFact = page.locator('[data-block="0"]')
  await payFact.locator('[data-catalog-open]').click()
  await page.locator('[data-catalog]').waitFor()
  const payRows = await catalogRows()
  check(
    `${dir} payment: the catalog offers only its own four facts`,
    same(payRows, ['$paymentReconciliation.detail.payment', '$paymentReconciliation.detail.earlyFee', '$paymentReconciliation.detail.nphiesFee', '$paymentReconciliation.detail.amount']),
    payRows.join(),
  )
  check(`${dir} payment: no $previous group`, (await page.locator('[data-catalog-message="previous"]').count()) === 0)
  await closeCatalog()
  await addBlock('formula')
  const formula = page.locator('[data-block="1"]')
  await formula.locator('[data-fx-toggle]').click()
  const fx = formula.locator('[data-fx-helper]')
  check(`${dir} payment: ƒx offers the detail, no $previous and no claim response`, (await fx.locator('[data-fx-item="paymentReconciliation.detail.amount"]').count()) === 1 && (await fx.locator('[data-fx-group="previous"]').count()) === 0 && (await fx.locator('[data-fx-group="claimResponse"]').count()) === 0)
  await fx.locator('[data-fx-tab="recipes"]').click()
  await fx.locator('[data-fx-use="underpaid"]').click()
  check(`${dir} payment: the recipe writes the comparison, and it reads`, (await formula.locator('[data-input="formula"]').inputValue()) === UNDERPAID && (await formula.locator('[data-fx-status="ok"]').count()) === 1)
  await fillText('Detail underpaid', 'بند دفع ناقص')
  await page.locator('[data-save]').click()
  await page.waitForURL('**/insurance-rules/guards/M-002/edit', { timeout: 30000 })
  const pay = savedRule('M-002')
  check(`${dir} payment: saved on its scope, with no use`, pay?.scope === 'paymentReconciliation' && !('uses' in pay), JSON.stringify(pay))
  check(
    `${dir} payment: the wire reads the fact and the compare`,
    pay?.when?.[0]?.check === 'paymentReconciliation' && pay?.when?.[0]?.field === 'detail.payment' && same(pay?.when?.[1]?.expr, ['<', '$paymentReconciliation.detail.payment', '$paymentReconciliation.detail.amount']),
    JSON.stringify(pay?.when),
  )
  check(`${dir} payment: only a review item`, same(pay?.then, [{ effect: 'reviewItem', severity: 'action', says: { en: 'Detail underpaid', ar: 'بند دفع ناقص' } }]), JSON.stringify(pay?.then))

  await page.goto(`${BASE}/insurance-rules/guards/M-002/edit`)
  await page.locator('[data-editor-header]').waitFor({ timeout: 60000 })
  check(`${dir} payment: reopens on its scope and formula`, (await page.locator('[data-monitor-scope="paymentReconciliation"]').count()) === 1 && (await page.locator('[data-block="1"] [data-input="formula"]').inputValue()) === UNDERPAID)
  await page.goto(`${BASE}/insurance-rules/guards/M-002`)
  await page.locator('[data-rule-header]').waitFor({ timeout: 60000 })
  check(`${dir} payment: reads as a detail`, /payment reconciliation|تسوية دفع/.test(await page.locator('[data-block-when]').innerText()))

  // ── a guard is offered neither ────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/new`)
  await page.locator('[data-editor-header]').waitFor({ timeout: 60000 })
  check(`${dir} a guard has no scope picker`, (await page.locator('[data-monitor-scope-pick]').count()) === 0)
  await addBlock('fact')
  await page.locator('[data-block="0"] [data-catalog-open]').click()
  await page.locator('[data-catalog]').waitFor()
  check(`${dir} a guard is offered neither scope`, (await page.locator('[data-catalog-message="communicationRequest"],[data-catalog-message="paymentReconciliation"]').count()) === 0)

  check(`${dir} no page error`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
