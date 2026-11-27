/**
 * The settings of a weight set that the screens name, by group, in the order shown (ticket 963; spec 4354 §10). In
 * `@/core/` because two features read it: the simulator's weight set panel edits these settings, and the weight-set list
 * (ticket 967) names them when it shows what differs between two versions — a feature may never import another.
 *
 * Reconciled with BackOffice 4360 at pricing2 35a4e56be: a set's values are ONE nested document
 * (`SourcingAdvisor/WeightSets/baseline-weight-set.json`, `WeightSetValues.cs`). Each control names its place in it by
 * a path — `prices.companyCostWeight`, a mode's row by its mode `modes[SLOT].reachWidened`, every mode `modes[*]…`.
 * A control the server keeps as several settings (both carrier modes, every store record measure) names each.
 */
export type WeightGroup = 'weights' | 'factors' | 'reach'

type Common = { group: WeightGroup; key: string; paths: readonly string[] }
export type WeightControl =
  | (Common & { kind: 'slider'; min: number; max: number; step: number; start: number; riyals?: boolean })
  | (Common & { kind: 'switch'; start: boolean })

const STORE_RECORD_MEASURES = [
  'storeRecord.slot.late.on',
  'storeRecord.slot.returned.on',
  'storeRecord.slot.cancelled.on',
  'storeRecord.pickUp.neverReady.on',
  'storeRecord.pickUp.cancelled.on',
  'storeRecord.pickUp.readyLate.on',
  'storeRecord.dawaaNow.calloutIgnored.on',
  'storeRecord.dawaaNow.late.on',
]

/** Each with its range (the prototype's) and its starting value (the baseline document's). */
export const WEIGHT_CONTROLS: readonly WeightControl[] = [
  { group: 'weights', key: 'companyCostWeight', paths: ['prices.companyCostWeight'], kind: 'slider', min: 0, max: 2, step: 0.25, start: 1 },
  { group: 'weights', key: 'feeWeight', paths: ['prices.feeWeight'], kind: 'slider', min: 0, max: 2, step: 0.25, start: 1 },
  { group: 'weights', key: 'waitingPerHour', paths: ['waiting.firstPerHour'], kind: 'slider', min: 0, max: 10, step: 0.5, start: 5, riyals: true },
  { group: 'weights', key: 'splitPenalty', paths: ['prices.splitPenalty'], kind: 'slider', min: 0, max: 10, step: 1, start: 0, riyals: true },
  { group: 'weights', key: 'mostShipments', paths: ['limits.mostShipments'], kind: 'slider', min: 1, max: 3, step: 1, start: 3 },
  { group: 'weights', key: 'marginMultiplier', paths: ['modes[*].marginMultiplier'], kind: 'slider', min: 0.5, max: 1.5, step: 0.25, start: 1 },
  { group: 'factors', key: 'buffer', paths: ['stock.bufferOn'], kind: 'switch', start: true },
  { group: 'factors', key: 'stockConfidence', paths: ['stock.confidenceOn'], kind: 'switch', start: true },
  { group: 'factors', key: 'storeRecord', paths: STORE_RECORD_MEASURES, kind: 'switch', start: true },
  { group: 'reach', key: 'widerSlotReach', paths: ['modes[SLOT].reachWidened'], kind: 'switch', start: false },
  { group: 'reach', key: 'carrierModes', paths: ['modes[CARRIER_SAME_DAY].on', 'modes[CARRIER_NEXT_DAY].on'], kind: 'switch', start: false },
  { group: 'reach', key: 'feePerOrder', paths: ['feePerOrder'], kind: 'switch', start: false },
  { group: 'reach', key: 'pickUpInDeliveryPlan', paths: ['pickUpWithDelivery'], kind: 'switch', start: false },
]

export const WEIGHT_GROUPS: readonly WeightGroup[] = ['weights', 'factors', 'reach']

type Doc = Record<string, unknown>
/** The fields that name a row of a list (BO 4360 `WeightSetDocument.RowKeys`). */
const ROW_KEYS = ['mode', 'goal']

const SEGMENT = /^([^[\]]+)(?:\[([^\]]+)\])?$/
const isRecord = (v: unknown): v is Doc => v !== null && typeof v === 'object' && !Array.isArray(v)
const rowName = (row: unknown) => (isRecord(row) ? ROW_KEYS.map((k) => row[k]).find((v) => typeof v === 'string') : undefined)

/** A setting's value at its path; `[*]` reads the first row. Undefined when the document does not hold it. */
export function readSetting(doc: unknown, path: string): unknown {
  let at: unknown = doc
  for (const part of path.split('.')) {
    const m = SEGMENT.exec(part)
    if (!m || !isRecord(at)) return undefined
    at = at[m[1]]
    if (m[2] !== undefined) {
      if (!Array.isArray(at)) return undefined
      at = m[2] === '*' ? at[0] : at.find((row) => rowName(row) === m[2])
    }
  }
  return at
}

/** Left as it was: a write or a restore that has nothing to do there. */
const UNTOUCHED = Symbol('untouched')
/** Taken out: a restore of a setting the version does not hold. */
const GONE = Symbol('gone')

/** The field naming a list's rows: the one its rows carry, else the list's own (`modes` → `mode`). */
const rowKeyOf = (list: string, rows: readonly unknown[]) =>
  ROW_KEYS.find((k) => rows.some((r) => isRecord(r) && typeof r[k] === 'string')) ?? ROW_KEYS.find((k) => list === `${k}s`) ?? ROW_KEYS[0]

/**
 * The document with the setting at its path written; `[*]` writes every row, and a named row the list lacks is added
 * (`{ mode: NAME, … }`), so a switch written on reads on. `[*]` over no rows writes nothing: no empty list is made. The
 * document given is never changed.
 */
export function writeSetting<T extends Doc>(doc: T, path: string, value: unknown): T {
  const write = (at: unknown, parts: readonly string[]): unknown => {
    if (parts.length === 0) return value
    const m = SEGMENT.exec(parts[0])
    if (!m) return UNTOUCHED
    const obj: Doc = isRecord(at) ? at : {}
    let next: unknown
    if (m[2] === undefined) next = write(obj[m[1]], parts.slice(1))
    else {
      const rows = Array.isArray(obj[m[1]]) ? (obj[m[1]] as unknown[]) : []
      const hits = (row: unknown) => m[2] === '*' || rowName(row) === m[2]
      if (m[2] === '*' && rows.length === 0) next = UNTOUCHED
      else if (rows.some(hits)) next = rows.map((row) => (hits(row) ? write(row, parts.slice(1)) : row))
      else next = [...rows, write({ [rowKeyOf(m[1], rows)]: m[2] }, parts.slice(1))]
    }
    if (next === UNTOUCHED) return isRecord(at) ? at : UNTOUCHED
    return { ...obj, [m[1]]: next }
  }
  const out = write(doc, path.split('.'))
  return (out === UNTOUCHED ? doc : out) as T
}

/**
 * The document with the setting at its path put back to what `base` holds there, row by row through `[*]`. A setting
 * `base` does not hold is taken out again, and with it a row or a group left holding nothing else `base` lacks too.
 */
export function restoreSetting<T extends Doc>(doc: T, base: unknown, path: string): T {
  const put = (at: unknown, from: unknown, parts: readonly string[]): unknown => {
    if (parts.length === 0) return from === undefined ? GONE : from
    const m = SEGMENT.exec(parts[0])
    if (!m || !isRecord(at)) return at === undefined ? GONE : at
    const src = isRecord(from) ? from[m[1]] : undefined
    let next: unknown
    if (m[2] === undefined) next = put(at[m[1]], src, parts.slice(1))
    else if (!Array.isArray(at[m[1]])) next = at[m[1]]
    else {
      const baseRows = Array.isArray(src) ? src : []
      const rows = (at[m[1]] as unknown[]).flatMap((row) => {
        if (m[2] !== '*' && rowName(row) !== m[2]) return [row]
        const r = put(row, baseRows.find((b) => rowName(b) === rowName(row)), parts.slice(1))
        return r === GONE ? [] : [r]
      })
      next = rows.length === 0 && src === undefined ? GONE : rows
    }
    if (next !== GONE) return next === at[m[1]] ? at : { ...at, [m[1]]: next }
    const rest = Object.fromEntries(Object.entries(at).filter(([k]) => k !== m[1]))
    return from === undefined && Object.keys(rest).every((k) => ROW_KEYS.includes(k)) ? GONE : rest
  }
  const out = put(doc, base, path.split('.'))
  return (out === GONE ? {} : out) as T
}

/** A control's value: a slider its first setting's, a switch on while any of its settings is; else its start. */
export function controlValue(values: unknown, control: WeightControl): number | boolean {
  const read = control.paths.map((p) => readSetting(values, p))
  if (control.kind === 'slider') return typeof read[0] === 'number' ? read[0] : control.start
  const held = read.filter((v): v is boolean => typeof v === 'boolean')
  return held.length ? held.some(Boolean) : control.start
}

/**
 * The document with a control set. Set to the value it reads at in `base` (the version the panel opened on), each of its
 * settings is put back as `base` holds it (`restoreSetting`): each mode's own margin, each store record measure, and a
 * setting `base` never held taken out again, so the draft is the saved version once more. Set to any other value, a
 * slider writes each of its settings and a switch turns each on or off.
 */
export function withControl<T extends Doc>(values: T, control: WeightControl, value: number | boolean, base?: unknown): T {
  if (base !== undefined && value === controlValue(base, control)) return control.paths.reduce((d, p) => restoreSetting(d, base, p), values)
  return control.paths.reduce((d, p) => writeSetting(d, p, value), values)
}
