import type { BoardPeriod, Grain, Param, ParamValue, ThresholdOp } from '@/core/models/analytics'
import { periodToken, type CrossFilter } from './effective-query'
import { GRAINS } from './editor'
import { boardPeriodOf, isReservedName, periodValue, sameValue, TOP_N_MAX, TOP_N_MIN, valueOf, type ParamValues } from './params'
import { isPeriodToken } from './periods'

/**
 * The board's permalink (spec 766 §F, ticket 771) — the board's parameter values live in the query
 * string, and that string IS the permalink. Pure. Since 819 (ticket 821) each parameter's NAME is its
 * key, and the six ready-made parameters keep v1's names, so v1's keys keep their exact meaning. A
 * relative period stays relative (`period=last-30-days`), a fixed range is `period=2026-10-01..2026-10-31`,
 * and each member is its own param (`store=P001&store=P002`), so no member value needs escaping.
 *
 * Only the parameters' keys are touched by `writeParamValues`: the cross-filter (`writeCrossFilter`) and
 * 780's `tv` / `refresh` keep theirs; those four names are reserved (823) and never a parameter's key.
 */

const DAY = /^\d{4}-\d{2}-\d{2}$/

export function readPeriod(raw: string | null | undefined): BoardPeriod | null {
  if (!raw) return null
  if (isPeriodToken(raw)) return { kind: 'relative', token: raw }
  const [from, to, extra] = raw.split('..')
  if (extra === undefined && DAY.test(from ?? '') && DAY.test(to ?? '') && from <= to) return { kind: 'fixed', from, to }
  return null
}

/**
 * Each parameter's value from the URL by its name (823: every kind), and the parameters whose value in
 * the link could not be used. A key the URL does not name reads the default. A key it names with a value
 * that is no value of the kind (`period=last-century`, `top=500`), or that is outside the author's
 * declared list (a pinned member, a grain, a measure or breakdown option), reads the default too, and is
 * reported in `fellBack` so the strip says so. A bare `name=` is "cleared": no members, a threshold off —
 * unless the parameter is required, which viewers can't clear. A reserved name is never read.
 */
export function readParamLink(params: URLSearchParams, declared: readonly Param[]): { values: ParamValues; fellBack: string[] } {
  const values: ParamValues = {}
  const fellBack: string[] = []
  for (const p of declared) {
    const read = isReservedName(p.name) || !params.has(p.name) ? null : readOne(p, params.getAll(p.name))
    values[p.name] = read ?? p.default
    if (read === null && !isReservedName(p.name) && params.has(p.name)) fellBack.push(p.name)
  }
  return { values, fellBack }
}

/** {@link readParamLink}'s values alone. */
export const readParamValues = (params: URLSearchParams, declared: readonly Param[]): ParamValues => readParamLink(params, declared).values

const THRESHOLD = /^(gt|gte|lt|lte):(-?\d+(?:\.\d+)?)$/

/** One parameter's value from its raw entries, or `null` when they hold no usable value. */
function readOne(p: Param, raw: string[]): ParamValue | null {
  const first = raw[0] ?? ''
  const cleared = raw.every((r) => r === '')
  switch (p.kind) {
    case 'period':
      return periodValueOf(readPeriod(first))
    case 'members': {
      if (cleared) return p.required ? p.default : { kind: 'members', values: [] }
      const given = [...new Set(raw.filter(Boolean))]
      const kept = p.pinned ? given.filter((m) => p.pinned!.includes(m)) : given
      if (kept.length < given.length) return null
      return { kind: 'members', values: p.multi === false ? kept.slice(0, 1) : kept }
    }
    case 'grain':
      return isGrain(first) && (p.grains?.length ? p.grains.includes(first) : true) ? { kind: 'grain', grain: first } : null
    case 'threshold': {
      if (first === '' || first === 'off') return p.required ? null : { kind: 'threshold', op: 'off', value: thresholdOf(p.default) }
      const m = THRESHOLD.exec(first)
      return m ? { kind: 'threshold', op: m[1] as ThresholdOp, value: Number(m[2]) } : null
    }
    case 'topN': {
      const n = /^\d+$/.test(first) ? Number(first) : NaN
      return n >= TOP_N_MIN && n <= TOP_N_MAX ? { kind: 'topN', n } : null
    }
    case 'measure':
    case 'breakdown':
      return first && (p.options?.length ? p.options.includes(first) : true) ? ({ kind: p.kind, key: first } as ParamValue) : null
  }
}

const isGrain = (v: string): v is Grain => (GRAINS as readonly string[]).includes(v)
const thresholdOf = (v: ParamValue) => (v.kind === 'threshold' ? v.value : 0)
const periodValueOf = (p: BoardPeriod | null) => (p ? periodValue(p) : null)

/**
 * `params` with the parameters' values written over it (a new object; the other params kept). The
 * period is always written and members as they are (v1's six keys, unchanged). A `members` value left
 * empty where its default holds members is written bare (`region=`), so it reads back cleared. Every other
 * kind is written only when it differs from its default — a threshold as `gt:5`, or bare (`name=`) when
 * turned off from a default that is on — so a link carries what the viewer moved. A reserved name is
 * never written.
 */
export function writeParamValues(params: URLSearchParams, declared: readonly Param[], values: ParamValues): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const p of declared) {
    if (isReservedName(p.name)) continue
    const v = valueOf(p, values)
    if (v.kind === 'period') {
      const period = boardPeriodOf(v)
      if (period) next.set(p.name, periodToken(period))
      continue
    }
    next.delete(p.name)
    if (v.kind === 'members') {
      for (const m of v.values) next.append(p.name, m)
      if (v.values.length === 0 && p.default.kind === 'members' && p.default.values.length > 0) next.set(p.name, '')
    } else if (!sameValue(v, p.default)) {
      next.set(p.name, linkWord(v))
    }
  }
  return next
}

/** A value other than a period or members as its one link word. */
function linkWord(v: ParamValue): string {
  switch (v.kind) {
    case 'grain':
      return v.grain
    case 'threshold':
      return v.op === 'off' ? '' : `${v.op}:${v.value}`
    case 'topN':
      return String(v.n)
    case 'measure':
    case 'breakdown':
      return v.key
    default:
      return ''
  }
}

/**
 * The cross-filter in the permalink (772): `cross=<dimension>:<member>` plus `crossFrom=<panel id>`, the
 * panel it was clicked on (which does not re-run). Split at the FIRST colon: dimension keys hold none.
 */
export function readCrossFilter(params: URLSearchParams): CrossFilter | null {
  const raw = params.get('cross')
  const source = params.get('crossFrom')
  if (!raw || !source) return null
  const at = raw.indexOf(':')
  if (at <= 0 || at === raw.length - 1) return null
  return { source, dimension: raw.slice(0, at), member: raw.slice(at + 1) }
}

/** `params` with the cross-filter written over it, or removed when `null` (a new object; the rest kept). */
export function writeCrossFilter(params: URLSearchParams, cross: CrossFilter | null): URLSearchParams {
  const next = new URLSearchParams(params)
  next.delete('cross')
  next.delete('crossFrom')
  if (cross) {
    next.set('cross', `${cross.dimension}:${cross.member}`)
    next.set('crossFrom', cross.source)
  }
  return next
}
