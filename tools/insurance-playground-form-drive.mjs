// Insurance rules ▸ Playground — the Data pane's Form | JSON over one dataset (BackOffice spec 3243; oms tickets 682, 683).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, section 677):
// POST InsuranceRules/Playground/Evaluate { kind, data, document, asOf }. No new door; 🚩 no live SIS.Api (ticket 691).
//
// It verifies, in LTR and RTL:
//   1. the Data pane has Form | JSON | Raw tabs; the Form shows the seed's request, patient and line 1, every value ltr,
//      and (683) history, reference and eligibility too, so the seed holds nothing the form does not show;
//   2. add a line in the form → the JSON shows line 2 (the line shape, quantity 1), and the outcome refreshes with it;
//   3. type a quantity, ICD codes and an attribute in the form → the JSON holds a number, a list and TEXT;
//   4. edit line 1's quantity in the JSON → the form follows; a JSON key the form does not know survives a form edit;
//   5. reorder and remove lines; JSON that does not parse shows the form's problem and nothing is sent;
//   6. no raw keys and no page errors;
//   7. (683) an empty history / reference / eligibility reads "none"; add a history event and an eligibility fact in
//      the form → both in the JSON, typed; the payer section shows only for coverage, and a deductible edit is a number.
//
//   1. run the app:  npx vite --port 5382 --strictPort
//   2. node tools/insurance-playground-form-drive.mjs        (DRIVE_PORT overrides 5382)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newPlaygroundStore, playgroundStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5382}`

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

const noRawKeys = async (page) => !/insurance-(rules|playground):|\b(run|data|rule|json|outcome|trace|intake|access|form)\.\w/.test(await page.locator('main').innerText())
const dataBox = (page) => page.locator('textarea[data-json-box="data"]')
const tab = (page, k) => page.locator(`[data-pane="data"] [data-data-tab="${k}"]`)
const field = (page, path) => page.locator(`[data-data-form] input[data-form-field="${path}"]`)
const keysOf = (page, sel, attr) => page.locator(sel).evaluateAll((els, a) => els.map((e) => e.getAttribute(a)).join(), attr)
const json = async (page) => {
  await tab(page, 'json').click()
  const v = JSON.parse(await dataBox(page).inputValue())
  await tab(page, 'form').click()
  return v
}
const waitRun = async (page, store, sel) => {
  const before = store.evaluates.length
  for (let i = 0; i < 30 && store.evaluates.length === before; i++) await new Promise((r) => setTimeout(r, 100))
  await page.locator(sel).first().waitFor({ timeout: 10000 }).catch(() => {})
  await new Promise((r) => setTimeout(r, 700))
  return store.evaluates.length - before
}

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, store } = await open(dir)
  await page.goto(`${BASE}/insurance-rules/playground`)
  await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
  await page.locator('[data-outcome-line="1"]').waitFor({ timeout: 15000 }).catch(() => {})
  check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

  // 1. the form over the seed
  const order = await keysOf(page, '[data-pane="data"] [data-data-tab]', 'data-data-tab')
  check(`${dir} 1. tabs Form | JSON | Raw`, order === 'form,json,raw', order)
  await tab(page, 'form').click()
  check(`${dir} 1. Form is selected and replaces the box`, (await tab(page, 'form').getAttribute('aria-selected')) === 'true' && (await dataBox(page).count()) === 0 && (await page.locator('[data-data-form]').count()) === 1)
  const sections = await keysOf(page, '[data-form-section]', 'data-form-section')
  check(`${dir} 1. request, patient, lines, history, reference, eligibility — no payer for guard`, sections === 'request,patient,lines,history,reference,eligibility', sections)
  check(
    `${dir} 1. the seed's values`,
    (await field(page, 'request.channel').inputValue()) === 'nphies' &&
      (await field(page, 'patient.birthDate').inputValue()) === '1990-04-01' &&
      (await field(page, 'lines.0.daysSupply').inputValue()) === '120' &&
      (await field(page, 'lines.0.icd').inputValue()) === 'E11' &&
      (await field(page, 'request.policy').inputValue()) === '',
  )
  check(`${dir} 1. values are typed left to right`, (await field(page, 'lines.0.item').getAttribute('dir')) === 'ltr' && (await field(page, 'request.store').getAttribute('dir')) === 'ltr')
  check(`${dir} 1. every line field is there`, (await page.locator('[data-form-line="0"] input[data-form-field]').count()) === 10)
  check(`${dir} 1. the form shows the whole seed: no "more" note`, (await page.locator('[data-form-more]').count()) === 0)

  // 2. add a line → JSON → outcome
  await page.locator('[data-form-add-line]').click()
  const ran = await waitRun(page, store, '[data-outcome-line="2"]')
  check(`${dir} 2. a second line card shows`, (await page.locator('[data-form-line]').count()) === 2)
  check(`${dir} 2. the outcome refreshes on its own, with line 2`, ran >= 1 && (await page.locator('[data-outcome-line="2"]').count()) === 1 && store.evaluates.at(-1)?.data?.lines?.length === 2)
  let d = await json(page)
  check(
    `${dir} 2. the JSON shows line 2 in the line shape`,
    d.lines.length === 2 && d.lines[1].line === 2 && d.lines[1].quantity === 1 && Array.isArray(d.lines[1].icd) && d.lines[1].item === null && JSON.stringify(d.lines[1].attributes) === '{}',
    JSON.stringify(d.lines[1]),
  )
  check(`${dir} 2. what the form does not show is kept`, JSON.stringify(d.history) === '[]' && JSON.stringify(d.reference) === '{}')

  // 3. typed values
  await field(page, 'lines.1.item').fill('300100')
  await field(page, 'lines.1.quantity').fill('3')
  await field(page, 'lines.1.icd').fill('J45, E66')
  const attrs = page.locator('[data-form-attributes="lines.1"]')
  await attrs.locator('[data-form-add-attribute]').click()
  await attrs.locator('[data-form-attribute="0"] [data-form-attribute-key]').fill('strength')
  await attrs.locator('[data-form-attribute="0"] [data-form-attribute-value]').fill('500')
  check(`${dir} 3. ICD keeps the typed text in the form`, (await field(page, 'lines.1.icd').inputValue()) === 'J45, E66')
  d = await json(page)
  check(`${dir} 3. quantity is a number, ICD a list`, d.lines[1].quantity === 3 && JSON.stringify(d.lines[1].icd) === '["J45","E66"]' && d.lines[1].item === '300100', JSON.stringify(d.lines[1]))
  check(`${dir} 3. an attribute is text even when it looks like a number`, d.lines[1].attributes.strength === '500', JSON.stringify(d.lines[1].attributes))

  // 4. JSON → form; unknown keys survive the form
  await tab(page, 'json').click()
  const edited = JSON.parse(await dataBox(page).inputValue())
  edited.lines[0].quantity = 7
  edited.lines[0].mystery = { keep: true }
  edited.extra = 'yes'
  await dataBox(page).fill(JSON.stringify(edited, null, 2))
  await waitRun(page, store, '[data-outcome-line="1"]')
  check(`${dir} 4. the edited JSON was sent`, store.evaluates.at(-1)?.data?.lines?.[0]?.quantity === 7)
  await tab(page, 'form').click()
  check(`${dir} 4. the form follows the JSON quantity`, (await field(page, 'lines.0.quantity').inputValue()) === '7')
  const more2 = await keysOf(page, '[data-form-more-key]', 'data-form-more-key')
  check(`${dir} 4. the note names the new keys`, more2.includes('lines[0].mystery') && more2.includes('extra'), more2)
  check(`${dir} 4. those keys are ltr isolates`, (await page.locator('[data-form-more-key] bdi[dir="ltr"]').count()) === more2.split(',').length)
  await field(page, 'request.policy').fill('POL-9')
  d = await json(page)
  check(`${dir} 4. unknown keys survive a form edit`, d.request.policy === 'POL-9' && d.extra === 'yes' && d.lines[0].mystery?.keep === true && d.lines[0].quantity === 7)

  // 5. reorder, remove, broken JSON
  await page.locator('[data-form-line="1"] [data-form-line-up]').click()
  d = await json(page)
  check(`${dir} 5. move up reorders the lines`, JSON.stringify(d.lines.map((l) => l.line)) === '[2,1]')
  await page.locator('[data-form-line="0"] [data-form-line-remove]').click()
  d = await json(page)
  check(`${dir} 5. remove drops the line`, JSON.stringify(d.lines.map((l) => l.line)) === '[1]')
  await tab(page, 'json').click()
  await dataBox(page).fill('{ "lines": [')
  await new Promise((r) => setTimeout(r, 200))
  const before = store.evaluates.length
  await tab(page, 'form').click()
  await new Promise((r) => setTimeout(r, 1200))
  check(`${dir} 5. broken JSON: the form says so`, (await page.locator('[data-form-problem="invalid"]').count()) === 1 && (await page.locator('[data-data-form]').count()) === 0)
  check(`${dir} 5. and nothing is sent`, store.evaluates.length === before)
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-form.png`, fullPage: true }).catch(() => {})

  // 7. (683) history, eligibility, "none", the payer for coverage only — from a fresh seed
  await tab(page, 'json').click()
  await dataBox(page).fill(JSON.stringify({ request: { channel: 'nphies', attributes: {} }, lines: [{ line: 1, item: '200021', quantity: 1, attributes: {} }], history: [], reference: {}, eligibility: {} }, null, 2))
  await tab(page, 'form').click()
  const nones = await keysOf(page, '[data-form-none]', 'data-form-none')
  check(`${dir} 7. empty history, reference and eligibility read "none"`, nones === 'history,reference,eligibility', nones)
  check(`${dir} 7. "none" is words, not a blank`, ((await page.locator('[data-form-none="history"]').innerText()) || '').trim().length > 3)
  await page.locator('[data-form-add-event]').click()
  check(`${dir} 7. an event card replaces "none"`, (await page.locator('[data-form-event]').count()) === 1 && (await page.locator('[data-form-none="history"]').count()) === 0)
  await field(page, 'history.0.on').fill('2026-10-20')
  await field(page, 'history.0.item').fill('200021')
  await field(page, 'history.0.daysSupply').fill('30')
  check(`${dir} 7. history values are ltr`, (await field(page, 'history.0.on').getAttribute('dir')) === 'ltr')
  await page.locator('[data-form-add-fact]').click()
  const fact = page.locator('[data-form-fact="0"]')
  await fact.locator('[data-form-fact-key]').fill('benefit[66].approvalLimit')
  await fact.locator('[data-form-fact-value]').fill('10000')
  await fact.locator('[data-form-fact-unit]').fill('SAR')
  await page.locator('[data-form-add-fact]').click()
  const flag = page.locator('[data-form-fact="1"]')
  await flag.locator('[data-form-fact-key]').fill('member.active')
  await flag.locator('[data-form-fact-type]').selectOption('flag')
  await flag.locator('[data-form-fact-value]').fill('true')
  const ran7 = await waitRun(page, store, '[data-outcome-line="1"]')
  d = await json(page)
  check(
    `${dir} 7. the history event is in the JSON, in the event shape`,
    d.history.length === 1 && d.history[0].on === '2026-10-20' && d.history[0].item === '200021' && d.history[0].daysSupply === 30 && d.history[0].quantity === 1 && 'store' in d.history[0] && 'payer' in d.history[0],
    JSON.stringify(d.history),
  )
  check(
    `${dir} 7. the facts are in the JSON in the engine shape, typed`,
    JSON.stringify(d.eligibility) === JSON.stringify({ 'benefit[66].approvalLimit': { type: 'number', number: 10000, unit: 'SAR' }, 'member.active': { type: 'flag', flag: true } }),
    JSON.stringify(d.eligibility),
  )
  check(`${dir} 7. reference stays an empty object`, JSON.stringify(d.reference) === '{}')
  check(`${dir} 7. and the run sent them`, ran7 >= 1 && store.evaluates.at(-1)?.data?.eligibility?.['member.active']?.flag === true && store.evaluates.at(-1)?.data?.history?.length === 1)
  check(`${dir} 7. no payer section for guard`, (await page.locator('[data-form-section="payer"]').count()) === 0)
  await page.locator('[data-kind="coverage"]').click()
  await tab(page, 'form').click()
  await page.locator('[data-form-section="payer"]').waitFor({ timeout: 5000 }).catch(() => {})
  check(`${dir} 7. coverage: the payer section shows, G1 G2 G3`, (await keysOf(page, '[data-form-deductible]', 'data-form-deductible')) === 'G1,G2,G3')
  check(`${dir} 7. coverage: the seeded payer's values`, (await page.locator('[data-form-deductible="G1"] [data-form-deductible-percent]').inputValue()) === '20')
  check(`${dir} 7. coverage: payer is not in the "more" note`, !(await keysOf(page, '[data-form-more-key]', 'data-form-more-key')).split(',').includes('payer'))
  await page.locator('[data-form-deductible="G3"] [data-form-deductible-percent]').fill('15')
  d = await json(page)
  check(`${dir} 7. coverage: a deductible edit is a number in the payer`, d.payer?.deductibles?.G3?.percent === 15 && d.payer.deductibles.G1.percent === 20, JSON.stringify(d.payer))
  await page.locator('[data-kind="guard"]').click()
  await tab(page, 'form').click()
  check(`${dir} 7. back to guard: no payer section`, (await page.locator('[data-form-section="payer"]').count()) === 0)
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-form-683.png`, fullPage: true }).catch(() => {})

  check(`${dir} 6. no raw keys`, await noRawKeys(page))
  check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
