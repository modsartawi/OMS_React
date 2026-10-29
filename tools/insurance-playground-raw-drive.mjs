// Insurance rules ▸ Playground — the Raw tab and the intake report (BackOffice spec 3243, door 3246; oms ticket 684).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, sections
// 677 + 684): POST InsuranceRules/Playground/Evaluate { kind, raw, document, asOf } → rawPlayground(body).
// Shapes as the BRIEF draws them; 🚩 nothing here is driven against a live SIS.Api (ticket 691).
//
// It verifies, in LTR and RTL:
//   1. the Data pane has JSON | Raw tabs; Raw shows an empty, left-to-right text box in place of the data box;
//   2. `{"lines":[{"qty":2}]}` as Raw sends { kind, raw, document, asOf } (the text as it is, no data), and the intake
//      report teaches the near-miss: lines[0].qty ignored, "did you mean quantity?", the path an ltr isolate;
//   3. read and refused: lines[0].daysSupply read, lines[0].price refused (expected number), line 1 matched;
//   4. text that is not JSON is still sent, and the PLAYGROUND_RAW_INVALID refusal shows its message and code;
//   5. back on JSON the data box is untouched by Raw, the body is { kind, data, document, asOf } and no intake shows;
//      back on Raw its text is kept;
//   6. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5384 --strictPort
//   2. node tools/insurance-playground-raw-drive.mjs        (DRIVE_PORT overrides 5384)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newPlaygroundStore, playgroundStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5384}`

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
    const hit = playgroundStub(req.method(), p, body, { store }) ?? insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|playground):|\b(run|data|rule|json|outcome|trace|intake|access)\.\w/.test(await page.locator('main').innerText())
const rawBox = (page) => page.locator('textarea[data-raw-box]')
const dataBox = (page) => page.locator('textarea[data-json-box="data"]')
const tab = (page, k) => page.locator(`[data-pane="data"] [data-data-tab="${k}"]`)
const runAndWait = async (page, store, sel) => {
  const before = store.evaluates.length
  await page.locator('[data-run]').click()
  await page.locator(sel).first().waitFor({ timeout: 10000 }).catch(() => {})
  return store.evaluates.length - before
}

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, store } = await open(dir)
  await page.goto(`${BASE}/insurance-rules/playground`)
  await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
  check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  const seedData = await dataBox(page).inputValue()

  // 1. the tabs
  check(`${dir} 1. the Data pane has JSON | Raw tabs, JSON selected`, (await tab(page, 'json').getAttribute('aria-selected')) === 'true' && (await tab(page, 'raw').getAttribute('aria-selected')) === 'false')
  await tab(page, 'raw').click()
  check(`${dir} 1. Raw is selected`, (await tab(page, 'raw').getAttribute('aria-selected')) === 'true')
  check(`${dir} 1. the Raw box replaces the data box, empty and ltr`, (await rawBox(page).count()) === 1 && (await dataBox(page).count()) === 0 && (await rawBox(page).inputValue()) === '' && (await rawBox(page).getAttribute('dir')) === 'ltr')

  // 2. the near-miss
  const RAW = '{"lines":[{"qty":2}]}'
  await rawBox(page).fill(RAW)
  await runAndWait(page, store, '[data-intake]')
  const sent = store.evaluates.at(-1)
  check(`${dir} 2. the body is { kind, raw, document, asOf }`, JSON.stringify(Object.keys(sent ?? {})) === JSON.stringify(['kind', 'raw', 'document', 'asOf']), JSON.stringify(Object.keys(sent ?? {})))
  check(`${dir} 2. raw is the text as typed`, sent?.raw === RAW)
  const qty = page.locator('[data-intake-ignored="lines[0].qty"]')
  check(`${dir} 2. lines[0].qty is ignored`, (await qty.count()) === 1)
  check(`${dir} 2. its hint: did you mean quantity?`, (await qty.locator('[data-intake-hint="quantity"]').count()) === 1 && strip(await qty.innerText()) === 'lines[0].qty did you mean quantity?', strip(await qty.innerText().catch(() => '')))
  check(`${dir} 2. the path is an ltr isolate`, (await qty.locator('bdi[dir="ltr"]').count()) === 1)
  check(`${dir} 2. nothing refused, nothing read`, (await page.locator('[data-intake-section="refused"], [data-intake-section="read"]').count()) === 0)
  check(`${dir} 2. the lines still show (line 1, nothing matched)`, (await page.locator('[data-outcome-line="1"]').count()) === 1 && (await page.locator('[data-nothing-matched]').count()) === 1)
  check(`${dir} 2. no raw keys`, await noRawKeys(page))
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-raw-intake.png`, fullPage: true }).catch(() => {})

  // 3. read and refused
  await rawBox(page).fill('{"lines":[{"line":1,"daysSupply":120,"price":"12"}]}')
  await runAndWait(page, store, '[data-intake-refused]')
  check(`${dir} 3. lines[0].daysSupply is read`, (await page.locator('[data-intake-read="lines[0].daysSupply"] bdi[dir="ltr"]').count()) === 1)
  const price = page.locator('[data-intake-refused="lines[0].price"]')
  check(`${dir} 3. lines[0].price is refused, expected number`, (await price.locator('[data-intake-expected="number"]').count()) === 1 && strip(await price.innerText()) === 'lines[0].price expected number', strip(await price.innerText().catch(() => '')))
  check(`${dir} 3. nothing ignored`, (await page.locator('[data-intake-section="ignored"]').count()) === 0)
  check(`${dir} 3. line 1 matched on what was read`, (await page.locator('[data-matched-lines="1"]').count()) === 1)

  // 4. not JSON: sent anyway, the door refuses in words
  await rawBox(page).fill('{"lines":[')
  const sentBad = await runAndWait(page, store, '[data-refusal-code]')
  check(`${dir} 4. text that is not JSON is still sent`, sentBad === 1 && store.evaluates.at(-1)?.raw === '{"lines":[')
  check(`${dir} 4. no JSON problem is said client-side`, (await page.locator('[data-json-problem]').count()) === 0)
  check(`${dir} 4. the refusal shows its code`, (await page.locator('[data-refusal-code="PLAYGROUND_RAW_INVALID"]').count()) === 1)
  const banner = strip(await page.locator('[data-pane="outcome"] [role="alert"]').innerText())
  check(`${dir} 4. and its message, never "unexpected"`, banner.includes('The raw text is not one JSON object.') && !/unexpected/i.test(banner), banner)

  // 5. leaving Raw never overwrites the data
  await tab(page, 'json').click()
  check(`${dir} 5. back on JSON the data box is untouched`, (await dataBox(page).inputValue()) === seedData)
  await runAndWait(page, store, '[data-outcome-line="1"]')
  const sentJson = store.evaluates.at(-1)
  check(`${dir} 5. the body is { kind, data, document, asOf }`, JSON.stringify(Object.keys(sentJson ?? {})) === JSON.stringify(['kind', 'data', 'document', 'asOf']), JSON.stringify(Object.keys(sentJson ?? {})))
  check(`${dir} 5. a data experiment shows no intake report`, (await page.locator('[data-outcome-line="1"]').count()) === 1 && (await page.locator('[data-intake]').count()) === 0)
  await tab(page, 'raw').click()
  check(`${dir} 5. back on Raw its text is kept`, (await rawBox(page).inputValue()) === '{"lines":[')

  check(`${dir} 6. no raw keys`, await noRawKeys(page))
  check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
