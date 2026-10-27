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
