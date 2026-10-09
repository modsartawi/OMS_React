/**
 * Ticket 452 — the Master tab's labelled groups (spec 2544 story 17). Every field of the
 * `MaterialWeb/Material/{no}` master lands in exactly ONE place (the header or one group), and a
 * material without ItemInfo (`hasInfo: false`) shows "not in material info" IN PLACE OF the info
 * groups — never the groups drawn empty.
 */
import { describe, expect, it } from 'vitest'
import type { MaterialMaster } from '@/core/models/materials'
import { HEADER_FIELDS, MASTER_GROUP_ROWS, MASTER_GROUPS, MASTER_SOURCE, masterSections } from './master-groups'

/** The contract's own example master (§ `GET MaterialWeb/Material/{materialNumber}`), every field set. */
const MASTER: MaterialMaster = {
  materialNumber: '101234',
  description: 'PANADOL 500MG 24 TAB',
  description2: 'بنادول ٥٠٠ ملغ ٢٤ قرص',
  aCode: 'A006', aDesc: 'MEDICINE',
  bCode: 'B010', bDesc: 'PAIN RELIEF',
  cCode: 'C0101', cDesc: 'ANALGESICS',
  dCode: 'D0101', dDesc: 'PARACETAMOL',
  eCode: 'E0101', eDesc: 'TABLETS',
  vendorNo: '200345', vendorName: 'GSK',
  brand: 'PANADOL', manufacturer: 'GSK',
  status: 'ACTIVE',
  itemType: 0,
  blocked: false,
  serialised: true,
  unitPriceExVat: 12.5,
  hasInfo: true,
  vendorName2: 'جي إس كي',
  manufactureCode: 'M100', manufactureName: 'GLAXOSMITHKLINE',
  sfdaCode: '0123-456', wasfatyCode: 'W-99812',
  houseBrand: 'N', otcList: 'OTC', itemGrade: 'A', abc: 'A',
  categoryManager: 'NOURA', purchaseGroup: 'P01',
  materialGroup: 'MG10',
  itemClass: 'RX',
  uomBase: 'EA', salesUom: 'EA', purchaseUom: 'CAR',
  trackingType: 1,
  temperature: '2-8 C',
  createdDate: '2019-04-02',
}

/** The same material as the door answers it with no ItemInfo row: every info field null. */
const NO_INFO: MaterialMaster = Object.fromEntries(
  Object.entries(MASTER).map(([k, v]) => [k, MASTER_SOURCE[k as keyof MaterialMaster] === 'info' ? null : v]),
) as unknown as MaterialMaster

const placed = () => [...HEADER_FIELDS, ...MASTER_GROUPS.flatMap((g) => MASTER_GROUP_ROWS[g].flatMap((r) => r.fields))]

describe('every contract field lands in exactly one place', () => {
  it('each field of the contract master is placed once — in the header or in one group', () => {
    const counts = new Map<string, number>()
    for (const f of placed()) counts.set(f, (counts.get(f) ?? 0) + 1)
    for (const key of Object.keys(MASTER)) expect([key, counts.get(key)]).toEqual([key, 1])
  })

  it('nothing is placed that the contract does not carry', () => {
    const contract = new Set(Object.keys(MASTER))
    for (const f of placed()) expect([f, contract.has(f)]).toEqual([f, true])
  })

  it('the four groups, in order', () => {
    expect(MASTER_GROUPS).toEqual(['identity', 'hierarchy', 'commercial', 'logistics'])
  })

  it('the source map covers exactly the contract fields', () => {
    expect(Object.keys(MASTER_SOURCE).sort()).toEqual(Object.keys(MASTER).sort())
  })
})

describe('masterSections — hasInfo: true', () => {
  const sections = masterSections(MASTER)

  it('draws the four groups and no "not in material info" note', () => {
    expect(sections.map((s) => (s.kind === 'group' ? s.id : 'notInInfo'))).toEqual(MASTER_GROUPS)
  })

  it('each A–E level is ONE "code · description" pair, led by the code', () => {
    const hierarchy = sections.find((s) => s.kind === 'group' && s.id === 'hierarchy')
    expect(hierarchy?.kind === 'group' && hierarchy.rows.map((r) => [r.id, r.value, r.kind])).toEqual([
      ['levelA', 'A006 · MEDICINE', 'machine'],
      ['levelB', 'B010 · PAIN RELIEF', 'machine'],
      ['levelC', 'C0101 · ANALGESICS', 'machine'],
      ['levelD', 'D0101 · PARACETAMOL', 'machine'],
      ['levelE', 'E0101 · TABLETS', 'machine'],
    ])
  })

  it('the vendor is its number · name; the price is 3 decimals; the date is shown as sent', () => {
    const rows = sections.flatMap((s) => (s.kind === 'group' ? s.rows : []))
    const value = (id: string) => rows.find((r) => r.id === id)?.value
    expect(value('vendor')).toBe('200345 · GSK')
    expect(value('vendorName2')).toBe('جي إس كي')
    expect(value('price')).toBe('12.500')
    expect(value('createdDate')).toBe('2019-04-02')
    expect(value('materialType')).toBe('0')
    expect(value('trackingType')).toBe('1')
    expect(value('sfdaCode')).toBe('0123-456')
  })

  it('a null field is an empty value, never the text "null"', () => {
    const rows = masterSections({ ...MASTER, temperature: null, unitPriceExVat: null }).flatMap((s) => (s.kind === 'group' ? s.rows : []))
    expect(rows.find((r) => r.id === 'temperature')?.value).toBe('')
    expect(rows.find((r) => r.id === 'price')?.value).toBe('')
  })
})

describe('masterSections — hasInfo: false', () => {
  const sections = masterSections({ ...NO_INFO, hasInfo: false })

  it('🚩 the info groups collapse into ONE "not in material info" note, where they stood', () => {
    expect(sections.map((s) => (s.kind === 'group' ? s.id : 'notInInfo'))).toEqual(['identity', 'notInInfo', 'commercial', 'logistics'])
  })

  it('no group is drawn empty, and no ItemInfo field is drawn at all', () => {
    for (const s of sections) {
      if (s.kind !== 'group') continue
      expect(s.rows.length).toBeGreaterThan(0)
      for (const r of s.rows) for (const f of r.fields) expect([f, MASTER_SOURCE[f]]).toEqual([f, 'item'])
    }
  })

  it("the material's own fields still show", () => {
    const ids = sections.flatMap((s) => (s.kind === 'group' ? s.rows.map((r) => r.id) : []))
    expect(ids).toEqual(['materialType', 'materialGroup', 'price', 'uomBase', 'salesUom', 'purchaseUom', 'trackingType', 'temperature'])
  })

  it('a material whose info row is absent says so even when a stray info value came back', () => {
    const sectionsStray = masterSections({ ...MASTER, hasInfo: false })
    expect(sectionsStray.some((s) => s.kind === 'notInInfo')).toBe(true)
    expect(sectionsStray.some((s) => s.kind === 'group' && s.id === 'hierarchy')).toBe(false)
  })
})
