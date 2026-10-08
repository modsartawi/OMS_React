// Document payments drive (ticket 433, spec 430 D2/D4/D10/D11/D18).
//
// Drives the REAL app in Chromium against a STUB of the spec 430 wire contract — the door
// (`GET SdDocumentWeb/DocumentPayments`, BackOffice ask BO-3) is NOT built, so there is no live
// SIS.Api to point at. Stubbed, exactly as D2/D4 propose:
//   GET SdDocumentWeb/Access            → { canOpenList, canOpenDetail, canOpenDocumentPayments? }
//   GET SdDocumentWeb/DocumentPayments  → { rows: DocumentPaymentModel[], limited }; refusal TOO_MANY_VALUES
//   GET SdDocument/DocumentTypes        → the existing cookie-open lookup
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; i18n stays `lng: 'en'`), it asserts:
//   1. without the flag (an older server that omits it) the leaf is hidden and the URL shows the
//      denied card, with no list call;
//   2. with it, the leaf follows Donor requests, the group costs ONE probe call, and the screen
//      opens on today and limit 200 WITHOUT asking for the list (it loads on Search);
//   3. more than 1,000 numbers across both boxes is refused before the call, naming the count;
//      exactly 1,000 is allowed;
//   4. the criteria reach the wire as the WPF query names them, the number boxes as typed;
//   5. amounts are money in their own currency, and money, dates, phones and codes are isolated;
//   6. a `limited` answer says "showing the first N";
//   7. Open document always, Open delivery only with a delivery no — each lands on Document Details,
//      and Back restores the search and its result;
//   8. Export writes the result as xlsx: no actions column, amounts as numbers, identities as text,
//      no isolate characters;
//   9. a TOO_MANY_VALUES refusal is shown with its own message; no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/document-payments-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.document-payments-shots'
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
    errors: errorCode ? [{ errorCode, errorMessage: message }] : [],
    data,
  }),
})

const pad = (n) => String(n).padStart(2, '0')
const day = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
const TODAY = day(new Date())

/** A `DocumentPaymentModel` exactly as the WPF class has it, in camelCase. */
const payment = (documentNo, over) => ({
  documentNo,
  orderNo: '1100000' + documentNo.slice(-3),
  documentDate: `${TODAY}T09:41:00`,
  conditionType: 'ZCSH',
  conditionRate: 1234.5,
  conditionRateUnit: 'SAR',
  conditionTypeDescription: 'Cash on delivery',
  documentType: 'ZWEB',
  documentTypeDescription: 'Web order',
  referenceNumber: 'REF-' + documentNo.slice(-3),
  paymentMethod: 'COD',
  cardType: '',
  paymentType: 'Postpaid',
  storeCode: 'P019',
  customerPhone: '+966500000001',
  customerName: 'Huda Al-Qahtani',
  deliveryType: 'HD',
  deliveryTypeDescription: 'Home delivery',
  orderCloseStatus: '',
  orderIsActiveInStore: true,
  deliveryNo: '8000000500',
  refDocumentNo: '',
  deliveryStoreCode: 'P019',
  deliveryIsActiveInStore: true,
  deliveryReadyStatus: 'READY',
  deliveryCloseStatus: '',
  deliveryDeliveryStatus: 'Out for delivery',
  salesInvoice: '',
  returnInvoice: '',
  deliveryNote: 'Ring twice',
  ...over,
})

function rows(rtl) {
  return [
    payment('1000000101'),
    // A Bahraini line: three decimals, and no delivery — so no Open delivery.
    payment('1000000102', {
      conditionRate: 95.255,
      conditionRateUnit: 'BHD',
      storeCode: 'B003',
      paymentMethod: 'CARD',
      cardType: 'MADA',
      conditionTypeDescription: 'Card',
      deliveryNo: null,
      deliveryTypeDescription: '',
      deliveryDeliveryStatus: '',
      deliveryNote: rtl ? 'اتصل قبل الوصول' : '',
    }),
    payment('1000000103', { conditionRate: -15, deliveryNo: '8000000503' }),
  ]
}

const DOC_TYPES = [
  { documentType: 'ZWEB', description: 'Web order', documentCategory: 'O' },
  { documentType: 'ZCC', description: 'Call center order', documentCategory: 'O' },
]

const browser = await chromium.launch()

async function open(dir, { grant, list = 'rows' }) {
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const listQueries = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 4\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access')
      return route.fulfill(
        envelope(
          grant
            ? { canOpenList: true, canOpenDetail: true, canOpenDonorRequests: true, canOpenDocumentPayments: true }
            : { canOpenList: true, canOpenDetail: true, canOpenDonorRequests: true },
        ),
      )
    if (p === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'SdDocument/DocumentTypes') return route.fulfill(envelope(DOC_TYPES))
    if (p === 'SdDocumentWeb/DocumentPayments') {
      listQueries.push(url.searchParams)
      const mode = typeof list === 'function' ? list(url.searchParams) : list
      if (mode === 'tooMany')
        return route.fulfill(
          envelope(null, {
            status: 400,
            success: false,
            message: 'Too many document/order numbers: 1200. The most that can be searched at once is 1000.',
            errorCode: 'TOO_MANY_VALUES',
          }),
        )
      if (mode === 'limited') return route.fulfill(envelope({ rows: rows(rtl).slice(0, 2), limited: true }))
      return route.fulfill(envelope({ rows: rows(rtl), limited: false }))
    }
    // Document Details' own reads: not this drive's to draw — only that it was asked for.
    if (/^SdDocumentWeb\/(?:Delivery|Document)\/\d+/.test(p)) return route.fulfill(envelope(null))
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, listQueries }
}

const omsLinks = (page) =>
  page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

const waitRows = async (page, n) => {
  await page.waitForFunction((count) => document.querySelectorAll('[data-payment-list] .ag-row').length === count, n, { timeout: 20000 })
  await page.waitForTimeout(150)
}

/** One row's cells, by column id, as drawn. */
const rowOf = (page, documentNo) =>
  page.evaluate((no) => {
    const rows = [...document.querySelectorAll('[data-payment-list] .ag-row')]
    const row = rows.find((r) => r.querySelector('[col-id="documentNo"]')?.textContent === no)
    if (!row) return null
    const cell = (id) => row.querySelector(`[col-id="${id}"]`)
    const isolated = (id) => !!cell(id)?.querySelector('bdi')
    return {
      amount: cell('conditionRate')?.textContent ?? '',
      currency: cell('conditionRateUnit')?.textContent ?? '',
      entryTime: cell('documentDate')?.textContent ?? '',
      mobile: cell('customerPhone')?.textContent ?? '',
      store: cell('storeCode')?.textContent ?? '',
      offers: [...(cell('actions')?.querySelectorAll('[data-payment-open]') ?? [])].map((b) => b.getAttribute('data-payment-open')),
      isolated: ['conditionRate', 'documentDate', 'customerPhone', 'storeCode', 'documentNo'].every(isolated),
    }
  }, documentNo)

const statusText = (page) => page.locator('[data-status-count]').innerText()

/** The entries of a zip, name → text (stored or deflated). Enough of a reader for the writer's own output. */
function unzipText(buf) {
  let eocd = buf.length - 22
  while (eocd >= 0 && buf.readUInt32LE(eocd) !== 0x06054b50) eocd--
  const entries = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const out = {}
  for (let i = 0; i < entries; i++) {
    const method = buf.readUInt16LE(at + 10)
    const size = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    const dataAt = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(dataAt, dataAt + size)
    out[name] = (method === 8 ? inflateRawSync(raw) : raw).toString('utf8')
    at += 46 + nameLen + extraLen + commentLen
  }
  return out
}

/** Sheet 1's text with shared strings resolved, cells joined by | and rows by newline; numbers marked `n:`. */
function sheetText(files) {
  const shared = [...(files['xl/sharedStrings.xml'] ?? '').matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) =>
    m[1].replace(/<[^>]+>/g, ''),
  )
  const xml = files['xl/worksheets/sheet1.xml'] ?? ''
  return [...xml.matchAll(/<row[^>]*>([\s\S]*?)<\/row>/g)]
    .map((r) =>
      [...r[1].matchAll(/<c([^>]*)>([\s\S]*?)<\/c>/g)]
        .map(([, attrs, body]) => {
          const v = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? body.replace(/<[^>]+>/g, '')
          if (/t="s"/.test(attrs)) return shared[Number(v)]
          return (/t="n"|^(?![\s\S]*t=)/.test(attrs) && v !== '' ? 'n:' : '') + v
        })
        .join('|'),
    )
    .join('\n')
}

/** `n` distinct numbers, one per line — a pasted Excel column. */
const column = (n, from = 1) => Array.from({ length: n }, (_, i) => String(1_000_000 + from + i)).join('\n')

const actionOf = (page, documentNo, kind) =>
  page
    .locator('[data-payment-list] .ag-row', { has: page.locator(`[col-id="documentNo"]`, { hasText: new RegExp(`^${documentNo}$`) }) })
    .locator(`[data-payment-open="${kind}"]`)

async function drive(dir) {
  const label = dir

  // ── 1: no flag → hidden leaf, denied card, no list call ─────────────────────────────────────
  {
    const { context, page, errors, calls } = await open(dir, { grant: false })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/donor-requests"]').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    const links = await omsLinks(page)
    check(`${label}: without the flag the Document payments leaf is hidden`, !links.includes('/oms/document-payments'), links.join(' · '))
    await page.goto(`${BASE}/oms/document-payments`)
    const card = page.locator('[role="alert"]', { hasText: 'No access to document payments' })
    await card.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: the URL shows the denied card and never asks for payments`,
      (await card.count()) === 1 && !calls.includes('SdDocumentWeb/DocumentPayments'),
    )
    check(`${label}: no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–8: granted ────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, calls, listQueries } = await open(dir, {
      grant: true,
      list: (q) => (q.get('Limit') === '2' ? 'limited' : 'rows'),
    })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/document-payments"]').first().waitFor({ timeout: 20000 })
    const links = await omsLinks(page)
    check(
      `${label}: the leaf follows Donor requests`,
      links.indexOf('/oms/document-payments') > links.indexOf('/oms/donor-requests') && links.indexOf('/oms/donor-requests') >= 0,
      links.join(' · '),
    )
    await page.locator('nav a[href="/oms/document-payments"]').first().click()
    await page.locator('[data-payment-filters]').waitFor({ timeout: 20000 })
    await page.waitForFunction(() => document.querySelectorAll('[data-payment-filter="documentType"] option').length === 3, null, { timeout: 10000 })
    await page.waitForTimeout(300)
    check(
      `${label}: the OMS group and the page gate cost ONE probe call`,
      calls.filter((c) => c === 'SdDocumentWeb/Access').length === 1,
      String(calls.filter((c) => c === 'SdDocumentWeb/Access').length),
    )
    const from = await page.locator('[data-payment-filter="from"]').inputValue()
    const to = await page.locator('[data-payment-filter="to"]').inputValue()
    const limit = await page.locator('[data-payment-filter="limit"]').inputValue()
    check(`${label}: opens on today and limit 200`, from === TODAY && to === TODAY && limit === '200', `${from} ${to} ${limit}`)
    check(
      `${label}: nothing is asked for until Search`,
      listQueries.length === 0 && (await page.locator('[data-payment-not-searched]').count()) === 1,
    )
    check(`${label}: dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

    // 3: the guard
    await page.locator('[data-payment-filter="documentNos"]').fill(column(600))
    await page.locator('[data-payment-filter="orderNos"]').fill(column(401, 5000).replaceAll('\n', ', '))
    const alert = page.locator('[data-payment-problem="tooMany"]')
    await alert.waitFor({ timeout: 5000 })
    const said = await alert.innerText()
    check(
      `${label}: 1,001 numbers across both boxes are refused, naming the count`,
      /1,001/.test(said) && /1,000/.test(said) && (await alert.locator('bdi[dir="ltr"]').count()) === 2,
      said,
    )
    check(`${label}: the guard disables Search`, await page.locator('[data-payment-search]').isDisabled())
    await page.locator('[data-payment-search]').click({ force: true })
    await page.waitForTimeout(200)
    check(`${label}: the refused paste never reaches the server`, listQueries.length === 0)
    await page.screenshot({ path: `${SHOTS}/${dir}-guard.png` })

    // 4: exactly 1,000 is fine, and the criteria reach the wire
    const docs = column(600)
    const orders = column(400, 5000).replaceAll('\n', ', ')
    await page.locator('[data-payment-filter="orderNos"]').fill(orders)
    check(`${label}: exactly 1,000 numbers are allowed`, (await alert.count()) === 0 && !(await page.locator('[data-payment-search]').isDisabled()))
    await page.locator('[data-payment-filter="storeCode"]').fill(' P019 ')
    await page.locator('[data-payment-filter="customerPhone"]').fill('+966500000001')
    await page.locator('[data-payment-filter="documentType"]').selectOption('ZWEB')
    await page.locator('[data-payment-search]').click()
    await waitRows(page, 3)
    const q = listQueries.at(-1)
    check(
      `${label}: the criteria reach the wire as the WPF query names them, the numbers as typed`,
      q?.get('FromDate') === TODAY &&
        q.get('ToDate') === TODAY &&
        q.get('Limit') === '200' &&
        q.get('StoreCode') === 'P019' &&
        q.get('CustomerPhone') === '+966500000001' &&
        q.get('DocumentType') === 'ZWEB' &&
        q.get('DocumentNo') === docs &&
        q.get('OrderNo') === orders,
      [...(q?.keys() ?? [])].join(','),
    )

    // 5: money, dates, isolation
    const r1 = await rowOf(page, '1000000101')
    const r2 = await rowOf(page, '1000000102')
    const r3 = await rowOf(page, '1000000103')
    check(`${label}: a SAR amount is money at two decimals`, r1?.amount === '1,234.50' && r1.currency === 'SAR', JSON.stringify(r1))
    check(`${label}: a BHD amount is money at three decimals`, r2?.amount === '95.255' && r2.currency === 'BHD', JSON.stringify(r2))
    check(`${label}: a negative amount keeps its sign`, r3?.amount === '-15.00', r3?.amount)
    check(`${label}: the entry time is the document's day and time`, r1?.entryTime === `${TODAY} 09:41`, r1?.entryTime)
    check(
      `${label}: money, dates, phones, stores and numbers are isolated`,
      [r1, r2, r3].every((r) => r?.isolated) && r1.mobile === '+966500000001',
      JSON.stringify(r1),
    )
    const count = await statusText(page)
    check(`${label}: the status bar counts the lines`, /^3 payment lines$/.test(count.trim()), count)
    await page.screenshot({ path: `${SHOTS}/${dir}-result.png` })

    // 7a: the offers
    check(`${label}: a row with a delivery offers both`, r1?.offers.join(',') === 'document,delivery', r1?.offers.join(','))
    check(`${label}: a row without a delivery offers only its document`, r2?.offers.join(',') === 'document', r2?.offers.join(','))

    // 8: export
    const [dl] = await Promise.all([page.waitForEvent('download'), page.locator('[data-payment-export]').click()])
    const name = dl.suggestedFilename()
    const sheet = sheetText(unzipText(readFileSync(await dl.path())))
    const lines = sheet.split('\n')
    check(`${label}: Export downloads an xlsx`, /^document-payments-\d{8}-\d{4}\.xlsx$/.test(name), name)
    check(
      `${label}: the workbook is the result — a header and its three lines, no actions column`,
      lines.length === 4 &&
        lines[0].startsWith('Document no|Order no|Doc. type|Payment|Payment type|Method|Card type|Amount|Currency') &&
        lines[0].endsWith('|Delivery status') &&
        !/\|Open$/.test(lines[0]),
      lines[0],
    )
    check(
      `${label}: amounts are numbers, identities and phones are text, no isolate characters`,
      lines.some((l) => l.startsWith('1000000101|1100000101|') && l.includes('|n:1234.5|SAR|') && l.includes('|+966500000001|')) &&
        !/\|n:1000000/.test(sheet) &&
        !/[⁦-⁩]/.test(sheet),
      lines[1],
    )

    // 7b: open document and delivery
    const detailsReads = () => calls.filter((c) => /^SdDocumentWeb\/(Delivery|Document)\/\d+/.test(c))
    await actionOf(page, '1000000102', 'document').click()
    await page.waitForURL('**/oms/document/1000000102', { timeout: 10000 })
    await page.waitForTimeout(400)
    check(`${label}: Open document lands on the document in Document Details`, detailsReads().some((c) => c.includes('1000000102')), detailsReads().join(','))
    await page.goBack()
    await waitRows(page, 3)
    check(
      `${label}: Back from Document Details restores the search and its result`,
      (await page.locator('[data-payment-filter="documentNos"]').inputValue()) === docs &&
        (await page.locator('[data-payment-filter="storeCode"]').inputValue()) === ' P019 ',
    )
    await actionOf(page, '1000000103', 'delivery').click()
    await page.waitForURL('**/oms/delivery/8000000503', { timeout: 10000 })
    await page.waitForTimeout(400)
    check(`${label}: Open delivery lands on the delivery in Document Details`, detailsReads().some((c) => c.includes('8000000503')), detailsReads().join(','))
    await page.goBack()
    await waitRows(page, 3)

    // 6: limited
    await page.locator('[data-payment-filter="limit"]').fill('2')
    await page.locator('[data-payment-search]').click()
    await waitRows(page, 2)
    const limited = await statusText(page)
    check(
      `${label}: a limited answer says "showing the first N"`,
      /Showing the first 2 payment lines/.test(limited) && (await page.locator('[data-status-count][data-limited]').count()) === 1,
      limited,
    )
    // Reset goes back to the landing criteria AND drops the result, so the two never disagree.
    await page.getByRole('button', { name: 'Reset' }).click()
    await waitRows(page, 0)
    check(
      `${label}: Reset restores today and limit 200 and clears the result`,
      (await page.locator('[data-payment-filter="limit"]').inputValue()) === '200' &&
        (await page.locator('[data-payment-filter="documentNos"]').inputValue()) === '' &&
        (await page.locator('[data-payment-not-searched]').count()) === 1,
    )
    check(`${label}: no page errors (granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 9: TOO_MANY_VALUES from the door ───────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { grant: true, list: 'tooMany' })
    await page.goto(`${BASE}/oms/document-payments`)
    await page.locator('[data-payment-search]').click()
    const banner = page.locator('[role="alert"]', { hasText: 'The most that can be searched at once is 1000.' })
    await banner.waitFor({ timeout: 20000 })
    check(
      `${label}: a TOO_MANY_VALUES refusal is shown with its own message`,
      (await banner.count()) === 1 && /Too many numbers/.test(await banner.innerText()),
      await banner.innerText(),
    )
    check(
      `${label}: and no "0 payment lines" contradicts it`,
      (await page.locator('[data-status-count]').count()) === 0 && !/No payment matches/.test(await page.locator('[data-payment-list]').innerText()),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-refused.png` })
    check(`${label}: no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
