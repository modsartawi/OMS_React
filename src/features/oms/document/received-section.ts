/**
 * Document Details' Insurance section, **Received** (ticket 788, BackOffice 3392 / spec 3389 user
 * stories 64–66): the intake body the order arrived with — formatted, collapsible JSON with a copy —
 * or, for an order that landed before bodies were kept, "not kept for orders before <date>".
 *
 * Pure: no React, no network, no i18n.
 *
 * 🚩 The body is evidence, held byte for byte (3392). Copy takes the verbatim body; the tree only
 * lays it out. Every scalar keeps its own text (`jsonTree`): `1.10` never becomes `1.1`, a 20-digit
 * number keeps its digits, an escape stays an escape — the same rule as `@/core/util/raw-json`.
 */
import { formatDateTime } from '@/core/util/date-format'
import { rawView } from '@/core/util/raw-json'
import type { IntakeBody } from '@/core/models/order-insurance'

/** A JSON value as written: containers hold their parts, a scalar holds its exact text. */
export type JsonNode =
  | { type: 'object'; entries: { key: string; value: JsonNode }[] }
  | { type: 'array'; items: JsonNode[] }
  | { type: 'scalar'; raw: string }

export type ReceivedView =
  | {
      kind: 'kept'
      /** The tree to draw, or `null` when the body is not JSON (then `text` is drawn as received). */
      tree: JsonNode | null
      /** The body for a plain view: re-indented when it is JSON, else as received. */
      text: string
      /** What Copy puts on the clipboard: the body byte for byte. */
      copyText: string
      contentType: string
      receivedAt: string
      receivedBy: string
    }
  | {
      kind: 'notKept'
      /** `insurance.received.notKeptBefore` with `since`, or `insurance.received.notKept` with no date. */
      textKey: string
      since: string | null
    }

/** The Received part's view of the read's intake. */
export function receivedView(intake: IntakeBody): ReceivedView {
  if (!intake.kept) {
    const since = intake.keptSince && intake.keptSince.trim() !== '' ? intake.keptSince : null
    return { kind: 'notKept', textKey: since ? 'insurance.received.notKeptBefore' : 'insurance.received.notKept', since }
  }
  const body = intake.body ?? ''
  return {
    kind: 'kept',
    tree: jsonTree(body),
    text: rawView(body).text,
    copyText: body,
    contentType: intake.contentType ?? '',
    receivedAt: formatDateTime(intake.receivedAt) || intake.receivedAt || '',
    receivedBy: intake.receivedBy ?? '',
  }
}

/** The body as a tree whose scalars keep their exact text; `null` when it is not valid JSON. */
export function jsonTree(text: string): JsonNode | null {
  try {
    JSON.parse(text)
  } catch {
    return null
  }
  let i = 0
  const ws = () => {
    while (i < text.length && /\s/.test(text[i])) i++
  }
  const string = (): string => {
    const start = i
    i++
    while (text[i] !== '"') i += text[i] === '\\' ? 2 : 1
    i++
    return text.slice(start, i)
  }
  const value = (): JsonNode => {
    ws()
    const c = text[i]
    if (c === '{') {
      i++
      const entries: { key: string; value: JsonNode }[] = []
      ws()
      if (text[i] === '}') {
        i++
        return { type: 'object', entries }
      }
      for (;;) {
        ws()
        const key = string()
        ws()
        i++ // ':'
        entries.push({ key, value: value() })
        ws()
        if (text[i++] === '}') return { type: 'object', entries }
      }
    }
    if (c === '[') {
      i++
      const items: JsonNode[] = []
      ws()
      if (text[i] === ']') {
        i++
        return { type: 'array', items }
      }
      for (;;) {
        items.push(value())
        ws()
        if (text[i++] === ']') return { type: 'array', items }
      }
    }
    if (c === '"') return { type: 'scalar', raw: string() }
    const start = i
    while (i < text.length && !/[\s,\]}]/.test(text[i])) i++
    return { type: 'scalar', raw: text.slice(start, i) }
  }
  return value()
}
