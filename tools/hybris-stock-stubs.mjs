// Stubs of the Hybris stock web doors (BackOffice spec 3447; oms 847–850), shared by the three
// Hybris stock drives (`hybris-stock-{stores,materials,pushes}-drive.mjs`).
//
// 🚩 GUESSED CONTRACT. BackOffice 3453–3456 are not built and the door contract asset
// (C:\Work\DMSCO\BackOffice\.issues\assets\3447-hybris-stock-web-door-contract.md) does not exist yet
// (2026-11-07). Every route and field here mirrors `src/core/models/hybris-stock.ts`, on the REAL
// SIS.Api envelope { statusCode, success, message, errors: [{ errorCode, internalErrorCode,
// errorMessage }], data }; every refusal's errorMessage is "<English> / <Arabic>"; a missing grant is
// a BARE 403. Ticket 851 reconciles all of it with the real doors on staging.
//
//   GET  HybrisStockWeb/Access                                  → { canView, canManage }
//   GET  HybrisStockWeb/Status                                  → { mode, deltaMinutes, …, alerts }
//   GET  HybrisStockWeb/Stores?marked=&q=                       → store rows
//   POST HybrisStockWeb/Stores/{store}/Mark|Unmark  { reason }  → the row; HYS-00001/2/3
//   GET  HybrisStockWeb/Stores/{store}/History                  → mark / unmark rows
//   POST HybrisStockWeb/Stores/{store}/PushNow      { reason }  → the push; HYS-00001/9/10, 502 00011, 409 busy
//   POST HybrisStockWeb/Pushes/Materials { storeCodes, materialNumbers, reason } → the push; + HYS-00004
//   GET  HybrisStockWeb/Materials?q=&enabled=&skip=&take=       → { total, rows }
//   POST HybrisStockWeb/Materials { materialNumber, reason }    → the row; HYS-00001/4/5
//   PUT  HybrisStockWeb/Materials/{n}/Enabled { enabled, reason } → the row; HYS-00001/4
//   POST HybrisStockWeb/Materials/Upload/Preview  (multipart file) → the preview; HYS-00007
//   POST HybrisStockWeb/Materials/Upload/{id}/Commit { reason } → the result; HYS-00001/6
//   GET  HybrisStockWeb/Materials/Download                      → text/csv
//   GET  HybrisStockWeb/Pushes?store=&type=&status=&from=&to=&skip=&take= → { total, rows }
//   GET  HybrisStockWeb/Pushes/{id}/Lines?store=&material=&skip=&take=    → { pushId, total, lines }; HYS-00008
//   GET  HybrisStockWeb/Stores/{store}/Materials/{n}/History    → sent rows

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
  'HYS-00003': [409, 'The store was changed meanwhile. / تغيّر الفرع في الأثناء.'],
  'HYS-00004': [404, 'Not a known material. / ليست مادة معروفة.'],
  'HYS-00005': [409, 'The material is already on the list. / المادة موجودة في القائمة.'],
  'HYS-00006': [404, 'The upload preview is gone. / انتهت معاينة الملف.'],
  'HYS-00007': [400, 'The file has no material column. / لا يحوي الملف عمود المواد.'],
  'HYS-00008': [404, 'No such push. / لا يوجد إرسال بهذا الرقم.'],
  'HYS-00009': [409, 'The store is not a Hybris stock store. / الفرع ليس من فروع مخزون هايبرس.'],
  'HYS-00010': [409, 'The Hybris stock sync is off. / مزامنة مخزون هايبرس متوقفة.'],
  'HYS-00011': [502, 'Blob upload failed: 503 Server Busy. / فشل رفع الملف.'],
  HybrisStockPushBusy: [409, 'A push of this store is running. / إرسال لهذا الفرع جارٍ.'],
}
export const refuse = (code) => {
  const [status, message] = REFUSALS[code]
  return envelope(null, { status, success: false, message, errorCode: code })
}

const health = (over = {}) => ({
  lastDeltaAt: '2026-11-07T10:30:00',
  lastFullAt: '2026-11-06T03:05:00',
  nextFullDue: '2026-11-08T03:00:00',
  fullRequested: false,
  lastErrorAt: null,
  lastError: null,
  deltaBehind: false,
  fullOverdue: false,
  ...over,
})
export const storeRow = (storeCode, over = {}) => ({
  storeCode,
  storeName: 'Riyadh Olaya',
  marked: true,
  changedAt: '2026-11-01T09:00:00',
  changedBy: 'HYBRIS1',
  health: health(),
  ...over,
})
export const STORES = [
  storeRow('1234'),
  storeRow('0099', { storeName: 'Jeddah Tahlia', health: health({ deltaBehind: true, lastDeltaAt: '2026-11-07T08:30:00' }) }),
  storeRow('2001', { storeName: 'صيدلية الدواء - العليا', health: health({ fullOverdue: true, lastError: 'Blob upload failed: 503 Server Busy', lastErrorAt: '2026-11-07T10:00:00' }) }),
  storeRow('3003', { storeName: 'Dammam Corniche', health: health({ lastError: 'Stock Visibility timed out', lastErrorAt: '2026-11-07T10:00:00' }) }),
  storeRow('0450', { storeName: 'Khobar Mall', marked: false, changedAt: null, changedBy: null, health: null }),
  storeRow('0451', { storeName: 'Abha Center', marked: false, changedAt: '2026-10-20T12:00:00', changedBy: 'HYBRIS2', health: null }),
]
export const STORE_HISTORY = {
  1234: [
    { at: '2026-11-01T09:00:00', by: 'HYBRIS1', action: 'mark', reason: 'Back on the website after refit', door: 'oms-react' },
    { at: '2026-10-15T14:00:00', by: 'HYBRIS1', action: 'unmark', reason: 'إغلاق مؤقت للتجديد', door: 'oms-react' },
    { at: '2026-09-01T08:00:00', by: 'HYBRIS2', action: 'mark', reason: 'First wave', door: 'oms-react' },
  ],
}

export const STATUS = (mode = 'shadow', alerts = []) => ({
  mode,
  deltaMinutes: 30,
  overlapMinutes: 15,
  fullRoundHours: [3, 4, 5],
  storesPerRound: 10,
  lineRetentionDays: 15,
  alerts,
})

export const materialRow = (materialNumber, over = {}) => ({
  materialNumber,
  materialName: `Material ${materialNumber}`,
  enabled: true,
  addedAt: '2026-11-01T09:00:00',
  addedBy: 'HYBRIS1',
  updatedAt: '2026-11-01T09:00:00',
  updatedBy: 'HYBRIS1',
  ...over,
})
export const MATERIALS = Array.from({ length: 120 }, (_, i) => {
  const n = String(100000 + i)
  if (i === 1) return materialRow(n, { materialName: 'بنادول أقراص 500 ملغ', enabled: false })
  if (i === 2) return materialRow(n, { materialName: 'Panadol Extra 24 tabs' })
  return materialRow(n)
})
/** Material numbers the master knows besides the list: an add or upload of these is accepted. */
export const KNOWN_NOT_LISTED = ['200001', '200002', '200003']

const push = (pushId, type, storeCodes, startedAt, finishedAt, status, rows, over = {}) => ({
  pushId,
  type,
  storeCodes,
  startedAt,
  finishedAt,
  status,
  rows,
  target: 'shadow',
  files: status === 'S' ? [`aldawaastocklevel-${startedAt.replace(/\D/g, '').slice(0, 14)}-1.csv`] : [],
  error: null,
  requestedBy: null,
  reason: null,
  linesSwept: false,
  ...over,
})
export const PUSHES = [
  push('P-0105', 'D', ['1234', '0099', '2001', '3003'], '2026-11-07T10:30:00', '2026-11-07T10:30:41', 'S', 812),
  push('P-0104', 'S', ['1234'], '2026-11-07T10:12:00', '2026-11-07T10:13:05', 'S', 4210, { requestedBy: 'HYBRIS1', reason: 'Website showed stale stock' }),
  push('P-0103', 'D', ['1234', '0099', '2001', '3003'], '2026-11-07T10:00:00', '2026-11-07T10:00:12', 'E', 0, { error: 'Blob upload failed: 503 Server Busy' }),
  push('P-0102', 'M', ['1234', '2001'], '2026-11-07T09:40:00', '2026-11-07T09:40:03', 'S', 4, {
    requestedBy: 'HYBRIS2',
    reason: 'تصحيح مادتين',
    files: ['aldawaastocklevel-20261107094000-1.csv'],
  }),
  push('P-0101', 'F', ['1234', '2001', '3003'], '2026-11-07T03:00:00', '2026-11-07T03:11:00', 'S', 250000, {
    files: ['aldawaastocklevel-20261107030000-1.csv', 'aldawaastocklevel-20261107030000-2.csv', 'aldawaastocklevel-20261107030000-3.csv'],
  }),
  push('P-0050', 'F', ['0099'], '2026-10-20T03:00:00', '2026-10-20T03:04:00', 'S', 4100, { linesSwept: true }),
  push('P-0100', 'D', ['3003'], '2026-11-07T10:35:00', null, 'R', 0),
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
    { pushId: 'P-0105', type: 'D', status: 'S', target: 'shadow', sentAt: '2026-11-07T10:30:10', quantity: 3 },
    { pushId: 'P-0104', type: 'S', status: 'S', target: 'shadow', sentAt: '2026-11-07T10:12:30', quantity: 4 },
    { pushId: 'P-0102', type: 'M', status: 'S', target: 'shadow', sentAt: '2026-11-07T09:40:01', quantity: 0 },
  ],
}

/** The PREVIEW of the drive's upload file — what the door would read. `wasEnabled` from the list. */
export function previewOf(text, list) {
  const lines = text.split(/\r?\n/).map((l) => l.trim())
  const rows = []
  const seen = new Set()
  lines.forEach((raw, i) => {
    if (!raw || (i === 0 && !/\d/.test(raw))) return
    const [number, enabledCell] = raw.split(/[,;\t]/).map((c) => (c ?? '').trim())
    const line = i + 1
    const base = { line, materialNumber: number, materialName: '', enabled: null, wasEnabled: null }
    if (!/^\d{1,18}$/.test(number)) return rows.push({ ...base, outcome: 'refused', refusal: 'malformed' })
    const enabled = enabledCell === undefined || enabledCell === '' ? null : /^(1|true|yes|y)$/i.test(enabledCell) ? true : /^(0|false|no|n)$/i.test(enabledCell) ? false : 'bad'
    if (enabled === 'bad') return rows.push({ ...base, outcome: 'refused', refusal: 'badEnabled' })
    if (seen.has(number)) return rows.push({ ...base, outcome: 'refused', refusal: 'repeated' })
    seen.add(number)
    const listed = list.find((m) => m.materialNumber === number)
    if (!listed && !KNOWN_NOT_LISTED.includes(number)) return rows.push({ ...base, outcome: 'refused', refusal: 'unknownMaterial' })
    const name = listed?.materialName ?? `Material ${number}`
    if (!listed) return rows.push({ ...base, materialName: name, enabled, outcome: 'new', refusal: null })
    const changed = enabled !== null && enabled !== listed.enabled
    rows.push({ ...base, materialName: name, enabled, wasEnabled: listed.enabled, outcome: changed ? 'changed' : 'unchanged', refusal: null })
  })
  const counts = { new: 0, changed: 0, unchanged: 0, refused: 0 }
  for (const r of rows) counts[r.outcome]++
  return { rows, counts }
}

/**
 * Install the stubs on a page. Each browser context holds its OWN state (stores, materials, pushes),
 * so a write in one test never leaks into the next. `opts.access` (an object, or 403), `opts.mode`,
 * `opts.alerts`, `opts.status` ('ok' | 'fail'). Returns the recorded calls and a `gate` the drive
 * releases to finish a slow push.
 */
export async function installStubs(page, opts = {}) {
  const access = opts.access ?? { canView: true, canManage: true }
  const state = {
    stores: STORES.map((s) => ({ ...s, health: s.health && { ...s.health } })),
    history: structuredClone(STORE_HISTORY),
    materials: MATERIALS.map((m) => ({ ...m })),
    pushes: PUSHES.map((p) => ({ ...p })),
    previews: new Map(),
    uploads: 0,
  }
  const calls = []
  const reads = []
  const writes = []
  const gate = { release: null, waiting: false }
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.split('/api/')[1]
    const m = req.method()
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
      const marked = url.searchParams.get('marked')
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      return route.fulfill(
        envelope(
          state.stores.filter(
            (s) =>
              (!marked || (marked === 'marked') === s.marked) &&
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
        return route.fulfill(envelope(state.history[code] ?? []))
      }
      const body = json()
      writes.push({ method: m, path: p, body })
      if (body.reason === 'slow') {
        gate.waiting = true
        await new Promise((r) => (gate.release = r))
        gate.waiting = false
      }
      if (!body.reason || body.reason.trim().length > 200 || body.reason === 'trigger 00001') return route.fulfill(refuse('HYS-00001'))
      if (at < 0) return route.fulfill(refuse('HYS-00002'))
      if (verb === 'PushNow') {
        if (body.reason === 'trigger busy') return route.fulfill(refuse('HybrisStockPushBusy'))
        if (body.reason === 'trigger off') return route.fulfill(refuse('HYS-00010'))
        if (!state.stores[at].marked) return route.fulfill(refuse('HYS-00009'))
        const startedAt = '2026-11-07T10:40:00'
        if (body.reason === 'trigger 00011') {
          const failed = { ...PUSHES[2], pushId: 'P-0107', type: 'S', storeCodes: [code], startedAt, finishedAt: '2026-11-07T10:40:02', requestedBy: 'MSARTAWI', reason: body.reason }
          state.pushes.unshift(failed)
          state.stores[at] = { ...state.stores[at], health: { ...state.stores[at].health, lastError: 'Blob upload failed: 503 Server Busy', lastErrorAt: startedAt } }
          return route.fulfill(refuse('HYS-00011'))
        }
        const done = { ...PUSHES[1], pushId: 'P-0106', storeCodes: [code], startedAt, finishedAt: '2026-11-07T10:41:00', requestedBy: 'MSARTAWI', reason: body.reason, rows: 4300 }
        state.pushes.unshift(done)
        state.stores[at] = {
          ...state.stores[at],
          health: { ...state.stores[at].health, lastFullAt: startedAt, lastDeltaAt: startedAt, fullRequested: false, fullOverdue: false, deltaBehind: false, lastError: null, lastErrorAt: null },
        }
        return route.fulfill(envelope(done))
      }
      const s = state.stores[at]
      if (body.reason === 'trigger 00003' || (verb === 'Mark') === s.marked) return route.fulfill(refuse('HYS-00003'))
      const next =
        verb === 'Mark'
          ? { ...s, marked: true, changedAt: '2026-11-07T10:45:00', changedBy: 'MSARTAWI', health: health({ lastDeltaAt: null, lastFullAt: null, nextFullDue: null, fullRequested: true }) }
          : { ...s, marked: false, changedAt: '2026-11-07T10:45:00', changedBy: 'MSARTAWI', health: null }
      state.stores[at] = next
      ;(state.history[code] ??= []).unshift({ at: '2026-11-07T10:45:00', by: 'MSARTAWI', action: verb === 'Mark' ? 'mark' : 'unmark', reason: body.reason, door: 'oms-react' })
      return route.fulfill(envelope(next))
    }
    if (p === 'HybrisStockWeb/Pushes/Materials' && m === 'POST') {
      const body = json()
      writes.push({ method: m, path: p, body })
      if (body.reason === 'slow') {
        gate.waiting = true
        await new Promise((r) => (gate.release = r))
        gate.waiting = false
      }
      if (!body.reason || body.reason === 'trigger 00001') return route.fulfill(refuse('HYS-00001'))
      if (body.reason === 'trigger busy') return route.fulfill(refuse('HybrisStockPushBusy'))
      const unknown = body.materialNumbers.find((n) => !state.materials.some((x) => x.materialNumber === n))
      if (unknown) return route.fulfill(refuse('HYS-00004'))
      if (body.storeCodes.some((c) => !state.stores.find((s) => s.storeCode === c)?.marked)) return route.fulfill(refuse('HYS-00009'))
      const done = {
        ...PUSHES[3],
        pushId: 'P-0108',
        storeCodes: body.storeCodes,
        startedAt: '2026-11-07T10:50:00',
        finishedAt: '2026-11-07T10:50:02',
        rows: body.storeCodes.length * body.materialNumbers.length,
        requestedBy: 'MSARTAWI',
        reason: body.reason,
      }
      state.pushes.unshift(done)
      return route.fulfill(envelope(done))
    }

    // ── materials ──
    if (p === 'HybrisStockWeb/Materials' && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const q = (url.searchParams.get('q') ?? '').toLowerCase()
      const enabled = url.searchParams.get('enabled')
      const skip = Number(url.searchParams.get('skip') ?? 0)
      const take = Number(url.searchParams.get('take') ?? 50)
      const hits = state.materials.filter(
        (x) =>
          (!q || x.materialNumber.includes(q) || x.materialName.toLowerCase().includes(q)) &&
          (!enabled || (enabled === 'enabled') === x.enabled),
      )
      return route.fulfill(envelope({ total: hits.length, rows: hits.slice(skip, skip + take) }))
    }
    if (p === 'HybrisStockWeb/Materials' && m === 'POST') {
      const body = json()
      writes.push({ method: m, path: p, body })
      if (!body.reason || body.reason === 'trigger 00001') return route.fulfill(refuse('HYS-00001'))
      if (state.materials.some((x) => x.materialNumber === body.materialNumber)) return route.fulfill(refuse('HYS-00005'))
      if (!KNOWN_NOT_LISTED.includes(body.materialNumber)) return route.fulfill(refuse('HYS-00004'))
      const row = materialRow(body.materialNumber, { addedBy: 'MSARTAWI', updatedBy: 'MSARTAWI', addedAt: '2026-11-07T10:45:00', updatedAt: '2026-11-07T10:45:00' })
      state.materials.unshift(row)
      return route.fulfill(envelope(row))
    }
    const enabledMatch = p.match(/^HybrisStockWeb\/Materials\/([^/]+)\/Enabled$/)
    if (enabledMatch && m === 'PUT') {
      const n = decodeURIComponent(enabledMatch[1])
      const body = json()
      writes.push({ method: m, path: p, body })
      if (!body.reason || body.reason === 'trigger 00001') return route.fulfill(refuse('HYS-00001'))
      const at = state.materials.findIndex((x) => x.materialNumber === n)
      if (at < 0) return route.fulfill(refuse('HYS-00004'))
      state.materials[at] = { ...state.materials[at], enabled: body.enabled, updatedBy: 'MSARTAWI', updatedAt: '2026-11-07T10:46:00' }
      return route.fulfill(envelope(state.materials[at]))
    }
    if (p === 'HybrisStockWeb/Materials/Upload/Preview' && m === 'POST') {
      const raw = req.postDataBuffer()?.toString('utf8') ?? ''
      const nameMatch = raw.match(/filename="([^"]+)"/)
      const fileName = nameMatch?.[1] ?? 'upload.csv'
      const content = raw.split(/\r\n\r\n/).slice(1).join('\r\n\r\n').replace(/\r\n--[^\r\n]*--\r\n$/, '')
      writes.push({ method: m, path: p, fileName, hasFilePart: /name="file"/.test(raw), content })
      if (/no-column/.test(fileName)) return route.fulfill(refuse('HYS-00007'))
      const { rows, counts } = previewOf(content, state.materials)
      const uploadId = `U-${++state.uploads}`
      state.previews.set(uploadId, rows)
      return route.fulfill(envelope({ uploadId, fileName, counts, rows }))
    }
    const commitMatch = p.match(/^HybrisStockWeb\/Materials\/Upload\/([^/]+)\/Commit$/)
    if (commitMatch && m === 'POST') {
      const id = decodeURIComponent(commitMatch[1])
      const body = json()
      writes.push({ method: m, path: p, body })
      if (!body.reason || body.reason === 'trigger 00001') return route.fulfill(refuse('HYS-00001'))
      const rows = state.previews.get(id)
      if (!rows || body.reason === 'trigger 00006') return route.fulfill(refuse('HYS-00006'))
      state.previews.delete(id)
      let added = 0
      let changed = 0
      for (const r of rows) {
        if (r.outcome === 'new') {
          state.materials.unshift(materialRow(r.materialNumber, { enabled: r.enabled ?? true, addedBy: 'MSARTAWI' }))
          added++
        }
        if (r.outcome === 'changed') {
          const at = state.materials.findIndex((x) => x.materialNumber === r.materialNumber)
          state.materials[at] = { ...state.materials[at], enabled: r.enabled }
          changed++
        }
      }
      const count = (o) => rows.filter((r) => r.outcome === o).length
      return route.fulfill(envelope({ uploadId: id, added, changed, unchanged: count('unchanged'), refused: count('refused') }))
    }
    if (p === 'HybrisStockWeb/Materials/Download' && m === 'GET') {
      reads.push({ path: p, search: '' })
      const csv = ['MaterialNumber,Enabled', ...state.materials.map((x) => `${x.materialNumber},${x.enabled ? 1 : 0}`)].join('\r\n')
      return route.fulfill({ status: 200, contentType: 'text/csv', headers: { 'Content-Disposition': 'attachment; filename="hybris-stock-materials.csv"' }, body: csv })
    }

    // ── pushes ──
    if (p === 'HybrisStockWeb/Pushes' && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const qs = url.searchParams
      const store = qs.get('store')
      const type = qs.get('type')
      const status = qs.get('status')
      const from = qs.get('from')
      const to = qs.get('to')
      const skip = Number(qs.get('skip') ?? 0)
      const take = Number(qs.get('take') ?? 50)
      const hits = state.pushes.filter(
        (x) =>
          (!store || x.storeCodes.includes(store)) &&
          (!type || x.type === type) &&
          (!status || x.status === status) &&
          (!from || x.startedAt.slice(0, 10) >= from) &&
          (!to || x.startedAt.slice(0, 10) <= to),
      )
      return route.fulfill(envelope({ total: hits.length, rows: hits.slice(skip, skip + take) }))
    }
    const linesMatch = p.match(/^HybrisStockWeb\/Pushes\/([^/]+)\/Lines$/)
    if (linesMatch && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const id = decodeURIComponent(linesMatch[1])
      if (!state.pushes.some((x) => x.pushId === id)) return route.fulfill(refuse('HYS-00008'))
      const store = url.searchParams.get('store')
      const material = url.searchParams.get('material')
      const skip = Number(url.searchParams.get('skip') ?? 0)
      const take = Number(url.searchParams.get('take') ?? 200)
      const all = (LINES[id] ?? []).filter((l) => (!store || l.storeCode === store) && (!material || l.materialNumber === material))
      return route.fulfill(envelope({ pushId: id, total: all.length, lines: all.slice(skip, skip + take) }))
    }
    const histMatch = p.match(/^HybrisStockWeb\/Stores\/([^/]+)\/Materials\/([^/]+)\/History$/)
    if (histMatch && m === 'GET') {
      reads.push({ path: p, search: url.search.slice(1) })
      const key = `${decodeURIComponent(histMatch[1])}/${decodeURIComponent(histMatch[2])}`
      return route.fulfill(envelope(MATERIAL_HISTORY[key] ?? []))
    }
    return route.fulfill(envelope(null, { status: 404, success: false, message: `no stub for ${m} ${p}` }))
  })
  return { state, calls, reads, writes, gate }
}
