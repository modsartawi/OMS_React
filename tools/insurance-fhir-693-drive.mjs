// A condition's operators follow the fact's type and cardinality (BackOffice spec 3271; oms ticket 693). STUBBED: every
// door is on the real envelope, never a live SIS.Api; 711 swaps in the live doors.
//
// In LTR and RTL: one condition of each type is built from the catalog, offers only its operators, is saved on the guess
// of the wire, reopened from the saved document, and read in words. A money value with more than 3 decimals is refused at
// the field. onUnknown stays visible beside a FHIR fact. RTL here is the layout + data labels (see 692's finding on `lng`);
// the `ar` words are proved by the pure test against the locale.
//
//   1. npx vite --port 5203 --strictPort
//   2. DRIVE_PORT=5203 node tools/insurance-fhir-693-drive.mjs
import { createRequire } from 'node:module'
import { fhirCatalogStub } from './fhir-rules-stubs-692.mjs'
import { OUTCOME_SYSTEM, codeSystemStub } from './fhir-rules-stubs-693.mjs'
import { coverageStub, envelope, guardEditorStub, insuranceListsStub, insuranceRulesStub, newCoverageState, newGuardStore, newListsState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const browser = await chromium.launch()
const context0 = (dir) => browser.newContext({ viewport: { width: 1600, height: 1200 }, timezoneId: 'Asia/Riyadh', locale: dir === 'rtl' ? 'ar' : 'en' })

for (const dir of ['ltr', 'rtl']) {
  const context = await context0(dir)
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newGuardStore()
  const registry = newListsState()
  const coverage = newCoverageState()
  const NEW_TYPES = [
    { check: 'claim', field: 'total', atLeast: { amount: '100.500', currency: 'BHD' } },
    { check: 'claim', field: 'diagnoses', count: { atLeast: 2 } },
    { check: 'claimResponse', field: 'outcome', anyOf: ['rejected'], system: OUTCOME_SYSTEM },
  ]
  const covRule = coverage.coverage.rules.find((r) => r.id === 'C-002')
  covRule.when.push(...structuredClone(NEW_TYPES))
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
    const hit =
      (p.startsWith('InsuranceRules/Coverage/') ? coverageStub(req.method(), p, body, { state: coverage, query: url.searchParams, user: 'msartawi' }) : null) ??
      codeSystemStub(req.method(), p, url.searchParams) ??
      fhirCatalogStub(req.method(), p, {}) ??
      guardEditorStub(req.method(), p, body, { store, reads: {} }) ??
      insuranceListsStub(req.method(), p, body, { state: registry, query: url.searchParams }) ??
      insuranceRulesStub(req.method(), p, body, { reads: {} })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })

  await page.goto(`${BASE}/insurance-rules/guards/new`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-guard-editor] [data-editor-header]').waitFor({ timeout: 30000 })

  const block = (i) => page.locator(`[data-block="${i}"]`)
  const input = (i, name) => block(i).locator(`[data-input="${name}"]`)
  const ops = (i) => input(i, 'op').locator('option').evaluateAll((els) => els.map((e) => e.value))
  let n = 0
  /** Adds a fact block and picks a catalog row into it. */
  const pick = async (key) => {
    const i = n++
    await page.locator('select[data-add-condition=""]').selectOption('fact')
    await block(i).locator('[data-catalog-open]').click()
    await page.locator('dialog [data-catalog]').waitFor({ timeout: 10000 })
    await page.locator(`dialog [data-catalog-row="${key}"] [data-catalog-pick]`).click()
    await page.locator('dialog').waitFor({ state: 'detached', timeout: 5000 })
    await input(i, 'op').waitFor()
    return i
  }

  // ── money ────────────────────────────────────────────────────────────────────────────────
  const money = await pick('$claim.total')
  check(`${dir} money compares only`, same(await ops(money), ['atLeast', 'below']), JSON.stringify(await ops(money)))
  check(`${dir} money starts with a currency`, (await input(money, 'currency').inputValue()) === 'SAR')
  await input(money, 'amount').fill('100.5001')
  check(`${dir} more than 3 decimals is refused at the field`, (await block(money).locator('[data-value-problem="decimals"]').isVisible()) && (await input(money, 'amount').getAttribute('aria-invalid')) === 'true')
  await input(money, 'amount').blur()
  check(`${dir} leaving the box puts back what it took`, (await input(money, 'amount').inputValue()) === '0' && (await block(money).locator('[data-value-problem]').count()) === 0)
  await input(money, 'amount').fill('100.500')
  await input(money, 'currency').fill('bhd')
  check(`${dir} a currency is typed in capitals`, (await input(money, 'currency').inputValue()) === 'BHD')
  await input(money, 'op').selectOption('below')
  check(`${dir} a bound of the same family keeps its value`, (await input(money, 'amount').inputValue()) === '100.500')
  check(`${dir} the money box is a machine value`, (await input(money, 'amount').getAttribute('dir')) === 'ltr')

  // ── quantity ─────────────────────────────────────────────────────────────────────────────
  const quantity = await pick('$eligibility.coverage.copayPctQty')
  check(`${dir} a quantity is a value and a unit, in the fact's unit`, (await input(quantity, 'unit').inputValue()) === '%')
  await input(quantity, 'quantity').fill('20.5')

  // ── code ─────────────────────────────────────────────────────────────────────────────────
  const code = await pick('$claimResponse.outcome')
  check(`${dir} a single code offers any of and none of, and no count`, same(await ops(code), ['anyOf', 'noneOf']), JSON.stringify(await ops(code)))
  check(`${dir} the code starts in the declared system`, (await input(code, 'system').inputValue()) === OUTCOME_SYSTEM)
  await input(code, 'addCode').waitFor({ timeout: 10000 })
  const offered = await input(code, 'addCode').locator('option').evaluateAll((els) => els.map((e) => e.value).filter(Boolean))
  check(`${dir} codes are offered from that system`, same(offered, ['approved', 'rejected', 'partial']), JSON.stringify(offered))
  await input(code, 'addCode').selectOption('rejected')
  await input(code, 'codes').fill('rejected, Z-RAW')
  check(`${dir} a code the list does not hold is taken raw`, (await input(code, 'codes').inputValue()) === 'rejected, Z-RAW')

  // ── list ─────────────────────────────────────────────────────────────────────────────────
  const list = await pick('$claim.diagnoses')
  check(`${dir} a list offers any of, none of and count`, same(await ops(list), ['anyOf', 'noneOf', 'countAtLeast', 'countBelow']), JSON.stringify(await ops(list)))
  await input(list, 'op').selectOption('countAtLeast')
  await input(list, 'count').fill('2')
  const listNone = await pick('$line.claimResponse.reasons')
  await input(listNone, 'op').selectOption('noneOf')
  await input(listNone, 'codes').fill('CV-4-8')

  // ── flag + a flag on eligibility ─────────────────────────────────────────────────────────
  const flag = await pick('$claim.hasAttachment')
  check(`${dir} a flag is only yes or no`, same(await ops(flag), ['is']))
  await input(flag, 'flag').selectOption('no')
  const inForce = await pick('$eligibility.response.inForce')
  check(`${dir} a flag on eligibility too`, same(await ops(inForce), ['is']))

  // ── a day ────────────────────────────────────────────────────────────────────────────────
  const day = await pick('$eligibility.coverage.periodEnd')
  check(`${dir} a day has day tests`, same(await ops(day), ['before', 'onOrBefore', 'after', 'onOrAfter']), JSON.stringify(await ops(day)))
  await input(day, 'day').fill('2026-12-31')

  // ── onUnknown ────────────────────────────────────────────────────────────────────────────
  check(`${dir} a FHIR fact says what unknown or unparsed does`, (await block(money).locator('[data-fact-unknown="none"]').isVisible()) && (await page.locator('[data-on-unknown-editor]').isVisible()))
  await page.locator('[data-on-unknown="warn"]').check()
  check(`${dir} and follows the rule's choice`, (await block(money).locator('[data-fact-unknown="warn"]').count()) === 1)

  // ── save ─────────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-input="name.en"]').first().fill('Typed facts')
  await page.locator('[data-input="name.ar"]').first().fill('معلومات مصنفة')
  await page.locator('[data-save]').click()
  await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 15000 }).catch(() => {})
  const saved = store.puts.at(-1)?.rules.find((r) => r.name?.en === 'Typed facts')
  const expected = [
    { check: 'claim', field: 'total', under: { amount: '100.500', currency: 'BHD' } },
    { check: 'eligibility', field: 'coverage.copayPctQty', atLeast: { value: '20.5', unit: '%' } },
    { check: 'claimResponse', field: 'outcome', anyOf: ['rejected', 'Z-RAW'], system: OUTCOME_SYSTEM },
    { check: 'claim', field: 'diagnoses', count: { atLeast: 2 } },
    { check: 'line', field: 'claimResponse.reasons', noneOf: ['CV-4-8'], system: 'http://nphies.sa/terminology/CodeSystem/adjudication-reason' },
    { check: 'claim', field: 'hasAttachment', is: false },
    { check: 'eligibility', field: 'response.inForce', is: true },
    { check: 'eligibility', field: 'coverage.periodEnd', before: '2026-12-31' },
  ]
  check(`${dir} each condition saves on its wire shape, money as a string`, same(saved?.when, expected), JSON.stringify(saved?.when))
  check(`${dir} no page errors while building`, errors.length === 0, errors.join(' | '))

  // ── reopen: a fresh page reads the saved document ────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/${encodeURIComponent(saved.id)}/edit`, { waitUntil: 'domcontentloaded' })
  await input(0, 'amount').waitFor({ timeout: 30000 })
  check(`${dir} reopened: money`, (await input(0, 'op').inputValue()) === 'below' && (await input(0, 'amount').inputValue()) === '100.500' && (await input(0, 'currency').inputValue()) === 'BHD')
  check(`${dir} reopened: quantity`, (await input(1, 'quantity').inputValue()) === '20.5' && (await input(1, 'unit').inputValue()) === '%')
  check(`${dir} reopened: code`, (await input(2, 'codes').inputValue()) === 'rejected, Z-RAW' && (await input(2, 'system').inputValue()) === OUTCOME_SYSTEM)
  check(`${dir} reopened: count`, (await input(3, 'op').inputValue()) === 'countAtLeast' && (await input(3, 'count').inputValue()) === '2')
  check(`${dir} reopened: none of stays none of`, (await input(4, 'op').inputValue()) === 'noneOf')
  check(`${dir} reopened: flag`, (await input(5, 'flag').inputValue()) === 'no')
  check(`${dir} reopened: an eligibility flag still edits`, (await input(6, 'flag').inputValue()) === 'yes')
  check(`${dir} reopened: an eligibility day still edits`, (await input(7, 'day').inputValue()) === '2026-12-31')

  const reads = page.locator('[data-reads-as]')
  await reads.getByText('Request total', { exact: false }).or(reads.getByText('إجمالي الطلب', { exact: false })).first().waitFor({ timeout: 10000 })
  const words = (await reads.locator('[data-conditions="0"] > li').allInnerTexts()).map((s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim())
  const has = (i, ...parts) => parts.every((p) => (words[i] ?? '').includes(p))
  check(`${dir} reads: money`, has(0, 'is below', 'BHD 100.500'), words[0])
  check(`${dir} reads: quantity`, has(1, 'is at least', '20.5 %'), words[1])
  check(`${dir} reads: code + system`, has(2, 'is any of', 'rejected', 'Z-RAW', 'in the code system', OUTCOME_SYSTEM), words[2])
  check(`${dir} reads: count`, has(3, 'the number of values of', 'is at least', '2'), words[3])
  check(`${dir} reads: none of`, has(4, 'is none of', 'CV-4-8'), words[4])
  check(`${dir} reads: flag`, has(5, 'is no'), words[5])
  check(`${dir} reads: an eligibility flag`, has(6, 'yes'), words[6])
  check(`${dir} reads: an eligibility day`, has(7, 'before'), words[7])
  check(`${dir} the amount in the sentence is a machine isolate`, (await reads.locator('[data-conditions="0"] > li').first().locator('code bdi[dir="ltr"]').innerText()) === 'BHD 100.500')
  check(`${dir} the page runs in its direction`, (await page.locator('html').getAttribute('dir')) === dir)
  check(`${dir} no raw keys`, !/insurance-(rules|guards):|editor\.fact|sentence\.fact/.test(await page.locator('main').innerText()))

  // ── saved again untouched, the document does not move ────────────────────────────────────
  await page.locator('[data-input="name.en"]').first().fill('Typed facts, renamed')
  await page.locator('[data-save]').click()
  await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 15000 }).catch(() => {})
  const again = store.puts.at(-1)?.rules.find((r) => r.id === saved.id)
  check(`${dir} reopened and saved again, every condition is unchanged`, same(again?.when, expected), JSON.stringify(again?.when))

  // ── the rule page ────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/${encodeURIComponent(saved.id)}`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-rule-header]').waitFor({ timeout: 30000 })
  const main = await page.locator('main').innerText()
  check(`${dir} the rule page reads it too, with onUnknown`, main.includes('BHD 100.500') && main.includes('If a fact is unknown'), main.slice(0, 300))

  // ── a coverage rule holding a fact of a new type ─────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/coverage?rule=C-002`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-conditions-editor]').waitFor({ timeout: 30000 })
  const kept = page.locator('[data-conditions-editor] [data-kept-as-written="fact"]')
  await kept.first().waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} coverage: each new-type fact is kept as written`, (await kept.count()) === NEW_TYPES.length, String(await kept.count()))
  const keptWords = (await kept.allInnerTexts()).join(' | ')
  check(`${dir} coverage: it reads in words, never [object Object]`, keptWords.includes('BHD 100.500') && keptWords.includes('the number of values of') && !(await page.locator('[data-conditions-editor]').innerText()).includes('[object') && (await page.locator('[data-conditions-editor] input').evaluateAll((els) => els.every((e) => !e.value.includes('[object')))), keptWords)
  check(`${dir} coverage: the phase-1 facts beside them still draw as rows`, (await page.locator('[data-conditions-editor] [data-input="fact"]').count()) === 2)
  const before = coverage.writes.length
  await page.locator('[data-conditions-editor] [data-input="codes"]').first().fill('Z-EDITED')
  await page.locator('[data-save]').click()
  await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 15000 }).catch(() => {})
  const put = coverage.writes.slice(before).find((w) => w.method === 'PUT')
  const sent = put?.body?.document?.rules?.find((r) => r.id === 'C-002')?.when ?? put?.body?.rules?.find((r) => r.id === 'C-002')?.when ?? []
  check(`${dir} coverage: saving another edit sends them back unchanged`, same(sent.slice(-NEW_TYPES.length), NEW_TYPES), JSON.stringify(sent))
  check(`${dir} no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
