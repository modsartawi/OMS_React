/**
 * Tickets 504, 522 — a rule read as sentences. Every block of the sample campaigns (schema 1,
 * re-cut from the prototype's in 522), read through the stubbed catalogue the drive serves, becomes a
 * sentence whose every key exists in the `campaign-workspace` bundle and whose text leaks no raw type
 * id; a filter is named by its CURRENT name, looked up by id; an expression is printed by the codec.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/campaign-workspace.json'
import type { CampaignRule, RuleCampaign, RuleCondition, RuleEffect } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../tools/campaigns-fixtures.mjs'
import {
  blockSentence,
  blockType,
  bundleSentence,
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

const campaign = (code: string): RuleCampaign => CAMPAIGNS.find((x) => x.code === code)!.campaign
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

const blocks = CAMPAIGNS.flatMap(({ campaign: c }) =>
  c.rules.flatMap((r) => [
    ...leafConditions(r.when).map((b) => ({ c, r, kind: 'condition' as const, b: b as RuleCondition | RuleEffect })),
    ...r.then.map((b) => ({ c, r, kind: 'effect' as const, b: b as RuleCondition | RuleEffect })),
  ]),
)

describe('sentence', () => {
  it('reads blocks of every type the sample campaigns use', () => {
    const types = new Set(blocks.map((x) => blockType(x.b)))
    // 11 condition types and 10 effect types, schema 1's own ids
    expect(types.size).toBe(21)
  })

  it('sentence_rendersEveryCatalogueBlock_ofThePrototypeCampaigns', () => {
    for (const { c, r, kind, b } of blocks) {
      const read = blockSentence(kind, b, ctx(c, r))
      const where = `${c.id} ${kind} ${blockType(b)}`
      expect(read.known, where).toBe(true)
      for (const s of [read.sentence, ...read.clauses])
        for (const key of keysOf(s)) expect(has(key, key === s.key ? s.count : undefined) || instance.exists(key, { count: 2 }), `${where}: ${key}`).toBe(true)
      const line = [read.sentence, ...read.clauses].map(text).join('')
      expect(line, where).not.toMatch(/\{\{|\}\}|<\/?[a-z]+>|sentence\./)
      for (const id of TYPE_IDS) expect(line, `${where} leaks ${id}`).not.toContain(id)
    }
  })

  it('reads every block the catalogue offers, from a sample value per field kind', () => {
    const c = campaign('WLCB')
    const r = c.rules[0]
    const sample: Record<string, (f: (typeof CATALOGUE.blocks)[number]['fields'][number]) => unknown> = {
      items: () => r.filters[0].id,
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
      formula: () => ['>', '$back', 0],
      timing: () => ({ afterDays: 7 }),
      budget: () => c.budgets![0].id,
      flag: () => true,
      says: () => ({ en: 'English', ar: 'عربي' }),
    }
    const blocksRead = CATALOGUE.blocks.filter((b) => b.type !== 'group')
    for (const b of blocksRead) {
      const key = b.kind === 'condition' ? 'check' : 'effect'
      const item = { [key]: b.type, says: { en: '', ar: '' }, ...Object.fromEntries(b.fields.map((f) => [f.key, sample[f.kind](f)])) } as unknown as RuleCondition
      const read = blockSentence(b.kind, item, ctx(c, r))
      expect(read.known, b.type).toBe(true)
      const line = [read.sentence, ...read.clauses].map(text).join('')
      expect(line, b.type).not.toMatch(/\{\{|\}\}|<\/?[a-z]+>|sentence\.|not picked|nothing picked|no longer exists/)
      for (const id of TYPE_IDS) expect(line, `${b.type} leaks ${id}`).not.toContain(id)
    }
    expect(blocksRead.length).toBe(25)
  })

  it('reads the five 2702 campaigns and the prototype’s shapes', () => {
    const one = (code: string, kind: 'condition' | 'effect', i: number) => {
      const c = campaign(code)
      const r = c.rules[0]
      const b = kind === 'condition' ? leafConditions(r.when)[i] : r.then[i]
      const read = blockSentence(kind, b, ctx(c, r))
      return [read.sentence, ...read.clauses].map(text).join('')
    }
    expect(one('SUN-3FOR2', 'condition', 0)).toBe('At least 3 units of sun')
    expect(one('SUN-3FOR2', 'condition', 1)).toBe('The value of all merchandise is at least SAR 150.00, before any offer')
    expect(one('SUN-3FOR2', 'effect', 0)).toBe('For every 3 of sun, the cheapest 1 unit is free')
    expect(one('GP-BEAUTY15', 'condition', 0)).toBe('The member’s tier is Gold or Platinum')
    expect(one('GP-BEAUTY15', 'effect', 0)).toBe('Take 15% off each item of beauty')
    expect(one('WKND20', 'condition', 0)).toBe('The customer presents a coupon matching WKND*')
    expect(one('WKND20', 'effect', 0)).toBe('Take 20% off eligible, spread pro rata')
    expect(one('PTS-50OFF', 'condition', 0)).toBe('The customer is an earning Arbahi member')
    expect(one('PTS-50OFF', 'condition', 3)).toBe('The member’s points balance is at least 30')
    expect(one('PTS-50OFF', 'effect', 0)).toBe('Take 30 points from the member')
    expect(one('PTS-50OFF', 'effect', 1)).toBe('Take SAR 50.00 off eligible, spread pro rata')
    expect(one('WLCB', 'condition', 2)).toBe('It is the member’s first purchase')
    expect(one('WLCB', 'condition', 3)).toBe('The formula back > 0 is true')
    expect(one('WLCB', 'effect', 0)).toBe('Award back in SAR of points under the activity WLCB, usable after 7 days, expiring after 30 days')
    expect(one('PRCB-AUG26', 'effect', 0)).toBe('Award back in SAR of points under the activity PRCB, usable on 2026-09-10, expiring on 2026-09-17')
    expect(one('BASE-EARN', 'effect', 0)).toBe('Award pts points under the activity BASE, usable after 2 days, expiring after 365 days')
    expect(one('BABY-BUNDLE', 'effect', 0)).toBe('Sell each bundle for SAR 85.00')
    expect(one('NEXT-VISIT', 'effect', 0)).toBe('Create a coupon from WKND20, valid for 14 days')
    expect(one('GIFT-POUCH', 'effect', 0)).toBe('Give 1 unit of pouch free when it is scanned')
    expect(one('PCUT-SA01', 'effect', 0)).toBe('Price each item of all merchandise from the value map')
  })

  it('reads a rule’s bundle: its lists by filter name, and its limit', () => {
    const c = campaign('BABY-BUNDLE')
    const b = bundleSentence(c.rules[0].bundle!, c.rules[0])
    expect([b.sentence, ...b.clauses].map(text).join('')).toBe('A bundle of 1 of diapers and 2 of wipes, at most 2 bundles per sale')
  })

  it('reads a BHD amount to the fils', () => {
    const c = campaign('BH-SPEND10')
    expect(campaignCurrency(c.audience)).toBe('BHD')
    expect(text(blockSentence('condition', c.rules[0].when[0], ctx(c, c.rules[0])).sentence)).toBe(
      'The value of eligible is at least BHD 10.000, after earlier offers',
    )
    expect(campaignCurrency({ countries: ['SA', 'BH'] })).toBeNull()
    expect(campaignCurrency(undefined)).toBeNull()
  })

  it('keeps the EN + AR lines out of the sentence, by role', () => {
    const c = campaign('GIFT-POUCH')
    const r = c.rules[0]
    const read = blockSentence('effect', r.then[0], ctx(c, r))
    expect(read.says.map((s) => s.role)).toEqual(['cashierPrompt', 'receiptLabel'])
    expect(read.says[1].says).toEqual({ en: 'Free pouch', ar: 'حقيبة مجانية' })
    const cond = blockSentence('condition', r.when[0], ctx(c, r))
    expect(cond.says).toEqual([{ field: 'says', role: 'notMet', says: { en: 'a Vitamin C serum', ar: 'سيروم فيتامين سي' } }])
  })

  it('sentence_namesAFilterByItsCurrentName_viaId', () => {
    const c = structuredClone(campaign('SUN-3FOR2'))
    const r = c.rules[0]
    r.filters[0].name = 'Suncare'
    expect(text(blockSentence('condition', r.when[0], ctx(c, r)).sentence)).toBe('At least 3 units of Suncare')
    expect(text(blockSentence('effect', r.then[0], ctx(c, r)).sentence)).toBe('For every 3 of Suncare, the cheapest 1 unit is free')
    // a reference that no longer resolves says so, and never shows the id
    r.filters = []
    expect(text(blockSentence('condition', r.when[0], ctx(c, r)).sentence)).toBe('At least 3 units of a filter that no longer exists')
  })

  it('reads a filter as a chain, Prescription by its name', () => {
    const chain = filterChain(campaign('WKND20').rules[0].filters[0])
    expect(chain.name).toBe('eligible')
    expect(chain.links.map(text)).toEqual(['any cart item', 'not Prescription A006'])
    expect(filterChain(campaign('SUN-3FOR2').rules[0].filters[0]).links.map(text)).toEqual(['product SUN-50, SUN-30, or SUN-KID'])
    expect(filterChain(campaign('BASE-EARN').rules[0].filters[0]).links.map(text)).toEqual(['category A001, A002, A003, or A005'])
  })

  it('reads a rule with no condition as "always"', () => {
    const c = campaign('PCUT-SA01')
    expect(text(whenSentence(c.rules[0]))).toBe('Always')
    expect(ruleSummary(c.rules[0])).toEqual({ filters: 0, conditions: 0, effects: 1 })
    expect(text(whenSentence(campaign('SUN-3FOR2').rules[0]))).toBe('When all of these are true')
  })

  it('reads a named value through the codec, its filter by name — and its JSON when it cannot be printed', () => {
    const r = campaign('PRCB-AUG26').rules[0]
    expect(r.values.map((v) => text(valueSentence(v, r)))).toEqual([
      "basis is worked out as sum(items('earning'), item.net)",
      'rate is worked out as band(basis, 200:0.1, 400:0.12, 700:0.15)',
      'back is worked out as min(round(basis * rate, 0, halfUp), 105)',
    ])
    expect(text(valueSentence({ name: 'odd', expr: [1, 2] }, r))).toBe('odd is worked out as [1,2]')
  })

  it('reads a block whose number is not set yet, in its plural form', () => {
    const c = campaign('SUN-3FOR2')
    const r = c.rules[0]
    const read = blockSentence('condition', { check: 'minCount', says: { en: '', ar: '' }, of: r.filters[0].id }, ctx(c, r))
    expect(read.known).toBe(true)
    expect(text(read.sentence)).toBe('At least not picked yet units of sun')
  })

  it('keeps a value that looks like a tag as written', () => {
    const c = campaign('WLCB')
    const read = blockSentence('condition', { check: 'formula', expr: ['>', '$a', 'b<c>d'] }, ctx(c, c.rules[0]))
    expect(text(read.sentence)).toBe("The formula a > 'b<c>d' is true")
  })

  it('reads a rule whose only conditions are empty groups as "always"', () => {
    const rule = { when: [{ check: 'group', says: { en: '', ar: '' }, mode: 'any', conditions: [] }], filters: [], then: [] }
    expect(text(whenSentence(rule))).toBe('Always')
    expect(ruleSummary(rule).conditions).toBe(0)
  })

  it('says so for a block the catalogue does not know, rather than guessing', () => {
    const c = campaign('PCUT-SA01')
    const read = blockSentence('effect', { effect: 'webhook' }, ctx(c, c.rules[0]))
    expect(read.known).toBe(false)
    expect(text(read.sentence)).toBe('A block this screen cannot read yet (webhook)')
  })
})
