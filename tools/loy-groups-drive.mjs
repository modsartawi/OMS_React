// Loyalty groups list drive (oms ticket 629; BackOffice spec 3173, brief 3173-oms-react-loyalty-groups-brief.md).
//
// Drives the REAL app in Chromium against a STUB of the brief's doors — `LoyGroupWeb/Access` and
// `LoyGroupWeb/Groups?includeInactive=bool` (BackOffice 3174; `liveBonusBuys` 3179) are deployed nowhere
// yet, so every envelope here is stubbed. In LTR (en) and RTL (ar) it asserts:
//   1. a view grant shows the "Loyalty groups" leaf; a denied, malformed or maintain-only probe hides it,
//      and a deep link then shows the denial instead of the grid;
//   2. Active (the default) asks `includeInactive=false` and shows active rows only; All asks `true` and
//      adds the inactive row;
//   3. each row shows its code, its name in the UI language (the Arabic name as stored, Arabic-Indic digits
//      included, falling back to English when blank), the mobile count, and its live bonus-buys — "None"
//      for `[]` and for a row whose door omitted the field;
//   4. no page errors.
//
// 🚩 The app's language stays `en` under RTL (`core/i18n.ts`: only `<html dir>` follows `oms.locale`), so
// RTL words in English too and the `ar` bundle is checked for key parity instead. The Arabic-as-stored
// name is proven through a group whose English name is blank, which shows its Arabic name in either.
//
//   1. run the app:  npx vite --port 5201 --strictPort
//   2. DRIVE_PORT=5201 node tools/loy-groups-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5201}`
const SHOTS = 'tools/.loy-groups-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: null, serverTime: '2026-10-27 09:41:07', data }),
})

// ── Fixtures ─────────────────────────────────────────────────────────────────────────────────

const VIP = {
  groupId: 'g-1',
  code: 'RAMADAN_VIP',
  nameEn: 'Ramadan VIP',
  nameAr: 'كبار رمضان ٢٠٢٦',
  isActive: true,
  mobileCount: 1250,
  liveBonusBuys: [
    { promoNumber: '100045', description: 'Buy 2 vitamins get 1' },
    { promoNumber: '100046', description: 'Baby care bundle' },
  ],
}
/** Arabic name blank → the English name under Arabic. `liveBonusBuys: []` (3179 not shipped). */
const STAFF = { groupId: 'g-2', code: 'STAFF', nameEn: 'Staff', nameAr: '', isActive: true, mobileCount: 37, liveBonusBuys: [] }
/** English name blank → the Arabic name as stored, Arabic-Indic digits included. */
const ARABIC = { groupId: 'g-4', code: 'JEDDAH_100', nameEn: '', nameAr: 'عملاء جدة ١٠٠', isActive: true, mobileCount: 100, liveBonusBuys: [] }
/** Inactive, and an older door that omitted `liveBonusBuys` altogether. */
const OLD = { groupId: 'g-3', code: 'PILOT-01', nameEn: 'Pilot 2025', nameAr: 'تجربة ٢٠٢٥', isActive: false, mobileCount: 0 }

// ── The harness ──────────────────────────────────────────────────────────────────────────────

const browser = await chromium.launch()

async function open(dir, access) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  // A cold Vite pre-bundles on the first load, well past the 30 s default.
  page.setDefaultNavigationTimeout(180000)
  const errors = []
  const asked = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    const answer = (data) => route.fulfill(envelope(data))
    if (p === 'Auth/Me') return answer({ authenticated: true, userId: 'hq01', currentStoreCode: 'P001' })
    if (p === 'LoyGroupWeb/Access') return answer(access)
    if (p === 'LoyGroupWeb/Groups') {
      const inactive = url.searchParams.get('includeInactive')
      asked.push(inactive)
      return answer(inactive === 'true' ? [VIP, STAFF, ARABIC, OLD] : [VIP, STAFF, ARABIC])
    }
    if (/Access$/.test(p)) return answer({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canOpenLoyMember: false })
    return answer([])
  })
  return { context, page, errors, asked }
}

const strip = (s) => s.replace(/[⁦-⁩]/g, '').replace(/\s+/g, ' ').trim()
const leaf = (page) => page.locator('a[href="/loy/groups"]')
const row = (page, id) => page.locator(`[data-loy-groups-grid] .ag-row[row-id="${id}"]`)
const cell = (page, id, col) => row(page, id).locator(`[col-id="${col}"]`)

const keysOf = (o, at = '') => Object.entries(o).flatMap(([k, v]) => (typeof v === 'object' ? keysOf(v, `${at}${k}.`) : [`${at}${k}`]))
const EN = JSON.parse(readFileSync(new URL('../src/locales/en/loy-groups.json', import.meta.url), 'utf8'))
const AR = JSON.parse(readFileSync(new URL('../src/locales/ar/loy-groups.json', import.meta.url), 'utf8'))
check('the ar bundle ships every en key, key for key', keysOf(AR).join() === keysOf(EN).join())

async function drive(dir) {

  // ── Denied, malformed and maintain-only probes hide the leaf ──
  for (const [label, access] of [
    ['denied', { canView: false, canMaintain: false }],
    ['malformed', { canView: 'true' }],
    ['maintain-only', { canMaintain: true }],
  ]) {
    const { context, page, errors } = await open(dir, access)
    await page.goto(`${BASE}/loy/groups`)
    const alert = page.locator('[role="alert"]')
    await alert.waitFor({ timeout: 10000 })
    check(`${dir} ${label}: the leaf is hidden`, (await leaf(page).count()) === 0)
    check(`${dir} ${label}: a deep link shows the denial, no grid`, (await page.locator('[data-loy-groups-grid]').count()) === 0, (await alert.innerText()).replace(/\s+/g, ' '))
    check(`${dir} ${label}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── A view grant ──
  const { context, page, errors, asked } = await open(dir, { canView: true, canMaintain: false })
  await page.goto(`${BASE}/loy/groups`)
  await page.locator('[data-loy-groups-grid]').waitFor({ timeout: 10000 })
  await leaf(page).first().waitFor({ timeout: 10000 })
  const leafText = (await leaf(page).first().innerText()).trim()
  check(`${dir} granted: the leaf shows`, leafText === 'Loyalty groups', leafText)
  check(`${dir} the page runs ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

  check(`${dir} Active (default) asks includeInactive=false`, asked[0] === 'false', JSON.stringify(asked))
  check(`${dir} Active shows the active rows only`, (await page.locator('[data-loy-groups-grid] .ag-row').count()) === 3 && (await row(page, 'g-3').count()) === 0)

  check(`${dir} the code renders`, (await cell(page, 'g-1', 'code').innerText()).trim() === 'RAMADAN_VIP')
  const vipName = (await cell(page, 'g-1', 'name').innerText()).trim()
  check(`${dir} the name follows the UI language`, vipName === 'Ramadan VIP', vipName)
  const arName = strip(await cell(page, 'g-4', 'name').innerText())
  check(`${dir} a blank English name shows the Arabic name as stored, Arabic-Indic digits included`, arName === 'عملاء جدة ١٠٠', arName)
  check(`${dir} a blank locale name falls back to the other`, (await cell(page, 'g-2', 'name').innerText()).trim() === 'Staff')
  check(`${dir} the mobile count renders`, (await cell(page, 'g-1', 'mobileCount').innerText()).trim() === '1250' && (await cell(page, 'g-2', 'mobileCount').innerText()).trim() === '37')
  const promos = await cell(page, 'g-1', 'liveBonusBuys').locator('[data-group-bby-promo]').allInnerTexts()
  const tip = await cell(page, 'g-1', 'liveBonusBuys').locator('[data-group-bby-promo="100045"]').getAttribute('title')
  check(`${dir} the live bonus-buys render, description as tooltip`, promos.map((s) => s.trim()).join(',') === '100045,100046' && !!tip && tip.includes('Buy 2 vitamins get 1'), `${promos} / ${tip}`)
  const none = (await cell(page, 'g-2', 'liveBonusBuys').innerText()).trim()
  check(`${dir} an empty liveBonusBuys reads None, not an error`, none === 'None', none)
  check(`${dir} the active flag renders`, (await cell(page, 'g-1', 'active').locator('[data-group-active="true"]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/${dir}-active.png`, fullPage: true })

  await page.locator('[data-scope="all"]').click()
  await row(page, 'g-3').waitFor({ timeout: 10000 })
  check(`${dir} All asks includeInactive=true`, asked.includes('true'), JSON.stringify(asked))
  check(`${dir} All adds the inactive row, flagged inactive`, (await cell(page, 'g-3', 'active').locator('[data-group-active="false"]').count()) === 1)
  check(`${dir} a row with no liveBonusBuys field reads None`, (await cell(page, 'g-3', 'liveBonusBuys').locator('[data-group-bby="none"]').count()) === 1)
  check(`${dir} the scope sits in the URL`, new URL(page.url()).searchParams.get('scope') === 'all', page.url())
  await page.screenshot({ path: `${SHOTS}/${dir}-all.png`, fullPage: true })

  await page.locator('[data-scope="active"]').click()
  await row(page, 'g-3').waitFor({ state: 'detached', timeout: 10000 })
  check(`${dir} back to Active drops the inactive row`, (await row(page, 'g-3').count()) === 0)
  check(`${dir} granted: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

try {
  await drive('ltr')
  await drive('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
