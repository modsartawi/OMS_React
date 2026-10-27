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

// --- 608 --- the guard editor's doors: the draft read and saved WHOLE, and HQ's checks of it.
//   GET  InsuranceRules/Guards/Draft    → `opts.store.draft` (a copy of RULESET to start)
//   PUT  InsuranceRules/Guards/Draft    → the saved document, `revision` + 1; a stale `revision` → 409
//                                         `STALE_REVISION` (⚠️ provisional spelling; 3139 owns it)
//   POST InsuranceRules/Guards/Validate → `[{ ruleId, blockPath, field, severity, en, ar }]` (validateGuards)
// `opts.store` is the drive's own `{ draft, puts: [], validates: [] }` (newGuardStore()); without one, 607's
// stateless handler answers. Call `guardEditorStub` first and fall through to `insuranceRulesStub`.

/** A drive's stateful draft: a deep copy of RULESET, and every PUT / Validate body it was sent. */
export const newGuardStore = () => ({ draft: structuredClone(RULESET), puts: [], validates: [] })

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
        } else if (['patient', 'policy', 'line'].includes(c.check) && c.inList === '') {
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
    return envelope(store.draft)
  }
  if (path === 'InsuranceRules/Guards/Draft' && method === 'PUT') {
    count('save')
    store.puts.push(body)
    if (body?.revision !== store.draft.revision)
      return envelope(null, { status: 409, success: false, message: 'Someone saved the draft since you read it.', errorCode: 'STALE_REVISION' })
    store.draft = { ...structuredClone(body), revision: store.draft.revision + 1 }
    return envelope(store.draft)
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
 * names doors (`metrics`, `flags`, `flagSettings`, `rejections`) answered with a bare 403.
 */
export function insuranceMetricsStub(method, path, query, opts = {}) {
  const { deny = [], asked = [] } = opts
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
  if (door === 'flagSettings') return envelope(FLAG_SETTINGS)
  const payer = query.get('payer')
  return envelope(payer ? REJECTIONS.filter((r) => r.payer === payer) : REJECTIONS)
}

// --- 616 --- guards on an OMS order (BackOffice 3142/3143; check doors 3127/3128/3134). Order-door
// spelling is a GUESS fitted to the existing OMS doors: `SdDocumentWeb/Document/{no}/Guards/Recheck|Release`
// (the brief writes `Oms/Orders/{id}/Guards/…`); 618 reconciles.

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
