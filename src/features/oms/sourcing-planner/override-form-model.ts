/**
 * A buffer override's form (ticket 968, BackOffice spec 4354 §5, BO 4375): "keep N units" or "keep D days of walk-in
 * sales", or both — the larger applies, worked out on the server, which alone knows the walk-in rate. Four levels,
 * the most specific wins: store and item, item, merchandise category, store. A first day and an optional last day.
 * The reason is the sheet's (every BO 4375 change keeps one), not this form's.
 *
 * The fields and level codes are BackOffice 4375's `BufferOverrideRequest` (pricing2 35a4e56be); the checks below are
 * its `PlannerStockService.CheckedOverride`, read first so a refusal is rare.
 */
import { OVERRIDE_LEVELS, type OverrideLevel } from '@/core/models/sourcing-planner'
import type { PlannerRow, PlannerValue, PlannerValues } from './wire'

/** The form as typed: every field text, so a half-typed figure stays as typed. Dates are `yyyy-MM-dd`. */
export interface OverrideForm {
  level: OverrideLevel
  store: string
  item: string
  category: string
  keepUnits: string
  keepDays: string
  firstDay: string
  lastDay: string
}

export type OverrideProblem =
  | 'needStore'
  | 'needItem'
  | 'needCategory'
  | 'unitsOrDays'
  | 'badUnits'
  | 'badDays'
  | 'needFirstDay'
  | 'lastBeforeFirst'
  | 'lastPast'

/** The most days of walk-in sales an override may keep (`PlannerStockService.MostKeepDays`). */
const MOST_KEEP_DAYS = 365

export const blankOverrideForm = (today: string): OverrideForm => ({
  level: 'STORE_ITEM',
  store: '',
  item: '',
  category: '',
  keepUnits: '',
  keepDays: '',
  firstDay: today,
  lastDay: '',
})

const text = (v: PlannerValue | undefined): string => (v == null ? '' : String(v))

/** A row's values back into the form (a change starts from the version it replaces). */
export function overrideFormOf(values: PlannerValues): OverrideForm {
  const level = OVERRIDE_LEVELS.find((l) => l === values.level) ?? 'STORE_ITEM'
  return {
    level,
    store: text(values.store),
    item: text(values.item),
    category: text(values.category),
    keepUnits: text(values.keepUnits),
    keepDays: text(values.keepDays),
    firstDay: text(values.firstDay),
    lastDay: text(values.lastDay),
  }
}

const needsStore = (l: OverrideLevel) => l === 'STORE_ITEM' || l === 'STORE'
const needsItem = (l: OverrideLevel) => l === 'STORE_ITEM' || l === 'ITEM'
const needsCategory = (l: OverrideLevel) => l === 'CATEGORY'

const figure = (s: string): number | null => (s.trim() === '' ? null : Number(s))

/** Whether the override keeps units, days, or both (null: neither yet). */
export function overrideKeep(f: OverrideForm): 'UNITS' | 'DAYS' | 'BOTH' | null {
  const units = f.keepUnits.trim() !== ''
  const days = f.keepDays.trim() !== ''
  return units && days ? 'BOTH' : units ? 'UNITS' : days ? 'DAYS' : null
}

const twoDecimals = (n: number) => Math.abs(Math.round(n * 100) - n * 100) < 1e-9

/** What stops the form from saving, in the order the form reads. Given today, a last day before it is refused. */
export function overrideProblems(f: OverrideForm, today?: string): OverrideProblem[] {
  const out: OverrideProblem[] = []
  if (needsStore(f.level) && f.store.trim() === '') out.push('needStore')
  if (needsItem(f.level) && f.item.trim() === '') out.push('needItem')
  if (needsCategory(f.level) && f.category.trim() === '') out.push('needCategory')
  const units = figure(f.keepUnits)
  const days = figure(f.keepDays)
  if (units == null && days == null) out.push('unitsOrDays')
  if (units != null && !(Number.isInteger(units) && units >= 0)) out.push('badUnits')
  if (days != null && !(Number.isFinite(days) && days >= 0 && days <= MOST_KEEP_DAYS && twoDecimals(days))) out.push('badDays')
  if (f.firstDay === '') out.push('needFirstDay')
  else if (f.lastDay !== '' && f.lastDay < f.firstDay) out.push('lastBeforeFirst')
  else if (f.lastDay !== '' && today && f.lastDay < today) out.push('lastPast')
  return out
}

/** The values the door is sent: only the target fields the level names, figures as numbers. Null while a problem stands. */
export function overrideValues(f: OverrideForm, today?: string): PlannerValues | null {
  if (overrideProblems(f, today).length > 0) return null
  return {
    level: f.level,
    store: needsStore(f.level) ? f.store.trim() : null,
    item: needsItem(f.level) ? f.item.trim() : null,
    category: needsCategory(f.level) ? f.category.trim() : null,
    keepUnits: figure(f.keepUnits),
    keepDays: figure(f.keepDays),
    firstDay: f.firstDay,
    lastDay: f.lastDay === '' ? null : f.lastDay,
  }
}

/** The levels a level wins over: every level less specific than it. */
export const levelsBeaten = (level: OverrideLevel): OverrideLevel[] => OVERRIDE_LEVELS.slice(OVERRIDE_LEVELS.indexOf(level) + 1)

export interface OverrideTarget {
  store?: string
  item?: string
  /** The item's merchandise category. Without it no category row can match. */
  category?: string
}

function matches(values: PlannerValues, t: OverrideTarget): boolean {
  switch (values.level) {
    case 'STORE_ITEM':
      return !!t.store && !!t.item && values.store === t.store && values.item === t.item
    case 'ITEM':
      return !!t.item && values.item === t.item
    case 'CATEGORY':
      return !!t.category && values.category === t.category
    case 'STORE':
      return !!t.store && values.store === t.store
    default:
      return false
  }
}

const inForceOn = (r: PlannerRow, day: string) =>
  !r.endedAt && text(r.values.firstDay) <= day && (r.values.lastDay == null || r.values.lastDay === '' || text(r.values.lastDay) >= day)

const rank = (r: PlannerRow) => {
  const i = OVERRIDE_LEVELS.indexOf(r.values.level as OverrideLevel)
  return i < 0 ? OVERRIDE_LEVELS.length : i
}

/** The override that applies to a store and item on a day: the most specific in force; null — the computed buffer stands. */
export function overrideThatApplies(rows: readonly PlannerRow[], target: OverrideTarget, day: string): PlannerRow | null {
  const hits = rows.filter((r) => inForceOn(r, day) && matches(r.values, target))
  hits.sort((a, b) => rank(a) - rank(b))
  return hits[0] ?? null
}
