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

/**
 * Each later ticket's doors, as `(route, url, p) => Promise | undefined` — consulted before the 629 doors.
 * A ticket pushes its own handler in its own section, so the harness stays the same for everyone.
 */
const ROUTES = []

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
    for (const handle of ROUTES) {
      const handled = handle(route, url, p)
      if (handled) return handled
    }
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

// ── 630: create + rename (doors `GET Groups/{id}`, `POST Groups/Create`, `POST Groups/Rename`, BackOffice
// 3174 — stubbed). Create upper-cases and checks the code before the round trip; a duplicate is refused
// with the envelope's sentence in the active locale and its Loy code; success lands on the group's page;
// the code has no input anywhere; Rename sends `{ groupId, nameEn, nameAr }` only, the Arabic as typed;
// Create and Save are absent on a view-only grant.
//
// 🚩 The UI language stays `en` under RTL (see the header), so the Arabic sentence is proven through a
// refusal that carries `messageAr` only — the reader falls back to the other language, as the names do.
// The `ar`-locale pick itself is the pure test `src/core/loy-groups/refusal.test.ts`.

const DUP_EN = 'Group code RAMADAN_VIP already exists.'
const DUP_AR = 'رمز المجموعة STAFF موجود مسبقاً.'
const VIP_DETAIL = { ...VIP, createdBy: 'marketing01', createdAt: '2026-10-20T08:15:00', updatedBy: null, updatedAt: null }
const g630 = { groups: new Map(), created: [], renamed: [] }
const refusal630 = (code, messageEn, messageAr) => ({
  status: 409,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 409,
    success: false,
    message: messageEn || messageAr,
    errors: [{ errorCode: code, internalErrorCode: '', errorMessage: messageEn || messageAr }],
    serverTime: '2026-10-27 09:41:07',
    data: { messageEn, messageAr },
  }),
})
ROUTES.push((route, url, p) => {
  const body = () => JSON.parse(route.request().postData() || '{}')
  const one = /^LoyGroupWeb\/Groups\/([^/]+)$/.exec(p)
  if (p === 'LoyGroupWeb/Groups/Create') {
    const b = body()
    g630.created.push(b)
    if (b.code === 'RAMADAN_VIP') return route.fulfill(refusal630('LOY-00601', DUP_EN, 'رمز المجموعة RAMADAN_VIP موجود مسبقاً.'))
    if (b.code === 'STAFF') return route.fulfill(refusal630('LOY-00601', '', DUP_AR))
    const made = { groupId: 'g-9', ...b, isActive: true, mobileCount: 0, liveBonusBuys: [], createdBy: 'marketing01', createdAt: '2026-10-27T09:41:07', updatedBy: null, updatedAt: null }
    g630.groups.set('g-9', made)
    return route.fulfill(envelope(made))
  }
  if (p === 'LoyGroupWeb/Groups/Rename') {
    const b = body()
    g630.renamed.push(b)
    const was = g630.groups.get(b.groupId)
    const saved = { ...was, nameEn: b.nameEn, nameAr: b.nameAr, updatedBy: 'marketing01', updatedAt: '2026-10-27T10:05:00' }
    g630.groups.set(b.groupId, saved)
    return route.fulfill(envelope(saved))
  }
  if (one && g630.groups.has(one[1])) return route.fulfill(envelope(g630.groups.get(one[1])))
  return undefined
})

async function drive630(dir) {
  g630.groups = new Map([['g-1', VIP_DETAIL]])
  g630.created = []
  g630.renamed = []

  // ── A maintain grant ──
  const { context, page, errors } = await open(dir, { canView: true, canMaintain: true })
  await page.goto(`${BASE}/loy/groups`)
  await page.locator('[data-loy-groups-grid]').waitFor({ timeout: 10000 })
  await page.locator('[data-loy-groups-create]').click()
  const dialog = page.locator('dialog[open]')
  const codeInput = dialog.locator('[data-loy-group-field="code"]')
  const submit = dialog.locator('[data-loy-group-create-submit]')
  const banner = dialog.locator('[role="alert"]')

  await codeInput.pressSequentially('vip 1')
  await submit.click()
  const fieldError = strip(await dialog.innerText())
  check(`${dir} create: a space is refused before the round trip`, g630.created.length === 0 && fieldError.includes('Use only capital letters'), fieldError.slice(0, 160))

  await codeInput.fill('')
  await codeInput.pressSequentially('ramadan_vip')
  check(`${dir} create: the code is upper-cased as typed`, (await codeInput.inputValue()) === 'RAMADAN_VIP', await codeInput.inputValue())
  await dialog.locator('[data-loy-group-field="nameEn"]').fill('Ramadan again')
  await submit.click()
  await banner.waitFor({ timeout: 10000 })
  const dupEn = strip(await banner.innerText())
  check(`${dir} create: a duplicate is refused with the English sentence and its Loy code`, dupEn.includes(DUP_EN) && (await banner.locator('[data-loy-group-refusal-code="LOY-00601"]').count()) === 1, dupEn)
  check(`${dir} create: the refusal keeps the dialog open`, (await dialog.count()) === 1 && new URL(page.url()).pathname === '/loy/groups')

  await codeInput.fill('')
  await codeInput.pressSequentially('staff')
  await submit.click()
  await banner.filter({ hasText: DUP_AR }).waitFor({ timeout: 10000 })
  const dupAr = strip(await banner.innerText())
  check(`${dir} create: a duplicate refused in Arabic shows the Arabic sentence and its code`, dupAr.includes(DUP_AR) && dupAr.includes('LOY-00601'), dupAr)
  await page.screenshot({ path: `${SHOTS}/${dir}-630-duplicate.png`, fullPage: true })

  await codeInput.fill('')
  await codeInput.pressSequentially('eid-26')
  await dialog.locator('[data-loy-group-field="nameEn"]').fill('Eid 2026')
  await dialog.locator('[data-loy-group-field="nameAr"]').fill('عيد ٢٠٢٦')
  await submit.click()
  await page.waitForURL('**/loy/groups/g-9', { timeout: 10000 })
  const sent = g630.created.at(-1)
  check(`${dir} create: sends the upper-cased code and both names`, sent.code === 'EID-26' && sent.nameEn === 'Eid 2026' && sent.nameAr === 'عيد ٢٠٢٦', JSON.stringify(sent))
  check(`${dir} create: lands on the new group's page`, new URL(page.url()).pathname === '/loy/groups/g-9', page.url())

  const groupPage = page.locator('[data-loy-group="g-9"]')
  await groupPage.locator('[data-loy-group-code]').waitFor({ timeout: 10000 })
  check(`${dir} page: the code is shown as text`, strip(await groupPage.locator('[data-loy-group-code]').innerText()) === 'EID-26')
  const inputValues = await page.locator('input').evaluateAll((els) => els.map((e) => e.value))
  check(`${dir} page: the code has no input`, (await page.locator('[data-loy-group-field="code"]').count()) === 0 && !inputValues.includes('EID-26'), JSON.stringify(inputValues))
  const created = strip(await groupPage.locator('[data-loy-group-stamp="created"]').innerText())
  check(`${dir} page: created by/at in local wall-clock`, created.includes('marketing01') && created.includes('2026-10-27 09:41'), created)
  check(`${dir} page: never-changed reads Never`, strip(await groupPage.locator('[data-loy-group-stamp="updated"]').innerText()) === 'Never')

  const save = groupPage.locator('[data-loy-group-save]')
  check(`${dir} page: Save waits for a change`, await save.isDisabled())
  await groupPage.locator('[data-loy-group-field="nameEn"]').fill('Eid al-Fitr 2026')
  await groupPage.locator('[data-loy-group-field="nameAr"]').fill(' عيد الفطر ٢٠٢٦ ')
  await save.click()
  await groupPage.locator('[data-loy-group-stamp="updated"] [data-stamp-at]').waitFor({ timeout: 10000 })
  const renamed = g630.renamed.at(-1)
  check(`${dir} rename: the request is { groupId, nameEn, nameAr } only`, JSON.stringify(Object.keys(renamed).sort()) === '["groupId","nameAr","nameEn"]' && renamed.groupId === 'g-9', JSON.stringify(renamed))
  check(`${dir} rename: the Arabic name is sent exactly as typed`, renamed.nameAr === ' عيد الفطر ٢٠٢٦ ', JSON.stringify(renamed.nameAr))
  const updated = strip(await groupPage.locator('[data-loy-group-stamp="updated"]').innerText())
  check(`${dir} rename: updated by/at follows the save`, updated.includes('marketing01') && updated.includes('2026-10-27 10:05'), updated)
  check(`${dir} rename: the code is unchanged`, strip(await groupPage.locator('[data-loy-group-code]').innerText()) === 'EID-26')
  await page.screenshot({ path: `${SHOTS}/${dir}-630-page.png`, fullPage: true })
  check(`${dir} create + rename: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()

  // ── A view-only grant ──
  const viewer = await open(dir, { canView: true, canMaintain: false })
  await viewer.page.goto(`${BASE}/loy/groups`)
  await viewer.page.locator('[data-loy-groups-grid]').waitFor({ timeout: 10000 })
  check(`${dir} view-only: no Create button`, (await viewer.page.locator('[data-loy-groups-create]').count()) === 0)
  await viewer.page.locator('[data-group-open="g-1"]').click()
  await viewer.page.locator('[data-loy-group="g-1"] [data-loy-group-code]').waitFor({ timeout: 10000 })
  check(`${dir} view-only: the code links from the list to the page`, new URL(viewer.page.url()).pathname === '/loy/groups/g-1', viewer.page.url())
  check(`${dir} view-only: no Save and no name inputs`, (await viewer.page.locator('[data-loy-group-save]').count()) === 0 && (await viewer.page.locator('[data-loy-group-field]').count()) === 0)
  const arName = strip(await viewer.page.locator('[data-loy-group-name="ar"]').innerText())
  check(`${dir} view-only: the Arabic name shows as stored`, arName === 'كبار رمضان ٢٠٢٦', arName)
  check(`${dir} view-only: no page errors`, viewer.errors.length === 0, viewer.errors.join(' | '))
  await viewer.context.close()
}

try {
  await drive('ltr')
  await drive('rtl')
  await drive630('ltr')
  await drive630('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
