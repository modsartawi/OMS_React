// The address editor's drive (tickets 187 and 188) — the REAL console in
// Chromium, with only the wire stubbed.
//
//   1. run the app:  npx vite --port 5211
//   2. node tools/address-editor-drive.mjs
//
// ⚠ THE ADDRESS WRITES STAND ON HAND-AUTHORED FIXTURES AND THIS DRIVE SAYS SO
// (177's rule, as 159 applies it). The five `CallCenterWeb/CustomerAddresses*`
// routes ship (BackOffice 801) and 878's narrowing is `done` server-side, but no
// SIS.Api runs beside this drive — the book, the write answers, the district list
// and the label catalogue below are this drive's, not captures. The SESSION
// payload underneath them is the contract's own committed fixture.
//
// What it asserts — the ticket's Proof, plus the two capture rules that are only
// observable ON THE WIRE and therefore cannot be asserted anywhere else:
//
//   creating an address auto-applies it to the order
//     1. an agent with no address on file reaches the form from inside the book
//        — one dialog, two views: the list is REPLACED, never covered;
//     2. the district picker is one box that matches a CITY as well as a
//        district, and one pick commits both;
//     3. Save sends ONE `POST CustomerAddresses` whose body is the narrow
//        capture: the label plus twelve values, no `countryKey` / `languageKey` /
//        `addressType`, and none of the thirteen fields CC2 never filled;
//     4. 🚩 a box the agent left empty is `""` on the wire and NEVER `null` —
//        the null-coalescing merge would read a null as *keep what is there*;
//     5. the minted `addressNumber` goes straight to `SetAddress` with no
//        re-read of the book in between, and the order's rail shows the address;
//     6. the book closes behind it — the agent is back on the order.
//
//   editing a NON-CURRENT address leaves the order alone
//     7. the edit control is ABSENT on the address the order is using (188 owns
//        the re-pin; offering it here would be the silent wrong price §6.5 exists
//        to prevent) and present on every other row;
//     8. the form opens seeded from the book row, in the same dialog;
//     9. Save sends ONE `PUT` naming that address, carrying the same narrow body,
//        with a cleared box as `""`;
//    10. 🚩 NO `SetAddress` follows it and the order's address is untouched —
//        a book act on a row the order is not using is not an order act;
//    11. the GPS pair the console cannot capture is round-tripped, never zeroed.
//
//   a store-less district is visibly unpickable
//    12. a district carrying neither `storeCode` nor `tempStoreCode` is rendered,
//        disabled, and says why — visible and unpickable (§2.3), never hidden;
//    13. no store code reaches the DOM at all — the client asks *whether*, never
//        *which*;
//    14. a malformed national address blocks Save and says the format, and there
//        is no *verified* affordance anywhere on the field (SPL is unwired);
//
//   a created address the ORDER refuses — §6.5's named consequence
//    15. `NO_DELIVERY_STORE_FOR_DISTRICT` reaches the agent as a sentence, never
//        as a machine code, and says the ORDER is unchanged (which is what they
//        are asking about — the book keeps the caller's real address);
//    16. 🚩 the address they just keyed IS on the book in front of them, put
//        there by the create's own answer rather than by a second read — a list
//        missing it is what would invite them to key it twice;
//    17. no state throws.
//
// ---- 188: the two book writes that reach into the order ------------------
//
//   editing the order's OWN address re-pins the store
//    18. the edit control is present on that row now (187 withheld it until the
//        re-pin existed; this drive's own assertion flips with the ticket);
//    19. one `PUT` lands and is FOLLOWED by one `SetAddress` carrying THE SAME
//        `addressNumber` — the whole of §6.5 rule 1, on the wire, in order;
//    20. 🚩 what the agent meets is §5.1's store-move PREVIEW, not a moved
//        plant: an edit across districts is answered exactly as a different
//        address would have been;
//    21. an edit of a row the order is NOT using still sends no `SetAddress` —
//        the assertion that would fail if anyone treated the two alike.
//
//   an edit the order refuses — §6.5's named consequence, the second shape
//    22. the `PUT` lands, the re-pin answers `NO_DELIVERY_STORE_FOR_DISTRICT`,
//        and BOTH facts are on screen: the book kept the correction and the
//        order kept the store and address it had;
//    23. the order's rail is untouched — the console does not roll back a
//        correction the caller just made.
//
//   deleting is refused, and the control is not there to press
//    24. no delete control on the row the order is using, and one on every
//        other row (`AddressChoice.isCurrent`);
//    25. the delete asks a second time IN PLACE — no dialog on top of the book;
//    26. one `DELETE` on the wire naming that address on the QUERY STRING;
//    27. 🚩 `ADDRESS_IN_USE_BY_ORDER` reaches the agent as a sentence even
//        though this UI cannot provoke it — the refusal is the guard and the
//        omission only the courtesy, so the client handles the code.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5211}`

// The contract's own fixture, verbatim — the session half of every scenario.
const raw = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
const fixture = (name) => raw(name).response.body.data
const OPEN_RESULT = fixture('01-open-empty')
// 188 — a basket with lines, and the preview a rebind of one answers. Both are
// the contract's own committed captures: the point of §6.5 rule 1 is that an
// edit takes the ORDINARY store-move path, so the drive must show the ordinary
// store-move payload rather than one written for this scenario.
const LINES = fixture('02-two-lines-priced').lines
const STORE_MOVE = raw('05-rebind-preview').preview.response.body.data.pendingConfirmation

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

/* ------------------------------------------------------- stub  ⚠ hand-authored */

const CUSTOMER = {
  customerId: '8801234567',
  name: 'Nouf A. Al-Qahtani',
  mobile: '+966551234567',
  loyaltyAttached: true,
}

// Three districts, and the third is the point: an ops row carrying no delivering
// store at all. The insurance store is populated on it deliberately — it is NOT
// a delivery store (D-22) and a client that read it would call the row pickable.
const DISTRICTS = [
  district('R-114', 'Al Malqa', '0021', 'Riyadh', { storeCode: '1101' }),
  district('J-201', 'Al Rawdah', '0031', 'Jeddah', { storeCode: '', tempStoreCode: '1288' }),
  district('R-990', 'Al Nakheel', '0021', 'Riyadh', { storeCode: '', insuranceStoreCode: '9901' }),
]

function district(districtCode, districtNameEn, cityCode, cityNameEn, over) {
  return {
    districtCode,
    cityCode,
    cityNameAr: cityNameEn,
    cityNameEn,
    magentoCityEn: '',
    magentoCityAr: '',
    districtNameAr: districtNameEn,
    districtNameEn,
    storeCode: '',
    insuranceStoreCode: '',
    tempStoreCode: '',
    createdOn: '',
    createdBy: '',
    updatedOn: '',
    updatedBy: '',
    latitude: 0,
    longitude: 0,
    ...over,
  }
}

const LABELS = [
  { labelCode: 'HOME', labelNameAr: 'المنزل', labelNameEn: 'Home' },
  { labelCode: 'WORK', labelNameAr: 'العمل', labelNameEn: 'Work' },
]

/** A book row, the shape `GET CustomerAddresses` answers (a whole BusinessAddress). */
const bookRow = (addressNumber, over = {}) => ({
  addressNumber,
  labelCode: 'HOME',
  labelNameEn: 'Home',
  isDefault: false,
  ...over,
  address: {
    cityCode: '0021',
    cityName: 'Riyadh',
    districtCode: 'R-114',
    districtName: 'Al Malqa',
    street1: 'King Abdulaziz Rd',
    street2: 'Exit 5',
    buildingNumber: 'Bldg 4',
    phone1: '0551234567',
    phone2: null,
    shortAddress: 'RIMA6904',
    // 🚩 The pair the console cannot capture and must not zero.
    gpsLat: 24.7743,
    gpsLon: 46.7386,
    ...(over.address ?? {}),
  },
})

/** The order's own address, as the projection carries it (composed, no fields). */
const onOrder = (addressNumber) => ({
  addressNumber,
  label: 'Home',
  cityCode: '0021',
  cityName: 'Riyadh',
  districtCode: 'R-114',
  districtName: 'Al Malqa',
  line: 'King Abdulaziz Rd, Exit 5, Bldg 4, Al Malqa, Riyadh',
})

/**
 * The state the console opens on: the contract's empty order with a caller
 * ATTACHED, because the address book is unreachable before attach (§6.3) and
 * this drive's subject starts after it.
 */
function seedState({ address = null, lines = [] } = {}) {
  const state = OPEN_RESULT.state
  return {
    ...state,
    lines,
    header: { ...state.header, customer: CUSTOMER, address },
    capabilities: {
      ...state.capabilities,
      canOpenAddressBook: true,
      canChangeStore: true,
    },
  }
}

// §7's district refusal, as the door answers it: a 409 CARRYING the envelope, so
// `core/api.ts` maps it to kind:'business' and `apiErrorCode()` can read it.
const NO_DELIVERY_STORE = {
  status: 409,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 409,
    success: false,
    message: 'No delivery store is configured for that district.',
    errors: [{ errorCode: 'NO_DELIVERY_STORE_FOR_DISTRICT', internalErrorCode: '', errorMessage: '' }],
    data: null,
  }),
}

// 188 §6.5 rule 2, as the door answers it — a 409 CARRYING the envelope. The
// console's own UI never provokes this (the control is absent on that row); it
// is stubbed so the drive can prove the client says a SENTENCE for a code the
// guard, not the omission, is responsible for.
const IN_USE_BY_ORDER = {
  status: 409,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 409,
    success: false,
    message: 'That address is in use by an open order.',
    errors: [{ errorCode: 'ADDRESS_IN_USE_BY_ORDER', internalErrorCode: '', errorMessage: '' }],
    data: null,
  }),
}

async function open(
  browser,
  { book, state, applyRefused = false, applyPreviews = false, deleteRefused = false },
) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  /** Every write, with its body — where the two capture rules are PROVEN. */
  const wire = []
  let served = state
  let currentBook = book

  page.on('pageerror', (e) => errors.push(String(e)))
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const p = request.url().split('/api/')[1].split('?')[0]
    const method = request.method()
    calls.push(`${method} ${p}`)
    let body = null
    if (method !== 'GET' && method !== 'DELETE') {
      try {
        body = request.postDataJSON()
      } catch {
        body = null
      }
    }
    if (body !== null) wire.push({ method, path: p, body })
    // A DELETE names its target on the QUERY STRING (801's route shape), so its
    // payload is not in a body and is recorded from the URL instead.
    if (method === 'DELETE')
      wire.push({ method, path: p, query: Object.fromEntries(new URL(request.url()).searchParams) })

    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') return route.fulfill(envelope({ canOpenConsole: true }))
    if (p === 'CallCenterWeb/Open')
      return route.fulfill(envelope({ outcome: 'opened', state: served, existing: null }))
    if (p === 'CallCenterWeb/State') return route.fulfill(envelope(served))

    // ---- the reference reads, off the door on their own paths (801) ----
    if (p === 'SdDocument/Districts') return route.fulfill(envelope(DISTRICTS))
    if (p === 'SdDocument/AddressLabels') return route.fulfill(envelope(LABELS))
    if (p === 'SdDocument/StoreDetails') return route.fulfill(envelope([]))

    // ---- the book, and its two writes ----
    if (p === 'CallCenterWeb/CustomerAddresses') {
      if (method === 'GET') return route.fulfill(envelope(currentBook))
      if (method === 'POST') {
        // 🚩 `AddCustomerAddress` answers the whole row INCLUDING the new
        // number — which is what lets a create auto-apply with no re-read.
        const created = bookRow('99001', { labelCode: body.labelCode, address: body.address })
        currentBook = [...currentBook, created]
        return route.fulfill(envelope(created))
      }
      if (method === 'PUT') {
        currentBook = currentBook.map((row) =>
          row.addressNumber === body.addressNumber
            ? bookRow(row.addressNumber, { labelCode: body.labelCode, address: body.address })
            : row,
        )
        return route.fulfill(envelope(true))
      }
      if (method === 'DELETE') {
        if (deleteRefused) return route.fulfill(IN_USE_BY_ORDER)
        const gone = new URL(request.url()).searchParams.get('addressNumber')
        currentBook = currentBook.filter((row) => row.addressNumber !== gone)
        return route.fulfill(envelope(true))
      }
    }
    if (p === 'CallCenterWeb/SetAddress') {
      if (applyRefused) return route.fulfill(NO_DELIVERY_STORE)
      // §5.1 on the SUCCESS path: the unchanged state plus a token to commit
      // with. 🚩 The version does NOT move — nothing was persisted — and that is
      // what makes this a preview rather than a rebind the agent never saw.
      if (applyPreviews && !body.confirmToken)
        return route.fulfill(envelope({ ...served, pendingConfirmation: STORE_MOVE }))
      served = { ...served, version: served.version + 1, header: { ...served.header, address: onOrder(body.addressNumber) } }
      return route.fulfill(envelope(served))
    }

    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }))
    return route.fulfill(envelope([]))
  })

  return { context, page, errors, calls, wire }
}

const CONSTANTS = ['countryKey', 'languageKey', 'addressType']
const NEVER_FILLED = [
  'postalCode',
  'poBox',
  'houseNumber',
  'floorNumber',
  'apartmentNumber',
  'name1',
  'name2',
  'titleCode',
  'phone1Ext',
]

/** The narrowing and the `""`-not-null rule, read off one write's body. */
function assertNarrowCapture(label, body) {
  const address = body?.address ?? {}
  check(
    `${label}: the body is the label and the capture, and nothing else`,
    JSON.stringify(Object.keys(body).sort()) === JSON.stringify(['address', 'labelCode']),
    Object.keys(body).join(', '),
  )
  check(
    `${label}: the twelve captured values, no more`,
    Object.keys(address).length === 12,
    `${Object.keys(address).length} keys`,
  )
  check(
    `${label}: none of the three constants — they are stamped server-side`,
    CONSTANTS.every((k) => !(k in address)),
  )
  check(
    `${label}: none of the thirteen fields CC2 has never filled`,
    NEVER_FILLED.every((k) => !(k in address)),
  )
  // 🚩 The rule a mapper written from the endpoint signature alone gets
  // backwards. `null` here would mean *keep what is there*, so a box the agent
  // deliberately emptied would silently keep its old value.
  check(
    `${label}: no null anywhere in the body`,
    !JSON.stringify(body).includes('null') && Object.values(address).every((v) => v !== null && v !== undefined),
  )
}

async function run() {
  const browser = await chromium.launch()
  console.log('\n⚠ the address writes, the book, the district list and the labels below are STUBS\n')

  /* ------------------------------------ create: the caller with nothing on file */
  {
    console.log('creating an address for a caller with an empty book')
    const { context, page, errors, calls, wire } = await open(browser, {
      book: [],
      state: seedState(),
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    await page.locator('[data-cc-pick-address]').click()
    await page.locator('[data-cc-address-picker]').waitFor()
    check('an empty book says so', await page.locator('[data-cc-address-empty]').isVisible())

    await page.locator('[data-cc-address-add]').click()
    await page.locator('[data-cc-address-form]').waitFor()

    // 1. One dialog, two views — the list is REPLACED, not covered. Two open
    //    dialogs would be the modal-on-modal `AddressPicker` rejected in 166.
    const dialogs = await page.locator('dialog[open]').count()
    check('the form REPLACES the list inside one dialog', dialogs === 1 && (await page.locator('[data-cc-address-picker]').count()) === 0, `${dialogs} open dialog(s)`)

    // 2. One box, matching a CITY — a caller who names either is answered in one
    //    step, and the pick commits both.
    await page.locator('[data-cc-district-search]').fill('jed')
    await page.locator('[data-cc-district-option="J-201"]').waitFor()
    check(
      'the one box matches on the city, not just the district',
      (await page.locator('[data-cc-district-option]').count()) === 1,
    )
    await page.locator('[data-cc-district-option="J-201"]').click()
    check(
      'one pick commits the district AND its city',
      /Al Rawdah/.test(await page.locator('[data-cc-district-current="J-201"]').innerText()) &&
        /Jeddah/.test(await page.locator('[data-cc-district-current="J-201"]').innerText()),
    )

    await page.locator('[data-cc-address-field="street1"]').fill('Prince Sultan Rd')
    await page.locator('[data-cc-address-field="buildingNumber"]').fill('7')
    await page.locator('[data-cc-address-field="phone1"]').fill('0559876543')
    // `street2` and `phone2` are left EMPTY on purpose — they are what proves
    // the `""`-never-null rule on the create path.
    await page.locator('[data-cc-address-save]').click()

    await page.locator('[data-cc-address="set"]').waitFor({ timeout: 10_000 })

    const posts = wire.filter((w) => w.method === 'POST' && w.path === 'CallCenterWeb/CustomerAddresses')
    check('one create is sent', posts.length === 1, `${posts.length} POST(s)`)
    assertNarrowCapture('create', posts[0]?.body ?? {})
    check(
      'the district pick is on the wire as four values',
      posts[0]?.body.address.districtCode === 'J-201' &&
        posts[0]?.body.address.districtName === 'Al Rawdah' &&
        posts[0]?.body.address.cityCode === '0031' &&
        posts[0]?.body.address.cityName === 'Jeddah',
    )
    check(
      '🚩 an empty box is "" on the wire, never null',
      posts[0]?.body.address.street2 === '' && posts[0]?.body.address.phone2 === '',
    )

    // 5. The minted number goes straight to `setAddress`, with NO book re-read
    //    in between — the create answers the whole row, so there is nothing to
    //    go back for.
    const order = calls.indexOf('POST CallCenterWeb/CustomerAddresses')
    const applied = calls.indexOf('POST CallCenterWeb/SetAddress')
    const sets = wire.filter((w) => w.path === 'CallCenterWeb/SetAddress')
    check('the create auto-applies to the order', sets.length === 1 && sets[0].body.addressNumber === '99001')
    check(
      'the apply follows the create with no book re-read between them',
      order >= 0 && applied === order + 1,
      calls.slice(order, applied + 1).join(' → '),
    )
    check(
      'the order shows the address the agent just keyed',
      /Al Malqa|King Abdulaziz/.test(await page.locator('[data-cc-address="set"]').innerText()),
    )
    check('the book closes behind it', (await page.locator('dialog[open]').count()) === 0)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ------------------------- edit: a row the order is NOT using is a book act */
  {
    console.log('\ncorrecting an address the order is not using')
    const { context, page, errors, calls, wire } = await open(browser, {
      book: [bookRow('77120'), bookRow('88220', { labelCode: 'WORK', labelNameEn: 'Work' })],
      state: seedState({ address: onOrder('77120') }),
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-change-address]').click()
    await page.locator('[data-cc-address-picker]').waitFor()

    // 7 / 18. 🚩 **This assertion FLIPPED with 188.** 187 withheld the control
    //    on the order's own address because the re-pin did not exist yet;
    //    now it does, so the control is offered on every row and the
    //    asymmetry moves to DELETE (asserted below, item 24).
    check(
      'the edit control is offered on the address the order is using',
      (await page.locator('[data-cc-address-edit="77120"]').count()) === 1,
    )
    check(
      'and on the one it is not',
      (await page.locator('[data-cc-address-edit="88220"]').count()) === 1,
    )
    // 24. ⚠ Delete is the one that stays absent there: the server refuses it
    //     (`ADDRESS_IN_USE_BY_ORDER`) because the submit path re-reads a book
    //     filtered on `IsDeleted = 0` and would find nothing to build a
    //     shipping address from.
    check(
      'the DELETE control is ABSENT on the address the order is using',
      (await page.locator('[data-cc-address-delete="77120"]').count()) === 0,
    )
    check(
      'and present on the one it is not',
      (await page.locator('[data-cc-address-delete="88220"]').count()) === 1,
    )

    await page.locator('[data-cc-address-edit="88220"]').click()
    await page.locator('[data-cc-address-form]').waitFor()
    check(
      'the form opens seeded from the book row',
      (await page.locator('[data-cc-address-field="street1"]').inputValue()) === 'King Abdulaziz Rd' &&
        (await page.locator('[data-cc-address-field="shortAddress"]').inputValue()) === 'RIMA6904',
    )
    check(
      'the district it already has is pinned above the results',
      (await page.locator('[data-cc-district-current="R-114"]').count()) === 1,
    )

    const before = await page.locator('[data-cc-address="set"]').innerText()
    // The agent clears a line the caller says is wrong.
    await page.locator('[data-cc-address-field="street2"]').fill('')
    await page.locator('[data-cc-address-field="street1"]').fill('King Fahd Rd')
    await page.locator('[data-cc-address-save]').click()
    await page.locator('[data-cc-address-picker]').waitFor({ timeout: 10_000 })

    const puts = wire.filter((w) => w.method === 'PUT')
    check('one correction is sent, naming that address', puts.length === 1 && puts[0].body.addressNumber === '88220')
    assertNarrowCapture('edit', { labelCode: puts[0]?.body.labelCode, address: puts[0]?.body.address })
    check('🚩 the cleared line is "" on the wire, never null', puts[0]?.body.address.street2 === '')
    // 11. The pair the console cannot capture, round-tripped rather than zeroed
    //     — the service assigns GPS unconditionally, so an omission writes 0.
    check(
      'the GPS the console never captures is carried back unchanged',
      puts[0]?.body.address.gpsLat === 24.7743 && puts[0]?.body.address.gpsLon === 46.7386,
    )

    // 10 / 21. 🚩 The negative half of §6.5 rule 1, and the assertion that
    //     would fail if anyone treated the two rows alike: a book act on a row
    //     the order is not using never touches the order. A console that
    //     re-pinned after EVERY edit would re-price a live basket, and raise
    //     §5.1's are-you-sure, for a correction to an address the order never
    //     had.
    check(
      'NO SetAddress follows a correction to a row the order is not using',
      calls.filter((c) => c === 'POST CallCenterWeb/SetAddress').length === 0,
    )
    check('the order’s address is untouched', (await page.locator('[data-cc-address="set"]').innerText()) === before)
    check('the agent lands back on the book', await page.locator('[data-cc-address-picker]').isVisible())
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ------------------------------------- the district no store delivers from */
  {
    console.log('\na district with no delivering store, and the unverified national address')
    const { context, page, errors, wire } = await open(browser, {
      book: [],
      state: seedState(),
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-pick-address]').click()
    await page.locator('[data-cc-address-add]').click()
    await page.locator('[data-cc-address-form]').waitFor()

    await page.locator('[data-cc-district-search]').fill('nakheel')
    const storeless = page.locator('[data-cc-district-option="R-990"]')
    await storeless.waitFor()
    // 12. Visible and unpickable, saying why (§2.3) — an agent who could not
    //     find the caller's own district would keep hunting for it.
    check('a store-less district is drawn, not hidden', await storeless.isVisible())
    check('and is unpickable', await storeless.isDisabled())
    check('and says why', /no delivery/i.test(await storeless.innerText()))
    check(
      'a district that has only an OPERATIONAL override is pickable',
      await (async () => {
        await page.locator('[data-cc-district-search]').fill('rawdah')
        return !(await page.locator('[data-cc-district-option="J-201"]').isDisabled())
      })(),
    )

    // 13. 🚩 The negative the whole predicate exists for: the client asks
    //     WHETHER there is a store, never WHICH.
    const dom = await page.locator('[data-cc-district-results]').innerHTML()
    check(
      'no store code reaches the DOM at all',
      !dom.includes('1101') && !dom.includes('1288') && !dom.includes('9901'),
    )

    // Nothing was picked, so the form will not send — the district is what the
    // store is derived from.
    await page.locator('[data-cc-district-search]').fill('nakheel')
    await storeless.click({ force: true }).catch(() => {})
    check('a store-less district cannot be committed', (await page.locator('[data-cc-district-current]').count()) === 0)

    // 14. SPL: format-checked, never verified.
    await page.locator('[data-cc-district-search]').fill('malqa')
    await page.locator('[data-cc-district-option="R-114"]').click()
    await page.locator('[data-cc-address-field="shortAddress"]').fill('RIMA69')
    check('a malformed national address blocks the save', await page.locator('[data-cc-address-save]').isDisabled())
    check(
      'and says the format',
      /four letters/i.test(await page.locator('[data-cc-address-field-error="shortAddress"]').innerText()),
    )
    const form = await page.locator('[data-cc-address-form]').innerText()
    check(
      '🚩 nothing on the field claims the address was verified',
      !/verified|confirmed|valid address/i.test(form),
    )
    await page.locator('[data-cc-address-field="shortAddress"]').fill('rima6904')
    check('a well-formed one unblocks it', !(await page.locator('[data-cc-address-save]').isDisabled()))
    await page.locator('[data-cc-address-save]').click()
    await page.locator('[data-cc-address="set"]').waitFor({ timeout: 10_000 })
    check(
      'the national address is upper-cased on the wire, CC2’s own normalisation',
      wire.find((w) => w.method === 'POST' && w.path === 'CallCenterWeb/CustomerAddresses')?.body.address
        .shortAddress === 'RIMA6904',
    )
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ------- the create whose apply is refused: saved on the book, off the order */
  {
    console.log('\na created address the order refuses (§6.5’s named consequence)')
    const { context, page, errors, calls } = await open(browser, {
      book: [],
      state: seedState(),
      applyRefused: true,
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-pick-address]').click()
    await page.locator('[data-cc-address-add]').click()
    await page.locator('[data-cc-address-form]').waitFor()
    await page.locator('[data-cc-district-search]').fill('malqa')
    await page.locator('[data-cc-district-option="R-114"]').click()
    await page.locator('[data-cc-address-field="street1"]').fill('Prince Sultan Rd')
    await page.locator('[data-cc-address-save]').click()

    await page.locator('[data-cc-address-error]').waitFor({ timeout: 10_000 })
    const refusal = await page.locator('[data-cc-address-error]').innerText()
    // The refusal is EXPLAINED, never a machine code — and it says what is true
    // of the order, which is what the agent is asking about.
    check('the district refusal is worded, not a code', !/NO_DELIVERY_STORE_FOR_DISTRICT/.test(refusal))
    check('and says the order is unchanged', /nothing has changed/i.test(refusal), refusal)

    // 🚩 The address the agent just keyed IS on the book — it saved. Showing a
    // list without it would invite them to key it a second time.
    check(
      'the saved address is on the book the agent is looking at',
      (await page.locator('[data-cc-address-option="99001"]').count()) === 1,
    )
    check(
      'and it took no extra read to put it there',
      calls.filter((c) => c === 'GET CallCenterWeb/CustomerAddresses').length === 1,
      calls.filter((c) => c.includes('CustomerAddresses')).join(' → '),
    )
    check('the order still has no address', (await page.locator('[data-cc-address="pick"]').count()) === 1)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ---- 188: editing the order's OWN address re-pins the store (§6.5 rule 1) */
  {
    console.log('\ncorrecting the address the ORDER is using')
    const { context, page, errors, calls, wire } = await open(browser, {
      book: [bookRow('77120'), bookRow('88220', { labelCode: 'WORK', labelNameEn: 'Work' })],
      // A basket WITH lines: it is what makes the re-pin raise §5.1 rather than
      // apply inline, and the preview is the thing the agent must meet.
      state: seedState({ address: onOrder('77120'), lines: LINES }),
      applyPreviews: true,
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-change-address]').click()
    await page.locator('[data-cc-address-picker]').waitFor()

    await page.locator('[data-cc-address-edit="77120"]').click()
    await page.locator('[data-cc-address-form]').waitFor()
    // The caller corrects the district — the one field on this form that can
    // move the store, and the reason the whole rule exists.
    await page.locator('[data-cc-district-search]').fill('rawdah')
    await page.locator('[data-cc-district-option="J-201"]').click()
    await page.locator('[data-cc-address-save]').click()

    // 20. What the agent meets is the ordinary store-move preview.
    await page.locator('[data-cc-rebind-to]').waitFor({ timeout: 10_000 })
    check('the correction raises the store-move preview', await page.locator('[data-cc-rebind-to]').isVisible())
    check(
      'the book closes behind it — one modal at a time',
      (await page.locator('[data-cc-address-picker]').count()) === 0,
    )

    // 19. The whole of §6.5 rule 1, on the wire and in order.
    const puts = wire.filter((w) => w.method === 'PUT')
    const sets = wire.filter((w) => w.path === 'CallCenterWeb/SetAddress')
    check('one correction is sent, naming the order’s own address', puts.length === 1 && puts[0].body.addressNumber === '77120')
    check(
      '🚩 the correction is FOLLOWED by a re-issued SetAddress',
      sets.length === 1 && sets[0].body.addressNumber === '77120',
      sets.map((s) => s.body.addressNumber).join(', '),
    )
    check(
      'and the re-pin carries THE SAME addressNumber — no new verb, no new field',
      sets[0]?.body.addressNumber === puts[0]?.body.addressNumber,
    )
    check(
      'the re-pin follows the write, never precedes it',
      calls.indexOf('POST CallCenterWeb/SetAddress') > calls.indexOf('PUT CallCenterWeb/CustomerAddresses'),
      calls.filter((c) => /CustomerAddresses|SetAddress/.test(c)).join(' → '),
    )
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ---- 188: the edit the book keeps and the order refuses (§6.5's ⚠) ------- */
  {
    console.log('\ncorrecting the order’s own address into a district no store delivers to')
    const { context, page, errors, wire } = await open(browser, {
      book: [bookRow('77120')],
      state: seedState({ address: onOrder('77120'), lines: LINES }),
      applyRefused: true,
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-change-address]').click()
    await page.locator('[data-cc-address-picker]').waitFor()

    const before = await page.locator('[data-cc-address="set"]').innerText()
    await page.locator('[data-cc-address-edit="77120"]').click()
    await page.locator('[data-cc-address-form]').waitFor()
    // ⚠ Picked from the districts the client believes are served — the client
    // asks WHETHER a store delivers and the SERVER's answer is the authority
    // (§2.3). This is the shape that reaches an agent when the two disagree,
    // and it is the shape §6.5 named.
    await page.locator('[data-cc-district-search]').fill('rawdah')
    await page.locator('[data-cc-district-option="J-201"]').click()
    await page.locator('[data-cc-address-save]').click()

    await page.locator('[data-cc-address-error]').waitFor({ timeout: 10_000 })
    const refusal = await page.locator('[data-cc-address-error]').innerText()
    check('the refusal is worded, not a code', !/NO_DELIVERY_STORE_FOR_DISTRICT/.test(refusal), refusal)

    // 22. 🚩 BOTH facts, or neither is honest: an agent shown only the refusal
    //     would conclude the correction was lost and key it a second time.
    check(
      'the book kept the correction and the screen says so',
      await page.locator('[data-cc-address-saved-not-moved]').isVisible(),
    )
    const saved = await page.locator('[data-cc-address-saved-not-moved]').innerText()
    check('and it says the ORDER still has what it had', /still has/i.test(saved), saved)

    check('the correction was sent', wire.filter((w) => w.method === 'PUT').length === 1)
    check('and the re-pin was attempted', wire.filter((w) => w.path === 'CallCenterWeb/SetAddress').length === 1)

    // ⚠ The saved-half qualifies ONE refusal — the one its own re-pin raised.
    // The agent now tries a DIFFERENT address and is refused again; a leftover
    // *the correction is saved* under that failure would credit this refusal
    // with a correction it has nothing to do with.
    await page.locator('[data-cc-address-add]').click()
    await page.locator('[data-cc-address-form]').waitFor()
    await page.locator('[data-cc-district-search]').fill('malqa')
    await page.locator('[data-cc-district-option="R-114"]').click()
    await page.locator('[data-cc-address-field="street1"]').fill('Takhassusi St')
    await page.locator('[data-cc-address-save]').click()
    await page.locator('[data-cc-address-error]').waitFor({ timeout: 10_000 })
    check(
      '🚩 the saved-half does not survive into the NEXT act’s refusal',
      (await page.locator('[data-cc-address-saved-not-moved]').count()) === 0,
    )
    // 23. Nothing is rolled back — not the book row, and not the order.
    check('the order’s address is untouched', (await page.locator('[data-cc-address="set"]').innerText()) === before)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ---- 188: deleting a row, and the refusal the UI cannot provoke --------- */
  {
    console.log('\nremoving an address from the book')
    const { context, page, errors, calls, wire } = await open(browser, {
      book: [bookRow('77120'), bookRow('88220', { labelCode: 'WORK', labelNameEn: 'Work' })],
      state: seedState({ address: onOrder('77120') }),
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-change-address]').click()
    await page.locator('[data-cc-address-picker]').waitFor()

    // 25. The second press is IN PLACE — a dialog here would be the
    //     modal-on-modal `AddressPicker` rejected in 166, and it would ask the
    //     question away from the address it is about.
    await page.locator('[data-cc-address-delete="88220"]').click()
    await page.locator('[data-cc-address-delete-confirm="88220"]').waitFor()
    check('the delete asks a second time, in place', (await page.locator('dialog[open]').count()) === 1)
    check('nothing is sent on the first press', calls.every((c) => !c.startsWith('DELETE')))

    await page.locator('[data-cc-address-delete-yes]').click()
    await page.locator('[data-cc-address-row="88220"]').waitFor({ state: 'detached', timeout: 10_000 })

    // 26. One DELETE, naming the address on the query string — 801's own route
    //     shape, and the reason `api.del` takes params rather than a body.
    const deletes = wire.filter((w) => w.method === 'DELETE')
    check('one delete is sent', deletes.length === 1, deletes.length + ' DELETE(s)')
    check(
      'it names the address on the query string, and nothing else',
      JSON.stringify(deletes[0]?.query) === JSON.stringify({ addressNumber: '88220' }),
      JSON.stringify(deletes[0]?.query),
    )
    check('the row is gone from the book', (await page.locator('[data-cc-address-row="88220"]').count()) === 0)
    check('and the order’s own address is still there', (await page.locator('[data-cc-address-row="77120"]').count()) === 1)
    check('the order is untouched', calls.filter((c) => c === 'POST CallCenterWeb/SetAddress').length === 0)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  /* ---- 188: the code this console's own UI cannot provoke ----------------- */
  {
    console.log('\na delete the open order refuses')
    const { context, page, errors } = await open(browser, {
      book: [bookRow('77120'), bookRow('88220', { labelCode: 'WORK', labelNameEn: 'Work' })],
      state: seedState({ address: onOrder('77120') }),
      // The book moved under the agent — another window, another call. The
      // control is only ever drawn on a row the console believes is free, so
      // this is the ONLY way its own UI reaches the refusal.
      deleteRefused: true,
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-change-address]').click()
    await page.locator('[data-cc-address-picker]').waitFor()
    await page.locator('[data-cc-address-delete="88220"]').click()
    await page.locator('[data-cc-address-delete-yes]').click()

    await page.locator('[data-cc-address-error]').waitFor({ timeout: 10_000 })
    const refusal = await page.locator('[data-cc-address-error]').innerText()
    // 27. 🚩 The refusal is the guard; the omission is only the courtesy. A
    //     client that could not SAY this code would be relying on its own copy
    //     of the rule, which is the second implementation §6.5 refuses to have.
    check('the refusal is worded, not a machine code', !/ADDRESS_IN_USE_BY_ORDER/.test(refusal), refusal)
    check('and it names the order as the reason', /order/i.test(refusal), refusal)
    check('the row is still on the book', (await page.locator('[data-cc-address-row="88220"]').count()) === 1)
    check('nothing threw', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  await browser.close()

  const passed = results.filter((r) => r.pass).length
  console.log(`\n${passed}/${results.length}`)
  if (passed !== results.length) {
    console.log('\nfailed:')
    for (const r of results.filter((x) => !x.pass)) console.log(`  ✗ ${r.name}`)
    process.exitCode = 1
  }
}

await run()
