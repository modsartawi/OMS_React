// Simulation loyalty-group picker drive (oms ticket 637; BackOffice spec 3173, door 3174).
//
// Drives the REAL app in Chromium against STUBBED envelopes: `LoyGroupWeb/Access` and
// `LoyGroupWeb/Groups` (3174) are deployed nowhere yet, and `Pricing/Simulate` serves a captured
// payload. It asserts:
//   1. with the view grant, the header's "Loyalty group" field is the core picker over
//      `Groups?includeInactive=true`, not a text box;
//   2. ticking GOLD and SILVER: Escape closes the panel and NOT the run form;
//   3. Process posts `loyGroups: "GOLD,SILVER"` (one comma string) and the collapsed strip's LOY chip
//      shows it; taking every group off posts `null` and the LOY chip goes;
//   4. without the grant (D3) — and while the probe is pending, and when it has failed — the field is
//      today's FREE TEXT (not the picker's read-only fallback), sent as typed, and no list is asked;
//   5. under RTL the picker still draws; no raw keys, no page errors.
//
//   1. run the app:  npx vite --port 5208 --strictPort
//   2. DRIVE_PORT=5208 node tools/sim-loy-groups-drive.mjs   (cwd: the repo root holding .issues/)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5208}`
const CAPTURE = '.issues/assets/098-simulate-payloads/03-applied-and-potential-owner-supplied.json'
const SIMULATION = JSON.parse(readFileSync(CAPTURE, 'utf8')).response.data
const SHOTS = fileURLToPath(new URL('./.sim-loy-groups-shots/', import.meta.url))
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: status < 400, message: '', errors: [], data }),
})

const GROUPS = [
  { groupId: 'g1', code: 'GOLD', nameEn: 'Gold members', nameAr: 'الذهبي', isActive: true, mobileCount: 120, liveBonusBuys: [] },
  { groupId: 'g2', code: 'SILVER', nameEn: 'Silver members', nameAr: 'الفضي', isActive: true, mobileCount: 80, liveBonusBuys: [] },
  { groupId: 'g3', code: 'RAMADAN_24', nameEn: 'Ramadan 2024', nameAr: 'رمضان ٢٠٢٤', isActive: false, mobileCount: 40, liveBonusBuys: [] },
]

/** Answers the 'late' probe (granted) once the drive releases it. */
let releaseLate = () => {}
let lateGate = Promise.resolve()

/** probe: 'granted' | 'denied' | 'pending' | 'failed' | 'late' */
async function open(dir, probe) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } })
  const errors = []
  const posted = []
  const asked = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/Failed to load resource/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en'), dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const [path, qs = ''] = req.url().split('/api/')[1].split('?')
    if (path === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (path === 'Pricing/Access') return route.fulfill(envelope({ canOpen: true }))
    if (path === 'Pricing/CacheAccess') return route.fulfill(envelope({ canClear: true }))
    if (path === 'LoyGroupWeb/Access') {
      if (probe === 'pending') return new Promise(() => {}) // never answers
      if (probe === 'failed') return route.fulfill(envelope(null, { status: 500 }))
      if (probe === 'late') return lateGate.then(() => route.fulfill(envelope({ canView: true, canMaintain: false })))
      return route.fulfill(envelope({ canView: probe === 'granted', canMaintain: false }))
    }
    if (path === 'LoyGroupWeb/Groups') {
      asked.push(qs)
      return route.fulfill(envelope(GROUPS))
    }
    if (path === 'Pricing/Simulate') {
      posted.push(JSON.parse(req.postData() || '{}'))
      return route.fulfill(envelope(SIMULATION))
    }
    return route.fulfill(envelope({}))
  })
  await page.goto(`${BASE}/pricing/simulation`, { timeout: 180000 })
  await page.locator('[data-run-strip]').waitFor({ timeout: 60000 })
  await page.locator('table').first().locator('input').first().fill('107255')
  return { browser, page, errors, posted, asked }
}

const stripMode = (page) => page.locator('[data-run-strip]').getAttribute('data-run-strip')
const stripText = (page) => page.locator('[data-chip-set]').innerText().then((s) => s.replace(/\s+/g, ' '))
const processRun = async (page, posted) => {
  const n = posted.length
  await page.getByRole('button', { name: /Process|معالجة/ }).first().click()
  await page.waitForFunction(() => document.querySelector('[data-run-strip]')?.getAttribute('data-run-strip') === 'collapsed', null, { timeout: 8000 }).catch(() => {})
  await page.waitForTimeout(150)
  return posted.length > n ? posted[posted.length - 1] : null
}
const rawKey = async (page) => (await page.locator('body').innerText()).match(/(?:header|strip|multiSelect|picker)\.[a-zA-Z.]+/)
const textBox = (page) => page.locator('[data-run-strip] label:has(input[type="text"])').filter({ hasText: /Loyalty group|مجموعة الولاء/ })

async function granted(dir) {
  const { browser, page, errors, posted, asked } = await open(dir, 'granted')
  const picker = page.locator('[data-testid="sim-header-loyGroups"]')
  await picker.locator('[data-multi-select-trigger]').waitFor({ timeout: 10000 })

  // ── 1. the picker ──
  check(`${dir} 1. with the grant the field is the picker`, (await picker.getAttribute('data-multi-select')) === '')
  check(`${dir} 1. …and no longer a text box`, (await textBox(page).count()) === 0)
  check(`${dir} 1. the options are asked with includeInactive=true`, asked.some((q) => q.includes('includeInactive=true')), asked.join(' | '))
  if (dir === 'ltr') {
    const label = await page.locator(`label[for="${await picker.locator('[data-multi-select-trigger]').getAttribute('id')}"]`).innerText()
    check(`${dir} 1. the trigger is named by the field label`, label === 'Loyalty group', label)
  }
  if (dir === 'rtl') check('rtl 1. the page is right-to-left', (await page.locator('html').getAttribute('dir')) === 'rtl')

  // ── 2. pick two; Escape closes the panel, not the form ──
  await picker.locator('[data-multi-select-trigger]').click()
  check(`${dir} 2. the panel offers the three defined groups`, (await picker.locator('[data-option]').count()) === 3)
  await picker.locator('[data-option="GOLD"] input').check()
  await picker.locator('[data-option="SILVER"] input').check()
  await page.screenshot({ path: `${SHOTS}/${dir}-picker-open.png` }).catch(() => {})
  await page.keyboard.press('Escape')
  await page.waitForTimeout(150)
  check(`${dir} 2. Escape closes the panel`, (await picker.locator('[data-multi-select-panel]').count()) === 0)
  check(`${dir} 2. …and leaves the run form open`, (await stripMode(page)) !== 'collapsed', await stripMode(page))
  const chosen = await picker.locator('[data-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chip')))
  check(`${dir} 2. the chips read GOLD, SILVER`, JSON.stringify(chosen) === '["GOLD","SILVER"]', JSON.stringify(chosen))

  // ── 3. run: the comma string rides the request; the LOY chip shows it ──
  const body = await processRun(page, posted)
  check(`${dir} 3. Process posts loyGroups "GOLD,SILVER"`, body?.header?.loyGroups === 'GOLD,SILVER', JSON.stringify(body?.header?.loyGroups))
  const chips = await stripText(page)
  check(`${dir} 3. the collapsed strip's LOY chip shows the picked groups`, chips.includes('GOLD,SILVER'), chips)
  await page.screenshot({ path: `${SHOTS}/${dir}-ran.png` }).catch(() => {})

  // ── 3b. none → null ──
  await page.locator('[data-chip-set]').click()
  await picker.locator('[data-chip-remove="GOLD"]').click()
  await picker.locator('[data-chip-remove="SILVER"]').click()
  const cleared = await processRun(page, posted)
  check(`${dir} 3. every group taken off posts loyGroups null`, cleared && cleared.header.loyGroups === null, JSON.stringify(cleared?.header?.loyGroups))
  const after = await stripText(page)
  check(`${dir} 3. …and the LOY chip goes`, !/GOLD|SILVER/.test(after), after)

  const k = await rawKey(page)
  check(`${dir} 5. no raw i18n keys`, k === null, (k || [''])[0])
  check(`${dir} 5. no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await browser.close()
}

async function freeText(dir, probe) {
  const { browser, page, errors, posted, asked } = await open(dir, probe)
  await page.waitForTimeout(probe === 'pending' ? 800 : 400)
  const box = textBox(page)
  check(`${dir} 4. ${probe}: the field is today's free text`, (await box.count()) === 1)
  check(`${dir} 4. ${probe}: …not the picker, not its read-only text`,
    (await page.locator('[data-multi-select], [data-loy-groups-readonly]').count()) === 0)
  await box.locator('input').fill(' gold, 0001 ')
  const body = await processRun(page, posted)
  check(`${dir} 4. ${probe}: Process posts the text as typed (trimmed)`, body?.header?.loyGroups === 'gold, 0001', JSON.stringify(body?.header?.loyGroups))
  check(`${dir} 4. ${probe}: the LOY chip shows it`, (await stripText(page)).includes('gold, 0001'))
  check(`${dir} 4. ${probe}: no groups list is asked`, asked.length === 0, asked.join(' | '))
  check(`${dir} 4. ${probe}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await browser.close()
}

/** Review fix 9: the probe answers after free text was typed — the form takes the picker's normalised codes. */
async function lateProbe(dir) {
  lateGate = new Promise((r) => (releaseLate = r))
  const { browser, page, errors, posted } = await open(dir, 'late')
  const box = textBox(page)
  await box.waitFor({ timeout: 10000 })
  await box.locator('input').fill(' gold; silver ,gold')
  releaseLate()
  const picker = page.locator('[data-testid="sim-header-loyGroups"]')
  await picker.locator('[data-multi-select-trigger]').waitFor({ timeout: 10000 })
  const chips = await picker.locator('[data-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chip')))
  check(`${dir} 6. late probe: the picker shows the typed codes normalised`, JSON.stringify(chips) === '["GOLD","SILVER"]', JSON.stringify(chips))
  const body = await processRun(page, posted)
  check(`${dir} 6. late probe: Process posts what the picker shows`, body?.header?.loyGroups === 'GOLD,SILVER', JSON.stringify(body?.header?.loyGroups))
  check(`${dir} 6. late probe: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await browser.close()
}

async function run() {
  for (const dir of ['ltr', 'rtl']) {
    await granted(dir)
    await freeText(dir, 'denied')
  }
  await freeText('ltr', 'pending')
  await freeText('ltr', 'failed')
  await lateProbe('ltr')
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
