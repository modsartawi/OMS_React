// Store stages: the move to Blocking (BackOffice ticket 4261, ADR 0145, SIS.Stock 081).
//
// Drives the REAL app in Chromium against a STUB of SIS.Api's StoreStage doors, in the shapes 4261 shipped, camelCase:
//   GET  Auth/Permissions          → `StoreStage:03` + `StoreStage:02`, with or without `StoreBlockEarly:02`
//   GET  StoreStage                → P077 Seeded
//   GET  StoreStage/P077/Gates     → the store's own proof (all holding) then the fleet's gates (SapCount, Feeds failing)
//   POST StoreStage/P077/Move      → the body is captured
// In LTR (en) and RTL (ar) it asserts:
//   1. the store sheet shows the gates, store and fleet apart, and the would-be refusals one day per line;
//   2. choosing Blocking asks each confirmation the answer names; without the block-early grant a failing fleet gate has
//      no waive tick and the move cannot be sent;
//   3. with the grant, ticking every confirmation and waiving both failing fleet gates sends
//      { stage, why, confirmed: [answer's order], waived: [SapCount, Feeds] };
//   4. a store gate failing: the move is not offered, and says why;
//   5. no page errors. Screenshots in tools/.store-stages-shots.
//
//   1. run the app:  npx vite --port 5213 --strictPort
//   2. DRIVE_PORT=5213 node tools/store-stages-blocking-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5213}`
const SHOTS = 'tools/.store-stages-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})

const gate = (name, scope, holds, figure) => ({ gate: name, scope, holds, waived: false, figure })
const GATES = (ownHolds = true) => ({
  store: 'P077',
  from: '2026-11-11T00:00:00',
  to: '2026-11-24T00:00:00',
  hold: false,
  measured: [
    gate('Seed', 'Store', true, 'the last seed run Seeded, count day 2026-11-17'),
    gate('CountersMet', 'Store', true, "the till's sales and SAP's from 2026-11-18 to 2026-11-23 met per material"),
    gate('NightlyCompare', 'Store', ownHolds, ownHolds ? 'compared 2026-11-24 02:10, 0 of 812 drifting' : 'the compare of 2026-11-24 found 3 of 812 batches drifting'),
    gate('WouldBeRefusals', 'Store', true,
      '2026-11-22: 1 of 140 takes refused (0.7%): GS1 scan 1 of 60, entered batch 0 of 10, determined 0 of 70; ' +
      '2026-11-23: 2 of 150 takes refused (1.3%): GS1 scan 2 of 65, entered batch 0 of 5, determined 0 of 80; ' +
      '2026-11-24: 0 of 120 takes refused (0%): GS1 scan 0 of 50, entered batch 0 of 0, determined 0 of 70'),
    gate('TakeDoor', 'Fleet', true, 'every day of 14: 99% within 1000 ms'),
    gate('Feeds', 'Fleet', false, '2026-11-19: the PosFeed stopped 58 minutes'),
    gate('SapCount', 'Fleet', false, 'never ran'),
    gate('SalePush', 'Fleet', true, 'every day pushed'),
    gate('HeldServed', 'Fleet', true, 'held stock served'),
  ],
  confirmed: [],
  notConfirmed: ['StoreTills', 'DrsHoldsInShadow', 'DeliverySalesPicked', 'TillsOnHoldSeam', 'OldDocumentsCleared',
    'FeedForcedStop', 'TakeDoorSkips', 'WouldBeRefusalsRead'],
  waived: [],
})

const browser = await chromium.launch()

async function open(dir, { canWaive, ownHolds = true }) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const moves = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'owner', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions')
      return route.fulfill(permissions(['StoreStage:03', 'StoreStage:02', ...(canWaive ? ['StoreBlockEarly:02'] : [])]))
    if (p === 'StoreStage') return route.fulfill(envelope([{ store: 'P077', stage: 'Seeded', updatedAt: null, lastMove: null }]))
    if (p === 'StoreStage/P077/Gates') return route.fulfill(envelope(GATES(ownHolds)))
    if (p === 'StoreStage/P077/Move') {
      moves.push(JSON.parse(route.request().postData() || '{}'))
      return route.fulfill(envelope({ store: 'P077', stage: 'Blocking', updatedAt: null, lastMove: null }))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/stock/store-stages?open=P077`)
  await page.locator('[data-stage-gates="notYet"]').waitFor({ timeout: 15000 })
  return { context, page, errors, moves }
}

const chooseBlocking = async (page) => {
  await page.locator('[data-stage-move] select').selectOption('Blocking')
  await page.locator('[data-stage-move] textarea').fill('Its own proof holds; the fleet gates are waived by name')
}

for (const dir of ['ltr', 'rtl']) {
  console.log(`\n── ${dir.toUpperCase()} ──`)
  {
    const { context, page, errors, moves } = await open(dir, { canWaive: false })
    const store = await page.locator('[data-stage-gates-scope="store"] [data-gate]').evaluateAll((els) => els.map((e) => e.getAttribute('data-gate')))
    const fleet = await page.locator('[data-stage-gates-scope="fleet"] [data-gate]').evaluateAll((els) => els.map((e) => e.getAttribute('data-gate')))
    check(`${dir} 1 store gates apart`, store.join(',') === 'Seed,CountersMet,NightlyCompare,WouldBeRefusals', store.join(','))
    check(`${dir} 1 fleet gates apart`, fleet.join(',') === 'TakeDoor,Feeds,SapCount,SalePush,HeldServed', fleet.join(','))
    check(`${dir} 1 would-be refusals one day per line`,
      (await page.locator('[data-stage-gates-scope="store"] [data-gate="WouldBeRefusals"] [data-gate-figure-line]').count()) === 3)
    await chooseBlocking(page)
    check(`${dir} 2 eight confirmations asked by name`, (await page.locator('[data-stage-confirm]').count()) === 8)
    check(`${dir} 2 no waive tick without the grant`, (await page.locator('[data-stage-waive]').count()) === 0)
    check(`${dir} 2 failing fleet gates shown`, (await page.locator('[data-stage-waive-gate]').count()) === 2)
    for (const box of await page.locator('[data-stage-confirm]').all()) await box.check()
    check(`${dir} 2 cannot send without the grant`, await page.locator('[data-stage-move-commit]').isDisabled())
    await page.screenshot({ path: `${SHOTS}/${dir}-no-grant.png`, fullPage: true })
    check(`${dir} 2 nothing sent`, moves.length === 0)
    check(`${dir} 2 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, moves } = await open(dir, { canWaive: true })
    await chooseBlocking(page)
    for (const box of await page.locator('[data-stage-confirm]').all()) await box.check()
    check(`${dir} 3 not sendable before the waivers`, await page.locator('[data-stage-move-commit]').isDisabled())
    await page.locator('[data-stage-waive="SapCount"]').check()
    await page.locator('[data-stage-waive="Feeds"]').check()
    check(`${dir} 3 sendable once waived`, await page.locator('[data-stage-move-commit]').isEnabled())
    await page.screenshot({ path: `${SHOTS}/${dir}-waived.png`, fullPage: true })
    await page.locator('[data-stage-move-commit]').click()
    await page.waitForTimeout(500)
    const sent = moves[0] ?? {}
    check(`${dir} 3 the move sent`, moves.length === 1)
    check(`${dir} 3 confirmed in the answer's order`, JSON.stringify(sent.confirmed) === JSON.stringify(GATES().notConfirmed), JSON.stringify(sent.confirmed))
    check(`${dir} 3 waived the failing fleet gates`, JSON.stringify(sent.waived) === '["Feeds","SapCount"]', JSON.stringify(sent.waived))
    check(`${dir} 3 stage and why`, sent.stage === 'Blocking' && sent.why.startsWith('Its own proof'))
    check(`${dir} 3 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { canWaive: true, ownHolds: false })
    await chooseBlocking(page)
    check(`${dir} 4 store gate failing says so`, await page.locator('[data-stage-blocking-store-failing]').isVisible())
    for (const box of await page.locator('[data-stage-confirm]').all()) await box.check()
    for (const box of await page.locator('[data-stage-waive]').all()) await box.check()
    check(`${dir} 4 cannot send while the store's proof fails`, await page.locator('[data-stage-move-commit]').isDisabled())
    await page.screenshot({ path: `${SHOTS}/${dir}-store-failing.png`, fullPage: true })
    check(`${dir} 4 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
