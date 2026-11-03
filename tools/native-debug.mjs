import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const BASE = 'http://localhost:5199'
const envelope = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: null, data }) })
const browser = await chromium.launch()
const page = await (await browser.newContext({ viewport: { width: 1600, height: 1000 } })).newPage()
await page.route(`${BASE}/api/**`, (route) => {
  const p = new URL(route.request().url()).pathname.split('/api/')[1]
  if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'm', currentStoreCode: 'P001' }))
  if (/Access$/.test(p)) return route.fulfill(envelope({ allowed: true, canOpen: true, screenAllowed: true }))
  return route.fulfill(envelope([]))
})
await page.goto(BASE + '/prototype/analytics?variant=native&scenario=en')
await page.waitForSelector('.recharts-surface, table', { timeout: 30000 }).catch(() => {})
await page.waitForTimeout(3000)
const info = await page.evaluate(() => {
  const rc = document.querySelector('.recharts-responsive-container')
  const surf = document.querySelector('.recharts-surface')
  const q = (s) => document.querySelectorAll(s).length
  return {
    container: rc ? { w: rc.clientWidth, h: rc.clientHeight } : null,
    surface: surf ? { w: surf.getAttribute('width'), h: surf.getAttribute('height') } : null,
    bars: q('.recharts-bar-rectangle'),
    rects: q('.recharts-rectangle'),
    lines: q('.recharts-line-curve'),
    xticks: q('.recharts-xAxis .recharts-cartesian-axis-tick'),
    yticks: q('.recharts-yAxis .recharts-cartesian-axis-tick'),
  }
})
console.log(JSON.stringify(info, null, 2))
await browser.close()
