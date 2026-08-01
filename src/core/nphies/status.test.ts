/**
 * `verdictIsBlankUntilTheRequestIsComplete` and
 * `siteEligibilityQualifiesTheVerdictInline` (ticket 211) — the two axes every
 * act on the Nphies screens carries, proved at their edge.
 *
 * Raw response in, axes out. Nothing here knows how a badge is painted or which
 * hook fired (spec 209's testing ruling): the assertions are about what an agent
 * is told, expressed as the derivation's own output.
 */
import { describe, expect, it } from 'vitest'
import type { AuthListRow, EligibilityCheckResponse } from '@/core/models/nphies'
import {
  AUTH_VERDICTS,
  REQUEST_STATES,
  authRowMarkers,
  authVerdictSeverity,
  deriveAuthAxes,
  deriveEligibilityAxes,
  deriveStoredEligibilityAxes,
  eligibilityVerdictSeverity,
  requestSeverity,
  showsFailureMessage,
  verdictCellKeys,
} from './status'

/** A check the exchange answered, eligible, in network — the happy fixture every
 *  case below varies ONE field of, so the field under test is the only variable. */
const ELIGIBLE: Pick<
  EligibilityCheckResponse,
  'outcome' | 'success' | 'inforce' | 'coverage' | 'isEligible' | 'siteEligibility' | 'errorMessage'
> = {
  outcome: 'complete',
  success: true,
  inforce: true,
  coverage: true,
  isEligible: true,
  siteEligibility: 'eligible',
  errorMessage: '',
}

const check = (over: Partial<typeof ELIGIBLE> = {}) =>
  ({ ...ELIGIBLE, ...over }) as EligibilityCheckResponse

describe('the Request axis', () => {
  it('reads queued as Pending — the exchange has not answered yet', () => {
    expect(deriveEligibilityAxes(check({ outcome: 'queued' })).request).toBe('pending')
  })

  it('reads error as Failed — we could not ask', () => {
    expect(deriveEligibilityAxes(check({ outcome: 'error', success: false })).request).toBe('failed')
  })

  it('reads complete as Complete', () => {
    expect(deriveEligibilityAxes(check()).request).toBe('complete')
  })

  it('reads partial as Complete — a partial answer is still an answer', () => {
    expect(deriveEligibilityAxes(check({ outcome: 'partial' })).request).toBe('complete')
  })

  it('falls back to Pending when the outcome is absent and nothing failed', () => {
    // 🚩 Reachable, and it must not read as Complete. `FillResponse` sets
    // `Outcome` only inside `if (eligibilityResponse != null)`
    // (`EligibilityService.cs:667-670`) while `eResponse.Success = true` is
    // unconditional after it returns (`:277`) — so a bundle carrying no
    // `CoverageEligibilityResponse` arrives here saying success with no outcome,
    // and a verdict published for it would be one the payer never gave.
    expect(deriveEligibilityAxes(check({ outcome: '', success: true })).request).toBe('pending')
    expect(deriveEligibilityAxes(check({ outcome: '', success: true })).verdict).toBeNull()
  })

  it('🚩 reads success:false as Failed even when the outcome says complete', () => {
    // The trap the ordering exists for: `EligibilityService` fills `Outcome` at
    // the top of `FillResponse` (:670) and the exchange's own validation errors
    // throw a few lines later (:682), where the catch sets `Success = false`
    // (:293). Reading the outcome first would render a refusal as a verdict.
    const axes = deriveEligibilityAxes(
      check({ outcome: 'complete', success: false, errorMessage: 'BV-00123: invalid member id' }),
    )
    expect(axes.request).toBe('failed')
    expect(axes.verdict).toBeNull()
  })

  it('is case- and whitespace-insensitive about the exchange’s spelling', () => {
    expect(deriveEligibilityAxes(check({ outcome: ' Complete ' })).request).toBe('complete')
  })
})

describe('verdictIsBlankUntilTheRequestIsComplete', () => {
  it('reports no verdict while the request is Pending', () => {
    const axes = deriveEligibilityAxes(check({ outcome: 'queued' }))
    expect(axes.verdict).toBeNull()
    expect(verdictCellKeys(axes)).toEqual([])
  })

  it('reports no verdict on a Failed request — even one carrying eligibility flags', () => {
    // 🚩 The trap: the service stores `IsEligible` on the row whatever happened.
    // A request that never reached the payer has no verdict to report, and the
    // blank cell is the honest rendering of that (contract §5).
    const axes = deriveEligibilityAxes(check({ outcome: 'error', success: false, isEligible: true }))
    expect(axes.request).toBe('failed')
    expect(axes.verdict).toBeNull()
    expect(axes.siteQualifier).toBeNull()
  })

  it('reports the mapped verdict once the request is Complete', () => {
    expect(deriveEligibilityAxes(check()).verdict).toBe('eligible')
    expect(deriveEligibilityAxes(check({ isEligible: false, inforce: false })).verdict).toBe(
      'notInForce',
    )
    expect(deriveEligibilityAxes(check({ isEligible: false, coverage: false })).verdict).toBe(
      'notEligible',
    )
  })
})

describe('siteEligibilityQualifiesTheVerdictInline', () => {
  it('renders an out-of-network eligible result as ONE qualified verdict', () => {
    const axes = deriveEligibilityAxes(check({ siteEligibility: 'outside-network' }))
    expect(axes.verdict).toBe('eligible')
    expect(axes.siteQualifier).toBe('outsideNetwork')
    // One cell, two words — not a verdict here and a site fact discovered later.
    expect(verdictCellKeys(axes)).toEqual(['verdict.eligible', 'site.outsideNetwork'])
  })

  it('adds nothing when the site is plainly eligible', () => {
    expect(deriveEligibilityAxes(check()).siteQualifier).toBeNull()
    expect(verdictCellKeys(deriveEligibilityAxes(check()))).toEqual(['verdict.eligible'])
  })

  it('carries not-direct-billing the same way', () => {
    const axes = deriveEligibilityAxes(check({ siteEligibility: 'not-direct-billing' }))
    expect(verdictCellKeys(axes)).toEqual(['verdict.eligible', 'site.notDirectBilling'])
  })

  it('normalises the exchange’s spelling of the code', () => {
    expect(deriveEligibilityAxes(check({ siteEligibility: 'OutsideNetwork' })).siteQualifier).toBe(
      'outsideNetwork',
    )
  })

  it('ignores a code it does not know rather than inventing a qualifier', () => {
    expect(deriveEligibilityAxes(check({ siteEligibility: 'not-a-code' })).siteQualifier).toBeNull()
  })
})

describe('deriveStoredEligibilityAxes — a list row carries less than an answer did', () => {
  it('🚩 reads success-with-no-outcome as Complete, because no row has an outcome', () => {
    // Ticket 212. `NEligibility` has no `Outcome` column
    // (`Data/Eligibility/NEligibility.cs`): the value is filled from the live
    // bundle at `EligibilityService.cs:670` and never persisted, so EVERY row on
    // the list arrives without it. The live reading (`pending`) would report the
    // whole estate as still waiting, forever.
    const axes = deriveStoredEligibilityAxes(check({ outcome: '', success: true }))
    expect(axes.request).toBe('complete')
    expect(axes.verdict).toBe('eligible')
  })

  it('reads a row that threw as Failed, with the verdict still blank', () => {
    // The catch never writes `nEligibility.Success` (`:293` sets the response
    // only), so the row keeps its default `false`. 🚩 And `IsEligible` is stored
    // whatever happened, so the blank verdict has to survive it.
    const axes = deriveStoredEligibilityAxes(check({ outcome: '', success: false, isEligible: true }))
    expect(axes.request).toBe('failed')
    expect(axes.verdict).toBeNull()
    expect(axes.siteQualifier).toBeNull()
  })

  it('qualifies a stored verdict inline exactly as a live one does', () => {
    const axes = deriveStoredEligibilityAxes(
      check({ outcome: '', success: true, siteEligibility: 'outside-network' }),
    )
    expect(verdictCellKeys(axes)).toEqual(['verdict.eligible', 'site.outsideNetwork'])
  })

  it('defers to an outcome if the re-modelled row ever projects one', () => {
    expect(deriveStoredEligibilityAxes(check({ outcome: 'queued' })).request).toBe('pending')
    expect(deriveStoredEligibilityAxes(check({ outcome: 'queued' })).verdict).toBeNull()
  })

  it('🚩 still lets success:false outrank an outcome that says complete', () => {
    const axes = deriveStoredEligibilityAxes(check({ outcome: 'complete', success: false }))
    expect(axes.request).toBe('failed')
    expect(axes.verdict).toBeNull()
  })
})

describe('the badge severities', () => {
  it('paints a pending request as motion, not as a problem', () => {
    // The service's own worker polls the exchange every 15 s, so waiting IS the
    // normal path to a verdict.
    expect(requestSeverity('pending')).toBe('go')
    expect(requestSeverity('complete')).toBe('ok')
    expect(requestSeverity('failed')).toBe('bad')
    expect(requestSeverity('cancelled')).toBe('mute')
  })

  it('paints a not-in-force policy as something to act on, not as a refusal', () => {
    expect(eligibilityVerdictSeverity('eligible')).toBe('ok')
    expect(eligibilityVerdictSeverity('notInForce')).toBe('warn')
    expect(eligibilityVerdictSeverity('notEligible')).toBe('bad')
  })

  it('does not let the site qualifier change what the payer said', () => {
    const plain = deriveEligibilityAxes(check())
    const outside = deriveEligibilityAxes(check({ siteEligibility: 'outside-network' }))
    expect(eligibilityVerdictSeverity(outside.verdict!)).toBe(
      eligibilityVerdictSeverity(plain.verdict!),
    )
  })
})

// ---------------------------------------------------------------------------
// Ticket 214 — the authorization side of the SAME module.
// ---------------------------------------------------------------------------

/** A completed, approved authorization — the happy fixture every case below
 *  varies ONE field of, so the field under test is the only variable. */
const APPROVED: Pick<
  AuthListRow,
  | 'cancelled'
  | 'error'
  | 'queued'
  | 'claimProcessingCodes'
  | 'adjudicationOutcome'
  | 'needComm'
  | 'isDispensed'
> = {
  cancelled: false,
  error: false,
  queued: false,
  claimProcessingCodes: 'Complete',
  adjudicationOutcome: 'approved',
  needComm: false,
  isDispensed: false,
}

const auth = (over: Partial<typeof APPROVED> = {}) => ({ ...APPROVED, ...over }) as AuthListRow

describe('the Request axis on an authorization', () => {
  it('reads a queued request as Pending — the exchange has not answered yet', () => {
    expect(deriveAuthAxes(auth({ queued: true, claimProcessingCodes: 'Queued' })).request).toBe(
      'pending',
    )
  })

  it('🚩 reads an errored request as Failed — refused BEFORE the payer saw it', () => {
    // §5: `Failed` has two sources — NPHIES's own validation and the service's
    // local guards — and either way it is a form state the agent fixes in place,
    // never a payer verdict. `Complete` + `Rejected` is the opposite.
    const axes = deriveAuthAxes(auth({ error: true, claimProcessingCodes: 'Error' }))
    expect(axes.request).toBe('failed')
    expect(axes.verdict).toBeNull()
  })

  it('reads a complete request as Complete, and a partial one as Complete too', () => {
    expect(deriveAuthAxes(auth()).request).toBe('complete')
    // A partial answer IS an answer — `Partly approved` is a Verdict, not a
    // half-arrived request. Reading it as Pending would offer a status check for
    // a payer that has already replied.
    expect(
      deriveAuthAxes(auth({ claimProcessingCodes: 'Partial', adjudicationOutcome: 'partial' }))
        .request,
    ).toBe('complete')
  })

  it('🚩 lets Cancelled outrank a stored Complete', () => {
    // A cancel happens AFTER an answer (`CancellationService` refuses anything
    // else), so a cancelled authorization still carries
    // `ClaimProcessingCodes = "Complete"` and an approval. Reading the outcome
    // first would show a withdrawn request as live — and 215 offers Cancel on
    // exactly the rows this branch removes.
    const axes = deriveAuthAxes(auth({ cancelled: true }))
    expect(axes.request).toBe('cancelled')
    expect(axes.verdict).toBeNull()
  })

  it('falls back to Pending when nothing has come back yet', () => {
    // `ProcessAddAuthRequest.cs:182-184` has the three booleans commented out, so
    // a just-submitted row can carry no outcome at all. In flight, never failed
    // (law 6's posture, one act earlier).
    expect(deriveAuthAxes(auth({ claimProcessingCodes: '' })).request).toBe('pending')
    expect(deriveAuthAxes(auth({ claimProcessingCodes: '' })).verdict).toBeNull()
  })

  it('is case- and whitespace-insensitive about the exchange’s spelling', () => {
    expect(deriveAuthAxes(auth({ claimProcessingCodes: ' complete ' })).request).toBe('complete')
  })
})

describe('the Verdict axis on an authorization', () => {
  it('maps the four adjudication outcomes §5 names', () => {
    expect(deriveAuthAxes(auth({ adjudicationOutcome: 'approved' })).verdict).toBe('approved')
    expect(deriveAuthAxes(auth({ adjudicationOutcome: 'partial' })).verdict).toBe('partlyApproved')
    expect(deriveAuthAxes(auth({ adjudicationOutcome: 'rejected' })).verdict).toBe('rejected')
    expect(deriveAuthAxes(auth({ adjudicationOutcome: 'not-required' })).verdict).toBe(
      'noApprovalNeeded',
    )
  })

  it('is blank until the Request is Complete, whatever the row carries', () => {
    // 🚩 The row stores `AdjudicationOutcome` whatever happened to the request, so
    // the blank has to survive it — a request that never reached the payer has no
    // verdict to report.
    for (const over of [
      { queued: true },
      { error: true },
      { cancelled: true },
      { claimProcessingCodes: '' },
    ]) {
      expect(deriveAuthAxes(auth({ ...over, adjudicationOutcome: 'approved' })).verdict).toBeNull()
    }
  })

  it('🚩 reads an unknown outcome as blank rather than coercing it to a nearby value', () => {
    // Inventing `Approved` from a code we do not know is the one error on this
    // screen that costs money.
    expect(deriveAuthAxes(auth({ adjudicationOutcome: 'BV-00999' })).verdict).toBeNull()
  })

  it('paints partly approved as something to look at, not as a refusal', () => {
    expect(authVerdictSeverity('approved')).toBe('ok')
    expect(authVerdictSeverity('partlyApproved')).toBe('warn')
    expect(authVerdictSeverity('rejected')).toBe('bad')
    expect(authVerdictSeverity('noApprovalNeeded')).toBe('mute')
  })
})

describe('aPayerQueryShowsOnACompletedRow', () => {
  it('🚩 renders on a row that already has BOTH a Request state and a Verdict', () => {
    // Which is exactly why it cannot be a value of either axis: the payer raises
    // it asynchronously, after the answer. It is required rather than decorative
    // — answering one is out of v1, so the authorization stalls on the web and
    // the agent has to be able to see that the row now needs the till.
    const row = auth({ needComm: true })
    const axes = deriveAuthAxes(row)
    expect(axes.request).toBe('complete')
    expect(axes.verdict).toBe('approved')
    expect(authRowMarkers(row).payerQuery).toBe(true)
  })

  it('renders independently of the axes on every Request state', () => {
    for (const over of [{ queued: true }, { error: true }, { cancelled: true }, {}]) {
      expect(authRowMarkers(auth({ ...over, needComm: true })).payerQuery).toBe(true)
    }
  })

  it('does not appear on a row the payer has asked nothing about', () => {
    expect(authRowMarkers(auth()).payerQuery).toBe(false)
  })

  it('carries the dispensed marker the same way — a fact from after the verdict', () => {
    const row = auth({ isDispensed: true })
    expect(authRowMarkers(row).dispensed).toBe(true)
    expect(deriveAuthAxes(row).verdict).toBe('approved')
  })

  it('🚩 offers no "ready to dispense" of any kind', () => {
    // The predicate is authoritative in the service's `Dispense()` and its
    // `HasFollowUp` clause is absent from `AuthForListDto` (§5), so a browser copy
    // could only lie on some rows. The reader infers it: Complete + a good verdict
    // + no dispensed marker.
    expect(Object.keys(authRowMarkers(auth())).sort()).toEqual(['dispensed', 'payerQuery'])
  })
})

describe('theStatusModuleIsSharedNotCopied', () => {
  it('derives both lists’ Request axis from ONE vocabulary and one severity map', () => {
    // The type is the proof: `deriveAuthAxes` and `deriveEligibilityAxes` return
    // the same `RequestState`, and the same `requestSeverity` paints both. A
    // second module would let an authorization's "Pending" mean something other
    // than an eligibility's.
    const eligible = deriveEligibilityAxes(check({ outcome: 'queued' })).request
    const authorized = deriveAuthAxes(auth({ queued: true })).request
    expect(eligible).toBe(authorized)
    expect(requestSeverity(eligible)).toBe(requestSeverity(authorized))
    expect(REQUEST_STATES).toContain(authorized)
  })

  it('applies §5’s blank-until-Complete rule identically on both sides', () => {
    expect(deriveEligibilityAxes(check({ outcome: 'queued' })).verdict).toBeNull()
    expect(deriveAuthAxes(auth({ queued: true })).verdict).toBeNull()
  })

  it('reads the dual-meaning message field through the same one predicate', () => {
    // `ErrorMessageShort` (auth) and `ErrorMessage` (eligibility) are the same
    // trap in two DTOs, and one function decides when either may be rendered.
    expect(showsFailureMessage(deriveAuthAxes(auth({ error: true })).request)).toBe(true)
    expect(showsFailureMessage(deriveAuthAxes(auth()).request)).toBe(false)
    expect(showsFailureMessage(deriveEligibilityAxes(check()).request)).toBe(false)
  })

  it('differs in exactly one thing: the Verdict value set', () => {
    // Four values against three, and no member in common — which is why the
    // verdicts are two exported vocabularies over one derivation shape rather
    // than one union nobody could filter by.
    expect(AUTH_VERDICTS).toHaveLength(4)
    expect(AUTH_VERDICTS.some((v) => (['eligible', 'notInForce', 'notEligible'] as string[]).includes(v))).toBe(
      false,
    )
  })
})

describe('the dual-meaning message field', () => {
  it('is readable on Failed and Pending, under a failure label', () => {
    expect(showsFailureMessage('failed')).toBe(true)
    expect(showsFailureMessage('pending')).toBe(true)
  })

  it('is NEVER readable on Complete', () => {
    // §5's trap: on a completed act the same field carries the decoded
    // adjudication display, and a neutral "Message" label would re-conflate
    // exactly what the two axes exist to keep apart.
    expect(showsFailureMessage('complete')).toBe(false)
  })
})
