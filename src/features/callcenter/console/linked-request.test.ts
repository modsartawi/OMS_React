import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import type {
  CustomerRequest,
  LinkRequestResult,
  LinkedRequest,
  SessionCapabilities,
  SessionState,
} from '@/core/models/callcenter'
import {
  linkGate,
  linkedCard,
  reasonWords,
  reportWithout,
  requestOffer,
  requestRows,
  skippedReport,
  submitRefusal,
  unlinkCost,
} from './linked-request'
import { readSubmitFailure } from './submit-outcome'
import { ATTACHED_SESSION, EMPTY_SESSION } from './__fixtures__/payloads'

/**
 * 🚩 **The captures predate v1.11**, so `linkedRequest` and `canLinkRequest` are
 * absent from both fixtures and every case below says which of them it is adding.
 * That is deliberate: the two states this module has to get right on a
 * pre-v1.11 server (no field, no capability) are the fixtures as they stand, and
 * a hand-built "neutral" state would have hidden them.
 *
 * `EMPTY_SESSION` is capture 01 — no caller, no lines. `ATTACHED_SESSION` is
 * capture 02 — a caller and two priced lines.
 */

/** A caller attached and the basket empty: the one state a link is offered in. */
const linkable = (extra: Partial<SessionCapabilities> = {}): SessionState => ({
  ...EMPTY_SESSION,
  header: { ...EMPTY_SESSION.header, customer: ATTACHED_SESSION.header.customer },
  capabilities: { ...EMPTY_SESSION.capabilities, canLinkRequest: true, ...extra },
})

const TMRA: LinkedRequest = {
  documentNo: 'SREQ-0001234',
  reason: 'TMRA',
  reasonDescription: 'Tamara payment',
  storeCode: '1234',
  note: 'Customer paid via Tamara, collecting Mounjaro 5mg',
}

const request = (over: Partial<CustomerRequest> = {}): CustomerRequest => ({
  documentNo: 'SREQ-0001234',
  documentDate: '2026-07-28T09:14:00',
  storeCode: '1234',
  reason: 'TMRA',
  reasonDescription: 'Tamara payment',
  note: 'Customer paid via Tamara, collecting Mounjaro 5mg',
  lines: [{ itemNumber: '100234', description: 'Mounjaro 5mg pen', quantity: 1, uom: 'EA' }],
  ...over,
})

const linked = (state: SessionState, request: LinkedRequest | null): SessionState => ({
  ...state,
  header: { ...state.header, linkedRequest: request },
})

describe('reasonWords', () => {
  it('renders the description the server resolved', () => {
    expect(reasonWords(TMRA)).toBe('Tamara payment')
  })

  it('renders NOTHING rather than the code when the description is missing', () => {
    // 🚩 The whole point of 880 §3 resolving the description server-side: the
    // agent must never read `TMRA` to a caller. A `?? reason` fallback here would
    // be the console quietly re-inventing the thing the contract removed — so an
    // unworded reason renders as an absence, and the surface says nothing.
    const bare = { ...TMRA, reasonDescription: null }
    expect(reasonWords(bare)).toBeNull()
    expect(reasonWords({ ...bare, reasonDescription: '   ' })).toBeNull()
  })

  it('is null for no request at all', () => {
    expect(reasonWords(null)).toBeNull()
  })
})

describe('requestOffer', () => {
  it('counts the caller’s open requests', () => {
    const offer = requestOffer(linkable(), [request(), request({ documentNo: 'SREQ-0001299' })])
    expect(offer).toEqual({ count: 2 })
  })

  it('is silent with no open request — a plain order gains no furniture', () => {
    expect(requestOffer(linkable(), [])).toBeNull()
    expect(requestOffer(linkable(), undefined)).toBeNull()
  })

  it('is silent with no caller attached', () => {
    // The read is scoped to the attached caller by the door itself (880 §3), so
    // there is nothing to count — and a count over a caller-less order would be
    // a claim about somebody the console has not got.
    const noCaller = { ...EMPTY_SESSION, capabilities: { ...EMPTY_SESSION.capabilities, canLinkRequest: false } }
    expect(requestOffer(noCaller, [request()])).toBeNull()
  })

  it('is silent while the basket holds lines — the server’s own LINES_EXIST', () => {
    // 🚩 Read off `canLinkRequest`, never re-derived: the empty-basket rule is the
    // server's (880 §4.1) and the console does not own a second copy of it.
    const withLines = {
      ...ATTACHED_SESSION,
      capabilities: {
        ...ATTACHED_SESSION.capabilities,
        canLinkRequest: false,
        capabilityReasons: { canLinkRequest: 'LINES_EXIST' },
      },
    }
    expect(withLines.lines.length).toBeGreaterThan(0)
    expect(requestOffer(withLines, [request()])).toBeNull()
  })

  it('falls back to the basket itself only where the capability is ABSENT', () => {
    // A pre-v1.11 server cannot say `canLinkRequest`, and §9's rule is to render
    // what we can see rather than assume the worst. What we can see is the
    // basket — so the offer stands on an empty one and goes on a full one.
    const { canLinkRequest: _absent, ...caps } = linkable().capabilities
    expect(requestOffer({ ...linkable(), capabilities: caps }, [request()])).toEqual({ count: 1 })
    expect(requestOffer({ ...ATTACHED_SESSION, capabilities: caps }, [request()])).toBeNull()
  })

  it('is silent once a request is already linked — the card replaces the count', () => {
    // One order converts at most one request (`RefDocumentNo` is singular), so a
    // count beside a linked card would offer something that cannot happen.
    expect(requestOffer(linked(linkable(), TMRA), [request()])).toBeNull()
  })

  it('is silent on an order that is no longer open', () => {
    expect(requestOffer({ ...linkable(), status: 'submitted' }, [request()])).toBeNull()
  })
})

describe('linkGate', () => {
  it('is open when the server says so', () => {
    expect(linkGate(linkable().capabilities)).toEqual({ canLink: true, reason: null })
  })

  it('carries the server’s own reason when shut', () => {
    expect(
      linkGate({
        ...EMPTY_SESSION.capabilities,
        canLinkRequest: false,
        capabilityReasons: { canLinkRequest: 'LINES_EXIST' },
      }),
    ).toEqual({ canLink: false, reason: 'LINES_EXIST' })
  })

  it('is shut with no reason rather than open, when the reason is missing', () => {
    // The reasons map is emptied deliberately: capture 01 now carries
    // `canLinkRequest: 'NO_CUSTOMER'` in it (v1.11, re-captured live), and this
    // case is about the server that shuts the door and says nothing.
    expect(
      linkGate({ ...EMPTY_SESSION.capabilities, canLinkRequest: false, capabilityReasons: {} }),
    ).toEqual({ canLink: false, reason: null })
  })

  it('degrades to open on a pre-v1.11 server', () => {
    // Same posture as `canApplyCoupon` (189): an absent capability is a server
    // older than the field, and the door refuses in words if it must.
    const { canLinkRequest: _absent, ...caps } = linkable().capabilities
    expect(linkGate(caps).canLink).toBe(true)
  })
})

describe('requestRows', () => {
  it('shows what it is about to copy — the lines, the reason in words, the note', () => {
    const [row] = requestRows([request()])
    expect(row.documentNo).toBe('SREQ-0001234')
    expect(row.storeCode).toBe('1234')
    expect(row.reason).toBe('Tamara payment')
    expect(row.note).toBe('Customer paid via Tamara, collecting Mounjaro 5mg')
    expect(row.lines).toHaveLength(1)
    expect(row.lines[0]).toMatchObject({ itemNumber: '100234', quantity: 1, uom: 'EA' })
  })

  it('never shows the reason CODE, on a row whose description is missing', () => {
    const [row] = requestRows([request({ reasonDescription: null })])
    expect(row.reason).toBeNull()
    expect(JSON.stringify(row)).not.toContain('TMRA')
  })

  it('links out to the OMS document rather than opening it here', () => {
    // 🚩 The picker is not `DocumentDetailsPage` and must not become it: that page
    // has no view-only mode, so reusing it would put change-store / reschedule /
    // close-request under an agent's hand mid-call — and `callcenter → oms` is a
    // boundary violation besides. A URL is not an import.
    expect(requestRows([request()])[0].href).toBe('/oms/document/SREQ-0001234')
  })

  it('carries no money — the request is unpriced and none may be invented', () => {
    const rows = requestRows([request()])
    expect(JSON.stringify(rows)).not.toMatch(/price|amount|total|SAR/i)
  })

  it('holds the server’s order and drops nothing', () => {
    const rows = requestRows([request(), request({ documentNo: 'SREQ-0001299' })])
    expect(rows.map((r) => r.documentNo)).toEqual(['SREQ-0001234', 'SREQ-0001299'])
  })
})

describe('linkedCard', () => {
  it('is null on an ordinary order', () => {
    expect(linkedCard(EMPTY_SESSION)).toBeNull()
    expect(linkedCard(linked(linkable(), null))).toBeNull()
  })

  it('names the request, its reason in words, its store and the pharmacist’s note', () => {
    const card = linkedCard(linked(linkable(), TMRA))
    expect(card).toEqual({
      documentNo: 'SREQ-0001234',
      reason: 'Tamara payment',
      storeCode: '1234',
      note: 'Customer paid via Tamara, collecting Mounjaro 5mg',
      href: '/oms/document/SREQ-0001234',
    })
  })

  it('holds no figure formatted as money at all', () => {
    // 🚩 Asserted in the NARROW form, over a note that carries a currency word:
    // the broad form (no "SAR" anywhere) fails on server text nobody may edit —
    // the note is the pharmacist's and the console may not sub-edit it. What can
    // be asserted is that no field of this card is a MONEY FIGURE, which is the
    // actual rule: the request is unpriced and the basket is where the order's
    // money lives.
    const card = linkedCard(
      linked(linkable(), { ...TMRA, note: 'Paid SAR 1,240.00 through Tamara on Tuesday' }),
    )!
    expect(card.note).toContain('SAR')
    for (const [field, value] of Object.entries(card)) {
      if (field === 'note') continue
      expect(String(value)).not.toMatch(/\d+[.,]\d{2}\b/)
      expect(String(value)).not.toMatch(/SAR/i)
    }
  })
})

describe('unlinkCost', () => {
  /** A linked order that actually holds the copied lines — capture 02's two. */
  const converting = (over: Partial<LinkedRequest> = {}): SessionState =>
    linked({ ...ATTACHED_SESSION, capabilities: { ...ATTACHED_SESSION.capabilities } }, { ...TMRA, ...over })

  it('is null on an order that converts nothing — there is nothing to take back', () => {
    expect(unlinkCost(EMPTY_SESSION)).toBeNull()
    expect(unlinkCost(linked(linkable(), null))).toBeNull()
  })

  it('states the three facts the undo costs', () => {
    // The lines go, the chosen store re-opens, and 🚩 the caller STAYS. The third
    // is a field rather than a sentence a surface has to remember: the two acts
    // sit next to each other in the rail, and an agent must not fear losing the
    // caller they have just attached.
    const linkedOrder: SessionState = {
      ...converting(),
      header: { ...converting().header, plant: '1234', plantSource: 'fromLinkedRequest' },
    }
    expect(unlinkCost(linkedOrder)).toEqual({
      documentNo: 'SREQ-0001234',
      lines: ATTACHED_SESSION.lines.length,
      reopensStore: true,
      storeCode: '1234',
      keepsCustomer: true,
    })
  })

  it('names the store the ORDER is on, never the one the request stamped', () => {
    // 🚩 Spec 193: *the address still wins the plant*. Once a `setAddress` has
    // re-derived the store, the request's own store is where a pharmacist stood
    // an hour ago — a sheet naming it would tell the agent they are about to lose
    // a branch this order is not at.
    const moved: SessionState = {
      ...converting(),
      header: {
        ...converting().header,
        plant: '1007',
        plantSource: 'derivedFromAddress',
        linkedRequest: { ...TMRA, storeCode: '1234' },
      },
    }
    expect(unlinkCost(moved)?.storeCode).toBe('1007')
  })

  it('claims no store where the order never had a chosen one', () => {
    // 880 (*what shipped* §3): a request that names no store copies no store and
    // `plantSource` stays `seededAtOpen` — the gate was never opened, so an undo
    // that said it re-shuts would be describing something that did not happen.
    const seeded: SessionState = {
      ...converting(),
      header: {
        ...converting().header,
        plant: '1001',
        plantSource: 'seededAtOpen',
        linkedRequest: { ...TMRA, storeCode: '' },
      },
    }
    expect(unlinkCost(seeded)).toMatchObject({ reopensStore: false, storeCode: null })
  })

  it('re-shuts the gate without naming a store, where the projection names none', () => {
    const nameless: SessionState = {
      ...converting(),
      header: { ...converting().header, plant: '', plantSource: 'fromLinkedRequest' },
    }
    expect(unlinkCost(nameless)).toMatchObject({ reopensStore: true, storeCode: null })
  })

  it('counts the lines OFF THE STATE, never off what the copy claimed', () => {
    // 🚩 The sharp one. A link whose lines were partly skipped landed fewer lines
    // than the request had — the request asked for six, four landed — and a
    // confirmation offering to remove six would be describing the request rather
    // than the basket. The only truthful count is the one on the order right now,
    // which is why this function takes the STATE and nothing else.
    const partly: SessionState = { ...converting(), lines: [ATTACHED_SESSION.lines[0]] }
    expect(unlinkCost(partly)?.lines).toBe(1)
    // And an empty basket says so rather than saying nothing: a link whose every
    // line was refused is still a link, and taking it back still re-opens the store.
    expect(unlinkCost({ ...converting(), lines: [] })?.lines).toBe(0)
  })

  it('is null once the order is no longer open', () => {
    // A submitted order's link is history — the document carries it now.
    expect(unlinkCost({ ...converting(), status: 'submitted' })).toBeNull()
  })
})

describe('submitRefusal', () => {
  const converting = linked(ATTACHED_SESSION, TMRA)
  /** §7's refusals as `core/api.ts` hands them over: business-kind and coded. */
  const refusal = (code: string, message: string) =>
    new ApiError('business', message, code === 'SUBMIT_UNAVAILABLE' ? 503 : 409, [
      { errorCode: code, internalErrorCode: '', errorMessage: '' },
    ], null)

  it('names the request and offers the one act that resolves it', () => {
    // Another agent — or the pharmacist at the till — converted or cancelled the
    // request between the link and the submit (880 §7). The order itself is
    // perfectly good: unlink, then submit.
    expect(submitRefusal('REQUEST_ALREADY_CONVERTED', converting)).toEqual({
      documentNo: 'SREQ-0001234',
      escape: 'unlink',
    })
  })

  it('does NOT reach the transient outage’s retry wording', () => {
    // 🚩 The defect this exists to prevent: without the mapping the refusal
    // arrives as `SUBMIT_UNAVAILABLE`'s catch-all and the agent retries forever
    // on an order that will never post. Asserted on the classification the
    // receipt actually reads — `retryable` is what turns the button into *Try
    // again* and the box into the attention register.
    const gone = readSubmitFailure(refusal('REQUEST_ALREADY_CONVERTED', 'That request has already been converted.'), 'x')
    expect(gone.retryable).toBe(false)
    expect(gone.kind).not.toBe('unavailable')
    expect(gone.orderOpen).toBe(true)
  })

  it('leaves the transient outage exactly where it was — the two must not swap', () => {
    const outage = readSubmitFailure(refusal('SUBMIT_UNAVAILABLE', 'Try again shortly.'), 'x')
    expect(outage.kind).toBe('unavailable')
    expect(outage.retryable).toBe(true)
    // …and it is no business of this family's: nothing about an outage is about
    // the request, so no unlink is offered beside it.
    expect(submitRefusal('SUBMIT_UNAVAILABLE', converting)).toBeNull()
  })

  it('is silent on every other outcome', () => {
    expect(submitRefusal('SUBMIT_REFUSED', converting)).toBeNull()
    expect(submitRefusal(null, converting)).toBeNull()
    expect(submitRefusal(undefined, converting)).toBeNull()
  })

  it('is silent where the order holds no link — there is nothing to name or undo', () => {
    // 🚩 Then the server's own sentence stands alone. Inventing an unlink offer
    // over an order with no `linkedRequest` would be a control that answers with
    // a refusal, on the one screen where the agent has a caller on the line.
    expect(submitRefusal('REQUEST_ALREADY_CONVERTED', ATTACHED_SESSION)).toBeNull()
  })
})

describe('skippedReport', () => {
  const result = (over: Partial<LinkRequestResult> = {}): LinkRequestResult => ({
    state: linked(linkable(), TMRA),
    copied: [{ itemNumber: '100234', quantity: 1 }],
    skipped: [],
    ...over,
  })

  it('reports a clean copy with nothing skipped', () => {
    expect(skippedReport(result())).toEqual({ made: true, copied: 1, skipped: [] })
  })

  it('reports the link as MADE even when nothing was copied', () => {
    // 880 §4: a request whose items are all out of stock is still the request
    // this order converts. `made` is read off the state's own stamp rather than
    // guessed from the counts, so the two can never disagree.
    const report = skippedReport(
      result({
        copied: [],
        skipped: [{ itemNumber: '100234', quantity: 1, reason: 'NOT_SELLABLE_AT_PLANT' }],
      }),
    )
    expect(report.made).toBe(true)
    expect(report.copied).toBe(0)
  })

  it('is NOT made where the response carries no stamp', () => {
    expect(skippedReport(result({ state: linked(linkable(), null) })).made).toBe(false)
  })

  it('separates below-ATP from refused — different rows, different offers', () => {
    const report = skippedReport(
      result({
        copied: [],
        skipped: [
          { itemNumber: '100234', quantity: 6, reason: 'BELOW_ATP', requested: 6, available: 2 },
          { itemNumber: '100999', quantity: 1, reason: 'NOT_SELLABLE_AT_PLANT' },
        ],
      }),
    )
    expect(report.skipped[0]).toEqual({
      itemNumber: '100234',
      quantity: 6,
      kind: 'belowAtp',
      // 🚩 The code rides along on BOTH kinds. 880 §4.5 puts `reason` on every
      // skipped row, and dropping it here would lose the one thing the server
      // actually said about the line — the row is WORDED from its figures, never
      // stripped of its code.
      code: 'BELOW_ATP',
      requested: 6,
      available: 2,
      addAnyway: true,
    })
    // 🚩 The refused row carries the server's own code and NO handle: a refusal is
    // not something the agent can accept their way past, and an *add anyway* on
    // one would be a control that answers with a refusal.
    expect(report.skipped[1]).toEqual({
      itemNumber: '100999',
      quantity: 1,
      kind: 'refused',
      code: 'NOT_SELLABLE_AT_PLANT',
      requested: null,
      available: null,
      addAnyway: false,
    })
  })

  it('never auto-confirms a below-ATP line — the handle is an offer, not an act', () => {
    // The rule this expresses lives in the server (`HasBelowAtp` is a fraud signal
    // and a client-set boolean proves nothing), and the client half of it is that
    // the row is a row: `addAnyway` is a handle the agent presses, and the report
    // says the line is NOT on the order.
    const report = skippedReport(
      result({
        copied: [],
        skipped: [{ itemNumber: '100234', quantity: 6, reason: 'BELOW_ATP', requested: 6, available: 2 }],
      }),
    )
    expect(report.copied).toBe(0)
    expect(report.skipped[0].addAnyway).toBe(true)
  })

  it('treats a below-ATP row with unreadable figures as refused', () => {
    // 🚩 The same rule `belowAtpAsk` holds: an acceptance the console cannot state
    // truthfully is not offered. Without both figures there is no *6 of 2* to
    // show, so the row keeps the server's code and loses the handle.
    const report = skippedReport(
      result({
        copied: [],
        skipped: [{ itemNumber: '100234', quantity: 6, reason: 'BELOW_ATP', requested: 6, available: null }],
      }),
    )
    expect(report.skipped[0].kind).toBe('refused')
    expect(report.skipped[0].addAnyway).toBe(false)
    expect(report.skipped[0].code).toBe('BELOW_ATP')
  })

  it('classifies on the FIGURES, whatever the server calls the code', () => {
    // The discriminator is what the row can SAY, not a code spelling this client
    // would then own a copy of — a below-availability outcome under a name this
    // client has never seen still has an acceptance to offer.
    const report = skippedReport(
      result({
        copied: [],
        skipped: [
          { itemNumber: '100234', quantity: 6, reason: 'BELOW_AVAILABILITY', requested: 6, available: 0 },
        ],
      }),
    )
    expect(report.skipped[0].kind).toBe('belowAtp')
    expect(report.skipped[0].available).toBe(0)
    expect(report.skipped[0].code).toBe('BELOW_AVAILABILITY')
  })

  it('treats a refusal that happens to carry figures as REFUSED, not as an offer', () => {
    // 🚩 The narrowing that makes the figure test safe: an *add anyway* is only
    // honest where there is a shortfall to accept. A refusal shipping stock numbers
    // — `available` at or above what was asked — is still a refusal, and offering
    // the acceptance path on it would be a control that answers with a refusal.
    const report = skippedReport(
      result({
        copied: [],
        skipped: [
          { itemNumber: '100999', quantity: 1, reason: 'NOT_SELLABLE_AT_PLANT', requested: 1, available: 9 },
        ],
      }),
    )
    expect(report.skipped[0].kind).toBe('refused')
    expect(report.skipped[0].addAnyway).toBe(false)
    expect(report.skipped[0].code).toBe('NOT_SELLABLE_AT_PLANT')
  })

  it('drops a row once a line for that item lands, and the report with the last one', () => {
    // 🚩 The row's claim is *this did not land*. A banner still making it over a
    // basket that now holds the line is the console arguing with the receipt — and
    // the LAST row taking the whole report with it is what stops a heading being
    // drawn over nothing.
    const report = skippedReport(
      result({
        copied: [],
        skipped: [
          { itemNumber: '100234', quantity: 6, reason: 'BELOW_ATP', requested: 6, available: 2 },
          { itemNumber: '100999', quantity: 1, reason: 'NOT_SELLABLE_AT_PLANT' },
        ],
      }),
    )
    const pruned = reportWithout(report, '100234')
    expect(pruned?.skipped.map((r) => r.itemNumber)).toEqual(['100999'])
    expect(reportWithout(pruned, '100999')).toBeNull()
    // An add of something that was never skipped leaves the report ALONE — by
    // identity, so an unrelated add cannot re-render the banner either.
    expect(reportWithout(report, '200021')).toBe(report)
    expect(reportWithout(null, '100234')).toBeNull()
  })

  it('survives a response whose two lists are absent', () => {
    // §9's posture on a field the client cannot see: nothing here, never a throw.
    const bare = { state: linked(linkable(), TMRA) } as LinkRequestResult
    expect(skippedReport(bare)).toEqual({ made: true, copied: 0, skipped: [] })
  })
})
