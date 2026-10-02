// PROTOTYPE 377 — captures of the overlay variants on the real app (stubbed data).
//
//   1. npx vite --port 5277
//   2. DRIVE_PORT=5277 node tools/proto-377-shots.mjs     (ONLY=<regex> to re-shoot a subset)
//
// → .issues/assets/377-shots/ (copied by hand into the main checkout's assets).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5277}`
const OUT = process.env.OUT || '.issues/assets/377-shots'
const ONLY = process.env.ONLY ? new RegExp(process.env.ONLY) : null
mkdirSync(OUT, { recursive: true })

const browser = await chromium.launch()
const errors = []
const facts = []

async function open({ dark = false, rtl = false, width = 1440, height = 900, axes = {} } = {}) {
  const ctx = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1 })
  await ctx.addInitScript(
    ([d, a]) => {
      localStorage.setItem('oms.darkMode', String(d))
      localStorage.setItem('proto363.d.expanded', '0')
      localStorage.setItem(
        'proto377',
        JSON.stringify({ fam: 'today', toast: 'today', pos: 'top-right', bell: 'today', host: 'root', ...a }),
      )
    },
    [dark, axes],
  )
  const page = await ctx.newPage()
  page.setDefaultTimeout(5000)
  page.setDefaultNavigationTimeout(90000)
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.goto(`${BASE}/oms/deliveries?stub=1&palette=navy&shell=D&rtl=${rtl ? 1 : 0}&cmd=1`)
  const load = page.getByRole('button', { name: /load/i }).first()
  await load.waitFor({ timeout: 90000 }).catch(() => {})
  await page.waitForTimeout(1500)
  await load.click().catch(() => {})
  await page.waitForSelector('.ag-row[row-index="5"]', { state: 'attached', timeout: 20000 }).catch(() => {})
  await page.addStyleTag({ content: '[data-proto-bar]{display:none!important}' })
  await page.waitForTimeout(300)
  return { ctx, page }
}

const run = (page, fn) => page.evaluate((f) => window.__stage[f](), fn)

async function shot(name, opts, body) {
  if (ONLY && !ONLY.test(name)) return
  const { ctx, page } = await open(opts)
  try {
    await body(page)
    await page.screenshot({ path: `${OUT}/${name}.png` })
    console.log('shot', name)
  } catch (e) {
    errors.push(`${name}: ${e.message.split('\n')[0]}`)
  }
  await ctx.close()
}

async function toasts(page, { expand = true, arrival = true } = {}) {
  await run(page, 'toasts')
  if (arrival) await run(page, 'arrival')
  await page.waitForTimeout(1200)
  if (expand) await page.hover('[data-sonner-toast]').catch(() => {})
  await page.waitForTimeout(600)
}

const modes = [
  ['light', {}],
  ['dark', { dark: true }],
  ['rtl', { rtl: true }],
]

// 1. today, as shipped: toasts top-right over the 44px bar, and with the bell open
for (const [m, o] of modes) await shot(`today-toasts-${m}`, o, (p) => toasts(p))
await shot('today-toasts-over-bell-light', {}, async (p) => {
  await run(p, 'bell')
  await p.waitForTimeout(300)
  await run(p, 'toasts')
  await p.waitForTimeout(1200)
})

// 2. toast looks at top-end under the bar
for (const look of ['today', 'tinted', 'bar', 'ink'])
  for (const [m, o] of modes.slice(0, 2))
    await shot(`toast-${look}-${m}`, { ...o, axes: { toast: look, pos: 'top-end' } }, (p) => toasts(p))

// 3. positions (tinted), incl. the RTL mapping
for (const pos of ['top-right', 'top-end', 'bottom-end', 'bottom-center']) {
  await shot(`pos-${pos}-light`, { axes: { toast: 'tinted', pos } }, (p) => toasts(p, { expand: false }))
  await shot(`pos-${pos}-rtl`, { rtl: true, axes: { toast: 'tinted', pos } }, (p) => toasts(p, { expand: false }))
}
await shot('pos-top-end-with-bell-light', { axes: { toast: 'tinted', pos: 'top-end', bell: 'dense', fam: 'card' } }, async (p) => {
  await run(p, 'bell')
  await p.waitForTimeout(300)
  await toasts(p, { expand: false, arrival: false })
})

// 4. bell panel
for (const bell of ['today', 'dense', 'sheet'])
  for (const [m, o] of modes)
    await shot(`bell-${bell}-${m}`, { ...o, axes: { bell, fam: bell === 'today' ? 'today' : 'card' } }, async (p) => {
      await run(p, 'bell')
      await p.waitForTimeout(500)
    })

// 5. family: user menu (rail foot), store chip, columns popover
for (const fam of ['today', 'card', 'split'])
  for (const [m, o] of modes.slice(0, 2)) {
    await shot(`fam-${fam}-usermenu-${m}`, { ...o, axes: { fam } }, async (p) => {
      await p.locator('[data-rail] button[aria-expanded]').last().click()
      await p.waitForTimeout(300)
    })
    await shot(`fam-${fam}-storechip-${m}`, { ...o, axes: { fam } }, async (p) => {
      await p.locator('header button[aria-expanded]').first().click()
      await p.waitForTimeout(300)
    })
  }
for (const fam of ['today', 'card'])
  await shot(`fam-${fam}-columns-light`, { axes: { fam } }, async (p) => {
    await p.getByRole('button', { name: /columns/i }).first().click()
    await p.waitForTimeout(300)
  })

// 6. dialogs: confirm + form, focus shown with a keyboard Tab
for (const fam of ['today', 'card'])
  for (const [m, o] of modes) {
    await shot(`dialog-${fam}-confirm-${m}`, { ...o, axes: { fam } }, async (p) => {
      await run(p, 'confirm')
      await p.waitForTimeout(400)
      await p.keyboard.press('Tab')
      await p.waitForTimeout(200)
    })
    await shot(`dialog-${fam}-form-${m}`, { ...o, axes: { fam } }, async (p) => {
      await run(p, 'form')
      await p.waitForTimeout(400)
      await p.keyboard.press('Tab')
      await p.waitForTimeout(200)
    })
  }

// 7. a toast raised while a dialog is open: root host vs dialog host
for (const host of ['root', 'dialog'])
  for (const [m, o] of modes.slice(0, 2))
    await shot(`error-in-dialog-${host}-${m}`, { ...o, axes: { fam: 'card', toast: 'tinted', pos: 'top-end', host } }, async (p) => {
      await run(p, 'errorInDialog')
      await p.waitForTimeout(1600)
      const close = p.locator('[data-sonner-toast] [data-close-button]').first()
      const box = await close.boundingBox().catch(() => null)
      if (!box) return void facts.push(`error-in-dialog host=${host} ${m}: no close button found`)
      const hit = await p.evaluate(
        ([x, y]) => {
          const el = document.elementFromPoint(x, y)
          if (!el) return 'none'
          return el.closest('[data-close-button]') ? 'close-button' : `${el.tagName}`
        },
        [box.x + box.width / 2, box.y + box.height / 2],
      )
      facts.push(`error-in-dialog host=${host} ${m}: hit-test at the toast's close = ${hit}`)
    })

// 8. measured facts
if (!ONLY) {
  const { ctx, page } = await open({ axes: { pos: 'top-right' } })
  await run(page, 'toasts')
  await page.waitForTimeout(1000)
  facts.push(
    'today top-right: ' +
      JSON.stringify(
        await page.evaluate(() => {
          const t = document.querySelector('[data-sonner-toast]')?.getBoundingClientRect()
          const h = document.querySelector('header')?.getBoundingClientRect()
          const bell = document.querySelector('[aria-haspopup="dialog"]')?.getBoundingClientRect()
          const toaster = document.querySelector('[data-sonner-toaster]')
          const ok = document.querySelector('[data-sonner-toast][data-type="success"]')
          return {
            toast: t && [Math.round(t.left), Math.round(t.top), Math.round(t.right), Math.round(t.bottom)],
            headerBottom: h?.bottom,
            bell: bell && [Math.round(bell.left), Math.round(bell.top), Math.round(bell.right), Math.round(bell.bottom)],
            font: toaster && getComputedStyle(toaster).fontFamily,
            successBg: ok && getComputedStyle(ok).backgroundColor,
            successInk: ok && getComputedStyle(ok).color,
          }
        }),
      ),
  )
  await ctx.close()
}

console.log('\nFACTS\n' + facts.join('\n'))
console.log('\nERRORS\n' + (errors.length ? errors.join('\n') : 'none'))
await browser.close()
