/**
 * Rail composition (spec 083 D-3): `(status, t) → RailEntry[]`.
 *
 * > A pill renders for **every described status that carries a value**. Blank
 * > and `null` produce no pill at all — not a muted one, not an em dash.
 *
 * `lastAction` anchors the rail: always first, never a pill, never coloured
 * (`sev: null`). It reports; it does not judge — and because it is populated on
 * 5/5 of the captured corpus it is what keeps the rail from ever being empty.
 *
 * Pure, and `t` is passed in rather than imported for the same reason
 * `fields.ts` does it: the labels must come from i18n, but reaching for the
 * global `i18n.t` here would bind the rule to module state.
 */
import type { SdDocumentHeaderStatusModel } from '@/core/models/sd-document'
import type { Severity } from '@/core/ui/severity'
import { RAIL_STATUSES, isCodeEcho, statusSeverity, type RailStatusKey } from './status-severity'

/** One thing on the rail: the `lastAction` anchor, or one status pill. */
export interface RailEntry {
  /** The payload field this entry reports. */
  key: 'lastAction' | RailStatusKey
  /**
   * The lead word, or `null` when the value already says it — `readyStatus`
   * resolves to "Ready" under a label that also reads "Ready", and printing both
   * is noise. The anchor always keeps its label.
   */
  label: string | null
  /** The server's `*Description`, or the raw code when `isCode`. */
  text: string
  /** Render `text` in monospace: it is a code, not a word (D-3's echo test). */
  isCode: boolean
  /** `null` on the anchor — it never takes a severity colour, on any value. */
  sev: Severity | null
}

/**
 * The translator, passed in. Same contract as `fields.ts`'s `TFn`.
 */
type TFn = (key: string, options?: Record<string, unknown>) => string

/** One entry, or `null` when the status carries no value and so gets no pill. */
function entry(
  key: RailEntry['key'],
  label: string,
  description: string | null | undefined,
  code: string | null | undefined,
  sev: Severity | null,
): RailEntry | null {
  const rawCode = (code ?? '').trim()
  const isCode = isCodeEcho(description, rawCode)
  const text = isCode ? rawCode : (description ?? '').trim()
  if (!text) return null
  return {
    key,
    label: text.toUpperCase() === label.toUpperCase() ? null : label,
    text,
    isCode,
    sev,
  }
}

/**
 * The rail for one document's status block: the `lastAction` anchor first, then
 * one pill per described status carrying a value, in lifecycle order.
 */
export function railEntries(
  status: SdDocumentHeaderStatusModel | null | undefined,
  t: TFn,
): RailEntry[] {
  if (!status) return []

  const entries: RailEntry[] = []

  const anchor = entry(
    'lastAction',
    t('rail.lastAction'),
    status.lastActionDescription,
    status.lastAction,
    null,
  )
  if (anchor) entries.push(anchor)

  for (const key of RAIL_STATUSES) {
    const code = status[key]
    const pill = entry(
      key,
      t(`rail.${key}`),
      status[`${key}Description`],
      code,
      statusSeverity(key, code),
    )
    if (pill) entries.push(pill)
  }

  return entries
}
