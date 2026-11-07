// 846 — the report designer half: smoother drag and drop and roomier panes (stubbed analytics doors, as
// `tools/analytics-drive.mjs` does, through `./analytics-stubs.mjs`).
//
//   1. the outline and inspector panes resize by their separators, and the widths are remembered across a reload;
//      an outline row cut short carries its full name on hover;
//   2. dragging a block shows ONE primary line on the nearest edge of the hovered block, moves with the pointer,
//      and none over the block's own place; the drop lands exactly at the line; Ctrl+Z puts it back;
//   3. on a long report, a drag held near the bottom edge scrolls the page gradually (no jump to the end);
//   4. the Views tab: a view dragged into a section lands at the line as a copied panel; "+" adds one to the
//      selected section;
//   5. keyboard: Delete removes the selected block, Ctrl+D duplicates it (selected), Esc clears the selection;
//      each one undo step;
//   6. no page errors. en (LTR) and ar (RTL).
//
//   1. run the app:  npx vite --port 5197 --strictPort
//   2. DRIVE_PORT=5197 node tools/report-designer-846-drive.mjs
import { createRequire } from 'node:module'
import { ITEMS, LIST, MODEL_827, installAnalyticsStubs } from './analytics-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5197}`
const AUTHOR = { canView: true, canAuthor: true, canCurate: false }
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const noIsolates = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '')

const browser = await chromium.launch()

async function open({ dir, height = 1400 }) {
  const context = await browser.newContext({ viewport: { width: 1440, height } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(
    ({ dir }) => {
      localStorage.setItem('oms.locale', dir === 'rtl' ? 'ar' : 'en')
      localStorage.setItem('oms.railExpanded', 'true')
    },
    { dir },
  )
  const stub = await installAnalyticsStubs(page, { access: AUTHOR, model: MODEL_827, list: [...LIST, ITEMS['v-825']] })
  return { context, page, errors, ...stub }
}

/** A new report holding the product's sample (four sections, four panels: a long page). */
async function sampleDesigner(page) {
  await page.goto(`${BASE}/analytics/new?kind=report`)
  await page.locator('[data-report-designer="new"]').waitFor({ timeout: 30000 })
  await page.locator('[data-designer-tutorial-action]').click()
  await page.locator('[data-designer-tutorial-load]').click()
  await page.locator('[data-designer-tutorial-close]').click()
  await page.locator('[data-designer-block="p4"]').waitFor({ timeout: 10000 })
}

const blocks = (page, sid) =>
  page.locator(`[data-designer-section="${sid}"] [data-designer-block]`).evaluateAll((els) => els.map((e) => e.dataset.designerBlock).join(','))
const lines = (page) =>
  page.locator('[data-designer-page] [data-designer-drop-line]').evaluateAll((els) =>
    els.map((e) => {
      const owner = e.parentElement.closest('[data-designer-block], [data-designer-section]')
      const r = e.getBoundingClientRect()
      return { edge: e.dataset.designerDropLine, block: owner?.dataset.designerBlock ?? null, section: owner?.dataset.designerSection ?? null, y: r.top + r.height / 2 }
    }),
  )
const box = (page, sel) => page.locator(sel).first().evaluate((e) => {
  const r = e.getBoundingClientRect()
  return { x: r.left, y: r.top, w: r.width, h: r.height, bottom: r.bottom }
})
/** The element that scrolls the designer page (as `core/ui/auto-scroll` finds it). */
const scrollTop = (page) =>
  page.evaluate(() => {
    let e = document.querySelector('[data-designer-sections]')?.parentElement
    for (; e; e = e.parentElement) {
      const y = getComputedStyle(e).overflowY
      if ((y === 'auto' || y === 'scroll') && e.scrollHeight > e.clientHeight) return { top: e.scrollTop, max: e.scrollHeight - e.clientHeight }
    }
    const d = document.scrollingElement
    return { top: d.scrollTop, max: d.scrollHeight - d.clientHeight }
  })
const scrollToTop = (page) =>
  page.evaluate(() => {
    for (let e = document.querySelector('[data-designer-sections]'); e; e = e.parentElement) e.scrollTop = 0
    document.scrollingElement.scrollTop = 0
  })
/** Scroll the page so `sel`'s top sits `at` px below the window's top (and out of the auto-scroll bands). */
const scrollTo = (page, sel, at) =>
  page.evaluate(
    ({ sel, at }) => {
      const d = document.scrollingElement
      d.scrollTop += document.querySelector(sel).getBoundingClientRect().top - at
    },
    { sel, at },
  )

/** Press the mouse on a page block's grip (its tools show on hover). */
async function grabBlock(page, id) {
  await page.locator(`[data-designer-block="${id}"]`).hover({ position: { x: 40, y: 20 } })
  const g = await box(page, `[data-designer-page] [data-designer-grip="block:${id}"]`)
  await page.mouse.move(g.x + g.w / 2, g.y + g.h / 2)
  await page.mouse.down()
}

async function drive({ dir }) {
  const tag = `846 ${dir}`
  const { context, page, errors, calls } = await open({ dir })

  // 1. Panes.
  await sampleDesigner(page)
  const outlinePane = page.locator('#designer-outline-pane')
  const inspectorPane = page.locator('#designer-inspector-pane')
  const w0 = { o: Number(await outlinePane.getAttribute('data-designer-outline-pane')), i: Number(await inspectorPane.getAttribute('data-designer-inspector-pane')) }
  check(`${tag}: the panes open at their defaults (256 / 416)`, w0.o === 256 && w0.i === 416, JSON.stringify(w0))
  const sign = dir === 'rtl' ? -1 : 1
  const sepO = await box(page, '#designer-outline-pane > [role="separator"]')
  await page.mouse.move(sepO.x + sepO.w / 2, sepO.y + 200)
  await page.mouse.down()
  await page.mouse.move(sepO.x + sepO.w / 2 + sign * 80, sepO.y + 200, { steps: 6 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  const sepI = await box(page, '#designer-inspector-pane > [role="separator"]')
  await page.mouse.move(sepI.x + sepI.w / 2, sepI.y + sepI.h / 2)
  await page.mouse.down()
  await page.mouse.move(sepI.x + sepI.w / 2 - sign * 64, sepI.y + sepI.h / 2, { steps: 6 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  const w1 = { o: Number(await outlinePane.getAttribute('data-designer-outline-pane')), i: Number(await inspectorPane.getAttribute('data-designer-inspector-pane')) }
  check(`${tag}: dragging the outline's separator toward the page widens it`, w1.o === 336, String(w1.o))
  check(`${tag}: dragging the inspector's separator toward the page widens it`, w1.i === 480, String(w1.i))
  const ow = await outlinePane.evaluate((e) => e.getBoundingClientRect().width)
  check(`${tag}: … and the column itself follows`, Math.abs(ow - 336) < 1, String(ow))
  await page.reload()
  await sampleDesigner(page)
  const w2 = { o: Number(await outlinePane.getAttribute('data-designer-outline-pane')), i: Number(await inspectorPane.getAttribute('data-designer-inspector-pane')) }
  check(`${tag}: the widths are remembered across a reload`, w2.o === 336 && w2.i === 480, JSON.stringify(w2))
  const title = noIsolates(await page.locator('[data-designer-outline="block:p3"]').getAttribute('title'))
  check(`${tag}: an outline row carries its full name on hover`, title === 'Cancellation rate: HungerStation against QC', title)

  // 2. The indicator line, on the page: t2 (s2: p2, p3, t2).
  await scrollTo(page, '[data-designer-section="s2"]', 150)
  await grabBlock(page, 't2')
  const p2 = await box(page, '[data-designer-block="p2"]')
  await page.mouse.move(p2.x + 60, p2.y + p2.h * 0.2, { steps: 5 })
  await page.waitForTimeout(150)
  let ls = await lines(page)
  check(`${tag}: over p2's top half: one line, on p2's top edge`, ls.length === 1 && ls[0].block === 'p2' && ls[0].edge === 'before' && Math.abs(ls[0].y - (p2.y - 6)) < 4, JSON.stringify(ls))
  await page.mouse.move(p2.x + 60, p2.y + p2.h * 0.8, { steps: 5 })
  await page.waitForTimeout(150)
  ls = await lines(page)
  const p3 = await box(page, '[data-designer-block="p3"]')
  check(`${tag}: over p2's bottom half: the line moves to the gap below it (p3's top edge)`, ls.length === 1 && ls[0].block === 'p3' && ls[0].edge === 'before' && ls[0].y > p2.bottom && ls[0].y < p3.y, JSON.stringify(ls))
  const t2 = await box(page, '[data-designer-block="t2"]')
  await page.mouse.move(t2.x + 60, t2.y + t2.h * 0.3, { steps: 5 })
  await page.waitForTimeout(150)
  ls = await lines(page)
  check(`${tag}: over its own place: no line (the drop would change nothing)`, ls.length === 0, JSON.stringify(ls))
  await page.mouse.move(p2.x + 60, p2.y + p2.h * 0.2, { steps: 5 })
  await page.waitForTimeout(150)
  await page.mouse.up()
  check(`${tag}: the drop lands at the line: t2 first in s2`, (await blocks(page, 's2')) === 't2,p2,p3', await blocks(page, 's2'))
  check(`${tag}: … and the line is gone`, (await lines(page)).length === 0)
  await page.locator('[data-designer-title]').click()
  await page.keyboard.press('Control+z')
  check(`${tag}: Ctrl+Z puts it back (one step)`, (await blocks(page, 's2')) === 'p2,p3,t2', await blocks(page, 's2'))

  // A section dragged on the page (s2, by its heading grip, the page at its top): the line sits between sections;
  // its own place has none. Every point stays out of the auto-scroll bands (a scroll mid-drag ends Playwright's
  // emulated drag).
  await scrollToTop(page)
  const g = await box(page, '[data-designer-page] [data-designer-grip="section:s2"]')
  await page.mouse.move(g.x + g.w / 2, g.y + g.h / 2)
  await page.mouse.down()
  const s1 = await box(page, '[data-designer-section="s1"]')
  await page.mouse.move(s1.x + 80, s1.y + s1.h - 40, { steps: 5 })
  await page.waitForTimeout(150)
  ls = await lines(page)
  check(`${tag}: a section over the one before's bottom half: its own place, no line`, ls.length === 0, JSON.stringify(ls))
  await page.mouse.move(s1.x + 80, s1.y + 40, { steps: 5 })
  await page.waitForTimeout(150)
  ls = await lines(page)
  check(`${tag}: … over its top half: one line on s1's top edge`, ls.length === 1 && ls[0].section === 's1' && ls[0].edge === 'before', JSON.stringify(ls))
  await page.mouse.up()
  const order = await page.locator('[data-designer-sections] [data-designer-section]').evaluateAll((els) => els.map((e) => e.dataset.designerSection).join(','))
  check(`${tag}: … and it lands there`, order === 's2,s1,s3,s4', order)
  if (order !== 's1,s2,s3,s4') {
    await page.locator('[data-designer-title]').click()
    await page.keyboard.press('Control+z')
  }

  // 3. Auto-scroll on a long report: p1 held near the bottom edge.
  await scrollToTop(page)
  const before = await scrollTop(page)
  check(`${tag}: the report is longer than the window`, before.max > 400, JSON.stringify(before))
  await grabBlock(page, 'p1')
  const vh = page.viewportSize().height
  await page.mouse.move(700, vh - 60, { steps: 4 })
  await page.waitForTimeout(150)
  await page.mouse.move(700, vh - 40, { steps: 2 })
  await page.waitForTimeout(150)
  await page.waitForTimeout(250)
  const early = await scrollTop(page)
  await page.waitForTimeout(700)
  const later = await scrollTop(page)
  check(`${tag}: held near the bottom edge, the page scrolls`, later.top > 0, `${early.top} → ${later.top}`)
  check(`${tag}: … gradually: after 0.25 s it has not jumped to the end`, early.top < early.max / 2, `${early.top} of ${early.max}`)
  check(`${tag}: … and keeps going while held`, later.top > early.top, `${early.top} → ${later.top}`)
  await page.mouse.move(700, vh / 2, { steps: 4 })
  await page.waitForTimeout(150)
  await page.waitForTimeout(250)
  const settled = (await scrollTop(page)).top
  await page.waitForTimeout(300)
  check(`${tag}: … and stops once the pointer leaves the band`, (await scrollTop(page)).top === settled)
  await page.mouse.up()
  const moved = await blocks(page, 's1')
  check(`${tag}: … and the drop still lands (p1 left s1's top)`, !moved.startsWith('p1'), moved)
  await page.locator('[data-designer-title]').click()
  await page.keyboard.press('Control+z')
  check(`${tag}: … undone in one step`, (await blocks(page, 's1')) === 'p1,t1', await blocks(page, 's1'))

  // 4. The views list.
  await scrollToTop(page)
  await page.locator('[data-designer-side="views"]').click()
  await page.locator('[data-designer-views] [data-board-palette-view="v-825"]').waitFor({ timeout: 10000 })
  check(`${tag}: the Views tab lists the views (search, chips)`, (await page.locator('[data-designer-views] [data-board-palette-search]').count()) === 1 && (await page.locator('[data-designer-views] [data-board-palette-who]').count()) > 1)
  const row = await box(page, '[data-board-palette-view="v-825"]')
  await page.mouse.move(row.x + 20, row.y + row.h / 2)
  await page.mouse.down()
  const t1 = await box(page, '[data-designer-block="t1"]')
  await page.mouse.move(t1.x + 60, t1.y + t1.h * 0.25, { steps: 6 })
  await page.waitForTimeout(150)
  ls = await lines(page)
  check(`${tag}: a view over t1's top half: the line on t1's top edge`, ls.length === 1 && ls[0].block === 't1' && ls[0].edge === 'before', JSON.stringify(ls))
  await page.mouse.up()
  await page.locator('[data-designer-block="p5"]').waitFor({ timeout: 10000 })
  check(`${tag}: … dropped, it lands there as a copied panel`, (await blocks(page, 's1')) === 'p1,p5,t1', await blocks(page, 's1'))
  check(`${tag}: … read whole first (Analytics/Item/v-825)`, calls.includes('Analytics/Item/v-825'))
  check(`${tag}: … and selected, its provenance shown`, (await page.locator('[data-designer-block-inspector="p5"]').count()) === 1 && (await page.locator('[data-designer-provenance="v-825"]').count()) === 1)
  await page.locator('[data-designer-edit="section:s3"]').click()
  await page.locator('[data-board-palette-add="v-bar"]').click()
  await page.locator('[data-designer-block="p6"]').waitFor({ timeout: 10000 })
  check(`${tag}: "+" adds a view at the end of the selected section`, (await blocks(page, 's3')) === 'p4,p6', await blocks(page, 's3'))
  await page.locator('[data-designer-title]').click()
  await page.keyboard.press('Control+z')
  await page.keyboard.press('Control+z')
  check(`${tag}: each add is one undo step`, (await blocks(page, 's1')) === 'p1,t1' && (await blocks(page, 's3')) === 'p4', `${await blocks(page, 's1')} | ${await blocks(page, 's3')}`)
  await page.locator('[data-designer-side="outline"]').click()

  // 5. Keyboard.
  const select = async (key) => {
    await page.locator(`[data-designer-outline="${key}"]`).click()
    await page.locator('[data-designer-title]').click()
  }
  await select('block:t1')
  check(`${tag}: t1 selected`, (await page.locator('[data-designer-block-inspector="t1"]').count()) === 1)
  check(`${tag}: … the inspector names the keys`, (await page.locator('[data-designer-keys-hint]').count()) === 1)
  await page.keyboard.press('Delete')
  check(`${tag}: Delete removes the selected block`, (await blocks(page, 's1')) === 'p1', await blocks(page, 's1'))
  check(`${tag}: … saying "Removed … · Undo"`, (await page.locator('[data-designer-notice="text"]').count()) === 1)
  await page.keyboard.press('Control+z')
  check(`${tag}: … Ctrl+Z puts it back`, (await blocks(page, 's1')) === 'p1,t1', await blocks(page, 's1'))
  await select('block:p1')
  await page.keyboard.press('Control+d')
  check(`${tag}: Ctrl+D duplicates it just after itself`, (await blocks(page, 's1')) === 'p1,p5,t1', await blocks(page, 's1'))
  check(`${tag}: … the copy selected`, (await page.locator('[data-designer-block-inspector="p5"]').count()) === 1)
  await page.keyboard.press('Control+z')
  check(`${tag}: … one undo step`, (await blocks(page, 's1')) === 'p1,t1', await blocks(page, 's1'))
  await select('block:t1')
  await page.keyboard.press('Escape')
  check(`${tag}: Esc clears the selection`, (await page.locator('[data-designer-block-inspector]').count()) === 0 && (await page.locator('[aria-current="true"][data-designer-outline]').count()) === 0)
  await page.keyboard.press('Delete')
  check(`${tag}: … and Delete with nothing selected removes nothing`, (await blocks(page, 's1')) === 'p1,t1', await blocks(page, 's1'))

  check(`${tag}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

for (const dir of (process.env.DIRS ?? 'ltr,rtl').split(',')) {
  try {
    await drive({ dir })
  } catch (e) {
    check(`846 ${dir}: drive ran to the end`, false, String(e).slice(0, 400))
  }
}
await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
