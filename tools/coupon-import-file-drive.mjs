// Coupon import file drive (ticket 495, BackOffice spec 2680 slice 3) — drives the REAL coupons
// screen in Chromium against STUBBED `CouponsAdminWeb/*` envelopes, shaped from the contract
// BackOffice 2683 fixed (`fileName` / `fileSizeBytes`). 🚩 NOTHING here is driven against a live
// SIS.Api: the walk on a host carrying 2683 (and migration 011) is what closes the live half.
//
// It verifies:
//   1. uploading a file posts its name and size beside the codes;
//   2. the new job's row shows the file name in a File column, its size on hover;
//   3. an older job (no fields at all) and a job with none recorded ('' / 0) show "—";
//   4. a Deleted job keeps its file name; an Arabic name reads exactly as named;
//   5. the same holds right-to-left, and no state throws.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/coupon-import-file-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.coupon-import-file-shots'
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
const ARABIC = 'قسائم رمضان ١٤٤٧ - الدفعة ٣.csv'
const job = (jobId, status, over = {}) => ({
  jobId,
  templateId: TEMPLATE,
  status,
  totalCodes: 3,
  totalProcessed: 3,
  totalAdded: 3,
  totalSkipped: 0,
  customerId: null,
  createdBy: 'msartawi',
  createdAt: '2026-10-06T09:00:00',
  startedAt: '2026-10-06T09:00:05',
  completedAt: '2026-10-06T09:03:00',
  errorMessage: null,
  deletedAt: null,
  deletedBy: null,
  ...over,
})

// The upload: three codes, one duplicate — 32 bytes.
const UPLOAD = { name: 'autumn-batch-1.txt', mimeType: 'text/plain', buffer: Buffer.from('AU-0001\nAU-0002\nAU-0003\nAU-0001\n') }

const browser = await chromium.launch()

async function drive(dir) {
  const L = dir.toUpperCase()
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const posts = []
  const jobs = [
    job('JOBKB', 'Completed', { fileName: 'ramadan-batch-3.csv', fileSizeBytes: 1536 }),
    job('JOBAR', 'Deleted', { fileName: ARABIC, fileSizeBytes: 2_411_724, deletedAt: '2026-10-07T11:30:00', deletedBy: 'r.admin' }),
    job('JOBBLANK', 'Completed', { fileName: '', fileSizeBytes: 0 }),
    job('JOBOLD', 'Completed'), // an API older than 2683: neither field
  ]
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const p = new URL(route.request().url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'CouponsAdminWeb/Access') return route.fulfill(envelope({ canAdmin: true, canSupport: true }))
    if (p === `CouponsAdminWeb/Templates/${TEMPLATE}/Jobs`) return route.fulfill(envelope(jobs))
    if (p === `CouponsAdminWeb/Templates/${TEMPLATE}/Import`) {
      const body = route.request().postDataJSON()
      posts.push(body)
      const created = job('JOBNEW', 'Completed', { totalCodes: body.codes.length, fileName: body.fileName ?? '', fileSizeBytes: body.fileSizeBytes ?? 0 })
      jobs.unshift(created)
      return route.fulfill(envelope(created))
    }
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })

  const rowOf = (jobId) => page.locator('tr', { has: page.locator('td', { hasText: jobId }) })
  const fileCell = (jobId) => rowOf(jobId).locator('[data-testid="job-file"]')
  const strip = (s) => (s ?? '').replace(/[\u2068\u2069]/g, '')

  await page.goto(`${BASE}/pricing/coupons`)
  await page.getByRole('tab').nth(2).click()
  await page.locator('[role="tabpanel"]:not([hidden]) input[maxlength="26"]').first().fill(TEMPLATE)
  await rowOf('JOBKB').waitFor()

  // 2–4 on the seeded rows
  check(`${L}: the grid has a File column`, (await page.locator('th').allInnerTexts()).some((h) => /^(file|الملف)$/i.test(h.trim())))
  check(`${L}: a recorded job shows its file name`, (await fileCell('JOBKB').innerText()).trim() === 'ramadan-batch-3.csv')
  check(`${L}: …with its size on hover`, /^1\.5 (KB|ك\.ب)$/.test(strip(await fileCell('JOBKB').getAttribute('title'))), strip(await fileCell('JOBKB').getAttribute('title')))
  check(`${L}: …the name in a <bdi>`, (await fileCell('JOBKB').locator('bdi').count()) === 1)
  check(`${L}: a Deleted job keeps its Arabic file name exactly`, (await fileCell('JOBAR').innerText()).trim() === ARABIC)
  check(`${L}: …and its MB size`, /^2\.3 (MB|م\.ب)$/.test(strip(await fileCell('JOBAR').getAttribute('title'))))
  check(`${L}: an older job (no fields) shows —`, (await fileCell('JOBOLD').innerText()).trim() === '—')
  check(`${L}: a job with none recorded shows —`, (await fileCell('JOBBLANK').innerText()).trim() === '—')
  check(`${L}: …and no size on its hover`, !/\d/.test((await fileCell('JOBBLANK').getAttribute('title')) ?? ''))

  // 1–2 a fresh upload
  await page.locator('input[type="file"]').setInputFiles(UPLOAD)
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await dialog.getByRole('button').last().click()
  await rowOf('JOBNEW').waitFor()
  const sent = posts[0] ?? {}
  check(`${L}: the upload posts the file name`, sent.fileName === UPLOAD.name, JSON.stringify({ fileName: sent.fileName, fileSizeBytes: sent.fileSizeBytes }))
  check(`${L}: …and its size in bytes`, sent.fileSizeBytes === UPLOAD.buffer.length)
  check(`${L}: …beside the de-duped codes`, JSON.stringify(sent.codes) === '["AU-0001","AU-0002","AU-0003"]')
  check(`${L}: the fresh upload's row shows its file name`, (await fileCell('JOBNEW').innerText()).trim() === UPLOAD.name)
  check(`${L}: …with its size on hover`, /^32 (B|بايت)$/.test(strip(await fileCell('JOBNEW').getAttribute('title'))), strip(await fileCell('JOBNEW').getAttribute('title')))

  await page.screenshot({ path: `${SHOTS}/${dir}-jobs.png`, fullPage: true })
  check(`${L}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
