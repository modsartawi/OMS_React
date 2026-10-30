// Insurance rules ▸ Playground — Lessons and Check (BackOffice spec 3243 stories 45-47; oms ticket 689).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, sections
// 677 + 678 + 684 + 689): POST InsuranceRules/Playground/Evaluate → playgroundLessonsStub. Shapes as the BRIEF draws
// them; 🚩 nothing here is driven against a live SIS.Api (ticket 691 re-runs every lesson's Check there).
//
// It verifies, in LTR and RTL:
//   1. the Lessons picker lists the nine lessons; Load is refused in words until one is picked;
//   2. every lesson loads as the current experiment (its kind, its data or Raw text), shows its title and
//      explanation, and Check against the stub's answer says met;
//   3. lesson 1, then the data changed so it fails (line 1 given 120 days): Check names the differences — the
//      matched lines and line 1's trace value — and the old result is gone once a newer answer arrives;
//   4. Check waits while the edited experiment has no answer yet;
//   5. switching the kind unloads the lesson;
//   6. the explanation's machine values are ltr isolates; no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5389 --strictPort
//   2. node tools/insurance-playground-lessons-drive.mjs        (DRIVE_PORT overrides 5389)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newPlaygroundStore, playgroundLessonsStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5389}`

/** The nine lessons, their kind and whether they are Raw (the module's own order). */
const LESSONS = [
  ['unknownVsFalse', 'guard'],
  ['groups', 'guard'],
  ['quantityCap', 'coverage'],
  ['categoryOrder', 'category'],
  ['historyWindow', 'guard'],
  ['benefit66', 'guard'],
  ['otherPayer', 'guard'],
  ['crossLine', 'guard'],
  ['rawNearMiss', 'guard', 'raw'],
]

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
    const hit = playgroundLessonsStub(req.method(), p, body, { store }) ?? insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|playground):|\b(lessons|run|data|rule|json|outcome|trace|intake|access)\.\w/.test(await page.locator('main').innerText())
const dataBox = (page) => page.locator('textarea[data-json-box="data"]')
const checkBtn = (page) => page.locator('[data-lesson-check]')
/** The experiment runs itself ~500 ms after an edit; wait for that request, then for Check to be ready. */
const runAndWait = async (page, store) => {
  const before = store.evaluates.length
  for (let i = 0; i < 40 && store.evaluates.length === before; i++) await new Promise((r) => setTimeout(r, 100))
  for (let i = 0; i < 50 && (await checkBtn(page).getAttribute('aria-disabled')) === 'true'; i++) await new Promise((r) => setTimeout(r, 100))
  return store.evaluates.length - before
}
const loadLesson = async (page, store, id) => {
  await page.locator('[data-lesson-picker]').selectOption(id)
  await page.locator('[data-lesson-load]').click()
  await page.locator(`[data-lesson-loaded="${id}"]`).waitFor({ timeout: 5000 }).catch(() => {})
  return runAndWait(page, store)
}

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, store } = await open(dir)
  await page.goto(`${BASE}/insurance-rules/playground`)
  await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
  check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

  // 1. the picker
  const values = await page.locator('[data-lesson-picker] option').evaluateAll((os) => os.map((o) => o.value))
  check(`${dir} 1. the picker lists the nine lessons after its placeholder`, JSON.stringify(values) === JSON.stringify(['', ...LESSONS.map(([id]) => id)]), JSON.stringify(values))
  check(`${dir} 1. Load says why until a lesson is picked`, (await page.locator('[data-lesson-load]').getAttribute('aria-disabled')) === 'true' && !!(await page.locator('[data-lesson-load]').getAttribute('title')))
  check(`${dir} 1. no lesson is loaded yet, so no Check`, (await page.locator('[data-lesson-loaded]').count()) === 0 && (await checkBtn(page).count()) === 0)

  // 2. every lesson loads and meets its assertion against the stub
  for (const [id, kind, raw] of LESSONS) {
    const sent = await loadLesson(page, store, id)
    const body = store.evaluates.at(-1)
    check(`${dir} 2. ${id}: loads and runs`, sent >= 1 && (await page.locator(`[data-lesson-loaded="${id}"]`).count()) === 1)
    check(`${dir} 2. ${id}: the experiment is the lesson's (${kind}${raw ? ', Raw' : ''})`, body?.kind === kind && (await page.locator(`[data-kind-picker="${kind}"]`).count()) === 1 && (raw ? typeof body?.raw === 'string' && body.data === undefined : typeof body?.data === 'object' && body.raw === undefined), JSON.stringify(Object.keys(body ?? {})))
    const explain = strip(await page.locator('[data-lesson-explain]').innerText())
    check(`${dir} 2. ${id}: the explanation shows`, explain.length > 80, explain)
    await checkBtn(page).click()
    const met = page.locator('[data-lesson-result="met"]')
    await met.waitFor({ timeout: 3000 }).catch(() => {})
    const diffs = await page.locator('[data-lesson-difference]').allInnerTexts()
    check(`${dir} 2. ${id}: Check says met`, (await met.count()) === 1, diffs.map(strip).join(' | '))
  }
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-lesson-met.png`, fullPage: true }).catch(() => {})

  // 2b (3243 review). lesson 7 contrasts two payers: it opens Compare on its B side, where the same code passes
  await loadLesson(page, store, 'otherPayer')
  await page.locator('[data-compare-line="1"]').waitFor({ timeout: 5000 }).catch(() => {})
  const bData = JSON.parse((await page.locator('#playground-b-data').inputValue().catch(() => '{}')) || '{}')
  check(`${dir} 2b. otherPayer: Compare is on`, (await page.locator('[data-compare-toggle="on"]').count()) === 1 && (await page.locator('[data-compare]').count()) === 1)
  check(`${dir} 2b. otherPayer: B is the same request at payer 0001100041, limit 10,000`, bData.request?.payer === '0001100041' && bData.eligibility?.['benefit[66].approvalLimit']?.number === 10000, JSON.stringify(bData.request))
  check(`${dir} 2b. otherPayer: A warns and B does not, so line 1 differs`, (await page.locator('[data-compare-diff="differs"]').count()) === 1 && (await page.locator('[data-compare-line="1"][data-diff="differs"]').count()) === 1)
  await loadLesson(page, store, 'crossLine')
  check(`${dir} 2b. a lesson with no B side closes Compare`, (await page.locator('[data-compare]').count()) === 0)

  // 3. lesson 1 met, then changed so it fails
  await loadLesson(page, store, 'unknownVsFalse')
  await checkBtn(page).click()
  check(`${dir} 3. lesson 1 is met as loaded`, (await page.locator('[data-lesson-result="met"]').count()) === 1)
  const data = JSON.parse(await dataBox(page).inputValue())
  data.lines[0].daysSupply = 120
  await dataBox(page).fill(JSON.stringify(data, null, 2))
  // 4. no answer to the edited experiment yet: the old result is gone and Check waits
  check(`${dir} 4. after the edit the old result is gone and Check waits`, (await page.locator('[data-lesson-result]').count()) === 0 && (await checkBtn(page).getAttribute('aria-disabled')) === 'true')
  await runAndWait(page, store)
  check(`${dir} 3. the edited lesson is still loaded`, (await page.locator('[data-lesson-loaded="unknownVsFalse"]').count()) === 1)
  await checkBtn(page).click()
  await page.locator('[data-lesson-result="notMet"]').waitFor({ timeout: 3000 }).catch(() => {})
  check(`${dir} 3. Check says not met`, (await page.locator('[data-lesson-result="notMet"]').count()) === 1)
  const kinds = await page.locator('[data-lesson-difference]').evaluateAll((ls) => ls.map((l) => l.getAttribute('data-lesson-difference')))
  check(`${dir} 3. it names the matched lines and line 1's trace, nothing else`, JSON.stringify(kinds) === JSON.stringify(['matched', 'trace']), JSON.stringify(kinds))
  // The app's RTL pass serves the English copy under dir="rtl" (as every playground drive does), so the words are English.
  const texts = (await page.locator('[data-lesson-difference]').allInnerTexts()).map((s) => strip(s).toLowerCase())
  const words = { nothing: 'nothing matched', unknown: 'expected unknown', true: 'has true' }
  check(`${dir} 3. matched: expected nothing, the answer has line 1`, texts[0]?.includes(words.nothing) && /\b1\b/.test(texts[0] ?? ''), texts[0])
  check(`${dir} 3. trace: line 1, G-1, when[0], expected unknown, the answer has true`, ['g-1', 'when[0]', words.unknown, words.true].every((w) => texts[1]?.includes(w)), texts[1])
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-lesson-not-met.png`, fullPage: true }).catch(() => {})

  // 5. a kind switch replaces the experiment, so the lesson unloads
  await page.locator('[data-kind-picker] [data-kind="coverage"]').click()
  check(`${dir} 5. switching the kind unloads the lesson`, (await page.locator('[data-lesson-loaded]').count()) === 0)

  // 6. bidi, keys, errors
  await loadLesson(page, store, 'benefit66')
  check(`${dir} 6. the explanation's field names are ltr isolates`, (await page.locator('[data-lesson-explain] bdi[dir="ltr"]').count()) === 5)
  check(`${dir} 6. no raw keys`, await noRawKeys(page))
  check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
