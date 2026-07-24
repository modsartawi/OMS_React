// StatusBadge drive (ticket 086) — proves the ONE badge idiom paints the severity
// tokens on the real DOM, in BOTH themes, from a single class string.
//
// `npm run typecheck` proves the map is exhaustive over the `Severity` union; it
// cannot prove the string reaches a screen or that one string is correct in two
// themes. That is the whole claim of spec 082 R4/D-6 — `-050` and `-800` are
// ROLES whose absolute lightness swaps — so this reads computed styles back out
// of painted pills and asserts:
//   1. every pill's ground/ink equals its severity's tokens, per theme;
//   2. NO pill class attribute contains a `dark:` variant (the negative
//      assertion — a reintroduced twin would still look right in a screenshot);
//   3. ua-admin's six derived password states cover ok / warn / bad / mute.
// The fifth severity (`go`) is asserted by tools/bby-inquiry-drive.mjs, whose
// live validity marker is its only consumer today.
//
// SIS.Api's UaAdminWeb/* endpoints need a grant a dev session does not have, so
// every `/api/**` call is mocked — the harness from tools/bby-inquiry-drive.mjs.
// Mocked data, real app, real browser, real CSS.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/status-badge-drive.mjs
//
// Screenshots (light + dark) → tools/.badge-shots/.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.badge-shots'
mkdirSync(SHOTS, { recursive: true })

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

// One row per branch of `deriveStatus` — the four password states plus the two
// terminal ones, so the worklist paints ok / warn / bad / mute side by side.
const ROW = (employeeId, over) => ({
  employeeId,
  displayName: `Person ${employeeId}`,
  phone: '0500000000',
  phoneClass: 'usable',
  isActive: true,
  isSeeded: true,
  credentialState: 'active',
  isTotpEnrolled: false,
  lastLoginAt: '2026-07-01T09:00:00',
  ...over,
})

const ROWS = [
  ROW('1001', {}), //                                              active   → ok
  ROW('1002', { credentialState: 'temporary-must-change' }), //     must-chg → warn
  ROW('1003', { credentialState: 'none' }), //                      awaiting → warn
  ROW('1004', { credentialState: 'none', phoneClass: 'missing' }), // blocked → bad
  ROW('1005', { isSeeded: false }), //                              notSeeded→ bad
  ROW('1006', { isActive: false }), //                              disabled → mute
]

// label → the severity `deriveStatus` assigns it (helpers.ts). The drive asserts
// the PAINT matches this table; the table itself mirrors the ticket's vocabulary.
const EXPECT_SEV = {
  Active: 'ok',
  'Must change password': 'warn',
  'Awaiting activation': 'warn',
  'Blocked — no phone': 'bad',
  'Not seeded': 'bad',
  Disabled: 'mute',
}

// severity → the token pair `core/ui/severity.ts` spells. Kept as TOKEN NAMES,
// not hex: the drive resolves them in the live document per theme, so it stays
// correct when a token value moves and still fails when a badge stops reading it.
const SEV_TOKENS = {
  ok: ['--success-050', '--success-800'],
  go: ['--primary-050', '--primary-800'],
  warn: ['--attention-050', '--attention-800'],
  bad: ['--danger-050', '--danger-800'],
  mute: ['--muted', '--muted-foreground'],
}

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

await page.route('**/api/**', async (route) => {
  const url = route.request().url()
  const path = url.split('/api/')[1].split('?')[0]
  if (path === 'Auth/Me')
    return route.fulfill(
      envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
    )
  if (path === 'UaAdminWeb/Access') return route.fulfill(envelope({ canOpen: true }))
  if (path === 'UaAdminWeb/ReportCounts')
    return route.fulfill(
      envelope({
        allPeople: 6,
        notSeeded: 1,
        phoneGap: 1,
        awaitingActivation: 1,
        mustChangePassword: 1,
        disabled: 1,
      }),
    )
  if (path.startsWith('UaAdminWeb/ReportCards/'))
    return route.fulfill(envelope({ rows: ROWS, totalMatches: 6, rowCap: 50, isCapped: false }))
  return route.fulfill(envelope({}))
})

// `oms.darkMode` is the key both `src/layout/theme.ts` and index.html's pre-paint
// script use; the class + AG attribute are what they set from it.
const setTheme = (theme) =>
  page.evaluate((t) => {
    localStorage.setItem('oms.darkMode', String(t === 'dark'))
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.dataset.agThemeMode = t
  }, theme)

// A token's resolved value, read off a probe element in the LIVE document — the
// only way to catch a token that parses but never reaches the page.
const tokenValue = (name, prop) =>
  page.evaluate(
    ([n, p]) => {
      const probe = document.createElement('div')
      probe.style.color = `var(${n})`
      probe.style.backgroundColor = `var(${n})`
      document.body.appendChild(probe)
      const v = getComputedStyle(probe)[p]
      probe.remove()
      return v
    },
    [name, prop],
  )

await page.goto(BASE + '/admin/ua-users')
await page.waitForSelector('main', { timeout: 20000 })

for (const theme of ['light', 'dark']) {
  await setTheme(theme)
  await page.reload()
  await page.waitForSelector('main', { timeout: 20000 })

  // Pull the "People" worklist — the grid is query-driven, empty until asked.
  await page.getByRole('button', { name: /People/i }).first().click()
  await page.waitForSelector('tbody tr', { timeout: 10000 }).catch(() => {})
  const rowCount = await page.locator('tbody tr').count()
  check(`${theme}: ua-admin worklist renders the six derived states`, rowCount === 6, `${rowCount} rows`)

  // Every pill in the Status column: its label, its class attribute, its paint.
  const pills = await page.$$eval('tbody tr td:nth-child(4) > span', (els) =>
    els.map((el) => {
      const cs = getComputedStyle(el)
      return {
        label: el.textContent.trim(),
        cls: el.getAttribute('class') || '',
        bg: cs.backgroundColor,
        ink: cs.color,
      }
    }),
  )
  check(`${theme}: six status pills painted`, pills.length === 6, `${pills.length} pills`)

  const wanted = {}
  for (const sev of Object.keys(SEV_TOKENS)) {
    wanted[sev] = [
      await tokenValue(SEV_TOKENS[sev][0], 'backgroundColor'),
      await tokenValue(SEV_TOKENS[sev][1], 'color'),
    ]
  }

  for (const p of pills) {
    const sev = EXPECT_SEV[p.label]
    if (!sev) {
      check(`${theme}: pill "${p.label}" is a known status`, false, p.label)
      continue
    }
    const [wantBg, wantInk] = wanted[sev]
    check(
      `${theme}: "${p.label}" paints ${sev} (${SEV_TOKENS[sev].join(' + ')})`,
      p.bg === wantBg && p.ink === wantInk,
      `${p.bg} / ${p.ink} (want ${wantBg} / ${wantInk})`,
    )
  }

  // The negative assertion. A reintroduced `dark:` twin would look right in a
  // screenshot and still be the drift R4 removed, so it is checked by name.
  const withDark = pills.filter((p) => p.cls.includes('dark:')).map((p) => p.label)
  check(
    `${theme}: no status pill carries a dark: variant`,
    withDark.length === 0,
    withDark.join(', '),
  )

  // One idiom: every pill differs only in its two severity classes.
  const shapes = new Set(
    pills.map((p) => p.cls.split(/\s+/).filter((c) => !/^(bg|text)-/.test(c)).sort().join(' ')),
  )
  check(`${theme}: all pills share one shape (one idiom)`, shapes.size === 1, [...shapes].join(' | '))

  await page.screenshot({ path: `${SHOTS}/ua-admin-${theme}.png` })
}

check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
console.log(`screenshots → ${SHOTS}/`)
process.exit(failed ? 1 : 0)
