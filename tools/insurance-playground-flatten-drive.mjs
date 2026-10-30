// Insurance rules ▸ Playground — the Data pane's Flatten panel (BackOffice spec 3243, door 3247; oms ticket 685).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, sections
// 677 + 685): POST InsuranceRules/Playground/Flatten { source, response, memberId, policy } → { facts }.
// Shapes as the brief's CONTRACT draws them; 🚩 nothing here is driven against a live SIS.Api (ticket 691).
//
// It verifies, in LTR and RTL:
//   1. the panel shows under Form and JSON (hidden on Raw), nphies picked;
//   2. an answer that is not JSON is said in words and never sent;
//   3. a stubbed nphies answer + member id → the body is { source, response, memberId, policy }, the facts show as rows,
//      keys and values ltr isolates, benefit[66].approvalLimit = 10000 SAR;
//   4. "Use these facts" REPLACES a prior fact: benefit[66].approvalLimit = 10000 SAR in the form and the JSON, the
//      old fact gone, and the outcome refreshes (the next Evaluate carries the facts);
//   5. an edit after Use is kept across a tab switch and a later Flatten; only another Use replaces it again;
//   6. an nphies refusal shows its message and code; no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5385 --strictPort
//   2. node tools/insurance-playground-flatten-drive.mjs        (DRIVE_PORT overrides 5385)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newPlaygroundStore, NPHIES_ANSWER, playgroundStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5385}`

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
const noRawKeys = async (page) => !/insurance-(rules|playground):|\b(run|data|rule|json|outcome|trace|intake|access|flatten)\.\w/.test(await page.locator('main').innerText())
const dataBox = (page) => page.locator('textarea[data-json-box="data"]')
const tab = (page, k) => page.locator(`[data-pane="data"] [data-data-tab="${k}"]`)
const panel = (page) => page.locator('[data-flatten]')
const waitFor = async (cond, ms = 5000) => {
  for (let i = 0; i < ms / 100 && !(await cond()); i++) await new Promise((r) => setTimeout(r, 100))
  return cond()
}
const dataJson = async (page) => {
  await tab(page, 'json').click()
  const v = JSON.parse(await dataBox(page).inputValue())
  return v
}
const formFacts = (page) =>
  page.locator('[data-form-fact]').evaluateAll((rows) =>
    rows.map((r) => [r.querySelector('[data-form-fact-key]')?.value, r.querySelector('[data-form-fact-value]')?.value, r.querySelector('[data-form-fact-unit]')?.value]),
  )

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, store } = await open(dir)
  await page.goto(`${BASE}/insurance-rules/playground`)
  await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
  check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  await page.locator('[data-outcome-line]').first().waitFor({ timeout: 10000 }).catch(() => {})

  // a prior fact the payer's answer must replace
  const seed = JSON.parse(await dataBox(page).inputValue())
  await dataBox(page).fill(JSON.stringify({ ...seed, eligibility: { 'old.fact': { type: 'number', number: 5 } } }, null, 2))

  // 1. the panel
  check(`${dir} 1. the panel shows under JSON`, await panel(page).isVisible())
  await tab(page, 'form').click()
  check(`${dir} 1. and under Form`, await panel(page).isVisible())
  await tab(page, 'raw').click()
  check(`${dir} 1. hidden on Raw`, !(await panel(page).isVisible()))
  await tab(page, 'form').click()
  check(`${dir} 1. nphies is picked`, (await page.locator('[data-flatten-source="nphies"]').count()) === 1 && (await page.locator('[data-flatten-source-pick="nphies"]').getAttribute('aria-pressed')) === 'true')
  check(`${dir} 1. the answer box is ltr`, (await page.locator('[data-flatten-response]').getAttribute('dir')) === 'ltr')

  // 2. not JSON: said, never sent
  await page.locator('[data-flatten-response]').fill('{"resourceType":')
  await page.locator('[data-flatten-run]').click()
  check(`${dir} 2. an answer that is not JSON is said in words`, (await page.locator('[data-flatten-problem="invalid"]').count()) === 1 && strip(await page.locator('[data-flatten-problem]').innerText()).length > 10)
  await new Promise((r) => setTimeout(r, 400))
  check(`${dir} 2. and never sent`, store.flattens.length === 0)

  // 3. a stubbed nphies answer
  await page.locator('[data-flatten-response]').fill(JSON.stringify(NPHIES_ANSWER, null, 2))
  check(`${dir} 3. typing clears the problem`, (await page.locator('[data-flatten-problem]').count()) === 0)
  await page.locator('[data-flatten-member]').fill('1023')
  await page.locator('[data-flatten-run]').click()
  await page.locator('[data-flatten-facts]').waitFor({ timeout: 10000 }).catch(() => {})
  const sent = store.flattens.at(-1)
  check(`${dir} 3. the body is { source, response, memberId, policy }`, JSON.stringify(Object.keys(sent ?? {})) === JSON.stringify(['source', 'response', 'memberId', 'policy']), JSON.stringify(sent))
  check(`${dir} 3. nphies, the answer parsed, the member id, no policy`, sent?.source === 'nphies' && sent?.response?.resourceType === 'Bundle' && sent?.memberId === '1023' && sent?.policy === null)
  check(`${dir} 3. five fact rows`, (await page.locator('[data-flatten-fact]').count()) === 5)
  const limit = page.locator('[data-flatten-fact="benefit[66].approvalLimit"]')
  check(`${dir} 3. benefit[66].approvalLimit = 10000 SAR`, strip(await limit.locator('[data-flatten-fact-value]').innerText()) === '10000 SAR', strip(await limit.innerText().catch(() => '')))
  check(`${dir} 3. key and value are ltr isolates`, (await limit.locator('[data-flatten-fact-key] bdi[dir="ltr"]').count()) === 1 && (await limit.locator('[data-flatten-fact-value] bdi[dir="ltr"]').count()) === 1)
  check(`${dir} 3. the type in words`, (await limit.locator('[data-flatten-fact-type="number"]').innerText()).trim().length > 0)
  check(`${dir} 3. Flatten alone changes no fact`, JSON.stringify((await formFacts(page)).map((f) => f[0])) === JSON.stringify(['old.fact']))
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-flatten.png`, fullPage: true }).catch(() => {})

  // 4. Use these facts
  const before = store.evaluates.length
  await page.locator('[data-flatten-use]').click()
  check(`${dir} 4. "used" is said`, (await page.locator('[data-flatten-used="used"]').count()) === 1)
  const facts = await formFacts(page)
  check(`${dir} 4. the form: benefit[66].approvalLimit 10000 SAR, the old fact gone`, JSON.stringify(facts[0]) === JSON.stringify(['benefit[66].approvalLimit', '10000', 'SAR']) && !facts.some((f) => f[0] === 'old.fact') && facts.length === 5, JSON.stringify(facts))
  check(`${dir} 4. the outcome refreshes with the facts`, await waitFor(() => store.evaluates.length > before && store.evaluates.at(-1)?.data?.eligibility?.['benefit[66].approvalLimit']?.number === 10000))
  let d = await dataJson(page)
  check(`${dir} 4. the JSON: the engine shape`, JSON.stringify(d.eligibility['benefit[66].approvalLimit']) === JSON.stringify({ type: 'number', number: 10000, unit: 'SAR' }) && d.eligibility['old.fact'] === undefined && d.eligibility['member.active']?.flag === true, JSON.stringify(d.eligibility))
  check(`${dir} 4. the rest of the data as it was`, JSON.stringify(d.lines) === JSON.stringify(seed.lines) && JSON.stringify(d.request) === JSON.stringify(seed.request))

  // 5. an edit after Use is kept
  await tab(page, 'form').click()
  await page.locator('[data-form-fact="0"] [data-form-fact-value]').fill('12000')
  await tab(page, 'json').click()
  await tab(page, 'form').click()
  check(`${dir} 5. the edit survives a tab switch`, (await page.locator('[data-form-fact="0"] [data-form-fact-value]').inputValue()) === '12000')
  await page.locator('[data-flatten-run]').click()
  await waitFor(async () => store.flattens.length === 2)
  await page.locator('[data-flatten-facts]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 5. a later Flatten replaces nothing until Use`, (await page.locator('[data-form-fact="0"] [data-form-fact-value]').inputValue()) === '12000' && (await page.locator('[data-flatten-used]').count()) === 0)
  d = await dataJson(page)
  check(`${dir} 5. the JSON keeps 12000`, d.eligibility['benefit[66].approvalLimit']?.number === 12000)
  await page.locator('[data-flatten-use]').click()
  d = JSON.parse(await dataBox(page).inputValue())
  check(`${dir} 5. another Use replaces it again`, d.eligibility['benefit[66].approvalLimit']?.number === 10000)

  // 6. a refusal
  await page.locator('[data-flatten-response]').fill('{"resourceType":"Patient"}')
  await page.locator('[data-flatten-run]').click()
  await page.locator('[data-flatten-refusal]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 6. the refusal shows its code`, (await page.locator('[data-flatten-refusal="PLAYGROUND_FLATTEN_UNREADABLE"]').count()) === 1)
  const banner = strip(await page.locator('[data-flatten] [role="alert"]').first().innerText().catch(() => ''))
  check(`${dir} 6. and its message, never "unexpected"`, banner.includes('The nphies answer is not a FHIR bundle.') && !/unexpected/i.test(banner), banner)
  check(`${dir} 6. bupa can be picked`, await (async () => {
    await page.locator('[data-flatten-source-pick="bupa"]').click()
    return (await page.locator('[data-flatten-source="bupa"]').count()) === 1
  })())

  check(`${dir} 6. no raw keys`, await noRawKeys(page))
  check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
