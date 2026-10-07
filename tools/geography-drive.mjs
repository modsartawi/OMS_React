// Cities & districts drive (ticket 436, spec 430 D2/D6/D13/D15/D16/D18).
//
// Drives the REAL app in Chromium against a STUB of the spec 430 wire contract — the doors
// (`GET SdDocumentWeb/Cities` and `GET SdDocumentWeb/Districts?cityCode=`, BackOffice ask BO-5) are
// NOT built, so there is no live SIS.Api to point at. Never point this at a live SIS.Api.
// Stubbed, exactly as D2/D6 propose:
//   GET SdDocumentWeb/Access              → { canOpenList, canOpenDetail, canOpenGeography? }
//   GET SdDocumentWeb/Cities              → SdCityModel[]
//   GET SdDocumentWeb/Districts?cityCode= → SdDistrictModel[]
// In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"), it asserts:
//   1. without the flag (an older server that omits it) the leaf is hidden and the URL shows the
//      denied card, with no cities call; an import flag alone does not show it;
//   2. with it, the leaf follows Document payments (D18), the group costs ONE probe call, the
//      cities load on open, once, and no district is asked for before a city is selected;
//   3. the city columns: code, English then Arabic name, the last change (update, else creation;
//      an unset time blank), every value isolated;
//   4. selecting a city loads ITS districts (`cityCode=`), titled with the city isolated whole;
//      the district columns: names, Magento cities, the three stores, latitude/longitude, last
//      change; another city loads its own;
//   5. each grid's text filter narrows it alone, by code, English or Arabic name; the status bar
//      says how many are shown; a filter matching nothing says so;
//      another city starts with an empty districts filter;
//   6. each grid exports xlsx as shown: its own file name, the filtered rows, codes as text,
//      coordinates as numbers, no isolates;
//   7. a refused cities load and a failed districts load are shown with their own message;
//   8. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/geography-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.geography-shots'
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

const UNSET = '0001-01-01T00:00:00'

/** An `SdCityModel` exactly as WPF's class has it, in camelCase. */
const city = (cityCode, cityNameEn, cityNameAr, over = {}) => ({
  cityCode,
  cityNameAr,
  cityNameEn,
  createdOn: '2024-01-02T08:00:00',
  createdBy: 'seed',
  updatedOn: UNSET,
  updatedBy: '',
  ...over,
})

const CITIES = [
  city('RUH', 'Riyadh', 'الرياض', { updatedOn: '2026-09-01T10:30:00', updatedBy: 'hq.lead' }),
  city('JED', 'Jeddah', 'جدة'),
  city('DMM', 'Dammam', 'الدمام', { createdOn: UNSET, createdBy: '' }),
]

/** An `SdDistrictModel` exactly as WPF's class has it, in camelCase. */
const district = (districtCode, cityCode, en, ar, over = {}) => ({
  districtCode,
  cityCode,
  cityNameAr: '',
  cityNameEn: '',
  magentoCityEn: cityCode === 'RUH' ? 'Riyadh' : 'Jeddah',
  magentoCityAr: cityCode === 'RUH' ? 'الرياض' : 'جدة',
  districtNameAr: ar,
  districtNameEn: en,
  storeCode: 'P001',
  insuranceStoreCode: 'P050',
  tempStoreCode: '',
  createdOn: '2024-01-02T08:00:00',
  createdBy: 'seed',
  updatedOn: '2026-08-15T14:05:00',
  updatedBy: 'store.config',
  latitude: 24.7136,
  longitude: 46.6753,
  ...over,
})

const DISTRICTS = {
  RUH: [
    district('RUH-01', 'RUH', 'Al Olaya', 'العليا'),
    district('RUH-02', 'RUH', 'Al Malqa', 'الملقا', { storeCode: 'P019', tempStoreCode: 'P020', latitude: 24.8121, longitude: 46.6118 }),
    district('RUH-03', 'RUH', 'An Nakheel', 'النخيل', { storeCode: 'P002', updatedOn: UNSET, updatedBy: '' }),
  ],
  JED: [district('JED-01', 'JED', 'Al Hamra', 'الحمراء', { storeCode: 'P101', insuranceStoreCode: 'P150', latitude: 21.5169, longitude: -39.1748 })],
}

const browser = await chromium.launch()

async function open(dir, { grant, importOnly = false, cities = () => 'rows', districts = () => 'rows' }) {
  const context = await browser.newContext({ viewport: { width: 1800, height: 1100 }, acceptDownloads: true })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const districtAsks = []
  let cityCalls = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    // A stubbed 4xx/5xx is the drive's own doing.
    (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()),
  )
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.split('/api/')[1]
    calls.push(p)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') {
      const flags = { canOpenList: true, canOpenDetail: true, canOpenDocumentPayments: true }
      if (grant) flags.canOpenGeography = true
      if (importOnly) Object.assign(flags, { canImportCities: true, canImportDistricts: true })
      return route.fulfill(envelope(flags))
    }
    if (p === 'Sd/CentralInvoice/Access') return route.fulfill(envelope({ canOpen: true }))
    if (p === 'SdDocumentWeb/Cities') {
      cityCalls++
      if (cities(cityCalls) === 'refused')
        return route.fulfill(envelope(null, { status: 403, success: false, message: 'You do not hold SdCityInquiry (03).', errorCode: 'FORBIDDEN' }))
      return route.fulfill(envelope(CITIES))
    }
    if (p === 'SdDocumentWeb/Districts') {
      const code = url.searchParams.get('cityCode')
      districtAsks.push(code)
      if (districts(code) === 'down') return route.fulfill({ status: 500, contentType: 'text/plain', body: 'boom' })
      return route.fulfill(envelope(DISTRICTS[code] ?? []))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, districtAsks, cityCount: () => cityCalls }
}

const omsLinks = (page) =>
  page.locator('nav a[href^="/oms/"]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('href')))])

const pane = (page, kind) => page.locator(`[data-geo-pane="${kind}"]`)

const waitRows = async (page, kind, n) => {
  await page.waitForFunction(
    ([k, count]) => document.querySelectorAll(`[data-geo-pane="${k}"] .ag-row`).length === count,
    [kind, n],
    { timeout: 20000 },
  )
  await page.waitForTimeout(150)
}

/** The first column's values of the rows drawn, in order. */
const drawn = (page, kind, colId) =>
  page.evaluate(
    ([k, id]) =>
      [...document.querySelectorAll(`[data-geo-pane="${k}"] .ag-row`)]
        .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
        .map((r) => r.querySelector(`[col-id="${id}"]`)?.textContent ?? ''),
    [kind, colId],
  )

/** One row's cells, by column id, as drawn, and whether every one is isolated. */
const rowOf = (page, kind, keyCol, key) =>
  page.evaluate(
    ([k, keyId, no]) => {
      const rows = [...document.querySelectorAll(`[data-geo-pane="${k}"] .ag-row`)]
      const row = rows.find((r) => r.querySelector(`[col-id="${keyId}"]`)?.textContent === no)
      if (!row) return null
      const out = {}
      let isolated = true
      for (const cell of row.querySelectorAll('[col-id]')) {
        out[cell.getAttribute('col-id')] = cell.textContent ?? ''
        if (cell.textContent && !cell.querySelector('bdi')) isolated = false
      }
      out.isolated = isolated
      return out
    },
    [kind, keyCol, key],
  )

const statusOf = (page, kind) => pane(page, kind).locator('[data-status-count]').innerText()

async function selectCity(page, code) {
  await pane(page, 'cities').locator('.ag-row', { has: page.locator('[col-id="cityCode"]', { hasText: new RegExp(`^${code}$`) }) }).locator('[col-id="cityNameEn"]').click()
}

/** Click a pane's Export and read the workbook it downloads. */
async function exportOf(page, kind) {
  const [dl] = await Promise.all([page.waitForEvent('download'), pane(page, kind).locator('[data-geo-export]').click()])
  return { name: dl.suggestedFilename(), sheet: sheetText(unzipText(readFileSync(await dl.path()))) }
}

async function drive(dir) {
  const label = dir

  // ── 1: no flag → hidden leaf, denied card, no cities call ──────────────────────────────────
  {
    const { context, page, errors, calls } = await open(dir, { grant: false, importOnly: true })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/document-payments"]').first().waitFor({ timeout: 20000 })
    await page.waitForTimeout(400)
    const links = await omsLinks(page)
    check(`${label}: without the flag (import flags alone) the Cities & districts leaf is hidden`, !links.includes('/oms/geography'), links.join(' · '))
    await page.goto(`${BASE}/oms/geography`)
    const card = page.locator('[role="alert"]', { hasText: 'No access to cities and districts' })
    await card.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: the URL shows the denied card and never asks for cities or districts`,
      (await card.count()) === 1 && !calls.some((c) => /^SdDocumentWeb\/(Cities|Districts)/.test(c)),
    )
    check(`${label}: no page errors (denied)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 2–6: granted ───────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, calls, districtAsks, cityCount } = await open(dir, { grant: true })
    await page.goto(`${BASE}/oms/deliveries`)
    await page.locator('nav a[href="/oms/geography"]').first().waitFor({ timeout: 20000 })
    const links = await omsLinks(page)
    check(
      `${label}: the leaf follows Document payments (D18)`,
      links.indexOf('/oms/geography') === links.indexOf('/oms/document-payments') + 1,
      links.join(' · '),
    )
    check(`${label}: the cities are not read before the screen opens`, cityCount() === 0)
    await page.locator('nav a[href="/oms/geography"]').first().click()
    await waitRows(page, 'cities', 3)
    check(`${label}: the cities load on open, once`, cityCount() === 1, String(cityCount()))
    check(
      `${label}: the OMS group and the page gate cost ONE probe call`,
      calls.filter((c) => c === 'SdDocumentWeb/Access').length === 1,
      String(calls.filter((c) => c === 'SdDocumentWeb/Access').length),
    )
    check(`${label}: dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(
      `${label}: no district is asked for before a city is selected; the lower pane says to select one`,
      districtAsks.length === 0 && (await pane(page, 'districts').locator('[data-geo-placeholder]').innerText()).includes('Select a city above'),
    )

    // 3: city columns
    const ruh = await rowOf(page, 'cities', 'cityCode', 'RUH')
    const jed = await rowOf(page, 'cities', 'cityCode', 'JED')
    const dmm = await rowOf(page, 'cities', 'cityCode', 'DMM')
    const headers = await pane(page, 'cities').locator('.ag-header-cell').evaluateAll((els) => els.map((e) => e.getAttribute('col-id')))
    check(
      `${label}: the city columns are code, English name, Arabic name, last change (WPF's order)`,
      headers.join(',') === 'cityCode,cityNameEn,cityNameAr,changedBy,changedOn',
      headers.join(','),
    )
    check(
      `${label}: a city shows its names whole, every value isolated`,
      ruh?.cityNameEn === 'Riyadh' && ruh.cityNameAr === 'الرياض' && ruh.isolated && jed?.isolated,
      JSON.stringify(ruh),
    )
    check(
      `${label}: the last change is the update when there was one, else the creation; none is blank`,
      ruh?.changedBy === 'hq.lead' && ruh.changedOn === '2026-09-01 10:30' && jed?.changedBy === 'seed' && jed.changedOn === '2024-01-02 08:00' &&
        dmm?.changedBy === '' && dmm.changedOn === '',
      `${ruh?.changedBy} ${ruh?.changedOn} / ${jed?.changedBy} ${jed?.changedOn} / "${dmm?.changedOn}"`,
    )
    check(`${label}: the cities status bar counts them`, (await statusOf(page, 'cities')).trim() === '3 cities', await statusOf(page, 'cities'))
    await page.screenshot({ path: `${SHOTS}/${dir}-cities.png` })

    // 4: select → districts
    await selectCity(page, 'RUH')
    await waitRows(page, 'districts', 3)
    check(`${label}: selecting a city asks for ITS districts, by code`, districtAsks.join(',') === 'RUH', districtAsks.join(','))
    const title = pane(page, 'districts').locator('[data-geo-title]')
    check(
      `${label}: the districts are titled with the city, isolated whole`,
      (await title.innerText()).trim() === 'Districts of RUH · Riyadh' && (await title.locator('bdi[dir="ltr"]').innerText()) === 'RUH · Riyadh',
      await title.innerText(),
    )
    const dHeaders = await pane(page, 'districts').locator('.ag-header-cell').evaluateAll((els) => els.map((e) => e.getAttribute('col-id')))
    check(
      `${label}: the district columns: code, names, Magento cities, the three stores, latitude/longitude, last change`,
      dHeaders.join(',') ===
        'districtCode,districtNameEn,districtNameAr,magentoCityEn,magentoCityAr,storeCode,insuranceStoreCode,tempStoreCode,latitude,longitude,changedBy,changedOn',
      dHeaders.join(','),
    )
    const malqa = await rowOf(page, 'districts', 'districtCode', 'RUH-02')
    const nakheel = await rowOf(page, 'districts', 'districtCode', 'RUH-03')
    check(
      `${label}: a district shows its stores, its coordinates and its names, every value isolated`,
      malqa?.districtNameAr === 'الملقا' && malqa.magentoCityAr === 'الرياض' && malqa.storeCode === 'P019' && malqa.insuranceStoreCode === 'P050' &&
        malqa.tempStoreCode === 'P020' && malqa.latitude === '24.8121' && malqa.longitude === '46.6118' && malqa.isolated,
      JSON.stringify(malqa),
    )
    check(
      `${label}: a district's last change falls back to its creation`,
      nakheel?.changedBy === 'seed' && nakheel.changedOn === '2024-01-02 08:00' && malqa?.changedBy === 'store.config',
      `${nakheel?.changedBy} ${nakheel?.changedOn}`,
    )
    check(`${label}: the districts status bar counts them`, (await statusOf(page, 'districts')).trim() === '3 districts', await statusOf(page, 'districts'))
    await page.screenshot({ path: `${SHOTS}/${dir}-districts.png` })

    await selectCity(page, 'JED')
    await waitRows(page, 'districts', 1)
    const hamra = await rowOf(page, 'districts', 'districtCode', 'JED-01')
    check(
      `${label}: another city loads its own districts; a negative coordinate reads whole`,
      districtAsks.at(-1) === 'JED' && hamra?.storeCode === 'P101' && hamra.longitude === '-39.1748' && hamra.isolated &&
        (await title.innerText()).trim() === 'Districts of JED · Jeddah',
      `${districtAsks.join(',')} ${hamra?.longitude}`,
    )
    await selectCity(page, 'DMM')
    await page.locator('[data-geo-pane="districts"] [data-geo-empty]').waitFor({ timeout: 10000 })
    check(
      `${label}: a city with no districts says so`,
      (await pane(page, 'districts').locator('[data-geo-empty]').innerText()).includes('This city has no districts'),
    )
    await selectCity(page, 'RUH')
    await waitRows(page, 'districts', 3)

    // 5: quick filters
    const cityFilter = pane(page, 'cities').locator('[data-geo-filter]')
    const districtFilter = pane(page, 'districts').locator('[data-geo-filter]')
    await cityFilter.fill('jed')
    await waitRows(page, 'cities', 1)
    check(`${label}: the city filter matches a code or an English name, any case`, (await drawn(page, 'cities', 'cityCode')).join(',') === 'JED')
    check(`${label}: the city status bar says how many are shown`, (await statusOf(page, 'cities')).trim() === '1 / 3 cities shown', await statusOf(page, 'cities'))
    check(`${label}: the city filter leaves the districts alone`, (await drawn(page, 'districts', 'districtCode')).length === 3)
    await cityFilter.fill('الدمام')
    await waitRows(page, 'cities', 1)
    check(`${label}: the city filter matches an Arabic name`, (await drawn(page, 'cities', 'cityCode')).join(',') === 'DMM')
    await cityFilter.fill('')
    await waitRows(page, 'cities', 3)
    await districtFilter.fill('p019')
    await waitRows(page, 'districts', 1)
    check(`${label}: the district filter matches a store`, (await drawn(page, 'districts', 'districtCode')).join(',') === 'RUH-02')
    await districtFilter.fill('النخيل')
    await waitRows(page, 'districts', 1)
    check(`${label}: the district filter matches an Arabic name`, (await drawn(page, 'districts', 'districtCode')).join(',') === 'RUH-03')
    await districtFilter.fill('nowhere')
    await waitRows(page, 'districts', 0)
    await pane(page, 'districts').locator('[data-geo-empty]').waitFor({ timeout: 5000 })
    check(
      `${label}: a filter matching nothing says so, not "no districts"`,
      (await pane(page, 'districts').locator('[data-geo-empty]').innerText()).includes('Nothing matches this filter') &&
        (await pane(page, 'districts').locator('[data-geo-export]').isDisabled()),
    )
    await districtFilter.fill('olaya')
    await waitRows(page, 'districts', 1)
    await page.screenshot({ path: `${SHOTS}/${dir}-filtered.png` })

    // 6: export, as shown
    const cx = await exportOf(page, 'cities')
    const cLines = cx.sheet.split('\n')
    check(`${label}: cities export to their own xlsx`, /^cities-\d{8}-\d{4}\.xlsx$/.test(cx.name), cx.name)
    check(
      `${label}: the cities sheet: the header, then every city as drawn, no isolates`,
      cLines[0] === 'City code|English name|Arabic name|Last changed by|Last changed on' &&
        cLines.length === 4 &&
        cLines.includes('RUH|Riyadh|الرياض|hq.lead|2026-09-01 10:30') &&
        !/[\u2066-\u2069]/.test(cx.sheet),
      cLines.join(' ¶ '),
    )
    const dx = await exportOf(page, 'districts')
    const dLines = dx.sheet.split('\n')
    check(`${label}: districts export to their own xlsx`, /^districts-\d{8}-\d{4}\.xlsx$/.test(dx.name), dx.name)
    check(
      `${label}: the districts sheet holds the filtered rows only, codes as text and coordinates as numbers`,
      // The blank temporary store is a cell the writer leaves out, so the reader joins past it.
      dLines.length === 2 &&
        dLines[1] === 'RUH-01|Al Olaya|العليا|Riyadh|الرياض|P001|P050|n:24.7136|n:46.6753|store.config|2026-08-15 14:05' &&
        !/[\u2066-\u2069]/.test(dx.sheet),
      dLines.join(' ¶ '),
    )
    // Another city is another list: the districts filter ('olaya' above) does not carry over.
    await selectCity(page, 'JED')
    await waitRows(page, 'districts', 1)
    check(
      `${label}: selecting another city clears the districts filter`,
      (await districtFilter.inputValue()) === '' && (await statusOf(page, 'districts')).trim() === '1 district',
      `"${await districtFilter.inputValue()}" ${await statusOf(page, 'districts')}`,
    )
    check(`${label}: no page errors (granted)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: refusals ────────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir, { grant: true, cities: () => 'refused' })
    await page.goto(`${BASE}/oms/geography`)
    const banner = pane(page, 'cities').locator('[role="alert"]', { hasText: 'You do not hold SdCityInquiry (03).' })
    await banner.waitFor({ timeout: 20000 })
    await page.waitForTimeout(300)
    check(
      `${label}: a refused cities load is shown with its own message, and no count contradicts it`,
      /The cities could not be loaded/.test(await banner.innerText()) && (await pane(page, 'cities').locator('[data-status-count]').count()) === 0,
      await banner.innerText(),
    )
    await page.screenshot({ path: `${SHOTS}/${dir}-refused.png` })
    check(`${label}: no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { grant: true, districts: (code) => (code === 'JED' ? 'down' : 'rows') })
    await page.goto(`${BASE}/oms/geography`)
    await waitRows(page, 'cities', 3)
    await selectCity(page, 'JED')
    const banner = pane(page, 'districts').locator('[role="alert"]', { hasText: 'The districts could not be loaded' })
    await banner.waitFor({ timeout: 20000 })
    check(`${label}: a failed districts load is said in the districts pane`, (await banner.count()) === 1, await banner.innerText())
    check(`${label}: no page errors (districts down)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

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

await drive('ltr')
await drive('rtl')
await browser.close()

const failedChecks = results.filter((r) => !r.pass)
console.log(`\n${results.length - failedChecks.length}/${results.length} passed`)
process.exit(failedChecks.length ? 1 : 0)
