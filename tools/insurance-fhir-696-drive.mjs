// Field proposals inbox drive (BackOffice spec 3271; oms ticket 696). STUBBED: every door here is on the real envelope,
// never a live SIS.Api; 711 swaps in the live doors. In LTR and RTL:
//   1. one user proposes through the raw form; on their own proposal they see why approval is not offered;
//   2. another user opens it, sees path, Probe per payer, labels and the Patient warning, and approves;
//   3. the approved field is in the catalog and the picker with no reload;
//   4. another is rejected with its reason (a blank one is stopped), and joins no catalog; its author reads the reason;
//   5. a server refusal of an own approval shows the door's message and code, and the dialog stays;
//   6. a reader is offered nothing and told why; a bare 403 is said in words.
//
//   1. npx vite --port 5206 --strictPort
//   2. DRIVE_PORT=5206 node tools/insurance-fhir-696-drive.mjs
import { createRequire } from 'node:module'
import { fhirCatalogStub } from './fhir-rules-stubs-692.mjs'
import { PATHS, rawPathStub } from './fhir-rules-stubs-695.mjs'
import { fieldProposalsStub, newProposalStore, proposal } from './fhir-rules-stubs-696.mjs'
import { envelope, guardEditorStub, insuranceListsStub, insuranceRulesStub, newGuardStore, newListsState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5206}`
const INBOX = `${BASE}/insurance-rules/field-proposals`
const FSI = '\u2068'
const PDI = '\u2069'
const PATIENT_PATH = "%rootResource.entry.resource.ofType(Patient).birthDate"
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

/** A session as `user`, over a store other sessions may share. */
async function open(dir, user, store, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const guards = newGuardStore()
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
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: user, currentStoreCode: 'P001' }))
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit =
      fieldProposalsStub(req.method(), p, body, { store, user, ...opts }) ??
      rawPathStub(req.method(), p, body, {}) ??
      fhirCatalogStub(req.method(), p, { rows: store.catalog }) ??
      guardEditorStub(req.method(), p, body, { store: guards, reads: {} }) ??
      insuranceListsStub(req.method(), p, body, { state: registry, query: new URL(req.url()).searchParams }) ??
      insuranceRulesStub(req.method(), p, body, { reads: {} })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors }
}

const goInbox = async (page) => {
  await page.goto(INBOX, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-proposals-page] table, [data-proposals-empty], [data-proposals-denied]').first().waitFor({ timeout: 30000 })
}
const openDetail = async (page, id) => {
  await page.locator(`[data-proposal-open="${id}"]`).click()
  await page.locator(`[data-proposal-detail="${id}"]`).waitFor({ timeout: 10000 })
  return page.locator(`[data-proposal-detail="${id}"]`)
}
/** The router's own navigation, so the page and its query cache stay: nothing here reloads. */
const softGo = (page, url) =>
  page.evaluate((u) => {
    window.history.pushState({}, '', u)
    window.dispatchEvent(new PopStateEvent('popstate'))
  }, url)
const noRawKeys = async (page) => !/insurance-(rules|fields):|\b(proposals|rawPath|catalog)\.[a-z]/.test(await page.locator('main').innerText())

/** Proposes through the raw form on the Fields page, as a real author does. */
async function proposeByForm(page, key, path) {
  await page.goto(`${BASE}/insurance-rules/fields`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-raw-path-open]').click({ timeout: 30000 })
  await page.locator('[data-raw-path-form]').waitFor({ timeout: 10000 })
  await page.locator('[data-raw-moment]').selectOption('claimResponse')
  await page.locator('[data-raw-level]').selectOption('line')
  await page.locator('[data-raw-type]').selectOption('money')
  await page.locator('[data-raw-key]').fill(key)
  await page.locator('[data-raw-label-en]').fill('Line deductible')
  await page.locator('[data-raw-label-ar]').fill('خصم البند')
  await page.locator('[data-raw-path]').fill(path)
  await page.locator('[data-raw-verdict="clean"]').waitFor({ timeout: 10000 })
  await page.locator('[data-raw-probe-run]').click()
  await page.locator('[data-raw-probe]').waitFor({ timeout: 10000 })
  await page.locator('[data-raw-propose]').click()
  await page.locator('[data-raw-path-form]').waitFor({ state: 'detached', timeout: 5000 })
}

for (const dir of ['ltr', 'rtl']) {
  // ── 1 + 2 + 3: propose as one user, approve as another, pick it ─────────────────────────────
  {
    const store = newProposalStore()
    const author = await open(dir, 'nalharbi', store)
    await proposeByForm(author.page, 'lineDeductible', PATIENT_PATH)
    check(`${dir} 1. the proposal joins no catalog on its own`, store.rows.length === 1 && store.rows[0].state === 'proposed' && !store.catalog.some((r) => r.key === 'lineDeductible'))

    await goInbox(author.page)
    const mine = await openDetail(author.page, 'FP-1')
    check(`${dir} 1. the author is offered no decision`, (await author.page.locator('[data-proposal-approve], [data-proposal-reject]').count()) === 0)
    check(`${dir} 1. and is told why`, (await mine.getAttribute('data-proposal-standing')) === 'ownProposal' && /own proposal/i.test(await mine.locator('[data-proposal-why="ownProposal"]').innerText()))
    check(`${dir} 7. no raw keys, no page errors (author)`, (await noRawKeys(author.page)) && author.errors.length === 0, author.errors.join(' | '))
    await author.context.close()

    const other = await open(dir, 'falotaibi', store)
    // The catalog is read and cached BEFORE the approval: "at once" must beat that cache.
    await other.page.goto(`${BASE}/insurance-rules/fields`, { waitUntil: 'domcontentloaded' })
    await other.page.locator('[data-fields-catalog] [data-catalog-row]').first().waitFor({ timeout: 30000 })
    const rowKey = '$line.claimResponse.lineDeductible'
    check(`${dir} 3. not in the catalog before approval`, (await other.page.locator(`[data-catalog-row="${rowKey}"]`).count()) === 0)
    await other.page.evaluate(() => {
      window.__sameDocument = true
    })
    await softGo(other.page, '/insurance-rules/field-proposals')
    await other.page.locator('[data-proposal-open="FP-1"]').waitFor({ timeout: 30000 })
    check(`${dir} 2. the page runs in its direction`, (await other.page.locator('html').getAttribute('dir')) === dir)

    const detail = await openDetail(other.page, 'FP-1')
    check(`${dir} 2. another grant holder may decide`, (await detail.getAttribute('data-proposal-standing')) === 'may' && (await other.page.locator('[data-proposal-approve]').count()) === 1 && (await other.page.locator('[data-proposal-reject]').count()) === 1)
    check(`${dir} 2. the path, as a machine isolate`, (await detail.locator('[data-proposal-path] bdi[dir="ltr"]').innerText()) === PATIENT_PATH)
    check(`${dir} 2. the labels`, (await detail.locator('[data-says-en]').first().innerText()) === 'Line deductible' && (await detail.locator('[data-says-ar]').first().innerText()) === 'خصم البند')
    const bupa = detail.locator('[data-probe-payer="BUPA"]')
    check(`${dir} 2. the Probe per payer`, (await bupa.locator('[data-probe-match]').innerText()) === '14' && (await bupa.locator('[data-probe-no-match]').innerText()) === '2' && (await detail.locator('[data-probe-payer]').count()) === 3)
    const warning = await detail.locator('[data-proposal-patient-warning]').textContent()
    check(`${dir} 2. the Patient warning names the path, isolated by fsi`, warning.includes(`${FSI}${PATIENT_PATH}${PDI}`), warning)
    check(`${dir} 2. no raw keys in the detail`, !/\bproposals\.[a-z]/.test(await detail.innerText()))

    await other.page.locator('[data-proposal-approve]').click()
    await detail.waitFor({ state: 'detached', timeout: 5000 })
    await other.page.locator('[data-proposal-row="FP-1"][data-proposal-state="approved"]').waitFor({ timeout: 5000 })
    check(`${dir} 2. the approver is on the record`, store.rows[0].decidedBy === 'falotaibi' && store.writes.at(-1).door === 'Approve')

    await softGo(other.page, '/insurance-rules/fields')
    await other.page.locator(`[data-fields-catalog] [data-catalog-row="${rowKey}"]`).waitFor({ timeout: 10000 })
    check(`${dir} 3. in the catalog with no reload`, true)

    await softGo(other.page, '/insurance-rules/guards/new')
    await other.page.locator('[data-guard-editor] [data-editor-header]').waitFor({ timeout: 30000 })
    await other.page.locator('select[data-add-condition=""]').selectOption('fact')
    await other.page.locator('[data-block="0"] [data-catalog-open]').click()
    await other.page.locator(`dialog [data-catalog-row="${rowKey}"] [data-catalog-pick]`).click({ timeout: 10000 })
    await other.page.locator('dialog').waitFor({ state: 'detached', timeout: 5000 })
    check(`${dir} 3. and picked in a condition`, (await other.page.locator('[data-block="0"] [data-fact-key]').getAttribute('data-fact-key')) === rowKey)
    check(`${dir} 3. the page was never reloaded`, await other.page.evaluate(() => window.__sameDocument === true))
    check(`${dir} 7. no raw keys, no page errors (approver)`, (await noRawKeys(other.page)) && other.errors.length === 0, other.errors.join(' | '))
    await other.context.close()
  }

  // ── 4: reject with its reason ─────────────────────────────────────────────────────────────
  {
    const store = newProposalStore([proposal('FP-7')])
    const { context, page, errors } = await open(dir, 'falotaibi', store)
    await goInbox(page)
    const detail = await openDetail(page, 'FP-7')
    await page.locator('[data-proposal-reject]').click()
    await page.locator('[data-proposal-reason-missing]').waitFor({ timeout: 5000 })
    check(`${dir} 4. a blank reason sends nothing`, store.writes.length === 0)
    await page.locator('[data-proposal-reason-input]').fill('Duplicates the line copay.')
    await page.locator('[data-proposal-reject]').click()
    await detail.waitFor({ state: 'detached', timeout: 5000 })
    await page.locator('[data-proposal-row="FP-7"][data-proposal-state="rejected"]').waitFor({ timeout: 5000 })
    check(`${dir} 4. the reason is sent`, store.writes[0].door === 'Reject' && store.writes[0].body.reason === 'Duplicates the line copay.', JSON.stringify(store.writes))
    check(`${dir} 4. a rejected field joins no catalog`, !store.catalog.some((r) => r.key === 'proposedFP-7'))
    check(`${dir} 7. no page errors (reject)`, errors.length === 0, errors.join(' | '))
    await context.close()

    const author = await open(dir, 'nalharbi', store)
    await goInbox(author.page)
    const read = await openDetail(author.page, 'FP-7')
    check(`${dir} 4. its author reads the reason, and who decided`, (await read.locator('[data-proposal-reason] bdi').innerText()) === 'Duplicates the line copay.' && /falotaibi/.test(await read.locator('[data-proposal-decided-by]').innerText()))
    check(`${dir} 4. a decided proposal offers nothing`, (await read.getAttribute('data-proposal-standing')) === 'none')
    await author.context.close()
  }

  // ── 5: a server refusal of an own approval ────────────────────────────────────────────────
  {
    const store = newProposalStore([proposal('FP-8', { authorIs: 'falotaibi' })])
    const { context, page } = await open(dir, 'falotaibi', store)
    await goInbox(page)
    const detail = await openDetail(page, 'FP-8')
    await page.locator('[data-proposal-approve]').click()
    const refused = detail.locator('[data-proposal-refused]')
    await refused.waitFor({ timeout: 5000 })
    const words = await refused.innerText()
    check(`${dir} 5. the door's message`, /Someone other than the author must decide/.test(words), words)
    check(`${dir} 5. the door's code`, (await refused.locator('[data-proposal-refused-code="INSFIELDS_SELF_APPROVAL"]').count()) === 1, words)
    check(`${dir} 5. not "unexpected"`, !/unexpected|could not be decided/i.test(words), words)
    check(`${dir} 5. the dialog stays and nothing joined the catalog`, (await detail.count()) === 1 && !store.catalog.some((r) => r.key === 'proposedFP-8'))
    await context.close()
  }

  // ── 6: a reader, and bare 403s ────────────────────────────────────────────────────────────
  {
    const store = newProposalStore([proposal('FP-9', { patientWarning: true })])
    const reader = await open(dir, 'readonly', store, { viewer: { approver: false } })
    await goInbox(reader.page)
    const detail = await openDetail(reader.page, 'FP-9')
    check(`${dir} 6. a reader is offered nothing`, (await reader.page.locator('[data-proposal-approve], [data-proposal-reject], [data-proposal-reason-input]').count()) === 0)
    check(`${dir} 6. and is told why`, (await detail.locator('[data-proposal-why="reader"]').count()) === 1)
    check(`${dir} 6. and still reads the proposal`, (await detail.locator('[data-proposal-patient-warning]').count()) === 1 && (await detail.locator('[data-probe-payer]').count()) === 3)
    await reader.context.close()

    const bare = await open(dir, 'falotaibi', store, { deny: ['approve'] })
    await goInbox(bare.page)
    await openDetail(bare.page, 'FP-9')
    await bare.page.locator('[data-proposal-approve]').click()
    const refused = bare.page.locator('[data-proposal-refused]')
    await refused.waitFor({ timeout: 5000 })
    check(`${dir} 6. a bare 403 on a decision is said in words`, /permission/.test(await refused.innerText()), await refused.innerText())
    await bare.context.close()

    const denied = await open(dir, 'falotaibi', store, { deny: ['list'] })
    await goInbox(denied.page)
    check(`${dir} 6. a denied inbox says so`, (await denied.page.locator('[data-proposals-denied]').count()) === 1)
    await denied.context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
