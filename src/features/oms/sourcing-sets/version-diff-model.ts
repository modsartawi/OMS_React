/**
 * What differs between two versions of a weight set (ticket 967; spec 4354 §10: "every save is a new numbered version,
 * never edited"). Pure.
 *
 * The owner's default on the prototype (variant A): the changed settings only, grouped as the simulator's panel groups
 * them, then the shelf chance table, then any setting the screens do not name. "Show every setting" lists them all.
 *
 * A version's document is read flat: a nested object becomes dotted keys (`shelfChance.DAWAA_NOW.1.L0`). A setting the
 * panel names and a version does not hold reads at its starting value, as the simulator reads it (BO 4360: "a setting
 * added by a later release is read at its baseline value"), so it is no difference by itself.
 * PROVISIONAL (spec 4354: not specified) — BO 4360 names no key inside a set's document; the panel's keys are
 * `WEIGHT_CONTROLS`, and the shelf chance table's `shelfChance.<mode>.<asked>.<left over>` is ours.
 */
import type { WeightSetValues, WeightSetVersionRef } from '@/core/models/sourcing-run'
import { RESULTS_LEFT_OVERS, type ResultsLeftOver, type ResultsPromiseMode } from '@/core/models/sourcing-results'
import { WEIGHT_CONTROLS, WEIGHT_GROUPS, type WeightGroup } from '@/core/sourcing-advisor/weight-controls'

export type SettingGroup = WeightGroup | 'shelf' | 'other'
export const SETTING_GROUPS: readonly SettingGroup[] = [...WEIGHT_GROUPS, 'shelf', 'other']

/** How a value is written: a weight, riyals (3 decimals), a switch, a shelf chance percent, or as read. */
export type SettingKind = 'number' | 'riyals' | 'switch' | 'percent' | 'text'

export interface ShelfCell {
  mode: ResultsPromiseMode
  asked: number
  leftOver: ResultsLeftOver
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

const SHELF_MODES: readonly ResultsPromiseMode[] = ['DAWAA_NOW', 'SLOT', 'PICK_UP']
const SHELF_KEY = /^shelfChance\.(DAWAA_NOW|SLOT|PICK_UP)\.(\d+)\.(L0|L1|L2|L3_4|L5_9|L10_PLUS)$/

/** A document read flat: nested objects become dotted keys; arrays and scalars are leaves. */
export function flatValues(values: WeightSetValues, prefix = ''): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(values)) {
    const key = prefix ? `${prefix}.${k}` : k
    if (v !== null && typeof v === 'object' && !Array.isArray(v)) Object.assign(out, flatValues(v as WeightSetValues, key))
    else out[key] = v
  }
  return out
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

function shelfCell(key: string): ShelfCell | null {
  const m = SHELF_KEY.exec(key)
  return m
    ? {
        mode: m[1] as ResultsPromiseMode,
        asked: Number(m[2]),
        leftOver: m[3] as ResultsLeftOver,
      }
    : null
}

const shelfOrder = (c: ShelfCell) => SHELF_MODES.indexOf(c.mode) * 10000 + c.asked * 100 + RESULTS_LEFT_OVERS.indexOf(c.leftOver)

/**
 * Every setting of two versions side by side, grouped and in order; only the changed ones unless `every`. A group with
 * no row is left out, so two identical versions give nothing.
 */
export function versionDiff(from: WeightSetValues, to: WeightSetValues, { every = false }: { every?: boolean } = {}): DiffGroup[] {
  const a = flatValues(from)
  const b = flatValues(to)
  const rows: DiffRow[] = []

  for (const c of WEIGHT_CONTROLS) {
    const before = c.key in a ? a[c.key] : c.start
    const after = c.key in b ? b[c.key] : c.start
    const kind: SettingKind = c.kind === 'switch' ? 'switch' : c.riyals ? 'riyals' : 'number'
    rows.push({
      key: c.key,
      group: c.group,
      kind,
      before,
      after,
      changed: !same(before, after),
    })
  }

  const named = new Set(WEIGHT_CONTROLS.map((c) => c.key))
  const rest = [...new Set([...Object.keys(a), ...Object.keys(b)])].filter((k) => !named.has(k))
  const shelf: DiffRow[] = []
  const other: DiffRow[] = []
  for (const key of rest) {
    const before = a[key]
    const after = b[key]
    const changed = !same(before, after)
    const cell = shelfCell(key)
    if (cell)
      shelf.push({
        key,
        group: 'shelf',
        kind: 'percent',
        before,
        after,
        changed,
        cell,
      })
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
