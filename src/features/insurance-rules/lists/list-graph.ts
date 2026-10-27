import type { GuardList, GuardListAttribute, GuardRule } from '@/core/insurance-rules/model'

/**
 * The item lists as a graph (ticket 610; BackOffice 3132). A named list is the union of its filters, plus the
 * lists it includes, minus the lists it excludes. Lists reference lists by id, at most `LIST_MAX_DEPTH` lists
 * deep counting the list itself (`a → b → c` is three), and never in a cycle. Both are refused HERE, before the
 * save; HQ refuses them again at the PUT.
 */
export const LIST_MAX_DEPTH = 3

/** A list id: lower-case letters, digits and hyphens, a letter first (`glp1`, `glp1-pens`). Ids never change. */
export const LIST_ID = /^[a-z][a-z0-9-]{0,39}$/

export type ListProblem =
  | { kind: 'cycle'; path: string[] }
  | { kind: 'tooDeep'; path: string[] }
  | { kind: 'unknownList'; id: string }
  | { kind: 'idTaken' }
  | { kind: 'idInvalid' }
  | { kind: 'nameMissing' }
  | { kind: 'emptyAttribute'; filter: number; attribute: number }
  | { kind: 'emptyDefinition' }

/** The codes of an attribute, whichever of any of / none of it carries. */
export const attributeCodes = (a: GuardListAttribute): string[] => a.anyOf ?? a.noneOf ?? []
export const attributeMode = (a: GuardListAttribute): 'anyOf' | 'noneOf' => (a.noneOf !== undefined ? 'noneOf' : 'anyOf')

/** The ruleset's lists with `edited` in its place (or appended when new), order kept. */
export function withList(lists: readonly GuardList[], edited: GuardList, replacing: string | null = edited.id): GuardList[] {
  const at = replacing === null ? -1 : lists.findIndex((l) => l.id === replacing)
  return at < 0 ? [...lists, edited] : lists.map((l, i) => (i === at ? edited : l))
}

const refsOf = (l: GuardList): string[] => [...l.include, ...l.exclude]

/**
 * What stops `edited` from being saved, given the OTHER lists of the ruleset. Shape problems first (id, name,
 * an empty filter), then the graph: an unknown list, a cycle, a path deeper than three that runs through `edited`.
 */
export function listProblems(edited: GuardList, others: readonly GuardList[], opts: { isNew: boolean }): ListProblem[] {
  const out: ListProblem[] = []
  if (opts.isNew) {
    if (!LIST_ID.test(edited.id)) out.push({ kind: 'idInvalid' })
    else if (others.some((l) => l.id === edited.id)) out.push({ kind: 'idTaken' })
  }
  if (!edited.name.en.trim() || !edited.name.ar.trim()) out.push({ kind: 'nameMissing' })
  edited.filters.forEach((f, fi) =>
    f.attributes.forEach((a, ai) => {
      if (!a.field || attributeCodes(a).length === 0) out.push({ kind: 'emptyAttribute', filter: fi, attribute: ai })
    }),
  )
  const names = edited.filters.some((f) => f.articles.length || f.categories.length || f.attributes.length) || edited.include.length > 0
  if (!names) out.push({ kind: 'emptyDefinition' })
  if (out.length) return out

  const all = new Map(others.filter((l) => l.id !== edited.id).map((l) => [l.id, l]))
  all.set(edited.id, edited)
  for (const id of refsOf(edited)) if (!all.has(id)) out.push({ kind: 'unknownList', id })
  if (out.length) return out

  // A cycle reachable from the edited list (others were saved acyclic, so any new cycle runs through it).
  const cycle = findCycle(edited.id, all)
  if (cycle) return [{ kind: 'cycle', path: cycle }]

  // The longest path through the edited list: the longest way down to it from any root, then the longest below.
  const deepest = deepestThrough(edited.id, all)
  if (deepest.length > LIST_MAX_DEPTH) return [{ kind: 'tooDeep', path: deepest }]
  return []
}

function findCycle(start: string, all: Map<string, GuardList>): string[] | null {
  const walk = (id: string, path: string[]): string[] | null => {
    for (const next of refsOf(all.get(id)!)) {
      if (next === start) return [...path, next]
      if (path.includes(next) || !all.has(next)) continue
      const found = walk(next, [...path, next])
      if (found) return found
    }
    return null
  }
  return walk(start, [start])
}

function deepestThrough(id: string, all: Map<string, GuardList>): string[] {
  const below = (at: string): string[] => {
    let best: string[] = []
    for (const next of refsOf(all.get(at)!)) {
      if (!all.has(next)) continue
      const p = below(next)
      if (p.length > best.length) best = p
    }
    return [at, ...best]
  }
  const above = (at: string): string[] => {
    let best: string[] = []
    for (const l of all.values()) {
      if (!refsOf(l).includes(at)) continue
      const p = above(l.id)
      if (p.length > best.length) best = p
    }
    return [...best, at]
  }
  return [...above(id).slice(0, -1), ...below(id)]
}

/** The rules whose filters name list `id` — the card's "Used by". */
export const listUsers = (rules: readonly GuardRule[], id: string): string[] =>
  rules.filter((r) => r.filters.some((f) => f.list === id)).map((r) => r.id)
