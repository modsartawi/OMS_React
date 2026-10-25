// The location link on the web seat (574, BackOffice spec 2482; card rules BackOffice 2468) —
// drives the REAL app in Chromium, the wire stubbed at Playwright. The session state is the
// contract's capture 02 lifted to v1.12 (an address, `canSendLocationLink`); the four link
// calls answer EXACTLY the web-seat contract's fields (§2) inside the real envelope, and a
// refusal is the contract's HTTP 400 with a `CCL-` code in `errors[0]`.
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/callcenter-location-drive.mjs
//
// Time is Playwright's fake clock (`page.clock`), so 15 minutes of link, the 30 s cooldown and
// the 30 s unreachable rule run in seconds. Asserts ticket 574's Proof, LTR and RTL (the app's
// language stays `en` — `core/i18n.ts` — so RTL reads the English words mirrored; the `ar`
// bundle ships beside them, the dispatch-board precedent):
//   1. Send location link is shown only while `canSendLocationLink` is true — hidden (not
//      disabled) when false or absent;
//   2. the dialog pre-fills the customer's mobile; the Send body is the contract's four
//      fields, field for field (the customer's number re-spelled is NOT typed; another is);
//   3. the waiting strip names the masked number and counts down mm:ss every second;
//   4. the poll is every 3 s on the latest token;
//   5. Resend is disabled for 30 s showing the seconds left, then re-sends the same body
//      without the dialog — and the poll moves to the new token;
//   6. 30 s of failed polls → "Can't reach the server - still trying"; recovery → countdown;
//   7. Lapsed → expired + Send again (opens the dialog); Superseded → replaced + Send again;
//      Captured → the card (575);
//   8. the refusals: CCL-00004 inline at the number, CCL-00008 / 00009 / 00020 in the dialog,
//      CCL-00001 hides the action;
//   9. Retire `{ orderContextId }` on submit and on abandon; the strip goes with the order.
// …and ticket 575's (the card, Apply, the chip — `ApplyLocation` answers the whole SessionState,
// its refusals the session verbs' shape with `detail` = `{ code }` on `data`, contract §3):
//   7c. the card replaces the strip in place; its rows (phone pin ±m, the coordinates as one
//       isolated string, Open in Google Maps' URL in a new tab, the Short Address, details into
//       line 2, save to customer unticked); untick a row → Apply → the chip; the body is the
//       seven fields with no captured value; the chip stays;
//   10. the notes: replaces the earlier pin, "Order has: …", a MANUAL pin, Short Address not
//       given (no tick), line 2 filled (Copy, no tick), no customer (no save tick);
//   11. the refusals: the two save refusals inline on the save tick (the card stays),
//       CCL-00030 (kept, one retry on the next poll), CCL-00031 (re-read → chip, or the
//       discarded strip), CCL-00006 (drop → Send again; on the status poll too, at once),
//       CCL-00001 (the card and the action go).
// Screenshots → tools/.callcenter-location-shots/.
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5280}`
const SHOTS = 'tools/.callcenter-location-shots'
mkdirSync(SHOTS, { recursive: true })

const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
    .response.body.data

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
/** The contract's refusal: HTTP 400, `errors[0].errorCode` = the `CCL-` code. */
const refusal = (code, message) => ({
  status: 400,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 400,
    success: false,
    message,
    errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }],
    data: null,
  }),
})

let pass = 0
let fail = 0
const ok = (c, m, detail = '') =>
  c ? (pass++, console.log(`  ✓ ${m}`)) : (fail++, console.log(`  ✗ ${m}${detail ? ` — ${detail}` : ''}`))

// ---- the order: capture 02, lifted to v1.12 ----
const PRICED = fixture('02-two-lines-priced')
const MOBILE = '0551234567'
const MASKED = '055•••4567'
const stateOf = (transactionId, canSendLocationLink, { address = {}, customer = 'attached' } = {}) => ({
  ...PRICED,
  contractVersion: '1.12',
  transactionId,
  header: {
    ...PRICED.header,
    deliveryType: 'Delivery',
    customer: customer === null ? null : { ...PRICED.header.customer, mobile: MOBILE },
    address: {
      addressNumber: '77120',
      label: 'Home',
      cityCode: '0021',
      cityName: 'Riyadh',
      districtCode: 'R-114',
      districtName: 'Al Malqa',
      line: 'King Abdulaziz Rd 4',
      line2: null,
      shortAddress: 'RIMA6904',
      gpsLat: null,
      gpsLon: null,
      ...address,
    },
    slot: { slotId: 'S-1', from: '18:00', to: '21:00', isActive: true },
  },
  capabilities: (() => {
    const caps = { ...PRICED.capabilities, canSubmit: true, submitBlockers: [] }
    if (canSendLocationLink !== undefined) caps.canSendLocationLink = canSendLocationLink
    return caps
  })(),
})
const TX1 = '01JCLOCATIONLINKTX0000001'
const TX2 = '01JCLOCATIONLINKTX0000002'

// ---- the link's own wire, §2 ----
const CAPTURE = {
  gpsLat: 24.774265,
  gpsLon: 46.738586,
  pinSource: 'DEVICE',
  accuracyMeters: 12,
  shortAddress: 'RIMA6904',
  addressDetails: 'Villa 4, second gate',
  capturedAt: '2026-10-26T10:14:03',
  appliedAt: '0001-01-01T00:00:00',
  appliedBy: '',
  discardedAt: '0001-01-01T00:00:00',
  discardedBy: '',
}
const statusBody = (status, secondsLeft = 0, capture = CAPTURE) => ({
  status,
  secondsLeft: status === 'Live' ? secondsLeft : 0,
  capture: status === 'Captured' ? capture : null,
})

/** A session-verb refusal (CONTRACT §7, the door's `Refusal`): the code in `errors[0]`, the
 *  server's sentence, and the code's extras on `data` — `LOCATION_LINK_REFUSED`'s `detail`
 *  is `{ code: <CCL-> }` there (§3). */
const codedRefusal = (code, status, message, data = null) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success: false,
    message,
    errors: [{ errorCode: code, internalErrorCode: '', errorMessage: message }],
    data,
  }),
})
const APPLY_REFUSALS = {
  stamped: ['LOCATION_LINK_REFUSED', 409, 'The location was already applied or discarded.', { code: 'CCL-00031' }],
  notYet: ['LOCATION_LINK_REFUSED', 409, 'Nothing has been captured yet.', { code: 'CCL-00030' }],
  noLink: ['LOCATION_LINK_REFUSED', 409, 'No such location link.', { code: 'CCL-00006' }],
  notConfigured: ['LOCATION_LINK_REFUSED', 409, 'The location link is not configured.', { code: 'CCL-00001' }],
  noCustomer: ['NO_CUSTOMER_ATTACHED', 409, 'No customer attached to session.'],
  notTheirs: ['ADDRESS_NOT_FOR_CUSTOMER', 403, 'Address 77120 not found for customer.'],
}
const isBlank = (text) => !text || !text.trim()

const MODES = [{ dir: 'ltr' }, { dir: 'rtl' }]
const browser = await chromium.launch()
const allErrors = []

/**
 * One console, with its own stub server. `wire` is every call the page made; `link` is the
 * server's view of each token, and `next` queues the answer the next Send gets.
 */
async function open({ dir }, { canSendLocationLink = true, address, customer, capture = CAPTURE } = {}) {
  if (canSendLocationLink === 'absent') canSendLocationLink = undefined
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource/.test(m.text()) &&
      errors.push(m.text()),
  )
  await page.clock.install({ time: new Date('2026-10-26T10:00:00') })
  await page.addInitScript((d) => {
    localStorage.setItem('oms.darkMode', 'false')
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
  }, dir)
  const srv = {
    wire: [],
    opens: 0,
    tokens: 0,
    /** token → { status, issuedAt } — `issuedAt` on the PAGE's (fake) clock, so the
     *  server's `secondsLeft` counts down as the server's would. */
    link: new Map(),
    /** Queued Send answers: a refusal `[code, message]`, else success. */
    next: [],
    failPolls: false,
    /** Queued ApplyLocation answers: an `APPLY_REFUSALS` entry, else success. */
    applyNext: [],
    state: stateOf(TX1, canSendLocationLink, { address, customer }),
  }
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = req.url().split('/api/')[1].split('?')[0]
    const body = req.postData() ? JSON.parse(req.postData()) : null
    srv.wire.push({ path: p, body, method: req.method() })
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open') {
      srv.opens++
      if (srv.opens > 1) srv.state = stateOf(TX2, canSendLocationLink, { address, customer })
      return route.fulfill(envelope({ outcome: 'opened', state: srv.state, existing: null }))
    }
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(srv.state))
    if (p === 'CallCenterWeb/LocationLinks/Send') {
      const queued = srv.next.shift()
      if (queued) return route.fulfill(refusal(...queued))
      const token = `Tok${String(++srv.tokens).padStart(9, '0')}`
      for (const live of srv.link.values()) if (live.status === 'Live') live.status = 'Superseded'
      srv.link.set(token, { status: 'Live', issuedAt: await page.evaluate(() => Date.now()), capture })
      return route.fulfill(envelope({ token, secondsLeft: 900, maskedMobile: MASKED }))
    }
    const statusPath = /^CallCenterWeb\/LocationLinks\/([^/]+)\/Status$/.exec(p)
    if (statusPath) {
      if (srv.failPolls) return route.abort('failed')
      const held = srv.link.get(statusPath[1])
      if (!held) return route.fulfill(refusal('CCL-00006', 'No such link.'))
      const pageNow = await page.evaluate(() => Date.now())
      const secondsLeft = Math.max(0, 900 - Math.floor((pageNow - held.issuedAt) / 1000))
      return route.fulfill(envelope(statusBody(held.status, secondsLeft, held.capture)))
    }
    // §3 — the Apply verb. Only the ticks arrive; the values come off the capture the server
    // holds, under its rules (a blank never wipes; details only into an EMPTY line 2), and
    // the capture is stamped Applied in the same act. Answers the whole SessionState.
    if (p === 'CallCenterWeb/ApplyLocation') {
      const queued = srv.applyNext.shift()
      if (queued) return route.fulfill(codedRefusal(...queued))
      const held = srv.link.get(body.token)
      const cap = held.capture
      const address = { ...srv.state.header.address }
      if (body.applyPin) Object.assign(address, { gpsLat: cap.gpsLat, gpsLon: cap.gpsLon })
      if (body.applyShortAddress && !isBlank(cap.shortAddress)) address.shortAddress = cap.shortAddress
      if (body.applyDetails && !isBlank(cap.addressDetails) && isBlank(address.line2)) address.line2 = cap.addressDetails
      held.capture = { ...cap, appliedAt: '2026-10-26T10:00:00', appliedBy: 'a.alharbi' }
      srv.state = { ...srv.state, version: srv.state.version + 1, header: { ...srv.state.header, address } }
      return route.fulfill(envelope(srv.state))
    }
    if (p === 'CallCenterWeb/LocationLinks/Retire') return route.fulfill(envelope({ retired: 1 }))
    if (p === 'CallCenterWeb/Submit') {
      srv.state = {
        ...srv.state,
        status: 'submitted',
        version: srv.state.version + 1,
        capabilities: { ...srv.state.capabilities, canSubmit: false, canSendLocationLink: false },
      }
      return route.fulfill(envelope({ outcome: 'submitted', documentNo: '4100012345', state: srv.state }))
    }
    if (p === 'CallCenterWeb/Abandon')
      return route.fulfill(envelope({ outcome: 'abandoned', transactionId: srv.state.transactionId }))
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true }))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/callcenter`)
  await page.locator('[data-cc-console]').waitFor({ timeout: 20_000 })
  await page.waitForLoadState('networkidle')
  return { context, page, errors, srv }
}

const calls = (srv, re) => srv.wire.filter((w) => re.test(w.path))
const stripState = (page) => page.locator('[data-cc-location-strip]').getAttribute('data-cc-location-strip')
const clockOf = async (page) => (await page.locator('[data-cc-location-clock]').innerText()).trim()
const secondsOf = (clock) => {
  const [m, s] = clock.split(':').map(Number)
  return m * 60 + s
}
/**
 * Advance the fake clock and let the page's answers land. In steps of at most 1 s with a
 * real pause between, because the stubbed network answers in REAL time: one long jump would
 * fire many polls into one in-flight request (react-query de-duplicates them) and stamp a
 * failure at the end of the jump rather than when it happened.
 */
async function run(page, ms) {
  for (let left = ms; left > 0; left -= 1_000) {
    await page.clock.runFor(Math.min(1_000, left))
    await page.waitForTimeout(60)
  }
  await page.waitForTimeout(100)
}

const MAPS_URL = 'https://www.google.com/maps/search/?api=1&query=24.774265,46.738586'
const rowText = async (page, field) =>
  (await page.locator(`[data-cc-location-row="${field}"]`).innerText()).replace(/\s+/g, ' ').trim()
const tickOf = (page, field) => page.locator(`[data-cc-location-tick="${field}"]`).isChecked()
const lastApply = (srv) => calls(srv, /ApplyLocation$/).at(-1)?.body ?? null

/** Send a link from a fresh order and have the customer send their location: the card. */
async function toCard(page, srv, mobile) {
  await page.locator('[data-cc-location-send]').click()
  await sendFromDialog(page, mobile)
  await page.locator('[data-cc-location-strip]').waitFor({ timeout: 5_000 })
  srv.link.get(`Tok${String(srv.tokens).padStart(9, '0')}`).status = 'Captured'
  await run(page, 3_500)
  await page.locator('[data-cc-location-card]').waitFor({ timeout: 5_000 })
}

async function sendFromDialog(page, mobile) {
  await page.locator('[data-cc-location-dialog]').waitFor({ timeout: 5_000 })
  if (mobile !== undefined) await page.locator('[data-cc-location-mobile]').fill(mobile)
  await page.locator('[data-cc-location-submit]').click()
}

for (const mode of MODES) {
  const at = mode.dir
  console.log(`\n${at}`)

  // ---- 1. hidden, never disabled ----
  for (const flag of [false, 'absent']) {
    const { context, page, errors } = await open(mode, { canSendLocationLink: flag })
    ok(
      (await page.locator('[data-cc-location-send]').count()) === 0 && (await page.locator('[data-cc-location]').count()) === 0,
      `${at}: canSendLocationLink ${flag} → no action and no section at all`,
    )
    allErrors.push(...errors)
    await context.close()
  }

  const { context, page, errors, srv } = await open(mode)
  ok(await page.locator('[data-cc-location-send]').isVisible(), `${at}: canSendLocationLink true → Send location link is shown`)
  const sentence = await page.locator('[data-cc-sentence]').boundingBox()
  const row = await page.locator('[data-cc-location]').boundingBox()
  ok(row && sentence && row.y >= sentence.y + sentence.height - 1, `${at}: it sits on the address row, under the header sentence`)

  // ---- 2. the dialog and the body ----
  await page.locator('[data-cc-location-send]').click()
  await page.locator('[data-cc-location-dialog]').waitFor({ timeout: 5_000 })
  ok(
    (await page.locator('[data-cc-location-mobile]').inputValue()) === MOBILE,
    `${at}: the number is pre-filled from the customer's mobile`,
  )

  // ---- 8. the refusals, in the dialog ----
  srv.next.push(['CCL-00004', 'The mobile number is not valid.'])
  await sendFromDialog(page, '0512')
  await page.locator('[data-cc-location-mobile-error]').waitFor({ timeout: 5_000 })
  ok(
    (await page.locator('[data-cc-location-mobile-error]').innerText()).includes('The mobile number is not valid.') &&
      (await page.locator('[data-cc-location-send-error]').count()) === 0,
    `${at}: CCL-00004 is drawn inline at the number, in the validator's words`,
  )
  ok(
    (await page.locator('[data-cc-location-mobile]').getAttribute('aria-invalid')) === 'true',
    `${at}: and the number is marked invalid`,
  )
  srv.next.push(['CCL-00008', 'Wait 12 seconds before sending another link.'])
  await sendFromDialog(page, MOBILE)
  await page.locator('[data-cc-location-send-error]').waitFor({ timeout: 5_000 })
  ok(
    (await page.locator('[data-cc-location-send-error]').innerText()).includes('Wait 12 seconds'),
    `${at}: CCL-00008 shows the server's message (its seconds left) in the dialog`,
  )
  const limits = {
    'CCL-00009': 'No more links for this order',
    'CCL-00020': 'This number has had 10 links today',
  }
  for (const [code, words] of Object.entries(limits)) {
    srv.next.push([code, 'Limit reached.'])
    await sendFromDialog(page)
    await page.waitForTimeout(250)
    const said = await page.locator('[data-cc-location-send-error]').innerText()
    ok(said.includes(words), `${at}: ${code} reads "${words}" in the dialog`, said)
  }

  // The customer's own number, re-spelled, is not "typed".
  const before = calls(srv, /LocationLinks\/Send$/).length
  await sendFromDialog(page, '+966 55 123 4567')
  await page.locator('[data-cc-location-strip]').waitFor({ timeout: 5_000 })
  const sends = calls(srv, /LocationLinks\/Send$/)
  ok(sends.length === before + 1, `${at}: one Send per press`)
  ok(
    JSON.stringify(sends.at(-1).body) ===
      JSON.stringify({ seatKind: 'OMSWEB', orderContextId: TX1, mobile: '+966 55 123 4567', mobileWasTyped: false }),
    `${at}: the Send body is the contract's four fields — the customer's number re-spelled is not typed`,
    JSON.stringify(sends.at(-1).body),
  )
  ok((await page.locator('[data-cc-location-dialog]').count()) === 0, `${at}: the dialog closes on a sent link`)

  // ---- 3. the waiting strip ----
  ok((await stripState(page)) === 'waiting', `${at}: the strip is waiting`)
  const line = await page.locator('[data-cc-location-line]').innerText()
  ok(line.includes(MASKED), `${at}: it names the masked number`, line)
  ok(
    (await page.locator('[data-cc-location-line] bdi[dir="ltr"]').first().innerText()) === MASKED,
    `${at}: the masked number is isolated whole (Ltr)`,
  )
  ok(/Location link sent to .* - waiting \(\d\d:\d\d\)/.test(line), `${at}: the strip reads the ticket's sentence`, line)
  const c0 = secondsOf(await clockOf(page))
  ok(c0 >= 898 && c0 <= 900, `${at}: the countdown starts at the link's 15 minutes`, String(c0))
  await run(page, 2_000)
  const c1 = secondsOf(await clockOf(page))
  // 1–2, not exactly 2: a poll inside the window re-bases on the server's whole seconds.
  ok(c0 - c1 >= 1 && c0 - c1 <= 2, `${at}: and ticks down with the seconds (${c0} → ${c1} over 2 s)`)
  await page.screenshot({ path: `${SHOTS}/waiting-${at}.png` })

  // ---- 4. the poll, every 3 s on the latest token ----
  const tok1 = 'Tok000000001'
  const polls1 = calls(srv, /Tok000000001\/Status$/).length
  await run(page, 9_000)
  const polls1b = calls(srv, /Tok000000001\/Status$/).length
  ok(polls1b - polls1 >= 3 && polls1b - polls1 <= 4, `${at}: 9 s brings 3 polls of ${tok1}`, `${polls1} → ${polls1b}`)

  // ---- 5. Resend: the cooldown, the same body, the new token ----
  // 11 s have passed since the send: 19 s of cooldown are left.
  const resend = page.locator('[data-cc-location-resend]')
  ok(await resend.isDisabled(), `${at}: Resend is disabled inside 30 s of the send`)
  const left = Number(await resend.getAttribute('data-cc-location-resend-in'))
  ok(left >= 18 && left <= 20 && (await resend.innerText()).includes(String(left)), `${at}: and shows the seconds left (${left})`)
  await run(page, 20_000)
  ok(await resend.isEnabled(), `${at}: Resend opens once 30 s have passed`)
  await resend.click()
  await page.waitForTimeout(250)
  const resent = calls(srv, /LocationLinks\/Send$/).at(-1)
  ok(
    JSON.stringify(resent.body) === JSON.stringify(sends.at(-1).body) &&
      (await page.locator('[data-cc-location-dialog]').count()) === 0,
    `${at}: Resend re-sends the same body, without the dialog`,
  )
  ok(await resend.isDisabled(), `${at}: and the cooldown starts again`)
  const before2 = calls(srv, /Tok000000001\/Status$/).length
  await run(page, 6_000)
  ok(
    calls(srv, /Tok000000002\/Status$/).length >= 2 && calls(srv, /Tok000000001\/Status$/).length === before2,
    `${at}: the poll follows the new token, and the superseded one is no longer asked`,
  )
  const c2 = secondsOf(await clockOf(page))
  ok(c2 >= 893 && c2 <= 895, `${at}: the countdown restarts from the new link's 15 minutes`, String(c2))

  // ---- 6. the unreachable note ----
  srv.failPolls = true
  await run(page, 27_000)
  ok((await stripState(page)) === 'waiting', `${at}: under 30 s of failed polls the countdown stays`)
  // The first failed poll lands up to one 3 s interval after the outage began.
  await run(page, 7_000)
  ok((await stripState(page)) === 'unreachable', `${at}: past 30 s of failure the strip says it can't reach the server`)
  const note = await page.locator('[data-cc-location-line]').innerText()
  ok(
    note.includes("Can't reach the server - still trying"),
    `${at}: in the ticket's words`,
    note,
  )
  ok((await page.locator('[data-cc-location-clock]').count()) === 0, `${at}: in place of the countdown`)
  await page.screenshot({ path: `${SHOTS}/unreachable-${at}.png` })
  const failedPolls = srv.wire.filter((w) => /Tok000000002\/Status$/.test(w.path)).length
  srv.failPolls = false
  await run(page, 3_500)
  ok(
    srv.wire.filter((w) => /Tok000000002\/Status$/.test(w.path)).length > failedPolls &&
      (await stripState(page)) === 'waiting',
    `${at}: polls kept going, and the first good one brings the countdown back`,
  )

  // ---- 7a. lapse → Send again ----
  srv.link.get('Tok000000002').status = 'Lapsed'
  await run(page, 3_500)
  ok((await stripState(page)) === 'expired', `${at}: Lapsed → the link expired`)
  const expired = await page.locator('[data-cc-location-line]').innerText()
  ok(
    expired.includes("Link expired - the customer didn't send a location"),
    `${at}: in the ticket's words`,
    expired,
  )
  ok((await page.locator('[data-cc-location-resend]').count()) === 0, `${at}: no Resend on a dead link`)
  const afterLapse = calls(srv, /Tok000000002\/Status$/).length
  await run(page, 9_000)
  ok(calls(srv, /Tok000000002\/Status$/).length === afterLapse, `${at}: and the poll has stopped`)
  await page.screenshot({ path: `${SHOTS}/expired-${at}.png` })
  await page.locator('[data-cc-location-again]').click()
  ok(await page.locator('[data-cc-location-dialog]').isVisible(), `${at}: Send again opens the dialog`)

  // A typed number is typed.
  await sendFromDialog(page, '0509876543')
  await page.waitForTimeout(250)
  ok(
    JSON.stringify(calls(srv, /LocationLinks\/Send$/).at(-1).body) ===
      JSON.stringify({ seatKind: 'OMSWEB', orderContextId: TX1, mobile: '0509876543', mobileWasTyped: true }),
    `${at}: another number goes as typed, mobileWasTyped true`,
  )
  ok((await stripState(page)) === 'waiting', `${at}: and a new strip waits`)

  // ---- 7b. superseded → Send again ----
  srv.link.get('Tok000000003').status = 'Superseded'
  await run(page, 3_500)
  ok((await stripState(page)) === 'replaced', `${at}: Superseded → the link was replaced`)
  const replaced = await page.locator('[data-cc-location-line]').innerText()
  ok(
    replaced.includes('This link was replaced - send a new one'),
    `${at}: in the ticket's words`,
    replaced,
  )
  ok(await page.locator('[data-cc-location-again]').isVisible(), `${at}: with Send again`)
  await page.screenshot({ path: `${SHOTS}/replaced-${at}.png` })

  // ---- 7c. captured → the card (575), in the strip's place ----
  await page.locator('[data-cc-location-again]').click()
  await sendFromDialog(page)
  await page.waitForTimeout(250)
  srv.link.get('Tok000000004').status = 'Captured'
  await run(page, 3_500)
  ok(
    (await page.locator('[data-cc-location-card]').isVisible()) && (await page.locator('[data-cc-location-strip]').count()) === 0,
    `${at}: Captured → the card replaces the strip`,
  )
  const cardBox = await page.locator('[data-cc-location-card]').boundingBox()
  ok(cardBox && cardBox.y >= sentence.y + sentence.height - 1, `${at}: in the same place, under the header sentence`)
  const capturedPolls = calls(srv, /Tok000000004\/Status$/).length
  await run(page, 9_000)
  ok(calls(srv, /Tok000000004\/Status$/).length === capturedPolls, `${at}: Captured stops the poll`)

  // The rows, against an order with no pin, the same Short Address and an empty line 2.
  ok(
    (await rowText(page, 'pin')).includes("Pinned by the customer's phone (±12 m)"),
    `${at}: the pin row says the phone pinned it, with its accuracy`,
    await rowText(page, 'pin'),
  )
  ok(
    (await page.locator('[data-cc-location-coords]').innerText()).trim() === '24.774265, 46.738586' &&
      (await page.locator('[data-cc-location-coords] bdi[dir="ltr"]').count()) === 1,
    `${at}: the coordinates are one copyable string, isolated whole`,
  )
  const maps = page.locator('[data-cc-location-card] [data-cc-location-maps]')
  ok(
    (await maps.getAttribute('href')) === MAPS_URL &&
      (await maps.getAttribute('target')) === '_blank' &&
      /noopener/.test((await maps.getAttribute('rel')) ?? ''),
    `${at}: Open in Google Maps is the search URL, in a new tab`,
    await maps.getAttribute('href'),
  )
  ok((await page.locator('[data-cc-location-note="pin"]').count()) === 0, `${at}: no earlier pin, so nothing is replaced`)
  ok(await tickOf(page, 'pin'), `${at}: the pin is ticked`)
  ok(
    (await page.locator('[data-cc-location-short]').innerText()).trim() === 'RIMA6904' &&
      (await page.locator('[data-cc-location-note="shortAddress"]').count()) === 0 &&
      (await tickOf(page, 'shortAddress')),
    `${at}: the Short Address, ticked, with no note when the order has the same one`,
  )
  ok(
    (await rowText(page, 'details')).includes('Details into Address line 2') &&
      (await rowText(page, 'details')).includes('Villa 4, second gate') &&
      (await tickOf(page, 'details')),
    `${at}: the details tick into Address line 2 while it is empty`,
  )
  ok(
    (await page.locator('[data-cc-location-tick="saveToCustomer"]').isVisible()) &&
      !(await tickOf(page, 'saveToCustomer')) &&
      (await rowText(page, 'saveToCustomer')).includes('Also save to this customer address'),
    `${at}: Also save to this customer address is shown, unticked`,
  )
  await page.screenshot({ path: `${SHOTS}/card-${at}.png` })

  // Untick a row, Apply → the chip; the body is the ticks and nothing else.
  await page.locator('[data-cc-location-tick="shortAddress"]').uncheck()
  await page.locator('[data-cc-location-apply]').click()
  await page.locator('[data-cc-location-chip]').waitFor({ timeout: 5_000 })
  const applies = calls(srv, /ApplyLocation$/)
  const applied = applies.at(-1)?.body ?? {}
  ok(applies.length === 1, `${at}: one Apply per press`)
  ok(
    JSON.stringify({ ...applied, requestId: '·' }) ===
      JSON.stringify({
        transactionId: TX1,
        requestId: '·',
        token: 'Tok000000004',
        applyPin: true,
        applyShortAddress: false,
        applyDetails: true,
        saveToCustomer: false,
      }) && typeof applied.requestId === 'string' && applied.requestId.length > 0,
    `${at}: the Apply body is the contract's seven fields — the untick travels`,
    JSON.stringify(applied),
  )
  ok(
    !['24.77', '46.73', 'RIMA6904', 'Villa', 'DEVICE'].some((v) => JSON.stringify(applied).includes(v)),
    `${at}: and no captured value is in it`,
  )
  const chip = (await page.locator('[data-cc-location-chip]').innerText()).replace(/\s+/g, ' ').trim()
  ok(/^Location applied \d\d:\d\d · Open in Google Maps$/.test(chip), `${at}: the chip reads "Location applied hh:mm · Open in Google Maps"`, chip)
  ok(
    (await page.locator('[data-cc-location-chip] [data-cc-location-maps]').getAttribute('href')) === MAPS_URL,
    `${at}: and its map link is the pin's`,
  )
  ok((await page.locator('[data-cc-location-card]').count()) === 0, `${at}: the card is gone`)
  await page.screenshot({ path: `${SHOTS}/chip-${at}.png` })
  await run(page, 9_000)
  ok(
    (await page.locator('[data-cc-location-chip]').isVisible()) &&
      calls(srv, /Tok000000004\/Status$/).length === capturedPolls &&
      calls(srv, /ApplyLocation$/).length === 1,
    `${at}: the chip stays, and nothing is asked again`,
  )

  // ---- 9a. Retire on submit ----
  await page.locator('[data-cc-submit]').click()
  await page.waitForTimeout(400)
  const retireOnSubmit = calls(srv, /LocationLinks\/Retire$/)
  ok(
    retireOnSubmit.length === 1 && JSON.stringify(retireOnSubmit[0].body) === JSON.stringify({ orderContextId: TX1 }),
    `${at}: placing the order retires its link — { orderContextId: transactionId }`,
    JSON.stringify(retireOnSubmit.map((w) => w.body)),
  )
  ok((await page.locator('[data-cc-location]').count()) === 0, `${at}: and the chip goes with the open order`)
  ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
  allErrors.push(...errors)
  await context.close()

  // ---- 9b. Retire on abandon ----
  {
    const { context, page, errors, srv } = await open(mode)
    await page.locator('[data-cc-location-send]').click()
    await sendFromDialog(page)
    await page.locator('[data-cc-location-strip]').waitFor({ timeout: 5_000 })
    await page.locator('[data-cc-abandon]').click()
    await page.locator('[data-cc-abandon-confirm]').click()
    await page.waitForFunction(
      (tx) => document.querySelector('[data-cc-transaction]')?.getAttribute('data-cc-transaction') === tx,
      TX2,
      { timeout: 10_000 },
    )
    const retire = calls(srv, /LocationLinks\/Retire$/)
    ok(
      retire.length === 1 && JSON.stringify(retire[0].body) === JSON.stringify({ orderContextId: TX1 }),
      `${at}: abandoning the order retires its link`,
      JSON.stringify(retire.map((w) => w.body)),
    )
    const order = srv.wire.map((w) => w.path).filter((p) => /Abandon$|Retire$|Open$/.test(p))
    ok(
      order.indexOf('CallCenterWeb/Abandon') < order.indexOf('CallCenterWeb/LocationLinks/Retire'),
      `${at}: after the abandon landed`,
      order.join(' → '),
    )
    ok(
      (await page.locator('[data-cc-location-strip]').count()) === 0 &&
        (await page.locator('[data-cc-location-send]').isVisible()),
      `${at}: the fresh order holds no link — the action is back, no strip`,
    )

    // ---- 8b. CCL-00001 hides the action for the order ----
    srv.next.push(['CCL-00001', 'The location link is not configured.'])
    await page.locator('[data-cc-location-send]').click()
    await sendFromDialog(page)
    await page.waitForTimeout(300)
    ok(
      (await page.locator('[data-cc-location]').count()) === 0 && (await page.locator('[data-cc-location-dialog]').count()) === 0,
      `${at}: CCL-00001 closes the dialog and hides the action`,
    )
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }

  // ---- 9c. a failed Retire is never shown ----
  {
    const { context, page, errors, srv } = await open(mode)
    await page.route('**/api/CallCenterWeb/LocationLinks/Retire', (route) => {
      srv.wire.push({ path: 'CallCenterWeb/LocationLinks/Retire', body: JSON.parse(route.request().postData()) })
      return route.fulfill({ status: 500, contentType: 'text/plain', body: 'boom' })
    })
    await page.locator('[data-cc-submit]').click()
    await page.waitForTimeout(400)
    ok(calls(srv, /LocationLinks\/Retire$/).length === 1, `${at}: an order that could send a link is retired even with none sent here`)
    ok(
      (await page.locator('[data-sonner-toast]').count()) === 0 && (await page.locator('[data-cc-submit-failed]').count()) === 0,
      `${at}: a failed Retire is logged, never shown`,
    )
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }

  // ---- 10. the card's notes, against an order that already holds a pin, another Short
  //          Address and a filled line 2; a hand-placed pin with no Short Address ----
  {
    const { context, page, errors, srv } = await open(mode, {
      address: { gpsLat: 24.7, gpsLon: 46.6, shortAddress: 'RRRD2929', line2: null },
    })
    await toCard(page, srv)
    ok(
      (await page.locator('[data-cc-location-note="pin"]').innerText()).includes('Replaces the earlier pin'),
      `${at}: an order with a different pin → "Replaces the earlier pin"`,
    )
    const has = page.locator('[data-cc-location-note="shortAddress"]')
    ok(
      (await has.innerText()).includes('Order has: RRRD2929') && (await has.locator('bdi[dir="ltr"]').innerText()) === 'RRRD2929',
      `${at}: a different Short Address → "Order has: RRRD2929", the code isolated`,
    )
    ok(await tickOf(page, 'shortAddress'), `${at}: and it is still ticked`)
    await page.screenshot({ path: `${SHOTS}/card-notes-${at}.png` })
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }
  {
    const { context, page, errors, srv } = await open(mode, {
      address: { line2: 'Flat 2' },
      capture: { ...CAPTURE, pinSource: 'MANUAL', accuracyMeters: 0, shortAddress: '' },
    })
    await toCard(page, srv)
    ok((await rowText(page, 'pin')).includes('Placed by hand on the map'), `${at}: a MANUAL pin → "Placed by hand on the map"`)
    ok(
      (await page.locator('[data-cc-location-tick="shortAddress"]').count()) === 0 &&
        (await page.locator('[data-cc-location-note="shortAddress"]').innerText()).includes(
          "Not given - the order's Short Address is kept",
        ),
      `${at}: no Short Address given → no tick, "the order's Short Address is kept"`,
    )
    ok(
      (await page.locator('[data-cc-location-tick="details"]').count()) === 0 &&
        (await page.locator('[data-cc-location-copy]').isVisible()) &&
        (await page.locator('[data-cc-location-note="details"]').innerText()).includes(
          'Address line 2 is already filled - copy by hand',
        ),
      `${at}: line 2 filled → no tick, a Copy button and the note`,
    )
    await page.screenshot({ path: `${SHOTS}/card-copy-${at}.png` })
    await page.locator('[data-cc-location-apply]').click()
    await page.locator('[data-cc-location-chip]').waitFor({ timeout: 5_000 })
    const body = lastApply(srv)
    ok(
      body && body.applyPin === true && body.applyShortAddress === false && body.applyDetails === false && body.saveToCustomer === false,
      `${at}: Apply sends no tick the card did not offer`,
      JSON.stringify(body),
    )
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }
  {
    const { context, page, errors, srv } = await open(mode, { customer: null })
    await toCard(page, srv, MOBILE)
    ok(
      (await page.locator('[data-cc-location-row="saveToCustomer"]').count()) === 0,
      `${at}: no customer attached → no save-to-customer tick`,
    )
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }

  // ---- 11. the refusals ----
  {
    const { context, page, errors, srv } = await open(mode)
    await toCard(page, srv)

    // The two save refusals: inline on the save tick, the card stays, untick and Apply again.
    for (const [which, words] of [
      ['noCustomer', 'There is no customer on this order'],
      ['notTheirs', "This order's address is not in this customer's address book"],
    ]) {
      await page.locator('[data-cc-location-tick="saveToCustomer"]').check()
      srv.applyNext.push(APPLY_REFUSALS[which])
      await page.locator('[data-cc-location-apply]').click()
      await page.locator('[data-cc-location-save-error]').waitFor({ timeout: 5_000 })
      ok(
        (await page.locator('[data-cc-location-save-error]').innerText()).includes(words) &&
          (await page.locator('[data-cc-location-card]').isVisible()) &&
          lastApply(srv).saveToCustomer === true,
        `${at}: ${APPLY_REFUSALS[which][0]} → inline on the save tick, the card stays open`,
      )
      ok(
        !(await page.locator('[data-cc-location-save-error]').innerText()).includes('not found'),
        `${at}: in the console's words, not the server's "not found"`,
      )
    }
    await page.screenshot({ path: `${SHOTS}/save-refused-${at}.png` })
    await page.locator('[data-cc-location-tick="saveToCustomer"]').uncheck()
    ok((await page.locator('[data-cc-location-save-error]').count()) === 0, `${at}: unticking clears it`)

    // CCL-00030: the card stays and the same press is tried once more on the next poll.
    srv.applyNext.push(APPLY_REFUSALS.notYet)
    const before = calls(srv, /ApplyLocation$/).length
    await page.locator('[data-cc-location-apply]').click()
    await page.waitForTimeout(250)
    ok(
      (await page.locator('[data-cc-location-card]').isVisible()) &&
        (await page.locator('[data-cc-location-card-error]').count()) === 0 &&
        calls(srv, /ApplyLocation$/).length === before + 1,
      `${at}: CCL-00030 keeps the card, quietly`,
    )
    srv.applyNext.push(APPLY_REFUSALS.notYet)
    await run(page, 3_500)
    const tried = calls(srv, /ApplyLocation$/)
    ok(
      tried.length === before + 2 && JSON.stringify(tried.at(-1).body) === JSON.stringify(tried.at(-2).body),
      `${at}: and retries the same press once, on the next poll`,
      String(tried.length - before),
    )
    ok(
      (await page.locator('[data-cc-location-card-error]').innerText()).includes('The server has no location for this link yet'),
      `${at}: a second "not yet" is said on the card`,
    )
    await run(page, 6_000)
    ok(calls(srv, /ApplyLocation$/).length === before + 2, `${at}: and only once`)

    // CCL-00031: re-read the order and the capture; its stamp draws the chip.
    const link = srv.link.get('Tok000000001')
    link.capture = { ...link.capture, appliedAt: '2026-10-26T10:05:00', appliedBy: 'm.saleh' }
    srv.applyNext.push(APPLY_REFUSALS.stamped)
    const states = calls(srv, /CallCenterWeb\/State$/).length
    const statuses = calls(srv, /Tok000000001\/Status$/).length
    await page.locator('[data-cc-location-apply]').click()
    await page.locator('[data-cc-location-chip]').waitFor({ timeout: 5_000 })
    ok(
      calls(srv, /CallCenterWeb\/State$/).length > states && calls(srv, /Tok000000001\/Status$/).length > statuses,
      `${at}: CCL-00031 re-reads the order and the link`,
    )
    const chip = (await page.locator('[data-cc-location-chip]').innerText()).replace(/\s+/g, ' ')
    ok(chip.includes('Location applied 10:05'), `${at}: and shows the chip at the capture's own stamp`, chip)
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }
  {
    const { context, page, errors, srv } = await open(mode)
    // CCL-00006 on Apply: drop the card, offer Send again.
    await toCard(page, srv)
    srv.applyNext.push(APPLY_REFUSALS.noLink)
    await page.locator('[data-cc-location-apply]').click()
    await page.waitForTimeout(300)
    ok(
      (await page.locator('[data-cc-location-card]').count()) === 0 && (await stripState(page)) === 'gone',
      `${at}: CCL-00006 on Apply drops the card`,
    )
    ok(
      (await page.locator('[data-cc-location-line]').innerText()).includes('This link is no longer available - send a new one') &&
        (await page.locator('[data-cc-location-again]').isVisible()),
      `${at}: and offers Send again`,
    )
    await page.screenshot({ path: `${SHOTS}/gone-${at}.png` })

    // CCL-00031 over a DISCARDED capture: the strip, not the chip.
    await page.locator('[data-cc-location-again]').click()
    await sendFromDialog(page)
    // The dead strip is already on screen: wait for the NEW link's, not any strip.
    await page.locator('[data-cc-location-strip="waiting"]').waitFor({ timeout: 5_000 })
    ok((await stripState(page)) === 'waiting', `${at}: Send again starts a new link`)
    const second = srv.link.get('Tok000000002')
    second.status = 'Captured'
    await run(page, 3_500)
    await page.locator('[data-cc-location-card]').waitFor({ timeout: 5_000 })
    second.capture = { ...second.capture, discardedAt: '2026-10-26T10:06:00', discardedBy: 'm.saleh' }
    srv.applyNext.push(APPLY_REFUSALS.stamped)
    await page.locator('[data-cc-location-apply]').click()
    await page.waitForTimeout(400)
    ok(
      (await stripState(page)) === 'discarded' &&
        (await page.locator('[data-cc-location-chip]').count()) === 0 &&
        (await page.locator('[data-cc-location-again]').isVisible()),
      `${at}: CCL-00031 over a discarded capture → "Location discarded" with Send again`,
    )

    // CCL-00006 on the STATUS poll: the link is dropped at once — not a failed poll.
    await page.locator('[data-cc-location-again]').click()
    await sendFromDialog(page)
    // The dead strip is already on screen: wait for the NEW link's, not any strip.
    await page.locator('[data-cc-location-strip="waiting"]').waitFor({ timeout: 5_000 })
    srv.link.delete('Tok000000003')
    await run(page, 3_500)
    ok((await stripState(page)) === 'gone', `${at}: CCL-00006 on the status poll → Send again within one poll, not the 30 s note`)
    const polled = calls(srv, /Tok000000003\/Status$/).length
    await run(page, 9_000)
    ok(calls(srv, /Tok000000003\/Status$/).length === polled, `${at}: and the poll stops`)
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }
  {
    // CCL-00001 on Apply: the card and the action go.
    const { context, page, errors, srv } = await open(mode)
    await toCard(page, srv)
    srv.applyNext.push(APPLY_REFUSALS.notConfigured)
    await page.locator('[data-cc-location-apply]').click()
    await page.waitForTimeout(300)
    ok((await page.locator('[data-cc-location]').count()) === 0, `${at}: CCL-00001 on Apply drops the card and hides the action`)
    ok(errors.length === 0, `${at}: no console errors`, errors[0] ?? '')
    allErrors.push(...errors)
    await context.close()
  }
}

ok(allErrors.length === 0, `nothing threw (${allErrors.length})`)
console.log('\n⚠ STUB: every SIS.Api answer is stubbed (BackOffice 2483–2491 not yet on staging; live walk is 577).')
console.log(`\n${pass} passed, ${fail} failed`)
await browser.close()
process.exit(fail ? 1 : 0)
