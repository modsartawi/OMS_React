/**
 * Ticket 417 — the SAP-copy bonus-buy editor's pure seam (BackOffice spec 2374).
 *
 * The page is a thin renderer over `editor.ts`; every decision the ticket's Proof names lives
 * there: the two layout switches, Curr/Pe, the state ↔ `BonusBuy/Save` mapping, the outcome
 * reading (refusals, stale version) and display mode's read-only answer.
 */
import { describe, expect, it } from 'vitest'
import type {
  BbyBonusBuyDocument,
  BbyBonusBuyWire,
  BbyMaintainOutcome,
} from '@/core/models/bonus-buy-maintenance'
import {
  ENGINE_LIST_MAX,
  ORIGIN_FILTER_MAX,
  buyPanelLayout,
  couponMaterialDefault,
  couponMaterialLands,
  couponMaterialOffered,
  currPe,
  editorAccess,
  emptyBuyLine,
  engineListMeter,
  fillCouponMaterial,
  formChanged,
  fromDocument,
  getPanelLayout,
  newEditor,
  normalizeGroupingId,
  readEditorOutcome,
  readGenerateOutcome,
  timeFromWire,
  timeToWire,
  toRequest,
  upsertGrouping,
} from './editor'

const PROMO = { promoNumber: 'P000000001', salesFrom: '2026-10-05T00:00:00', salesTo: '2026-10-31T00:00:00' }

/** The owner's third captured shape (2330 §6, `000100001124`) widened to a non-trivial line
 *  count: an AND buy side of a material, a grouping and a coupon, a 100 SAR minimum value, and
 *  OR-linked rewards of every discount type and scale type — so a swapped key cannot pass. */
const WIRE: BbyBonusBuyWire = {
  bbyNumber: 'OMS000000124',
  version: '2026-10-05T09:14:03.117',
  promoNumber: 'P000000001',
  description: 'OR when apply discount',
  validFrom: '2026-10-05T00:00:00',
  validTo: '2026-10-31T00:00:00',
  limitNumber: 2,
  minValue: 100,
  linkCategoryBuy: 'A',
  linkCategoryGet: 'O',
  engineRules: {
    includes: '200033,200034',
    excludes: null,
    originFilter: '10',
    stackingExcludes: 'OMS000000001',
    loyGroups: 'GOLD',
    loyTiers: 'T1,T2',
    isStackable: true,
    maxValue: 0,
    score: 5,
    validFromTime: '080000',
    validToTime: '220000',
  },
  totalDiscount: null,
  buy: [
    { material: '200033', grouping: null, quantity: 2, uom: 'EA' },
    { material: null, grouping: 'GROUP1', quantity: 1, uom: 'EA' },
    { material: 'COUP01', grouping: null, quantity: 1, uom: 'EA' },
  ],
  get: [
    { condNumber: 'OMS0000101', material: '200044', grouping: null, quantity: 3, uom: 'EA', scaleType: 'C', discountType: 'P', value: 15 },
    { condNumber: 'OMS0000102', material: '200055', grouping: null, quantity: 2, uom: 'EA', scaleType: 'A', discountType: 'R', value: 10.5 },
    { condNumber: 'OMS0000103', material: null, grouping: 'GROUP2', quantity: 1, uom: 'EA', scaleType: 'B', discountType: '%', value: 100 },
    { condNumber: 'OMS0000104', material: '200077', grouping: null, quantity: 4, uom: 'EA', scaleType: 'C', discountType: '%', value: 12.125 },
  ],
  groupings: [
    { id: 'GROUP1', materials: ['200011', '200012', '200013'] },
    { id: 'GROUP2', materials: ['200021', '200022'] },
  ],
}

const doc = (over: Partial<BbyBonusBuyDocument> = {}): BbyBonusBuyDocument => ({
  status: 'found',
  number: 'OMS000000124',
  bonusBuy: WIRE,
  bbyStatus: '1',
  readOnly: false,
  version: WIRE.version,
  changedBy: 'msartawi',
  changedAt: '2026-10-05T09:14:03',
  ...over,
})

const msg = (code: string) => ({ code, english: `${code} in English`, arabic: `${code} بالعربية` })
const outcome = (o: Partial<BbyMaintainOutcome>): BbyMaintainOutcome => ({
  status: 'saved',
  number: null,
  refusals: [],
  warnings: [],
  ...o,
})

describe('total discount swaps the reward columns for the side panel', () => {
  it('unticked: the get grid carries Discount Type, Value and Curr/Pe, and there is no side panel', () => {
    const layout = getPanelLayout(false)
    expect(layout.sidePanel).toBe(false)
    expect(layout.columns).toEqual([
      'type', 'identifier', 'description', 'scaleType', 'quantity', 'unit', 'discountType', 'value', 'currPe',
    ])
  })

  it('ticked: the three reward columns leave the grid and the side panel appears', () => {
    const layout = getPanelLayout(true)
    expect(layout.sidePanel).toBe(true)
    expect(layout.columns).toEqual(['type', 'identifier', 'description', 'scaleType', 'quantity', 'unit'])
    expect(layout.columns).not.toContain('discountType')
  })

  it('ticked, the request carries the side panel’s reward and no per-line reward', () => {
    const s = fromDocument(doc())
    const req = toRequest({ ...s, totalDiscountOn: true, total: { condNumber: null, discountType: 'P', value: '45' } })
    expect(req.totalDiscount).toEqual({ condNumber: null, discountType: 'P', value: 45 })
    expect(req.get.map((g) => [g.discountType, g.value])).toEqual([[null, 0], [null, 0], [null, 0], [null, 0]])
    // …and the per-line rewards survive in the state, so unticking brings them back.
    expect(toRequest({ ...s, totalDiscountOn: false }).get.map((g) => g.discountType)).toEqual(['P', 'R', '%', '%'])
  })

  it('a basket Total Discount (empty Get) keeps the read’s get-total condition number; over lines it does not', () => {
    const basket = fromDocument(
      doc({ bonusBuy: { ...WIRE, get: [], totalDiscount: { condNumber: 'OMS0000200', discountType: '%', value: 10 } } }),
    )
    expect(basket.totalDiscountOn).toBe(true)
    expect(toRequest(basket).totalDiscount).toEqual({ condNumber: 'OMS0000200', discountType: '%', value: 10 })
    const overLines = { ...basket, get: fromDocument(doc()).get }
    expect(toRequest(overLines).totalDiscount?.condNumber).toBeNull()
  })
})

describe('total minimum value enables its amount', () => {
  it('the amount is enabled only while the box is ticked, and never in display', () => {
    const s = newEditor(PROMO)
    expect(buyPanelLayout(s, false).minAmountEnabled).toBe(false)
    expect(buyPanelLayout({ ...s, minValueOn: true }, false).minAmountEnabled).toBe(true)
    expect(buyPanelLayout({ ...s, minValueOn: true }, true).minAmountEnabled).toBe(false)
  })

  it('unticked sends 0 whatever the amount box still holds; ticked sends the amount', () => {
    const s = { ...newEditor(PROMO), minValue: '100' }
    expect(toRequest({ ...s, minValueOn: false }).minValue).toBe(0)
    expect(toRequest({ ...s, minValueOn: true }).minValue).toBe(100)
  })

  it('a read with a minimum value opens ticked', () => {
    expect(fromDocument(doc()).minValueOn).toBe(true)
    expect(fromDocument(doc({ bonusBuy: { ...WIRE, minValue: 0 } })).minValueOn).toBe(false)
  })
})

describe('curr/pe shows % for percent and the currency otherwise; price carries ex-VAT', () => {
  it('percent → %, no ex-VAT tag', () => {
    expect(currPe('%', 'SAR')).toEqual({ unit: '%', exVat: false })
  })
  it('amount → the currency, no tag', () => {
    expect(currPe('R', 'SAR')).toEqual({ unit: 'SAR', exVat: false })
    expect(currPe('R', 'BHD')).toEqual({ unit: 'BHD', exVat: false })
  })
  it('price → the currency, tagged ex-VAT', () => {
    expect(currPe('P', 'SAR')).toEqual({ unit: 'SAR', exVat: true })
  })
})

describe('editor state maps to the BonusBuy/Save request and back', () => {
  it('a read round-trips to the same request — every line, grouping and engine rule in place', () => {
    const req = toRequest(fromDocument(doc()))
    expect(req).toEqual({
      ...WIRE,
      // Dates go back as the day the user sees; the server reads them as local days.
      validFrom: '2026-10-05',
      validTo: '2026-10-31',
    })
  })

  it('sends back the version it read and the bonus buy’s own number', () => {
    const req = toRequest(fromDocument(doc()))
    expect(req.version).toBe('2026-10-05T09:14:03.117')
    expect(req.bbyNumber).toBe('OMS000000124')
  })

  it('a new bonus buy carries no number and no version, and its dates default from the promotion', () => {
    const req = toRequest(newEditor(PROMO))
    expect(req.bbyNumber).toBeNull()
    expect(req.version).toBeNull()
    expect(req.promoNumber).toBe('P000000001')
    expect([req.validFrom, req.validTo]).toEqual(['2026-10-05', '2026-10-31'])
  })

  it('a new get line carries no condition number; a kept one keeps the read’s', () => {
    const s = fromDocument(doc())
    const added = { ...s.get[0], key: 'new', condNumber: null, identifier: '200099' }
    const req = toRequest({ ...s, get: [...s.get, added] })
    expect(req.get.map((g) => g.condNumber)).toEqual(['OMS0000101', 'OMS0000102', 'OMS0000103', 'OMS0000104', null])
  })

  it('a line names a material or a grouping by its Line Item Type, never both', () => {
    const s = fromDocument(doc())
    expect(s.buy.map((b) => [b.type, b.identifier])).toEqual([
      ['material', '200033'],
      ['grouping', 'GROUP1'],
      ['material', 'COUP01'],
    ])
    const flipped = { ...s, buy: [{ ...s.buy[0], type: 'grouping' as const, identifier: 'GROUP2' }] }
    expect(toRequest(flipped).buy[0]).toMatchObject({ material: null, grouping: 'GROUP2' })
  })

  it('an empty row is left out, as SAP’s table ignores it', () => {
    const s = newEditor(PROMO)
    expect(s.buy).toHaveLength(1)
    expect(s.get).toHaveLength(1)
    const req = toRequest(s)
    expect(req.buy).toEqual([])
    expect(req.get).toEqual([])
  })

  it('blank engine rules mean no restriction — sent as null, never as an empty list', () => {
    const r = toRequest(newEditor(PROMO)).engineRules
    expect(r).toEqual({
      includes: null, excludes: null, originFilter: null, stackingExcludes: null, loyGroups: null, loyTiers: null,
      isStackable: false, maxValue: 0, score: 0, validFromTime: null, validToTime: null,
    })
  })

  // Ticket 420 (spec 2396 stories 35–37): a pasted Excel column goes up as the comma list the
  // server stores, so the client never relies on the server's separator set being 2400's yet.
  it('a pasted column goes up as the comma list the server stores; loyalty groups and tiers upper-cased', () => {
    const s = newEditor(PROMO)
    const r = toRequest({
      ...s,
      engine: {
        ...s.engine,
        includes: '200033\r\n200044\r\n',
        excludes: '200055\t200066',
        originFilter: '1186\n1188\n1186',
        stackingExcludes: ' OMS000000001 ',
        loyGroups: 'gold\r\nsilver',
        loyTiers: 't1\tt2',
      },
    }).engineRules
    expect(r).toMatchObject({
      includes: '200033,200044',
      excludes: '200055,200066',
      originFilter: '1186,1188,1186',
      stackingExcludes: 'OMS000000001',
      loyGroups: 'GOLD,SILVER',
      loyTiers: 'T1,T2',
    })
    // A box holding only separators is no restriction, as a blank one is.
    expect(toRequest({ ...s, engine: { ...s.engine, originFilter: '\r\r\n\t' } }).engineRules.originFilter).toBeNull()
  })

  it('origin filter cap follows the shipped width', () => {
    // ⚠ 50 until BackOffice 2403 ships the 3000-character column everywhere: then ORIGIN_FILTER_MAX flips.
    expect(ORIGIN_FILTER_MAX).toBe(50)
    expect(ENGINE_LIST_MAX.originFilter).toBe(ORIGIN_FILTER_MAX)
    // The cap is checked against the normalised list, which is what the server checks.
    const ten = Array.from({ length: 10 }, (_, i) => String(1180 + i)).join('\r\n') + '\r\n' // 49 stored
    expect(engineListMeter('originFilter', ten)).toMatchObject({ count: 10, length: 49, max: 50, over: false })
    expect(engineListMeter('originFilter', ten + '11')).toMatchObject({ count: 11, length: 52, over: true })
    // The other five keep their caps.
    expect(ENGINE_LIST_MAX).toMatchObject({ includes: 500, excludes: 500, stackingExcludes: 500, loyGroups: 500, loyTiers: 500 })
  })

  it('the code count matches the normalised list, upper-cased where the server upper-cases', () => {
    expect(engineListMeter('loyTiers', 'gold\r\nsilver\r\n')).toMatchObject({ normalised: 'GOLD,SILVER', count: 2 })
    expect(engineListMeter('includes', 'a\tb')).toMatchObject({ normalised: 'a,b', count: 2 })
  })

  it('time of day is HHmmss on the wire and HH:mm:ss in the time box', () => {
    expect(timeFromWire('080000')).toBe('08:00:00')
    expect(timeToWire('22:30:15')).toBe('223015')
    expect(timeToWire('22:30')).toBe('223000')
    expect(timeToWire('')).toBeNull()
    expect(timeFromWire(null)).toBe('')
  })
})

describe('the Local Material Grouping popup', () => {
  it('an id is upper-cased and held to 12 characters', () => {
    expect(normalizeGroupingId(' group1 ')).toBe('GROUP1')
    expect(normalizeGroupingId('abcdefghijklmnop')).toBe('ABCDEFGHIJKL')
  })
  it('confirm adds a grouping, or replaces the one with the same id', () => {
    const s = fromDocument(doc())
    const added = upsertGrouping(s, { id: 'GROUP3', materials: ['200031'] })
    expect(added.groupings.map((g) => g.id)).toEqual(['GROUP1', 'GROUP2', 'GROUP3'])
    const replaced = upsertGrouping(s, { id: 'GROUP1', materials: ['200019'] })
    expect(replaced.groupings.find((g) => g.id === 'GROUP1')?.materials).toEqual(['200019'])
    expect(replaced.groupings).toHaveLength(2)
  })
})

describe('refusals render with code, English and Arabic', () => {
  it('a refused Check keeps every refusal with its code and both languages, and the warnings too', () => {
    const read = readEditorOutcome(
      outcome({ status: 'refused', refusals: [msg('BBY-DISCOUNT-TYPE'), msg('BBY-QUANTITY'), msg('BBY-MATERIAL-UNKNOWN')], warnings: [msg('BBY-OUTSIDE-PROMOTION')] }),
    )
    expect(read.kind).toBe('refused')
    expect(read.refusals).toEqual([msg('BBY-DISCOUNT-TYPE'), msg('BBY-QUANTITY'), msg('BBY-MATERIAL-UNKNOWN')])
    expect(read.warnings).toEqual([msg('BBY-OUTSIDE-PROMOTION')])
  })

  it('a passing Check is valid, its warnings kept; a Save is saved with the minted number', () => {
    expect(readEditorOutcome(outcome({ status: 'valid', warnings: [msg('BBY-OUTSIDE-PROMOTION')] }))).toMatchObject({
      kind: 'valid',
      warnings: [msg('BBY-OUTSIDE-PROMOTION')],
    })
    expect(readEditorOutcome(outcome({ status: 'saved', number: 'OMS000000125' }))).toMatchObject({
      kind: 'saved',
      number: 'OMS000000125',
    })
  })

  it('a missing list reads as empty, never a crash', () => {
    const read = readEditorOutcome({ status: 'refused', number: null } as unknown as BbyMaintainOutcome)
    expect(read.refusals).toEqual([])
    expect(read.warnings).toEqual([])
  })
})

describe('stale version shows the reload prompt', () => {
  it('BBY-STALE-VERSION is its own outcome: the reload prompt, with the server’s sentence in both languages', () => {
    const read = readEditorOutcome(outcome({ status: 'refused', refusals: [msg('BBY-STALE-VERSION')] }))
    expect(read.kind).toBe('stale')
    expect(read.refusals).toEqual([msg('BBY-STALE-VERSION')])
  })

  it('an ordinary refusal is not stale', () => {
    expect(readEditorOutcome(outcome({ status: 'refused', refusals: [msg('BBY-QUANTITY')] })).kind).toBe('refused')
  })

  it('a bonus buy gone since the read is notFound, not a refusal', () => {
    expect(readEditorOutcome(outcome({ status: 'notFound', number: 'OMS000000124' })).kind).toBe('notFound')
  })
})

describe('display mode disables every input', () => {
  /** The three status acts ticket 419 added; none of them applies to these four cases. */
  const NO_ACTS = { canMarkTested: false, canBackToPlanned: false, backToPlannedAsks: false }

  it('Display is read-only: nothing to save or check, Copy still offered', () => {
    expect(editorAccess('display', doc())).toEqual({
      readOnly: true,
      reason: 'display',
      canSave: false,
      canCheck: false,
      canCopy: true,
      ...NO_ACTS,
    })
  })

  it('a SAP bonus buy opened for Change is read-only too — only Copy changes it', () => {
    expect(editorAccess('change', doc({ readOnly: true, number: '000100001124' }))).toEqual({
      readOnly: true,
      reason: 'sap',
      canSave: false,
      canCheck: false,
      canCopy: true,
      ...NO_ACTS,
    })
  })

  it('Change of a Planned OMS bonus buy and Create are editable; Create has nothing to copy yet', () => {
    expect(editorAccess('change', doc())).toEqual({
      readOnly: false,
      reason: null,
      canSave: true,
      canCheck: true,
      canCopy: true,
      ...NO_ACTS,
    })
    expect(editorAccess('create', null)).toEqual({
      readOnly: false,
      reason: null,
      canSave: true,
      canCheck: true,
      canCopy: false,
      ...NO_ACTS,
    })
  })

  it('display keeps the minimum-value amount disabled even when ticked', () => {
    const s = fromDocument(doc())
    expect(buyPanelLayout(s, editorAccess('display', doc()).readOnly).minAmountEnabled).toBe(false)
  })
})

/**
 * Ticket 419 (spec 2396, ADR 0063). These REPLACE spec 2374's reading that an activated bonus
 * buy can be changed live: only Planned can change now, and the way back is Back to Planned.
 */
describe('each status opens read-only except Planned', () => {
  it('Planned opens for Change; Tested, Activated and Deactivated open locked', () => {
    expect(editorAccess('change', doc({ bbyStatus: '1' })).readOnly).toBe(false)
    for (const bbyStatus of ['3', '', ' ', '2'])
      expect(editorAccess('change', doc({ bbyStatus })), `status [${bbyStatus}]`).toMatchObject({
        readOnly: true,
        reason: 'locked',
        canSave: false,
        canCheck: false,
        canCopy: true,
      })
  })

  it('🚩 an unreadable status is locked, never guessed editable', () => {
    for (const bbyStatus of [null, 'X', '4'])
      expect(editorAccess('change', doc({ bbyStatus })).reason, String(bbyStatus)).toBe('locked')
  })

  it('a SAP bonus buy keeps its own reason whatever its status: its hint is not "back to Planned"', () => {
    expect(editorAccess('change', doc({ readOnly: true, bbyStatus: '' })).reason).toBe('sap')
    expect(editorAccess('change', doc({ readOnly: true, bbyStatus: '1' })).reason).toBe('sap')
  })

  it('Back to Planned is offered on Tested, Activated and Deactivated, never on Planned or SAP', () => {
    for (const bbyStatus of ['3', '', '2'])
      expect(editorAccess('change', doc({ bbyStatus })).canBackToPlanned, `status [${bbyStatus}]`).toBe(true)
    expect(editorAccess('change', doc({ bbyStatus: '1' })).canBackToPlanned).toBe(false)
    expect(editorAccess('change', doc({ bbyStatus: null })).canBackToPlanned).toBe(false)
    expect(editorAccess('change', doc({ readOnly: true, bbyStatus: '' })).canBackToPlanned).toBe(false)
    expect(editorAccess('create', null).canBackToPlanned).toBe(false)
  })

  it('Display offers the status acts as Change does: they are not edits', () => {
    expect(editorAccess('display', doc({ bbyStatus: '3' })).canBackToPlanned).toBe(true)
    expect(editorAccess('display', doc({ bbyStatus: '1' }), true).canMarkTested).toBe(true)
  })
})

describe('mark tested is offered only with canTest on a Planned bonus buy', () => {
  it('Planned + canTest → offered', () => {
    expect(editorAccess('change', doc({ bbyStatus: '1' }), true).canMarkTested).toBe(true)
  })

  it('without the tester grant → not offered; the default is no grant (fail closed)', () => {
    expect(editorAccess('change', doc({ bbyStatus: '1' }), false).canMarkTested).toBe(false)
    expect(editorAccess('change', doc({ bbyStatus: '1' })).canMarkTested).toBe(false)
  })

  it('any status but Planned → not offered, even with the grant', () => {
    for (const bbyStatus of ['3', '', '2', null])
      expect(editorAccess('change', doc({ bbyStatus }), true).canMarkTested, String(bbyStatus)).toBe(false)
  })

  it('a SAP bonus buy is never tested here; a new one has nothing saved to test', () => {
    expect(editorAccess('change', doc({ readOnly: true, bbyStatus: '1' }), true).canMarkTested).toBe(false)
    expect(editorAccess('create', null, true).canMarkTested).toBe(false)
  })

  it('no four eyes: the last writer is offered Mark Tested', () => {
    // The drive's session user is `msartawi`, the document's last writer too: still offered.
    expect(editorAccess('change', doc({ bbyStatus: '1', changedBy: 'msartawi' }), true).canMarkTested).toBe(true)
  })
})

describe('mark tested waits for unsaved edits', () => {
  it('a form as it opened has not changed; a typed edit has', () => {
    const opened = fromDocument(doc())
    expect(formChanged(opened, opened)).toBe(false)
    expect(formChanged(opened, { ...opened, description: 'changed' })).toBe(true)
    expect(formChanged(opened, { ...opened, engine: { ...opened.engine, score: '9' } })).toBe(true)
  })

  it('an added empty line is not a change: it is never sent', () => {
    const opened = fromDocument(doc())
    expect(formChanged(opened, { ...opened, buy: [...opened.buy, emptyBuyLine()] })).toBe(false)
  })
})

describe('back to planned on an activated bonus buy asks first', () => {
  it('Activated asks: the offer leaves the tills', () => {
    expect(editorAccess('change', doc({ bbyStatus: '' }))).toMatchObject({ canBackToPlanned: true, backToPlannedAsks: true })
  })

  it('Tested and Deactivated go back without the warning', () => {
    for (const bbyStatus of ['3', '2'])
      expect(editorAccess('change', doc({ bbyStatus })), `status [${bbyStatus}]`).toMatchObject({
        canBackToPlanned: true,
        backToPlannedAsks: false,
      })
  })

  it('nothing asks where nothing is offered', () => {
    expect(editorAccess('change', doc({ bbyStatus: '1' })).backToPlannedAsks).toBe(false)
    expect(editorAccess('change', doc({ readOnly: true, bbyStatus: '' })).backToPlannedAsks).toBe(false)
  })
})

// ── ticket 422: a new coupon material on a Buy line ──────────────────────────────────

describe('generate fills the buy line with the returned COUP number', () => {
  it('saved → the material fills that line only, and goes up on Save as a material', () => {
    const s = newEditor(PROMO)
    const other = emptyBuyLine()
    const two = { ...s, buy: [...s.buy, { ...other, identifier: '200033' }] }
    const got = readGenerateOutcome({ status: 'saved', material: 'COUP1035' })
    expect(got).toEqual({ kind: 'saved', material: 'COUP1035' })
    if (got.kind !== 'saved') throw new Error('unreachable')
    const next = fillCouponMaterial(two, two.buy[0].key, got.material)
    expect(next.buy.map((l) => l.identifier)).toEqual(['COUP1035', '200033'])
    expect(toRequest(next).buy[0]).toMatchObject({ material: 'COUP1035', grouping: null })
  })

  it('each press is a new material: a second generate replaces the first, never reuses it', () => {
    const s = newEditor(PROMO)
    const key = s.buy[0].key
    const once = fillCouponMaterial(s, key, 'COUP1035')
    expect(fillCouponMaterial(once, key, 'COUP1036').buy[0].identifier).toBe('COUP1036')
  })

  it('refused → the server’s refusals, kept as they came; the line is untouched', () => {
    const r = msg('BBY-COUPON-REFUSED')
    expect(readGenerateOutcome({ status: 'refused', material: null, refusals: [r] })).toEqual({ kind: 'refused', refusals: [r] })
    expect(readGenerateOutcome({ status: 'refused', material: null })).toEqual({ kind: 'refused', refusals: [] })
  })

  it('🚩 a "saved" with no material is not a fill: nothing is invented', () => {
    expect(readGenerateOutcome({ status: 'saved', material: '  ' }).kind).toBe('refused')
    expect(readGenerateOutcome({ status: 'saved', material: null }).kind).toBe('refused')
  })

  it('a line removed, or turned into a grouping, while the call was out is left alone', () => {
    const s = newEditor(PROMO)
    const key = s.buy[0].key
    expect(fillCouponMaterial({ ...s, buy: [] }, key, 'COUP1035').buy).toEqual([])
    const grouped = { ...s, buy: [{ ...s.buy[0], type: 'grouping' as const, identifier: 'GROUP1' }] }
    expect(fillCouponMaterial(grouped, key, 'COUP1035').buy[0].identifier).toBe('GROUP1')
    // …and the page is told so, so it never claims the number is on the line.
    expect(couponMaterialLands(s, key)).toBe(true)
    expect(couponMaterialLands({ ...s, buy: [] }, key)).toBe(false)
    expect(couponMaterialLands(grouped, key)).toBe(false)
  })

  it('the prompt’s description defaults to the bonus buy’s text', () => {
    expect(couponMaterialDefault({ ...newEditor(PROMO), description: ' Vichy 2nd p @ 20 SR ' })).toBe('Vichy 2nd p @ 20 SR')
    expect(couponMaterialDefault(newEditor(PROMO))).toBe('')
  })
})

describe('the action is absent on a non-Planned bonus buy and on a grouping line', () => {
  const material = { type: 'material' as const }
  const grouping = { type: 'grouping' as const }

  it('a Planned OMS bonus buy offers it on a Material line', () => {
    expect(couponMaterialOffered(editorAccess('change', doc({ bbyStatus: '1' })), material)).toBe(true)
  })

  it('a new, unsaved bonus buy offers it too (before the first Save)', () => {
    expect(couponMaterialOffered(editorAccess('create', null), material)).toBe(true)
  })

  it('never on a grouping line', () => {
    expect(couponMaterialOffered(editorAccess('change', doc({ bbyStatus: '1' })), grouping)).toBe(false)
    expect(couponMaterialOffered(editorAccess('create', null), grouping)).toBe(false)
  })

  it('never on Tested, Activated, Deactivated or an unreadable status', () => {
    for (const bbyStatus of ['3', '', '2', null, 'X'])
      expect(couponMaterialOffered(editorAccess('change', doc({ bbyStatus })), material), String(bbyStatus)).toBe(false)
  })

  it('never read-only: not in Display, not on a SAP bonus buy', () => {
    expect(couponMaterialOffered(editorAccess('display', doc({ bbyStatus: '1' })), material)).toBe(false)
    expect(couponMaterialOffered(editorAccess('change', doc({ readOnly: true, bbyStatus: '1' })), material)).toBe(false)
  })
})
