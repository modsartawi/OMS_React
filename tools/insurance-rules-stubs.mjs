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
