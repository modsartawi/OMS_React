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
