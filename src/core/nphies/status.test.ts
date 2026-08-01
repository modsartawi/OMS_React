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
import type { EligibilityCheckResponse } from '@/core/models/nphies'
import {
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
