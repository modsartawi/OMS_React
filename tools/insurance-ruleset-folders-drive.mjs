// The category and coverage rule lists grouped by folder, in the order HQ runs them (oms ticket 675; BackOffice spec 3126).
//
// Drives the REAL app in Chromium against 617's stubs (`tools/insurance-rules-stubs.mjs`), the coverage draft set to the
// seeded 059 + 060 document (`tools/insurance-coverage-seeded.json`: Segments 1–3, Prescriptions 4, Item master 5–15).
// 🚩 NOTHING here is driven against a live SIS.Api; the ticket's walk does that.
//
// It verifies, in LTR and RTL:
//   1. the list reads three folder headings with their positions and counts, the rows keep their global positions,
//      and the "first match wins" note sits above the list;
//   2. a heading collapses its rules (the heading stays, with its count and positions); the open rule's run stays open;
//   3. moving C-EXCEPTION up splits Segments: Segments 1–2, Prescriptions 3, Segments 4 (continued);
//   4. the folder filter shows Segments' rules with their real positions (1, 2, 4) and turns the arrows off;
//   5. the folder box offers the document's other folders; picking one leaves the rule where it is;
//   6. Save sends the moved order and the one folder change, every other rule byte for byte;
//   7. the Categories page groups its rules the same way;
//   8. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5210 --strictPort
//   2. node tools/insurance-ruleset-folders-drive.mjs        (DRIVE_PORT overrides 5210)
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

async function open(dir, setup) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const state = newCoverageState()
  setup(state)
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
const noRawKeys = async (page) => !/insurance-(rules|coverage|guards):|\b(ruleset|folders|settings|conditions|effect|payerMark|problem|reads|checks|sentence)\.[a-z]/.test(await page.locator('main').innerText())
/** Each folder run on screen: `folder[+] first-last`, `+` when it continues a split folder. */
const runsOf = (page) =>
  page.locator('[data-folder-run]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-folder-run') || '-'}${e.getAttribute('data-continued') === 'true' ? '+' : ''} ${e.getAttribute('data-positions')}`))
/** The rule rows on screen: `position:id`. */
const rowsOf = (page) => page.locator('[data-rule-row]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-position')}:${e.getAttribute('data-rule-row')}`))
/** What the drive expects: runs cut where the folder changes, in document order (the list may move nothing). */
function expectedRuns(rules) {
  const out = []
  const seen = new Set()
  rules.forEach((r, i) => {
    const f = (r.folder ?? '').trim()
    const last = out.at(-1)
    if (last && last.f === f) last.to = i + 1
    else out.push({ f, cont: seen.has(f), from: i + 1, to: i + 1 })
    seen.add(f)
  })
  return out.map((x) => `${x.f || '-'}${x.cont ? '+' : ''} ${x.from}-${x.to}`)
}

for (const dir of ['ltr', 'rtl']) {
  // ── 1–6: the seeded coverage document ──────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir, (s) => (s.coverage = copy(SEEDED)))
    await page.goto(`${BASE}/insurance-rules/coverage`)
    await page.locator('[data-rule-row="A01-NO-CONTRACT"]').waitFor({ timeout: 60000 })

    // 1.
    check(`${dir} 1. three folder headings, in order`, JSON.stringify(await runsOf(page)) === JSON.stringify(['Segments 1-3', 'Prescriptions 4-4', 'Item master 5-15']), JSON.stringify(await runsOf(page)))
    check(`${dir} 1. the rows keep their positions in the whole ruleset`, JSON.stringify(await rowsOf(page)) === JSON.stringify(SEEDED.rules.map((r, i) => `${i + 1}:${r.id}`)))
    const im = page.locator('[data-folder-run="Item master"]')
    const summary = strip(await im.locator('[data-folder-summary]').innerText())
    check(`${dir} 1. a heading says its positions and count`, /^(Positions|المواضع) 5–15 · (Rules|القواعد): 11$/.test(summary), summary)
    check(`${dir} 1. a one-rule run says one position`, /^(Positions|المواضع) 4 · (Rules|القواعد): 1$/.test(strip(await page.locator('[data-folder-run="Prescriptions"] [data-folder-summary]').innerText())))
    const noteFirst = await page.evaluate(() => {
      const note = document.querySelector('[data-ruleset-order]')
      const list = document.querySelector('[data-rule-list]')
      return !!note && !!list && !!(note.compareDocumentPosition(list) & Node.DOCUMENT_POSITION_FOLLOWING) && !document.querySelector('header [data-ruleset-order]')
    })
    check(`${dir} 1. the "first match wins" note sits above the list, not under the title`, noteFirst && (await page.locator('[data-ruleset-order]').count()) === 1)

    // 2.
    await page.locator('[data-folder-toggle="Item master"]').click()
    check(`${dir} 2. Item master collapsed: its rules go, its heading stays with 5–15 and 11`,
      (await page.locator('[data-rule-row]').count()) === 4 && (await page.locator('[data-folder-toggle="Item master"]').getAttribute('aria-expanded')) === 'false' && strip(await im.locator('[data-folder-summary]').innerText()) === summary)
    await page.locator('[data-folder-toggle="Segments"]').click()
    check(`${dir} 2. the open rule's run (C-ELITE in Segments) stays open`, (await page.locator('[data-rule-row="C-ELITE"]').count()) === 1 && (await page.locator('[data-folder-toggle="Segments"]').getAttribute('aria-expanded')) === 'true')
    await page.locator('[data-folder-toggle="Segments"]').click()
    await page.locator('[data-folder-toggle="Item master"]').click()
    check(`${dir} 2. expanded again: all 15 rows`, (await page.locator('[data-rule-row]').count()) === 15)

    // 3.
    await page.locator('[data-move-up="C-EXCEPTION"]').focus()
    await page.keyboard.press('Enter')
    await page.waitForFunction(() => document.querySelector('[data-rule-row="C-EXCEPTION"]')?.getAttribute('data-position') === '3')
    await page.waitForTimeout(100)
    check(`${dir} 3. the keyboard stays on the arrow it pressed, though the rule moved into another run`, await page.evaluate(() => document.activeElement?.getAttribute('data-move-up') === 'C-EXCEPTION'))
    check(`${dir} 3. C-EXCEPTION up: Segments 1–2, Prescriptions 3, Segments 4 (continued)`,
      JSON.stringify(await runsOf(page)) === JSON.stringify(['Segments 1-2', 'Prescriptions 3-3', 'Segments+ 4-4', 'Item master 5-15']), JSON.stringify(await runsOf(page)))
    check(`${dir} 3. the continuation is said`, /\(continued\)|\(تتمة\)/.test(strip(await page.locator('[data-folder-run="Segments"][data-continued="true"] [data-folder-continued]').innerText())))

    const contKey = '[data-folder-run="Segments"][data-continued="true"] [data-folder-toggle]'
    await page.locator(contKey).click()
    check(`${dir} 3. a heading collapses its own run only: C-ARAMCO hidden, C-ELITE and C-SABIC shown`,
      (await page.locator('[data-rule-row="C-ARAMCO"]').count()) === 0 && (await page.locator('[data-rule-row="C-SABIC"]').count()) === 1)
    await page.locator(contKey).click()

    // 4.
    const filter = page.locator('[data-folder-filter]')
    const filterOpts = await filter.locator('option').evaluateAll((els) => els.map((o) => o.value))
    check(`${dir} 4. the filter offers All + each folder once (no "No folder": every rule has one)`, JSON.stringify(filterOpts) === JSON.stringify(['all', 'in:Segments', 'in:Prescriptions', 'in:Item master']), JSON.stringify(filterOpts))
    await filter.selectOption('in:Segments')
    check(`${dir} 4. Segments: rules 1, 2 and 4, at their real positions`, JSON.stringify(await rowsOf(page)) === JSON.stringify(['1:C-ELITE', '2:C-SABIC', '4:C-ARAMCO']), JSON.stringify(await rowsOf(page)))
    const up = page.locator('[data-move-down="C-SABIC"]')
    check(`${dir} 4. while filtered the arrows are off but focusable, saying why`, (await up.getAttribute('aria-disabled')) === 'true' && !(await up.evaluate((b) => b.disabled)) && /Show all folders|اعرض كل المجلدات/.test((await up.getAttribute('title')) ?? ''))
    await up.click({ force: true }) // aria-disabled: Playwright would wait for it to be enabled
    check(`${dir} 4. a click on an arrow that is off moves nothing`, JSON.stringify(await rowsOf(page)) === JSON.stringify(['1:C-ELITE', '2:C-SABIC', '4:C-ARAMCO']))
    await filter.selectOption('all')
    check(`${dir} 4. all folders: the arrows are back`, (await page.locator('[data-move-down="C-SABIC"]').getAttribute('aria-disabled')) === null && (await page.locator('[data-rule-row]').count()) === 15)

    // 5.
    await page.locator('[data-rule-open="A02-NO-APPROVAL"]').click()
    const ed = page.locator('[data-rule-editor="A02-NO-APPROVAL"]')
    await ed.waitFor({ timeout: 10000 })
    const offered = await ed.locator('[data-folder-options] option').evaluateAll((els) => els.map((o) => o.value))
    check(`${dir} 5. the folder box offers the other folders`, JSON.stringify(offered) === JSON.stringify(['Segments', 'Prescriptions']), JSON.stringify(offered))
    await ed.locator('[data-input="folder"]').fill(' Segments ')
    await ed.locator('[data-input="name.en"]').focus()
    check(`${dir} 5. leaving the folder box reads it as a path (no stray spaces)`, (await ed.locator('[data-input="folder"]').inputValue()) === 'Segments')
    check(`${dir} 5. A02-NO-APPROVAL to Segments: it stays at 15, its run re-cut`,
      JSON.stringify(await runsOf(page)) === JSON.stringify(['Segments 1-2', 'Prescriptions 3-3', 'Segments+ 4-4', 'Item master 5-14', 'Segments+ 15-15']) && (await page.locator('[data-rule-row="A02-NO-APPROVAL"]').getAttribute('data-position')) === '15',
      JSON.stringify(await runsOf(page)))

    // 6.
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 10000 }).catch(() => {})
    const put = state.writes.filter((w) => w.door === 'saveCoverage')
    const want = copy(SEEDED.rules)
    ;[want[2], want[3]] = [want[3], want[2]]
    want.find((r) => r.id === 'A02-NO-APPROVAL').folder = 'Segments'
    const changed = (put[0]?.body?.rules ?? []).filter((r, i) => JSON.stringify(r) !== JSON.stringify(want[i])).map((r) => r.id)
    check(`${dir} 6. one PUT: the moved order and the one folder, every other rule byte for byte`, put.length === 1 && put[0].body.rules.length === 15 && changed.length === 0, changed.join(','))

    check(`${dir} 8. no raw keys (coverage)`, await noRawKeys(page))
    check(`${dir} 8. no page errors (coverage)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: the Categories page ─────────────────────────────────────────────────────────────────────
  {
    let rules = []
    const { context, page, errors } = await open(dir, (s) => {
      // five copies of the stub's rule, in folders the order splits: A, A, B, (none), A
      const names = ['Bupa contract', 'Bupa contract', 'Generics', '', 'Bupa contract']
      const base = s.categories.rules[0]
      s.categories.rules = names.map((f, i) => {
        const r = { ...copy(base), id: `K-00${i + 1}` }
        if (f) r.folder = f
        else delete r.folder
        return r
      })
      rules = s.categories.rules
    })
    await page.goto(`${BASE}/insurance-rules/categories`)
    await page.locator('[data-rule-row]').first().waitFor({ timeout: 60000 })
    check(`${dir} 7. Categories: the runs follow the order (${rules.length} rules)`, rules.length === 5 && JSON.stringify(await runsOf(page)) === JSON.stringify(expectedRuns(rules)), `${JSON.stringify(await runsOf(page))} vs ${JSON.stringify(expectedRuns(rules))}`)
    check(`${dir} 7. Categories: a rule in no folder reads "No folder"`, /No folder|بلا مجلد/.test(strip(await page.locator('[data-folder-run=""] [data-folder-name]').first().innerText())))
    check(`${dir} 7. Categories: the filter offers "No folder"`, (await page.locator('[data-folder-filter] option[value="none"]').count()) === 1)
    check(`${dir} 8. no raw keys (categories)`, await noRawKeys(page))
    check(`${dir} 8. no page errors (categories)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
