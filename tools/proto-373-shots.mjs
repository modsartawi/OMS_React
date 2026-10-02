// PROTOTYPE 373 — captures + keyboard checks of the sentence header variants.
//
//   1. npx vite --port 5373
//   2. node tools/proto-373-shots.mjs
//
// → .issues/assets/373-shots/ (copied by hand into the main checkout's assets).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5373}`
const OUT = process.env.OUT || '.issues/assets/373-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []
const checks = []
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)

async function open(variant, state, dark = false) {
  const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 })
  await ctx.addInitScript((d) => localStorage.setItem('oms.darkMode', String(d)), dark)
  const page = await ctx.newPage()
  page.setDefaultTimeout(6000)
  page.on('pageerror', (e) => errors.push(`${variant}/${state}: ${e}`))
  await page.goto(`${BASE}/prototype/callcenter-sentence?stub=1&palette=navy&variant=${variant}&state=${state}`, { timeout: 60000 })
  await page.waitForSelector('[data-cc-chips]', { timeout: 90000 })
  await page.waitForTimeout(400)
  return { ctx, page }
}
const clip = { x: 0, y: 0, width: 1440, height: 330 }

for (const dark of [false, true]) {
  const mode = dark ? 'dark' : 'light'
  const states = dark ? ['complete', 'fresh'] : ['complete', 'fresh', 'pickup', 'pickupUnchosen', 'arabicLtr', 'arabicRtl', 'latinRtl', 'locked', 'noCaller']
  for (const v of ['A', 'B', 'C', 'D']) {
    for (const s of states) {
      const { ctx, page } = await open(v, s, dark)
      await page.screenshot({ path: `${OUT}/${v}-${s}-${mode}.png`, clip })
      await ctx.close()
    }
  }
}

// --- open states -------------------------------------------------------------------
{
  const { ctx, page } = await open('A', 'fresh')
  await page.locator('[data-proto-slot="slot"]').click()
  await page.waitForSelector('[data-cc-section="slot"]')
  await page.waitForTimeout(600)
  await page.screenshot({ path: `${OUT}/A-fresh-slot-section-light.png`, clip: { x: 0, y: 0, width: 1440, height: 620 } })
  await ctx.close()
}
{
  const { ctx, page } = await open('B', 'fresh')
  await page.locator('[data-proto-slot="slot"]').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/B-fresh-slot-popover-light.png`, clip: { x: 0, y: 0, width: 1440, height: 520 } })
  await ctx.close()
}
{
  const { ctx, page } = await open('B', 'arabicRtl')
  await page.locator('[data-proto-slot="slot"]').click()
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${OUT}/B-arabicRtl-slot-popover-light.png`, clip: { x: 0, y: 0, width: 1440, height: 520 } })
  await ctx.close()
}

// --- keyboard: B, Tab to the slot word, Enter, ↓, Enter; Esc returns focus ------------
{
  const { ctx, page } = await open('B', 'fresh')
  await page.locator('[data-proto-slot="mode"]').focus()
  let hops = 0
  while (hops < 12) {
    const id = await page.evaluate(() => document.activeElement?.getAttribute('data-proto-slot'))
    if (id === 'slot') break
    await page.keyboard.press('Tab')
    hops++
  }
  ok('B: Tab reaches the slot word in reading order', hops > 0 && hops < 12, `${hops} Tab presses from the mode word`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  const inPop = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))
  ok('B: Enter opens the popover and focus moves into it', inPop)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(200)
  const text = await page.locator('[data-proto-slot="slot"]').innerText()
  const focus = await page.evaluate(() => document.activeElement?.getAttribute('data-proto-slot'))
  ok('B: ↓ Enter sets the window and focus returns to the word', /\d\d:\d\d/.test(text) && focus === 'slot', `slot reads "${text}", focus on ${focus}`)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(150)
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  const back = await page.evaluate(() => document.activeElement?.getAttribute('data-proto-slot'))
  const gone = (await page.locator('[role="dialog"]').count()) === 0
  ok('B: Esc closes and returns focus to the word', gone && back === 'slot')
  // Ctrl+K → "Delivery slot" → the same popover
  await page.keyboard.press('Control+KeyK')
  await page.waitForTimeout(250)
  await page.keyboard.type('slot')
  await page.waitForTimeout(150)
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(300)
  const viaPalette = await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"][aria-label]'))
  ok('B: Ctrl+K "slot" Enter opens the slot popover with focus inside', viaPalette)
  await page.screenshot({ path: `${OUT}/B-fresh-palette-to-popover-light.png`, clip: { x: 0, y: 0, width: 1440, height: 520 } })
  await ctx.close()
}

// --- keyboard: A, Enter on the slot word opens the in-flow section ---------------------
{
  const { ctx, page } = await open('A', 'fresh')
  await page.locator('[data-proto-slot="slot"]').focus()
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-cc-section="slot"]')
  const focused = await page.evaluate(() => document.activeElement?.getAttribute('data-cc-section'))
  ok('A: Enter on the word opens the slot section, focus on the region', focused === 'slot')
  await page.keyboard.press('Escape')
  await page.waitForTimeout(200)
  const back = await page.evaluate(() => document.activeElement?.getAttribute('data-proto-slot'))
  ok('A: Esc closes the section, focus back on the word', back === 'slot', `focus on ${back}`)
  await ctx.close()
}

// --- bidi: the Arabic name sits whole inside the English sentence ---------------------------
{
  const { ctx, page } = await open('A', 'arabicLtr')
  const bdi = await page.locator('[data-proto-sentence] bdi').filter({ hasText: 'فاطمة' }).count()
  ok('arabicLtr: the caller name is isolated in <bdi>', bdi === 1)
  await ctx.close()
}

await browser.close()
console.log(checks.join('\n'))
if (errors.length) console.log('PAGE ERRORS:\n' + errors.join('\n'))
