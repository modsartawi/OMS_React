/**
 * The Retail Command Center's wire shapes (oms 946-950, BackOffice spec 4165; routes BO 4176-4179).
 *
 * In `@/core/` because two features read them: the command center pages (`features/analytics/command-center`) and the
 * copilot (950), which draws a brief finding through the shared card in `@/core/findings` — and a feature may not
 * import another (`.claude/rules/feature-structure.md`).
 *
 * 🚩 The server computes every figure, colour and order; these types carry them as the server sent them. The page lays
 * them out and computes nothing (spec 4165 "The routes return stored findings as stored", ticket 946).
 *
 * ⚠ proposed: no server code exists yet (BO 4176-4179 unbuilt). Every field marked `⚠ proposed` is this client's
 * reading of the spec, built against stubs, so the server ticket can confirm it or rename it in one place.
 *
 * Append-only by ticket: each later ticket adds its own block at the END under a `// 94x` banner.
 */

// ── 946: the shared vocabulary ────────────────────────────────────────────────────────────────────────────────────

/** The page's language; every command-center read takes it as `lang` and the server answers in it. */
export const CC_LANGS = ['en', 'ar'] as const
export type CcLang = (typeof CC_LANGS)[number]

/** A stored colour. The page maps it to a tone token; it never decides one. */
export type CcColour = 'green' | 'amber' | 'red'

/** The map filter (spec 4165): all issues, sales (measures 1-3), stock (measure 4), delivery (measure 6). */
export const CC_FILTERS = ['all', 'sales', 'stock', 'delivery'] as const
export type CcFilter = (typeof CC_FILTERS)[number]

/** A sales region: the store dimension's `ksa_region` code, or `BH` for Bahrain. ⚠ proposed */
export type CcRegionKey = string

/** What "Ask" sends the copilot: the server's written question and its finding's id. Absent while `Copilot:Findings` is off (950). */
export interface CcAsk {
  question: string
  findingId: string
}

/** Where a profile narrows to (949). */
export type CcScope = { kind: 'chain' } | { kind: 'region'; region: CcRegionKey } | { kind: 'store'; storeCode: string }

/** Where a link in a sentence or a cell goes. The client builds the href (`@/core/command-center-routes`). ⚠ proposed */
export type CcTarget =
  | { kind: 'store'; storeCode: string }
  | { kind: 'category'; level: 'top' | 'second'; code: string; scope?: CcScope }

/** A server sentence in parts, so a pharmacy code or a category name can be a link without the client parsing words. ⚠ proposed */
export interface CcPart {
  text: string
  target?: CcTarget
}

/** A labelled figure, both as server text ("Yesterday's sales" / "SAR 12.4 m"). ⚠ proposed */
export interface CcFigure {
  label: string
  value: string
}

// ── 946: the home (`GET CommandCenter/Home?lang=`, BO 4176) ─────────────────────────────────────────────────────────

/** An overnight run's agent. ⚠ proposed */
export const CC_RUN_AGENTS = ['scorecard', 'product-health', 'brief'] as const
export type CcRunAgent = (typeof CC_RUN_AGENTS)[number]

/** A run's status (spec 4165 "Run" table). */
export const CC_RUN_STATES = ['waiting', 'running', 'done', 'failed', 'missed'] as const
export type CcRunState = (typeof CC_RUN_STATES)[number]

/** One overnight run on the status line. */
export interface CcRun {
  agent: CcRunAgent
  /** The run's name in the asked language ("Scorecards"). ⚠ proposed */
  label: string
  state: CcRunState
  /** Local ISO stamp without a zone, or null while it has not finished. */
  finishedAt: string | null
  /** The status line's dot, chosen by the server (the page computes no colour). ⚠ proposed */
  dot: 'green' | 'red'
}

/** The brief's eight sections, in the server's order (BO 4173). */
export const CC_SECTION_KEYS = ['headline', 'changed', 'risks', 'opportunities', 'slipped', 'products', 'categories', 'omni'] as const
export type CcSectionKey = (typeof CC_SECTION_KEYS)[number]

/** One line of the brief: a stored finding's fixed sentence and its SAR figure. */
export interface CcLine {
  findingId: string
  /** The sentence; a pharmacy code and a category name are parts with a target. */
  parts: CcPart[]
  /** The SAR figure as text, already formatted ("SAR 1.2 m"). */
  money: string
  /** The line's stored colour, drawn as a dot. ⚠ proposed */
  tone?: CcColour
  /** Absent while `Copilot:Findings` is off (decisions §4, 950). ⚠ proposed */
  ask?: CcAsk
}

export interface CcSection {
  key: CcSectionKey
  /** Folded under "More in today's brief". The server says which (spec: the last four). ⚠ proposed */
  folded: boolean
  state: 'ok' | 'not-available'
  /** The oldest source behind this section (local date). */
  dataAsOf: string | null
  /** With `not-available`: the last night this section was published. */
  lastGoodDate: string | null
  /** With `not-available`: the server's reason, in the asked language. ⚠ proposed */
  reason?: string
  /** A folded section's one-line summary, in the asked language. */
  summary?: string
  /** Slipped and improved, while still empty: the day its list starts. */
  startsOn?: string
  /** Only on `headline`: the sentence and its four figures. */
  headline?: { parts: CcPart[]; figures: CcFigure[] }
  /** Ranked by money, in the server's order. */
  lines: CcLine[]
}

export interface CcBrief {
  /** Whether the model's headline words were kept (else the fixed headline stands). */
  modelWrote: boolean
  sections: CcSection[]
}

/** One region's row under one filter (947). `shade` is the server's step for the region's fill. ⚠ proposed */
export interface CcRegionFigures {
  scored: number
  flagged: number
  share: string
  shade: 0 | 1 | 2 | 3 | 4 | 5
}

export interface CcRegionRow {
  region: CcRegionKey
  /** In the asked language. ⚠ proposed */
  name: string
  byFilter: Record<CcFilter, CcRegionFigures>
}

/** A trading pharmacy on the map: only its code and coordinates go to Google. */
export interface CcMapPoint {
  storeCode: string
  lat: number
  lon: number
  /** ⚠ proposed */
  region: CcRegionKey
  /** Its stored colour under each filter; null = not scored. */
  colour: Record<CcFilter, CcColour | null>
}

/** `GET CommandCenter/Home?lang=` — the brief, the status line, the region table and the map's points. */
export interface CommandCenterHome {
  /** The language the server answered in (a late answer for the other language is detectable). ⚠ proposed */
  lang: CcLang
  /** The brief's night (local date). */
  night: string
  /** False when tonight's brief is not published yet and this is the previous night, marked with its day. ⚠ proposed */
  isLatest: boolean
  /** The header's data-as-of: the oldest of all sections. */
  dataAsOf: string
  runs: CcRun[]
  brief: CcBrief
  regions: CcRegionRow[]
  points: CcMapPoint[]
  /** Trading pharmacies with no coordinates, counted under the map. ⚠ proposed */
  notOnMap: number
  /** The browser map key, as `Analytics/Model` hands it (ADR 0139). ⚠ proposed — not in BO 4176's text. */
  maps?: { key: string; mapId?: string }
}

// ── 946 for 948/949: the profiles' shared shapes (both profiles render sections of tables) ─────────────────────────

export const CC_PERIOD_KINDS = ['rolling4', 'ytd', 'dates'] as const
export type CcPeriodKind = (typeof CC_PERIOD_KINDS)[number]

export interface CcPeriod {
  kind: CcPeriodKind
  /** In the asked language. ⚠ proposed */
  label: string
  from: string
  to: string
  compareFrom: string
  compareTo: string
}

/** A table cell as server text; a cell with a target is a link. ⚠ proposed */
export interface CcCell {
  text: string
  target?: CcTarget
}

export interface CcTable {
  columns: { key: string; label: string; kind: 'text' | 'money' | 'count' | 'percent' | 'code' | 'date' }[]
  /** In the server's order. */
  rows: Record<string, CcCell>[]
  /** Every money figure includes VAT and is labelled so. */
  moneyInclVat?: boolean
  /** The product list: the row index of the 80% cut. ⚠ proposed */
  cut80?: number
}

/** A profile section, as the server sends it (948, 949). ⚠ proposed */
export interface CcProfileSection {
  key: string
  title: string
  state: 'ok' | 'not-available-yet'
  reason?: string
  tables: CcTable[]
  sentences?: CcPart[][]
}

// ── 947: the scorecard panel (`GET CommandCenter/Scorecard?storeCode=&lang=`, spec 4165 "one pharmacy's scorecard") ──

/** The six measures, in the spec's order (spec 4165 "The store scorecard"). The server sends them in its order. */
export const CC_MEASURE_KEYS = ['salesGrowth', 'receiptsGrowth', 'basket', 'deadStock', 'loyalty', 'delivery'] as const
export type CcMeasureKey = (typeof CC_MEASURE_KEYS)[number]

/** A measure's state: scored, "new" (a new pharmacy's growth measures), or not scored (too few delivery orders). */
export const CC_MEASURE_STATES = ['scored', 'new', 'not-scored'] as const
export type CcMeasureState = (typeof CC_MEASURE_STATES)[number]

/** One measure of a pharmacy's scorecard against its peer group, as stored. ⚠ proposed */
export interface CcMeasure {
  key: CcMeasureKey
  /** In the asked language. ⚠ proposed */
  label: string
  state: CcMeasureState
  /** The stored colour; null unless scored. */
  colour: CcColour | null
  /** The pharmacy's own figure and its peer group's, as formatted text (incl. VAT where money). */
  own: string
  peer: string
  /** Growth measures: the plain year-on-year figure beside the relative one (spec 4165 story 34). ⚠ proposed */
  plain?: string
}

/** `GET CommandCenter/Scorecard?storeCode=&lang=` — one pharmacy's scorecard, as stored last night. ⚠ proposed */
export interface CcScorecard {
  lang: CcLang
  night: string
  dataAsOf: string
  storeCode: string
  /** The pharmacy's code and city, in the asked language ("P166 · Riyadh"); no person's name. ⚠ proposed */
  title: string
  /** Its peer group in words ("Size B · Center"). ⚠ proposed */
  peerGroup: string
  /** Three or more red measures. */
  flagged: boolean
  /** No comparable 4 weeks last year: the growth measures read "new". */
  isNew: boolean
  /** The six measures, in the server's order. */
  measures: CcMeasure[]
  /** Context with no colour (insurance share, delivery and online share, days of cover). ⚠ proposed */
  context: CcFigure[]
  /** "Ask the copilot" about this pharmacy (950). Absent while `Copilot:Findings` is off. ⚠ proposed */
  ask?: CcAsk
}
