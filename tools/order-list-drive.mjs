// Order / ERX list drive (ticket 786, BackOffice spec 3389; door 3391 `GET SdDocumentWeb/OrderDocumentList`,
// STUBBED — not built yet; the stub answers in the contract's shape, `src/core/models/order-document.ts`).
//
// Drives the REAL app in Chromium, LTR and RTL (`oms.locale = 'ar'`), and asserts:
//   1. the list opens on the last 3 days; Search sends FromDate/ToDate and Limit=500;
//   2. an Approval token sends no date (the identifier ignores it) and finds 1006358459; the Date
//      token reads "ignored" meanwhile;
//   3. a 32-day Custom range with no identifier is refused before any request is sent;
//   4. the lenses count the loaded rows: Bupa Care Connect / No delivery yet / Channel / Engine;
//      a lens narrows the grid;
//   5. without the insurance-view grant there is no Patient ID / Member ID column, token or
//      inspector line; with it they show;
//   6. a row opens Document details (`/oms/document/:documentNo`) on Enter;
//   7. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/order-list-drive.mjs   (DRIVE_PORT=<port> for another port)
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.order-list-shots'
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

const row = (documentNo, over = {}) => ({
  orderNo: `ORD-${documentNo}`,
  documentNo,
  documentCategory: 'O',
  documentType: 'CLCN',
  documentTypeDescription: 'Call centre order',
  documentSource: 'CC',
  documentSourceDescription: 'Call centre',
  storeCode: '1101',
  customerName: 'Sara Ahmed',
  customerPhone: '0551234567',
  entryTime: '2026-11-04T10:15:00',
  status: 'OPEN',
  statusDescription: 'Open',
  closeStatus: '',
  netTotal: 120.5,
  amountDue: 120.5,
  currency: 'SAR',
  deliveryNo: '9000001',
  isInsuranceOrder: false,
  moneySource: null,
  patientTotal: null,
  insurerTotal: null,
  ...over,
})

/** The door's rows. The health identifiers ride only with the grant, as 3391 says the server does. */
const rows = (grant, rtl) => {
  const ids = (p, m) => (grant ? { patientId: p, memberId: m } : {})
  return [
    row('1006358459', {
      orderNo: 'BUPA-20261104-77',
      documentCategory: 'X',
      documentType: 'BUPA',
      documentTypeDescription: 'Bupa Care Connect',
      documentSource: 'ERX',
      documentSourceDescription: 'ERX',
      customerName: rtl ? 'سارة أحمد' : 'Sara Ahmed',
      deliveryNo: null,
      isInsuranceOrder: true,
      moneySource: 'ENGINE',
      patientTotal: 12.5,
      insurerTotal: 87.5,
      guardState: 'actionNeeded',
      ...ids('2402727917', '30112233'),
    }),
    row('1006358460', { documentType: 'BUPA', documentSource: 'CC', isInsuranceOrder: true, moneySource: 'CHANNEL', patientTotal: 5, insurerTotal: 45, ...ids('1000000001', '30000001') }),
    row('1006358461', { documentSource: 'ERX', documentCategory: 'X' }),
    row('1006358462'),
  ]
}

const browser = await chromium.launch()

async function drive(dir, grant) {
  const rtl = dir === 'rtl'
  const label = `${dir}${grant ? ' + grant' : ' no grant'}`
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (400|404)|net::ERR_FAILED/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.removeItem('oms.orders.inspector.v1')
  }, rtl ? 'ar' : 'en')

  const searches = []
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true, canViewInsurance: grant }))
    if (p === 'SdDocument/DocumentTypes') return route.fulfill(envelope([{ documentType: 'BUPA', description: 'Bupa Care Connect', documentCategory: 'X' }]))
    if (p === 'SdDocument/DocumentSources') return route.fulfill(envelope([{ documentSource: 'ERX', description: 'ERX', documentSourceCategory: '' }]))
    if (p === 'SdDocumentWeb/OrderDocumentList') {
      const params = Object.fromEntries(url.searchParams)
      searches.push(params)
      const all = rows(grant, rtl)
      if (params.Approval) return route.fulfill(envelope(all.filter((r) => r.documentNo === '1006358459')))
      return route.fulfill(envelope(all))
    }
    return route.fulfill(envelope(p.startsWith('SdDocumentWeb/Document/') ? null : []))
  })

  await page.goto(`${BASE}/oms/orders`)
  await page.locator('[data-orders-page]').waitFor({ timeout: 20000 })
  const htmlDir = await page.evaluate(() => document.documentElement.dir || 'ltr')
  check(`${label}: the page runs ${rtl ? 'right-to-left' : 'left-to-right'}`, htmlDir === dir, htmlDir)

  // 1. opens on the last 3 days; Search sends the range and Limit 500.
  const dateToken = page.locator('[data-query-token="date"] [data-token-value]')
  check(`${label}: the Date token opens on the last 3 days`, (await dateToken.textContent())?.trim() === 'Last 3 days')
  await page.locator('[data-query-search]').click()
  await page.locator('.ag-row').first().waitFor({ timeout: 10000 })
  const first = searches.at(-1) ?? {}
  check(`${label}: a broad search sends a 3-day range and Limit 500`, !!first.FromDate && !!first.ToDate && first.Limit === '500', JSON.stringify(first))

  // 4. lenses.
  const count = async (lens) => (await page.locator(`[data-lens="${lens}"] [data-lens-count]`).textContent())?.trim()
  const counts = { all: await count('all'), bupa: await count('bupaCareConnect'), none: await count('noDelivery'), ch: await count('channel'), en: await count('engine') }
  check(`${label}: lens counts All 4 · Bupa 1 · No delivery 1 · Channel 1 · Engine 1`,
    counts.all === '4' && counts.bupa === '1' && counts.none === '1' && counts.ch === '1' && counts.en === '1', JSON.stringify(counts))
  await page.locator('[data-lens="bupaCareConnect"]').click()
  await page.waitForTimeout(200)
  const shown = await page.locator('.ag-row [col-id="orderNo"]').count()
  check(`${label}: the Bupa Care Connect lens narrows the grid to its one row`, shown === 1, String(shown))
  await page.locator('[data-lens="all"]').click()

  // 5. the health identifiers.
  // Columns are virtualised, so read the column chooser rather than the rendered headers.
  await page.locator('[data-toolbar-columns]').click()
  const headers = await page.locator('[data-columns-chooser] label').allTextContents()
  await page.keyboard.press('Escape')
  const hasIds = headers.includes('Patient ID') && headers.includes('Member ID')
  check(`${label}: Patient ID / Member ID columns ${grant ? 'shown' : 'absent'}`, hasIds === grant, headers.join('|'))
  await page.locator('[data-query-add]').click()
  const offersPatient = (await page.locator('[data-query-entry="patientId"]').count()) > 0
  check(`${label}: the Patient ID criterion ${grant ? 'is' : 'is not'} offered`, offersPatient === grant)
  await page.keyboard.press('Escape')

  // Select the Bupa row: the inspector shows its insurance lines.
  await page.locator('.ag-row [col-id="orderNo"]').first().click()
  await page.locator('[data-inspector-body]').waitFor({ timeout: 5000 })
  const insp = await page.locator('[data-inspector-body]').evaluate((b) => ({
    insurance: !!b.querySelector('[data-section="insurance"]'),
    patientId: !!b.querySelector('[data-field="patientId"]'),
    noDelivery: b.querySelector('[data-field="delivery"] dd')?.textContent?.trim(),
  }))
  check(`${label}: the inspector shows the order's insurance, IDs ${grant ? 'with' : 'without'} the grant`,
    insp.insurance && insp.patientId === grant && insp.noDelivery === 'No delivery yet', JSON.stringify(insp))
  await page.screenshot({ path: `${SHOTS}/${dir}-${grant ? 'grant' : 'nogrant'}.png` })

  // 3. a 32-day Custom range, no identifier: refused, nothing sent.
  await page.locator('[data-query-token="date"] button').first().click()
  await page.locator('[data-token-popover="date"] select').selectOption('custom')
  await page.locator('[data-date-end="from"]').fill('2026-10-01')
  await page.locator('[data-date-end="to"]').fill('2026-11-01')
  const before = searches.length
  await page.locator('[data-token-popover="date"] [data-token-done]').click()
  await page.locator('[data-query-search]').click()
  await page.waitForTimeout(400)
  const refusal = await page.locator('[data-sonner-toast]').allTextContents()
  check(`${label}: a 32-day range is refused before the door is called`,
    searches.length === before && refusal.some((s) => s.includes('at most 31 days')), refusal.join(' / '))

  // 2. approval finds 1006358459 and sends no date.
  await page.locator('[data-query-add]').click()
  await page.locator('[data-query-entry="approval"]').click()
  await page.locator('[data-token-popover="approval"] input').fill('146591214')
  await page.keyboard.press('Enter')
  await page.waitForTimeout(500)
  const bySearch = searches.at(-1) ?? {}
  check(`${label}: an approval search sends no date`, bySearch.Approval === '146591214' && !('FromDate' in bySearch) && !('ToDate' in bySearch), JSON.stringify(bySearch))
  check(`${label}: the Date token reads ignored`, (await page.locator('[data-token-ignored]').count()) === 1)
  const docs = await page.locator('.ag-row [col-id="documentNo"]').allTextContents()
  check(`${label}: the approval finds 1006358459 alone`, docs.length === 1 && docs[0].includes('1006358459'), docs.join('|'))

  // 6. Enter opens Document details.
  await page.locator('.ag-row [col-id="documentNo"]').first().click()
  await page.keyboard.press('Enter')
  await page.waitForURL(/\/oms\/document\/1006358459$/, { timeout: 5000 }).catch(() => {})
  check(`${label}: Enter opens Document details`, page.url().endsWith('/oms/document/1006358459'), page.url())

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

for (const dir of ['ltr', 'rtl']) for (const grant of [true, false]) await drive(dir, grant)
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
