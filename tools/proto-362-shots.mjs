// PROTOTYPE 362 — captures of the candidate palettes on the real app (stubbed data).
//
//   1. npx vite --port 5199
//   2. node tools/proto-362-shots.mjs
//
// → .issues/assets/362-shots/ (copied by hand into the main checkout's assets).
// deviceScaleFactor 1 on purpose: the 12px-in-26px legibility check is about
// real pixels on an ordinary office monitor, not a retina upscale.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const OUT = process.env.OUT || '.issues/assets/362-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []

async function open(palette, dark, { rows = 26, size = 12 } = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript((d) => localStorage.setItem('oms.darkMode', String(d)), dark)
  const page = await ctx.newPage()
  page.setDefaultTimeout(4000)
  page.on('pageerror', (e) => errors.push(`${palette}/${dark}: ${e}`))
  const q = `?stub=1&palette=${palette}&rows=${rows}&size=${size}`
  return { ctx, page, q }
}

async function deliveries(page, q) {
  await page.goto(BASE + '/oms/deliveries' + q)
  const load = page.getByRole('button', { name: /load/i }).first()
  await load.waitFor({ timeout: 90000 })
  await page.waitForTimeout(2500) // the filter lookups settle before Load is honoured
  await load.click()
  await page.waitForSelector('.ag-row[row-index="8"]', { state: 'attached', timeout: 30000 }).catch(() => {})
  await page.waitForTimeout(500)
  // AG Grid 36: rows live under .ag-grid-scrolling-rows, not .ag-center-cols-container.
  // select row 3 (click selection), arrow focus to row 9, hover row 6 — every state at once
  await page.locator('.ag-row[row-index="2"] .ag-cell[col-id="documentNo"]').first().click().catch(() => {})
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowDown')
  await page.locator('.ag-row[row-index="5"] .ag-cell[col-id="orderNo"]').first().hover().catch(() => {})
  await page.waitForTimeout(250)
  await page.locator('.ag-root-wrapper').first().scrollIntoViewIfNeeded().catch(() => {})
}

const shots = []
for (const palette of ['steel', 'far', 'navy']) {
  for (const dark of [false, true]) {
    const mode = dark ? 'dark' : 'light'
    const { ctx, page, q } = await open(palette, dark)
    await deliveries(page, q)
    const name = `deliveries-${palette}-${mode}.png`
    await page.screenshot({ path: `${OUT}/${name}` })
    shots.push(name)
    // 1:1 crop of the grid body for the legibility read
    const grid = page.locator('.ag-root-wrapper').first()
    const box = await grid.boundingBox().catch(() => null)
    if (box) {
      const crop = `grid-${palette}-${mode}-26-12.png`
      await page.screenshot({ path: `${OUT}/${crop}`, clip: { x: box.x, y: box.y, width: Math.min(900, box.width), height: 300 } })
      shots.push(crop)
    }
    if (palette !== 'steel') {
      await page.goto(BASE + '/oms/document/1000000393' + q)
      await page.waitForTimeout(1500)
      const doc = `document-${palette}-${mode}.png`
      await page.screenshot({ path: `${OUT}/${doc}` })
      shots.push(doc)
    }
    await ctx.close()
  }
}

// density matrix on the two candidates: rows × grid text, light + dark, 1:1 grid crops
for (const palette of ['far', 'navy']) {
  for (const dark of [false, true]) {
    for (const [rows, size] of [[28, 12], [24, 12], [26, 12.5], [26, 13]]) {
      const mode = dark ? 'dark' : 'light'
      const { ctx, page, q } = await open(palette, dark, { rows, size })
      await deliveries(page, q)
      const grid = page.locator('.ag-root-wrapper').first()
      const box = await grid.boundingBox().catch(() => null)
      if (box) {
        const crop = `grid-${palette}-${mode}-${rows}-${size}.png`
        await page.screenshot({ path: `${OUT}/${crop}`, clip: { x: box.x, y: box.y, width: Math.min(900, box.width), height: 300 } })
        shots.push(crop)
      }
      await ctx.close()
    }
  }
}

// computed proof: the grid really paints in Plex, the cursor bar in the token
{
  const { ctx, page, q } = await open('navy', false)
  await deliveries(page, q)
  const probe = await page.evaluate(() => {
    const cell = document.querySelector('.ag-row .ag-cell[col-id="customerName"]')
    const mono = document.querySelector('.ag-row .ag-cell[col-id="deliveryNo"]')
    const sel = document.querySelector('.ag-row-selected:not(.ag-full-width-row)')
    return {
      cellFont: cell && getComputedStyle(cell).fontFamily,
      cellSize: cell && getComputedStyle(cell).fontSize,
      monoFont: mono && getComputedStyle(mono).fontFamily,
      rowHeight: cell && cell.closest('.ag-row')?.getBoundingClientRect().height,
      cursor: sel && getComputedStyle(sel, '::before').backgroundColor,
      plexLoaded: document.fonts.check('12px "IBM Plex Sans"'),
      monoLoaded: document.fonts.check('12px "IBM Plex Mono"'),
    }
  })
  console.log('probe', JSON.stringify(probe))
  await ctx.close()
}

await browser.close()
console.log(`${shots.length} shots → ${OUT}`)
if (errors.length) console.log('page errors:\n  ' + errors.slice(0, 10).join('\n  '))
