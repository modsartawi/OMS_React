// Collection documents print drive (tickets 251 + 252 + 259) — drives the REAL app in Chromium.
// This is the wave's DOCUMENTS drive; both documents live here rather than in a drive each. The
// screens have their own: collection-drive.mjs.
//
// ⚠ Ticket 259 changed what this drive stubs, not what it asserts. The print routes used to read a
// checked-in fixture with no network involved; they now call
// `CollectionWeb/{Receipt,AcrForm}/{id}`, so the SAME four scenarios are served here as ENVELOPES
// over the intercepted route. That is a strictly better drive: every assertion below now runs
// through the api layer, the query, and the four-way outcome branch, instead of past them.
//
// 🚩 And the fixtures are loaded from the dev server rather than copied into this file — see
// `loadFixtures`. A second transcription of a 47-row ACR would drift from the one the tests pin,
// and it would drift silently, because both copies would still be internally consistent.
//
// 259 also added the three assertions the fixture era could not make at all: an unknown id is a
// MISS, a server fault is a FAILURE and says something different, and neither prints a sheet.
//
// Verifies ticket 251's flow Proof bullet, on `/collection/receipt/:collectionReceiptId`:
//   1. the sheet renders with NO AppShell chrome — the body IS the document (241);
//   2. one 210×297mm block per model page, at the WPF's 780px document width;
//   3. a multi-shift receipt produces TWO blocks, stamped -1 and -2 (the server paginates; the
//      client never chunks);
//   4. the S.R. | H. digit cells resolve LEFT-TO-RIGHT inside the RTL parent;
//   5. an empty pharmacistName renders an EMPTY fill-line rather than a 0;
//   6. NO خصم فائض content and NO POSTED banner anywhere in the DOM — both are rulings, and both
//      are provable only by absence;
//   7. a stale link renders "this document no longer exists", never a blank A4 sheet.
//
// And ticket 252's, on `/collection/acr/:acrId` — where the whole question is PAGING, because the
// ACR is the document that runs off the end of a sheet:
//   8. the four paging scenarios the 247 sign-off judged: 47 rows → 3 sheets with the header on
//      each, the م sequence 1→47 unbroken, and the summary on the last sheet only; 25 rows → a
//      short last page; 23 rows → ONE row alone beneath the whole summary block; 0 rows → the idle
//      ACR still prints its one page, totals `0.00`, summary present;
//   9. a NEGATIVE cash figure paints `-412.50` and not `412.50-` — a bug the WPF has and the
//      fidelity inventory's list of LTR islands missed;
//  10. a still-OPEN ACR renders a BLANK تاريخ التحصيل, not the string `''` and not a placeholder;
//  11. ملخص التحصيل prints on the LEFT with the signature on the RIGHT — the pad's sides, which
//      the WPF swapped — and it carries exactly ONE row, every deposit mark having left the model.
//
// What it CANNOT prove is the paper: the browser's header/footer stamp and whether every grey fill
// actually prints are hardware questions on real Chrome and real Edge — ticket 260, deliberately a
// build ticket of its own rather than a checkbox here.
//
// Playwright is borrowed from the Angular prototype (as in screen1-smoke.mjs).
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/collection-print-drive.mjs
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const receipt = (id) => `${BASE}/collection/receipt/${id}`
const acr = (id) => `${BASE}/collection/acr/${id}`

// 210mm / 297mm at the CSS reference 96dpi. The assertion is on the mm geometry, not on a pixel
// count someone once measured.
const MM = 96 / 25.4
const A4_W = 210 * MM
const A4_H = 297 * MM

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errors = [] } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors, data }),
})

// A refusal the way `EndpointHelpers.ExecuteAsync` builds one: a non-2xx that still carries the
// envelope, with the machine code in `errors[0].errorCode`. `core/api` turns this into a business
// `ApiError`, which is what `printOutcome` branches on — so getting the SHAPE right here is what
// makes the miss/failure assertions below mean anything.
const refusal = (code, message) =>
  envelope(null, { status: 404, success: false, message, errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }] })

// Chromium writes one `/Type /Page` object per printed sheet. Counting them beats adding a PDF
// dependency to a manual-run tool for one number.
const pdfPageCount = (buffer) => (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length

/**
 * The four receipts and four ACRs, read out of the app's own fixture modules.
 *
 * They are TypeScript and this drive is plain node, so they come through the dev server that is
 * already running: vite serves `/src/**.ts` as a transformed ES module, the page imports it, and
 * the result is structured-cloned back here. One source of truth, and it is the same one
 * `acr-fixture.ts` hands to vitest.
 */
async function loadFixtures(page) {
  const fixtures = await page.evaluate(async () => {
    const [v, a] = await Promise.all([
      import('/src/features/collection/inquiry/voucher-fixture.ts'),
      import('/src/features/collection/inquiry/acr-fixture.ts'),
    ])
    const byKey = (scenarios) => Object.fromEntries(scenarios.map((s) => [s.key, s.document]))
    return { receipts: byKey(v.VOUCHER_SCENARIOS), acrs: byKey(a.ACR_SCENARIOS) }
  })
  const counts = [Object.keys(fixtures.receipts).length, Object.keys(fixtures.acrs).length]
  if (counts[0] !== 4 || counts[1] !== 4)
    throw new Error(`fixture load returned ${counts.join('/')} scenarios, expected 4/4`)
  return fixtures
}

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
  const errors = []
  // `pageerror` is a real JS exception and is never filtered.
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => {
    if (m.type() !== 'error') return
    // ⚠ Since 259 a REFUSED document is a deliberate part of this drive — the miss, the cross-code
    // case and the injected 500. Chromium logs every non-2xx as a console resource error, so those
    // three would otherwise fail the no-errors check for doing exactly what they were asked to do.
    // Filtered by URL rather than by message, so an unexpected 404 anywhere ELSE still counts.
    if (/CollectionWeb\/(Receipt|AcrForm)\//.test(m.location()?.url ?? '')) return
    errors.push(m.text())
  })

  // Populated after the first navigation — the modules are served by the app, so the app has to be
  // up first. The route handler closes over the binding, not the value.
  let FIXTURES = { receipts: {}, acrs: {} }
  // Set by a test that wants the NEXT document call to fail in a way that is not a miss.
  let faultNext = null
  // Every document path the app asked for, in order. The whole of 259 is "these routes now call a
  // door", and the only way to assert that is to watch the door.
  const documentCalls = []

  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )

    // The two document doors (259). The id is a PATH SEGMENT and arrives url-encoded, so decode it
    // before the lookup — otherwise every scenario key would still match and the encoding would go
    // untested.
    const receiptId = path.startsWith('CollectionWeb/Receipt/')
      ? decodeURIComponent(path.slice('CollectionWeb/Receipt/'.length))
      : null
    const acrId = path.startsWith('CollectionWeb/AcrForm/')
      ? decodeURIComponent(path.slice('CollectionWeb/AcrForm/'.length))
      : null

    if (receiptId !== null || acrId !== null) {
      // The RAW path, before decoding — the encoding assertion needs to see what actually went on
      // the wire, not what the lookup made of it.
      documentCalls.push(path)
      if (faultNext) {
        const fault = faultNext
        faultNext = null
        return route.fulfill(fault)
      }
      const doc = receiptId !== null ? FIXTURES.receipts[receiptId] : FIXTURES.acrs[acrId]
      if (doc) return route.fulfill(envelope(doc))
      return receiptId !== null
        ? route.fulfill(refusal('CollectionReceiptNotFound', 'No such collection receipt.'))
        : route.fulfill(refusal('AcrNotFound', 'No such ACR.'))
    }

    // Anything else that fires is benign-empty so nothing crashes around it.
    return route.fulfill(envelope({}))
  })

  // `.print-sheet` is the A4 block BOTH documents land on — extracted at 252, because the ACR
  // lands on the same sheet at the same scale and a second copy of that geometry would be a
  // second answer to a settled question.
  const sheets = page.locator('.print-sheet')
  // ⚠ Since 259 the route FETCHES, so "loaded" is no longer "rendered": wait until the outcome
  // branch has actually drawn one of its three settled states. `[role=alert]` is the miss and the
  // failure; the PENDING state is `role=status` and deliberately NOT in this list, or every
  // assertion below would race it.
  const settle = async () => {
    await page.waitForLoadState('networkidle')
    await page.waitForSelector('.print-sheet, [role="alert"]', { state: 'attached' })
  }
  const goto = async (id) => {
    await page.goto(receipt(id))
    await settle()
  }
  const gotoAcr = async (id) => {
    await page.goto(acr(id))
    await settle()
  }

  // The app has to be up before it can serve its own fixture modules.
  await page.goto(BASE + '/login')
  await page.waitForLoadState('networkidle')
  FIXTURES = await loadFixtures(page)

  // ---- 1. the everyday receipt: one sheet, and no app chrome around it ----
  await goto('posted')
  check('posted → exactly ONE A4 sheet', (await sheets.count()) === 1, `${await sheets.count()}`)

  check('the body IS the document → no AppShell <main>', (await page.locator('main').count()) === 0)
  check('the body IS the document → no nav landmark', (await page.locator('nav').count()) === 0)
  check(
    'the body IS the document → no Collections nav group',
    (await page.getByRole('button', { name: /^Collections$/ }).count()) === 0,
  )

  const box = await sheets.first().boundingBox()
  check(
    'the sheet is a 210×297mm block',
    Math.abs(box.width - A4_W) < 2 && Math.abs(box.height - A4_H) < 2,
    `${box.width.toFixed(1)}×${box.height.toFixed(1)}px vs ${A4_W.toFixed(1)}×${A4_H.toFixed(1)}`,
  )
  check(
    'the first sheet starts no new page — the break goes BEFORE each later sheet, so a trailing break can never print a blank one',
    (await sheets.first().evaluate((el) => getComputedStyle(el).breakBefore)) !== 'page',
  )
  check(
    'the A4 rule is mounted by the ROUTE, not by a stylesheet that outlives it',
    (await page.locator('head style[data-print-page="a4"]').count()) === 1,
  )

  const doc = page.locator('.print-doc').first()
  const docStyle = await doc.evaluate((el) => {
    const s = getComputedStyle(el)
    return { laidOut: el.offsetWidth, painted: el.getBoundingClientRect().width, direction: s.direction, font: s.fontFamily }
  })
  check('the document is the WPF’s 780px wide', docStyle.laidOut === 780, `${docStyle.laidOut}px`)
  // WPF's own shrink-to-fit, min(1.0, (pageWidth − 48) / 780) ≈ 0.956 — the paper original already
  // prints at ~96%, so this is the geometry, not a defect to chase to 100%.
  check(
    'and it is painted at the WPF’s 0.956 scale',
    Math.abs(docStyle.painted - 780 * 0.956) < 1,
    `${docStyle.painted.toFixed(1)}px`,
  )
  check('the document flows RTL', docStyle.direction === 'rtl')
  check('Tahoma, no webfont', /Tahoma/i.test(docStyle.font), docStyle.font)

  const logo = page.locator('.cv-logo').first()
  check(
    'the al-dawaa mark actually loads (a missing image renders broken and typechecks fine)',
    await logo.evaluate((el) => el.complete && el.naturalWidth > 0),
  )
  check(
    'and it is LTR-forced so it never mirrors inside the RTL parent',
    (await logo.evaluate((el) => getComputedStyle(el).direction)) === 'ltr',
  )

  // ---- 2. the digit cells: an LTR island inside an RTL parent ----
  const wholeBox = await page.locator('.cv-cell--whole-grand').first().boundingBox()
  const minorBox = await page.locator('.cv-cell--minor-grand').first().boundingBox()
  check(
    'S.R. stays LEFT of H. — the grand-total cells resolve LTR inside the RTL sheet',
    wholeBox.x < minorBox.x,
    `whole@${wholeBox.x.toFixed(0)} minor@${minorBox.x.toFixed(0)}`,
  )
  const cashWhole = await page.locator('.cv-cell--whole-row').first().boundingBox()
  const cashMinor = await page.locator('.cv-cell--minor-row').first().boundingBox()
  check('and so do the cash-row cells', cashWhole.x < cashMinor.x)
  check(
    'the grey cell fill is marked to survive the printer',
    (await page
      .locator('.cv-cell')
      .first()
      .evaluate((el) => getComputedStyle(el).printColorAdjust)) === 'exact',
  )
  // `2026-08-06 21:14` mixes digits with a space, so without an LTR island the RTL paragraph
  // orders the two halves right-to-left and the sheet prints `21:14 2026-08-06`. Reading the text
  // back would not catch it — the DOM order is fine, the PAINTED order is not — so measure.
  const dateParts = await page.locator('.cv-line--date').first().evaluate((el) => {
    const range = window.document.createRange()
    const text = el.querySelector('bdi')?.firstChild ?? el.firstChild
    const at = (from, to) => {
      range.setStart(text, from)
      range.setEnd(text, to)
      return range.getBoundingClientRect().x
    }
    return { day: at(0, 10), time: at(11, 16), isolated: !!el.querySelector('bdi[dir="ltr"]') }
  })
  check('the collected-at date is an LTR island', dateParts.isolated)
  check(
    'and it PAINTS in order — yyyy-MM-dd left of HH:mm, not bidi-flipped',
    dateParts.day < dateParts.time,
    `date@${dateParts.day.toFixed(0)} time@${dateParts.time.toFixed(0)}`,
  )

  check(
    'the fill-lines are DOT leaders, the pad’s texture — not the WPF’s solid rules',
    (await page
      .locator('.cv-line')
      .first()
      .evaluate((el) => getComputedStyle(el).borderBottomStyle)) === 'dotted',
  )

  // ---- 3. the rulings that are provable only by ABSENCE ----
  const bodyText = await page.locator('body').innerText()
  const overage = (await page.locator('.cv-overage-box').innerText()).trim()
  check(
    'the خصم فائض box is ALWAYS EMPTY — its red label and nothing else',
    overage === 'خصم فائض :',
    JSON.stringify(overage),
  )
  check('no فائض/عجز variance amount anywhere in the DOM', !/(فائض|عجز)\s*[\d-]/.test(bodyText))
  check('no مطابق match mark anywhere in the DOM', !bodyText.includes('مطابق'))
  check(
    'NO POSTED banner — taking a number IS the posted state',
    !/POSTED/i.test(bodyText) && !bodyText.includes('مرحّل'),
  )
  check(
    'and no — placeholder No.: a receipt on the HQ path always has a number',
    !bodyText.includes('—'),
  )

  // ---- 4. a multi-shift receipt is a real case, not an edge one ----
  await goto('multishift')
  check('multishift → TWO A4 blocks', (await sheets.count()) === 2, `${await sheets.count()}`)
  const stamps = await page.locator('.cv-band-side--no .cv-stamp').allInnerTexts()
  check(
    'stamped 0000000005-1 then 0000000005-2, in page order',
    stamps.length === 2 &&
      stamps[0].includes('0000000005-1') &&
      stamps[1].includes('0000000005-2'),
    stamps.join(' | '),
  )
  const boxes = await Promise.all((await sheets.all()).map((s) => s.boundingBox()))
  check(
    'both blocks are a full A4 — the second is not a short remainder',
    boxes.every((b) => Math.abs(b.height - A4_H) < 2),
    boxes.map((b) => b.height.toFixed(0)).join(' / '),
  )

  // ---- 5. an empty pharmacist renders an empty fill-line, never a 0 ----
  await goto('zero')
  const pharmacist = page.locator('.cv-name-block').nth(1)
  const nameLine = pharmacist.locator('.cv-line--name')
  const idLine = pharmacist.locator('.cv-line').nth(1)
  check('zero → the pharmacist name line is EMPTY', (await nameLine.innerText()).trim() === '')
  check('zero → the pharmacist id line is EMPTY', (await idLine.innerText()).trim() === '')
  const nameBox = await nameLine.boundingBox()
  check(
    'zero → and it is still a drawn fill-line, not a collapsed run',
    nameBox.height > 10 && nameBox.width > 20,
    `${nameBox.width.toFixed(0)}×${nameBox.height.toFixed(0)}`,
  )
  const zeroText = await pharmacist.innerText()
  check('zero → and it renders NO 0 in the pharmacist block', !/\b0\b/.test(zeroText), JSON.stringify(zeroText))
  const moneyCells = await page.locator('.cv-cell--whole-row, .cv-cell--minor-row').allInnerTexts()
  check(
    'zero → but the MONEY boxes do print 0 / 00, never blank',
    moneyCells.length === 4 && moneyCells.every((c) => /^0+$/.test(c.trim())),
    moneyCells.join(' '),
  )

  // ---- 6. the minor cell sizes to the value, not to a currency lookup ----
  await goto('bhd')
  const minor3 = await page.locator('.cv-cell--minor-grand').first()
  check('bhd → the 3-digit minor cell renders 005', (await minor3.innerText()).trim() === '005')
  const minor3Box = await minor3.boundingBox()
  check(
    'bhd → and it is not clipped',
    await minor3.evaluate((el) => el.scrollWidth <= el.clientWidth + 1),
    `${minor3Box.width.toFixed(0)}px`,
  )

  // ---- 7. a stale link is a sentence, never a blank sheet ----
  await goto('no-such-receipt')
  const missText = await page.locator('body').innerText()
  check('a stale link → renders no A4 sheet at all', (await sheets.count()) === 0)
  check(
    'a stale link → says so, rather than printing a convincing blank',
    missText.includes('no longer exists'),
    missText.replace(/\n/g, ' ').slice(0, 80),
  )
  // 259: the miss is now the SERVER's answer, not a fixture lookup that came up empty. It has to
  // have gone and asked.
  check(
    '259 — and it asked the door before saying so: CollectionReceiptNotFound came off the wire',
    documentCalls.includes('CollectionWeb/Receipt/no-such-receipt'),
    documentCalls.slice(-1)[0],
  )

  // ---- 7b. THE 259 DISTINCTION: a fault is not a miss ----
  //
  // The failure mode this guards is a sentence, not a crash. Folding a 500 into "this document no
  // longer exists" tells an accountant their receipt was reversed because SIS.Api was restarting,
  // and sends them looking for a reversal that never happened. Both states are non-blank; what
  // separates them is which true thing they say.
  faultNext = envelope(null, { status: 500, success: false, message: 'Internal Server Error' })
  await goto('posted')
  const faultText = await page.locator('body').innerText()
  check('a server fault → still renders no A4 sheet — never a blank one either', (await sheets.count()) === 0)
  check(
    '259 — a server fault does NOT claim the document is gone',
    !faultText.includes('no longer exists'),
    faultText.replace(/\n/g, ' ').slice(0, 80),
  )
  check(
    '259 — it says the fetch failed, and that nothing is known about whether it exists',
    faultText.includes('could not be fetched') && faultText.includes('not the same as it being gone'),
    faultText.replace(/\n/g, ' ').slice(0, 100),
  )
  check('259 — the fault state is announced, not silent', (await page.locator('[role="alert"]').count()) === 1)

  // ---- 7c. the id is a path segment, and it is encoded ----
  //
  // A hand-typed id reaches the route as whatever was pasted into the URL bar. `posted/../Acrs`
  // must not be able to walk the path it lands on.
  await goto(encodeURIComponent('a/b?c=1'))
  check(
    '259 — a url-hostile id is encoded into ONE path segment, never allowed to reshape the path',
    documentCalls.slice(-1)[0] === 'CollectionWeb/Receipt/a%2Fb%3Fc%3D1',
    documentCalls.slice(-1)[0],
  )
  check('259 — and it lands on the miss, not on some other screen', (await page.locator('[role="alert"]').count()) === 1)

  // ---- 8. the same document under print media ----
  await page.emulateMedia({ media: 'print' })
  await goto('multishift')
  await page.emulateMedia({ media: 'print' })
  const printBoxes = await Promise.all((await sheets.all()).map((s) => s.boundingBox()))
  check(
    'under @media print → still two full A4 blocks, nothing hidden or reflowed',
    printBoxes.length === 2 && printBoxes.every((b) => Math.abs(b.height - A4_H) < 2),
    printBoxes.map((b) => `${b.width.toFixed(0)}×${b.height.toFixed(0)}`).join(' / '),
  )
  await page.emulateMedia({ media: 'screen' })

  // ---- 9. the count that actually comes out of the printer ----
  // Every assertion above is about the DOM; this one is about the PDF. It is the only one that
  // can see a TRAILING BLANK SHEET — a `break-after` on the last block prints a page the DOM has
  // no element for, and `:last-child` does not suppress it because the sheets are not the only
  // children of #root (the app's toaster renders a sibling section).
  for (const [id, expected] of [
    ['posted', 1],
    ['multishift', 2],
  ]) {
    await goto(id)
    const pages = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
    check(`${id} → the PDF is exactly ${expected} sheet(s), with no blank tail`, pages === expected, `${pages}`)
  }

  // ---- 10. the @page rule leaves with the route it belongs to ----
  await page.goto(BASE + '/collection/collections')
  await page.waitForLoadState('networkidle')
  check(
    'leaving the print route takes its `@page { margin: 0 }` with it — an ordinary screen must not print edge-to-edge for the rest of the session',
    (await page.locator('head style[data-print-page="a4"]').count()) === 0,
  )

  // ═══ the ACR (ticket 252) ═══════════════════════════════════════════════════════════════════
  //
  // The receipt is one sheet and the ACR is three, so everything below is really one question:
  // does the SERVER's page break survive contact with a browser, unhelped by the client?

  const acrSheets = page.locator('.print-sheet')
  const seqCells = page.locator('.acr-c0:not(.acr-th)')
  const summary = page.locator('.acr-summary')

  // ---- 11. 47 rows over three sheets ----
  await gotoAcr('three-pages')
  check('acr 47 rows → THREE A4 sheets', (await acrSheets.count()) === 3, `${await acrSheets.count()}`)
  check('acr → the body IS the document here too', (await page.locator('main').count()) === 0)

  const heads = await page.locator('.acr-tr').first().locator('.acr-th').allInnerTexts()
  check(
    'acr → eleven columns, م first (column 0 is the RTL row’s leading cell)',
    heads.length === 11 && heads[0] === 'م' && heads[9] === 'رقم الصيدلي',
    `${heads.length} cols: ${heads.slice(0, 2).join(',')} … ${heads[9]}`,
  )
  // The header must repeat on EVERY page — each printed side is a whole reading of the form.
  const headRows = await Promise.all(
    (await acrSheets.all()).map(async (s) => (await s.locator('.acr-th').allInnerTexts()).slice(0, 11).join('|')),
  )
  check(
    'acr → the header row repeats on all three sheets, identically',
    headRows.length === 3 && new Set(headRows).size === 1 && headRows[0].startsWith('م|'),
  )
  const stampTexts = await page.locator('.acr-stamp').allInnerTexts()
  check(
    'acr → stamped صفحة 1 / 3, 2 / 3, 3 / 3 — the pad was one sheet, this prints three',
    stampTexts.join(' ') === 'صفحة 1 / 3 صفحة 2 / 3 صفحة 3 / 3',
    stampTexts.join(' | '),
  )
  // Deliberately NOT an LTR island, and measured rather than assumed: `2 / 3` sits after an Arabic
  // word, so its digits resolve to AN and the neutrals between them to the paragraph direction —
  // which paints صفحة, then 2, then 3 leading right-to-left. That is the correct reading order in
  // the document's own direction, and it is what the WPF and the 247 sign-off show. Isolating it
  // would flip the pair against both. If this assertion ever fires, the ruling is what needs
  // revisiting, not the markup.
  const stampOrder = await page.locator('.acr-stamp').nth(1).evaluate((el) => {
    const range = window.document.createRange()
    const [word, value] = el.childNodes
    const at = (node, from, to) => {
      range.setStart(node, from)
      range.setEnd(node, to)
      return range.getBoundingClientRect().x
    }
    return { word: at(word, 0, word.length), index: at(value, 0, 1), count: at(value, 4, 5) }
  })
  check(
    'acr → and the stamp PAINTS right-to-left: صفحة, then 2, then 3 — the form’s own reading order',
    stampOrder.word > stampOrder.index && stampOrder.index > stampOrder.count,
    `صفحة@${stampOrder.word.toFixed(0)} 2@${stampOrder.index.toFixed(0)} 3@${stampOrder.count.toFixed(0)}`,
  )

  // The client never counts: `seqText` is read off the row, which is the only reason it can run
  // unbroken THROUGH a page break.
  const seqs = await seqCells.allInnerTexts()
  const expectedSeqs = Array.from({ length: 47 }, (_, i) => String(i + 1))
  check(
    'acr → the م sequence runs 1→47 UNBROKEN across the three sheets',
    seqs.length === 47 && seqs.every((s, i) => s.trim() === expectedSeqs[i]),
    `${seqs.length} rows, ${seqs[0]}…${seqs[seqs.length - 1]}`,
  )
  const rowsPerSheet = await Promise.all(
    (await acrSheets.all()).map(async (s) => await s.locator('.acr-c0:not(.acr-th)').count()),
  )
  check(
    'acr → the SERVER’s break, 22 / 22 / 3 — the client applies no rowsPerPage of its own',
    rowsPerSheet.join('/') === '22/22/3',
    rowsPerSheet.join('/'),
  )
  check('acr → ملخص التحصيل appears exactly ONCE', (await summary.count()) === 1)
  check(
    'acr → and it is on the LAST sheet, with the الاجمالي band beside it',
    (await acrSheets.nth(2).locator('.acr-summary').count()) === 1 &&
      (await acrSheets.nth(0).locator('.acr-summary').count()) === 0 &&
      (await page.locator('.acr-total-label').count()) === 1,
  )
  // 247's amendment 3: every deposit mark left the model, meta AND summary, so ملخص التحصيل is
  // left holding a single row. Provable only by absence.
  check(
    'acr → the summary box carries exactly ONE row, اجمالي الايرادات',
    (await summary.locator('.acr-summary-label').count()) === 1 &&
      (await summary.locator('.acr-summary-label').innerText()).trim() === 'اجمالي الايرادات',
  )
  const acrBody = await page.locator('body').innerText()
  check(
    'acr → NO deposit mark anywhere: no رقم الإيداع, no اجمالي ايداع المحصل',
    !acrBody.includes('الإيداع') && !acrBody.includes('ايداع'),
  )
  check(
    'acr → and no نموذج رقم: the serial prints under رقم التجميعي (247’s amendment 2)',
    acrBody.includes('رقم التجميعي') && !acrBody.includes('نموذج رقم'),
  )
  check('acr → الموافق restored beside the Gregorian date', acrBody.includes('الموافق'))
  // A porting artifact the XAML carries and HTML collapses — kept deliberately.
  check(
    'acr → the meta labels keep their trailing space (white-space: pre)',
    (await page
      .locator('.acr-meta-label')
      .first()
      .evaluate((el) => getComputedStyle(el).whiteSpace)) === 'pre',
  )
  check(
    'acr → the header cells are grey-filled, and marked to survive the printer',
    (await page.locator('.acr-th').first().evaluate((el) => getComputedStyle(el).printColorAdjust)) === 'exact',
  )
  // `anywhere` shears مطابقة الكاش والشبكة into four lines with a lone ة; WPF's TextWrapping="Wrap"
  // breaks at word boundaries.
  check(
    'acr → cells wrap on word boundaries (break-word), never `anywhere`',
    (await page.locator('.acr-td').first().evaluate((el) => getComputedStyle(el).overflowWrap)) === 'break-word',
  )

  // ---- 12. the negative figure — the bug the WPF has and the inventory missed ----
  const shortfall = page.locator('.acr-money.acr-mark').first()
  check(
    'acr → the shortfall row’s cash reads -412.50 in the DOM',
    (await shortfall.innerText()).trim() === '-412.50',
    (await shortfall.innerText()).trim(),
  )
  // Reading the text back cannot catch this: the DOM order is fine and the PAINTED order is not.
  // Under the RTL paragraph the minus is bidi-neutral and prints AFTER the digits — `412.50-`.
  const minus = await shortfall.evaluate((el) => {
    const range = window.document.createRange()
    const text = el.querySelector('bdi')?.firstChild ?? el.firstChild
    const at = (from, to) => {
      range.setStart(text, from)
      range.setEnd(text, to)
      return range.getBoundingClientRect().x
    }
    return { sign: at(0, 1), digits: at(1, 7), isolated: !!el.querySelector('bdi[dir="ltr"]') }
  })
  check('acr → the money cell is an LTR island', minus.isolated)
  check(
    'acr → and the minus PAINTS on the LEFT — -412.50, never 412.50-',
    minus.sign < minus.digits,
    `sign@${minus.sign.toFixed(0)} digits@${minus.digits.toFixed(0)}`,
  )
  check(
    'acr → a shortfall carries the mismatch-red warning style',
    (await shortfall.evaluate((el) => getComputedStyle(el).color)) === 'rgb(176, 0, 32)',
  )
  // Tri-state, and the blank state is a state: a reconciled row carries no mark at all.
  const marks = await page.locator('.acr-c7:not(.acr-th)').allInnerTexts()
  check(
    'acr → the مطابقة flag in all three states: blank, ✗, and ؟',
    marks.filter((m) => m.trim() === '✗').length === 1 &&
      marks.filter((m) => m.trim() === '؟').length === 1 &&
      marks.filter((m) => m.trim() === '').length === 45,
    `✗:${marks.filter((m) => m.trim() === '✗').length} ؟:${marks.filter((m) => m.trim() === '؟').length}`,
  )
  check(
    'acr → the unsynced Z row says so in Arabic — 242 §8-O5 fixed in the builder, not passed through',
    acrBody.includes('تقرير Z غير مُرحّل') && !/Z report missing/i.test(acrBody),
  )

  // ---- 13. 23 rows — the ugly break the sign-off looked hardest at ----
  await gotoAcr('boundary')
  check('acr 23 rows → TWO sheets', (await acrSheets.count()) === 2)
  const lastSheet = acrSheets.nth(1)
  check(
    'acr 23 rows → ONE row alone on the last sheet, beneath the whole summary block',
    (await lastSheet.locator('.acr-c0:not(.acr-th)').count()) === 1 &&
      (await lastSheet.locator('.acr-summary').count()) === 1,
  )
  // Legible means it fits: a summary pushed off the bottom of A4 is silently truncated on paper.
  const lastBox = await lastSheet.boundingBox()
  const summaryBox = await lastSheet.locator('.acr-summary').boundingBox()
  const signBox = await lastSheet.locator('.acr-sign').boundingBox()
  check(
    'acr 23 rows → and the whole summary block still fits inside the sheet',
    summaryBox.y + summaryBox.height <= lastBox.y + lastBox.height,
    `summary ends @${(summaryBox.y + summaryBox.height).toFixed(0)}, sheet @${(lastBox.y + lastBox.height).toFixed(0)}`,
  )
  // Back to the pad's sides — the WPF swapped the two for no stated reason.
  check(
    'acr → ملخص التحصيل on the LEFT, the signature on the RIGHT (the pad’s sides)',
    summaryBox.x < signBox.x,
    `summary@${summaryBox.x.toFixed(0)} signature@${signBox.x.toFixed(0)}`,
  )
  const signLine = await lastSheet.locator('.acr-sign-line').innerText()
  check('acr → the wet-signature line is ALWAYS empty', signLine.trim() === '')

  // ---- 14. 25 rows, still OPEN — a short last page and a blank collection date ----
  await gotoAcr('open')
  check('acr 25 rows → TWO sheets, the last one short', (await acrSheets.count()) === 2)
  check(
    'acr 25 rows → 22 then 3',
    (
      await Promise.all(
        (await acrSheets.all()).map(async (s) => await s.locator('.acr-c0:not(.acr-th)').count()),
      )
    ).join('/') === '22/3',
  )
  // `closedAtText` is '' while the ACR is still OPEN — and '' renders BLANK, with no `||` fallback
  // that could put an invented mark on a printed record.
  const closedAt = page.locator('.acr-meta--last .acr-meta-cell').first()
  const closedAtText = (await closedAt.innerText()).trim()
  check(
    'acr OPEN → تاريخ التحصيل is BLANK — not the string, not a placeholder, not a dash',
    closedAtText === 'تاريخ التحصيل:' && !/\d/.test(closedAtText),
    JSON.stringify(closedAtText),
  )
  check(
    'acr OPEN → and the ACR still says it is مفتوح',
    (await page.locator('.acr-meta--last .acr-meta-cell').nth(2).innerText()).includes('مفتوح'),
  )

  // ---- 15. 0 rows — the idle ACR still prints one page ----
  await gotoAcr('empty')
  check('acr 0 rows → still ONE A4 sheet', (await acrSheets.count()) === 1)
  check('acr 0 rows → and no data rows at all', (await seqCells.count()) === 0)
  check(
    'acr 0 rows → but the header, the totals and the summary are all present',
    (await page.locator('.acr-th').count()) >= 13 && (await summary.count()) === 1,
  )
  const idleTotals = await page.locator('.acr-total-label ~ .acr-money').allInnerTexts()
  check(
    'acr 0 rows → the totals print 0.00, never blank',
    idleTotals.length === 3 && idleTotals.every((v) => v.trim() === '0.00'),
    idleTotals.join(' '),
  )
  // 259's other direction, and the one that would fail QUIETLY: an idle ACR is a 200 with one page
  // and `rows: []`. Reading it as a refusal — because the rows are empty, or because the outcome
  // branch checked a row count instead of an envelope code — turns a real document into an error
  // screen, and nobody would notice until an accountant printed a quiet week.
  check(
    '259 — an EMPTY ACR is a success off the wire, not a refusal: no alert anywhere on the page',
    (await page.locator('[role="alert"]').count()) === 0,
  )

  // ---- 16. a stale ACR link is the same sentence the receipt gives ----
  await gotoAcr('no-such-acr')
  check('acr stale link → renders no A4 sheet at all', (await acrSheets.count()) === 0)
  check(
    'acr stale link → says so, rather than printing a convincing blank',
    (await page.locator('body').innerText()).includes('no longer exists'),
  )
  check(
    '259 — off the ACR door, reusing AcrNotFound: there is no second code for the same fact',
    documentCalls.includes('CollectionWeb/AcrForm/no-such-acr'),
    documentCalls.slice(-1)[0],
  )
  // The receipt route owns CollectionReceiptNotFound and the ACR route owns AcrNotFound. If either
  // accepted the other's code, a refusal from the wrong family would read as a stale link — so the
  // ACR route is handed the RECEIPT's code and must call it a failure, not a miss.
  faultNext = refusal('CollectionReceiptNotFound', 'No such collection receipt.')
  await gotoAcr('three-pages')
  const crossText = await page.locator('body').innerText()
  check(
    '259 — the ACR route does NOT read the receipt’s not-found code as its own stale link',
    !crossText.includes('no longer exists') && crossText.includes('could not be fetched'),
    crossText.replace(/\n/g, ' ').slice(0, 80),
  )

  // ---- 17. the sheets that actually come out of the printer ----
  for (const [id, expected] of [
    ['three-pages', 3],
    ['boundary', 2],
    ['empty', 1],
  ]) {
    await gotoAcr(id)
    const pages = pdfPageCount(await page.pdf({ preferCSSPageSize: true, printBackground: true }))
    check(`acr ${id} → the PDF is exactly ${expected} sheet(s), with no blank tail`, pages === expected, `${pages}`)
  }

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
