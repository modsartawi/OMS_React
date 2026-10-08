// Coupon import delete drive (ticket 439, BackOffice spec 2463) — drives the REAL coupons screen in
// Chromium against STUBBED `CouponsAdminWeb/*` envelopes, shaped from the contract BackOffice
// 2465/2466 fixed. 🚩 NOTHING here is driven against a live SIS.Api: the owner walk on staging
// (ticket 439's last Proof bullet) is what closes the live half.
//
// It verifies:
//   1. the jobs grid offers Delete on Completed and Failed rows, Retry only on Failed, and nothing
//      on Deleted or Processing rows; a Deleted row reads Deleted with who deleted it and when;
//   2. the delete dialog states the server's preview as a sentence, keeps Confirm shut until a
//      reason is typed, caps the reason at 512, posts `{ reason }`, toasts, and re-reads the grid;
//   3. a preview that refuses shows the server's reason and keeps Confirm and the reason shut;
//   4. a delete the server refuses after the confirm (409) closes the dialog and toasts its
//      message; any other failure is said inside the dialog, which keeps the typed reason;
//   5. a deleted code's details show only its earlier upload (no instance card, no actions);
//   6. a re-uploaded code shows its current coupon first, then the earlier upload with its ledger;
//   7. the same holds right-to-left, and no state throws.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/coupon-import-delete-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.coupon-import-delete-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const TEMPLATE = 'OMS000000619'
const job = (jobId, status, over = {}) => ({
  jobId,
  templateId: TEMPLATE,
  status,
  totalCodes: 15000,
  totalProcessed: 15000,
  totalAdded: 2904,
  totalSkipped: 12096,
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

const PREVIEWS = {
  JOBDONE: { toDelete: 2904, redeemed: 3, redemptionCount: 4, inOtherTemplates: 12096, canDelete: true, refusalCode: null, refusalMessage: null },
  JOBFAIL: { toDelete: 10, redeemed: 0, redemptionCount: 0, inOtherTemplates: 0, canDelete: false, refusalCode: 'CUP-09062', refusalMessage: 'Another upload on this template is running. Try again when it finishes.' },
  JOBDOWN: { toDelete: 7, redeemed: 0, redemptionCount: 0, inOtherTemplates: 0, canDelete: true, refusalCode: null, refusalMessage: null },
  JOBRACE: { toDelete: 5, redeemed: 0, redemptionCount: 0, inOtherTemplates: 0, canDelete: true, refusalCode: null, refusalMessage: null },
}

const txn = (id, type, time, over = {}) => ({
  transactionId: id,
  refTransactionId: '',
  couponCode: 'X',
  redemptionType: type,
  transactionReference: `REF-${id}`,
  storeCode: 'P001',
  redemptionTime: time,
  userId: 'pos',
  staffId: '',
  isSuccessful: true,
  errorMessage: '',
  ...over,
})
const EARLIER = {
  deletedAt: '2026-10-07T11:30:00',
  deletedBy: 'msartawi',
  reason: 'wrong file uploaded to 619',
  templateId: TEMPLATE,
  redeemCount: 1,
  transactions: [txn('T-OLD-1', 'Redeem', '2026-10-06T15:00:00'), txn('T-OLD-2', 'Refund', '2026-10-08T10:00:00', { refTransactionId: 'T-OLD-1' })],
}
const TEMPLATE_ROW = {
  templateId: TEMPLATE, materialNumber: '100200', description: 'Autumn', maxRedemptionsPerCode: 1, maxRedemptionsTotal: 100000,
  totalRedemptionCount: 0, codePrefix: 'AU', isDisabled: false, validFrom: null, validTo: null, originFilter: '',
  createdAt: '2026-10-01T08:00:00', createdBy: 'seed', updatedAt: null, updatedBy: '',
}
const DETAILS = {
  DELCODE: { instance: null, template: null, transactions: [], isDeleted: true, earlierUploads: [EARLIER] },
  RECODE: {
    instance: {
      couponCode: 'RECODE', templateId: TEMPLATE, redeemCount: 0, lastRedeemTransactionId: '', customerId: '', isDisabled: false,
      createdAt: '2026-10-08T09:00:00', createdBy: 'msartawi', updatedAt: null, updatedBy: '',
    },
    template: TEMPLATE_ROW,
    transactions: [txn('T-NEW-1', 'Redeem', '2026-10-08T12:00:00')],
    isDeleted: false,
    earlierUploads: [EARLIER],
  },
}

const browser = await chromium.launch()

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  const deletes = []
  let jobsCalls = 0
  const jobs = [
    job('JOBDONE', 'Completed'),
    job('JOBFAIL', 'Failed', { errorMessage: 'worker stopped' }),
    job('JOBGONE', 'Deleted', { deletedAt: '2026-10-07T11:30:00', deletedBy: 'r.admin' }),
    job('JOBRACE', 'Completed'),
    job('JOBRUN', 'Processing', { totalProcessed: 100 }),
    job('JOBDOWN', 'Completed'),
  ]
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
    if (p === `CouponsAdminWeb/Templates/${TEMPLATE}/Jobs`) {
      jobsCalls++
      return route.fulfill(envelope(jobs))
    }
    let m = /^CouponsAdminWeb\/Jobs\/([^/]+)\/DeletePreview$/.exec(p)
    if (m) return route.fulfill(envelope({ jobId: m[1], ...PREVIEWS[m[1]] }))
    m = /^CouponsAdminWeb\/Jobs\/([^/]+)\/Delete$/.exec(p)
    if (m) {
      deletes.push({ jobId: m[1], body: route.request().postDataJSON() })
      if (m[1] === 'JOBDOWN') return route.fulfill({ status: 500, contentType: 'text/plain', body: 'boom' })
      if (m[1] === 'JOBRACE')
        return route.fulfill(envelope(null, { status: 409, success: false, message: 'This upload was already deleted.', errorCode: 'CUP-09061' }))
      const row = jobs.find((j) => j.jobId === m[1])
      Object.assign(row, { status: 'Deleted', deletedAt: '2026-10-08T10:00:00', deletedBy: 'msartawi' })
      return route.fulfill(envelope({ jobId: m[1], deleted: 2904, redeemed: 3, redemptionCount: 4 }))
    }
    m = /^CouponsAdminWeb\/Coupons\/([^/]+)$/.exec(p)
    if (m) return route.fulfill(envelope(DETAILS[m[1]]))
    if (/\/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, deletes, jobsCount: () => jobsCalls }
}

const rowOf = (page, jobId) => page.locator('tr', { has: page.locator('td', { hasText: jobId }) })
const toastText = async (page) => (await page.locator('[data-sonner-toast]').allInnerTexts()).join(' | ')

async function importTab(page) {
  await page.goto(`${BASE}/pricing/coupons`)
  await page.getByRole('tab').nth(2).click()
  await page.locator('[role="tabpanel"]:not([hidden]) input[maxlength="26"]').first().fill(TEMPLATE)
  await rowOf(page, 'JOBDONE').waitFor()
}

async function drive(dir) {
  const L = dir.toUpperCase()
  // ── 1–4: the jobs grid and the delete dialog ──────────────────────────────────────────────
  {
    const { context, page, errors, deletes, jobsCount } = await open(dir)
    await importTab(page)
    const buttons = async (id) => (await rowOf(page, id).locator('button').allInnerTexts()).map((s) => s.trim())

    if (dir === 'ltr') {
      check(`${L}: Completed offers Delete only`, JSON.stringify(await buttons('JOBDONE')) === '["Delete"]', JSON.stringify(await buttons('JOBDONE')))
      check(`${L}: Failed offers Retry and Delete`, JSON.stringify(await buttons('JOBFAIL')) === '["Retry","Delete"]', JSON.stringify(await buttons('JOBFAIL')))
      check(`${L}: Deleted offers nothing`, (await buttons('JOBGONE')).length === 0)
      check(`${L}: Processing offers nothing`, (await buttons('JOBRUN')).length === 0)
      const gone = await rowOf(page, 'JOBGONE').innerText()
      check(`${L}: a Deleted row reads Deleted with who and when`, /Deleted/.test(gone) && /by\s+\u2068?r\.admin/.test(gone), gone.replace(/\s+/g, ' '))
      check(`${L}: a Deleted row is greyed`, /opacity-70/.test((await rowOf(page, 'JOBGONE').getAttribute('class')) ?? ''))
    }

    // 2: the happy delete
    await rowOf(page, 'JOBDONE').getByRole('button').last().click()
    const dialog = page.locator('dialog[open]')
    await dialog.locator('[data-testid="delete-preview"]').waitFor()
    const sentence = (await dialog.locator('[data-testid="delete-preview"]').innerText()).replace(/[\u2068\u2069]/g, '')
    const confirm = dialog.getByRole('button').last()
    if (dir === 'ltr') {
      check(
        `${L}: the dialog states the preview in plain language`,
        sentence ===
          'Deletes 2,904 coupons (3 already redeemed; their redemption history is kept). 12,096 codes in this file belong to other templates and are not touched.',
        sentence,
      )
    } else {
      // Arabic text is not switched on yet (`lng` stays `en`); RTL is the direction. The ar bundle's
      // words and plurals are proven in helpers.test.ts.
      check(`${L}: the page is right-to-left and the dialog still states the preview`, (await page.locator('html').getAttribute('dir')) === 'rtl' && /2,904/.test(sentence), sentence)
    }
    check(`${L}: Confirm is shut until a reason is typed`, await confirm.isDisabled())
    const reason = dialog.locator('input[type="text"]')
    check(`${L}: the reason is capped at 512`, (await reason.getAttribute('maxlength')) === '512')
    await reason.fill('wrong file')
    check(`${L}: a reason opens Confirm`, await confirm.isEnabled())
    const before = jobsCount()
    await confirm.click()
    await page.locator('[data-sonner-toast]').first().waitFor()
    await page.waitForTimeout(300)
    check(`${L}: the delete posts the reason`, JSON.stringify(deletes[0]) === '{"jobId":"JOBDONE","body":{"reason":"wrong file"}}', JSON.stringify(deletes[0]))
    if (dir === 'ltr') check(`${L}: a success toast counts the removed coupons`, /Upload deleted: \u2068?2,904\u2069? coupons removed/.test(await toastText(page)), await toastText(page))
    check(`${L}: the dialog closes`, (await page.locator('dialog[open]').count()) === 0)
    check(`${L}: the grid re-reads and the row now reads Deleted`, jobsCount() > before && (await buttons('JOBDONE')).length === 0)
    await page.screenshot({ path: `${SHOTS}/${dir}-grid-after-delete.png` })

    // 3: a preview that refuses
    await rowOf(page, 'JOBFAIL').getByRole('button').last().click()
    await page.locator('dialog[open]', { hasText: 'Another upload on this template is running' }).waitFor()
    const refused = await page.locator('dialog[open]').innerText()
    check(`${L}: a refusing preview shows the server's reason`, /Another upload on this template is running/.test(refused))
    check(`${L}: …and no sentence about a delete that won't happen`, (await page.locator('dialog[open] [data-testid="delete-preview"]').count()) === 0)
    check(`${L}: …and keeps Confirm and the reason shut`, (await page.locator('dialog[open]').getByRole('button').last().isDisabled()) && (await page.locator('dialog[open] input[type="text"]').isDisabled()))
    await page.screenshot({ path: `${SHOTS}/${dir}-refused-preview.png` })
    await page.locator('dialog[open]').getByRole('button').first().click() // Cancel
    await page.waitForTimeout(200)

    // 4: a delete refused after the confirm
    await rowOf(page, 'JOBRACE').getByRole('button').last().click()
    await page.locator('dialog[open] [data-testid="delete-preview"]').waitFor()
    await page.locator('dialog[open] input[type="text"]').fill('duplicate')
    await page.locator('dialog[open]').getByRole('button').last().click()
    await page.waitForTimeout(600)
    check(`${L}: a refused delete closes the dialog and toasts the server's message`, (await page.locator('dialog[open]').count()) === 0 && /already deleted/.test(await toastText(page)), await toastText(page))

    // 4b: any other failure is said inside the dialog, which keeps the reason
    await rowOf(page, 'JOBDOWN').getByRole('button').last().click()
    await page.locator('dialog[open] [data-testid="delete-preview"]').waitFor()
    await page.locator('dialog[open] input[type="text"]').fill('kept reason')
    await page.locator('dialog[open]').getByRole('button').last().click()
    await page.locator('dialog[open]', { hasText: 'Could not delete the upload' }).waitFor()
    check(`${L}: a 5xx keeps the dialog open with the reason typed`, (await page.locator('dialog[open] input[type="text"]').inputValue()) === 'kept reason')
    await page.screenshot({ path: `${SHOTS}/${dir}-delete-failed-inline.png` })

    check(`${L}: no page errors (import)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 5–6: the detail pane ──────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/pricing/coupons`)
    await page.getByRole('tab').nth(1).click()
    const search = page.locator('[role="tabpanel"]:not([hidden]) input[type="text"]').first()
    await search.fill('DELCODE')
    await search.press('Enter')
    await page.locator('[data-testid="earlier-upload"]').first().waitFor()
    const panel = page.locator('[role="tabpanel"]:not([hidden])')
    const text = await panel.innerText()
    check(`${L}: a deleted code shows one earlier-upload section`, (await panel.locator('[data-testid="earlier-upload"]').count()) === 1)
    if (dir === 'ltr') {
      check(`${L}: …headed with when, who and why`, /Earlier upload, deleted .+ by msartawi: wrong file uploaded to 619/.test(text.replace(/[\u2068\u2069]/g, '')), text.split('\n')[1])
      check(`${L}: …and no instance card or actions`, !/Instance/.test(text) && (await panel.getByRole('button', { name: /Reset|Deactivate|Refund/ }).count()) === 0)
    }
    check(`${L}: …listing the deleted upload's ledger, refund included`, /REF-T-OLD-1/.test(text) && /REF-T-OLD-2/.test(text))
    await page.screenshot({ path: `${SHOTS}/${dir}-deleted-code.png`, fullPage: true })

    await search.fill('RECODE')
    await search.press('Enter')
    await page.locator('text=REF-T-NEW-1').waitFor()
    const html = await panel.innerText()
    check(`${L}: a re-uploaded code shows the current ledger before the earlier upload`, html.indexOf('REF-T-NEW-1') < html.indexOf('REF-T-OLD-1') && html.indexOf('REF-T-OLD-1') > 0)
    check(`${L}: …and the current coupon keeps its actions`, (await panel.getByRole('button').count()) > 1)
    await page.screenshot({ path: `${SHOTS}/${dir}-reuploaded-code.png`, fullPage: true })
    check(`${L}: no page errors (details)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
