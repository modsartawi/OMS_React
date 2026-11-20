/**
 * The GS1 element string a phone reads off a serialised pack's DataMatrix (spec 4063, ticket 928), parsed the way the
 * 3709 prototype parsed it: `(01)` GTIN-14, `(17)` expiry, `(10)` batch and `(21)` serial. Fixed-length AIs read their
 * length; `(10)` and `(21)` run to the group separator (`<GS>`, 0x1D) or to the end.
 *
 * A reader hands the same code back in three spellings, and all three parse alike:
 * - **raw**: `0106281234567890 17270131 10AB12 <GS> 21XYZ` (no spaces), as a built-in `BarcodeDetector` answers;
 * - **`]d2`-prefixed**: the AIM symbology identifier a keyboard-wedge scanner puts in front of a GS1 DataMatrix;
 * - **bracketed**: `(01)06281234567890(17)270131(10)AB12(21)XYZ`, as a human types it off the pack's text.
 *
 * A read is taken as a GS1 element string only when something marks it as one: the reader says it was a DataMatrix
 * (`format`), it carries the `]d2` prefix, it is bracketed, or it holds a `<GS>`. A bare read with none of these is GS1
 * only when it opens with a whole AI 01 (`01` and fourteen digits): a UPC-A `016000275287`, an EAN-13 `0123456789012`
 * or a typed item number merely opens with `01`, and parsing it would send a truncated code. Anything else, and any
 * marked read that does not open with an SSCC/GTIN AI (`00`, `01`, `02`), is `null`: the value goes to the server as
 * it was read.
 */

const GS = '\x1d'

/** The fixed-length AIs this reader knows, by their data length. */
const FIXED: Record<string, number> = { '00': 18, '01': 14, '02': 14, '11': 6, '13': 6, '15': 6, '17': 6, '20': 2 }

/** The variable-length AIs this reader knows: they run to `<GS>` or to the end. */
const VARIABLE = new Set(['10', '21'])

export interface Gs1 {
  /** AI 01 (or 02): the trade item's GTIN-14. */
  gtin: string | null
  /** AI 17, `YYMMDD` as printed. Never turned into a date here: the server owns what an expiry means. */
  expiry: string | null
  /** AI 10. */
  batch: string | null
  /** AI 21. */
  serial: string | null
  /** Every AI read, by its code. An AI this reader does not know ends the read under `<ai>?`, kept whole. */
  ais: Record<string, string>
}

export function parseGs1(raw: string, format?: string | null): Gs1 | null {
  const marked = format === 'data_matrix' || /^(\]d2|\(\d\d\))/.test(raw) || raw.includes(GS)
  let s = raw.replace(/^\]d2/, '').replace(/^\x1d/, '')
  if (/^\(\d\d\)/.test(s)) s = s.replace(/\((\d\d)\)/g, `${GS}$1`).replace(/^\x1d/, '')
  if (marked ? !/^(00|01|02)\d/.test(s) : !/^01\d{14}/.test(s)) return null

  const ais: Record<string, string> = {}
  while (s.length) {
    const ai = s.slice(0, 2)
    s = s.slice(2)
    const fixed = FIXED[ai]
    if (fixed) {
      ais[ai] = s.slice(0, fixed)
      s = s.slice(fixed)
      if (s[0] === GS) s = s.slice(1)
    } else if (VARIABLE.has(ai)) {
      const end = s.indexOf(GS)
      ais[ai] = end < 0 ? s : s.slice(0, end)
      s = end < 0 ? '' : s.slice(end + 1)
    } else {
      ais[`${ai}?`] = s
      break
    }
  }

  return {
    gtin: ais['01'] ?? ais['02'] ?? null,
    expiry: ais['17'] ?? null,
    batch: ais['10'] ?? null,
    serial: ais['21'] ?? null,
    ais,
  }
}

/**
 * The code the phone sends on add item for one read: a GS1 element string sends its GTIN (as the EAN-13 a pack
 * barcode carries when the GTIN-14 opens with the `0` indicator, since that is the barcode the item master holds),
 * and the serial beside it; anything else is sent exactly as read. `format` is the camera reader's (`data_matrix`),
 * absent for a typed or wedge read. The server resolves the code to its item (a pack
 * barcode or an item number) and prices it: the phone decides nothing about the item.
 */
export function addItemCode(value: string, format?: string | null): { code: string; serial: string | null } {
  const gs1 = parseGs1(value, format)
  if (!gs1?.gtin) return { code: value.trim(), serial: null }
  const code = gs1.gtin.length === 14 && gs1.gtin.startsWith('0') ? gs1.gtin.slice(1) : gs1.gtin
  return { code, serial: gs1.serial }
}
