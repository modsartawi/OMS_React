// Request cancellation drive (ticket 855, BackOffice spec 3461 / door 3462) — drives the REAL app in
// Chromium against a STUBBED wire, serving a captured delivery from `.issues/assets/078-document-payloads/`.
//
// Asserts:
//   1. the dialog lists the server's reasons in the server's order, in English under `en`;
//   2. under the RTL boot (`oms.locale = ar`) the same reasons, in the same order;
//   3. the posted request carries `reasonCode` and the ENGLISH name as `note`;
//   4. the pick is cleared on every open;
//   5. a failed load shows an inline error, the select is off and commit stays disabled;
//   6. an `SDD-02235` refusal is toasted in this client's words, not the server's English sentence.
//   Review follow-up (3461 review A/B/D/E):
//   7. a reopen whose re-read is still running shows loading — the last open's list is not offered;
//   8. a reopen retrying a failed load shows loading, not the last failure, then the list;
//   9. a list that loads empty says so inline and commit stays disabled;
//  10. a 403 on the read toasts the grant refusal and closes the dialog.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/request-close-drive.mjs
//
// Not driven: the Arabic NAMES. `@/core/i18n` boots `lng: 'en'` and nothing in the app switches it at
// runtime yet (`oms.locale` sets only `<html dir>`), so the dialog shows `nameEn` under RTL too. The
// name-by-language rule is proven at its pure seam (`request-close.test.ts`), on `i18n.language`.
import { createRequire } from 'node:module'
import { readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'
const DELIVERY = '8000000253'

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
    errors: errorCode ? [{ errorCode, errorMessage: message }] : [],
    data,
  }),
})

const DOCUMENTS = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  DOCUMENTS[capture.data.documentNo] = capture.data
}

/** Deliberately NOT alphabetical: the server's order is the business's order. */
const REASONS = [
  { code: 'CREQ', nameEn: 'Customer requested cancellation', nameAr: 'طلب العميل الإلغاء' },
  { code: 'CMIS', nameEn: 'Order placed by mistake', nameAr: 'تم إنشاء الطلب بالخطأ' },
  { code: 'CDUP', nameEn: 'Duplicate order', nameAr: 'طلب مكرر' },
]

async function session(locale, wire) {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  await page.addInitScript((l) => localStorage.setItem('oms.locale', l), locale)
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(
        envelope({ canOpenList: true, canOpenDetail: true, canChangeDetail: true, canCreateReturn: true }),
      )
    if (p === 'SdDocumentWeb/CancellationReasons') {
      wire.reads++
      if (wire.delay) await new Promise((r) => setTimeout(r, wire.delay))
      return route.fulfill(wire.reasons())
    }
    if (p === 'SdDocumentWeb/UpdateDocument' || p === 'SdDocumentWeb/UpdateDelivery') {
      wire.posted.push({ path: p, body: JSON.parse(route.request().postData() || '{}') })
      return route.fulfill(wire.update())
    }
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCUMENTS[doc[1]] ?? null))
    if (/\/(Outbox|Logs|DonorRequests)$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })
  await page.goto(`${BASE}/oms/delivery/${DELIVERY}`)
  await page.locator('section[aria-label="Actions"]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(400)
  return { browser, page, errors }
}

const openDialog = async (page) => {
  await page.locator('[data-command="request-close"]').click()
  await page.locator('dialog[open] #request-close-reason').waitFor()
  await page.waitForTimeout(400)
}
const openDialogNow = async (page) => {
  await page.locator('[data-command="request-close"]').click()
  await page.locator('dialog[open] #request-close-reason').waitFor()
}
const view = (page) => page.locator('dialog[open] #request-close-reason').getAttribute('data-request-close-view')
const bannerCount = (page) => page.locator('dialog[open] [role="alert"], dialog[open] .text-danger-800').count()
const options = (page) =>
  page.$$eval('dialog[open] #request-close-reason option', (os) =>
    os.filter((o) => o.value).map((o) => ({ value: o.value, text: o.textContent.replace(/[\u2066-\u2069]/g, '') })),
  )
const commitDisabled = (page) => page.locator('dialog[open] [data-request-close-commit]').isDisabled()
const closeDialog = async (page) => {
  await page.keyboard.press('Escape')
  await page.waitForTimeout(300)
}

async function run() {
  // ---------------------------------------------------------------- English
  {
    const wire = { reads: 0, posted: [], reasons: () => envelope(REASONS), update: () => envelope(true) }
    const { browser, page, errors } = await session('en', wire)
    await openDialog(page)
    const en = await options(page)
    check(
      'en: the server’s reasons, in the server’s order, by English name',
      JSON.stringify(en) === JSON.stringify(REASONS.map((r) => ({ value: r.code, text: r.nameEn }))),
      JSON.stringify(en),
    )
    check('en: commit is disabled until a reason is picked', await commitDisabled(page))
    await page.locator('dialog[open] #request-close-reason').selectOption('CMIS')
    check('en: picking a reason enables commit', !(await commitDisabled(page)))
    await closeDialog(page)
    await openDialog(page)
    check(
      'the pick is cleared on every open, and the list is asked again',
      (await page.locator('dialog[open] #request-close-reason').inputValue()) === '' &&
        (await commitDisabled(page)) &&
        wire.reads >= 2,
      `reads=${wire.reads}`,
    )
    await closeDialog(page)

    // A reason retired while the dialog was open.
    wire.update = () =>
      envelope(null, {
        status: 400,
        success: false,
        message: 'Reason CMIS is not an active cancellation reason',
        errorCode: 'SDD-02235',
      })
    await openDialog(page)
    await page.locator('dialog[open] #request-close-reason').selectOption('CMIS')
    await page.locator('dialog[open] [data-request-close-commit]').click()
    await page.waitForTimeout(800)
    const toast = await page.$$eval('[data-sonner-toast][data-type="error"]', (ts) => ts.map((t) => t.textContent))
    check(
      'SDD-02235 is toasted in this client’s words, not the server’s English sentence',
      toast.some((t) => t.includes('no longer in use')) && !toast.some((t) => t.includes('not an active cancellation')),
      JSON.stringify(toast),
    )
    check('en: no page errors', errors.length === 0, errors.join(' | '))
    await browser.close()
  }

  // ---------------------------------------------------------------- RTL boot
  {
    const wire = { reads: 0, posted: [], reasons: () => envelope(REASONS), update: () => envelope(true) }
    const { browser, page, errors } = await session('ar', wire)
    await openDialog(page)
    const ar = await options(page)
    check(
      'rtl: the page is right-to-left and the same reasons show, in the same order',
      (await page.locator('html').getAttribute('dir')) === 'rtl' &&
        JSON.stringify(ar.map((o) => o.value)) === JSON.stringify(REASONS.map((r) => r.code)),
      JSON.stringify(ar),
    )
    await page.locator('dialog[open] #request-close-reason').selectOption('CMIS')
    await page.locator('dialog[open] [data-request-close-commit]').click()
    await page.waitForTimeout(800)
    const post = wire.posted.at(-1)
    check(
      'rtl: the request carries the code and the ENGLISH name, on the delivery door',
      post?.path === 'SdDocumentWeb/UpdateDelivery' &&
        post.body.actionType === 'DRCL' &&
        post.body.reasonCode === 'CMIS' &&
        post.body.note === 'Order placed by mistake',
      JSON.stringify(post),
    )
    check('rtl: no page errors', errors.length === 0, errors.join(' | '))
    await browser.close()
  }

  // ---------------------------------------------------------------- load failure
  {
    const wire = {
      reads: 0,
      posted: [],
      reasons: () => ({ status: 500, contentType: 'text/plain', body: 'boom' }),
      update: () => envelope(true),
    }
    const { browser, page } = await session('en', wire)
    await openDialog(page)
    const banner = await page.locator('dialog[open] [role="alert"], dialog[open] .text-danger-800').count()
    check(
      'a failed load shows an inline error, the select is off and commit stays disabled',
      banner > 0 &&
        (await page.locator('dialog[open] #request-close-reason').isDisabled()) &&
        (await commitDisabled(page)),
      `banner=${banner}`,
    )
    await browser.close()
  }

  // ---------------------------------------------------------------- stale list on reopen (A)
  {
    const wire = { reads: 0, posted: [], reasons: () => envelope(REASONS), update: () => envelope(true) }
    const { browser, page } = await session('en', wire)
    await openDialog(page)
    await closeDialog(page)
    wire.delay = 1500
    wire.reasons = () => envelope([REASONS[2]])
    await openDialogNow(page)
    await page.waitForTimeout(300)
    check(
      'a reopen whose re-read is running shows loading and offers none of the last open’s reasons',
      (await view(page)) === 'loading' && (await options(page)).length === 0 && (await commitDisabled(page)),
      `view=${await view(page)}`,
    )
    await page.waitForTimeout(1600)
    const fresh = await options(page)
    check(
      'once the re-read lands, only the fresh list is offered',
      (await view(page)) === 'ready' && JSON.stringify(fresh.map((o) => o.value)) === '["CDUP"]',
      JSON.stringify(fresh),
    )
    await browser.close()
  }

  // ---------------------------------------------------------------- retry after failure (E)
  {
    const wire = {
      reads: 0,
      posted: [],
      reasons: () => ({ status: 500, contentType: 'text/plain', body: 'boom' }),
      update: () => envelope(true),
    }
    const { browser, page } = await session('en', wire)
    await openDialog(page)
    await closeDialog(page)
    wire.delay = 1500
    wire.reasons = () => envelope(REASONS)
    await openDialogNow(page)
    await page.waitForTimeout(300)
    check(
      'a reopen retrying a failed load shows loading, not the last failure',
      (await view(page)) === 'loading' && (await bannerCount(page)) === 0,
      `view=${await view(page)} banner=${await bannerCount(page)}`,
    )
    await page.waitForTimeout(1600)
    check('the retry lands the list', (await view(page)) === 'ready' && (await options(page)).length === 3)
    await browser.close()
  }

  // ---------------------------------------------------------------- empty list (D)
  {
    const wire = { reads: 0, posted: [], reasons: () => envelope([]), update: () => envelope(true) }
    const { browser, page } = await session('en', wire)
    await openDialog(page)
    check(
      'an empty list says no reason is active, and commit stays disabled',
      (await view(page)) === 'empty' &&
        (await page.locator('dialog[open] [data-request-close-empty]').count()) === 1 &&
        (await commitDisabled(page)),
      `view=${await view(page)}`,
    )
    await browser.close()
  }

  // ---------------------------------------------------------------- 403 on the read (B)
  {
    const wire = {
      reads: 0,
      posted: [],
      reasons: () => envelope(null, { status: 403, success: false, message: 'Forbidden' }),
      update: () => envelope(true),
    }
    const { browser, page } = await session('en', wire)
    await page.locator('[data-command="request-close"]').click()
    await page.waitForTimeout(800)
    const toast = await page.$$eval('[data-sonner-toast][data-type="error"]', (ts) => ts.map((t) => t.textContent))
    check(
      'a 403 on the read toasts the grant refusal and closes the dialog',
      (await page.locator('dialog[open] #request-close-reason').count()) === 0 &&
        toast.some((t) => t.includes('not open to you')),
      JSON.stringify(toast),
    )
    await browser.close()
  }

  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
