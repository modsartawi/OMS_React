// The call-center console's tracer bullet (ticket 162) — drives the REAL app in Chromium.
//
//   1. run the app:  npx vite --port 5210
//   2. node tools/callcenter-drive.mjs
//
// Nothing about the app is stubbed except the wire. `CallCenterWeb/Access` and
// `CallCenterWeb/Open` DO NOT EXIST server-side yet (BackOffice 800 carries the grant,
// 801 the route table), so this run answers them from the contract's own committed
// fixture — `.issues/assets/136-cc-contract/01-open-empty.json` — rather than from a
// hand-rolled mock. That is the point: the client is driven against the frozen shape.
// Every `/api/**` request is RECORDED, which is how "exactly one Open" and "a refused
// console opens no order" are PROVEN rather than asserted.
//
// Asserts ticket 162's Proof:
//   theConsoleOpensAndRendersTheReturnedState
//     1. a granted agent lands on /callcenter, exactly ONE Open call is made, and the
//        shell renders the returned header, the empty basket and the engine's totals;
//     2. no app nav chrome is around it — no sidebar, no shell top bar;
//     3. the receipt's payable is the fixture's `totals.payable`, and *Place order* is
//        disabled with `submitBlockers` named under it (nothing client-computed);
//     4. the nav leaf appears for a granted agent, on ONE shared Access call.
//   aRefusedConsoleIsNotADeadEnd
//     5. canOpenConsole:false → the denial, with BOTH ways home, and NO Open call;
//     6. an ERRORED probe → the "check unavailable" copy (not "ask for a grant"),
//        both ways home, and still no Open call;
//     7. a probe that throws CONSOLE_NOT_GRANTED → the DENIAL copy, not "server
//        problem, try again shortly" — the machine code, not `isError`, decides;
//     8. the door refusing Open with CONSOLE_NOT_GRANTED (the probe is show/hide
//        hygiene, never the enforcement) → the denial, with no dead "try again";
//     9. the leaf is absent from the nav in both refused cases.
//
// Asserts ticket 163's Proof:
//   anExistingOrderIsOfferedNotInherited
//    10. Open answering `refusedExisting` draws the previous caller's name, line count,
//        opened-at and store — and NO basket is rendered until the agent chooses;
//        nothing about that order is even fetched.
//   resumeAndStartFreshBothLandOnAnOrder
//    11. *Resume* reads THAT order's state (one State call, on that id) and renders it;
//    12. *Abandon and start fresh* cannot fire without the confirmation, and once
//        confirmed sends Abandon BEFORE Open, on a NEW requestId, landing on an empty
//        order that is not the one abandoned;
//    13. abandoning from inside a live order is the same act — same confirmation,
//        naming what is thrown away — and lands the agent on a fresh order, never on
//        nothing.
//
// Asserts ticket 164's Proof:
//   aBusyCollisionKeepsTheScreenUsable
//    14. a stub answering SESSION_BUSY (fixture 08's own refusal) three times then
//        succeeding shows the STRIP — in the flow, inside the console, never a
//        blocking spinner — the basket and its controls stay usable throughout, and
//        the strip clears itself when the collision does;
//    15. the exhausted case: the schedule runs out and the agent is offered a manual
//        retry, which lands them back on their order;
//    16. a stale tab is REFUSED, not misrouted — SESSION_CLOSED returns it to the
//        start, naming the reason, with the dead basket gone from the screen and a
//        new order one click away;
//    17. a major contractVersion mismatch stops the console dead (no basket, no
//        totals, no dead "try again"), while minor drift is a non-event.
//
// Asserts ticket 165's Proof:
//   attachingACallerOpensTheAddressBook
//    18. the caret is IN the phone field the moment the console opens — nothing is
//        clicked first; before a caller there is no address control to reach at all;
//    19. looking a caller up names them, attaching sends the found loyalty id on one
//        requestId, and the rail fills with a compact card of AT MOST six fields in a
//        fixed order — with the empty address slot and its *Pick an address* appearing
//        only once `capabilities.canOpenAddressBook` says the door will answer;
//    20. a number nobody holds says so and offers no signup surface (159 is undrawn);
//    21. removing the caller clears the address and LEAVES THE STORE CHIP STANDING —
//        a re-attach must never silently re-price the basket.
//
// Asserts ticket 166's Proof:
//   anAddressOnAnEmptyBasketAppliesInline
//    22. on an EMPTY basket, picking an address sends SetAddress on its own requestId
//        and applies INLINE — no confirmation modal at all — and the store chip moves
//        to the plant the SERVER derived, carrying *derived* so a store the agent did
//        not choose reads as explained;
//    23. a chip that still needs something looks like it does, off the server's own
//        `submitBlockers` — and an unknown blocker code reaches no chip at all;
//    24. both address refusals are EXPLAINED, never raw and never "not found":
//        NO_CUSTOMER_ATTACHED and ADDRESS_NOT_FOR_CUSTOMER read as different facts,
//        and the order is left untouched by either;
//    25. the book is read when it is OPENED (not when a caller is attached), a
//        failed read is not a dead end, and the next caller's book never opens by
//        itself off the previous caller's intent.
//
// Asserts ticket 167's Proof:
//   aStoreMoveIsPreviewedThenCommitted
//    26. a store change on a basket WITH lines returns the UNCHANGED state plus a
//        modal naming the diff line by line — price movement, the promotion whose
//        value moves, the delivery fee, the availability re-freeze — and declining
//        leaves no trace; and a preview that already names an unpriceable line
//        refuses the commit HERE rather than after a round trip (26b);
//    27. accepting commits exactly what was previewed, as a second send of the
//        same verb on the SAME requestId carrying the token;
//    28. a stale token RE-PREVIEWS instead of committing — the token is dropped,
//        the id is not, and the agent is told why they are being asked twice;
//    30. the deliberate override rides SetStore into the SAME sheet — one
//        confirmation mechanism, not two — and the chip stops saying *derived*.
//
// Asserts ticket 168's Proof:
//   searchingInArabicFindsAndAddsAnItem
//    31. a term too short to ask with asks nothing; an Arabic term reaches the
//        catalogue verbatim on ONE settled request carrying the ORDER (never a
//        client-chosen plant); every row carries its Arabic name in a dir-PINNED
//        isolate that does not flip the block; the estimate rides the SECOND
//        line with `≈` and no currency word and is measurably nowhere near the
//        row's end edge, which holds no money-formatted figure at all; the three
//        availability states differ in ground, ink AND words, with unknown
//        reading as nothing like none; a capped result offers narrowing rather
//        than a pager; and one click adds the item — one AddItem, an item number
//        and a quantity, never a price — leaving it in the basket at the
//        ENGINE's price, not the estimate.
//
// Asserts ticket 169's Proof:
//   acceptingAShortfallMarksTheLineAndTheOrder
//    32. adding beyond a KNOWN availability returns the unchanged state and asks —
//        in the SAME confirmation surface as the rebind, naming the item, what was
//        asked for, what is there and at which store, with no money in it and no
//        block on the commit; declining adds nothing and sends no token; accepting
//        re-sends the same verb on the SAME requestId plus the token, and the
//        committed line and the order header carry the below-availability flags,
//        with the line's pill reading *at add* rather than like the live one —
//        while an UNKNOWN stock read never raises a confirmation at all.
// Asserts ticket 170's Proof:
//   theBasketTakesCorrections
//    33. the receipt is ENGINE truth: totals that disagree with the lines on
//        screen are still what the caller is quoted — the console sums nothing;
//    34. a line says what it costs and WHY — the store price and VAT as separate
//        conditions, and the promotion that fired on it in the offer's words —
//        with the receipt pinned whole at the end edge;
//    35. quantity, unit of measure and void each send ONE verb naming the line
//        (a new quantity, never a delta, never a price), each re-renders from
//        the returned state, and the receipt moves with all three — including
//        the DELIVERY FEE, which is quoted live and waives itself as the basket
//        crosses the threshold, as an outcome with no control on it;
//    36. a quantity raised beyond availability takes 169's path unchanged — the
//        same sheet, the same id, the same token — and declining puts the field
//        back to what the order holds;
//    37. LINE_NOT_FOUND and UOM_NOT_AVAILABLE are explained in the agent's words
//        ON the line they were about, and the order is left exactly as it was.
//
// Asserts ticket 173's Proof:
//   theHeaderSettlesIntoChips
//    38. a chip whose section the SERVER says is blocking submit looks like it
//        needs something, and the dead *Place order* names every reason in
//        words — including a blocker code this client has never heard of;
//        setting a slot (one SetSlot, one requestId, at the ORDER's store,
//        picking from the server's own windows with a full one drawn and
//        unpickable) collapses it into a settled chip and clears the attention
//        with it; the source and its reference go up on ONE verb and settle two
//        chips, with the mandatory-reference rule left to the door — the
//        console sends the empty reference and words the refusal rather than
//        predicting it;
//    38b. the soft gate stays soft: a slot the order holds that has LAPSED is
//        named on the chip and warned about in the flow while the chip stays
//        settled and submit stays live, and a window that goes mid-call warns
//        inside the picker — no failure, nothing changed, the next window lands.
// Asserts ticket 174's Proof:
//   placingAnOrderWaitsForItsNumber
//    39. *Place order* becomes *Placing the order…* and cannot be pressed again;
//        the receipt HOLDS — no confirmation, no order number, not a figure moved
//        — until a documentNo arrives; the request carries ONLY the transaction
//        id and a requestId (no document, no lines, no amounts, no fee); and a
//        placed order has nothing left to place, correct or abandon.
//   aRefusedSubmitKeepsTheOrder
//    40. SUBMIT_REFUSED is drawn in the server's own words, points at the section
//        that fixes it, and leaves the basket, the total and a live *Place order*
//        exactly as they were — a correction, not a lost basket;
//    40b. SUBMIT_UNAVAILABLE — a 503 CARRYING the envelope — reads as the
//        server's own retryable sentence rather than as "unexpected", the one
//        control offers the retry, and that retry re-sends the SAME requestId
//        and is answered `alreadySubmitted` with the FIRST order's number, drawn
//        word for word as the first submit was.
//   aRefusedRebindChangesNothingAndSaysWhichLine
//    29. REBIND_REFUSED draws the banner in the server's own words, names the
//        offending line THERE and tints it in the basket, and leaves the store,
//        the total and the lines exactly as they were.
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5210}`

// The contract's own fixture, verbatim — the same file `__fixtures__/payloads.ts`
// imports. A drive that hand-wrote this payload would be testing the drive.
const raw = (name) =>
  JSON.parse(readFileSync(new URL(`../.issues/assets/136-cc-contract/${name}.json`, import.meta.url), 'utf8'))
// v1.2 (857): a capture is `{ request, response: { statusCode, body } }` where
// `body` is the envelope — so a payload is one level deeper than it was.
const fixture = (name) => raw(name).response.body.data

// A REFUSAL out of a fixture that holds several (08 carries four scenarios), as a
// Playwright fulfilment. Hand-writing a 409 body here would be testing the drive;
// the codes, the messages and the `data` payloads are the contract's own.
const refusal = (name, key) => {
  const response = raw(name)[key].response
  return { status: response.statusCode, contentType: 'application/json', body: JSON.stringify(response.body) }
}

// §6.1's routine collision and §6.2's stale tab, verbatim from fixture 08.
const BUSY = refusal('08-session-busy', 'busy')
const CLOSED = refusal('08-session-busy', 'staleTab')
const CLOSED_MESSAGE = raw('08-session-busy').staleTab.response.body.message

const OPEN_RESULT = fixture('01-open-empty')
const STATE = OPEN_RESULT.state

// The order the agent already has open, and what reading it back answers.
// `02-two-lines-priced` is the resume target on purpose: an order with LINES in
// it is the one whose inheritance would do harm, and two lines on screen after
// *Resume* is what "back where it was" looks like.
// 🚩 The v1.2 capture carries `address: null` — the capture environment reached the
// loyalty attach but not the address book, so a settled order in it has a caller and
// no address. Ticket 167's cases are about moving a plant that was DERIVED from an
// address, so the address is stated here: the capture supplies the caller, the lines
// and the money, and this supplies the one field it could not reach. It is the same
// address `ADDRESS_BOOK` offers, so the picker and the header agree.
const PRIOR_STATE = (() => {
  const captured = fixture('02-two-lines-priced')
  return {
    ...captured,
    header: {
      ...captured.header,
      address: {
        addressNumber: '77120',
        label: 'Home',
        cityCode: '0021',
        cityName: 'Riyadh',
        districtCode: 'R-114',
        districtName: 'Al Malqa',
        line: 'King Abdulaziz Rd, Bldg 4',
      },
    },
  }
})()
const PRIOR_ID = PRIOR_STATE.transactionId

// 🚩 The v1.2 capture ships `uomOptions: []` on EVERY line — 857 confirmed that as
// expected rather than drift: `changeUom` works and only the picker's catalogue is
// missing in phase 1. The unit picker therefore has nothing to draw, so the cases
// that drive it state the second line's units. Everything else stays the capture's.
const PRIOR_WITH_UNITS = {
  ...PRIOR_STATE,
  lines: PRIOR_STATE.lines.map((line, index) =>
    index === 1 ? { ...line, uomOptions: ['EA', 'BOX'] } : line,
  ),
}

// §8.1's shape, hand-built: there is no committed fixture for a refusal (136
// froze nine payloads and this is not one of them), so the drive spells the four
// fields the contract lists — and only those.
const EXISTING = {
  transactionId: PRIOR_ID,
  customerName: PRIOR_STATE.header.customer.name,
  lineCount: PRIOR_STATE.lines.length,
  openedAt: PRIOR_STATE.header.openedAt,
  plant: PRIOR_STATE.header.plant,
}

// The fixtures share one transactionId, so a fresh open is given a distinct one:
// the shape is the fixture's, and only the identity is varied — which is the one
// thing "the new order is not the one you abandoned" has to be able to see.
const FRESH_ID = '01JD0000000000000000000000'
const freshOpenResult = () => ({
  outcome: 'opened',
  state: { ...STATE, transactionId: FRESH_ID },
  existing: null,
})

// ---- ticket 165: the caller, and the two verbs that bind and unbind them ----
//
// The loyalty lookup is NOT part of the session contract — it precedes attach and
// has no committed fixture (BackOffice 801 delegates it verbatim to
// `LoyEndpoints.GetLoyMemberByMobile`). So the drive spells `LoyMemberModel`'s own
// field names, and only the ones the rail reads.
const MEMBER = {
  loyId: PRIOR_STATE.header.customer.customerId,
  mobile: '0551234567',
  fullName: 'Nouf Al-Qahtani',
  tier: 'Gold',
  pointsBalance: 1240,
  email: 'caller@example.com',
}

// The caller as the ORDER holds them once attached — `SessionCustomer`, not the
// loyalty record. Deliberately spelled with a name of its own: the rail must read
// the projection rather than the member it searched with, and a check that cannot
// tell the two apart proves nothing.
const ATTACHED_CUSTOMER = {
  customerId: MEMBER.loyId,
  name: 'Nouf A. Al-Qahtani',
  mobile: MEMBER.mobile,
  loyaltyAttached: true,
}

// ---- 175's opening gate, as the SERVER computes it (contract v1.3) ----
//
//   canAddItem = open && customer != null && plantSource != 'seededAtOpen'
//
// and `canPriceCheck` (157) and `canApplyCoupon` (159) are the SAME predicate.
// The rule lives in the stub because the console never re-derives it — it reads
// `capabilities`, which is precisely what 175 settled. Fixture 01 opens with the
// gate SHUT (no caller, a plant nobody chose) and fixture 02 shows what it looks
// like once both are settled; every state this stub builds in between has to
// agree with the two of them, or the drive would be asking the console to open a
// door the contract says is closed.
const gated = (state) => {
  const isOpen =
    state.status === 'open' && state.header.customer != null && state.header.plantSource !== 'seededAtOpen'
  const reasons = { ...(state.capabilities.capabilityReasons ?? {}) }
  // The reason is the FIRST thing still missing — the one the agent does next.
  if (isOpen) delete reasons.canApplyCoupon
  else reasons.canApplyCoupon = state.header.customer == null ? 'NO_CUSTOMER' : 'STORE_NOT_CHOSEN'
  return {
    ...state,
    capabilities: {
      ...state.capabilities,
      canAddItem: isOpen,
      canPriceCheck: isOpen,
      canApplyCoupon: isOpen,
      capabilityReasons: reasons,
    },
  }
}

// What `removeCustomer` answers (§6.3): the customer and the address are gone,
// **the derived plant is retained**, and the address book has closed again.
// Every one of those is the SERVER's doing — the console is only being watched
// to see that it re-renders them rather than inventing them. Derived from the
// state the stub last served, so removal answers about the order actually on
// screen rather than about a fixture.
// The gate shuts again with the caller — a basket may not be added to for an
// order nobody is on, whatever the plant says.
const removedFrom = (state) =>
  gated({
    ...state,
    version: state.version + 1,
    header: { ...state.header, customer: null, address: null },
    capabilities: { ...state.capabilities, canOpenAddressBook: false },
  })

// ---- ticket 166: the address book, and the store the server derives from it ----
//
// The book read has no committed fixture either (BackOffice 801 specifies it),
// so the drive spells `CustomerAddressBookModel`'s own field names and only the
// ones the picker reads. Two entries, the DEFAULT one second in the array on
// purpose: "the default is offered first" is a claim about the console's
// ordering, and a book already in that order would prove nothing.
const ADDRESS_BOOK = [
  {
    addressNumber: '77120',
    labelCode: 'HOME',
    labelNameEn: 'Home',
    isDefault: false,
    address: {
      cityCode: '0021',
      cityName: 'Riyadh',
      districtCode: 'R-114',
      districtName: 'Al Malqa',
      street1: 'King Abdulaziz Rd',
      street2: null,
      buildingNumber: 'Bldg 4',
    },
  },
  {
    addressNumber: '77121',
    labelCode: 'WORK',
    labelNameEn: 'Work',
    isDefault: true,
    address: {
      cityCode: '0021',
      cityName: 'Riyadh',
      districtCode: 'R-220',
      districtName: 'Al Olaya',
      street1: 'Olaya St',
      street2: 'Tower 2',
      buildingNumber: null,
    },
  },
]

// 🚩 The district→store rule is the SERVER's, so it lives in the stub — this is
// the whole subject of the ticket. Both plants differ from the fixture's entry
// store (1001), which is what makes "the store moved, and it was not the agent
// who moved it" visible at all.
const DERIVED_PLANT = {
  77120: { plant: '1101', plantName: 'Riyadh — Al Malqa' },
  77121: { plant: '1204', plantName: 'Riyadh — Olaya North' },
}

// §6.3's two refusals, each carrying a MACHINE code and a server sentence the
// console must not simply relay: "not found" is precisely the wording the
// contract forbids, so the stub says it and the console had better not.
const codedRefusal = (code, status, message, data = null) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success: false,
    message,
    errors: [{ errorCode: code, internalErrorCode: '', errorMessage: '' }],
    data,
  }),
})
const ADDRESS_REFUSALS = {
  noCustomer: codedRefusal('NO_CUSTOMER_ATTACHED', 409, 'No customer attached to session.'),
  notTheirs: codedRefusal('ADDRESS_NOT_FOR_CUSTOMER', 403, 'Address 77120 not found for customer.'),
}

// ---- ticket 167: the plant rebind, previewed then committed ----
//
// The two-phase protocol is the SERVER's (CONTRACT.md §5), so it lives in the
// stub: a plant that would move on a basket with lines answers 200 with the
// UNCHANGED state plus a token, and the re-send carrying that token commits.
//
// The diff is fixture 05's own `detail`, verbatim except for the two plants —
// which are taken from the stub's own derivation table so the sheet and the chip
// cannot disagree. Its `lineDiffs` already name L1/L2, which are exactly the
// lines fixture 02 puts in the basket: a diff about lines the basket does not
// hold could not prove that the sheet names what the agent is holding.
const REBIND_DETAIL = raw('05-rebind-preview').preview.response.body.data.pendingConfirmation.detail
const CONFIRM_TOKEN = raw('05-rebind-preview').preview.response.body.data.pendingConfirmation.confirmToken

// A preview whose diff already names a line that does not price at the new store.
//
// 🚩 The v1.2 capture of fixture 06 has NO preview half any more, and its own note
// says why: the atomicity check fires on the preview too, so the live server
// refuses an unpriceable rebind on the FIRST call — the agent is never asked to
// accept a diff they could not commit. That is stricter than what this drive
// covers, not looser, so the case is kept: a server that DID preview-then-refuse
// (129's door run twice) must still leave the console able to name the line.
// Built off 05's real preview with 06's real `unpriceableLines` shape.
const REFUSING_DETAIL = {
  ...REBIND_DETAIL,
  unpriceableLines: raw('06-rebind-refused').refusal.response.body.data.unpriceableLines,
}

const previewOf = (state, plant, refuses) => ({
  kind: 'storeChange',
  confirmToken: CONFIRM_TOKEN,
  expiresInMs: 120000,
  detail: {
    ...(refuses ? REFUSING_DETAIL : REBIND_DETAIL),
    ...(refuses
      ? {
          unpriceableLines: REFUSING_DETAIL.unpriceableLines.map((row) => ({
            ...row,
            lineId: PRIOR_STATE.lines[1].lineId,
            itemNumber: PRIOR_STATE.lines[1].itemNumber,
            description: PRIOR_STATE.lines[1].description,
          })),
        }
      : {}),
    fromPlant: state.header.plant,
    fromPlantName: state.header.plantName,
    toPlant: plant.plant,
    toPlantName: plant.plantName,
  },
})

// §7's `CONFIRM_TOKEN_STALE`. Hand-built: 136 froze nine payloads and this is not
// one of them, so the drive spells the envelope and only the code is load-bearing.
const STALE_TOKEN = {
  status: 409,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 409,
    success: false,
    message: 'The basket changed while that preview was open.',
    errors: [{ errorCode: 'CONFIRM_TOKEN_STALE', internalErrorCode: '', errorMessage: '' }],
    data: null,
  }),
}

// Fixture 06's atomic refusal — its envelope, its message, its `data` shape, with
// the offending line's IDENTITY varied to one that is actually in this basket
// (the fixture's L3 is not). "The named line is tinted" is a claim about the
// basket on screen; the same device `FRESH_ID` uses.
const REFUSED_COMMIT = (() => {
  const response = raw('06-rebind-refused').refusal.response.body
  const line = PRIOR_STATE.lines[1]
  return {
    status: response.statusCode,
    contentType: 'application/json',
    body: JSON.stringify({
      ...response,
      data: {
        unpriceableLines: response.data.unpriceableLines.map((row) => ({
          ...row,
          lineId: line.lineId,
          itemNumber: line.itemNumber,
          description: line.description,
        })),
      },
    }),
  }
})()
const REFUSED_MESSAGE = raw('06-rebind-refused').refusal.response.body.message
const REFUSED_LINE = PRIOR_STATE.lines[1]

// The estate as `SdDocument/StoreDetails` answers it — a reference read OFF the
// call-center door (137), already shared app-wide. Unfiltered on purpose (§2.2):
// the door refuses what it will not do, and a client-side filter here would be a
// second opinion about fulfilment.
const STORE_DETAILS = [
  // 🚩 The order's OWN store is in the estate — it has to be, or "the store already
  // on the order is marked and not offered" has nothing to mark. The v1.2 capture
  // opens on plant 1001 (the capture environment's entry store), so the estate
  // carries it rather than the fixture being bent to the drive's reference list.
  { storeCode: '1001', city: 'Riyadh', region: 'Central', storeAddress: 'King AbdelAziz Road', deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false },
  { storeCode: '1101', city: 'Riyadh', region: 'Central', storeAddress: 'Al Malqa', deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false },
  { storeCode: '1204', city: 'Riyadh', region: 'Central', storeAddress: 'Olaya North', deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false },
  { storeCode: '2301', city: 'Jeddah', region: 'Western', storeAddress: 'Al Rawdah', deliveryStore: true, latitude: '', longitude: '', wasfatyRefill: false },
]
const STORE_PLANT = Object.fromEntries(
  STORE_DETAILS.map((s) => [s.storeCode, { plant: s.storeCode, plantName: `${s.city} — ${s.storeAddress}` }]),
)

// ---- ticket 168: the catalogue the agent searches, and what it answers ----
//
// `CallCenterWeb/ItemSearch` has no committed fixture either (BackOffice 799
// specifies it), so the drive spells that ticket's own response row and only the
// fields the panel reads. Four rows on purpose, and in this order:
//
//   1. a positive count, 2. nought, 3. a degraded read (`atp: null`) — the three
//   availability states the console must tell apart — and 4. a fourth match that
//   the cap drops, so `truncated` is a real consequence of the search rather
//   than a flag the stub sets by hand.
//
// Every row carries an Arabic name, because the Arabic run in an LTR row is the
// thing 138's bidi ruling is about and a catalogue without one proves nothing.
const CATALOGUE = [
  {
    materialNumber: '200145',
    descriptionEn: 'Panadol Extra 500mg 24 Tablets',
    descriptionAr: 'بنادول إكسترا ٥٠٠ مجم ٢٤ قرص',
    estimatePriceExVat: 9.13,
    atp: 12,
  },
  {
    materialNumber: '200146',
    descriptionEn: 'Panadol Cold & Flu 24 Tablets',
    descriptionAr: 'بنادول للبرد والإنفلونزا ٢٤ قرص',
    estimatePriceExVat: 11.4,
    atp: 0,
  },
  {
    materialNumber: '200147',
    descriptionEn: 'Panadol Advance 32 Tablets',
    descriptionAr: 'بنادول أدفانس ٣٢ قرص',
    estimatePriceExVat: 7.85,
    atp: null,
  },
  {
    materialNumber: '200148',
    descriptionEn: 'Panadol Baby Suspension 100ml',
    descriptionAr: 'بنادول للأطفال شراب ١٠٠ مل',
    estimatePriceExVat: 14.25,
    atp: 5,
  },
]

// The cap, small enough that one query proves *no paging, a cap and a flag*.
const SEARCH_TAKE = 3

// 799's match clause in miniature: every whitespace-separated token must appear
// in the English OR the Arabic name. The Arabic axis is the point — WPF never
// searched `Description2` at all.
const searchCatalogue = (term) => {
  const tokens = term.trim().split(/\s+/).filter(Boolean)
  return CATALOGUE.filter((row) =>
    tokens.every(
      (token) =>
        row.descriptionEn.toLowerCase().includes(token.toLowerCase()) ||
        (row.descriptionAr ?? '').includes(token) ||
        row.materialNumber.startsWith(token),
    ),
  )
}

// What one add puts in the basket. The line's SHAPE is fixture 02's (a priced
// engine line, VAT-inclusive, with its own conditions); the identity and the
// frozen availability are the added row's. A hand-built line would be testing
// the drive's idea of a line rather than the console's rendering of one.
const lineFor = (row, qty, index, below = false) => ({
  ...PRIOR_STATE.lines[0],
  lineId: `LS${index}`,
  itemNumber: row.materialNumber,
  description: row.descriptionEn,
  description2: row.descriptionAr,
  qty,
  // §2.1 — frozen AT ADD, and `known:false` is the degraded read, never a zero.
  atpAtScan: { quantity: row.atp, frozenAt: PRIOR_STATE.header.openedAt, known: row.atp !== null },
  // 🚩 The flag the AGENT's acceptance produced — stamped by the server on the
  // commit, never set by the client (§5.2, BackOffice 285/286).
  belowAtpAtScan: below,
})

// ---- ticket 169: adding beyond availability, accepted deliberately ----
//
// The soft gate is the SERVER's (§5.2), so it lives in the stub: a KNOWN
// shortfall answers 200 with the UNCHANGED state plus a token, and the re-send
// carrying that token commits — stamping the line and the header. An UNKNOWN
// stock read raises nothing at all, at any quantity.
//
// The block is fixture 04's own, with only the figures varied to the row the
// agent actually pressed *Add* on: a confirmation about an item the search panel
// is not showing could not prove that the sheet names what they are holding.
const BELOW_ATP_BLOCK = raw('04-below-atp-confirm').ask.response.body.data.pendingConfirmation
const BELOW_ATP_TOKEN = BELOW_ATP_BLOCK.confirmToken
const belowAtpAskFor = (row, qty, plant) => ({
  ...BELOW_ATP_BLOCK,
  detail: { ...BELOW_ATP_BLOCK.detail, itemNumber: row.materialNumber, requested: qty, available: row.atp, plant },
})

// ---- ticket 170: the three corrections, and the engine that re-prices them ----
//
// 🚩 The re-price is the SERVER's, so all of it lives in the stub: a corrected
// line is re-totalled from its own unit price, the order's totals are re-summed,
// and the delivery fee falls away over the threshold fixture 02 already carries.
// The console is watched to see that it RENDERS every one of those rather than
// computing any of them — which is the whole subject of the ticket.
const round = (value) => Math.round(value * 100) / 100

// A box is not twelve singles: the unit decides the price, which is why
// `changeUom` re-prices at all and why the receipt has to move with it.
const UOM_FACTOR = { EA: 1, BOX: 12 }

const linePriced = (line, { qty = line.qty, uom = line.uom } = {}) => {
  const factor = UOM_FACTOR[uom] / UOM_FACTOR[line.uom]
  const unitPrice = { net: round(line.unitPrice.net * factor), gross: round(line.unitPrice.gross * factor) }
  return {
    ...line,
    qty,
    uom,
    unitPrice,
    lineTotal: { net: round(unitPrice.net * qty), gross: round(unitPrice.gross * qty) },
  }
}

// The engine's own totals. The console never does this — that is the point.
const repriced = (state) => {
  const net = round(state.lines.reduce((sum, line) => sum + line.lineTotal.net, 0))
  const gross = round(state.lines.reduce((sum, line) => sum + line.lineTotal.gross, 0))
  const fee = state.totals.deliveryFee
  // Quoted LIVE as the basket changes (US36): crossing the threshold is
  // something the agent watches happen, not something submit tells them.
  const waived = gross >= fee.thresholdGross
  return {
    ...state,
    totals: {
      net,
      vat: round(gross - net),
      gross,
      deliveryFee: { ...fee, waived },
      payable: round(gross + (waived ? 0 : fee.amount)),
    },
  }
}

// ---- ticket 173: the rest of the header — the slot, the source, its reference ----
//
// The delivery windows are `Slots/AvailableSlots/{storeCode}` — a reference read
// OFF the call-center door (137), so this is `TimeSlotsModel`'s own shape and not
// the session contract's. Two days, and the second day's first window FULL
// (`status: false`), because "the server decides which windows are offerable" is
// a claim the console has to be seen not to re-implement.
const SLOT_DAYS = {
  slots: [
    {
      day: 'MONDAY',
      date: '2026/07/28',
      fullDay: '2026/07/28 MONDAY',
      times: [
        { time: '10:00 AM - 12:00 PM', status: true, slotId: '2026-07-28#S1', slotFrom: '2026-07-28T10:00:00', slotTo: '2026-07-28T12:00:00' },
        { time: '06:00 PM - 09:00 PM', status: true, slotId: '2026-07-28#S3', slotFrom: '2026-07-28T18:00:00', slotTo: '2026-07-28T21:00:00' },
      ],
    },
    {
      day: 'TUESDAY',
      date: '2026/07/29',
      fullDay: '2026/07/29 TUESDAY',
      times: [
        { time: '10:00 AM - 12:00 PM', status: false, slotId: '2026-07-29#S1', slotFrom: '2026-07-29T10:00:00', slotTo: '2026-07-29T12:00:00' },
      ],
    },
  ],
}
const SLOT_CHOSEN = SLOT_DAYS.slots[0].times[0]
const SLOT_OTHER = SLOT_DAYS.slots[0].times[1]
const SLOT_FULL = SLOT_DAYS.slots[1].times[0]

// What the projection holds once a window is set — `SessionSlot`, the contract's
// own shape (fixture 02 carries one). The window's own identity, so "the chip
// says what was picked" is provable.
const slotHeldFor = (window, isActive = true) => ({
  slotId: window.slotId,
  from: window.slotFrom.slice(11, 16),
  to: window.slotTo.slice(11, 16),
  isActive,
})

// `GET CallCenterWeb/MyDocumentSources` — the AGENT's own sources, with NO user
// id anywhere in the request (137's deliberate break with "delegates verbatim").
// `DocumentSourceModel`'s field names, since 801 projects that model.
const MY_SOURCES = [
  { documentSource: 'CALLCENTER', description: 'Call center', documentSourceCategory: 'CC' },
  { documentSource: 'CAMPAIGN', description: 'Marketing campaign', documentSourceCategory: 'CC' },
]

// §7's mandatory-reference refusal — a 400 carrying the envelope, so the console
// can read the code and word it. The RULE is the server's: this stub refuses a
// source sent with an empty reference, and the console is watched to see that it
// sent it rather than predicting the refusal itself.
const SOURCE_REFUSAL = codedRefusal('SOURCE_REFERENCE_REQUIRED', 400, 'Source reference is required.')

// §7's soft gate — 409, and explicitly NOT a submit blocker. The window went
// while the list was open; the order is untouched.
const SLOT_REFUSAL = codedRefusal('SLOT_UNAVAILABLE', 409, 'Slot 2026-07-28#S1 is no longer active.')

// ---- ticket 174: placing the order, and the three ways it can answer ----
//
// 🚩 The v1.2 capture (857) keeps only the two SUCCESS legs here. `outcome_refused`
// and `outcome_unavailable` are gone: neither is reproducible on demand against a
// live server, so the contract's own fixture note leaves them to the BackOffice
// `CallCenterWebRefusalTableTests`, which asserts the code/status/envelope pairing
// for every §7 row INCLUDING the 503. So this drive states the two refusals with
// `codedRefusal` — the shape is §7's, the pairing is proven server-side, and what
// the drive is actually asserting is what the CONSOLE does with them.
//
// The 503 is still the interesting one: it carries the envelope, so `core/api.ts`
// keeps it as kind:'business'. A bare 503 would reach the agent as "unexpected"
// for a routine retryable outcome.
const SUBMIT_07 = raw('07-submit-already-submitted')
const SUBMIT_REFUSED_MESSAGE = 'A delivery slot is required.'
const SUBMIT_UNAVAILABLE_MESSAGE = 'The order service is not responding. The order is still open.'
const SUBMIT_REFUSED = codedRefusal('SUBMIT_REFUSED', 409, SUBMIT_REFUSED_MESSAGE, { field: 'slot' })
const SUBMIT_UNAVAILABLE = codedRefusal('SUBMIT_UNAVAILABLE', 503, SUBMIT_UNAVAILABLE_MESSAGE)
// The order number the caller is read — the capture's own mint. One per
// transaction, by construction.
const DOCUMENT_NO = SUBMIT_07.submitted.response.body.data.documentNo

// 🚩 What a submit RETRY really gets today: 409 SESSION_CLOSED, not §8.3's
// `alreadySubmitted` (860). The console's replay leg below is driven against the
// contract's promise, because that is the client rule under test; this is the
// capture's own answer, driven as its own case so 860's harm is visible here too.
const SUBMIT_RETRY_REFUSED = {
  status: SUBMIT_07.retryRefused.response.statusCode,
  contentType: 'application/json',
  body: JSON.stringify(SUBMIT_07.retryRefused.response.body),
}

// What the order looks like once it is placed — `status: 'submitted'`, and the
// capabilities that follow from it. The blocker names ITSELF (fixture 07's own
// `ALREADY_SUBMITTED`) rather than leaving a dead button silent.
const submittedState = (state) => ({
  ...state,
  version: state.version + 1,
  status: 'submitted',
  capabilities: {
    ...state.capabilities,
    canSubmit: false,
    canAddItem: false,
    canChangeStore: false,
    canOpenAddressBook: false,
    submitBlockers: ['ALREADY_SUBMITTED'],
  },
})

// §7's three codes for this verb family, each carrying the envelope so
// `core/api.ts` maps it to kind:'business' and the console can read the code.
const LINE_REFUSALS = {
  notFound: codedRefusal('LINE_NOT_FOUND', 404, 'Line not found.'),
  uom: codedRefusal('UOM_NOT_AVAILABLE', 409, 'UoM BOX is not valid for material 100455.'),
  qty: codedRefusal('QTY_INVALID', 400, 'Quantity 0 is not valid.'),
}

// §7 — CONSOLE_NOT_GRANTED is a 403 CARRYING the envelope, so `core/api.ts` maps
// it to kind:'business' and `apiErrorCode()` can read it. A refusal, not a fault.
const REFUSAL = {
  status: 403,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: 403,
    success: false,
    message: 'The call-center console is not granted to this account.',
    errors: [{ errorCode: 'CONSOLE_NOT_GRANTED', internalErrorCode: '', errorMessage: '' }],
    data: null,
  }),
}

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

/**
 * A fresh context per scenario — each answers the probe differently, and react-query
 * caches per page anyway.
 *
 * @param opts.granted `canOpenConsole` the probe answers
 * @param opts.probe   'ok' | 'unreachable' | 'notGranted' — how Access answers:
 *                     a 500 with no code, or a 403 carrying CONSOLE_NOT_GRANTED
 * @param opts.door    'ok' | 'notGranted' — whether Open itself refuses
 * @param opts.existing  when set, the FIRST Open answers `refusedExisting` with it
 *                       (163's whole subject); every later Open opens normally
 * @param opts.openState the state a successful Open returns — the empty fixture by
 *                       default, `02-two-lines-priced` for the live-order abandon
 * @param opts.stateFailures how many `State` reads fail before one succeeds — the
 *                       failed-resume case, and whether *Resume* retries itself
 * @param opts.stateBusy how many `State` reads answer SESSION_BUSY before one
 *                       lands (164): 3 rides the schedule out, 6 exhausts it
 * @param opts.stateClosed  every `State` read answers SESSION_CLOSED — the stale tab
 * @param opts.contractVersion  overrides the version every returned state declares
 * @param opts.memberFound  whether the loyalty lookup finds anyone (165) — `false`
 *                       is the number nobody holds, answered `null` on the success
 *                       envelope rather than as a refusal
 * @param opts.bookFailures  how many address-book READS fail before one lands —
 *                       the read is pure, so a failure owes the agent a retry
 * @param opts.addressRefusal  how `SetAddress` answers (166): `null` applies it,
 *                       `'noCustomer'` / `'notTheirs'` refuse with §6.3's two codes.
 *                       The book READ still answers normally — the agent has to be
 *                       able to reach the address before the refusal is about it.
 * @param opts.rebind    how the CONFIRM re-send answers (167): `null` commits,
 *                       `'staleOnce'` refuses the first token with
 *                       CONFIRM_TOKEN_STALE and commits the next one, `'refused'`
 *                       answers fixture 06's atomic REBIND_REFUSED every time,
 *                       and `'previewRefuses'` raises fixture 06's PREVIEW half —
 *                       a diff that already names an unpriceable line.
 *                       Otherwise the preview is unaffected: the agent must be
 *                       able to see the diff before the commit is what is tested.
 * @param opts.slotLapses  the FIRST `SetSlot` naming the offered window answers
 *                       §7's `SLOT_UNAVAILABLE` (173) — the soft gate, which
 *                       warns and never blocks; the next send lands.
 * @param opts.submit    how `Submit` answers (174): `null` places the order,
 *                       `'refused'` answers fixture 07's SUBMIT_REFUSED every
 *                       time (the field to fix, order untouched), and
 *                       `'outageOnce'` answers its 503-WITH-ENVELOPE on the
 *                       first send — 🚩 having minted the order anyway, which is
 *                       exactly why the retry must answer `alreadySubmitted`
 *                       with the same number and must look like a first submit.
 * @param opts.submitDelayMs  how long `Submit` takes to answer — the window in
 *                       which *Placing the order…* and the HELD receipt are
 *                       observable at all.
 * @param opts.lineEdit  how the three corrections answer (170): `null` applies
 *                       them and re-prices, `'notFound'` refuses every one with
 *                       LINE_NOT_FOUND (the stale screen), `'uomRefused'` and
 *                       `'qtyInvalid'` refuse their own verb with §7's codes.
 */
async function open(
  browser,
  {
    granted = true,
    probe = 'ok',
    door = 'ok',
    existing = null,
    openState = null,
    stateFailures = 0,
    stateBusy = 0,
    stateClosed = false,
    contractVersion = null,
    memberFound = true,
    addressRefusal = null,
    bookFailures = 0,
    rebind = null,
    lineEdit = null,
    slotLapses = false,
    submit = null,
    submitDelayMs = 0,
    // 🚩 858, as the live server really behaves: a send carrying a confirmToken
    // is resolved as an already-applied REPLAY, so the commit never reaches the
    // engine. 200, success, the state unchanged, `replayed: true`.
    swallowCommit = false,
  } = {},
) {
  let stateReads = 0
  let bookReads = 0
  let staleSpent = false
  let lapseSpent = false
  // 🚩 The order number this transaction minted, or `null`. ONE per transaction
  // by construction — once-only is keyed on the transaction id (§8.3) — which is
  // what makes "a repeated submit is not a second order" provable from the stub
  // rather than inferred from the screen.
  let minted = null
  let outageSpent = false
  // The state this stub last served, so the two customer verbs (165) answer
  // about the order on screen rather than about a fixture.
  let served = openState ?? STATE
  // Law 10 — every response carries one, so the override is applied wherever a
  // state leaves this stub rather than at one call site. `'none'` strips the
  // field entirely: a server that has not shipped it yet is a real state, and
  // it is the one this check must NOT stop on.
  const speak = (state) => {
    if (!contractVersion) return state
    if (contractVersion === 'none') {
      const { contractVersion: _absent, ...rest } = state
      return rest
    }
    return { ...state, contractVersion }
  }
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  const calls = []
  // Every POST with its body, in order — how "abandon BEFORE open" and "a new
  // requestId" are PROVEN rather than inferred from what ends up on screen.
  const wire = []
  // Every ItemSearch URL in full — how "it rides the order, not a client-chosen
  // plant" is proven from the request rather than from what ends up on screen.
  const searches = []
  let opens = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  // Chromium logs EVERY non-2xx as a console error, whether or not the app
  // handled it — and 164's whole subject is refusals the app handles on purpose
  // (SESSION_BUSY, SESSION_CLOSED). That line is the browser's network log, not
  // the app's; a real fault still arrives as `pageerror` or as an app-authored
  // console error, both of which are still collected.
  page.on(
    'console',
    (m) =>
      m.type() === 'error' &&
      !/^Failed to load resource: the server responded with a status of/.test(m.text()) &&
      errors.push(m.text()),
  )

  await page.route('**/api/**', async (route) => {
    const url = route.request().url()
    const p = url.split('/api/')[1].split('?')[0]
    calls.push(p)
    if (route.request().method() === 'POST') {
      let body = null
      try {
        body = route.request().postDataJSON()
      } catch {
        body = null
      }
      wire.push({ path: p, body })
    }
    if (p === 'CallCenterWeb/State') {
      stateReads += 1
      if (stateReads <= stateFailures)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'state read failed' }))
      if (stateReads <= stateFailures + stateBusy) return route.fulfill(BUSY)
      if (stateClosed) return route.fulfill(CLOSED)
      return route.fulfill(
        envelope(speak(new URL(url).searchParams.get('transactionId') === PRIOR_ID ? PRIOR_STATE : STATE)),
      )
    }
    // ---- 165 ----
    if (p.startsWith('CallCenterWeb/MemberByMobile/'))
      // `null` is how the service answers a number nobody holds — an ordinary
      // outcome carried on the SUCCESS envelope, not a refusal.
      return route.fulfill(envelope(memberFound ? MEMBER : null))
    if (p === 'CallCenterWeb/AttachCustomer') {
      // The order the agent is on, with the caller bound and the book opened —
      // whichever order that is. `openState` seeds a session that already has
      // one, so attaching must answer about THAT state, not about the empty one.
      served = gated({
        ...served,
        version: served.version + 1,
        header: { ...served.header, customer: ATTACHED_CUSTOMER },
        capabilities: {
          ...served.capabilities,
          canOpenAddressBook: true,
          submitBlockers: served.capabilities.submitBlockers.filter((c) => c !== 'NO_CUSTOMER'),
        },
      })
      return route.fulfill(envelope(speak(served)))
    }
    // ---- 168: the catalogue read, and the one verb that adds from it ----
    if (p === 'CallCenterWeb/ItemSearch') {
      searches.push(url)
      const term = new URL(url).searchParams.get('query') ?? ''
      const matched = searchCatalogue(term)
      return route.fulfill(
        envelope({
          rows: matched.slice(0, SEARCH_TAKE),
          // No paging: the cap plus the flag is the whole protocol (799).
          truncated: matched.length > SEARCH_TAKE,
          // The stock read landed. Its FAILURE is `atp: null` on every row with
          // this false — never a non-200 — which row 3 already covers per-row.
          atpAvailable: true,
        }),
      )
    }
    if (p === 'CallCenterWeb/AddItem') {
      const body = route.request().postDataJSON()
      const row = CATALOGUE.find((r) => r.materialNumber === body.itemNumber)
      // 🚩 §5.2 — a shortfall against a KNOWN figure asks; a degraded read
      // (`atp: null`) never does, at any quantity. Unknown ATP has never gated
      // order entry (287's rule).
      if (swallowCommit && body.confirmToken)
        return route.fulfill(envelope(speak({ ...served, pendingConfirmation: null, replayed: true })))
      const short = row.atp !== null && body.qty > row.atp
      if (short && !body.confirmToken)
        // 🚩 200, success, the UNCHANGED state — same version, nothing added.
        return route.fulfill(
          envelope(speak({ ...served, pendingConfirmation: belowAtpAskFor(row, body.qty, served.header.plant) })),
        )
      served = {
        ...served,
        version: served.version + 1,
        pendingConfirmation: null,
        // The BackOffice fraud signal, stamped by the commit the agent accepted.
        header: { ...served.header, hasBelowAtp: served.header.hasBelowAtp || short },
        lines: [...served.lines, lineFor(row, body.qty, served.lines.length + 1, short)],
        capabilities: {
          ...served.capabilities,
          submitBlockers: served.capabilities.submitBlockers.filter((c) => c !== 'NO_LINES'),
        },
      }
      return route.fulfill(envelope(speak(served)))
    }
    // ---- 170: the three corrections, each returning the WHOLE state ----
    if (p === 'CallCenterWeb/ChangeQty' || p === 'CallCenterWeb/VoidLine' || p === 'CallCenterWeb/ChangeUom') {
      const body = route.request().postDataJSON()
      if (lineEdit === 'notFound') return route.fulfill(LINE_REFUSALS.notFound)
      const line = served.lines.find((l) => l.lineId === body.lineId)
      // A line the order no longer holds — usually a screen that fell behind.
      if (!line) return route.fulfill(LINE_REFUSALS.notFound)

      let lines
      let short = false
      if (p === 'CallCenterWeb/VoidLine') {
        lines = served.lines.filter((l) => l.lineId !== body.lineId)
      } else if (p === 'CallCenterWeb/ChangeUom') {
        if (lineEdit === 'uomRefused' || !line.uomOptions.includes(body.uom))
          return route.fulfill(LINE_REFUSALS.uom)
        lines = served.lines.map((l) => (l.lineId === body.lineId ? linePriced(l, { uom: body.uom }) : l))
      } else {
        if (lineEdit === 'qtyInvalid') return route.fulfill(LINE_REFUSALS.qty)
        // 🚩 §5.2's soft gate, on the OTHER verb that can cross it — the same
        // protocol as `addItem`, and an unknown freeze still asks nothing.
        short = line.atpAtScan.known && body.newQty > line.atpAtScan.quantity
        if (short && !body.confirmToken)
          return route.fulfill(
            envelope(
              speak({
                ...served,
                pendingConfirmation: belowAtpAskFor(
                  { materialNumber: line.itemNumber, atp: line.atpAtScan.quantity },
                  body.newQty,
                  served.header.plant,
                ),
              }),
            ),
          )
        lines = served.lines.map((l) =>
          l.lineId === body.lineId
            ? { ...linePriced(l, { qty: body.newQty }), belowAtpAtScan: l.belowAtpAtScan || short }
            : l,
        )
      }

      served = repriced({
        ...served,
        version: served.version + 1,
        pendingConfirmation: null,
        header: { ...served.header, hasBelowAtp: served.header.hasBelowAtp || short },
        lines,
        capabilities: {
          ...served.capabilities,
          submitBlockers: [
            ...served.capabilities.submitBlockers.filter((code) => code !== 'NO_LINES'),
            ...(lines.length === 0 ? ['NO_LINES'] : []),
          ],
        },
      })
      return route.fulfill(envelope(speak(served)))
    }
    // ---- 166 ----
    if (p === 'CallCenterWeb/CustomerAddresses') {
      // No customer id in the request and none accepted: the door reads it off
      // the session row (801). The stub answers the whole book.
      bookReads += 1
      if (bookReads <= bookFailures)
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'book read failed' }))
      return route.fulfill(envelope(ADDRESS_BOOK))
    }
    // ---- 166 / 167: the two verbs that move the plant, one protocol ----
    if (p === 'CallCenterWeb/SetAddress' || p === 'CallCenterWeb/SetStore') {
      if (addressRefusal && p === 'CallCenterWeb/SetAddress')
        return route.fulfill(ADDRESS_REFUSALS[addressRefusal])
      const body = route.request().postDataJSON()
      if (swallowCommit && body.confirmToken)
        return route.fulfill(envelope(speak({ ...served, pendingConfirmation: null, replayed: true })))
      const isAddress = p === 'CallCenterWeb/SetAddress'
      // 🚩 The district→store rule is the SERVER's; the override names a store
      // outright. Either way nothing the CLIENT sent decided a plant on the
      // address path — the request carries an address number and nothing else.
      const target = isAddress ? DERIVED_PLANT[body.addressNumber] : STORE_PLANT[body.storeCode]

      // §5.1 — the confirmation exists only where money on screen would move: a
      // basket with lines AND a plant that actually changes. An empty basket or
      // an unchanged plant applies inline with no confirmation at all.
      const moves = served.lines.length > 0 && target.plant !== served.header.plant
      if (moves && !body.confirmToken)
        // 🚩 200, success, the UNCHANGED state — same version, nothing persisted.
        return route.fulfill(
          envelope(speak({ ...served, pendingConfirmation: previewOf(served, target, rebind === 'previewRefuses') })),
        )
      if (moves && body.confirmToken) {
        if (rebind === 'refused') return route.fulfill(REFUSED_COMMIT)
        if (rebind === 'staleOnce' && !staleSpent) {
          staleSpent = true
          return route.fulfill(STALE_TOKEN)
        }
      }

      const entry = isAddress ? ADDRESS_BOOK.find((a) => a.addressNumber === body.addressNumber) : null
      served = gated({
        ...served,
        version: served.version + 1,
        pendingConfirmation: null,
        header: {
          ...served.header,
          ...(isAddress
            ? {
                address: {
                  addressNumber: body.addressNumber,
                  label: entry.labelNameEn,
                  cityCode: entry.address.cityCode,
                  cityName: entry.address.cityName,
                  districtCode: entry.address.districtCode,
                  districtName: entry.address.districtName,
                  line: [entry.address.street1, entry.address.street2].filter(Boolean).join(', '),
                },
              }
            : {}),
          plant: target.plant,
          plantName: target.plantName,
          // The provenance is the server's answer to "why that branch?" — derived
          // from the address, or chosen by this operator.
          plantSource: isAddress ? 'derivedFromAddress' : 'operatorOverride',
        },
        capabilities: {
          ...served.capabilities,
          // A plant somebody chose — by address or outright — is a plant that
          // is no longer un-chosen (175).
          submitBlockers: served.capabilities.submitBlockers.filter(
            (c) => c !== 'NO_ADDRESS' && c !== 'STORE_NOT_CHOSEN',
          ),
        },
      })
      return route.fulfill(envelope(speak(served)))
    }
    // ---- 173: the rest of the header ----
    if (p === 'CallCenterWeb/MyDocumentSources') return route.fulfill(envelope(MY_SOURCES))
    if (p === 'CallCenterWeb/SetSlot') {
      const body = route.request().postDataJSON()
      // §7's soft gate: the window went while the list was open. The order is
      // untouched — this stub changes nothing before answering.
      if (slotLapses && !lapseSpent) {
        lapseSpent = true
        return route.fulfill(SLOT_REFUSAL)
      }
      const chosen = SLOT_DAYS.slots.flatMap((d) => d.times).find((w) => w.slotId === body.slotId)
      served = {
        ...served,
        version: served.version + 1,
        header: { ...served.header, slot: slotHeldFor(chosen) },
        capabilities: {
          ...served.capabilities,
          submitBlockers: served.capabilities.submitBlockers.filter((c) => c !== 'MISSING_SLOT'),
        },
      }
      return route.fulfill(envelope(speak(served)))
    }
    if (p === 'CallCenterWeb/SetDocumentSource') {
      const body = route.request().postDataJSON()
      // 🚩 The mandatory-reference rule is the SERVER's, so it lives here — and
      // the console had better have SENT the empty reference rather than
      // deciding for itself that it could not.
      if (!body.sourceReference) return route.fulfill(SOURCE_REFUSAL)
      served = {
        ...served,
        version: served.version + 1,
        header: {
          ...served.header,
          documentSource: body.documentSource,
          sourceReference: body.sourceReference,
        },
        capabilities: {
          ...served.capabilities,
          submitBlockers: served.capabilities.submitBlockers.filter(
            (c) => c !== 'MISSING_SOURCE' && c !== 'MISSING_SOURCE_REFERENCE',
          ),
        },
      }
      return route.fulfill(envelope(speak(served)))
    }
    // ---- 174: the last thirty seconds of the call ----
    if (p === 'CallCenterWeb/Submit') {
      if (submit === 'refused') return route.fulfill(SUBMIT_REFUSED)
      // 🚩 The order IS minted — the outage is in the ANSWER, not in the work.
      // That is the whole reason `alreadySubmitted` exists, and a stub whose
      // 503 changed nothing would let the retry mint a second order unnoticed.
      const replay = minted !== null
      minted = minted ?? DOCUMENT_NO
      served = submittedState(served)
      if ((submit === 'outageOnce' || submit === 'outageThenClosed') && !outageSpent) {
        outageSpent = true
        return route.fulfill(SUBMIT_UNAVAILABLE)
      }
      // 🚩 860, as the v1.2 capture really answers: the order IS minted, the first
      // response was lost, and the retry is refused by the session's liveness gate
      // before the once-only path runs — so the number is unrecoverable. This is
      // the SAME press as the outage above (one action, one requestId).
      if (submit === 'outageThenClosed' && replay) return route.fulfill(SUBMIT_RETRY_REFUSED)
      if (submitDelayMs) await new Promise((resolve) => setTimeout(resolve, submitDelayMs))
      return route.fulfill(
        envelope({
          outcome: replay ? 'alreadySubmitted' : 'submitted',
          documentNo: minted,
          state: speak(served),
        }),
      )
    }
    // The windows one store offers — off the door, on their old path (750 OQ2).
    if (p.startsWith('Slots/AvailableSlots/')) return route.fulfill(envelope(SLOT_DAYS))
    // The estate, off the door and shared app-wide (137).
    if (p === 'SdDocument/StoreDetails') return route.fulfill(envelope(STORE_DETAILS))
    if (p === 'CallCenterWeb/RemoveCustomer') {
      served = removedFrom(served)
      return route.fulfill(envelope(speak(served)))
    }
    if (p === 'CallCenterWeb/Abandon')
      return route.fulfill(envelope({ outcome: 'abandoned', transactionId: route.request().postDataJSON().transactionId }))
    if (p === 'Auth/Me')
      return route.fulfill(
        envelope({ authenticated: true, userId: 'a.alharbi', displayName: 'A. Alharbi', currentStoreCode: '1001' }),
      )
    if (p === 'CallCenterWeb/Access') {
      if (probe === 'unreachable')
        return route.fulfill(envelope(null, { status: 500, success: false, message: 'boom' }))
      if (probe === 'notGranted') return route.fulfill(REFUSAL)
      return route.fulfill(envelope({ canOpenConsole: granted }))
    }
    if (p === 'CallCenterWeb/Open') {
      opens += 1
      if (door === 'notGranted') return route.fulfill(REFUSAL)
      // One active order per agent (law 9): the agent HAS one, so the first open
      // is refused with its identity. Once it is abandoned, the next one lands.
      if (existing && opens === 1)
        return route.fulfill(envelope({ outcome: 'refusedExisting', state: null, existing }))
      // `openState` seeds the FIRST order only. Whatever follows an abandon is a
      // genuinely fresh, empty one — anything else would let box 13 pass while
      // the console quietly re-rendered the basket it had just voided.
      if (openState && opens === 1)
        return route.fulfill(envelope({ outcome: 'opened', state: speak(openState), existing: null }))
      const result = existing || openState ? freshOpenResult() : OPEN_RESULT
      return route.fulfill(envelope({ ...result, state: speak(result.state) }))
    }
    // Every other screen's probe: allowed, so the rest of the shell is normal.
    if (/Access$/.test(p))
      return route.fulfill(
        envelope({ canOpen: true, screenAllowed: true, allowed: true, canAdmin: true, canSupport: true }),
      )
    return route.fulfill(envelope([]))
  })

  return { context, page, errors, calls, wire, searches }
}

const count = (calls, re) => calls.filter((c) => re.test(c)).length
const text = async (page, selector) => (await page.locator(selector).first().innerText()).trim()

async function run() {
  const browser = await chromium.launch()

  // ---- 1–3. the granted agent: one Open, the returned state on screen, no chrome ----
  {
    const { context, page, errors, calls } = await open(browser, { granted: true })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    check('opens exactly one order', count(calls, /^CallCenterWeb\/Open$/) === 1, `${count(calls, /^CallCenterWeb\/Open$/)} Open call(s)`)
    check(
      'one Access call, shared by the guard (no second probe)',
      count(calls, /^CallCenterWeb\/Access$/) === 1,
      `${count(calls, /^CallCenterWeb\/Access$/)} Access call(s)`,
    )
    check(
      'does not fetch state it was just handed',
      count(calls, /^CallCenterWeb\/State$/) === 0,
      'getState is for refresh/recovery only (law 2)',
    )

    // The header, from the server's own projection.
    check('renders the returned document type', (await text(page, '[data-cc-doctype]')) === STATE.header.documentType, STATE.header.documentType)
    check('renders the returned operator', (await text(page, '[data-cc-operator]')) === STATE.header.operatorId)
    const storeChip = await text(page, '[data-cc-chip="store"]')
    check(
      'the store chip carries the plant the engine bound at open',
      storeChip.includes(STATE.header.plant) && storeChip.includes(STATE.header.plantName),
      storeChip.replace(/\s+/g, ' '),
    )
    // 🚩 175: the plant the engine seeded is DRAWN but not settled — the opening
    // state carries `STORE_NOT_CHOSEN`, so the chip that shows it says so. The
    // console does not decide that; it reads the server's own `submitBlockers`.
    check(
      'the seeded store chip needs attention, and the unset ones are not settled',
      (await page.locator('[data-cc-chip="store"]').getAttribute('data-cc-chip-state')) === 'needsAttention' &&
        (await page.locator('[data-cc-chip="slot"]').getAttribute('data-cc-chip-state')) !== 'settled',
      STATE.capabilities.submitBlockers.join(', '),
    )

    // The empty basket and the engine's zero totals.
    check('renders the empty basket', await page.locator('[data-cc-basket-empty]').isVisible())
    const payable = await text(page, '[data-cc-payable]')
    check(
      'the receipt shows the ENGINE total, not a client sum',
      payable.startsWith(STATE.totals.payable.toFixed(2)),
      payable.replace(/\s+/g, ' '),
    )

    // Submit: disabled by `capabilities`, reason named from `submitBlockers`.
    check('Place order is disabled', await page.locator('[data-cc-submit]').isDisabled())
    const blockers = await text(page, '[data-cc-blockers]')
    check(
      'the reason submit is blocked is named',
      STATE.capabilities.submitBlockers.length > 0 && blockers.length > 0,
      blockers.replace(/\s+/g, ' '),
    )

    // Chrome-less: no app nav around it (map 126 note 13).
    check('no app nav chrome', (await page.locator('nav').count()) === 0)
    check('the console fills the viewport', (await page.locator('[data-cc-console]').boundingBox()).height >= 880)

    // 165 — the rail is live from the first frame, and the caret is already in it.
    check('the empty rail is drawn and live', await page.locator('#cc-phone').isEnabled())

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 4. the nav leaf, for a granted agent, off the same probe ----
  {
    const { context, page, calls } = await open(browser, { granted: true })
    await page.goto(`${BASE}/`)
    await page.locator('nav').first().waitFor({ timeout: 10_000 })
    const labels = await page
      .locator('nav')
      .first()
      .locator('button, a')
      .evaluateAll((els) => els.map((e) => e.innerText.trim()))
    check('the granted agent sees the Call center leaf', labels.some((l) => /call center/i.test(l)), labels.join(' | '))
    check('the leaf costs one Access call', count(calls, /^CallCenterWeb\/Access$/) === 1)
    check('the nav opens no order', count(calls, /^CallCenterWeb\/Open$/) === 0)
    await context.close()
  }

  // ---- 5. refused: the denial, both ways home, and NO order opened ----
  {
    const { context, page, errors, calls } = await open(browser, { granted: false })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice]').waitFor({ timeout: 10_000 })

    check('a refused agent gets the denial', (await page.locator('[data-cc-notice]').getAttribute('data-cc-notice')) === 'denied')
    check('a refused console opens NO order', count(calls, /^CallCenterWeb\/Open$/) === 0)
    check('the console itself never renders', (await page.locator('[data-cc-console]').count()) === 0)
    // 🚩 The whole point of this box: a chrome-less refusal has no nav to leave by.
    check('the denial offers Back to the portal', await page.locator('[data-cc-home]').isVisible())
    check('the denial offers Sign out', await page.locator('[data-cc-signout]').isVisible())
    check('no nav to leave by — which is why the two above matter', (await page.locator('nav').count()) === 0)

    // And the way home actually goes home.
    await page.locator('[data-cc-home]').click()
    await page.waitForURL(`${BASE}/`, { timeout: 10_000 })
    check('Back to the portal lands on the portal', page.url().replace(/\/$/, '') === BASE)

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 6. the probe itself errors: unavailable copy, still no order ----
  {
    const { context, page, calls } = await open(browser, { probe: 'unreachable' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice]').waitFor({ timeout: 10_000 })

    check(
      'an errored probe says the CHECK failed, not "ask for a grant"',
      (await page.locator('[data-cc-notice]').getAttribute('data-cc-notice')) === 'unavailable',
    )
    check('an errored probe opens NO order', count(calls, /^CallCenterWeb\/Open$/) === 0)
    check('an errored probe still carries both ways home', (await page.locator('[data-cc-home]').isVisible()) && (await page.locator('[data-cc-signout]').isVisible()))
    await context.close()
  }

  // ---- 7. the probe REFUSES with a code: the denial, not the server-fault copy ----
  {
    const { context, page, calls } = await open(browser, { probe: 'notGranted' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice]').waitFor({ timeout: 10_000 })
    check(
      'CONSOLE_NOT_GRANTED reads as a refusal, not "try again shortly"',
      (await page.locator('[data-cc-notice]').getAttribute('data-cc-notice')) === 'denied',
    )
    check('a coded refusal opens NO order', count(calls, /^CallCenterWeb\/Open$/) === 0)
    await context.close()
  }

  // ---- 8. the DOOR refuses Open, though the probe admitted ----
  {
    const { context, page } = await open(browser, { granted: true, door: 'notGranted' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice]').waitFor({ timeout: 10_000 })
    check(
      'a door refusal draws the denial, not "the order could not be opened"',
      (await page.locator('[data-cc-notice]').getAttribute('data-cc-notice')) === 'denied',
    )
    check(
      'and offers no dead "try again" — only the ways home',
      (await page.locator('[data-cc-notice] button, [data-cc-notice] a').count()) === 2,
    )
    await context.close()
  }

  // ---- 9. the leaf is hidden in both refused cases ----
  for (const scenario of [{ granted: false }, { probe: 'unreachable' }]) {
    const { context, page } = await open(browser, scenario)
    await page.goto(`${BASE}/`)
    await page.locator('nav').first().waitFor({ timeout: 10_000 })
    const labels = await page
      .locator('nav')
      .first()
      .locator('button, a')
      .evaluateAll((els) => els.map((e) => e.innerText.trim()))
    check(
      `the leaf is hidden (${scenario.probe === 'unreachable' ? 'probe errored' : 'not granted'})`,
      !labels.some((l) => /call center/i.test(l)),
      labels.join(' | '),
    )
    await context.close()
  }

  // ================= ticket 163 — an order is already open =================

  // ---- 10. the choice is drawn, and NOTHING of the old order is inherited ----
  {
    const { context, page, errors, calls } = await open(browser, { existing: EXISTING })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice="existing"]').waitFor({ timeout: 10_000 })

    check(
      'the previous caller is named in the heading',
      (await text(page, '[data-cc-existing-title]')).includes(EXISTING.customerName),
      await text(page, '[data-cc-existing-title]'),
    )
    check('the line count is shown', (await text(page, '[data-cc-existing="lines"]')) === String(EXISTING.lineCount))
    check('when it was opened is shown', (await text(page, '[data-cc-existing="opened"]')).length > 0, await text(page, '[data-cc-existing="opened"]'))
    check('the fulfilment store is shown', (await text(page, '[data-cc-existing="store"]')) === EXISTING.plant)

    // 🚩 The heart of it: the previous caller's basket is not on screen at all.
    check('no console is rendered behind the choice', (await page.locator('[data-cc-console]').count()) === 0)
    check('no basket is rendered', (await page.locator('[data-cc-basket]').count()) === 0)
    check(
      'nothing about that order is even fetched until the agent chooses',
      count(calls, /^CallCenterWeb\/State$/) === 0,
    )
    check('it is not treated as an error — Open was a SUCCESS', count(calls, /^CallCenterWeb\/Open$/) === 1)

    check('both choices are offered', (await page.locator('[data-cc-resume]').isVisible()) && (await page.locator('[data-cc-start-fresh]').isVisible()))
    check('and no confirmation is up yet', (await page.locator('[data-cc-abandon-dialog]').count()) === 0)
    // 🚩 A chrome-less screen has no nav to leave by (134 §8) — the choice is a
    // non-console state like any other and owes the agent both exits.
    check(
      'the choice still carries both ways home',
      (await page.locator('[data-cc-home]').isVisible()) && (await page.locator('[data-cc-signout]').isVisible()),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 11. Resume — reads THAT order and lands on it ----
  {
    const { context, page, errors, calls } = await open(browser, { existing: EXISTING })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-resume]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-resume]').click()
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    check('Resume reads the existing order back', count(calls, /^CallCenterWeb\/State$/) === 1)
    check('Resume opens NO second order', count(calls, /^CallCenterWeb\/Open$/) === 1)
    check('Resume abandons nothing', count(calls, /^CallCenterWeb\/Abandon$/) === 0)
    check(
      'the console is back where it was — the lines are there',
      (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length,
      `${await page.locator('[data-cc-line]').count()} line(s)`,
    )
    check(
      'and it is THAT order, by identity',
      (await page.locator('[data-cc-console]').getAttribute('data-cc-transaction')) === PRIOR_ID,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 11b. a resume that FAILS still leaves the agent a way to an order ----
  {
    const { context, page, calls } = await open(browser, { existing: EXISTING, stateFailures: 1 })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-resume]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-resume]').click()
    await page.locator('[data-cc-resume-error]').waitFor({ timeout: 10_000 })

    // 🚩 The failure must not swallow the choice: *abandon and start fresh* is
    // the action that would still get this agent an order.
    check('a failed resume says so on the choice screen', await page.locator('[data-cc-notice="existing"]').isVisible())
    check('and leaves Abandon and start fresh reachable', await page.locator('[data-cc-start-fresh]').isEnabled())
    check('and still carries both ways home', (await page.locator('[data-cc-home]').isVisible()) && (await page.locator('[data-cc-signout]').isVisible()))
    check('a failed resume opened no second order', count(calls, /^CallCenterWeb\/Open$/) === 1)

    // Resume is a retry of itself — `getState` is a pure read, so it costs nothing.
    await page.locator('[data-cc-resume]').click()
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('Resume retries itself and lands on the order', (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)
    check('and it took two reads, not two opens', count(calls, /^CallCenterWeb\/State$/) === 2 && count(calls, /^CallCenterWeb\/Open$/) === 1)
    await context.close()
  }

  // ---- 12. Abandon and start fresh — confirmed, ordered, and on a NEW id ----
  {
    const { context, page, errors, calls, wire } = await open(browser, { existing: EXISTING })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-start-fresh]').waitFor({ timeout: 10_000 })

    // 🚩 Not reachable by accident: the click OPENS a confirmation, it does not void.
    await page.locator('[data-cc-start-fresh]').click()
    await page.locator('[data-cc-abandon-dialog]').waitFor({ timeout: 5_000 })
    check('the first click only asks', count(calls, /^CallCenterWeb\/Abandon$/) === 0)
    check(
      'and the confirmation names what is thrown away',
      (await text(page, '[data-cc-abandon-cost]')).includes(String(EXISTING.lineCount)),
      await text(page, '[data-cc-abandon-cost]'),
    )
    await page.locator('[data-cc-abandon-cancel]').click()
    // The dialog is gone before we count — otherwise a cancel that DID fire an
    // abandon would simply not have reached the interceptor yet, and the check
    // would pass for the wrong reason. The total count after the real abandon
    // below is the second, independent guard on the same property.
    await page.locator('[data-cc-abandon-dialog]').waitFor({ state: 'detached', timeout: 5_000 })
    check('backing out voids nothing', count(calls, /^CallCenterWeb\/Abandon$/) === 0)
    check('and leaves the choice standing', await page.locator('[data-cc-notice="existing"]').isVisible())

    await page.locator('[data-cc-start-fresh]').click()
    await page.locator('[data-cc-abandon-confirm]').click()
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    const verbs = wire.filter((w) => /^CallCenterWeb\/(Open|Abandon)$/.test(w.path)).map((w) => w.path)
    check('abandon runs BEFORE the new open', verbs.join(' → ') === 'CallCenterWeb/Open → CallCenterWeb/Abandon → CallCenterWeb/Open', verbs.join(' → '))
    check(
      'it abandons the order the agent was told about',
      wire.find((w) => w.path === 'CallCenterWeb/Abandon')?.body?.transactionId === PRIOR_ID,
    )
    const openIds = wire.filter((w) => w.path === 'CallCenterWeb/Open').map((w) => w.body?.requestId)
    check(
      'the second open is a genuinely NEW action, not a replay of the refused one',
      openIds.length === 2 && openIds[0] && openIds[1] && openIds[0] !== openIds[1],
      openIds.join(' | '),
    )
    check('the abandon carries its own requestId', wire.find((w) => w.path === 'CallCenterWeb/Abandon')?.body?.requestId && !openIds.includes(wire.find((w) => w.path === 'CallCenterWeb/Abandon').body.requestId))
    check('the new order is empty', await page.locator('[data-cc-basket-empty]').isVisible())
    // By IDENTITY, not by emptiness — any other empty order would satisfy a
    // line count of zero, and "you are on a different order" is the claim.
    const landedOn = await page.locator('[data-cc-console]').getAttribute('data-cc-transaction')
    check('and it is not the one that was abandoned', landedOn === FRESH_ID && landedOn !== PRIOR_ID, landedOn)
    check('the cancelled confirmation never voided anything either', count(calls, /^CallCenterWeb\/Abandon$/) === 1)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 13. abandoning from INSIDE a live order — the same act, same landing ----
  {
    const { context, page, errors, wire } = await open(browser, { openState: PRIOR_STATE })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('a live order offers Abandon', await page.locator('[data-cc-abandon]').isVisible())

    await page.locator('[data-cc-abandon]').click()
    await page.locator('[data-cc-abandon-dialog]').waitFor({ timeout: 5_000 })
    check(
      'the same confirmation, naming this order’s caller and cost',
      (await text(page, '[data-cc-abandon-dialog]')).includes(PRIOR_STATE.header.customer.name) &&
        (await text(page, '[data-cc-abandon-cost]')).includes(String(PRIOR_STATE.lines.length)),
      (await text(page, '[data-cc-abandon-dialog]')).replace(/\s+/g, ' '),
    )

    await page.locator('[data-cc-abandon-confirm]').click()
    // 🚩 Never left with nothing: abandon returns no state, so an order follows it.
    await page.waitForFunction(
      () => document.querySelectorAll('[data-cc-line]').length === 0 && !!document.querySelector('[data-cc-console]'),
      undefined,
      { timeout: 10_000 },
    )
    const verbs = wire.filter((w) => /^CallCenterWeb\/(Open|Abandon)$/.test(w.path)).map((w) => w.path)
    check('abandon then open, and the agent lands on an order', verbs.join(' → ') === 'CallCenterWeb/Open → CallCenterWeb/Abandon → CallCenterWeb/Open', verbs.join(' → '))
    check('the console is still there, holding a fresh order', await page.locator('[data-cc-console]').isVisible())
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ============ ticket 164 — collisions, stale tabs, and the contract ============

  // ---- 14. a busy collision is ridden out, and never blocks the screen ----
  {
    const { context, page, errors, calls } = await open(browser, { openState: PRIOR_STATE, stateBusy: 3 })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    // `getState` is §6.1's universal recovery action, and this is the agent's
    // hand on it — the one verb slice 0 has that can meet the claim.
    await page.locator('[data-cc-refresh]').click()
    await page.locator('[data-cc-busy="retrying"]').waitFor({ timeout: 10_000 })

    check('a collision shows the retrying strip', await page.locator('[data-cc-busy="retrying"]').isVisible())
    check(
      'it says it is retrying AND that nothing is lost',
      (await text(page, '[data-cc-busy="retrying"]')).length > 20,
      (await text(page, '[data-cc-busy="retrying"]')).replace(/\s+/g, ' '),
    )
    // 🚩 The heart of it: routine, so the screen is never taken away.
    check('the console is still on screen', await page.locator('[data-cc-console]').isVisible())
    check('the basket is still on screen', await page.locator('[data-cc-basket]').isVisible())
    check(
      'the lines are still there — nothing was blanked while waiting',
      (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length,
    )
    check('no blocking full-screen spinner', (await page.locator('[data-cc-status]').count()) === 0)
    check('no modal over the order', (await page.locator('[data-cc-abandon-dialog]').count()) === 0)
    check('the strip is IN the flow, inside the console', (await page.locator('[data-cc-console] [data-cc-busy]').count()) === 1)
    check('and the order stays usable — its controls are live', await page.locator('[data-cc-abandon]').isEnabled())
    check('it does not offer a retry while it is retrying itself', (await page.locator('[data-cc-busy-retry]').count()) === 0)

    // It clears itself: a collision that resolves leaves no trace to dismiss.
    await page.locator('[data-cc-busy]').waitFor({ state: 'detached', timeout: 15_000 })
    check('the strip clears itself when the collision does', (await page.locator('[data-cc-busy]').count()) === 0)
    check(
      'the retries were the CLIENT’s, on one agent action',
      count(calls, /^CallCenterWeb\/State$/) === 4,
      `${count(calls, /^CallCenterWeb\/State$/)} State call(s)`,
    )
    check('and it opened no second order to recover', count(calls, /^CallCenterWeb\/Open$/) === 1)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 15. the schedule runs out — and the agent still has an action ----
  {
    // Six busy answers = every attempt of the first run; the manual retry then
    // lands on the seventh. The schedule is 0·400·800·1600·3200 ms, so this box
    // spends ~6 s in the strip on purpose — that IS the ceiling being bounded.
    const { context, page, errors } = await open(browser, { openState: PRIOR_STATE, stateBusy: 6 })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-refresh]').click()

    await page.locator('[data-cc-busy="exhausted"]').waitFor({ timeout: 20_000 })
    check('the exhausted schedule says so', await page.locator('[data-cc-busy="exhausted"]').isVisible())
    // 🚩 Never left without an action (US61).
    check('and offers a manual retry', await page.locator('[data-cc-busy-retry]').isVisible())
    check('the order is still there behind it', (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)
    check('the sweep stops — nothing implies it is still trying', (await page.locator('[data-cc-busy-hairline]').count()) === 0)

    await page.locator('[data-cc-busy-retry]').click()
    await page.locator('[data-cc-busy]').waitFor({ state: 'detached', timeout: 15_000 })
    check('the manual retry lands them back on their order', await page.locator('[data-cc-console]').isVisible())
    check('and it is the same order, not a new one', (await page.locator('[data-cc-console]').getAttribute('data-cc-transaction')) === PRIOR_STATE.transactionId)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 16. the stale tab: refused, returned to the start, never misrouted ----
  {
    const { context, page, errors, calls } = await open(browser, { openState: PRIOR_STATE, stateClosed: true })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-refresh]').click()
    await page.locator('[data-cc-notice="sessionClosed"]').waitFor({ timeout: 10_000 })

    // 🚩 The dead basket is GONE. A tab still showing an order that no longer
    // exists is where the stale-tab harm starts (§6.2).
    check('the dead order stops being rendered', (await page.locator('[data-cc-console]').count()) === 0)
    check('no lines survive it', (await page.locator('[data-cc-line]').count()) === 0)
    check(
      'the reason is named in the agent’s words',
      /abandoned/i.test(await text(page, '[data-cc-notice="sessionClosed"]')),
      (await text(page, '[data-cc-notice="sessionClosed"]')).replace(/\s+/g, ' '),
    )
    check(
      'and the server’s own sentence is passed through',
      (await text(page, '[data-cc-notice="sessionClosed"]')).includes(CLOSED_MESSAGE),
    )
    check('it is not retried into the ground', count(calls, /^CallCenterWeb\/State$/) === 1)
    check('a chrome-less dead end still carries both ways home', (await page.locator('[data-cc-home]').isVisible()) && (await page.locator('[data-cc-signout]').isVisible()))

    // Return to the start: a genuinely new open action, which either opens or
    // lands on 163's choice naming the agent's real current order.
    await page.locator('[data-cc-retry]').click()
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('starting again opens a new order', count(calls, /^CallCenterWeb\/Open$/) === 2)
    check(
      'and it is not the dead one',
      (await page.locator('[data-cc-console]').getAttribute('data-cc-transaction')) === FRESH_ID,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 17. the contract version: a major stops it, a minor is a non-event ----
  {
    const { context, page, errors } = await open(browser, { contractVersion: '2.0' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-notice="contractVersion"]').waitFor({ timeout: 10_000 })

    check('a major mismatch stops the console', (await page.locator('[data-cc-console]').count()) === 0)
    check('no money is rendered at all', (await page.locator('[data-cc-payable]').count()) === 0)
    check(
      'it names both versions, so someone can act on it',
      /2\.0/.test(await text(page, '[data-cc-notice="contractVersion"]')),
      (await text(page, '[data-cc-notice="contractVersion"]')).replace(/\s+/g, ' '),
    )
    // Retrying cannot change which client is installed.
    check('and offers no dead "try again" — only the ways home', (await page.locator('[data-cc-notice] button, [data-cc-notice] a').count()) === 2)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }
  {
    // §9 — additive changes bump the minor and ship server-first. A console that
    // stopped on one would make every additive server change a client release.
    const { context, page } = await open(browser, { contractVersion: '1.7' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('minor drift is ignored by rule', await page.locator('[data-cc-basket]').isVisible())
    await context.close()
  }
  {
    // 🚩 And a server that sends no version at all still gets a console. Law 10
    // says it should send one, but silence is not evidence of a MAJOR change —
    // stopping here would brick the console against the very server this slice
    // is waiting on (BackOffice 804 is unbuilt).
    const { context, page } = await open(browser, { contractVersion: 'none' })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('a missing version degrades rather than refusing', await page.locator('[data-cc-basket]').isVisible())
    await context.close()
  }

  // ============ ticket 165 — the caller, the rail, and the address book ============

  // ---- 18/19. the caret, the lookup, the six-field card, the opened book ----
  {
    const { context, page, errors, calls, wire } = await open(browser, {})
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    // 🚩 US9 / CC2 finding 1: the first keystroke of the call is the one the
    // screen expects. Nothing has been clicked at this point.
    check(
      'the caret is in the phone field the moment the console opens',
      await page.evaluate(() => document.activeElement?.id === 'cc-phone'),
      await page.evaluate(() => document.activeElement?.tagName + '#' + document.activeElement?.id),
    )

    // 🚩 Customer-first as intent, not enforcement: with no caller there is no
    // control to poke — the console states the next step instead.
    check(
      'no caller ⇒ the address block offers nothing to reach',
      (await page.locator('[data-cc-pick-address]').count()) === 0 &&
        (await page.locator('[data-cc-address="noCaller"]').isVisible()),
    )
    check(
      'and it says what the next step is',
      (await text(page, '[data-cc-address="noCaller"]')).length > 10,
      (await text(page, '[data-cc-address="noCaller"]')).replace(/\s+/g, ' '),
    )

    // Typing straight in, without clicking: the caret is already there.
    await page.keyboard.type(MEMBER.mobile)
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-lookup-found]').waitFor({ timeout: 10_000 })
    check(
      'the lookup names who was found BEFORE anything is bound to the order',
      (await text(page, '[data-cc-lookup-found]')).includes(MEMBER.fullName),
      (await text(page, '[data-cc-lookup-found]')).replace(/\s+/g, ' '),
    )
    check('finding is not attaching', count(calls, /^CallCenterWeb\/AttachCustomer$/) === 0)
    check('the caller is still not on the order', (await page.locator('[data-cc-caller]').count()) === 0)
    check(
      'and the address book is still shut',
      (await page.locator('[data-cc-pick-address]').count()) === 0,
    )

    await page.locator('[data-cc-attach]').click()
    await page.locator('[data-cc-caller]').waitFor({ timeout: 10_000 })

    const attach = wire.find((w) => w.path === 'CallCenterWeb/AttachCustomer')
    check('attach sends the loyalty id the lookup returned', attach?.body?.customerId === MEMBER.loyId, String(attach?.body?.customerId))
    check('on this order, with its own requestId', attach?.body?.transactionId === STATE.transactionId && !!attach?.body?.requestId)
    check(
      'and it is one action, one id — not the open’s',
      attach?.body?.requestId !== wire.find((w) => w.path === 'CallCenterWeb/Open')?.body?.requestId,
    )

    // 135's compact-layout discipline: the seventh field is what turns a rail
    // into a form. The cap is asserted, not assumed.
    const fields = await page.locator('[data-cc-rail-field]').evaluateAll((els) =>
      els.map((e) => e.getAttribute('data-cc-rail-field')),
    )
    check('the rail card is capped at six fields', fields.length <= 6, `${fields.length}: ${fields.join(', ')}`)
    check(
      'in a fixed order, identity first',
      fields.join(',') === 'name,mobile,member,tier,points,email',
      fields.join(','),
    )
    check(
      'the identity shown is the ORDER’s, not the lookup’s',
      (await text(page, '[data-cc-rail-field="name"]')).includes(ATTACHED_CUSTOMER.name) &&
        ATTACHED_CUSTOMER.name !== MEMBER.fullName,
      await text(page, '[data-cc-rail-field="name"]'),
    )
    check('the rail is still pinned at the start edge', await page.locator('[data-cc-rail]').isVisible())

    // 🚩 The heart of it: the control appears because `capabilities` opened it.
    check('attaching opens the address book', await page.locator('[data-cc-pick-address]').isVisible())
    check(
      'as an empty dashed slot, with its own action',
      (await page.locator('[data-cc-address="pick"]').isVisible()) &&
        (await page.locator('[data-cc-address="noCaller"]').count()) === 0,
    )

    // 🚩 And the next call starts clean. A found card left standing would offer
    // *Attach this caller* for the caller just removed, over a box still holding
    // their number — and US9's caret would land in the previous call.
    await page.locator('[data-cc-remove-caller]').click()
    await page.locator('#cc-phone').waitFor({ timeout: 10_000 })
    check('removing the caller empties the search', (await page.locator('#cc-phone').inputValue()) === '')
    check('the removed caller is not left there to re-attach', (await page.locator('[data-cc-attach]').count()) === 0)
    check('nor their found card', (await page.locator('[data-cc-lookup-found]').count()) === 0)

    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 19b. the capability decides, not "a caller is attached" ----
  {
    // A caller IS attached and the door still says no (§6.3 — v1.1's PickInStore
    // reports through the same capability). A console that re-derived the rule
    // would offer a control the door refuses.
    const attachedShut = {
      ...PRIOR_STATE,
      header: { ...PRIOR_STATE.header, address: null },
      capabilities: { ...PRIOR_STATE.capabilities, canOpenAddressBook: false },
    }
    const { context, page } = await open(browser, { openState: attachedShut })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    check('a caller alone does not open the book', (await page.locator('[data-cc-pick-address]').count()) === 0)
    check(
      'and the closed state is not a disabled control to poke',
      (await page.locator('[data-cc-address="unavailable"]').isVisible()) &&
        (await page.locator('[data-cc-address="unavailable"] button').count()) === 0,
    )
    await context.close()
  }

  // ---- 20. a number nobody holds ----
  {
    const { context, page, errors, calls } = await open(browser, { memberFound: false })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.keyboard.type('0500000000')
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-lookup-miss]').waitFor({ timeout: 10_000 })

    check('a miss says so', (await text(page, '[data-cc-lookup-miss]')).length > 10, (await text(page, '[data-cc-lookup-miss]')).replace(/\s+/g, ' '))
    check('a miss is not an error', (await page.locator('[data-cc-lookup-error]').count()) === 0)
    // ⚠ Loyalty signup is 159's undrawn surface — this slice must not invent one.
    check('and offers nothing to attach', (await page.locator('[data-cc-attach]').count()) === 0)
    check('nothing was bound to the order', count(calls, /^CallCenterWeb\/AttachCustomer$/) === 0)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 21. removing the caller: the address goes, the store stays ----
  {
    // Off an order that has BOTH — a caller, their address, and a plant derived
    // from it. That is the only shape in which "the store stays" can be seen.
    const { context, page, errors, wire } = await open(browser, { openState: PRIOR_STATE })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-caller]').waitFor({ timeout: 10_000 })
    check('the address is on the order to begin with', await page.locator('[data-cc-address="set"]').isVisible())
    const storeBefore = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')

    await page.locator('[data-cc-remove-caller]').click()
    await page.locator('[data-cc-caller]').waitFor({ state: 'detached', timeout: 10_000 })

    check('the caller is gone from the rail', (await page.locator('[data-cc-caller]').count()) === 0)
    check('the address goes with them', (await page.locator('[data-cc-address="set"]').count()) === 0)
    check('and the book is shut again', (await page.locator('[data-cc-pick-address]').count()) === 0)

    // 🚩 The property the whole slice turns on: a re-attach must not silently
    // re-price the basket, so the derived store is still standing.
    const storeAfter = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')
    check('the derived store chip is still standing', storeAfter === storeBefore && storeAfter.includes(PRIOR_STATE.header.plant), storeAfter)
    check(
      'and still reads as derived, not chosen',
      (await text(page, '[data-cc-chip="store"]')).length > 0 &&
        (await page.locator('[data-cc-chip="store"]').getAttribute('data-cc-chip-state')) === 'settled',
    )
    check('the basket is untouched', (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)

    const remove = wire.find((w) => w.path === 'CallCenterWeb/RemoveCustomer')
    check('remove carries the order and its own requestId', remove?.body?.transactionId === PRIOR_STATE.transactionId && !!remove?.body?.requestId)
    // The caret returns to where the next call starts.
    check('the phone field is back', await page.locator('#cc-phone').isVisible())
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ========== ticket 166 — the address derives the store, and says so ==========

  /** Open a console, attach the caller, and open their address book. The three
   *  steps every box below starts from — 165's path, driven rather than stubbed. */
  const openTheBook = async (page) => {
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.keyboard.type(MEMBER.mobile)
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-attach]').click()
    await page.locator('[data-cc-pick-address]').click()
    await page.locator('[data-cc-address-picker]').waitFor({ timeout: 10_000 })
  }

  /** 175's opening gate, opened the way an AGENT opens it: a caller on the order
   *  and a store somebody chose. Until both hold, `canAddItem` is false and the
   *  search row draws no *Add* at all — so every box below that puts an item in
   *  the basket starts here rather than on the bare opening state.
   *
   *  🚩 The gate is right and the setup was wrong: this is the sequence the
   *  console is built to expect, not a relaxation of the capability. The address
   *  is the one `openTheBook` offers, so the plant it derives is the stub's own —
   *  `GATED_PLANT`, which is what an order past this point is really at. */
  const GATED_ADDRESS = '77120'
  const GATED_PLANT = DERIVED_PLANT[GATED_ADDRESS].plant
  const openTheGate = async (page) => {
    await openTheBook(page)
    await page.locator(`[data-cc-address-option="${GATED_ADDRESS}"]`).click()
    await page.locator('[data-cc-address-picker]').waitFor({ state: 'detached', timeout: 10_000 })
    // The address on the rail is the state that carries the open gate with it.
    await page.locator('[data-cc-address="set"]').waitFor({ timeout: 10_000 })
  }

  // ---- 22. an address on an EMPTY basket applies inline, and says it derived ----
  {
    const { context, page, errors, calls, wire } = await open(browser, {})
    await page.goto(`${BASE}/callcenter`)
    await openTheBook(page)

    check(
      'the book lists the caller’s addresses',
      (await page.locator('[data-cc-address-option]').count()) === ADDRESS_BOOK.length,
      `${await page.locator('[data-cc-address-option]').count()} option(s)`,
    )
    check(
      'the default is offered first',
      (await page.locator('[data-cc-address-option]').first().getAttribute('data-cc-address-option')) === '77121',
    )
    check('and is marked as the default', await page.locator('[data-cc-address-default]').first().isVisible())

    const storeBefore = await text(page, '[data-cc-chip="store"]')
    check('the store is the entry store until an address decides', storeBefore.includes(STATE.header.plant), storeBefore.replace(/\s+/g, ' '))

    await page.locator('[data-cc-address-option="77120"]').click()
    // 🚩 The heart of it: it applies, and the dialog simply goes. Nothing to
    // confirm — an empty basket has nothing to re-price (§5.1).
    await page.locator('[data-cc-address-picker]').waitFor({ state: 'detached', timeout: 10_000 })

    check('picking an address sends SetAddress once', count(calls, /^CallCenterWeb\/SetAddress$/) === 1)
    const setAddress = wire.find((w) => w.path === 'CallCenterWeb/SetAddress')
    check(
      'on this order, naming the address the agent picked',
      setAddress?.body?.transactionId === STATE.transactionId && setAddress?.body?.addressNumber === '77120',
      JSON.stringify(setAddress?.body ?? null),
    )
    check(
      'with its own requestId — one action, one id',
      !!setAddress?.body?.requestId &&
        setAddress.body.requestId !== wire.find((w) => w.path === 'CallCenterWeb/AttachCustomer')?.body?.requestId,
    )
    check(
      'and NOTHING that names a store — the client does not derive one',
      !('storeCode' in (setAddress?.body ?? {})) && !('plant' in (setAddress?.body ?? {})),
      JSON.stringify(setAddress?.body ?? null),
    )
    // A console that derived the store itself would have to read the district
    // table to do it. It never asks for one.
    check(
      'no district or store lookup was fetched to work it out',
      count(calls, /Districts|Cities|StoreDetails/) === 0,
      calls.filter((c) => /Districts|Cities|StoreDetails/.test(c)).join(', '),
    )

    // 🚩 No confirmation, at all — not a dismissed one, not a skipped one.
    check('no confirmation stood in the way', (await page.locator('[data-cc-address-confirm-needed]').count()) === 0)
    check('and no modal is left on screen', (await page.locator('dialog').count()) === 0)

    const storeAfter = await text(page, '[data-cc-chip="store"]')
    check(
      'the store chip moved to the plant the SERVER derived',
      storeAfter.includes(DERIVED_PLANT['77120'].plant) && !storeAfter.includes(STATE.header.plant),
      storeAfter.replace(/\s+/g, ' '),
    )
    // The whole reason the chip carries a parenthetical: "why that branch?" is
    // answerable without opening anything.
    check(
      'and says it was DERIVED, not chosen',
      /derived/i.test(storeAfter),
      storeAfter.replace(/\s+/g, ' '),
    )
    check(
      'the chip reads settled — a derived store is not a problem to fix',
      (await page.locator('[data-cc-chip="store"]').getAttribute('data-cc-chip-state')) === 'settled',
    )
    check('the address is on the rail', await page.locator('[data-cc-address="set"]').isVisible())
    check('and can be re-opened in place', await page.locator('[data-cc-change-address]').isVisible())
    check('the basket is still empty — an address adds nothing to it', await page.locator('[data-cc-basket-empty]').isVisible())
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 23. a chip that still needs something looks like it does ----
  {
    // The server's own list, including a code this client has never heard of —
    // §9's additive change, which must reach no chip rather than be printed raw.
    const blocked = {
      ...STATE,
      capabilities: {
        ...STATE.capabilities,
        submitBlockers: ['NO_LINES', 'MISSING_SLOT', 'MISSING_PAYMENT_TYPE'],
      },
    }
    const { context, page, errors } = await open(browser, { openState: blocked })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    check(
      'the blocking chip is marked as needing attention',
      (await page.locator('[data-cc-chip="slot"]').getAttribute('data-cc-chip-state')) === 'needsAttention',
    )
    check(
      'and the ones the server did not name are not',
      (await page.locator('[data-cc-chip="source"]').getAttribute('data-cc-chip-state')) !== 'needsAttention' &&
        (await page.locator('[data-cc-chip="store"]').getAttribute('data-cc-chip-state')) === 'settled',
    )
    check(
      'an unknown blocker code reaches no chip at all',
      !/MISSING_PAYMENT_TYPE/.test(await text(page, '[data-cc-chips]')),
      (await text(page, '[data-cc-chips]')).replace(/\s+/g, ' '),
    )
    // The row grew twice since this box was written — 176 put the mode first and
    // the payment word after the reference, 159 put the coupon last — so the
    // claim is the ORDER of what the header captures rather than a count.
    const chipRow = await page
      .locator('[data-cc-chip]')
      .evaluateAll((els) => els.map((el) => el.getAttribute('data-cc-chip')))
    check(
      'the chip row is what the header captures, in the order it captures it',
      chipRow.join(',') === 'fulfilment,store,slot,source,reference,payment,coupon',
      chipRow.join(','),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 24. both refusals explained, and told apart ----
  {
    const explained = {}
    for (const kind of ['noCustomer', 'notTheirs']) {
      const { context, page, errors } = await open(browser, { addressRefusal: kind })
      await page.goto(`${BASE}/callcenter`)
      await openTheBook(page)
      const storeBefore = await text(page, '[data-cc-chip="store"]')
      await page.locator('[data-cc-address-option="77120"]').click()
      await page.locator('[data-cc-address-error]').waitFor({ timeout: 10_000 })

      const shown = (await text(page, '[data-cc-address-error]')).replace(/\s+/g, ' ')
      explained[kind] = shown
      check(`the refusal is explained (${kind})`, shown.length > 40, shown)
      check(`no machine code reaches the agent (${kind})`, !/[A-Z]{3,}_[A-Z_]+/.test(shown), shown)
      // 🚩 The contract's own wording rule: never "not found" — and the stub's
      // sentence says exactly that, so a console that relayed it would fail here.
      check(`and it never reads as "not found" (${kind})`, !/not found/i.test(shown), shown)
      check(
        `the order is untouched by the refusal (${kind})`,
        (await text(page, '[data-cc-chip="store"]')) === storeBefore &&
          (await page.locator('[data-cc-address="set"]').count()) === 0,
      )
      check(`the book stays open so the agent can act (${kind})`, await page.locator('[data-cc-address-picker]').isVisible())
      check(`no console errors (${kind})`, errors.length === 0, errors[0] ?? '')
      await context.close()
    }
    // The distinction is the point: one is an ordering problem the agent fixes
    // in a step, the other is a data problem someone has to hear about.
    check('the two refusals are told apart', explained.noCustomer !== explained.notTheirs)
  }

  // ---- 25. the book is read when it is opened, and never opens itself ----
  {
    const { context, page, errors, calls } = await open(browser, { bookFailures: 1 })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.keyboard.type(MEMBER.mobile)
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-attach]').click()
    await page.locator('[data-cc-pick-address]').waitFor({ timeout: 10_000 })

    // Attaching a caller opens the book's DOOR; it does not read it. An agent
    // who never changes the address should cost the door nothing.
    check(
      'attaching does not read the address book',
      count(calls, /^CallCenterWeb\/CustomerAddresses$/) === 0,
    )

    await page.locator('[data-cc-pick-address]').click()
    await page.locator('[data-cc-address-error]').waitFor({ timeout: 10_000 })
    // 🚩 A failed read is not a dead end — the read is pure, so it may be tried
    // again, and the agent is holding the only address the caller has.
    check('a failed book read offers a retry', await page.locator('[data-cc-address-reload]').isVisible())
    await page.locator('[data-cc-address-reload]').click()
    await page.locator('[data-cc-address-option="77120"]').waitFor({ timeout: 10_000 })
    check('and the retry lands on the book', (await page.locator('[data-cc-address-option]').count()) === 2)
    check('it is not retried into the ground', count(calls, /^CallCenterWeb\/CustomerAddresses$/) === 2)

    // 🚩 The book belongs to whoever is attached. Swapping callers mid-open must
    // not leave the next caller's addresses springing open by themselves.
    await page.locator('[data-cc-address-close]').click()
    await page.locator('[data-cc-remove-caller]').click()
    await page.locator('#cc-phone').waitFor({ timeout: 10_000 })
    await page.keyboard.type(MEMBER.mobile)
    await page.keyboard.press('Enter')
    await page.locator('[data-cc-attach]').click()
    await page.locator('[data-cc-pick-address]').waitFor({ timeout: 10_000 })
    check(
      'the next caller’s book does not open by itself',
      (await page.locator('[data-cc-address-picker]').count()) === 0,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ====== ticket 167 — the store move is previewed, committed, or refused ======

  /** A LIVE order — a caller, an address, two priced lines — with its address
   *  book open. Everything below starts here: the confirmation exists only where
   *  there is money on screen to move. */
  const openTheBookOnALiveOrder = async (page) => {
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-change-address]').click()
    await page.locator('[data-cc-address-picker]').waitFor({ timeout: 10_000 })
  }
  const MOVED_TO = DERIVED_PLANT['77121']

  // ---- 26. a move on a live basket is PREVIEWED, and declining leaves nothing ----
  {
    const { context, page, errors, calls, wire } = await open(browser, { openState: PRIOR_STATE })
    await page.goto(`${BASE}/callcenter`)
    await openTheBookOnALiveOrder(page)

    const storeBefore = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')
    const payableBefore = await text(page, '[data-cc-payable]')

    await page.locator('[data-cc-address-option="77121"]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ timeout: 10_000 })

    // 🚩 The heart of it: the server answered 200 with the UNCHANGED state, so
    // nothing on the order has moved while the agent reads what would.
    check(
      'the store chip has NOT moved — the preview is not an application',
      (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ') === storeBefore,
      await text(page, '[data-cc-chip="store"]'),
    )
    check('and the total is exactly what it was', (await text(page, '[data-cc-payable]')) === payableBefore)
    check('the basket is untouched', (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)

    // A modal sheet, ruled at 135: an inline card in a scrolling flow can be
    // scrolled past, and this is a moment that must be able to stop the agent.
    check('the preview is a modal, not a card in the flow', (await page.locator('dialog[open]').count()) === 1)
    check(
      'and it replaced the book rather than stacking on it',
      (await page.locator('[data-cc-address-picker]').count()) === 0,
    )

    const sheet = (await text(page, '[data-cc-confirm-sheet="storeChange"]')).replace(/\s+/g, ' ')
    check('it names where the order is moving from', (await text(page, '[data-cc-rebind-from]')).includes(PRIOR_STATE.header.plant), sheet)
    check('and where it is moving to', (await text(page, '[data-cc-rebind-to]')).includes(MOVED_TO.plant), sheet)
    check(
      'every line in the diff is named, line by line',
      (await page.locator('[data-cc-rebind-line]').count()) === REBIND_DETAIL.lineDiffs.length,
      `${await page.locator('[data-cc-rebind-line]').count()} of ${REBIND_DETAIL.lineDiffs.length}`,
    )
    for (const line of REBIND_DETAIL.lineDiffs) {
      const row = (await text(page, `[data-cc-rebind-line="${line.lineId}"]`)).replace(/\s+/g, ' ')
      check(
        `line ${line.lineId} shows what it costs now and what it would cost`,
        row.includes(line.fromGross.toFixed(2)) && row.includes(line.toGross.toFixed(2)),
        row,
      )
    }
    // 🚩 The v1.2 capture reports `promotionsMoved: []` and will keep doing so:
    // the engine's rebind diff is per LINE, not per offer (857 divergence 3). So the
    // sheet draws no promotion row — asserted as the capture's own truth rather than
    // deleted, because a row appearing here would mean the engine changed.
    check(
      'the capture moves no promotion, so the sheet claims none',
      REBIND_DETAIL.promotionsMoved.length === 0 &&
        (await page.locator('[data-cc-rebind-promo]').count()) === 0,
    )
    check(
      'the availability re-freeze is named',
      (await page.locator('[data-cc-rebind-atp]').count()) > 0,
      (await text(page, '[data-cc-rebind-atp]')).replace(/\s+/g, ' '),
    )
    // 🚩 The capture's `detail` carries no `deliveryFee` at all — the engine's diff
    // does not report one. An ABSENT fee is not a fee that moved, so no row.
    check(
      'a diff that states no delivery fee reports no fee change',
      REBIND_DETAIL.deliveryFee === undefined &&
        (await page.locator('[data-cc-rebind-fee]').count()) === 0,
    )
    check('nothing has been committed yet', count(calls, /^CallCenterWeb\/SetAddress$/) === 1)
    check(
      'and the one call carried no token — the preview IS the first send',
      wire.filter((w) => w.path === 'CallCenterWeb/SetAddress').every((w) => !w.body.confirmToken),
    )

    // 🚩 Declining costs nothing: the preview was the engine door run and not
    // persisted, which is why there is no dry-run flag (129).
    await page.locator('[data-cc-confirm-decline]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ state: 'detached', timeout: 10_000 })
    check('declining sends nothing at all', count(calls, /^CallCenterWeb\/(SetAddress|SetStore)$/) === 1)
    check('and leaves no trace on the order', (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ') === storeBefore)
    check('no modal is left on screen', (await page.locator('dialog[open]').count()) === 0)
    check('the console is still there, holding the same order', await page.locator('[data-cc-console]').isVisible())
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 26b. a preview that already names an unpriceable line offers no commit ----
  {
    // Fixture 06's own preview half. Its note: the console can refuse BEFORE the
    // agent commits, because `unpriceableLines[]` rides the preview as well as
    // the refusal (§5.1). A button whose only possible answer is REBIND_REFUSED
    // is a refusal the agent has to discover by pressing it.
    const { context, page, errors, calls } = await open(browser, {
      openState: PRIOR_STATE,
      rebind: 'previewRefuses',
    })
    await page.goto(`${BASE}/callcenter`)
    await openTheBookOnALiveOrder(page)
    await page.locator('[data-cc-address-option="77121"]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ timeout: 10_000 })

    check(
      'the preview names the line that would not price',
      await page.locator(`[data-cc-rebind-unpriceable-line="${REFUSED_LINE.lineId}"]`).isVisible(),
      (await text(page, '[data-cc-rebind-unpriceable]')).replace(/\s+/g, ' '),
    )
    check('and says the move is all-or-nothing', /all-or-nothing/i.test(await text(page, '[data-cc-rebind-unpriceable]')))
    check('the commit is refused here, before it is sent', await page.locator('[data-cc-confirm-accept]').isDisabled())
    check('backing out is still offered', await page.locator('[data-cc-confirm-decline]').isEnabled())

    await page.locator('[data-cc-confirm-decline]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ state: 'detached', timeout: 10_000 })
    check('nothing was ever committed', count(calls, /^CallCenterWeb\/SetAddress$/) === 1)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 27. accepting commits exactly what was previewed, on the SAME id ----
  {
    const { context, page, errors, calls, wire } = await open(browser, { openState: PRIOR_STATE })
    await page.goto(`${BASE}/callcenter`)
    await openTheBookOnALiveOrder(page)
    await page.locator('[data-cc-address-option="77121"]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ timeout: 10_000 })

    await page.locator('[data-cc-confirm-accept]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ state: 'detached', timeout: 10_000 })

    const sends = wire.filter((w) => w.path === 'CallCenterWeb/SetAddress')
    check('the commit is a second send of the same verb', sends.length === 2)
    // 🚩 One user action is one requestId — INCLUDING the retry that carries the
    // token (§4). A fresh id here is the double-apply the ledger exists to stop.
    check(
      'on the SAME requestId as the preview',
      sends[0].body.requestId === sends[1].body.requestId,
      `${sends[0].body.requestId} | ${sends[1].body.requestId}`,
    )
    check(
      'carrying the token the preview was pinned with',
      !sends[0].body.confirmToken && sends[1].body.confirmToken === CONFIRM_TOKEN,
      JSON.stringify(sends[1].body),
    )
    check('and naming the same address the agent picked', sends[1].body.addressNumber === '77121')

    const storeAfter = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')
    check(
      'the order is now at the store the preview named',
      storeAfter.includes(MOVED_TO.plant) && !storeAfter.includes(PRIOR_STATE.header.plant),
      storeAfter,
    )
    check('and it still reads as derived — the address decided it', /derived/i.test(storeAfter), storeAfter)
    check('the basket survived the move', (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)
    check('no refusal banner', (await page.locator('[data-cc-rebind-refused]').count()) === 0)
    check('and the address book did not spring back open', (await page.locator('[data-cc-address-picker]').count()) === 0)
    check('it opened no order to do it', count(calls, /^CallCenterWeb\/Open$/) === 1)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 28. a stale token RE-PREVIEWS — it never commits a diff unseen ----
  {
    const { context, page, errors, wire } = await open(browser, { openState: PRIOR_STATE, rebind: 'staleOnce' })
    await page.goto(`${BASE}/callcenter`)
    await openTheBookOnALiveOrder(page)
    await page.locator('[data-cc-address-option="77121"]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-confirm-accept]').click()

    // 🚩 The basket moved underneath the preview, so the agent is shown a fresh
    // one rather than having the old diff committed for them.
    await page.locator('[data-cc-confirm-reissued]').waitFor({ timeout: 10_000 })
    check('a stale token re-previews rather than committing', await page.locator('[data-cc-confirm-sheet="storeChange"]').isVisible())
    check(
      'and says why they are being asked twice',
      (await text(page, '[data-cc-confirm-reissued]')).length > 40,
      (await text(page, '[data-cc-confirm-reissued]')).replace(/\s+/g, ' '),
    )
    check('no machine code reaches the agent', !/[A-Z]{3,}_[A-Z_]+/.test(await text(page, '[data-cc-confirm-sheet="storeChange"]')))

    const sends = wire.filter((w) => w.path === 'CallCenterWeb/SetAddress')
    check('it took three sends: preview, refused commit, fresh preview', sends.length === 3, String(sends.length))
    check(
      'the re-send dropped the token — a fresh preview, not a second commit',
      sends[1].body.confirmToken === CONFIRM_TOKEN && !sends[2].body.confirmToken,
      sends.map((s) => s.body.confirmToken ?? '—').join(' | '),
    )
    // Still one action: the agent asked once.
    check(
      'and all three carry the one requestId',
      new Set(sends.map((s) => s.body.requestId)).size === 1,
      sends.map((s) => s.body.requestId).join(' | '),
    )
    check(
      'nothing was committed while that happened',
      (await text(page, '[data-cc-chip="store"]')).includes(PRIOR_STATE.header.plant),
      await text(page, '[data-cc-chip="store"]'),
    )

    // And the fresh preview commits normally — the ceiling is one re-issue, not a loop.
    await page.locator('[data-cc-confirm-accept]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ state: 'detached', timeout: 10_000 })
    check(
      'accepting the fresh preview lands the move',
      (await text(page, '[data-cc-chip="store"]')).includes(MOVED_TO.plant),
      await text(page, '[data-cc-chip="store"]'),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 29. REBIND_REFUSED — whole, named twice, and byte-identical after ----
  {
    const { context, page, errors } = await open(browser, { openState: PRIOR_STATE, rebind: 'refused' })
    await page.goto(`${BASE}/callcenter`)
    await openTheBookOnALiveOrder(page)

    const storeBefore = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')
    const payableBefore = await text(page, '[data-cc-payable]')
    const basketBefore = (await text(page, '[data-cc-basket]')).replace(/\s+/g, ' ')

    await page.locator('[data-cc-address-option="77121"]').click()
    await page.locator('[data-cc-confirm-accept]').click()
    await page.locator('[data-cc-rebind-refused]').waitFor({ timeout: 10_000 })

    const banner = (await text(page, '[data-cc-rebind-refused]')).replace(/\s+/g, ' ')
    check('the refusal is a banner, not a crash surface', await page.locator('[data-cc-console]').isVisible())
    check("and it is the server's own sentence", banner.includes(REFUSED_MESSAGE), banner)
    check('no machine code reaches the agent', !/[A-Z]{3,}_[A-Z_]+/.test(banner), banner)
    check('it says nothing was changed', /nothing was changed/i.test(banner), banner)
    // 🚩 Named TWICE — in the banner and on the line — so "nothing was changed,
    // fix this line" is legible in one glance.
    check(
      'the banner names the offending line',
      (await page.locator(`[data-cc-refused-line="${REFUSED_LINE.lineId}"]`).isVisible()) &&
        banner.includes(REFUSED_LINE.itemNumber),
      banner,
    )
    check(
      'and that line is tinted in the basket',
      await page.locator(`[data-cc-line-refused="${REFUSED_LINE.lineId}"]`).isVisible(),
    )
    check(
      'only that line — the refusal is about one of them',
      (await page.locator('[data-cc-line-refused]').count()) === 1,
    )

    // 🚩 Atomic: nothing partial is ever persisted.
    check('the sheet is gone — there is nothing left to confirm', (await page.locator('[data-cc-confirm-sheet="storeChange"]').count()) === 0)
    check('the store did not move', (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ') === storeBefore, storeBefore)
    check('the total did not move', (await text(page, '[data-cc-payable]')) === payableBefore)
    check(
      'and the basket is byte-identical apart from the tint',
      (await text(page, '[data-cc-basket]')).replace(/\s+/g, ' ').includes(basketBefore.split(' ').slice(0, 6).join(' ')) &&
        (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length,
    )

    // It is a refusal to read once, not a state to be stuck in.
    await page.locator('[data-cc-rebind-refused-dismiss]').click()
    await page.locator('[data-cc-rebind-refused]').waitFor({ state: 'detached', timeout: 10_000 })
    check('the banner can be dismissed once read', (await page.locator('[data-cc-line-refused]').count()) === 0)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 30. the deliberate override takes the SAME path, not a second one ----
  {
    const { context, page, errors, calls, wire } = await open(browser, { openState: PRIOR_STATE })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    // The chip re-opens the section it collapsed (135's progressive collapse).
    check('the store chip is the way back in', await page.locator('[data-cc-chip-open="store"]').isVisible())
    check(
      'and the estate is not read until it is opened',
      count(calls, /StoreDetails/) === 0,
      calls.filter((c) => /StoreDetails/.test(c)).join(', '),
    )

    await page.locator('[data-cc-chip-open="store"]').click()
    await page.locator('[data-cc-store-picker]').waitFor({ timeout: 10_000 })
    check('opening it reads the estate once', count(calls, /StoreDetails/) === 1)
    check(
      'unfiltered — the door refuses what it will not do, not the console',
      (await page.locator('[data-cc-store-option]').count()) === STORE_DETAILS.length,
      `${await page.locator('[data-cc-store-option]').count()} of ${STORE_DETAILS.length}`,
    )
    check(
      'the store already on the order is marked and not offered',
      (await page.locator('[data-cc-store-current]').isVisible()) &&
        (await page.locator(`[data-cc-store-option="${PRIOR_STATE.header.plant}"]`).isDisabled()),
    )

    await page.locator('[data-cc-store-option="1204"]').click()
    // 🚩 The same modal, from the other door. A second confirmation mechanism
    // would be the defect this box exists to catch.
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ timeout: 10_000 })
    check('an override is previewed by the same sheet', (await page.locator('[data-cc-rebind-line]').count()) > 0)
    check('the store picker gave way to it', (await page.locator('[data-cc-store-picker]').count()) === 0)

    await page.locator('[data-cc-confirm-accept]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ state: 'detached', timeout: 10_000 })

    const sends = wire.filter((w) => w.path === 'CallCenterWeb/SetStore')
    check('the override rides SetStore, twice, on one requestId', sends.length === 2 && sends[0].body.requestId === sends[1].body.requestId)
    check('naming the store the agent chose', sends[0].body.storeCode === '1204' && !('addressNumber' in sends[0].body))
    check('and the commit carries the token', sends[1].body.confirmToken === CONFIRM_TOKEN)
    check('SetAddress was never involved', count(calls, /^CallCenterWeb\/SetAddress$/) === 0)

    const storeAfter = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')
    check('the chip moved to the chosen store', storeAfter.includes('1204'), storeAfter)
    // 🚩 The provenance is the server's, and it changed: this branch was CHOSEN.
    // A chip that still said *derived* would be explaining the wrong decision.
    check('and no longer reads as derived — this one was chosen', !/derived/i.test(storeAfter), storeAfter)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ============ ticket 168 — the search, the estimate and availability ============

  // ---- 31. searching in Arabic finds and adds an item ----
  {
    const { context, page, errors, calls, wire, searches } = await open(browser, {})
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    check('the search box is there from the first frame', await page.locator('[data-cc-search-input]').isEnabled())
    // 165's ruling still holds: the caret opens the call in the phone field, and
    // the search box must not have taken it.
    check(
      'and it has not stolen the caret from the phone field',
      (await page.evaluate(() => document.activeElement?.id)) === 'cc-phone',
      await page.evaluate(() => document.activeElement?.id ?? '—'),
    )

    // 🚩 STANDING: the mis-quote rule is on screen before a single price is —
    // a caption that arrives with the rows is read after the agent is already
    // looking at prices (US28).
    check(
      'the estimate note stands before anything is searched',
      (await page.locator('[data-cc-search-note]').isVisible()) &&
        /estimate/i.test(await text(page, '[data-cc-search-note]')),
      (await text(page, '[data-cc-search-note]')).replace(/\s+/g, ' '),
    )

    // 🚩 Both checks above are about the OPENING state, so they are taken before
    // the gate: the search box stands and the caret is elsewhere from the first
    // frame. Adding is a later act, and 175 says it waits for a caller and a
    // store — so the box now takes that step, as an agent would.
    await openTheGate(page)

    // 🚩 Under three characters the endpoint answers 400, so the console does not
    // spend the round trip: it says what is needed instead of failing.
    await page.locator('[data-cc-search-input]').fill('بن')
    await page.locator('[data-cc-search-hint]').waitFor({ timeout: 5_000 })
    check('a term too short to ask with asks nothing', count(calls, /^CallCenterWeb\/ItemSearch$/) === 0)
    check('and says what is needed', (await text(page, '[data-cc-search-hint]')).length > 20, await text(page, '[data-cc-search-hint]'))

    // ---- the Arabic run: part of a name, in the caller's own words ----
    await page.locator('[data-cc-search-input]').fill('بنادول')
    await page.locator('[data-cc-search-row]').first().waitFor({ timeout: 10_000 })

    check(
      'the Arabic term reached the catalogue verbatim',
      searches.length === 1 && decodeURIComponent(searches[0]).includes('query=بنادول'),
      decodeURIComponent(searches[0] ?? '—'),
    )
    check(
      'it is asked ONCE for one settled term, not once per keystroke',
      count(calls, /^CallCenterWeb\/ItemSearch$/) === 1,
      `${count(calls, /^CallCenterWeb\/ItemSearch$/)} search call(s)`,
    )
    check(
      'the search rides the ORDER, not a client-chosen plant',
      searches.length > 0 &&
        searches.every((u) => u.includes(`transactionId=${STATE.transactionId}`) && !/plant=/.test(u)),
      searches[0] ?? '',
    )

    const rows = page.locator('[data-cc-search-row]')
    check('the cap decides how many come back, not the console', (await rows.count()) === SEARCH_TAKE, `${await rows.count()} row(s)`)
    check(
      'every row carries its Arabic name',
      (await page.locator('[data-cc-search-part="description2"]').allInnerTexts()).map((s) => s.trim()).join('|') ===
        CATALOGUE.slice(0, SEARCH_TAKE).map((r) => r.descriptionAr).join('|'),
      (await page.locator('[data-cc-search-part="description2"]').allInnerTexts()).join(' | '),
    )
    // 138's ruling: the isolate is `dir`-pinned, never `dir="auto"` — a bare
    // <bdi> reads the Arabic and flips the whole block.
    check(
      'the Arabic run is isolated with a dir-PINNED wrapper',
      await page
        .locator('[data-cc-search-part="description2"] bdi')
        .first()
        .evaluate((el) => el.getAttribute('dir') === 'ltr'),
    )
    // And the flip it prevents, measured: the name stays start-aligned, on the
    // same line as the item number rather than pushed onto one of its own.
    const firstRow = page.locator('[data-cc-search-row="200145"]')
    const titleBox = await firstRow.locator('[data-cc-search-title]').boundingBox()
    const metaBox = await firstRow.locator('[data-cc-search-meta]').boundingBox()
    check(
      'the Arabic did not flip the block — the name stays at the start edge',
      Math.abs(metaBox.x - titleBox.x) < 2,
      `${titleBox.x} vs ${metaBox.x}`,
    )

    // ---- 🚩 the estimate is on the second line, and is not money ----
    const estimate = firstRow.locator('[data-cc-search-part="estimate"]')
    const estimateText = (await estimate.innerText()).trim()
    check('the estimate carries the approximation mark', estimateText.startsWith('≈'), estimateText)
    check(
      'and no currency word — SAR is reserved for engine money',
      !/\bSAR\b|\bSR\b|ريال/i.test((await firstRow.innerText())),
      (await firstRow.innerText()).replace(/\s+/g, ' '),
    )
    check(
      'it rides the META line, beside the item number',
      await estimate.evaluate((el) => !!el.closest('[data-cc-search-meta]')),
    )
    const estimateBox = await estimate.boundingBox()
    check('which is the row’s SECOND line', estimateBox.y > titleBox.y, `${titleBox.y} → ${estimateBox.y}`)
    // 🚩 The whole ruling, measured: the end edge carries availability and *Add*
    // only, and the estimate is nowhere near it.
    const pillBox = await firstRow.locator('[data-cc-atp]').boundingBox()
    check(
      'and never the row’s end edge, where a price would read as money',
      estimateBox.x + estimateBox.width < pillBox.x,
      `estimate ends ${Math.round(estimateBox.x + estimateBox.width)}, pill starts ${Math.round(pillBox.x)}`,
    )
    check(
      'the end edge holds no money-formatted figure at all',
      !/\d+\.\d{2}/.test(await firstRow.locator('[data-cc-atp]').innerText()),
      await firstRow.locator('[data-cc-atp]').innerText(),
    )
    // Stated once, at the top of the panel, rather than inferred per row.
    check(
      'the panel carries the standing estimate note',
      /estimate/i.test(await text(page, '[data-cc-search-note]')),
      (await text(page, '[data-cc-search-note]')).replace(/\s+/g, ' '),
    )

    // ---- 🚩 three availability states, and unknown is not zero ----
    const kinds = await page.locator('[data-cc-atp]').evaluateAll((els) =>
      els.map((el) => ({
        kind: el.getAttribute('data-cc-atp'),
        text: el.innerText.trim(),
        ground: getComputedStyle(el).backgroundColor,
        ink: getComputedStyle(el).color,
      })),
    )
    check('the three rows classify three different ways', kinds.map((k) => k.kind).join(',') === 'count,none,unknown', kinds.map((k) => k.kind).join(','))
    check('differing in WORDS', new Set(kinds.map((k) => k.text)).size === 3, kinds.map((k) => k.text).join(' | '))
    check('in GROUND', new Set(kinds.map((k) => k.ground)).size === 3, kinds.map((k) => k.ground).join(' | '))
    check('and in INK — never colour alone', new Set(kinds.map((k) => k.ink)).size === 3, kinds.map((k) => k.ink).join(' | '))
    const unknown = kinds.find((k) => k.kind === 'unknown')
    const none = kinds.find((k) => k.kind === 'none')
    check(
      '🚩 unknown does not read as none — a degraded read is not a zero',
      unknown.text !== none.text && !/\b0\b/.test(unknown.text),
      `${unknown.text} vs ${none.text}`,
    )
    check('and the count says the number', /\b12\b/.test(kinds[0].text), kinds[0].text)

    // ---- no paging: a cap, a flag, and an affordance that is not *next* ----
    check('a capped result says so', await page.locator('[data-cc-search-truncated]').isVisible())
    check(
      'and offers narrowing, never a pager',
      /narrow/i.test(await text(page, '[data-cc-search-truncated]')) &&
        !/next|page \d|›|»/i.test(await text(page, '[data-cc-search]')),
      await text(page, '[data-cc-search-truncated]'),
    )

    // ---- 🚩 one action adds it ----
    check('the basket is empty before the add', await page.locator('[data-cc-basket-empty]').isVisible())
    await page.locator('[data-cc-search-add="200145"]').click()
    await page.locator('[data-cc-line]').first().waitFor({ timeout: 10_000 })

    check('one click added it — no second step, no confirmation', (await page.locator('[data-cc-confirm-sheet]').count()) === 0)
    const adds = wire.filter((w) => w.path === 'CallCenterWeb/AddItem')
    check('exactly one AddItem', adds.length === 1, String(adds.length))
    check(
      'naming the item and a quantity',
      adds[0].body.itemNumber === '200145' && adds[0].body.qty === 1 && !!adds[0].body.requestId,
      JSON.stringify(adds[0].body),
    )
    // 🚩 Law 1 — money is one-way, engine → client. The estimate the agent was
    // looking at never goes back.
    check(
      'and never a price — the estimate never reaches the server',
      !JSON.stringify(adds[0].body).includes('9.13') &&
        !/price|estimate|amount/i.test(Object.keys(adds[0].body).join(',')),
      JSON.stringify(adds[0].body),
    )
    const line = page.locator('[data-cc-line]').first()
    check(
      'the item is in the basket, priced by the ENGINE',
      (await line.innerText()).includes(CATALOGUE[0].descriptionEn) && /\d+\.\d{2}/.test(await line.innerText()),
      (await line.innerText()).replace(/\s+/g, ' '),
    )
    check(
      'and what the basket shows is not the estimate',
      !(await line.innerText()).includes('9.13'),
      (await line.innerText()).replace(/\s+/g, ' '),
    )
    // 🚩 168 REVERSED this: the results list outliving the add that answered it was
    // the defect — the agent adds an item and the panel that answered them closes,
    // so the next search starts clean rather than on a stale list.
    check('the search results close on the add that answered them', (await rows.count()) === 0)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ============ ticket 169 — below availability, accepted deliberately ============

  // ---- 32. a known shortfall is accepted by the agent; unknown never asks ----
  {
    const { context, page, errors, wire } = await open(browser, {})
    await page.goto(`${BASE}/callcenter`)
    // 175's gate first: nothing enters an order with no caller and no store.
    await openTheGate(page)
    await page.locator('[data-cc-search-input]').fill('بنادول')
    await page.locator('[data-cc-search-row]').first().waitFor({ timeout: 10_000 })

    // Row 200146 has NONE at store, so one of it is already beyond availability.
    const NONE_ROW = CATALOGUE[1]
    await page.locator(`[data-cc-search-add="${NONE_ROW.materialNumber}"]`).click()
    await page.locator('[data-cc-confirm-sheet="belowAtp"]').waitFor({ timeout: 10_000 })

    // 🚩 The SAME mechanism as the plant rebind — one confirmation surface, two
    // bodies. The shared markers are the proof: same sheet, same two buttons.
    check(
      'it arrives in the console’s ONE confirmation surface, not a second one',
      (await page.locator('[data-cc-confirm-accept]').count()) === 1 &&
        (await page.locator('[data-cc-confirm-decline]').count()) === 1,
    )
    const sheet = page.locator('[data-cc-confirm-sheet="belowAtp"]')
    const sheetText = (await page.locator('dialog').innerText()).replace(/\s+/g, ' ')
    // The name the agent just read out, not an item number they would have to
    // look up mid-call.
    check('the sheet names the item the agent pressed Add on', sheetText.includes(NONE_ROW.descriptionEn), sheetText)
    check(
      'and both numbers — what was asked for, and what is there',
      (await text(page, '[data-cc-below-atp="requested"]')) === '1' &&
        (await text(page, '[data-cc-below-atp="available"]')) === String(NONE_ROW.atp),
      `${await text(page, '[data-cc-below-atp="requested"]')} vs ${await text(page, '[data-cc-below-atp="available"]')}`,
    )
    check(
      'and at which store',
      // The plant the order is really at once the gate is open — the one the
      // address derived, not the entry store it opened on.
      (await text(page, '[data-cc-below-atp-where]')).includes(GATED_PLANT),
      await text(page, '[data-cc-below-atp-where]'),
    )
    // 🚩 It is never a block: the order can always be taken, so the commit is
    // offered rather than disabled behind a refusal.
    check('the acceptance is offered, never blocked', await page.locator('[data-cc-confirm-accept]').isEnabled())
    check('no machine code reaches the agent', !/[A-Z]{3,}_[A-Z_]+/.test(sheetText), sheetText)
    check('and no money is drawn in it — these are counts, not prices', !/\d+\.\d{2}/.test(sheetText), sheetText)
    check('nothing was added while the agent reads it', await page.locator('[data-cc-basket-empty]').isVisible())
    check('and nothing carries the flag yet', (await page.locator('[data-cc-has-below-atp]').count()) === 0)

    // ---- declining leaves the basket exactly as it was ----
    await page.locator('[data-cc-confirm-decline]').click()
    await sheet.waitFor({ state: 'detached', timeout: 10_000 })
    check('declining adds nothing at all', await page.locator('[data-cc-basket-empty]').isVisible())
    const declined = wire.filter((w) => w.path === 'CallCenterWeb/AddItem')
    check('and sends no commit behind the agent’s back', declined.length === 1 && !declined[0].body.confirmToken)

    // ---- accepting: the same verb, the same id, plus the token ----
    // 🚩 The LIVE pill is read here, BEFORE the add: ticket 168 made the results
    // list close on the add that answered it, so the row is gone by the time the
    // line exists. The comparison below is still the real one — the same item, its
    // live availability against the frozen one — it just has to be taken in order.
    const livePill = await text(page, `[data-cc-search-row="${NONE_ROW.materialNumber}"] [data-cc-atp]`)
    await page.locator(`[data-cc-search-add="${NONE_ROW.materialNumber}"]`).click()
    await sheet.waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-confirm-accept]').click()
    await page.locator('[data-cc-line]').first().waitFor({ timeout: 10_000 })

    const adds = wire.filter((w) => w.path === 'CallCenterWeb/AddItem')
    check('the acceptance is a second send of the same verb', adds.length === 3, String(adds.length))
    // 🚩 One user action is one requestId — INCLUDING the send that carries the
    // token (§4). A fresh id here is the double-add the ledger exists to stop.
    check(
      'on the SAME requestId as the ask',
      adds[1].body.requestId === adds[2].body.requestId,
      `${adds[1].body.requestId} | ${adds[2].body.requestId}`,
    )
    check(
      'carrying the token the figures were pinned with',
      !adds[1].body.confirmToken && adds[2].body.confirmToken === BELOW_ATP_TOKEN,
      JSON.stringify(adds[2].body),
    )
    // The declined attempt was a different action, and asking again is too.
    check(
      'a second ask is a genuinely new action with a new id',
      adds[0].body.requestId !== adds[1].body.requestId,
      `${adds[0].body.requestId} | ${adds[1].body.requestId}`,
    )
    // 🚩 Law 1 — the acceptance carries a quantity and a token, never a price.
    check(
      'and still never a price',
      !/price|estimate|amount/i.test(Object.keys(adds[2].body).join(',')),
      JSON.stringify(adds[2].body),
    )

    // ---- what the acceptance produced, on the line and on the order ----
    const line = page.locator('[data-cc-line]').first()
    check(
      '🚩 the committed line carries the below-availability flag',
      (await page.locator('[data-cc-line-below-atp]').count()) === 1,
      (await line.innerText()).replace(/\s+/g, ' '),
    )
    check('and the order header carries it too', await page.locator('[data-cc-has-below-atp]').isVisible())
    const linePill = await text(page, '[data-cc-line-atp] [data-cc-atp]')
    check('the line’s pill reads AT ADD — frozen, not live', /at add/i.test(linePill), linePill)
    check(
      'and never reads like the live pill for the same item',
      linePill !== livePill,
      `${linePill} vs ${livePill}`,
    )

    // ---- 🚩 unknown availability never interrupts them at all ----
    // The results list closed on the add that answered it (168), so the agent
    // searches again for the next item — which is what they really do.
    const UNKNOWN_ROW = CATALOGUE[2]
    await page.locator('[data-cc-search-input]').fill('بنادول')
    await page.locator(`[data-cc-search-add="${UNKNOWN_ROW.materialNumber}"]`).waitFor({ timeout: 10_000 })
    await page.locator(`[data-cc-search-add="${UNKNOWN_ROW.materialNumber}"]`).click()
    await page.locator('[data-cc-line]').nth(1).waitFor({ timeout: 10_000 })
    check(
      '🚩 a degraded stock read raises no confirmation at all',
      (await page.locator('[data-cc-confirm-sheet]').count()) === 0,
    )
    const unknownAdds = wire.filter(
      (w) => w.path === 'CallCenterWeb/AddItem' && w.body.itemNumber === UNKNOWN_ROW.materialNumber,
    )
    check('it took one send and no token', unknownAdds.length === 1 && !unknownAdds[0].body.confirmToken)
    const secondPill = (
      await page.locator('[data-cc-line]').nth(1).locator('[data-cc-line-atp] [data-cc-atp]').innerText()
    ).trim()
    check(
      'and its line reads unknown at add — never a zero',
      /unknown/i.test(secondPill) && !/\b0\b/.test(secondPill),
      secondPill,
    )
    check(
      'that line carries no acceptance flag — there was nothing to accept',
      (await page.locator('[data-cc-line-below-atp]').count()) === 1,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ============ ticket 170 — the basket corrects itself ============

  // ---- 33. the receipt is the ENGINE's, not a sum of what is on screen ----
  {
    // 🚩 Totals that deliberately do NOT match the lines. A console that summed
    // would quote the caller its own arithmetic; this one quotes the till.
    const DIVERGENT = { ...PRIOR_STATE, totals: { ...PRIOR_STATE.totals, net: 1, vat: 2, payable: 999.99 } }
    const { context, page, errors } = await open(browser, { openState: DIVERGENT })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    const payable = await text(page, '[data-cc-payable]')
    check('🚩 the receipt quotes the engine, not the lines on screen', payable.includes('999.99'), payable)
    const lineTotals = await page.locator('[data-cc-line-total]').allInnerTexts()
    check(
      'and the lines it disagrees with are still drawn as the engine sent them',
      lineTotals.some((row) => row.includes(String(PRIOR_STATE.lines[0].lineTotal.gross))),
      lineTotals.join(' | '),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 34. a line says what it costs and WHY ----
  {
    const { context, page, errors } = await open(browser, { openState: PRIOR_STATE })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    const L1 = PRIOR_STATE.lines[0]
    const why = (await page.locator(`[data-cc-line-why="${L1.lineId}"]`).innerText()).replace(/\s+/g, ' ')
    // 🚩 The store price and VAT as SEPARATE things — VAT is its own condition,
    // and it is the fact that explains why the line reads above the estimate.
    check(
      'the line names the store price condition',
      why.includes(L1.conditions[0].description) && why.includes(L1.conditions[0].value.toFixed(2)),
      why,
    )
    check(
      '🚩 and VAT as a condition of its own, not folded into the price',
      (await page.locator(`[data-cc-line-why="${L1.lineId}"] [data-cc-condition="MWST"]`).count()) === 1 &&
        why.includes(L1.conditions[2].value.toFixed(2)),
      why,
    )
    // 🚩 Scoped to the LINE. The capture ships every `offerId` blank (859), so a
    // global `[data-cc-line-promo=""]` matches every promotion in the basket — the
    // same identity gap that made the guidance strip draw one card for two offers.
    check(
      'and the promotion that fired on it, in the offer’s own words',
      (await page
        .locator(`[data-cc-line-why="${L1.lineId}"] [data-cc-line-promo]`)
        .count()) === L1.promotions.length && why.includes(L1.promotions[0].description),
      why,
    )
    check(
      'the line total is the projection’s own figure',
      (await text(page, `[data-cc-line-total="${L1.lineId}"]`)).includes(L1.lineTotal.gross.toFixed(2)),
      await text(page, `[data-cc-line-total="${L1.lineId}"]`),
    )
    // The receipt is at the end edge and never scrolls away (US53).
    const receipt = await page.locator('[data-cc-receipt]').boundingBox()
    const console_ = await page.locator('[data-cc-console]').boundingBox()
    check(
      'the receipt is pinned at the end edge, whole',
      receipt.x + receipt.width >= console_.x + console_.width - 1 && receipt.height >= 800,
      JSON.stringify(receipt),
    )
    check('with Place order at its foot', await page.locator('[data-cc-receipt] [data-cc-submit]').isVisible())
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 35. quantity, unit and void — each re-renders from the returned state ----
  {
    const { context, page, errors, wire } = await open(browser, { openState: PRIOR_WITH_UNITS })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    const [L1, L2] = PRIOR_WITH_UNITS.lines
    const payableBefore = await text(page, '[data-cc-payable]')

    // ---- the quantity ----
    await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).fill('3')
    await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).press('Enter')
    await page.waitForFunction(
      (before) => document.querySelector('[data-cc-payable]').innerText.trim() !== before,
      payableBefore,
      { timeout: 10_000 },
    )
    const qtyCalls = wire.filter((w) => w.path === 'CallCenterWeb/ChangeQty')
    check('one ChangeQty, naming the line and the NEW quantity', qtyCalls.length === 1 && qtyCalls[0].body.lineId === L1.lineId && qtyCalls[0].body.newQty === 3, JSON.stringify(qtyCalls[0]?.body))
    // 🚩 Law 1 — no verb takes an amount, and none of them sends a delta either:
    // a delta applied to a line that moved under the agent is a quantity nobody
    // chose.
    check(
      'and never a price and never a delta',
      !/price|amount|delta|by\b/i.test(Object.keys(qtyCalls[0].body).join(',')),
      JSON.stringify(qtyCalls[0].body),
    )
    check(
      'the line re-renders at the engine’s quantity',
      (await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).inputValue()) === '3',
    )
    const payableAfterQty = await text(page, '[data-cc-payable]')
    check('and the receipt moves with it', payableAfterQty !== payableBefore, `${payableBefore} → ${payableAfterQty}`)

    // ---- 🚩 the delivery fee, quoted live while the basket is under it ----
    check('the fee is quoted while the basket is under the threshold', await page.locator('[data-cc-delivery-fee]').isVisible())
    check(
      'and the threshold itself is stated, so the crossing is watchable',
      (await text(page, '[data-cc-delivery-threshold]')).includes(
        PRIOR_STATE.totals.deliveryFee.thresholdGross.toFixed(2),
      ),
      await text(page, '[data-cc-delivery-threshold]'),
    )

    // ---- the unit of measure ----
    check(
      'a line with one unit gets a word, not a control',
      (await page.locator(`select[data-cc-line-uom="${L1.lineId}"]`).count()) === 0 &&
        (await text(page, `[data-cc-line-uom="${L1.lineId}"]`)) === L1.uom,
    )
    check('a line with two gets the choice', (await page.locator(`select[data-cc-line-uom="${L2.lineId}"]`).count()) === 1)
    await page.locator(`select[data-cc-line-uom="${L2.lineId}"]`).selectOption('BOX')
    await page.waitForFunction(
      (before) => document.querySelector('[data-cc-payable]').innerText.trim() !== before,
      payableAfterQty,
      { timeout: 10_000 },
    )
    const uomCalls = wire.filter((w) => w.path === 'CallCenterWeb/ChangeUom')
    check('one ChangeUom, naming the line and the unit', uomCalls.length === 1 && uomCalls[0].body.lineId === L2.lineId && uomCalls[0].body.uom === 'BOX', JSON.stringify(uomCalls[0]?.body))
    check('the line re-renders in the new unit', (await page.locator(`select[data-cc-line-uom="${L2.lineId}"]`).inputValue()) === 'BOX')
    check('and the receipt re-prices — a box is not a single', (await text(page, '[data-cc-payable]')) !== payableAfterQty)

    // 🚩 And the crossing itself: the unit change took the basket over the
    // threshold, so the fee falls away WHILE the agent is on the call rather
    // than being discovered at submit (US36).
    await page.locator('[data-cc-delivery-waived]').waitFor({ timeout: 10_000 })
    check(
      '🚩 crossing the threshold waives the fee, live and mid-basket',
      (await page.locator('[data-cc-delivery-fee]').count()) === 0 &&
        (await page.locator('[data-cc-delivery-threshold]').count()) === 0,
      await text(page, '[data-cc-receipt]'),
    )
    check(
      '🚩 and the waiver is an OUTCOME, never a control',
      (await page.locator('[data-cc-delivery-waived] button, [data-cc-delivery-waived] input').count()) === 0 &&
        (await page.locator('[data-cc-receipt] button').count()) === 1,
    )

    // ---- the void ----
    const linesBefore = await page.locator('[data-cc-line]').count()
    await page.locator(`[data-cc-line-void="${L1.lineId}"]`).click()
    await page.waitForFunction(
      (count) => document.querySelectorAll('[data-cc-line]').length < count,
      linesBefore,
      { timeout: 10_000 },
    )
    const voids = wire.filter((w) => w.path === 'CallCenterWeb/VoidLine')
    check('one VoidLine, on its own requestId', voids.length === 1 && voids[0].body.lineId === L1.lineId && !!voids[0].body.requestId, JSON.stringify(voids[0]?.body))
    check('voiding one line needs no confirmation', (await page.locator('dialog[open]').count()) === 0)
    check('the line is gone from the basket', (await page.locator(`[data-cc-line="${L1.lineId}"]`).count()) === 0)
    check('and the other line is still there', (await page.locator(`[data-cc-line="${L2.lineId}"]`).count()) === 1)
    // Every correction is one action with one id — three verbs, three ids.
    const ids = [...qtyCalls, ...uomCalls, ...voids].map((w) => w.body.requestId)
    check('each correction carried an id of its own', new Set(ids).size === ids.length, ids.join(' | '))
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 36. raising a quantity beyond availability takes 169's path, unchanged ----
  {
    // 🚩 Every captured line reads `atpAtScan.known: false` — no stock service is
    // reachable from the capture environment (857), and an unknown freeze correctly
    // asks NOTHING (287). So a KNOWN freeze is stated here, because that is the only
    // state in which this case's question — what raising a quantity past
    // availability does — exists at all. The unknown path is case 32's.
    const KNOWN_FREEZE = {
      ...PRIOR_STATE,
      lines: PRIOR_STATE.lines.map((line, index) =>
        index === 0
          ? { ...line, atpAtScan: { quantity: 4, frozenAt: line.atpAtScan.frozenAt, known: true } }
          : line,
      ),
    }
    const { context, page, errors, wire } = await open(browser, { openState: KNOWN_FREEZE })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    const L1 = KNOWN_FREEZE.lines[0]
    await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).fill('9')
    await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).press('Enter')
    await page.locator('[data-cc-confirm-sheet="belowAtp"]').waitFor({ timeout: 10_000 })

    // 🚩 The SAME sheet as the add's — one mechanism, two verbs.
    check(
      'it arrives in the console’s ONE confirmation surface',
      (await page.locator('[data-cc-confirm-accept]').count()) === 1 &&
        (await page.locator('[data-cc-confirm-sheet]').count()) === 1,
    )
    check(
      'naming what was asked for and what is there',
      (await text(page, '[data-cc-below-atp="requested"]')) === '9' &&
        (await text(page, '[data-cc-below-atp="available"]')) === String(L1.atpAtScan.quantity),
    )
    // 🚩 One mechanism, the verb's own WORDS: an agent raising a line already in
    // the basket must not be asked whether to *add* it.
    const raiseSheet = (await page.locator('dialog').innerText()).replace(/\s+/g, ' ')
    check(
      '🚩 and it asks about the quantity, never about adding an item',
      /raise/i.test(raiseSheet) && !/\badd\b/i.test(raiseSheet),
      raiseSheet,
    )
    check(
      'nothing was applied — the ask carried the unchanged state',
      (await text(page, `[data-cc-line-total="${L1.lineId}"]`)).includes(L1.lineTotal.gross.toFixed(2)),
      await text(page, `[data-cc-line-total="${L1.lineId}"]`),
    )

    await page.locator('[data-cc-confirm-accept]').click()
    await page.waitForFunction(
      (id) => document.querySelector(`[data-cc-line-qty="${id}"]`).value === '9',
      L1.lineId,
      { timeout: 10_000 },
    )
    const qtyCalls = wire.filter((w) => w.path === 'CallCenterWeb/ChangeQty')
    check('the acceptance is a second send of the same verb', qtyCalls.length === 2, String(qtyCalls.length))
    check(
      '🚩 on the SAME requestId, carrying the token',
      qtyCalls[0].body.requestId === qtyCalls[1].body.requestId &&
        !qtyCalls[0].body.confirmToken &&
        qtyCalls[1].body.confirmToken === BELOW_ATP_TOKEN,
      JSON.stringify(qtyCalls[1].body),
    )
    check('the line now carries the below-availability flag', (await page.locator(`[data-cc-line-below-atp="${L1.lineId}"]`).count()) === 1)
    check('and so does the order header', await page.locator('[data-cc-has-below-atp]').isVisible())

    // ---- declining a raise leaves the line exactly as the engine holds it ----
    await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).fill('40')
    await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).press('Enter')
    await page.locator('[data-cc-confirm-sheet="belowAtp"]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-confirm-decline]').click()
    await page.locator('[data-cc-confirm-sheet="belowAtp"]').waitFor({ state: 'detached', timeout: 10_000 })
    check(
      '🚩 declining puts the field back to what the order holds',
      (await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).inputValue()) === '9',
      await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).inputValue(),
    )
    check(
      'and sends no commit behind the agent’s back',
      wire.filter((w) => w.path === 'CallCenterWeb/ChangeQty').length === 3,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 37. a refused correction is explained and changes nothing ----
  for (const [kind, verb] of [
    ['notFound', 'void'],
    ['uomRefused', 'uom'],
    ['qtyInvalid', 'qty'],
  ]) {
    const { context, page, errors } = await open(browser, { openState: PRIOR_WITH_UNITS, lineEdit: kind })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    const [L1, L2] = PRIOR_WITH_UNITS.lines
    const target = verb === 'uom' ? L2 : L1
    const payableBefore = await text(page, '[data-cc-payable]')
    if (verb === 'void') await page.locator(`[data-cc-line-void="${L1.lineId}"]`).click()
    else if (verb === 'uom') await page.locator(`select[data-cc-line-uom="${L2.lineId}"]`).selectOption('BOX')
    else {
      await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).fill('4')
      await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).press('Enter')
    }

    await page.locator(`[data-cc-line-error="${target.lineId}"]`).waitFor({ timeout: 10_000 })
    const shown = (await text(page, `[data-cc-line-error="${target.lineId}"]`)).replace(/\s+/g, ' ')
    check(`the refusal is explained (${kind})`, shown.length > 40, shown)
    check(`no machine code reaches the agent (${kind})`, !/[A-Z]{3,}_[A-Z_]+/.test(shown), shown)
    check(
      `it is drawn ON the line it was about (${kind})`,
      (await page.locator(`[data-cc-line="${target.lineId}"] [data-cc-line-error]`).count()) === 1,
    )
    check(`the basket is untouched (${kind})`, (await page.locator('[data-cc-line]').count()) === PRIOR_STATE.lines.length)
    check(
      `and the line still reads what the order holds (${kind})`,
      verb === 'qty'
        ? (await page.locator(`[data-cc-line-qty="${L1.lineId}"]`).inputValue()) === String(L1.qty)
        : verb === 'uom'
          ? (await page.locator(`select[data-cc-line-uom="${L2.lineId}"]`).inputValue()) === L2.uom
          : (await page.locator(`[data-cc-line="${L1.lineId}"]`).count()) === 1,
    )
    check(`and the total is exactly what it was (${kind})`, (await text(page, '[data-cc-payable]')) === payableBefore)
    check(`the console is still usable (${kind})`, await page.locator('[data-cc-search-input]').isEnabled())
    check(`no console errors (${kind})`, errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 38. the header settles into chips, and a dead submit names its reason ----
  //
  // theHeaderSettlesIntoChips (173): the slot, the source and its reference each
  // collapse into a re-openable chip, the *needs attention* state clears as each
  // lands, and a lapsed slot warns without blocking submit.
  {
    // An order whose header is empty and whose server says so — the two chip
    // sections this ticket builds, plus an UNKNOWN code, which is an ordinary
    // wire state (§9) and must still reach the agent as words.
    const NEEDY = {
      ...STATE,
      capabilities: {
        ...STATE.capabilities,
        submitBlockers: ['MISSING_SLOT', 'MISSING_SOURCE', 'MISSING_SOURCE_REFERENCE', 'MISSING_PAYMENT_TYPE'],
      },
    }
    const { context, page, errors, wire, calls } = await open(browser, { openState: NEEDY })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    const chipState = (id) => page.locator(`[data-cc-chip="${id}"]`).getAttribute('data-cc-chip-state')
    check(
      'a chip whose section is blocking looks like it needs something',
      (await chipState('slot')) === 'needsAttention' &&
        (await chipState('source')) === 'needsAttention' &&
        (await chipState('reference')) === 'needsAttention',
    )
    check('and submit is dead while they are', await page.locator('[data-cc-submit]').isDisabled())
    const blockers = (await text(page, '[data-cc-blockers]')).replace(/\s+/g, ' ')
    check('the dead submit NAMES what it is waiting for', blockers.length > 20, blockers)
    check(
      '🚩 in words — an unknown blocker code never reaches the agent',
      !/[A-Z]{3,}_[A-Z_]+/.test(blockers),
      blockers,
    )

    // ---- the slot: chosen from the store's own windows, at the ORDER's store ----
    await page.locator('[data-cc-chip-open="slot"]').click()
    await page.locator('[data-cc-slot-picker]').waitFor({ timeout: 10_000 })
    check(
      'the windows are read at the order’s store, and say so',
      (await text(page, '[data-cc-slot-store]')).includes(NEEDY.header.plant),
    )
    // 🚩 Which windows are offerable is the SERVER's answer: a full one is drawn
    // (so the agent can say so to the caller) and cannot be picked.
    await page.locator('[data-cc-slot-day]').selectOption('1')
    check(
      'a window the server marks full is drawn, not hidden, and cannot be picked',
      (await page.locator(`[data-cc-slot-option="${SLOT_FULL.slotId}"]`).count()) === 1 &&
        (await page.locator(`[data-cc-slot-option="${SLOT_FULL.slotId}"]`).isDisabled()),
    )
    await page.locator('[data-cc-slot-day]').selectOption('0')
    await page.locator(`[data-cc-slot-option="${SLOT_CHOSEN.slotId}"]`).click()
    await page.locator('[data-cc-slot-picker]').waitFor({ state: 'detached', timeout: 10_000 })

    const slotCalls = wire.filter((w) => w.path === 'CallCenterWeb/SetSlot')
    check('one SetSlot, carrying the window and one requestId', slotCalls.length === 1 && !!slotCalls[0].body.requestId, JSON.stringify(slotCalls[0]?.body))
    const slotChip = await text(page, '[data-cc-chip="slot"]')
    check(
      'the section collapses into a settled chip carrying the window',
      (await chipState('slot')) === 'settled' && slotChip.includes('10:00'),
      slotChip.replace(/\s+/g, ' '),
    )
    check(
      'and the *needs attention* state clears with it',
      !(await text(page, '[data-cc-blockers]')).toLowerCase().includes('slot'),
      await text(page, '[data-cc-blockers]'),
    )

    // ---- the source and its reference: two chips, one form, one verb ----
    await page.locator('[data-cc-chip-open="source"]').click()
    await page.locator('[data-cc-source-form]').waitFor({ timeout: 10_000 })
    // 🚩 137's deliberate break with "delegates verbatim": the list is the
    // agent's own, resolved off the session row — so the request carries NO user
    // id, and there is nothing the console could send that would widen it.
    const sourceReads = calls.filter((c) => c.startsWith('CallCenterWeb/MyDocumentSources'))
    check(
      'the sources are the agent’s own — the read carries no user id at all',
      sourceReads.length === 1 && sourceReads[0] === 'CallCenterWeb/MyDocumentSources',
      sourceReads.join(', '),
    )
    // The mandatory-reference rule is the SERVER's: the console sends what was
    // keyed and lets the door decide.
    await page.locator('[data-cc-source-select]').selectOption(MY_SOURCES[1].documentSource)
    await page.locator('[data-cc-source-apply]').click()
    await page.locator('[data-cc-source-error]').waitFor({ timeout: 10_000 })
    const refused = (await text(page, '[data-cc-source-error]')).replace(/\s+/g, ' ')
    check('a source with no reference is refused IN WORDS', refused.length > 30 && !/[A-Z]{3,}_[A-Z_]+/.test(refused), refused)
    // 🚩 The mandatory-reference rule is the SERVER's: the console had to have
    // SENT the empty reference to have been refused it, rather than deciding
    // for itself which sources need one.
    const firstSend = wire.filter((w) => w.path === 'CallCenterWeb/SetDocumentSource')[0]
    check(
      '🚩 which means the console asked the door rather than predicting it',
      firstSend?.body.documentSource === MY_SOURCES[1].documentSource && firstSend?.body.sourceReference === '',
      JSON.stringify(firstSend?.body),
    )
    check('and the order is untouched — the chips still say so', (await chipState('source')) === 'needsAttention')

    await page.locator('[data-cc-source-reference]').fill('CRM-889231')
    await page.locator('[data-cc-source-apply]').click()
    await page.locator('[data-cc-source-form]').waitFor({ state: 'detached', timeout: 10_000 })
    const sourceCalls = wire.filter((w) => w.path === 'CallCenterWeb/SetDocumentSource')
    check(
      '🚩 ONE verb carries both fields, on its own requestId each time',
      sourceCalls.length === 2 &&
        sourceCalls[1].body.documentSource === MY_SOURCES[1].documentSource &&
        sourceCalls[1].body.sourceReference === 'CRM-889231' &&
        sourceCalls[0].body.requestId !== sourceCalls[1].body.requestId,
      JSON.stringify(sourceCalls[1]?.body),
    )
    check(
      'both chips settle, and nothing is left blocking the header',
      (await chipState('source')) === 'settled' && (await chipState('reference')) === 'settled',
    )
    check(
      'and the reference chip carries what was keyed',
      (await text(page, '[data-cc-chip="reference"]')).includes('CRM-889231'),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 38b. the soft gate: a lapsed slot WARNS, and never blocks ----
  {
    // An order the server is willing to submit, holding a window that has since
    // gone inactive. 🚩 `submitBlockers` is empty — §7 is explicit that
    // SLOT_UNAVAILABLE is a warning path and not a submit blocker, so a console
    // that dimmed *Place order* here would have hardened a soft gate itself.
    const LAPSED = {
      ...STATE,
      header: { ...STATE.header, slot: slotHeldFor(SLOT_CHOSEN, false) },
      capabilities: { ...STATE.capabilities, canSubmit: true, submitBlockers: [] },
    }
    const { context, page, errors } = await open(browser, { openState: LAPSED, slotLapses: true })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    check('a lapsed slot is named ON the chip', await page.locator('[data-cc-chip-lapsed]').isVisible())
    const warning = (await text(page, '[data-cc-slot-lapsed]')).replace(/\s+/g, ' ')
    check('and warned about in the flow, in words', warning.length > 30, warning)
    check(
      '🚩 the chip stays SETTLED — the order does hold a window',
      (await page.locator('[data-cc-chip="slot"]').getAttribute('data-cc-chip-state')) === 'settled',
    )
    check('🚩 and submit is NOT blocked by it', await page.locator('[data-cc-submit]').isEnabled())

    // The other half of the same soft gate: the window that goes between the
    // list being read and the agent picking it.
    await page.locator('[data-cc-chip-open="slot"]').click()
    await page.locator('[data-cc-slot-picker]').waitFor({ timeout: 10_000 })
    // 🚩 A different window — the fix for a lapsed slot is another window, and
    // the one the order already holds is not offered again.
    await page.locator(`[data-cc-slot-option="${SLOT_OTHER.slotId}"]`).click()
    await page.locator('[data-cc-slot-lapsed-refusal]').waitFor({ timeout: 10_000 })
    check(
      'a window that goes mid-call warns rather than failing',
      (await page.locator('[data-cc-slot-error]').count()) === 0,
    )
    check('the picker stays open with the windows still in front of the agent', await page.locator('[data-cc-slot-picker]').isVisible())
    check('and submit is still live throughout', await page.locator('[data-cc-submit]').isEnabled())

    // The retry lands: the gate was soft, so the call carries on.
    await page.locator(`[data-cc-slot-option="${SLOT_OTHER.slotId}"]`).click()
    await page.locator('[data-cc-slot-picker]').waitFor({ state: 'detached', timeout: 10_000 })
    check(
      'and the second attempt settles the chip, lapse note gone',
      (await page.locator('[data-cc-chip-lapsed]').count()) === 0 &&
        (await page.locator('[data-cc-slot-lapsed]').count()) === 0,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 39. placing the order: the receipt HOLDS until an order number exists ----
  //
  // An order the door is willing to place — lines, a caller, an address, and
  // `canSubmit` with nothing left in `submitBlockers`.
  const SUBMITTABLE = {
    ...PRIOR_STATE,
    capabilities: { ...PRIOR_STATE.capabilities, canSubmit: true, submitBlockers: [] },
  }
  // What a placed order looks like on screen, captured here and compared against
  // the REPLAY in box 40. 🚩 That comparison is the ticket's headline rule —
  // *both submitted outcomes are the same news* — and it is only assertable by
  // holding one panel's words next to the other's.
  let placedPanel = null

  {
    // The delay is what makes the in-flight state observable at all: without it
    // "the receipt holds" is a claim about a frame nobody can see.
    const { context, page, errors, wire } = await open(browser, {
      openState: SUBMITTABLE,
      submitDelayMs: 700,
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    check('a complete order offers a live Place order', await page.locator('[data-cc-submit]').isEnabled())
    const payableBefore = await text(page, '[data-cc-payable]')
    const linesBefore = await page.locator('[data-cc-line]').count()

    await page.locator('[data-cc-submit]').click()
    await page.locator('[data-cc-submit-placing]').waitFor({ timeout: 10_000 })

    const placingLabel = (await text(page, '[data-cc-submit]')).replace(/\s+/g, ' ')
    check('the button says it is placing the order', /placing/i.test(placingLabel), placingLabel)
    check('and cannot be pressed a second time mid-flight', await page.locator('[data-cc-submit]').isDisabled())
    // 🚩 The whole ruling, in one assertion: no optimistic hand-off. An order
    // the agent has been told about that then refuses is a phone call they
    // cannot take back.
    check(
      '🚩 nothing is confirmed while it is in flight — the receipt HOLDS',
      (await page.locator('[data-cc-order-placed]').count()) === 0 &&
        (await page.locator('[data-cc-order-no]').count()) === 0,
    )
    check(
      'and the order on screen is exactly as it was',
      (await text(page, '[data-cc-payable]')) === payableBefore &&
        (await page.locator('[data-cc-line]').count()) === linesBefore,
    )

    await page.locator('[data-cc-order-placed]').waitFor({ timeout: 10_000 })
    const orderNo = (await text(page, '[data-cc-order-no]')).replace(/\s+/g, '')
    check('the agent is given a real order number to read out', orderNo === DOCUMENT_NO, orderNo)
    placedPanel = (await text(page, '[data-cc-order-placed]')).replace(/\s+/g, ' ')

    const submits = wire.filter((w) => w.path === 'CallCenterWeb/Submit')
    check('exactly one Submit', submits.length === 1, `${submits.length} Submit call(s)`)
    // 🚩 The browser cannot influence what the caller pays: the CLCN document is
    // built server-side from engine state, so the request carries the id and
    // nothing else — no document, no lines, no amounts, no fee.
    check(
      '🚩 which carried ONLY the transaction id and a requestId',
      JSON.stringify(Object.keys(submits[0]?.body ?? {}).sort()) === '["requestId","transactionId"]',
      JSON.stringify(submits[0]?.body),
    )
    check(
      'a placed order has nothing left to place, correct or abandon',
      (await page.locator('[data-cc-submit]').count()) === 0 &&
        (await page.locator('[data-cc-line-void]').count()) === 0 &&
        (await page.locator('[data-cc-abandon]').count()) === 0,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 40. a refusal is a correction, and an outage is retryable ----
  {
    const { context, page, errors, wire } = await open(browser, {
      openState: SUBMITTABLE,
      submit: 'refused',
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    const payableBefore = await text(page, '[data-cc-payable]')
    const linesBefore = await page.locator('[data-cc-line]').count()

    await page.locator('[data-cc-submit]').click()
    await page.locator('[data-cc-submit-failed="refused"]').waitFor({ timeout: 10_000 })

    const refused = (await text(page, '[data-cc-submit-failed="refused"]')).replace(/\s+/g, ' ')
    // The server's own sentence (§7), passed through as data — it is what names
    // the field, and no client wording could name it better.
    check('a refusal is drawn in the server’s own words', refused.includes(SUBMIT_REFUSED_MESSAGE), refused)
    check(
      '🚩 and points at the section that fixes it',
      await page.locator('[data-cc-submit-fix="slot"]').isVisible(),
    )
    check('🚩 the basket survives it — nothing was lost', (await page.locator('[data-cc-line]').count()) === linesBefore)
    check('and the total is untouched', (await text(page, '[data-cc-payable]')) === payableBefore)
    check('the order is still there to place', await page.locator('[data-cc-submit]').isEnabled())
    check('nothing is confirmed', (await page.locator('[data-cc-order-placed]').count()) === 0)
    check('a refusal is NOT offered as a blind retry', (await page.locator('[data-cc-submit-retryable]').count()) === 0)

    // 🚩 The correction ENDS the refusal. Any verb moves the version, and a
    // danger box still saying *the order was not placed* under a receipt the
    // agent has just corrected is the console arguing with itself.
    await page.locator('[data-cc-line-void]').first().click()
    await page.waitForFunction(() => !document.querySelector('[data-cc-submit-failed]'), null, { timeout: 10_000 })
    check(
      '🚩 and it stops being said the moment the agent corrects the order',
      (await page.locator('[data-cc-submit-failed]').count()) === 0,
    )
    // The next press is a genuinely new action — the order it is about has moved.
    await page.locator('[data-cc-submit]').click()
    await page.locator('[data-cc-submit-failed="refused"]').waitFor({ timeout: 10_000 })
    const submits = wire.filter((w) => w.path === 'CallCenterWeb/Submit')
    check(
      'so placing a CORRECTED order is a new action, not a retry of the old one',
      submits.length === 2 && submits[0].body.requestId !== submits[1].body.requestId,
      JSON.stringify(submits.map((s) => s.body.requestId)),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 40b. the 503 that carries the envelope, and the retry that lands ----
  {
    const { context, page, errors, wire } = await open(browser, {
      openState: SUBMITTABLE,
      submit: 'outageOnce',
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    const linesBefore = await page.locator('[data-cc-line]').count()

    await page.locator('[data-cc-submit]').click()
    await page.locator('[data-cc-submit-failed="unavailable"]').waitFor({ timeout: 10_000 })

    const outage = (await text(page, '[data-cc-submit-failed="unavailable"]')).replace(/\s+/g, ' ')
    // 🚩 The assertion this ticket exists for. SUBMIT_UNAVAILABLE is a 503 that
    // CARRIES the envelope; a `core/api.ts` that let the status outrank the code
    // would map it to kind:'server' and the agent would read "unexpected" for a
    // routine retryable outcome, mid-call.
    check(
      '🚩 a transient outage reads as the server’s own sentence, not "unexpected"',
      outage.includes(SUBMIT_UNAVAILABLE_MESSAGE),
      outage,
    )
    check('and is marked retryable', await page.locator('[data-cc-submit-retryable]').isVisible())
    check('the transaction is still open and still has its basket', (await page.locator('[data-cc-line]').count()) === linesBefore)
    const retryLabel = (await text(page, '[data-cc-submit]')).replace(/\s+/g, ' ')
    check('the one control now offers the retry itself', /try again/i.test(retryLabel), retryLabel)
    check('and nothing was confirmed', (await page.locator('[data-cc-order-placed]').count()) === 0)

    await page.locator('[data-cc-submit]').click()
    await page.locator('[data-cc-order-placed]').waitFor({ timeout: 10_000 })

    const submits = wire.filter((w) => w.path === 'CallCenterWeb/Submit')
    // 🚩 One press, one requestId (law 3 / §4): the retry is a retry of that
    // press, not a second action — so the ledger reads as one attempt, and the
    // once-only key answers with the order the first send already minted.
    check(
      '🚩 the retry re-sends the SAME requestId — one action, not two orders',
      submits.length === 2 && submits[0].body.requestId === submits[1].body.requestId,
      JSON.stringify(submits.map((s) => s.body.requestId)),
    )
    const replayNo = (await text(page, '[data-cc-order-no]')).replace(/\s+/g, '')
    check(
      'and the agent is given the FIRST order’s number, not a second order',
      replayNo === DOCUMENT_NO && (await page.locator('[data-cc-order-no]').count()) === 1,
      replayNo,
    )
    // 🚩 The headline rule, asserted as an EQUALITY rather than as two readings
    // that happen to agree: `alreadySubmitted` is drawn word for word as the
    // first submit was. Any client branch that made the two look different is
    // the defect, and it would show up here.
    check(
      '🚩 a replay is the same news, word for word, as a first submit',
      (await text(page, '[data-cc-order-placed]')).replace(/\s+/g, ' ') === placedPanel,
      placedPanel,
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 177 / 858: the acceptance the server swallows, said out loud ----
  //
  // The v1.2 capture found both two-phase commits are a no-op on the live server:
  // the confirming retry — on the same requestId, as law 3 requires — resolves as
  // an already-applied REPLAY and never reaches the engine. The agent accepts, the
  // answer is a 200, and nothing changed. 🚩 The console cannot fix that; what it
  // must not do is stay SILENT, because silence is the outcome that sends an agent
  // on to quote a figure for a basket that did not move.
  {
    const { context, page, errors } = await open(browser, { swallowCommit: true })
    await page.goto(`${BASE}/callcenter`)
    // 175's gate: the acceptance under test is an ADD, so the order needs a
    // caller and a store before there is one to accept.
    await openTheGate(page)
    await page.locator('[data-cc-search-input]').fill('بنادول')
    await page.locator('[data-cc-search-row]').first().waitFor({ timeout: 10_000 })

    const NONE_ROW = CATALOGUE[1]
    await page.locator(`[data-cc-search-add="${NONE_ROW.materialNumber}"]`).click()
    await page.locator('[data-cc-confirm-sheet="belowAtp"]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-confirm-accept]').click()

    await page.locator('[data-cc-swallowed="belowAtp"]').waitFor({ timeout: 10_000 })
    const said = (await text(page, '[data-cc-swallowed="belowAtp"]')).replace(/\s+/g, ' ')
    check('🚩 an acceptance that did nothing is NOT silent', said.length > 0, said)
    check('and the basket really is empty, exactly as it says', await page.locator('[data-cc-basket-empty]').isVisible())
    check('the sheet is gone — the agent answered it', (await page.locator('[data-cc-confirm-sheet]').count()) === 0)
    check('no machine code reaches the agent', !/[A-Z]{3,}_[A-Z_]+/.test(said), said)
    // 🚩 No retry: the same id would be swallowed identically, and a fresh one
    // would be a genuinely new action against a real basket.
    check('it offers no blind retry', !/try again/i.test(said), said)
    check('the console is still usable underneath it', await page.locator('[data-cc-search-input]').isEnabled())
    // It is a thing to read once, not a state to be stuck in.
    await page.locator('[data-cc-swallowed-dismiss]').click()
    await page.locator('[data-cc-swallowed]').waitFor({ state: 'detached', timeout: 10_000 })
    check('and it can be dismissed once read', (await page.locator('[data-cc-swallowed]').count()) === 0)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 177 / 858: the same, on the OTHER two-phase verb ----
  {
    const { context, page, errors } = await open(browser, { openState: PRIOR_STATE, swallowCommit: true })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })
    const storeBefore = (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ')

    await page.locator('[data-cc-chip-open="store"]').click()
    await page.locator('[data-cc-store-picker]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-store-option="1204"]').click()
    await page.locator('[data-cc-confirm-sheet="storeChange"]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-confirm-accept]').click()

    await page.locator('[data-cc-swallowed="storeChange"]').waitFor({ timeout: 10_000 })
    const said = (await text(page, '[data-cc-swallowed="storeChange"]')).replace(/\s+/g, ' ')
    check('🚩 a store move that did nothing is NOT silent either', said.length > 0, said)
    check(
      'and the chip still reads the store the order is really at',
      (await text(page, '[data-cc-chip="store"]')).replace(/\s+/g, ' ') === storeBefore,
      storeBefore,
    )
    check('one banner, not two — the same mechanism as the add', (await page.locator('[data-cc-swallowed]').count()) === 1)
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  // ---- 177 / 860: the retry the server cannot answer yet ----
  //
  // Everything above drives §8.3's promise, because that is the CLIENT rule under
  // test and it has to hold the day 860 lands. This drives the v1.2 capture's own
  // answer: the outage loses the first response, the order IS minted, and the
  // retry is refused `SESSION_CLOSED { reason: "submitted" }` before the once-only
  // path runs. 🚩 The console's behaviour here is CORRECT and still bad news — it
  // returns the tab to the start rather than showing a submit error over a dead
  // order, and there is no surface anywhere that can give the agent the number.
  {
    const { context, page, errors } = await open(browser, {
      openState: SUBMITTABLE,
      submit: 'outageThenClosed',
    })
    await page.goto(`${BASE}/callcenter`)
    await page.locator('[data-cc-console]').waitFor({ timeout: 10_000 })

    await page.locator('[data-cc-submit]').click()
    await page.locator('[data-cc-submit-failed="unavailable"]').waitFor({ timeout: 10_000 })
    await page.locator('[data-cc-submit]').click()

    await page.locator('[data-cc-notice="sessionClosed"]').waitFor({ timeout: 10_000 })
    const notice = (await text(page, '[data-cc-notice="sessionClosed"]')).replace(/\s+/g, ' ')
    check('a refused retry is read as a dead order, not as a submit failure', notice.length > 0, notice)
    check(
      'and the reason it names is that the order was SUBMITTED',
      /submitted|placed/i.test(notice),
      notice,
    )
    check('it offers a way onward rather than a dead end', await page.locator('[data-cc-retry]').isVisible())
    check(
      '🚩 860 — and the order number is nowhere on the screen',
      (await page.locator('[data-cc-order-no]').count()) === 0 &&
        !(await page.locator('body').innerText()).includes(DOCUMENT_NO),
    )
    check('no console errors', errors.length === 0, errors[0] ?? '')
    await context.close()
  }

  await browser.close()

  const failed = results.filter((r) => !r.pass)
  console.log(`\n${results.length - failed.length}/${results.length} passed`)
  if (failed.length > 0) process.exit(1)
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
