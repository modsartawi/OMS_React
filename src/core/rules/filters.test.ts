import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/campaign-workspace.json'
import type { CampaignRule, RuleItemFilter } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../tools/campaigns-fixtures.mjs'
import {
  addFilter,
  copyFilterInto,
  DEFAULT_EXCLUDED_CATEGORIES,
  deleteFilter,
  effectLetsRxIn,
  filterLetsRxIn,
  filterNameProblem,
  filterUses,
  newFilter,
  nextFilterName,
  renameFilter,
  updateFilter,
} from './filters'
import { blockSentence, catalogueBlock, filterChain, plainSentence, RX_CATEGORY, type SentenceContext } from './sentence'

// Tickets 506, 522: named cart-item filters are kept by id (`of` on a condition, `filter` on an effect
// and on a bundle list), so a rename never breaks a rule, and Prescription (A006) is kept out of a new
// filter unless the marketer lets it in — then it is flagged.

const campaignOf = (code: string) => CAMPAIGNS.find((c) => c.code === code)!.campaign
const rulesOf = (code: string): CampaignRule[] => structuredClone(campaignOf(code).rules)
const f = (o: Partial<RuleItemFilter> = {}): RuleItemFilter => ({ id: 'f', name: 'x', categories: [], articles: [], exclude: { categories: [] }, ...o })

const instance = i18next.createInstance()
instance.init({
  lng: 'en',
  resources: { en: { 'campaign-workspace': en } },
  ns: ['campaign-workspace'],
  defaultNS: 'campaign-workspace',
  initAsync: false,
  interpolation: { escapeValue: false },
})
const t = instance.getFixedT('en', 'campaign-workspace') as unknown as (key: string, o: Record<string, unknown>) => string
const has = (key: string, count?: number) => instance.exists(key, count === undefined ? {} : { count })

describe('filters', () => {
  it('renameFilter_keepsEveryReference — references are ids, never the name', () => {
    const rules = rulesOf('BABY-BUNDLE')
    const rule = rules[0]
    const diapers = rule.filters[0]
    const ctx: SentenceContext = { campaign: campaignOf('BABY-BUNDLE'), rule, catalogue: CATALOGUE, has }
    const before = blockSentence('condition', rule.when[0], ctx)
    expect(plainSentence(before.sentence, t)).toBe('At least 1 unit of diapers')

    const next = renameFilter(rules, rule.id, diapers.id, 'nappies')
    const renamed = next[0]
    // The id did not move, and every block still points at it by id.
    expect(renamed.filters[0]).toEqual({ ...diapers, name: 'nappies' })
    expect(renamed.when[0].of).toBe(diapers.id)
    expect(renamed.bundle!.lists.map((l) => l.filter)).toEqual([diapers.id, rule.filters[1].id])
    // The blocks were not touched at all: the sentence reads the new name through the id.
    expect(renamed.when).toBe(rule.when)
    expect(renamed.bundle).toBe(rule.bundle)
    const after = blockSentence('condition', renamed.when[0], { ...ctx, rule: renamed })
    expect(plainSentence(after.sentence, t)).toBe('At least 1 unit of nappies')
    // The original rules are left as they were (the history keeps them for Undo).
    expect(rules[0].filters[0].name).toBe('diapers')
    // A rename to the same name changes nothing.
    expect(renameFilter(next, rule.id, diapers.id, 'nappies')).toBe(next)
    // The condition and the bundle's list both use it.
    expect(filterUses(renamed, diapers.id, CATALOGUE)).toBe(2)
  })

  it('newFilter_excludesA006_andRxCheckFlagsOneThatDoesNot', () => {
    expect(DEFAULT_EXCLUDED_CATEGORIES).toEqual(['A006'])
    const made = newFilter('n1', 'items1')
    expect(made).toEqual({ id: 'n1', name: 'items1', categories: [], articles: [], exclude: { categories: [RX_CATEGORY] } })
    expect(filterLetsRxIn(made)).toBe(false)
    expect(filterChain(made).links.map((l) => l.key)).toContain('sentence.filter.never')
    // The default list is a fresh copy: editing one filter's exclusions never edits the constant.
    made.exclude!.categories!.push('A008')
    expect(DEFAULT_EXCLUDED_CATEGORIES).toEqual(['A006'])

    // Taking A006 off the exclusions lets Rx in…
    expect(filterLetsRxIn(f({ exclude: { categories: ['A008'] } }))).toBe(true)
    expect(filterLetsRxIn(f({ articles: ['SER-VC'] }))).toBe(true)
    expect(filterLetsRxIn(f({ exclude: undefined }))).toBe(true)
    // …unless the filter holds to other categories only.
    expect(filterLetsRxIn(f({ categories: ['A002'] }))).toBe(false)
    expect(filterLetsRxIn(f({ categories: ['A002', 'A006'] }))).toBe(true)

    // A discount is flagged when its items let Rx in: all merchandise, or a filter that does.
    const rules = rulesOf('WKND20')
    const rule = rules[0]
    const session = rule.then[0]
    const entry = catalogueBlock(CATALOGUE, 'effect', session.effect)
    expect(effectLetsRxIn(session, entry, rule.filters)).toBe(false)
    expect(effectLetsRxIn({ ...session, filter: '' }, entry, rule.filters)).toBe(true)
    // A discount held to the fee lines never reaches a Prescription line.
    expect(effectLetsRxIn({ ...session, filter: '', scope: 'fees' }, entry, rule.filters)).toBe(false)
    const opened = updateFilter(rules, rule.id, rule.filters[0].id, { exclude: { categories: [] } })[0]
    expect(effectLetsRxIn(session, entry, opened.filters)).toBe(true)
    // An effect with no items field (points, a message), a missing filter, or an unknown block is not an Rx flag.
    const award = rulesOf('WLCB')[0].then[0]
    expect(effectLetsRxIn(award, catalogueBlock(CATALOGUE, 'effect', 'awardPoints'), [])).toBe(false)
    expect(effectLetsRxIn({ ...session, filter: 'gone' }, entry, rule.filters)).toBe(false)
    expect(effectLetsRxIn(session, undefined, rule.filters)).toBe(false)
  })

  it('names a new filter, and refuses an empty or a taken name', () => {
    const filters = [f({ id: 'a', name: 'items1' }), f({ id: 'b', name: 'items3' })]
    expect(nextFilterName(filters, 'items')).toBe('items2')
    expect(nextFilterName([], 'items')).toBe('items1')
    expect(filterNameProblem(filters, '  ')).toBe('empty')
    expect(filterNameProblem(filters, 'Items1')).toBe('taken')
    expect(filterNameProblem(filters, 'items1', 'a')).toBe(null)
    expect(filterNameProblem(filters, 'serum')).toBe(null)
    expect(filterNameProblem(filters, 'Back', undefined, [{ name: 'back' }])).toBe('taken')
  })

  it('adds, edits, copies, and deletes only a filter nothing uses', () => {
    const rules = rulesOf('SUN-3FOR2')
    const rule = rules[0]
    const sun = rule.filters[0]
    const added = addFilter(rules, rule.id, newFilter('n1', 'serum'))
    expect(added[0].filters.map((x) => x.id)).toEqual([sun.id, 'n1'])
    expect(updateFilter(added, rule.id, 'n1', { articles: ['SER-VC'] })[0].filters[1].articles).toEqual(['SER-VC'])
    expect(updateFilter(added, rule.id, 'gone', { name: 'x' })).toBe(added)

    // Delete: a filter in use stays (its blocks would silently widen to all merchandise).
    expect(filterUses(rule, sun.id, CATALOGUE)).toBe(2)
    expect(deleteFilter(added, rule.id, sun.id, CATALOGUE)).toBe(added)
    expect(deleteFilter(added, rule.id, 'n1', CATALOGUE)[0].filters.map((x) => x.id)).toEqual([sun.id])

    // Copy from another rule: a new id, the same picks, the name kept unless this rule has it.
    const two: CampaignRule[] = [...rules, { ...rule, id: 'r2', filters: [f({ id: 'z', name: 'sun' })], when: [], then: [] }]
    const copied = copyFilterInto(two, 'r2', sun, 'n2')
    expect(copied[1].filters[1]).toEqual({ ...sun, id: 'n2', name: 'sun2' })
    const intoFirst = copyFilterInto(two, rule.id, f({ id: 'q', name: 'eligible', exclude: { categories: ['A006'] } }), 'n3')
    expect(intoFirst[0].filters[1]).toEqual(f({ id: 'n3', name: 'eligible', exclude: { categories: ['A006'] } }))
    // The copy's lists are its own.
    copied[1].filters[1].articles!.push('X')
    expect(sun.articles).toEqual(['SUN-50', 'SUN-30', 'SUN-KID'])
  })
})
