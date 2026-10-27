// Stub fixtures for the insurance-rules drives (BackOffice spec 3126; oms ticket 607 creates them, 608–617
// EXTEND them — add your doors to `insuranceRulesStub` and your fixtures beside these, never re-cut 607's).
//
// Shapes are the brief's contract (`BackOffice/.issues/assets/3126-oms-react-insurance-rules-brief.md`) and the
// rule blocks the guard templates (`assets/3093-guard-templates.md`). The rules are the prototype's
// (`BackOffice/.scratch/proto/3096-insurance-rules`) rewritten into that shape; G-007 is the templates' own
// "GLP-1 without a diabetes diagnosis" (nesting + NOT), copied block for block.
//
// Every date is LOCAL (`yyyy-MM-dd`, `yyyy-MM-ddTHH:mm:ss`), never a `Z`. Never a live SIS.Api.
//
// Used by: tools/insurance-rules-drive.mjs (607) and `src/core/insurance-rules/sentence.test.ts`, which reads
// the SAME rules the drive serves. Types: `insurance-rules-stubs.d.mts`.

const says = (en, ar) => ({ en, ar })

/** The ruleset's item lists, by id. */
export const LISTS = [
  {
    id: 'glp1',
    name: says('GLP-1 and biologics', 'GLP-1 والأدوية الحيوية'),
    filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: ['E1497', 'E1502'] }] }],
    include: [],
    exclude: [],
  },
  {
    id: 'controlled',
    name: says('Controlled drugs', 'الأدوية الخاضعة للرقابة'),
    filters: [{ articles: [], categories: ['A006'], attributes: [] }],
    include: [],
    exclude: [],
  },
  {
    id: 'chronic',
    name: says('Chronic medicines', 'أدوية الأمراض المزمنة'),
    filters: [{ articles: [], categories: [], attributes: [{ field: 'ECode', anyOf: ['E0101', 'E0233'] }] }],
    include: ['100234'],
    exclude: [],
  },
]

/** Patient and policy lists live in their own doors (3133); a rule names them by id. */
export const PATIENT_LIST_VIP = 'PL-VIP'
export const POLICY_LIST_EXTENDED = 'PO-EXT'

const ALL_CHANNELS = ['nphies', 'waseel', 'oms', 'bupa']
const rule = (id, en, ar, folder, state, o) => ({
  id,
  name: says(en, ar),
  folder,
  state,
  window: { from: '2026-09-01', until: null },
  audience: { channels: ALL_CHANNELS, stores: [] },
  filters: [],
  onUnknown: 'none',
  ...o,
})
const guard = (severity, en, ar, o = {}) => ({ effect: 'guard', severity, says: says(en, ar), codes: null, suggest: null, ...o })

export const RULES = [
  rule('G-001', 'Same item twice in 3 days', 'نفس الصنف مرتين خلال 3 أيام', 'Pharmacist conduct', 'live', {
    when: [{ check: 'history', match: 'sameItem', windowDays: 3, measure: 'dispenses', atLeast: 1, includeThisLine: false }],
    then: [guard('REFUSE', 'Already dispensed on {lastDispensedOn}', 'صُرف مسبقاً بتاريخ {lastDispensedOn}', { codes: { conflict: '83', nphies: 'CV-4-3' } })],
  }),
  rule('G-002', 'Chronic refill too soon', 'صرف مبكر لدواء مزمن', 'Chronic care/Refills', 'live', {
    audience: { channels: ['nphies', 'waseel'], stores: ['P001', 'P019'] },
    filters: [{ id: 'controlled', list: 'controlled' }],
    when: [
      {
        check: 'supply',
        match: 'sameKind',
        eligibleDaysBeforeDue: 10,
        eligibleDaysBeforeDueFor: [{ list: 'controlled', value: 7 }],
        accumulate: { surplusDays: 10, overDays: 90 },
        unknownSupply: { assumeDays: 30 },
      },
    ],
    then: [
      guard('OVERRIDE', 'Refill too soon: {consumedPct}% used, eligible from {eligibleOn}', 'صرف مبكر: استُهلك {consumedPct}%، يحق الصرف من {eligibleOn}', {
        codes: { conflict: 'ER', nphies: 'CV-4-8' },
      }),
    ],
  }),
  rule('G-003', 'GLP-1: four pens per 28 days', 'GLP-1: أربعة أقلام كل 28 يوماً', 'Specialty medicines/GLP-1', 'shadow', {
    shadowSince: '2026-10-15',
    filters: [{ id: 'items', list: 'glp1' }],
    when: [{ check: 'history', match: 'list:items', windowDays: 28, measure: 'quantity', atLeast: 5, includeThisLine: true }],
    then: [
      guard('OVERRIDE', '{count} units in {windowDays} days; the limit is {limit}', '{count} وحدة خلال {windowDays} يوماً؛ الحد {limit}', {
        codes: { conflict: 'HD', nphies: 'SE-1-9' },
        suggest: { maxQuantity: '{remaining}' },
      }),
    ],
  }),
  rule('G-004', 'More than 90 days in one request', 'أكثر من 90 يوماً في طلب واحد', 'Chronic care', 'live', {
    when: [{ check: 'line', field: 'daysSupply', above: 90 }],
    then: [guard('REFUSE', '{daysSupply} days in one request; the maximum is {limit}', '{daysSupply} يوماً في طلب واحد؛ الحد الأقصى {limit}', { codes: { conflict: 'MX', nphies: 'CV-4-2' } })],
  }),
  rule('G-005', 'Two statins at once', 'اثنان من الستاتين معاً', 'Chronic care', 'waiting', {
    when: [{ check: 'history', match: 'sameClass', windowDays: 30, measure: 'dispenses', atLeast: 1, includeThisLine: false, excludeSameKind: true }],
    then: [guard('WARN', 'Patient already has {otherItem} in the same class', 'لدى المريض {otherItem} من نفس الفئة العلاجية', { codes: { conflict: 'TD', nphies: null } })],
  }),
  rule('G-006', 'GLP-1 requests per pharmacist', 'طلبات GLP-1 لكل صيدلي', 'Pharmacist conduct', 'draft', {
    filters: [{ id: 'items', list: 'glp1' }],
    when: [{ check: 'volume', by: 'pharmacist', match: 'list:items', window: 'day', atLeast: 20, includeThisLine: true }],
    then: [guard('WARN', '{count} requests for these items by you today', '{count} طلباً لهذه الأصناف من قبلك اليوم')],
  }),
  rule('G-007', 'GLP-1 without a diabetes diagnosis', 'GLP-1 بدون تشخيص سكري', 'Specialty medicines/GLP-1', 'live', {
    filters: [{ id: 'glp1', list: 'glp1' }],
    when: [
      {
        check: 'group',
        mode: 'all',
        conditions: [
          { check: 'line', inList: 'glp1' },
          { check: 'formulary', indication: 'listed', not: true },
          {
            check: 'group',
            mode: 'any',
            not: true,
            conditions: [
              { check: 'patient', inList: PATIENT_LIST_VIP },
              { check: 'policy', inList: POLICY_LIST_EXTENDED },
            ],
          },
        ],
      },
    ],
    onUnknown: 'warn',
    then: [guard('OVERRIDE', 'GLP-1 without a diabetes diagnosis', 'GLP-1 بدون تشخيص سكري', { codes: { conflict: 'DC', nphies: 'CV-4-5' } })],
  }),
  rule('G-008', 'Not marketed with SFDA', 'غير مسوّق لدى الهيئة', 'Reference/SFDA', 'shadow', {
    shadowSince: '2026-10-20',
    when: [{ check: 'sfda', status: 'notMarketed' }],
    then: [guard('REFUSE', 'This item is not marketed with SFDA', 'هذا الصنف غير مسوّق لدى الهيئة', { codes: { conflict: null, nphies: 'CV-4-10' } })],
  }),
  rule('G-009', 'Price above SFDA public price', 'السعر أعلى من سعر الهيئة', 'Reference/SFDA', 'disabled', {
    when: [{ check: 'sfda', priceAbove: 0.5 }],
    then: [guard('WARN', 'The price is above the SFDA public price', 'السعر أعلى من سعر الهيئة للعموم', { codes: { conflict: null, nphies: 'BE-1-6' } })],
  }),
  rule('G-010', 'Patient moving between stores', 'المريض يتنقل بين الفروع', 'Pharmacist conduct', 'live', {
    window: { from: '2026-09-01', until: '2026-12-31' },
    when: [{ check: 'history', match: 'sameKind', windowDays: 30, measure: 'distinctStores', atLeast: 3, includeThisLine: true }],
    then: [guard('WARN', 'Dispensed at {count} stores in {windowDays} days', 'صُرف في {count} فروع خلال {windowDays} يوماً')],
  }),
  rule('G-011', 'Quantity above formulary limit', 'الكمية أعلى من حد الدليل', 'Reference/Formulary', 'draft', {
    when: [{ check: 'formulary', edit: 'QL' }],
    then: [guard('OVERRIDE', 'The quantity is above the formulary limit', 'الكمية أعلى من حد الدليل الدوائي', { codes: { conflict: null, nphies: 'SE-1-9' } })],
  }),
]

/** `GET / PUT InsuranceRules/Guards/Draft` — the whole document. */
export const RULESET = { schema: 1, kind: 'guard', revision: 12, lists: LISTS, rules: RULES }

/** Last fired and flags per rule, as `GET InsuranceRules/Guards` adds them. */
const ACTIVITY = {
  'G-001': { lastFired: '2026-10-26T18:42:10', flags: [] },
  'G-002': { lastFired: '2026-10-27T09:05:00', flags: [{ kind: 'noisy', since: '2026-10-20' }] },
  'G-003': { lastFired: '2026-10-24T11:30:00', flags: [{ kind: 'jump', since: '2026-10-25' }] },
  'G-004': { lastFired: null, flags: [{ kind: 'silent', since: '2026-10-01' }] },
  'G-007': { lastFired: '2026-10-27T08:15:00', flags: [{ kind: 'noisy', since: '2026-10-22' }, { kind: 'jump', since: '2026-10-26' }] },
  'G-010': { lastFired: '2026-10-25T20:00:00', flags: [] },
}

const severityOf = (r) => ['REFUSE', 'OVERRIDE', 'WARN'].find((s) => r.then.some((e) => e.severity === s))

/** `GET InsuranceRules/Guards` — one row per rule. */
export const GUARD_ROWS = RULES.map((r) => ({
  id: r.id,
  name: r.name,
  folder: r.folder,
  state: r.state,
  severity: severityOf(r),
  lastFired: ACTIVITY[r.id]?.lastFired ?? null,
  flags: ACTIVITY[r.id]?.flags ?? [],
}))

/** The REAL SIS.Api envelope, as a Playwright `route.fulfill` argument. */
export const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

/**
 * The insurance-rules doors, stubbed. `path` is the api path without `/api/` (`InsuranceRules/Guards`);
 * answers a `route.fulfill` argument, or null when the door is not one of these (the caller falls through).
 * `opts.deny` names doors answered with a bare 403; `opts.reads` counts reads per door.
 */
export function insuranceRulesStub(method, path, _body, opts = {}) {
  const { deny = [], reads = {} } = opts
  const hit = (door, data) => {
    reads[door] = (reads[door] ?? 0) + 1
    if (deny.includes(door)) return { status: 403, body: '' }
    return envelope(data)
  }
  if (method === 'GET' && path === 'InsuranceRules/Guards') return hit('guards', GUARD_ROWS)
  if (method === 'GET' && path === 'InsuranceRules/Guards/Draft') return hit('draft', RULESET)
  return null
}

// --- 616 --- guards on an OMS order (BackOffice 3142/3143; check doors 3127/3128/3134). Order-door
// spelling is a GUESS fitted to the existing OMS doors: `SdDocumentWeb/Document/{no}/Guards/Recheck|Release`
// (the brief writes `Oms/Orders/{id}/Guards/…`); 618 reconciles.

const reasonCode = (code, en, ar, active = true) => ({ code, en, ar, active })

/** `GET Guards/Reasons` — the seeded NCPDP codes; G-002 asks a reason, `04` is capped at one use. */
export const GUARD_REASONS = {
  intervention: [
    reasonCode('M0', 'Prescriber consulted', 'تمت استشارة الطبيب'),
    reasonCode('P0', 'Patient consulted', 'تمت استشارة المريض'),
    reasonCode('R0', 'Pharmacist consulted other source', 'استشار الصيدلي مصدراً آخر'),
    reasonCode('MR', 'Medication review', 'مراجعة الدواء', false),
  ],
  outcome: [
    reasonCode('1A', 'Filled as is, false positive', 'صُرف كما هو، إنذار خاطئ'),
    reasonCode('1B', 'Filled prescription as is', 'صُرفت الوصفة كما هي'),
    reasonCode('1C', 'Filled with different dose', 'صُرف بجرعة مختلفة'),
    reasonCode('2A', 'Prescription not filled', 'لم تُصرف الوصفة'),
  ],
  reason: [
    reasonCode('03', 'Vacation supply', 'كمية للسفر'),
    reasonCode('04', 'Lost prescription', 'وصفة مفقودة'),
    reasonCode('05', 'Therapy change', 'تغيير العلاج'),
    reasonCode('07', 'Medically necessary', 'ضرورة طبية'),
    reasonCode('13', 'Payer-recognized emergency', 'حالة طارئة معترف بها'),
  ],
  accepts: { 'G-002': ['03', '04', '05', '07'] },
  caps: { '04': 1 },
}

const guardFired = (ruleId, severity, en, ar, over = {}) => ({
  ruleId,
  version: 3,
  severity,
  en,
  ar,
  codes: { conflict: 'ER', nphies: 'MN-1-1' },
  suggestion: null,
  exceptionId: null,
  ...over,
})

const LINE_20 = {
  line: 20,
  outcome: 'override',
  fired: [
    guardFired('G-002', 'OVERRIDE', '6 units in 28 days; the limit is 5', '6 وحدة خلال 28 يوماً؛ الحد 5', { suggestion: { maxQuantity: '4' } }),
    guardFired('G-003', 'WARN', 'Patient already has Rosuvastatin in the same class', 'لدى المريض روسوفاستاتين من نفس الفئة العلاجية', { codes: { conflict: 'TD', nphies: 'MN-1-2' } }),
  ],
  unknowns: [],
}
const LINE_30 = {
  line: 30,
  outcome: 'override',
  fired: [
    guardFired('G-005', 'OVERRIDE', 'Supply runs to 2026-12-30; the policy ends 2026-11-30', 'تمتد الكمية حتى 2026-12-30؛ وتنتهي الوثيقة في 2026-11-30', {
      suggestion: { maxDaysSupply: '34' },
    }),
  ],
  unknowns: [],
}
const LINE_40 = {
  line: 40,
  outcome: 'exception',
  fired: [guardFired('G-004', 'REFUSE', 'Not covered for this diagnosis', 'غير مغطى لهذا التشخيص', { exceptionId: 'EX-41' })],
  unknowns: [],
}
const LINE_50 = { line: 50, outcome: 'pass', fired: [], unknowns: [] }

/** Order detail's `guards` before the order changed: line 10 is REFUSED (180 days in one request). */
export const ORDER_GUARDS_HELD = {
  checkId: 'CHK-7001',
  lineHash: 'h-7001-a',
  lines: [
    {
      line: 10,
      outcome: 'refuse',
      fired: [guardFired('G-001', 'REFUSE', '180 days in one request; the maximum is 90', '180 يوماً في طلب واحد؛ الحد الأقصى 90', { codes: { conflict: 'MX', nphies: 'CV-4-2' } })],
      unknowns: ['daysSupply'],
    },
    LINE_20,
    LINE_30,
    LINE_40,
    LINE_50,
  ],
}

/** …and after line 10 was changed and the check run again: no refusal, a new check and line hash. */
export const ORDER_GUARDS_RECHECKED = {
  checkId: 'CHK-7002',
  lineHash: 'h-7002-a',
  lines: [{ line: 10, outcome: 'pass', fired: [], unknowns: [] }, LINE_20, LINE_30, LINE_40, LINE_50],
}

/** The order lines the guards name (`SdDocumentLineModel` fields the dialog reads). */
export const ORDER_GUARD_LINES = [
  [10, '100245', 'Metformin 500mg 60s'],
  [20, '102200', 'Atorvastatin 20mg 30s'],
  [30, '108800', 'Ozempic 1mg pen'],
  [40, '109900', 'Vitamin D3 50000 IU 4s'],
  [50, '238202', 'Nivea Day Cream 50ml'],
].map(([lineNumber, itemNumber, itemDescription]) => ({ lineNumber, itemNumber, itemDescription }))

/**
 * 616's doors. `order` is the order's mutable guard state `{ guardState, guards }` — Recheck moves it to
 * `ORDER_GUARDS_RECHECKED`, an accepted Answer and a Release move it to `none`. `writes` collects every POST.
 * `opts.answerRefusal` answers the next Answer with that refusal once (`{ status, message, errorCode }`).
 */
export function orderGuardsStub(method, path, body, order, opts = {}) {
  const { writes = [] } = opts
  if (method === 'GET' && path === 'Guards/Reasons') return envelope(GUARD_REASONS)
  const answer = method === 'POST' && path.match(/^Guards\/([^/]+)\/Answer$/)
  if (answer) {
    writes.push({ door: 'answer', checkId: decodeURIComponent(answer[1]), body })
    if (opts.answerRefusal) {
      const r = opts.answerRefusal
      opts.answerRefusal = null
      return envelope(null, { status: r.status ?? 400, success: false, message: r.message, errorCode: r.errorCode })
    }
    if (body?.lineHash !== order.guards?.lineHash)
      return envelope(null, { status: 409, success: false, message: 'The order lines changed since the check.', errorCode: 'GUARD-LINES-CHANGED' })
    order.guardState = 'none'
    return envelope({ decisionId: 'DEC-9001' })
  }
  const door = method === 'POST' && path.match(/^SdDocumentWeb\/Document\/([^/]+)\/Guards\/(Recheck|Release)$/)
  if (door) {
    writes.push({ door: door[2].toLowerCase(), documentNo: decodeURIComponent(door[1]), body })
    if (door[2] === 'Recheck') {
      order.guards = ORDER_GUARDS_RECHECKED
      order.guardState = 'actionNeeded'
      return envelope(ORDER_GUARDS_RECHECKED)
    }
    order.guardState = 'none'
    return envelope({ released: true })
  }
  return null
}
