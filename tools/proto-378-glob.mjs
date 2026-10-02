// PROTOTYPE 378 — does ONE global default <bdi> renderer (provideGlobalGridOptions defaultColDef)
// merge with the page's own defaultColDef and fix every cell? fix=1&iso=0 (no per-column Ltr) + glob=1.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const b = await chromium.launch()
const out = {}
for (const glob of [0, 1]) {
  const p = await b.newPage({ viewport: { width: 1440, height: 900 } })
  p.on('pageerror', (e) => console.error('PAGEERR', glob, String(e).slice(0, 300)))
  p.on('console', (m) => { if (m.type() === 'error' && !m.text().includes('Maximum update')) console.error('CONSOLE', glob, m.text().slice(0, 300)) })
  await p.goto(`http://localhost:5378/oms/deliveries?stub=1&palette=navy&shell=D&cmd=1&rtl=1&ar=1&fix=1&iso=0&glob=${glob}`)
  const load = p.locator('button', { hasText: /^(Load|تحميل)$/ }).first()
  await load.waitFor({ timeout: 90000 }); await p.waitForTimeout(1500); await load.click()
  await p.waitForTimeout(4000)
  console.error('glob', glob, 'rows', await p.locator('.ag-row').count())
  await p.waitForTimeout(500)
  out[glob] = await p.evaluate(() => {
    const vis = (root) => { const o = []; const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); const r = document.createRange()
      for (let n = w.nextNode(); n; n = w.nextNode()) for (let i = 0; i < n.textContent.length; i++) { r.setStart(n, i); r.setEnd(n, i + 1); const q = r.getBoundingClientRect(); if (q.width) o.push({ x: q.left + q.width / 2, c: n.textContent[i] }) }
      return o.sort((a, b) => a.x - b.x).map((x) => x.c).join('') }
    const c = (col, row) => document.querySelector(`.ag-row[row-index="${row}"] [col-id="${col}"]`)
    const pick = (col, row) => { const e = c(col, row); return e && { bdi: !!e.querySelector('bdi'), text: e.textContent, visual: vis(e) } }
    const a = c('netTotal', 0), r = document.createRange(); r.selectNodeContents(a); const t = r.getBoundingClientRect(), bb = a.getBoundingClientRect()
    return { slot: pick('timeSlotDescription', 0), entry: pick('entryTime', 0), phone: pick('customerPhone', 1), name: pick('customerName', 0), driverAr: pick('courierDriverName', 1), net: pick('netTotal', 0), failed: pick('failedJobsCount', 2), netGap: { l: Math.round(t.left - bb.left), r: Math.round(bb.right - t.right) }, failedBg: getComputedStyle(c('failedJobsCount', 2)).backgroundColor }
  })
  await p.close()
}
await b.close()
console.log(JSON.stringify(out, null, 1))
