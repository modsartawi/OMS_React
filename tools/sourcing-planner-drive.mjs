// Sourcing planner data drive (ticket 968, BackOffice spec 4354 §19) — drives the REAL app against a stubbed wire in the
// REAL server's shapes (BackOffice at pricing2 35a4e56be): BO 4375 `PlannerStockEndpoints` (`SourcingAdvisor/
// BufferOverrides` + `/Save` `/End`, `SourcingAdvisor/StoreConfidences` + `/Set` `/End`), BO 4362 `ProductRuleEndpoints`
// (`SourcingAdvisor/ProductRules` + `/Change` `/Lists/Add` `/Lists/Remove`) and BO 4361 `PlannerTableEndpoints`
// (`SourcingAdvisor/PlannerTables` + `/History` `/Save` `/End`). The stub keeps each family's rows as its service does:
// a change never edits a row, it ends it (who, when — and why, for the BO 4375 tables) and writes the next.
//
// Left to right and right to left (`oms.locale = 'ar'` sets dir="rtl"; the app's words stay English, as on every
// screen, so the RTL pass proves the mirroring and the isolation), asserts:
//   1. a tab is hidden without its grant (the owner's variant A): the planner-stock grant with the run grant shows two
//      tabs; a planner grant without the run grant (every list reads under it), or the run grant alone, says no access;
//   2. add an override: the sheet asks for units or days and a reason, refuses to save without the reason, and posts
//      `BufferOverrides/Save` with the level's keys, the figures as numbers, the first day and the reason; the new row
//      is listed and its history reads the reason; a change posts `replaces`, and the history follows the chain; an
//      ending posts `{ id, reason }`; "which override applies" names the store-and-item row over the item row;
//   3. switch a rule row straight from the list: `ProductRules/Change` posts the rule's row as on screen with only its
//      switch flipped and no reason (BO 4362 keeps none); the sheet does not open; a rule's sheet asks no reason and
//      offers no ending;
//   4. edit a contract row in its sheet: `PlannerTables/Save` posts the table's own row shape and the note, no reason;
//      the history door shows the rate's old and new value, who and when;
//   5. a list entry is taken off (`Lists/Remove`) or added (`Lists/Add`), never changed;
//   6. the side sheet docks at the inline end (right in English, left in Arabic); a planner table offers no "show
//      ended" (its door lists only current rows);
//   7. no page error and no raw key.
//
//   1. run the app:  npx vite --port 5204 --strictPort
//   2. DRIVE_PORT=5204 node tools/sourcing-planner-drive.mjs
//      (PLAYWRIGHT_CHANNEL=msedge to use the installed Edge when Playwright's own Chromium is not installed)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire(process.env.PLAYWRIGHT_FROM || import.meta.url)
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`
const SHOTS = 'tools/.sourcing-planner-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

// The run grant (BackOffice 4355 `SourcingSimulatorGrants`): every weight-set and planner list reads under it.
const RUN = ['SourcingSimulator:03']
const STOCK = 'SourcingPlannerStock:03'
const RULES = 'SourcingProductRules:03'
const TABLES = 'SourcingPlannerTables:03'
const ALL = [...RUN, STOCK, RULES, TABLES]
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const SEED_AT = '2026-11-01 07:00:00'
const WIRE_TABLES = { storeModes: 'storeModes', carrierContracts: 'carrierContracts', slotRules: 'slotRules' }

function seed() {
  const ov = (id, o) => ({ id, store: '', item: '', category: '', firstDay: '2026-10-15', createdBy: 'nalharbi', createdAt: SEED_AT, ended: false, expired: false, ...o })
  const rule = (n, group, value, mode, reason, on) => ({ rule: `00000000000000000000PR${String(n).padStart(4, '0')}`, group, value, mode, onlyFrom: [], reason, on, note: '', startedBy: '', startedAt: SEED_AT, ended: false })
  const trow = (table, id, key, row) => ({ table, id, key, row, addedBy: '', addedAt: SEED_AT, ended: false, note: '' })
  return {
    seq: 0,
    overrides: [
      ov('ov-it', { level: 'ITEM', item: '121007', keepDays: 2, reason: 'Clinic next door.' }),
      ov('ov-st', { level: 'STORE', store: 'P907', keepDays: 1, firstDay: '2026-11-20', reason: 'Winter season.' }),
    ],
    confidences: [{ id: 'cf-p905', store: 'P905', confidence: 0.8, reason: 'Renovation.', endsOn: '2026-12-20', createdBy: 'nalharbi', createdAt: SEED_AT, ended: false, pastEndDate: false }],
    rules: [
      rule(11, 'COLD_CHAIN', '', 'DAWAA_NOW', 'COLD', false),
      rule(13, 'COLD_CHAIN', '', 'CARRIER_NEXT_DAY', 'COLD', true),
      rule(6, 'LIST', 'RESTRICTED', 'DAWAA_NOW', 'RESTRICTED', true),
    ],
    lists: [
      { list: 'RESTRICTED', kind: 'ITEM', code: '300114', note: 'Hospital-only pack', startedBy: 'nalharbi', startedAt: SEED_AT, ended: false },
      { list: 'BULKY', kind: 'SUB_CATEGORY', code: 'B001', note: '', startedBy: '', startedAt: SEED_AT, ended: false },
    ],
    tables: [
      trow('storeModes', 'sm-1', 'P905|DAWAA_NOW', { store: 'P905', mode: 'DAWAA_NOW', gives: false }),
      trow('carrierContracts', 'cc-1', 'ARX-SD', { contract: 'ARX-SD', mode: 'CARRIER_SAME_DAY', courier: 'ARAMEX', cities: ['RUH', 'JED'], cutOff: '14:00', daysToDeliver: 0, deliverBy: '22:00', rate: 18, collectAt: '16:00', keepsCold: false, assumed: true }),
      trow('carrierContracts', 'cc-2', 'SMSA-ND', { contract: 'SMSA-ND', mode: 'CARRIER_NEXT_DAY', courier: 'SMSA', cities: ['*'], cutOff: '20:00', daysToDeliver: 1, deliverBy: '22:00', rate: 12.5, collectAt: '22:00', keepsCold: false, assumed: false }),
      trow('slotRules', 'sl-1', 'SLOT|08:00', { kind: 'SLOT', from: '08:00', to: '10:00' }),
    ],
  }
}

const now = (db) => `2026-11-27 10:${pad(30 + ++db.seq)}:00`
const BY = 'msartawi'
const strip = ({ table, ...r }) => r

/** The server's doors over the in-memory rows: a change ends the row and writes the next. */
function serve(db, p, q, body) {
  if (p === 'SourcingAdvisor/BufferOverrides') return db.overrides.filter((o) => q.withEnded === 'true' || !o.ended)
  if (p === 'SourcingAdvisor/BufferOverrides/Save') {
    const at = now(db)
    const row = { id: `ov-n${db.seq}`, ...body, store: body.store ?? '', item: body.item ?? '', category: body.category ?? '', createdBy: BY, createdAt: at, ended: false, expired: false }
    delete row.replaces
    if (body.replaces) {
      const old = db.overrides.find((o) => o.id === body.replaces)
      Object.assign(old, { ended: true, endedBy: BY, endedAt: at, endReason: body.reason, replacedBy: row.id })
      row.replaces = old.id
    }
    db.overrides.push(row)
    return row
  }
  if (p === 'SourcingAdvisor/BufferOverrides/End') {
    const old = db.overrides.find((o) => o.id === body.id)
    Object.assign(old, { ended: true, endedBy: BY, endedAt: now(db), endReason: body.reason })
    return old
  }
  if (p === 'SourcingAdvisor/StoreConfidences') return db.confidences.filter((c) => q.withEnded === 'true' || !c.ended)
  if (p === 'SourcingAdvisor/ProductRules') return { rules: db.rules.filter((r) => q.withHistory === 'true' || !r.ended), lists: db.lists.filter((l) => q.withHistory === 'true' || !l.ended) }
  if (p === 'SourcingAdvisor/ProductRules/Change') {
    const at = now(db)
    const current = db.rules.find((r) => r.rule === body.rule && !r.ended)
    if (current) Object.assign(current, { ended: true, endedBy: BY, endedAt: at })
    const row = { rule: body.rule ?? `NEW${db.seq}`, ...body, startedBy: BY, startedAt: at, ended: false }
    db.rules.push(row)
    return row
  }
  if (p === 'SourcingAdvisor/ProductRules/Lists/Add') {
    const row = { ...body, startedBy: BY, startedAt: now(db), ended: false }
    db.lists.push(row)
    return row
  }
  if (p === 'SourcingAdvisor/ProductRules/Lists/Remove') {
    const row = db.lists.find((l) => l.list === body.list && l.kind === body.kind && l.code === body.code && !l.ended)
    Object.assign(row, { ended: true, endedBy: BY, endedAt: now(db) })
    return row
  }
  if (p === 'SourcingAdvisor/PlannerTables') return db.tables.filter((r) => r.table === q.table && !r.ended).map(strip)
  if (p === 'SourcingAdvisor/PlannerTables/History') return db.tables.filter((r) => r.table === q.table && r.key === q.key).map(strip).reverse()
  if (p === 'SourcingAdvisor/PlannerTables/Save') {
    const at = now(db)
    const key = body.table === 'storeModes' ? `${body.row.store}|${body.row.mode}` : body.table === 'slotRules' ? `${body.row.kind}|${body.row.from}` : body.row.contract
    const current = db.tables.find((r) => r.table === body.table && r.key === key && !r.ended)
    if (current) Object.assign(current, { ended: true, endedBy: BY, endedAt: at })
    const row = { table: body.table, id: `${body.table}-n${db.seq}`, key, row: body.row, addedBy: BY, addedAt: at, ended: false, replaces: current?.id, note: body.note }
    db.tables.push(row)
    return strip(row)
  }
  if (p === 'SourcingAdvisor/PlannerTables/End') {
    const current = db.tables.find((r) => r.table === body.table && r.key === body.key && !r.ended)
    Object.assign(current, { ended: true, endedBy: BY, endedAt: now(db) })
    return strip(current)
  }
  return undefined
}

const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const plain = (text) => text.replace(/[⁦-⁩]/g, '')
const isLtrIsolate = (locator) => locator.evaluate((el) => !!el.closest('bdi[dir="ltr"]') || !!el.querySelector('bdi[dir="ltr"]'))
const RAW_KEY = /\b(fields|opt|tabs|notes|label|hints|problems|sheet|list|probe|override|toast|access|grants|actions|reason|switch|flag)\.[A-Za-z_]+/

async function scenario(browser, lang) {
  const tag = `[${lang}]`
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 } })
  await context.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'false')
  }, lang)
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))

  const wire = { grants: ALL, db: seed(), posts: [], gets: [] }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    const q = Object.fromEntries(url.searchParams)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: BY, currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(wire.grants))
    const body = route.request().method() === 'POST' ? JSON.parse(route.request().postData() || '{}') : null
    if (body) wire.posts.push({ path: p, body })
    else wire.gets.push(`${p}${url.search}`)
    const answer = p?.startsWith('SourcingAdvisor/') ? serve(wire.db, p, q, body) : undefined
    return route.fulfill(envelope(answer ?? {}))
  })

  const open = async (query = '') => {
    await page.goto(`${BASE}/oms/sourcing-planner${query}`)
    await page.locator('[data-sourcing-planner], [role="alert"]').first().waitFor({ timeout: 20000 })
  }
  const tabs = async () => page.locator('[data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))
  const sheet = page.locator('dialog[open][data-row-sheet]')
  const grid = (table) => page.locator(`[data-planner-grid="${table}"]`)
  const cell = (table, rowId, col) => grid(table).locator(`.ag-row[row-id="${rowId}"] [col-id="${col}"]`).first()
  const postsTo = (path) => wire.posts.filter((x) => x.path === path).map((x) => x.body)
  const close = async () => {
    await sheet.locator('header button[aria-label]').click()
    await sheet.waitFor({ state: 'detached' })
  }

  // ── 1. a tab is hidden without its grant ──────────────────────────────────────────────────────────────────────
  wire.grants = [...RUN, STOCK]
  await open()
  check(`${tag} the planner-stock grant shows the two buffer tabs only`, same(await tabs(), ['overrides', 'confidence']), JSON.stringify(await tabs()))
  for (const grants of [[STOCK, RULES, TABLES], RUN]) {
    wire.grants = grants
    await open()
    check(`${tag} ${grants.length === 3 ? 'the planner grants without the run grant' : 'the run grant alone'}: no access, no tab`, (await page.locator('[role="alert"]').count()) === 1 && (await page.locator('[data-tab]').count()) === 0)
  }
  wire.grants = ALL
  await open()
  check(`${tag} every grant: the eight tabs in their groups`, (await tabs()).length === 8 && (await page.locator('[data-tab-group]').count()) === 3)
  check(`${tag} the page is ${lang === 'ar' ? 'right to left' : 'left to right'}`, (await page.evaluate(() => document.documentElement.dir)) === (lang === 'ar' ? 'rtl' : 'ltr'))

  // ── 2. buffer overrides ─────────────────────────────────────────────────────────────────────────────────────
  await grid('overrides').waitFor()
  check(`${tag} the overrides tab opens first, its two rows in force, read off the BO 4375 door`, (await page.locator('[data-row-count]').getAttribute('data-row-count')) === '2' && wire.gets.some((g) => g.startsWith('SourcingAdvisor/BufferOverrides')))
  await page.locator('[data-add]').click()
  await sheet.waitFor()
  const dlg = await sheet.boundingBox()
  check(`${tag} the side sheet docks at the inline end`, lang === 'ar' ? dlg.x < 50 : dlg.x + dlg.width > 1450, JSON.stringify(dlg))
  await sheet.locator('[data-field="store"]').fill('P905')
  await sheet.locator('[data-field="item"]').fill('104871')
  check(`${tag} with neither units nor days the form says so and does not save`, (await sheet.locator('[data-keep="none"]').count()) === 1 && (await sheet.locator('[data-save]').isDisabled()))
  await sheet.locator('[data-field="keepUnits"]').fill('3')
  await sheet.locator('[data-field="keepDays"]').fill('1.5')
  check(`${tag} units and days: the larger applies, said so`, (await sheet.locator('[data-keep="BOTH"]').count()) === 1)
  check(`${tag} store and item wins over the other three levels`, (await sheet.locator('[data-level-beats="STORE_ITEM"]').count()) === 1)
  check(`${tag} the reason is asked, and save stays off without it`, (await sheet.locator('[data-reason]').count()) === 1 && (await sheet.locator('[data-save]').isDisabled()))
  await sheet.locator('[data-reason]').fill('Vitamin D campaign; protect walk-in.')
  await page.screenshot({ path: `${SHOTS}/${lang}-override-sheet.png` })
  await sheet.locator('[data-save]').click()
  await sheet.waitFor({ state: 'detached' })
  const add = postsTo('SourcingAdvisor/BufferOverrides/Save')[0]
  check(
    `${tag} the add posts BufferOverrides/Save: the level's keys, the figures as numbers, the first day and the reason`,
    same(add, { replaces: null, level: 'STORE_ITEM', store: 'P905', item: '104871', category: null, keepUnits: 3, keepDays: 1.5, firstDay: TODAY, lastDay: null, reason: 'Vitamin D campaign; protect walk-in.' }),
    JSON.stringify(add),
  )
  await page.locator('[data-row-count="3"]').waitFor({ timeout: 5000 }).catch(() => {})
  check(`${tag} the new row is listed`, (await page.locator('[data-row-count]').getAttribute('data-row-count')) === '3')
  const newId = wire.db.overrides.at(-1).id
  await cell('overrides', newId, 'keepUnits').click()
  await sheet.waitFor()
  await sheet.locator('[data-change-reason]').first().waitFor({ timeout: 5000 }).catch(() => {})
  check(
    `${tag} the new row's history keeps who, the reason and the new values`,
    (await sheet.locator('[data-change-action="ADD"] [data-change-by]').innerText()).includes(BY) && plain(await sheet.locator('[data-change-reason]').innerText()).includes('Vitamin D campaign'),
  )
  check(`${tag} the store's and item's codes read as LTR isolates in the title`, plain(await sheet.locator('#planner-sheet-title').innerText()).includes('P905') && (await isLtrIsolate(sheet.locator('#planner-sheet-title bdi[dir="ltr"]').last())))
  await close()

  // a change replaces the row; an ending keeps its reason
  await cell('overrides', 'ov-it', 'keepDays').click()
  await sheet.waitFor()
  check(`${tag} a saved override's level and keys are fixed`, (await sheet.locator('[data-field="level"]').isDisabled()) && (await sheet.locator('[data-field="item"]').isDisabled()))
  await sheet.locator('[data-field="keepDays"]').fill('3')
  await sheet.locator('[data-reason]').fill('Second clinic opened.')
  await sheet.locator('[data-save]').click()
  await sheet.waitFor({ state: 'detached' })
  const change = postsTo('SourcingAdvisor/BufferOverrides/Save')[1]
  check(`${tag} a change posts the row it replaces, with its reason`, change?.replaces === 'ov-it' && change?.keepDays === 3 && change?.reason === 'Second clinic opened.', JSON.stringify(change))
  const changedId = wire.db.overrides.at(-1).id
  await cell('overrides', changedId, 'keepDays').waitFor({ timeout: 5000 })
  await cell('overrides', changedId, 'keepDays').click()
  await sheet.waitFor()
  await sheet.locator('[data-change-action="CHANGE"]').waitFor({ timeout: 5000 }).catch(() => {})
  const ovDiff = plain(await sheet.locator('[data-change-action="CHANGE"] [data-diff="keepDays"]').innerText().catch(() => ''))
  check(`${tag} the history follows the chain: the change (days 2 to 3, its reason) over the first add`, ovDiff.includes('2') && ovDiff.includes('3') && (await sheet.locator('[data-change-action="ADD"]').count()) === 1, ovDiff)
  check(`${tag} …read off the list with its ended rows`, wire.gets.some((g) => g.startsWith('SourcingAdvisor/BufferOverrides?withEnded=true')))
  await sheet.locator('[data-reason]').fill('Clinic closed.')
  await sheet.locator('[data-end]').click()
  await sheet.waitFor({ state: 'detached' })
  check(`${tag} an ending posts the row's id and its reason`, same(postsTo('SourcingAdvisor/BufferOverrides/End')[0], { id: changedId, reason: 'Clinic closed.' }), JSON.stringify(postsTo('SourcingAdvisor/BufferOverrides/End')[0]))

  await page.locator('[data-probe="store"]').fill('P907')
  await page.locator('[data-probe="item"]').fill('999999')
  check(`${tag} the store row applies where nothing more specific does`, (await page.locator('[data-probe-result]').getAttribute('data-probe-result')) === 'STORE')
  await page.locator('[data-probe="store"]').fill('P905')
  await page.locator('[data-probe="item"]').fill('104871')
  check(`${tag} the new store-and-item row applies to its store and item`, (await page.locator('[data-probe-result]').getAttribute('data-probe-result')) === 'STORE_ITEM')

  // ── 3. switch a rule row ────────────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-tab="rules"]').click()
  await grid('rules').waitFor()
  const coldDn = `00000000000000000000PR0011@${SEED_AT}`
  await grid('rules').locator(`.ag-row[row-id="${coldDn}"]`).first().waitFor()
  const order = await grid('rules')
    .locator('.ag-row[row-index]')
    .evaluateAll((els) => [...new Set(els.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((e) => e.getAttribute('row-id').split('@')[0].slice(-6)))])
  check(`${tag} the rules are a list by item group, then mode`, same(order, ['PR0011', 'PR0013', 'PR0006']), JSON.stringify(order))
  const coldGroup = plain(await page.locator('[data-rule-group="COLD_CHAIN:"]').innerText())
  check(`${tag} the cold chain group counts one on and one off`, /1\D+1/.test(coldGroup), coldGroup)
  await cell('rules', coldDn, 'switch').locator('[data-switch="off"]').click()
  await page.waitForTimeout(400)
  const sw = postsTo('SourcingAdvisor/ProductRules/Change')[0]
  check(
    `${tag} the switch posts ProductRules/Change: the rule's row as on screen, only its switch flipped, no reason`,
    same(sw, { rule: '00000000000000000000PR0011', group: 'COLD_CHAIN', value: '', mode: 'DAWAA_NOW', onlyFrom: [], reason: 'COLD', on: true, note: '' }),
    JSON.stringify(sw),
  )
  check(`${tag} a switch does not open the sheet`, (await sheet.count()) === 0)
  const newRule = `${wire.db.rules.at(-1).rule}@${wire.db.rules.at(-1).startedAt}`
  await cell('rules', newRule, 'switch').locator('[data-switch="on"]').waitFor({ timeout: 5000 }).catch(() => {})
  check(`${tag} the list reads the new row, switched on`, (await cell('rules', newRule, 'switch').locator('[data-switch="on"]').count()) === 1)
  await cell('rules', newRule, 'mode').click()
  await sheet.waitFor()
  await sheet.locator('[data-change-action="SWITCH_ON"]').waitFor({ timeout: 5000 }).catch(() => {})
  check(
    `${tag} a rule's sheet asks no reason, offers no ending, and its history reads "switched on"`,
    (await sheet.locator('[data-reason]').count()) === 0 &&
      (await sheet.locator('[data-reason-none]').count()) === 1 &&
      (await sheet.locator('[data-end]').count()) === 0 &&
      (await sheet.locator('[data-change-action="SWITCH_ON"]').count()) === 1,
  )
  await page.screenshot({ path: `${SHOTS}/${lang}-rule-sheet.png` })
  await close()

  // ── 4. edit a contract row ──────────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-tab="contracts"]').click()
  await grid('contracts').waitFor()
  check(`${tag} the contracts say how many rows are assumed`, (await page.locator('[data-assumed-count="1"]').count()) === 1)
  check(`${tag} a planner table offers no "show ended": its door lists only current rows`, (await page.locator('[data-show-ended]').count()) === 0)
  await cell('contracts', 'cc-1', 'cities').click()
  await sheet.waitFor()
  check(`${tag} the contract's code is fixed, its rate is not`, (await sheet.locator('[data-field="contract"]').isDisabled()) && !(await sheet.locator('[data-field="rate"]').isDisabled()))
  check(`${tag} a contract's sheet asks no reason`, (await sheet.locator('[data-reason]').count()) === 0)
  await sheet.locator('[data-field="rate"]').fill('19.5')
  await sheet.locator('[data-field="note"]').fill('Rate from the signed contract')
  await sheet.locator('[data-save]').click()
  await sheet.waitFor({ state: 'detached' })
  const edit = postsTo('SourcingAdvisor/PlannerTables/Save')[0]
  check(
    `${tag} the edit posts PlannerTables/Save: the table, its own row shape with the new rate, and the note`,
    same(edit, {
      table: 'carrierContracts',
      row: { contract: 'ARX-SD', mode: 'CARRIER_SAME_DAY', courier: 'ARAMEX', cities: ['RUH', 'JED'], cutOff: '14:00', daysToDeliver: 0, deliverBy: '22:00', rate: 19.5, collectAt: '16:00', keepsCold: false, assumed: true },
      note: 'Rate from the signed contract',
    }),
    JSON.stringify(edit),
  )
  const newContract = wire.db.tables.at(-1).id
  await cell('contracts', newContract, 'rate').waitFor({ timeout: 5000 })
  check(`${tag} the list reads the new rate`, plain(await cell('contracts', newContract, 'rate').innerText()).includes('19.50'))
  await cell('contracts', newContract, 'cities').click()
  await sheet.waitFor()
  await sheet.locator('[data-change-action="CHANGE"]').waitFor({ timeout: 5000 }).catch(() => {})
  const diff = plain(await sheet.locator('[data-change-action="CHANGE"] [data-diff="rate"]').innerText().catch(() => ''))
  check(
    `${tag} the history door shows the rate's old and new value, who and when`,
    diff.includes('18.00') && diff.includes('19.50') && (await sheet.locator('[data-change-action="CHANGE"] [data-change-by]').innerText()).includes(BY) && wire.gets.some((g) => g.startsWith('SourcingAdvisor/PlannerTables/History?table=carrierContracts&key=ARX-SD')),
    diff,
  )
  check(`${tag} the history keeps the version it replaced (the seeded add)`, (await sheet.locator('[data-change-action="ADD"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/${lang}-contract-history.png` })
  await close()

  // ── 5. a list entry is added or taken off, never changed ────────────────────────────────────────────────────
  await page.locator('[data-tab="restricted"]').click()
  const entry = `RESTRICTED|ITEM|300114@${SEED_AT}`
  await cell('restricted', entry, 'code').click()
  await sheet.waitFor()
  check(`${tag} a list entry opens with no save, only "take off the list"`, (await sheet.locator('[data-save]').count()) === 0 && (await sheet.locator('[data-end]').count()) === 1)
  await sheet.locator('[data-end]').click()
  await sheet.waitFor({ state: 'detached' })
  check(`${tag} taking it off posts Lists/Remove`, same(postsTo('SourcingAdvisor/ProductRules/Lists/Remove')[0], { list: 'RESTRICTED', kind: 'ITEM', code: '300114' }), JSON.stringify(postsTo('SourcingAdvisor/ProductRules/Lists/Remove')[0]))
  await page.locator('[data-add]').click()
  await sheet.waitFor()
  await sheet.locator('[data-field="code"]').fill('109310')
  await sheet.locator('[data-field="note"]').fill('Pregabalin, our own restriction')
  await sheet.locator('[data-save]').click()
  await sheet.waitFor({ state: 'detached' })
  check(
    `${tag} adding posts Lists/Add with the list, the kind and the code`,
    same(postsTo('SourcingAdvisor/ProductRules/Lists/Add')[0], { list: 'RESTRICTED', kind: 'ITEM', code: '109310', note: 'Pregabalin, our own restriction' }),
    JSON.stringify(postsTo('SourcingAdvisor/ProductRules/Lists/Add')[0]),
  )

  // ── 6. every tab without a raw key ──────────────────────────────────────────────────────────────────────────
  let raw = ''
  for (const t of ['overrides', 'confidence', 'rules', 'restricted', 'bulky', 'storeModes', 'contracts', 'slots']) {
    await page.locator(`[data-tab="${t}"]`).click()
    await page.locator(`[data-planner-table="${t}"] [data-planner-grid], [data-planner-table="${t}"] [data-planner-empty]`).first().waitFor({ timeout: 10000 })
    const hit = RAW_KEY.exec(await page.locator('main').innerText())
    if (hit) raw += `${t}: ${hit[0]}; `
  }
  check(`${tag} no raw key on any tab`, raw === '', raw)
  check(`${tag} no page error`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

async function run() {
  const browser = await chromium.launch(process.env.PLAYWRIGHT_CHANNEL ? { channel: process.env.PLAYWRIGHT_CHANNEL } : {})
  try {
    for (const lang of ['en', 'ar']) await scenario(browser, lang)
  } finally {
    await browser.close()
  }
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exit(failed.length ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
