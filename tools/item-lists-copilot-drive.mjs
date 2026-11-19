// Item lists in the library and in Copilot's answer (oms 926, BackOffice spec 4057) — drives the REAL app in Chromium
// against STUBBED doors (`tools/analytics-stubs.mjs`), shaped from the guesses in `src/core/models/copilot.ts`
// (`usedLists`, `listPeriods`) and `src/features/analytics/boards/panel-state.ts` (`ITEM_LIST_GONE`).
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 4059–4061 were not built; the live walk on BO 4061 is
// what closes the live half.
//
// It verifies, in English (LTR) and Arabic (RTL):
//   1. the library's kind chip offers item lists and narrows to them; a list row has its icon, opens the list's page,
//      and carries its owner's share and delete (never certify); an author gets "New item list" → the upload page;
//   2. a Copilot answer that used a list shows the server's "Used" line under the assumptions, linked to the list;
//   3. the list_periods table: one column per status present, a "no periods" member, the per-status total row;
//   4. the calendar overlap is a warning line naming the event;
//   5. a saved view whose list is gone says "list not available" and draws no chart or table;
//   5b. (review) a list that goes while its answer is held: no figures behind the export / table actions or the period
//       line; the share dialog says what a list's audience can do (read, export), and Delete says "item list";
//   6. screenshots in tools/.item-lists-copilot-shots.
//
//   1. run the app:  npx vite --port 5232 --strictPort
//   2. DRIVE_PORT=5232 node tools/item-lists-copilot-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { COPILOT_ANSWER, ITEMS, LIST, QUERY, installAnalyticsStubs, refusal } from './analytics-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.item-lists-copilot-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const label = (en, ar) => ({ en, ar })

const list = (id, over = {}) => ({
  ...ITEMS['v-bar'],
  id,
  kind: 'itemlist',
  title: label('Shortage Q3', 'نقص الربع الثالث'),
  tier: 'personal',
  updatedAt: '2026-11-19T09:00:00',
  definition: { version: 1, members: [], periods: [], unknown: [] },
  ...over,
})
const LISTS = [list('il-1'), list('il-2', { title: label('Delisted brands', 'العلامات الملغاة'), tier: 'shared', owner: 'aalharbi', updatedAt: '2026-11-18T09:00:00' })]

// A saved view that reads an item list which is now gone (⚠ ANALYTICS-434 is the guessed code).
const GONE_VIEW = { ...ITEMS['v-bar'], id: 'v-list-gone', title: label('Shortage Q3 by region', 'نقص الربع الثالث حسب المنطقة'), definition: { ...ITEMS['v-bar'].definition, query: { ...ITEMS['v-bar'].definition.query, itemList: 'il-9' } } }

// The same, but its list goes while its first answer is on screen: the refresh answers ANALYTICS-434.
const STALE_VIEW = { ...GONE_VIEW, id: 'v-list-stale' }
const STALE_FIRST = { ...QUERY['v-bar'], period: { from: '2026-10-01', to: '2026-10-30' } }

const USED = {
  en: 'Used: Shortage Q3 (v4), 38 items, periods stated by the team',
  ar: 'المستخدمة: نقص الربع الثالث (الإصدار 4)، 38 صنفًا، فترات حددها الفريق',
}
const answerIn = (lang) => ({
  ...COPILOT_ANSWER,
  answer: lang === 'ar' ? 'تعافت مبيعات القائمة بنسبة 18% يوميًا بعد عودة التوفر.' : 'The list recovered 18% per day once available again.',
  trace: [{ tool: 'list_periods', input: { itemList: 'il-1', measure: 'units' }, rows: 3, ms: 900, ok: true }],
  ...(lang === 'ar' ? { language: 'ar' } : {}),
  assumptions: [label('Last quarter is July to September.', 'الربع الماضي من يوليو إلى سبتمبر.')],
  usedLists: [{ listId: 'il-1', name: 'Shortage Q3', version: 4, members: 38, line: label(USED.en, USED.ar) }],
  listPeriods: {
    step: 0,
    listId: 'il-1',
    measure: 'units',
    members: [
      { level: 'item', key: '100234', label: 'Panadol 500mg', noPeriods: false, change: 0.18, segments: [{ status: 'available', days: 30, perDay: 118 }, { status: 'unavailable', days: 12, perDay: 100 }] },
      { level: 'brand', key: 'NUTRI', label: 'نوتري', noPeriods: false, change: -0.05, segments: [{ status: 'blocked', days: 5, perDay: 40 }, { status: 'available', days: 20, perDay: 38 }] },
      { level: 'item', key: '100999', label: 'Brufen 400mg', noPeriods: true, change: null, segments: [] },
    ],
    totals: [{ status: 'available', days: 50, perDay: 156 }, { status: 'unavailable', days: 12, perDay: 100 }, { status: 'blocked', days: 5, perDay: 40 }],
    overlaps: [{ member: 'Panadol 500mg', status: 'unavailable', from: '2026-02-20', to: '2026-03-03', event: label('Ramadan', 'رمضان'), eventFrom: '2026-02-18', eventTo: '2026-03-19' }],
  },
})

const browser = await chromium.launch()

async function open(dir, opts = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  const stub = await installAnalyticsStubs(page, {
    list: [...LIST, ...LISTS],
    items: { ...ITEMS, 'v-list-gone': GONE_VIEW, 'v-list-stale': STALE_VIEW },
    query: { ...QUERY, 'v-list-gone': refusal('ANALYTICS-434', 'The item list is not available.', 404), 'v-list-stale': STALE_FIRST },
    querySequence: { 'v-list-stale': [STALE_FIRST, refusal('ANALYTICS-434', 'The item list is not available.', 404)] },
    copilot: 'granted',
    copilotAnswer: answerIn(dir === 'rtl' ? 'ar' : 'en'),
    ...opts,
  })
  return { context, page, errors, stub }
}

async function walk(dir) {
  const L = dir.toUpperCase()
  const { context, page, errors, stub } = await open(dir)

  // 1. the library
  await page.goto(`${BASE}/analytics/library`, { timeout: 180000 })
  await page.locator('[data-analytics-chip-kind="itemlist"]').waitFor({ timeout: 120000 })
  check(`${L}: the page is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  const kinds = await page.locator('[data-analytics-chip-kind]').evaluateAll((els) => els.map((e) => e.getAttribute('data-analytics-chip-kind')))
  check(`${L}: the kind chips end with item lists`, kinds.join() === 'all,view,board,report,itemlist', kinds.join())
  const newList = page.locator('[data-analytics-new-itemlist]')
  check(`${L}: an author gets New item list → the upload page`, (await newList.getAttribute('href')) === '/analytics/itemlist/new')
  await page.locator('[data-analytics-chip-kind="itemlist"]').click()
  await page.waitForURL(/kind=itemlist/)
  await page.waitForFunction(() => document.querySelectorAll('[data-analytics-item]').length === 2, null, { timeout: 10000 }).catch(() => null)
  const shown = await page.locator('[data-analytics-item]').evaluateAll((els) => els.map((e) => e.getAttribute('data-analytics-item')))
  check(`${L}: the chip narrows to the two lists`, shown.join() === 'il-1,il-2', shown.join())
  check(`${L}: the door is asked kind=itemlist`, (stub.gets['Analytics/Items'] ?? []).some((q) => q.kind === 'itemlist'))
  const mine = page.locator('[data-analytics-item="il-1"]')
  check(`${L}: a list row opens the list's page`, (await mine.locator('a').first().getAttribute('href')) === '/analytics/itemlist/il-1')
  const icon = await mine.locator('svg[aria-label]').first().getAttribute('aria-label')
  check(`${L}: a list row is labelled an item list`, icon === 'Item list', icon)
  const mineActions = await mine.locator('[data-analytics-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-analytics-action')))
  check(`${L}: my list offers share and delete, never certify`, mineActions.join() === 'share,delete', mineActions.join())
  const theirs = await page.locator('[data-analytics-item="il-2"] [data-analytics-action]').count()
  check(`${L}: someone else's Shared list offers an author nothing to change`, theirs === 0)
  await page.screenshot({ path: `${SHOTS}/${dir}-library.png`, fullPage: true })
  await mine.locator('[data-analytics-action="share"]').click()
  await page.locator('[data-analytics-share-everyone]').waitFor({ timeout: 5000 })
  check(`${L}: Share opens the item's share dialog for a list`, true)
  const shareWords = await page.locator('[data-analytics-share]').innerText()
  check(`${L}: … saying a list's audience reads and exports it, never runs it`, shareWords.includes('open it and read its items and periods') && shareWords.includes('export it as a workbook') && !shareWords.includes('change every parameter') && !shareWords.includes('share.'), shareWords.replace(/\s+/g, ' ').slice(0, 300))
  await page.keyboard.press('Escape')
  await page.locator('[data-analytics-share]').waitFor({ state: 'detached', timeout: 5000 })
  await mine.locator('[data-analytics-action="delete"]').click()
  const confirm = page.locator('dialog').filter({ has: page.locator('[data-analytics-confirm="delete"]') })
  await confirm.waitFor({ timeout: 5000 })
  const confirmWords = await confirm.innerText()
  check(`${L}: Delete's confirm says "item list", never a raw key`, confirmWords.includes('This item list is deleted for everyone') && !confirmWords.includes('tierActions.'), confirmWords.replace(/\s+/g, ' ').slice(0, 300))
  await page.keyboard.press('Escape')
  await confirm.waitFor({ state: 'detached', timeout: 5000 })

  // 2–4. the Copilot answer
  await page.locator('[data-copilot-button]').click()
  const sheet = page.locator('[data-copilot-sheet]')
  await sheet.locator('[data-copilot-question]').fill(dir === 'rtl' ? 'كيف بيعت قائمة نقص الربع الثالث أثناء عدم التوفر؟' : 'How did Shortage Q3 sell while unavailable vs after?')
  await sheet.locator('[data-copilot-send]').click()
  await sheet.locator('[data-copilot-used-lists]').waitFor({ timeout: 15000 })
  const used = (await sheet.locator('[data-copilot-used-line]').innerText()).trim()
  check(`${L}: the Used line is the server's, in the question's language`, used === (dir === 'rtl' ? USED.ar : USED.en), used)
  check(`${L}: … and links the list`, (await sheet.locator('[data-copilot-used-list-link]').getAttribute('href')) === '/analytics/itemlist/il-1')
  const order = await sheet.evaluate((s) => {
    const a = s.querySelector('[data-copilot-assumptions]')
    const u = s.querySelector('[data-copilot-used-lists]')
    return !!a && !!u && !!(a.compareDocumentPosition(u) & Node.DOCUMENT_POSITION_FOLLOWING)
  })
  check(`${L}: … under the assumption lines`, order)
  const statuses = await sheet.locator('[data-copilot-list-periods-table] thead [data-status]').evaluateAll((els) => els.map((e) => e.getAttribute('data-status')))
  check(`${L}: list_periods: a column per status present, in order`, statuses.join() === 'unavailable,blocked,available', statuses.join())
  check(`${L}: … a row per member`, (await sheet.locator('[data-copilot-list-member]').count()) === 3)
  check(`${L}: … the member without periods says so`, (await sheet.locator('[data-copilot-list-member="item:100999"] [data-copilot-no-periods]').count()) === 1)
  const total = await sheet.locator('[data-copilot-list-periods-total] [data-status]').evaluateAll((els) => els.map((e) => e.textContent.trim()))
  check(`${L}: … the per-status total row`, total.join('|') === '100|40|156', total.join('|'))
  const change = (await sheet.locator('[data-copilot-list-member="item:100234"] td').last().innerText()).trim()
  check(`${L}: … the change, signed`, change === '+18.0%', change)
  const warning = page.locator('[data-copilot-calendar-warning="unavailable"]')
  check(`${L}: the calendar overlap is a warning line`, (await warning.count()) === 1)
  const w = (await warning.innerText()).trim()
  check(`${L}: … naming the event and both periods`, w.includes(dir === 'rtl' ? 'رمضان' : 'Ramadan') && w.includes('2026-02-20') && w.includes('2026-03-19'), w)
  await sheet.locator('[data-copilot-list-periods]').scrollIntoViewIfNeeded()
  await sheet.screenshot({ path: `${SHOTS}/${dir}-copilot.png` })
  await page.keyboard.press('Escape')

  // 5. a saved view whose list is gone
  await page.goto(`${BASE}/analytics/view/v-list-gone`, { timeout: 120000 })
  await page.locator('[data-panel-list-gone]').waitFor({ timeout: 15000 })
  const state = await page.locator('[data-board-panel-state]').first().getAttribute('data-board-panel-state')
  check(`${L}: the panel's state is listGone`, state === 'listGone', state)
  const figures = await page.evaluate(() => document.querySelectorAll('[data-board-panel-state] canvas, [data-board-panel-state] svg.recharts-surface, [data-board-panel-state] .ag-row, [data-board-panel-state] [data-panel-empty]').length)
  check(`${L}: … and no figures, chart or table`, figures === 0, String(figures))
  const words = (await page.locator('[data-panel-list-gone]').innerText()).trim()
  check(`${L}: … it says the list is not available`, dir === 'rtl' ? words.includes('القائمة غير متاحة') || words.includes('List not available') : words.includes('List not available'), words)
  await page.screenshot({ path: `${SHOTS}/${dir}-list-gone.png`, fullPage: true })

  // 5b. the list goes while its first answer is held: the refresh's refusal leaves no figures anywhere
  await page.goto(`${BASE}/analytics/view/v-list-stale`, { timeout: 120000 })
  await page.locator('[data-analytics-period]').waitFor({ timeout: 15000 })
  const csv = page.locator('[data-panel-action="csv"]')
  check(`${L}: (held answer) CSV and the period line are there first`, (await csv.isEnabled()) && (await page.locator('[data-analytics-period]').count()) === 1)
  await page.locator('[data-panel-action="refresh"]').click()
  await page.locator('[data-panel-list-gone]').waitFor({ timeout: 15000 })
  const disabled = await page.locator('[data-panel-action]').evaluateAll((els) => els.filter((e) => ['table', 'csv', 'xlsx', 'png'].includes(e.getAttribute('data-panel-action'))).map((e) => e.disabled))
  check(`${L}: (list gone) table, CSV, XLSX and PNG are all off`, disabled.length === 4 && disabled.every(Boolean), disabled.join())
  check(`${L}: (list gone) no period line`, (await page.locator('[data-analytics-period]').count()) === 0)

  check(`${L}: no console or page errors`, errors.length === 0, errors.join(' | ').slice(0, 400))
  await context.close()
}

try {
  await walk('ltr')
  await walk('rtl')
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
