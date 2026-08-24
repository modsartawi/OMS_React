import { afterEach, describe, expect, it } from 'vitest'
import { mintRequestId } from './request-id'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/

const real = globalThis.crypto

afterEach(() => {
  Object.defineProperty(globalThis, 'crypto', { value: real, configurable: true })
})

/** Swap the platform's crypto for the shape a given browsing context offers. */
function withCrypto(value: unknown) {
  Object.defineProperty(globalThis, 'crypto', { value, configurable: true })
}

describe('mintRequestId', () => {
  it('uses the platform method when there is one', () => {
    expect(mintRequestId()).toMatch(UUID)
  })

  it('still mints a v4 UUID where randomUUID does not exist', () => {
    // ⚠ The real case, not a hypothetical: `randomUUID` is undefined outside a
    // SECURE context, and this app is served over plain http from IIS. Without
    // the fallback the dialog throws as it opens and no key is ever minted.
    withCrypto({ getRandomValues: real.getRandomValues.bind(real) })
    const id = mintRequestId()
    expect(id).toMatch(UUID)
    expect(id).not.toBe(mintRequestId())
  })

  it('mints one even with no web crypto at all — a missing key is a 400 on every submit', () => {
    withCrypto(undefined)
    const ids = new Set(Array.from({ length: 200 }, () => mintRequestId()))
    expect([...ids].every((id) => UUID.test(id))).toBe(true)
    expect(ids.size).toBe(200)
  })
})
