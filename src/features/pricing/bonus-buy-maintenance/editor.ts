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
import { type CodeListMeter, codeListMeter, normaliseCodeList, pastedCodes } from '@/core/util/code-list'
import { formatMoneyIn, formatMoneyOfUnknownCurrency } from '@/core/money'
import { minInclVat } from '@/core/bonus-buy/min-basis'
import { type SalesAreaFields, readSalesArea } from '@/core/bonus-buy/sales-area'
import { formatRate } from '@/core/util/bidi'
import { formatDay } from '@/core/util/date-format'
import type {
  BbyBonusBuyDocument,
  BbyBonusBuyWire,
  BbyCouponMaterialResult,
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

/**
 * The bonus buy's Organizational Data and currency (story 16, SAP's `BBYCURH`) are its
 * promotion's **sales area** (BackOffice spec 4096): KSA `1000` / `20` in SAR, or Bahrain
 * `1000` / `21` in BHD. Read off the promotion document, never sent: the server takes the
 * sales area from the promotion. A document with no pair (an old server) is KSA. A name the
 * server does not send is `null`, for the page to word from its own keys.
 */
export interface EditorSalesArea {
  salesOrganization: string
  salesOrganizationName: string | null
  distributionChannel: string
  distributionChannelName: string | null
  currency: string
}

export function editorSalesArea(
  promo: (SalesAreaFields & { salesOrganizationName?: string | null; distributionChannelName?: string | null }) | null | undefined,
): EditorSalesArea {
  const area = readSalesArea(promo)
  return {
    salesOrganization: area.salesOrganization,
    salesOrganizationName: promo?.salesOrganizationName?.trim() || null,
    distributionChannel: area.distributionChannel,
    distributionChannelName: promo?.distributionChannelName?.trim() || null,
    currency: area.currency,
  }
}

/** The names the client keeps for the closed list's codes, for a server that sends none. */
const ORG_NAME_KEYS = {
  salesOrg: { '1000': 'editor.org.salesOrg1000' },
  channel: { '20': 'editor.org.channel20', '21': 'editor.org.channel21' },
} as const satisfies Record<'salesOrg' | 'channel', Record<string, string>>

/** The locale key naming a sales org or channel code, or `null` for a code outside the list. */
export function orgNameKey(kind: 'salesOrg' | 'channel', code: string): string | null {
  return (ORG_NAME_KEYS[kind] as Record<string, string>)[code] ?? null
}

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
  /** Per (spec 639 D7): how many units `value` is for, as the box holds it. Kept across a type change. */
  per: string
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

/** The six Engine Rules lists: codes pasted or typed into a multi-line box (ticket 420). */
export type EngineListKey = 'includes' | 'excludes' | 'originFilter' | 'stackingExcludes' | 'loyGroups' | 'loyTiers'
export const ENGINE_LISTS: readonly EngineListKey[] = ['includes', 'excludes', 'originFilter', 'stackingExcludes', 'loyGroups', 'loyTiers']

/**
 * The origin filter's width (spec 2374: `BbyMaintainWidths.OriginFilter` 50). ⚠ Flip to 3000 only
 * with or after BackOffice 2403 (spec 2396 story 34): until every store's column is widened, the
 * server keeps refusing past 50.
 */
export const ORIGIN_FILTER_MAX = 50
/** The width each list's box shows its stored length against (the other five kept from 2374). */
export const ENGINE_LIST_MAX: Record<EngineListKey, number> = {
  includes: 500,
  excludes: 500,
  originFilter: ORIGIN_FILTER_MAX,
  stackingExcludes: 500,
  loyGroups: 500,
  loyTiers: 500,
}
/** The server upper-cases these two lists, and no other (`BbyMaintainValidator`). */
const UPPER_LISTS: ReadonlySet<EngineListKey> = new Set<EngineListKey>(['loyGroups', 'loyTiers'])

const normaliseEngineList = (key: EngineListKey, value: string): string =>
  normaliseCodeList(value, { upper: UPPER_LISTS.has(key) })

/**
 * What a list box shows beside it: how many codes it holds, and the stored length against its cap.
 * Both read the list as the server will store it, never the raw paste. Over the cap is shown, not
 * blocked: the server's width refusal is the one that decides.
 */
export const engineListMeter = (key: EngineListKey, value: string): CodeListMeter =>
  codeListMeter(value, ENGINE_LIST_MAX[key], { upper: UPPER_LISTS.has(key) })

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
  /** The minimum is incl. VAT (spec 4040). Travels only while the minimum is on with a value. */
  minValueInclVat: boolean
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
  per: '1',
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
    minValueInclVat: false,
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
    minValueInclVat: minInclVat(b),
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
      // A read's 0 (a percent line, Total Discount, or an older server) opens as 1 (spec 639 D7).
      per: (l.pricingUnit ?? 0) > 0 ? numStr(l.pricingUnit) : '1',
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

/** A box's number, or null when it is blank or not a number. The one parse of a typed box. */
const boxNumber = (v: string): number | null => {
  if (v.trim() === '') return null
  const n = Number(v.trim())
  return Number.isFinite(n) ? n : null
}

/** A typed amount as the wire's number: blank (or unreadable) is 0, for the validator to judge. */
const num = (v: string): number => boxNumber(v) ?? 0

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
    // A mark whose box is disabled (no minimum to measure) never travels.
    minValueInclVat: s.minValueInclVat && minValueApplies(s),
    linkCategoryBuy: s.linkBuy,
    linkCategoryGet: s.linkGet,
    engineRules: {
      // Each list goes up as the comma list the server stores (ticket 420), so a pasted column is
      // whole even on a server that does not yet split on newline and tab (BackOffice 2400).
      includes: orNull(normaliseEngineList('includes', s.engine.includes)),
      excludes: orNull(normaliseEngineList('excludes', s.engine.excludes)),
      originFilter: orNull(normaliseEngineList('originFilter', s.engine.originFilter)),
      stackingExcludes: orNull(normaliseEngineList('stackingExcludes', s.engine.stackingExcludes)),
      loyGroups: orNull(normaliseEngineList('loyGroups', s.engine.loyGroups)),
      loyTiers: orNull(normaliseEngineList('loyTiers', s.engine.loyTiers)),
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
      // A blank Per goes up as 0, for the server's BBY-PRICING-UNIT (spec 639 D2).
      pricingUnit: getLineShowsPer(s.totalDiscountOn, l.discountType) ? num(l.per) : 0,
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
  | 'per'
  | 'currPe'

const GET_BASE: GetColumn[] = ['type', 'identifier', 'description', 'scaleType', 'quantity', 'unit']
const GET_REWARD: GetColumn[] = ['discountType', 'value', 'per', 'currPe']

/** Total Discount is the one switch that changes the Get panel's shape (2330 §4): ticked, the
 *  reward columns leave the grid and the side panel takes their place. */
export function getPanelLayout(totalDiscountOn: boolean): { columns: GetColumn[]; sidePanel: boolean } {
  return totalDiscountOn
    ? { columns: [...GET_BASE], sidePanel: true }
    : { columns: [...GET_BASE, ...GET_REWARD], sidePanel: false }
}

/**
 * Whether the minimum has something to be incl. VAT about (spec 4040 story 3): ticked, with an
 * amount above 0. The mark is offered, and sent, only then.
 */
const minValueApplies = (s: Pick<EditorState, 'minValueOn' | 'minValue'>): boolean =>
  s.minValueOn && (boxNumber(s.minValue) ?? 0) > 0

/**
 * Total Minimum Value enables its amount, and the amount enables its incl. VAT mark; display enables
 * neither. `inclVatChecked` is what the box shows: the same reading `toRequest` sends, so the box is
 * never ticked while the request would say off (display still shows a stored mark ticked).
 */
export function buyPanelLayout(
  s: Pick<EditorState, 'minValueOn' | 'minValue' | 'minValueInclVat'>,
  readOnly: boolean,
): { minAmountEnabled: boolean; inclVatEnabled: boolean; inclVatChecked: boolean } {
  return {
    minAmountEnabled: !readOnly && s.minValueOn,
    inclVatEnabled: !readOnly && minValueApplies(s),
    inclVatChecked: s.minValueInclVat && minValueApplies(s),
  }
}

/** Ticking or unticking Total Minimum Value. Unticking clears the incl. VAT mark (ticket 920). */
export function setMinValueOn(s: EditorState, on: boolean): EditorState {
  return on ? { ...s, minValueOn: true } : { ...s, minValueOn: false, minValueInclVat: false }
}

/**
 * Typing the minimum amount. An amount that stops being above 0 clears the incl. VAT mark, so a
 * mark the disabled box never showed cannot come back when the amount is retyped (ticket 920).
 */
export function setMinValue(s: EditorState, minValue: string): EditorState {
  const next = { ...s, minValue }
  return minValueApplies(next) ? next : { ...next, minValueInclVat: false }
}

/**
 * A get line carries a Per box only on a Discount Price or Discount Amount, and never under Total
 * Discount (spec 639 D8): a percent has no Per, and the bundle total keeps the "lines together" 0.
 */
export const getLineShowsPer = (totalDiscountOn: boolean, discountType: DiscountType): boolean =>
  !totalDiscountOn && discountType !== '%'

/**
 * A box's Per as a count, or null when it is not one. Per counts only as a whole number ≥ 1 —
 * anything else the server refuses (`BBY-PRICING-UNIT`) — so Curr/Pe and the hint read it by
 * this one rule.
 */
const perCount = (v: string): number | null => {
  const n = boxNumber(v)
  return n !== null && Number.isInteger(n) && n >= 1 ? n : null
}

/**
 * SAP's Curr/Pe: `%` for a percent, the currency otherwise. A Price is VAT-exclusive and says so
 * (story 23). With a whole Per above 1 it reads the rate as SAP shows it, `SAR / 4 EA`, in the
 * line's own unit (EA when it names none) — one string, for the caller to isolate once (spec 639
 * D9). Any other Per (1, blank, 0.5, 2.5) reads plain. A blank currency (a promotion off the
 * sales-area list whose server sent none) names no unit: the page words it as unknown.
 */
export function currPe(discountType: DiscountType, currency: string, per = '1', uom = ''): { unit: string; exVat: boolean } {
  if (discountType === '%') return { unit: '%', exVat: false }
  if (!currency.trim()) return { unit: '', exVat: discountType === 'P' }
  const n = perCount(per)
  const unit = n !== null && n > 1 ? formatRate(currency, n, uom.trim() || DEFAULT_UOM) : currency
  return { unit, exVat: discountType === 'P' }
}

/** What the till will charge for a get line's quantity (spec 639 D10): a key plus whole formatted values. */
export interface PerHint {
  key: `editor.hint.${'P' | 'R'}.${ScaleType}`
  /** `total` and `rate` are amount + currency as one value; `quantity` is quantity + unit as one value. */
  values: { total: string; quantity: string; rate?: string }
}

/**
 * The hint under a Discount Price or Discount Amount get line: `value / Per × quantity` in the
 * currency's grouped money, worded by scale type (Equal "for", From "for, then each" with the
 * rate `value / Per`, Up To "for up to"). Nothing for a blank or non-numeric input, a quantity
 * ≤ 0, a value < 0, a Per that is not a whole number ≥ 1, a percent, or under Total Discount. It
 * decides nothing: no refusal, no colour, no blocking.
 */
export function perHint(
  totalDiscountOn: boolean,
  line: Pick<GetLine, 'discountType' | 'value' | 'per' | 'quantity' | 'uom' | 'scaleType'>,
  currency: string,
): PerHint | null {
  if (totalDiscountOn || line.discountType === '%') return null
  const value = boxNumber(line.value)
  const per = perCount(line.per)
  const quantity = boxNumber(line.quantity)
  if (value === null || per === null || quantity === null || value < 0 || quantity <= 0) return null
  const rate = value / per
  // A blank currency is unknown, not SAR: every stored digit, and no trailing blank unit.
  const money = (n: number) =>
    currency.trim() ? `${formatMoneyIn(n, currency)} ${currency}` : formatMoneyOfUnknownCurrency(n)
  return {
    key: `editor.hint.${line.discountType}.${line.scaleType}`,
    values: {
      total: money(rate * quantity),
      quantity: `${quantity} ${line.uom.trim() || DEFAULT_UOM}`,
      ...(line.scaleType === 'A' ? { rate: money(rate) } : {}),
    },
  }
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

/**
 * Refusals the client can word itself when the server sends no English (spec 639 D11): only codes
 * minted with an en fallback key. Every other refusal is shown exactly as the server worded it.
 */
const REFUSAL_FALLBACK: ReadonlySet<string> = new Set(['BBY-PRICING-UNIT'])

/** The en key to show for a refusal that came without English, or null when it needs none. */
export const refusalFallbackKey = (r: Pick<BbyRefusal, 'code' | 'english'>): string | null =>
  (r.english ?? '').trim() === '' && REFUSAL_FALLBACK.has(r.code) ? `editor.refusal.${r.code}` : null

/**
 * A refusal's English as shown — the editor's and the upload's alike: the en fallback for a code
 * minted with one when the server sent no English, the server's own words otherwise. `t` resolves
 * the key, so this stays free of i18n.
 */
export const refusalText = (r: { code: string; english?: string | null }, t: (key: string) => string): string => {
  const fallback = refusalFallbackKey({ code: r.code, english: r.english ?? '' })
  return fallback ? t(fallback) : (r.english ?? '')
}

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

/**
 * The codes of BackOffice 3179's two loyalty-group findings: a code that is not a defined group
 * (refused) and a defined but inactive one (warned; the save goes through).
 * As 3179 shipped them (brief Changes 2026-10-28), both raised on a save only — a check-only run
 * never lists them.
 */
export const LOY_GROUP_FINDING_CODES: ReadonlySet<string> = new Set(['BBY-LOYGROUP-UNKNOWN', 'BBY-LOYGROUP-INACTIVE'])

/** The Loyalty groups field's own findings from a Check or Save, listed under the field (636). */
export interface LoyGroupFindings {
  refusals: BbyRefusal[]
  warnings: BbyRefusal[]
}

export const NO_LOY_FINDINGS: LoyGroupFindings = { refusals: [], warnings: [] }

/**
 * The findings still shown on the field (review fix 7): a Check or Save answered one value; once the
 * field moves off it, its findings (and the field's invalid state) are gone.
 */
export function loyFindingsAfterEdit(findings: LoyGroupFindings, checked: string, current: string): LoyGroupFindings {
  return current === checked ? findings : NO_LOY_FINDINGS
}

export function loyGroupFindings(o: EditorOutcome): LoyGroupFindings {
  const mine = (r: BbyRefusal) => LOY_GROUP_FINDING_CODES.has(r.code)
  return { refusals: o.refusals.filter(mine), warnings: o.warnings.filter(mine) }
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
  /** Tested / Deactivated → Activated, on an OMS bonus buy (ticket 493). The page asks first. */
  canActivate: boolean
  /** Activated → Deactivated, on an OMS bonus buy (ticket 493). The page asks first. */
  canDeactivate: boolean
}

/**
 * An OMS bonus buy's number, exactly as the server tells one from SAP's (`OmsBonusBuyNumber`,
 * `BbyMaintainWebService`). SAP-ness is read from this, never from `readOnly`: since BackOffice 2398
 * the server sends `readOnly` for an OMS bonus buy that is not Planned too.
 */
const OMS_BONUS_BUY_NUMBER = /^OMS[0-9]{9}$/

/** The statuses Back to Planned leaves from (ADR 0063). */
const BACK_TO_PLANNED_FROM: readonly OverviewStatus[] = ['tested', 'activated', 'deactivated']
/** The statuses Activate leaves from: Planned → Activated is refused (ADR 0063). */
const ACTIVATE_FROM: readonly OverviewStatus[] = ['tested', 'deactivated']

/**
 * Display opens any bonus buy read-only (story 42). A SAP bonus buy is read-only whatever the
 * mode, since only Copy may change it (story 56), and it is never tested here. An OMS bonus buy
 * is editable only while Planned (spec 2396, ADR 0063 — reversing 2374's live change of an
 * activated one); an unreadable status is locked too, never guessed editable. The page wraps the
 * whole form in one disabled `<fieldset>` when `readOnly`, so no input can escape it.
 *
 * Mark Tested, Back to Planned, Activate and Deactivate are status acts, not edits: Display offers
 * them as Change does. Activate and Deactivate sit here too (ticket 493) so correcting a live bonus
 * buy never sends anyone back to the overview.
 * `canTest` is the tester grant (`canTestBbyMaintain`), read by the caller. There is no
 * four-eyes rule (owner ruling 2026-10-07): the last writer may mark it Tested.
 */
export function editorAccess(
  mode: EditorMode,
  doc: Pick<BbyBonusBuyDocument, 'number' | 'readOnly' | 'bbyStatus'> | null,
  canTest = false,
): EditorAccess {
  const sap = doc !== null && !OMS_BONUS_BUY_NUMBER.test(doc.number)
  const status: OverviewStatus = doc ? overviewStatus(doc.bbyStatus) : 'planned'
  // The server's `readOnly` on an OMS bonus buy means locked; honour it even if the status reads Planned.
  const locked = status !== 'planned' || doc?.readOnly === true
  const reason = mode === 'display' ? 'display' : sap ? 'sap' : locked ? 'locked' : null
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
    canActivate: existing && ACTIVATE_FROM.includes(status),
    canDeactivate: existing && status === 'activated',
  }
}

// ── a new coupon material (ticket 422) ────────────────────────────────────────────────

/**
 * New coupon material is offered on a Buy line whose Line Item Type is Material, while the bonus
 * buy may be typed into: a Planned OMS one, or a new one before its first Save (spec 2396 stories
 * 44, 49). Never on a grouping line, never read-only (Display, SAP, or any status but Planned).
 */
export const couponMaterialOffered = (access: Pick<EditorAccess, 'readOnly'>, line: Pick<BuyLine, 'type'>): boolean =>
  !access.readOnly && line.type === 'material'

/** The prompt's description starts as the bonus buy's text; the user may change it. */
export const couponMaterialDefault = (s: Pick<EditorState, 'description'>): string => s.description.trim()

export type GenerateOutcome = { kind: 'saved'; material: string } | { kind: 'refused'; refusals: BbyRefusal[] }

/**
 * Generate's answer, read for the page. Only a `saved` that names a material fills the line: an
 * answer without one is never turned into a number. Any refusals the server sends are kept as they
 * came (EN + AR); the spec names none, so a bare `refused` carries an empty list.
 */
export function readGenerateOutcome(r: BbyCouponMaterialResult): GenerateOutcome {
  const material = r.material?.trim() ?? ''
  if (r.status === 'saved' && material !== '') return { kind: 'saved', material }
  return { kind: 'refused', refusals: r.refusals ?? [] }
}

/**
 * The generated number fills the line it was asked for, as a typed material would. A line removed,
 * or turned into a grouping, while the call was out is left alone: the material still exists on the
 * server, unused, and nothing else on the form moves.
 */
export function fillCouponMaterial(s: EditorState, key: string, material: string): EditorState {
  return { ...s, buy: s.buy.map((l) => (isCouponTarget(l, key) ? { ...l, identifier: material } : l)) }
}

/** The line a generated number goes on: the one it was asked for, still a Material. */
const isCouponTarget = (l: BuyLine, key: string): boolean => l.key === key && l.type === 'material'

/** Whether `fillCouponMaterial` would place the number: the line is still there, still a Material. */
export const couponMaterialLands = (s: Pick<EditorState, 'buy'>, key: string): boolean =>
  s.buy.some((l) => isCouponTarget(l, key))

/**
 * Materials pasted into a paste box (the Buy and Get panels' and the grouping dialog's). The text
 * splits like the Engine Rules lists (`normaliseCodeList`: an Excel column or row, commas, spaces).
 * Each code is kept once, and a code the target already holds is skipped, so pasting the same
 * column twice adds nothing.
 */
export const pastedMaterials = pastedCodes

/** Whether a line is the blank row a new panel starts with: a Material with no identifier. */
const isBlankLine = (l: BuyLine | GetLine): boolean => l.type === 'material' && l.identifier.trim() === ''

/**
 * Pasted materials become Material lines at the end of the Buy or Get panel, each with the panel's
 * defaults (quantity 1; a Get line's discount still to fill). Blank Material rows are dropped, so
 * a new bonus buy's empty first row does not sit above the pasted ones.
 */
export function pasteLines(s: EditorState, side: 'buy' | 'get', text: string): EditorState {
  if (side === 'buy') {
    const codes = pastedMaterials(text, s.buy.filter((l) => l.type === 'material').map((l) => l.identifier))
    if (codes.length === 0) return s
    const kept = s.buy.filter((l) => !isBlankLine(l))
    return { ...s, buy: [...kept, ...codes.map((identifier) => ({ ...emptyBuyLine(), identifier }))] }
  }
  const codes = pastedMaterials(text, s.get.filter((l) => l.type === 'material').map((l) => l.identifier))
  if (codes.length === 0) return s
  const kept = s.get.filter((l) => !isBlankLine(l))
  return { ...s, get: [...kept, ...codes.map((identifier) => ({ ...emptyGetLine(), identifier }))] }
}

/**
 * Pasted materials joined to a grouping's material rows: the typed ones kept, the pasted ones
 * after them, and one blank row at the end to keep typing in.
 */
export function pasteGroupingMaterials(materials: readonly string[], text: string): string[] {
  const kept = materials.map((m) => m.trim()).filter((m) => m !== '')
  return [...kept, ...pastedMaterials(text, kept), '']
}
