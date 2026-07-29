/**
 * The call-center console's server calls. Every one goes through `@/core/api`
 * (`.claude/rules/api-envelope.md`): the envelope, the error taxonomy and 401
 * are that module's, and 401 in particular is never caught here.
 *
 * The door is `CallCenterWeb/*` (CONTRACT.md §1) — cookie-session only, one tag,
 * one grant, one probe. **Neither endpoint exists server-side yet** (BackOffice
 * 800 carries the grant, 801 the route table), so slice 0 is verified against a
 * stubbed envelope — the approach tickets 051/052 and 152 already used.
 *
 * The `SESSION_BUSY` retry/backoff (§6.1) lives at the foot of this file and
 * **nowhere else** — 🚩 never in `src/core/api.ts`: lease semantics have no
 * business in the layer every back-office grid shares
 * ([164](.issues/164-busy-collision-and-staleness.md)).
 *
 * **Path note.** Spec 160 and CONTRACT.md §6.1 both write this file as
 * `features/callcenter/api.ts`; it lands one level down, at
 * `features/callcenter/console/api.ts`. `callcenter` is the AREA (its own
 * top-level nav group, 134 §7) and `console` is the feature inside it, which is
 * what `.claude/rules/feature-structure.md` asks for and what the boundary lint
 * mechanically requires — it classifies `features/<area>/<feature>/` and would
 * read two flat files under `features/callcenter/` as two different features
 * importing each other. Same file, one directory deeper; nothing else moves.
 */
import { api, apiErrorCode } from '@/core/api'
import type {
  AbandonResult,
  AgentDocumentSource,
  CallCenterAccessResult,
  CustomerAddressBookEntry,
  CustomerAddressCapture,
  CustomerRequest,
  DeliveryType,
  ItemSearchResult,
  LinkRequestResult,
  LoyaltyMember,
  LoyaltySignupCapture,
  LoyaltySignupConfirmCapture,
  OpenResult,
  PaymentType,
  PrereqResolution,
  PriceCheckResult,
  SessionState,
  StockElsewhereResult,
  SubmitResult,
} from '@/core/models/callcenter'

/**
 * The ONE cache key the nav leaf and the route guard share, so a gated console
 * costs one network call and not two (134 §6, ticket 125's pattern). Exported
 * rather than re-spelled at each site: a typo in a string literal would not fail
 * a build, it would silently split the cache entry.
 */
export const CALLCENTER_ACCESS_KEY = ['callcenter', 'access'] as const

/**
 * `LoyaltyErrorCodes.CustomerNotExists` — the loyalty service's machine code for
 * *no member holds that number*.
 *
 * 🚩 A machine code matched against the envelope, which the i18n rule names as a
 * literal that is deliberately NOT localised: it is the server's identifier, not
 * anything a user reads. Matching the message instead would break the first time
 * somebody fixed its spelling — and its spelling today is *"doesn't exists"*.
 */
const MEMBER_NOT_FOUND = 'LOY-00100'

/**
 * The key one `open` action's result lives under. Keyed by the action's own
 * `requestId`, which is what makes *abandon and start fresh* work: a genuinely
 * new open action is a new id and therefore a new key, and the refusal the old
 * one answered can never be mistaken for the new one's answer.
 *
 * Spelled here rather than at the call site because it is load-bearing and
 * mutable — a typo in an inline literal would not fail a build, it would split
 * the cache entry and re-open an order.
 */
export const openKey = (requestId: string) => ['callcenter', 'open', requestId] as const

/** The query key holding one order's `SessionState` — the store of record.
 *  Keyed per transaction, which is what makes `applyState` free to be blind to
 *  identity and arbitrate version alone. */
export const sessionKey = (transactionId: string) =>
  ['callcenter', 'session', transactionId] as const

/**
 * One caller's address book. Keyed by the **customer** rather than by the order,
 * because that is what the book belongs to — and because the key is what stops
 * the previous caller's addresses from being offered for this one. The door
 * scopes the read to whoever is attached (§6.3), so a key that did not change
 * with the customer would hold an answer the door would no longer give.
 */
export const addressBookKey = (customerId: string) =>
  ['callcenter', 'addresses', customerId] as const

/**
 * One caller's still-open sales requests (194, v1.11). Keyed by the **customer**
 * for the same reason the address book is: the requests belong to the caller, the
 * door scopes the read to whoever is attached (880 §3), and a key that did not
 * move with the customer would offer the previous caller's requests for this one
 * — which is the swap this whole slice is careful about.
 */
export const customerRequestsKey = (customerId: string) =>
  ['callcenter', 'requests', customerId] as const

/**
 * One catalogue search. Keyed by the **order** as well as the term, because the
 * answer is scoped to the order's plant: availability and eligibility are both
 * read at `header.plant` (BackOffice 799), so the same words asked on a
 * different order are a different question — and a key that did not carry the
 * order would answer this one with the previous one's stock.
 */
export const itemSearchKey = (transactionId: string, query: string, offerId?: string | null) =>
  ['callcenter', 'itemSearch', transactionId, query, offerId ?? null] as const

/**
 * One item's price check (§3.4), keyed by the **order** as well as the item: the
 * quote is a pricing run at the order's own plant, origin, customer and loyalty,
 * so the same item asked on a different order is a different question — and a key
 * that did not carry the order would answer this one with another order's price,
 * which is the one number on this screen that gets read out loud.
 *
 * 🚩 Deliberately NOT keyed by `version`, for the opposite reason to `prereqKey`'s:
 * the price is re-asked when the panel is opened (`staleTime: 0`), and a key that
 * moved with every re-price would evict a quote the agent is mid-sentence about.
 */
export const priceCheckKey = (transactionId: string, itemNumber: string) =>
  ['callcenter', 'priceCheck', transactionId, itemNumber] as const

/**
 * Who else has the item (§3.5), keyed by the **order** as well as the item — the
 * list is ranked from the order's own plant, so the same item asked on an order
 * served from elsewhere is a different question and must not be served a cached
 * ranking measured from somewhere else.
 *
 * 🚩 **A different key from `priceCheckKey`, on purpose.** The two halves of the
 * panel are two cache entries so they can fail, retry and expire independently —
 * a shared key would make a stock outage evict the price, which is the one thing
 * §3.5 rule 6 exists to prevent.
 */
export const stockElsewhereKey = (transactionId: string, itemNumber: string) =>
  ['callcenter', 'stockElsewhere', transactionId, itemNumber] as const

/**
 * One offer's eligible items (§3.3), keyed by the **order** as well as the offer
 * — the set is ATP-filtered and ranked at the order's plant, so the same offer
 * asked on a different order is a different question.
 *
 * 🚩 It is deliberately NOT keyed by `version`. The rows must not move while an
 * add launched from one of them is running (138 / ticket 172), and a key that
 * changed with every re-price would re-rank the list under the agent's cursor
 * mid-click.
 */
export const prereqKey = (transactionId: string, offerId: string) =>
  ['callcenter', 'prereq', transactionId, offerId] as const

/**
 * The agent's own document sources (§ ticket 173). Keyed by nothing but the
 * screen: the list is derived from the SESSION server-side, so there is no
 * parameter that could vary it — and a key carrying a user id would be a client
 * asserting an identity the door deliberately does not accept.
 */
export const MY_SOURCES_KEY = ['callcenter', 'documentSources'] as const

const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ' // Crockford base32

/**
 * A client-minted ULID for one user action (§4 / law 3). Timestamp-prefixed so
 * ids sort by mint order, which is what makes a server-side ledger of the last
 * 50 legible when something goes wrong.
 *
 * **One action = one id**, reused verbatim across every retry of that action
 * including the retry that carries a `confirmToken`. That two-phase case is a
 * rule rather than a convention, so it does not live at a call site: `store-move.ts`
 * mints a rebind's id once and carries it through the confirm and the
 * re-preview, and is the only module here that calls this function for one.
 */
export function newRequestId(): string {
  let time = Date.now()
  const chars: string[] = new Array(26)
  for (let i = 9; i >= 0; i--) {
    chars[i] = ULID_ALPHABET[time % 32]
    time = Math.floor(time / 32)
  }
  const random = crypto.getRandomValues(new Uint8Array(16))
  for (let i = 0; i < 16; i++) chars[10 + i] = ULID_ALPHABET[random[i] % 32]
  return chars.join('')
}

/**
 * The window `setSlot` is told about, as v1.2 (§10) added it — the id plus four
 * optional descriptive fields, none of them price-affecting.
 *
 * 🚩 It lives here, with the call that sends it, rather than in the picker that
 * collects it: it is a REQUEST shape, and a wire contract declared inside a
 * presentational component is one the page has to import a type from a component
 * to satisfy.
 */
export interface PickedSlot {
  slotId: string
  day: string
  description: string
  from: string
  to: string
}

export const callCenterApi = {
  /**
   * `GET CallCenterWeb/Access` → `{ canOpenConsole }`. One boolean: open implies
   * act (134 §1), so there is no second capability to probe for.
   *
   * ⚠️ **Fails closed, deliberately** — no 404/network-tolerant catch, unlike the
   * `Notifications/Access` and `Bby/Access` probes. What sits behind this one
   * mints real OMS orders, so an unreachable probe must draw the refusal rather
   * than the console; the endpoint ships with BackOffice 800, so there is no
   * window in which a tolerant catch would be doing anything useful.
   */
  access(): Promise<CallCenterAccessResult> {
    return api.get<CallCenterAccessResult>('CallCenterWeb/Access')
  },

  /**
   * `POST CallCenterWeb/Open` → `OpenResult`. Opens a real engine transaction:
   * from this moment everything the agent does is on one transaction the server
   * owns (law 8 — the transaction IS the draft, there is no save verb).
   *
   * `outcome: 'refusedExisting'` is a **success**, not a throw — one active order
   * per agent (law 9), and the choice between resume and abandon is the agent's
   * ([163](.issues/163-order-already-open.md)).
   */
  open(requestId: string): Promise<OpenResult> {
    return api.post<OpenResult>('CallCenterWeb/Open', { requestId })
  },

  /**
   * `POST CallCenterWeb/Abandon` → `AbandonResult` (§8.2). Voids the engine
   * transaction; the coupon reversal is server-side and rides
   * `CollectReversalContexts()`, so there is nothing to undo here.
   *
   * 🚩 **It returns no state, so the caller owes the agent a landing.** Abandon
   * is never the last thing that happens: on the already-open screen it is the
   * first half of *abandon-and-start-fresh* and is immediately followed by
   * `open`, in that order ([163](.issues/163-order-already-open.md)); from
   * inside a live order it is the same act and lands the same way. An abandon
   * with no follow-on leaves the agent holding nothing.
   *
   * `requestId` is the **abandon action's own** id, not the open's — two actions,
   * two ids (law 3), reused verbatim only across retries of the same one.
   */
  abandon(transactionId: string, requestId: string): Promise<AbandonResult> {
    return api.post<AbandonResult>('CallCenterWeb/Abandon', { transactionId, requestId })
  },

  /**
   * `GET CallCenterWeb/MemberByMobile/{mobile}` — how the agent FINDS the caller,
   * before there is a caller to scope anything to (BackOffice 801: the four
   * loyalty routes precede attach, so grant-only is their whole boundary).
   *
   * 🚩 **A miss is `null`, not a throw** — and the ONE place that is made true is
   * here. This function's original note claimed *"the service answers an absent
   * member with an empty payload"*; driving it against a live SIS.Api on
   * 2026-07-29 showed it does not. `LoyMemberService.GetAndValidateMemberByMobile`
   * throws `DomainException(CustomerNotExists)`, so the envelope comes back
   * `success:false` and the console read it as a **failure**.
   *
   * ⚠️ The cost was not the red text. The rail hangs the enrolment offer off the
   * MISS branch (`isSuccess && !data`), so a caller who was not a member landed on
   * the error branch instead and the *Sign this caller up* button — built by 190,
   * wired, tested — was **unreachable in the running app**. The one path the whole
   * signup exists to serve was the one path that could not reach it.
   *
   * `LOY-00100` is therefore translated back into the absence it describes. This
   * is the api-envelope rule's own instruction — branch on the machine code, never
   * on the message — and it is done HERE rather than at the call site so there is
   * exactly one opinion about what *not a member* looks like to this console.
   *
   * 🚩 Only that code. Every other business refusal (a blocked customer, a
   * malformed number) still throws and is still drawn as what it is; a `catch`
   * that swallowed the lot would answer *no such caller* to a service that is
   * merely down, and the agent would enrol somebody who already exists.
   *
   * `branchId` is left unsent — the query param is optional on the original and
   * the console has no branch to scope a loyalty read by that the session does
   * not already imply.
   */
  async memberByMobile(mobile: string): Promise<LoyaltyMember | null> {
    try {
      return await api.get<LoyaltyMember | null>(
        `CallCenterWeb/MemberByMobile/${encodeURIComponent(mobile)}`,
      )
    } catch (error) {
      if (apiErrorCode(error) === MEMBER_NOT_FOUND) return null
      throw error
    }
  },

  /**
   * `POST CallCenterWeb/SignUpByBranch` — the first of the loyalty enrolment's
   * two steps (190, contract §6.6). It asks the loyalty service to send the
   * caller a code; the answer the console acts on is the envelope's own success.
   *
   * 🚩 **Not a session verb.** No `transactionId`, no `withBusyRetry`: the
   * signup precedes attach, so there is no transaction to scope it to and no
   * claim to collide with (the same posture as the address-book writes). It
   * still carries a `requestId` — CC2's own two calls do, and a re-sent enrolment
   * is exactly the double-apply §4's ledger exists to absorb.
   *
   * 🚩 **The body is `signup-view.ts`'s and only ever `signup-view.ts`'s** — see
   * `LoyaltySignupCapture` for what is not on it and why: no `branchId` (the
   * server stamps the call centre's own store, permanently, on the member) and
   * no normalised mobile (one rule, one place, and it is not a browser).
   */
  signUpByBranch(requestId: string, capture: LoyaltySignupCapture): Promise<void> {
    return api.post<void>('CallCenterWeb/SignUpByBranch', { requestId, ...capture })
  },

  /**
   * `POST CallCenterWeb/ConfirmSignUpByBranch` → the new `LoyaltyMember` — the
   * same shape the lookup answers, which is what lets the rail draw an enrolled
   * caller with the card it already has.
   *
   * 🚩 **It ends at a member, it does not attach one.** Putting the caller on
   * this order is `attachCustomer`, pressed deliberately — 165's two steps, which
   * a freshly enrolled caller does not get to skip.
   *
   * A wrong code is the service's own **business** refusal carrying its own
   * sentence, not a crash and not a client-side verdict: `canConfirmOtp` holds
   * the 4–6 digit shape so a typo costs a keystroke, and the server alone decides
   * whether the digits are right.
   */
  confirmSignUpByBranch(
    requestId: string,
    capture: LoyaltySignupConfirmCapture,
  ): Promise<LoyaltyMember> {
    return api.post<LoyaltyMember>('CallCenterWeb/ConfirmSignUpByBranch', { requestId, ...capture })
  },

  /**
   * `POST CallCenterWeb/AttachCustomer` → the whole `SessionState` (law 2).
   *
   * It is also what **opens the address book**: the five `CustomerAddresses`
   * routes are server-side scoped to the session's attached customer (§6.3,
   * BackOffice 801), so before this call there is no address book to reach —
   * which the response says in `capabilities.canOpenAddressBook`, the only thing
   * the console is allowed to read that from.
   */
  attachCustomer(transactionId: string, requestId: string, customerId: string): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/AttachCustomer', { transactionId, requestId, customerId })
  },

  /**
   * `POST CallCenterWeb/RemoveCustomer` → the whole `SessionState`.
   *
   * 🚩 It **clears the address and keeps the derived plant** (§6.3) — and that is
   * the SERVER's doing, arriving in the projection. The console must not "help"
   * by clearing a store it did not derive: a subsequent `setAddress` re-derives
   * it through the normal confirm path, which is what stops re-attaching a caller
   * from silently re-pricing the basket.
   */
  removeCustomer(transactionId: string, requestId: string): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/RemoveCustomer', { transactionId, requestId })
  },

  /**
   * `GET CallCenterWeb/CustomerAddresses` — the attached caller's address book.
   *
   * 🚩 **It takes no customer id.** The original is unscoped (`:1412` reads a
   * client-supplied `customerId` off the query string), which on a per-agent
   * door would let any agent enumerate any customer's addresses; BackOffice 801
   * resolves the customer off the agent's own session row instead, and
   * browser-supplied identity is exactly what the cookie branch exists to
   * distrust. So there is nothing to pass — and nothing the console could pass
   * that would widen what it may read.
   *
   * Before `attachCustomer` it refuses `NO_CUSTOMER_ATTACHED` (§6.3), which is
   * why the picker is only ever opened off `capabilities.canOpenAddressBook`.
   */
  customerAddresses(): Promise<CustomerAddressBookEntry[]> {
    return api.get<CustomerAddressBookEntry[]>('CallCenterWeb/CustomerAddresses')
  },

  /**
   * `POST CallCenterWeb/CustomerAddresses` — a new address on the caller's book,
   * answering the whole `CustomerAddressBookModel` **including the new
   * `addressNumber`** (BackOffice 878 §1 over 801's shipped route).
   *
   * 🚩 That return is why a create can **auto-apply**: the console hands the
   * minted number straight to `setAddress` with no re-read of the book, which is
   * the one-step service 179 ruling 6 asked for — the only reason an agent
   * creates an address mid-call is to deliver to it.
   *
   * 🚩 **Not a session verb.** It carries no `transactionId` and no `requestId`:
   * the address book is a CUSTOMER store on a different door (§6.5), and the
   * customer is resolved server-side off the agent's own session — the browser
   * names nobody. It therefore does not ride `withBusyRetry` either; there is no
   * transaction lease to collide with.
   *
   * The body is `address-capture.ts`'s and only ever `address-capture.ts`'s —
   * see that module for the narrowing and for why a cleared field is `""`.
   */
  createCustomerAddress(capture: CustomerAddressCapture): Promise<CustomerAddressBookEntry> {
    return api.post<CustomerAddressBookEntry>('CallCenterWeb/CustomerAddresses', capture)
  },

  /**
   * `PUT CallCenterWeb/CustomerAddresses` — a correction to an address already
   * on the book. Answers `true`, not the row: the book is re-read afterwards.
   *
   * ⚠️ **Editing the address the ORDER holds is an order act** (§6.5): the
   * console must re-issue `setAddress` on the same `addressNumber` afterwards,
   * because a `PUT` across districts leaves the order on a plant derived from a
   * district the address has left. Nothing in this function does that — it is
   * the caller's, and since [188](.issues/188-editing-re-pins-deleting-is-refused.md)
   * the page does it, off `rePinAfterEdit`. A `PUT` sent from anywhere that does
   * not ask that question is the silent wrong price §6.5 exists to prevent.
   */
  updateCustomerAddress(addressNumber: string, capture: CustomerAddressCapture): Promise<boolean> {
    return api.put<boolean>('CallCenterWeb/CustomerAddresses', { addressNumber, ...capture })
  },

  /**
   * `DELETE CallCenterWeb/CustomerAddresses?addressNumber=…` — a row off the
   * caller's book (188 / §6.5 rule 2).
   *
   * 🚩 **It refuses `ADDRESS_IN_USE_BY_ORDER` (409) on the address the open
   * order is holding.** The sidecar keeps an `addressNumber` while the submit
   * builder copies address *fields*, and `GetCustomerAddresses` filters
   * `IsDeleted = 0` — so deleting the current address yields a delivery order
   * that cannot build a shipping address at submit, broken at its LAST step by
   * an act on a different door. The console omits the control on that row too,
   * but that is the courtesy: **this refusal is the guard**, and the client
   * handles a code its own UI should never provoke.
   *
   * Ownership is checked first and unchanged — an address on someone else's
   * record still answers `ADDRESS_NOT_FOR_CUSTOMER` whether or not it happens to
   * match an order (BackOffice 878 §2).
   *
   * 🚩 The target rides the **query string**, not a body: it is the shape 801's
   * route already has. Not a session verb — no `transactionId`, no `requestId`,
   * no `withBusyRetry`; the customer is resolved server-side.
   */
  deleteCustomerAddress(addressNumber: string): Promise<boolean> {
    return api.del<boolean>('CallCenterWeb/CustomerAddresses', { addressNumber })
  },

  /**
   * `POST CallCenterWeb/SetAddress` → the whole `SessionState` (law 2).
   *
   * 🚩 **This is what decides where the order is fulfilled from**, and the
   * decision is the SERVER's: the district→store rule runs here and the answer
   * arrives as `header.plant` + `plantSource: 'derivedFromAddress'`. The console
   * derives nothing — a second client-side derivation is how the console and the
   * engine start disagreeing about which branch serves an address (spec 160).
   *
   * On an **empty basket** it applies inline: there is nothing to re-price, so
   * §5.1's confirmation is not raised at all. With lines it answers
   * `pendingConfirmation: storeChange` on the SUCCESS path, carrying the
   * unchanged state and a token to commit with — [167](.issues/167-store-move-shows-the-diff.md)'s
   * surface, which is why `confirmToken` is already in this signature.
   */
  setAddress(
    transactionId: string,
    requestId: string,
    addressNumber: string,
    confirmToken?: string,
  ): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/SetAddress', {
      transactionId,
      requestId,
      addressNumber,
      ...(confirmToken ? { confirmToken } : {}),
    })
  },

  /**
   * `POST CallCenterWeb/SetStore` → the whole `SessionState` (law 2). The
   * **explicit operator override** of the fulfilment store (§5.1) — the same
   * plant rebind `setAddress` reaches by derivation, asked for deliberately.
   *
   * 🚩 It is the SAME two-phase protocol, not a second one: on a basket with
   * lines whose plant would move it answers `200` with the unchanged state and
   * `pendingConfirmation: storeChange`, and the re-send carrying that token
   * commits exactly what was previewed — on the **same `requestId`** (§4). A
   * second confirmation mechanism would be a defect
   * ([167](.issues/167-store-move-shows-the-diff.md)).
   *
   * The store list it picks from is the whole estate, unfiltered (§2.2, CC2's
   * own behaviour) and is a reference read **off the door** — `StoreDetails`,
   * already served by `@/core/services/lookups.ts`. Nothing about which store
   * is legal is decided here: `capabilities.canChangeStore` opens the control
   * and the door refuses what it will not do.
   */
  setStore(
    transactionId: string,
    requestId: string,
    storeCode: string,
    confirmToken?: string,
  ): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/SetStore', {
      transactionId,
      requestId,
      storeCode,
      ...(confirmToken ? { confirmToken } : {}),
    })
  },

  /**
   * `GET CallCenterWeb/ItemSearch` — the box the agent types into while talking
   * (§1.1, BackOffice 799). A **pure read**, so it carries no `requestId`.
   *
   * It takes the `transactionId` and NOT a plant: the search is scoped to the
   * ORDER's fulfilment store server-side, which is the same rule the rest of the
   * door follows — a client-supplied plant would be a second opinion about where
   * this order is served from, and the one the agent could not see.
   *
   * 🚩 **The rows it answers are already the ones this order would accept.** The
   * eligibility whitelist (CC1's own, `POSOrderController`) and the ATP
   * annotation both run server-side, which is what makes every row addable in
   * one action — the agent never picks something and then hits a dead end
   * mid-call. Nothing here re-filters that answer.
   */
  /**
   * 🚩 `offerId` is the guidance strip's **hand-off** (172): a set of 997 must
   * not become a second screen, so `Search the other 994` narrows the console's
   * OWN search to that offer rather than opening a list of its own.
   *
   * It is an **optional, additive** query param the frozen contract's §1.1 does
   * not yet spell (`?transactionId=&query=`), on an endpoint BackOffice 799 has
   * not built — the same additive-and-server-first shape as `NearMiss.discount`
   * (§9), and recorded as a contract gap rather than smuggled in. A server that
   * ignores it answers the unnarrowed catalogue, which is why the panel's scope
   * chip states the offer it asked to be narrowed to instead of implying it.
   */
  itemSearch(transactionId: string, query: string, offerId?: string | null): Promise<ItemSearchResult> {
    return api.get<ItemSearchResult>('CallCenterWeb/ItemSearch', { transactionId, query, offerId })
  },

  /**
   * `GET CallCenterWeb/PriceCheck` — *"how much is that?"*, answered before the
   * item is in the basket (§3.4, v1.6, BackOffice 875). A **pure read**, so it
   * carries no `requestId`.
   *
   * 🚩 **It sends `transactionId` and `itemNumber` and NOTHING else.** No
   * quantity (always one unit, owner ruling), no plant, no sales org, no
   * condition: the server composes the whole pricing request from the order's own
   * header, and map note 4 is enforced by this signature having no other field to
   * abuse. That is also why `Pricing/Simulate` is **not** reused — route or body:
   * it is gated on the pricing-analysis screen's grant, and its `ManualConditions`
   * would hand an agent the price-affecting power the map note removes.
   *
   * 🚩 **It takes no claim and so it does not ride `withBusyRetry`.** The engine
   * prices in a throwaway context that is never persisted, so this read cannot
   * collide with the agent's own basket and never queues behind the 15-second
   * lease (§6.1) — which is why asking the price mid-basket costs the call
   * nothing. It is the only read on this contract with that property.
   *
   * Refuses `ITEM_NOT_FOUND`, `ITEM_NOT_SELLABLE`, `NO_PRICE_AT_PLANT`,
   * `NO_CUSTOMER_ATTACHED` and `STORE_NOT_CHOSEN` — no new codes. 🚩 Every one of
   * them is a **refusal the panel says**, never a fall back to the search row's
   * ex-VAT estimate: this number is read out loud with nothing beside it to
   * correct it (`price-check-view.ts`).
   */
  priceCheck(transactionId: string, itemNumber: string): Promise<PriceCheckResult> {
    return api.get<PriceCheckResult>('CallCenterWeb/PriceCheck', { transactionId, itemNumber })
  },

  /**
   * `GET CallCenterWeb/StockElsewhere` — *who else has it* (§3.5, v1.7,
   * BackOffice 876). The same panel and the same gate as `priceCheck`, and
   * deliberately **not the same call**.
   *
   * 🚩 **It is the only read on this contract that is a remote HTTP hop out of
   * SIS.Api.** The price is a lock-free engine run in SIS.Api's own process; this
   * is somebody else's stock service over the network — different failure modes,
   * different budgets, its own ~3 s race server-side. Two verbs and two queries is
   * what makes *a stock outage must not cost the agent the price* structural
   * rather than a promise about error handling.
   *
   * 🚩 **A stock outage is not an error.** The server races a timeout and answers
   * `available: false` with an EMPTY list on a 200 — which means *unknown*, never
   * *nobody has it* (`stock-view.ts`). So an outage never arrives here as a throw,
   * and the three codes it can refuse with are §7's existing ones — no new code,
   * no new capability.
   *
   * 🚩 **Read-only, and there is no sibling verb.** Nothing on this read moves the
   * order: a store change is the order's own act through `setStore` and §5.1's
   * confirm (§3.5 rule 1).
   *
   * A pure read, so it carries no `requestId` and takes no claim — like the price
   * check, asking costs the call nothing.
   */
  stockElsewhere(transactionId: string, itemNumber: string): Promise<StockElsewhereResult> {
    return api.get<StockElsewhereResult>('CallCenterWeb/StockElsewhere', { transactionId, itemNumber })
  },

  /**
   * `GET CallCenterWeb/ResolvePrereq` — what would actually close one offer's
   * gap (§3.3). A **pure read**, so it carries no `requestId`.
   *
   * 🚩 **On demand, never inline.** It is asked when the agent opens a card and
   * not once per near-miss per keystroke: a grouping expansion plus a stock read
   * for cards nobody opens is the hot path this endpoint exists to keep clear.
   *
   * 🚩 **Ranking, availability filtering and the cap are the SERVER's.** A
   * grouping is a set, not an item, and the handful the card draws is `topN` —
   * never a client slice (138 finding 1). Nothing here re-sorts or trims the
   * answer, exactly as nothing re-filters the item search's.
   */
  resolvePrereq(transactionId: string, offerId: string): Promise<PrereqResolution> {
    return api.get<PrereqResolution>('CallCenterWeb/ResolvePrereq', { transactionId, offerId })
  },

  /**
   * `POST CallCenterWeb/AddItem` → the whole `SessionState` (law 2).
   *
   * 🚩 **It sends an item number and a quantity, and never a price** (law 1 / map
   * note 3). The estimate the agent was looking at when they pressed *Add* is a
   * material-master figure that has never been near the engine; what the line
   * costs is decided by pricing and comes back in the projection.
   *
   * On a quantity beyond availability it answers `pendingConfirmation: belowAtp`
   * on the SUCCESS path with the unchanged state and a token to commit with —
   * the same two-phase protocol as the plant rebind, and
   * [169](.issues/169-below-availability-accepted.md)'s surface, which is why
   * `confirmToken` is already in this signature. Where availability is merely
   * *unknown* there is no confirmation at all: a degraded stock read never gates
   * order entry (§5.2).
   */
  addItem(
    transactionId: string,
    requestId: string,
    itemNumber: string,
    qty: number,
    confirmToken?: string,
    /** v1.2 (§10) — optional. `ScanOptions.Uom` already exists on the engine, and
     *  an agent adding a box rather than a strip should not have to add-then-change.
     *  ABSENT means the engine's own default unit, exactly as before, so omitting
     *  it is not a lesser call. Not price-affecting on this side either way: the
     *  unit is an intent, the money comes back in the projection (law 1). */
    uom?: string,
  ): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/AddItem', {
      transactionId,
      requestId,
      itemNumber,
      qty,
      ...(uom ? { uom } : {}),
      ...(confirmToken ? { confirmToken } : {}),
    })
  },

  /**
   * `POST CallCenterWeb/ChangeQty` → the whole `SessionState` (law 2). The
   * commonest correction on a call: the caller changes their mind, and the
   * basket keeps up without starting over.
   *
   * 🚩 It sends a **new quantity**, never a delta — the engine owns what the
   * line holds, and a delta applied to a line that moved under the agent would
   * be a quantity nobody chose.
   *
   * Beyond availability it is the SAME two-phase path as `addItem`
   * ([169](.issues/169-below-availability-accepted.md)): `200` with the
   * unchanged state and a `belowAtp` token, and the acceptance is a second send
   * of this verb on the same `requestId` carrying it. Where availability is
   * merely *unknown*, nothing is raised at all.
   *
   * Refuses `LINE_NOT_FOUND` (usually a stale screen) and `QTY_INVALID` (zero,
   * negative, or beyond the per-line cap — the cap is the engine's and is never
   * re-implemented here).
   */
  changeQty(
    transactionId: string,
    requestId: string,
    lineId: string,
    newQty: number,
    confirmToken?: string,
  ): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/ChangeQty', {
      transactionId,
      requestId,
      lineId,
      newQty,
      ...(confirmToken ? { confirmToken } : {}),
    })
  },

  /**
   * `POST CallCenterWeb/VoidLine` → the whole `SessionState` (law 2).
   *
   * 🚩 **No confirmation, by contract and by ruling.** It carries no
   * `confirmToken` field at all (§1.1): voiding one line is an ordinary
   * correction the agent can undo by adding it again, and §5's "are you sure"
   * is reserved for what re-prices the whole basket. The act that DOES throw a
   * basket away — abandon — keeps its dialog (163).
   *
   * Refuses `LINE_NOT_FOUND`, which on this verb is nearly always a screen that
   * has fallen behind rather than a mistake the agent made.
   */
  voidLine(transactionId: string, requestId: string, lineId: string): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/VoidLine', { transactionId, requestId, lineId })
  },

  /**
   * `POST CallCenterWeb/ChangeUom` → the whole `SessionState` (law 2).
   *
   * The unit is one of the line's own `uomOptions` — the projection's list, so
   * the console never offers a unit the item does not come in. A unit outside it
   * refuses `UOM_NOT_AVAILABLE`; that path stays reachable because the basket
   * can fall behind, not because the console invents units.
   *
   * It re-prices (a box is not twelve singles), which is why it returns the
   * whole state like everything else — including `totals`, so the receipt moves
   * with it.
   */
  changeUom(transactionId: string, requestId: string, lineId: string, uom: string): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/ChangeUom', { transactionId, requestId, lineId, uom })
  },

  /**
   * `GET CallCenterWeb/MyDocumentSources` — the sources THIS agent may use
   * (BackOffice 801). A pure read, so it carries no `requestId`.
   *
   * 🚩 **No user id in the path.** The original (`DocumentSourceUsers/{userId}`)
   * trusts a client-supplied identifier, which is the thing the cookie branch
   * exists to distrust; the door resolves the agent off the session row instead
   * (137's second deliberate break with *delegates verbatim*). So there is
   * nothing to pass — and nothing the console could pass that would widen what
   * it may read.
   */
  myDocumentSources(): Promise<AgentDocumentSource[]> {
    return api.get<AgentDocumentSource[]>('CallCenterWeb/MyDocumentSources')
  },

  /**
   * `POST CallCenterWeb/SetSlot` → the whole `SessionState` (law 2).
   *
   * 🚩 **A soft gate, and it stays soft.** A slot that lapses `warns` — the door
   * answers `SLOT_UNAVAILABLE` (409) and the order is untouched, which is a
   * warning path and explicitly **not** a submit blocker (§7). Nothing here
   * turns it into one, and nothing here re-implements *is this slot still
   * active*: `SlotIsActive` is off the door and the server decides.
   *
   * `slotId: null` clears the slot — the same verb, so there is no second
   * "unset" path to keep aligned.
   *
   * The windows it picks from are a reference read **off the door** —
   * `Slots/AvailableSlots/{storeCode}`, served by `@/core/services/lookups.ts`
   * (137: store operational data, no document or customer data in it).
   */
  setSlot(
    transactionId: string,
    requestId: string,
    slotId: string | null,
    /**
     * v1.2 (§10) — the window's own four fields, optional.
     *
     * 🚩 The client passes back the slot it already picked rather than the
     * server re-resolving it, because the slot catalogue is deliberately NOT on
     * this door (137 kept the reference reads on their existing routes) and the
     * CLCN header stamps all five slot fields. None of them is price-affecting,
     * and a client that sends none is unchanged — which is what makes the field
     * additive rather than a new contract.
     */
    window?: Omit<PickedSlot, 'slotId'>,
  ): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/SetSlot', {
      transactionId,
      requestId,
      slotId,
      // Only what the picker actually held. A null slot clears the window, and
      // there is nothing to describe about a window that is being removed.
      ...(slotId !== null && window ? window : {}),
    })
  },

  /**
   * `POST CallCenterWeb/SetFulfilment` → the whole `SessionState` (law 2) — how
   * the order arrives, which is the first question of the call.
   *
   * 🚩 **It carries no `confirmToken`, and that is the contract's own shape**
   * (§1.1's verb table). The flip never moves the plant: under
   * `Delivery → PickInStore` the order keeps the plant it already has, and the
   * re-derivation on the way back reaches the `storeChange` confirmation through
   * `setAddress`'s existing rule rather than through a second one on this verb
   * (§5.1 — *"`setFulfilment` never raises this"*). So this is an ordinary
   * one-shot verb and there is no two-phase path here to keep aligned.
   *
   * 🚩 **Every consequence of the flip arrives in the response**, and none of
   * them is computed here: the server clears `address`, drops `MISSING_SLOT`,
   * zeroes `deliveryFee` and sets `retainedAddressLabel` in the same payload
   * (capture 09). The console draws that answer — `fulfilment-view.ts` decides
   * only what the agent SEES of it.
   *
   * Refuses `SESSION_CLOSED` and the session's ordinary faults; there is no
   * refusal specific to the mode, because for CLCN both modes are always
   * permitted (§2.2, [132](.issues/132-header-capture-inventory.md)).
   */
  setFulfilment(transactionId: string, requestId: string, mode: DeliveryType): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/SetFulfilment', { transactionId, requestId, mode })
  },

  /**
   * `POST CallCenterWeb/SetPaymentType` → the whole `SessionState` (law 2).
   *
   * 🚩 **Not a tender, and no money moves.** `Online` instructs OMS to send the
   * caller a payment link they complete elsewhere; the console never sees a
   * gateway, a card or a result (§2.4). It re-prices nothing — `deliveryFee`'s
   * predicate contains no payment term at all — which is why it carries no
   * `confirmToken` either.
   *
   * 🚩 **An axis independent of `deliveryType`.** All four combinations are
   * legal, and this verb is what replaces `Submit.cs:196`'s live derivation of
   * *paid online* from *is a delivery* — a rule that is wrong in both
   * directions at once.
   *
   * Refuses `PAYMENT_TYPE_FORCED` (409 — the order's `paymentTypeForcedReason`
   * is non-null; ⚠ unreachable in phase 1, no forcing rule is configured) and
   * `PAYMENT_TYPE_INVALID` (`Receivable` is reserved, and reserved is not the
   * same as accepted). The console offers neither path a control, and the
   * refusals are still worded because a capability is advisory and the door is
   * the enforcement.
   */
  setPaymentType(
    transactionId: string,
    requestId: string,
    paymentType: PaymentType,
  ): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/SetPaymentType', {
      transactionId,
      requestId,
      paymentType,
    })
  },

  /**
   * `POST CallCenterWeb/SetDocumentSource` → the whole `SessionState` (law 2) —
   * how the order is traced back to the campaign or system that produced the
   * call.
   *
   * 🚩 **One verb for both fields.** The source and its reference are sent
   * together because the mandatory-reference rule is the SERVER's and is
   * evaluated over the pair: a source sent alone would be refused
   * `SOURCE_REFERENCE_REQUIRED` (400), and a console that split them into two
   * verbs would be re-implementing which sources require one — the second
   * opinion this door exists to prevent.
   */
  setDocumentSource(
    transactionId: string,
    requestId: string,
    documentSource: string,
    sourceReference: string,
  ): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/SetDocumentSource', {
      transactionId,
      requestId,
      documentSource,
      sourceReference,
    })
  },

  /**
   * `POST CallCenterWeb/SetOrderNote` → the whole `SessionState` (law 2) — what
   * the caller told the agent, travelling with the order (183, v1.3).
   *
   * 🚩 **`null` CLEARS it, and clearing is a real act.** A stale instruction
   * that survives on the header travels to the store with the order, so the verb
   * takes `string | null` rather than only text and the console sends `null`
   * rather than `''`: the column is what the picker reads, and *empty but
   * present* is not the same fact as *no instruction*.
   *
   * 🚩 **Never price-affecting, and it blocks nothing.** It raises no
   * `pendingConfirmation`, has no `confirmToken`, and no `submitBlocker` names
   * it — an order with no note is an ordinary order. The column is
   * `NVARCHAR(MAX)`, so a long note is not silently truncated and the console
   * imposes no length rule of its own.
   *
   * Refuses only the session's ordinary faults (`SESSION_CLOSED`,
   * `SESSION_BUSY`) — there is nothing about free text for the door to reject.
   */
  setOrderNote(transactionId: string, requestId: string, note: string | null): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/SetOrderNote', { transactionId, requestId, note })
  },

  /**
   * `POST CallCenterWeb/ApplyCoupon` → the whole `SessionState` (law 2) — the
   * caller's coupon, redeemed (189, v1.10).
   *
   * 🚩 **It redeems BEFORE the engine sees it.** `AddCouponAsync` burns the code
   * at the coupon service and only then scans the campaign SKU, so a
   * mistyped-but-valid code spends something real and there is no client-side
   * undo for it — which is why `CouponPicker` reads the code back before the
   * press rather than after. Nothing here validates a code: the coupon service
   * owns what is redeemable, and a console that pre-screened would be a second
   * opinion about a ledger it cannot see.
   *
   * 🚩 **A second, DIFFERENT code is an ordinary success.** The engine holds a
   * list and the duplicate check is per-code (capture 14's `duplicate` leg), so
   * the console enforces no one-coupon rule of its own.
   *
   * Refuses `COUPON_REJECTED` (409, carrying the coupon service's own message —
   * said out loud, never shown as a code), `COUPON_ALREADY_APPLIED` (409) and
   * the opening gate's own faults; `canApplyCoupon` is advisory and this door is
   * the enforcement.
   */
  applyCoupon(transactionId: string, requestId: string, couponCode: string): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/ApplyCoupon', {
      transactionId,
      requestId,
      couponCode,
    })
  },

  /**
   * `POST CallCenterWeb/RemoveCoupon` → the whole `SessionState` (law 2) — the
   * coupon taken back off, and the release given back to the caller.
   *
   * 🚩 **Reverse first, void only if the reverse landed** (issue 211's till
   * invariant, which the server composes here): `VoidLineAsync` on the `COUP`
   * line drops the bonus buy correctly, but `CollectReversalContexts()` is
   * reached from `VoidTransactionAsync` alone — so a bare void would take the
   * discount off and leave the customer's coupon **spent**.
   *
   * 🚩 Which makes **`COUPON_REVERSAL_REFUSED` (409) mean NOTHING CHANGED** —
   * the order is byte-identical and the coupon is still on it. That is the
   * opposite of what a failed remove normally means, and it is the one refusal
   * on this contract whose wording the console owns rather than passing through:
   * an agent told *"could not remove"* would reasonably tell the caller the
   * discount had gone.
   */
  removeCoupon(transactionId: string, requestId: string, couponCode: string): Promise<SessionState> {
    return api.post<SessionState>('CallCenterWeb/RemoveCoupon', {
      transactionId,
      requestId,
      couponCode,
    })
  },

  /**
   * `GET CallCenterWeb/CustomerRequests` — the attached caller's still-open sales
   * requests, newest first, each with its lines (194, BackOffice 880 §3). A pure
   * read, so it carries no `requestId`.
   *
   * 🚩 **It takes no customer id, and that is a safety property rather than a
   * tidiness one.** The scope comes off the session row (§6.3);
   * `GetSalesRequestList`'s own filter is `@CustomerId IS NULL OR …`, so an empty
   * scope answers with **every open request in the estate** — a door that accepted
   * a browser-supplied id would be one typo away from offering an agent a
   * stranger's request to convert. Before `attachCustomer` it refuses
   * `NO_CUSTOMER_ATTACHED`, which is why the read is only ever fired with a caller
   * on the order.
   *
   * The reason arrives with its description already resolved (the SREQ reason
   * group's curated text): the agent must never read `TMRA`, and sending the
   * console to `SdDocument/ReasonsByGroup` would make it knock on a second door
   * its `CallCenterWeb` grant does not cover.
   *
   * ⚠ **Unbuilt server-side** (880) — stubbed in `tools/linked-request-drive.mjs`
   * to 880 §3's documented shape.
   */
  customerRequests(): Promise<CustomerRequest[]> {
    return api.get<CustomerRequest[]>('CallCenterWeb/CustomerRequests')
  },

  /**
   * `POST CallCenterWeb/LinkRequest` → `LinkRequestResult` (194, 880 §4) — the
   * caller's open request becomes this order.
   *
   * 🚩 **One press, one act, one id.** The verb stamps the request number and its
   * reason, copies the request's **store**, copies its **items** through
   * `addItem`'s own guardrails, prefills `sourceReference` where it is empty, and
   * for `TMRA` additionally forces `PickInStore` + `Online`. The console must
   * **not** loop `addItem` over the lines: N ids for one agent action is §4 law 3
   * broken by design, and the guardrail outcomes belong to the server's own copy.
   *
   * 🚩 Refused unless the basket is **empty** (`LINES_EXIST`) — the restriction
   * the rest of the design hangs off, and the reason `capabilities.canLinkRequest`
   * exists.
   *
   * ⚠ **Unbuilt server-side** (880) — stubbed in the drive.
   */
  linkRequest(
    transactionId: string,
    requestId: string,
    /** The picked request's own document number. The ONE request this order
     *  converts — `RefDocumentNo` is singular and 055c makes the conversion
     *  one-shot, so there is no list to send. */
    documentNo: string,
  ): Promise<LinkRequestResult> {
    return api.post<LinkRequestResult>('CallCenterWeb/LinkRequest', {
      transactionId,
      requestId,
      documentNo,
    })
  },

  /**
   * `POST CallCenterWeb/Submit` → `SubmitResult` (§8.3) — the CLCN document, and
   * the one moment this console is deliberately not optimistic.
   *
   * 🚩 **It takes only the transaction id.** No document, no lines, no amounts,
   * no fee: the document is built server-side from engine state by
   * `Cc2DocumentHeaderBuilder`, which is precisely what makes the browser unable
   * to influence what the caller pays (map note 3). The delivery fee is quoted
   * live in `totals` as lines change and is not computed here or at submit.
   *
   * 🚩 **Submitting twice is a success.** Once-only is `(OrderNo, DocumentType)`
   * with `OrderNo := TransactionId`, so a replay answers `alreadySubmitted`
   * carrying the FIRST order number — and the server still completes the local
   * tail on that path (133). The console treats the two identically;
   * `submit-outcome.ts` is what makes that structural rather than a promise.
   *
   * Refuses `SUBMIT_REFUSED` (409, carrying `field` — the transaction stays
   * Open, so a refusal is a correction rather than a lost basket) and
   * `SUBMIT_UNAVAILABLE` (**503 carrying the envelope** — transient, the order
   * stays Open and retryable). 🚩 That 503 is only readable as a refusal because
   * `core/api.ts` lets a CODED envelope outrank a 5xx status; without it a
   * routine retryable outcome would reach the agent as "unexpected".
   */
  submit(transactionId: string, requestId: string): Promise<SubmitResult> {
    return api.post<SubmitResult>('CallCenterWeb/Submit', { transactionId, requestId })
  },

  /**
   * `GET CallCenterWeb/State` — refresh, recovery, reload and second tab only
   * (law 2). Never a way to "sync": a mutating verb has already returned the
   * whole state.
   *
   * It is also **the resume half of 163**: the agent who chooses to resume the
   * order they already have open is read back onto it through this call and
   * nothing else — there is no client-side memory of an order to restore from.
   */
  getState(transactionId: string): Promise<SessionState> {
    return api.get<SessionState>('CallCenterWeb/State', { transactionId })
  },
}

/**
 * The collision backoff, in milliseconds before each retry (§6.1 / law 7).
 *
 * Five retries after the first attempt — six attempts, ~6 s of waiting inside
 * the worst-case 15 s self-lockout, so the ceiling is reached while the agent is
 * still on the call. The first retry is immediate because the common collision
 * is two of the agent's OWN requests overlapping by milliseconds, and making
 * them all wait 400 ms would be a self-inflicted stutter.
 *
 * 🚩 The schedule is the **contract's**, not the server's hint. `SESSION_BUSY`
 * carries `retryAfterMs` and it is deliberately not honoured as a delay: a
 * bounded client ceiling is what guarantees the agent reaches the still-busy
 * state with an action in it, and a server hint could postpone that forever.
 */
export const BUSY_BACKOFF_MS = [0, 400, 800, 1600, 3200] as const

export interface BusyRetryHooks {
  /** Fired before each wait — `retry` is 1-based, so the strip can say which
   *  attempt it is on. It is never called when the first attempt succeeds. */
  onRetry?: (retry: number, delayMs: number) => void
  /** Injected by the pure test so the schedule is proved in microseconds. */
  sleep?: (ms: number) => Promise<void>
}

const wait = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms))

/**
 * Run one verb, riding out a routine claim collision.
 *
 * `SESSION_BUSY` is not a fault (law 7): the 15 s strict claim is the engine's
 * only mutual exclusion, so two requests on one order collide as a matter of
 * course — a second tab, or the agent's own two keystrokes. It is retried
 * automatically and **bounded**; after the ceiling the refusal is rethrown so
 * the console can draw the still-busy state with a manual retry in it. The agent
 * is never left without an action.
 *
 * 🚩 **Every other error is rethrown untouched, on the first attempt.** A
 * guardrail refusal (§7) is the server's considered answer to what was asked;
 * retrying it would turn one refusal into six and delay the banner the agent has
 * to read.
 *
 * It takes a thunk rather than a verb name so **every verb inherits it** without
 * this module knowing which verbs exist — which is why 164 is built before the
 * verbs that will collide most.
 */
export async function withBusyRetry<T>(
  verb: () => Promise<T>,
  { onRetry, sleep = wait }: BusyRetryHooks = {},
): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    try {
      return await verb()
    } catch (err) {
      if (apiErrorCode(err) !== 'SESSION_BUSY' || attempt >= BUSY_BACKOFF_MS.length) throw err
      const delayMs = BUSY_BACKOFF_MS[attempt]
      onRetry?.(attempt + 1, delayMs)
      await sleep(delayMs)
    }
  }
}
