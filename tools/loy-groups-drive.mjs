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
//   4. Find a mobile (ticket 634; `LoyGroupWeb/Mobile/{mobile}/Groups`, BackOffice 3176): the typed mobile
//      is path-encoded and sits in `?mobile=`; a mobile in an active and an inactive group lists both,
//      the inactive one marked, each linking to `/loy/groups/:groupId`; a refresh repeats it; none → the
//      empty sentence; a not-a-mobile refusal shows the server's message;
//   5. no page errors.
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

/** `Mobile/{mobile}/Groups` rows (ticket 634): one active, one inactive. */
const LOOKUP_VIP = { groupId: VIP.groupId, code: VIP.code, nameEn: VIP.nameEn, nameAr: VIP.nameAr, isActive: true }
const LOOKUP_OLD = { groupId: OLD.groupId, code: OLD.code, nameEn: OLD.nameEn, nameAr: OLD.nameAr, isActive: false }

/** A Loy refusal: `success:false`, the server's sentence and a stable code (brief: every refusal). */
const refusal = (message, errorCode) => ({
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 400,
    success: false,
    message,
    messageEn: message,
    messageAr: 'ليس رقم جوال.',
    errors: [{ errorCode, errorMessage: message }],
    serverTime: '2026-10-27 09:41:07',
    data: null,
  }),
})

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
  const looked = []
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
    // ── Mobile → groups (ticket 634; door BackOffice 3176) ──
    const lookup = /^LoyGroupWeb\/Mobile\/([^/]+)\/Groups$/.exec(p)
    if (lookup) {
      looked.push(lookup[1])
      const typed = decodeURIComponent(lookup[1])
      if (!/^[+\d\s]+$/.test(typed)) return route.fulfill(refusal('Not a mobile number.', 'LOY_NOT_A_MOBILE'))
      const digits = typed.replace(/\D/g, '')
      if (digits.endsWith('501234567')) return answer([LOOKUP_VIP, LOOKUP_OLD])
      return answer([])
    }
    if (/Access$/.test(p)) return answer({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canOpenLoyMember: false })
    return answer([])
  })
  return { context, page, errors, asked, looked }
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
  const { context, page, errors, asked, looked } = await open(dir, { canView: true, canMaintain: false })
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

  // ── Find a mobile (ticket 634) ──
  const lp = page
  const found = lp.locator('[data-lookup-results]')
  await lp.locator('[data-lookup-input]').fill('+966 50 123 4567')
  await lp.locator('[data-lookup-submit]').click()
  await found.waitFor({ timeout: 10000 })
  check(`${dir} lookup: the typed mobile is path-encoded`, looked.at(-1) === '%2B966%2050%20123%204567', JSON.stringify(looked))
  check(`${dir} lookup: the mobile sits in the URL`, new URL(lp.url()).searchParams.get('mobile') === '+966 50 123 4567', lp.url())
  const listed = await found.locator('[data-lookup-group]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-lookup-group')}:${e.getAttribute('data-lookup-active')}`))
  check(`${dir} lookup: an active and an inactive group both listed`, listed.join() === 'g-1:true,g-3:false', listed.join())
  const oldText = strip(await found.locator('[data-lookup-group="g-3"]').innerText())
  const vipText = strip(await found.locator('[data-lookup-group="g-1"]').innerText())
  check(`${dir} lookup: the inactive group is marked Inactive, the active one is not`, oldText.includes('Inactive') && !vipText.includes('Inactive'), `${vipText} | ${oldText}`)
  check(`${dir} lookup: each row shows its code and name`, vipText.includes('RAMADAN_VIP') && vipText.includes('Ramadan VIP'), vipText)
  const href = await found.locator('[data-lookup-group="g-3"] a').getAttribute('href')
  check(`${dir} lookup: each group opens its group page`, href === '/loy/groups/g-3', href)
  await lp.screenshot({ path: `${SHOTS}/${dir}-lookup-found.png`, fullPage: true })

  // A refresh repeats the search.
  const before = looked.length
  await lp.reload()
  await found.waitFor({ timeout: 10000 })
  check(`${dir} lookup: a refresh repeats the search`, looked.length > before && (await found.locator('[data-lookup-group]').count()) === 2 && (await lp.locator('[data-lookup-input]').inputValue()) === '+966 50 123 4567')

  // In no group → said plainly.
  await lp.locator('[data-lookup-input]').fill('0559999999')
  await lp.locator('[data-lookup-submit]').click()
  await lp.locator('[data-lookup-empty]').waitFor({ timeout: 10000 })
  const emptyText = strip(await lp.locator('[data-lookup-empty]').innerText())
  check(`${dir} lookup: no group reads the empty sentence`, emptyText === '0559999999 is in no group.' && (await found.count()) === 0, emptyText)

  // Not a mobile → the server's message.
  await lp.locator('[data-lookup-input]').fill('abc')
  await lp.locator('[data-lookup-submit]').click()
  await lp.locator('[data-lookup-refused]').waitFor({ timeout: 10000 })
  const refusedText = strip(await lp.locator('[data-lookup-refused]').innerText())
  check(`${dir} lookup: a not-a-mobile refusal shows the server's message`, refusedText === 'Not a mobile number.', refusedText)
  check(`${dir} lookup: a refusal is asked once, not retried`, looked.filter((m) => m === 'abc').length === 1, JSON.stringify(looked))
  await lp.screenshot({ path: `${SHOTS}/${dir}-lookup-refused.png`, fullPage: true })

  // Scope and lookup share the URL without trampling each other; Clear drops only the mobile.
  await lp.locator('[data-scope="all"]').click()
  await row(lp, 'g-3').waitFor({ timeout: 10000 })
  check(`${dir} lookup: switching scope keeps the mobile in the URL`, new URL(lp.url()).searchParams.get('mobile') === 'abc', lp.url())
  await lp.locator('[data-lookup-clear]').click()
  await lp.locator('[data-lookup-refused]').waitFor({ state: 'detached', timeout: 10000 })
  const cleared = new URL(lp.url()).searchParams
  check(`${dir} lookup: Clear drops the mobile and keeps the scope`, !cleared.has('mobile') && cleared.get('scope') === 'all', lp.url())

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

// ── 631: deactivate / reactivate (door `POST Groups/SetActive`, BackOffice 3174; `liveBonusBuys` 3179 —
// stubbed non-empty). Deactivate opens a confirm naming every live bonus-buy (promo number + description),
// or the "stops no live offer" sentence when none; Cancel sends nothing; confirm sends `{ groupId, isActive }`
// only and flips the badge and the list; Reactivate flips it back with no list; no delete control exists;
// view-only shows neither button.
//
// Its handler is put FIRST (`unshift`) and answers only while `g631.groups` is filled, so the 630 stub of
// `Groups/{id}` cannot shadow the state this section flips.

const g631 = { groups: new Map(), sent: [] }
ROUTES.unshift((route, url, p) => {
  if (g631.groups.size === 0) return undefined
  if (p === 'LoyGroupWeb/Groups/SetActive') {
    const b = JSON.parse(route.request().postData() || '{}')
    g631.sent.push(b)
    const was = g631.groups.get(b.groupId)
    g631.groups.set(b.groupId, { ...was, isActive: b.isActive, updatedBy: 'marketing01', updatedAt: `2026-10-27T11:0${g631.sent.length}:00` })
    return route.fulfill(envelope(null))
  }
  if (p === 'LoyGroupWeb/Groups') {
    const all = [...g631.groups.values()]
    return route.fulfill(envelope(url.searchParams.get('includeInactive') === 'true' ? all : all.filter((g) => g.isActive)))
  }
  const one = /^LoyGroupWeb\/Groups\/([^/]+)$/.exec(p)
  if (one && g631.groups.has(one[1])) return route.fulfill(envelope(g631.groups.get(one[1])))
  return undefined
})

async function drive631(dir) {
  const stamp = { createdBy: 'marketing01', createdAt: '2026-10-20T08:15:00', updatedBy: null, updatedAt: null }
  g631.groups = new Map([
    ['g-1', { ...VIP, ...stamp }],
    ['g-2', { ...STAFF, ...stamp }],
    ['g-3', { ...OLD, ...stamp }],
  ])
  g631.sent = []

  // ── A maintain grant ──
  const { context, page, errors } = await open(dir, { canView: true, canMaintain: true })
  const badge = (id) => page.locator(`[data-loy-group="${id}"] [data-loy-group-active]`)
  const dialog = page.locator('dialog[open]')
  await page.goto(`${BASE}/loy/groups/g-1`)
  await badge('g-1').waitFor({ timeout: 10000 })
  check(`${dir} activate: an active group shows Active and a Deactivate button`, (await badge('g-1').getAttribute('data-loy-group-active')) === 'true' && (await page.locator('[data-loy-group-deactivate]').count()) === 1)
  const deleteControls = await page.locator('button, a, [role="menuitem"]').evaluateAll((els) => els.filter((e) => /delete|remove group|حذف/i.test(e.textContent || '') || e.matches('[data-loy-group-delete]')).length)
  check(`${dir} activate: no delete control exists`, deleteControls === 0, String(deleteControls))

  await page.locator('[data-loy-group-deactivate]').click()
  await dialog.waitFor({ timeout: 10000 })
  const bbys = await dialog.locator('[data-loy-group-deactivate-bby]').evaluateAll((els) => els.map((e) => e.getAttribute('data-loy-group-deactivate-bby')))
  const text = strip(await dialog.innerText())
  check(`${dir} activate: the confirm names each live bonus-buy, number and description`, bbys.join() === '100045,100046' && text.includes('Buy 2 vitamins get 1') && text.includes('Baby care bundle'), `${bbys} / ${text.slice(0, 200)}`)
  check(`${dir} activate: the confirm says the bonus-buys stop`, (await dialog.locator('[data-loy-group-deactivate-sentence="stops"]').count()) === 1)
  check(`${dir} activate: the promo number is isolated LTR`, (await dialog.locator('[data-loy-group-deactivate-bby="100045"] bdi[dir="ltr"]').count()) === 1)
  check(`${dir} activate: opening the confirm sends nothing`, g631.sent.length === 0)
  await page.screenshot({ path: `${SHOTS}/${dir}-631-confirm.png`, fullPage: true })
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await dialog.waitFor({ state: 'detached', timeout: 10000 })
  check(`${dir} activate: Cancel closes and sends nothing`, g631.sent.length === 0 && (await badge('g-1').getAttribute('data-loy-group-active')) === 'true')

  await page.locator('[data-loy-group-deactivate]').click()
  await dialog.locator('[data-loy-group-deactivate-confirm]').click()
  await page.locator('[data-loy-group="g-1"] [data-loy-group-active="false"]').waitFor({ timeout: 10000 })
  const off = g631.sent.at(-1)
  check(`${dir} activate: deactivate sends { groupId, isActive: false } only`, JSON.stringify(off) === '{"groupId":"g-1","isActive":false}', JSON.stringify(off))
  check(`${dir} activate: deactivate flips the badge to Inactive and closes the confirm`, strip(await badge('g-1').innerText()) === 'Inactive' && (await dialog.count()) === 0)
  check(`${dir} activate: an inactive group offers Reactivate, not Deactivate`, (await page.locator('[data-loy-group-reactivate]').count()) === 1 && (await page.locator('[data-loy-group-deactivate]').count()) === 0)

  await page.locator('[data-loy-group="g-1"] a[href="/loy/groups"]').click()
  await page.locator('[data-loy-groups-grid]').waitFor({ timeout: 10000 })
  await page.locator('[data-loy-groups-grid] .ag-row').first().waitFor({ timeout: 10000 })
  check(`${dir} activate: the Active list no longer shows the group`, (await row(page, 'g-1').count()) === 0 && (await row(page, 'g-2').count()) === 1)
  await page.goto(`${BASE}/loy/groups?scope=all`)
  await cell(page, 'g-1', 'active').waitFor({ timeout: 10000 })
  check(`${dir} activate: All lists it flagged inactive`, (await cell(page, 'g-1', 'active').locator('[data-group-active="false"]').count()) === 1)

  await page.goto(`${BASE}/loy/groups/g-1`)
  await page.locator('[data-loy-group-reactivate]').click()
  await page.locator('[data-loy-group="g-1"] [data-loy-group-active="true"]').waitFor({ timeout: 10000 })
  const on = g631.sent.at(-1)
  check(`${dir} activate: reactivate sends { groupId, isActive: true } with no confirm`, JSON.stringify(on) === '{"groupId":"g-1","isActive":true}' && (await dialog.count()) === 0, JSON.stringify(on))
  check(`${dir} activate: reactivate flips the badge back to Active`, strip(await badge('g-1').innerText()) === 'Active' && (await page.locator('[data-loy-group-deactivate]').count()) === 1)

  await page.goto(`${BASE}/loy/groups/g-2`)
  await page.locator('[data-loy-group-deactivate]').click()
  await dialog.waitFor({ timeout: 10000 })
  const none = strip(await dialog.locator('[data-loy-group-deactivate-sentence]').innerText())
  check(`${dir} activate: no live bonus-buy reads the "stops no live offer" sentence`, (await dialog.locator('[data-loy-group-deactivate-sentence="none"]').count()) === 1 && (await dialog.locator('[data-loy-group-deactivate-bby]').count()) === 0 && none.includes('stops no live offer'), none)
  await page.screenshot({ path: `${SHOTS}/${dir}-631-none.png`, fullPage: true })
  await page.keyboard.press('Escape')
  await dialog.waitFor({ state: 'detached', timeout: 10000 })
  check(`${dir} activate: Escape closes and sends nothing`, g631.sent.length === 2)
  check(`${dir} activate: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()

  // ── A view-only grant ──
  const viewer = await open(dir, { canView: true, canMaintain: false })
  for (const id of ['g-1', 'g-3']) {
    await viewer.page.goto(`${BASE}/loy/groups/${id}`)
    await viewer.page.locator(`[data-loy-group="${id}"] [data-loy-group-active]`).waitFor({ timeout: 10000 })
    check(`${dir} view-only ${id}: no Deactivate and no Reactivate`, (await viewer.page.locator('[data-loy-group-deactivate], [data-loy-group-reactivate]').count()) === 0)
  }
  check(`${dir} view-only activate: no page errors`, viewer.errors.length === 0, viewer.errors.join(' | '))
  await viewer.context.close()
  g631.groups = new Map()
}

// ── 632: members (doors `GET Groups/{id}/Members`, `POST Groups/Members/Add`, `POST Groups/Members/Remove`,
// BackOffice 3174 — stubbed). Paged 50 at a time with the page in the URL; the search goes out exactly as
// typed and the stub canonicalises it as the server would; mobiles show exactly as returned; add refused as
// a placeholder shows the server's sentence and code; add and remove (after a confirm naming the mobile)
// refresh the group's mobile count; add and remove are absent on a view-only grant.

const g632 = { members: [], searches: [], added: [], removed: [] }
const MEMBERS_GROUP = { groupId: 'g-5', code: 'WINTER_25', nameEn: 'Winter 2025', nameAr: 'شتاء ٢٠٢٥', isActive: true, liveBonusBuys: [], createdBy: 'marketing01', createdAt: '2026-10-01T08:00:00', updatedBy: null, updatedAt: null }
const seedMembers = () =>
  Array.from({ length: 60 }, (_, i) => ({
    mobile: `9665000000${String(i + 1).padStart(2, '0')}`,
    isEnrolled: i % 3 !== 0,
    loyId: i % 3 !== 0 ? `10000${i + 1}` : null,
    addedBy: 'marketing01',
    addedAt: '2026-10-02T09:30:00',
  }))
/** What the server does with any spelling: digits only, then the `00966` / `966` / `0` prefix dropped. */
const canonicalTail = (typed) => typed.replace(/\D/g, '').replace(/^(00)?966/, '').replace(/^0/, '')
ROUTES.push((route, url, p) => {
  const body = () => JSON.parse(route.request().postData() || '{}')
  if (p === `LoyGroupWeb/Groups/${MEMBERS_GROUP.groupId}`) return route.fulfill(envelope({ ...MEMBERS_GROUP, mobileCount: g632.members.length }))
  if (p === `LoyGroupWeb/Groups/${MEMBERS_GROUP.groupId}/Members`) {
    const search = url.searchParams.get('search')
    const page = Number(url.searchParams.get('page'))
    const pageSize = Number(url.searchParams.get('pageSize'))
    g632.searches.push({ search, page, pageSize })
    const tail = search === null ? '' : canonicalTail(search)
    const hits = g632.members.filter((m) => m.mobile.slice(3).startsWith(tail))
    return route.fulfill(envelope({ total: hits.length, rows: hits.slice((page - 1) * pageSize, page * pageSize) }))
  }
  if (p === 'LoyGroupWeb/Groups/Members/Add') {
    const b = body()
    g632.added.push(b)
    if (canonicalTail(b.mobile) === '500000000') return route.fulfill(refusal630('LOY-00612', 'This is a placeholder mobile and cannot join a group.', 'هذا رقم جوال افتراضي ولا يمكن إضافته إلى مجموعة.'))
    const mobile = `966${canonicalTail(b.mobile)}`
    g632.members.unshift({ mobile, isEnrolled: false, loyId: null, addedBy: 'marketing01', addedAt: '2026-10-27T11:00:00' })
    return route.fulfill(envelope({ outcome: 'Added' }))
  }
  if (p === 'LoyGroupWeb/Groups/Members/Remove') {
    const b = body()
    g632.removed.push(b)
    g632.members = g632.members.filter((m) => m.mobile !== b.mobile)
    return route.fulfill(envelope({ outcome: 'Removed' }))
  }
  return undefined
})

async function drive632(dir) {
  g632.members = seedMembers()
  g632.searches = []
  g632.added = []
  g632.removed = []
  const memberRow = (page, mobile) => page.locator(`[data-loy-group-members-grid] .ag-row[row-id="${mobile}"]`)
  const memberRows = (page) => page.locator('[data-loy-group-members-grid] .ag-row')
  const countOf = async (page) => page.locator('[data-loy-group-mobile-count]').getAttribute('data-loy-group-mobile-count')

  const { context, page, errors } = await open(dir, { canView: true, canMaintain: true })
  await page.goto(`${BASE}/loy/groups/g-5`)
  const grid = page.locator('[data-loy-group-members-grid]')
  await grid.waitFor({ timeout: 10000 })
  await memberRow(page, '966500000001').waitFor({ timeout: 10000 })

  // ── Paging ──
  const first = g632.searches[0]
  check(`${dir} members: page 1 asks page=1 pageSize=50 and no search`, first && first.page === 1 && first.pageSize === 50 && first.search === null, JSON.stringify(first))
  check(`${dir} members: page 1 shows 50 rows`, (await memberRows(page).count()) === 50, String(await memberRows(page).count()))
  const mobileText = strip(await memberRow(page, '966500000001').locator('[col-id="mobile"]').innerText())
  check(`${dir} members: the mobile shows exactly as the server returned it`, mobileText === '966500000001', mobileText)
  check(`${dir} members: the enrolled flag renders, both ways`,
    (await memberRow(page, '966500000001').locator('[data-member-enrolled="false"]').count()) === 1 &&
    (await memberRow(page, '966500000002').locator('[data-member-enrolled="true"]').count()) === 1)
  const added = strip(await memberRow(page, '966500000002').locator('[col-id="addedAt"]').innerText())
  check(`${dir} members: added by and at render`, added.includes('2026-10-02 09:30') && strip(await memberRow(page, '966500000002').locator('[col-id="addedBy"]').innerText()) === 'marketing01', added)
  check(`${dir} members: the group's mobile count shows`, (await countOf(page)) === '60')
  await page.screenshot({ path: `${SHOTS}/${dir}-632-page1.png`, fullPage: true })

  await page.locator('[data-members-pager] button').last().click()
  await memberRow(page, '966500000060').waitFor({ timeout: 10000 })
  check(`${dir} members: Next asks page=2`, g632.searches.at(-1).page === 2, JSON.stringify(g632.searches.at(-1)))
  check(`${dir} members: page 2 shows the last 10`, (await memberRows(page).count()) === 10)
  check(`${dir} members: the page sits in the URL`, new URL(page.url()).searchParams.get('page') === '2', page.url())

  // ── Search, any spelling, sent untouched ──
  await page.locator('[data-members-search]').fill('+966 50 000 0007')
  await page.locator('[data-members-search-submit]').click()
  await memberRow(page, '966500000007').waitFor({ timeout: 10000 })
  await page.waitForFunction(() => document.querySelectorAll('[data-loy-group-members-grid] .ag-row').length === 1, null, { timeout: 10000 })
  const searched = g632.searches.at(-1)
  check(`${dir} members: the typed search goes out untouched`, searched.search === '+966 50 000 0007' && searched.page === 1, JSON.stringify(searched))
  const sp = new URL(page.url()).searchParams
  check(`${dir} members: the search sits in the URL and the page resets`, sp.get('search') === '+966 50 000 0007' && !sp.has('page'), page.url())
  await page.reload()
  await memberRow(page, '966500000007').waitFor({ timeout: 10000 })
  check(`${dir} members: a refresh repeats the search`, g632.searches.at(-1).search === '+966 50 000 0007' && (await page.locator('[data-members-search]').inputValue()) === '+966 50 000 0007')
  for (const spelling of ['0500000007', '500000007', '966500000007']) {
    await page.locator('[data-members-search]').fill(spelling)
    // The previous spelling's row is the same member, so wait for THIS spelling's answer, not the row.
    const answered = page.waitForResponse((r) => r.url().includes('/Members?') && new URL(r.url()).searchParams.get('search') === spelling, { timeout: 10000 })
    await page.locator('[data-members-search-submit]').click()
    await answered
    await memberRow(page, '966500000007').waitFor({ timeout: 10000 })
    check(`${dir} members: the spelling ${spelling} goes out as typed and finds the member`, g632.searches.at(-1).search === spelling && (await memberRows(page).count()) === 1)
  }
  await page.locator('[data-members-search-clear]').click()
  await page.waitForFunction(() => !new URL(location.href).searchParams.has('search'), null, { timeout: 10000 })
  await page.waitForFunction(() => document.querySelectorAll('[data-loy-group-members-grid] .ag-row').length === 50, null, { timeout: 10000 })
  check(`${dir} members: Clear drops the search`, g632.searches.at(-1).search === null)

  // ── Add one, refused as a placeholder ──
  const addInput = page.locator('[data-members-add-input]')
  await addInput.fill('0500000000')
  await page.locator('[data-members-add-submit]').click()
  const refused = page.locator('[data-members-add-refused]')
  await refused.waitFor({ timeout: 10000 })
  const refusedText = strip(await refused.innerText())
  check(`${dir} add: a placeholder is refused with the server's sentence and its code`,
    refusedText.includes('This is a placeholder mobile and cannot join a group.') && (await refused.locator('[data-loy-group-refusal-code="LOY-00612"]').count()) === 1, refusedText)
  check(`${dir} add: the refused mobile stays in the field, the count unchanged`, (await addInput.inputValue()) === '0500000000' && (await countOf(page)) === '60')
  await page.screenshot({ path: `${SHOTS}/${dir}-632-add-refused.png`, fullPage: true })

  // ── Add one ──
  await addInput.fill('055 123 4567')
  await page.locator('[data-members-add-submit]').click()
  await page.waitForFunction(() => document.querySelector('[data-loy-group-mobile-count]')?.getAttribute('data-loy-group-mobile-count') === '61', null, { timeout: 10000 })
  check(`${dir} add: sends { groupId, mobile } with the mobile as typed`, JSON.stringify(g632.added.at(-1)) === JSON.stringify({ groupId: 'g-5', mobile: '055 123 4567' }), JSON.stringify(g632.added.at(-1)))
  await memberRow(page, '966551234567').waitFor({ timeout: 10000 })
  check(`${dir} add: the new member lists canonical, the count follows, the field clears`,
    (await countOf(page)) === '61' && (await addInput.inputValue()) === '' && (await refused.count()) === 0)

  // ── Remove one, after a confirm naming the mobile ──
  await memberRow(page, '966500000001').locator('[data-member-remove]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor({ timeout: 10000 })
  const raw = await dialog.locator('[data-members-remove-dialog] p').first().innerText()
  check(`${dir} remove: the confirm names the mobile, isolated whole`, strip(raw).startsWith('Remove 966500000001 from this group?') && raw.includes('⁨966500000001⁩'), JSON.stringify(raw))
  check(`${dir} remove: nothing is removed before the confirm`, g632.removed.length === 0)
  await page.screenshot({ path: `${SHOTS}/${dir}-632-remove-confirm.png`, fullPage: true })
  await dialog.locator('[data-members-remove-confirm]').click()
  await dialog.waitFor({ state: 'detached', timeout: 10000 })
  await memberRow(page, '966500000001').waitFor({ state: 'detached', timeout: 10000 })
  check(`${dir} remove: sends { groupId, mobile } with the canonical mobile`, JSON.stringify(g632.removed.at(-1)) === JSON.stringify({ groupId: 'g-5', mobile: '966500000001' }), JSON.stringify(g632.removed.at(-1)))
  await page.waitForFunction(() => document.querySelector('[data-loy-group-mobile-count]')?.getAttribute('data-loy-group-mobile-count') === '60', null, { timeout: 10000 })
  check(`${dir} remove: the row goes and the count follows`, (await countOf(page)) === '60')
  check(`${dir} members (maintain): no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()

  // ── A view-only grant ──
  const viewer = await open(dir, { canView: true, canMaintain: false })
  await viewer.page.goto(`${BASE}/loy/groups/g-5`)
  await memberRow(viewer.page, '966500000002').waitFor({ timeout: 10000 })
  check(`${dir} view-only: the members list, with no add and no remove`,
    (await viewer.page.locator('[data-members-add-form]').count()) === 0 && (await viewer.page.locator('[data-member-remove]').count()) === 0 && (await viewer.page.locator('[col-id="remove"]').count()) === 0)
  check(`${dir} view-only: search still works`, (await viewer.page.locator('[data-members-search]').count()) === 1)
  check(`${dir} members (view-only): no page errors`, viewer.errors.length === 0, viewer.errors.join(' | '))
  await viewer.context.close()
}

try {
  await drive('ltr')
  await drive('rtl')
  await drive630('ltr')
  await drive630('rtl')
  await drive631('ltr')
  await drive631('rtl')
  await drive632('ltr')
  await drive632('rtl')
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
