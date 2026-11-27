// Sourcing planner data drive (ticket 968, BackOffice spec 4354 §19) — drives the REAL app against a STUBBED wire. The
// planner doors (BackOffice 4361, 4362, 4375) are not built and not specified: the stub serves the page's PROVISIONAL
// shapes (`src/core/models/sourcing-planner.ts`, paths in `src/features/oms/sourcing-planner/api.ts`) from an
// in-memory store that, like the server the tickets ask for, never changes a row in place: a change ends the row,
// writes a new version and logs who, when, old and new (and the reason, for the two BO 4375 tables).
//
// Left to right and right to left (`oms.locale = 'ar'` sets dir="rtl"; the app's words stay English, as on every
// screen, so the RTL pass proves the mirroring and the isolation), asserts:
//   1. a tab is hidden without its grant (the owner's variant A): the buffer grant alone shows two tabs; no planner
//      grant says no access;
//   2. add an override: the sheet asks for units or days and a reason, refuses to save without the reason, and posts
//      the level's target, the figures as numbers, the first day and the reason; the new row is listed and its history
//      reads the reason; "which override applies" names the store-and-item row over the item row;
//   3. switch a rule row straight from the list: the change posts the version on screen with only its switch flipped
//      and no reason (BO 4362 keeps none); the sheet does not open; a rule row's sheet asks no reason;
//   4. edit a contract row in its sheet: the rate changes, no reason is asked or sent, and the new version's history
//      shows the rate's old and new value, who and when;
//   5. the side sheet docks at the inline end (right in English, left in Arabic); a store's code and name read as one
//      LTR isolate;
//   6. no page error and no raw key.
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

const ALL = ['SourcingPlannerBuffer:01', 'SourcingPlannerRules:01', 'SourcingPlannerTables:01']
const pad = (n) => String(n).padStart(2, '0')
const d = new Date()
const TODAY = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

const CHOICES = {
  stores: [
    { code: 'P901', name: 'Al Malqa 1' },
    { code: 'P905', name: 'As Sahafa' },
    { code: 'P907', name: 'King Fahd Road' },
    { code: 'B001', name: 'Bonded store' },
  ],
  categories: [
    { code: 'MC0140', name: 'Diabetes care' },
    { code: 'MC0312', name: 'Infant formula' },
  ],
  subCategories: [{ code: 'SC0412', name: 'Baby diapers' }],
}
const DOORS = {
  BufferOverrides: 'overrides',
  StockConfidence: 'confidence',
  ProductRules: 'rules',
  RestrictedList: 'restricted',
  BulkyList: 'bulky',
  StoreModes: 'storeModes',
  CarrierContracts: 'contracts',
  SlotRules: 'slots',
}
const SEED_AT = '2026-11-01 07:00:00'

function seed() {
  const db = { rows: {}, changes: {}, seq: 0 }
  for (const t of Object.values(DOORS)) {
    db.rows[t] = []
    db.changes[t] = []
  }
  const put = (t, id, values, extra = {}) => {
    db.rows[t].push({ id, values, setAt: SEED_AT, setBy: 'seed', replaces: null, endedAt: null, endedBy: null, ...extra })
    db.changes[t].push({ id: `c-${id}`, rowId: id, action: 'ADD', diffs: Object.entries(values).filter(([, v]) => v != null).map(([field, v]) => ({ field, old: null, new: v })), reason: extra.reason ?? null, by: 'seed', at: SEED_AT })
  }
  put('overrides', 'ov-it', { level: 'ITEM', store: null, item: '121007', category: null, keepUnits: null, keepDays: 2, firstDay: '2026-10-15', lastDay: null }, { names: { item: 'Insulin glargine pen' }, reason: 'Clinic next door.' })
  put('overrides', 'ov-st', { level: 'STORE', store: 'P907', item: null, category: null, keepUnits: null, keepDays: 1, firstDay: '2026-11-20', lastDay: null }, { names: { store: 'King Fahd Road' }, reason: 'Winter season.' })
  put('confidence', 'cf-p905', { store: 'P905', confidence: 0.8, endDay: '2026-12-20' }, { names: { store: 'As Sahafa' }, reason: 'Renovation.' })
  put('rules', 'cold-dn', { groupKind: 'COLD_CHAIN', group: 'COLD', ruleKind: 'NOT_BY_MODE', mode: 'DAWAA_NOW', stores: null, on: false }, { names: { group: 'Cold chain' } })
  put('rules', 'cold-cnd', { groupKind: 'COLD_CHAIN', group: 'COLD', ruleKind: 'NOT_BY_MODE', mode: 'CARRIER_NEXT_DAY', stores: null, on: true }, { names: { group: 'Cold chain' } })
  put('rules', 'restr-dn', { groupKind: 'NAMED_LIST', group: 'RESTRICTED', ruleKind: 'NOT_BY_MODE', mode: 'DAWAA_NOW', stores: null, on: true }, { names: { group: 'Restricted list' } })
  put('restricted', 'rs-109310', { item: '109310', source: 'SAP' }, { names: { item: 'Pregabalin 75 mg' }, lockedBy: 'SAP', setBy: 'SAP' })
  put('bulky', 'bk-sc0412', { kind: 'SUB_CATEGORY', code: 'SC0412' }, { names: { code: 'Baby diapers' } })
  put('storeModes', 'sm-p905', { store: 'P905', DAWAA_NOW: true, SLOT: true, CARRIER_SAME_DAY: true, CARRIER_NEXT_DAY: true, BEYOND_BORDER: false, PICK_UP: true, note: null }, { names: { store: 'As Sahafa' } })
  put('contracts', 'arx-csd', { courier: 'ARX', mode: 'CARRIER_SAME_DAY', cities: 'Riyadh, Jeddah', cutoff: '14:00', daysToDeliver: 0, deliveredBy: '22:00', rate: 18, collectionTime: '16:00', keepsCold: false, assumed: true })
  put('contracts', 'smsa-cnd', { courier: 'SMSA', mode: 'CARRIER_NEXT_DAY', cities: 'Whole country', cutoff: '20:00', daysToDeliver: 1, deliveredBy: '22:00', rate: 12.5, collectionTime: '22:00', keepsCold: false, assumed: false })
  put('slots', 'sl-08', { from: '08:00', to: '10:00', ordersUntil: '07:30', day: 'SAME_DAY', on: true })
  return db
}

const same = (a, b) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null)
const stamp = (db) => `2026-11-27 10:${pad(30 + ++db.seq)}:00`

function apply(db, table, verb, body) {
  const rows = db.rows[table]
  const by = 'msartawi'
  const at = stamp(db)
  if (verb === 'Add') {
    const id = `${table}-n${db.seq}`
    const row = { id, values: body.values, setAt: at, setBy: by, replaces: null, endedAt: null, endedBy: null }
    rows.push(row)
    db.changes[table].unshift({ id: `c${db.seq}`, rowId: id, action: 'ADD', diffs: Object.entries(body.values).filter(([, v]) => v != null).map(([field, v]) => ({ field, old: null, new: v })), reason: body.reason ?? null, by, at })
    return row
  }
  const old = rows.find((r) => r.id === body.rowId)
  if (!old || old.endedAt) return null
  old.endedAt = at
  old.endedBy = by
  if (verb === 'End') {
    db.changes[table].unshift({ id: `c${db.seq}`, rowId: old.id, action: 'END', diffs: [], reason: body.reason ?? null, by, at })
    return old
  }
  const diffs = Object.keys({ ...old.values, ...body.values }).filter((k) => !same(old.values[k], body.values[k])).map((field) => ({ field, old: old.values[field] ?? null, new: body.values[field] ?? null }))
  const id = `${table}-n${db.seq}`
  const row = { ...old, id, values: body.values, setAt: at, setBy: by, replaces: old.id, endedAt: null, endedBy: null }
  rows.push(row)
  const action = diffs.length === 1 && diffs[0].field === 'on' ? (diffs[0].new ? 'SWITCH_ON' : 'SWITCH_OFF') : 'CHANGE'
  db.changes[table].unshift({ id: `c${db.seq}`, rowId: id, action, diffs, reason: body.reason ?? null, by, at })
  return row
}

function history(db, table, rowId) {
  const versions = []
  let cur = db.rows[table].find((r) => r.id === rowId)
  while (cur) {
    versions.push(cur)
    cur = cur.replaces ? db.rows[table].find((r) => r.id === cur.replaces) : null
  }
  const ids = new Set(versions.map((v) => v.id))
  return { versions, changes: db.changes[table].filter((c) => ids.has(c.rowId)) }
}

const plain = (text) => text.replace(/[⁦-⁩]/g, '')
const isLtrIsolate = (locator) => locator.evaluate((el) => !!el.closest('bdi[dir="ltr"]') || !!el.querySelector('bdi[dir="ltr"]'))
const RAW_KEY = /\b(fields|opt|tabs|notes|label|hints|problems|sheet|list|probe|override|toast|access|grants|actions|reason|switch)\.[A-Za-z_]+/

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

  const wire = { grants: ALL, db: seed(), posts: [] }
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(wire.grants))
    if (p === 'SourcingAdvisor/Planner/Choices') return route.fulfill(envelope(CHOICES))
    const m = /^SourcingAdvisor\/Planner\/([A-Za-z]+)(?:\/([A-Za-z]+))?$/.exec(p ?? '')
    if (m && DOORS[m[1]]) {
      const table = DOORS[m[1]]
      const verb = m[2]
      if (!verb) {
        const withEnded = url.searchParams.get('withEnded') === 'true'
        const all = wire.db.rows[table]
        const rows = all.filter((r) => !r.endedAt || (withEnded && !all.some((x) => x.replaces === r.id)))
        return route.fulfill(envelope({ rows }))
      }
      if (verb === 'History') return route.fulfill(envelope(history(wire.db, table, url.searchParams.get('rowId'))))
      const body = JSON.parse(route.request().postData() || '{}')
      wire.posts.push({ table, verb, body })
      return route.fulfill(envelope(apply(wire.db, table, verb, body)))
    }
    return route.fulfill(envelope({}))
  })

  const open = async (query = '') => {
    await page.goto(`${BASE}/oms/sourcing-planner${query}`)
    await page.locator('[data-sourcing-planner], [role="alert"]').first().waitFor({ timeout: 20000 })
  }
  const tabs = async () => page.locator('[data-tab]').evaluateAll((els) => els.map((e) => e.getAttribute('data-tab')))
  const sheet = page.locator('dialog[open][data-row-sheet]')
  const grid = (table) => page.locator(`[data-planner-grid="${table}"]`)
  const cell = (table, rowId, col) => grid(table).locator(`.ag-row[row-id="${rowId}"] [col-id="${col}"]`).first()
  const postsOf = (table, verb) => wire.posts.filter((x) => x.table === table && x.verb === verb)

  // ── 1. a tab is hidden without its grant ──────────────────────────────────────────────────────────────────────
  wire.grants = ['SourcingPlannerBuffer:01']
  await open()
  check(`${tag} the buffer grant alone shows the two buffer tabs only`, JSON.stringify(await tabs()) === JSON.stringify(['overrides', 'confidence']), JSON.stringify(await tabs()))
  wire.grants = ['SourcingSimulator:03']
  await open()
  check(`${tag} no planner grant: no access, no tab`, (await page.locator('[role="alert"]').count()) === 1 && (await page.locator('[data-tab]').count()) === 0)
  wire.grants = ALL
  await open()
  check(`${tag} all three grants: the eight tabs in their groups`, (await tabs()).length === 8 && (await page.locator('[data-tab-group]').count()) === 3)
  check(`${tag} the page is ${lang === 'ar' ? 'right to left' : 'left to right'}`, (await page.evaluate(() => document.documentElement.dir)) === (lang === 'ar' ? 'rtl' : 'ltr'))

  // ── 2. add an override ──────────────────────────────────────────────────────────────────────────────────────
  await grid('overrides').waitFor()
  check(`${tag} the overrides tab opens first, its two rows in force`, (await page.locator('[data-row-count]').getAttribute('data-row-count')) === '2')
  await page.locator('[data-add]').click()
  await sheet.waitFor()
  const dlg = await sheet.boundingBox()
  check(`${tag} the side sheet docks at the inline end`, lang === 'ar' ? dlg.x < 50 : dlg.x + dlg.width > 1450, JSON.stringify(dlg))
  await sheet.locator('[data-field="store"]').selectOption('P905')
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
  const add = postsOf('overrides', 'Add')[0]?.body
  check(
    `${tag} the add posts the level's target, the figures as numbers, the first day and the reason`,
    same(add, {
      values: { level: 'STORE_ITEM', store: 'P905', item: '104871', category: null, keepUnits: 3, keepDays: 1.5, firstDay: TODAY, lastDay: null },
      reason: 'Vitamin D campaign; protect walk-in.',
    }),
    JSON.stringify(add),
  )
  await page.locator('[data-row-count="3"]').waitFor({ timeout: 5000 }).catch(() => {})
  check(`${tag} the new row is listed`, (await page.locator('[data-row-count]').getAttribute('data-row-count')) === '3')
  const newId = wire.db.rows.overrides.at(-1).id
  await cell('overrides', newId, 'keepUnits').click()
  await sheet.waitFor()
  await sheet.locator('[data-change-reason]').first().waitFor({ timeout: 5000 }).catch(() => {})
  check(`${tag} the new row's history keeps who, the reason and the new values`, (await sheet.locator('[data-change-action="ADD"] [data-change-by]').innerText()).includes('msartawi') && plain(await sheet.locator('[data-change-reason]').innerText()).includes('Vitamin D campaign'))
  check(`${tag} the store's code and name read as one LTR isolate in the title`, plain(await sheet.locator('#planner-sheet-title').innerText()).includes('P905 · As Sahafa') && (await isLtrIsolate(sheet.locator('#planner-sheet-title bdi[dir="ltr"]').last())))
  await sheet.locator('header button[aria-label]').click()
  await sheet.waitFor({ state: 'detached' })
  await page.locator('[data-probe="store"]').selectOption('P905')
  await page.locator('[data-probe="item"]').fill('121007')
  check(`${tag} with no store-and-item row for it, the item row applies`, (await page.locator('[data-probe-result]').getAttribute('data-probe-result')) === 'ITEM')
  await page.locator('[data-probe="item"]').fill('104871')
  check(`${tag} the new store-and-item row applies to its store and item`, (await page.locator('[data-probe-result]').getAttribute('data-probe-result')) === 'STORE_ITEM')

  // ── 3. switch a rule row ────────────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-tab="rules"]').click()
  await grid('rules').waitFor()
  await grid('rules').locator('.ag-row[row-id="cold-dn"]').first().waitFor()
  const order = await grid('rules')
    .locator('.ag-row[row-index]')
    .evaluateAll((els) => [...new Set(els.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((e) => e.getAttribute('row-id')))])
  check(`${tag} the rules are a list by item group, then mode`, JSON.stringify(order) === JSON.stringify(['cold-dn', 'cold-cnd', 'restr-dn']), JSON.stringify(order))
  const coldGroup = plain(await page.locator('[data-rule-group="COLD_CHAIN:COLD"]').innerText())
  check(`${tag} the cold chain group counts one on and one off`, /1\D+1/.test(coldGroup), coldGroup)
  await cell('rules', 'cold-dn', 'switch').locator('[data-switch="off"]').click()
  await page.waitForTimeout(400)
  const sw = postsOf('rules', 'Change')[0]?.body
  check(
    `${tag} the switch posts the version on screen, only its switch flipped, with no reason`,
    same(sw, { rowId: 'cold-dn', values: { groupKind: 'COLD_CHAIN', group: 'COLD', ruleKind: 'NOT_BY_MODE', mode: 'DAWAA_NOW', stores: null, on: true } }),
    JSON.stringify(sw),
  )
  check(`${tag} a switch does not open the sheet`, (await sheet.count()) === 0)
  const newRule = wire.db.rows.rules.at(-1).id
  await cell('rules', newRule, 'switch').locator('[data-switch="on"]').waitFor({ timeout: 5000 }).catch(() => {})
  check(`${tag} the list reads the new version, switched on`, (await cell('rules', newRule, 'switch').locator('[data-switch="on"]').count()) === 1)
  await cell('rules', newRule, 'mode').click()
  await sheet.waitFor()
  await sheet.locator('[data-change-action="SWITCH_ON"]').waitFor({ timeout: 5000 }).catch(() => {})
  check(`${tag} a rule's sheet asks no reason, and its history reads "switched on"`, (await sheet.locator('[data-reason]').count()) === 0 && (await sheet.locator('[data-reason-none]').count()) === 1 && (await sheet.locator('[data-change-action="SWITCH_ON"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/${lang}-rule-sheet.png` })
  await sheet.locator('header button[aria-label]').click()
  await sheet.waitFor({ state: 'detached' })

  // ── 4. edit a contract row ──────────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-tab="contracts"]').click()
  await grid('contracts').waitFor()
  check(`${tag} the contracts say how many rows are assumed`, (await page.locator('[data-assumed-count="1"]').count()) === 1)
  await cell('contracts', 'arx-csd', 'cities').click()
  await sheet.waitFor()
  check(`${tag} the contract's courier and mode are fixed, its rate is not`, (await sheet.locator('[data-field="courier"]').isDisabled()) && (await sheet.locator('[data-field="mode"]').isDisabled()) && !(await sheet.locator('[data-field="rate"]').isDisabled()))
  check(`${tag} a contract's sheet asks no reason`, (await sheet.locator('[data-reason]').count()) === 0)
  await sheet.locator('[data-field="rate"]').fill('19.5')
  await sheet.locator('[data-save]').click()
  await sheet.waitFor({ state: 'detached' })
  const edit = postsOf('contracts', 'Change')[0]?.body
  check(
    `${tag} the edit posts the row's id and every value, the rate changed, no reason`,
    same(edit, {
      rowId: 'arx-csd',
      values: { courier: 'ARX', mode: 'CARRIER_SAME_DAY', cities: 'Riyadh, Jeddah', cutoff: '14:00', daysToDeliver: 0, deliveredBy: '22:00', rate: 19.5, collectionTime: '16:00', keepsCold: false, assumed: true },
    }),
    JSON.stringify(edit),
  )
  const newContract = wire.db.rows.contracts.at(-1).id
  await cell('contracts', newContract, 'rate').waitFor({ timeout: 5000 })
  check(`${tag} the list reads the new rate`, plain(await cell('contracts', newContract, 'rate').innerText()).includes('19.50'))
  await cell('contracts', newContract, 'cities').click()
  await sheet.waitFor()
  await sheet.locator('[data-change-action="CHANGE"]').waitFor({ timeout: 5000 }).catch(() => {})
  const diff = plain(await sheet.locator('[data-change-action="CHANGE"] [data-diff="rate"]').innerText().catch(() => ''))
  check(`${tag} the history shows the rate's old and new value, who and when`, diff.includes('18.00') && diff.includes('19.50') && (await sheet.locator('[data-change-action="CHANGE"] [data-change-by]').innerText()).includes('msartawi'), diff)
  check(`${tag} the history keeps the version it replaced (the seeded add)`, (await sheet.locator('[data-change-action="ADD"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/${lang}-contract-history.png` })
  await sheet.locator('header button[aria-label]').click()
  await sheet.waitFor({ state: 'detached' })

  // ── 5. a locked row; every tab without a raw key ────────────────────────────────────────────────────────────
  await page.locator('[data-tab="restricted"]').click()
  await cell('restricted', 'rs-109310', 'item').click()
  await sheet.waitFor()
  check(`${tag} a row fed by SAP opens read-only`, (await sheet.locator('[data-locked="SAP"]').count()) === 1 && (await sheet.locator('[data-save]').count()) === 0)
  await sheet.locator('header button[aria-label]').click()
  await sheet.waitFor({ state: 'detached' })
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
