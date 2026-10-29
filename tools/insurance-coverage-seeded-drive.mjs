// The coverage IF editor on the SEEDED coverage document (oms ticket 674; BackOffice spec 3126, SQL 059 + 060).
//
// Drives the REAL app in Chromium against 617's stubs (`tools/insurance-rules-stubs.mjs`) with the coverage draft set to
// the document BackOffice SQL 059 + 060 publish as version 2 of the coverage line (`tools/insurance-coverage-seeded.json`,
// built from the two scripts' text): 15 rules, 7 item lists, in SIS.Rules' own spelling.
// 🚩 NOTHING here is driven against a live SIS.Api; the ticket's walk does that.
//
// It verifies, in LTR and RTL:
//   1. A01-NO-CONTRACT's item list is picked by name on `a01-no-contract`, with what the list filters on beside it, and
//      the reads-as names the list;
//   2. C-ELITE shows the payer's code 0001100041 (editable) and the eligibility fact benefit[13/day].benefit at least
//      10,000;
//   3. every one of the 15 rules: each condition row has a control or its sentence, never a bare check name;
//   4. pick another list, toggle NOT, change the 10,000 → Save sends exactly those changes; every other rule goes back
//      byte for byte;
//   5. an eligibility block the codec keeps as written (atMost + unit) edits its operator and value; a block the
//      coverage editor does not draw (history) reads as its sentence, kept as written; the palette offers "Item list";
//   6. no raw keys and no page errors; each rule's JSON button shows it as the engine reads it.
//
//   1. run the app:  npx vite --port 5210 --strictPort
//   2. node tools/insurance-coverage-seeded-drive.mjs        (DRIVE_PORT overrides 5210)
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { envelope, coverageStub, insuranceRulesStub, newCoverageState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`
const SEEDED = JSON.parse(readFileSync(new URL('./insurance-coverage-seeded.json', import.meta.url), 'utf8'))
const copy = (x) => JSON.parse(JSON.stringify(x))

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, doc) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const state = newCoverageState()
  state.coverage = copy(doc)
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
    const hit = coverageStub(req.method(), p, body, { state, deny: [], reads, query: url.searchParams, user: 'msartawi' }) ?? insuranceRulesStub(req.method(), p, body, { reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const writesOf = (state, door) => state.writes.filter((w) => w.door === door)
const noRawKeys = async (page) => !/insurance-(rules|coverage|guards):|\b(ruleset|settings|conditions|effect|payerMark|problem|reads|checks|sentence)\.[a-z]/.test(await page.locator('main').innerText())
const input = (scope, name) => scope.locator(`[data-input="${name}"]`).first()
const openRule = async (page, id) => {
  await page.locator(`[data-rule-row="${id}"]`).first().click()
  const ed = page.locator(`[data-rule-editor="${id}"]`)
  await ed.waitFor({ timeout: 10000 })
  return ed
}
/** Each condition row of the open rule: its check, whether it has a control or a sentence, and its text. */
const rowsOf = (ed) =>
  ed.locator('[data-block]').evaluateAll((els) =>
    els.map((e) => ({
      check: e.getAttribute('data-check'),
      drawn: e.querySelectorAll('select:not([data-tree-tool]), input:not([type="checkbox"])').length > 0 || e.querySelector('[data-kept-as-written] [data-sentence]') !== null,
      text: e.innerText.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim(),
    })),
  )

for (const dir of ['ltr', 'rtl']) {
  // ── 1–4: the seeded document ───────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir, SEEDED)
    await page.goto(`${BASE}/insurance-rules/coverage`)
    await page.locator('[data-rule-row="A01-NO-CONTRACT"]').waitFor({ timeout: 60000 })
    check(`${dir} 0. html dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

    // 1. A01-NO-CONTRACT
    let ed = await openRule(page, 'A01-NO-CONTRACT')
    const b0 = ed.locator('[data-block="0"]')
    check(`${dir} 1. A01-NO-CONTRACT's row is an item list, NOT off`, (await b0.getAttribute('data-check')) === 'line' && (await b0.getAttribute('data-not')) === 'false' && (await b0.locator('[data-not-toggle]').getAttribute('aria-pressed')) === 'false')
    check(`${dir} 1. the list picker is on a01-no-contract`, (await input(b0, 'itemList').inputValue()) === 'a01-no-contract')
    const opts = await input(b0, 'itemList').locator('option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 1. it offers the document's 7 lists`, JSON.stringify(opts) === JSON.stringify(SEEDED.lists.map((l) => l.id)), JSON.stringify(opts))
    const optText = strip(await input(b0, 'itemList').locator('option[value="a01-no-contract"]').innerText())
    check(`${dir} 1. a list is named with its id beside the name`, /Item-master insurer: no ItemCustomer row|شركة تأمين بقائمة أصناف: لا يوجد سطر للصنف/.test(optText) && optText.includes('(a01-no-contract)'), optText)
    const filters = strip(await b0.locator('[data-list-filters]').innerText())
    check(`${dir} 1. the filter line says what the list filters on`, filters === 'Insurer.ItemMaster = Y · ItemCustomer.Row = N', filters)
    const readsAs = strip(await ed.locator('[data-reads-as] [data-check="line"]').innerText())
    check(`${dir} 1. reads as "the item is in" the list, by its name`, /Item-master insurer: no ItemCustomer row|شركة تأمين بقائمة أصناف: لا يوجد سطر للصنف/.test(readsAs), readsAs)

    await ed.locator('[data-json-open="rule"]').click()
    await page.locator('[data-json-body]').waitFor({ timeout: 5000 })
    const shown = JSON.parse(await page.locator('[data-json-body]').innerText())
    check(`${dir} 1. JSON shows the rule as the engine reads it, exactly as seeded`, JSON.stringify(shown) === JSON.stringify(SEEDED.rules.find((r) => r.id === 'A01-NO-CONTRACT')), JSON.stringify(shown))
    await page.keyboard.press('Escape')
    await page.locator('[data-json-body]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})

    // 2. C-ELITE
    ed = await openRule(page, 'C-ELITE')
    const payer = ed.locator('[data-block="0"]')
    check(`${dir} 2. C-ELITE: the payer's code 0001100041, editable`, (await payer.getAttribute('data-check')) === 'request' && (await input(payer, 'codes').inputValue()) === '0001100041' && (await input(payer, 'codes').isEditable()))
    const elig = ed.locator('[data-block="1"]')
    const factOpt = strip(await input(elig, 'fact').locator('option:checked').innerText())
    check(`${dir} 2. C-ELITE: benefit[13/day].benefit at least 10,000`, factOpt.includes('benefit[13/day].benefit') && (await input(elig, 'op').inputValue()) === 'atLeast' && (await input(elig, 'value').inputValue()) === '10000', `${factOpt} ${await input(elig, 'op').inputValue()} ${await input(elig, 'value').inputValue()}`)

    // 3. every rule
    const bare = []
    for (const r of SEEDED.rules) {
      const e = await openRule(page, r.id)
      const rows = await rowsOf(e)
      if (rows.length !== r.when.length) bare.push(`${r.id}: ${rows.length} rows`)
      for (const row of rows) if (!row.drawn || row.text.replace(/^(NOT|ليس)\s*/, '') === row.check) bare.push(`${r.id}: ${row.check} "${row.text}"`)
    }
    check(`${dir} 3. all 15 rules: every condition row has a control or its sentence, none a bare check name`, bare.length === 0, bare.join(' | '))
    check(`${dir} 5. the palette offers "Item list" (the document has lists)`, (await page.locator('select[data-add-condition=""] option[value="item"]').count()) === 1)

    // 4. edits → Save sends exactly them
    ed = await openRule(page, 'A01-NO-CONTRACT')
    await input(ed.locator('[data-block="0"]'), 'itemList').selectOption('a01-master-update')
    await ed.locator('[data-block="0"] [data-not-toggle]').click()
    check(`${dir} 4. the filter line follows the picked list`, strip(await ed.locator('[data-block="0"] [data-list-filters]').innerText()) === 'Insurer.ItemMaster = Y · ItemCustomer.DiscountZero = Y')
    ed = await openRule(page, 'C-ELITE')
    await input(ed.locator('[data-block="1"]'), 'value').fill('12000')
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 10000 }).catch(() => {})
    const put = writesOf(state, 'saveCoverage')
    const body = put[0]?.body
    const want = copy(SEEDED.rules)
    want.find((r) => r.id === 'A01-NO-CONTRACT').when = [{ check: 'line', inList: 'a01-master-update', not: true }]
    want.find((r) => r.id === 'C-ELITE').when[1] = { check: 'eligibility', field: 'benefit[13/day].benefit', atLeast: 12000 }
    check(`${dir} 4. one PUT`, put.length === 1)
    check(`${dir} 4. A01-NO-CONTRACT is NOT on a01-master-update; C-ELITE's eligibility block at least 12,000 (its own shape)`,
      JSON.stringify(body?.rules?.find((r) => r.id === 'A01-NO-CONTRACT')) === JSON.stringify(want.find((r) => r.id === 'A01-NO-CONTRACT')) &&
        JSON.stringify(body?.rules?.find((r) => r.id === 'C-ELITE')) === JSON.stringify(want.find((r) => r.id === 'C-ELITE')),
      JSON.stringify(body?.rules?.slice(0, 5)))
    const changed = (body?.rules ?? []).filter((r, i) => JSON.stringify(r) !== JSON.stringify(want[i])).map((r) => r.id)
    check(`${dir} 4. every rule goes back byte for byte except those edits, in order`, body?.rules?.length === 15 && changed.length === 0, changed.join(','))
    check(`${dir} 6. no raw keys (seeded)`, await noRawKeys(page))
    check(`${dir} 6. no source comment printed as text (review 674)`, !/\/\/ oms/.test(await page.locator('main').innerText()))
    check(`${dir} 6. no page errors (seeded)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 5: an eligibility block kept as written, and a block the coverage editor does not draw ──────
  {
    const doc = copy(SEEDED)
    doc.rules.push({
      id: 'C-CAP-TEST',
      name: { en: 'Day benefit at most 500 SAR', ar: 'منفعة يومية لا تزيد عن 500 ريال' },
      state: 'live',
      when: [
        { check: 'eligibility', field: 'benefit[13/day].benefit', atMost: 500, unit: 'SAR' },
        { check: 'history', match: 'sameItem', windowDays: 30, measure: 'dispenses', atLeast: 1, includeThisLine: false },
      ],
      then: [{ effect: 'priorApproval', value: true }],
    })
    const { context, page, errors, state } = await open(dir, doc)
    await page.goto(`${BASE}/insurance-rules/coverage`)
    await page.locator('[data-rule-row="C-CAP-TEST"]').waitFor({ timeout: 60000 })
    const ed = await openRule(page, 'C-CAP-TEST')
    const e = ed.locator('[data-block="0"]')
    check(`${dir} 5. an atMost eligibility block: its field (ltr), operator, value and unit`,
      (await e.getAttribute('data-check')) === 'eligibility' &&
        strip(await e.locator('[data-eligibility-field] bdi[dir="ltr"]').innerText()) === 'benefit[13/day].benefit' &&
        (await input(e, 'eligibilityOp').inputValue()) === 'atMost' &&
        (await input(e, 'value').inputValue()) === '500' &&
        strip(await e.innerText()).includes('SAR'))
    const ops = await input(e, 'eligibilityOp').locator('option').evaluateAll((els) => els.map((o) => o.value))
    check(`${dir} 5. it may become any bound`, JSON.stringify(ops) === JSON.stringify(['above', 'atLeast', 'under', 'atMost']), JSON.stringify(ops))
    const h = ed.locator('[data-block="1"]')
    const kept = strip(await h.locator('[data-kept-as-written="history"]').innerText())
    check(`${dir} 5. a history block reads as its sentence, kept as written`, /dispensed the same item/.test(kept) && /Kept as written|محفوظ كما كُتب/.test(kept), kept)
    const reads = strip(await ed.locator('[data-reads-as] [data-check="eligibility"]').innerText())
    check(`${dir} 5. the reads-as says the eligibility test in words`, reads.includes('benefit[13/day].benefit') && /at most|لا يزيد عن/.test(reads), reads)
    await input(e, 'eligibilityOp').selectOption('under')
    await input(e, 'value').fill('400')
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 10000 }).catch(() => {})
    const body = writesOf(state, 'saveCoverage')[0]?.body
    const want = copy(doc.rules)
    want.at(-1).when[0] = { check: 'eligibility', field: 'benefit[13/day].benefit', under: 400, unit: 'SAR' }
    const changed = (body?.rules ?? []).filter((r, i) => JSON.stringify(r) !== JSON.stringify(want[i])).map((r) => r.id)
    check(`${dir} 5. Save: under 400, the unit and the history block as written, the rest byte for byte`, body?.rules?.length === 16 && changed.length === 0, changed.join(',') + ' ' + JSON.stringify(body?.rules?.at(-1)))
    check(`${dir} 6. no raw keys (kept as written)`, await noRawKeys(page))
    check(`${dir} 6. no page errors (kept as written)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
