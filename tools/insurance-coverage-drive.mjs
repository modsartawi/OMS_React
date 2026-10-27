// Insurer settings, category rules and coverage rules drive (BackOffice spec 3126; oms ticket 617).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, its
// `// --- 617 ---` section, falling through to 610's for the Fields registry and the patient / policy lists), in the
// shapes BackOffice 3144 / 3145 / 3146 BUILT (brief section "HQ contract: coverage"):
//   GET  InsuranceRules/Insurers                        → every insurer's settings, the estate default `*` among them
//   GET / PUT InsuranceRules/Insurers/{customer id}/Settings (404 INSURER_SETTINGS_NOT_FOUND → a new insurer's blank row)
//   GET  InsuranceRules/Insurers/{customer id}/Settings/Log → { changeId, changedBy, changedAt, note, before, after }
//   GET / PUT InsuranceRules/{Categories|Coverage}/Draft → { revision, state, …, document } (409 GUARDS_DRAFT_STALE /
//        GUARDS_DRAFT_PENDING), POST …/Validate, …/Submit, …/Approve, …/SendBack, GET …/Versions, POST …/Restore
//   GET  InsuranceRules/Fields (610's + 617's eligibility facts), …/PolicyLists, …/PatientLists, …/Guards/Draft
// 🚩 NOTHING here is driven against a live SIS.Api. Ticket 618 swaps in the live doors.
//
// It verifies, in LTR and RTL (the app's language stays English; `oms.locale=ar` flips the direction only):
//   1. Insurers: every row (estate default first), Bupa's settings and log; a problem refused in words before the
//      PUT; the PUT of the whole settings with a note; the log line it writes; `?payer=` opens another insurer; an
//      insurer with no row opens blank and Create PUTs it;
//   2. Categories: K-001 "Bupa: Glucophage XR is Brand" built from the palette (payer + item code → Brand), moved
//      FIRST (first match wins), Undo / Redo of the move, checks pass, the whole draft PUT in its new order;
//   3. Coverage: "no deductible for these policies" (SASREF policy list → deductible { percent: 0, overridesPayer:
//      true }), ONE value per rule, the mark on the value, the row and the reads-as; the PUT; a stale revision says so
//      and reloads; an invoice value (segment) that reads the item is refused in words;
//   7. Submit { revision, note }, own-submission refusal, approve by another user (publishes LIVE), versions, restore;
//   4. the guard palette offers the registry's facts, eligibility ones included (608's FACTS switched to 610's
//      registry), and the line's "after" the coverage end; patient lists picked by name;
//   5. a bare 403 reads "You do not have access";
//   6. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5210 --strictPort
//   2. node tools/insurance-coverage-drive.mjs        (DRIVE_PORT overrides 5210)
import { createRequire } from 'node:module'
import { BUPA, INSURER_SETTINGS, K_001, MEDGULF, NO_DEDUCTIBLE, TAWUNIYA, envelope, coverageStub, insuranceRulesStub, newCoverageState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [], user = 'msartawi', viewer, state: shared } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const state = shared ?? newCoverageState()
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
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: user, currentStoreCode: 'P001' }))
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit = coverageStub(req.method(), p, body, { state, deny, reads, query: url.searchParams, user, viewer }) ?? insuranceRulesStub(req.method(), p, body, { reads })
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
    await page.locator('[data-settings="*"]').waitFor({ timeout: 60000 })
    check(`${dir} 0. html dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(
      `${dir} 1. the rail has Insurers, Categories and Coverage`,
      (await page.locator('a[href="/insurance-rules/insurers"]').count()) >= 1 &&
        (await page.locator('a[href="/insurance-rules/categories"]').count()) >= 1 &&
        (await page.locator('a[href="/insurance-rules/coverage"]').count()) >= 1,
    )
    const ids = await page.locator('[data-insurer]').evaluateAll((els) => els.map((e) => e.getAttribute('data-insurer')))
    check(`${dir} 1. every insurer's row from GET Insurers, the estate default first and open`, JSON.stringify(ids) === JSON.stringify(['*', BUPA, TAWUNIYA, MEDGULF]) && (await page.locator('[data-insurer="*"]').getAttribute('aria-current')) === 'true', JSON.stringify(ids))
    check(`${dir} 1. the estate default is named in words; it says every insurer inherits it`, ['Estate default (*)', 'الإعداد العام (*)'].includes(strip(await page.locator('[data-insurer="*"]').innerText())) && (await page.locator('[data-inherit-hint]').count()) === 1)
    check(`${dir} 1. an insurer is its SAP customer id, an ltr isolate`, strip(await page.locator(`[data-insurer="${BUPA}"] bdi[dir="ltr"]`).first().innerText()) === BUPA)
    await page.locator(`[data-insurer="${BUPA}"]`).click()
    const s = page.locator(`[data-settings="${BUPA}"]`)
    await s.waitFor({ timeout: 10000 })
    check(`${dir} 1. Bupa's discount, member-id length and days supply read`, (await input(s, 'fixedDiscountPct').inputValue()) === '15' && (await input(s, 'minLength').inputValue()) === '8' && (await input(s, 'daysMax').inputValue()) === '180' && (await input(s, 'daysDefault').inputValue()) === '30')
    check(`${dir} 1. its switches read`, (await input(s, 'hasFixedDiscount').isChecked()) && (await input(s, 'directDispense').isChecked()) && !(await input(s, 'brandMaxWhenZero').isChecked()))
    check(`${dir} 1. three benefit codes (one from the table of benefits) and one payer pin`, (await s.locator('[data-benefit-row]').count()) === 3 && (await input(s.locator('[data-benefit-row="2"]'), 'benefitSource').inputValue()) === 'tob' && (await s.locator('[data-pin-row]').count()) === 1 && (await input(s, 'pin').inputValue()) === 'Vitality')
    check(`${dir} 1. who last changed it, isolated once`, strip(await s.locator('[data-settings-stamp] bdi[dir="ltr"]').innerText()).startsWith('ins.huda'))
    await page.locator('[data-settings-log] [data-log-row="0"]').waitFor({ timeout: 10000 })
    check(`${dir} 1. the log: who · when (one ltr isolate), the note, what changed (before → after)`, (await page.locator('[data-log-row="0"] [data-log-change="fixedDiscountPct"]').count()) === 1 && strip(await page.locator('[data-log-row="0"] [data-log-by] bdi[dir="ltr"]').innerText()).startsWith('ins.huda') && strip(await page.locator('[data-log-row="0"] [data-log-note] bdi').innerText()) === 'Contract 2026')

    // a problem is refused in words, before any PUT
    await input(s, 'daysMin').fill('200')
    check(`${dir} 1. days supply least above most is refused in words`, (await page.locator('[data-settings-problems] [data-problem="daysSupplyRange"]').count()) === 1 && (await page.locator('[data-settings-save]').getAttribute('aria-disabled')) === 'true')
    await page.locator('[data-settings-save]').click({ force: true })
    check(`${dir} 1. …and nothing is sent`, writesOf(state, 'saveSettings').length === 0)
    await input(s, 'daysMin').fill('1')
    await page.locator('[data-add-benefit]').click()
    await input(s.locator('[data-benefit-row="3"]'), 'benefitCode').fill('57')
    check(`${dir} 1. a benefit code mapped twice from the same place is refused on its row`, strip(await page.locator('[data-settings-problems] [data-problem="benefitCodeTwice"]').innerText()).match(/^(Row 4:|الصف 4:)/) !== null, await page.locator('[data-settings-problems]').innerText())
    await input(s.locator('[data-benefit-row="3"]'), 'benefitSource').selectOption('tob')
    check(`${dir} 1. the same code read from the table of benefits is another mapping`, (await page.locator('[data-settings-problems]').count()) === 0)
    await input(s.locator('[data-benefit-row="3"]'), 'benefitMeaning').selectOption('nonMedCopayPct')
    await input(s, 'fixedDiscountPct').fill('14.5')
    await input(s, 'note').fill('Renewal 2027')
    await page.locator('[data-settings-save]').click()
    await page.locator('[data-log-row="1"]').waitFor({ timeout: 10000 }).catch(() => {})
    const put = writesOf(state, 'saveSettings')
    const expected = {
      ...INSURER_SETTINGS[BUPA],
      fixedDiscountPct: 14.5,
      benefitCategories: [...INSURER_SETTINGS[BUPA].benefitCategories, { source: 'tob', code: '57', meaning: 'nonMedCopayPct' }],
      note: 'Renewal 2027',
    }
    check(`${dir} 1. one PUT of the WHOLE settings with the note to Insurers/{customer id}/Settings`, put.length === 1 && put[0].path === `InsuranceRules/Insurers/${BUPA}/Settings` && canon(put[0].body) === canon(expected), canon(put[0]?.body))
    const changes = await page.locator('[data-log-row="0"] [data-log-change]').evaluateAll((els) => els.map((e) => e.getAttribute('data-log-change')))
    check(`${dir} 1. the log's new first line: its note and what changed`, JSON.stringify(changes.sort()) === JSON.stringify(['benefitCategories[3].code', 'benefitCategories[3].meaning', 'benefitCategories[3].source', 'fixedDiscountPct']) && (await page.locator('[data-log-row]').count()) === 2 && strip(await page.locator('[data-log-row="0"] [data-log-note]').innerText()) === 'Renewal 2027', JSON.stringify(changes))
    check(`${dir} 1. saved: nothing to cancel, the note box empties`, (await page.locator('[data-settings-cancel]').isDisabled()) && (await input(s, 'note').inputValue()) === '')
    await page.locator(`[data-insurer="${TAWUNIYA}"]`).click()
    await page.locator(`[data-settings="${TAWUNIYA}"]`).waitFor({ timeout: 10000 })
    check(`${dir} 1. another insurer lands in the URL`, new URL(page.url()).searchParams.get('payer') === TAWUNIYA && (await input(page.locator(`[data-settings="${TAWUNIYA}"]`), 'fixedDiscountPct').inputValue()) === '9.5')

    // a new insurer: GET is 404 INSURER_SETTINGS_NOT_FOUND → a blank row that inherits; the PUT creates it
    const NEW = '0001100099'
    await input(page, 'openPayer').fill(NEW)
    await page.locator('[data-open-insurer-go]').click()
    const n = page.locator(`[data-settings="${NEW}"]`)
    await n.waitFor({ timeout: 10000 })
    check(`${dir} 1. an insurer with no row opens blank and says it inherits the estate default`, (await n.locator('[data-settings-new]').count()) === 1 && (await input(n, 'fixedDiscountPct').inputValue()) === '0' && (await n.locator('[data-settings-log]').count()) === 0)
    await input(n, 'hasFixedDiscount').check()
    await input(n, 'fixedDiscountPct').fill('5')
    await page.locator('[data-settings-save]').click()
    await page.locator(`[data-settings="${NEW}"] [data-log-created]`).waitFor({ timeout: 10000 }).catch(() => {})
    const created = writesOf(state, 'saveSettings').at(-1)
    check(`${dir} 1. Create PUTs the new insurer's row; the log says it was created`, created?.path === `InsuranceRules/Insurers/${NEW}/Settings` && created.body.fixedDiscountPct === 5 && (await page.locator(`[data-settings="${NEW}"] [data-log-created]`).count()) === 1 && (await page.locator(`[data-insurer="${NEW}"]`).count()) === 1, JSON.stringify(created?.body))
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
    check(`${dir} 2. an approved draft publishes live (no back-test, shadow or promote)`, (await page.locator('[data-publishes-live]').count()) === 1 && (await page.locator('[data-approval-state="editing"]').count()) === 1)
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
    await input(ed.locator('[data-block="0"]'), 'codes').fill(BUPA)
    await ed.locator('select[data-add-condition=""]').selectOption('fact')
    await ed.locator('[data-block="1"]').waitFor()
    const factOpts = await ed.locator('[data-block="1"] [data-input="fact"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 2. the fields come from the registry, eligibility included`, factOpts.includes('$item.ItemCode') && factOpts.includes('$eligibility.benefit.dayBenefit') && !factOpts.includes('$item.OldGroup') && !factOpts.includes('$eligibility.coverage.periodEnd'), JSON.stringify(factOpts))
    await input(ed.locator('[data-block="1"]'), 'fact').selectOption('$item.ItemCode')
    await input(ed.locator('[data-block="1"]'), 'codes').fill('100245')
    await ed.locator('[data-group-pick="G3"]').click()
    await ed.locator('[data-group-pick="G2"]').click()
    const reads1 = strip(await ed.locator('[data-reads-as]').innerText())
    check(`${dir} 2. Reads as: the insurer, the item code, Brand`, (await ed.locator('[data-reads-as] [data-value="says"]').count()) === 2 && (await ed.locator('[data-reads-as] code bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))).join(',') === `${BUPA},100245` && (await ed.locator('[data-reads-then] [data-category-group="G2"]').count()) === 1, reads1)
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

    // The approval panel asks HQ's checks of the SAVED revision on its own; the pill adds one.
    const validatesBefore = reads.validateCategories ?? 0
    await page.locator('[data-checks-pill]').click()
    await page.waitForFunction(() => document.querySelector('[data-checks-pill]')?.getAttribute('data-checks-pill') === 'pass', null, { timeout: 10000 }).catch(() => {})
    check(`${dir} 2. HQ's checks pass`, (await page.locator('[data-checks-pill]').getAttribute('data-checks-pill')) === 'pass' && reads.validateCategories === validatesBefore + 1, `${validatesBefore} → ${reads.validateCategories}`)
    check(`${dir} 2. unsaved is flagged; approval waits for the save`, (await page.locator('[data-unsaved]').count()) === 1 && (await page.locator('[data-why="unsaved"]').count()) === 1)
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 10000 }).catch(() => {})
    const put = writesOf(state, 'saveCategories')
    const saved = put[0]?.body
    check(`${dir} 2. one PUT of the whole document at revision 4, in its new order`, put.length === 1 && saved.revision === 4 && saved.kind === 'category' && JSON.stringify(saved.rules.map((r) => r.id)) === JSON.stringify(['K-003', 'K-002']), JSON.stringify(saved?.rules?.map((r) => r.id)))
    const k = saved?.rules?.[0]
    check(`${dir} 2. the saved rule IS K-001 "Bupa: Glucophage XR is Brand" (one setCategory)`, k && canon({ name: k.name, folder: k.folder, when: k.when, then: k.then }) === canon(K_001) && k.state === 'draft', canon(k))
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
    check(`${dir} 3. no rule is in shadow (an approved coverage document is live)`, (await page.locator('[data-rule-row] [data-state="shadow"]').count()) === 0)
    await page.locator('[data-new-rule]').click()
    const ed = page.locator('[data-rule-editor="C-004"]')
    await ed.waitFor({ timeout: 10000 })
    check(`${dir} 3. a new coverage rule sets nothing yet, refused in words`, (await ed.locator('[data-rule-problem="noEffect"]').count()) === 1)
    await input(ed, 'name.en').fill(NO_DEDUCTIBLE.name.en)
    await input(ed, 'name.ar').fill(NO_DEDUCTIBLE.name.ar)
    await input(ed, 'folder').fill(NO_DEDUCTIBLE.folder)
    await ed.locator('select[data-add-condition=""]').selectOption('policy')
    await ed.locator('[data-block="0"]').waitFor()
    const listOpts = await ed.locator('[data-block="0"] [data-input="inList"] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 3. the policy lists are offered by name`, JSON.stringify(listOpts) === JSON.stringify(['', 'PO-EXT', 'PO-SASREF']), JSON.stringify(listOpts))
    await input(ed.locator('[data-block="0"]'), 'inList').selectOption('PO-SASREF')
    const kinds = await ed.locator('select[data-pick-effect] option').evaluateAll((els) => els.map((e) => e.value).filter(Boolean))
    check(`${dir} 3. ONE value per rule: the line's six, then the invoice's two`, JSON.stringify(kinds) === JSON.stringify(['covered', 'priorApproval', 'deductible', 'priceCap', 'quantityCap', 'daysSupplyCap', 'segment', 'exceptionPrescriptions']), JSON.stringify(kinds))
    await ed.locator('select[data-pick-effect]').selectOption('deductible')
    const d = ed.locator('[data-effect="deductible"]')
    await d.waitFor()
    check(`${dir} 3. a new value applies where the payer said nothing until marked`, (await d.locator('[data-payer-mark]').getAttribute('data-payer-mark')) === 'fills' && (await input(d, 'percent').inputValue()) === '0' && (await input(d, 'max').inputValue()) === '' && (await ed.locator('[data-rule-problems]').count()) === 0)
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
    check(`${dir} 3. one PUT at revision 7; C-004 is "no deductible for these policies": deductible { percent: 0, overridesPayer: true }`, put.length === 1 && put[0].body.revision === 7 && c && canon({ name: c.name, folder: c.folder, when: c.when, then: c.then }) === canon(NO_DEDUCTIBLE), canon(c))
    check(`${dir} 3. new rules go last`, JSON.stringify(put[0]?.body?.rules?.map((r) => r.id)) === JSON.stringify(['C-002', 'C-003', 'C-004']))

    // a stale revision: someone saved in between
    state.coverage = { ...state.coverage, revision: state.coverage.revision + 1 }
    await input(ed, 'folder').fill('Bupa contract/SASREF')
    await page.locator('[data-save]').click()
    await page.locator('[data-reload]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 3. a stale revision (409 GUARDS_DRAFT_STALE) says someone saved first, with a reload`, (await page.locator('[data-reload]').count()) === 1 && writesOf(state, 'saveCoverage').length === 2)
    await page.locator('[data-reload]').click()
    await page.waitForFunction(() => !document.querySelector('[data-reload]'), null, { timeout: 10000 }).catch(() => {})
    check(`${dir} 3. reloaded: the banner goes, the folder is HQ's`, (await page.locator('[data-reload]').count()) === 0 && (await input(page.locator('[data-rule-editor="C-004"]'), 'folder').inputValue()) === 'Bupa contract')

    // an invoice value reads no line: refused in words in the editor
    await page.locator('[data-new-rule]').click()
    const inv = page.locator('[data-rule-editor="C-005"]')
    await inv.waitFor({ timeout: 10000 })
    await inv.locator('select[data-add-condition=""]').selectOption('fact')
    await inv.locator('[data-block="0"]').waitFor()
    await input(inv.locator('[data-block="0"]'), 'fact').selectOption('$item.ItemCode')
    await inv.locator('select[data-pick-effect]').selectOption('segment')
    check(`${dir} 3. a segment rule that reads the item is refused in words`, (await inv.locator('[data-rule-problem="invoiceReadsLine"]').count()) === 1 && (await inv.locator('[data-effect-level="invoice"]').count()) === 1)
    await input(inv.locator('[data-effect="segment"]'), 'value').selectOption('SABIC')
    await inv.locator('select[data-pick-effect]').selectOption('priceCap')
    check(`${dir} 3. switched to a line value (price cap): no refusal, one value still`, (await inv.locator('[data-rule-problems]').count()) === 0 && (await inv.locator('[data-effect="priceCap"]').count()) === 1 && (await inv.locator('[data-effect-level="line"]').count()) === 1)
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

  // ── 7: Submit / Approve / Versions on the category ruleset (the guard doors as built: no back-test, publishes live) ──
  {
    const author = await open(dir)
    const { page, errors, state } = author
    await page.goto(`${BASE}/insurance-rules/categories`)
    await page.locator('[data-ruleset-approval="editing"] [data-action="submit"]').waitFor({ timeout: 60000 })
    const submit = page.locator('[data-action="submit"]')
    check(`${dir} 7. an author may ask for approval of the saved draft once HQ's checks pass (no back-test)`, !(await submit.isDisabled()))
    await page.locator('[data-ruleset-approval] [data-note]').fill('Tawuniya statins')
    await submit.click()
    await page.locator('[data-ruleset-approval="pending"]').waitFor({ timeout: 10000 }).catch(() => {})
    const sub = writesOf(state, 'submitCategories')[0]
    check(`${dir} 7. Submit posts { revision, note } to the Categories doors`, sub?.path === 'InsuranceRules/Categories/Submit' && JSON.stringify(sub.body) === JSON.stringify({ revision: 4, note: 'Tawuniya statins' }), JSON.stringify(sub))
    check(`${dir} 7. pending: the author may not approve their own request, and the draft cannot be saved`, (await page.locator('[data-ruleset-approval="pending"]').count()) === 1 && (await page.locator('[data-action="approve"]').isDisabled()) && (await page.locator('[data-why="ownSubmission"]').count()) === 1 && (await page.locator('[data-draft-locked]').count()) === 1)
    check(`${dir} 7. no page errors (author)`, errors.length === 0, errors.join(' | '))
    await author.context.close()

    const own = await open(dir, { state, viewer: { author: true, approver: true } })
    await own.page.goto(`${BASE}/insurance-rules/categories`)
    await own.page.locator('[data-action="approve"]').waitFor({ timeout: 60000 })
    check(`${dir} 7. an approver never approves their own submission`, (await own.page.locator('[data-action="approve"]').isDisabled()) && (await own.page.locator('[data-why="ownSubmission"]').count()) === 1)
    await own.context.close()

    const approver = await open(dir, { state, user: 'rev.salem', viewer: { author: false, approver: true } })
    const ap = approver.page
    await ap.goto(`${BASE}/insurance-rules/categories`)
    await ap.locator('[data-action="approve"]').waitFor({ timeout: 60000 })
    await ap.locator('[data-action="approve"]').click()
    await ap.locator('[data-ruleset-approval="none"]').waitFor({ timeout: 10000 }).catch(() => {})
    const v2 = state.versions.categories[0]
    check(`${dir} 7. a different user approves { revision, note }: version 2 is published`, writesOf(state, 'approveCategories').length === 1 && JSON.stringify(writesOf(state, 'approveCategories')[0].body) === JSON.stringify({ revision: 4, note: '' }) && v2.versionNo === 2 && v2.publishedBy === 'rev.salem')
    check(`${dir} 7. published LIVE: no draft left, every rule live`, (await ap.locator('[data-ruleset-approval="none"]').count()) === 1 && state.categories.rules.every((r) => r.state === 'live') && (await ap.locator('[data-rule-row] [data-state="live"]').count()) === state.categories.rules.length)
    await ap.locator('[data-ruleset-versions] summary').click()
    await ap.locator('[data-version="2"]').waitFor({ timeout: 10000 })
    check(`${dir} 7. the versions list, newest first, who · when isolated once`, JSON.stringify(await ap.locator('[data-version]').evaluateAll((els) => els.map((e) => e.getAttribute('data-version')))) === JSON.stringify(['2', '1']) && (await ap.locator('[data-version="2"] bdi[dir="ltr"]').count()) >= 2)
    await ap.locator('[data-restore="1"]').click()
    await ap.locator('dialog[open]').waitFor({ timeout: 5000 }).catch(() => {})
    await ap.locator('dialog[open] button').last().click()
    await ap.locator('[data-ruleset-approval="editing"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 7. Restore makes version 1 a new draft`, writesOf(state, 'restoreCategories')[0]?.path === 'InsuranceRules/Categories/Versions/1/Restore' && state.meta.categories.origin === 'restore:1' && (await ap.locator('[data-ruleset-approval="editing"]').count()) === 1)
    check(`${dir} 7. no raw keys`, await noRawKeys(ap))
    check(`${dir} 7. no page errors (approver)`, approver.errors.length === 0, approver.errors.join(' | '))
    await ap.screenshot({ path: `tools/.insurance-coverage-shots/${dir}-7-approval.png`, fullPage: true }).catch(() => {})
    await approver.context.close()
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
