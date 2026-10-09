import type { MaterialMaster } from '@/core/models/materials'
import { formatPair } from '@/core/util/bidi'
import { formatMoney3 } from '@/core/util/number-format'

// The Master tab's labelled groups (ticket 452, spec 2544 story 17): Item and ItemInfo read as one
// record, every field of `MaterialWeb/Material/{no}`'s `master` placed exactly ONCE — in the page
// header or in one of four groups. Pure: no React, no `t` (a row names its label by `id`).

type Field = keyof MaterialMaster

/**
 * Where each field is read from: the `Item` row every material has, or the `ItemInfo` row a
 * material may lack (`hasInfo: false`, when the door answers its info fields `null`). Read off the
 * contract (`hasInfo: false` nulls the level, vendor, brand and status fields) and the `ItemInfo`
 * entity (`Sartawi.Retail.Data/ItemInfo.cs`): a field ItemInfo carries is `info`; the UoMs,
 * tracking, temperature, material group, flags, type and price are the material's own.
 */
export const MASTER_SOURCE = {
  materialNumber: 'item',
  description: 'item',
  description2: 'item',
  aCode: 'info', aDesc: 'info',
  bCode: 'info', bDesc: 'info',
  cCode: 'info', cDesc: 'info',
  dCode: 'info', dDesc: 'info',
  eCode: 'info', eDesc: 'info',
  vendorNo: 'info', vendorName: 'info',
  brand: 'info',
  manufacturer: 'info',
  status: 'info',
  itemType: 'item',
  blocked: 'item',
  serialised: 'item',
  unitPriceExVat: 'item',
  hasInfo: 'item',
  vendorName2: 'info',
  manufactureCode: 'info', manufactureName: 'info',
  sfdaCode: 'info', wasfatyCode: 'info',
  houseBrand: 'info',
  otcList: 'info',
  itemGrade: 'info',
  abc: 'info',
  categoryManager: 'info',
  purchaseGroup: 'info',
  materialGroup: 'item',
  itemClass: 'info',
  uomBase: 'item', salesUom: 'item', purchaseUom: 'item',
  trackingType: 'item',
  temperature: 'item',
  createdDate: 'info',
} as const satisfies Record<Field, 'item' | 'info'>

/** The fields the page header draws: the number, both descriptions, and the badges. `hasInfo`
 *  is the "not in material info" badge. */
export const HEADER_FIELDS: readonly Field[] = ['materialNumber', 'description', 'description2', 'status', 'blocked', 'serialised', 'hasInfo']

export type MasterGroupId = 'identity' | 'hierarchy' | 'commercial' | 'logistics'

/** The four groups, in the order they are drawn. */
export const MASTER_GROUPS: readonly MasterGroupId[] = ['identity', 'hierarchy', 'commercial', 'logistics']

/**
 * How a row's value reads under RTL: `machine` — a code, number, date or a pair led by one — is
 * isolated left-to-right (`Ltr`), once, around the whole value; `text` — a name in either script —
 * takes a plain `<bdi>`.
 */
export type MasterRowKind = 'machine' | 'text'

export interface MasterRowSpec {
  /** The label's key under `master.fields.*` — named for the Material, never the `Item` table. */
  id: string
  /** The contract fields this row shows — one, or the two halves of a `code · name` pair. */
  fields: readonly Field[]
  kind: MasterRowKind
  format: (m: MaterialMaster) => string
}

export interface MasterRow {
  id: string
  fields: readonly Field[]
  kind: MasterRowKind
  /** The value as shown; `''` when the master holds none. */
  value: string
}

export type MasterSection =
  | { kind: 'group'; id: MasterGroupId; rows: MasterRow[] }
  /** Drawn IN PLACE OF the groups a material without ItemInfo has nothing for. */
  | { kind: 'notInInfo'; replaces: MasterGroupId[] }

const plain = (value: string | number | null | undefined): string => (value === null || value === undefined ? '' : String(value))

const one = (id: string, field: Field, kind: MasterRowKind): MasterRowSpec => ({
  id,
  fields: [field],
  kind,
  format: (m) => plain(m[field] as string | number | null),
})

const pair = (id: string, code: Field, name: Field): MasterRowSpec => ({
  id,
  fields: [code, name],
  kind: 'machine',
  // A pair led by a machine value is ONE string (`A006 · MEDICINE`), isolated once by the renderer.
  format: (m) => formatPair(m[code] as string | null, m[name] as string | null),
})

/** Each group's rows, in the order they are drawn. */
export const MASTER_GROUP_ROWS: Record<MasterGroupId, readonly MasterRowSpec[]> = {
  // Identity — the material's numbers and codes.
  identity: [
    one('materialType', 'itemType', 'machine'),
    one('materialGroup', 'materialGroup', 'machine'),
    one('materialClass', 'itemClass', 'machine'),
    one('sfdaCode', 'sfdaCode', 'machine'),
    one('wasfatyCode', 'wasfatyCode', 'machine'),
    one('otcList', 'otcList', 'text'),
    // A date-only `yyyy-MM-dd`, shown as sent: never parsed into an instant, so never shifted.
    one('createdDate', 'createdDate', 'machine'),
  ],
  // Hierarchy — A–E, each as "code · description".
  hierarchy: [
    pair('levelA', 'aCode', 'aDesc'),
    pair('levelB', 'bCode', 'bDesc'),
    pair('levelC', 'cCode', 'cDesc'),
    pair('levelD', 'dCode', 'dDesc'),
    pair('levelE', 'eCode', 'eDesc'),
  ],
  // Commercial — vendor, brand, manufacturer, house brand, price ex VAT, and the buying classifiers.
  commercial: [
    pair('vendor', 'vendorNo', 'vendorName'),
    one('vendorName2', 'vendorName2', 'text'),
    one('brand', 'brand', 'text'),
    one('manufacturer', 'manufacturer', 'text'),
    pair('manufactureCode', 'manufactureCode', 'manufactureName'),
    one('houseBrand', 'houseBrand', 'text'),
    {
      id: 'price',
      fields: ['unitPriceExVat'],
      kind: 'machine',
      // As the master holds it: 3 decimals, EXCLUDING VAT (the label says so).
      format: (m) => formatMoney3(m.unitPriceExVat),
    },
    one('abc', 'abc', 'machine'),
    one('materialGrade', 'itemGrade', 'text'),
    one('categoryManager', 'categoryManager', 'text'),
    one('purchaseGroup', 'purchaseGroup', 'machine'),
  ],
  // Logistics — UoMs, tracking, temperature.
  logistics: [
    one('uomBase', 'uomBase', 'machine'),
    one('salesUom', 'salesUom', 'machine'),
    one('purchaseUom', 'purchaseUom', 'machine'),
    one('trackingType', 'trackingType', 'machine'),
    one('temperature', 'temperature', 'text'),
  ],
}

const fromInfo = (spec: MasterRowSpec) => spec.fields.every((f) => MASTER_SOURCE[f] === 'info')

/**
 * The Master tab as drawn. With ItemInfo, the four groups. 🚩 Without it (`hasInfo: false`), every
 * ItemInfo row is left out, and a group left with nothing is not drawn empty: ONE "not in material
 * info" note stands where the first such group stood. A group that still holds the material's own
 * fields keeps them.
 */
export function masterSections(master: MaterialMaster): MasterSection[] {
  const sections: MasterSection[] = []
  let note: { kind: 'notInInfo'; replaces: MasterGroupId[] } | null = null
  for (const id of MASTER_GROUPS) {
    const specs = master.hasInfo ? MASTER_GROUP_ROWS[id] : MASTER_GROUP_ROWS[id].filter((s) => !fromInfo(s))
    if (specs.length === 0) {
      if (note === null) {
        note = { kind: 'notInInfo', replaces: [] }
        sections.push(note)
      }
      note.replaces.push(id)
      continue
    }
    sections.push({ kind: 'group', id, rows: specs.map((s) => ({ id: s.id, fields: s.fields, kind: s.kind, value: s.format(master) })) })
  }
  return sections
}
