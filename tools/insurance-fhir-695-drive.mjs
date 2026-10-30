// Raw-FHIRPath mode drive (BackOffice spec 3271; oms ticket 695). STUBBED: every door here is on the real envelope,
// never a live SIS.Api; 711 swaps in the live doors. In LTR and RTL:
//   1. one path for each refusal blocks Propose, and says why;
//   2. the case-only warning shows and does not stop the proposal;
//   3. Probe shows match / no match / unknown per payer; zero matches warns and does not stop it;
//   4. a slow older Compile never overwrites a newer verdict; edits inside the window make one request;
//   5. a proposal is sent with the row as typed; a door's refusal keeps the form open and says the door's words;
//   6. a filled form asks before it is thrown away; the path field is LTR under either direction.
//
//   1. npx vite --port 5205 --strictPort
//   2. DRIVE_PORT=5205 node tools/insurance-fhir-695-drive.mjs
import { createRequire } from 'node:module'
import { FHIR_CATALOG, fhirCatalogStub } from './fhir-rules-stubs-692.mjs'
import { PATHS, rawPathStub } from './fhir-rules-stubs-695.mjs'
import { envelope, guardEditorStub, insuranceListsStub, insuranceRulesStub, newGuardStore, newListsState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5205}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const browser = await chromium.launch()

async function open(dir, stubState = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const state = { proposals: [], compiles: [], ...stubState }
  const store = newGuardStore()
  const registry = newListsState()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    if (p.endsWith('Fields/Compile') && body?.path?.includes('slow')) await sleep(1800)
    const hit =
      rawPathStub(req.method(), p, body, state) ??
      fhirCatalogStub(req.method(), p, {}) ??
      guardEditorStub(req.method(), p, body, { store, reads: {} }) ??
      insuranceListsStub(req.method(), p, body, { state: registry, query: new URL(req.url()).searchParams }) ??
      insuranceRulesStub(req.method(), p, body, { reads: {} })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/insurance-rules/fields`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-raw-path-open]').waitFor({ timeout: 30000 })
  await page.locator('[data-raw-path-open]').click()
  await page.locator('[data-raw-path-form]').waitFor({ timeout: 10000 })
  return { context, page, errors, state }
}

const verdictState = (page) => page.locator('[data-raw-verdict]').getAttribute('data-raw-verdict')
const typePath = async (page, path) => {
  await page.locator('[data-raw-path]').fill(path)
  await page.locator('[data-raw-verdict="clean"], [data-raw-verdict="refused"], [data-raw-verdict="failed"]').waitFor({ timeout: 10000 })
}
const fillRow = async (page, key) => {
  await page.locator('[data-raw-moment]').selectOption('claimResponse')
  await page.locator('[data-raw-level]').selectOption('line')
  await page.locator('[data-raw-type]').selectOption('money')
  await page.locator('[data-raw-key]').fill(key)
  await page.locator('[data-raw-label-en]').fill('Line deductible')
  await page.locator('[data-raw-label-ar]').fill('خصم البند')
}
const blockers = (page) => page.locator('[data-raw-blocker]').evaluateAll((els) => els.map((e) => e.getAttribute('data-raw-blocker')))
const probe = async (page) => {
  await page.locator('[data-raw-probe-run]').click()
  await page.locator('[data-raw-probe]').waitFor({ timeout: 10000 })
}

for (const dir of ['ltr', 'rtl']) {
  // ── 1 + 2 + 3 + 5: every verdict on one form ──────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir)
    await fillRow(page, 'lineDeductible')
    check(`${dir} 6. the page runs in its direction`, (await page.locator('html').getAttribute('dir')) === dir)
    check(`${dir} 6. the path field is LTR`, (await page.locator('[data-raw-path]').getAttribute('dir')) === 'ltr')
    check(`${dir} 7. no raw keys in the form`, !/insurance-(rules|fields):|\b(rawPath|catalog)\.[a-z]/.test((await page.locator('[data-raw-path-form]').innerText()) + (await page.locator('[data-raw-moment]').innerText())))

    for (const code of ['syntax', 'clockFunction', 'terminologyFunction', 'conformsTo', 'trace', 'typeMisfit', 'unlistedExtension']) {
      await typePath(page, PATHS[code])
      check(`${dir} 1. ${code} is refused`, (await verdictState(page)) === 'refused' && (await page.locator(`[data-raw-refusal="${code}"]`).count()) === 1)
      const blockedProbe = await page.locator('[data-raw-probe-run]').getAttribute('aria-disabled')
      await page.locator('[data-raw-propose]').click({ force: true })
      check(`${dir} 1. ${code} cannot be probed or proposed`, blockedProbe === 'true' && (await blockers(page)).includes('refused') && state.proposals.length === 0, JSON.stringify(await blockers(page)))
    }

    await typePath(page, PATHS.caseOnly)
    const warn = page.locator('[data-raw-warning="caseOnlyCode"]')
    check(`${dir} 2. the case-only code warns`, (await verdictState(page)) === 'clean' && (await warn.count()) === 1)
    check(`${dir} 2. it names both spellings`, /coPay/.test(await warn.innerText()) && /copay/.test(await warn.innerText()))
    await page.locator('[data-raw-propose]').click({ force: true })
    check(`${dir} 2. it does not stop the proposal, only the unrun Probe does`, JSON.stringify(await blockers(page)) === '["notProbed"]', JSON.stringify(await blockers(page)))

    await typePath(page, PATHS.zero)
    await probe(page)
    check(`${dir} 3. zero matches warns`, (await page.locator('[data-raw-probe-zero]').count()) === 1)
    await page.locator('[data-raw-propose]').click({ force: true })
    await page.waitForFunction(() => !document.querySelector('[data-raw-path-form]'), null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 3. and does not stop the proposal`, state.proposals.length === 1 && state.proposals[0].fhirPath === PATHS.zero, JSON.stringify(state.proposals))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 3 + 5: a good path, per payer, and the row sent ──────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir)
    await fillRow(page, 'lineDeductible')
    await typePath(page, PATHS.good)
    await probe(page)
    const row = page.locator('[data-probe-payer="BUPA"]')
    check(`${dir} 3. Probe says match, no match and unknown per payer`, (await row.locator('[data-probe-match]').innerText()) === '14' && (await row.locator('[data-probe-no-match]').innerText()) === '2' && (await row.locator('[data-probe-unknown]').innerText()) === '0')
    check(`${dir} 3. every payer has its row`, (await page.locator('[data-probe-payer]').count()) === 3)
    check(`${dir} 3. some matches, no zero warning`, (await page.locator('[data-raw-probe-zero]').count()) === 0)
    check(`${dir} 3. a count is a machine isolate`, (await row.locator('[data-probe-match] bdi[dir="ltr"]').count()) === 1)

    await page.locator('[data-raw-path]').fill(PATHS.good + ' ')
    await sleep(600)
    check(`${dir} 3. the same path but for its ends keeps its Probe`, (await page.locator('[data-raw-probe]').count()) === 1)
    await page.locator('[data-raw-type]').selectOption('number')
    await page.locator('[data-raw-verdict="clean"]').waitFor({ timeout: 10000 })
    check(`${dir} 3. a changed question drops the old Probe`, (await page.locator('[data-raw-probe]').count()) === 0)
    await page.locator('[data-raw-type]').selectOption('money')
    await page.locator('[data-raw-verdict="clean"]').waitFor({ timeout: 10000 })
    await probe(page)

    await page.locator('[data-raw-propose]').click({ force: true })
    await page.locator('[data-raw-path-form]').waitFor({ state: 'detached', timeout: 5000 })
    const sent = state.proposals[0]
    check(
      `${dir} 5. the proposal carries the whole row`,
      JSON.stringify(sent) === JSON.stringify({ key: 'lineDeductible', label: { en: 'Line deductible', ar: 'خصم البند' }, moment: 'claimResponse', level: 'line', type: 'money', cardinality: 'single', system: null, fhirPath: PATHS.good }),
      JSON.stringify(sent),
    )
    check(`${dir} 5. a raw path joins no catalog on its own`, (await page.locator('[data-fields-catalog] [data-catalog-row]').count()) === FHIR_CATALOG.length)
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 4: stale, and one request per burst ───────────────────────────────────────────────────
  {
    const { context, page, state } = await open(dir)
    await page.locator('[data-raw-path]').fill("slow.today()")
    await sleep(600) // the slow request has left
    await page.locator('[data-raw-path]').fill(PATHS.good)
    await page.locator('[data-raw-verdict="clean"]').waitFor({ timeout: 10000 })
    await sleep(2000) // the slow reply has landed by now
    check(`${dir} 4. a slow older refusal never overwrites the newer verdict`, (await verdictState(page)) === 'clean')

    const before = state.compiles.length
    await page.locator('[data-raw-path]').pressSequentially('abc', { delay: 30 })
    await page.locator('[data-raw-verdict="clean"]').waitFor({ timeout: 10000 })
    check(`${dir} 4. a burst of keystrokes asks once`, state.compiles.length === before + 1, `${state.compiles.length - before}`)
    await context.close()
  }

  // ── 5 + 6: the door refuses; a filled form asks first ─────────────────────────────────────
  {
    const { context, page, state } = await open(dir, { refusePropose: true })
    await fillRow(page, 'lineDeductible')
    await typePath(page, PATHS.good)
    await probe(page)
    await page.locator('[data-raw-propose]').click({ force: true })
    const alert = page.locator('[data-raw-path-form] [role="alert"]')
    await alert.waitFor({ timeout: 5000 })
    check(`${dir} 5. a door's refusal keeps the form and says the door's words`, /already open/.test(await alert.innerText()) && (await page.locator('[data-raw-path-form]').count()) === 1 && state.proposals.length === 0)

    await page.locator('[data-raw-cancel]').click()
    await page.getByText('Close the form and lose what you entered?').waitFor({ timeout: 5000 })
    check(`${dir} 6. a filled form asks before it is thrown away`, (await page.locator('[data-raw-path-form]').count()) === 1)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
