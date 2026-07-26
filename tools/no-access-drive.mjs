// The empty-menu landing state (ticket 124) — drives the REAL app in Chromium.
//
//   1. run the app:  npx vite --port 5207
//   2. node tools/no-access-drive.mjs
//
// Port 5207, not 5206 — 125 reserves that one, and the two run in the same wave.
//
// Nothing about the app is stubbed except the wire: `Auth/Me` and every `*/Access`
// probe are fulfilled from here, so a run needs no SIS.Api and no seeded user.
//
// ⚠️ The one piece of surgery: the OMS group is still UNGATED on main (ticket 125 is
// what gates it), so no combination of probe answers can empty the menu today. The
// scenarios that need an empty menu therefore rewrite the served `menu-model.ts`
// module in flight, giving every ungated leaf an access probe — 125's world, one
// ticket early. The app code under test is untouched; only the menu data is.
//
// Asserts the ticket's Done-when:
//   1. settled + nothing visible  → the noAccess card (title, body, hint), no section cards;
//   2. a SLOW probe that resolves to visible → the card never renders, at any point —
//      the assertion that makes the settled flag worth having;
//   3. an entitled user's home page is unchanged — same section cards, same order.
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5207}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// Every screen probe reads a different flag off its own payload (canOpen / screenAllowed /
// allowed / canAdmin / canSupport). One object carrying all of them answers all of them,
// so the drive never has to enumerate the endpoints — and a menu item added later is
// covered without touching this file.
const grant = (yes) => ({
  canOpen: yes,
  screenAllowed: yes,
  allowed: yes,
  canAdmin: yes,
  canSupport: yes,
})

/** Appended to the served menu-model module: gate every ungated leaf (ticket 125's world). */
const GATE_ALL = `
;(function () {
  const gate = {
    key: ['drive', 'oms-access'],
    run: () => fetch('/api/Drive/Access').then((r) => r.json()).then((j) => j.data),
    visible: (r) => r != null && r.canOpen === true,
  }
  const walk = (items) => {
    for (const it of items) {
      if (it.items) walk(it.items)
      else if (!it.access) it.access = gate
    }
  }
  walk(MENU)
})()
`

/** Records whether the noAccess card was EVER in the DOM — a poll would miss a flash. */
const WATCH_FLASH = `
window.__noAccessSeen = false
const seen = (records = []) => {
  if (document.querySelector('[data-no-access]')) window.__noAccessSeen = true
  // The live query alone would miss a card ADDED and REMOVED inside one batch — the
  // callback runs after both. So the records themselves are scanned too.
  for (const r of records)
    for (const n of r.addedNodes)
      if (n.nodeType === 1 && (n.matches?.('[data-no-access]') || n.querySelector?.('[data-no-access]')))
        window.__noAccessSeen = true
}
// \`document\` (not documentElement, which does not exist yet at document_start) — every
// mount lands underneath it, so a card that appears for one frame is still recorded.
new MutationObserver(seen).observe(document, { childList: true, subtree: true })
seen()
`

/**
 * A fresh context per scenario: the browser caches the transformed menu-model module, so
 * scenarios that rewrite it and scenarios that don't must not share one.
 *
 * @param opts.gateAll  rewrite the menu so every leaf is gated
 * @param opts.granted  what every `*​/Access` probe answers
 * @param opts.hold     hold EVERY access probe until released (the slow-probe case)
 */
async function open(browser, { gateAll = false, granted = false, hold = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1400, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  let release = () => {}
  const held = new Promise((resolve) => (release = resolve))

  if (gateAll) {
    await page.route('**/src/layout/menu-model.ts*', async (route) => {
      const response = await route.fetch()
      route.fulfill({ response, body: (await response.text()) + GATE_ALL })
    })
  }

  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }),
      )
    if (/Access$/.test(p)) {
      // Covers the injected `Drive/Access` gate and every real screen probe alike.
      if (hold) await held
      return route.fulfill(envelope(grant(granted)))
    }
    return route.fulfill(envelope({}))
  })

  await page.addInitScript(WATCH_FLASH)
  return { context, page, errors, release }
}

const noAccess = (page) => page.locator('[data-no-access]')
const sections = (page) => page.locator('[data-section-card]')
const sectionTitles = (page) =>
  sections(page).evaluateAll((els) => els.map((e) => e.querySelector('h2').innerText.trim()))

async function run() {
  const browser = await chromium.launch()

  // ================================ 1 · settled with nothing to open → the noAccess card
  {
    const { context, page, errors } = await open(browser, { gateAll: true, granted: false })
    await page.goto(BASE + '/')
    await page.locator('h1').waitFor()
    await page.waitForTimeout(600)

    check(
      'every group hidden: the home page shows the noAccess card instead of empty space',
      (await noAccess(page).count()) === 1,
      `${await noAccess(page).count()} card(s)`,
    )
    const copy = (await noAccess(page).count()) ? await noAccess(page).innerText() : ''
    check(
      'it carries the title — "Nothing to show here yet"',
      /Nothing to show here yet/.test(copy),
      copy.split('\n')[0],
    )
    check(
      'the body is the DIAGNOSIS — signed in, activated, simply unassigned',
      /account is active and you are signed in, but no screens have been assigned/.test(copy),
    )
    check('the hint is the ACTION — contact IT support', /contact IT support/.test(copy))
    check(
      'no raw i18n keys reached the screen — the keys are backed in home.json',
      !/noAccess\./.test(copy),
      copy.replace(/\s+/g, ' ').slice(0, 120),
    )
    check('and no section cards render alongside it', (await sections(page).count()) === 0)
    check(
      'the hero card is still there — the message joins the landing, it does not replace it',
      (await page.locator('h1').count()) === 1,
    )
    // Negative control for scenarios 2 and 3: the flash watcher DOES fire when the card
    // is on screen, so its silence there is evidence rather than a broken observer.
    check(
      'the flash watcher records this card — so a "never rendered" verdict below means something',
      (await page.evaluate(() => window.__noAccessSeen)) === true,
    )
    check('no page errors on the empty landing', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ==================================== 2 · a slow probe must NOT flash the empty state
  {
    const { context, page, errors, release } = await open(browser, {
      gateAll: true,
      granted: true,
      hold: true,
    })
    await page.goto(BASE + '/')
    await page.locator('h1').waitFor()
    // Every probe is still out — so the menu is empty exactly the way it is empty for a
    // user with no grants at all. This is the moment a naive length check would fire.
    await page.waitForTimeout(700)

    check(
      'while the probes are still out the menu is empty — but the card is NOT shown (unsettled)',
      (await noAccess(page).count()) === 0 && (await sections(page).count()) === 0,
      `${await noAccess(page).count()} card(s), ${await sections(page).count()} section(s)`,
    )
    release()
    await sections(page).first().waitFor()
    await page.waitForTimeout(400)
    check(
      'when the slow probe resolves to VISIBLE the section cards appear',
      (await sections(page).count()) > 0,
      `${await sections(page).count()} section(s)`,
    )
    check(
      'and the noAccess card was never rendered at any point during the load — no flash',
      (await page.evaluate(() => window.__noAccessSeen)) === false,
    )
    check('no page errors on the slow-probe load', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ========================================= 3 · an entitled user's landing is unchanged
  {
    const { context, page, errors } = await open(browser, { gateAll: false, granted: true })
    await page.goto(BASE + '/')
    await page.locator('h1').waitFor()
    await sections(page).first().waitFor()
    await page.waitForTimeout(500)

    const titles = await sectionTitles(page)
    check(
      'an entitled user sees the section cards, in MENU order — OMS, Admin, Pricing',
      titles.length === 3 && /OMS/i.test(titles[0]) && /Admin/i.test(titles[1]),
      titles.join(' · '),
    )
    check(
      'every leaf is a quick link — the groups are not empty shells',
      (await page.locator('[data-section-card] a').count()) >= 8,
      `${await page.locator('[data-section-card] a').count()} link(s)`,
    )
    check('the noAccess card is absent for an entitled user', (await noAccess(page).count()) === 0)
    check(
      'and it never appeared mid-load either',
      (await page.evaluate(() => window.__noAccessSeen)) === false,
    )
    check('no page errors on the entitled landing', errors.length === 0, errors.join(' | '))
    await context.close()
  }

  await browser.close()
  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  process.exitCode = failed.length ? 1 : 0
}

run().catch((e) => {
  console.error(e)
  process.exitCode = 1
})
