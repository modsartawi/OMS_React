// PROTOTYPE 379 — captures + checks of the customer-rail variants.
//
//   1. npx vite --port 5379
//   2. node tools/proto-379-shots.mjs
//
// → .issues/assets/379-shots/ (copied by hand into the main checkout's assets).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5379}`
const OUT = process.env.OUT || '.issues/assets/379-shots'
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []
const checks = []
const ok = (name, cond, detail = '') => checks.push(`${cond ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)

async function open(variant, state, { dark = false, width = 1280 } = {}) {
  const height = width === 1280 ? 800 : 900
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await ctx.addInitScript((d) => localStorage.setItem('oms.darkMode', String(d)), dark)
  const page = await ctx.newPage()
  page.setDefaultTimeout(6000)
  page.on('pageerror', (e) => errors.push(`${variant}/${state}: ${e}`))
  await page.goto(`${BASE}/prototype/callcenter-rail?stub=1&palette=navy&variant=${variant}&state=${state}`, { timeout: 60000 })
  await page.waitForSelector('[data-cc-chips]', { timeout: 90000 })
  await page.waitForTimeout(400)
  // The dev bars cover the receipt foot; hide them for the shot.
  await page.addStyleTag({ content: '[data-proto-bar], .fixed.bottom-1 { display: none !important }' })
  return { ctx, page }
}
const shot = (page, name) => page.screenshot({ path: `${OUT}/${name}.png` })
const centreWidth = (page) => page.evaluate(() => Math.round(document.querySelector('[data-cc-console] main')?.getBoundingClientRect().width ?? 0))

const STATES = ['opening', 'attached', 'linked', 'complete', 'collection', 'collectionUnchosen', 'arabicRtl']
const VARIANTS = ['A', 'B', 'C', 'D']

// --- the static captures ------------------------------------------------------------
const widths = {}
for (const v of VARIANTS) {
  for (const s of STATES) {
    const { ctx, page } = await open(v, s)
    await shot(page, `${v}-${s}-1280`)
    if (s === 'complete') widths[`${v}@1280`] = await centreWidth(page)
    await ctx.close()
  }
  for (const [s, dark] of [['complete', false], ['complete', true], ['attached', true]]) {
    const { ctx, page } = await open(v, s, { dark, width: 1440 })
    await shot(page, `${v}-${s}-1440-${dark ? 'dark' : 'light'}`)
    if (!dark && s === 'complete') widths[`${v}@1440`] = await centreWidth(page)
    await ctx.close()
  }
}
checks.push(`INFO  centre column width (complete): ${JSON.stringify(widths)}`)

// --- the opening move: caret, find, attach, miss → sign-up -------------------------
for (const v of VARIANTS) {
  {
    const { ctx, page } = await open(v, 'opening')
    const focused = await page.evaluate(() => document.activeElement?.id)
    ok(`${v}: caret in the phone box on open (153/165)`, focused === 'cc-phone', `active=${focused}`)
    await page.keyboard.type('0501076360')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-cc-lookup-found]')
    await shot(page, `${v}-flow-1-found`)
    const before = await centreWidth(page)
    await page.locator('[data-cc-attach]').click()
    await page.waitForSelector('[data-cc-caller]')
    await page.waitForTimeout(250)
    await shot(page, `${v}-flow-2-attached`)
    const after = await centreWidth(page)
    ok(`${v}: centre column holds still across attach (135)`, before === after, `${before}px → ${after}px`)
    const tier = await page.locator('[data-cc-rail-field="tier"]').count()
    ok(`${v}: tier + points survive the attach`, tier > 0)
    const offer = await page.locator('[data-cc-request-view]').count()
    ok(`${v}: open-requests offer drawn once the caller lands (194)`, offer === 1)
    // Remove: the phone box comes back and takes the caret.
    await page.locator('[data-cc-remove-caller]').click()
    await page.waitForSelector('#cc-phone')
    await page.waitForTimeout(200)
    const back = await page.evaluate(() => document.activeElement?.id)
    ok(`${v}: remove → caret back in the phone box`, back === 'cc-phone', `active=${back}`)
    await ctx.close()
  }
  {
    const { ctx, page } = await open(v, 'opening')
    await page.keyboard.type('0500000000')
    await page.keyboard.press('Enter')
    await page.waitForSelector('[data-cc-lookup-miss]')
    await page.locator('[data-cc-signup-open]').click()
    await page.waitForSelector('[data-cc-signup]')
    await page.waitForTimeout(200)
    await shot(page, `${v}-flow-3-signup`)
    const signupBox = await page.locator('[data-cc-signup]').boundingBox()
    const steps = await page.locator('[data-cc-steps]').boundingBox()
    ok(`${v}: sign-up panel visible without scrolling`, !!signupBox && signupBox.y + signupBox.height <= 800, `bottom=${Math.round((signupBox?.y ?? 0) + (signupBox?.height ?? 0))}px`)
    checks.push(`INFO  ${v}: sign-up pushes the opening-steps card to y=${Math.round(steps?.y ?? -1)}`)
    await ctx.close()
  }
  // The sentence's address word is the second door to the address book (373).
  {
    const { ctx, page } = await open(v, 'complete')
    await page.locator('[data-proto-slot="address"]').click()
    const toast = await page.locator('[data-sonner-toast]').first().textContent({ timeout: 2000 }).catch(() => '')
    ok(`${v}: sentence address word opens the address book`, /address book/.test(toast ?? ''))
    const railDoors = await page.locator('[data-cc-change-address], [data-cc-pick-address]').count()
    checks.push(`INFO  ${v}: address-book doors outside the sentence = ${railDoors}`)
    await ctx.close()
  }
}

await browser.close()
console.log(checks.join('\n'))
if (errors.length) console.log('\nPAGE ERRORS\n' + errors.join('\n'))
