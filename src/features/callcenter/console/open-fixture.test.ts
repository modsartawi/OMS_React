/**
 * The shape of the console's own open-order fixture.
 *
 * 🚩 It stayed here when the latest-state guard graduated to `core/` (ticket
 * 210), because it never belonged to the guard: it asserts that the CALL-CENTRE
 * projection is whole enough for slice 0's shell to render, which is a fact
 * about `EMPTY_SESSION` and about this feature's contract, not about version
 * ordering. The guard's suite travelled; this block did not, and it is the whole
 * reason this file exists.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_SESSION } from './__fixtures__/payloads'

describe('the open fixture', () => {
  // Shape only: an empty order is what slice 0 renders, and every field the
  // shell reads must exist on it. Values are illustrative and asserted nowhere.
  it('is a whole SessionState the console can render', () => {
    expect(EMPTY_SESSION.transactionId).toBeTruthy()
    expect(typeof EMPTY_SESSION.version).toBe('number')
    expect(EMPTY_SESSION.status).toBe('open')
    expect(EMPTY_SESSION.lines).toEqual([])
    expect(EMPTY_SESSION.totals.deliveryFee).toBeDefined()
    expect(EMPTY_SESSION.capabilities.submitBlockers.length).toBeGreaterThan(0)
    expect(EMPTY_SESSION.capabilities.canSubmit).toBe(false)
  })

  it('carries no client-computable savings figure anywhere', () => {
    // `wouldSave` does not exist and will not be added (§2.1). Asserted on the
    // wire shape so a server that grew one fails a client test loudly.
    expect(JSON.stringify(EMPTY_SESSION)).not.toContain('wouldSave')
  })
})
