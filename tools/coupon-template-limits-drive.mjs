// Coupon template limits drive (ticket 494, BackOffice spec 2680 slice 3) — drives the REAL coupons
// screen in Chromium against STUBBED `CouponsAdminWeb/*` envelopes, shaped from the contract
// BackOffice 2682 fixed (both limits nullable on the PUT). 🚩 NOTHING here is driven against a live
// SIS.Api: the owner walk on a host carrying 2682 is what closes the live half.
//
// It verifies:
//   1. a loaded template's two limits are editable, Template ID and Code prefix stay locked, each
//      limit carries the "0 = unlimited" hint and the save hint names only the two fixed fields;
//   2. Save sends both limits on the PUT, with no confirmation when the total is not below redeemed,
//      and a reload shows the saved values;
//   3. a total lowered below what is redeemed asks first, naming the count; No sends nothing, Yes sends;
//   4. zero never asks;
//   5. the same holds right-to-left, and no state throws.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/coupon-template-limits-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.coupon-template-limits-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

const TEMPLATE = 'OMS000000619'

const browser = await chromium.launch()

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const puts = []
  // The stored template: a PUT writes through, so a reload reads back what was saved.
  const stored = {
    templateId: TEMPLATE, materialNumber: 'COUP01', description: 'Autumn', maxRedemptionsPerCode: 1, maxRedemptionsTotal: 100,
    totalRedemptionCount: 70, codePrefix: 'AU', isDisabled: false, validFrom: null, validTo: null, originFilter: '',
    createdAt: '2026-10-01T08:00:00', createdBy: 'seed', updatedAt: null, updatedBy: '',
  }
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'CouponsAdminWeb/Access') return route.fulfill(envelope({ canAdmin: true, canSupport: true }))
    if (p === `CouponsAdminWeb/Templates/${TEMPLATE}`) {
      if (route.request().method() === 'PUT') {
        const body = route.request().postDataJSON()
        puts.push(body)
        // Absent/null leaves a limit unchanged (BackOffice 2682).
        if (body.maxRedemptionsPerCode != null) stored.maxRedemptionsPerCode = body.maxRedemptionsPerCode
        if (body.maxRedemptionsTotal != null) stored.maxRedemptionsTotal = body.maxRedemptionsTotal
        stored.updatedAt = '2026-10-15T10:00:00'
      }
      return route.fulfill(envelope({ ...stored }))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, puts, stored }
}

const panel = (page) => page.locator('[role="tabpanel"]:not([hidden])')

async function load(page) {
  const p = panel(page)
  await p.locator('input[type="text"]').first().fill(TEMPLATE)
  await p.getByRole('button').first().click()
  await p.locator('[data-testid="coupon-template-max-total"]').waitFor()
  await page.waitForFunction(
    () => document.querySelector('[data-testid="coupon-template-max-total"]')?.value !== '0',
  )
}

async function save(page) {
  await panel(page).locator('button').filter({ hasText: /^(Save|حفظ)$/ }).first().click()
}

async function drive(dir) {
  const L = dir.toUpperCase()
  const { context, page, errors, puts, stored } = await open(dir)
  await page.goto(`${BASE}/pricing/coupons`)
  await load(page)
  const p = panel(page)
  const perCode = p.locator('[data-testid="coupon-template-max-per-code"]')
  const total = p.locator('[data-testid="coupon-template-max-total"]')

  // 1: what is editable once loaded
  check(`${L}: both limits are editable once loaded`, (await perCode.isEnabled()) && (await total.isEnabled()))
  const fixed = p.locator('input[type="text"]:disabled')
  check(`${L}: Template ID and Code prefix stay locked`, (await fixed.count()) === 2, String(await fixed.count()))
  if (dir === 'ltr') {
    check(`${L}: each limit carries the 0 = unlimited hint`, (await p.getByText('0 = unlimited', { exact: true }).count()) === 2)
    check(`${L}: the save hint names only the two fixed fields`, (await p.getByText('Only the template ID and code prefix are fixed.').count()) === 1)
  }

  // 2: raising both limits sends them with no confirmation, and a reload reads them back
  await perCode.fill('2')
  await total.fill('150')
  await save(page)
  await page.locator('[data-sonner-toast]').first().waitFor()
  check(`${L}: no confirmation when the total is not below redeemed`, (await page.locator('dialog[open]').count()) === 0)
  check(
    `${L}: the PUT carries both limits`,
    puts.length === 1 && puts[0].maxRedemptionsPerCode === 2 && puts[0].maxRedemptionsTotal === 150,
    JSON.stringify(puts[0]),
  )
  await p.getByRole('button').nth(1).click() // New — clears the form
  await load(page)
  check(`${L}: a reload shows the saved limits`, (await perCode.inputValue()) === '2' && (await total.inputValue()) === '150', `${await perCode.inputValue()}/${await total.inputValue()}`)

  // 3: lowering the total below redeemed asks, naming the count
  await total.fill('50')
  await save(page)
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  const message = (await dialog.innerText()).replace(/[\u2068\u2069]/g, '')
  if (dir === 'ltr') check(`${L}: the confirmation names what is redeemed`, /70 already redeemed — this limit stops all further use\./.test(message), message.replace(/\s+/g, ' '))
  else check(`${L}: the page is right-to-left and the confirmation names the count`, (await page.locator('html').getAttribute('dir')) === 'rtl' && /70/.test(message), message.replace(/\s+/g, ' '))
  await page.screenshot({ path: `${SHOTS}/${dir}-confirm.png` })
  await dialog.getByRole('button').filter({ hasText: /No|لا/ }).last().click()
  await page.waitForTimeout(300)
  check(`${L}: No sends nothing`, puts.length === 1 && (await page.locator('dialog[open]').count()) === 0, String(puts.length))
  await save(page)
  await dialog.waitFor()
  await dialog.getByRole('button').last().click()
  await page.waitForTimeout(500)
  check(`${L}: Yes sends the lowered total`, puts.length === 2 && puts[1].maxRedemptionsTotal === 50 && stored.maxRedemptionsTotal === 50, JSON.stringify(puts[1]))

  // 4: zero never asks
  await total.fill('0')
  await save(page)
  await page.waitForTimeout(500)
  check(`${L}: zero (unlimited) saves without asking`, (await page.locator('dialog[open]').count()) === 0 && puts.length === 3 && puts[2].maxRedemptionsTotal === 0, JSON.stringify(puts[2]))

  await page.screenshot({ path: `${SHOTS}/${dir}-saved.png` })
  check(`${L}: no state throws`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
