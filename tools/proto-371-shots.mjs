// PROTOTYPE 371 — captures + intent checks for the Delivery details record-page variants.
//
//   1. npx vite --port 5371
//   2. node tools/proto-371-shots.mjs
//
// → OUT (default .issues/assets/371-shots/). 1440×900 at 1×, full page.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5371}`
const OUT = process.env.OUT || '.issues/assets/371-shots'
mkdirSync(OUT, { recursive: true })
const NO = { out: '8000000300', resched: '8000000121', cancelreq: '8000000174', cancelled: '8000000301', pis: '8000000253' }

const browser = await chromium.launch()
const errors = []
const checks = []
const ok = (name, pass, detail = '') => checks.push(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)

async function open(variant, kase, dark) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript((d) => localStorage.setItem('oms.darkMode', String(d)), dark)
  const page = await ctx.newPage()
  page.setDefaultTimeout(8000)
  page.on('pageerror', (e) => errors.push(`${variant}/${kase}/${dark ? 'dark' : 'light'}: ${e}`))
  await page.goto(`${BASE}/oms/delivery/${NO[kase]}?variant=${variant}&stub=1&palette=navy`, { timeout: 60000 })
  await page.getByText(NO[kase]).first().waitFor({ timeout: 90000 })
  await page.waitForTimeout(900)
  return { ctx, page }
}

for (const v of ['A', 'B', 'C']) {
  for (const k of Object.keys(NO)) {
    for (const dark of k === 'out' || k === 'cancelreq' || k === 'resched' ? [false, true] : [false]) {
      const { ctx, page } = await open(v, k, dark)
      if (v === 'B' && k !== 'pis') {
        // B's activity lives behind a tab — capture the Activity tab too.
        await page.screenshot({ path: `${OUT}/${v}-${k}-${dark ? 'dark' : 'light'}.png`, fullPage: true })
        await page.getByRole('tab', { name: /Activity/ }).click()
        await page.waitForTimeout(300)
        await page.screenshot({ path: `${OUT}/${v}-${k}-${dark ? 'dark' : 'light'}-activity.png`, fullPage: true })
      } else {
        await page.screenshot({ path: `${OUT}/${v}-${k}-${dark ? 'dark' : 'light'}.png`, fullPage: true })
      }
      await ctx.close()
    }
  }
}

// ---- intent checks ---------------------------------------------------------------
for (const v of ['A', 'B', 'C']) {
  // C on a delivery with a cancellation already requested → refused, no dialog.
  {
    const { ctx, page } = await open(v, 'cancelreq', false)
    await page.getByRole('button', { name: /C · request-close/ }).click()
    await page.waitForTimeout(700)
    const dialogOpen = await page.locator('dialog[open]').count()
    const ringed = await page.locator('[data-cmd="request-close"].ring-2').count()
    ok(`${v}: C on 8000000174 is refused, no dialog`, dialogOpen === 0 && ringed === 1, `dialogs=${dialogOpen} ringed=${ringed}`)
    await page.screenshot({ path: `${OUT}/${v}-intent-C-refused.png` })
    // Back/refresh must not re-pop: reload and look again.
    await page.reload()
    await page.getByText('8000000174').first().waitFor()
    await page.waitForTimeout(700)
    ok(`${v}: reload after intent does not re-fire`, (await page.locator('[data-cmd="request-close"].ring-2').count()) === 0)
    await ctx.close()
  }
  // R on an open delivery → the Reschedule dialog opens once.
  {
    const { ctx, page } = await open(v, 'out', false)
    await page.getByRole('button', { name: /R · reschedule/ }).click()
    await page.waitForTimeout(900)
    const n = await page.locator('dialog[open]').count()
    ok(`${v}: R on 8000000300 opens Reschedule`, n === 1, `dialogs=${n}`)
    await page.screenshot({ path: `${OUT}/${v}-intent-R.png` })
    await ctx.close()
  }
  // N → composer focused (A, C) or the note dialog (B).
  {
    const { ctx, page } = await open(v, 'out', false)
    await page.getByRole('button', { name: /N · add-note/ }).click()
    await page.waitForTimeout(700)
    const focused = await page.evaluate(() => document.activeElement?.id === 'proto-note')
    const dialogs = await page.locator('dialog[open]').count()
    ok(`${v}: N lands on ${v === 'B' ? 'the note dialog' : 'the composer'}`, v === 'B' ? dialogs === 1 : focused, `focused=${focused} dialogs=${dialogs}`)
    if (v !== 'B') {
      await page.keyboard.type('Called the customer, no answer')
      await page.keyboard.press('Control+Enter')
      await page.waitForTimeout(400)
      ok(`${v}: Ctrl+Enter posts into the feed`, (await page.getByText('Called the customer, no answer').count()) >= 1)
    }
    await ctx.close()
  }
}

await browser.close()
console.log(checks.join('\n'))
console.log(errors.length ? 'PAGE ERRORS:\n' + errors.join('\n') : 'no page errors')
