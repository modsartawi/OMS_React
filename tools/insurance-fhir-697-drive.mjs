// Sample tree drive (BackOffice spec 3271; oms ticket 697). STUBBED, on synthetic bundles only: every door is on the
// real envelope, never a live SIS.Api; 711 swaps in the live doors. In LTR and RTL:
//   1. a ref opens the bundle as a tree: nested arrays, a choice type, a whole Money;
//   2. a click sends the door's node reference and nothing of the bundle, and the raw-path form opens filled with the
//      door's path; the same checks and Probe apply, and it can be proposed;
//   3. a click on an existing field points at it and offers no form;
//   4. a click on a Patient field warns, does not refuse, and the warning goes with the proposal;
//   5. nothing from the bundle reaches a URL (beyond its ref), storage, the console or a request;
//   6. an unknown ref and a bare denial are said in words.
//
//   1. npx vite --port 5207 --strictPort
//   2. DRIVE_PORT=5207 node tools/insurance-fhir-697-drive.mjs
import { createRequire } from 'node:module'
import { BUNDLE_REF, CHOICE_PATH, LINE_PATH, PATIENT_PATH, SENTINEL, bundleTreeStub } from './fhir-rules-stubs-697.mjs'
import { FHIR_CATALOG, fhirCatalogStub } from './fhir-rules-stubs-692.mjs'
import { rawPathStub } from './fhir-rules-stubs-695.mjs'
import { envelope, guardEditorStub, insuranceListsStub, insuranceRulesStub, newGuardStore, newListsState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5207}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const EXISTING = FHIR_CATALOG.find((r) => r.moment === 'claimResponse' && r.level === 'line')
const EXISTING_KEY = `$line.${EXISTING.moment}.${EXISTING.key}`

const browser = await chromium.launch()

async function open(dir, { url = '', deny = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const consoleLines = []
  const requests = []
  const state = { proposals: [], compiles: [], clicks: [], treeRefs: [], existing: EXISTING }
  const store = newGuardStore()
  const registry = newListsState()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    consoleLines.push(m.text())
    if (m.type() === 'error' && !/status of [45]\d\d/.test(m.text())) errors.push(m.text())
  })
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const p = u.pathname.replace(/^\/api\//, '')
    requests.push(`${req.url()} ${req.postData() ?? ''}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (deny && p === 'InsuranceRules/Fields/Tree') return route.fulfill({ status: 403, body: '' })
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit =
      bundleTreeStub(req.method(), p, body, { ...state, query: u.searchParams }) ??
      rawPathStub(req.method(), p, body, state) ??
      fhirCatalogStub(req.method(), p, {}) ??
      guardEditorStub(req.method(), p, body, { store, reads: {} }) ??
      insuranceListsStub(req.method(), p, body, { state: registry, query: u.searchParams }) ??
      insuranceRulesStub(req.method(), p, body, { reads: {} })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/insurance-rules/fields${url}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-tree-ref]').waitFor({ timeout: 30000 })
  return { context, page, errors, state, consoleLines, requests }
}

const openBundle = async (page, ref = BUNDLE_REF) => {
  await page.locator('[data-tree-ref]').fill(ref)
  await page.locator('[data-tree-open]').click()
}
const node = (page, ref) => page.locator(`[data-tree-node="${ref}"]`)
const clickNode = async (page, ref) => {
  await node(page, ref).locator('[data-tree-pick]').click()
}
const form = (page) => page.locator('[data-raw-path-form]')
const fillAndPropose = async (page, key) => {
  await page.locator('[data-raw-verdict="clean"]').waitFor({ timeout: 10000 })
  await page.locator('[data-raw-probe-run]').click()
  await page.locator('[data-raw-probe]').waitFor({ timeout: 10000 })
  await page.locator('[data-raw-key]').fill(key)
  await page.locator('[data-raw-label-en]').fill('A label')
  await page.locator('[data-raw-label-ar]').fill('تسمية')
  await page.locator('[data-raw-propose]').click()
  await form(page).waitFor({ state: 'detached', timeout: 5000 })
}
const storageDump = (page) => page.evaluate(() => JSON.stringify([{ ...localStorage }, { ...sessionStorage }]))

for (const dir of ['ltr', 'rtl']) {
  // ── 1 + 2 + 5: the tree, a whole Money, a choice type, and what leaves the page ───────────
  {
    const { context, page, errors, state, consoleLines, requests } = await open(dir)
    check(`${dir} 1. the page runs in its direction`, (await page.locator('html').getAttribute('dir')) === dir)
    check(`${dir} 1. no tree before a ref`, (await page.locator('[data-tree]').count()) === 0 && state.treeRefs.length === 0)
    await openBundle(page)
    await page.locator('[data-tree]').waitFor({ timeout: 10000 })
    check(`${dir} 1. the ref is what was asked for`, state.treeRefs[0] === BUNDLE_REF, JSON.stringify(state.treeRefs))
    check(`${dir} 1. two positions of one array are two nodes`, (await node(page, 'item0').locator('[data-tree-label]').innerText()) === 'item[0]' && (await node(page, 'item1').locator('[data-tree-label]').innerText()) === 'item[1]')
    check(`${dir} 1. a nested array sits under its parent`, (await node(page, 'item0.adj1').getAttribute('data-tree-depth')) === '2' && (await node(page, 'item0.adj1').locator('[data-tree-label]').innerText()) === 'adjudication[1]')
    check(`${dir} 1. a choice type reads as one, with what it chose`, (await node(page, 'item1.benefit').locator('[data-tree-label]').innerText()) === 'allowed[x]' && (await node(page, 'item1.benefit').locator('[data-tree-type]').innerText()) === 'Money')
    check(`${dir} 1. a value shows, isolated`, (await node(page, 'status').locator('bdi[data-tree-value]').innerText()) === SENTINEL)
    check(`${dir} 1. a part of a Money is not a click target; the Money is`, (await node(page, 'item0.adj1.amount.value').locator('[data-tree-pick]').count()) === 0 && (await node(page, 'item0.adj1.amount').locator('[data-tree-pick]').count()) === 1)
    check(`${dir} 7. no raw keys`, !/insurance-fields:|\btree\.[a-z]/.test(await page.locator('[data-bundle-tree]').innerText()))

    await node(page, 'item0').locator('[data-tree-toggle]').click()
    check(`${dir} 1. a collapsed array hides its children only`, (await node(page, 'item0.adj1').count()) === 0 && (await node(page, 'item1').count()) === 1)
    await node(page, 'item0').locator('[data-tree-toggle]').click()

    await clickNode(page, 'item0.adj1.amount')
    await form(page).waitFor({ timeout: 10000 })
    check(`${dir} 2. the click sends the ref and the node's own reference, and only them`, JSON.stringify(state.clicks[0]) === JSON.stringify({ ref: BUNDLE_REF, nodeRef: 'item0.adj1.amount' }), JSON.stringify(state.clicks))
    check(`${dir} 2. the form holds the door's path: a where(), not a position`, (await page.locator('[data-raw-path]').inputValue()) === LINE_PATH)
    check(`${dir} 2. a click inside an item opens as a line field`, (await page.locator('[data-raw-level]').inputValue()) === 'line' && (await page.locator('[data-raw-moment]').inputValue()) === 'claimResponse' && (await page.locator('[data-raw-type]').inputValue()) === 'money')
    check(`${dir} 4. an ordinary field carries no Patient warning`, (await page.locator('[data-raw-patient-warning]').count()) === 0)
    await page.locator('[data-raw-verdict="clean"]').waitFor({ timeout: 10000 })
    check(`${dir} 2. the same checks ran on it`, state.compiles.at(-1)?.path === LINE_PATH)
    await page.locator('[data-raw-propose]').click({ force: true })
    check(`${dir} 2. the same Probe is required`, (await page.locator('[data-raw-blocker="notProbed"]').count()) === 1)
    await fillAndPropose(page, 'lineCopayAmount')
    const sent = state.proposals[0]
    check(`${dir} 2. the proposal carries the door's path`, sent?.fhirPath === LINE_PATH && sent?.level === 'line' && !('patientWarning' in sent), JSON.stringify(sent))

    await clickNode(page, 'item1.benefit')
    await form(page).waitFor({ timeout: 10000 })
    check(`${dir} 2. a choice type comes back as ofType()`, (await page.locator('[data-raw-path]').inputValue()) === CHOICE_PATH)
    await page.locator('[data-raw-cancel]').click()
    await form(page).waitFor({ state: 'detached', timeout: 5000 })
    check(`${dir} 2. a form nobody touched closes without asking`, (await form(page).count()) === 0)

    await clickNode(page, 'status')
    await form(page).waitFor({ timeout: 10000 })
    check(`${dir} 2. a code keeps the door's system`, (await page.locator('[data-raw-system]').inputValue()) === 'http://hl7.org/fhir/fm-status')
    check(`${dir} 2. the bundle's value does not enter the form`, (await page.locator('[data-raw-path]').inputValue()) === 'status' && !(await form(page).innerText()).includes(SENTINEL))
    await page.locator('[data-raw-cancel]').click()

    const params = [...new URL(page.url()).searchParams.keys()]
    check(`${dir} 5. the URL holds the ref and nothing more of the bundle`, JSON.stringify(params) === '["bundle"]' && new URL(page.url()).searchParams.get('bundle') === BUNDLE_REF && !page.url().includes(SENTINEL), page.url())
    check(`${dir} 5. no bundle value in storage`, !(await storageDump(page)).includes(SENTINEL) && !(await storageDump(page)).includes('1900-01-01'))
    check(`${dir} 5. no bundle value in the console`, !consoleLines.some((l) => l.includes(SENTINEL)))
    check(`${dir} 5. no bundle value in any request`, !requests.some((r) => r.includes(SENTINEL)))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 3: an existing field ──────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir, { url: `?bundle=${BUNDLE_REF}` })
    await page.locator('[data-tree]').waitFor({ timeout: 10000 })
    check(`${dir} 1. the URL's ref opens the bundle`, state.treeRefs[0] === BUNDLE_REF && (await page.locator('[data-tree-ref]').inputValue()) === BUNDLE_REF)
    await clickNode(page, 'existing')
    const notice = page.locator(`[data-tree-existing]`)
    await notice.waitFor({ timeout: 10000 })
    check(`${dir} 3. it points at the field`, (await notice.getAttribute('data-tree-existing')) === EXISTING_KEY, await notice.getAttribute('data-tree-existing'))
    check(`${dir} 3. it names the field`, (await notice.innerText()).includes(EXISTING.label.en) && (await notice.innerText()).includes(EXISTING_KEY))
    check(`${dir} 3. no form offers a duplicate`, (await form(page).count()) === 0)
    await notice.locator('[data-tree-existing-show]').click()
    const row = page.locator(`[data-catalog-row="${EXISTING_KEY}"]`)
    await page.waitForFunction((k) => {
      const el = document.querySelector(`[data-catalog-row="${CSS.escape(k)}"]`)
      const r = el?.getBoundingClientRect()
      return r && r.top >= 0 && r.bottom <= innerHeight
    }, EXISTING_KEY, { timeout: 5000 }).catch(() => {})
    check(`${dir} 3. and the catalog row comes into view`, await row.isVisible() && (await row.evaluate((el) => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.bottom <= innerHeight })))
    await clickNode(page, 'item0.adj1.amount')
    await form(page).waitFor({ timeout: 10000 })
    check(`${dir} 3. the next click clears the notice`, (await notice.count()) === 0)
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 4: a Patient field ────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir, { url: `?bundle=${BUNDLE_REF}` })
    await page.locator('[data-tree]').waitFor({ timeout: 10000 })
    await clickNode(page, 'patient.birthDate')
    await form(page).waitFor({ timeout: 10000 })
    const warning = page.locator('[data-raw-patient-warning]')
    check(`${dir} 4. a Patient field warns`, (await warning.count()) === 1 && (await warning.innerText()).length > 20)
    // The app's lng stays en under RTL until Arabic is switched on (core/i18n); the ar words are proved by the locale test.
    check(`${dir} 4. the warning says so in words`, /Patient/.test(await warning.innerText()))
    check(`${dir} 4. the form holds the path`, (await page.locator('[data-raw-path]').inputValue()) === PATIENT_PATH)
    await fillAndPropose(page, 'patientBirthDate')
    const sent = state.proposals[0]
    check(`${dir} 4. it is not refused, and the warning goes with the proposal`, sent?.fhirPath === PATIENT_PATH && sent?.patientWarning === true, JSON.stringify(sent))
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: refusals, in words ─────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir)
    await openBundle(page, 'KB-NOT-KEPT')
    const alert = page.locator('[data-bundle-tree] [role="alert"]')
    await alert.waitFor({ timeout: 10000 })
    check(`${dir} 6. an unknown ref says the door's words`, /No kept bundle/.test(await alert.innerText()), await alert.innerText())
    await context.close()
  }
  {
    const { context, page } = await open(dir, { deny: true })
    await openBundle(page)
    const alert = page.locator('[data-bundle-tree] [role="alert"]')
    await alert.waitFor({ timeout: 10000 })
    check(`${dir} 6. a bare denial is said in words`, /permission/.test(await alert.innerText()), await alert.innerText())
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
