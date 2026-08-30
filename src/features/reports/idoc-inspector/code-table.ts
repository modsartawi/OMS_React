/**
 * Reading a **published table** by the code a server sent.
 *
 * 🚩 **A bare index into an object literal is not a lookup — it is a lookup plus
 * the whole of `Object.prototype`.** A server answering `constructor`,
 * `toString`, `valueOf` or `hasOwnProperty` resolves to an inherited *function*,
 * which is truthy, survives a `!entry` test and a `?? fallback`, and is then read
 * for fields it does not have or handed to `t()` as a translation key. What the
 * consultant sees is a screen claiming to recognise a code it has never heard
 * of — no unknown-verdict banner, no empty state, `undefined` where a severity
 * should be, and a raw key on screen.
 *
 * Improbable inputs, and this repo already treats them as a real hazard:
 * `member-commands.ts` and `profile-form.ts` both guard with `Object.hasOwn` and
 * name this exact case. This module is that guard, once, for the five tables
 * this feature publishes — the verdicts, the attention banners, the export
 * badges and the download codes — rather than the same comment written five
 * times and forgotten on the sixth.
 *
 * `null` for a code the table does not publish, never `undefined`: every caller
 * here already distinguishes *unrecognised* from *absent*, and one spelling of
 * "not in the table" keeps that distinction the caller's to make.
 */
export function published<T>(table: Record<string, T>, code: string): T | null {
  return Object.hasOwn(table, code) ? table[code] : null
}
