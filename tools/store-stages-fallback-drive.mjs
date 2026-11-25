// Store stages: the store's expiry fallback state (BackOffice ticket 4276, spec 4275, ADR 0146, SIS.Stock 082).
//
// Drives the REAL app in Chromium against a STUB of SIS.Api's StoreStage doors, in the shapes 4276 shipped, camelCase:
//   GET  Auth/Permissions                 → `StoreStage:03`, with or without `StoreStage:02`
//   GET  StoreStage                       → P077 Seeded (or Shadow)
//   GET  StoreStage/P077/ExpiryFallback   → Off, with one earlier change
//   POST StoreStage/P077/ExpiryFallback   → the body is captured
// In LTR (en) and RTL (ar) it asserts:
//   1. a counted store shows its state and what each state does; with the move grant it offers the three states, the
//      current one not choosable, and cannot be sent without a reason; choosing On says the batch worker must be live;
//      a state and a reason send { state, why } and nothing else;
//   2. without the move grant the state shows and no change is offered;
//   3. a store that is not counted shows the state greyed, says why, and offers no change;
//   4. no page errors. Screenshots in tools/.store-stages-shots (fallback-*).
//
//   1. run the app:  npx vite --port 5213 --strictPort
//   2. DRIVE_PORT=5213 node tools/store-stages-fallback-drive.mjs
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

const FALLBACK = {
  store: 'P077',
  state: 'Off',
  changes: [
    {
      store: 'P077',
      from: 'Record',
      to: 'Off',
      who: 'u.owner',
      whoName: 'Mohamed Sartawi',
      why: 'Back to Off until the batch worker change is live, read on the replay of ticket 4266 first',
      changedAt: '2026-11-25T09:15:00',
    },
  ],
}

const browser = await chromium.launch()

async function open(dir, { canChange, stage = 'Seeded' }) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  const sets = []
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
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['StoreStage:03', ...(canChange ? ['StoreStage:02'] : [])]))
    if (p === 'StoreStage') return route.fulfill(envelope([{ store: 'P077', stage, updatedAt: null, lastMove: null }]))
    if (p === 'StoreStage/P077/Gates') return route.fulfill(envelope({ store: 'P077', measured: [], notConfirmed: [] }))
    if (p === 'StoreStage/P077/ExpiryFallback') {
      if (route.request().method() === 'POST') {
        const body = JSON.parse(route.request().postData() || '{}')
        sets.push(body)
        return route.fulfill(envelope({ ...FALLBACK, state: body.state }))
      }
      return route.fulfill(envelope(FALLBACK))
    }
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/stock/store-stages?open=P077`)
  await page.locator('[data-stage-fallback="Off"]').waitFor({ timeout: 15000 })
  return { context, page, errors, sets }
}

for (const dir of ['ltr', 'rtl']) {
  console.log(`\n── ${dir.toUpperCase()} ──`)
  {
    const { context, page, errors, sets } = await open(dir, { canChange: true })
    const section = page.locator('[data-stage-fallback]')
    check(`${dir} 1 not greyed`, (await section.getAttribute('data-stage-fallback-greyed')) === null)
    check(`${dir} 1 one line per state`, (await section.locator('li').count()) === 3)
    check(`${dir} 1 the change shown by name`, (await page.locator('[data-stage-fallback-changes]').innerText()).length > 0)
    const options = await page
      .locator('[data-stage-fallback-change] select option')
      .evaluateAll((els) => els.map((e) => `${e.getAttribute('value')}:${e.disabled ? 'x' : 'ok'}`))
    check(`${dir} 1 three states, the current one not choosable`, options.join(',') === ':ok,Off:x,Record:ok,On:ok', options.join(','))
    await page.locator('[data-stage-fallback-change] select').selectOption('On')
    check(`${dir} 1 On says the batch worker must be live`, await page.locator('[data-stage-fallback-on-needs-worker]').isVisible())
    check(`${dir} 1 no send without a reason`, await page.locator('[data-stage-fallback-commit]').isDisabled())
    await page.locator('[data-stage-fallback-change] select').selectOption('Record')
    await page.locator('[data-stage-fallback-change] textarea').fill('  Read the fallback on live takes before On  ')
    check(`${dir} 1 sendable with a reason`, await page.locator('[data-stage-fallback-commit]').isEnabled())
    await page.screenshot({ path: `${SHOTS}/fallback-${dir}-change.png`, fullPage: true })
    await page.locator('[data-stage-fallback-commit]').click()
    await page.waitForTimeout(500)
    check(`${dir} 1 sent state and why only`,
      JSON.stringify(sets) === JSON.stringify([{ state: 'Record', why: 'Read the fallback on live takes before On' }]),
      JSON.stringify(sets))
    check(`${dir} 1 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { canChange: false })
    check(`${dir} 2 no change without the move grant`, (await page.locator('[data-stage-fallback-change]').count()) === 0)
    check(`${dir} 2 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { canChange: true, stage: 'Shadow' })
    const section = page.locator('[data-stage-fallback]')
    check(`${dir} 3 greyed`, (await section.getAttribute('data-stage-fallback-greyed')) === '')
    check(`${dir} 3 says why`, await page.locator('[data-stage-fallback-not-counted]').isVisible())
    check(`${dir} 3 no change offered`, (await page.locator('[data-stage-fallback-change]').count()) === 0)
    await page.screenshot({ path: `${SHOTS}/fallback-${dir}-not-counted.png`, fullPage: true })
    check(`${dir} 3 no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
