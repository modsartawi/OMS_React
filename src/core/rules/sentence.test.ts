/**
 * Ticket 504 — a rule read as sentences. Every block of the prototype's sample campaigns, read
 * through the stubbed catalogue the drive serves, becomes a sentence whose every key exists in the
 * `campaign-workspace` bundle and whose text leaks no raw type id; a filter is named by its CURRENT
 * name, looked up by id.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/campaign-workspace.json'
import type { CampaignRule, RuleCampaign, RuleCondition, RuleEffect } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../tools/campaigns-fixtures.mjs'
import {
  blockSentence,
  campaignCurrency,
  filterChain,
  leafConditions,
  plainSentence,
  ruleSummary,
  valueSentence,
  whenSentence,
  type Sentence,
  type SentenceContext,
  type SentenceValue,
} from './sentence'

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

const ctx = (c: RuleCampaign, rule: CampaignRule): SentenceContext => ({ campaign: c, rule, catalogue: CATALOGUE, has })
const text = (s: Sentence) => plainSentence(s, t)

/** Every key a sentence uses, nested phrases included. */
function keysOf(s: Sentence): string[] {
  const inValue = (v: SentenceValue): string[] =>
    v.kind === 'phrase' ? keysOf(v.sentence) : v.kind === 'list' ? v.items.flatMap(inValue) : []
  return [s.key, ...Object.values(s.values).flatMap(inValue)]
}

/** Every catalogue type id written in camelCase — the ones no English sentence would contain. */
const TYPE_IDS = CATALOGUE.blocks.map((b) => b.type).filter((type) => /[A-Z]/.test(type))

const blocks = CAMPAIGNS.flatMap((c) =>
  c.rules.flatMap((r) => [
    ...leafConditions(r.when).map((b) => ({ c, r, kind: 'condition' as const, b: b as RuleCondition | RuleEffect })),
    ...r.then.map((b) => ({ c, r, kind: 'effect' as const, b: b as RuleCondition | RuleEffect })),
  ]),
)

describe('sentence', () => {
  it('reads blocks of every type the prototype campaigns use', () => {
    const types = new Set(blocks.map((x) => x.b.type))
    // the five 2702 campaigns and the 2718 shapes: 9 condition types and 10 effect types
    expect(types.size).toBe(19)
  })

  it('sentence_rendersEveryCatalogueBlock_ofThePrototypeCampaigns', () => {
    for (const { c, r, kind, b } of blocks) {
      const read = blockSentence(kind, b, ctx(c, r))
      const where = `${c.code} ${kind} ${b.type}`
      expect(read.known, where).toBe(true)
      for (const s of [read.sentence, ...read.clauses])
        for (const key of keysOf(s)) expect(has(key, key === s.key ? s.count : undefined) || instance.exists(key, { count: 2 }), `${where}: ${key}`).toBe(true)
      const line = [read.sentence, ...read.clauses].map(text).join('')
      expect(line, where).not.toMatch(/\{\{|\}\}|<\/?[a-z]+>|sentence\./)
      for (const id of TYPE_IDS) expect(line, `${where} leaks ${id}`).not.toContain(id)
    }
  })

  it('reads every block the catalogue offers, from a sample value per field kind', () => {
    const c = CAMPAIGNS.find((x) => x.code === 'WLCB')!
    const r = c.rules[0]
    const sample: Record<string, (f: (typeof CATALOGUE.blocks)[number]['fields'][number]) => unknown> = {
      items: () => r.filters[0].id,
      itemParts: () => [{ of: r.filters[0].id, count: 2 }],
      money: () => 12.5,
      count: () => 2,
      days: () => 3,
      discount: () => 10,
      points: () => 5,
      code: () => 'X-1',
      codes: () => ['R101', 'R102'],
      text: () => 'VIP',
      choice: (f) => f.options?.[0],
      choices: (f) => f.options?.slice(0, 2),
      formula: () => 'back > 0',
      timing: () => ({ mode: 'afterDays', value: 7 }),
      budget: () => c.budgets[0].id,
      flag: () => true,
      says: () => ({ en: 'English', ar: 'عربي' }),
    }
    const blocksRead = CATALOGUE.blocks.filter((b) => b.type !== 'group')
    for (const b of blocksRead) {
      const item = { id: 'x', type: b.type, says: { en: '', ar: '' }, ...Object.fromEntries(b.fields.map((f) => [f.key, sample[f.kind](f)])) }
      const read = blockSentence(b.kind, item, ctx(c, r))
      expect(read.known, b.type).toBe(true)
      const line = [read.sentence, ...read.clauses].map(text).join('')
      expect(line, b.type).not.toMatch(/\{\{|\}\}|<\/?[a-z]+>|sentence\.|not picked|nothing picked|no longer exists/)
      for (const id of TYPE_IDS) expect(line, `${b.type} leaks ${id}`).not.toContain(id)
    }
    expect(blocksRead.length).toBe(26)
  })

  it('reads the five 2702 campaigns as the prototype does', () => {
    const one = (code: string, kind: 'condition' | 'effect', i: number) => {
      const c = CAMPAIGNS.find((x) => x.code === code)!
      const r = c.rules[0]
      const b = kind === 'condition' ? leafConditions(r.when)[i] : r.then[i]
      const read = blockSentence(kind, b, ctx(c, r))
      return [read.sentence, ...read.clauses].map(text).join('')
    }
    expect(one('SUN-3FOR2', 'condition', 0)).toBe('At least 3 units of sun')
    expect(one('SUN-3FOR2', 'condition', 1)).toBe('The value of all merchandise is at least SAR 150.00, before any offer')
    expect(one('SUN-3FOR2', 'effect', 0)).toBe('For every 3 of sun, the cheapest 1 unit is free')
    expect(one('GP-BEAUTY15', 'condition', 0)).toBe('The member’s tier is Gold or Platinum')
    expect(one('GP-BEAUTY15', 'effect', 0)).toBe('Take 15% off each line of beauty')
    expect(one('WKND20', 'effect', 0)).toBe('Take 20% off eligible, spread pro rata, at most SAR 40.00')
    expect(one('PTS-50OFF', 'condition', 2)).toBe('The member’s points balance is at least SAR 30.00 of points')
    expect(one('PTS-50OFF', 'effect', 1)).toBe('Take SAR 50.00 off eligible, spread pro rata')
    expect(one('WLCB', 'condition', 0)).toBe('The coupon code matches HAYAK*')
    expect(one('WLCB', 'condition', 2)).toBe('The formula back > 0 is true')
    expect(one('WLCB', 'effect', 0)).toBe('Award back in SAR of points under the activity WLCB, usable after 7 days, expiring after 30 days')
    expect(one('PRCB-AUG26', 'effect', 0)).toBe('Award back in SAR of points under the activity PRCB, usable on 2026-09-10, expiring on 2026-09-17')
    expect(one('BASE-EARN', 'effect', 0)).toBe('Award pts points under the activity BASE, usable after 48 hours, expiring after 365 days')
    expect(one('BABY-BUNDLE', 'effect', 0)).toBe('Sell 1 of diapers and 2 of wipes together for SAR 85.00, at most 2 bundles per sale')
    expect(one('NEXT-VISIT', 'effect', 0)).toBe('Create a coupon from WKND20, valid for 14 days, bound to the member')
    expect(one('GIFT-POUCH', 'effect', 0)).toBe('Give 1 unit of GIFT-BAG free when it is scanned')
  })

  it('reads a BHD amount to the fils', () => {
    const c = CAMPAIGNS.find((x) => x.code === 'BH-SPEND10')!
    expect(campaignCurrency(c.audience)).toBe('BHD')
    expect(text(blockSentence('condition', c.rules[0].when.items[0], ctx(c, c.rules[0])).sentence)).toBe(
      'The value of eligible is at least BHD 10.000, after earlier offers',
    )
    expect(campaignCurrency({ countries: ['SA', 'BH'] })).toBeNull()
  })

  it('keeps the EN + AR lines out of the sentence, by role', () => {
    const c = CAMPAIGNS.find((x) => x.code === 'GIFT-POUCH')!
    const r = c.rules[0]
    const read = blockSentence('effect', r.then[0], ctx(c, r))
    expect(read.says.map((s) => s.role)).toEqual(['cashierPrompt', 'receiptLabel'])
    expect(read.says[1].says).toEqual({ en: 'Free pouch', ar: 'حقيبة مجانية' })
    const cond = blockSentence('condition', r.when.items[0], ctx(c, r))
    expect(cond.says).toEqual([{ field: 'says', role: 'notMet', says: { en: 'a Vitamin C serum', ar: 'سيروم فيتامين سي' } }])
  })

  it('sentence_namesAFilterByItsCurrentName_viaId', () => {
    const c = structuredClone(CAMPAIGNS.find((x) => x.code === 'SUN-3FOR2')!)
    const r = c.rules[0]
    r.filters[0].name = 'Suncare'
    expect(text(blockSentence('condition', r.when.items[0], ctx(c, r)).sentence)).toBe('At least 3 units of Suncare')
    expect(text(blockSentence('effect', r.then[0], ctx(c, r)).sentence)).toBe('For every 3 of Suncare, the cheapest 1 unit is free')
    // a reference that no longer resolves says so, and never shows the id
    r.filters = []
    const gone = text(blockSentence('condition', r.when.items[0], ctx(c, r)).sentence)
    expect(gone).toBe('At least 3 units of a filter that no longer exists')
  })

  it('reads a filter as a chain, Prescription by its name', () => {
    const c = CAMPAIGNS.find((x) => x.code === 'WKND20')!
    const chain = filterChain(c.rules[0].filters[0])
    expect(chain.name).toBe('eligible')
    expect(chain.links.map(text)).toEqual(['cart items', 'not Prescription A006'])
    const sun = filterChain(CAMPAIGNS.find((x) => x.code === 'SUN-3FOR2')!.rules[0].filters[0])
    expect(sun.links.map(text)).toEqual(['cart items', 'in collection SUNCARE'])
    const earning = filterChain(CAMPAIGNS.find((x) => x.code === 'BASE-EARN')!.rules[0].filters[0])
    expect(earning.links.map(text)).toEqual(['cart items', 'category A001, A002, A003, or A005'])
  })

  it('reads a rule with no condition as "always"', () => {
    const c = CAMPAIGNS.find((x) => x.code === 'PCUT-SA01')!
    expect(text(whenSentence(c.rules[0]))).toBe('Always')
    expect(ruleSummary(c.rules[0])).toEqual({ filters: 0, conditions: 0, effects: 1 })
    expect(text(whenSentence(CAMPAIGNS.find((x) => x.code === 'SUN-3FOR2')!.rules[0]))).toBe('When all of these are true')
  })

  it('reads a named value as written, never parsed', () => {
    expect(text(valueSentence({ name: 'rate', formula: 'band(basis, 200:0.10, 400:0.12)' }))).toBe(
      'rate is worked out as band(basis, 200:0.10, 400:0.12)',
    )
  })

  it('reads a block whose number is not set yet, in its plural form', () => {
    const c = CAMPAIGNS.find((x) => x.code === 'SUN-3FOR2')!
    const r = c.rules[0]
    const read = blockSentence('condition', { id: 'k', type: 'minCount', says: { en: '', ar: '' }, of: r.filters[0].id }, ctx(c, r))
    expect(read.known).toBe(true)
    expect(text(read.sentence)).toBe('At least not picked yet units of sun')
  })

  it('keeps a value that looks like a tag as written', () => {
    const c = CAMPAIGNS[0]
    const read = blockSentence('condition', { id: 'k', type: 'expr', says: { en: '', ar: '' }, formula: 'a<b>c' }, ctx(c, c.rules[0]))
    expect(text(read.sentence)).toBe('The formula a<b>c is true')
  })

  it('reads a rule whose only conditions are empty groups as "always"', () => {
    const rule = { when: { mode: 'all' as const, items: [{ id: 'g', type: 'group', says: { en: '', ar: '' }, mode: 'any', items: [] }] }, filters: [], then: [] }
    expect(text(whenSentence(rule))).toBe('Always')
    expect(ruleSummary(rule).conditions).toBe(0)
  })

  it('says so for a block the catalogue does not know, rather than guessing', () => {
    const c = CAMPAIGNS[0]
    const read = blockSentence('effect', { id: 'x', type: 'webhook' }, ctx(c, c.rules[0]))
    expect(read.known).toBe(false)
    expect(text(read.sentence)).toBe('A block this screen cannot read yet (webhook)')
  })
})
