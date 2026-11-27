/**
 * What differs between two versions of a weight set (ticket 967; spec 4354 §10: "every save is a new numbered version,
 * never edited"). Pure.
 *
 * The owner's default on the prototype (variant A): the changed settings only, grouped as the simulator's panel groups
 * them, then the shelf chance table, then every other setting. "Show every setting" lists them all.
 *
 * A version's values are ONE nested document (BackOffice 4360 `WeightSetValues`, reconciled at pricing2 35a4e56be). It
 * is read flat: a nested object becomes dotted keys, a row of a list is named by its mode or goal (`modes[SLOT].on`, as
 * the server's own save check names it), and a shelf chance cell is named as the marking screen names the figure
 * (`shelfChance 2/0`: units asked / units left over). The set's name, version and format are not settings. A panel
 * control reads its own place in the document (`@/core/sourcing-advisor/weight-controls`).
 */
import type { WeightSetValues, WeightSetVersionRef } from '@/core/models/sourcing-run'
import { controlValue, WEIGHT_CONTROLS, WEIGHT_GROUPS, type WeightGroup } from '@/core/sourcing-advisor/weight-controls'

export type SettingGroup = WeightGroup | 'shelf' | 'other'
export const SETTING_GROUPS: readonly SettingGroup[] = [...WEIGHT_GROUPS, 'shelf', 'other']

/** How a value is written: a weight, riyals (3 decimals), a switch, a shelf chance (a fraction shown as a percent), or as read. */
export type SettingKind = 'number' | 'riyals' | 'switch' | 'chance' | 'text'

export interface ShelfCell {
  asked: number
  leftOver: number
}

export interface DiffRow {
  key: string
  group: SettingGroup
  kind: SettingKind
  before: unknown
  after: unknown
  changed: boolean
  /** A shelf chance cell's coordinates. */
  cell?: ShelfCell
}

export interface DiffGroup {
  group: SettingGroup
  rows: DiffRow[]
}

/** Not settings: the format number and the set's name and version (BO 4360 `WeightSetDocument.Metadata`). */
const METADATA = ['formatVersion', 'name', 'version']
const ROW_KEYS = ['mode', 'goal']
const SHELF_TABLE = 'noStock.shelfChance'
const SHELF_KEY = /^shelfChance (\d+)\/(\d+)$/

const isRecord = (v: unknown): v is Record<string, unknown> => v !== null && typeof v === 'object' && !Array.isArray(v)
const rowName = (row: unknown) => (isRecord(row) ? ROW_KEYS.map((k) => row[k]).find((v) => typeof v === 'string') : undefined)

/** A document read flat: nested objects become dotted keys, named rows `list[NAME]`, shelf chance cells their figure name. */
export function flatValues(values: WeightSetValues): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const walk = (v: unknown, key: string) => {
    if (key === SHELF_TABLE && Array.isArray(v)) {
      for (const c of v) if (isRecord(c)) out[`shelfChance ${String(c.asked)}/${String(c.leftOver)}`] = c.chance
    } else if (isRecord(v)) {
      for (const [k, x] of Object.entries(v)) if (key || !METADATA.includes(k)) walk(x, key ? `${key}.${k}` : k)
    } else if (Array.isArray(v) && v.length > 0 && v.every((row) => rowName(row) !== undefined)) {
      for (const row of v as Record<string, unknown>[]) {
        const name = rowName(row)!
        for (const [k, x] of Object.entries(row)) if (!ROW_KEYS.includes(k)) walk(x, `${key}[${name}].${k}`)
      }
    } else out[key] = v
  }
  walk(values, '')
  return out
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function shelfCell(key: string): ShelfCell | null {
  const m = SHELF_KEY.exec(key)
  return m ? { asked: Number(m[1]), leftOver: Number(m[2]) } : null
}

/** The server's table order: by units left over, then units asked. */
const shelfOrder = (c: ShelfCell) => c.leftOver * 1000 + c.asked

/** A control's path as a pattern over flat keys (`[*]` stands for any row). */
const pathPattern = (p: string) =>
  new RegExp(`^${p.replace(/[.]/g, '\\.').replace(/\[\*\]/g, '\\[[^\\]]+\\]').replace(/\[([A-Z_]+)\]/g, '\\[$1\\]')}$`)
const controlPatterns = new Map(WEIGHT_CONTROLS.map((c) => [c.key, c.paths.map(pathPattern)]))
/** Whether a flat key is a setting a panel control reads. */
const isCovered = (key: string) => [...controlPatterns.values()].some((res) => res.some((re) => re.test(key)))

/**
 * Every setting of two versions side by side, grouped and in order; only the changed ones unless `every`. A group with
 * no row is left out, so two identical versions give nothing.
 */
export function versionDiff(from: WeightSetValues, to: WeightSetValues, { every = false }: { every?: boolean } = {}): DiffGroup[] {
  const a = flatValues(from)
  const b = flatValues(to)
  const keys = [...new Set([...Object.keys(a), ...Object.keys(b)])]
  const rows: DiffRow[] = []

  for (const c of WEIGHT_CONTROLS) {
    const before = controlValue(from, c)
    const after = controlValue(to, c)
    const kind: SettingKind = c.kind === 'switch' ? 'switch' : c.riyals ? 'riyals' : 'number'
    // A control over several settings reads as one value (a mode's margin, "any measure on"): it has changed when any
    // one of its settings has, though the value it reads is the same.
    const res = controlPatterns.get(c.key)!
    const changed = !same(before, after) || keys.some((k) => res.some((re) => re.test(k)) && !same(a[k], b[k]))
    rows.push({ key: c.key, group: c.group, kind, before, after, changed })
  }

  const rest = keys.filter((k) => !isCovered(k))
  const shelf: DiffRow[] = []
  const other: DiffRow[] = []
  for (const key of rest) {
    const before = a[key]
    const after = b[key]
    const changed = !same(before, after)
    const cell = shelfCell(key)
    if (cell) shelf.push({ key, group: 'shelf', kind: 'chance', before, after, changed, cell })
    else {
      const sample = after ?? before
      const kind: SettingKind = typeof sample === 'number' ? 'number' : typeof sample === 'boolean' ? 'switch' : 'text'
      other.push({ key, group: 'other', kind, before, after, changed })
    }
  }
  shelf.sort((x, y) => shelfOrder(x.cell!) - shelfOrder(y.cell!))
  other.sort((x, y) => x.key.localeCompare(y.key))
  rows.push(...shelf, ...other)

  return SETTING_GROUPS.map((group) => ({
    group,
    rows: rows.filter((r) => r.group === group && (every || r.changed)),
  })).filter((g) => g.rows.length > 0)
}

const isRef = (a: WeightSetVersionRef, b: WeightSetVersionRef) => a.name === b.name && a.version === b.version

/** A version ticked or unticked: at most two are kept, the two ticked last. */
export function pickToCompare(picked: readonly WeightSetVersionRef[], ref: WeightSetVersionRef): WeightSetVersionRef[] {
  if (picked.some((p) => isRef(p, ref))) return picked.filter((p) => !isRef(p, ref))
  return [...picked, ref].slice(-2)
}

/** The two versions compared: of one set, older → newer; of two sets, in the order picked. Null until two are picked. */
export function comparedPair(picked: readonly WeightSetVersionRef[]): { from: WeightSetVersionRef; to: WeightSetVersionRef } | null {
  if (picked.length !== 2) return null
  const [x, y] = picked
  if (x.name === y.name && x.version > y.version) return { from: y, to: x }
  return { from: x, to: y }
}
