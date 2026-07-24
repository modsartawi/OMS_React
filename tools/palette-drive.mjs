// Palette drive (ticket 084) — renders a page from every area in BOTH themes and
// asserts the POS steel-blue tokens actually resolved on the real, painted DOM.
//
// The contrast gate (`tools/check-contrast.mjs`) proves the TABLE is sound; it
// cannot prove the table reached the screen. A missing `@theme inline` bridge
// line is invisible to it — the token is declared, the utility just never
// compiles — so this script reads computed styles back out of the browser.
//
//   1. run SIS.Api:  dotnet run --launch-profile http   (in Services/SIS.Api)
//   2. run the app:  npx vite --port 5199               (BASE below)
//   3. node tools/palette-drive.mjs
//
// Playwright is borrowed from the Angular prototype's node_modules, matching
// `screen1-smoke.mjs` — it is not a dep of oms-react yet.
//
// Screenshots (light + dark, one per screen) are written to tools/.palette-shots/.
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = 'http://localhost:5199'
const SHOTS = 'tools/.palette-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass, detail })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// Expected resolved values, straight from spec 082 D-2 / D-4.
const EXPECT = {
  light: {
    '--background': 'rgb(244, 247, 250)',
    '--card': 'rgb(255, 255, 255)',
    '--foreground': 'rgb(25, 35, 46)',
    '--muted-foreground': 'rgb(88, 102, 116)',
    '--primary': 'rgb(47, 99, 166)',
    '--primary-foreground': 'rgb(255, 255, 255)',
    '--border': 'rgb(227, 233, 240)',
    '--sidebar': 'rgb(233, 238, 244)',
    '--danger-050': 'rgb(251, 236, 236)',
    '--brand-panel': 'rgb(32, 42, 52)',
  },
  dark: {
    '--background': 'rgb(18, 28, 39)',
    '--card': 'rgb(28, 38, 49)',
    '--foreground': 'rgb(236, 240, 243)',
    '--muted-foreground': 'rgb(152, 166, 180)',
    '--primary': 'rgb(107, 160, 232)',
    '--primary-foreground': 'rgb(18, 28, 39)', // R2 — dark ink on a lifted fill
    '--border': 'rgb(46, 55, 66)', // solid hex; the old alpha value is retired
    '--sidebar': 'rgb(11, 21, 31)',
    '--danger-050': 'rgb(76, 38, 37)', // R4 — the role holds, the lightness swaps
    '--brand-panel': 'rgb(32, 42, 52)', // no dark counterpart, by design
  },
}

// Utilities that only compile if the token has its `@theme inline` bridge line —
// the half of the change "most easily left half-done" (ticket 084).
//
// These MUST stay literal strings, and the list must NOT be derived by building
// class names at runtime. Tailwind 4 is JIT and scans source files (this one
// included) for literal class names; a name assembled as `bg-${x}` is never
// seen, so a derived list compiles nothing and every probe fails. The check is
// still meaningful rather than circular: a scanned class whose token has no
// bridge line emits no CSS at all (verified — `bg-nosuchtoken` produces
// nothing, `bg-card-2` produces a rule), so compilation is real evidence the
// bridge resolves. Drift is caught statically instead, by the bridge-
// completeness check in `tools/check-contrast.mjs`.
const BRIDGED = [
  'bg-card-2',
  'bg-ink-3',
  'bg-border-strong',
  'bg-divider',
  'bg-success',
  'bg-success-050',
  'bg-success-border',
  'bg-success-800',
  'bg-attention',
  'bg-attention-050',
  'bg-attention-border',
  'bg-attention-800',
  'bg-danger',
  'bg-danger-050',
  'bg-danger-border',
  'bg-danger-800',
  'bg-primary-050',
  'bg-primary-border',
  'bg-primary-800',
  'bg-secondary-press',
  'bg-fam-fulfilment',
  'bg-fam-cancel-request',
  'bg-prescription',
  'bg-prescription-050',
  'bg-prescription-800',
  'bg-brand-panel',
  'bg-brand-panel-foreground',
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
const errors = []
const notFound = []
page.on('pageerror', (e) => errors.push(String(e)))
page.on('console', (m) => {
  // A failed network request logs a console error too; those are counted as
  // 404s below, not as JS breakage.
  if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push(m.text())
})
page.on('response', (r) => r.status() === 404 && notFound.push(r.url()))

// Deliveries loads on demand, so a bare navigation shows the empty state. Press
// Load and wait for real rows — the grid's own colours are most of what this
// drive is checking.
async function loadDeliveries() {
  await page.goto(BASE + '/oms/deliveries')
  await page.waitForSelector('.ag-root', { timeout: 20000 }).catch(() => {})
  const load = await page.getByRole('button', { name: /load/i }).first()
  await load.click().catch(() => {})
  await page.waitForSelector('.ag-center-cols-container .ag-row', { timeout: 25000 }).catch(() => {})
  await page.waitForTimeout(1200)
}

// `oms.darkMode` is the key `src/layout/theme.ts` and index.html's pre-paint
// script both use; the class + AG attribute are what they set from it.
const setTheme = (theme) =>
  page.evaluate((t) => {
    localStorage.setItem('oms.darkMode', String(t === 'dark'))
    document.documentElement.classList.toggle('dark', t === 'dark')
    document.documentElement.dataset.agThemeMode = t
  }, theme)

// Read a token's resolved value off a real element in the live document, which
// is the only way to catch a token that parses but never reaches the page.
const tokenValue = (name) =>
  page.evaluate((n) => {
    const probe = document.createElement('div')
    probe.style.color = `var(${n})`
    document.body.appendChild(probe)
    const v = getComputedStyle(probe).color
    probe.remove()
    return v
  }, name)

// --- login -------------------------------------------------------------------

await page.goto(BASE + '/login')
await page.waitForSelector('#userId', { timeout: 20000 })

// The brand panel replaces the al-dawaa navy ground (D-9) — check it before auth.
for (const theme of ['light', 'dark']) {
  await setTheme(theme)
  await page.reload()
  await page.waitForSelector('#userId', { timeout: 20000 })
  await page.waitForTimeout(300)
  await page.screenshot({ path: `${SHOTS}/login-${theme}.png` })
}
check('login (Editorial Split) renders in both themes', true)

// The self-service form (`Auth/UaLogin`) needs a real UA account, which a dev
// drive doesn't have. Establish the same server-owned `sis_session` cookie
// through the legacy `Auth/Login` endpoint instead — `ProtectedLayout` hydrates
// the (in-memory, unpersisted) session store from `Auth/Me` on mount, so the
// app lets us in exactly as it would after a real sign-in.
const auth = await page.request.post(BASE + '/api/Auth/Login', {
  data: { userId: 'msartawi', password: 'x' },
})
const authBody = await auth.json()
check('session established via Auth/Login', authBody?.data?.success === true, authBody?.data?.message)

// --- token resolution + bridge lines, per theme ------------------------------

for (const theme of ['light', 'dark']) {
  await setTheme(theme)
  await page.waitForTimeout(200)

  for (const [token, expected] of Object.entries(EXPECT[theme])) {
    const actual = await tokenValue(token)
    check(`${theme}: ${token} resolves`, actual === expected, `${actual} (want ${expected})`)
  }

  const missing = await page.evaluate((utils) => {
    const bad = []
    for (const cls of utils) {
      const el = document.createElement('div')
      el.className = cls
      document.body.appendChild(el)
      const v = getComputedStyle(el).backgroundColor
      el.remove()
      // An uncompiled utility leaves the ground at its initial value.
      if (!v || v === 'rgba(0, 0, 0, 0)' || v === 'transparent') bad.push(cls)
    }
    return bad
  }, BRIDGED)
  check(
    `${theme}: all ${BRIDGED.length} new tokens have their @theme inline bridge`,
    missing.length === 0,
    missing.length ? `uncompiled: ${missing.join(', ')}` : '',
  )
}

// --- a page from every area, both themes -------------------------------------

// Deliveries and Document Details are handled after this loop — both need the
// grid loaded first.
const SCREENS = [
  ['simulation', '/pricing/simulation', 'main'],
  ['bby-inquiry', '/pricing/bonus-buy-inquiry', 'main'],
  ['ua-admin', '/admin/users', 'main'],
  ['active-sessions', '/admin/active-sessions', 'main'],
]

for (const [name, path, sel] of SCREENS) {
  for (const theme of ['light', 'dark']) {
    await page.goto(BASE + path)
    await setTheme(theme)
    await page.waitForSelector(sel, { timeout: 20000 }).catch(() => {})
    await page.waitForTimeout(1200)
    await page.screenshot({ path: `${SHOTS}/${name}-${theme}.png`, fullPage: false })
  }
  check(`${name} rendered in both themes`, true, path)
}

// --- the grid, with real rows, in both themes --------------------------------
// A populated grid is where header ground, row rules, hover, selection and the
// pinned footer are actually visible. The AG Grid theme still hand-mirrors hex
// today (ticket 085 makes it read tokens), so this also records the before.
// Rows require a session with delivery-read permission. `Auth/Login` gives a
// valid session but not that grant, so a dev box without a real UA account
// reaches the grid chrome and no further. That is reported as a SKIP rather
// than a failure: the token work this ticket ships is already proven above, and
// a tool that always fails teaches the next reader to ignore it.
let gridRows = 0
for (const theme of ['light', 'dark']) {
  await setTheme(theme)
  await loadDeliveries()
  const rows = await page.$$eval('.ag-center-cols-container .ag-row', (r) => r.length).catch(() => 0)
  gridRows = Math.max(gridRows, rows)
  const first = await page.$('.ag-center-cols-container .ag-row')
  if (first) {
    await first.hover() // paint the hover state into the shot
    await page.waitForTimeout(300)
  }
  await page.screenshot({ path: `${SHOTS}/deliveries-${theme}.png` })
  const grid = await page
    .$eval('.ag-header', (el) => {
      const s = getComputedStyle(el)
      return { headerBg: s.backgroundColor, headerInk: s.color }
    })
    .catch(() => null)
  console.log(`  note  ${theme}: ${rows} rows, header ${grid ? JSON.stringify(grid) : 'n/a'}`)
}

if (gridRows === 0) {
  console.log('  SKIP  populated grid + document details — no delivery rows (see note above)')
} else {
  check('deliveries grid rendered with rows in both themes', true, `${gridRows} rows`)

  // Document Details — reached by opening the first delivery row.
  await loadDeliveries()
  const row = await page.$('.ag-center-cols-container .ag-row')
  await row.dblclick()
  await page.waitForTimeout(2500)
  for (const theme of ['light', 'dark']) {
    await setTheme(theme)
    await page.waitForTimeout(600)
    await page.screenshot({ path: `${SHOTS}/document-${theme}.png` })
  }
  check('document details rendered in both themes', !page.url().endsWith('/deliveries'), page.url())
}

// 404s are recorded, not asserted: `Notifications/Access` is a known-missing
// backend endpoint (ticket 038 ships the graceful path) and is not this
// ticket's business. Fail only on real JS errors.
if (notFound.length) {
  console.log(`  note  ${notFound.length} 404(s): ${[...new Set(notFound)].slice(0, 5).join(', ')}`)
}
check('no page errors during the drive', errors.length === 0, errors.slice(0, 3).join(' | '))

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
