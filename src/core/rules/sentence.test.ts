/**
 * Tickets 504, 522, 523 — a rule read as sentences. A condition or an effect reads in HQ's own words:
 * its catalogue block's `sentence` ({en, ar}, the real `Rules/Authoring/Catalogue` the drive serves),
 * its braced fields filled by type; a field the sentence does not name reads as a bundle clause or an
 * EN + AR line. Every block of the sample campaigns (schema 1) reads in full, with no raw key, brace
 * or type id; a filter is named by its CURRENT name, looked up by id; an expression is printed by the
 * codec.
 */
import i18next from 'i18next'
import { describe, expect, it } from 'vitest'
import en from '@/locales/en/campaign-workspace.json'
import type { CampaignRule, RuleCampaign, RuleCondition, RuleEffect } from '@/core/models/rule-campaign'
import { CAMPAIGNS, CATALOGUE } from '../../../tools/campaigns-fixtures.mjs'
import {
  blockFields,
  blockSentence,
  blockType,
  bracedFields,
  bundleSentence,
  campaignCurrency,
  catalogueBlock,
  filterChain,
  leafConditions,
  plainSentence,
  ruleSummary,
  templateParts,
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
const arabic = (s: Sentence) => plainSentence(s, t, 'ar')

/** Every bundle key a sentence uses, nested phrases included (HQ's own words have none of their own). */
function keysOf(s: Sentence): string[] {
  const inValue = (v: SentenceValue): string[] =>
    v.kind === 'phrase' ? keysOf(v.sentence) : v.kind === 'list' ? v.items.flatMap(inValue) : []
  return ['key' in s ? [s.key] : [], Object.values(s.values).flatMap(inValue)].flat()
}

/** Every catalogue type id written in camelCase — the ones no English sentence would contain. */
const BLOCKS = [...CATALOGUE.conditions, ...CATALOGUE.effects]
const TYPE_IDS = BLOCKS.map((b) => b.type).filter((type) => /[A-Z]/.test(type))

const blocks = CAMPAIGNS.flatMap(({ campaign: c }) =>
  c.rules.flatMap((r) => [
    ...leafConditions(r.when).map((b) => ({ c, r, kind: 'condition' as const, b: b as RuleCondition | RuleEffect })),
    ...r.then.map((b) => ({ c, r, kind: 'effect' as const, b: b as RuleCondition | RuleEffect })),
  ]),
)

const one = (code: string, kind: 'condition' | 'effect', i: number, read: (s: Sentence) => string = text) => {
  const c = campaign(code)
  const r = c.rules[0]
  const b = kind === 'condition' ? leafConditions(r.when)[i] : r.then[i]
  const s = blockSentence(kind, b, ctx(c, r))
  return [s.sentence, ...s.clauses].map(read).join('')
}

describe('sentence', () => {
  it('sentence_fillsBraceFields from a real catalogue block', () => {
    const minSubtotal = catalogueBlock(CATALOGUE, 'condition', 'minSubtotal')!
    expect(minSubtotal.sentence.en).toBe('the subtotal of {of} is at least {amount}')
    expect([...bracedFields(minSubtotal.sentence)].sort()).toEqual(['amount', 'of'])
    expect(templateParts(minSubtotal.sentence.en)).toEqual([{ text: 'the subtotal of ' }, { slot: 'of' }, { text: ' is at least ' }, { slot: 'amount' }])
    const c = campaign('PRCB-AUG26')
    const r = c.rules[0]
    const read = blockSentence('condition', r.when[0], ctx(c, r))
    expect(read.known).toBe(true)
    expect('template' in read.sentence && read.sentence.template).toEqual(minSubtotal.sentence)
    // Each braced field by its type: a filter by its name, money in the campaign's currency.
    expect(read.sentence.values).toEqual({ of: { kind: 'name', name: 'earning' }, amount: { kind: 'money', amount: 200, currency: 'SAR' } })
    expect(text(read.sentence)).toBe('the subtotal of earning is at least SAR 200.00')
    // HQ's Arabic template, the same values in it.
    expect(arabic(read.sentence)).toBe('مجموع earning لا يقل عن SAR 200.00')
    // A field the sentence does not name: `basis` off its default reads as the bundle's clause, the
    // "not met" text as a line under the sentence.
    expect(read.clauses.map(text)).toEqual([', counted after earlier offers'])
    expect(read.says).toEqual([{ field: 'says', role: 'notMet', says: { en: 'SAR 200 of eligible spend', ar: '200 ريال من المشتريات المؤهلة' } }])
  })

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
      for (const s of [read.sentence, ...read.clauses]) for (const key of keysOf(s)) expect(has(key) || instance.exists(key, { count: 2 }), `${where}: ${key}`).toBe(true)
      const line = [read.sentence, ...read.clauses].map(text).join('')
      expect(line, where).not.toMatch(/\{|\}|<\/?[a-z]+>|sentence\./)
      for (const id of TYPE_IDS) expect(line, `${where} leaks ${id}`).not.toContain(id)
    }
  })

  it('reads every block HQ lists, from a sample value per field type', () => {
    const c = campaign('WLCB')
    const r = c.rules[0]
    const sample: Record<string, (f: (typeof BLOCKS)[number]['fields'][number]) => unknown> = {
      filter: () => r.filters[0].id,
      money: () => 12.5,
      count: () => 2,
      points: () => 5,
      percent: () => 10,
      number: () => 3,
      code: () => 'X-1',
      codes: () => ['R101', 'R102'],
      text: () => ({ en: 'English', ar: 'عربي' }),
      choice: (f) => f.values?.[0],
      bool: () => true,
      formula: (f) => (f.unit ? 10 : ['>', '$back', 0]),
      pointsDate: () => ({ afterDays: 7 }),
      budget: () => c.budgets![0].id,
      date: () => '2026-11-01',
      time: () => '10:00',
      conditions: () => [],
      object: () => ({}),
      objects: () => [],
      entries: () => [],
    }
    const blocksRead = BLOCKS.filter((b) => b.type !== 'group')
    for (const b of blocksRead) {
      const item = { [b.kind === 'condition' ? 'check' : 'effect']: b.type, ...Object.fromEntries(blockFields(b).map((f) => [f.name, sample[f.type](f)])) } as unknown as RuleCondition
      const read = blockSentence(b.kind as 'condition' | 'effect', item, ctx(c, r))
      expect(read.known, b.type).toBe(true)
      const line = [read.sentence, ...read.clauses].map(text).join('')
      expect(line, b.type).not.toMatch(/\{|\}|<\/?[a-z]+>|sentence\.|not picked|nothing picked|no longer exists/)
      for (const id of TYPE_IDS) expect(line, `${b.type} leaks ${id}`).not.toContain(id)
    }
    expect(blocksRead.length).toBe(25)
  })

  it('reads the five 2702 campaigns and the prototype’s shapes in HQ’s words', () => {
    expect(one('SUN-3FOR2', 'condition', 0)).toBe('at least 3 units of sun')
    // `basis` at its default adds nothing.
    expect(one('SUN-3FOR2', 'condition', 1)).toBe('the subtotal of all merchandise is at least SAR 150.00')
    expect(one('SUN-3FOR2', 'effect', 0)).toBe('of every 3 of sun, the 1 cheapest free')
    // A choice's codes read in the bundle's words where it has them.
    expect(one('GP-BEAUTY15', 'condition', 0)).toBe("the member's tier is Gold or Platinum")
    expect(one('GP-BEAUTY15', 'effect', 0)).toBe('15% off beauty')
    expect(one('WKND20', 'condition', 0)).toBe('the customer presents coupon WKND*')
    // A discount's figure by its kind: a percent…
    expect(one('WKND20', 'effect', 0)).toBe('20% off eligible, spread pro rata')
    expect(one('PTS-50OFF', 'condition', 0)).toBe('the customer is a member (earning: yes)')
    expect(one('PTS-50OFF', 'condition', 2)).toBe('the subtotal of all merchandise is at least SAR 200.00, counted after earlier offers')
    expect(one('PTS-50OFF', 'condition', 3)).toBe('the member has at least 30 points')
    expect(one('PTS-50OFF', 'effect', 0)).toBe('use 30 points (pays the bill: no)')
    // …or an amount in the campaign's currency.
    expect(one('PTS-50OFF', 'effect', 1)).toBe('SAR 50.00 off eligible, spread pro rata')
    expect(one('WLCB', 'condition', 2)).toBe("it is the member's first purchase")
    expect(one('WLCB', 'condition', 3)).toBe('back > 0 is true')
    expect(one('WLCB', 'effect', 0)).toBe('award back SAR of points, under the activity WLCB, usable after 7 days, expiring after 30 days')
    expect(one('PRCB-AUG26', 'effect', 0)).toBe('award back SAR of points, under the activity PRCB, usable on 2026-09-10, expiring on 2026-09-17')
    expect(one('BASE-EARN', 'effect', 0)).toBe('award pts points, under the activity BASE, usable after 2 days, expiring after 365 days')
    expect(one('BABY-BUNDLE', 'effect', 0)).toBe('each bundle for SAR 85.00')
    expect(one('NEXT-VISIT', 'effect', 0)).toBe('a coupon of WKND20, valid 14 days')
    expect(one('GIFT-POUCH', 'effect', 0)).toBe('1 of pouch free, prompted if not scanned')
    expect(one('PCUT-SA01', 'effect', 0)).toBe('each item of all merchandise priced from the value map')
  })

  it('reads a rule’s bundle: its lists by filter name, and its limit', () => {
    const c = campaign('BABY-BUNDLE')
    const b = bundleSentence(c.rules[0].bundle!, c.rules[0])
    expect([b.sentence, ...b.clauses].map(text).join('')).toBe('A bundle of 1 of diapers and 2 of wipes, at most 2 bundles per sale')
  })

  it('reads a BHD amount to the fils', () => {
    const c = campaign('BH-SPEND10')
    expect(campaignCurrency(c.audience)).toBe('BHD')
    expect(text(blockSentence('condition', c.rules[0].when[0], ctx(c, c.rules[0])).sentence)).toBe('the subtotal of eligible is at least BHD 10.000')
    expect(campaignCurrency({ countries: ['SA', 'BH'] })).toBeNull()
    expect(campaignCurrency(undefined)).toBeNull()
  })

  it('keeps the EN + AR lines the sentence does not name out of it, by role', () => {
    const c = campaign('GIFT-POUCH')
    const r = c.rules[0]
    const read = blockSentence('effect', r.then[0], ctx(c, r))
    expect(read.says.map((s) => s.role)).toEqual(['cashierPrompt', 'receiptLabel'])
    expect(read.says[1].says).toEqual({ en: 'Free pouch', ar: 'حقيبة مجانية' })
    const cond = blockSentence('condition', r.when[0], ctx(c, r))
    expect(cond.says).toEqual([{ field: 'says', role: 'notMet', says: { en: 'a Vitamin C serum', ar: 'سيروم فيتامين سي' } }])
    // A text the sentence names is read inside it, in the reader's language.
    const msg = blockSentence('effect', { effect: 'cashierMessage', text: { en: 'Offer the bag', ar: 'اعرض الكيس' } }, ctx(c, r))
    expect(msg.says).toEqual([])
    expect(text(msg.sentence)).toBe('tell the cashier Offer the bag')
    expect(arabic(msg.sentence)).toBe('أبلغ الكاشير اعرض الكيس')
  })

  it('sentence_namesAFilterByItsCurrentName_viaId', () => {
    const c = structuredClone(campaign('SUN-3FOR2'))
    const r = c.rules[0]
    r.filters[0].name = 'Suncare'
    expect(text(blockSentence('condition', r.when[0], ctx(c, r)).sentence)).toBe('at least 3 units of Suncare')
    expect(text(blockSentence('effect', r.then[0], ctx(c, r)).sentence)).toBe('of every 3 of Suncare, the 1 cheapest free')
    // a reference that no longer resolves says so, and never shows the id
    r.filters = []
    expect(text(blockSentence('condition', r.when[0], ctx(c, r)).sentence)).toBe('at least 3 units of a filter that no longer exists')
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

  it('reads a block whose number is not set yet', () => {
    const c = campaign('SUN-3FOR2')
    const r = c.rules[0]
    const read = blockSentence('condition', { check: 'minCount', says: { en: '', ar: '' }, of: r.filters[0].id }, ctx(c, r))
    expect(read.known).toBe(true)
    expect(text(read.sentence)).toBe('at least not picked yet units of sun')
    // An empty "not met" line is no line.
    expect(read.says).toEqual([])
  })

  it('reads a yes / no expression as the codec prints it', () => {
    const c = campaign('WLCB')
    expect(text(blockSentence('condition', { check: 'formula', expr: true }, ctx(c, c.rules[0])).sentence)).toBe('true is true')
  })

  it('keeps a value that looks like a tag as written', () => {
    const c = campaign('WLCB')
    const read = blockSentence('condition', { check: 'formula', expr: ['>', '$a', 'b<c>d'] }, ctx(c, c.rules[0]))
    expect(text(read.sentence)).toBe("a > 'b<c>d' is true")
  })

  it('reads a rule whose only conditions are empty groups as "always"', () => {
    const rule = { when: [{ check: 'group', says: { en: '', ar: '' }, mode: 'any', conditions: [] }], filters: [], then: [] }
    expect(text(whenSentence(rule))).toBe('Always')
    expect(ruleSummary(rule).conditions).toBe(0)
  })

  it('counts a rule as HQ stores it when it omits a list (a template or upload bundle rule has no when)', () => {
    const rule = { filters: [{ id: 'fx' }, { id: 'fy' }], then: [{ effect: 'bundlePrice', value: 30 }] } as unknown as Parameters<typeof ruleSummary>[0]
    expect(ruleSummary(rule)).toEqual({ filters: 2, conditions: 0, effects: 1 })
    expect(ruleSummary({} as Parameters<typeof ruleSummary>[0])).toEqual({ filters: 0, conditions: 0, effects: 0 })
  })

  it('says so for a block the catalogue does not list, rather than guessing', () => {
    const c = campaign('PCUT-SA01')
    const read = blockSentence('effect', { effect: 'webhook' }, ctx(c, c.rules[0]))
    expect(read.known).toBe(false)
    expect(text(read.sentence)).toBe('A block this screen cannot read yet (webhook)')
  })
})
