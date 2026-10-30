// Insurance rules ▸ "Open in playground" drive (BackOffice spec 3243 stories 30, 31; oms ticket 688).
//
// No new door: the guard draft, the category / coverage drafts and Evaluate are stubbed (`tools/insurance-rules-stubs.mjs`,
// sections 608, 617, 677). It verifies, in LTR and RTL:
//   1. the guard rule page: Open in playground → the playground on `?open=copy`, said to be a copy of the rule, the guard
//      kind, ONE rule in the editors (G-004), and the auto-run sends it; G-003's copy carries exactly the list it names;
//   2. edit the copy in the editors → the JSON follows and it runs; a reload keeps the copy;
//   3. back on the guard rule page: the rule is unchanged, nothing was saved (no PUT);
//   4. the playground opened from the menu (no copy link) is the plain seed, not the old copy;
//   5. coverage: a saved rule on an in-list condition opens as a coverage copy with exactly that list and the payer
//      block; editing the copy's JSON leaves the Coverage page's rule and draft alone (no write);
//   6. categories: the selected rule opens as a category copy; a new, unsaved rule's button is off;
//   7. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5388 --strictPort
//   2. node tools/insurance-playground-open-drive.mjs        (DRIVE_PORT overrides 5388)
import { createRequire } from 'node:module'
import { coverageStub, envelope, guardEditorStub, insuranceRulesStub, newCoverageState, newGuardStore, newPlaygroundStore, playgroundStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5388}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()
const says = (en, ar) => ({ en, ar })

/** 617's coverage state with C-002 on an item-list block, and two lists in the document (only one named). */
function coverageState() {
  const state = newCoverageState()
  state.coverage.lists = [
    { id: 'cosmetics', name: says('Cosmetics', 'مستحضرات التجميل'), filters: [{ articles: ['200021'], categories: [], attributes: [] }], include: [], exclude: [] },
    { id: 'vitamins', name: says('Vitamins', 'الفيتامينات'), filters: [{ articles: ['300001'], categories: [], attributes: [] }], include: [], exclude: [] },
  ]
  state.coverage.rules[0].when = [{ check: 'line', inList: 'cosmetics' }]
  return state
}

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newPlaygroundStore()
  const guards = newGuardStore()
  const state = coverageState()
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
      playgroundStub(req.method(), p, body, { store }) ??
      guardEditorStub(req.method(), p, body, { store: guards }) ??
      coverageStub(req.method(), p, body, { state, query: url.searchParams }) ??
      insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit).catch(() => {})
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store, guards, state }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const noRawKeys = async (page) => !/insurance-(rules|playground|guards|coverage):|\b(run|rule|json|outcome|trace|access|copied|ruleset)\.[a-z]\w/.test(await page.locator('main').innerText())
const box = (page, b) => page.locator(`textarea[data-json-box="${b}"]`)
const docText = async (page) => JSON.parse(await box(page, 'document').inputValue())
const dataText = async (page) => JSON.parse(await box(page, 'data').inputValue())
const waitRun = async (store, before) => {
  for (let i = 0; i < 40 && store.evaluates.length === before; i++) await sleep(100)
  return store.evaluates.length - before
}
const lastSent = (store) => store.evaluates[store.evaluates.length - 1]

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, store, guards, state } = await open(dir)

  // ── 1: the guard rule page → a copy in the playground ─────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/G-004`)
  await page.locator('[data-open-playground="guard"]').waitFor({ timeout: 60000 })
  const guardBefore = await page.locator('main').innerText()
  let before = store.evaluates.length
  await page.locator('[data-open-playground="guard"]').click()
  await page.locator('[data-copied-from="G-004"]').waitFor({ timeout: 30000 })
  check(`${dir} 1. the playground opens on a copy link`, new URL(page.url()).pathname === '/insurance-rules/playground' && new URL(page.url()).search === '?open=copy', page.url())
  check(`${dir} 1. it says it is a copy of G-004`, (await page.locator('[data-copied-from="G-004"][data-copied-kind="guard"]').count()) === 1)
  check(`${dir} 1. the guard kind is picked`, (await page.locator('[data-kind-picker="guard"]').count()) === 1)
  let doc = await docText(page)
  check(`${dir} 1. a one-rule guard document, revision 0`, doc.kind === 'guard' && doc.revision === 0 && doc.rules.length === 1 && doc.rules[0].id === 'G-004', JSON.stringify(doc).slice(0, 200))
  check(`${dir} 1. G-004 names no list: none carried`, Array.isArray(doc.lists) && doc.lists.length === 0, JSON.stringify(doc.lists))
  check(`${dir} 1. the rule is in the editors`, (await page.locator('[data-rule-slot]').count()) === 1 && (await page.locator('[data-rule-slot="0"]').getAttribute('data-slot-rule-id')) === 'G-004' && (await page.locator('[data-rule-slot="0"]').getAttribute('data-editable')) === 'true')
  check(`${dir} 1. its line block shows 90`, (await page.locator('[data-rule-slot="0"] [data-block="0"] [data-input="lineValue"]').inputValue()) === '90')
  check(`${dir} 1. example data seeded`, ((await dataText(page)).lines ?? []).length === 1)
  check(`${dir} 1. the auto-run sends the copy`, (await waitRun(store, before)) >= 1 && lastSent(store)?.document?.rules?.[0]?.id === 'G-004')

  // ── 2: edit the copy; a reload keeps it ─────────────────────────────────────────────────────────
  before = store.evaluates.length
  await page.locator('[data-rule-slot="0"] [data-block="0"] [data-input="lineValue"]').fill('30')
  await waitRun(store, before)
  await sleep(600)
  doc = await docText(page)
  check(`${dir} 2. the editor edit is in the JSON`, doc.rules[0].when[0].above === 30, JSON.stringify(doc.rules[0].when))
  check(`${dir} 2. and it runs`, lastSent(store)?.document?.rules?.[0]?.when?.[0]?.above === 30)
  await page.reload()
  await page.locator('[data-copied-from="G-004"]').waitFor({ timeout: 30000 }).catch(() => {})
  check(`${dir} 2. a reload keeps the copy`, (await page.locator('[data-copied-from="G-004"]').count()) === 1 && (await docText(page)).rules[0].id === 'G-004')

  // ── 3: the source rule is unchanged ─────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/G-004`)
  await page.locator('[data-open-playground="guard"]').waitFor({ timeout: 30000 })
  await sleep(300)
  check(`${dir} 3. the guard rule page reads as before`, (await page.locator('main').innerText()) === guardBefore)
  check(`${dir} 3. nothing was saved to the guard draft`, guards.puts.length === 0 && guards.draft.rules.find((r) => r.id === 'G-004').when[0].above === 90)

  // G-003 names list `glp1` (through its filter alias): the copy carries exactly that list
  await page.goto(`${BASE}/insurance-rules/guards/G-003`)
  await page.locator('[data-open-playground="guard"]').click()
  await page.locator('[data-copied-from="G-003"]').waitFor({ timeout: 30000 })
  doc = await docText(page)
  check(`${dir} 3. G-003's copy carries exactly list glp1`, JSON.stringify(doc.lists.map((l) => l.id)) === '["glp1"]' && doc.rules[0].when[0].match === 'list:glp1', JSON.stringify([doc.lists.map((l) => l.id), doc.rules[0].when]))

  // ── 4: from the menu, the playground is the plain seed ─────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/playground`)
  await page.locator('[data-playground-page]').waitFor({ timeout: 30000 })
  await sleep(500)
  check(`${dir} 4. no copy link: the plain seed, not the old copy`, (await page.locator('[data-copied-from]').count()) === 0 && (await docText(page)).rules[0].id === 'G-1')

  // ── 5: coverage ─────────────────────────────────────────────────────────────────────────────────
  const coverageBefore = JSON.stringify(state.coverage)
  await page.goto(`${BASE}/insurance-rules/coverage?rule=C-002`)
  await page.locator('[data-rule-editor="C-002"] [data-open-playground="coverage"]').waitFor({ timeout: 30000 })
  await page.locator('[data-rule-editor="C-002"] [data-open-playground="coverage"]').click()
  await page.locator('[data-copied-from="C-002"]').waitFor({ timeout: 30000 })
  doc = await docText(page)
  check(`${dir} 5. a coverage copy: kind, one rule, exactly list cosmetics`, (await page.locator('[data-kind-picker="coverage"]').count()) === 1 && doc.kind === 'coverage' && doc.rules.length === 1 && JSON.stringify(doc.lists.map((l) => l.id)) === '["cosmetics"]', JSON.stringify(doc).slice(0, 300))
  check(`${dir} 5. the data carries the payer block`, (await dataText(page)).payer !== undefined)
  check(`${dir} 5. the rule is in the coverage editors`, (await page.locator('[data-rule-slot="0"][data-slot-rule-id="C-002"][data-editable="true"] [data-rule-kind="coverage"]').count()) === 1)
  before = store.evaluates.length
  const edited = structuredClone(doc)
  edited.rules[0].then = [{ effect: 'covered', value: true }]
  await box(page, 'document').fill(JSON.stringify(edited, null, 2))
  await waitRun(store, before)
  check(`${dir} 5. the edited copy runs`, lastSent(store)?.document?.rules?.[0]?.then?.[0]?.value === true && lastSent(store)?.kind === 'coverage')
  await page.goto(`${BASE}/insurance-rules/coverage?rule=C-002`)
  await page.locator('[data-rule-editor="C-002"]').waitFor({ timeout: 30000 })
  check(`${dir} 5. the Coverage draft is unchanged, nothing saved`, JSON.stringify(state.coverage) === coverageBefore && !state.writes.some((w) => w.door.startsWith('save')), JSON.stringify(state.writes.map((w) => w.door)) + (JSON.stringify(state.coverage) === coverageBefore ? '' : ' doc changed'))
  check(`${dir} 5. the page has no unsaved edit`, (await page.locator('[data-unsaved]').count()) === 0)

  // ── 6: categories; an unsaved rule's button is off ────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/categories?rule=K-002`)
  await page.locator('[data-rule-editor="K-002"] [data-open-playground="category"]').click()
  await page.locator('[data-copied-from="K-002"]').waitFor({ timeout: 30000 })
  doc = await docText(page)
  check(`${dir} 6. a category copy`, (await page.locator('[data-kind-picker="category"]').count()) === 1 && doc.kind === 'category' && doc.rules[0].id === 'K-002')
  await page.goto(`${BASE}/insurance-rules/categories`)
  await page.locator('[data-new-rule]').click()
  const off = page.locator('[data-rule-editor]:not([data-rule-editor="K-002"]) [data-open-playground]')
  await off.waitFor({ timeout: 30000 })
  check(`${dir} 6. a new, unsaved rule cannot be opened, and says why`, (await off.getAttribute('data-open-playground')) === 'off' && (await off.isDisabled()) && ((await off.getAttribute('title')) ?? '').length > 0, JSON.stringify([await off.getAttribute('data-open-playground'), await off.isDisabled(), await off.getAttribute('title'), await page.locator('[data-rule-editor]').getAttribute('data-rule-editor')]))

  // ── 7 ─────────────────────────────────────────────────────────────────────────────────────────────
  check(`${dir} 7. no raw keys`, await noRawKeys(page))
  check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
