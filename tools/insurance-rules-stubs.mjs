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

// ── oms 618: the doors as BUILT ─────────────────────────────────────────────────────────────────────────────
// The fixtures above are written in the EDITOR's model (a rule binds lists to filter aliases, a fact is one `$`-path
// block) so the vitest proofs read them as the screens do. SIS.Rules spells the same rules differently and HQ serves
// that spelling, so every guard document a door answers goes out through `wireRuleset` (the subset of
// `src/core/insurance-rules/guard-wire.ts` these fixtures need): no `filters`, each alias resolved to its list, a fact
// block as the block of its scope, a line's `below` as `under`. A PUT body arrives in that spelling and is kept so.

const FACT_SCOPES = ['patient', 'request', 'eligibility', 'line']
function wireCondition(c, alias) {
  if (!c || typeof c !== 'object') return c
  const o = { ...c }
  if (o.check === 'group') return { ...o, conditions: (o.conditions ?? []).map((x) => wireCondition(x, alias)) }
  if (typeof o.match === 'string' && o.match.startsWith('list:')) {
    const a = o.match.slice(5)
    o.match = `list:${alias.get(a) ?? a}`
  }
  if (o.check === 'line' && typeof o.inList === 'string') o.inList = alias.has(o.inList) ? alias.get(o.inList) : o.inList
  if (o.check === 'line' && o.below !== undefined) {
    o.under = o.below
    delete o.below
  }
  const m = o.check === 'fact' && typeof o.path === 'string' ? /^\$([A-Za-z]+)\.(.+)$/.exec(o.path) : null
  if (m && FACT_SCOPES.includes(m[1])) {
    const out = { check: m[1], field: m[2] }
    let not = o.not === true
    if (o.op === 'atLeast') out.atLeast = o.value
    else if (o.op === 'below') out.under = o.value
    else if (o.op === 'anyOf') out.anyOf = o.value
    else if (o.op === 'noneOf') {
      out.anyOf = o.value
      not = !not
    }
    if (not) out.not = true
    return out
  }
  return o
}
/** An editor rule in the engine's spelling. */
export function wireRule(r) {
  const { filters, ...rest } = r
  const alias = new Map((filters ?? []).map((f) => [f.id, f.list]))
  const out = { ...rest, when: (r.when ?? []).map((c) => wireCondition(c, alias)) }
  // As built an audience holds only the keys it sets: an empty list (none = every one) is left out.
  if (out.audience && typeof out.audience === 'object')
    out.audience = Object.fromEntries(Object.entries(out.audience).filter(([, v]) => !(Array.isArray(v) && v.length === 0)))
  return out
}
/** A document in the engine's spelling. */
export const wireRuleset = (doc) => ({ ...doc, rules: (doc.rules ?? []).map(wireRule) })

/** `GET / PUT …/Draft`, Submit, SendBack, Restore and Create answer the DRAFT (3139), its document inside. */
export const draftReply = (document, over = {}) => ({
  revision: document.revision,
  state: 'editing',
  origin: '',
  baseVersionNo: 4,
  updatedBy: 'falotaibi',
  updatedAt: '2026-10-26T15:00:00',
  requestedBy: null,
  requestedAt: null,
  requestNote: null,
  reviewedBy: null,
  reviewNote: null,
  document,
  warnings: [],
  ...over,
})
/** The stale-revision refusal as built (3139). */
const staleDraft = () => envelope(null, { status: 409, success: false, message: 'The draft is at another revision: reload it.', errorCode: 'GUARDS_DRAFT_STALE' })

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
              { check: 'request', field: 'policy', inList: POLICY_LIST_EXTENDED },
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

/** The whole guard document in the editor's model (the vitest proofs read it). */
export const RULESET = { schema: 1, kind: 'guard', revision: 12, lists: LISTS, rules: RULES }
/** …and as `GET InsuranceRules/Guards/Draft` serves it (`document` of `draftReply`). */
export const WIRE_RULESET = wireRuleset(RULESET)

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

/** `GET InsuranceRules/Guards` as built (3139 / 3141) — one row per rule. */
export const guardRow = (r) => ({
  id: r.id,
  name: r.name,
  folder: r.folder,
  state: r.state,
  severity: severityOf(r) ?? 'WARN',
  group: null,
  shadowSince: r.state === 'shadow' ? (r.shadowSince ?? null) : null,
  shadowFires: r.state === 'shadow' ? 4 : 0,
  inDraft: r.state === 'draft' || r.state === 'waiting',
  lastFired: ACTIVITY[r.id]?.lastFired ?? null,
  flags: ACTIVITY[r.id]?.flags ?? [],
})
export const GUARD_ROWS = RULES.map(guardRow)

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
  if (method === 'GET' && path === 'InsuranceRules/Guards/Draft') return hit('draft', draftReply(WIRE_RULESET))
  return null
}

// --- 610 --- Fields registry, field values, list preview, patient, policy and class lists (BackOffice 3132 +
// 3133 + 3172). Stateful: a drive makes one state per browser context (`newListsState()`) and passes it as
// `opts.state`, so an added field, a saved draft, a new list or an added entry is read back. `opts.query` is the
// request's URLSearchParams (the `Values?q=`). The keyed lists answer 3133's BUILT shapes: `GET …Lists` →
// `[{ id, name, entries, createdBy, createdAt }]`, entries `{ key, addedBy, addedAt, reason, expiresOn, expired,
// payer }` (`expired` against `state.today`, which a drive may move on), DELETE with a body `{ key, payer?, reason }`,
// log `createList | add | change | remove`. `GET Insurers` is served here only, on `state.settings` (617's 3144 rows).
// Shapes ⚠️ PROVISIONAL where the brief does not spell them (see 610).

/** `GET InsuranceRules/Fields` — every scope, one retired. */
export const FIELDS = [
  { key: 'ECode', label: says('E-code', 'الرمز الإلكتروني'), scope: 'item', type: 'text', unit: '', source: 'ItemInfo.ECode', pickerSource: 'ItemInfo.EDesc', retired: false },
  { key: 'ATC', label: says('ATC class', 'تصنيف ATC'), scope: 'item', type: 'text', unit: '', source: 'ItemInfo.ATC', retired: false },
  { key: 'DosageForm', label: says('Dosage form', 'الشكل الصيدلاني'), scope: 'item', type: 'text', unit: '', source: 'ItemInfo.DosageForm', retired: false },
  { key: 'OldGroup', label: says('Old item group', 'مجموعة الأصناف القديمة'), scope: 'item', type: 'text', unit: '', source: 'ItemInfo.OldGroup', retired: true },
  { key: 'daysSupply', label: says('Days of supply', 'أيام التوريد'), scope: 'request', type: 'number', unit: 'days', source: 'Request line', retired: false },
  { key: 'age', label: says('Age', 'العمر'), scope: 'patient', type: 'number', unit: 'years', source: 'Patient profile', retired: false },
  { key: 'coverage.periodEnd', label: says('Coverage ends on', 'نهاية التغطية'), scope: 'eligibility', type: 'date', unit: null, source: 'Nphies eligibility answer', retired: false },
]

/** `GET InsuranceRules/Fields/{key}/Values?q=` — code + description. */
export const FIELD_VALUES = {
  ECode: [
    { code: 'E1497', description: 'Semaglutide pen' },
    { code: 'E1502', description: 'Dulaglutide pen' },
    { code: 'E1510', description: 'Liraglutide pen' },
    { code: 'E1520', description: 'Tirzepatide pen' },
    { code: 'E0101', description: 'Metformin' },
    { code: 'E0233', description: 'Insulin glargine' },
  ],
  ATC: [
    { code: 'A10BJ', description: 'GLP-1 analogues' },
    { code: 'C10AA', description: 'Statins' },
  ],
  DosageForm: [
    { code: 'PEN', description: 'Pre-filled pen' },
    { code: 'TAB', description: 'Tablet' },
  ],
}

/** The items `Lists/Preview` matches against: article, name and its item fields. */
export const PREVIEW_ITEMS = [
  { article: '100101', name: 'Ozempic 1 mg pen', ECode: 'E1497', ATC: 'A10BJ', DosageForm: 'PEN' },
  { article: '100102', name: 'Ozempic 0.5 mg pen', ECode: 'E1497', ATC: 'A10BJ', DosageForm: 'PEN' },
  { article: '100201', name: 'Trulicity 1.5 mg pen', ECode: 'E1502', ATC: 'A10BJ', DosageForm: 'PEN' },
  { article: '100301', name: 'Victoza 6 mg/ml pen', ECode: 'E1510', ATC: 'A10BJ', DosageForm: 'PEN' },
  { article: '100401', name: 'Mounjaro 5 mg pen', ECode: 'E1520', ATC: 'A10BJ', DosageForm: 'PEN' },
  { article: '200101', name: 'Glucophage 500 mg', ECode: 'E0101', ATC: 'A10BA', DosageForm: 'TAB' },
  { article: '200201', name: 'Lantus SoloStar', ECode: 'E0233', ATC: 'A10AE', DosageForm: 'PEN' },
]

export const PATIENT_LISTS = [
  { id: PATIENT_LIST_VIP, name: says('VIP patients', 'مرضى كبار الشخصيات'), entries: 2, createdBy: 'nalharbi', createdAt: '2026-09-15T08:00:00' },
  { id: 'PL-STAFF', name: says('Staff and family', 'الموظفون وذووهم'), entries: 0, createdBy: 'nalharbi', createdAt: '2026-09-15T08:05:00' },
]
export const POLICY_LISTS = [{ id: POLICY_LIST_EXTENDED, name: says('Extended cover policies', 'وثائق التغطية الممتدة'), entries: 1, createdBy: 'falotaibi', createdAt: '2026-09-01T11:50:00' }]
/** The insurers' SAP customer ids (3144: `{payer}` is the customer id, or `*`). */
export const BUPA = '0001100041'
export const TAWUNIYA = '0001100052'
export const MEDGULF = '0001100063'

/** 3172 — a class list: Bupa's GOLD class for Bupa only, and VIP for any insurer. */
export const CLASS_LIST_GOLD = 'CL-GOLD'
export const CLASS_LISTS = [{ id: CLASS_LIST_GOLD, name: says('Gold and VIP classes', 'الفئات الذهبية وكبار الشخصيات'), entries: 2, createdBy: 'falotaibi', createdAt: '2026-10-27T09:00:00' }]

const ENTRIES = {
  [`patient:${PATIENT_LIST_VIP}`]: [
    { key: '1012345678', addedBy: 'nalharbi', addedAt: '2026-09-15T08:30:00', reason: 'Board member', expiresOn: null, payer: null },
    { key: '2087654321', addedBy: 'nalharbi', addedAt: '2026-10-20T10:12:00', reason: 'مريض كبار الشخصيات حتى نهاية العام', expiresOn: '2026-12-31', payer: null },
  ],
  'patient:PL-STAFF': [],
  [`policy:${POLICY_LIST_EXTENDED}`]: [{ key: 'SUB-778812', addedBy: 'falotaibi', addedAt: '2026-09-01T12:00:00', reason: 'Extended cover agreed with Bupa', expiresOn: '2027-03-31', payer: null }],
  [`class:${CLASS_LIST_GOLD}`]: [
    { key: 'GOLD', addedBy: 'falotaibi', addedAt: '2026-10-27T09:10:00', reason: 'Bupa gold tier', expiresOn: null, payer: BUPA },
    { key: 'VIP', addedBy: 'falotaibi', addedAt: '2026-10-27T09:12:00', reason: 'VIP class with every insurer', expiresOn: null, payer: null },
  ],
}
const LOG = {
  [`patient:${PATIENT_LIST_VIP}`]: [
    { at: '2026-10-20T10:12:00', by: 'nalharbi', action: 'add', key: '2087654321', reason: 'مريض كبار الشخصيات حتى نهاية العام', expiresOn: '2026-12-31', payer: null },
    { at: '2026-10-02T09:00:00', by: 'nalharbi', action: 'remove', key: '1099999999', reason: 'Left the board', expiresOn: null, payer: null },
    { at: '2026-09-15T08:30:00', by: 'nalharbi', action: 'add', key: '1012345678', reason: 'Board member', expiresOn: null, payer: null },
  ],
  'patient:PL-STAFF': [],
  [`policy:${POLICY_LIST_EXTENDED}`]: [{ at: '2026-09-01T12:00:00', by: 'falotaibi', action: 'add', key: 'SUB-778812', reason: 'Extended cover agreed with Bupa', expiresOn: '2027-03-31', payer: null }],
  [`class:${CLASS_LIST_GOLD}`]: [
    { at: '2026-10-27T09:12:00', by: 'falotaibi', action: 'add', key: 'VIP', reason: 'VIP class with every insurer', expiresOn: null, payer: null },
    { at: '2026-10-27T09:10:00', by: 'falotaibi', action: 'add', key: 'GOLD', reason: 'Bupa gold tier', expiresOn: null, payer: BUPA },
    { at: '2026-10-27T09:00:00', by: 'falotaibi', action: 'createList', key: null, reason: 'Bupa gold tier', expiresOn: null, payer: null },
  ],
}

const localNow = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
}
const localDay = () => localNow().slice(0, 10)

/** A fresh, mutable copy of 610's fixtures — one per browser context. `today` is the day `expired` is read against. */
export function newListsState() {
  const copy = (x) => JSON.parse(JSON.stringify(x))
  return {
    fields: copy(FIELDS),
    ruleset: copy(WIRE_RULESET),
    entries: copy(ENTRIES),
    log: copy(LOG),
    lists: { patient: copy(PATIENT_LISTS), policy: copy(POLICY_LISTS), class: copy(CLASS_LISTS) },
    /** 3144's insurer settings, the estate default `*` among them — `GET Insurers` serves their rows (617's shape). */
    settings: copy(INSURER_SETTINGS),
    today: localDay(),
    writes: [],
  }
}

/** The items a list matches: union of its filters, plus included lists, minus excluded ones (`lists` resolve ids). */
export function matchItems(list, lists, items = PREVIEW_ITEMS) {
  const byId = new Map(lists.map((l) => [l.id, l]))
  const resolve = (l, depth) => {
    const out = new Set()
    if (depth > 3) return out
    for (const f of l.filters) {
      if (!(f.articles.length || f.categories.length || f.attributes.length)) continue
      for (const it of items) {
        const attrs = f.attributes.every((a) => (a.anyOf ? a.anyOf.includes(it[a.field]) : !(a.noneOf ?? []).includes(it[a.field])))
        const arts = !f.articles.length || f.articles.includes(it.article)
        const cats = !f.categories.length // the stub's items carry no category
        if (attrs && arts && cats) out.add(it.article)
      }
    }
    for (const id of l.include) if (byId.has(id)) for (const a of resolve(byId.get(id), depth + 1)) out.add(a)
    for (const id of l.exclude) if (byId.has(id)) for (const a of resolve(byId.get(id), depth + 1)) out.delete(a)
    return out
  }
  const hit = resolve(list, 1)
  return items.filter((it) => hit.has(it.article))
}

/**
 * 610's doors. Answers a `route.fulfill` argument, or null to fall through (to `insuranceRulesStub`). Call it
 * BEFORE `insuranceRulesStub`: with a state, `GET Guards/Draft` answers the state's (saved) ruleset.
 * `opts.deny` door names: draft · saveDraft · fields · addField · retire · values · preview · keyedLists ·
 * createList · entries · addEntry · removeEntry · log · insurers.
 */
export function insuranceListsStub(method, path, body, opts = {}) {
  const { deny = [], reads = {}, state, query = new URLSearchParams(), pageSize = 3 } = opts
  if (!state || !path.startsWith('InsuranceRules/')) return null
  const p = path.slice('InsuranceRules/'.length)
  const door = (name, fn) => {
    reads[name] = (reads[name] ?? 0) + 1
    if (deny.includes(name)) return { status: 403, body: '' }
    if (method !== 'GET') state.writes.push({ door: name, body })
    return fn()
  }

  if (p === 'Guards/Draft' && method === 'GET') return door('draft', () => envelope(draftReply(state.ruleset)))
  if (p === 'Guards/Draft' && method === 'PUT')
    return door('saveDraft', () => {
      if (body.revision !== state.ruleset.revision) return staleDraft()
      state.ruleset = { ...body, revision: state.ruleset.revision + 1 }
      return envelope(draftReply(state.ruleset, { updatedBy: 'msartawi', updatedAt: localNow() }))
    })

  if (p === 'Fields' && method === 'GET') return door('fields', () => envelope(state.fields))
  if (p === 'Fields' && method === 'POST')
    return door('addField', () => {
      if (state.fields.some((f) => f.key.toLowerCase() === String(body.key).toLowerCase()))
        return envelope(null, { status: 409, success: false, message: "a field with this key already exists (a key is never reused)", errorCode: 'INSFIELDS_EXISTS' })
      const f = { unit: '', pickerSource: '', ...body, retired: false }
      state.fields.push(f)
      return envelope(f)
    })
  let m = /^Fields\/([^/]+)\/Retire$/.exec(p)
  if (m && method === 'POST')
    return door('retire', () => {
      const f = state.fields.find((x) => x.key === decodeURIComponent(m[1]))
      if (!f) return envelope(null, { status: 404, success: false, message: 'no such field', errorCode: 'INSFIELDS_NOT_FOUND' })
      f.retired = true
      return envelope(f)
    })
  m = /^Fields\/([^/]+)\/Values$/.exec(p)
  if (m && method === 'GET')
    return door('values', () => {
      const q = (query.get('q') ?? '').toLowerCase()
      return envelope((FIELD_VALUES[decodeURIComponent(m[1])] ?? []).filter((v) => !q || v.code.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)))
    })

  if (p === 'Lists/Preview' && method === 'POST')
    return door('preview', () => {
      // 3132 as built: `{ count, unknown, items: [{ item, description }] (first 50), warnings, errors }`.
      const items = matchItems(body.list, [...(body.lists ?? []), body.list])
      return envelope({
        count: items.length,
        unknown: 0,
        items: items.slice(0, pageSize).map(({ article, name }) => ({ item: article, description: name })),
        warnings: items.length === 0 ? ["the list matches no item in today's master"] : [],
        errors: [],
      })
    })

  // The ONE `GET Insurers` handler: 3144's settings rows as built (`[{ payer, …settings }]`, `*` among them, no name).
  if (p === 'Insurers' && method === 'GET') return door('insurers', () => envelope(Object.values(state.settings)))

  m = /^(PatientLists|PolicyLists|ClassLists)(?:\/([^/]+)\/(Entries|Log))?$/.exec(p)
  if (!m) return null
  const kind = { PatientLists: 'patient', PolicyLists: 'policy', ClassLists: 'class' }[m[1]]
  const lists = (state.lists[kind] ??= [])
  const bad = (message) => envelope(null, { status: 400, success: false, message, errorCode: 'INSLISTS_BAD_REQUEST' })
  const reasonOf = (b) => String(b?.reason ?? '').trim()
  if (!m[2]) {
    if (method === 'GET') return door('keyedLists', () => envelope(lists))
    if (method === 'POST')
      return door('createList', () => {
        if (!reasonOf(body)) return bad('A reason is required.')
        if (lists.some((l) => l.id === body.id)) return envelope(null, { status: 409, success: false, message: 'A list has this id.', errorCode: 'INSLISTS_EXISTS' })
        const list = { id: body.id, name: body.name, entries: 0, createdBy: 'msartawi', createdAt: localNow() }
        lists.push(list)
        state.entries[`${kind}:${list.id}`] = []
        state.log[`${kind}:${list.id}`] = [{ at: list.createdAt, by: 'msartawi', action: 'createList', key: null, reason: reasonOf(body), expiresOn: null, payer: null }]
        return envelope(list)
      })
    return null
  }
  const id = decodeURIComponent(m[2])
  const k = `${kind}:${id}`
  const meta = lists.find((l) => l.id === id)
  const recount = () => meta && (meta.entries = state.entries[k].length)
  // 3172: the class kept upper case; payer only on a class list (a 400 elsewhere); key + payer make one entry.
  const keyOf = (b) => (kind === 'class' ? String(b?.key ?? '').trim().toUpperCase() : String(b?.key ?? '').trim())
  const payerOf = (b) => (kind === 'class' && b?.payer ? String(b.payer).trim() || null : null)
  const same = (e, key, payer) => e.key === key && (e.payer ?? null) === payer
  const withExpiry = (e) => ({ ...e, expired: !!e.expiresOn && e.expiresOn < (state.today ?? localDay()) })
  if (m[3] === 'Log') return method === 'GET' ? door('log', () => envelope(state.log[k] ?? [])) : null
  if (method === 'GET') return door('entries', () => envelope((state.entries[k] ?? []).map(withExpiry)))
  if (method === 'POST')
    return door('addEntry', () => {
      if (!reasonOf(body)) return bad('A reason is required.')
      if (kind !== 'class' && body?.payer != null) return bad('A payer is only for class lists.')
      const key = keyOf(body)
      const payer = payerOf(body)
      const rows = (state.entries[k] ??= [])
      const at = rows.findIndex((e) => same(e, key, payer))
      const entry = { key, addedBy: 'msartawi', addedAt: localNow(), reason: reasonOf(body), expiresOn: body.expiresOn ?? null, payer }
      if (at >= 0) rows[at] = entry
      else rows.unshift(entry)
      ;(state.log[k] ??= []).unshift({ at: entry.addedAt, by: 'msartawi', action: at >= 0 ? 'change' : 'add', key, reason: entry.reason, expiresOn: entry.expiresOn, payer })
      recount()
      return envelope(withExpiry(entry))
    })
  if (method === 'DELETE')
    return door('removeEntry', () => {
      if (!reasonOf(body)) return bad('A reason is required.')
      if (kind !== 'class' && body?.payer != null) return bad('A payer is only for class lists.')
      const key = keyOf(body)
      const payer = payerOf(body)
      const rows = state.entries[k] ?? []
      if (!rows.some((e) => same(e, key, payer))) return envelope(null, { status: 404, success: false, message: 'No such entry.', errorCode: 'INSLISTS_NOT_FOUND' })
      state.entries[k] = rows.filter((e) => !same(e, key, payer))
      ;(state.log[k] ??= []).unshift({ at: localNow(), by: 'msartawi', action: 'remove', key, reason: reasonOf(body), expiresOn: null, payer })
      recount()
      return envelope({ key, payer })
    })
  return null
}

// --- 608 --- the guard editor's doors: the draft read and saved WHOLE, and HQ's checks of it.
//   GET  InsuranceRules/Guards/Draft    → the draft (`draftReply`) of `opts.store.draft` (WIRE_RULESET to start)
//   PUT  InsuranceRules/Guards/Draft    → the draft at `revision` + 1; a stale `revision` → 409 `GUARDS_DRAFT_STALE`
//   POST InsuranceRules/Guards/Validate → `[{ ruleId, blockPath, field, severity, en, ar }]` (validateGuards)
// `opts.store` is the drive's own `{ draft, puts: [], validates: [] }` (newGuardStore()); without one, 607's
// stateless handler answers. Call `guardEditorStub` first and fall through to `insuranceRulesStub`.

/** A drive's stateful draft: a deep copy of RULESET, and every PUT / Validate body it was sent. */
export const newGuardStore = () => ({ draft: structuredClone(WIRE_RULESET), puts: [], validates: [] })

const issue = (ruleId, blockPath, field, en, ar, severity = 'error') => ({ ruleId, blockPath, field, severity, en, ar })

/** HQ's checks, as the stub reads them: names, empty lists, empty groups, a 4th level, messages, `{lastStore}`. */
export function validateGuards(doc) {
  const out = []
  for (const r of doc.rules ?? []) {
    if (!r.name?.en?.trim()) out.push(issue(r.id, null, 'name.en', 'The rule needs a name in English.', 'تحتاج القاعدة إلى اسم بالإنجليزية.'))
    if (!r.name?.ar?.trim()) out.push(issue(r.id, null, 'name.ar', 'The rule needs a name in Arabic.', 'تحتاج القاعدة إلى اسم بالعربية.'))
    if (!(r.when ?? []).length) out.push(issue(r.id, null, 'when', 'The rule has no condition.', 'لا شرط في القاعدة.'))
    const walk = (list, prefix, level) =>
      list.forEach((c, i) => {
        const at = `${prefix}[${i}]`
        if (c.check === 'group') {
          if (level + 1 > 3) out.push(issue(r.id, at, null, 'Groups nest at most three levels.', 'لا تتداخل المجموعات أكثر من ثلاثة مستويات.'))
          if (!c.conditions.length) out.push(issue(r.id, at, 'conditions', 'This group is empty.', 'هذه المجموعة فارغة.'))
          walk(c.conditions, `${at}.conditions`, level + 1)
        } else if (['patient', 'request', 'line'].includes(c.check) && c.inList === '') {
          out.push(issue(r.id, at, 'inList', 'Pick a list.', 'اختر قائمة.'))
        }
      })
    walk(r.when ?? [], 'when', 0)
    ;(r.then ?? []).forEach((e, i) => {
      for (const lang of ['en', 'ar'])
        if (!e.says?.[lang]?.trim())
          out.push(issue(r.id, `then[${i}]`, `says.${lang}`, `The message in ${lang === 'en' ? 'English' : 'Arabic'} is empty.`, `الرسالة ${lang === 'en' ? 'بالإنجليزية' : 'بالعربية'} فارغة.`))
      if (/\{lastStore\}/.test(`${e.says?.en} ${e.says?.ar}`))
        out.push(issue(r.id, `then[${i}]`, 'says', '{lastStore} is not allowed in phase 1.', '{lastStore} غير مسموح في المرحلة الأولى.'))
    })
  }
  return out
}

/** The editor's doors on a drive's `store`; null when not one of them (fall through to `insuranceRulesStub`). */
export function guardEditorStub(method, path, body, opts = {}) {
  const { store, deny = [], reads = {} } = opts
  if (!store) return null
  const count = (door) => (reads[door] = (reads[door] ?? 0) + 1)
  if (path === 'InsuranceRules/Guards/Draft' && method === 'GET') {
    count('draft')
    if (deny.includes('draft')) return { status: 403, body: '' }
    return envelope(draftReply(store.draft))
  }
  if (path === 'InsuranceRules/Guards/Draft' && method === 'PUT') {
    count('save')
    store.puts.push(body)
    if (body?.revision !== store.draft.revision) return staleDraft()
    store.draft = { ...structuredClone(body), revision: store.draft.revision + 1 }
    return envelope(draftReply(store.draft, { updatedBy: 'msartawi' }))
  }
  if (path === 'InsuranceRules/Guards/Validate' && method === 'POST') {
    count('validate')
    store.validates.push(body)
    return envelope(validateGuards(body))
  }
  return null
}

// --- 614 ---------------------------------------------------------------------------------------------------
// The Review list and HQ exceptions (BackOffice 3134, 3135, 3141). The doors and bodies are the brief's; the
// ROW shapes are guesses recorded on ticket 614 (618 reconciles). `createReviewStubs()` keeps its own state so
// a drive's mark / issue / revoke shows on the next read. Today in the drives is 2026-10-27 (local).

/** `GET Guards/Reasons` (3134) — the seeded NCPDP codes; reason `13` is retired (inactive). */
export const GUARD_REASONS = {
  intervention: [
    { code: 'M0', en: 'Prescriber consulted', ar: 'استُشير الطبيب', active: true },
    { code: 'P0', en: 'Patient consulted', ar: 'استُشير المريض', active: true },
    { code: 'R0', en: 'Pharmacist consulted other source', ar: 'رجع الصيدلي لمصدر آخر', active: true },
    { code: 'MR', en: 'Medication review', ar: 'مراجعة الدواء', active: true },
  ],
  outcome: [
    { code: '1A', en: 'Filled as is, false positive', ar: 'صُرف كما هو، إنذار خاطئ', active: true },
    { code: '1B', en: 'Filled prescription as is', ar: 'صُرفت الوصفة كما هي', active: true },
  ],
  reason: [
    { code: '03', en: 'Vacation supply', ar: 'كمية للسفر', active: true },
    { code: '04', en: 'Lost prescription', ar: 'فقدان الدواء', active: true },
    { code: '05', en: 'Therapy change', ar: 'تغيير العلاج', active: true },
    { code: '07', en: 'Medically necessary', ar: 'ضرورة طبية', active: true },
    { code: '13', en: 'Payer-recognized emergency', ar: 'حالة طارئة يعترف بها الدافع', active: false },
  ],
}

const reviewRow = (o) => ({ reason: null, note: null, exceptionId: null, mark: null, markNote: null, markedBy: null, markedAt: null, ...o })

/** `GET InsuranceRules/Review` rows (guessed shape). Patient keys arrive masked from the server. */
export const REVIEW_ROWS = [
  reviewRow({ id: 'D-9001', kind: 'override', at: '2026-10-26T21:14:00', store: 'P107', pharmacist: 'PH-1107-03', patientKey: '10••••••83', ruleId: 'G-002', item: { code: '100234', name: 'Ator 20mg 30s' }, reason: '05', note: 'Prescriber changed the dose' }),
  reviewRow({ id: 'D-9002', kind: 'override', at: '2026-10-26T18:02:00', store: 'P051', pharmacist: 'PH-2051-01', patientKey: '24••••••19', ruleId: 'G-003', item: { code: '200871', name: 'Ozempic 1mg pen' }, reason: '04', note: 'تلف القلم أثناء النقل', mark: 'questioned', markNote: 'Third lost pen this month', markedBy: 'rev.salem', markedAt: '2026-10-27T08:30:00' }),
  reviewRow({ id: 'D-9003', kind: 'exception', at: '2026-10-25T12:11:00', store: 'P040', pharmacist: 'PH-3040-01', patientKey: '10••••••77', ruleId: 'G-007', item: { code: '200871', name: 'Ozempic 1mg pen' }, reason: '07', exceptionId: 'X-101' }),
  reviewRow({ id: 'D-9004', kind: 'unchecked', at: '2026-10-24T23:40:00', store: 'P150', pharmacist: 'PH-1150-02', patientKey: '11••••••08', ruleId: null, item: { code: '300112', name: 'Glucophage XR 750mg 30s' } }),
  reviewRow({ id: 'D-9005', kind: 'override', at: '2026-10-23T09:30:00', store: 'P107', pharmacist: 'PH-1107-03', patientKey: '23••••••55', ruleId: 'G-002', item: { code: '100235', name: 'Lipitor 20mg 30s' }, reason: '03', note: 'Travel supply', mark: 'ok', markNote: '', markedBy: 'rev.salem', markedAt: '2026-10-24T10:00:00' }),
]

/** `GET InsuranceRules/Exceptions` rows (the list door and its shape are guesses). */
export const EXCEPTIONS = [
  { id: 'X-101', patientKey: '1023456777', ruleId: 'G-007', scope: { item: '200871' }, validUntil: '2026-12-31', reason: '07', note: 'Diagnosis confirmed by the insurer', issuedBy: 'ins.huda', issuedAt: '2026-10-20T10:00:00', revokedBy: null, revokedAt: null, uses: 2 },
  { id: 'X-102', patientKey: '2412345619', ruleId: null, scope: { list: 'glp1' }, validUntil: '2026-11-30', reason: '05', note: '', issuedBy: 'ins.huda', issuedAt: '2026-10-01T09:00:00', revokedBy: 'ins.omar', revokedAt: '2026-10-10T15:00:00', uses: 0 },
  { id: 'X-099', patientKey: '1198765408', ruleId: 'G-002', scope: { sameKind: '100234' }, validUntil: '2026-10-26', reason: '03', note: 'Hajj travel', issuedBy: 'ins.omar', issuedAt: '2026-09-01T11:00:00', revokedBy: null, revokedAt: null, uses: 1 },
]

const logEntry = (at, kind, by, o = {}) => ({ at, kind, by, store: null, ruleId: null, sourceRef: null, ...o })

/** `GET InsuranceRules/Exceptions/{id}/Log`. */
export const EXCEPTION_LOGS = {
  'X-101': [
    logEntry('2026-10-20T10:00:00', 'issue', 'ins.huda'),
    logEntry('2026-10-22T17:45:00', 'use', 'PH-3040-01', { store: 'P040', ruleId: 'G-007', sourceRef: 'NPH-55120' }),
    logEntry('2026-10-25T12:11:00', 'use', 'PH-3040-01', { store: 'P040', ruleId: 'G-007', sourceRef: 'NPH-55871' }),
  ],
  'X-102': [logEntry('2026-10-01T09:00:00', 'issue', 'ins.huda'), logEntry('2026-10-10T15:00:00', 'revoke', 'ins.omar')],
}

/**
 * A stateful handler for the 614 doors: `(method, path, body, params) → route.fulfill arg | null`. `params` is
 * the request's URLSearchParams. `opts.deny` names reads answered with a bare 403 (`review`, `exceptions`);
 * `opts.writes` collects every write `{ method, path, body }`; `opts.refuse` maps a write door (`issue`,
 * `mark`, `revoke`) to a business refusal `{ status, message, errorCode }`; `opts.reads` counts reads.
 */
export function createReviewStubs(opts = {}) {
  const { deny = [], writes = [], refuse = {}, reads = {} } = opts
  const rows = structuredClone(REVIEW_ROWS)
  const exceptions = structuredClone(EXCEPTIONS)
  const logs = structuredClone(EXCEPTION_LOGS)
  let next = 103
  const read = (door, data) => {
    reads[door] = (reads[door] ?? 0) + 1
    return deny.includes(door) ? { status: 403, body: '' } : envelope(data)
  }
  const refused = (door) => {
    const r = refuse[door]
    return r ? envelope(null, { status: r.status ?? 409, success: false, message: r.message, errorCode: r.errorCode }) : null
  }
  return function reviewStub(method, path, body, params = new URLSearchParams()) {
    if (method === 'GET' && path === 'Guards/Reasons') return read('reasons', GUARD_REASONS)
    if (method === 'GET' && path === 'InsuranceRules/Review') {
      const f = (k) => params.get(k) ?? ''
      const out = rows.filter(
        (r) =>
          (!f('kind') || r.kind === f('kind')) &&
          (!f('pharmacist') || r.pharmacist === f('pharmacist')) &&
          (!f('store') || r.store === f('store')) &&
          (!f('rule') || r.ruleId === f('rule')) &&
          (!f('reason') || r.reason === f('reason')),
      )
      return read('review', out)
    }
    let m = /^InsuranceRules\/Review\/([^/]+)$/.exec(path)
    if (method === 'POST' && m) {
      writes.push({ method, path, body })
      const no = refused('mark')
      if (no) return no
      const row = rows.find((r) => r.id === decodeURIComponent(m[1]))
      if (!row) return envelope(null, { status: 404, success: false, message: 'No such decision row.', errorCode: 'NOT_FOUND' })
      Object.assign(row, { mark: body.mark, markNote: body.note, markedBy: 'msartawi', markedAt: '2026-10-27T10:05:00' })
      return envelope(null)
    }
    if (method === 'GET' && path === 'InsuranceRules/Exceptions') return read('exceptions', exceptions)
    if (method === 'POST' && path === 'InsuranceRules/Exceptions') {
      writes.push({ method, path, body })
      const no = refused('issue')
      if (no) return no
      const made = { id: `X-${next++}`, ...body, issuedBy: 'msartawi', issuedAt: '2026-10-27T10:05:00', revokedBy: null, revokedAt: null, uses: 0 }
      exceptions.unshift(made)
      logs[made.id] = [logEntry(made.issuedAt, 'issue', 'msartawi')]
      return envelope(made)
    }
    m = /^InsuranceRules\/Exceptions\/([^/]+)\/Revoke$/.exec(path)
    if (method === 'POST' && m) {
      writes.push({ method, path, body })
      const no = refused('revoke')
      if (no) return no
      const e = exceptions.find((x) => x.id === decodeURIComponent(m[1]))
      if (!e) return envelope(null, { status: 404, success: false, message: 'No such exception.', errorCode: 'NOT_FOUND' })
      Object.assign(e, { revokedBy: 'msartawi', revokedAt: '2026-10-27T10:06:00' })
      logs[e.id] = [...(logs[e.id] ?? []), logEntry(e.revokedAt, 'revoke', 'msartawi')]
      return envelope(null)
    }
    m = /^InsuranceRules\/Exceptions\/([^/]+)\/Log$/.exec(path)
    if (method === 'GET' && m) return read('log', logs[decodeURIComponent(m[1])] ?? [])
    return null
  }
}

// --- 613 --- reference editions (BackOffice 3138), AS BUILT (oms 618): an edition `{ id, list, editionNo, state:
// pending|published, live, fileName, rows: { sfda, map, indications }, problems, uploadedBy/At, publishedBy/At }`;
// the diff's counts and `newlyUnmatched: [{ item, sfdaCode }]`; the gaps `{ id, counts, rows: [{ kind: noMatch|junkCode|
// gtinMismatch|withdrawn, item, description, sfdaCode, detail }] }`; the export `GET …/Gaps/Export` (an .xlsx); the
// uploader's publish refused 403 `EDITIONS_SELF_PUBLISH`. Its own handler, `editionsStub`, so 607's stays untouched.

// The fixtures keep the screen's words for a state (`pending|live|retired`); `wireEdition` sends HQ's.
const edition = (id, list, fileName, rows, uploadedBy, uploadedAt, state, publishedBy = null, publishedAt = null) => ({
  id,
  list,
  fileName,
  rows,
  uploadedBy,
  uploadedAt,
  state,
  publishedBy,
  publishedAt,
})
const wireEdition = (e) => ({
  id: e.id,
  list: e.list,
  editionNo: Number(/(\d+)$/.exec(e.id)?.[1] ?? 0),
  state: e.state === 'pending' ? 'pending' : 'published',
  live: e.state === 'live',
  fileName: e.fileName,
  rows: e.list === 'sfda' ? { sfda: e.rows, map: 0, indications: 0 } : { sfda: 0, map: e.rows, indications: 0 },
  problems: [],
  uploadedBy: e.uploadedBy,
  uploadedAt: e.uploadedAt,
  publishedBy: e.publishedBy ?? '',
  publishedAt: e.publishedAt,
})
const wireGap = (g) => ({ kind: g.kind === 'junk' ? 'junkCode' : g.kind, item: g.item ?? '', description: g.itemName?.en ?? '', sfdaCode: g.sfdaCode ?? '', detail: g.kind === 'gtinMismatch' ? `edition GTIN ${g.detail}; item barcodes ${g.gtin}` : (g.detail ?? '') })

/** `GET InsuranceRules/Editions?list=` — every edition of both lists, newest first. */
export const EDITIONS = [
  edition('ED-SFDA-58', 'sfda', 'SFDA Human Drug List 2026-09.xlsx', 9412, 'nalharbi', '2026-09-28T10:12:00', 'live', 'falotaibi', '2026-09-29T09:01:00'),
  edition('ED-SFDA-57', 'sfda', 'SFDA Human Drug List 2026-08.xlsx', 9388, 'nalharbi', '2026-08-30T11:40:00', 'retired', 'msartawi', '2026-08-31T08:30:00'),
  edition('ED-CHI-7', 'chi', 'CHI Drug Formulary v7.xlsx', 5120, 'falotaibi', '2026-10-01T13:05:00', 'live', 'nalharbi', '2026-10-02T09:15:00'),
]

/** The edition the drive uploads (its id is what `POST InsuranceRules/Editions` answers). */
export const UPLOADED_EDITION_ID = 'ED-SFDA-59'
export const UPLOADED_FILE_NAME = 'SFDA Human Drug List 2026-10.xlsx'

const OZEMPIC = says('Ozempic 1 mg pen', 'أوزمبيك 1 ملغ قلم')
const LIPITOR = says('Lipitor 20 mg tablets', 'ليبيتور 20 ملغ أقراص')
const PANADOL = says('Panadol Extra 24s', 'بنادول إكسترا 24 قرص')

/** `GET InsuranceRules/Editions/{id}/Diff`. */
export const EDITION_DIFFS = {
  [UPLOADED_EDITION_ID]: {
    added: 31,
    dropped: 4,
    changed: 118,
    newlyUnmatched: [
      { item: '100234', itemName: OZEMPIC, sfdaCode: '2412246474' },
      { item: '100871', itemName: LIPITOR, sfdaCode: '52-23-09' },
    ],
    rulesAffected: [
      { ruleId: 'G-008', backtestFires: 41 },
      { ruleId: 'G-009', backtestFires: 7 },
    ],
  },
  'ED-SFDA-58': { added: 12, dropped: 2, changed: 64, newlyUnmatched: [], rulesAffected: [{ ruleId: 'G-008', backtestFires: 3 }] },
  'ED-SFDA-57': { added: 0, dropped: 0, changed: 0, newlyUnmatched: [], rulesAffected: [] },
  'ED-CHI-7': { added: 220, dropped: 15, changed: 9, newlyUnmatched: [], rulesAffected: [{ ruleId: 'G-011', backtestFires: 0 }] },
}

/** `GET InsuranceRules/Editions/{id}/Gaps`. */
export const EDITION_GAPS = {
  [UPLOADED_EDITION_ID]: [
    { kind: 'noMatch', item: '100234', itemName: OZEMPIC, sfdaCode: '2412246474', gtin: '05701234567890', detail: null },
    { kind: 'junk', item: '100512', itemName: PANADOL, sfdaCode: 'OLD DELISTED SFDA', gtin: null, detail: null },
    { kind: 'junk', item: '100513', itemName: says('Brufen 400 mg', 'بروفين 400 ملغ'), sfdaCode: '0', gtin: null, detail: null },
    { kind: 'gtinMismatch', item: '100871', itemName: LIPITOR, sfdaCode: '52-23-09', gtin: '06281234500017', detail: '06281234500024' },
    { kind: 'withdrawn', item: '100940', itemName: says('Zantac 150 mg', 'زانتاك 150 ملغ'), sfdaCode: '1109876543', gtin: null, detail: null },
  ],
  'ED-SFDA-58': [{ kind: 'junk', item: '100512', itemName: PANADOL, sfdaCode: 'OLD DELISTED SFDA', gtin: null, detail: null }],
  'ED-SFDA-57': [],
  'ED-CHI-7': [],
}

/** A fresh, mutable editions store for one drive run (share it across contexts so two users see one HQ). */
export function editionsState() {
  return { editions: EDITIONS.map((e) => ({ ...e })) }
}

/**
 * The 613 doors. `path` may carry its query (`InsuranceRules/Editions?list=sfda`). `opts.editions` is an
 * `editionsState()` (writes land there); `opts.user` the session's user (uploader / publisher); `opts.upload`
 * the `{ list, fileName }` a POST carried (the drive reads them off the multipart body); `opts.now` the local
 * wall-clock of a write; `opts.refusePublish` answers a publish with that refusal `{ status, message, errorCode }`.
 */
export function editionsStub(method, path, opts = {}) {
  const { deny = [], reads = {}, user = 'msartawi', now = '2026-10-27T10:30:00', refusePublish = null, upload = null } = opts
  const st = opts.editions ?? editionsState()
  const hit = (door, data) => {
    reads[door] = (reads[door] ?? 0) + 1
    if (deny.includes(door)) return { status: 403, body: '' }
    return envelope(data)
  }
  const [base, query] = path.split('?')
  const list = new URLSearchParams(query ?? '').get('list')
  if (method === 'GET' && base === 'InsuranceRules/Editions') return hit('editions', st.editions.filter((e) => !list || e.list === list).map(wireEdition))
  if (method === 'POST' && base === 'InsuranceRules/Editions') {
    if (deny.includes('upload')) return { status: 403, body: '' }
    const u = upload ?? { list: 'sfda', fileName: UPLOADED_FILE_NAME }
    st.editions = st.editions.filter((e) => e.id !== UPLOADED_EDITION_ID)
    st.editions.unshift(edition(UPLOADED_EDITION_ID, u.list, u.fileName, 9439, user, now, 'pending'))
    return envelope(wireEdition(st.editions[0]))
  }
  const m = /^InsuranceRules\/Editions\/([^/]+)\/(Diff|Gaps|Gaps\/Export|Publish)$/.exec(base)
  if (!m) return null
  const id = decodeURIComponent(m[1])
  if (method === 'GET' && m[2] === 'Diff') {
    const d = EDITION_DIFFS[id]
    return hit('diff', d ? { id, list: id.includes('CHI') ? 'chi' : 'sfda', against: null, samples: { added: [], dropped: [], changed: [] }, ...d, newlyUnmatched: d.newlyUnmatched.map(({ item, sfdaCode }) => ({ item, sfdaCode })) } : null)
  }
  if (method === 'GET' && m[2] === 'Gaps') return hit('gaps', { id, counts: {}, rows: (EDITION_GAPS[id] ?? []).map(wireGap) })
  if (method === 'GET' && m[2] === 'Gaps/Export') {
    reads.export = (reads.export ?? 0) + 1
    return {
      status: 200,
      contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      headers: { 'Content-Disposition': `attachment; filename="${id}-gaps.xlsx"` },
      body: 'PK-stub-xlsx',
    }
  }
  if (method === 'POST' && m[2] === 'Publish') {
    if (refusePublish) return envelope(null, { success: false, ...refusePublish })
    const ed = st.editions.find((e) => e.id === id)
    if (!ed) return envelope(null, { status: 404, success: false, message: 'no such edition', errorCode: 'EDITIONS_NOT_FOUND' })
    if (ed.uploadedBy.toLowerCase() === user.toLowerCase())
      return envelope(null, { status: 403, success: false, message: 'the user who uploaded an edition cannot publish it', errorCode: 'EDITIONS_SELF_PUBLISH' })
    if (ed.state !== 'pending') return envelope(null, { status: 409, success: false, message: 'the edition is already published', errorCode: 'EDITIONS_NOT_PENDING' })
    for (const e of st.editions) if (e.list === ed.list && e.state === 'live') e.state = 'retired'
    Object.assign(ed, { state: 'live', publishedBy: user, publishedAt: now })
    return envelope(wireEdition(ed))
  }
  return null
}

// --- 615 --- metrics, flags, rejection report (BackOffice 3141). ⚠️ Field spellings beyond the brief are 615's
// guesses (`src/features/insurance-rules/metrics/model.ts`; recorded under 615's ## Comments for 618).

const fires = (refuse, override, warn) => ({ refuse, override, warn })
const outcomes = (removed, changed, overridden, acknowledged, exception) => ({ removed, changed, overridden, acknowledged, exception })
const mrow = (key, name, f, shadowFires, o, overrideRate, sarProtectedEstimate, rejectionsAfterPass, timeAddedMedianMs) => ({
  key, name, fires: f, shadowFires, outcomes: o, overrideRate, sarProtectedEstimate, rejectionsAfterPass, timeAddedMedianMs,
})
const nameOf = (id) => RULES.find((r) => r.id === id).name

/** `GET InsuranceRules/Metrics?by=…` — one table per `by`, in no particular order (the screen sorts). */
export const METRICS = {
  rule: [
    mrow('G-002', nameOf('G-002'), fires(0, 40, 0), 0, outcomes(2, 2, 36, 0, 0), 0.9, 845.5, 1, 12400),
    mrow('G-001', nameOf('G-001'), fires(12, 0, 0), 0, outcomes(10, 2, 0, 0, 0), null, 1320, 0, 8000),
    mrow('G-007', nameOf('G-007'), fires(0, 30, 0), 0, outcomes(3, 3, 24, 0, 0), 0.8, 2210, 2, null),
    mrow('G-010', nameOf('G-010'), fires(0, 0, 18), 0, outcomes(0, 0, 0, 18, 0), null, 0, 0, 3100),
    mrow('G-003', nameOf('G-003'), fires(0, 0, 0), 240, outcomes(0, 0, 0, 0, 0), null, 0, 0, null),
  ],
  store: [
    mrow('P019', null, fires(4, 30, 6), 80, outcomes(5, 1, 28, 6, 0), 0.93, 1200, 2, 9800),
    mrow('P001', null, fires(8, 40, 12), 160, outcomes(7, 4, 32, 12, 5), 0.8, 3175.5, 1, 11000),
  ],
  pharmacist: [mrow('AP-RIY-01', null, fires(2, 20, 4), 30, outcomes(2, 0, 18, 4, 2), 0.9, 410, 0, 15200)],
  day: [
    mrow('2026-10-26', null, fires(3, 9, 2), 20, outcomes(2, 1, 8, 2, 1), 0.89, 300, 0, 9000),
    mrow('2026-10-24', null, fires(5, 12, 6), 40, outcomes(4, 1, 11, 6, 1), 0.92, 950, 1, 10000),
    mrow('2026-10-25', null, fires(1, 4, 0), 10, outcomes(1, 0, 4, 0, 0), 1, 120, 0, 7000),
  ],
}

/** `GET InsuranceRules/Flags` — the current flags with the numbers that raised them. */
export const FLAGS = [
  { ruleId: 'G-002', name: nameOf('G-002'), kind: 'noisy', since: '2026-10-20', fires: 40, overridden: 36, previousAverage: 38, lastFired: '2026-10-27T09:05:00' },
  { ruleId: 'G-003', name: nameOf('G-003'), kind: 'jump', since: '2026-10-25', fires: 240, overridden: 0, previousAverage: 16, lastFired: '2026-10-24T11:30:00' },
  { ruleId: 'G-004', name: nameOf('G-004'), kind: 'silent', since: '2026-10-01', fires: 0, overridden: 0, previousAverage: 0, lastFired: null },
]

/** `GET InsuranceRules/Settings/Flags` — the flag job's thresholds (3141's defaults). */
export const FLAG_SETTINGS = { noisyOverrideRate: 0.8, noisyMinFires: 30, windowDays: 30, silentDays: 60, jumpFactor: 10 }

/** `GET InsuranceRules/Rejections` — by code (or the payer's words), payer and same kind. */
export const REJECTIONS = [
  { code: 'CV-4-8', words: null, payer: 'BUPA', sameKind: 'E0101', count: 14, sar: 1820.5, liveGuard: true },
  { code: 'CV-4-5', words: null, payer: 'TAWUNIYA', sameKind: 'E1497', count: 6, sar: 5400, liveGuard: false },
  { code: null, words: 'الكمية تتجاوز الحد المسموح', payer: 'BUPA', sameKind: 'E1497', count: 3, sar: 2700, liveGuard: true },
  { code: 'BE-1-4', words: null, payer: 'MEDGULF', sameKind: 'E0233', count: 9, sar: 640, liveGuard: false },
]

/**
 * 615's doors. `query` is the request's URLSearchParams; `opts.asked` collects each read's params; `opts.deny`
 * names doors (`metrics`, `flags`, `flagSettings`, `saveFlagSettings`, `rejections`) answered with a bare 403.
 * Review 3126 P5: `PUT InsuranceRules/Settings/Flags` (body = the settings) pushes `{ door, body }` to `opts.writes`,
 * keeps the body in `opts.settings` (later GETs read it) and answers it back.
 */
export function insuranceMetricsStub(method, path, query, opts = {}) {
  const { deny = [], asked = [], writes = [] } = opts
  if (method === 'PUT' && path === 'InsuranceRules/Settings/Flags') {
    writes.push({ door: 'saveFlagSettings', body: opts.body })
    if (deny.includes('saveFlagSettings')) return { status: 403, body: '' }
    opts.settings = opts.body
    return envelope(opts.body)
  }
  if (method !== 'GET') return null
  const door =
    path === 'InsuranceRules/Metrics' ? 'metrics'
    : path === 'InsuranceRules/Flags' ? 'flags'
    : path === 'InsuranceRules/Settings/Flags' ? 'flagSettings'
    : path === 'InsuranceRules/Rejections' ? 'rejections'
    : null
  if (!door) return null
  asked.push({ door, params: Object.fromEntries(query) })
  if (deny.includes(door)) return { status: 403, body: '' }
  if (door === 'metrics') return envelope(METRICS[query.get('by')] ?? [])
  if (door === 'flags') return envelope(FLAGS)
  if (door === 'flagSettings') return envelope(opts.settings ?? FLAG_SETTINGS)
  const payer = query.get('payer')
  return envelope(payer ? REJECTIONS.filter((r) => r.payer === payer) : REJECTIONS)
}

// --- 616 --- guards on an OMS order (BackOffice 3142/3143; check doors 3127/3128/3134). Order doors in the
// brief's spelling, `Oms/Orders/{id}/Guards/Recheck|Release` (review 3126 P1); `{id}` read as the document no.

const reasonCode = (code, en, ar, active = true) => ({ code, en, ar, active })

/** `GET Guards/Reasons` — the seeded NCPDP codes; G-002 asks a reason, `04` is capped at one use. */
export const ORDER_GUARD_REASONS = {
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
  if (method === 'GET' && path === 'Guards/Reasons') return envelope(ORDER_GUARD_REASONS)
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
  const door = method === 'POST' && path.match(/^Oms\/Orders\/([^/]+)\/Guards\/(Recheck|Release)$/)
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

// --- 611 --- approval by role, shadow promotion, versions (BackOffice 3139; the latest back-test 3140), AS BUILT
// (oms 618). There is no `…/Approval` door: where the draft stands is the draft (`draftReply`'s state fields).
//   GET  InsuranceRules/Guards/Draft               → the draft: `state` none|editing|pending|sentBack, requestedBy/At, …
//   GET  InsuranceRules/Guards/Backtests           → `store.backtests`, newest first (3140, 612's shape)
//   GET  InsuranceRules/Guards/Backtests/{id}      → `store.backtests[id]`
//   POST InsuranceRules/Guards/Submit { revision, note } → 409 GUARDS_BACKTEST_MISSING without a done back-test of
//                                                    this revision; 409 GUARDS_DRAFT_PENDING when already asked;
//                                                    draft rules turn waiting → the draft, `pending`
//   POST InsuranceRules/Guards/Approve { revision, note } → a bare 403 without the approver grant; 409
//                                                    GUARDS_DRAFT_NOT_PENDING; 403 GUARDS_SELF_APPROVAL for whoever
//                                                    asked or last saved; waiting rules turn shadow today → the version
//   POST InsuranceRules/Guards/SendBack { note }   → the same refusals, a note required (400) → the draft, `sentBack`
//   POST InsuranceRules/Guards/Rules/{id}/Promote  → `{ skipReason? }`; 409 GUARDS_SHADOW_TOO_SHORT under 14 local
//                                                    days without a reason, 409 GUARDS_NOT_IN_SHADOW → the version
//   GET  InsuranceRules/Guards/Versions            → `[{ versionNo, publishedAt, publishedBy, requestedBy, action,
//                                                    note }]` newest first; POST …/Versions/{v}/Restore → a NEW draft
//                                                    (409 GUARDS_DRAFT_EXISTS over a draft)
//   GET / PUT Draft, POST Validate                 → on `store.draft` (608's `validateGuards`)
// Never a live SIS.Api.

/** The published versions, newest first (3139's `GET …/Versions`). */
export const GUARD_VERSIONS = [
  { versionNo: 4, publishedAt: '2026-10-20T11:15:00', publishedBy: 'falotaibi', requestedBy: 'nalharbi', action: 'approve', note: 'SFDA not-marketed guard into shadow.' },
  { versionNo: 3, publishedAt: '2026-10-15T09:30:00', publishedBy: 'falotaibi', requestedBy: 'nalharbi', action: 'approve', note: 'أقلام GLP-1 كل 28 يوماً في وضع الظل' },
  { versionNo: 2, publishedAt: '2026-09-02T16:45:00', publishedBy: 'malqahtani', requestedBy: 'nalharbi', action: 'approve', note: '' },
]

/** What each version held: version 3 had neither of the draft rules (G-006, G-011) nor G-008. */
const VERSION_DOCS = {
  4: wireRuleset({ ...RULESET, revision: 0, rules: RULES.filter((r) => !['G-006', 'G-011'].includes(r.id)) }),
  3: wireRuleset({ ...RULESET, revision: 0, rules: RULES.filter((r) => !['G-006', 'G-008', 'G-011'].includes(r.id)) }),
  2: wireRuleset({ ...RULESET, revision: 0, rules: RULES.filter((r) => ['G-001', 'G-002', 'G-004', 'G-010'].includes(r.id)) }),
}

/** The draft's back-test of revision 12 (RULESET's), done — 612's report over 30 days. */
export const BACKTEST_DONE_ID = 'BT-40'
export const BACKTEST_DONE = backtestReport(30, 12, BACKTEST_DONE_ID)

/** One HQ for a drive: the draft and its state fields, the latest back-test, the versions, every write.
 * `backtest`: the draft's back-test (612's shape) under `BACKTEST_DONE_ID`, or null for none. `backtests` keeps
 * insertion order (oldest first); the list door answers newest first. `draftState` starts the draft elsewhere
 * (`none` = no draft row: the newest version shows at revision 0). */
export function newApprovalStore({ backtest = BACKTEST_DONE, draftState = 'editing' } = {}) {
  return {
    draft: structuredClone(WIRE_RULESET),
    meta: { state: draftState, updatedBy: 'ins.huda', updatedAt: '2026-10-26T15:00:00', requestedBy: null, requestedAt: null, requestNote: null, reviewedBy: null, reviewNote: null, origin: '' },
    backtests: backtest ? { [BACKTEST_DONE_ID]: { ...structuredClone(backtest), id: BACKTEST_DONE_ID } } : {},
    versions: structuredClone(GUARD_VERSIONS),
    versionDocs: structuredClone(VERSION_DOCS),
    writes: [],
  }
}

const localDays = (fromDay, now) => {
  const [y, m, d] = fromDay.slice(0, 10).split('-').map(Number)
  const [ny, nm, nd] = now.slice(0, 10).split('-').map(Number)
  return Math.round((Date.UTC(ny, nm - 1, nd) - Date.UTC(y, m - 1, d)) / 86400000)
}

/**
 * 611's doors on a drive's `store` (newApprovalStore()). `opts.user` is the session's user id, `opts.viewer` the
 * grants HQ checks `{ author, approver }` (a door the session lacks the grant for is a bare 403, as built), `opts.now`
 * the local moment HQ stamps. Null when not one of these.
 */
export function approvalStub(method, path, body, opts = {}) {
  const { store, user = 'nalharbi', viewer = { author: true, approver: false }, now = '2026-10-27T10:30:00', deny = [] } = opts
  if (!store) return null
  const refuse = (status, errorCode, message) => envelope(null, { status, success: false, message, errorCode })
  const bare = () => ({ status: 403, body: '' })
  const draft = () => envelope(draftReply(store.draft, { ...store.meta, revision: store.draft.revision }))
  const write = () => store.writes.push({ method, path, body, user })
  const G = 'InsuranceRules/Guards'
  const setStates = (from, to, extra = {}) => {
    store.draft.rules = store.draft.rules.map((r) => (r.state === from ? { ...r, state: to, ...extra } : r))
  }
  const nextVersion = () => Math.max(0, ...store.versions.map((v) => v.versionNo)) + 1
  if (deny.includes(path)) return bare()

  if (method === 'GET' && path === `${G}/Draft`) return draft()
  if (method === 'PUT' && path === `${G}/Draft`) {
    write()
    if (store.meta.state === 'pending') return refuse(409, 'GUARDS_DRAFT_PENDING', 'the draft is waiting for approval')
    if (body?.revision !== store.draft.revision) return staleDraft()
    store.draft = { ...structuredClone(body), revision: store.draft.revision + 1 }
    store.meta = { ...store.meta, state: 'editing', updatedBy: user, updatedAt: now }
    return draft()
  }
  if (method === 'POST' && path === `${G}/Validate`) return envelope(validateGuards(body ?? store.draft))
  const btRead = method === 'GET' && path.match(/^InsuranceRules\/Guards\/Backtests\/([^/]+)$/)
  if (btRead && store.backtests[decodeURIComponent(btRead[1])]) return envelope(store.backtests[decodeURIComponent(btRead[1])])
  if (method === 'GET' && path === `${G}/Backtests`) return envelope(Object.values(store.backtests).reverse())
  if (method === 'GET' && path === `${G}/Versions`) return envelope(store.versions)

  if (method === 'POST' && path === `${G}/Submit`) {
    write()
    if (!viewer.author) return bare()
    if (store.meta.state === 'none') return refuse(404, 'GUARDS_NOT_FOUND', 'there is no draft to submit: save one first')
    if (store.meta.state === 'pending') return refuse(409, 'GUARDS_DRAFT_PENDING', 'the draft is already waiting for approval')
    if (body?.revision != null && body.revision !== store.draft.revision) return staleDraft()
    if (!Object.values(store.backtests).some((bt) => bt.status === 'done' && bt.revision === store.draft.revision))
      return refuse(409, 'GUARDS_BACKTEST_MISSING', 'no finished back-test of the draft revision')
    store.meta = { ...store.meta, state: 'pending', requestedBy: user, requestedAt: now, requestNote: body?.note || null }
    setStates('draft', 'waiting')
    return draft()
  }
  if (method === 'POST' && (path === `${G}/Approve` || path === `${G}/SendBack`)) {
    write()
    if (!viewer.approver) return bare()
    if (store.meta.state !== 'pending') return refuse(409, 'GUARDS_DRAFT_NOT_PENDING', 'no draft is waiting for approval')
    const me = user.toLowerCase()
    if (me === (store.meta.requestedBy ?? '').toLowerCase() || me === (store.meta.updatedBy ?? '').toLowerCase())
      return refuse(403, 'GUARDS_SELF_APPROVAL', 'you asked for or last edited this draft: a different user approves it')
    if (path.endsWith('/Approve')) {
      if (body?.revision != null && body.revision !== store.draft.revision) return staleDraft()
      setStates('waiting', 'shadow', { shadowSince: now.slice(0, 10) })
      const version = { versionNo: nextVersion(), publishedAt: now, publishedBy: user, requestedBy: store.meta.requestedBy, action: 'approve', note: body?.note || store.meta.requestNote || '' }
      store.versionDocs[version.versionNo] = { ...structuredClone(store.draft), revision: 0 }
      store.versions.unshift(version)
      // The draft row is gone: the draft door shows the new version at revision 0.
      store.draft = { ...store.draft, revision: 0 }
      store.meta = { ...store.meta, state: 'none', requestedBy: null, requestedAt: null, requestNote: null, reviewedBy: null, reviewNote: null }
      return envelope(version)
    }
    if (!body?.note?.trim()) return refuse(400, 'GUARDS_AUTHORING_BAD_REQUEST', 'say why the draft goes back')
    setStates('waiting', 'draft')
    store.meta = { ...store.meta, state: 'sentBack', reviewedBy: user, reviewNote: body.note }
    return draft()
  }
  const promote = method === 'POST' && path.match(/^InsuranceRules\/Guards\/Rules\/([^/]+)\/Promote$/)
  if (promote) {
    write()
    const id = decodeURIComponent(promote[1])
    const rule = store.draft.rules.find((r) => r.id === id)
    if (!viewer.approver) return bare()
    if (!rule || rule.state !== 'shadow') return refuse(409, 'GUARDS_NOT_IN_SHADOW', 'this rule is not in shadow in the newest version')
    if ((!rule.shadowSince || localDays(rule.shadowSince, now) < 14) && !body?.skipReason?.trim())
      return refuse(409, 'GUARDS_SHADOW_TOO_SHORT', 'under 14 days in shadow: give a reason to skip the rest')
    store.draft.rules = store.draft.rules.map((r) => (r.id === id ? { ...r, state: 'live', shadowSince: null } : r))
    const version = { versionNo: nextVersion(), publishedAt: now, publishedBy: user, requestedBy: null, action: 'promote', note: body?.skipReason ?? '' }
    store.versions.unshift(version)
    return envelope(version)
  }
  const restore = method === 'POST' && path.match(/^InsuranceRules\/Guards\/Versions\/(\d+)\/Restore$/)
  if (restore) {
    write()
    if (store.meta.state !== 'none') return refuse(409, 'GUARDS_DRAFT_EXISTS', 'a draft exists: approve, send back or finish it first')
    const doc = store.versionDocs[restore[1]]
    if (!doc) return refuse(404, 'GUARDS_NOT_FOUND', 'no version ' + restore[1])
    store.draft = { ...structuredClone(doc), revision: 1 }
    store.meta = { ...store.meta, state: 'editing', origin: `restore:${restore[1]}`, updatedBy: user, updatedAt: now }
    return draft()
  }
  return null
}

// --- 609 --- guard templates and folders (BackOffice 3139), AS BUILT (oms 618):
//   GET  InsuranceRules/Guards                      → rows from `state.store.draft` (moves and new rules show)
//   GET  InsuranceRules/Guards/Folders              → `{ folders: [{ path, rules }] }` (kept empty ones + the rules')
//   POST InsuranceRules/Guards/Folders              → body `{ path }` → the tree
//   PUT  InsuranceRules/Guards/Folders              → `{ from, to }` renames a folder (its rules and sub-folders
//                                                     follow); `{ ruleId, folder }` moves ONE rule. No approval.
//   GET  InsuranceRules/Guards/Templates            → `[{ id, origin, name, conflictCode, rule, blanks: [path],
//                                                     updatedBy, updatedAt }]` (the rule in the engine's spelling)
//   POST InsuranceRules/Guards/Templates            → body `{ id, name, ruleId, blanks: [path] }` → the template; a
//                                                     phase-1 id → 409 GUARDS_TEMPLATE_READ_ONLY, a blank that is
//                                                     not a field of the rule → 400
//   POST InsuranceRules/Guards/Templates/{id}/Create → body `{ revision, ruleId, name?, folder?, values }` → the
//                                                     DRAFT with the new rule; a stale revision → 409, a value for a
//                                                     path that is not a blank → 400
// Draft GET / PUT / Validate fall through to 608's `guardEditorStub` on the SAME `state.store`.

const blank = (path, en, ar) => ({ path, label: says(en, ar) })
const NAME_BLANK = blank('name', 'Rule name', 'اسم القاعدة')
const LIST_BLANK = blank('filters[0].list', 'Item list', 'قائمة الأصناف')
const DAYS_BLANK = blank('when[0].windowDays', 'Days back', 'عدد الأيام السابقة')
const tplRule = (o) => ({
  id: '',
  name: says('', ''),
  folder: '',
  state: 'draft',
  window: { from: null, until: null },
  audience: { channels: ALL_CHANNELS, stores: [] },
  filters: [],
  onUnknown: 'none',
  ...o,
})
/**
 * A phase-1 template as HQ serves it: the rule in the engine's spelling without id or state, its blanks as PATHS
 * (HQ names none), a rule-filter blank (`filters[0].list`) moved to the block that names the list.
 */
function tpl(id, en, ar, conflictCode, rule, blanks) {
  const editor = tplRule(rule)
  // The stubs' `items` alias stands for "the list the author picks": the block names none yet (an empty blank).
  const alias = editor.filters.map((f) => (f.list ? f : { ...f, list: f.id }))
  const wire = wireRule({ ...editor, filters: alias })
  const listAt = wire.when.findIndex((c) => (typeof c.match === 'string' && c.match.startsWith('list:')) || (c.check === 'line' && 'inList' in c))
  if (listAt >= 0) {
    const c = wire.when[listAt]
    if (typeof c.match === 'string' && c.match === 'list:items') c.match = ''
    if (c.check === 'line' && c.inList === 'items') c.inList = ''
  }
  const paths = [NAME_BLANK, ...blanks].map((b) =>
    b.path === LIST_BLANK.path ? `when[${listAt}].${wire.when[listAt]?.check === 'line' ? 'inList' : 'match'}` : b.path,
  )
  delete wire.id
  delete wire.state
  return { id, origin: 'phase1', name: says(en, ar), conflictCode, rule: wire, blanks: paths, updatedBy: 'seed', updatedAt: '2026-10-01T00:00:00' }
}
const tplCodes = (conflict, nphies) => ({ conflict, nphies })
const tplItems = () => [{ id: 'items', list: '' }]

/** HQ's phase-1 templates, copied from `BackOffice/.issues/assets/3093-guard-templates.md` (`says` verbatim). */
export const TEMPLATES = [
  tpl(
    'T-RTS',
    'Refill too soon',
    'صرف مبكر',
    'ER',
    {
      when: [
        {
          check: 'supply',
          match: 'sameKind',
          eligibleDaysBeforeDue: 10,
          eligibleDaysBeforeDueFor: [{ list: '', value: 7 }],
          accumulate: { surplusDays: 10, overDays: 90 },
          unknownSupply: { assumeDays: 30 },
        },
      ],
      then: [
        guard('OVERRIDE', 'Refill too soon: {consumedPct}% used, eligible from {eligibleOn}', 'صرف مبكر: استُهلك {consumedPct}%، يحق الصرف من {eligibleOn}', {
          codes: tplCodes('ER', 'CV-4-8'),
        }),
      ],
    },
    [
      blank('when[0].eligibleDaysBeforeDue', 'Days before due', 'أيام قبل الاستحقاق'),
      blank('when[0].eligibleDaysBeforeDueFor[0].list', 'Controlled drugs list', 'قائمة الأدوية الخاضعة للرقابة'),
      blank('when[0].eligibleDaysBeforeDueFor[0].value', 'Days before due for that list', 'أيام قبل الاستحقاق لهذه القائمة'),
    ],
  ),
  tpl(
    'T-DUP',
    'Duplicate dispense',
    'صرف مكرر',
    '83',
    {
      when: [{ check: 'history', match: 'sameItem', windowDays: 3, measure: 'dispenses', atLeast: 1, includeThisLine: false }],
      then: [guard('REFUSE', 'Already dispensed on {lastDispensedOn}', 'صُرف مسبقاً بتاريخ {lastDispensedOn}', { codes: tplCodes('83', null) })],
    },
    [DAYS_BLANK],
  ),
  tpl(
    'T-QTY',
    'Quantity cap per period',
    'حد الكمية لكل فترة',
    'HD',
    {
      filters: tplItems(),
      when: [{ check: 'history', match: 'list:items', windowDays: 28, measure: 'quantity', atLeast: 5, includeThisLine: true }],
      then: [
        guard('OVERRIDE', '{count} units in {windowDays} days; the limit is {limit}', '{count} وحدة خلال {windowDays} يوماً؛ الحد {limit}', {
          codes: tplCodes('HD', null),
          suggest: { maxQuantity: '{remaining}' },
        }),
      ],
    },
    [LIST_BLANK, DAYS_BLANK, blank('when[0].atLeast', 'Units that fire it', 'الوحدات التي تطلقها')],
  ),
  tpl(
    'T-TD',
    'Therapeutic duplication',
    'ازدواجية علاجية',
    'TD',
    {
      when: [{ check: 'history', match: 'sameClass', windowDays: 30, measure: 'dispenses', atLeast: 1, includeThisLine: false, excludeSameKind: true }],
      then: [guard('WARN', 'Patient already has {otherItem} in the same class', 'لدى المريض {otherItem} من نفس الفئة العلاجية', { codes: tplCodes('TD', null) })],
    },
    [DAYS_BLANK],
  ),
  tpl(
    'T-HOP',
    'Store-hopping',
    'التنقل بين الفروع',
    null,
    {
      when: [{ check: 'history', match: 'sameKind', windowDays: 30, measure: 'distinctStores', atLeast: 3, includeThisLine: true }],
      then: [guard('WARN', 'Dispensed at {count} stores in {windowDays} days', 'صُرف في {count} فروع خلال {windowDays} يوماً')],
    },
    [DAYS_BLANK, blank('when[0].atLeast', 'Stores that fire it', 'الفروع التي تطلقها')],
  ),
  tpl(
    'T-MX',
    'Supply longer than allowed',
    'كمية أطول من المسموح',
    'MX',
    {
      when: [{ check: 'line', field: 'daysSupply', above: 90 }],
      then: [guard('REFUSE', '{daysSupply} days in one request; the maximum is {limit}', '{daysSupply} يوماً في طلب واحد؛ الحد الأقصى {limit}', { codes: tplCodes('MX', 'CV-4-2') })],
    },
    [blank('when[0].above', 'Most days in one request', 'أقصى أيام في طلب واحد')],
  ),
  tpl(
    'T-COV',
    'Supply past coverage end',
    'كمية بعد انتهاء التغطية',
    null,
    {
      when: [{ check: 'line', field: 'supplyEndsOn', after: '$eligibility.coverage.periodEnd' }],
      then: [
        guard('OVERRIDE', 'Supply runs to {supplyEndsOn}; the policy ends {periodEnd}', 'تمتد الكمية حتى {supplyEndsOn}؛ وتنتهي الوثيقة في {periodEnd}', {
          suggest: { maxDaysSupply: '{daysToPeriodEnd}' },
        }),
      ],
    },
    [],
  ),
  tpl(
    'T-RSN',
    'Item needs a reason',
    'صنف يتطلب سبباً',
    null,
    {
      filters: tplItems(),
      when: [{ check: 'line', inList: 'items' }],
      then: [guard('OVERRIDE', 'This item needs a reason before it is sent', 'يتطلب هذا الصنف سبباً قبل الإرسال')],
    },
    [LIST_BLANK],
  ),
  tpl(
    'T-VOL',
    'Requests per pharmacist',
    'الطلبات لكل صيدلي',
    null,
    {
      filters: tplItems(),
      when: [{ check: 'volume', by: 'pharmacist', match: 'list:items', window: 'day', atLeast: 20, includeThisLine: true }],
      then: [guard('WARN', '{count} requests for these items by you today', '{count} طلباً لهذه الأصناف من قبلك اليوم')],
    },
    [LIST_BLANK, blank('when[0].atLeast', 'Requests that fire it', 'الطلبات التي تطلقها')],
  ),
  tpl(
    'T-SFDA',
    'SFDA not registered / not marketed',
    'غير مسجل أو غير مسوّق لدى الهيئة',
    null,
    {
      when: [{ check: 'sfda', status: 'notMarketed' }],
      then: [guard('REFUSE', 'This item is not marketed with SFDA', 'هذا الصنف غير مسوّق لدى الهيئة', { codes: tplCodes(null, 'CV-4-10') })],
    },
    [],
  ),
  tpl(
    'T-PRICE',
    'Price above SFDA public price',
    'السعر أعلى من سعر الهيئة',
    null,
    {
      when: [{ check: 'sfda', priceAbove: 0 }],
      then: [guard('WARN', 'The price is above the SFDA public price', 'السعر أعلى من سعر الهيئة للعموم', { codes: tplCodes(null, 'BE-1-6') })],
    },
    [blank('when[0].priceAbove', 'Tolerance (SAR)', 'الهامش (ريال)')],
  ),
  tpl(
    'T-PACK',
    'Pack / GTIN mismatch',
    'عدم تطابق العبوة أو GTIN',
    null,
    {
      when: [{ check: 'sfda', packMismatch: true }],
      then: [guard('WARN', 'The pack does not match the SFDA record', 'العبوة لا تطابق سجل الهيئة')],
    },
    [],
  ),
  tpl(
    'T-IND',
    'Indication not on formulary',
    'الداعي غير مدرج في الدليل',
    null,
    {
      when: [{ check: 'formulary', indication: 'notListed' }],
      then: [guard('OVERRIDE', 'The diagnosis is not an indication on the formulary', 'التشخيص ليس من دواعي الاستعمال في الدليل', { codes: tplCodes(null, 'CV-4-5') })],
    },
    [],
  ),
  tpl(
    'T-QL',
    'Quantity above formulary QL',
    'الكمية أعلى من حد الدليل',
    null,
    {
      when: [{ check: 'formulary', edit: 'QL' }],
      then: [guard('OVERRIDE', 'The quantity is above the formulary limit', 'الكمية أعلى من حد الدليل الدوائي', { codes: tplCodes(null, 'SE-1-9') })],
    },
    [],
  ),
  tpl(
    'T-PA',
    'PA required',
    'يتطلب موافقة مسبقة',
    null,
    {
      when: [{ check: 'formulary', edit: 'PA' }],
      then: [guard('WARN', 'This item needs prior approval', 'يتطلب هذا الصنف موافقة مسبقة', { codes: tplCodes(null, 'BE-1-4') })],
    },
    [],
  ),
  tpl(
    'T-AGE',
    'Age outside the edit',
    'العمر خارج حد الدليل',
    null,
    {
      when: [{ check: 'formulary', edit: 'AGE' }],
      then: [guard('OVERRIDE', 'The age of the patient is outside the formulary edit', 'عمر المريض خارج حد الدليل', { codes: tplCodes(null, 'AD-3-7') })],
    },
    [],
  ),
]

/** A folder HQ keeps with no rule in it yet (made through `POST …/Folders`). */
export const EMPTY_FOLDERS = ['Specialty medicines/Biologics']

/** A drive's stateful templates + folders, on 608's guard store (so a create or a move reads back). */
export function newTemplatesState() {
  return { store: newGuardStore(), templates: structuredClone(TEMPLATES), folders: [...EMPTY_FOLDERS], writes: [] }
}

const pathSteps = (path) =>
  String(path)
    .split('.')
    .flatMap((p) => {
      const m = /^([^[]+)((?:\[\d+\])*)$/.exec(p)
      return m ? [m[1], ...[...m[2].matchAll(/\[(\d+)\]/g)].map((x) => Number(x[1]))] : [p]
    })
const getPath = (o, path) => pathSteps(path).reduce((a, s) => (a == null ? undefined : a[s]), o)
function setPath(o, path, v) {
  const steps = pathSteps(path)
  const parent = steps.slice(0, -1).reduce((a, s) => (a == null ? undefined : a[s]), o)
  if (parent && typeof parent === 'object') parent[steps[steps.length - 1]] = v
}
const segs = (f) =>
  String(f ?? '')
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
const under = (folder, root) => {
  const a = segs(folder)
  const b = segs(root)
  return b.length > 0 && b.length <= a.length && b.every((s, i) => s === a[i])
}
const rebase = (folder, from, to) => [...segs(to), ...segs(folder).slice(segs(from).length)].join('/')
const allFolders = (state) => {
  const out = new Set()
  for (const f of [...state.folders, ...state.store.draft.rules.map((r) => r.folder)]) {
    const s = segs(f)
    for (let i = 1; i <= s.length; i++) out.add(s.slice(0, i).join('/'))
  }
  return [...out].sort((a, b) => a.localeCompare(b))
}
const nextRuleId = (rules) => `G-${String(Math.max(0, ...rules.map((r) => Number(/^G-(\d+)$/.exec(r.id)?.[1] ?? 0))) + 1).padStart(3, '0')}`
const emptyOf = (v) => (typeof v === 'number' ? v : typeof v === 'object' && v !== null ? says('', '') : '')

/** The templates and folders doors on a drive's `state`; null when not one of them. */
export function templatesStub(method, path, body, opts = {}) {
  const { state, deny = [], reads = {}, user = 'msartawi', now = '2026-10-27T10:00:00' } = opts
  if (!state) return null
  const denied = (name) => {
    reads[name] = (reads[name] ?? 0) + 1
    return deny.includes(name)
  }
  const write = (name) => state.writes.push({ door: name, body })
  const bump = () => (state.store.draft = { ...state.store.draft, revision: state.store.draft.revision + 1 })
  const fail = (status, message, errorCode) => envelope(null, { status, success: false, message, errorCode })

  if (method === 'GET' && path === 'InsuranceRules/Guards') {
    if (denied('guards')) return { status: 403, body: '' }
    return envelope(state.store.draft.rules.map(guardRow))
  }
  if (path === 'InsuranceRules/Guards/Folders') {
    if (denied(`folders.${method}`)) return { status: 403, body: '' }
    if (method === 'POST') {
      write('folders.create')
      const p = segs(body?.path).join('/')
      if (!p) return fail(400, 'a folder has a path', 'GUARDS_AUTHORING_BAD_REQUEST')
      state.folders.push(p)
    } else if (method === 'PUT' && typeof body?.ruleId === 'string' && body.ruleId.trim()) {
      write('folders.move')
      const to = segs(body.folder).join('/')
      if (!state.store.draft.rules.some((r) => r.id === body.ruleId)) return fail(404, `no rule '${body.ruleId}'`, 'GUARDS_NOT_FOUND')
      state.store.draft = { ...state.store.draft, rules: state.store.draft.rules.map((r) => (r.id === body.ruleId ? { ...r, folder: to } : r)) }
      bump()
    } else if (method === 'PUT') {
      write('folders.rename')
      const { from, to } = body ?? {}
      state.folders = state.folders.map((f) => (under(f, from) ? rebase(f, from, to) : f))
      state.store.draft = {
        ...state.store.draft,
        rules: state.store.draft.rules.map((r) => (under(r.folder, from) ? { ...r, folder: rebase(r.folder, from, to) } : r)),
      }
      bump()
    }
    const direct = (p) => state.store.draft.rules.filter((r) => segs(r.folder).join('/') === p).length
    return envelope({ folders: allFolders(state).map((p) => ({ path: p, rules: direct(p) })) })
  }
  if (method === 'GET' && path === 'InsuranceRules/Guards/Templates') {
    if (denied('templates')) return { status: 403, body: '' }
    return envelope(state.templates)
  }
  if (method === 'POST' && path === 'InsuranceRules/Guards/Templates') {
    if (denied('templates.save')) return { status: 403, body: '' }
    write('templates.save')
    const code = String(body?.id ?? '').trim()
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(code)) return fail(400, "a template id is letters, digits, '.', '_' or '-', up to 40", 'GUARDS_AUTHORING_BAD_REQUEST')
    if (!body?.name?.en?.trim() || !body?.name?.ar?.trim()) return fail(400, 'a template is named in English and in Arabic', 'GUARDS_AUTHORING_BAD_REQUEST')
    const r = state.store.draft.rules.find((x) => x.id === body?.ruleId)
    if (!r) return fail(404, `no rule '${body?.ruleId}' to save as a template`, 'GUARDS_NOT_FOUND')
    const rule = structuredClone(r)
    delete rule.id
    delete rule.state
    delete rule.shadowSince
    for (const p of body.blanks ?? []) if (getPath(rule, p) === undefined) return fail(400, `blank '${p}' is not a field of rule '${r.id}'`, 'GUARDS_AUTHORING_BAD_REQUEST')
    const at = state.templates.findIndex((x) => x.id === code)
    if (at >= 0 && state.templates[at].origin !== 'team') return fail(409, `template '${code}' is a phase-1 template`, 'GUARDS_TEMPLATE_READ_ONLY')
    // HQ keeps the rule's values as the blanks' defaults.
    const t = { id: code, origin: 'team', name: body.name, conflictCode: r.then[0]?.codes?.conflict ?? null, rule, blanks: [...(body.blanks ?? [])], updatedBy: user, updatedAt: now }
    if (at >= 0) state.templates[at] = t
    else state.templates.push(t)
    return envelope(t)
  }
  const create = method === 'POST' && path.match(/^InsuranceRules\/Guards\/Templates\/([^/]+)\/Create$/)
  if (create) {
    if (denied('templates.create')) return { status: 403, body: '' }
    write('templates.create')
    const t = state.templates.find((x) => x.id === decodeURIComponent(create[1]))
    if (!t) return fail(404, `no template '${decodeURIComponent(create[1])}'`, 'GUARDS_NOT_FOUND')
    const id = String(body?.ruleId ?? '').trim()
    if (!/^[A-Za-z0-9._-]{1,40}$/.test(id)) return fail(400, "a rule id is letters, digits, '.', '_' or '-', up to 40", 'GUARDS_AUTHORING_BAD_REQUEST')
    if ((body?.revision ?? 0) !== state.store.draft.revision) return staleDraft()
    if (state.store.draft.rules.some((r) => r.id === id)) return fail(400, `the draft already has a rule '${id}'`, 'GUARDS_AUTHORING_BAD_REQUEST')
    const rule = structuredClone(t.rule)
    for (const [p, v] of Object.entries(body?.values ?? {})) {
      if (!t.blanks.includes(p)) return fail(400, `'${p}' is not a blank of template '${t.id}'`, 'GUARDS_AUTHORING_BAD_REQUEST')
      setPath(rule, p, structuredClone(v))
    }
    const created = { id, ...rule, state: 'draft' }
    if (body?.name?.en || body?.name?.ar) created.name = body.name
    if (body?.folder != null) created.folder = segs(body.folder).join('/')
    state.store.draft = { ...state.store.draft, rules: [...state.store.draft.rules, created] }
    bump()
    return envelope(draftReply(state.store.draft, { updatedBy: user, origin: `template:${t.id}` }))
  }
  return guardEditorStub(method, path, body, { store: state.store, deny, reads })
}

// --- 617 --- insurer settings (BackOffice 3144), the category and coverage rulesets (3145 / 3146), as BUILT, and the
// eligibility facts the Fields registry offers every palette. Stateful: one `newCoverageState()` per browser context,
// passed as `opts.state`.
//   GET  InsuranceRules/Insurers                       → every insurer's settings, the estate default `*` among them
//   GET  InsuranceRules/Insurers/{payer}/Settings      → the row; 404 INSURER_SETTINGS_NOT_FOUND
//   PUT  InsuranceRules/Insurers/{payer}/Settings      → the saved row (creates it); 400 INSURER_SETTINGS_BAD_REQUEST
//                                                        one error per problem; a log row { changeId, changedBy,
//                                                        changedAt, note, before, after }
//   GET  InsuranceRules/Insurers/{payer}/Settings/Log  → newest first
//   GET / PUT InsuranceRules/{Categories|Coverage}/Draft → the draft { revision, state, …, document } (stale `revision`
//        → 409 GUARDS_DRAFT_STALE, while pending → 409 GUARDS_DRAFT_PENDING), POST …/Validate, …/Submit { revision,
//        note }, …/Approve { revision, note } → the version (publishes LIVE; 403 GUARDS_SELF_APPROVAL), …/SendBack
//        { note }, GET …/Versions, POST …/Versions/{v}/Restore (409 GUARDS_DRAFT_EXISTS over a draft)
//   POST InsuranceRules/Categories/Simulate { request } → { version, lines } (`categorySimulateStub`, for 612's drive)
// Anything else falls through to 610's `insuranceListsStub` on `state.lists` (Fields, patient / policy lists, the
// guard draft), then to null. `opts.deny` door names: insurers · settings · saveSettings · log · categories ·
// coverage · saveCategories · saveCoverage · validateCategories · validateCoverage (and 610's). `opts.user` is the
// session's user id; `opts.viewer.approver` stands in for the approver grant (06).

/** Fields 617's rules read beside 610's FIELDS (which keep their own counts): request, patient, item and eligibility facts. */
export const COVERAGE_FIELDS = [
  { key: 'payer', label: says('Insurer', 'شركة التأمين'), scope: 'request', type: 'text', unit: '', source: 'Request', retired: false },
  { key: 'policy', label: says('Policy', 'الوثيقة'), scope: 'request', type: 'text', unit: '', source: 'Request', retired: false },
  { key: 'class', label: says('Policy class', 'فئة الوثيقة'), scope: 'request', type: 'text', unit: '', source: 'Request', retired: false },
  { key: 'qty', label: says('Quantity', 'الكمية'), scope: 'request', type: 'number', unit: 'units', source: 'Request line', retired: false },
  { key: 'price', label: says('Line price', 'سعر السطر'), scope: 'request', type: 'number', unit: 'SAR', source: 'Request line', retired: false },
  { key: 'gender', label: says('Gender', 'الجنس'), scope: 'patient', type: 'text', unit: '', source: 'Patient profile', retired: false },
  { key: 'ItemCode', label: says('Item code', 'رمز الصنف'), scope: 'item', type: 'text', unit: '', source: 'ItemInfo.ItemCode', retired: false },
  { key: 'coverage.class', label: says('Coverage class', 'فئة التغطية'), scope: 'eligibility', type: 'text', unit: '', source: 'Nphies eligibility answer', retired: false },
  { key: 'benefit.dayBenefit', label: says('Day benefit', 'منفعة اليوم'), scope: 'eligibility', type: 'number', unit: 'SAR', source: 'Nphies eligibility answer', retired: false },
  { key: 'benefit.genericCopayPct', label: says('Generic copay', 'تحمّل الجنيس'), scope: 'eligibility', type: 'number', unit: '%', source: 'Nphies eligibility answer', retired: false },
]

export const POLICY_LIST_SASREF = 'PO-SASREF'

/** The insurers' SAP customer ids (BUPA / TAWUNIYA / MEDGULF) are declared in section 610, which names them first. */

const settingsRow = (payer, over) => ({
  payer,
  hasFixedDiscount: false,
  fixedDiscountPct: 0,
  receivableCustomer: null,
  createsInsuranceCoupon: false,
  memberId: { minLength: 0, maxLength: 0, pattern: null },
  daysSupply: { min: 0, max: 0, default: 0 },
  directDispense: false,
  fullQuantityReturnsOnly: false,
  brandMaxWhenZero: false,
  benefitCategories: [],
  payerPins: [],
  updatedBy: 'ins.huda',
  updatedAt: '2026-10-20T09:30:00',
  ...over,
})

export const INSURER_SETTINGS = {
  '*': settingsRow('*', {
    memberId: { minLength: 6, maxLength: 20, pattern: null },
    daysSupply: { min: 1, max: 90, default: 30 },
    benefitCategories: [
      { source: 'benefit', code: '66', meaning: 'genericCopay' },
      { source: 'benefit', code: '57', meaning: 'brandCopay' },
      { source: 'benefit', code: '13', meaning: 'dayBenefit' },
    ],
  }),
  [BUPA]: settingsRow(BUPA, {
    hasFixedDiscount: true,
    fixedDiscountPct: 15,
    receivableCustomer: BUPA,
    memberId: { minLength: 8, maxLength: 8, pattern: '^\\d{8}$' },
    daysSupply: { min: 1, max: 180, default: 30 },
    directDispense: true,
    benefitCategories: [
      { source: 'benefit', code: '66', meaning: 'genericCopay' },
      { source: 'benefit', code: '57', meaning: 'brandCopay' },
      { source: 'tob', code: 'maxcopay', meaning: 'nonMedCopayMax' },
    ],
    payerPins: ['Vitality'],
  }),
  [TAWUNIYA]: settingsRow(TAWUNIYA, { hasFixedDiscount: true, fixedDiscountPct: 9.5, receivableCustomer: TAWUNIYA, memberId: { minLength: 15, maxLength: 15, pattern: null } }),
  [MEDGULF]: settingsRow(MEDGULF, {}),
}

export const SETTINGS_LOG = {
  [BUPA]: [
    {
      changeId: 41,
      changedBy: 'ins.huda',
      changedAt: '2026-10-20T09:30:00',
      note: 'Contract 2026',
      before: { ...INSURER_SETTINGS[BUPA], fixedDiscountPct: 14 },
      after: INSURER_SETTINGS[BUPA],
    },
  ],
}

const fact = (path, value, op = 'anyOf') => ({ check: 'fact', path, op, value })
const covRule = (id, en, ar, folder, state, when, then) => ({ id, name: says(en, ar), folder, state, when, then })

export const CATEGORY_RULESET = {
  schema: 1,
  kind: 'category',
  revision: 4,
  rules: [
    covRule('K-002', 'Tawuniya: Example Pharma statins are Generic', 'التعاونية: أدوية الستاتين من Example Pharma جنيسة', 'Tawuniya contract', 'live',
      [fact('$request.payer', [TAWUNIYA]), fact('$item.ATC', ['C10AA'])], [{ effect: 'setCategory', group: 'G1' }]),
  ],
}

export const COVERAGE_RULESET = {
  schema: 1,
  kind: 'coverage',
  revision: 7,
  rules: [
    covRule('C-002', 'Bupa: cosmetics not covered', 'بوبا: مستحضرات التجميل غير مغطاة', 'Bupa contract', 'live',
      [fact('$request.payer', [BUPA]), fact('$item.DosageForm', ['COSM'])], [{ effect: 'covered', value: false, overridesPayer: true }]),
    covRule('C-003', 'MedGulf class C: 20% capped at SAR 50', 'ميدغلف الفئة C: 20% بحد أقصى 50 ريال', 'MedGulf contract', 'live',
      [fact('$request.payer', [MEDGULF]), fact('$request.class', ['C'])], [{ effect: 'deductible', percent: 20, max: 50 }]),
  ],
}

/** K-001 "Bupa: Glucophage XR is Brand" as 617's drive builds it (under the next free id). */
export const K_001 = {
  name: says('Bupa: Glucophage XR is Brand', 'بوبا: جلوكوفاج إكس آر علامة تجارية'),
  folder: 'Bupa contract',
  when: [fact('$request.payer', [BUPA]), fact('$item.ItemCode', ['100245'])],
  then: [{ effect: 'setCategory', group: 'G2' }],
}

/** "No deductible for these policies" (the prototype's SASREF branch, POSController.cs:6146) as the drive builds it. */
export const NO_DEDUCTIBLE = {
  name: says('SASREF: no deductible for these policies', 'ساسرف: لا تحمّل لهذه الوثائق'),
  folder: 'Bupa contract',
  when: [{ check: 'request', field: 'policy', inList: POLICY_LIST_SASREF }],
  then: [{ effect: 'deductible', percent: 0, overridesPayer: true }],
}

const draftMeta = (over = {}) => ({ state: 'editing', origin: null, baseVersionNo: 1, updatedBy: 'ins.huda', updatedAt: '2026-10-26T15:00:00', requestedBy: null, requestedAt: null, requestNote: null, reviewedBy: null, reviewNote: null, ...over })

/** A drive's state: 610's lists state with 617's fields and the SASREF policy list, and 617's own documents. */
export function newCoverageState() {
  const copy = (x) => JSON.parse(JSON.stringify(x))
  const lists = newListsState()
  lists.fields.push(...copy(COVERAGE_FIELDS))
  lists.lists.policy.push({ id: POLICY_LIST_SASREF, name: says('SASREF policies', 'وثائق ساسرف'), entries: 1 })
  return {
    lists,
    settings: lists.settings,
    log: copy(SETTINGS_LOG),
    nextChange: 42,
    categories: copy(CATEGORY_RULESET),
    coverage: copy(COVERAGE_RULESET),
    meta: { categories: draftMeta(), coverage: draftMeta() },
    versions: {
      categories: [{ versionNo: 1, publishedAt: '2026-10-01T09:00:00', publishedBy: 'rev.salem', requestedBy: 'ins.huda', action: 'approve', note: 'First contract rules' }],
      coverage: [{ versionNo: 1, publishedAt: '2026-10-01T09:00:00', publishedBy: 'rev.salem', requestedBy: 'ins.huda', action: 'approve', note: 'Seeded C-ELITE, C-SABIC, C-ARAMCO, C-EXCEPTION' }],
    },
    versionDocs: { categories: { 1: copy(CATEGORY_RULESET) }, coverage: { 1: copy(COVERAGE_RULESET) } },
    writes: [],
  }
}

/** HQ's settings checks as the stub reads them: one error per problem (3144). */
function settingsErrors(s) {
  const out = []
  if (!(s?.fixedDiscountPct >= 0 && s?.fixedDiscountPct <= 100)) out.push('fixedDiscountPct must be between 0 and 100.')
  const ds = s?.daysSupply ?? {}
  if (ds.min > 0 && ds.max > 0 && ds.min > ds.max) out.push('daysSupply.min must not exceed daysSupply.max.')
  return out
}

const isLine = (c) => (c.check === 'group' ? c.conditions.some(isLine) : ['line', 'sfda', 'formulary'].includes(c.check) || (c.check === 'fact' && /^\$(item|line)\./.test(c.path)))

/** HQ's checks of a category / coverage draft, as the stub reads them: names, no condition, one effect, an invoice rule on a line, a range. */
export function validateRuleset(doc) {
  const out = []
  for (const r of doc.rules ?? []) {
    if (!r.name?.en?.trim()) out.push(issue(r.id, null, 'name.en', 'The rule needs a name in English.', 'تحتاج القاعدة إلى اسم بالإنجليزية.'))
    if (!r.name?.ar?.trim()) out.push(issue(r.id, null, 'name.ar', 'The rule needs a name in Arabic.', 'تحتاج القاعدة إلى اسم بالعربية.'))
    if (!(r.when ?? []).length) out.push(issue(r.id, null, 'when', 'The rule has no condition: it matches every line.', 'لا شرط في القاعدة: تنطبق على كل سطر.', 'warning'))
    const then = r.then ?? []
    if (then.length !== 1) out.push(issue(r.id, 'then', 'then', 'A rule sets exactly one effect.', 'تحدد القاعدة أثراً واحداً بالضبط.'))
    then.forEach((e, i) => {
      if (e.effect === 'deductible' && e.percent !== undefined && !(e.percent >= 0 && e.percent <= 100)) out.push(issue(r.id, `then[${i}]`, 'percent', 'The deductible is between 0 and 100 %.', 'نسبة التحمّل بين 0 و100 %.'))
      if (['segment', 'exceptionPrescriptions'].includes(e.effect) && (r.when ?? []).some(isLine)) out.push(issue(r.id, `then[${i}]`, 'effect', 'An invoice effect cannot read a line block.', 'أثر الفاتورة لا يقرأ كتلة سطر.'))
    })
  }
  return out
}

/** 617's doors on a drive's `state`; anything else to 610's lists stub on `state.lists`; null when neither. */
export function coverageStub(method, path, body, opts = {}) {
  const { state, deny = [], reads = {}, query, user = 'msartawi', viewer = { author: true, approver: false } } = opts
  if (!state || !path.startsWith('InsuranceRules/')) return null
  const p = path.slice('InsuranceRules/'.length)
  const door = (name, fn) => {
    reads[name] = (reads[name] ?? 0) + 1
    if (deny.includes(name)) return { status: 403, body: '' }
    if (method !== 'GET') state.writes.push({ door: name, method, path, body })
    return fn()
  }
  const refuse = (status, errorCode, message) => envelope(null, { status, success: false, message, errorCode })

  // `GET Insurers` falls through to 610's lists stub, which serves `state.lists.settings` (the same object as `state.settings`).
  let m = /^Insurers\/([^/]+)\/Settings(\/Log)?$/.exec(p)
  if (m) {
    const payer = decodeURIComponent(m[1])
    if (m[2]) return method === 'GET' ? door('log', () => envelope(state.log[payer] ?? [])) : null
    if (method === 'GET')
      return door('settings', () => (state.settings[payer] ? envelope(state.settings[payer]) : refuse(404, 'INSURER_SETTINGS_NOT_FOUND', 'No settings for this insurer.')))
    if (method === 'PUT')
      return door('saveSettings', () => {
        const errors = settingsErrors(body)
        if (errors.length)
          return {
            status: 400,
            contentType: 'application/json',
            body: JSON.stringify({ statusCode: 400, success: false, message: errors[0], errors: errors.map((e) => ({ errorCode: 'INSURER_SETTINGS_BAD_REQUEST', errorMessage: e, internalErrorCode: '' })), data: null }),
          }
        const before = state.settings[payer] ?? null
        const after = { ...structuredClone(body), payer, updatedBy: user, updatedAt: localNow() }
        delete after.note
        state.settings[payer] = after
        ;(state.log[payer] ??= []).unshift({ changeId: state.nextChange++, changedBy: user, changedAt: after.updatedAt, note: body?.note ?? null, before, after })
        return envelope(after)
      })
    return null
  }

  m = /^(Categories|Coverage)\/(Draft|Validate|Submit|Approve|SendBack|Versions|Versions\/(\d+)\/Restore)$/.exec(p)
  if (m) {
    const key = m[1] === 'Categories' ? 'categories' : 'coverage'
    const meta = () => state.meta[key]
    const view = () => envelope({ revision: state[key].revision, ...meta(), document: state[key] })
    const what = m[2].startsWith('Versions/') ? 'restore' : m[2]
    if (what === 'Validate') return method === 'POST' ? door(`validate${m[1]}`, () => envelope(validateRuleset(body))) : null
    if (what === 'Draft') {
      if (method === 'GET') return door(key, view)
      if (method !== 'PUT') return null
      return door(`save${m[1]}`, () => {
        if (meta().state === 'pending') return refuse(409, 'GUARDS_DRAFT_PENDING', 'The draft is waiting for approval.')
        if (body?.revision !== state[key].revision) return refuse(409, 'GUARDS_DRAFT_STALE', 'Someone saved the draft since you read it.')
        state[key] = { ...structuredClone(body), revision: state[key].revision + 1 }
        state.meta[key] = { ...meta(), state: 'editing', updatedBy: user, updatedAt: localNow() }
        return view()
      })
    }
    if (what === 'Versions') return method === 'GET' ? door(`versions${m[1]}`, () => envelope(state.versions[key])) : null
    if (method !== 'POST') return null
    if (what === 'restore')
      return door(`restore${m[1]}`, () => {
        if (meta().state !== 'none') return refuse(409, 'GUARDS_DRAFT_EXISTS', 'A draft exists; restore replaces none.')
        const doc = state.versionDocs[key][m[3]]
        if (!doc) return refuse(404, 'GUARDS_NOT_FOUND', 'No such version.')
        state[key] = { ...structuredClone(doc), revision: 1 }
        state.meta[key] = draftMeta({ origin: `restore:${m[3]}`, baseVersionNo: Number(m[3]), updatedBy: user, updatedAt: localNow() })
        return view()
      })
    return door(`${what.toLowerCase()}${m[1]}`, () => {
      if (what === 'Submit') {
        if (!['editing', 'sentBack'].includes(meta().state)) return refuse(409, 'GUARDS_DRAFT_NOT_EDITING', 'There is no draft to submit.')
        state.meta[key] = { ...meta(), state: 'pending', requestedBy: user, requestedAt: localNow(), requestNote: body?.note || null }
        return view()
      }
      if (!viewer.approver) return refuse(403, 'GUARDS_NOT_APPROVER', 'Only an approver approves the draft.')
      if (meta().state !== 'pending') return refuse(409, 'GUARDS_DRAFT_NOT_PENDING', 'The draft is not waiting for approval.')
      const own = [meta().requestedBy, meta().updatedBy].some((u) => u && u.toLowerCase() === user.toLowerCase())
      if (own) return refuse(403, 'GUARDS_SELF_APPROVAL', 'You asked for or last edited this draft; a different user approves it.')
      if (what === 'Approve') {
        // An approved category / coverage document publishes LIVE: every rule live, no shadow, no promote.
        const versionNo = Math.max(0, ...state.versions[key].map((v) => v.versionNo)) + 1
        const published = { ...structuredClone(state[key]), rules: state[key].rules.map((r) => ({ ...r, state: r.state === 'disabled' ? 'disabled' : 'live' })) }
        state.versionDocs[key][versionNo] = published
        const version = { versionNo, publishedAt: localNow(), publishedBy: user, requestedBy: meta().requestedBy, action: 'approve', note: body?.note || meta().requestNote }
        state.versions[key].unshift(version)
        state[key] = { ...structuredClone(published), revision: 0 }
        state.meta[key] = draftMeta({ state: 'none', baseVersionNo: versionNo, updatedBy: null, updatedAt: null })
        return envelope(version)
      }
      state.meta[key] = { ...meta(), state: 'sentBack', reviewedBy: user, reviewNote: body?.note ?? '' }
      return view()
    })
  }
  return insuranceListsStub(method, path, body, { state: state.lists, query, deny, reads })
}

/**
 * `POST InsuranceRules/Categories/Simulate` (3145) for 612's drive: the stub does not run the category rules; item
 * 200101 is set by K-002 (Generic), an item starting 9 has no category, every other line keeps its default (Brand-IR).
 * `opts.store.categorySimulates` records the bodies; `opts.deny` may name `simulateCategories`.
 */
export function categorySimulateStub(method, path, body, opts = {}) {
  if (method !== 'POST' || path !== 'InsuranceRules/Categories/Simulate') return null
  const { store, deny = [] } = opts
  ;(store ? (store.categorySimulates ??= []) : []).push(body)
  if (deny.includes('simulateCategories')) return { status: 403, body: '' }
  const lines = (body?.request?.lines ?? []).map((l) =>
    l.item === '200101'
      ? { line: l.line, item: l.item, insuranceItemCategory: 'Generic', group: 'G1', source: 'rule', ruleId: 'K-002', version: 1, defaultCategory: 'Brand', unknowns: [] }
      : /^9/.test(l.item)
        ? { line: l.line, item: l.item, insuranceItemCategory: null, group: null, source: 'none', ruleId: null, version: null, defaultCategory: null, unknowns: [] }
        : { line: l.line, item: l.item, insuranceItemCategory: 'Brand-IR', group: 'G2', source: 'default', ruleId: null, version: null, defaultCategory: 'Brand-IR', unknowns: l.item === '100101' ? ['K-002'] : [] },
  )
  return envelope({ version: 1, lines })
}

// --- 612 --- the simulator and the back-test (BackOffice 3140). Both run the guard DRAFT (`RULESET`, revision 12).
// Shapes as BUILT in 3140 (the brief's section): Simulate `{ request: { …, lines: [{ line, … }] }, patientKey,
// document? }` → `{ lines: [{ line, outcome, fired, unknowns, trace }] }`, each rule's trace led by `blockPath:
// "when"`; `POST …/Backtests { days }` → the back-test; `GET …/Backtests` newest first; `GET …/Backtests/{id}`.
// Still 612's guesses (618 reconciles): the trace `value` after the block's NOT, `why` EN + AR, `unknowns` as rule
// ids, `category` (617 re-points it).

/** The stub patient the drive simulates on (a National ID). On no patient list, so G-007's NOT any-group holds. */
export const SIM_PATIENT = '1023456783'

/** The GLP-1 articles of the `glp1` list (ECode E1497 / E1502, `PREVIEW_ITEMS`). */
const GLP1_ARTICLES = ['100101', '100102', '100201']

// 3140 as built: `value` is the TEXT "true" | "false" | "unknown", `why` one plain English line.
const traceOf = (ruleId) => (blockPath, value, why) => ({ ruleId, blockPath, value: String(value), ...(why === undefined ? {} : { why: why && typeof why === 'object' ? why.en : why }) })

/** One simulated line: G-007 (GLP-1 without a diabetes diagnosis) and G-004 (more than 90 days) as HQ would read them. */
function simulateLine(l) {
  const fired = []
  const trace = []
  const g7 = traceOf('G-007')
  const glp1 = GLP1_ARTICLES.includes(l.item)
  if (!glp1) {
    trace.push(g7('when', false), g7('when[0]', false), g7('when[0].conditions[0]', false, says('The item is not in GLP-1 and biologics', 'الصنف ليس في GLP-1 والأدوية الحيوية')))
  } else {
    const diabetes = (l.icd ?? []).some((c) => c.startsWith('E11'))
    trace.push(
      g7('when', !diabetes),
      g7('when[0]', !diabetes),
      g7('when[0].conditions[0]', true),
      g7(
        'when[0].conditions[1]',
        !diabetes,
        diabetes
          ? says('E11 is a listed indication for this item', 'E11 دلالة مدرجة لهذا الصنف')
          : says('No listed indication among the line’s ICD-10-AM codes', 'لا توجد دلالة مدرجة بين رموز ICD-10-AM للبند'),
      ),
    )
    if (!diabetes) {
      trace.push(
        g7('when[0].conditions[2]', true),
        g7('when[0].conditions[2].conditions[0]', false, says('Not on VIP patients', 'ليس في قائمة كبار الشخصيات')),
        g7('when[0].conditions[2].conditions[1]', 'unknown', says('The policy is not known to HQ', 'الوثيقة غير معروفة للإدارة العامة')),
      )
      fired.push({ ruleId: 'G-007', version: 4, severity: 'OVERRIDE', en: 'GLP-1 without a diabetes diagnosis', ar: 'GLP-1 بدون تشخيص سكري', codes: { conflict: 'DC', nphies: 'CV-4-5' }, suggestion: null })
    }
  }
  const g4 = traceOf('G-004')
  const unknowns = []
  if (l.daysSupply === undefined) {
    trace.push(g4('when', 'unknown'), g4('when[0]', 'unknown', says('No days’ supply on the line', 'لا توجد أيام إمداد على البند')))
    unknowns.push('G-004')
  } else if (l.daysSupply > 90) {
    trace.push(g4('when', true), g4('when[0]', true))
    fired.push({ ruleId: 'G-004', version: 4, severity: 'REFUSE', en: `${l.daysSupply} days in one request; the maximum is 90`, ar: `${l.daysSupply} يوماً في طلب واحد؛ الحد الأقصى 90`, codes: { conflict: 'MX', nphies: 'CV-4-2' }, suggestion: { maxDaysSupply: 90 } })
  } else trace.push(g4('when', false), g4('when[0]', false))
  const heaviest = ['REFUSE', 'OVERRIDE', 'WARN'].find((s) => fired.some((f) => f.severity === s))
  // A line's category is Categories/Simulate's (617's `categorySimulateStub`), not the guard Simulate's.
  return { line: l.line, outcome: heaviest ? heaviest.toLowerCase() : 'pass', fired, unknowns, trace }
}

/** `POST InsuranceRules/Guards/Simulate` — deterministic over the request's lines. */
export const simulateGuards = (body) => ({ lines: (body?.request?.lines ?? []).map(simulateLine) })

/** A finished back-test's report over `days` (the fires grow with the window). One key arrives WHOLE: the screen masks it.
 * `stoppedTotal` is beyond the 3 rows sent, as HQ's first-500 cut is on a bigger history. */
export function backtestReport(days, revision = RULESET.revision, id = 'BT-41') {
  const k = days / 30
  return {
    id,
    status: 'done',
    progress: 1,
    revision,
    days,
    requestedBy: 'nalharbi',
    requestedAt: '2026-10-27T10:00:00',
    finishedAt: '2026-10-27T10:03:00',
    error: null,
    since: days === 90 ? '2026-07-29' : days === 180 ? '2026-04-30' : '2026-09-27',
    requests: 1200 * k,
    lines: 3400 * k,
    fires: { refuse: 4 * k, override: 30 * k, warn: 6 * k },
    stopped: [
      { on: '2026-10-26', store: 'P019', item: '100101', maskedKey: '1*******83', sar: 450.5, rules: ['G-007'] },
      { on: '2026-10-25', store: 'P001', item: '100201', maskedKey: '2*******19', sar: 612, rules: ['G-007', 'G-004'] },
      { on: '2026-10-21', store: 'P107', item: '100102', maskedKey: '1198765408', sar: 380.25, rules: ['G-004'] },
    ],
    stoppedTotal: 34 * k,
    sar: 1442.75,
    distinct: { patients: 21 * k, stores: 7, pharmacists: 9 },
    overlap: 12 * k,
    rules: [
      { ruleId: 'G-007', fires: 30 * k, stopped: 30 * k },
      { ruleId: 'G-004', fires: 4 * k, stopped: 4 * k },
      { ruleId: 'G-010', fires: 6 * k, stopped: 0 },
    ],
  }
}

/** The back-test jobs (oldest first) and what was asked of them. A job runs until it has been read once, then is done. */
export const newBacktestStore = () => ({ next: 41, jobs: { 'BT-OLD': { days: 30, reads: 1, revision: 11 } }, starts: [], simulates: [] })

/** A job as HQ answers it: running (40 %) on its first read, done after. */
const jobView = (id, job) => {
  job.reads += 1
  if (job.reads === 1)
    return { ...backtestReport(job.days, job.revision, id), status: 'running', progress: 0.4, finishedAt: null, requests: 0, lines: 0, fires: { refuse: 0, override: 0, warn: 0 }, stopped: [], stoppedTotal: 0, sar: 0, distinct: { patients: 0, stores: 0, pharmacists: 0 }, overlap: 0, rules: [] }
  return backtestReport(job.days, job.revision, id)
}

/**
 * 612's doors. `opts.store` is a `newBacktestStore()`; `opts.deny` names doors (`simulate`, `startBacktest`,
 * `backtest`, `backtests`) answered with a bare 403. Call it before `insuranceRulesStub` (which serves the draft).
 */
export function simulatorStub(method, path, body, opts = {}) {
  const { store = newBacktestStore(), deny = [] } = opts
  if (method === 'POST' && path === 'InsuranceRules/Guards/Simulate') {
    store.simulates.push(body)
    if (deny.includes('simulate')) return { status: 403, body: '' }
    return envelope(simulateGuards(body))
  }
  if (method === 'POST' && path === 'InsuranceRules/Guards/Backtests') {
    store.starts.push(body)
    if (deny.includes('startBacktest')) return { status: 403, body: '' }
    const days = body?.days ?? 90
    const id = `BT-${store.next++}`
    store.jobs[id] = { days, reads: 0, revision: RULESET.revision }
    return envelope({ ...jobView(id, { ...store.jobs[id] }), status: 'queued', progress: 0 })
  }
  if (method === 'GET' && path === 'InsuranceRules/Guards/Backtests') {
    if (deny.includes('backtests')) return { status: 403, body: '' }
    return envelope(Object.entries(store.jobs).reverse().map(([id, job]) => jobView(id, job)))
  }
  const read = method === 'GET' && path.match(/^InsuranceRules\/Guards\/Backtests\/([^/]+)$/)
  if (read) {
    if (deny.includes('backtest')) return { status: 403, body: '' }
    const id = decodeURIComponent(read[1])
    const job = store.jobs[id]
    if (!job) return envelope(null, { status: 404, success: false, message: 'No such back-test.', errorCode: 'GUARDS_NOT_FOUND' })
    return envelope(jobView(id, job))
  }
  return null
}
