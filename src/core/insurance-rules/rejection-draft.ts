import { newGuardRule, withListFilter } from './guard-edit'
import type { GuardCondition, GuardList, GuardRuleset } from './model'
import { isPlainObject } from '@/core/util/plain-object'

// "Open as guard draft" on the rejection report (BackOffice spec 3271 A10, stories 49, 51; oms ticket 709). The row hands
// the editor what it knows through router state, as "Open in playground" does, so the report never imports the editor
// and nothing is written: the draft is the editor's unsaved document until the author saves it. In core because the
// Metrics screen makes the seed and the Guards editor reads it (a feature may not import another). Pure.

/** What a coded rejection row knows: the payer, the kind of medicine (E-code) and the payer's reason code. */
export interface RejectionSeed {
  payer: string
  kind: string
  code: string
}

/** The row's seed; null for a row with no code (the payer's words alone make no draft). */
export function rejectionSeed(row: { code: string | null; payer: string; sameKind: string }): RejectionSeed | null {
  const code = row.code?.trim()
  return code ? { payer: row.payer, kind: row.sameKind, code } : null
}

/** The router state the row navigates to `GUARD_NEW_PATH` with. */
export const rejectionSeedState = (seed: RejectionSeed) => ({ rejectionSeed: seed })

/** The seed in a location's state, or null when it holds none. */
export function readRejectionSeed(state: unknown): RejectionSeed | null {
  const s = isPlainObject(state) ? state.rejectionSeed : null
  if (!isPlainObject(s)) return null
  const { payer, kind, code } = s
  return typeof payer === 'string' && typeof kind === 'string' && typeof code === 'string' && code ? { payer, kind, code } : null
}

const isOnlyKind = (l: GuardList, kind: string): boolean => {
  if (l.include.length || l.exclude.length || l.filters.length !== 1) return false
  const [f] = l.filters
  const [a] = f.attributes
  return !f.articles.length && !f.categories.length && f.attributes.length === 1 && a.field === 'ECode' && a.anyOf?.length === 1 && a.anyOf[0] === kind
}

/** A free list id for the kind (letters, digits, `.`, `_`, `-`, up to 40: what the Lists screen accepts). */
function kindListId(kind: string, lists: readonly GuardList[]): string {
  const base = `kind-${kind}`.replace(/[^A-Za-z0-9._-]/g, '-').slice(0, 37)
  const taken = new Set(lists.map((l) => l.id))
  if (!taken.has(base)) return base
  let n = 2
  while (taken.has(`${base}-${n}`)) n += 1
  return `${base}-${n}`
}

/**
 * The draft document with a new rule for the row: on this payer, on a line of this kind, answering with the code in
 * `codes.nphies`. SIS.Rules reads an item-master field only as an item list's attribute filter (3132), never as a block,
 * so the kind is a list: one that is exactly this kind if the ruleset has it, else a new one. The name and the message
 * stay empty for the author, and the code leaves the conflict key out, so a block they add may still default it.
 */
export function seededGuardDraft(doc: GuardRuleset, id: string, seed: RejectionSeed): GuardRuleset {
  const found = doc.lists.find((l) => isOnlyKind(l, seed.kind))
  const list: GuardList = found ?? {
    id: kindListId(seed.kind, doc.lists),
    name: { en: seed.kind, ar: seed.kind },
    filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: [seed.kind] }] }],
    include: [],
    exclude: [],
  }
  const blank = newGuardRule(id)
  const { rule, alias } = withListFilter(blank, list.id)
  const when: GuardCondition[] = [
    { check: 'request', field: 'payer', anyOf: [seed.payer] },
    { check: 'line', inList: alias },
  ]
  return {
    ...doc,
    lists: found ? doc.lists : [...doc.lists, list],
    rules: [...doc.rules, { ...rule, when, then: rule.then.map((e) => ({ ...e, codes: { nphies: seed.code } })) }],
  }
}
