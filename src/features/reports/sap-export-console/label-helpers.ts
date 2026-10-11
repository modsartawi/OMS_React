/**
 * Label, flag and verdict → token (BackOffice spec 2579, ticket 461). Pure: no React, no
 * network, pinned by `label-helpers.test.ts`.
 *
 * 🚩 **The colours are a ruling, not taste** (the 461 runner's wave facts):
 * `stuck` danger · `behind` strong warning · `heldForInventory` info and NEVER red (a
 * deliberate stock-count freeze, spec 2579 story 20) · `waiting` neutral · `exported`
 * success · `byDesign` muted.
 *
 * Six labels need six tokens, and `@/core/ui/severity`'s vocabulary has five words (`warn`
 * has no strong twin, and `mute` is both neutral and muted), so the console carries its own
 * six — each one built only from theme token utilities, never a colour literal. Labels come
 * from the door: nothing here decides a transaction's label, it only names and colours it.
 */
import type { Accounting, Flag, Label } from '@/core/models/sap-export'

export type LabelToken = 'danger' | 'warningStrong' | 'info' | 'neutral' | 'success' | 'muted'

/** The ground + ink (+ edge) of each token — theme tokens only (the palette gate's rule). */
export const LABEL_TOKEN_CLASS: Record<LabelToken, string> = {
  danger: 'bg-danger-050 text-danger-800',
  // Strong: the attention family with its own edge and weight, so it reads louder than a plain tint.
  warningStrong: 'bg-attention-050 text-attention-800 font-semibold ring-1 ring-inset ring-attention-border',
  info: 'bg-primary-050 text-primary-800',
  neutral: 'bg-muted text-foreground',
  success: 'bg-success-050 text-success-800',
  muted: 'bg-transparent text-muted-foreground ring-1 ring-inset ring-border',
}

/** A code's token and its label key, or `null` for a value this bundle does not know. */
export type TokenBadge = { token: LabelToken; labelKey: string | null }

function lookup<K extends string>(map: Record<K, LabelToken>, keyPrefix: string, value: string): TokenBadge {
  // `Object.hasOwn`, so a key inherited from `Object.prototype` (`toString`) is not a label.
  if (!Object.hasOwn(map, value)) return { token: 'neutral', labelKey: null }
  return { token: map[value as K], labelKey: `${keyPrefix}.${value}` }
}

const LABEL_TOKEN: Record<Label, LabelToken> = {
  stuck: 'danger',
  behind: 'warningStrong',
  heldForInventory: 'info',
  waiting: 'neutral',
  exported: 'success',
  byDesign: 'muted',
}

/**
 * A label's token and its `sap-export-console` key. An unknown value (a door newer than
 * this bundle) is neutral with no key, so the caller shows the raw value — never a crash.
 */
export function labelToken(label: string): TokenBadge {
  return lookup(LABEL_TOKEN, 'labels', label)
}

/** Worst first: stuck > behind > heldForInventory > waiting > exported > byDesign. Ranks every `Label` (pinned by the test). */
export const WORST_FIRST: readonly Label[] = ['stuck', 'behind', 'heldForInventory', 'waiting', 'exported', 'byDesign']

/**
 * The label counts a newer door sent that this bundle does not know, non-zero only — drawn as
 * plain chips after the known six so the header still adds up to the day's total.
 */
export function unknownLabelCounts(counts: Record<string, number>): { label: string; count: number }[] {
  return Object.keys(counts)
    .filter((k) => !(WORST_FIRST as readonly string[]).includes(k) && counts[k] > 0)
    .map((label) => ({ label, count: counts[label] }))
}

/** The worst known label among `labels`, or `null` when none is known. Unknown values are ignored. */
export function worstLabel(labels: readonly string[]): Label | null {
  return WORST_FIRST.find((l) => labels.includes(l)) ?? null
}

/**
 * A flag's chip. The two double-send flags are danger (spec 2579 story 26: "listed first and
 * in red"); every other flag is a rail leak or an evidence gap worth reading, drawn neutral.
 */
const FLAG_TOKEN: Record<Flag, LabelToken> = {
  X1: 'danger',
  X1p: 'danger',
  X2: 'neutral',
  X3: 'neutral',
  X4: 'neutral',
  legacyResend: 'neutral',
  failClosedNoDetail: 'neutral',
}

export function flagToken(flag: string): TokenBadge {
  return lookup(FLAG_TOKEN, 'flags', flag)
}

const ACCOUNTING_TOKEN: Record<Accounting, LabelToken> = {
  agrees: 'success',
  breaks: 'danger',
}

/** The export-accounting verdict's badge: `breaks` is the danger token. */
export function accountingToken(verdict: string): TokenBadge {
  return lookup(ACCOUNTING_TOKEN, 'accounting', verdict)
}
