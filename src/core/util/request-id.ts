/**
 * Mint a client-side idempotency key.
 *
 * ⚠ **Not `crypto.randomUUID()` on its own.** That method exists only in a
 * **secure context** — it is `undefined` over plain `http`, which is exactly how
 * this app is served from IIS on the internal network. Two screens already
 * sidestep it for that reason (`SimItemsEntry`, `SimManualConditions`), but
 * those only need a React key: here the value is an **idempotency key**, so it
 * has to be genuinely unlikely to repeat, not merely unique on one screen.
 *
 * `crypto.getRandomValues` is **not** restricted to secure contexts, so the
 * fallback keeps real entropy and only the formatting is hand-rolled — RFC 4122
 * version 4, the same shape `randomUUID` returns. The last resort exists so a
 * key is always minted: a missing key would make every submit a 400, which is a
 * worse failure than a slightly weaker random.
 */
export function mintRequestId(): string {
  const web = globalThis.crypto
  if (typeof web?.randomUUID === 'function') return web.randomUUID()

  const bytes = new Uint8Array(16)
  if (typeof web?.getRandomValues === 'function') {
    web.getRandomValues(bytes)
  } else {
    for (let i = 0; i < bytes.length; i += 1) bytes[i] = Math.floor(Math.random() * 256)
  }
  // Version 4, variant 1 — the two fixed nibbles a v4 UUID carries.
  bytes[6] = (bytes[6] & 0x0f) | 0x40
  bytes[8] = (bytes[8] & 0x3f) | 0x80
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`
}
