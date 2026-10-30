// Insurance rules ▸ Playground — the read log and "Explain this result" (BackOffice spec 3243, 3251; oms ticket 686).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, sections
// 677 + 686): `playgroundReadsStub` answers Evaluate with a read log; `playgroundStub` (677) is the door before 3251.
// 🚩 Nothing here is driven against a live SIS.Api (ticket 691).
//
// It verifies, in LTR and RTL:
//   1. a reply with reads shows the read log per line: a field as raw → parsed, one that does not parse as
//      "not a number → unknown", a missing fact as missing, the derived patient.age with its value, an eligibility
//      fact with ONE value on both lines marked "whole request", a request-scope field flagged "no live source";
//   2. the explain paragraph names the matched rule, the false block (with why) and the unknown blocks with their
//      reason (missing; raw text that is not a number), each value isolated;
//   3. a reply with no reads: the log says the door gave none, and Explain works from the trace alone;
//   4. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5386 --strictPort
//   2. node tools/insurance-playground-reads-drive.mjs        (DRIVE_PORT overrides 5386)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newPlaygroundStore, playgroundReadsStub, playgroundStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5386}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const browser = await chromium.launch()

async function open(dir, { withReads }) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newPlaygroundStore()
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
    const door = withReads ? playgroundReadsStub : playgroundStub
    const hit = door(req.method(), p, body, { store }) ?? insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store }
}

const FSI = '\u2068'
const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|playground):|\b(run|data|rule|json|outcome|trace|access|reads|explain)\.\w/.test(await page.locator('main').innerText())
const box = (page, b) => page.locator(`textarea[data-json-box="${b}"]`)
// 678: no Run button — the experiment runs by itself about 500 ms after the last edit. Wait for the request that
// carries the experiment just typed (`sent`, or any request when omitted), then for its answer to be drawn.
const run = async (page, store, sel, sent = () => true) => {
  for (let i = 0; i < 50 && !store.evaluates.some(sent); i++) await new Promise((r) => setTimeout(r, 100))
  await new Promise((r) => setTimeout(r, 300))
  await page.locator(sel).first().waitFor({ timeout: 10000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 300))
}

const ELIG = 'benefit[66].approvalLimit'
const DATA = {
  request: { channel: 'nphies', store: 'P001', payer: '0001100041', policy: null, class: null, pharmacist: null, attributes: { Referral: '1' } },
  patient: { birthDate: '1990-04-01', gender: 'male', idType: 'nationalId', attributes: {} },
  lines: [
    { line: 1, item: '200021', quantity: 2, unit: 'PC', daysSupply: 120, attributes: { MaxDays: 'abc' } },
    { line: 2, item: '200022', quantity: 1, unit: 'PC', daysSupply: 30, attributes: { MaxDays: '20' } },
  ],
  history: [],
  reference: {},
  eligibility: { [ELIG]: { type: 'number', number: 10000, unit: 'SAR' } },
}
const DOC = {
  schema: 1,
  kind: 'guard',
  revision: 0,
  fields: [{ key: 'MaxDays', scope: 'line', type: 'number' }],
  lists: [],
  rules: [
    { id: 'G-1', when: [{ check: 'line', field: 'daysSupply', above: 90 }, { check: 'line', field: 'line.field.MaxDays', above: 10 }], then: [] },
    { id: 'G-2', when: [{ check: 'line', field: 'request.field.Referral', atLeast: 1 }], then: [] },
    { id: 'G-3', when: [{ check: 'line', field: 'icd2', above: 0 }], then: [] },
  ],
}
const now = new Date()
const AGE = now.getFullYear() - 1990 - (now.getMonth() + 1 < 4 ? 1 : 0)

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, store } = await open(dir, { withReads: true })
    await page.goto(`${BASE}/insurance-rules/playground`)
    await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    await box(page, 'data').fill(JSON.stringify(DATA, null, 2))
    await box(page, 'document').fill(JSON.stringify(DOC, null, 2))
    await run(page, store, '[data-read-line="2"]', (b) => b?.document?.rules?.[0]?.id === 'G-1' && b?.data?.lines?.[0]?.attributes?.MaxDays === 'abc')

    // 1. the read log
    const log = page.locator('[data-read-log]')
    check(`${dir} 1. the read log shows both lines`, (await log.locator('[data-read-line]').count()) === 2 && (await page.locator('[data-reads-none]').count()) === 0)
    const row = (line, key) => page.locator(`[data-read-line="${line}"] [data-read-row="${key}"]`)
    const cell = async (r, i) => strip(await r.locator('td').nth(i).innerText())
    const bad = row(1, 'G-1:when[1]:line.field.MaxDays')
    check(
      `${dir} 1. a field that does not parse: raw "abc" → not a number → unknown`,
      (await bad.locator('[data-read-unparsed="number"]').count()) === 1 && strip(await bad.locator('[data-read-raw]').innerText()) === 'abc' && (await cell(bad, 3)) === 'abc Not a number Unknown',
      await cell(bad, 3).catch(() => ''),
    )
    const good = row(2, 'G-1:when[1]:line.field.MaxDays')
    check(`${dir} 1. a field that parses: raw "20" → 20`, (await good.getAttribute('data-read-state')) === 'value' && (await cell(good, 3)) === '20 20' && (await good.locator('[data-read-value="20"]').count()) === 1)
    check(`${dir} 1. raw and value are ltr isolates`, (await bad.locator('[data-read-raw] bdi[dir="ltr"]').count()) === 1 && (await good.locator('[data-read-value] bdi[dir="ltr"]').count()) === 1)
    const miss = row(1, 'G-3:when[0]:line.icd2')
    check(`${dir} 1. a missing fact says missing`, (await miss.getAttribute('data-read-state')) === 'missing' && (await cell(miss, 3)) === 'Missing')
    const age = row(1, 'G-1:when[0]:patient.age')
    check(`${dir} 1. the derived patient.age carries its value, marked derived`, (await age.getAttribute('data-read-kind')) === 'derived' && (await age.locator(`[data-read-value="${AGE}"]`).count()) === 1 && (await cell(age, 2)).includes('Derived'))
    const e1 = row(1, `G-1:when[0]:eligibility.${ELIG}`)
    const e2 = row(2, `G-1:when[0]:eligibility.${ELIG}`)
    check(`${dir} 1. eligibility: one value on both lines`, (await cell(e1, 3)) === '10000 SAR' && (await cell(e2, 3)) === '10000 SAR')
    check(
      `${dir} 1. eligibility is marked as the whole request`,
      (await e1.getAttribute('data-whole-request')) === 'true' && strip(await e2.locator('[data-whole-request-badge]').innerText()) === 'Whole request',
    )
    const ref = row(1, 'G-2:when[0]:request.field.Referral')
    check(`${dir} 1. a request-scope field is flagged no live source`, (await ref.getAttribute('data-no-live-source')) === 'true' && strip(await ref.locator('[data-no-live-source-badge]').innerText()) === 'No live source: reads unknown at the till')
    check(`${dir} 1. a line field carries no such flag`, (await good.getAttribute('data-no-live-source')) === null)

    // 2. explain
    const ex = page.locator('[data-explain]')
    const keys = await ex.locator('[data-explain-sentence]').evaluateAll((els) => els.map((e) => e.getAttribute('data-explain-sentence')))
    const want = ['explain.unknown', 'explain.unparsedAs.number', 'explain.matched', 'explain.unknown', 'explain.missing', 'explain.false', 'explain.why', 'explain.matched', 'explain.unknown', 'explain.missing']
    check(`${dir} 2. the paragraph's sentences, in order`, JSON.stringify(keys) === JSON.stringify(want), JSON.stringify(keys))
    const text = strip(await ex.locator('p').innerText())
    check(`${dir} 2. the unknown block and its unparsed read`, text.includes('On line 1, rule G-1 did not match because block when[1] was unknown. It was unknown because line.field.MaxDays read abc, which is not a number.'), text)
    check(`${dir} 2. the matched rule`, text.includes('On line 1, rule G-2 matched: every block held.'))
    check(`${dir} 2. the missing read`, text.includes('It was unknown because line.icd2 was missing.'))
    check(`${dir} 2. the false block and why`, text.includes('On line 2, rule G-1 did not match because block when[0] was false. The engine said: daysSupply 30 not > 90.'), text)
    check(`${dir} 2. values are isolated (fsi)`, (await ex.locator('p').evaluate((e) => e.textContent ?? '')).split(FSI).length - 1 >= 20)
    check(`${dir} 4. no raw keys`, await noRawKeys(page))
    check(`${dir} 4. no page errors`, errors.length === 0, errors.join(' | '))
    await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-reads.png`, fullPage: true }).catch(() => {})
    await context.close()
  }
  {
    // 3. the door before 3251: no reads
    const { context, page, errors, store } = await open(dir, { withReads: false })
    await page.goto(`${BASE}/insurance-rules/playground`)
    await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
    await run(page, store, '[data-read-log]')
    check(`${dir} 3. no reads: the log says the door gave none`, (await page.locator('[data-reads-none]').count()) === 1 && (await page.locator('[data-read-line]').count()) === 0)
    const keys = await page.locator('[data-explain-sentence]').evaluateAll((els) => els.map((e) => e.getAttribute('data-explain-sentence')))
    check(`${dir} 3. Explain works from the trace alone`, JSON.stringify(keys) === JSON.stringify(['explain.matched', 'explain.noReads']), JSON.stringify(keys))
    check(`${dir} 4. no raw keys (no reads)`, await noRawKeys(page))
    check(`${dir} 4. no page errors (no reads)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
