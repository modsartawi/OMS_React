// PROTOTYPE 378 — captures + measurements of the foundation under Arabic/RTL (stubbed data).
//
//   1. npx vite --port 5378
//   2. node tools/proto-378-shots.mjs
//
// → .issues/assets/378-shots/ (copied by hand into the main checkout's assets) + facts JSON.
import { createRequire } from 'node:module'
import { mkdirSync, writeFileSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5378}`
const OUT = process.env.OUT || '.issues/assets/378-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []
const facts = {}

const HELPERS = () => {
  window.__visualOf = (root) => {
    const out = []
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT)
    const range = document.createRange()
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = n.textContent ?? ''
      for (let i = 0; i < text.length; i++) {
        if (/[\u2066-\u2069]/.test(text[i])) continue
        range.setStart(n, i)
        range.setEnd(n, i + 1)
        const r = range.getBoundingClientRect()
        if (r.width === 0) continue
        out.push({ x: r.left + r.width / 2, c: text[i] })
      }
    }
    return out.sort((a, b) => a.x - b.x).map((o) => o.c).join('')
  }
  window.__ink = (cell) => {
    const host = cell.querySelector('bdi') || cell.querySelector('.ag-cell-value') || cell
    const probe = document.createElement('span')
    probe.style.cssText = 'display:inline-block;width:0;height:0;vertical-align:baseline'
    host.appendChild(probe)
    const base = probe.getBoundingClientRect().top
    probe.remove()
    const cs = getComputedStyle(host)
    const ctx = document.createElement('canvas').getContext('2d')
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`
    const m = ctx.measureText(host.textContent)
    const row = cell.closest('.ag-row') || cell
    const r = row.getBoundingClientRect()
    return {
      text: host.textContent,
      rowH: r.height,
      inkAbove: +(base - m.actualBoundingBoxAscent - r.top).toFixed(1),
      inkBelow: +(r.bottom - (base + m.actualBoundingBoxDescent)).toFixed(1),
    }
  }
}

async function open({ ar = true, fix = false, iso = true, dark = false, arsize = 100, sep = 'slash', width = 1440, height = 900, expanded = false, dpr = 1 } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: dpr })
  await ctx.addInitScript(
    ([d, e]) => {
      localStorage.setItem('oms.darkMode', String(d))
      localStorage.setItem('proto363.d.expanded', String(e))
    },
    [dark, expanded],
  )
  await ctx.addInitScript(HELPERS)
  const page = await ctx.newPage()
  page.setDefaultTimeout(5000)
  page.setDefaultNavigationTimeout(90000)
  page.on('pageerror', (e) => errors.push(String(e)))
  const q = `?stub=1&palette=navy&shell=D&cmd=1&rtl=${ar ? 1 : 0}&ar=${ar ? 1 : 0}&fix=${fix ? 1 : 0}&iso=${iso ? 1 : 0}&arsize=${arsize}&sep=${sep}`
  return { ctx, page, q }
}

async function deliveries(page, q) {
  await page.goto(BASE + '/oms/deliveries' + q)
  const load = page.locator('button', { hasText: /^(Load|تحميل)$/ }).first()
  await load.waitFor({ timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await load.click().catch(() => {})
  await page.waitForSelector('.ag-row[row-index="5"]', { state: 'attached', timeout: 20000 }).catch(() => {})
  await page.waitForTimeout(500)
}

async function snap(page, name, clip) {
  await page.addStyleTag({ content: '[data-proto-bar]{display:none!important}' }).catch(() => {})
  await page.screenshot({ path: `${OUT}/${name}`, ...(clip ? { clip } : {}) })
}

/** Everything the foundation's RTL questions measure on the live Deliveries screen. */
async function measure(page) {
  return page.evaluate(() => {
    const grid = document.querySelector('.ag-root-wrapper')
    const gb = grid?.getBoundingClientRect()
    const cell = (col, row) => document.querySelector(`.ag-row[row-index="${row}"] [col-id="${col}"]`)
    const pinnedCell = cell('deliveryNo', 0)
    const pb = pinnedCell?.getBoundingClientRect()
    const vis = (col, row) => {
      const c = cell(col, row)
      return c ? { text: c.textContent, visual: window.__visualOf(c) } : null
    }
    const align = (col, row) => {
      const c = cell(col, row)
      if (!c) return null
      const r = document.createRange()
      r.selectNodeContents(c)
      const t = r.getBoundingClientRect()
      const b = c.getBoundingClientRect()
      return { leftGap: Math.round(t.left - b.left), rightGap: Math.round(b.right - t.right) }
    }
    const firstHeader = [...document.querySelectorAll('.ag-header-cell')].sort((a, b) => b.getBoundingClientRect().right - a.getBoundingClientRect().right)[0]
    const crumb = document.querySelector('nav[aria-label="Breadcrumb"]')
    const legend = document.querySelector('[data-legend]')
    const kbds = legend ? [...legend.querySelectorAll('kbd')].map((k) => ({ t: k.textContent, x: Math.round(k.getBoundingClientRect().left) })) : []
    const rail = document.querySelector('[data-rail]')?.getBoundingClientRect()
    return {
      dir: document.documentElement.dir,
      gridRtlClass: !!document.querySelector('.ag-rtl'),
      gridLtrClass: !!document.querySelector('.ag-ltr'),
      railSide: rail ? (rail.left < innerWidth / 2 ? 'left' : 'right') : null,
      pinnedClasses: pinnedCell?.className.match(/ag-cell-last-(left|right)-pinned|ag-cell-first-right-pinned/g),
      deliveryNoSide: pb && gb ? (pb.left - gb.left < gb.right - pb.right ? 'left' : 'right') : null,
      firstHeaderAtRight: firstHeader?.textContent,
      slot: vis('timeSlotDescription', 0),
      slotDay: vis('timeSlotDay', 0),
      entryTime: vis('entryTime', 0),
      mobileSpaced: vis('customerPhone', 1),
      mobileBare: vis('customerPhone', 0),
      driverPhone: vis('courierDriverPhone', 1),
      driverArabic: vis('courierDriverName', 1),
      netTotalAlign: align('netTotal', 0),
      nameAlign: align('customerName', 0),
      deliveryNoAlign: align('deliveryNo', 0),
      crumb: crumb ? { text: crumb.textContent, visual: window.__visualOf(crumb) } : null,
      legend: kbds,
      inkArabicName: cell('customerName', 0) ? window.__ink(cell('customerName', 0)) : null,
      inkLatinNo: cell('deliveryNo', 0) ? window.__ink(cell('deliveryNo', 0)) : null,
      inkArabicCity: cell('cityName', 0) ? window.__ink(cell('cityName', 0)) : null,
    }
  })
}

// --- 1. the bench -----------------------------------------------------------------
{
  const { ctx, page } = await open({ ar: false, width: 1720, height: 1000 })
  await page.goto(BASE + '/prototype/bidi')
  await page.waitForFunction(() => window.__bidi?.length > 0 && window.__ink?.length > 0, null, { timeout: 60000 }).catch(() => {})
  facts.bench = await page.evaluate(() => window.__bidi)
  facts.benchInk = await page.evaluate(() => window.__ink)
  await page.addStyleTag({ content: '[data-proto-bar]{display:none!important}' })
  await page.screenshot({ path: `${OUT}/bench.png`, fullPage: true })
  await ctx.close()
}
{
  const { ctx, page } = await open({ ar: false, width: 1720, height: 1000, dpr: 3 })
  await page.goto(BASE + '/prototype/bidi')
  await page.waitForFunction(() => window.__ink?.length > 0, null, { timeout: 60000 }).catch(() => {})
  await page.addStyleTag({ content: '[data-proto-bar]{display:none!important}' })
  const sec = page.locator('section').nth(1)
  await sec.screenshot({ path: `${OUT}/bench-arabic-sizes-3x.png` })
  await ctx.close()
}

// --- 2. Deliveries: as found vs fixed, Arabic, light + dark ------------------------
for (const [name, o] of [
  ['found-ar-light', { fix: false }],
  ['mirrored-unisolated-ar', { fix: true, iso: false }],
  ['fixed-ar-light', { fix: true }],
  ['fixed-ar-dark', { fix: true, dark: true }],
  ['fixed-ar-expanded', { fix: true, expanded: true }],
  ['fixed-ar-chevron', { fix: true, sep: 'chevron' }],
  ['fixed-latin-rtl', { fix: true, ar: false }],
]) {
  const { ctx, page, q } = await open(o)
  await deliveries(page, o.ar === false ? q.replace('rtl=0', 'rtl=1') : q)
  facts[name] = await measure(page)
  await snap(page, `${name}.png`)
  if (o.ar !== false && !o.dark && !o.expanded && o.sep !== 'chevron') {
    await page.evaluate(() => document.querySelector('.ag-row[row-index="0"] [col-id="customerPhone"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }))
    await page.waitForTimeout(400)
    const g = await page.locator('.ag-root-wrapper').boundingBox()
    const c = await page.locator('.ag-row[row-index="0"] [col-id="customerPhone"]').boundingBox()
    if (c && g) await snap(page, `${name}-values.png`, { x: Math.max(g.x, Math.min(c.x - 450, g.x + g.width - 1000)), y: g.y, width: 1000, height: 200 })
  }
  await ctx.close()
}

// --- 3. zoomed: grid start edge with Arabic headers + names, at 3 sizes --------------
for (const arsize of [100, 108, 115]) {
  const { ctx, page, q } = await open({ fix: true, arsize, dpr: 3 })
  await deliveries(page, q)
  facts[`ink-${arsize}`] = await measure(page).then((m) => ({ name: m.inkArabicName, no: m.inkLatinNo, city: m.inkArabicCity }))
  const g = await page.locator('.ag-root-wrapper').boundingBox()
  if (g) await snap(page, `zoom-grid-start-${arsize}.png`, { x: g.x + g.width - 620, y: g.y, width: 620, height: 230 })
  // the Arabic-text columns: bring Customer Name into view and crop around it
  await page.evaluate(() => document.querySelector('.ag-row[row-index="0"] [col-id="customerName"]')?.scrollIntoView({ inline: 'center', block: 'nearest' }))
  await page.waitForTimeout(400)
  const c = await page.locator('.ag-row[row-index="0"] [col-id="customerName"]').boundingBox()
  if (c && g) await snap(page, `zoom-names-${arsize}.png`, { x: Math.max(g.x, c.x - 300), y: g.y, width: 760, height: 230 })
  const top = await page.locator('header, [data-topbar]').first().boundingBox().catch(() => null)
  if (arsize === 100) await snap(page, `zoom-topbar.png`, { x: 0, y: 0, width: 1440, height: 50 })
  await ctx.close()
}

// --- 4. a deep page: the crumb record number + both separators ----------------------
for (const [name, o] of [
  ['found-ar-document', { fix: false }],
  ['fixed-ar-document', { fix: true }],
  ['fixed-ar-document-chevron', { fix: true, sep: 'chevron' }],
]) {
  const { ctx, page, q } = await open({ ...o, dpr: 2 })
  await page.goto(BASE + '/oms/document/1000000393' + q)
  await page.waitForTimeout(2500)
  facts[name] = await page.evaluate(() => {
    const c = document.querySelector('nav[aria-label="Breadcrumb"]')
    return c ? { text: c.textContent, visual: window.__visualOf(c) } : null
  })
  await snap(page, `${name}-topbar.png`, { x: 0, y: 0, width: 1440, height: 50 })
  await ctx.close()
}

// --- 5. the call-center slot chip shape, as shipped -------------------------------
// (header-chips.ts builds `${from}–${to}`; the bench row "win-dash" is that exact string)

await browser.close()
writeFileSync(`${OUT}/facts.json`, JSON.stringify(facts, null, 1))
console.log(JSON.stringify(facts, (k, v) => (k === 'bench' ? undefined : v), 1))
if (errors.length) console.log('page errors:\n  ' + [...new Set(errors)].slice(0, 15).join('\n  '))
