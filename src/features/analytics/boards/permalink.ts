import type { BoardPeriod, Param } from '@/core/models/analytics'
import { periodToken, type CrossFilter } from './effective-query'
import { boardPeriodOf, periodValue, valueOf, type ParamValues } from './params'
import { isPeriodToken } from './periods'

/**
 * The board's permalink (spec 766 §F, ticket 771) — the board's parameter values live in the query
 * string, and that string IS the permalink. Pure. Since 819 (ticket 821) each parameter's NAME is its
 * key, and the six ready-made parameters keep v1's names, so v1's keys keep their exact meaning. A
 * relative period stays relative (`period=last-30-days`), a fixed range is `period=2026-10-01..2026-10-31`,
 * and each member is its own param (`store=P001&store=P002`), so no member value needs escaping.
 *
 * Only the parameters' keys are touched by `writeParamValues`: the cross-filter (`writeCrossFilter`) and
 * 780's `tv` / `refresh` keep theirs. The other kinds' codecs (`name=gt:5`, …) come with their controls.
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
 * Each parameter's value from the URL, by its name, falling back to its default when the URL names
 * none (or names a period that is no period). A bare `region=` is "none" — a default the viewer
 * cleared — so it does not fall back. A kind with no codec yet reads its default.
 */
export function readParamValues(params: URLSearchParams, declared: readonly Param[]): ParamValues {
  const out: ParamValues = {}
  for (const p of declared) {
    if (p.kind === 'period') out[p.name] = periodValueOf(readPeriod(params.get(p.name))) ?? p.default
    else if (p.kind === 'members' && params.has(p.name)) out[p.name] = { kind: 'members', values: [...new Set(params.getAll(p.name).filter(Boolean))] }
    else out[p.name] = p.default
  }
  return out
}

const periodValueOf = (p: BoardPeriod | null) => (p ? periodValue(p) : null)

/**
 * `params` with the parameters' values written over it (a new object; the other params kept). A
 * `members` value left empty where its default holds members is written bare (`region=`), so it reads
 * back cleared.
 */
export function writeParamValues(params: URLSearchParams, declared: readonly Param[], values: ParamValues): URLSearchParams {
  const next = new URLSearchParams(params)
  for (const p of declared) {
    const v = valueOf(p, values)
    if (v.kind === 'period') {
      const period = boardPeriodOf(v)
      if (period) next.set(p.name, periodToken(period))
    } else if (v.kind === 'members') {
      next.delete(p.name)
      for (const m of v.values) next.append(p.name, m)
      if (v.values.length === 0 && p.default.kind === 'members' && p.default.values.length > 0) next.set(p.name, '')
    }
  }
  return next
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
