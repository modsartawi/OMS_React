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

// --- 610 --- Fields registry, field values, list preview, patient and policy lists (BackOffice 3132 + 3133).
// Stateful: a drive makes one state per browser context (`newListsState()`) and passes it as `opts.state`, so an
// added field, a saved draft or an added entry is read back. `opts.query` is the request's URLSearchParams (the
// `Values?q=` and the DELETE `?key=`). Shapes ⚠️ PROVISIONAL where the brief does not spell them (see 610).

/** `GET InsuranceRules/Fields` — every scope, one retired. */
export const FIELDS = [
  { key: 'ECode', label: says('E-code', 'الرمز الإلكتروني'), scope: 'item', type: 'code', unit: null, source: 'ItemInfo.ECode / EDesc', retired: false },
  { key: 'ATC', label: says('ATC class', 'تصنيف ATC'), scope: 'item', type: 'code', unit: null, source: 'ItemInfo.ATC', retired: false },
  { key: 'DosageForm', label: says('Dosage form', 'الشكل الصيدلاني'), scope: 'item', type: 'code', unit: null, source: 'ItemInfo.DosageForm', retired: false },
  { key: 'OldGroup', label: says('Old item group', 'مجموعة الأصناف القديمة'), scope: 'item', type: 'code', unit: null, source: 'ItemInfo.OldGroup', retired: true },
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
  { id: PATIENT_LIST_VIP, name: says('VIP patients', 'مرضى كبار الشخصيات'), entries: 2 },
  { id: 'PL-STAFF', name: says('Staff and family', 'الموظفون وذووهم'), entries: 0 },
]
export const POLICY_LISTS = [{ id: POLICY_LIST_EXTENDED, name: says('Extended cover policies', 'وثائق التغطية الممتدة'), entries: 1 }]

const ENTRIES = {
  [`patient:${PATIENT_LIST_VIP}`]: [
    { key: '1012345678', addedBy: 'nalharbi', reason: 'Board member', expiresOn: null },
    { key: '2087654321', addedBy: 'nalharbi', reason: 'مريض كبار الشخصيات حتى نهاية العام', expiresOn: '2026-12-31' },
  ],
  'patient:PL-STAFF': [],
  [`policy:${POLICY_LIST_EXTENDED}`]: [{ key: 'SUB-778812', addedBy: 'falotaibi', reason: 'Extended cover agreed with Bupa', expiresOn: '2027-03-31' }],
}
const LOG = {
  [`patient:${PATIENT_LIST_VIP}`]: [
    { at: '2026-10-20T10:12:00', by: 'nalharbi', action: 'added', key: '2087654321', reason: 'مريض كبار الشخصيات حتى نهاية العام', expiresOn: '2026-12-31' },
    { at: '2026-10-02T09:00:00', by: 'nalharbi', action: 'removed', key: '1099999999', reason: null, expiresOn: null },
    { at: '2026-09-15T08:30:00', by: 'nalharbi', action: 'added', key: '1012345678', reason: 'Board member', expiresOn: null },
  ],
  'patient:PL-STAFF': [],
  [`policy:${POLICY_LIST_EXTENDED}`]: [{ at: '2026-09-01T12:00:00', by: 'falotaibi', action: 'added', key: 'SUB-778812', reason: 'Extended cover agreed with Bupa', expiresOn: '2027-03-31' }],
}

/** A fresh, mutable copy of 610's fixtures — one per browser context. */
export function newListsState() {
  const copy = (x) => JSON.parse(JSON.stringify(x))
  return { fields: copy(FIELDS), ruleset: copy(RULESET), entries: copy(ENTRIES), log: copy(LOG), lists: { patient: copy(PATIENT_LISTS), policy: copy(POLICY_LISTS) }, writes: [] }
}

const localNow = () => {
  const d = new Date()
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`
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
 * entries · addEntry · removeEntry · log.
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

  if (p === 'Guards/Draft' && method === 'GET') return door('draft', () => envelope(state.ruleset))
  if (p === 'Guards/Draft' && method === 'PUT')
    return door('saveDraft', () => {
      if (body.revision !== state.ruleset.revision) return envelope(null, { status: 409, success: false, message: 'The draft was saved by someone else.', errorCode: 'STALE_REVISION' })
      state.ruleset = { ...body, revision: state.ruleset.revision + 1 }
      return envelope(state.ruleset)
    })

  if (p === 'Fields' && method === 'GET') return door('fields', () => envelope(state.fields))
  if (p === 'Fields' && method === 'POST')
    return door('addField', () => {
      if (state.fields.some((f) => f.key.toLowerCase() === String(body.key).toLowerCase()))
        return envelope(null, { status: 409, success: false, message: 'A field has this key.', errorCode: 'KEY_TAKEN' })
      const f = { ...body, retired: false }
      state.fields.push(f)
      return envelope(f)
    })
  let m = /^Fields\/([^/]+)\/Retire$/.exec(p)
  if (m && method === 'POST')
    return door('retire', () => {
      const f = state.fields.find((x) => x.key === decodeURIComponent(m[1]))
      if (f) f.retired = true
      return envelope(null)
    })
  m = /^Fields\/([^/]+)\/Values$/.exec(p)
  if (m && method === 'GET')
    return door('values', () => {
      const q = (query.get('q') ?? '').toLowerCase()
      return envelope((FIELD_VALUES[decodeURIComponent(m[1])] ?? []).filter((v) => !q || v.code.toLowerCase().includes(q) || v.description.toLowerCase().includes(q)))
    })

  if (p === 'Lists/Preview' && method === 'POST')
    return door('preview', () => {
      const items = matchItems(body.list, [...body.lists, body.list])
      return envelope({ count: items.length, items: items.slice(0, pageSize).map(({ article, name }) => ({ article, name })), matchesNothing: items.length === 0 })
    })

  m = /^(PatientLists|PolicyLists)(?:\/([^/]+)\/(Entries|Log))?$/.exec(p)
  if (!m) return null
  const kind = m[1] === 'PatientLists' ? 'patient' : 'policy'
  if (!m[2]) return method === 'GET' ? door('keyedLists', () => envelope(state.lists[kind])) : null
  const id = decodeURIComponent(m[2])
  const k = `${kind}:${id}`
  const meta = state.lists[kind].find((l) => l.id === id)
  const recount = () => meta && (meta.entries = state.entries[k].length)
  if (m[3] === 'Log') return method === 'GET' ? door('log', () => envelope(state.log[k] ?? [])) : null
  if (method === 'GET') return door('entries', () => envelope(state.entries[k] ?? []))
  if (method === 'POST')
    return door('addEntry', () => {
      const entry = { key: body.key, addedBy: 'msartawi', reason: body.reason, expiresOn: body.expiresOn ?? null }
      ;(state.entries[k] ??= []).unshift(entry)
      ;(state.log[k] ??= []).unshift({ at: localNow(), by: 'msartawi', action: 'added', key: entry.key, reason: entry.reason, expiresOn: entry.expiresOn })
      recount()
      return envelope(entry)
    })
  if (method === 'DELETE')
    return door('removeEntry', () => {
      const key = query.get('key')
      state.entries[k] = (state.entries[k] ?? []).filter((e) => e.key !== key)
      ;(state.log[k] ??= []).unshift({ at: localNow(), by: 'msartawi', action: 'removed', key, reason: null, expiresOn: null })
      recount()
      return envelope(null)
    })
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

// --- 613 --- reference editions (BackOffice 3138): the SFDA Human Drug List and the CHI Drug Formulary.
// Shapes beyond the brief's are GUESSES recorded on ticket 613 (618 reconciles): the history row
// (`id, list, fileName, rows, uploadedBy, uploadedAt, state: pending|live|retired, publishedBy, publishedAt`),
// `added / dropped / changed` as counts and `newlyUnmatched` as rows `{ item, itemName, sfdaCode }`,
// `backtestFires` one number, the gap row `{ kind: noMatch|junk|gtinMismatch|withdrawn, item, itemName,
// sfdaCode, gtin, detail }`, the export door `GET …/Editions/{id}/Gaps/Export` (an .xlsx), and the
// uploader's refusal code `UPLOADER_CANNOT_PUBLISH`. Its own handler, `editionsStub`, so 607's stays untouched.

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
  if (method === 'GET' && base === 'InsuranceRules/Editions') return hit('editions', st.editions.filter((e) => !list || e.list === list))
  if (method === 'POST' && base === 'InsuranceRules/Editions') {
    if (deny.includes('upload')) return { status: 403, body: '' }
    const u = upload ?? { list: 'sfda', fileName: UPLOADED_FILE_NAME }
    st.editions = st.editions.filter((e) => e.id !== UPLOADED_EDITION_ID)
    st.editions.unshift(edition(UPLOADED_EDITION_ID, u.list, u.fileName, 9439, user, now, 'pending'))
    return envelope({ id: UPLOADED_EDITION_ID })
  }
  const m = /^InsuranceRules\/Editions\/([^/]+)\/(Diff|Gaps|Gaps\/Export|Publish)$/.exec(base)
  if (!m) return null
  const id = decodeURIComponent(m[1])
  if (method === 'GET' && m[2] === 'Diff') return hit('diff', EDITION_DIFFS[id] ?? null)
  if (method === 'GET' && m[2] === 'Gaps') return hit('gaps', EDITION_GAPS[id] ?? [])
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
    if (!ed) return envelope(null, { status: 404, success: false, message: 'No edition has this id.', errorCode: 'NOT_FOUND' })
    if (ed.uploadedBy.toLowerCase() === user.toLowerCase())
      return envelope(null, { status: 409, success: false, message: 'The user who uploaded an edition cannot publish it.', errorCode: 'UPLOADER_CANNOT_PUBLISH' })
    for (const e of st.editions) if (e.list === ed.list && e.state === 'live') e.state = 'retired'
    Object.assign(ed, { state: 'live', publishedBy: user, publishedAt: now })
    return envelope(ed)
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

// --- 611 --- approval by role, shadow promotion, versions (BackOffice 3139; the latest back-test 3140).
//   GET  InsuranceRules/Guards/Approval            → where the draft stands + the viewer's roles (⚠️ guessed door)
//   GET  InsuranceRules/Guards/Backtests/{id}      → `store.backtests[id]` for the id the Approval read names (the
//                                                    draft's latest, ⚠️ guessed `backtestId`); 612's door and shape
//   POST InsuranceRules/Guards/Submit { note }     → refused 409 BACKTEST_REQUIRED without a done back-test of
//                                                    this revision; draft rules turn waiting
//   POST InsuranceRules/Guards/Approve { note }    → approver only (403 NOT_APPROVER), never the author (409
//                                                    OWN_SUBMISSION); waiting rules turn shadow today; a version
//   POST InsuranceRules/Guards/SendBack { note }   → the same refusals; waiting rules back to draft
//   POST InsuranceRules/Guards/Rules/{id}/Promote  → `{ skipReason? }`; refused 409 SHADOW_TOO_SHORT under 14 local
//                                                    days without a reason; the rule turns live
//   GET  InsuranceRules/Guards/Versions            → newest first; POST …/Versions/{v}/Restore → a NEW draft
//   GET / PUT Draft, POST Validate                 → on `store.draft` (608's `validateGuards`)
// Error codes are ⚠️ guessed spellings (3139 owns them). Never a live SIS.Api.

/** The published versions, newest first: who, when, note. */
export const GUARD_VERSIONS = [
  { version: 4, by: 'falotaibi', at: '2026-10-20T11:15:00', note: 'SFDA not-marketed guard into shadow.' },
  { version: 3, by: 'falotaibi', at: '2026-10-15T09:30:00', note: 'أقلام GLP-1 كل 28 يوماً في وضع الظل' },
  { version: 2, by: 'malqahtani', at: '2026-09-02T16:45:00', note: null },
]

/** What each version held: version 3 had neither of the draft rules (G-006, G-011) nor G-008. */
const VERSION_DOCS = {
  4: { ...RULESET, revision: 10, rules: RULES.filter((r) => !['G-006', 'G-011'].includes(r.id)) },
  3: { ...RULESET, revision: 8, rules: RULES.filter((r) => !['G-006', 'G-008', 'G-011'].includes(r.id)) },
  2: { ...RULESET, revision: 5, rules: RULES.filter((r) => ['G-001', 'G-002', 'G-004', 'G-010'].includes(r.id)) },
}

/** The draft's back-test of revision 12 (RULESET's), done — 612's report over 30 days. */
export const BACKTEST_DONE_ID = 'BT-40'
const backtestDone = () => ({ status: 'done', progress: 1, revision: 12, fires: { refuse: 4, override: 30, warn: 6 }, stopped: [], sar: 1442.75, distinct: { patients: 21, stores: 7, pharmacists: 9 }, overlap: 12 })
export const BACKTEST_DONE = backtestDone()

/** One HQ for a drive: the draft, its approval, the latest back-test, the versions, every write. */
/** `backtest`: the draft's latest back-test (612's shape) under `BACKTEST_DONE_ID`, or null for none. */
export function newApprovalStore({ backtest = BACKTEST_DONE } = {}) {
  return {
    draft: structuredClone(RULESET),
    approval: { state: 'draft', submittedBy: null, submittedAt: null, note: null, sentBack: null, backtestId: backtest ? BACKTEST_DONE_ID : null },
    backtests: backtest ? { [BACKTEST_DONE_ID]: structuredClone(backtest) } : {},
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
 * 611's doors on a drive's `store` (newApprovalStore()). `opts.user` is the session's user id, `opts.viewer` its
 * roles `{ author, approver }`, `opts.now` the local moment HQ stamps. Null when not one of these.
 */
export function approvalStub(method, path, body, opts = {}) {
  const { store, user = 'nalharbi', viewer = { author: true, approver: false }, now = '2026-10-27T10:30:00', deny = [] } = opts
  if (!store) return null
  const refuse = (status, errorCode, message) => envelope(null, { status, success: false, message, errorCode })
  const view = () => ({ ...store.approval, revision: store.draft.revision, viewer })
  const write = () => store.writes.push({ method, path, body, user })
  const G = 'InsuranceRules/Guards'
  const setStates = (from, to, extra = {}) => {
    store.draft.rules = store.draft.rules.map((r) => (r.state === from ? { ...r, state: to, ...extra } : r))
  }
  if (deny.includes(path)) return { status: 403, body: '' }

  if (method === 'GET' && path === `${G}/Draft`) return envelope(store.draft)
  if (method === 'PUT' && path === `${G}/Draft`) {
    write()
    if (body?.revision !== store.draft.revision) return refuse(409, 'STALE_REVISION', 'Someone saved the draft since you read it.')
    store.draft = { ...structuredClone(body), revision: store.draft.revision + 1 }
    return envelope(store.draft)
  }
  if (method === 'POST' && path === `${G}/Validate`) return envelope(validateGuards(body ?? store.draft))
  if (method === 'GET' && path === `${G}/Approval`) return envelope(view())
  const btRead = method === 'GET' && path.match(/^InsuranceRules\/Guards\/Backtests\/([^/]+)$/)
  if (btRead && store.backtests[decodeURIComponent(btRead[1])]) return envelope(store.backtests[decodeURIComponent(btRead[1])])
  if (method === 'GET' && path === `${G}/Versions`) return envelope(store.versions)

  if (method === 'POST' && path === `${G}/Submit`) {
    write()
    const bt = store.backtests[store.approval.backtestId]
    if (!bt || bt.status !== 'done' || bt.revision !== store.draft.revision)
      return refuse(409, 'BACKTEST_REQUIRED', 'Run a back-test of this revision before asking for approval.')
    if (store.approval.state !== 'draft') return refuse(409, 'NOT_DRAFT', 'The draft is already waiting for approval.')
    store.approval = { ...store.approval, state: 'waiting', submittedBy: user, submittedAt: now, note: body?.note || null, sentBack: null }
    setStates('draft', 'waiting')
    return envelope(view())
  }
  if (method === 'POST' && (path === `${G}/Approve` || path === `${G}/SendBack`)) {
    write()
    if (!viewer.approver) return refuse(403, 'NOT_APPROVER', 'Only an approver approves the guard draft.')
    if (store.approval.state !== 'waiting') return refuse(409, 'NOT_WAITING', 'The draft is not waiting for approval.')
    if (user.toLowerCase() === (store.approval.submittedBy ?? '').toLowerCase())
      return refuse(409, 'OWN_SUBMISSION', 'You asked for this approval; a different user approves it.')
    if (path.endsWith('/Approve')) {
      setStates('waiting', 'shadow', { shadowSince: now.slice(0, 10) })
      const version = Math.max(0, ...store.versions.map((v) => v.version)) + 1
      store.versionDocs[version] = structuredClone(store.draft)
      store.versions.unshift({ version, by: user, at: now, note: body?.note || store.approval.note })
      store.approval = { ...store.approval, state: 'draft', submittedBy: null, submittedAt: null, note: null, sentBack: null }
    } else {
      setStates('waiting', 'draft')
      store.approval = { ...store.approval, state: 'draft', submittedBy: null, submittedAt: null, note: null, sentBack: { by: user, at: now, note: body?.note ?? '' } }
    }
    return envelope(view())
  }
  const promote = method === 'POST' && path.match(/^InsuranceRules\/Guards\/Rules\/([^/]+)\/Promote$/)
  if (promote) {
    write()
    const id = decodeURIComponent(promote[1])
    const rule = store.draft.rules.find((r) => r.id === id)
    if (!viewer.approver) return refuse(403, 'NOT_APPROVER', 'Only an approver promotes a shadow rule.')
    if (!rule || rule.state !== 'shadow') return refuse(409, 'NOT_SHADOW', 'This rule is not in shadow.')
    if ((!rule.shadowSince || localDays(rule.shadowSince, now) < 14) && !body?.skipReason?.trim())
      return refuse(409, 'SHADOW_TOO_SHORT', 'Under 14 days in shadow: give a reason to skip the rest.')
    store.draft.rules = store.draft.rules.map((r) => (r.id === id ? { ...r, state: 'live', shadowSince: null } : r))
    return envelope({ ruleId: id, state: 'live' })
  }
  const restore = method === 'POST' && path.match(/^InsuranceRules\/Guards\/Versions\/(\d+)\/Restore$/)
  if (restore) {
    write()
    const doc = store.versionDocs[restore[1]]
    if (!doc) return refuse(404, 'NO_VERSION', 'No such version.')
    store.draft = { ...structuredClone(doc), revision: store.draft.revision + 1 }
    store.approval = { ...store.approval, state: 'draft', submittedBy: null, submittedAt: null, note: null, sentBack: null }
    return envelope(store.draft)
  }
  return null
}

// --- 609 --- guard templates and folders (BackOffice 3139). ⚠️ Shapes beyond the brief are 609's guesses
// (`src/core/insurance-rules/templates.ts`), 618 reconciles:
//   GET  InsuranceRules/Guards                      → rows from `state.store.draft` (moves and new rules show)
//   GET  InsuranceRules/Guards/Folders              → every folder path (kept empty ones + the rules'), sorted
//   POST InsuranceRules/Guards/Folders              → body `{ path }`; a taken path → 409 FOLDER_EXISTS
//   PUT  InsuranceRules/Guards/Folders              → `{ from, to }` renames a folder (its rules and sub-folders
//                                                     follow); `{ rules: [id], to }` moves rules. No approval.
//   GET  InsuranceRules/Guards/Templates            → phase-1 (3093, with conflict code) + team templates
//   POST InsuranceRules/Guards/Templates            → body `{ ruleId, name, blanks: [path] }` → the template
//   POST InsuranceRules/Guards/Templates/{id}/Create → body `{ values: { [path]: value }, folder }` → the new
//                                                     draft rule (HQ mints `G-nnn`, adds it to the draft)
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
const tpl = (id, en, ar, conflictCode, rule, blanks) => ({ id, source: 'phase1', name: says(en, ar), conflictCode, rule: tplRule(rule), blanks: [NAME_BLANK, ...blanks] })
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
    const activity = Object.fromEntries(GUARD_ROWS.map((r) => [r.id, r]))
    return envelope(
      state.store.draft.rules.map((r) => ({
        id: r.id,
        name: r.name,
        folder: r.folder,
        state: r.state,
        severity: severityOf(r) ?? 'WARN',
        lastFired: activity[r.id]?.lastFired ?? null,
        flags: activity[r.id]?.flags ?? [],
      })),
    )
  }
  if (path === 'InsuranceRules/Guards/Folders') {
    if (denied(`folders.${method}`)) return { status: 403, body: '' }
    if (method === 'POST') {
      write('folders.create')
      const p = segs(body?.path).join('/')
      if (!p) return fail(400, 'A folder needs a name.', 'FOLDER_NAME')
      if (allFolders(state).some((f) => f.toLowerCase() === p.toLowerCase())) return fail(409, 'That folder already exists.', 'FOLDER_EXISTS')
      state.folders.push(p)
    } else if (method === 'PUT' && Array.isArray(body?.rules)) {
      write('folders.move')
      const to = segs(body.to).join('/')
      state.store.draft = { ...state.store.draft, rules: state.store.draft.rules.map((r) => (body.rules.includes(r.id) ? { ...r, folder: to } : r)) }
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
    return envelope(allFolders(state))
  }
  if (method === 'GET' && path === 'InsuranceRules/Guards/Templates') {
    if (denied('templates')) return { status: 403, body: '' }
    return envelope(state.templates)
  }
  if (method === 'POST' && path === 'InsuranceRules/Guards/Templates') {
    if (denied('templates.save')) return { status: 403, body: '' }
    write('templates.save')
    const r = state.store.draft.rules.find((x) => x.id === body?.ruleId)
    if (!r) return fail(404, 'No rule has this id.', 'NOT_FOUND')
    if (!body?.name?.en?.trim() || !body?.name?.ar?.trim()) return fail(400, 'The template needs a name in English and Arabic.', 'TEMPLATE_NAME')
    const rule = { ...structuredClone(r), id: '', state: 'draft' }
    delete rule.shadowSince
    // A text or message blank starts empty (the author fills it); a number keeps the rule's as its default.
    for (const p of body.blanks ?? []) setPath(rule, p, emptyOf(getPath(rule, p)))
    const t = {
      id: `TT-${state.templates.length + 1}`,
      source: 'team',
      name: body.name,
      conflictCode: r.then[0]?.codes?.conflict ?? null,
      rule,
      blanks: (body.blanks ?? []).map((p) => ({ path: p, label: null })),
      createdBy: user,
      createdAt: now,
    }
    state.templates.push(t)
    return envelope(t)
  }
  const create = method === 'POST' && path.match(/^InsuranceRules\/Guards\/Templates\/([^/]+)\/Create$/)
  if (create) {
    if (denied('templates.create')) return { status: 403, body: '' }
    write('templates.create')
    const t = state.templates.find((x) => x.id === decodeURIComponent(create[1]))
    if (!t) return fail(404, 'No template has this id.', 'NOT_FOUND')
    const rule = structuredClone(t.rule)
    for (const b of t.blanks) if (b.path in (body?.values ?? {})) setPath(rule, b.path, structuredClone(body.values[b.path]))
    const created = { ...rule, id: nextRuleId(state.store.draft.rules), folder: body?.folder ?? rule.folder, state: 'draft' }
    delete created.shadowSince
    state.store.draft = { ...state.store.draft, rules: [...state.store.draft.rules, created] }
    bump()
    return envelope(created)
  }
  return guardEditorStub(method, path, body, { store: state.store, deny, reads })
}

// --- 617 --- insurer settings (BackOffice 3144), the category and coverage rulesets (3145 / 3146), and the
// eligibility facts the Fields registry offers every palette. Shapes ⚠️ PROVISIONAL where the brief does not spell
// them (see ticket 617's comments). Stateful: one `newCoverageState()` per browser context, passed as `opts.state`.
//   GET  InsuranceRules/Insurers                       → INSURERS
//   GET  InsuranceRules/Insurers/{payer}/Settings      → the insurer's settings
//   PUT  InsuranceRules/Insurers/{payer}/Settings      → the saved settings; a log row of what changed
//   GET  InsuranceRules/Insurers/{payer}/Settings/Log  → newest first
//   GET / PUT InsuranceRules/{Categories|Coverage}/Draft (stale `revision` → 409 STALE_REVISION), POST …/Validate
// Anything else falls through to 610's `insuranceListsStub` on `state.lists` (Fields, patient / policy lists, the
// guard draft), then to null. `opts.deny` door names: insurers · settings · saveSettings · log · categories ·
// coverage · saveCategories · saveCoverage · validateCategories · validateCoverage (and 610's).

/** Fields 617's rules read beside 610's FIELDS (which keep their own counts): request, patient, item and eligibility facts. */
export const COVERAGE_FIELDS = [
  { key: 'payer', label: says('Insurer', 'شركة التأمين'), scope: 'request', type: 'code', unit: null, source: 'Request', retired: false },
  { key: 'policy', label: says('Policy', 'الوثيقة'), scope: 'request', type: 'code', unit: null, source: 'Request', retired: false },
  { key: 'class', label: says('Policy class', 'فئة الوثيقة'), scope: 'request', type: 'code', unit: null, source: 'Request', retired: false },
  { key: 'qty', label: says('Quantity', 'الكمية'), scope: 'request', type: 'number', unit: 'units', source: 'Request line', retired: false },
  { key: 'price', label: says('Line price', 'سعر السطر'), scope: 'request', type: 'number', unit: 'SAR', source: 'Request line', retired: false },
  { key: 'gender', label: says('Gender', 'الجنس'), scope: 'patient', type: 'code', unit: null, source: 'Patient profile', retired: false },
  { key: 'ItemCode', label: says('Item code', 'رمز الصنف'), scope: 'item', type: 'code', unit: null, source: 'ItemInfo.ItemCode', retired: false },
  { key: 'coverage.class', label: says('Coverage class', 'فئة التغطية'), scope: 'eligibility', type: 'code', unit: null, source: 'Nphies eligibility answer', retired: false },
  { key: 'benefit.dayBenefit', label: says('Day benefit', 'منفعة اليوم'), scope: 'eligibility', type: 'number', unit: 'SAR', source: 'Nphies eligibility answer', retired: false },
  { key: 'benefit.genericCopayPct', label: says('Generic copay', 'تحمّل الجنيس'), scope: 'eligibility', type: 'number', unit: '%', source: 'Nphies eligibility answer', retired: false },
]

export const POLICY_LIST_SASREF = 'PO-SASREF'

export const INSURERS = [
  { payer: 'BUPA', name: says('Bupa Arabia', 'بوبا العربية') },
  { payer: 'TAWUNIYA', name: says('Tawuniya', 'التعاونية') },
  { payer: 'MEDGULF', name: says('MedGulf', 'ميدغلف') },
]

export const INSURER_SETTINGS = {
  BUPA: {
    payer: 'BUPA',
    fixedDiscountPct: 15,
    receivableCustomer: '1000123',
    memberId: { length: 8, format: '^\\d{8}$' },
    benefitCategories: [
      { code: '66', meaning: 'genericCopay' },
      { code: '57', meaning: 'brandCopay' },
      { code: '13', meaning: 'dayBenefit' },
    ],
    daysSupply: { min: 1, max: 180 },
    directDispense: { allowed: true, defaultDayBenefit: 500 },
    payerPins: [{ documentType: 'ZINV', payer: 'BUPA-01' }],
  },
  TAWUNIYA: {
    payer: 'TAWUNIYA',
    fixedDiscountPct: 9.5,
    receivableCustomer: '1000456',
    memberId: { length: 15, format: null },
    benefitCategories: [{ code: '66', meaning: 'genericCopay' }],
    daysSupply: { min: 1, max: 100 },
    directDispense: { allowed: false, defaultDayBenefit: null },
    payerPins: [],
  },
  MEDGULF: {
    payer: 'MEDGULF',
    fixedDiscountPct: null,
    receivableCustomer: null,
    memberId: { length: null, format: null },
    benefitCategories: [],
    daysSupply: { min: null, max: null },
    directDispense: { allowed: false, defaultDayBenefit: null },
    payerPins: [],
  },
}

export const SETTINGS_LOG = {
  BUPA: [{ at: '2026-10-20T09:30:00', by: 'ins.huda', changes: [{ field: 'fixedDiscountPct', from: '14', to: '15' }] }],
  TAWUNIYA: [],
  MEDGULF: [],
}

const fact = (path, value, op = 'anyOf') => ({ check: 'fact', path, op, value })
const covRule = (id, en, ar, folder, state, when, then) => ({ id, name: says(en, ar), folder, state, when, then })

export const CATEGORY_RULESET = {
  schema: 1,
  kind: 'category',
  revision: 4,
  rules: [
    covRule('K-002', 'Tawuniya: Example Pharma statins are Generic', 'التعاونية: أدوية الستاتين من Example Pharma جنيسة', 'Tawuniya contract', 'live',
      [fact('$request.payer', ['TAWUNIYA']), fact('$item.ATC', ['C10AA'])], [{ effect: 'setCategory', group: 'G1' }]),
  ],
}

export const COVERAGE_RULESET = {
  schema: 1,
  kind: 'coverage',
  revision: 7,
  rules: [
    covRule('C-002', 'Bupa: cosmetics not covered', 'بوبا: مستحضرات التجميل غير مغطاة', 'Bupa contract', 'live',
      [fact('$request.payer', ['BUPA']), fact('$item.DosageForm', ['COSM'])], [{ effect: 'covered', covered: false, overridesPayer: true }]),
    covRule('C-003', 'MedGulf class C: 20% capped at SAR 50', 'ميدغلف الفئة C: 20% بحد أقصى 50 ريال', 'MedGulf contract', 'shadow',
      [fact('$request.payer', ['MEDGULF']), fact('$request.class', ['C'])], [{ effect: 'deductible', pct: 20, max: 50, overridesPayer: false }]),
  ],
}

/** K-001 "Bupa: Glucophage XR is Brand" as 617's drive builds it (under the next free id). */
export const K_001 = {
  name: says('Bupa: Glucophage XR is Brand', 'بوبا: جلوكوفاج إكس آر علامة تجارية'),
  folder: 'Bupa contract',
  when: [fact('$request.payer', ['BUPA']), fact('$item.ItemCode', ['100245'])],
  then: [{ effect: 'setCategory', group: 'G2' }],
}

/** "No deductible for these policies" (the prototype's SASREF branch, POSController.cs:6146) as the drive builds it. */
export const NO_DEDUCTIBLE = {
  name: says('SASREF: no deductible for these policies', 'ساسرف: لا تحمّل لهذه الوثائق'),
  folder: 'Bupa contract',
  when: [{ check: 'policy', inList: POLICY_LIST_SASREF }],
  then: [{ effect: 'deductible', pct: 0, max: null, overridesPayer: true }],
}

/** A drive's state: 610's lists state with 617's fields and the SASREF policy list, and 617's own documents. */
export function newCoverageState() {
  const copy = (x) => JSON.parse(JSON.stringify(x))
  const lists = newListsState()
  lists.fields.push(...copy(COVERAGE_FIELDS))
  lists.lists.policy.push({ id: POLICY_LIST_SASREF, name: says('SASREF policies', 'وثائق ساسرف'), entries: 1 })
  return {
    lists,
    insurers: copy(INSURERS),
    settings: copy(INSURER_SETTINGS),
    log: copy(SETTINGS_LOG),
    categories: copy(CATEGORY_RULESET),
    coverage: copy(COVERAGE_RULESET),
    writes: [],
  }
}

/** The leaves of a JSON value by path (`benefitCategories[3].code`), as strings — what the settings log compares. */
function leavesOf(v, at = '', out = {}) {
  if (Array.isArray(v)) v.forEach((x, i) => leavesOf(x, `${at}[${i}]`, out))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) leavesOf(x, at ? `${at}.${k}` : k, out)
  else out[at] = v === null || v === undefined ? null : String(v)
  return out
}

/** HQ's checks of a category / coverage draft, as the stub reads them: names, no condition, a value outside its range. */
export function validateRuleset(doc) {
  const out = []
  for (const r of doc.rules ?? []) {
    if (!r.name?.en?.trim()) out.push(issue(r.id, null, 'name.en', 'The rule needs a name in English.', 'تحتاج القاعدة إلى اسم بالإنجليزية.'))
    if (!r.name?.ar?.trim()) out.push(issue(r.id, null, 'name.ar', 'The rule needs a name in Arabic.', 'تحتاج القاعدة إلى اسم بالعربية.'))
    if (!(r.when ?? []).length) out.push(issue(r.id, null, 'when', 'The rule has no condition: it matches every line.', 'لا شرط في القاعدة: تنطبق على كل سطر.', 'warning'))
    ;(r.then ?? []).forEach((e, i) => {
      if (e.effect === 'deductible' && !(e.pct >= 0 && e.pct <= 100)) out.push(issue(r.id, `then[${i}]`, 'pct', 'The deductible is between 0 and 100 %.', 'نسبة التحمّل بين 0 و100 %.'))
    })
    if (doc.kind === 'coverage' && !(r.then ?? []).length) out.push(issue(r.id, null, 'then', 'The rule sets no coverage value.', 'لا تحدد القاعدة أي قيمة تغطية.'))
  }
  return out
}

/** 617's doors on a drive's `state`; anything else to 610's lists stub on `state.lists`; null when neither. */
export function coverageStub(method, path, body, opts = {}) {
  const { state, deny = [], reads = {}, query } = opts
  if (!state || !path.startsWith('InsuranceRules/')) return null
  const p = path.slice('InsuranceRules/'.length)
  const door = (name, fn) => {
    reads[name] = (reads[name] ?? 0) + 1
    if (deny.includes(name)) return { status: 403, body: '' }
    if (method !== 'GET') state.writes.push({ door: name, method, path, body })
    return fn()
  }

  if (p === 'Insurers' && method === 'GET') return door('insurers', () => envelope(state.insurers))
  let m = /^Insurers\/([^/]+)\/Settings(\/Log)?$/.exec(p)
  if (m) {
    const payer = decodeURIComponent(m[1])
    if (m[2]) return method === 'GET' ? door('log', () => envelope(state.log[payer] ?? [])) : null
    if (method === 'GET')
      return door('settings', () => (state.settings[payer] ? envelope(state.settings[payer]) : envelope(null, { status: 404, success: false, message: 'No such insurer.' })))
    if (method === 'PUT')
      return door('saveSettings', () => {
        const before = leavesOf(state.settings[payer] ?? {})
        const after = leavesOf(body)
        const changes = [...new Set([...Object.keys(before), ...Object.keys(after)])]
          .filter((k) => before[k] !== after[k])
          .map((field) => ({ field, from: before[field] ?? null, to: after[field] ?? null }))
        state.settings[payer] = structuredClone(body)
        ;(state.log[payer] ??= []).unshift({ at: localNow(), by: 'msartawi', changes })
        return envelope(state.settings[payer])
      })
    return null
  }

  m = /^(Categories|Coverage)\/(Draft|Validate)$/.exec(p)
  if (m) {
    const key = m[1] === 'Categories' ? 'categories' : 'coverage'
    if (m[2] === 'Validate') return method === 'POST' ? door(`validate${m[1]}`, () => envelope(validateRuleset(body))) : null
    if (method === 'GET') return door(key, () => envelope(state[key]))
    if (method === 'PUT')
      return door(`save${m[1]}`, () => {
        if (body?.revision !== state[key].revision)
          return envelope(null, { status: 409, success: false, message: 'Someone saved the draft since you read it.', errorCode: 'STALE_REVISION' })
        state[key] = { ...structuredClone(body), revision: state[key].revision + 1 }
        return envelope(state[key])
      })
    return null
  }
  return insuranceListsStub(method, path, body, { state: state.lists, query, deny, reads })
}

// --- 612 --- the simulator and the back-test (BackOffice 3140). Both run the guard DRAFT (`RULESET`, revision 12).
// ⚠️ Shapes beyond the brief are 612's guesses (`src/features/insurance-rules/simulator/simulate.ts`,
// `src/core/insurance-rules/backtest.ts`; recorded under 612's ## Comments for 618): the trace `value` is read
// AFTER the block's NOT, `why` is EN + AR, back-test `status` is queued|running|done|failed, `progress` is 0–1,
// `overlap` is a count of fires a live guard fires on too.

/** The stub patient the drive simulates on (a National ID). On no patient list, so G-007's NOT any-group holds. */
export const SIM_PATIENT = '1023456783'

/** The GLP-1 articles of the `glp1` list (ECode E1497 / E1502, `PREVIEW_ITEMS`). */
const GLP1_ARTICLES = ['100101', '100102', '100201']

const traceOf = (ruleId) => (blockPath, value, why) => ({ ruleId, blockPath, value, ...(why === undefined ? {} : { why }) })

/** One simulated line: G-007 (GLP-1 without a diabetes diagnosis) and G-004 (more than 90 days) as HQ would read them. */
function simulateLine(l) {
  const fired = []
  const trace = []
  const g7 = traceOf('G-007')
  const glp1 = GLP1_ARTICLES.includes(l.item)
  if (!glp1) {
    trace.push(g7('when[0]', false), g7('when[0].conditions[0]', false, says('The item is not in GLP-1 and biologics', 'الصنف ليس في GLP-1 والأدوية الحيوية')))
  } else {
    const diabetes = (l.icd ?? []).some((c) => c.startsWith('E11'))
    trace.push(
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
      fired.push({ ruleId: 'G-007', severity: 'OVERRIDE', en: 'GLP-1 without a diabetes diagnosis', ar: 'GLP-1 بدون تشخيص سكري', codes: { conflict: 'DC', nphies: 'CV-4-5' }, suggestion: null })
    }
  }
  const g4 = traceOf('G-004')
  if (l.daysSupply === undefined) trace.push(g4('when[0]', 'unknown', says('No days’ supply on the line', 'لا توجد أيام إمداد على البند')))
  else if (l.daysSupply > 90) {
    trace.push(g4('when[0]', true))
    fired.push({ ruleId: 'G-004', severity: 'REFUSE', en: `${l.daysSupply} days in one request; the maximum is 90`, ar: `${l.daysSupply} يوماً في طلب واحد؛ الحد الأقصى 90`, codes: { conflict: 'MX', nphies: 'CV-4-2' }, suggestion: { maxDaysSupply: 90 } })
  } else trace.push(g4('when[0]', false))
  const heaviest = ['REFUSE', 'OVERRIDE', 'WARN'].find((s) => fired.some((f) => f.severity === s))
  return { outcome: heaviest ? heaviest.toLowerCase() : 'pass', fired, trace }
}

/** `POST InsuranceRules/Guards/Simulate` — deterministic over the request's lines. */
export const simulateGuards = (body) => ({ lines: (body?.request?.lines ?? []).map(simulateLine) })

/** A finished back-test's report over `days` (the fires grow with the window). One key arrives WHOLE: the screen masks it. */
export function backtestReport(days, revision = RULESET.revision) {
  const k = days / 30
  return {
    status: 'done',
    progress: 1,
    revision,
    fires: { refuse: 4 * k, override: 30 * k, warn: 6 * k },
    stopped: [
      { on: '2026-10-26T18:42:10', store: 'P019', item: '100101', maskedKey: '10••••••83', sar: 450.5 },
      { on: '2026-10-25', store: 'P001', item: '100201', maskedKey: '24••••••19', sar: 612 },
      { on: '2026-10-21T09:05:00', store: 'P107', item: '100102', maskedKey: '1198765408', sar: 380.25 },
    ],
    sar: 1442.75,
    distinct: { patients: 21 * k, stores: 7, pharmacists: 9 },
    overlap: 12 * k,
  }
}

/** The back-test jobs and what was asked of them. A job runs for its first read, then is done. */
export const newBacktestStore = () => ({ next: 41, jobs: { 'BT-OLD': { days: 30, reads: 1, revision: 11 } }, starts: [], simulates: [] })

/**
 * 612's doors. `opts.store` is a `newBacktestStore()`; `opts.deny` names doors (`simulate`, `startBacktest`,
 * `backtest`) answered with a bare 403. Call it before `insuranceRulesStub` (which serves the draft).
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
    const id = `BT-${store.next++}`
    store.jobs[id] = { days: body?.days ?? 30, reads: 0, revision: RULESET.revision }
    return envelope({ id })
  }
  const read = method === 'GET' && path.match(/^InsuranceRules\/Guards\/Backtests\/([^/]+)$/)
  if (read) {
    if (deny.includes('backtest')) return { status: 403, body: '' }
    const job = store.jobs[decodeURIComponent(read[1])]
    if (!job) return envelope(null, { status: 404, success: false, message: 'No such back-test.', errorCode: 'BACKTEST-NOT-FOUND' })
    job.reads += 1
    if (job.reads === 1) return envelope({ ...backtestReport(job.days, job.revision), status: 'running', progress: 0.4, fires: { refuse: 0, override: 0, warn: 0 }, stopped: [], sar: 0, distinct: { patients: 0, stores: 0, pharmacists: 0 }, overlap: 0 })
    return envelope(backtestReport(job.days, job.revision))
  }
  return null
}
