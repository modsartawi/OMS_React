// Insurer settings, category rules and coverage rules drive (BackOffice spec 3126; oms ticket 617).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, its
// `// --- 617 ---` section, falling through to 610's for the Fields registry and the patient / policy lists):
//   GET  InsuranceRules/Insurers                        → Bupa, Tawuniya, MedGulf          (⚠️ guessed door)
//   GET  InsuranceRules/Insurers/{payer}/Settings       → the insurer's settings
//   PUT  InsuranceRules/Insurers/{payer}/Settings       → the saved settings; a log row of what changed
//   GET  InsuranceRules/Insurers/{payer}/Settings/Log   → newest first
//   GET / PUT InsuranceRules/{Categories|Coverage}/Draft (revision 4 / 7; stale → 409 STALE_REVISION), POST …/Validate
//   GET  InsuranceRules/Fields (610's + 617's eligibility facts), …/PolicyLists, …/PatientLists, …/Guards/Draft
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3144 / 3145 / 3146 are unbuilt. Ticket 618 swaps
// in the live doors.
//
// It verifies, in LTR and RTL (the app's language stays English; `oms.locale=ar` flips the direction only):
//   1. Insurers: the list, Bupa's settings and log; a problem refused in words before the PUT; the PUT of the
//      whole settings; the log line it writes; `?payer=` opens another insurer;
//   2. Categories: K-001 "Bupa: Glucophage XR is Brand" built from the palette (payer + item code → Brand), moved
//      FIRST (first match wins), Undo / Redo of the move, checks pass, the whole draft PUT in its new order;
//   3. Coverage: "no deductible for these policies" (SASREF policy list → deductible 0 %, no cap, OVERRIDES the
//      payer), the mark shown on the value, the row and the reads-as; the PUT; a stale revision says so and reloads;
//   4. the guard palette offers the registry's facts, eligibility ones included (608's FACTS switched to 610's
//      registry), and the line's "after" the coverage end; patient lists picked by name;
//   5. a bare 403 reads "You do not have access";
//   6. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5210 --strictPort
//   2. node tools/insurance-coverage-drive.mjs        (DRIVE_PORT overrides 5210)
import { createRequire } from 'node:module'
import { K_001, NO_DEDUCTIBLE, envelope, coverageStub, insuranceRulesStub, newCoverageState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const state = newCoverageState()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit = coverageStub(req.method(), p, body, { state, deny, reads, query: url.searchParams }) ?? insuranceRulesStub(req.method(), p, body, { reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const canon = (v) => JSON.stringify(v, (_k, x) => (x && typeof x === 'object' && !Array.isArray(x) ? Object.fromEntries(Object.entries(x).sort(([a], [b]) => a.localeCompare(b))) : x))
const writesOf = (state, door) => state.writes.filter((w) => w.door === door)
const noRawKeys = async (page) => !/insurance-(rules|coverage|guards):|\b(ruleset|settings|conditions|effect|payerMark|problem|reads|checks)\.[a-z]/.test(await page.locator('main').innerText())
const input = (scope, name) => scope.locator(`[data-input="${name}"]`).first()
const positions = (page) => page.locator('[data-rule-row]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-position')}:${e.getAttribute('data-rule-row')}`))

for (const dir of ['ltr', 'rtl']) {
  // ── 1: Insurers ──────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/insurers`)
    await page.locator('[data-settings="BUPA"]').waitFor({ timeout: 60000 })
    check(`${dir} 0. html dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(
      `${dir} 1. the rail has Insurers, Categories and Coverage`,
      (await page.locator('a[href="/insurance-rules/insurers"]').count()) >= 1 &&
        (await page.locator('a[href="/insurance-rules/categories"]').count()) >= 1 &&
        (await page.locator('a[href="/insurance-rules/coverage"]').count()) >= 1,
    )
    const ids = await page.locator('[data-insurer]').evaluateAll((els) => els.map((e) => e.getAttribute('data-insurer')))
    check(`${dir} 1. three insurers; the first opens`, JSON.stringify(ids) === JSON.stringify(['BUPA', 'TAWUNIYA', 'MEDGULF']) && (await page.locator('[data-insurer="BUPA"]').getAttribute('aria-current')) === 'true', JSON.stringify(ids))
    check(`${dir} 1. the payer code is an ltr isolate`, strip(await page.locator('[data-insurer="BUPA"] bdi[dir="ltr"]').innerText()) === 'BUPA')
    const s = page.locator('[data-settings="BUPA"]')
    check(`${dir} 1. Bupa's discount, member id and days supply read`, (await input(s, 'fixedDiscountPct').inputValue()) === '15' && (await input(s, 'memberIdLength').inputValue()) === '8' && (await input(s, 'daysMax').inputValue()) === '180')
    check(`${dir} 1. its three benefit codes and one pin`, (await s.locator('[data-benefit-row]').count()) === 3 && (await s.locator('[data-pin-row]').count()) === 1)
    await page.locator('[data-settings-log] [data-log-row="0"]').waitFor({ timeout: 10000 })
    check(`${dir} 1. the log: who, when (an ltr isolate), what changed`, (await page.locator('[data-log-row="0"] [data-log-change="fixedDiscountPct"]').count()) === 1 && strip(await page.locator('[data-log-row="0"] [data-log-by] bdi[dir="ltr"]').innerText()) === 'ins.huda' && (await page.locator('[data-log-row="0"] [data-log-at] bdi[dir="ltr"]').count()) === 1)

    // a problem is refused in words, before any PUT
    await input(s, 'daysMin').fill('200')
    check(`${dir} 1. days supply least above most is refused in words`, (await page.locator('[data-settings-problems] [data-problem="daysSupplyRange"]').count()) === 1 && (await page.locator('[data-settings-save]').getAttribute('aria-disabled')) === 'true')
    await page.locator('[data-settings-save]').click({ force: true })
    check(`${dir} 1. …and nothing is sent`, writesOf(state, 'saveSettings').length === 0)
    await input(s, 'daysMin').fill('1')
    await page.locator('[data-add-benefit]').click()
    await input(s.locator('[data-benefit-row="3"]'), 'benefitCode').fill('57')
    check(`${dir} 1. a benefit code mapped twice is refused on its row`, strip(await page.locator('[data-settings-problems] [data-problem="benefitCodeTwice"]').innerText()).startsWith('Row 4:'), await page.locator('[data-settings-problems]').innerText())
    await input(s.locator('[data-benefit-row="3"]'), 'benefitCode').fill('58')
    await input(s.locator('[data-benefit-row="3"]'), 'benefitMeaning').selectOption('dayBenefit')
    await input(s, 'fixedDiscountPct').fill('14.5')
    check(`${dir} 1. no problem left`, (await page.locator('[data-settings-problems]').count()) === 0)
    await page.locator('[data-settings-save]').click()
    await page.waitForFunction(() => document.querySelector('[data-log-row="0"] [data-log-change="fixedDiscountPct"] ')?.textContent?.includes('14.5'), null, { timeout: 10000 }).catch(() => {})
    const put = writesOf(state, 'saveSettings')
    const expected = {
      payer: 'BUPA',
      fixedDiscountPct: 14.5,
      receivableCustomer: '1000123',
      memberId: { length: 8, format: '^\\d{8}$' },
      benefitCategories: [
        { code: '66', meaning: 'genericCopay' },
        { code: '57', meaning: 'brandCopay' },
        { code: '13', meaning: 'dayBenefit' },
        { code: '58', meaning: 'dayBenefit' },
      ],
      daysSupply: { min: 1, max: 180 },
      directDispense: { allowed: true, defaultDayBenefit: 500 },
      payerPins: [{ documentType: 'ZINV', payer: 'BUPA-01' }],
    }
    check(`${dir} 1. one PUT of the WHOLE settings to Insurers/BUPA/Settings`, put.length === 1 && put[0].path === 'InsuranceRules/Insurers/BUPA/Settings' && canon(put[0].body) === canon(expected), canon(put[0]?.body))
    const changes = await page.locator('[data-log-row="0"] [data-log-change]').evaluateAll((els) => els.map((e) => e.getAttribute('data-log-change')))
    check(`${dir} 1. the log's new first line names what changed`, JSON.stringify(changes.sort()) === JSON.stringify(['benefitCategories[3].code', 'benefitCategories[3].meaning', 'fixedDiscountPct']) && (await page.locator('[data-log-row]').count()) === 2, JSON.stringify(changes))
    check(`${dir} 1. saved: nothing to cancel`, await page.locator('[data-settings-cancel]').isDisabled())
    await page.locator('[data-insurer="TAWUNIYA"]').click()
    await page.locator('[data-settings="TAWUNIYA"]').waitFor({ timeout: 10000 })
    check(`${dir} 1. another insurer lands in the URL`, new URL(page.url()).searchParams.get('payer') === 'TAWUNIYA' && (await input(page.locator('[data-settings="TAWUNIYA"]'), 'fixedDiscountPct').inputValue()) === '9.5')
    check(`${dir} 6. no raw keys (insurers)`, await noRawKeys(page))
    check(`${dir} 6. no page errors (insurers)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2: Categories — K-001 ────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, state, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/categories`)
    await page.locator('[data-rule-row="K-002"]').waitFor({ timeout: 60000 })
    check(`${dir} 2. the order is said: first match wins`, (await page.locator('[data-ruleset-order]').count()) === 1)
    check(`${dir} 2. K-002 sets Generic (G1, an ltr isolate)`, (await page.locator('[data-rule-row="K-002"] [data-category-group="G1"] bdi[dir="ltr"]').innerText()) === 'G1')
    await page.locator('[data-new-rule]').click()
    const ed = page.locator('[data-rule-editor="K-003"]')
    await ed.waitFor({ timeout: 10000 })
    check(`${dir} 2. a new rule takes the next id, LAST, a draft, open in the URL`, JSON.stringify(await positions(page)) === JSON.stringify(['1:K-002', '2:K-003']) && new URL(page.url()).searchParams.get('rule') === 'K-003' && (await ed.locator('[data-state]').first().getAttribute('data-state')) === 'draft', JSON.stringify(await positions(page)))
    check(`${dir} 2. it sets Brand to start; no condition = every line`, (await ed.locator('[data-group-pick="G2"]').getAttribute('aria-checked')) === 'true' && (await ed.locator('[data-conditions-empty]').count()) === 1)
    await input(ed, 'name.en').fill(K_001.name.en)
    await input(ed, 'name.ar').fill(K_001.name.ar)
    await input(ed, 'folder').fill(K_001.folder)
    await ed.locator('select[data-add-condition=""]').selectOption('fact')
    await ed.locator('[data-block="0"]').waitFor()
    check(`${dir} 2. a field condition starts on the insurer, any of`, (await input(ed.locator('[data-block="0"]'), 'fact').inputValue()) === '$request.payer' && (await input(ed.locator('[data-block="0"]'), 'op').inputValue()) === 'anyOf')
    await input(ed.locator('[data-block="0"]'), 'codes').fill('BUPA')
    await ed.locator('select[data-add-condition=""]').selectOption('fact')
    await ed.locator('[data-block="1"]').waitFor()
    const factOpts = await ed.locator('[data-block="1"] [data-input="fact"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 2. the fields come from the registry, eligibility included`, factOpts.includes('$item.ItemCode') && factOpts.includes('$eligibility.benefit.dayBenefit') && !factOpts.includes('$item.OldGroup') && !factOpts.includes('$eligibility.coverage.periodEnd'), JSON.stringify(factOpts))
    await input(ed.locator('[data-block="1"]'), 'fact').selectOption('$item.ItemCode')
    await input(ed.locator('[data-block="1"]'), 'codes').fill('100245')
    await ed.locator('[data-group-pick="G3"]').click()
    await ed.locator('[data-group-pick="G2"]').click()
    const reads1 = strip(await ed.locator('[data-reads-as]').innerText())
    check(`${dir} 2. Reads as: the insurer, the item code, Brand`, (await ed.locator('[data-reads-as] [data-value="says"]').count()) === 2 && (await ed.locator('[data-reads-as] code bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))).join(',') === 'BUPA,100245' && (await ed.locator('[data-reads-then] [data-category-group="G2"]').count()) === 1, reads1)
    check(`${dir} 2. the row says what it sets`, (await page.locator('[data-rule-row="K-003"] [data-category-group="G2"]').count()) === 1 && strip(await page.locator('[data-rule-row="K-003"] [data-rule-name]').innerText()) === K_001.name.en)

    // first match wins: move it first; Undo / Redo the move
    await page.locator('[data-move-up="K-003"]').click()
    check(`${dir} 2. moved up, K-003 is checked first`, JSON.stringify(await positions(page)) === JSON.stringify(['1:K-003', '2:K-002']))
    check(`${dir} 2. the first can go no higher`, await page.locator('[data-move-up="K-003"]').isDisabled())
    check(`${dir} 2. positions are ltr isolates`, (await page.locator('[data-rule-row="K-003"] [data-rule-position] bdi[dir="ltr"]').innerText()) === '1')
    await page.locator('[data-undo]').click()
    check(`${dir} 2. Undo puts it back last`, JSON.stringify(await positions(page)) === JSON.stringify(['1:K-002', '2:K-003']))
    await page.locator('[data-redo]').click()
    check(`${dir} 2. Redo moves it first again`, JSON.stringify(await positions(page)) === JSON.stringify(['1:K-003', '2:K-002']))

    await page.locator('[data-checks-pill]').click()
    await page.waitForFunction(() => document.querySelector('[data-checks-pill]')?.getAttribute('data-checks-pill') === 'pass', null, { timeout: 10000 }).catch(() => {})
    check(`${dir} 2. HQ's checks pass`, (await page.locator('[data-checks-pill]').getAttribute('data-checks-pill')) === 'pass' && reads.validateCategories === 1)
    check(`${dir} 2. unsaved is flagged`, (await page.locator('[data-unsaved]').count()) === 1)
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 10000 }).catch(() => {})
    const put = writesOf(state, 'saveCategories')
    const saved = put[0]?.body
    check(`${dir} 2. one PUT of the whole draft at revision 4, in its new order`, put.length === 1 && saved.revision === 4 && saved.kind === 'category' && JSON.stringify(saved.rules.map((r) => r.id)) === JSON.stringify(['K-003', 'K-002']), JSON.stringify(saved?.rules?.map((r) => r.id)))
    const k = saved?.rules?.[0]
    check(`${dir} 2. the saved rule IS K-001 "Bupa: Glucophage XR is Brand"`, k && canon({ name: k.name, folder: k.folder, when: k.when, then: k.then }) === canon(K_001) && k.state === 'draft', canon(k))
    check(`${dir} 2. saved: nothing unsaved, the revision moves on`, (await page.locator('[data-unsaved]').count()) === 0 && state.categories.revision === 5)
    check(`${dir} 6. no raw keys (categories)`, await noRawKeys(page))
    check(`${dir} 6. no page errors (categories)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 3: Coverage — no deductible for these policies ───────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/coverage`)
    await page.locator('[data-rule-row="C-002"]').waitFor({ timeout: 60000 })
    check(`${dir} 3. each value carries its payer mark`, (await page.locator('[data-rule-row="C-002"] [data-payer-mark]').getAttribute('data-payer-mark')) === 'overrides' && (await page.locator('[data-rule-row="C-003"] [data-payer-mark]').getAttribute('data-payer-mark')) === 'fills')
    check(`${dir} 3. a deductible's numbers are ltr isolates`, (await page.locator('[data-rule-row="C-003"] [data-effect-line="deductible"] bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))).join(',') === '20,50')
    await page.locator('[data-new-rule]').click()
    const ed = page.locator('[data-rule-editor="C-004"]')
    await ed.waitFor({ timeout: 10000 })
    check(`${dir} 3. a new coverage rule sets nothing yet`, (await ed.locator('[data-effects-empty]').count()) === 1)
    await input(ed, 'name.en').fill(NO_DEDUCTIBLE.name.en)
    await input(ed, 'name.ar').fill(NO_DEDUCTIBLE.name.ar)
    await input(ed, 'folder').fill(NO_DEDUCTIBLE.folder)
    await ed.locator('select[data-add-condition=""]').selectOption('policy')
    await ed.locator('[data-block="0"]').waitFor()
    const listOpts = await ed.locator('[data-block="0"] [data-input="inList"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 3. the policy lists are offered by name`, JSON.stringify(listOpts) === JSON.stringify(['', 'PO-EXT', 'PO-SASREF']), JSON.stringify(listOpts))
    await input(ed.locator('[data-block="0"]'), 'inList').selectOption('PO-SASREF')
    await ed.locator('select[data-add-effect]').selectOption('deductible')
    const d = ed.locator('[data-effect="deductible"]')
    await d.waitFor()
    check(`${dir} 3. a new value FILLS the payer's gap until marked`, (await d.locator('[data-payer-mark]').getAttribute('data-payer-mark')) === 'fills' && (await input(d, 'pct').inputValue()) === '0' && (await input(d, 'max').inputValue()) === '')
    await input(d, 'overridesPayer').check()
    check(`${dir} 3. marked: it overrides the payer — on the value, the row and the reads-as`,
      (await d.locator('[data-payer-mark]').getAttribute('data-payer-mark')) === 'overrides' &&
        (await page.locator('[data-rule-row="C-004"] [data-payer-mark="overrides"]').count()) === 1 &&
        (await ed.locator('[data-reads-then] [data-payer-mark="overrides"]').count()) === 1)
    check(`${dir} 3. Reads as names the policy list by id, an ltr isolate`, (await ed.locator('[data-reads-as] [data-check="policy"] bdi[dir="ltr"]').innerText()) === 'PO-SASREF')
    await page.locator('[data-checks-pill]').click()
    await page.waitForFunction(() => document.querySelector('[data-checks-pill]')?.getAttribute('data-checks-pill') === 'pass', null, { timeout: 10000 }).catch(() => {})
    check(`${dir} 3. HQ's checks pass`, (await page.locator('[data-checks-pill]').getAttribute('data-checks-pill')) === 'pass')
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 10000 }).catch(() => {})
    const put = writesOf(state, 'saveCoverage')
    const c = put[0]?.body?.rules?.find((r) => r.id === 'C-004')
    check(`${dir} 3. one PUT at revision 7; C-004 is "no deductible for these policies", overriding the payer`, put.length === 1 && put[0].body.revision === 7 && c && canon({ name: c.name, folder: c.folder, when: c.when, then: c.then }) === canon(NO_DEDUCTIBLE), canon(c))
    check(`${dir} 3. new rules go last`, JSON.stringify(put[0]?.body?.rules?.map((r) => r.id)) === JSON.stringify(['C-002', 'C-003', 'C-004']))

    // a stale revision: someone saved in between
    state.coverage = { ...state.coverage, revision: state.coverage.revision + 1 }
    await input(ed, 'folder').fill('Bupa contract/SASREF')
    await page.locator('[data-save]').click()
    await page.locator('[data-reload]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 3. a stale revision says someone saved first, with a reload`, (await page.locator('[data-reload]').count()) === 1 && writesOf(state, 'saveCoverage').length === 2)
    await page.locator('[data-reload]').click()
    await page.waitForFunction(() => !document.querySelector('[data-reload]'), null, { timeout: 10000 }).catch(() => {})
    check(`${dir} 3. reloaded: the banner goes, the folder is HQ's`, (await page.locator('[data-reload]').count()) === 0 && (await input(page.locator('[data-rule-editor="C-004"]'), 'folder').inputValue()) === 'Bupa contract')
    check(`${dir} 6. no raw keys (coverage)`, await noRawKeys(page))
    check(`${dir} 6. no page errors (coverage)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 4: eligibility facts in the guard palette ───────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/guards/new`)
    await page.locator('[data-guard-editor] [data-editor-header]').waitFor({ timeout: 60000 })
    await page.locator('select[data-add-condition=""]').selectOption('fact')
    await page.locator('[data-block="0"]').waitFor()
    const scopes = await page.locator('[data-block="0"] [data-input="fact"] optgroup').evaluateAll((els) => els.length)
    const elig = await page.locator('[data-block="0"] [data-input="fact"] option[data-scope="eligibility"]').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 4. the guard palette offers the registry's facts by scope`, scopes === 4, String(scopes))
    check(`${dir} 4. eligibility facts are in it`, JSON.stringify(elig) === JSON.stringify(['$eligibility.coverage.class', '$eligibility.benefit.dayBenefit', '$eligibility.benefit.genericCopayPct']), JSON.stringify(elig))
    await page.locator('[data-block="0"] [data-input="fact"]').selectOption('$eligibility.benefit.dayBenefit')
    await page.locator('[data-block="0"] [data-input="value"]').fill('10000')
    check(`${dir} 4. a number fact takes its unit from the registry`, strip(await page.locator('[data-block="0"] [data-input="value"]').locator('xpath=..').innerText()).endsWith('SAR'))
    check(`${dir} 4. Reads as names the fact by its registry label`, strip(await page.locator('[data-reads-as] [data-value="says"]').first().innerText()) === 'Day benefit')
    await page.locator('select[data-add-condition=""]').selectOption('line')
    await page.locator('[data-block="1"]').waitFor()
    await page.locator('[data-block="1"] [data-input="lineMode"]').selectOption('after')
    const after = await page.locator('[data-block="1"] [data-input="after"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 4. the line's "after" offers the registry's days`, JSON.stringify(after) === JSON.stringify(['$eligibility.coverage.periodEnd']) && (await page.locator('[data-block="1"] [data-input="after"]').inputValue()) === '$eligibility.coverage.periodEnd', JSON.stringify(after))
    await page.locator('select[data-add-condition=""]').selectOption('patient')
    await page.locator('[data-block="2"]').waitFor()
    const pl = await page.locator('[data-block="2"] [data-input="inList"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 4. a patient list is picked from the lists`, JSON.stringify(pl) === JSON.stringify(['', 'PL-VIP', 'PL-STAFF']), JSON.stringify(pl))
    check(`${dir} 6. no page errors (guard palette)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 5: a bare 403 ────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { deny: ['insurers', 'coverage'] })
    await page.goto(`${BASE}/insurance-rules/insurers`)
    await page.locator('[data-insurers-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 5. Insurers denied: "You do not have access"`, (await page.locator('[data-insurers-denied]').count()) === 1)
    await page.goto(`${BASE}/insurance-rules/coverage`)
    await page.locator('[data-ruleset-denied]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 5. Coverage denied: "You do not have access"`, (await page.locator('[data-ruleset-denied]').count()) === 1 && strip(await page.locator('[data-ruleset-denied]').innerText()).startsWith('You do not have access'))
    check(`${dir} 6. no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
