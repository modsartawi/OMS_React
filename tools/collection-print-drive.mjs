// Collection documents print drive (ticket 251) — drives the REAL app in Chromium against the
// CHECKED-IN fixtures, because SIS.Api's CollectionWeb door doesn't exist yet (BackOffice 1090;
// ticket 259 is the wave-joining event). This is the wave's DOCUMENTS drive — ticket 252's ACR
// EXTENDS this file rather than starting a third. The screens have their own: collection-drive.mjs.
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

// Chromium writes one `/Type /Page` object per printed sheet. Counting them beats adding a PDF
// dependency to a manual-run tool for one number.
const pdfPageCount = (buffer) => (buffer.toString('latin1').match(/\/Type\s*\/Page[^s]/g) || []).length

async function run() {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } })
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))

  await page.route('**/api/**', async (route) => {
    const path = route.request().url().split('/api/')[1].split('?')[0]
    if (path === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }),
      )
    // The print route makes NO call of its own at 251 — the fixture is checked in. Anything else
    // that fires is benign-empty so nothing crashes around it.
    return route.fulfill(envelope({}))
  })

  const sheets = page.locator('.cv-sheet')
  const goto = async (id) => {
    await page.goto(receipt(id))
    await page.waitForLoadState('networkidle')
  }

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

  const doc = page.locator('.cv-doc').first()
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

  check('no uncaught page errors', errors.length === 0, errors.slice(0, 3).join(' | '))

  await browser.close()
  const failed = results.filter((r) => !r.pass).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  process.exit(failed ? 1 : 0)
}

run()
