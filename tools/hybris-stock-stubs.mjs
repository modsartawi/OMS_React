// Stubs of the Hybris stock web doors (BackOffice spec 3447; oms 847–850), shared by the three
// Hybris stock drives (`hybris-stock-{stores,materials,pushes}-drive.mjs`).
//
// Built to the REAL door contract (C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md,
// BackOffice 3453–3456 at 6749be2de; reconciled 2026-11-09, ticket 851): every route, field, enum word and
// refusal code here is the contract's, on the SIS.Api envelope { statusCode, success, message, errors:
// [{ errorCode, internalErrorCode, errorMessage }], data }; every errorMessage is "<English> / <Arabic>"; a
// missing grant is a BARE 403. The staging walk (851) still owes the proof against the live doors.
//
//   GET  HybrisStockWeb/Access                                   → { canView, canManage }
//   GET  HybrisStockWeb/Status                                   → { mode, target, targetPath, …, alerts: [{ kind, title, raisedAt }] }
//   GET  HybrisStockWeb/Stores?flag=&health=&q=                  → store rows (open stores + marked closed ones)
//   POST HybrisStockWeb/Stores/{store}/Mark    { reason }        → the row; HYS-00001/2/3/4
//   POST HybrisStockWeb/Stores/{store}/Unmark  { reason }        → the row; HYS-00001/2/5
//   GET  HybrisStockWeb/Stores/{store}/History?take=             → [{ changeId, action M|U, door, reason, changedBy, changedAt }]
//   POST HybrisStockWeb/Stores/{store}/PushNow { reason }        → the push-now answer; HYS-00001/2/34/31/30; failed upload = 200 status E
//   POST HybrisStockWeb/Pushes/MaterialsNow { storeCodes, materialNumbers, reason } → the answer; HYS-00001/33/2/34/31/32/30
//   GET  HybrisStockWeb/Materials?q=&enabled=&skip=&take=        → { total, rows }
//   POST HybrisStockWeb/Materials { materialNumber, enabled?, reason } → the row; HYS-00001/10/11
//   POST HybrisStockWeb/Materials/{n}/Enable|Disable { reason }  → the row; HYS-00001/12/13/14
//   POST HybrisStockWeb/Materials/Upload/Preview  (multipart file) → { contentHash, counts, rows }; HYS-00016
//   POST HybrisStockWeb/Materials/Upload/Commit   (multipart file, contentHash, reason) → { uploadId, counts }; HYS-00001/16/15
//   GET  HybrisStockWeb/Materials/Download                       → text/csv MaterialNumber,Enabled
//   GET  HybrisStockWeb/Pushes?store=&type=&status=&from=&to=&take= → push rows (no skip, no total)
//   GET  HybrisStockWeb/Pushes/{id}/Lines?store=&material=&skip=&take= → { pushId, linesKept, total, lines }; HYS-00020
//   GET  HybrisStockWeb/Stores/{store}/Materials/{n}/History?take= → [{ pushId, type, status, sentAt, quantity }]
import { createHash } from 'node:crypto'

export const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, internalErrorCode: '', errorMessage: message }] : [],
    data,
  }),
})
export const bare403 = { status: 403, contentType: 'text/plain', body: '' }

export const REFUSALS = {
  'HYS-00001': [400, 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'],
  'HYS-00002': [404, 'No such store. / لا يوجد فرع بهذا الرمز.'],
  'HYS-00003': [400, 'The store is closed. / الفرع مغلق.'],
  'HYS-00004': [409, 'The store is already a Hybris stock store. / الفرع من فروع مخزون هايبرس بالفعل.'],
  'HYS-00005': [409, 'The store is not a Hybris stock store. / الفرع ليس من فروع مخزون هايبرس.'],
  'HYS-00010': [404, 'No such material in the material master. / لا توجد مادة بهذا الرقم.'],
  'HYS-00011': [409, 'The material is already on the Hybris stock list. / المادة موجودة في القائمة.'],
  'HYS-00012': [404, 'The material is not on the Hybris stock list. / المادة ليست في القائمة.'],
  'HYS-00013': [409, 'The material is already enabled. / المادة مفعّلة بالفعل.'],
  'HYS-00014': [409, 'The material is already disabled. / المادة معطّلة بالفعل.'],
  'HYS-00015': [409, 'The file or the list changed since the preview; preview again. / تغيّر الملف أو القائمة منذ المعاينة.'],
  'HYS-00016': [400, 'The file has no material number column. / لا يحوي الملف عمود رقم المادة.'],
  'HYS-00020': [404, 'No such push. / لا يوجد إرسال بهذا الرقم.'],
  'HYS-00030': [409, 'A chosen store is being pushed. / أحد الفروع قيد الإرسال.'],
  'HYS-00031': [409, 'A chosen store is not a Hybris stock store. / أحد الفروع ليس من فروع مخزون هايبرس.'],
  'HYS-00032': [400, 'Not enabled Hybris stock materials: 999999. / مواد غير مفعّلة: 999999.'],
  'HYS-00033': [400, 'Choose 1–200 stores and 1–1,000 materials. / اختر 1–200 فرع و1–1,000 مادة.'],
  'HYS-00034': [409, 'The Hybris stock sync is switched off. / مزامنة مخزون هايبرس متوقفة.'],
}
export const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

const health = (over = {}) => {
  const h = {
    lastDeltaAt: '2026-11-07T10:30:00',
    lastFullAt: '2026-11-06T03:05:00',
    nextFullDue: '2026-11-08T06:00:00',
    fullRequested: false,
    lastError: null,
    lastErrorAt: null,
    deltaBehind: false,
    fullOverdue: false,
    ...over,
  }
  return { ...h, healthy: !h.deltaBehind && !h.fullOverdue }
}
export const storeRow = (storeCode, over = {}) => ({
  storeCode,
  storeName: 'Riyadh Olaya',
  closed: false,
  marked: true,
  markedAt: '2026-11-01T09:00:00',
  markedBy: 'HYBRIS1',
  health: health(),
  ...over,
})
export const STORES = [
  storeRow('1234'),
  storeRow('0099', { storeName: 'Jeddah Tahlia', health: health({ deltaBehind: true, lastDeltaAt: '2026-11-07T08:30:00' }) }),
  storeRow('2001', { storeName: 'صيدلية الدواء - العليا', health: health({ fullOverdue: true, lastError: 'Blob upload failed: 503 Server Busy', lastErrorAt: '2026-11-07T10:00:00' }) }),
  // A marked store that has since closed: the list still holds it (a closed store is listed only while marked).
  storeRow('3003', { storeName: 'Dammam Corniche', closed: true, health: health({ lastError: 'Stock Visibility could not be read: timeout', lastErrorAt: '2026-11-07T10:00:00' }) }),
  storeRow('0450', { storeName: 'Khobar Mall', marked: false, markedAt: null, markedBy: null, health: null }),
  storeRow('0451', { storeName: 'Abha Center', marked: false, markedAt: null, markedBy: null, health: null }),
]
const change = (changeId, action, reason, changedBy, changedAt) => ({ changeId, action, door: 'oms-react', reason, changedBy, changedAt })
export const STORE_HISTORY = {
  1234: [
    change('01JC3', 'M', 'Back on the website after refit', 'HYBRIS1', '2026-11-01T09:00:00'),
    change('01JC2', 'U', 'إغلاق مؤقت للتجديد', 'HYBRIS1', '2026-10-15T14:00:00'),
    change('01JC1', 'M', 'First wave', 'HYBRIS2', '2026-09-01T08:00:00'),
  ],
}

export const STATUS = (mode = 'shadow', alerts = []) => ({
  mode,
  target: mode === 'live' ? 'live' : 'shadow',
  targetPath: mode === 'live' ? 'master/hotfolder/' : 'master/hotfolder-shadow/',
  deltaMinutes: 30,
  overlapMinutes: 15,
  fullRoundHours: [3, 4, 5],
  storesPerRound: 10,
  maxRowsPerFile: 100000,
  minutesBetweenParts: 5,
  lineRetentionDays: 15,
  alerts,
})

export const materialRow = (materialNumber, over = {}) => ({
  materialNumber,
  nameEn: `Material ${materialNumber}`,
  nameAr: '',
  enabled: true,
  addedAt: '2026-11-01T09:00:00',
  addedBy: 'HYBRIS1',
  updatedAt: '2026-11-01T09:00:00',
  updatedBy: 'HYBRIS1',
  lastEnabledAt: '2026-11-01T09:00:00',
  ...over,
})
export const MATERIALS = Array.from({ length: 120 }, (_, i) => {
  const n = String(100000 + i)
  if (i === 1) return materialRow(n, { nameEn: 'Panadol 500mg 24s', nameAr: 'بنادول أقراص 500 ملغ', enabled: false })
  if (i === 2) return materialRow(n, { nameEn: 'Panadol Extra 24 tabs' })
  return materialRow(n)
})
/** Material numbers the master knows besides the list: an add or upload of these is accepted. */
export const KNOWN_NOT_LISTED = ['200001', '200002', '200003']

const STAMP = (at) => at.replace(/\D/g, '').slice(0, 14)
const LETTER = { delta: 'd', full: 'f', 'now-store': 's', 'now-materials': 'm' }
/** `aldawaastocklevel-yyyyMMddHHmmss-<tag>[-pNN].csv`, the tag the type letter + the push id's last six. */
export const fileName = (type, pushId, startedAt, part) =>
  `aldawaastocklevel-${STAMP(startedAt)}-${LETTER[type]}${pushId.slice(-6).toLowerCase()}${part ? `-p${String(part).padStart(2, '0')}` : ''}.csv`
const STATUS_TEXT = {
  running: 'Sending to hot folder / جارٍ الإرسال إلى مجلد هايبرس',
  sent: 'Delivered to hot folder / تم التسليم إلى مجلد هايبرس',
  failed: 'Failed / فشل',
}
const push = (pushId, type, storeCodes, startedAt, finishedAt, status, rows, over = {}) => {
  const fileNames = status === 'sent' ? [fileName(type, pushId, startedAt)] : []
  const p = {
    pushId,
    type,
    status,
    statusText: STATUS_TEXT[status],
    startedAt,
    finishedAt,
    storeCount: storeCodes.length,
    storeCodes,
    requestedBy: null,
    reason: null,
    rows,
    target: 'shadow',
    targetPath: 'master/hotfolder-shadow/',
    fileCount: fileNames.length,
    fileNames,
    error: null,
    parts: null,
    linesKept: true,
    ...over,
  }
  return { ...p, fileCount: p.fileNames.length }
}
export const PUSHES = [
  push('P-0105', 'delta', ['1234', '0099', '2001', '3003'], '2026-11-07T10:30:00', '2026-11-07T10:30:41', 'sent', 812),
  push('P-0104', 'now-store', ['1234'], '2026-11-07T10:12:00', '2026-11-07T10:13:05', 'sent', 4210, { requestedBy: 'HYBRIS1', reason: 'Website showed stale stock' }),
  push('P-0103', 'delta', ['1234', '0099', '2001', '3003'], '2026-11-07T10:00:00', '2026-11-07T10:00:12', 'failed', 0, { error: 'Blob upload failed: 503 Server Busy' }),
  push('P-0102', 'now-materials', ['1234', '2001'], '2026-11-07T09:40:00', '2026-11-07T09:40:03', 'sent', 4, { requestedBy: 'HYBRIS2', reason: 'تصحيح مادتين' }),
  push('P-0101', 'full', ['1234', '2001', '3003'], '2026-11-07T03:00:00', '2026-11-07T03:11:00', 'sent', 250000, {
    fileNames: [1, 2, 3].map((n) => fileName('full', 'P-0101', '2026-11-07T03:00:00', n)),
  }),
  push('P-0050', 'full', ['0099'], '2026-10-20T03:00:00', '2026-10-20T03:04:00', 'sent', 4100, { linesKept: false }),
  // A split push still sending its parts: one of two up.
  push('P-0100', 'full', ['3003'], '2026-11-07T10:35:00', null, 'running', 150000, {
    fileNames: [fileName('full', 'P-0100', '2026-11-07T10:35:00', 1)],
    parts: { uploaded: 1, total: 2 },
  }),
]

// One line per store and material in a push, as the rail writes them.
const lineFor = (storeCode, m, i) => ({ storeCode, materialNumber: String(100000 + m), quantity: (i * 7) % 40 })
export const LINES = {
  'P-0105': Array.from({ length: 812 }, (_, i) => lineFor(['1234', '0099', '2001', '3003'][i % 4], Math.floor(i / 4), i)),
  'P-0104': Array.from({ length: 4210 }, (_, i) => lineFor('1234', i, i)),
  'P-0102': [
    { storeCode: '1234', materialNumber: '100002', quantity: 0 },
    { storeCode: '1234', materialNumber: '100003', quantity: 12 },
    { storeCode: '2001', materialNumber: '100002', quantity: 5 },
    { storeCode: '2001', materialNumber: '100003', quantity: 9 },
  ],
}
export const MATERIAL_HISTORY = {
  '1234/100002': [
    { pushId: 'P-0105', type: 'delta', status: 'sent', sentAt: '2026-11-07T10:30:00', quantity: 3 },
    { pushId: 'P-0104', type: 'now-store', status: 'sent', sentAt: '2026-11-07T10:12:00', quantity: 4 },
    { pushId: 'P-0102', type: 'now-materials', status: 'sent', sentAt: '2026-11-07T09:40:00', quantity: 0 },
  ],
}

// ── the upload, as the contract reads a file ────────────────────────────────────────────────────
const norm = (h) => h.toLowerCase().replace(/[\s_-]/g, '')
const NUMBER_HEADERS = ['materialnumber', 'material', 'materialno', 'itemnumber', 'item', 'article', 'رقمالمادة', 'المادة', 'رقمالصنف', 'الصنف']
const ENABLED_HEADERS = ['enabled', 'isenabled', 'enable', 'active', 'مفعل', 'مفعّل', 'الحالة']
const TRUE = ['true', '1', 'yes', 'y', 'x', 'enabled', 'on', 'نعم', 'مفعل']
const FALSE = ['false', '0', 'no', 'n', 'disabled', 'off', 'لا', 'معطل']

/** The PREVIEW of a CSV — headers by name, a blank enabled cell states nothing, the first of a repeat wins. */
export function previewOf(text, list) {
  const lines = text.split(/\r?\n/)
  const sep = /\t/.test(lines[0]) ? '\t' : /;/.test(lines[0]) ? ';' : ','
  const headers = lines[0].split(sep).map((h) => norm(h.trim()))
  const numberAt = headers.findIndex((h) => NUMBER_HEADERS.includes(h))
  if (numberAt < 0) return null
  const enabledAt = headers.findIndex((h) => ENABLED_HEADERS.includes(h))
  const rows = []
  const seen = new Set()
  lines.slice(1).forEach((raw, i) => {
    if (!raw.trim()) return
    const cells = raw.split(sep).map((c) => (c ?? '').trim())
    const typed = cells[numberAt] ?? ''
    const cell = enabledAt < 0 ? '' : (cells[enabledAt] ?? '').toLowerCase()
    const rowNumber = i + 2
    const enabled = cell === '' ? null : TRUE.includes(cell) ? true : FALSE.includes(cell) ? false : 'bad'
    const base = { rowNumber, materialNumber: typed, enabled: enabled === 'bad' ? null : enabled, currentEnabled: null }
    if (!/^[A-Za-z0-9._-]{1,30}$/.test(typed) || enabled === 'bad') return rows.push({ ...base, outcome: 'refused', refusal: 'malformed' })
    const listed = list.find((m) => m.materialNumber.toLowerCase() === typed.toLowerCase())
    const key = typed.toLowerCase()
    if (seen.has(key)) return rows.push({ ...base, currentEnabled: listed?.enabled ?? null, outcome: 'refused', refusal: 'repeated' })
    seen.add(key)
    if (!listed && !KNOWN_NOT_LISTED.includes(typed)) return rows.push({ ...base, outcome: 'refused', refusal: 'unknownMaterial' })
    if (!listed) return rows.push({ ...base, outcome: 'new', refusal: null })
    const changed = enabled !== null && enabled !== listed.enabled
    rows.push({ ...base, materialNumber: listed.materialNumber, currentEnabled: listed.enabled, outcome: changed ? 'changed' : 'unchanged', refusal: null })
  })
  const counts = { new: 0, changed: 0, unchanged: 0, refused: 0 }
  for (const r of rows) counts[r.outcome]++
  const contentHash = createHash('sha256').update(text).update(JSON.stringify(rows)).digest('hex')
  return { contentHash, counts, rows }
}

/** The parts of a multipart body: `{ name: { filename?, value } }`. */
export function multipart(req) {
  const type = req.headers()['content-type'] ?? ''
  const boundary = type.match(/boundary=(.+)$/)?.[1]
  const raw = req.postDataBuffer()?.toString('utf8') ?? ''
  const out = {}
  if (!boundary) return out
  for (const part of raw.split(`--${boundary}`)) {
    const at = part.indexOf('\r\n\r\n')
    if (at < 0) continue
    const head = part.slice(0, at)
    const name = head.match(/name="([^"]+)"/)?.[1]
    if (!name) continue
    out[name] = { filename: head.match(/filename="([^"]*)"/)?.[1], value: part.slice(at + 4).replace(/\r\n$/, '') }
  }
  return out
}

/** A push-now answer (the letters, not the log's words). */
const nowAnswer = (pushId, pushType, storeCodes, rowsSent, reason, over = {}) => {
  const startedAt = '2026-11-07T10:40:00'
  const type = pushType === 'S' ? 'now-store' : 'now-materials'
  return {
    pushId,
    pushType,
    status: 'S',
    storeCodes,
    rowsSent,
    fileCount: 1,
    fileNames: [fileName(type, pushId, startedAt)],
    target: 'shadow',
    targetPath: 'master/hotfolder-shadow/',
    requestedBy: 'MSARTAWI',
    reason,
    startedAt,
    finishedAt: '2026-11-07T10:41:00',
    error: null,
    ...over,
  }
}
/** The log row a push-now answer is recorded as. */
const logRow = (a) =>
  push(a.pushId, a.pushType === 'S' ? 'now-store' : 'now-materials', a.storeCodes, a.startedAt, a.finishedAt, { S: 'sent', E: 'failed', R: 'running' }[a.status], a.rowsSent, {
    requestedBy: a.requestedBy,
    reason: a.reason,
    fileNames: a.fileNames,
    error: a.error,
  })

const WORDS = { take: (qs, d) => Number(qs.get('take') ?? d) }

/**
 * Install the stubs on a page. Each browser context holds its OWN state (stores, materials, pushes),
 * so a write in one test never leaks into the next. `opts.access` (an object, or 403), `opts.mode`,
 * `opts.alerts`, `opts.status` ('ok' | 'fail'), `opts.extraPushes` (N older deltas, for Show more). Returns the recorded calls and a `gate` the drive
 * releases to finish a slow push.
 */
export async function installStubs(page, opts = {}) {
  const access = opts.access ?? { canView: true, canManage: true }
  const state = {
    stores: STORES.map((s) => ({ ...s, health: s.health && { ...s.health } })),
    history: structuredClone(STORE_HISTORY),
    materials: MATERIALS.map((m) => ({ ...m })),
    pushes: [
      ...PUSHES.map((p) => ({ ...p })),
      ...Array.from({ length: opts.extraPushes ?? 0 }, (_, i) =>
        push(`P-${String(i).padStart(4, '0')}`, 'delta', ['1234'], `2026-10-${String(1 + (i % 19)).padStart(2, '0')}T0${i % 10}:00:00`, null, 'sent', 10, { finishedAt: '2026-10-01T00:00:10' }),
      ),
    ],
    uploads: 0,
  }
  const calls = []
  const reads = []
  const writes = []
  const gate = { release: null, waiting: false }
  const slow = async (reason) => {
    if (reason !== 'slow') return
    gate.waiting = true
    await new Promise((r) => (gate.release = r))
    gate.waiting = false
  }
  const badReason = (r) => typeof r !== 'string' || !r.trim() || r.trim().length > 200 || r === 'trigger 00001'
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.split('/api/')[1]
    const m = req.method()
    const qs = url.searchParams
    calls.push(p)
    const json = () => req.postDataJSON()
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'HybrisStockWeb/Access') return route.fulfill(access === 403 ? bare403 : envelope(access))
    if (!p.startsWith('HybrisStockWeb/')) {
      if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
      return route.fulfill(envelope([]))
    }
    // Every other door wants the view grant; a write wants manage.
    if (access === 403 || !(access.canView || access.canManage)) return route.fulfill(bare403)
    if (m !== 'GET' && !access.canManage) return route.fulfill(bare403)
    if (p === 'HybrisStockWeb/Status') {
      reads.push({ path: p, search: '' })
      return route.fulfill(opts.status === 'fail' ? envelope(null, { status: 500, success: false, message: 'boom' }) : envelope(STATUS(opts.mode, opts.alerts)))
    }

    // ── stores ──
    if (p === 'HybrisStockWeb/Stores' && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const flag = qs.get('flag') ?? 'any'
      const hf = qs.get('health') ?? 'any'
      if (!['any', 'marked', 'unmarked'].includes(flag) || !['any', 'ok', 'unhealthy'].includes(hf))
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'Unknown filter. / مرشح غير معروف.', errorCode: 'HybrisStockFilterUnknown' }))
      const q = (qs.get('q') ?? '').toLowerCase()
      return route.fulfill(
        envelope(
          state.stores.filter(
            (s) =>
              (flag === 'any' || (flag === 'marked') === s.marked) &&
              (hf === 'any' || (s.marked && (hf === 'ok') === s.health.healthy)) &&
              (!q || s.storeCode.includes(q) || s.storeName.toLowerCase().includes(q)),
          ),
        ),
      )
    }
    const storeMatch = p.match(/^HybrisStockWeb\/Stores\/([^/]+)\/(Mark|Unmark|History|PushNow)$/)
    if (storeMatch) {
      const code = decodeURIComponent(storeMatch[1])
      const verb = storeMatch[2]
      const at = state.stores.findIndex((s) => s.storeCode === code)
      if (verb === 'History') {
        reads.push({ path: p, search: url.search.slice(1) })
        return route.fulfill(envelope((state.history[code] ?? []).slice(0, WORDS.take(qs, 50))))
      }
      const body = json()
      writes.push({ method: m, path: p, body })
      await slow(body.reason)
      if (badReason(body.reason)) return route.fulfill(refuse('HYS-00001'))
      if (at < 0) return route.fulfill(refuse('HYS-00002'))
      const s = state.stores[at]
      if (verb === 'PushNow') {
        if (body.reason === 'trigger off') return route.fulfill(refuse('HYS-00034'))
        if (!s.marked) return route.fulfill(refuse('HYS-00031'))
        if (body.reason === 'trigger busy') return route.fulfill(refuse('HYS-00030'))
        if (body.reason === 'trigger failed') {
          // A failed upload is NOT a refusal: 200, status E, recorded in the log and on the store's health.
          const failed = nowAnswer('P-0107', 'S', [code], 0, body.reason, { status: 'E', fileCount: 0, fileNames: [], error: 'Blob upload failed: 503 Server Busy' })
          state.pushes.unshift(logRow(failed))
          state.stores[at] = { ...s, health: { ...s.health, lastError: failed.error, lastErrorAt: failed.startedAt } }
          return route.fulfill(envelope(failed))
        }
        const done = nowAnswer('P-0106', 'S', [code], 4300, body.reason)
        state.pushes.unshift(logRow(done))
        state.stores[at] = {
          ...s,
          health: { ...s.health, lastFullAt: done.startedAt, lastDeltaAt: done.startedAt, fullRequested: false, fullOverdue: false, deltaBehind: false, healthy: true, lastError: null, lastErrorAt: null },
        }
        return route.fulfill(envelope(done))
      }
      if (verb === 'Mark') {
        if (s.closed) return route.fulfill(refuse('HYS-00003'))
        if (s.marked || body.reason === 'trigger 00004') return route.fulfill(refuse('HYS-00004'))
      } else if (!s.marked) return route.fulfill(refuse('HYS-00005'))
      const next =
        verb === 'Mark'
          ? { ...s, marked: true, markedAt: '2026-11-07T10:45:00', markedBy: 'MSARTAWI', health: health({ lastDeltaAt: null, lastFullAt: null, nextFullDue: '2026-11-07T11:45:00', fullRequested: true }) }
          : { ...s, marked: false, markedAt: null, markedBy: null, health: null }
      state.stores[at] = next
      ;(state.history[code] ??= []).unshift(change(`01JX${state.history[code]?.length ?? 0}`, verb === 'Mark' ? 'M' : 'U', body.reason.trim(), 'MSARTAWI', '2026-11-07T10:45:00'))
      return route.fulfill(envelope(next))
    }
    if (p === 'HybrisStockWeb/Pushes/MaterialsNow' && m === 'POST') {
      const body = json()
      writes.push({ method: m, path: p, body })
      await slow(body.reason)
      if (badReason(body.reason)) return route.fulfill(refuse('HYS-00001'))
      const storeCodes = [...new Set((body.storeCodes ?? []).map((c) => c.trim()))]
      const numbers = [...new Set((body.materialNumbers ?? []).map((c) => c.trim()))]
      if (!storeCodes.length || !numbers.length || storeCodes.length > 200 || numbers.length > 1000) return route.fulfill(refuse('HYS-00033'))
      if (storeCodes.some((c) => !state.stores.some((s) => s.storeCode === c))) return route.fulfill(refuse('HYS-00002'))
      if (body.reason === 'trigger off') return route.fulfill(refuse('HYS-00034'))
      if (storeCodes.some((c) => !state.stores.find((s) => s.storeCode === c).marked)) return route.fulfill(refuse('HYS-00031'))
      if (numbers.some((n) => !state.materials.some((x) => x.materialNumber === n && x.enabled))) return route.fulfill(refuse('HYS-00032'))
      if (body.reason === 'trigger busy') return route.fulfill(refuse('HYS-00030'))
      const done = nowAnswer('P-0108', 'M', storeCodes, storeCodes.length * numbers.length, body.reason, { startedAt: '2026-11-07T10:50:00', finishedAt: '2026-11-07T10:50:02' })
      state.pushes.unshift(logRow(done))
      return route.fulfill(envelope(done))
    }

    // ── materials ──
    if (p === 'HybrisStockWeb/Materials' && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const q = (qs.get('q') ?? '').toLowerCase()
      const enabled = qs.get('enabled') ?? 'any'
      const skip = Number(qs.get('skip') ?? 0)
      const take = WORDS.take(qs, 50)
      if (!['any', 'enabled', 'disabled'].includes(enabled)) return route.fulfill(envelope(null, { status: 400, success: false, message: 'Unknown filter.', errorCode: 'HybrisStockFilterUnknown' }))
      if (take < 1 || take > 500 || skip < 0) return route.fulfill(envelope(null, { status: 400, success: false, message: 'Bad paging.', errorCode: 'HybrisStockInputInvalid' }))
      const hits = state.materials
        .filter(
          (x) =>
            (!q || x.materialNumber.toLowerCase().includes(q) || x.nameEn.toLowerCase().includes(q) || x.nameAr.includes(q)) &&
            (enabled === 'any' || (enabled === 'enabled') === x.enabled),
        )
        .sort((a, b) => a.materialNumber.localeCompare(b.materialNumber))
      return route.fulfill(envelope({ total: hits.length, rows: hits.slice(skip, skip + take) }))
    }
    if (p === 'HybrisStockWeb/Materials' && m === 'POST') {
      const body = json()
      writes.push({ method: m, path: p, body })
      if (badReason(body.reason)) return route.fulfill(refuse('HYS-00001'))
      const known = KNOWN_NOT_LISTED.find((n) => n.toLowerCase() === body.materialNumber.toLowerCase())
      if (state.materials.some((x) => x.materialNumber.toLowerCase() === body.materialNumber.toLowerCase())) return route.fulfill(refuse('HYS-00011'))
      if (!known) return route.fulfill(refuse('HYS-00010'))
      const on = body.enabled ?? true
      const row = materialRow(known, { enabled: on, addedBy: 'MSARTAWI', updatedBy: 'MSARTAWI', addedAt: '2026-11-07T10:45:00', updatedAt: '2026-11-07T10:45:00', lastEnabledAt: on ? '2026-11-07T10:45:00' : null })
      state.materials.push(row)
      return route.fulfill(envelope(row))
    }
    const enabledMatch = p.match(/^HybrisStockWeb\/Materials\/([^/]+)\/(Enable|Disable)$/)
    if (enabledMatch && m === 'POST') {
      const n = decodeURIComponent(enabledMatch[1])
      const on = enabledMatch[2] === 'Enable'
      const body = json()
      writes.push({ method: m, path: p, body })
      if (badReason(body.reason)) return route.fulfill(refuse('HYS-00001'))
      const at = state.materials.findIndex((x) => x.materialNumber === n)
      if (at < 0) return route.fulfill(refuse('HYS-00012'))
      if (state.materials[at].enabled === on || body.reason === 'trigger stale') return route.fulfill(refuse(on ? 'HYS-00013' : 'HYS-00014'))
      state.materials[at] = { ...state.materials[at], enabled: on, updatedBy: 'MSARTAWI', updatedAt: '2026-11-07T10:46:00', ...(on ? { lastEnabledAt: '2026-11-07T10:46:00' } : {}) }
      return route.fulfill(envelope(state.materials[at]))
    }
    if (p === 'HybrisStockWeb/Materials/Upload/Preview' && m === 'POST') {
      const parts = multipart(req)
      const file = parts.file
      writes.push({ method: m, path: p, fileName: file?.filename, hasFilePart: !!file, fields: Object.keys(parts), content: file?.value })
      const preview = file ? previewOf(file.value, state.materials) : null
      if (!preview) return route.fulfill(refuse('HYS-00016'))
      return route.fulfill(envelope(preview))
    }
    if (p === 'HybrisStockWeb/Materials/Upload/Commit' && m === 'POST') {
      const parts = multipart(req)
      const body = { fileName: parts.file?.filename, contentHash: parts.contentHash?.value, reason: parts.reason?.value }
      writes.push({ method: m, path: p, body, fields: Object.keys(parts) })
      if (badReason(body.reason)) return route.fulfill(refuse('HYS-00001'))
      const preview = parts.file ? previewOf(parts.file.value, state.materials) : null
      if (!preview) return route.fulfill(refuse('HYS-00016'))
      if (preview.contentHash !== body.contentHash || body.reason === 'trigger 00015') return route.fulfill(refuse('HYS-00015'))
      const uploadId = preview.counts.new + preview.counts.changed > 0 ? `01JU${++state.uploads}` : null
      for (const r of preview.rows) {
        if (r.outcome === 'new') state.materials.push(materialRow(r.materialNumber, { enabled: r.enabled ?? true, addedBy: 'MSARTAWI' }))
        if (r.outcome === 'changed') {
          const at = state.materials.findIndex((x) => x.materialNumber === r.materialNumber)
          state.materials[at] = { ...state.materials[at], enabled: r.enabled }
        }
      }
      return route.fulfill(envelope({ uploadId, counts: preview.counts }))
    }
    if (p === 'HybrisStockWeb/Materials/Download' && m === 'GET') {
      reads.push({ path: p, search: '' })
      const csv = ['MaterialNumber,Enabled', ...state.materials.map((x) => `${x.materialNumber},${x.enabled}`)].join('\n')
      return route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'Content-Disposition': 'attachment; filename="hybris-stock-materials-20261107104500.csv"' }, body: csv })
    }

    // ── pushes ──
    if (p === 'HybrisStockWeb/Pushes' && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const store = qs.get('store')
      const type = qs.get('type') ?? 'any'
      const status = qs.get('status') ?? 'any'
      const from = qs.get('from')
      const to = qs.get('to')
      const take = WORDS.take(qs, 50)
      if (!['any', 'delta', 'full', 'now-store', 'now-materials'].includes(type) || !['any', 'running', 'sent', 'failed'].includes(status))
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'Unknown filter.', errorCode: 'HybrisStockFilterUnknown' }))
      if (take < 1 || take > 500 || (from && to && from > to) || qs.has('skip'))
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'Bad input.', errorCode: 'HybrisStockInputInvalid' }))
      const hits = state.pushes.filter(
        (x) =>
          (!store || x.storeCodes.includes(store)) &&
          (type === 'any' || x.type === type) &&
          (status === 'any' || x.status === status) &&
          (!from || x.startedAt.slice(0, 10) >= from) &&
          (!to || x.startedAt.slice(0, 10) <= to),
      )
      return route.fulfill(envelope(hits.slice(0, take)))
    }
    const linesMatch = p.match(/^HybrisStockWeb\/Pushes\/([^/]+)\/Lines$/)
    if (linesMatch && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const id = decodeURIComponent(linesMatch[1])
      const found = state.pushes.find((x) => x.pushId === id)
      if (!found) return route.fulfill(refuse('HYS-00020'))
      if (!found.linesKept) return route.fulfill(envelope({ pushId: id, linesKept: false, total: 0, lines: [] }))
      const store = qs.get('store')
      const material = qs.get('material')
      const skip = Number(qs.get('skip') ?? 0)
      const take = WORDS.take(qs, 50)
      const all = (LINES[id] ?? []).filter((l) => (!store || l.storeCode === store) && (!material || l.materialNumber === material))
      return route.fulfill(envelope({ pushId: id, linesKept: true, total: all.length, lines: all.slice(skip, skip + take) }))
    }
    const histMatch = p.match(/^HybrisStockWeb\/Stores\/([^/]+)\/Materials\/([^/]+)\/History$/)
    if (histMatch && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const key = `${decodeURIComponent(histMatch[1])}/${decodeURIComponent(histMatch[2])}`
      return route.fulfill(envelope((MATERIAL_HISTORY[key] ?? []).slice(0, WORDS.take(qs, 50))))
    }
    return route.fulfill(envelope(null, { status: 404, success: false, message: `no stub for ${m} ${p}` }))
  })
  return { state, calls, reads, writes, gate }
}
