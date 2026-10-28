// Insurance rules ▸ Lists + Fields drive (BackOffice spec 3126, doors 3132 + 3133 + 3172; oms ticket 610).
//
// Drives the REAL app in Chromium against STUBS of the doors, on the REAL envelope. Fixtures and the door handler
// are `tools/insurance-rules-stubs.mjs` (section 610: `insuranceListsStub`, stateful per context — a saved draft,
// an added field or entry is read back). 🚩 NOTHING here is driven against a live SIS.Api; ticket 618 swaps in
// the live doors.
//
// It verifies, in LTR and RTL:
//   1. the Lists and Fields leaves are in the rail; the Items tab shows the draft's lists as cards — fields with
//      any of their codes (each `Ltr`), the lists included, the rules that use each;
//   2. a NEW list "GLP-1 pens" from ECode values: codes searched and picked, each shown with its description;
//      taking out a list that holds them all warns "matches no item"; the preview counts the rest and shows the
//      first page; Save PUTs the whole draft at its revision and the card appears;
//   3. a cycle (controlled → glp1-pens → controlled) is refused before the save: the path is read out and Save
//      sends nothing;
//   4. Patients: the VIP list's entries (key `Ltr`, Arabic reason `<bdi>`, expiry or none) and its change log;
//      a bad key is refused in words; a VIP entry is added (POST body), shows, and is logged; Remove asks for a
//      reason and DELETEs with a body `{ key, reason }`, and logs; Policies keys by SubscriberId;
//   4b. Classes (3172): entries for one insurer (its SAP customer id, one ltr isolate) and for any insurer, and
//      the split between them; a class with `|` is refused; a class is added for one insurer and the same class
//      for any insurer (two entries, upper-cased, `payer` only when picked); an entry whose expiry has passed
//      reads expired; Remove sends the entry's payer; a new class list is made with a reason;
//   5. Fields: one table per scope, with what uses each field; a retired field is badged and has no Retire;
//      a key in use is refused; an ItemInfo field is added (key suggested from the source), shows in the item
//      table and in the list editor's field picker; Retire asks first;
//   6. a bare 403 on a read is "You do not have access", never an empty list;
//   7. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5202 --strictPort
//   2. node tools/insurance-lists-drive.mjs        (DRIVE_PORT overrides 5202)
import { createRequire } from 'node:module'
import { BUPA, MEDGULF, TAWUNIYA, envelope, insuranceListsStub, insuranceRulesStub, newListsState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5202}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const state = newListsState()
  state.today = riyadhDay()
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
    const mine = insuranceListsStub(req.method(), p, body, { deny, reads, state, query: url.searchParams })
    if (mine) return route.fulfill(mine)
    const hit = insuranceRulesStub(req.method(), p, body, { deny, reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|lists|fields):|\b(keyed|editor|preview|items|def|mode|problem|entryProblem|logAction|scope|col|add|retire|type|page)\.[a-zA-Z]/.test(await page.locator('main').innerText())
const settle = (page, ms = 400) => page.waitForTimeout(ms)
const confirmYes = async (page) => {
  const dialog = page.getByRole('dialog')
  await dialog.waitFor({ timeout: 5000 })
  await dialog.locator('button').last().click()
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
}
const writesOf = (state, door) => state.writes.filter((w) => w.door === door)
/** The reason dialog every keyed-list write goes through (3133): a reason, then Confirm. */
const withReason = async (page, reason) => {
  const dialog = page.locator('[data-reason-dialog]')
  await dialog.waitFor({ timeout: 5000 })
  await page.locator('[data-reason-input]').fill(reason)
  await page.locator('[data-reason-confirm]').click()
  await dialog.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
}
/** The browser's local day (the drive runs it in Asia/Riyadh), and the day after. */
const riyadhDay = (offset = 0) => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Riyadh' }).format(new Date(Date.now() + offset * 86400000))

for (const dir of ['ltr', 'rtl']) {
  // ── 1–3: item lists ──────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/lists`)
    await page.locator('[data-list-card]').first().waitFor({ timeout: 30000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the rail has the Lists and Fields leaves`, (await page.locator('a[href="/insurance-rules/lists"]').count()) >= 1 && (await page.locator('a[href="/insurance-rules/fields"]').count()) >= 1)
    check(`${dir} 1. the Items tab is open`, (await page.locator('[data-lists-tab="items"]').getAttribute('aria-selected')) === 'true')
    const cards = await page.locator('[data-list-card]').evaluateAll((els) => els.map((e) => e.getAttribute('data-list-card')))
    check(`${dir} 1. one card per list of the draft`, JSON.stringify(cards) === JSON.stringify(['glp1', 'controlled', 'chronic']), JSON.stringify(cards))
    const glp1 = page.locator('[data-list-card="glp1"]')
    check(`${dir} 1. glp1: id an ltr isolate, from fields`, (await glp1.locator('[data-list-id] bdi[dir="ltr"]').innerText()) === 'glp1' && (await glp1.locator('.bg-primary-050').count()) === 1)
    const codes = await glp1.locator('[data-def-attribute="ECode"] [data-def-code] bdi[dir="ltr"]').allInnerTexts()
    check(`${dir} 1. glp1: E-code any of E1497, E1502 — each an ltr isolate`, JSON.stringify(codes) === JSON.stringify(['E1497', 'E1502']) && strip(await glp1.locator('[data-def-attribute="ECode"] .font-medium').innerText()) === 'E-code', JSON.stringify(codes))
    const users = await glp1.locator('[data-list-used-by] bdi[dir="ltr"]').allInnerTexts()
    check(`${dir} 1. glp1: used by G-003, G-006, G-007`, JSON.stringify(users.map(strip)) === JSON.stringify(['G-003', 'G-006', 'G-007']), JSON.stringify(users))
    check(`${dir} 1. controlled: its category`, strip(await page.locator('[data-list-card="controlled"] [data-def-row="categories"] bdi[dir="ltr"]').innerText()) === 'A006')
    check(`${dir} 1. chronic: what it also includes is listed`, (await page.locator('[data-list-card="chronic"] [data-list-refs="include"] [data-list-ref]').count()) === 1)
    check(`${dir} 1. no raw keys on the cards`, await noRawKeys(page))

    // 2. a new list from ECode values
    await page.locator('[data-list-new]').click()
    const editor = page.locator('[data-list-editor="new"]')
    await editor.waitFor({ timeout: 5000 })
    check(`${dir} 2. a blank new list is refused in words before the save`, (await editor.locator('[data-problem="idInvalid"]').count()) === 1 && (await editor.locator('[data-problem="nameMissing"]').count()) === 1 && (await editor.locator('[data-list-save]').getAttribute('aria-disabled')) === 'true')
    await editor.locator('[data-list-id-input]').fill('glp1-pens')
    await editor.locator('[data-list-name-en]').fill('GLP-1 pens')
    await editor.locator('[data-list-name-ar]').fill('أقلام GLP-1')
    await editor.locator('[data-add-attribute="0"]').click()
    const row = editor.locator('[data-attribute-row]').first()
    check(`${dir} 2. a field row starts on E-code, any of, no code`, (await row.locator('[data-attribute-field]').inputValue()) === 'ECode' && (await row.locator('[data-attribute-mode]').inputValue()) === 'anyOf' && (await editor.locator('[data-problem="emptyAttribute"]').count()) === 1)
    const fieldOptions = await row.locator('[data-attribute-field] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 2. the picker offers the live item fields (a retired one not)`, JSON.stringify(fieldOptions) === JSON.stringify(['ECode', 'ATC', 'DosageForm']), JSON.stringify(fieldOptions))
    await row.locator('[data-value-option="E1497"]').waitFor({ timeout: 5000 })
    check(`${dir} 2. a code is offered with its description, one ltr isolate`, strip(await row.locator('[data-value-option="E1497"] bdi[dir="ltr"]').innerText()) === 'E1497 · Semaglutide pen')
    await row.locator('[data-value-option="E1497"]').click()
    check(`${dir} 2. the picked code shows with its description`, strip(await row.locator('[data-code-chip="E1497"] bdi[dir="ltr"]').innerText()) === 'E1497 · Semaglutide pen')
    // take out glp1, which holds E1497 → nothing left
    await editor.locator('[data-ref="exclude:glp1"]').check()
    await editor.locator('[data-preview-run]').click()
    await editor.locator('[data-preview-nothing]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 2. taking out a list that holds every item warns "matches no item"`, (await editor.locator('[data-preview-nothing]').count()) === 1)
    const previewBody = writesOf(state, 'preview').at(-1)?.body
    check(`${dir} 2. the preview sends the definition and the draft's other lists`, previewBody?.list?.id === 'glp1-pens' && JSON.stringify(previewBody?.list?.exclude) === '["glp1"]' && previewBody?.lists?.length === 3, JSON.stringify(previewBody))
    await editor.locator('[data-ref="exclude:glp1"]').uncheck()
    check(`${dir} 2. an edit after a preview clears it`, (await editor.locator('[data-preview-nothing], [data-preview-result]').count()) === 0)
    await row.locator('[data-value-search]').fill('lira')
    await page.waitForFunction(() => document.querySelectorAll('[data-attribute-row] [data-value-option]').length === 1, null, { timeout: 5000 }).catch(() => {})
    const found = await row.locator('[data-value-option]').evaluateAll((els) => els.map((e) => e.getAttribute('data-value-option')))
    check(`${dir} 2. a search narrows the codes`, JSON.stringify(found) === '["E1510"]', JSON.stringify(found))
    await row.locator('[data-value-option="E1510"]').click()
    await row.locator('[data-value-search]').fill('E152')
    await row.locator('[data-value-option="E1520"]').waitFor({ timeout: 5000 })
    await row.locator('[data-value-option="E1520"]').click()
    await editor.locator('[data-ref="include:controlled"]').check()
    await editor.locator('[data-preview-run]').click()
    await editor.locator('[data-preview-result]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 2. the preview counts the matches`, (await editor.locator('[data-preview-count]').getAttribute('data-preview-count')) === '4')
    const items = await editor.locator('[data-preview-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-preview-item')))
    check(`${dir} 2. …and shows the first page`, JSON.stringify(items) === JSON.stringify(['100101', '100102', '100301']), JSON.stringify(items))
    check(`${dir} 2. an item is an ltr isolate, its name a <bdi>`, (await editor.locator('[data-preview-item="100301"] bdi[dir="ltr"]').innerText()) === '100301' && (await editor.locator('[data-preview-item="100301"] bdi:not([dir])').innerText()) === 'Victoza 6 mg/ml pen')
    check(`${dir} 2. no raw keys in the editor`, await noRawKeys(page))
    await editor.locator('[data-list-save]').click()
    await page.locator('[data-list-card="glp1-pens"]').waitFor({ timeout: 5000 }).catch(() => {})
    const put = writesOf(state, 'saveDraft')
    const saved = put.at(-1)?.body
    const pens = saved?.lists?.find((l) => l.id === 'glp1-pens')
    check(`${dir} 2. Save PUTs the whole draft at the revision it was read`, put.length === 1 && saved.revision === 12 && saved.rules.length === 11 && JSON.stringify(saved.lists.map((l) => l.id)) === JSON.stringify(['glp1', 'controlled', 'chronic', 'glp1-pens']), JSON.stringify(saved?.lists?.map((l) => l.id)))
    check(
      `${dir} 2. …with the list as built`,
      JSON.stringify(pens) ===
        JSON.stringify({ id: 'glp1-pens', name: { en: 'GLP-1 pens', ar: 'أقلام GLP-1' }, filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: ['E1497', 'E1510', 'E1520'] }] }], include: ['controlled'], exclude: [] }),
      JSON.stringify(pens),
    )
    check(`${dir} 2. the card appears; no rule uses it yet`, (await page.locator('[data-list-card="glp1-pens"]').count()) === 1 && (await page.locator('[data-list-card="glp1-pens"] [data-list-used-by] bdi').count()) === 0)

    // 3. a cycle is refused before the save
    await page.locator('[data-list-edit="controlled"]').click()
    const ed = page.locator('[data-list-editor="controlled"]')
    await ed.waitFor({ timeout: 5000 })
    await ed.locator('[data-ref="include:glp1-pens"]').check()
    const path = await ed.locator('[data-problem="cycle"] [data-path-step]').evaluateAll((els) => els.map((e) => e.getAttribute('data-path-step')))
    check(`${dir} 3. listCycle_isRefusedBeforeSave: the path is read out`, JSON.stringify(path) === JSON.stringify(['controlled', 'glp1-pens', 'controlled']), JSON.stringify(path))
    check(`${dir} 3. Save and Preview are disabled`, (await ed.locator('[data-list-save]').getAttribute('aria-disabled')) === 'true' && (await ed.locator('[data-preview-run]').getAttribute('aria-disabled')) === 'true')
    await ed.locator('[data-list-save]').click({ force: true })
    await settle(page)
    check(`${dir} 3. …and send nothing`, writesOf(state, 'saveDraft').length === 1)
    await ed.locator('[data-list-cancel]').click()
    check(`${dir} 3. Cancel returns to the cards`, (await page.locator('[data-list-card]').count()) === 4)
    check(`${dir} 7. no page errors (lists)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 4: patient and policy lists ───────────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/lists?tab=patients`)
    await page.locator('[data-entry]').first().waitFor({ timeout: 30000 })
    check(`${dir} 4. ?tab=patients opens Patients on the first list`, (await page.locator('[data-lists-tab="patients"]').getAttribute('aria-selected')) === 'true' && (await page.locator('[data-keyed-panel="PL-VIP"]').count()) === 1)
    check(`${dir} 4. the lists with their entry counts`, strip(await page.locator('[data-keyed-pick="PL-VIP"] bdi[dir="ltr"]').innerText()) === '2' && (await page.locator('[data-keyed-pick="PL-STAFF"]').count()) === 1)
    const keys = await page.locator('[data-entry]').evaluateAll((els) => els.map((e) => e.getAttribute('data-entry')))
    check(`${dir} 4. every entry`, JSON.stringify(keys) === JSON.stringify(['1012345678', '2087654321']), JSON.stringify(keys))
    const e2 = page.locator('[data-entry="2087654321"]')
    check(`${dir} 4. key and added-by ltr isolates; the Arabic reason a <bdi>`, (await e2.locator('td').first().locator('bdi[dir="ltr"]').innerText()) === '2087654321' && (await e2.locator('td').nth(1).locator('bdi[dir="ltr"]').innerText()) === 'nalharbi' && (await e2.locator('td').nth(2).locator('bdi:not([dir])').innerText()) === 'مريض كبار الشخصيات حتى نهاية العام')
    check(`${dir} 4. an expiry is a day; none says so`, strip(await e2.locator('[data-entry-expiry] bdi[dir="ltr"]').innerText()) === '2026-12-31' && (await page.locator('[data-entry="1012345678"] [data-entry-expiry] bdi').count()) === 0)
    const log = await page.locator('[data-keyed-log] [data-log-row]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-log-row')}:${e.querySelector('[data-log-key]').textContent.replace(/[\u2066-\u2069]/g, '')}`))
    check(`${dir} 4. the change log, newest first`, JSON.stringify(log) === JSON.stringify(['add:2087654321', 'remove:1099999999', 'add:1012345678']), JSON.stringify(log))
    check(`${dir} 4. a log moment is local, an ltr isolate`, strip(await page.locator('[data-keyed-log] [data-log-row]').first().locator('bdi[dir="ltr"]').first().innerText()) === '2026-10-20 10:12')

    // a bad key, then the VIP entry
    await page.locator('[data-entry-key]').fill('12345')
    await page.locator('[data-entry-add]').click()
    check(`${dir} 4. a bad key and no reason are refused in words`, (await page.locator('[data-entry-problems] [data-problem="keyInvalid"]').count()) === 1 && (await page.locator('[data-entry-problems] [data-problem="reasonMissing"]').count()) === 1 && writesOf(state, 'addEntry').length === 0)
    await page.locator('[data-entry-key]').fill('1012345678')
    await page.locator('[data-entry-reason]').fill('x')
    check(`${dir} 4. a key already on the list is a change, not a refusal: the button and a hint say so`, (await page.locator('[data-entry-add="change"]').count()) === 1 && (await page.locator('[data-entry-change]').count()) === 1 && (await page.locator('[data-entry-problems] [data-problem]').count()) === 0)
    await page.locator('[data-entry-key]').fill('1055555555')
    await page.locator('[data-entry-reason]').fill("Minister's family")
    await page.locator('[data-entry-expires]').fill('2027-06-30')
    await page.locator('[data-entry-add]').click()
    await page.locator('[data-entry="1055555555"]').waitFor({ timeout: 5000 }).catch(() => {})
    const add = writesOf(state, 'addEntry')
    check(`${dir} 4. a VIP entry is POSTed: key, reason, expiry`, add.length === 1 && JSON.stringify(add[0].body) === JSON.stringify({ key: '1055555555', reason: "Minister's family", expiresOn: '2027-06-30' }), JSON.stringify(add[0]?.body))
    check(`${dir} 4. …shows with who added it`, (await page.locator('[data-entry="1055555555"] td').nth(1).locator('bdi').innerText()) === 'msartawi' && strip(await page.locator('[data-entry="1055555555"] [data-entry-expiry]').innerText()) === '2027-06-30')
    await page.waitForFunction(() => document.querySelector('[data-keyed-log] [data-log-row]')?.textContent.includes('1055555555'), null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 4. …is logged`, strip(await page.locator('[data-keyed-log] [data-log-row]').first().locator('[data-log-key]').innerText()) === '1055555555')
    await page.waitForFunction(() => document.querySelector('[data-keyed-pick="PL-VIP"]')?.textContent.replace(/[\u2066-\u2069]/g, '').includes('3'), null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 4. …and the count follows`, strip(await page.locator('[data-keyed-pick="PL-VIP"] bdi[dir="ltr"]').innerText()) === '3')
    check(`${dir} 4. the form is cleared`, (await page.locator('[data-entry-key]').inputValue()) === '' && (await page.locator('[data-entry-problems]').count()) === 0)

    // Remove asks for a reason
    await page.locator('[data-entry-remove="1012345678"]').click()
    await page.locator('[data-reason-dialog]').waitFor({ timeout: 5000 })
    check(`${dir} 4. Remove asks for a reason; Confirm waits for one`, (await page.locator('[data-reason-confirm]').isDisabled()) || (await page.locator('[data-reason-confirm]').getAttribute('aria-disabled')) === 'true')
    await withReason(page, 'Left the board')
    await page.locator('[data-entry="1012345678"]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const rm = writesOf(state, 'removeEntry')
    check(`${dir} 4. …then DELETEs with a body { key, reason }`, rm.length === 1 && JSON.stringify(rm[0].body) === JSON.stringify({ key: '1012345678', reason: 'Left the board' }) && (await page.locator('[data-entry="1012345678"]').count()) === 0, JSON.stringify(rm[0]?.body))
    await page.waitForFunction(() => document.querySelector('[data-keyed-log] [data-log-row]')?.getAttribute('data-log-row') === 'remove', null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 4. …and logs it with the reason`, (await page.locator('[data-keyed-log] [data-log-row]').first().getAttribute('data-log-row')) === 'remove' && strip(await page.locator('[data-keyed-log] [data-log-row]').first().innerText()).includes('Left the board'))

    await page.locator('[data-keyed-pick="PL-STAFF"]').click()
    await page.locator('[data-entries-empty]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. picking another list lands in the URL; an empty list says so`, new URL(page.url()).searchParams.get('list') === 'PL-STAFF' && (await page.locator('[data-entries-empty]').count()) === 1)
    check(`${dir} 4. no raw keys on Patients`, await noRawKeys(page))

    await page.locator('[data-lists-tab="policies"]').click()
    await page.locator('[data-entry="SUB-778812"]').waitFor({ timeout: 5000 }).catch(() => {})
    check(`${dir} 4. Policies: keyed by SubscriberId`, (await page.locator('[data-keyed-panel="PO-EXT"] [data-entry="SUB-778812"]').count()) === 1 && new URL(page.url()).searchParams.get('tab') === 'policies')
    await page.locator('[data-entry-key]').fill('SUB 1')
    await page.locator('[data-entry-reason]').fill('x')
    await page.locator('[data-entry-add]').click()
    check(`${dir} 4. a SubscriberId with a space is refused`, (await page.locator('[data-entry-problems] [data-problem="keyInvalid"]').count()) === 1)
    check(`${dir} 7. no page errors (keyed lists)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 4b: class lists (BackOffice 3172) ─────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/lists?tab=classes`)
    await page.locator('[data-entry]').first().waitFor({ timeout: 30000 })
    check(`${dir} 4b. ?tab=classes opens Policy classes on the class list`, (await page.locator('[data-lists-tab="classes"]').getAttribute('aria-selected')) === 'true' && (await page.locator('[data-keyed-panel="CL-GOLD"]').count()) === 1)
    const rows = await page.locator('[data-entry]').evaluateAll((els) => els.map((e) => e.getAttribute('data-entry')))
    check(`${dir} 4b. the entries, each a class and its insurer`, JSON.stringify(rows) === JSON.stringify([`GOLD|${BUPA}`, 'VIP|']), JSON.stringify(rows))
    check(`${dir} 4b. one insurer: its SAP customer id (3144 names none), one ltr isolate`, strip(await page.locator(`[data-entry="GOLD|${BUPA}"] [data-entry-insurer="${BUPA}"] bdi[dir="ltr"]`).innerText()) === BUPA)
    check(`${dir} 4b. any insurer says so`, (await page.locator('[data-entry="VIP|"] [data-entry-insurer=""] bdi').count()) === 0 && strip(await page.locator('[data-entry="VIP|"] [data-entry-insurer=""]').innerText()).length > 0)
    check(`${dir} 4b. the list shows how many are for one insurer and how many for any`, (await page.locator('[data-class-split]').getAttribute('data-class-split')) === '1/1')
    const payers = await page.locator('[data-entry-payer] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 4b. the insurer picker: any insurer, then the insurers (never the estate default `*`)`, JSON.stringify(payers) === JSON.stringify(['', BUPA, TAWUNIYA, MEDGULF]), JSON.stringify(payers))

    await page.locator('[data-entry-key]').fill('VIP|A')
    await page.locator('[data-entry-reason]').fill('x')
    await page.locator('[data-entry-add]').click()
    check(`${dir} 4b. a class with "|" is refused in words`, (await page.locator('[data-entry-problems] [data-problem="keyInvalid"]').count()) === 1 && writesOf(state, 'addEntry').length === 0)
    await page.locator('[data-entry-key]').fill('vip')
    check(`${dir} 4b. VIP for any insurer is already on the list: a change`, (await page.locator('[data-entry-add="change"]').count()) === 1 && (await page.locator('[data-entry-change]').count()) === 1)

    // one insurer
    await page.locator('[data-entry-key]').fill('silver')
    await page.locator('[data-entry-payer]').selectOption(TAWUNIYA)
    await page.locator('[data-entry-reason]').fill('Tawuniya silver tier')
    await page.locator('[data-entry-add]').click()
    await page.locator(`[data-entry="SILVER|${TAWUNIYA}"]`).waitFor({ timeout: 5000 }).catch(() => {})
    let add = writesOf(state, 'addEntry')
    check(`${dir} 4b. a class for one insurer is POSTed upper case, with its payer`, add.length === 1 && JSON.stringify(add[0].body) === JSON.stringify({ key: 'SILVER', payer: TAWUNIYA, reason: 'Tawuniya silver tier' }), JSON.stringify(add[0]?.body))
    check(`${dir} 4b. …shows with its insurer`, strip(await page.locator(`[data-entry="SILVER|${TAWUNIYA}"] [data-entry-insurer] bdi[dir="ltr"]`).innerText()) === TAWUNIYA)
    check(`${dir} 4b. …the insurer is back to any after the add`, (await page.locator('[data-entry-payer]').inputValue()) === '')

    // the same class for any insurer, expiring today
    const today = riyadhDay()
    await page.locator('[data-entry-key]').fill('Gold')
    await page.locator('[data-entry-reason]').fill('Gold with every insurer this week')
    await page.locator('[data-entry-expires]').fill(today)
    await page.locator('[data-entry-add]').click()
    await page.locator('[data-entry="GOLD|"]').waitFor({ timeout: 5000 }).catch(() => {})
    add = writesOf(state, 'addEntry')
    check(`${dir} 4b. the same class for any insurer is a second entry (no payer sent), expiring today`, add.length === 2 && JSON.stringify(add[1].body) === JSON.stringify({ key: 'GOLD', reason: 'Gold with every insurer this week', expiresOn: today }) && (await page.locator(`[data-entry="GOLD|${BUPA}"]`).count()) === 1 && (await page.locator('[data-entry="GOLD|"]').count()) === 1, JSON.stringify(add[1]?.body))
    await page.waitForFunction(() => document.querySelector('[data-class-split]')?.getAttribute('data-class-split') === '2/2', null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 4b. …the split follows`, (await page.locator('[data-class-split]').getAttribute('data-class-split')) === '2/2')
    check(`${dir} 4b. …and it counts today: not expired`, (await page.locator('[data-entry="GOLD|"]').getAttribute('data-expired')) === 'false')
    const logTop = page.locator('[data-keyed-log] [data-log-row]').first()
    check(`${dir} 4b. …logged with "any insurer"`, (await logTop.getAttribute('data-log-row')) === 'add' && (await logTop.locator('[data-log-insurer=""]').count()) === 1)

    // a change: VIP for any insurer is already listed, so the POST replaces its reason and expiry (HQ logs `change`)
    await page.locator('[data-entry-key]').fill('vip')
    await page.locator('[data-entry-reason]').fill('VIP renewed for next year')
    await page.locator('[data-entry-expires]').fill('2027-12-31')
    check(`${dir} 4b. a listed class reads as a change before the save`, (await page.locator('[data-entry-add="change"]').count()) === 1 && (await page.locator('[data-entry-change]').count()) === 1)
    await page.locator('[data-entry-add]').click()
    await page.waitForFunction(() => document.querySelector('[data-keyed-log] [data-log-row]')?.getAttribute('data-log-row') === 'change', null, { timeout: 5000 }).catch(() => {})
    add = writesOf(state, 'addEntry')
    check(`${dir} 4b. the change is the same POST: { key, reason, expiresOn }, no payer`, add.length === 3 && JSON.stringify(add[2].body) === JSON.stringify({ key: 'VIP', reason: 'VIP renewed for next year', expiresOn: '2027-12-31' }), JSON.stringify(add[2]?.body))
    check(`${dir} 4b. …still one VIP entry, its reason and expiry replaced`, (await page.locator('[data-entry="VIP|"]').count()) === 1 && strip(await page.locator('[data-entry="VIP|"]').innerText()).includes('VIP renewed for next year') && strip(await page.locator('[data-entry="VIP|"] [data-entry-expiry]').innerText()) === '2027-12-31')
    check(`${dir} 4b. …logged as a change; the split stays 2/2`, (await page.locator('[data-keyed-log] [data-log-row]').first().getAttribute('data-log-row')) === 'change' && (await page.locator('[data-class-split]').getAttribute('data-class-split')) === '2/2')
    check(`${dir} 4b. …and the form is back to Add`, (await page.locator('[data-entry-add="add"]').count()) === 1 && (await page.locator('[data-entry-key]').inputValue()) === '')

    // a day later it has expired
    state.today = riyadhDay(1)
    await page.reload()
    await page.locator('[data-entry="GOLD|"]').waitFor({ timeout: 30000 })
    check(`${dir} 4b. a day on, the entry whose expiry has passed reads expired, still listed`, (await page.locator('[data-entry="GOLD|"]').getAttribute('data-expired')) === 'true' && (await page.locator('[data-entry="GOLD|"] [data-entry-expired]').count()) === 1)
    check(`${dir} 4b. …the Bupa GOLD entry, with no expiry, does not`, (await page.locator(`[data-entry="GOLD|${BUPA}"]`).getAttribute('data-expired')) === 'false' && (await page.locator('[data-entry-expired]').count()) === 1)

    // Remove sends the entry's payer
    await page.locator(`[data-entry-remove="GOLD|${BUPA}"]`).click()
    await withReason(page, 'Bupa ended the gold tier')
    await page.locator(`[data-entry="GOLD|${BUPA}"]`).waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
    const rm = writesOf(state, 'removeEntry')
    check(`${dir} 4b. Remove DELETEs { key, payer, reason }; the any-insurer GOLD stays`, rm.length === 1 && JSON.stringify(rm[0].body) === JSON.stringify({ key: 'GOLD', payer: BUPA, reason: 'Bupa ended the gold tier' }) && (await page.locator('[data-entry="GOLD|"]').count()) === 1, JSON.stringify(rm[0]?.body))
    await page.waitForFunction(() => document.querySelector('[data-keyed-log] [data-log-row]')?.getAttribute('data-log-row') === 'remove', null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 4b. …logged with its insurer`, strip(await page.locator('[data-keyed-log] [data-log-row]').first().locator(`[data-log-insurer="${BUPA}"] bdi[dir="ltr"]`).innerText()) === BUPA)
    check(`${dir} 4b. no raw keys on Classes`, await noRawKeys(page))

    // a new class list
    await page.locator('[data-keyed-new]').click()
    await page.locator('[data-new-list]').waitFor({ timeout: 5000 })
    await page.locator('[data-new-list-id]').fill('CL GOLD')
    check(`${dir} 4b. a bad list id is refused in words`, (await page.locator('[data-new-list] [data-problem="idInvalid"]').count()) === 1)
    await page.locator('[data-new-list-id]').fill('CL-SILVER')
    await page.locator('[data-new-list-en]').fill('Silver classes')
    await page.locator('[data-new-list-ar]').fill('الفئات الفضية')
    await withReason(page, 'Silver tier review')
    await page.locator('[data-keyed-panel="CL-SILVER"]').waitFor({ timeout: 5000 }).catch(() => {})
    const made = writesOf(state, 'createList')
    check(`${dir} 4b. a new class list is POSTed { id, name, reason } and opened`, made.length === 1 && JSON.stringify(made[0].body) === JSON.stringify({ id: 'CL-SILVER', name: { en: 'Silver classes', ar: 'الفئات الفضية' }, reason: 'Silver tier review' }) && (await page.locator('[data-keyed-panel="CL-SILVER"] [data-entries-empty]').count()) === 1, JSON.stringify(made[0]?.body))
    await page.waitForFunction(() => document.querySelector('[data-keyed-log] [data-log-row]')?.getAttribute('data-log-row') === 'createList', null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 4b. …its log opens with "List created"`, (await page.locator('[data-keyed-log] [data-log-row]').first().getAttribute('data-log-row')) === 'createList')
    check(`${dir} 7. no page errors (class lists)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 5: the Fields registry ─────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, state } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/fields`)
    await page.locator('[data-field-row]').first().waitFor({ timeout: 30000 })
    const scopes = await page.locator('[data-fields-scope]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-fields-scope')}=${e.querySelectorAll('[data-field-row]').length}`))
    check(`${dir} 5. one table per scope`, JSON.stringify(scopes) === JSON.stringify(['item=4', 'request=1', 'patient=1', 'eligibility=1', 'line=0']), JSON.stringify(scopes))
    const ecode = page.locator('[data-field-row="ECode"]')
    await page.waitForFunction(() => document.querySelector('[data-field-row="ECode"] [data-field-users]')?.getAttribute('data-field-users') !== '0', null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 5. ECode: key and source ltr isolates`, (await ecode.locator('td').nth(1).locator('bdi[dir="ltr"]').innerText()) === 'ECode' && strip(await ecode.locator('[data-field-source] bdi[dir="ltr"]').innerText()) === 'ItemInfo.ECode')
    check(`${dir} 5. ECode is used by the lists that name it`, (await ecode.locator('[data-field-users]').getAttribute('data-field-users')) === '2' && JSON.stringify(await ecode.locator('[data-field-users] bdi[dir="ltr"]').allInnerTexts()) === '["glp1","chronic"]')
    check(`${dir} 5. daysSupply is used by G-004, with its unit`, strip(await page.locator('[data-field-row="daysSupply"] [data-field-users]').innerText()) === 'G-004' && (await page.locator('[data-field-row="daysSupply"] td').nth(2).locator('bdi[dir="ltr"]').innerText()) === 'days')
    check(`${dir} 5. a retired field is badged and has no Retire`, (await page.locator('[data-field-row="OldGroup"]').getAttribute('data-retired')) === 'true' && (await page.locator('[data-field-retire="OldGroup"]').count()) === 0 && (await page.locator('[data-field-retire="ECode"]').count()) === 1)
    check(`${dir} 5. no raw keys on Fields`, await noRawKeys(page))

    // a key in use is refused
    const form = page.locator('[data-field-add]')
    await form.locator('[data-add-source]').fill('ItemInfo.ECode')
    check(`${dir} 5. the key is suggested from the source`, (await form.locator('[data-add-key]').inputValue()) === 'ECode')
    await form.locator('[data-add-submit]').click()
    check(`${dir} 5. a key in use (and no label) is refused`, (await form.locator('[data-problem="keyTaken"]').count()) === 1 && (await form.locator('[data-problem="labelMissing"]').count()) === 1 && writesOf(state, 'addField').length === 0)

    // add an ItemInfo field
    await form.locator('[data-add-source]').fill('ItemInfo.HouseBrand')
    check(`${dir} 5. …a new source suggests its column`, (await form.locator('[data-add-key]').inputValue()) === 'HouseBrand')
    await form.locator('[data-add-label-en]').fill('House brand')
    await form.locator('[data-add-label-ar]').fill('العلامة الخاصة')
    await form.locator('[data-add-type]').selectOption('text')
    await form.locator('[data-add-submit]').click()
    await page.locator('[data-field-row="HouseBrand"]').waitFor({ timeout: 5000 }).catch(() => {})
    const added = writesOf(state, 'addField')
    check(
      `${dir} 5. an ItemInfo field is POSTed: key, EN + AR label, scope, type, unit, source`,
      added.length === 1 && JSON.stringify(added[0].body) === JSON.stringify({ key: 'HouseBrand', label: { en: 'House brand', ar: 'العلامة الخاصة' }, scope: 'item', type: 'text', unit: null, source: 'ItemInfo.HouseBrand' }),
      JSON.stringify(added[0]?.body),
    )
    check(`${dir} 5. …shows in the item table, the Arabic label right to left`, (await page.locator('[data-fields-scope="item"] [data-field-row="HouseBrand"]').count()) === 1 && (await page.locator('[data-field-row="HouseBrand"] bdi[data-says-ar][dir="rtl"]').innerText()) === 'العلامة الخاصة')
    check(`${dir} 5. …and the form is cleared`, (await form.locator('[data-add-source]').inputValue()) === '')

    // Retire asks first
    await page.locator('[data-field-retire="ATC"]').click()
    await confirmYes(page)
    await page.waitForFunction(() => document.querySelector('[data-field-row="ATC"]')?.getAttribute('data-retired') === 'true', null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 5. Retire asks first, then retires (never deletes)`, writesOf(state, 'retire').length === 1 && (await page.locator('[data-field-row="ATC"]').getAttribute('data-retired')) === 'true')

    // the new field is offered to a list; the retired one is not
    await page.goto(`${BASE}/insurance-rules/lists`)
    await page.locator('[data-list-new]').click()
    await page.locator('[data-add-attribute="0"]').click()
    const offered = await page.locator('[data-attribute-field] option').evaluateAll((els) => els.map((e) => e.value))
    check(`${dir} 5. the list editor offers the new field, not the retired ones`, JSON.stringify(offered) === JSON.stringify(['ECode', 'DosageForm', 'HouseBrand']), JSON.stringify(offered))
    check(`${dir} 7. no page errors (fields)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: a bare 403 on a read ──────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, { deny: ['draft', 'fields', 'keyedLists'] })
    await page.goto(`${BASE}/insurance-rules/lists`)
    await page.locator('[data-lists-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 6. a 403 on the item lists → "You do not have access", no card`, (await page.locator('[data-lists-denied]').count()) === 1 && (await page.locator('[data-list-card], [data-list-new]').count()) === 0)
    await page.locator('[data-lists-tab="patients"]').click()
    await page.locator('[data-keyed-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 6. a 403 on the patient lists → "You do not have access"`, (await page.locator('[data-keyed-denied]').count()) === 1)
    await page.goto(`${BASE}/insurance-rules/fields`)
    await page.locator('[data-fields-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 6. a 403 on the fields → "You do not have access", no table, no form`, (await page.locator('[data-fields-denied]').count()) === 1 && (await page.locator('[data-field-row], [data-field-add]').count()) === 0)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
