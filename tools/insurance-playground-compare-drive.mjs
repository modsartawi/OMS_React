// Insurance rules ▸ Playground — Compare (A/B) (BackOffice spec 3243, story 48; oms ticket 690).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, section
// 690: `playgroundCompareStub` = 677's evaluator + 686's read log + 678's verdict). No new door: two Evaluate calls.
// 🚩 Nothing here is driven against a live SIS.Api (ticket 691).
//
// It verifies, in LTR and RTL:
//   1. Compare duplicates the experiment as B (same boxes), both run, and equal outcomes highlight nothing;
//   2. one quantity changed in B: the differing line, trace row, read row and verdict are highlighted; the rest not;
//      A's own outcome is untouched;
//   3. a line added in B is shown as "only in B", A's side says it is not there;
//   4. leaving Compare keeps A as the experiment;
//   5. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5390 --strictPort
//   2. node tools/insurance-playground-compare-drive.mjs        (DRIVE_PORT overrides 5390)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newPlaygroundStore, playgroundCompareStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5390}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const browser = await chromium.launch()

async function open(dir) {
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
    const hit = playgroundCompareStub(req.method(), p, body, { store }) ?? insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|playground):|\b(run|data|rule|json|outcome|trace|access|reads|explain|compare)\.\w/.test(await page.locator('main').innerText())
const box = (page, b) => page.locator(`textarea[data-json-box="${b}"]`)
const bBox = (page, b) => page.locator(`textarea[data-b-box="${b}"]`)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
// No Run button: wait for the request carrying what was just typed, then for its answer to be drawn.
const run = async (page, store, sel, sent = () => true) => {
  const from = store.evaluates.length
  for (let i = 0; i < 50 && !store.evaluates.slice(from).some(sent); i++) await sleep(100)
  await sleep(300)
  await page.locator(sel).first().waitFor({ timeout: 10000 }).catch(() => {})
  await sleep(300)
}

const DATA = {
  request: { channel: 'nphies', store: 'P001', payer: '0001100041', policy: null, class: null, pharmacist: null, attributes: {} },
  patient: { birthDate: '1990-04-01', gender: 'male', idType: 'nationalId', attributes: {} },
  lines: [
    { line: 1, item: '200021', quantity: 2, unit: 'PC', daysSupply: 120, attributes: {} },
    { line: 2, item: '200022', quantity: 1, unit: 'PC', daysSupply: 30, attributes: {} },
  ],
  history: [],
  reference: {},
  eligibility: {},
}
const DOC = {
  schema: 1,
  kind: 'guard',
  revision: 0,
  fields: [],
  lists: [],
  rules: [
    {
      id: 'G-1',
      when: [
        { check: 'line', field: 'daysSupply', above: 90 },
        { check: 'line', field: 'quantity', atLeast: 2 },
      ],
      then: [{ effect: 'guard', severity: 'WARN', says: { en: 'Two packs of a long supply', ar: 'عبوتان لصرف طويل' } }],
    },
  ],
}
const DATA_TEXT = JSON.stringify(DATA, null, 2)

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, store } = await open(dir)
  await page.goto(`${BASE}/insurance-rules/playground`)
  await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
  check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  await box(page, 'data').fill(DATA_TEXT)
  await box(page, 'document').fill(JSON.stringify(DOC, null, 2))
  await run(page, store, '[data-outcome-line="2"]', (b) => b?.document?.rules?.[0]?.when?.[1]?.field === 'quantity' && b?.data?.lines?.length === 2)
  check(`${dir} 0. A: line 1 matched`, (await page.locator('[data-matched-lines]').getAttribute('data-matched-lines')) === '1')

  // 1. duplicate as B
  const toggle = page.locator('[data-compare-toggle]')
  check(`${dir} 1. the toggle says Compare A/B`, strip(await toggle.innerText()) === 'Compare A/B' && (await toggle.getAttribute('aria-pressed')) === 'false')
  const before = store.evaluates.length
  await toggle.click()
  await page.locator('[data-compare]').waitFor({ timeout: 5000 })
  check(`${dir} 1. B starts as a copy of A's boxes`, (await bBox(page, 'data').inputValue()) === DATA_TEXT && JSON.parse(await bBox(page, 'document').inputValue()).rules[0].id === 'G-1')
  await run(page, store, '[data-compare-diff]')
  check(`${dir} 1. B makes its own Evaluate call`, store.evaluates.length > before)
  check(`${dir} 1. equal outcomes: nothing highlighted`, (await page.locator('[data-compare-diff]').getAttribute('data-compare-diff')) === 'same' && (await page.locator('[data-compare] [data-diff]:not([data-diff="same"])').count()) === 0)
  check(`${dir} 1. the summary says the same`, strip(await page.locator('[data-compare-summary]').innerText()) === 'A and B give the same outcome.')

  // 2. change one quantity in B
  const changed = structuredClone(DATA)
  changed.lines[0].quantity = 1
  await bBox(page, 'data').fill(JSON.stringify(changed, null, 2))
  await run(page, store, '[data-compare-diff="differs"]', (b) => b?.data?.lines?.[0]?.quantity === 1)
  const line = (n) => page.locator(`[data-compare-line="${n}"]`)
  check(`${dir} 2. line 1 is highlighted as differing`, (await line(1).getAttribute('data-diff')) === 'differs' && (await line(1).locator('header.bg-attention-050').count()) === 1)
  check(`${dir} 2. line 2 is not`, (await line(2).getAttribute('data-diff')) === 'same' && (await line(2).locator('.bg-attention-050').count()) === 0)
  const tr = (k) => page.locator(`[data-compare-trace-row="${k}"]`)
  const flipped = tr('1|G-1|when[1]')
  check(
    `${dir} 2. trace row 1|G-1|when[1] is highlighted: A true, B false`,
    (await flipped.getAttribute('data-diff')) === 'differs' &&
      (await flipped.getAttribute('class'))?.includes('bg-attention-050') &&
      (await flipped.locator('[data-side="a"] [data-trace-value]').getAttribute('data-trace-value')) === 'true' &&
      (await flipped.locator('[data-side="b"] [data-trace-value]').getAttribute('data-trace-value')) === 'false',
  )
  check(`${dir} 2. the differing row says Differs`, strip(await flipped.locator('[data-mark]').innerText()) === 'Differs')
  check(`${dir} 2. trace row 1|G-1|when[0] is not highlighted`, (await tr('1|G-1|when[0]').getAttribute('data-diff')) === 'same')
  const rr = page.locator('[data-compare-read-row="1|G-1|when[1]|line.quantity"]')
  check(
    `${dir} 2. the read row line.quantity differs: 2 against 1`,
    (await rr.getAttribute('data-diff')) === 'differs' && (await rr.locator('[data-side="a"] [data-read-value]').getAttribute('data-read-value')) === '2' && (await rr.locator('[data-side="b"] [data-read-value]').getAttribute('data-read-value')) === '1',
  )
  check(`${dir} 2. the verdict differs`, (await page.locator('[data-compare-verdict]').getAttribute('data-compare-verdict')) === 'differs')
  check(`${dir} 2. A's own outcome is untouched`, (await page.locator('[data-pane="outcome"] [data-matched-lines]').getAttribute('data-matched-lines')) === '1' && (await box(page, 'data').inputValue()) === DATA_TEXT)
  check(`${dir} 2. two outcomes, one per side`, (await line(1).locator('header [data-side="a"]').count()) === 1 && (await line(1).locator('header [data-side="b"]').count()) === 1)

  // 3. a line only in B
  const more = structuredClone(changed)
  more.lines.push({ line: 3, item: '200023', quantity: 3, unit: 'PC', daysSupply: 100, attributes: {} })
  await bBox(page, 'data').fill(JSON.stringify(more, null, 2))
  await run(page, store, '[data-compare-line="3"]', (b) => b?.data?.lines?.length === 3)
  check(`${dir} 3. line 3 is only in B`, (await line(3).getAttribute('data-diff')) === 'onlyB' && strip(await line(3).locator('header [data-mark]').innerText()) === 'Only in B')
  check(`${dir} 3. A's side of line 3 says not on this side`, strip(await line(3).locator('header [data-side="a"] [data-absent]').innerText()) === 'Not on this side')
  check(`${dir} 3. line 3's trace rows are only in B`, (await line(3).locator('[data-compare-trace-row][data-diff="onlyB"]').count()) === 2)

  check(`${dir} 5. no raw keys`, await noRawKeys(page))
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-compare.png`, fullPage: true }).catch(() => {})

  // 4. leave Compare
  await toggle.click()
  await sleep(300)
  check(`${dir} 4. leaving Compare drops B`, (await page.locator('[data-compare]').count()) === 0 && (await toggle.getAttribute('aria-pressed')) === 'false')
  check(`${dir} 4. A stays the experiment`, (await box(page, 'data').inputValue()) === DATA_TEXT && (await page.locator('[data-matched-lines]').getAttribute('data-matched-lines')) === '1')
  check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
