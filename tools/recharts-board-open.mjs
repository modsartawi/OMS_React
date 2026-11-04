// PROTOTYPE — opens the Recharts board in a VISIBLE browser, oms-react /api stubbed (no SIS.Api needed).
// Metabase :3000 is real. Close the window to end.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const BASE = 'http://localhost:5199'
const envelope = (data) => ({ status: 200, contentType: 'application/json', body: JSON.stringify({ statusCode: 200, success: true, message: null, data }) })
const browser = await chromium.launch({ headless: false, args: ['--start-maximized'] })
const context = await browser.newContext({ viewport: null })
await context.route(`${BASE}/api/**`, (route) => {
  const p = new URL(route.request().url()).pathname.split('/api/')[1]
  if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
  if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
  return route.fulfill(envelope([]))
})
const page = await context.newPage()
await page.goto(`${BASE}/prototype/analytics?variant=recharts&scenario=en`)
console.log('opened')
await new Promise((r) => browser.on('disconnected', r))
