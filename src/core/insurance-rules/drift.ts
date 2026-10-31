// Payer drift (BackOffice spec 3271 D3-D6, D10; door 3293; oms 703). Pure: no React, no http. In core because the
// Review list reads the signal while the catalog and the rule lists draw the badges.
//
// 🚩 PROVISIONAL: door 3293 names the content and spells no wire, so `DriftSignalReply` and `DriftBadge` are guesses that
// 711 reconciles.

/** What the door sends for a drift item's `signal`. Every field but `type` belongs to one signal only. */
export interface DriftSignalReply {
  type?: string | null
  profile?: string | null
  url?: string | null
  /** `answer`: the field's answer rate fell. `unparsed`: its unparsed rate rose. */
  measure?: string | null
  field?: string | null
  /** The trailing 7 days, a fraction 0-1. */
  rate?: number | null
  /** The 28 days before, a fraction 0-1. */
  baseline?: number | null
}

export type DriftSignal =
  | { type: 'newProfile'; profile: string }
  | { type: 'newUrl'; url: string }
  | { type: 'rateFell'; measure: 'answer' | 'unparsed'; field: string; rate: number; baseline: number }
  /** A signal this screen does not know, or one sent without what it needs: its code, and never a throw. */
  | { type: 'unknown'; code: string }

const isRate = (n: number | null | undefined): n is number => typeof n === 'number' && Number.isFinite(n)

export function driftSignalIn(s: DriftSignalReply | null | undefined): DriftSignal {
  const code = s?.type ?? ''
  if (code === 'newProfile' && s?.profile) return { type: code, profile: s.profile }
  if (code === 'newUrl' && s?.url) return { type: code, url: s.url }
  if (code === 'rateFell' && s?.field && isRate(s.rate) && isRate(s.baseline) && (s.measure === 'answer' || s.measure === 'unparsed'))
    return { type: code, measure: s.measure, field: s.field, rate: s.rate, baseline: s.baseline }
  return { type: 'unknown', code }
}

/** A fraction as a percent, to one decimal at most. */
export const formatDriftRate = (fraction: number): string => `${Math.round(fraction * 1000) / 10}%`

/** A signal's locale key and the machine values for its `<v>` slots. Nothing isolated here: the screen does that. */
export interface SignalReading {
  words: string
  values: Record<string, string>
}

export function signalReading(s: DriftSignal): SignalReading {
  switch (s.type) {
    case 'newProfile':
      return { words: 'drift.signal.newProfile', values: { profile: s.profile } }
    case 'newUrl':
      return { words: 'drift.signal.newUrl', values: { url: s.url } }
    case 'rateFell':
      return {
        words: s.measure === 'answer' ? 'drift.signal.answerRateFell' : 'drift.signal.unparsedRateRose',
        values: { field: s.field, rate: formatDriftRate(s.rate), baseline: formatDriftRate(s.baseline) },
      }
    case 'unknown':
      return { words: 'drift.signal.unknown', values: { code: s.code } }
  }
}

export const DRIFT_SIGNAL_TYPES = ['newProfile', 'newUrl', 'rateFell'] as const
export type DriftSignalType = (typeof DRIFT_SIGNAL_TYPES)[number] | 'unknown'

/** The door's spelling of each signal (`DriftSignals`, 3293). */
const DOOR_SIGNALS: Record<string, DriftSignalType> = {
  'new-profile-version': 'newProfile',
  'never-seen-url': 'newUrl',
  'answer-rate': 'rateFell',
  'unparsed-rate': 'rateFell',
}

/** A badge's signal as its hint's word: `drift.type.<this>`. */
export const driftSignalType = (type: string): DriftSignalType => DOOR_SIGNALS[type] ?? DRIFT_SIGNAL_TYPES.find((k) => k === type) ?? 'unknown'

/** One open drift item and what it affects. Cleared items are not sent, so clearing removes the badges. */
export interface DriftBadge {
  /** The review item the badge links back to. */
  itemId: string
  payer: string
  signal: string
  /** Catalog rows, as `factKey` writes them. */
  fields: string[]
  /** Published rules that read those fields. They keep running. */
  rules: string[]
}

export type DriftBadgeReply = Pick<DriftBadge, 'itemId' | 'payer' | 'signal'> & Partial<Pick<DriftBadge, 'fields' | 'rules'>>

export const driftBadgesIn = (rows: readonly DriftBadgeReply[] | null | undefined): DriftBadge[] =>
  (rows ?? []).map((r) => ({ itemId: r.itemId, payer: r.payer, signal: r.signal, fields: r.fields ?? [], rules: r.rules ?? [] }))

export const badgesOnField = (badges: readonly DriftBadge[], key: string): DriftBadge[] => badges.filter((b) => b.fields.includes(key))
export const badgesOnRule = (badges: readonly DriftBadge[], ruleId: string): DriftBadge[] => badges.filter((b) => b.rules.includes(ruleId))

/** The Review list, filtered to drift, with this item marked. */
export const driftItemPath = (itemId: string): string => `/insurance-rules/review?kind=drift&item=${encodeURIComponent(itemId)}`
