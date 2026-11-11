/**
 * Codes pasted into a list (oms 618 walk): one per line, or separated by commas, semicolons, spaces or tabs, as a
 * column copied out of Excel arrives. Each code is kept once, in the order pasted; a code already on the list is
 * counted, not added again; a token that is not a code of its kind is rejected and shown back.
 */
export type PasteKind = 'articles' | 'categories'

/** An item is its SAP article number (digits); a category code is letters, digits, `.` `_` `-`. */
const CODE: Record<PasteKind, RegExp> = {
  articles: /^\d{1,18}$/,
  categories: /^[A-Za-z0-9._-]{1,40}$/,
}

export interface PasteRead {
  /** New codes, in pasted order. */
  added: string[]
  /** Codes the list already holds, or pasted twice. */
  repeated: number
  /** Tokens that are not a code of the kind. */
  rejected: string[]
}

export function readPaste(text: string, kind: PasteKind, held: readonly string[]): PasteRead {
  const seen = new Set(held)
  const added: string[] = []
  const rejected: string[] = []
  let repeated = 0
  for (const token of text.split(/[\s,;]+/)) {
    if (!token) continue
    if (!CODE[kind].test(token)) rejected.push(token)
    else if (seen.has(token)) repeated++
    else {
      seen.add(token)
      added.push(token)
    }
  }
  return { added, repeated, rejected }
}
