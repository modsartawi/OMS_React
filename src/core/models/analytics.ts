/**
 * The analytics doors' wire (spec 766 §C — PROPOSED, owned by BackOffice 3378 once filed).
 *
 * ⚠ Drift rule: a `400` on the first live call is a drift report. Correct the BackOffice spec first,
 * then this transcription — never the transcription alone.
 *
 * Where §C names a field but not its exact shape, the choice made here is marked ⚠ (ticket 767).
 * Every array is read through `features/analytics/boards/wire.ts`, which turns an absent array into an
 * empty one, so nothing downstream checks for `undefined`.
 */

/** A model label or title in both languages (766 §B: labels live with the member, in en and ar). */
export interface AnalyticsLabel {
  en: string
  ar: string
}

/**
 * `GET Analytics/Access`. Absent or unreachable means denied (the OMS probe pattern). 822 (spec 819 §C, PROPOSED):
 * `canAuthor` is the builder's grant — a **runner** is `canView` without it; curate implies author.
 */
export interface AnalyticsAccess {
  canView: boolean
  canAuthor: boolean
  canCurate: boolean
}

export type MeasureShape = 'additive' | 'rate' | 'percentile'
export type MeasureUnit = 'count' | 'SAR' | 'minutes' | 'seconds' | 'km' | 'share'

export interface AnalyticsArea {
  key: string
  available: boolean
  /**
   * Bilingual on the wire (`AnalyticsAreaInfo.UnavailableReason` is an `AnalyticsLabel`, BackOffice 3437; ticket
   * 841 fixed the old `string` typing). `readModel` reads it as a label; null when the area is available.
   */
  unavailableReason?: AnalyticsLabel | null
}

export interface AnalyticsMeasure {
  key: string
  area: string
  shape: MeasureShape
  unit: MeasureUnit
  maxWindowDays?: number | null
  label: AnalyticsLabel
  description: AnalyticsLabel
  /** The dimension keys this measure may be broken down by. ⚠ Field name not fixed by §C. */
  dimensions: string[]
  /**
   * 827 (spec 819 §B, ⚠ PROPOSED): the model's warning every panel of this measure shows, e.g. "inside OMS only".
   * Absent = none.
   */
  caveat?: AnalyticsLabel | null
  /**
   * 827 (spec 819 §B, ⚠ PROPOSED): days younger than this, counted back from `dataAsOf`, are marked "may still
   * rise" (8 for the cancellation measures, 30 for claims). Absent = never marked.
   */
  mayStillRiseDays?: number | null
}

/** A small, fixed dimension's value, served inline (channel group, country). */
export interface AnalyticsDimensionValue {
  key: string
  /** ⚠ Bilingual like every model label (§C gives `{ key, label }` only for `DimensionValues`). */
  label: AnalyticsLabel
}

export interface AnalyticsDimension {
  key: string
  kind: 'time' | 'category'
  label: AnalyticsLabel
  /** 841 (BackOffice 3437 §C): the dimension's description; the Catalog shows it. Absent on older readers. */
  description?: AnalyticsLabel
  /**
   * Inline when the list is small and fixed. Its ORDER is the catalogue's, and a dimension served
   * with values gets a fixed colour slot per value (766 §F: channel groups and countries).
   */
  values: AnalyticsDimensionValue[]
}

/** `GET Analytics/Model` — the catalogue the screens and the AI share. */
export interface AnalyticsModel {
  areas: AnalyticsArea[]
  measures: AnalyticsMeasure[]
  dimensions: AnalyticsDimension[]
}

/** The eight chart types (766 §E). Slice 0 (767) draws `bar` vertical; 768/769 add the rest. */
export type AnalyticsChartType = 'kpi' | 'line' | 'area' | 'bar' | 'donut' | 'table' | 'heatmap' | 'combo'

/** ⚠ 766 §C does not fix a definition shape; this is the web's proposal, mirroring `semantic_query`. */
export interface AnalyticsFilter {
  dimension: string
  values: string[]
}

export interface AnalyticsSemanticQuery {
  measures: string[]
  dimensions: string[]
  filters: AnalyticsFilter[]
  /** A relative period token ("last-30-days"), resolved by the server in Riyadh time. */
  period?: string | null
  grain?: string | null
  limit?: number | null
  compareToPrevious?: boolean
}

/** The editor's number formats (755 item 4). `auto` follows the measure's unit. */
export type AnalyticsNumberFormat = 'auto' | 'integer' | 'decimal' | 'percent' | 'SAR' | 'minutes'

export interface AnalyticsChart {
  type: AnalyticsChartType
  /** Bars only: vertical (the default) or horizontal. */
  orientation?: 'vertical' | 'horizontal'
  /**
   * Bars with two or more series (768): stacked or grouped (the default). ⚠ Field name not fixed by §C.
   * A stacked area is always stacked. A rate or percentile measure is never stacked (766 §E).
   */
  stack?: 'stacked' | 'grouped'
  /** ⚠ The definition's number format (766 story 43); absent means `auto`. */
  format?: AnalyticsNumberFormat
  /** ⚠ Table only (769): the column a table is sorted by, and how. Default: the first measure, largest first. */
  sort?: { key: string; direction: 'asc' | 'desc' } | null
  /** ⚠ Table only (769): keep the first N rows after the sort. Absent → every row. */
  topN?: number | null
  /** ⚠ The legend's place (755 item 4, ticket 775): hidden, top, bottom or end. Absent → the form's default. */
  legend?: AnalyticsLegendPosition
}

export type AnalyticsLegendPosition = 'hidden' | 'top' | 'bottom' | 'end'

/** An analytics view's definition. */
export interface AnalyticsViewDefinition {
  chart: AnalyticsChart
  query: AnalyticsSemanticQuery
  /**
   * The saved member → colour slot map, per breakdown dimension (766 §F: written when the view is
   * saved). Ignored for a dimension with inline values, whose slots are fixed.
   */
  slots?: Record<string, Record<string, number>>
  /**
   * 825 (spec 819 §C, PROPOSED): up to 4 **named series**. Each runs as its own query with the view's
   * query plus its own filters (on the view's own category dimensions), so a rate stays its own; the
   * answer merges them on the shared axis under a `series` column. Slot = position. No total across them.
   * Absent = none (a v1 view).
   */
  series?: AnalyticsSeries[]
}

/** One named series (825): ⚠ `{ id, label{en,ar}, filters[] }` as spec 819 §C writes it. */
export interface AnalyticsSeries {
  id: string
  label: AnalyticsLabel
  filters: AnalyticsFilter[]
}

export type AnalyticsTier = 'personal' | 'shared' | 'certified'

/**
 * 826 (spec 819 §C, ⚠ PROPOSED, BackOffice 3378): an authz role in an audience or among the candidates. `removed`
 * is a role authz no longer holds: it stays in the audience, marked, and grants nobody.
 */
export interface AnalyticsAudienceRole {
  key: string
  label: AnalyticsLabel
  removed: boolean
}

/** 826: an analytics user in an audience or among the candidates — a free-text name and a machine employee id. */
export interface AnalyticsAudienceUser {
  id: string
  name: string
  employeeId: string
  /**
   * 833 (spec 819 §C, ⚠ proposed): asked for a report (`AudienceCandidates?reportId=`), each user also carries their
   * address, whether they hold the run grant, and whether they sit in the report's audience (a role's membership is
   * authz's to resolve, so the server says). Absent reads as no: a schedule never offers whom it cannot vouch for.
   */
  email?: string
  canRun?: boolean
  inAudience?: boolean
}

/**
 * 826: a Shared item's audience as the store answers it, resolved through authz on every read — everyone, or a mix
 * of roles and named users. ⚠ §C writes `{ roles: string[], users: string[] }`; the read is proposed to carry each
 * entry resolved (a role's label and `removed`, a user's name and employee id), so the chip can name them.
 */
export type AnalyticsAudience = { everyone: true } | { everyone: false; roles: AnalyticsAudienceRole[]; users: AnalyticsAudienceUser[] }

/** 826: the audience as the writes carry it (§C): everyone, or role keys and user ids. */
export type AnalyticsAudienceWrite = { everyone: true } | { roles: string[]; users: string[] }

/** 826: `GET Analytics/AudienceCandidates?search=` — up to 50 roles and analytics users matching `search`. */
export interface AnalyticsAudienceCandidates {
  roles: AnalyticsAudienceRole[]
  users: AnalyticsAudienceUser[]
}

/** 826: `PUT Analytics/Item/{id}/Audience` — not a definition revision, so no `baseRevision` and never `ANALYTICS-405`. */
export interface AnalyticsItemAudience {
  audience: AnalyticsAudienceWrite
}

/** 826: `POST Analytics/Item/{id}/Reassign` (curators only): the author the item is handed to. */
export interface AnalyticsItemReassign {
  owner: string
}

/**
 * 826: an `ANALYTICS-413` refusal's `data` (⚠ proposed): who to ask. No title, no data of the item.
 * `ownerName` is the owner's display name when the store has one.
 */
export interface AnalyticsNotShared {
  owner: string
  ownerName?: string
}

/**
 * `GET Analytics/Item/{id}` — a view, a board or (819, ticket 828) a report in the analytics store. A board and a
 * report are read through their own readers (`AnalyticsBoard`, `AnalyticsReport`); here `definition` is typed as a
 * view's, which only a view's is.
 */
export interface AnalyticsItem {
  id: string
  kind: 'view' | 'board' | 'report'
  /** Empty by default for an AI view: the screen then generates one from the model labels. */
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  owner: string
  tier: AnalyticsTier
  certifiedFrom?: string | null
  copiedFrom?: string | null
  sourceChangedSinceCopy: boolean
  revision: number
  updatedAt: string
  updatedBy: string
  definition: AnalyticsViewDefinition
  /** 826: a Shared item's audience. Absent on a Shared item is v1's share with everyone. */
  audience?: AnalyticsAudience
  /**
   * 837 (BackOffice 3432 §1): the CALLER's folder for this item, or `null` (unfiled). Folders are personal: this is
   * never another user's filing. A server without 3432 sends none, read as `null`.
   */
  folderId?: string | null
  /** 837 (3432 §3): when the item was deleted — only on `Items?deleted=true` rows; `null` otherwise. */
  deletedAt?: string | null
}

/** 837 (3432 §1): `GET Analytics/Folders` — one of the caller's own flat folders. */
export interface AnalyticsFolder {
  id: string
  name: string
  order: number
  /** Items the caller can still read that are not deleted. */
  itemCount: number
}

/** 837: `POST Analytics/Folders` / `PUT Analytics/Folders/{id}`. The name is trimmed, 1–80, unique per user (406). */
export interface AnalyticsFolderWrite {
  name?: string
  order?: number
}

/** 837: `PUT Analytics/Item/{id}/Folder` answers the filing. `folderId: null` is unfiled. */
export interface AnalyticsFiling {
  itemId: string
  folderId: string | null
}

/** 837 (3432 §2): a live board that links a view — the ones the caller can read. */
export interface AnalyticsUsedByBoard {
  id: string
  title: AnalyticsLabel
  owner: string
  tier: AnalyticsTier
  mine: boolean
}

/**
 * 837: `GET Analytics/Item/{id}/UsedBy`, and the `data` of an `ANALYTICS-416` (view in use) refusal. `hidden` counts
 * the boards the caller cannot read (no titles leak).
 */
export interface AnalyticsUsedBy {
  boards: AnalyticsUsedByBoard[]
  hidden: number
}

/**
 * `POST Analytics/Item` — the body of a new item (ticket 775). ⚠ §C names the door, not its body: the
 * server makes it Personal to the caller and answers the whole item. An empty title is generated on screen.
 */
export interface AnalyticsItemCreate {
  kind: 'view' | 'board' | 'report'
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  definition: AnalyticsItemDefinition
}

/** A view's, a board's or a report's definition: what the store's writes carry, whichever the kind (776, 777, 828). */
export type AnalyticsItemDefinition = AnalyticsViewDefinition | AnalyticsBoardDefinition | AnalyticsReportDefinition

/**
 * `PUT Analytics/Item/{id}` — save in place (ticket 776). §C names `{ definition, baseRevision }`;
 * ⚠ `title` and `subtitle` ride too, or an edited title could not be saved. `baseRevision` is the revision
 * the editor opened: a newer one on the server refuses with `ANALYTICS-405`; not the caller's to edit,
 * `ANALYTICS-403`. Answers the saved item at its new revision.
 */
export interface AnalyticsItemUpdate {
  title: AnalyticsLabel
  subtitle: AnalyticsLabel
  definition: AnalyticsItemDefinition
  baseRevision: number
}

/**
 * `POST Analytics/Item/{id}/Copy` — save as my copy (ticket 776): a Personal item of the caller's that records
 * its source (`copiedFrom`). ⚠ §C gives Copy no body: here `revision` is the source revision copied FROM (the
 * one the editor opened) and the edited `title`/`subtitle`/`definition` are the copy's, so editing someone
 * else's item is one call. Omitted, the server copies that revision as is. Answers the new copy.
 */
export interface AnalyticsItemCopy {
  revision: number
  title?: AnalyticsLabel
  subtitle?: AnalyticsLabel
  definition?: AnalyticsItemDefinition
}

/** 778: the body of `…/Share`, `…/Unshare` and `…/Certify` — the revision the screen showed (⚠ §C `{ revision }`). */
export interface AnalyticsItemRevision {
  revision: number
}

/** 826: `…/Share` takes an audience (§C): the revision the screen showed, shared with whom. */
export interface AnalyticsItemShare extends AnalyticsItemRevision {
  audience: AnalyticsAudienceWrite
}

/**
 * `POST Analytics/Query` — a saved view by id, or an inline definition while editing (v1's two forms), or
 * (spec 819 §C, ticket 823) one panel of an item that carries parameters, which the server applies the
 * bindings of: {@link AnalyticsParamQuery}.
 */
export type AnalyticsQueryInput = AnalyticsViewQuery | AnalyticsParamQuery

/**
 * ⚠ 819 §C, proposed: a saved item's panel `{ itemId, revision, panelId, values }`, or, while editing or
 * drilled, `{ definition, params, bindings, panelId, values }`. `values` holds the parameters bound to that
 * panel, so a value change re-asks only the panels it is bound to. The cross-filter (772) is the web's own,
 * not a parameter, and rides as before; `compareToPrevious` too.
 */
export type AnalyticsParamQuery = (
  | { itemId: string; revision: number }
  | { definition: AnalyticsViewDefinition; params: Param[]; bindings: Bindings }
) & {
  panelId: string
  values: Record<string, ParamValue>
  crossFilter?: AnalyticsFilter | null
  compareToPrevious?: boolean
}

export type AnalyticsViewQuery = (
  | { viewId: string; revision?: number }
  | { definition: AnalyticsViewDefinition }
) & {
  /** The board filters that reach this panel (771), canonical: sorted by dimension, values sorted. */
  filters?: AnalyticsFilter[]
  /**
   * ⚠ The board's period, overriding the view's own (771). A relative token ("last-30-days") the server
   * resolves, or a fixed range written `from..to` (ISO days). Absent: the view's own period.
   */
  period?: string
  /**
   * ⚠ The cross-filter (772): the one member clicked on another panel, `{ dimension, values: [member] }`.
   * Absent when it does not reach this panel (its source, opted out, or a dimension its measures lack).
   */
  crossFilter?: AnalyticsFilter | null
  compareToPrevious?: boolean
}

export interface AnalyticsColumn {
  key: string
  /** ⚠ 825: `series` — the column holding each row's series id, when the view has named series. */
  role: 'dimension' | 'measure' | 'series'
  shape?: MeasureShape | null
  unit?: MeasureUnit | null
}

/** ⚠ A row is an object keyed by column key (Cube's own shape); §C says `rows[]` only. */
export type AnalyticsRow = Record<string, string | number | null>

export interface AnalyticsQueryResult {
  columns: AnalyticsColumn[]
  rows: AnalyticsRow[]
  total: number
  truncated: boolean
  period: { from: string; to: string } | null
  /** Present when `compareToPrevious` was asked. */
  previous: AnalyticsRow[]
  fetchedAt: string
  /** The newest source event time of the last good run, from `mart_load_log`. */
  dataAsOf: string
  /** ⚠ 819 §C (823): the parameters that do not reach this panel, and why. Absent reads as none. */
  notReached?: { param: string; reason: string }[]
  /** ⚠ 819 §C (823): the parameters whose value was outside a declared list, so the default ran. Absent reads as none. */
  fellBack?: { param: string }[]
}

// ── Boards (ticket 771) ──────────────────────────────────────────────────────────────────────────────
// ⚠ 766 §C names the board as an item kind but fixes no definition shape: this is the web's proposal.

/** The board filters a panel can opt out of (766 §F), and the cross-filter (772). */
export type BoardFilterKey = 'period' | 'city' | 'region' | 'store' | 'channel' | 'country' | 'crossFilter'

/** The relative period tokens (766 story 21), resolved by the server in Riyadh time with Sunday weeks. */
export type PeriodToken =
  | 'today'
  | 'yesterday'
  | 'this-week'
  | 'last-week'
  | 'last-7-days'
  | 'last-28-days'
  | 'last-30-days'
  | 'this-month'
  | 'last-month'
  | 'year-to-date'

/** A relative period (stays relative in the permalink and on the wire), or a fixed range of ISO days. */
export type BoardPeriod = { kind: 'relative'; token: PeriodToken } | { kind: 'fixed'; from: string; to: string }

/** The filter strip's state: the period plus the member lists of the five category filters. */
export interface BoardFilters {
  period: BoardPeriod
  city: string[]
  region: string[]
  store: string[]
  channel: string[]
  country: string[]
}

/** A panel's place on the 12-column grid, in logical (writing-mode) columns and fixed row units. */
export interface BoardLayout {
  x: number
  y: number
  w: number
  h: number
}

/** A board panel: a view linked by reference, a text panel, or a section header. */
export type AnalyticsBoardPanel =
  /**
   * `optOut`: v1's opt-outs. Since 819 only `crossFilter` is read from it (the cross-filter keeps its
   * opt-out); the six ready-made parameters reach a panel through the board's `bindings`.
   */
  | { id: string; kind: 'view'; viewId: string; layout: BoardLayout; optOut: BoardFilterKey[] }
  | { id: string; kind: 'text'; text: AnalyticsLabel; layout: BoardLayout }
  | { id: string; kind: 'section'; title: AnalyticsLabel; layout: BoardLayout }

// ── Parameters (spec 819 §C, ticket 821; the 798 prototype's shape) ─────────────────────────────────────

export type ParamKind = 'period' | 'members' | 'grain' | 'threshold' | 'topN' | 'measure' | 'breakdown'
export type Grain = 'day' | 'week' | 'month'
export type ThresholdOp = 'off' | 'gt' | 'gte' | 'lt' | 'lte'

/** A parameter's value. Only `members` takes several; `[]` is "all". A threshold is in the display unit. */
export type ParamValue =
  | { kind: 'period'; token: PeriodToken }
  | { kind: 'period'; from: string; to: string }
  | { kind: 'members'; values: string[] }
  | { kind: 'grain'; grain: Grain }
  | { kind: 'threshold'; op: ThresholdOp; value: number }
  | { kind: 'topN'; n: number }
  | { kind: 'measure'; key: string }
  | { kind: 'breakdown'; key: string }

/** A parameter declared on a board or a report (797), never on a view. */
export interface Param {
  /** A slug, unique within the item, not `tv|refresh|cross|crossFrom`: the URL key. */
  name: string
  kind: ParamKind
  label: AnalyticsLabel
  /** "Viewers can't clear it" — every parameter has a default (797 §2). */
  required: boolean
  /** members: the dimension it picks from (a binding may point it elsewhere per panel). */
  dimension?: string
  /** members: the author's pinned list; `null` = open search. */
  pinned?: string[] | null
  multi?: boolean
  /** grain: the allowed subset. */
  grains?: Grain[]
  /** threshold: the one measure it compares. */
  measure?: string
  /** measure | breakdown: the author's options. */
  options?: string[]
  default: ParamValue
}

/** Parameter name → panel id → the dimension a `members` parameter filters there, or `true`. Absent = not bound. */
export type Bindings = Record<string, Record<string, string | true>>

/** Why a parameter cannot bind to a panel (797 §5, 799 §2). */
export type BindReason = 'noTimeAxis' | 'seriesFilters' | 'thresholdShape' | 'topNShape' | 'measureShape' | 'breakdownShape' | 'notInArea'

export interface AnalyticsBoardDefinition {
  panels: AnalyticsBoardPanel[]
  /**
   * 819: the board's parameters and their bindings. Absent on a v1 board, which `boardParams` converts
   * from `filters` and each panel's `optOut` (797 item 6) until the server converts on read.
   */
  params?: Param[]
  bindings?: Bindings
  /** v1: the board's saved filters, which the strip opens on when the URL names none. */
  filters?: Partial<BoardFilters>
  /**
   * ⚠ The board's default auto-refresh interval in seconds (story 57, ticket 777): one of `BOARD_REFRESH_SECONDS`
   * (30, 60, 300, 900); absent or `null` is Off. A viewer's own choice overrides it for their session (780).
   */
  refresh?: number | null
}

/** A board in the analytics store: an item whose definition is a board's. */
export type AnalyticsBoard = Omit<AnalyticsItem, 'definition' | 'kind'> & { kind: 'board'; definition: AnalyticsBoardDefinition }

// ── Reports (spec 819 §C, ticket 827; 801) ─────────────────────────────────────────────────────────────
// ⚠ PROPOSED (BackOffice owns it once filed). A report is an `Analytics/Item` of `kind: 'report'`: its title is
// the item's `title{en,ar}`; its definition carries the parameters, their bindings and ordered sections.

/**
 * A report block: a **panel** (an inline view definition — never a reference — with its provenance when it was
 * copied from a saved view), a **text** block (`{en, ar}` holding live-figure tokens `{{fig:<panel>:<measure>[:<series>]}}`), or the
 * **summary** block (at most one per report). A panel's id is the `panelId` its query and its tokens name.
 */
export type AnalyticsReportBlock =
  | {
      id: string
      kind: 'panel'
      /** ⚠ The panel's own title; empty → generated from the model labels, as a view's is. */
      title: AnalyticsLabel
      definition: AnalyticsViewDefinition
      /** Copied from a saved view (801 §2): which, and the revision copied. */
      from?: { viewId: string; revision: number } | null
      /** Computed by the server: the source view has been saved since the copy. */
      sourceChangedSinceCopy?: boolean
    }
  | { id: string; kind: 'text'; text: AnalyticsLabel }
  | { id: string; kind: 'summary' }

export interface AnalyticsReportSection {
  id: string
  heading: AnalyticsLabel
  blocks: AnalyticsReportBlock[]
}

export interface AnalyticsReportDefinition {
  params: Param[]
  bindings: Bindings
  sections: AnalyticsReportSection[]
}

/** A report in the analytics store: an item whose definition is a report's. */
export type AnalyticsReport = Omit<AnalyticsItem, 'definition' | 'kind'> & { kind: 'report'; definition: AnalyticsReportDefinition }

/** 827: `POST Analytics/Report/{id}/Words` — the run the screen shows: the revision and every parameter's value. */
export interface AnalyticsReportWordsRequest {
  revision: number
  values: Record<string, ParamValue>
}

/**
 * 827: the Words answer (BackOffice 3408 §F). `figures`: each live-figure token as written
 * (`{{fig:p1:net_value}}`) → its value's words in both languages, formatted by the measure's unit. `summary`: the
 * AI summary in both languages, or `unavailable` with the reason (the number check failed, or the AI was not
 * reached) — which drops the summary alone. `null` when the report has no summary block.
 */
export interface AnalyticsReportWords {
  figures: Record<string, AnalyticsLabel>
  summary: { text: AnalyticsLabel } | { unavailable: string } | null
}

/** `GET Analytics/DimensionValues` — one member for the store, city and region pickers. */
export interface AnalyticsMember {
  key: string
  /** ⚠ §C gives `label` without its shape: a plain string is read as both languages. */
  label: AnalyticsLabel
}

/**
 * `GET Analytics/Item/{id}/Revisions` — one of an item's last 20 revisions (ticket 779): who saved it and
 * when. §C keeps the full definition snapshots server side; the web lists who and when only.
 * ⚠ `revertedFrom` is the web's proposal (BackOffice 3378): the revision a revert copied, so the list can
 * say "reverted to revision N". Absent, the row reads as an ordinary save.
 */
export interface AnalyticsRevision {
  revision: number
  updatedAt: string
  updatedBy: string
  revertedFrom?: number | null
  /**
   * 826 (⚠ proposed): a history row that is not a definition revision — an audience change or a reassign. Its
   * `revision` is the one current when it happened; it is never reverted to. A reassign names the new `owner`.
   */
  event?: 'audience' | 'reassign'
  owner?: string
}

/** `POST Analytics/Item/{id}/Revert` — writes `revision`'s snapshot as a NEW revision. Answers the item at it. */
export interface AnalyticsItemRevert {
  revision: number
}

/**
 * `GET Analytics/Health` (BackOffice 3386, curators only — `ANALYTICS-402` otherwise): the analytics
 * container's own `/health`, passed on field by field by SIS.Api. Unreachable is an answer, not a refusal.
 */
export type AnalyticsHealthStatus = 'ok' | 'fail' | 'unreachable' | 'not_configured'
export type AnalyticsCubeState = 'ready' | 'not_ready' | ''
export type AnalyticsMartsState = 'fresh' | 'stale' | 'never_built' | 'unreachable' | ''
/** Image 1.2.0: the first load of a newly deployed dbt project; '' from an older image. */
export type AnalyticsFirstLoadState = 'done' | 'running' | 'failed' | 'not_started' | 'unreachable' | ''
export type AnalyticsFirstLoadPhase = 'rebuild' | 'backfill' | ''

export interface AnalyticsHealth {
  status: AnalyticsHealthStatus
  /** The image version the container runs; empty when it did not answer. */
  version: string
  cube: AnalyticsCubeState
  marts: {
    status: AnalyticsMartsState
    /** The newest successful dbt run, Riyadh time as stored (`yyyy-MM-dd HH:mm:ss`). */
    lastGoodRunAtRiyadh: string
    minutesSince: number | null
    /** The threshold in force: 45 by day, 360 at night (00:00–08:00). */
    maxMinutes: number | null
    /** The newest run whatever its outcome: `"<job> <status> at <time>"`. */
    lastRun: string
  }
  /**
   * Image 1.2.0: whether this image's dbt project is built into POS_Analytics yet — a full rebuild,
   * then the 2026 backfill one month at a time. It never changes `status`: the boards answer from
   * the previous marts meanwhile.
   */
  firstLoad: {
    status: AnalyticsFirstLoadState
    /** While running: `rebuild` or `backfill`. */
    phase: AnalyticsFirstLoadPhase
    /** During the backfill: months finished, of `monthsTotal`. */
    monthsDone: number | null
    monthsTotal: number | null
    /** During the backfill: the first day of the month being read (`yyyy-MM-dd`). */
    currentMonth: string
    /** Riyadh time as stored (`yyyy-MM-dd HH:mm:ss`). */
    startedAtRiyadh: string
    finishedAtRiyadh: string
  }
  /** When SIS.Api asked, its local clock. */
  checkedAt: string
}

// ── Schedules and kept runs (spec 819 §C, ticket 833; research 803) ────────────────────────────────────────
// ⚠ PROPOSED (BackOffice owns it once filed): `Analytics/Report/{id}/Schedules[/{sid}]`, `…/SendNow`,
// `Analytics/Report/{id}/Runs`, `Analytics/ReportRun/{runId}` and its `/Html` and `/Pdf`.

/** Weekdays as the server's Sunday weeks count them: 0 is Sunday … 6 is Saturday. */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6

/** Daily, weekly on chosen days, or monthly on a day (1–28, so every month has it) or its last day (3408 §G). */
export type AnalyticsScheduleCadence = { kind: 'daily' } | { kind: 'weekly'; days: Weekday[] } | { kind: 'monthly'; day: number | 'last' }

/**
 * Why a schedule is suspended (not deleted): its owner lost the run or author grant (`ownerGrant`, resumed by a
 * curator's handover), or a saved value no longer resolves (`value`, `ANALYTICS-412`, naming `param`). Any other
 * reason reads as the server's `message`.
 */
export interface AnalyticsScheduleSuspended {
  reason: 'ownerGrant' | 'value' | string
  param?: string
  message?: string
}

/** One schedule of a report: what is sent, when (Riyadh time), in which language and to whom (analytics user ids). */
export interface AnalyticsSchedule {
  id: string
  cadence: AnalyticsScheduleCadence
  /** `HH:mm`, Asia/Riyadh. */
  time: string
  values: Record<string, ParamValue>
  lang: 'en' | 'ar'
  recipients: string[]
  enabled: boolean
  suspended?: AnalyticsScheduleSuspended | null
}

/** The body of a schedule's POST and PUT: the schedule without its id and its server-set suspension. */
export type AnalyticsScheduleWrite = Omit<AnalyticsSchedule, 'id' | 'suspended'>

/** What set a run going: its slot, its slot sent late (803's catch-up), or Send now. */
export type AnalyticsRunTrigger = 'schedule' | 'late' | 'sendNow'

/**
 * How a run ended: sent; sent with the HTML alone (the PDF render failed: "charts unavailable"); stopped on
 * `ANALYTICS-412`; a missed slot skipped (never sent twice); or failed to send. `open`: queued, not yet sent.
 */
export type AnalyticsRunOutcome = 'sent' | 'chartsUnavailable' | 'stopped' | 'skipped' | 'failed' | 'open'

/**
 * One kept run (`GET …/Runs`, `GET Analytics/ReportRun/{runId}`): the record is kept for good, the HTML and PDF for 90
 * days (`artefactsKept`; after that the artefact doors answer `410`). Open to the owner, curators and the run's own
 * recipients.
 */
export interface AnalyticsReportRun {
  id: string
  reportId: string
  scheduleId: string | null
  revision: number
  /** When it went, ISO local Riyadh time. */
  ranAt: string
  dataAsOf: string | null
  trigger: AnalyticsRunTrigger
  values: Record<string, ParamValue>
  recipients: AnalyticsAudienceUser[]
  /** Recipients who had left the audience, dropped from this run and listed to the owner. */
  dropped: AnalyticsAudienceUser[]
  outcome: AnalyticsRunOutcome
  /** The summary text that went, or null. */
  summary: AnalyticsLabel | null
  artefactsKept: boolean
  hasPdf: boolean
}

// ── Spec 3437 (BackOffice 3438–3442): the data catalog ──────────────────────────────────────────────────────────
// `GET Analytics/Catalog` (and `GET Analytics/Render/Catalog` under a catalog render ticket), as built on BackOffice
// branch spec3437 (`AnalyticsCatalog.cs`). camelCase, nulls written as null. Read through `boards/catalog-wire.ts`.

export type AnalyticsMartKind = 'mart' | 'fact' | 'dim'
export type AnalyticsPlannedStatus = 'idea' | 'approved' | 'building' | 'live'
export type AnalyticsAreaReader = 'copilot' | 'designer'

/** Saved items using an area, everyone's (cached ~120 s per host). `null` on the area = store fault, never 0. */
export interface AnalyticsCatalogUsedBy {
  views: number
  boards: number
  reports: number
}

export interface AnalyticsCatalogArea {
  key: string
  label: AnalyticsLabel
  description: AnalyticsLabel
  /** The role or team that owns the area ("Analytics team"); English server text. */
  owner: string
  available: boolean
  /** Only when `!available`. */
  unavailableReason: AnalyticsLabel | null
  /** Riyadh local, no zone ("2026-11-05T09:45:12"); '' = not known. */
  dataAsOf: string
  /** 'yyyy-MM-dd' | '<N>d' | ''. */
  historyStart: string
  refresh: AnalyticsLabel
  boundary: AnalyticsLabel[]
  /** Unknown readers are dropped by the reader. */
  readBy: AnalyticsAreaReader[]
  usedBy: AnalyticsCatalogUsedBy | null
  access: { grant: string }
  measures: AnalyticsMeasure[]
  /** The area's OWN dimensions. */
  dimensions: AnalyticsDimension[]
  /** Mart keys (resolve against `AnalyticsCatalog.marts`; a key with no mart object is tolerated). */
  marts: string[]
}

export interface AnalyticsCatalogColumn {
  name: string
  previewable: boolean
}

export interface AnalyticsCatalogMart {
  key: string
  kind: AnalyticsMartKind
  /** English only (the dbt description). */
  description: string
  /** English only, "One row per …"; '' = none. */
  grain: string
  /** TRANSITIVE source keys. */
  sources: string[]
  /** Curators only; null otherwise. */
  columns: AnalyticsCatalogColumn[] | null
  /** Curators only; null otherwise or for a view. */
  rows: number | null
  /** Curators only; null otherwise or for a view. */
  sizeMb: number | null
}

export interface AnalyticsCatalogSource {
  /** `<dbt source>.<table>`, e.g. `pos.RetailTrx`. */
  key: string
  server: string
  database: string
  table: string
  /** English only. */
  description: string
  /** Mart keys built from it. */
  usedBy: string[]
}

export interface AnalyticsCatalogPlanned {
  key: string
  label: AnalyticsLabel
  status: AnalyticsPlannedStatus
  questions: AnalyticsLabel[]
  sources: string[]
  /** Keys naming neither a lineage nor an untapped source (flagged, not dropped). */
  unknownSources: string[]
}

export interface AnalyticsCatalogUntapped {
  key: string
  server: string
  database: string
  table: string
  /** English only. */
  note: string
}

export interface AnalyticsCatalog {
  /** '' when `lineageAvailable` is false. */
  imageVersion: string
  /** false: the image has no `/catalog` (< 1.4.0) or it was unreadable → marts/sources empty, areas still served. */
  lineageAvailable: boolean
  areas: AnalyticsCatalogArea[]
  marts: AnalyticsCatalogMart[]
  sources: AnalyticsCatalogSource[]
  planned: AnalyticsCatalogPlanned[]
  untappedSources: AnalyticsCatalogUntapped[]
}
