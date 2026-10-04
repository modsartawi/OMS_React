// Simulation's Process command drive (ticket 406, spec 380 M1–M2; ruling 365 §8). Drives the
// REAL app in Chromium, light, dark and RTL; only the wire is stubbed: `Pricing/Simulate`
// answers the captured 098 payloads, every other call a minimal envelope.
//
// Asserts, in each theme/direction:
//   1. at rest the basket is empty: `▶ Process ⌃⏎` keeps its hint, carries
//      `aria-keyshortcuts="Control+Enter"`, and its tooltip is the refusal, "Add an item first";
//   2. Ctrl+Enter HELD on the empty basket (from inside the items entry) toasts that reason
//      exactly once, and posts nothing;
//   3. with an item typed, the tooltip reads "Process (Ctrl+Enter)", the chord isolated as one
//      unit, and Ctrl+Enter from inside the quantity box runs one simulation;
//   4. Ctrl+Enter from a focused result line runs Process too — the line's own Enter leaves a
//      modified press alone — and toggles nothing;
//   5. a second press while a run is in flight toasts "A run is already in progress" and posts
//      nothing more;
//   6. under an open dialog (Clear cache's confirm) Ctrl+Enter does nothing: no post, no toast;
//   7. the palette's This screen group lists Process with its Ctrl Enter hint; with no item it
//      is a greyed row carrying the reason, and Enter on it posts nothing; with an item, Enter
//      on it runs one simulation once the palette has closed;
//   8. the shortcuts sheet lists Process alone on this screen — Simulation has no single keys,
//      and a letter pressed on the page does nothing;
//   9. the retheme holds: Plex on the page, the run controls drop the pill (6px), and the chip
//      strip, Items, a line's expansion with its money foot and rule cards render — captured
//      to screenshots for the eye.
// No page errors anywhere (the key registry's dev refusals are console errors, so a refused
// key would fail this too).
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/sim-process-drive.mjs
//
// Screenshots → tools/.sim-process-shots/ (gitignored).
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sim-process-shots'
const ASSETS = '.issues/assets/098-simulate-payloads/'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

/** A run with a fired bonus buy: its lines carry rule cards and a money foot. */
const PAYLOAD = JSON.parse(readFileSync(ASSETS + '02-fired-bonus-buy.json', 'utf8')).response.data

const NO_ITEMS = 'Add an item first'
const RUNNING = 'A run is already in progress'
const FSI = '\u2068'
const PDI = '\u2069'

const MODES = [
  { theme: 'light', dir: 'ltr' },
  { theme: 'dark', dir: 'ltr' },
  { theme: 'light', dir: 'rtl' },
]

const processButton = (page) => page.locator('[data-run-strip] button', { hasText: /Process/ }).first()

/** What the page shows right now. */
const read = (page) =>
  page.evaluate(() => {
    const button = [...document.querySelectorAll('[data-run-strip] button')].find((b) => /Process/.test(b.textContent))
    return {
      dir: document.documentElement.dir,
      processTitle: button?.getAttribute('title') ?? null,
      processKeys: button?.getAttribute('aria-keyshortcuts') ?? null,
      processDisabled: button ? button.disabled : null,
      processHint: button?.querySelector('span[aria-hidden]')?.textContent ?? null,
      processRadius: button ? getComputedStyle(button).borderTopLeftRadius : null,
      dialogOpen: document.querySelector('dialog[open]') !== null,
      toasts: [...document.querySelectorAll('[data-sonner-toast]')].map((t) => t.textContent.trim()),
      lines: document.querySelectorAll('[data-result-line]').length,
      expansions: document.querySelectorAll('[data-line-expansion]').length,
      font: getComputedStyle(document.body).fontFamily,
    }
  })

/** Closes every toast through its own close button — never by removing sonner's nodes from under React. */
async function dismissToasts(page) {
  for (const close of await page.locator('[data-sonner-toast] [data-close-button]').all()) await close.click().catch(() => {})
  await page
    .waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 0, null, { timeout: 3000 })
    .catch(() => {})
}

/** Ctrl+Enter held: one press, then the auto-repeat a held key sends. */
async function holdCtrlEnter(page, repeats = 5) {
  await page.keyboard.down('Control')
  await page.keyboard.down('Enter')
  for (let i = 0; i < repeats; i++) {
    await page.keyboard.down('Enter')
    await page.waitForTimeout(30)
  }
  await page.keyboard.up('Enter')
  await page.keyboard.up('Control')
}

const itemInput = (page, nth) => page.locator('table').first().locator('tbody input').nth(nth)

async function drive(browser, { theme, dir }) {
  const label = `${theme}/${dir}`
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    },
    [theme, dir],
  )

  const posted = []
  const wire = { delayMs: 0 }
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', displayName: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'Pricing/CacheAccess') return route.fulfill(envelope({ canClear: true }))
    if (p === 'Pricing/Simulate') {
      posted.push(JSON.parse(route.request().postData() || '{}'))
      if (wire.delayMs) await new Promise((r) => setTimeout(r, wire.delayMs))
      return route.fulfill(envelope(PAYLOAD))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope({}))
  })

  await page.goto(`${BASE}/pricing/simulation`)
  await page.locator('[data-run-strip]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)

  // ------------------------------------------------------------ 1 · at rest, refused
  const rest = await read(page)
  check(`${label}: the page renders ${dir === 'rtl' ? 'right-to-left' : 'left-to-right'}`, rest.dir === dir, rest.dir)
  check(
    `${label}: ▶ Process keeps its ⌃⏎ hint, carries aria-keyshortcuts, and its tooltip is the refusal`,
    rest.processHint === '⌃⏎' &&
      rest.processKeys === 'Control+Enter' &&
      rest.processDisabled === true &&
      rest.processTitle === NO_ITEMS,
    JSON.stringify(rest),
  )

  // ------------------------------------------------------------ 2 · held on an empty basket
  await itemInput(page, 0).focus()
  await holdCtrlEnter(page)
  await page.waitForTimeout(400)
  const held = await read(page)
  check(
    `${label}: Ctrl+Enter held on an empty basket toasts "${NO_ITEMS}" exactly once and posts nothing`,
    held.toasts.length === 1 && held.toasts[0].includes(NO_ITEMS) && posted.length === 0,
    JSON.stringify({ toasts: held.toasts, posted: posted.length }),
  )
  await dismissToasts(page)

  // ------------------------------------------------------------ 3 · a run from the quantity box
  await itemInput(page, 0).fill('107255')
  await itemInput(page, 1).fill('2')
  await page.waitForTimeout(150)
  const ready = await read(page)
  check(
    `${label}: with an item the tooltip reads "Process (Ctrl+Enter)", the chord isolated as one unit`,
    ready.processDisabled === false && ready.processTitle === `Process (${FSI}Ctrl+Enter${PDI})`,
    JSON.stringify(ready.processTitle),
  )
  await itemInput(page, 1).focus()
  await page.keyboard.press('Control+Enter')
  await page.locator('[data-result-line]').first().waitFor({ timeout: 5000 }).catch(() => {})
  await page.waitForTimeout(300)
  const ran = await read(page)
  check(
    `${label}: Ctrl+Enter from inside the quantity box runs one simulation`,
    posted.length === 1 && posted[0].items?.[0]?.materialNumber === '107255' && ran.lines > 0 && ran.toasts.length === 0,
    JSON.stringify({ posted: posted.length, lines: ran.lines, toasts: ran.toasts }),
  )

  // ------------------------------------------------------------ 4 · from a focused result line
  await page.locator('[data-result-line]').first().focus()
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(500)
  const fromLine = await read(page)
  check(
    `${label}: Ctrl+Enter from a focused result line runs Process too and toggles nothing`,
    posted.length === 2 && fromLine.expansions === 0,
    JSON.stringify({ posted: posted.length, expansions: fromLine.expansions }),
  )

  // ------------------------------------------------------------ 5 · a run in flight
  wire.delayMs = 1500
  await itemInput(page, 1).focus()
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(200)
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(250)
  const inFlight = await read(page)
  check(
    `${label}: a press while a run is in flight toasts "${RUNNING}" and posts nothing more`,
    posted.length === 3 && inFlight.toasts.length === 1 && inFlight.toasts[0].includes(RUNNING) && inFlight.processTitle === RUNNING,
    JSON.stringify({ posted: posted.length, toasts: inFlight.toasts, title: inFlight.processTitle }),
  )
  await page.waitForTimeout(1500)
  wire.delayMs = 0
  await dismissToasts(page)

  // ------------------------------------------------------------ 6 · inert under a dialog
  await page.locator('[data-run-strip] button', { hasText: /Clear cache/ }).first().click()
  await page.waitForSelector('dialog[open]', { timeout: 3000 }).catch(() => {})
  const before = posted.length
  await page.keyboard.press('Control+Enter')
  await page.waitForTimeout(400)
  const underDialog = await read(page)
  check(
    `${label}: under an open dialog Ctrl+Enter does nothing — no post, no toast`,
    underDialog.dialogOpen && posted.length === before && underDialog.toasts.length === 0,
    JSON.stringify({ dialog: underDialog.dialogOpen, posted: posted.length - before, toasts: underDialog.toasts }),
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)

  // ------------------------------------------------------------ 9 · the retheme, with a line open
  await page.locator('[data-result-line]').first().click()
  await page.waitForTimeout(250)
  const look = await page.evaluate(() => {
    const exp = document.querySelector('[data-line-expansion]')
    const radius = (el) => (el ? getComputedStyle(el).borderTopLeftRadius : null)
    const strip = document.querySelector('[data-run-strip]')
    return {
      font: getComputedStyle(document.body).fontFamily,
      foot: !!exp?.querySelector('[data-money-foot]'),
      cards: exp ? exp.querySelectorAll('[data-condition-card]').length : 0,
      chips: document.querySelectorAll('[data-chip]').length,
      items: document.querySelector('table')?.querySelectorAll('tbody input').length ?? 0,
      buttons: [...(strip?.querySelectorAll('button') ?? [])]
        .filter((b) => /Process|Clear/.test(b.textContent))
        .map((b) => [b.textContent.trim().slice(0, 12), radius(b)]),
    }
  })
  check(`${label}: the page is set in IBM Plex Sans`, /IBM Plex Sans/.test(look.font), look.font)
  check(
    `${label}: the run controls drop the pill — 6px controls`,
    look.buttons.length >= 3 && look.buttons.every(([, r]) => r === '6px'),
    JSON.stringify(look.buttons),
  )
  check(
    `${label}: the chip strip, Items, and an open line's money foot and rule cards render`,
    look.chips > 0 && look.items > 0 && look.foot && look.cards > 0,
    JSON.stringify({ chips: look.chips, items: look.items, foot: look.foot, cards: look.cards }),
  )
  await page.screenshot({ path: `${SHOTS}/sim-run-${theme}-${dir}.png`, fullPage: true })

  // ------------------------------------------------------------ 7 · the palette row
  await itemInput(page, 1).focus()
  await page.keyboard.press('Control+k')
  await page.waitForSelector('[data-palette]', { timeout: 3000 }).catch(() => {})
  const row = await page.evaluate(() => {
    const el = document.querySelector('[data-palette-row="screen:process"]')
    return {
      present: !!el,
      group: el?.closest('[data-palette-group]')?.getAttribute('data-palette-group') ?? null,
      text: el?.textContent.replace(/\s+/g, ' ').trim() ?? null,
      chord: el?.querySelector('[data-key-chord]')?.getAttribute('data-key-chord') ?? null,
      caps: [...(el?.querySelectorAll('kbd') ?? [])].map((k) => k.textContent.trim()),
      disabled: el?.getAttribute('aria-disabled') ?? null,
      isolated: !!el?.querySelector('[data-key-chord] bdi[dir="ltr"]'),
    }
  })
  check(
    `${label}: the palette's This screen group lists Process with its Ctrl Enter hint, isolated as one unit`,
    row.present &&
      row.group === 'screen' &&
      row.chord === 'Ctrl+Enter' &&
      JSON.stringify(row.caps) === '["Ctrl","Enter"]' &&
      row.isolated &&
      row.disabled === 'false',
    JSON.stringify(row),
  )
  await page.screenshot({ path: `${SHOTS}/sim-palette-${theme}-${dir}.png` })
  const beforeRow = posted.length
  await page.locator('[data-palette-input]').fill('Process')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await page.waitForSelector('[data-palette]', { state: 'detached', timeout: 3000 }).catch(() => {})
  await page.waitForTimeout(500)
  check(
    `${label}: Enter on the Process row runs one simulation once the palette has closed`,
    posted.length === beforeRow + 1 && (await page.locator('[data-palette]').count()) === 0,
    `posted ${posted.length - beforeRow}`,
  )

  // The refused row: an empty basket.
  await page.locator('[data-run-strip] button', { hasText: /^Clear$/ }).first().click()
  await page.waitForTimeout(200)
  await page.keyboard.press('Control+k')
  await page.waitForSelector('[data-palette]', { timeout: 3000 }).catch(() => {})
  const refusedRow = await page.evaluate(() => ({
    disabled: document.querySelector('[data-palette-row="screen:process"]')?.getAttribute('aria-disabled') ?? null,
    reason: document.querySelector('[data-palette-reason="screen:process"]')?.textContent.trim() ?? null,
  }))
  const beforeRefused = posted.length
  await page.locator('[data-palette-input]').fill('Process')
  await page.waitForTimeout(150)
  await page.keyboard.press('Enter')
  await page.waitForTimeout(400)
  check(
    `${label}: with no item the Process row is greyed, carries "${NO_ITEMS}", and Enter on it posts nothing`,
    refusedRow.disabled === 'true' && refusedRow.reason === NO_ITEMS && posted.length === beforeRefused,
    JSON.stringify({ ...refusedRow, posted: posted.length - beforeRefused }),
  )

  // ------------------------------------------------------------ 8 · the sheet, and no single keys
  await page.locator('[data-palette-input]').fill('')
  await page.locator('[data-palette-row="core:shortcuts"]').click()
  await page.waitForSelector('[data-shortcuts-sheet]', { timeout: 3000 }).catch(() => {})
  const sheet = await page.$$eval('[data-shortcuts-sheet] [data-shortcut^="screen:"]', (els) =>
    els.map((l) => ({ id: l.getAttribute('data-shortcut'), text: l.textContent.replace(/\s+/g, ' ').trim() })),
  )
  check(
    `${label}: the shortcuts sheet lists Process alone on this screen, under Ctrl Enter`,
    sheet.length === 1 && sheet[0].id === 'screen:process' && /Process/.test(sheet[0].text) && /Ctrl/.test(sheet[0].text),
    JSON.stringify(sheet),
  )
  await page.keyboard.press('Escape')
  await page.waitForTimeout(250)
  await page.evaluate(() => document.activeElement instanceof HTMLElement && document.activeElement.blur())
  const beforeLetters = posted.length
  for (const key of ['r', 'p', 'n', 'Slash', 'Shift+Slash']) await page.keyboard.press(key)
  await page.waitForTimeout(300)
  const letters = await read(page)
  check(
    `${label}: letters, / and ? do nothing on Simulation — no post, no dialog, no toast`,
    posted.length === beforeLetters && !letters.dialogOpen && letters.toasts.length === 0 &&
      (await page.locator('[data-palette]').count()) === 0,
    JSON.stringify({ posted: posted.length - beforeLetters, dialog: letters.dialogOpen, toasts: letters.toasts }),
  )

  check(`${label}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

const browser = await chromium.launch()
try {
  for (const mode of MODES) await drive(browser, mode)
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exitCode = failed.length ? 1 : 0
