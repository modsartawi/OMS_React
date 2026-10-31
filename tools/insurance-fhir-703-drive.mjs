// Drift items and their badges (BackOffice spec 3271, door 3293; oms ticket 703).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/fhir-rules-stubs-703.mjs`): never a live
// SIS.Api. RTL is direction only (`lng` stays `en`). In LTR and RTL: each signal reads in words with its rate, URL and
// version in ltr isolates; a sample is one (source, id) isolate; a catalog field and a guard carry a badge, the guard's
// saying it still runs; the badge links back to its item, marked on the list; in the picker it opens a new tab; a denied
// badge read leaves the catalog working; clearing with a note removes the badges and the rule row never changed.
//
//   1. npx vite --port 5213 --strictPort
//   2. DRIVE_PORT=5213 node tools/insurance-fhir-703-drive.mjs
import { createRequire } from 'node:module'
import { coverageStub, envelope, guardEditorStub, insuranceRulesStub, newCoverageState, newGuardStore } from './insurance-rules-stubs.mjs'
import { fhirCatalogStub } from './fhir-rules-stubs-692.mjs'
import { createDriftStubs, SAMPLE_URL } from './fhir-rules-stubs-703.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5213}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const browser = await chromium.launch()

async function open(dir, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  await page.clock.setFixedTime(new Date('2026-10-27T10:00:00+03:00'))
  const errors = []
  const writes = []
  const stub = createDriftStubs({ writes, ...opts })
  const store = newGuardStore()
  const coverage = newCoverageState()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await context.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    const body = req.method() === 'GET' ? null : req.postDataJSON()
    const catalog = fhirCatalogStub(req.method(), p)
    if (catalog) return route.fulfill(catalog)
    const mine = stub(req.method(), p, body, url.searchParams)
    if (mine) return route.fulfill(mine)
    const covered = /^InsuranceRules\/(Categories|Coverage)\//.test(p) ? coverageStub(req.method(), p, body, { state: coverage, query: url.searchParams, user: 'msartawi' }) : null
    if (covered) return route.fulfill(covered)
    const hit = guardEditorStub(req.method(), p, body, { store, reads: {} }) ?? insuranceRulesStub(req.method(), p, body, {})
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, writes }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const isolates = (loc) => loc.locator('bdi[dir="ltr"]').allInnerTexts()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const noRawKeys = async (page) => !/insurance-(review|rules):|\b(drift|item|kind)\.[a-z]/.test(await page.locator('main').innerText())
const FIELD = '[data-catalog-row="$line.claimResponse.copay"]'

for (const dir of ['ltr', 'rtl']) {
  // ── the items ─────────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/review?kind=drift`)
    await page.locator('[data-review-row="D-1"]').waitFor({ timeout: 30000 })
    check(`${dir} dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} drift is a kind filter`, (await page.locator('[data-kind-filter="drift"]').count()) === 1)

    const signal = (id) => page.locator(`[data-review-row="${id}"] [data-item-signal]`)
    check(`${dir} kind in words`, strip(await page.locator('[data-review-row="D-1"] [data-col="kind"]').innerText()) === 'Drift')
    check(`${dir} payer is an ltr isolate`, (await page.locator('[data-review-row="D-1"] [data-item-payer] bdi[dir="ltr"]').innerText()) === 'bupa')
    check(`${dir} new profile reads in words`, strip(await signal('D-1').innerText()) === 'Sent a new profile version: ksa-claim-response|2.1.0', await signal('D-1').innerText())
    check(`${dir} new profile: the version is isolated`, same(await isolates(signal('D-1')), ['ksa-claim-response|2.1.0']))
    check(`${dir} new URL reads in words, the URL whole and unescaped`, strip(await signal('D-2').innerText()) === `Sent a URL never seen from this payer: ${SAMPLE_URL}`, await signal('D-2').innerText())
    check(`${dir} new URL: the URL is isolated`, same(await isolates(signal('D-2')), [SAMPLE_URL]))
    check(`${dir} answer rate reads in words`, strip(await signal('D-3').innerText()) === 'The answer rate of $line.claimResponse.copay fell to 12.5%, from a baseline of 48%', await signal('D-3').innerText())
    check(`${dir} answer rate: each machine value is isolated`, same(await isolates(signal('D-3')), ['$line.claimResponse.copay', '12.5%', '48%']))
    check(`${dir} unparsed rate says rose`, strip(await signal('D-4').innerText()) === 'The unparsed rate of $claim.total rose to 20%, from a baseline of 5%')
    check(`${dir} an unknown signal renders with its code`, strip(await signal('D-5').innerText()) === 'A signal this screen does not know: somethingNew')
    check(`${dir} sample is one (source, id) isolate, labelled`, (await page.locator('[data-review-row="D-1"] [data-item-message] bdi[dir="ltr"]').innerText()) === 'bupa · CR-301' && strip(await page.locator('[data-review-row="D-1"] [data-item-message]').innerText()).startsWith('Sample'))
    check(`${dir} no sample: no label`, (await page.locator('[data-review-row="D-5"] [data-item-message]').count()) === 0)
    check(`${dir} the item says rules keep running`, (await page.locator('[data-review-row="D-1"] [data-item-still-running]').count()) === 1)
    check(`${dir} a drift item has no marks`, (await page.locator('[data-review-row="D-1"] [data-mark-action]').count()) === 0)
    check(`${dir} no row links to an unlinked mark`, (await page.locator('[data-review-row][aria-current]').count()) === 0)
    check(`${dir} no raw keys`, await noRawKeys(page))
    check(`${dir} no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // ── badge, link back, clear, badge gone ───────────────────────────────────────────────────────
  {
    const { context, page, errors, writes } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/fields`)
    await page.locator(FIELD).waitFor({ timeout: 30000 })
    const fieldBadge = page.locator(`${FIELD} [data-drift-badge="D-3"]`)
    await fieldBadge.waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} a catalog field carries the badge`, strip(await fieldBadge.innerText()) === 'Drift')
    check(`${dir} a field no item affects has none`, (await page.locator('[data-catalog-row="$claim.hasAttachment"] [data-drift-badge]').count()) === 0)
    const hint = await fieldBadge.getAttribute('title')
    check(`${dir} the badge's hint isolates the payer and says rules keep running`, /\u2068waseel\u2069/.test(hint ?? '') && /keep running/.test(hint ?? ''), hint)
    check(`${dir} on the Fields page the badge stays in this tab`, (await fieldBadge.getAttribute('target')) === null)

    await page.goto(`${BASE}/insurance-rules/guards`)
    const guard = page.locator('.ag-row[row-id="G-001"]').first()
    await guard.waitFor({ timeout: 30000 })
    const ruleBadge = guard.locator('[data-drift-badge="D-3"]')
    await ruleBadge.waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} the rule carries the badge and reads as still running`, strip(await ruleBadge.innerText()) === 'Drift, still running')
    check(`${dir} another rule has none`, (await page.locator('.ag-row[row-id="G-002"] [data-drift-badge]').count()) === 0)
    const stateBefore = strip(await guard.locator('[col-id="state"]').innerText())

    await ruleBadge.click()
    await page.waitForURL(/\/insurance-rules\/review/, { timeout: 8000 }).catch(() => {})
    const u = new URL(page.url())
    check(`${dir} the badge links back to its item, not the rule`, u.pathname === '/insurance-rules/review' && u.searchParams.get('kind') === 'drift' && u.searchParams.get('item') === 'D-3', page.url())
    const row = page.locator('[data-review-row="D-3"]')
    await row.waitFor({ timeout: 8000 })
    check(`${dir} the linked item is marked, and only it`, (await row.getAttribute('aria-current')) === 'true' && (await page.locator('[data-review-row][aria-current]').count()) === 1)

    await row.locator('[data-item-open]').click()
    await page.locator('[data-item-dialog="D-3"]').waitFor({ timeout: 5000 })
    const n = writes.length
    await page.locator('[data-item-clear]').click()
    check(`${dir} clear: an empty note is refused`, (await page.locator('[data-clear-problem]').count()) === 1 && writes.length === n)
    await page.locator('[data-clear-note-input]').fill('تحققنا مع الجهة')
    await page.locator('[data-item-clear]').click()
    await page.locator('[data-review-row="D-3"] [data-col="mark"][data-cleared="true"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} clear: posts the note, one request, no approver`, same(writes.slice(n), [{ method: 'POST', path: 'InsuranceRules/Review/D-3/Clear', body: { note: 'تحققنا مع الجهة' } }]), JSON.stringify(writes.slice(n)))
    check(`${dir} clear: the row reads cleared with the note`, (await row.locator('bdi[data-clear-note]').innerText()) === 'تحققنا مع الجهة')

    // In-app navigation, on the same query cache: only the invalidation can have removed the badges.
    await page.goBack()
    await page.locator('.ag-row[row-id="G-001"]').first().waitFor({ timeout: 30000 })
    await page.locator('.ag-row[row-id="G-001"] [data-drift-badge]').waitFor({ state: 'detached', timeout: 8000 }).catch(() => {})
    check(`${dir} clearing removes the rule's badge`, (await page.locator('.ag-row[row-id="G-001"] [data-drift-badge]').count()) === 0)
    check(`${dir} the rule's state has not changed: nothing stopped`, strip(await page.locator('.ag-row[row-id="G-001"] [col-id="state"]').first().innerText()) === stateBefore)
    await page.locator('.ag-row[row-id="G-001"] [col-id="id"]').first().click()
    await page.waitForURL(/\/insurance-rules\/guards\/G-001/, { timeout: 8000 }).catch(() => {})
    check(`${dir} a row click outside a badge still opens the rule`, /\/insurance-rules\/guards\/G-001/.test(page.url()), page.url())
    await page.goto(`${BASE}/insurance-rules/fields`)
    await page.locator(FIELD).waitFor({ timeout: 30000 })
    await page.locator('[data-catalog-row="$claim.total"] [data-drift-badge="D-1"]').waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} the cleared item's field has no badge, another item's keeps its own`, (await page.locator(`${FIELD} [data-drift-badge]`).count()) === 0 && (await page.locator('[data-catalog-row="$claim.total"] [data-drift-badge="D-1"]').count()) === 1)
    check(`${dir} no page errors on the walk`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // ── wherever a published rule is opened or listed ─────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/guards/G-001`)
    await page.locator('[data-rule-header]').waitFor({ timeout: 30000 })
    const onRule = page.locator('[data-rule-header] [data-drift-badge="D-3"]')
    await onRule.waitFor({ timeout: 8000 }).catch(() => {})
    check(`${dir} the rule page carries the badge, in this tab, still running`, strip(await onRule.innerText()) === 'Drift, still running' && (await onRule.getAttribute('target')) === null)
    await page.goto(`${BASE}/insurance-rules/guards/G-002`)
    await page.locator('[data-rule-header]').waitFor({ timeout: 30000 })
    check(`${dir} a rule page no item affects has none`, (await page.locator('[data-rule-header] [data-drift-badge]').count()) === 0)

    await page.goto(`${BASE}/insurance-rules/guards/G-001/edit`)
    const onEditor = page.locator('[data-editor-header] [data-drift-badge="D-3"]')
    await onEditor.waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} the rule's editor carries it, in a new tab so the draft survives`, (await onEditor.count()) === 1 && (await onEditor.getAttribute('target')) === '_blank')

    for (const [path, id] of [['coverage', 'C-002'], ['categories', 'K-002']]) {
      await page.goto(`${BASE}/insurance-rules/${path}`)
      const row = page.locator(`[data-rule-row="${id}"]`)
      await row.waitFor({ timeout: 30000 })
      const badge = row.locator('[data-drift-badge="D-3"]')
      await badge.waitFor({ timeout: 8000 }).catch(() => {})
      check(`${dir} the ${path} list carries it on the rule, in a new tab`, strip(await badge.innerText()) === 'Drift, still running' && (await badge.getAttribute('target')) === '_blank')
      check(`${dir} the ${path} badge is not inside the row's button`, (await row.locator('button [data-drift-badge]').count()) === 0)
      check(`${dir} the ${path} badge links back to its item`, (await badge.getAttribute('href')) === '/insurance-rules/review?kind=drift&item=D-3')
    }
    const other = page.locator('[data-rule-row]:not([data-rule-row="K-002"]) [data-drift-badge]')
    check(`${dir} no other category rule has one`, (await other.count()) === 0)
    check(`${dir} no page errors on the rule screens`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // ── the picker, and a denied badge read ───────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/guards/new`)
    await page.locator('[data-guard-editor] [data-editor-header]').waitFor({ timeout: 30000 })
    await page.locator('select[data-add-condition=""]').selectOption('fact')
    const pickerOpen = page.locator('[data-block="0"] [data-catalog-open]')
    await pickerOpen.waitFor({ timeout: 15000 }).catch(() => {})
    if (await pickerOpen.count()) {
      await pickerOpen.click()
      const badge = page.locator(`[data-catalog] ${FIELD} [data-drift-badge="D-3"]`)
      await badge.waitFor({ timeout: 8000 }).catch(() => {})
      check(`${dir} in the picker the badge opens a new tab, the draft safe`, (await badge.getAttribute('target')) === '_blank')
    } else check(`${dir} in the picker the badge opens a new tab, the draft safe`, false, 'no picker reached')
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { deny: ['badges'] })
    await page.goto(`${BASE}/insurance-rules/fields`)
    await page.locator(FIELD).waitFor({ timeout: 30000 })
    check(`${dir} a denied badge read: the catalog works, no badge, no error card`, (await page.locator('[data-drift-badge]').count()) === 0 && (await page.locator('[data-catalog]').count()) === 1)
    check(`${dir} a denied badge read: no page error`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
