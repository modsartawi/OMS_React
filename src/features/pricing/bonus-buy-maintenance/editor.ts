/**
 * The SAP-copy bonus-buy editor's pure half (ticket 417, BackOffice spec 2374).
 *
 * The page renders; this decides. The form's state, the `BonusBuy/Save` request it maps to
 * and from (`BbyBonusBuyRequest` in BackOffice's `BbyMaintainModels.cs`), the two layout
 * switches SAP's screen has (Total Minimum Value, Total Discount), Curr/Pe, the outcome of
 * Check and Save, and who may type. No React, no i18n: the page resolves every key.
 *
 * Numbers live in the state as the strings the inputs hold, and become numbers only in
 * `toRequest`. A blank amount is 0, which the server's validator refuses where 0 is wrong
 * (`BBY-QUANTITY`, `BBY-VALUE-RANGE`): the client never decides that a value is acceptable.
 */
import { formatDay } from '@/core/util/date-format'
import type {
  BbyBonusBuyDocument,
  BbyBonusBuyWire,
  BbyGroupingWire,
  BbyMaintainOutcome,
  BbyRefusal,
} from '@/core/models/bonus-buy-maintenance'
import { type EditorMode, type OverviewStatus, overviewStatus } from './overview'

/** SAP's `KONBBYT`: the bonus-buy text, at most 60. */
export const BBY_TEXT_MAX = 60
/** `BbyTestMark.Note` is `NVARCHAR(200)` (spec 2396): Mark Tested's optional note, at most 200. */
export const TEST_NOTE_MAX = 200
/** SAP's `GRPNR`: a local material grouping id, at most 12. */
export const GROUPING_ID_MAX = 12

/**
 * The unit the server writes when a line names none, and for every grouping member
 * (`BbyMaintainContainerBuilder.DefaultUom`). Shown, never sent: a blank unit stays blank on the wire.
 */
export const DEFAULT_UOM = 'EA'

/** The one organizational scope the copy offers: sales org `1000`, channel `20` (story 17). */
export const BBY_ORG = { salesOrg: '1000', channel: '20' } as const

/**
 * The bonus buy's currency follows its organisation (story 16) — SAP's `BBYCURH`, inert on
 * the wire. The copy offers one organisation, so this is one row; Bahrain's `BHD` arrives
 * here as a line of its own when its sales org is offered.
 */
export const ORG_CURRENCY: Record<string, string> = { '1000': 'SAR' }
export const orgCurrency = (salesOrg: string): string => ORG_CURRENCY[salesOrg] ?? ''

/** SAP's Link Category: `A` AND (every line), `O` OR (any line). */
export type LinkCategory = 'A' | 'O'
/** SAP's Scale Type (`STFKZ`): `A` From, `B` Up To, `C` Equal. */
export type ScaleType = 'A' | 'B' | 'C'
/** SAP's three reward kinds: `P` Discount Price, `R` Discount Amount, `%` Discount Percent. */
export type DiscountType = 'P' | 'R' | '%'
/** SAP's Line Item Type. */
export type LineItemType = 'material' | 'grouping'

export const LINK_CATEGORIES: readonly LinkCategory[] = ['A', 'O']
export const SCALE_TYPES: readonly ScaleType[] = ['A', 'B', 'C']
export const DISCOUNT_TYPES: readonly DiscountType[] = ['P', 'R', '%']

export interface BuyLine {
  key: string
  type: LineItemType
  identifier: string
  quantity: string
  uom: string
}

export interface GetLine {
  key: string
  /** The read's condition number; null on a line added here (the server mints it). */
  condNumber: string | null
  type: LineItemType
  identifier: string
  scaleType: ScaleType
  quantity: string
  uom: string
  discountType: DiscountType
  value: string
}

export interface EngineRules {
  includes: string
  excludes: string
  originFilter: string
  stackingExcludes: string
  loyGroups: string
  loyTiers: string
  isStackable: boolean
  maxValue: string
  score: string
  /** `HH:mm:ss`, as the time box holds it; `HHmmss` on the wire. */
  validFromTime: string
  validToTime: string
}

export interface EditorState {
  bbyNumber: string | null
  version: string | null
  promoNumber: string
  description: string
  validFrom: string
  validTo: string
  limitNumber: string
  linkBuy: LinkCategory
  linkGet: LinkCategory
  minValueOn: boolean
  minValue: string
  totalDiscountOn: boolean
  total: { condNumber: string | null; discountType: DiscountType; value: string }
  buy: BuyLine[]
  get: GetLine[]
  groupings: BbyGroupingWire[]
  engine: EngineRules
}

let keySeq = 0
/** A row key for React; never sent. */
export const lineKey = () => `l${++keySeq}`

export const emptyBuyLine = (): BuyLine => ({ key: lineKey(), type: 'material', identifier: '', quantity: '1', uom: '' })

export const emptyGetLine = (): GetLine => ({
  key: lineKey(),
  condNumber: null,
  type: 'material',
  identifier: '',
  scaleType: 'C',
  quantity: '1',
  uom: '',
  discountType: '%',
  value: '',
})

const EMPTY_ENGINE: EngineRules = {
  includes: '',
  excludes: '',
  originFilter: '',
  stackingExcludes: '',
  loyGroups: '',
  loyTiers: '',
  isStackable: false,
  maxValue: '0',
  score: '0',
  validFromTime: '',
  validToTime: '',
}

/** Create: a Planned bonus buy under the promotion, its dates taken from the promotion's window
 *  (story 15), one empty row on each side as SAP's table shows. */
export function newEditor(promo: { promoNumber: string; salesFrom: string | null; salesTo: string | null }): EditorState {
  return {
    bbyNumber: null,
    version: null,
    promoNumber: promo.promoNumber,
    description: '',
    validFrom: formatDay(promo.salesFrom),
    validTo: formatDay(promo.salesTo),
    limitNumber: '0',
    linkBuy: 'A',
    linkGet: 'A',
    minValueOn: false,
    minValue: '',
    totalDiscountOn: false,
    total: { condNumber: null, discountType: '%', value: '' },
    buy: [emptyBuyLine()],
    get: [emptyGetLine()],
    groupings: [],
    engine: { ...EMPTY_ENGINE },
  }
}

const str = (v: string | null | undefined) => v ?? ''
const numStr = (v: number | null | undefined) => (v == null ? '' : String(v))
const link = (v: string | null | undefined): LinkCategory => (v?.trim() === 'O' ? 'O' : 'A')
const scale = (v: string | null | undefined): ScaleType => {
  const c = v?.trim()
  return c === 'A' || c === 'B' ? c : 'C'
}
const discount = (v: string | null | undefined): DiscountType => {
  const c = v?.trim().toUpperCase()
  return c === 'P' || c === 'R' ? c : '%'
}
const lineType = (grouping: string | null | undefined): LineItemType => (grouping?.trim() ? 'grouping' : 'material')

/** Change / Display: the read's bonus buy, as the form holds it. */
export function fromDocument(doc: BbyBonusBuyDocument): EditorState {
  const b = doc.bonusBuy
  if (!b) throw new Error('fromDocument: the document carries no bonus buy')
  const r = b.engineRules
  return {
    bbyNumber: b.bbyNumber ?? doc.number,
    version: doc.version ?? b.version,
    promoNumber: str(b.promoNumber),
    description: str(b.description),
    validFrom: formatDay(b.validFrom),
    validTo: formatDay(b.validTo),
    limitNumber: numStr(b.limitNumber),
    linkBuy: link(b.linkCategoryBuy),
    linkGet: link(b.linkCategoryGet),
    minValueOn: (b.minValue ?? 0) > 0,
    minValue: (b.minValue ?? 0) > 0 ? numStr(b.minValue) : '',
    totalDiscountOn: b.totalDiscount != null,
    total: b.totalDiscount
      ? {
          condNumber: b.totalDiscount.condNumber ?? null,
          discountType: discount(b.totalDiscount.discountType),
          value: numStr(b.totalDiscount.value),
        }
      : { condNumber: null, discountType: '%', value: '' },
    buy: (b.buy ?? []).map((l) => ({
      key: lineKey(),
      type: lineType(l.grouping),
      identifier: str(l.grouping?.trim() ? l.grouping : l.material),
      quantity: numStr(l.quantity),
      uom: str(l.uom),
    })),
    get: (b.get ?? []).map((l) => ({
      key: lineKey(),
      condNumber: l.condNumber ?? null,
      type: lineType(l.grouping),
      identifier: str(l.grouping?.trim() ? l.grouping : l.material),
      scaleType: scale(l.scaleType),
      quantity: numStr(l.quantity),
      uom: str(l.uom),
      discountType: discount(l.discountType),
      value: numStr(l.value),
    })),
    groupings: (b.groupings ?? []).map((g) => ({ id: g.id, materials: [...(g.materials ?? [])] })),
    engine: r
      ? {
          includes: str(r.includes),
          excludes: str(r.excludes),
          originFilter: str(r.originFilter),
          stackingExcludes: str(r.stackingExcludes),
          loyGroups: str(r.loyGroups),
          loyTiers: str(r.loyTiers),
          isStackable: r.isStackable === true,
          maxValue: numStr(r.maxValue ?? 0),
          score: numStr(r.score ?? 0),
          validFromTime: timeFromWire(r.validFromTime),
          validToTime: timeFromWire(r.validToTime),
        }
      : { ...EMPTY_ENGINE },
  }
}

/** A typed amount as the wire's number: blank (or unreadable) is 0, for the validator to judge. */
function num(v: string): number {
  const n = Number(v.trim())
  return v.trim() === '' || !Number.isFinite(n) ? 0 : n
}

const orNull = (v: string): string | null => (v.trim() === '' ? null : v.trim())

/** `HHmmss` → `HH:mm:ss` for the time box; anything else → blank. */
export function timeFromWire(v: string | null | undefined): string {
  const s = (v ?? '').trim()
  return /^\d{6}$/.test(s) ? `${s.slice(0, 2)}:${s.slice(2, 4)}:${s.slice(4, 6)}` : ''
}

/** The time box's `HH:mm[:ss]` → `HHmmss`; blank → null (no time-of-day window). */
export function timeToWire(v: string): string | null {
  const m = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(v.trim())
  return m ? `${m[1]}${m[2]}${m[3] ?? '00'}` : null
}

/** The line's identifier as the wire's `material` / `grouping` pair, never both (SAP's Line Item Type). */
const identify = (type: LineItemType, identifier: string) => {
  const id = identifier.trim()
  return type === 'grouping' ? { material: null, grouping: id } : { material: id, grouping: null }
}

/**
 * The form as `BonusBuy/Save` (and `BonusBuy/Validate`) takes it. Empty rows are left out, as
 * SAP's table ignores them. Under Total Discount the get lines carry no reward of their own (the
 * server ignores them there, as SAP hides the columns) and the side panel's reward goes as
 * `totalDiscount`; its condition number travels only over the whole basket (an empty Get), the
 * one place the read gives one.
 */
export function toRequest(s: EditorState): BbyBonusBuyWire {
  const get = s.get.filter((l) => l.identifier.trim() !== '')
  return {
    bbyNumber: s.bbyNumber,
    version: s.version,
    promoNumber: s.promoNumber,
    description: s.description.trim(),
    validFrom: s.validFrom || null,
    validTo: s.validTo || null,
    limitNumber: num(s.limitNumber),
    minValue: s.minValueOn ? num(s.minValue) : 0,
    linkCategoryBuy: s.linkBuy,
    linkCategoryGet: s.linkGet,
    engineRules: {
      includes: orNull(s.engine.includes),
      excludes: orNull(s.engine.excludes),
      originFilter: orNull(s.engine.originFilter),
      stackingExcludes: orNull(s.engine.stackingExcludes),
      loyGroups: orNull(s.engine.loyGroups),
      loyTiers: orNull(s.engine.loyTiers),
      isStackable: s.engine.isStackable,
      maxValue: num(s.engine.maxValue),
      score: num(s.engine.score),
      validFromTime: timeToWire(s.engine.validFromTime),
      validToTime: timeToWire(s.engine.validToTime),
    },
    totalDiscount: s.totalDiscountOn
      ? {
          condNumber: get.length === 0 ? s.total.condNumber : null,
          discountType: s.total.discountType,
          value: num(s.total.value),
        }
      : null,
    buy: s.buy
      .filter((l) => l.identifier.trim() !== '')
      .map((l) => ({ ...identify(l.type, l.identifier), quantity: num(l.quantity), uom: orNull(l.uom) })),
    get: get.map((l) => ({
      condNumber: l.condNumber,
      ...identify(l.type, l.identifier),
      quantity: num(l.quantity),
      uom: orNull(l.uom),
      scaleType: l.scaleType,
      discountType: s.totalDiscountOn ? null : l.discountType,
      value: s.totalDiscountOn ? 0 : num(l.value),
    })),
    groupings: s.groupings.map((g) => ({ id: g.id, materials: [...g.materials] })),
  }
}

/**
 * Has the form moved off what it opened with? Compared as the request each would send, so a row
 * key or an untouched empty line is not a change. Mark Tested attests the SAVED bonus buy, so it
 * waits while this is true: the tester must never mark one version while looking at another.
 */
export function formChanged(opened: EditorState, now: EditorState): boolean {
  return JSON.stringify(toRequest(opened)) !== JSON.stringify(toRequest(now))
}

// ── layout ────────────────────────────────────────────────────────────────────────────

export type GetColumn =
  | 'type'
  | 'identifier'
  | 'description'
  | 'scaleType'
  | 'quantity'
  | 'unit'
  | 'discountType'
  | 'value'
  | 'currPe'

const GET_BASE: GetColumn[] = ['type', 'identifier', 'description', 'scaleType', 'quantity', 'unit']
const GET_REWARD: GetColumn[] = ['discountType', 'value', 'currPe']

/** Total Discount is the one switch that changes the Get panel's shape (2330 §4): ticked, the
 *  reward columns leave the grid and the side panel takes their place. */
export function getPanelLayout(totalDiscountOn: boolean): { columns: GetColumn[]; sidePanel: boolean } {
  return totalDiscountOn
    ? { columns: [...GET_BASE], sidePanel: true }
    : { columns: [...GET_BASE, ...GET_REWARD], sidePanel: false }
}

/** Total Minimum Value enables its amount; display never does. */
export function buyPanelLayout(s: Pick<EditorState, 'minValueOn'>, readOnly: boolean): { minAmountEnabled: boolean } {
  return { minAmountEnabled: !readOnly && s.minValueOn }
}

/** SAP's Curr/Pe: `%` for a percent, the currency otherwise. A Price is VAT-exclusive and says so (story 23). */
export function currPe(discountType: DiscountType, currency: string): { unit: string; exVat: boolean } {
  return discountType === '%' ? { unit: '%', exVat: false } : { unit: currency, exVat: discountType === 'P' }
}

// ── groupings ─────────────────────────────────────────────────────────────────────────

/** A grouping id as SAP keeps it: trimmed, upper-case, at most 12. */
export const normalizeGroupingId = (raw: string): string =>
  raw.trim().toUpperCase().slice(0, GROUPING_ID_MAX)

/** The popup's Confirm: add the grouping, or replace the one already under that id. */
export function upsertGrouping(s: EditorState, g: BbyGroupingWire): EditorState {
  const at = s.groupings.findIndex((x) => x.id === g.id)
  const groupings = at < 0 ? [...s.groupings, g] : s.groupings.map((x, i) => (i === at ? g : x))
  return { ...s, groupings }
}

// ── outcomes ──────────────────────────────────────────────────────────────────────────

/** The refusal that means "someone saved after you opened it": a reload, not a fix. */
export const STALE_VERSION_CODE = 'BBY-STALE-VERSION'

export type EditorOutcome =
  | { kind: 'valid' | 'saved'; number: string | null; refusals: BbyRefusal[]; warnings: BbyRefusal[] }
  | { kind: 'refused' | 'stale' | 'notFound'; number: string | null; refusals: BbyRefusal[]; warnings: BbyRefusal[] }

/**
 * Check's and Save's answer, read for the page. Every refusal and warning is kept, each with its
 * `BBY-` code and both languages (story 37). A stale version is its own kind: the page offers a
 * reload instead of a list to fix.
 */
export function readEditorOutcome(o: BbyMaintainOutcome): EditorOutcome {
  const refusals = o.refusals ?? []
  const warnings = o.warnings ?? []
  const number = o.number ?? null
  if (o.status === 'refused')
    return { kind: refusals.some((r) => r.code === STALE_VERSION_CODE) ? 'stale' : 'refused', number, refusals, warnings }
  if (o.status === 'notFound') return { kind: 'notFound', number, refusals, warnings }
  if (o.status === 'valid') return { kind: 'valid', number, refusals: [], warnings }
  return { kind: 'saved', number, refusals: [], warnings }
}

// ── who may type ──────────────────────────────────────────────────────────────────────

export interface EditorAccess {
  readOnly: boolean
  /**
   * Why it is read-only: Display was asked for, the bonus buy is SAP's, or its status is not
   * Planned (spec 2396: only Planned can change). `sap` stays its own reason so the hint says
   * "SAP's", never "take it back to Planned" — a SAP bonus buy has no way back.
   */
  reason: 'display' | 'sap' | 'locked' | null
  canSave: boolean
  canCheck: boolean
  canCopy: boolean
  /** Planned → Tested: the tester grant, a Planned OMS bonus buy. */
  canMarkTested: boolean
  /** Tested / Activated / Deactivated → Planned, on an OMS bonus buy. */
  canBackToPlanned: boolean
  /** Back to Planned on an Activated bonus buy pulls the offer off the tills: ask first. */
  backToPlannedAsks: boolean
}

/** The statuses Back to Planned leaves from (ADR 0063). */
const BACK_TO_PLANNED_FROM: readonly OverviewStatus[] = ['tested', 'activated', 'deactivated']

/**
 * Display opens any bonus buy read-only (story 42). A SAP bonus buy is read-only whatever the
 * mode, since only Copy may change it (story 56), and it is never tested here. An OMS bonus buy
 * is editable only while Planned (spec 2396, ADR 0063 — reversing 2374's live change of an
 * activated one); an unreadable status is locked too, never guessed editable. The page wraps the
 * whole form in one disabled `<fieldset>` when `readOnly`, so no input can escape it.
 *
 * Mark Tested and Back to Planned are status acts, not edits: Display offers them as Change does.
 * `canTest` is the access answer's tester grant (`canMarkTested`), read by the caller. The
 * four-eyes rule (the tester is not the last writer) is the server's, never pre-judged here.
 */
export function editorAccess(
  mode: EditorMode,
  doc: Pick<BbyBonusBuyDocument, 'readOnly' | 'bbyStatus'> | null,
  canTest = false,
): EditorAccess {
  const sap = doc?.readOnly === true
  const status: OverviewStatus = doc ? overviewStatus(doc.bbyStatus) : 'planned'
  const reason = mode === 'display' ? 'display' : sap ? 'sap' : status !== 'planned' ? 'locked' : null
  const readOnly = reason !== null
  const existing = mode !== 'create' && doc !== null && !sap
  return {
    readOnly,
    reason,
    canSave: !readOnly,
    canCheck: !readOnly,
    canCopy: mode !== 'create',
    canMarkTested: existing && status === 'planned' && canTest,
    canBackToPlanned: existing && BACK_TO_PLANNED_FROM.includes(status),
    backToPlannedAsks: existing && status === 'activated',
  }
}
