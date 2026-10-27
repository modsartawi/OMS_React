/**
 * A list of mobiles to load into a group (oms ticket 633; door BackOffice 3175
 * `POST LoyGroupWeb/Groups/Members/Bulk`) — pure.
 *
 * The maintainer pastes mobiles (one per line, or comma-separated), or picks a `.csv` (its first column)
 * or an `.xlsx` (the first column of its first sheet, read by `@/core/util/xlsx-read`). This one parser
 * turns any of them into the `lines` the request carries. It decides the SHAPE only — split, trim, drop
 * blanks, skip a header, count against the cap — and never judges a mobile: a line that is not one, or
 * a repeat, goes up as typed and the server answers it (`notAMobile`, `duplicateInBatch`).
 *
 * Decision D4 keeps it here rather than in `@/core/import/material-list`: one consumer, and its rules
 * differ — repeats are NOT collapsed (the server counts them), and an Arabic-Indic digit is a digit, so
 * `٠٥٠١٢٣٤٥٦٧` is a mobile-looking first line, not a header.
 */

/** The door's ceiling on one load: more is refused as a whole, so it is refused HERE, before sending. */
export const LOY_GROUP_BULK_MAX = 50000

export type MobileSource =
  | { kind: 'paste'; text: string }
  | { kind: 'csv'; text: string }
  | { kind: 'sheet'; rows: readonly (readonly string[])[] }

export interface MobileLines {
  /** Every non-blank line, trimmed, in order, repeats kept. NEVER truncated to the cap. */
  lines: string[]
  /** The first line, skipped as a header because it does not look like a mobile — else `null`. */
  header: string | null
  /** How many lines over the cap the list is; 0 when it can be sent. */
  overBy: number
}

/** A first line with no digit at all (Latin, Arabic-Indic or Eastern Arabic-Indic) is a header. */
const isHeader = (value: string) => !/[0-9٠-٩۰-۹]/.test(value)

const BOM = /^﻿/
const LINE_BREAK = /\r\n|\n|\r/

/** A CSV line's first field: a quoted field (`""` an escaped quote) up to its closing quote, else up to the first separator. */
function firstField(line: string): string {
  const text = line.trimStart()
  if (text.startsWith('"')) {
    let out = ''
    for (let i = 1; i < text.length; i++) {
      if (text[i] !== '"') out += text[i]
      else if (text[i + 1] === '"') {
        out += '"'
        i++
      } else break
    }
    return out
  }
  return text.split(/[,;\t]/, 1)[0]
}

function values(source: MobileSource): string[] {
  switch (source.kind) {
    case 'paste':
      return source.text.replace(BOM, '').split(LINE_BREAK).flatMap((l) => l.split(','))
    case 'csv':
      return source.text.replace(BOM, '').split(LINE_BREAK).map(firstField)
    case 'sheet':
      return source.rows.map((row) => row[0] ?? '')
  }
}

export function mobileLines(source: MobileSource, cap: number = LOY_GROUP_BULK_MAX): MobileLines {
  const lines = values(source)
    .map((v) => v.trim())
    .filter((v) => v !== '')
  const header = lines.length > 0 && isHeader(lines[0]) ? lines.shift()! : null
  return { lines, header, overBy: Math.max(0, lines.length - cap) }
}
