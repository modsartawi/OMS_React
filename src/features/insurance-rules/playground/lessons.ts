import { EXPERIMENT_FORMAT, readExperiment, type PlaygroundExperiment } from '@/core/insurance-rules/experiment'
import type { CompareSeed } from './ComparePanel'
import type { LessonExpect } from './lesson-check'

// The playground's lessons (BackOffice spec 3243 stories 45-47; oms ticket 689): static experiments shipped with the
// page, each a v1 experiment FILE (the 687 codec, so a lesson travels exactly like an exported experiment) plus its
// expected result as a minimal assertion. The title and explanation are copy: `lessons.items.<id>.title|explain` in
// the `insurance-playground` namespace (en + ar). The data, the rules and their names are EXAMPLE data, not copy.
//
// 🚩 The assertions are authored against the stubs (`tools/insurance-rules-stubs.mjs`, 677 + 678 + 684 + 689); 691
// re-runs every lesson's Check on the live door and corrects an assertion only after confirming the engine is right.
// The rule spellings are SIS.Rules' (`group` + `mode`, `not`, `history`, `eligibility`, `formula` + `expr`); the
// nested trace path `when[0].conditions[1]` and the formula's `lines(filter($request.lines, …))` are the brief's
// guesses until 3244 / ADR 0117 as built.

export interface Lesson {
  /** Its key under `lessons.items` (machine word). */
  id: string
  /** The experiment as a v1 file. */
  file: Record<string, unknown>
  /** The expected result, every expectation of which must hold. */
  expects: LessonExpect[]
  /**
   * A lesson that contrasts two answers ships its B side (3243 review): Compare opens with this data and the lesson's
   * own rule. Check still judges A; B is there to be seen beside it.
   */
  compare?: { data: Record<string, unknown> }
}

const head = (id: string, kind: string, asOf = '2026-10-30T10:00:00') => ({ format: EXPERIMENT_FORMAT, version: 1, name: `lesson-${id}`, kind, asOf })

const REQUEST = { channel: 'nphies', store: 'P001', payer: '0001100041', policy: null, class: null, pharmacist: null, attributes: {} }
const PATIENT = { birthDate: '1990-04-01', gender: 'M', attributes: {} }
const line = (n: number, over: Record<string, unknown> = {}) => ({
  line: n,
  item: '200021',
  quantity: 2,
  unit: 'PC',
  daysSupply: 30,
  icd: ['E11'],
  price: 120.5,
  eCode: null,
  dCode: null,
  sfdaCode: null,
  idfPriority: null,
  attributes: {},
  ...over,
})
const data = (lines: unknown[], more: Record<string, unknown> = {}) => ({ request: REQUEST, patient: PATIENT, lines, history: [], reference: {}, eligibility: {}, ...more })
const doc = (kind: string, rules: unknown[]) => ({ schema: 1, kind, revision: 0, fields: [], lists: [], rules })
const warn = (en: string, ar: string) => [{ effect: 'guard', severity: 'WARN', says: { en, ar } }]
const num = (n: number, unit = 'SAR') => ({ type: 'number', number: n, unit })

const LONG_SUPPLY = {
  id: 'G-1',
  name: { en: 'Long supply', ar: 'صرف لمدة طويلة' },
  onUnknown: 'none',
  when: [{ check: 'line', field: 'daysSupply', above: 90 }],
  then: warn('More than 90 days of supply', 'أكثر من 90 يوماً من الصرف'),
}

/** A rule per field of benefit category 66, each true only when that field holds exactly 10,000. */
const benefitRule = (field: string) => ({
  id: `G-${field}`,
  name: { en: `Category 66 ${field} is 10,000`, ar: `${field} للفئة 66 يساوي 10,000` },
  onUnknown: 'none',
  when: [{ check: 'eligibility', field: `benefit[66].${field}`, atLeast: 10000, atMost: 10000 }],
  then: warn(`${field} holds 10,000`, `${field} يساوي 10,000`),
})

const OVER_APPROVAL = {
  id: 'G-7',
  name: { en: 'Above the approval limit of category 66', ar: 'فوق حد الموافقة للفئة 66' },
  onUnknown: 'none',
  when: [{ check: 'formula', expr: ['>', '$line.price', '$eligibility.benefit[66].approvalLimit'] }],
  then: warn('The price is above the approval limit of category 66', 'السعر فوق حد الموافقة للفئة 66'),
}

export const LESSONS: readonly Lesson[] = [
  {
    id: 'unknownVsFalse',
    file: {
      ...head('unknownVsFalse', 'guard'),
      data: data([line(1, { daysSupply: null }), line(2, { daysSupply: 30 })]),
      document: doc('guard', [LONG_SUPPLY]),
    },
    expects: [
      { expect: 'matched', lines: null },
      { expect: 'trace', line: 1, ruleId: 'G-1', blockPath: 'when[0]', value: 'unknown' },
      { expect: 'trace', line: 2, ruleId: 'G-1', blockPath: 'when[0]', value: false },
    ],
  },
  {
    id: 'groups',
    file: {
      ...head('groups', 'guard'),
      data: data([line(1, { daysSupply: 120 })]),
      document: doc('guard', [
        {
          id: 'G-2',
          name: { en: 'Long or large, not costly, and a normal pack', ar: 'طويل أو كبير، غير مكلف، وعبوة عادية' },
          onUnknown: 'none',
          when: [
            {
              check: 'group',
              mode: 'any',
              conditions: [
                { check: 'line', field: 'daysSupply', above: 90 },
                { check: 'line', field: 'quantity', atLeast: 5 },
              ],
            },
            { check: 'line', field: 'price', above: 1000, not: true },
            {
              check: 'group',
              mode: 'all',
              conditions: [
                { check: 'line', field: 'quantity', atLeast: 1 },
                { check: 'line', field: 'quantity', under: 10 },
              ],
            },
          ],
          then: warn('A long or large supply', 'صرف طويل أو كبير'),
        },
      ]),
    },
    expects: [
      { expect: 'matched', lines: [1] },
      { expect: 'trace', line: 1, ruleId: 'G-2', blockPath: 'when[0]', value: true },
      { expect: 'trace', line: 1, ruleId: 'G-2', blockPath: 'when[0].conditions[1]', value: false },
      { expect: 'trace', line: 1, ruleId: 'G-2', blockPath: 'when[1]', value: true },
    ],
  },
  {
    id: 'quantityCap',
    file: {
      ...head('quantityCap', 'coverage'),
      data: data([line(1, { daysSupply: 120 }), line(2, { daysSupply: 30 })], {
        payer: { deductibles: { G1: { percent: 20, max: 50 }, G2: { percent: 30, max: 100 }, G3: { percent: null, max: null } } },
      }),
      document: doc('coverage', [
        {
          id: 'C-1',
          name: { en: 'One pack on a long supply', ar: 'عبوة واحدة للصرف الطويل' },
          when: [{ check: 'line', field: 'daysSupply', above: 90 }],
          then: [{ effect: 'quantityCap', value: 1 }],
        },
      ]),
    },
    expects: [
      { expect: 'verdict', line: 1, field: 'quantityCap', value: 1, ruleId: 'C-1' },
      { expect: 'verdict', line: 2, field: 'quantityCap', value: null },
    ],
  },
  {
    id: 'categoryOrder',
    file: {
      ...head('categoryOrder', 'category'),
      data: data([line(1, { daysSupply: 120, price: 50 }), line(2, { daysSupply: 120, price: 150 })]),
      document: doc('category', [
        {
          id: 'K-1',
          name: { en: 'A costly item counts as generic', ar: 'الصنف المكلف يحسب عاماً' },
          when: [{ check: 'line', field: 'price', above: 100 }],
          then: [{ effect: 'setCategory', group: 'G1' }],
        },
        {
          id: 'K-2',
          name: { en: 'Long supply counts as brand', ar: 'الصرف الطويل يحسب علامة تجارية' },
          when: [{ check: 'line', field: 'daysSupply', above: 90 }],
          then: [{ effect: 'setCategory', group: 'G2' }],
        },
      ]),
    },
    expects: [
      { expect: 'verdict', line: 1, field: 'group', value: 'G2', ruleId: 'K-2' },
      { expect: 'verdict', line: 2, field: 'group', value: 'G1', ruleId: 'K-1' },
    ],
  },
  {
    id: 'historyWindow',
    file: {
      ...head('historyWindow', 'guard'),
      data: data([line(1)], {
        history: [{ eventType: 'DISPENSED', at: '2026-10-20T10:00:00', item: '200021', quantity: 1, daysSupply: 30, store: 'P001', payer: '0001100041', attributes: {} }],
      }),
      document: doc('guard', [
        {
          id: 'G-5',
          name: { en: 'Dispensed again within 30 days', ar: 'صرف مرة أخرى خلال 30 يوماً' },
          onUnknown: 'none',
          when: [{ check: 'history', match: 'sameItem', windowDays: 30, measure: 'dispenses', atLeast: 1, includeThisLine: false }],
          then: warn('The same item was dispensed in the last 30 days', 'صرف الصنف نفسه خلال آخر 30 يوماً'),
        },
      ]),
    },
    expects: [
      { expect: 'matched', lines: [1] },
      { expect: 'trace', line: 1, ruleId: 'G-5', blockPath: 'when[0]', value: true },
    ],
  },
  {
    id: 'benefit66',
    file: {
      ...head('benefit66', 'guard'),
      data: data([line(1)], {
        eligibility: {
          'benefit[66].benefit': num(50000),
          'benefit[66].approvalLimit': num(10000),
          'benefit[66].copayPct': num(20, '%'),
          'benefit[66].copayMax': num(75),
        },
      }),
      document: doc('guard', ['benefit', 'approvalLimit', 'copayPct', 'copayMax'].map(benefitRule)),
    },
    expects: [
      { expect: 'trace', line: 1, ruleId: 'G-approvalLimit', blockPath: 'when[0]', value: true },
      { expect: 'trace', line: 1, ruleId: 'G-benefit', blockPath: 'when[0]', value: false },
      { expect: 'trace', line: 1, ruleId: 'G-copayMax', blockPath: 'when[0]', value: false },
      { expect: 'verdict', line: 1, field: 'fired', value: ['G-approvalLimit'] },
    ],
  },
  {
    id: 'otherPayer',
    file: {
      ...head('otherPayer', 'guard'),
      data: {
        ...data([line(1)], { eligibility: { 'benefit[66].approvalLimit': num(100) } }),
        request: { ...REQUEST, payer: '0001100099' },
      },
      document: doc('guard', [OVER_APPROVAL]),
    },
    expects: [
      { expect: 'matched', lines: [1] },
      { expect: 'verdict', line: 1, field: 'outcome', value: 'warn' },
    ],
    // B: the same request and rule at the first payer, whose category 66 approval limit is 10,000 — line 1 passes.
    compare: { data: data([line(1)], { eligibility: { 'benefit[66].approvalLimit': num(10000) } }) },
  },
  {
    id: 'crossLine',
    file: {
      ...head('crossLine', 'guard'),
      data: data([line(1), line(2, { item: '100345' }), line(3)]),
      document: doc('guard', [
        {
          id: 'G-8',
          name: { en: 'SKU 200021 on more than one line', ar: 'الصنف 200021 في أكثر من سطر' },
          onUnknown: 'none',
          when: [
            { check: 'formula', expr: ['==', '$line.item', '200021'] },
            { check: 'formula', expr: ['>=', ['lines', ['filter', '$request.lines', ['==', '$line.item', '200021']]], 2] },
          ],
          then: warn('SKU 200021 is on more than one line of the request', 'الصنف 200021 في أكثر من سطر من الطلب'),
        },
      ]),
    },
    expects: [
      { expect: 'matched', lines: [1, 3] },
      { expect: 'trace', line: 2, ruleId: 'G-8', blockPath: 'when[0]', value: false },
      { expect: 'trace', line: 2, ruleId: 'G-8', blockPath: 'when[1]', value: true },
    ],
  },
  {
    id: 'rawNearMiss',
    file: {
      ...head('rawNearMiss', 'guard'),
      raw: '{\n  "lines": [\n    { "line": 1, "item": "200021", "qty": 6, "daysSupply": 30 }\n  ]\n}\n',
      document: doc('guard', [
        {
          id: 'G-9',
          name: { en: 'A large quantity', ar: 'كمية كبيرة' },
          onUnknown: 'none',
          when: [{ check: 'line', field: 'quantity', atLeast: 5 }],
          then: warn('Five packs or more', 'خمس عبوات أو أكثر'),
        },
      ]),
    },
    expects: [
      { expect: 'ignored', path: 'lines[0].qty', hint: 'quantity' },
      { expect: 'trace', line: 1, ruleId: 'G-9', blockPath: 'when[0]', value: 'unknown' },
      { expect: 'matched', lines: null },
    ],
  },
]

/** The lesson as an experiment, through the codec (a lesson that did not decode would be a build mistake). */
export function lessonExperiment(lesson: Lesson): PlaygroundExperiment {
  const r = readExperiment(lesson.file)
  if (!r.ok) throw new Error(`lesson ${lesson.id} does not decode: ${r.code}`)
  return r.experiment
}

/** The lesson's B side as Compare's seed (its data, the lesson's own rule); null for a lesson with none. */
export function lessonCompareSeed(lesson: Lesson): CompareSeed | null {
  if (!lesson.compare) return null
  return { dataTab: 'json', dataText: JSON.stringify(lesson.compare.data, null, 2), rawText: '', documentText: JSON.stringify(lessonExperiment(lesson).document, null, 2) }
}

export const lessonById = (id: string): Lesson | undefined => LESSONS.find((l) => l.id === id)
