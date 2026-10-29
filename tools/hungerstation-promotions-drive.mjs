// HungerStation promotions drive (oms-react 665–671, BackOffice spec 3201).
//
// Drives the REAL app in Chromium against STUBS of the HungerStation promotion doors. The doors are
// built (BackOffice 3211–3216) and their shapes are the door contract asset
// (C:\Work\DMSCO\BackOffice\.issues\assets\3201-hungerstation-promotion-door-contract.md) — but this
// drive still never calls a live SIS.Api. § 0 PROVES, three ways, that nothing drifts: every fixture
// emits exactly its model interface's fields, every model interface is exactly the contract asset's
// own JSON example (parsed from the asset), and every body the browser sends is exactly its model.
// Every answer rides the REAL envelope { statusCode, success, message, errors: [{ errorCode,
// internalErrorCode, errorMessage }], data }; a refusal carries only its `message` (the contract has
// no structured refusal data); a missing grant is a BARE 403 (no envelope).
//
// ── Extending it ─────────────────────────────────────────────────────────────────────────────────
// The stub server is the `DOORS` table: ONE entry per door of the contract. The write doors answer
// 501 `NOT_STUBBED` unless a scenario fills them, so an unexpected call fails loudly. A scenario bends
// a door by passing `open(dir, { doors: { send: (ctx, m, req) => … } })`. Every call lands in
// `ctx.calls` as { door, method, path, query, body }. Fixture builders (`row`, `detail`, `part`,
// `store`, `item`, `send`, `issue`, `checkOf`) take overrides.
//
// Sections: 0 contract + fixtures · 1–5 ticket 665 (list, detail, RTL) · 6–9 ticket 666 (editor,
// save, send, refresh, refusals, a typed chain, RTL) · 10 ticket 669 (refusals per store, Resend,
// the light poll) · 11 ticket 667 (the Check panel; review B1/B2: a Check in flight holds the form) ·
// 12 ticket 668 (the same-item bundle and its part preview) · 13 ticket 670 (the in-place edit,
// Remove items) · 14 ticket 671 (Replace, Switch off, a partial and a failed switch-off, the
// Scheduled / Ended / store filters; review B7: a cancelled Replace never comes back) · 15 review
// B3 (a promotion reading Sending is polled whatever its parts say).
//
// The browser runs in Asia/Riyadh at 2026-10-29 11:00 local.
//
//   1. run the app:  npx vite --port 5265 --strictPort
//   2. DRIVE_PORT=5265 node tools/hungerstation-promotions-drive.mjs
import { createRequire } from 'node:module'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.hungerstation-promotions-shots'
const CONTRACT = 'C:/Work/DMSCO/BackOffice/.issues/assets/3201-hungerstation-promotion-door-contract.md'
mkdirSync(SHOTS, { recursive: true })

/** `ONLY=6,13` runs just those sections (§ 0 always runs). */
const ONLY = process.env.ONLY ? process.env.ONLY.split(',') : null
const want = (s) => !ONLY || ONLY.includes(s)

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// ── The envelope ───────────────────────────────────────────────────────────────────────────────

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
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
/** A missing grant: a BARE 403, no envelope. */
const bare403 = { status: 403, contentType: 'text/plain', body: '' }

/** Every refusal the doors name (contract § Error codes), `<English> / <Arabic>`, data `null`. */
const REFUSALS = {
  'DHS-00006': [404, 'No such HungerStation chain. / لا توجد سلسلة هنقرستيشن بهذا الاسم.'],
  'DHS-00008': [400, 'A reason is required (1–200 characters). / السبب مطلوب (1–200 حرف).'],
  'DHS-00014': [502, 'HungerStation refused or could not be reached. / رفضت هنقرستيشن أو تعذر الوصول إليها.'],
  'DHS-00016': [404, 'No such HungerStation promotion. / لا يوجد عرض ترويجي لهنقرستيشن بهذا المعرّف.'],
  'DHS-00017': [409, 'The promotion is still sending: wait, reload, retry. / العرض ما زال قيد الإرسال.'],
  'DHS-00018': [400, 'The promotion cannot be sent: row 2: material 101002 is not on the HungerStation material list. / لا يمكن إرسال العرض.'],
  'DHS-00019': [409, 'The promotion cannot be sent: the name is in use by another live promotion. / الاسم مستخدم.'],
  'DHS-00020': [409, "Replace stopped: HungerStation did not switch off part 1 'Ramadan' (Vendor promotion locked). Nothing new was sent. / توقف الاستبدال."],
  'DHS-00021': [409, 'Changing the name, stores, start or end replaces the promotion: use Replace. / تغيير الاسم أو الفروع أو البداية أو النهاية يستبدل العرض: استخدم الاستبدال.'],
  HungerStationPromotionSent: [409, 'The promotion is no longer a draft. / لم يعد العرض مسودة.'],
  NOT_STUBBED: [501, 'This door is not stubbed in the drive yet.'],
}
const refuse = (code, message) => {
  const [status, words] = REFUSALS[code]
  return envelope(null, { status, success: false, message: message ?? words, errorCode: code })
}

// ── Fixtures: one builder per model interface, each emitting EXACTLY its fields ────────────────

const AT = '2026-10-29T11:00:00'

const row = (promotionId, over = {}) => ({
  promotionId,
  chainKey: 'OlaCare',
  name: `Promotion ${promotionId}`,
  type: 'STRIKETHROUGH',
  status: 'live',
  startAt: '2026-11-01T00:00:00',
  endAt: '2026-11-30T23:59:00',
  storeCount: 42,
  itemCount: 1000,
  updatedAt: '2026-10-28T09:29:00',
  updatedBy: 'aalharbi',
  sentAt: '2026-10-28T09:30:00',
  ...over,
})

const NO_REFUSALS = () => ({ invalidVendors: [], missingSkus: [], invalidDiscountedSkus: [] })

const part = (partId, over = {}) => ({
  partId,
  partNo: 1,
  name: 'Ramadan',
  combination: 'ALL',
  active: true,
  status: 'live',
  refusals: NO_REFUSALS(),
  ...over,
})

const store = (storeCode, over = {}) => ({ storeCode, storeName: `صيدلية ${storeCode}`, vendorId: `v-${storeCode}`, syncActive: true, ...over })

let rowNo = 0
const item = (materialNumber, over = {}) => ({
  rowNo: ++rowNo,
  materialNumber,
  sku: `SKU-${materialNumber}`,
  subtype: 'PERCENTAGE',
  value: 20,
  maxQuantity: null,
  buyQuantity: null,
  getQuantity: null,
  partId: 'pt-1',
  active: true,
  ...over,
})

const send = (sendId, over = {}) => ({
  sendId,
  partId: 'pt-1',
  kind: 'UPSERT',
  httpStatus: 202,
  jobId: `job-${sendId}`,
  jobStatus: 'COMPLETED',
  hsCreatedAt: '2026-10-28T09:30:02',
  hsUpdatedAt: '2026-10-28T09:31:40',
  result: null,
  error: null,
  sentAt: '2026-10-28T09:30:00',
  sentBy: 'msartawi',
  reason: 'Ramadan launch',
  attempts: 2,
  lastAttemptAt: '2026-10-28T09:31:40',
  ...over,
})

const detail = (r, over = {}) => ({
  promotionId: r.promotionId,
  chainKey: r.chainKey,
  name: r.name,
  displayNameEn: `${r.name} — up to 20% off`,
  displayNameAr: 'خصم حتى ٢٠٪',
  type: r.type,
  hsReason: 'COMPETITIVENESS',
  startAt: r.startAt,
  endAt: r.endAt,
  orderLimit: null,
  globalLimit: null,
  defaultSubtype: 'PERCENTAGE',
  defaultValue: 20,
  currencyKey: 'SAR',
  allStores: false,
  status: r.status,
  replacesPromotionId: null,
  createdAt: '2026-10-27T14:00:00',
  createdBy: 'msartawi',
  updatedAt: r.updatedAt,
  updatedBy: r.updatedBy,
  sentAt: r.sentAt,
  sentBy: r.sentAt ? 'msartawi' : null,
  replacedByPromotionId: null,
  switchedOffAt: null,
  switchedOffBy: null,
  switchedOffReason: null,
  stores: [store('1001'), store('1002')],
  items: [item('101001'), item('101002'), item('101003')],
  parts: [part('pt-1', { name: r.name })],
  sends: [send('s-1')],
  ...over,
})

/** One Check issue (a refusal or the price warning). */
const issue = (over = {}) => ({ code: 'materialNotListed', field: 'materialNumber', rowNo: 1, materialNumber: '101001', storeCodes: [], message: 'server words / كلمات', ...over })
/** A Check answer: clean unless told otherwise. */
const checkOf = (promotionId, over = {}) => ({ promotionId, canSend: true, itemCount: 0, duplicateCount: 0, refusals: [], warnings: [], parts: [], ...over })
const previewPart = (over = {}) => ({ partNo: 1, combination: 'ALL', buyQuantity: null, getQuantity: null, subtype: null, value: null, skuCount: 1, name: 'Ramadan', ...over })

const STATUSES = ['draft', 'sending', 'live', 'livePartlyRefused', 'failed', 'switchedOff', 'replaced', 'scheduled', 'ended']
const STATUS_WORDS = ['Draft', 'Sending', 'Live', 'Live with refusals', 'Failed', 'Switched off', 'Replaced', 'Scheduled', 'Ended']

/** One row per status, a bundle, two chains, and one status the contract does not name. */
const freshRows = () => [
  row('p-live', { name: 'Ramadan', status: 'live' }),
  row('p-refused', { name: 'Eid B2G1', type: 'SAME_ITEM_BUNDLE', status: 'livePartlyRefused', itemCount: 3, storeCount: 3 }),
  row('p-draft', { name: 'Winter draft', status: 'draft', sentAt: null }),
  row('p-sending', { name: 'Flu season', status: 'sending' }),
  row('p-failed', { name: 'Vitamins', status: 'failed' }),
  row('p-off', { name: 'Back to school', status: 'switchedOff' }),
  row('p-replaced', { name: 'Summer v1', status: 'replaced' }),
  row('p-scheduled', { name: 'National Day', status: 'scheduled', chainKey: 'AlDawaa', startAt: '2026-12-01T00:00:00', endAt: '2026-12-02T23:59:00' }),
  row('p-ended', { name: 'Hajj', status: 'ended', startAt: '2026-06-01T00:00:00', endAt: '2026-06-10T23:59:00' }),
  row('p-unknown', { name: 'Mystery', status: 'paused' }),
]

/** The details the drive opens; any other row reads its default detail. */
const DETAILS = {
  'p-refused': (r) =>
    detail(r, {
      displayNameAr: 'اشترِ ٢ واحصل على ١',
      hsReason: 'OVERSTOCK',
      orderLimit: 2,
      globalLimit: 5000,
      parts: [
        part('pt-a', { partNo: 1, name: 'Eid B2G1 · B2G1 50%', combination: 'B2G1|PERCENTAGE|50' }),
        // Unanswered for 24 hours (contract 3214): it reads Failed, its latest job still QUEUED.
        part('pt-b', { partNo: 2, name: 'Eid B2G1 · B3G1 5 SAR', combination: 'B3G1|ABSOLUTE|5', status: 'failed', refusals: null }),
      ],
      stores: [store('1001'), store('1002', { storeName: '' }), store('2001', { vendorId: 'hs-77821' })],
      items: [
        item('201001', { partId: 'pt-a', subtype: 'PERCENTAGE', value: 50, buyQuantity: 2, getQuantity: 1, maxQuantity: 6 }),
        item('201002', { partId: 'pt-a', subtype: 'PERCENTAGE', value: 50, buyQuantity: 2, getQuantity: 1 }),
        item('201003', { partId: 'pt-b', subtype: 'ABSOLUTE', value: 5, buyQuantity: 3, getQuantity: 1 }),
        item('201004', { partId: 'pt-b', subtype: 'ABSOLUTE', value: 5, buyQuantity: 3, getQuantity: 1, active: false }),
      ],
      // OLDEST first, as the contract sends them: the sheet must show them newest first.
      sends: [
        send('s-b0', { partId: 'pt-b', sentAt: '2026-10-28T09:15:00', sentBy: 'aalharbi', httpStatus: 503, jobId: null, jobStatus: null, error: 'HungerStation unavailable', attempts: 0, lastAttemptAt: null }),
        send('s-a1', { partId: 'pt-a', sentAt: '2026-10-28T09:30:00', reason: 'إطلاق العيد' }),
        send('s-b1', { partId: 'pt-b', sentAt: '2026-10-28T09:30:05', jobStatus: 'QUEUED', hsUpdatedAt: null, error: 'HungerStation has not answered this job in 24 hours.', attempts: 1440 }),
      ],
    }),
  'p-draft': (r) =>
    detail(r, {
      allStores: true,
      // A draft on "all stores" lists the stores it targets NOW (contract § The promotion row).
      stores: [store('1001'), store('1002', { syncActive: false }), store('2001')],
      parts: [],
      sends: [],
      items: [item('301001', { sku: null, partId: null, subtype: null, value: null })],
    }),
  'p-off': (r) => detail(r, { switchedOffAt: '2026-10-20T10:00:00', switchedOffBy: 'msartawi', switchedOffReason: 'Stopped', parts: [part('pt-1', { name: r.name, active: false, status: 'switchedOff' })] }),
  'p-replaced': (r) =>
    detail(r, { replacedByPromotionId: 'p-live', switchedOffAt: '2026-10-20T10:00:00', switchedOffBy: 'msartawi', switchedOffReason: 'Moved', parts: [part('pt-1', { name: r.name, active: false, status: 'switchedOff' })] }),
}
const detailOf = (r) => (DETAILS[r.promotionId] ?? detail)(r)

/** 245 more live rows, so the list pages past the first 50. */
const extraRows = () => Array.from({ length: 245 }, (_, i) => row(`p-x${String(i + 1).padStart(3, '0')}`, { name: `Bulk ${String(i + 1).padStart(3, '0')}` }))

function listAnswer(qs, rows) {
  const status = qs.get('status')
  const chain = qs.get('chain')
  const q = (qs.get('q') ?? '').toLowerCase()
  const at = qs.get('store')
  const hits = rows.filter(
    (r) =>
      (!status || status === 'any' || r.status === status) &&
      (!chain || r.chainKey === chain) &&
      (!q || r.name.toLowerCase().includes(q)) &&
      (!at || detailOf(r).stores.some((s) => s.storeCode === at)),
  )
  const skip = Number(qs.get('skip') ?? 0)
  const take = Number(qs.get('take') ?? 50)
  return { total: hits.length, rows: hits.slice(skip, skip + take) }
}

const storeChoice = (s) => ({ storeCode: s.storeCode, storeName: s.storeName, vendorId: s.vendorId, syncActive: s.syncActive })

// ── The stub doors: ONE entry per door of the contract ─────────────────────────────────────────
// `handle(ctx, m, req, url)` returns what `route.fulfill` takes. Order matters only where a path
// could match two patterns (`Stores` before `{id}`).

const P = 'HungerStationWeb/Promotions'
const notStubbed = () => refuse('NOT_STUBBED')
const findRow = (ctx, m) => ctx.rows.find((r) => r.promotionId === decodeURIComponent(m[1]))

const DOORS = [
  { door: 'list', method: 'GET', path: new RegExp(`^${P}$`), handle: (ctx, _m, _req, url) => envelope(listAnswer(url.searchParams, ctx.rows)) },
  {
    door: 'stores',
    method: 'GET',
    path: new RegExp(`^${P}/Stores$`),
    handle: () => envelope([storeChoice(store('1001')), storeChoice(store('1002', { syncActive: false })), storeChoice(store('2001'))]),
  },
  {
    door: 'read',
    method: 'GET',
    path: new RegExp(`^${P}/([^/]+)$`),
    handle: (ctx, m) => {
      const r = findRow(ctx, m)
      return r ? envelope(detailOf(r)) : refuse('DHS-00016')
    },
  },
  { door: 'create', method: 'POST', path: new RegExp(`^${P}$`), handle: notStubbed },
  { door: 'save', method: 'PUT', path: new RegExp(`^${P}/([^/]+)$`), handle: notStubbed },
  { door: 'check', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Check$`), handle: (_ctx, m) => envelope(checkOf(decodeURIComponent(m[1]))) },
  { door: 'send', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Send$`), handle: notStubbed },
  { door: 'refresh', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Refresh$`), handle: notStubbed },
  { door: 'resend', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Parts/([^/]+)/Resend$`), handle: notStubbed },
  { door: 'removeItems', method: 'POST', path: new RegExp(`^${P}/([^/]+)/RemoveItems$`), handle: notStubbed },
  { door: 'replace', method: 'POST', path: new RegExp(`^${P}/([^/]+)/Replace$`), handle: notStubbed },
  { door: 'switchOff', method: 'POST', path: new RegExp(`^${P}/([^/]+)/SwitchOff$`), handle: notStubbed },
]

// ── § 0: the contract ⇄ the models ⇄ the fixtures ─────────────────────────────────────────────

const MODELS = readFileSync('src/core/models/hungerstation.ts', 'utf8')

/** The field names of `interface <name>` in the model file, `extends` included. */
function modelFields(name, source = MODELS) {
  const m = new RegExp(`export interface ${name}(?: extends ([\\w, ]+))? \\{([\\s\\S]*?)\\n\\}`).exec(source)
  if (!m) throw new Error(`no interface ${name}`)
  const own = [...m[2].matchAll(/^ {2}(\w+)\??:/gm)].map((f) => f[1])
  const inherited = (m[1] ?? '').split(',').map((s) => s.trim()).filter(Boolean).flatMap((parent) => modelFields(parent, source))
  return [...inherited, ...own]
}
const keysOf = (o) => Object.keys(o ?? {}).sort()
const same = (a, b) => JSON.stringify([...a].sort()) === JSON.stringify([...b].sort())

/** A fixture (or a body the browser sent) has exactly its model's fields. */
function sameKeys(label, name, obj, drop = []) {
  const want = modelFields(name).filter((f) => !drop.includes(f)).sort()
  check(label, same(want, keysOf(obj)), `model ${want.join(',')} | got ${keysOf(obj).join(',')}`)
}

/**
 * The contract asset's own JSON examples, parsed: the promotion row (§ 3211, plus the four keys
 * 3216 adds in prose), the list page, the save body, the Check answer, a part's refusals and the
 * Replace body. Each `json` fence is picked by what it holds; HungerStation's own request bodies
 * (`display_name`) are not ours and are skipped.
 */
function contractExamples() {
  const md = readFileSync(CONTRACT, 'utf8').replace(/\r\n/g, '\n')
  const blocks = [...md.matchAll(/```json\n([\s\S]*?)```/g)].map((b) => b[1].trim()).filter((b) => !b.includes('display_name'))
  const pick = (test) => {
    const b = blocks.find(test)
    if (!b) throw new Error('a contract example is missing')
    return JSON.parse(b.startsWith('"') ? `{${b}}` : b)
  }
  const promotion = pick((b) => b.includes('"sends"'))
  // 3216 "The promotion row gains four keys" — said in prose, not in the example.
  for (const k of ['replacedByPromotionId', 'switchedOffAt', 'switchedOffBy', 'switchedOffReason']) {
    if (!md.includes(`\`${k}\``)) throw new Error(`the contract no longer names ${k}`)
    promotion[k] = null
  }
  return {
    promotion,
    page: pick((b) => b.includes('"total"')),
    saveBody: pick((b) => b.includes('"storeCodes": null') && b.includes('"items"')),
    check: pick((b) => b.includes('"canSend"')),
    refusals: pick((b) => b.startsWith('"refusals"')).refusals,
    replaceBody: pick((b) => b.includes('"allStores": null')),
  }
}

if (!existsSync(CONTRACT)) check('0: the door contract asset is readable', false, CONTRACT)
else {
  const c = contractExamples()
  // The models are the contract, field for field.
  const pairs = [
    ['HungerStationPromotionDetail', c.promotion],
    ['HungerStationPromotionStore', c.promotion.stores[0]],
    ['HungerStationPromotionStoreChoice', c.promotion.stores[0]],
    ['HungerStationPromotionItem', c.promotion.items[0]],
    ['HungerStationPromotionPart', c.promotion.parts[0]],
    ['HungerStationPromotionSend', c.promotion.sends[0]],
    ['HungerStationPromotionsPage', c.page],
    ['HungerStationPromotionRow', c.page.rows[0]],
    ['HungerStationPromotionSaveBody', c.saveBody],
    ['HungerStationPromotionItemInput', c.saveBody.items[0]],
    ['HungerStationPromotionCheck', c.check],
    ['HungerStationPromotionCheckIssue', c.check.refusals[0]],
    ['HungerStationPromotionPartPreview', c.check.parts[0]],
    ['HungerStationPromotionRefusals', c.refusals],
    ['HungerStationPromotionVendorRef', c.refusals.invalidVendors[0]],
    ['HungerStationPromotionSkuRefusal', c.refusals.missingSkus[0]],
    ['HungerStationPromotionSkuRef', c.refusals.missingSkus[0].items[0]],
    ['HungerStationPromotionReplaceBody', c.replaceBody],
  ]
  for (const [name, example] of pairs) sameKeys(`0: ${name} is exactly the contract's example`, name, example)
  sameKeys("0: HungerStationPromotionSaved is the promotion row plus `check` (contract 3212)", 'HungerStationPromotionSaved', { ...c.promotion, check: null })
  check('0: the contract list `take` is 50, at most 200', /take` defaults to 50\s+\(1 to 200\)/.test(readFileSync(CONTRACT, 'utf8')) && /default: 50, max: 200/.test(MODELS))

  // The fixtures are the models.
  const r = freshRows()[1]
  const d = detailOf(r)
  sameKeys('0: the row fixture is exactly HungerStationPromotionRow', 'HungerStationPromotionRow', r)
  sameKeys('0: the list answer is exactly HungerStationPromotionsPage', 'HungerStationPromotionsPage', listAnswer(new URLSearchParams(), freshRows()))
  sameKeys('0: the detail fixture is exactly HungerStationPromotionDetail', 'HungerStationPromotionDetail', d)
  sameKeys('0: the part fixture is exactly HungerStationPromotionPart', 'HungerStationPromotionPart', d.parts[0])
  sameKeys('0: the store fixture is exactly HungerStationPromotionStore', 'HungerStationPromotionStore', d.stores[0])
  sameKeys('0: the item fixture is exactly HungerStationPromotionItem', 'HungerStationPromotionItem', d.items[0])
  sameKeys('0: the send fixture is exactly HungerStationPromotionSend', 'HungerStationPromotionSend', d.sends[0])
  sameKeys('0: the store choice is exactly HungerStationPromotionStoreChoice', 'HungerStationPromotionStoreChoice', storeChoice(store('1001')))
  sameKeys('0: the Check answer is exactly HungerStationPromotionCheck', 'HungerStationPromotionCheck', checkOf('p'))
  sameKeys('0: a Check issue is exactly HungerStationPromotionCheckIssue', 'HungerStationPromotionCheckIssue', issue())
  sameKeys('0: a previewed part is exactly HungerStationPromotionPartPreview', 'HungerStationPromotionPartPreview', previewPart())
  sameKeys('0: the access probe is the four flags', 'HungerStationAccessResult', { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManagePromotions: true })
}

// ── The browser ──────────────────────────────────────────────────────────────────────────────

const ALL = { canManageStores: true, canManageCatalog: true, canViewOrders: true, canManagePromotions: true }
const ELEVEN = new Date('2026-10-29T11:00:00+03:00')

const browser = await chromium.launch()

async function open(dir, { access = ALL, chains = 'ok', many = false, doors = {} } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  await page.clock.setFixedTime(ELEVEN)
  const ctx = { rows: many ? [...freshRows(), ...extraRows()] : freshRows(), calls: [] }
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (4\d\d|502)/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'HungerStationWeb/Access') return route.fulfill(envelope(access))
    if (p === 'HungerStationWeb/Chains') return route.fulfill(chains === 'ok' ? envelope(['OlaCare', 'AlDawaa']) : bare403)
    for (const d of DOORS) {
      const m = req.method() === d.method ? d.path.exec(p) : null
      if (!m) continue
      let body = null
      try {
        body = req.postDataJSON()
      } catch {
        body = req.postData()
      }
      ctx.calls.push({ door: d.door, method: d.method, path: p, query: url.search.slice(1), body })
      if (!access.canManagePromotions) return route.fulfill(bare403)
      return route.fulfill(await (doors[d.door] ?? d.handle)(ctx, m, req, url))
    }
    if (/Access$/.test(p)) return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, ctx }
}

const GRID = '[data-promotions-grid]'
const lists = (ctx) => ctx.calls.filter((c) => c.door === 'list').map((c) => c.query)
const callsOf = (ctx, door) => ctx.calls.filter((c) => c.door === door)

/** Wait until the grid holds `n` rows and has settled. */
const waitRows = async (page, n) => {
  await page
    .waitForFunction(
      (count) =>
        new Set([...document.querySelectorAll('[data-promotions-grid] .ag-row[row-index]')].map((r) => r.getAttribute('row-index'))).size === count &&
        !document.querySelector('[data-promotions-grid] .ag-overlay-loading-center'),
      n,
      { timeout: 20000 },
    )
    .catch(async (e) => {
      const seen = await page.evaluate(() => document.querySelectorAll('[data-promotions-grid] .ag-row[row-index]').length)
      console.log(`waitRows(${n}) timed out at ${page.url()} — ${seen} row elements`)
      throw e
    })
  await page.waitForTimeout(150)
}
const cellLoc = (page, id, colId) => page.locator(`${GRID} .ag-row[row-id="${id}"] [col-id="${colId}"]`)
const cell = async (page, id, colId) => ((await cellLoc(page, id, colId).count()) ? (await cellLoc(page, id, colId).innerText()).trim() : null)
const search = (page) => new URL(page.url()).searchParams
const N = freshRows().length
const strip = (t) => t.replace(/[⁦-⁩]/g, '').trim()

const chip = async (page, s) => {
  const loc = page.locator(`[data-filter-status="${s}"]`)
  const was = await loc.getAttribute('aria-pressed')
  await loc.click()
  await page.waitForFunction(([sel, w]) => document.querySelector(sel)?.getAttribute('aria-pressed') !== w, [`[data-filter-status="${s}"]`, was])
}

// ── 1: the menu leaf and the gate ──────────────────────────────────────────────────────────────
if (want('1')) {
  const { context, page, errors } = await open('ltr')
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  const leaf = page.locator('nav a[href="/hungerstation/promotions"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Promotions leaf shows with canManagePromotions', (await leaf.innerText()).includes('Promotions'))
  await leaf.click()
  await waitRows(page, N)
  check('1: the leaf opens the list', new URL(page.url()).pathname === '/hungerstation/promotions')
  check('1: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
if (want('1')) {
  const { context, page, ctx } = await open('ltr', { access: { ...ALL, canManagePromotions: false } })
  await page.goto(`${BASE}/`)
  const header = page.locator('nav button[aria-expanded]', { hasText: /^HungerStation$/ })
  await header.first().waitFor({ timeout: 20000 })
  await header.first().click()
  await page.locator('nav a[href="/hungerstation/orders"]').first().waitFor({ timeout: 15000 })
  check('1: without canManagePromotions the leaf is hidden (the others stay)', (await page.locator('nav a[href="/hungerstation/promotions"]').count()) === 0)
  await page.goto(`${BASE}/hungerstation/promotions`)
  await page.getByText('No access to HungerStation promotions').waitFor({ timeout: 20000 })
  check('1: the URL shows the denied card, and NO promotions door is called', ctx.calls.length === 0, JSON.stringify(ctx.calls))
  await context.close()
}

// ── 2–3: the list, its filters and paging ──────────────────────────────────────────────────────
if (want('2')) {
  const { context, page, errors, ctx } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/promotions`)
  await waitRows(page, N)
  check('2: a bare URL sends the first page of 50 (the contract default), no filter', lists(ctx)[0] === 'skip=0&take=50', lists(ctx)[0])
  const headers = await page.locator(`${GRID} .ag-header-cell-text`).allInnerTexts()
  const want = ['Name', 'Chain', 'Type', 'Status', 'Window', 'Stores', 'Items', 'Sent at', 'Updated at', 'Updated by', 'Actions']
  check('2: every column of the contract row', JSON.stringify(headers) === JSON.stringify(want), headers.join(' | '))
  const words = []
  for (const s of STATUSES) words.push(await cell(page, freshRows().find((r) => r.status === s).promotionId, 'status'))
  check('2: the nine statuses in words', JSON.stringify(words) === JSON.stringify(STATUS_WORDS), words.join(' | '))
  check('2: a status the contract does not name is shown as itself', (await cell(page, 'p-unknown', 'status')) === 'paused')
  check('2: the type in words', (await cell(page, 'p-refused', 'type')) === 'Same-item bundle' && (await cell(page, 'p-live', 'type')) === 'Strikethrough')
  check('2: the window is the local start and end as ONE range', (await cell(page, 'p-live', 'window')) === '2026-11-01 00:00 – 2026-11-30 23:59', await cell(page, 'p-live', 'window'))
  check('2: store and item counts', (await cell(page, 'p-refused', 'storeCount')) === '3' && (await cell(page, 'p-refused', 'itemCount')) === '3')
  check('2: sent at, updated at and by', (await cell(page, 'p-live', 'sentAt')) === '2026-10-28 09:30' && (await cell(page, 'p-live', 'updatedAt')) === '2026-10-28 09:29' && (await cell(page, 'p-live', 'updatedBy')) === 'aalharbi')
  check('2: a never-sent draft has no sent time', (await cell(page, 'p-draft', 'sentAt')) === '')
  check('2: the count', (await page.locator('[data-status-count]').innerText()).trim() === `${N} promotions`)
  await page.screenshot({ path: `${SHOTS}/ltr-list.png` })

  // Chain.
  const chainOpts = await page.locator('[data-filter-chain] option').evaluateAll((els) => els.map((e) => e.value))
  check('3: the chain filter offers the Chains read', JSON.stringify(chainOpts) === JSON.stringify(['', 'AlDawaa', 'OlaCare']), chainOpts.join())
  await page.locator('[data-filter-chain]').selectOption('AlDawaa')
  await waitRows(page, 1)
  check('3: chain → URL and door', search(page).get('chain') === 'AlDawaa' && lists(ctx).at(-1) === 'chain=AlDawaa&skip=0&take=50', lists(ctx).at(-1))
  await page.locator('[data-filter-chain]').selectOption('')
  await waitRows(page, N)

  // The contract's list has no type filter.
  check('3: no type filter (the contract list door takes none)', (await page.locator('[data-filter-type]').count()) === 0)

  // ONE status: a chip picks it, another replaces it, Any drops it.
  check('3: Any status is on by default', (await page.locator('[data-filter-status="any"]').getAttribute('aria-pressed')) === 'true')
  await chip(page, 'live')
  await waitRows(page, 1)
  check('3: a status chip → URL and door', search(page).get('status') === 'live' && lists(ctx).at(-1) === 'status=live&skip=0&take=50', lists(ctx).at(-1))
  await chip(page, 'livePartlyRefused')
  await waitRows(page, 1)
  check(
    '3: another status REPLACES it (the door takes one)',
    JSON.stringify(search(page).getAll('status')) === JSON.stringify(['livePartlyRefused']) &&
      lists(ctx).at(-1) === 'status=livePartlyRefused&skip=0&take=50' &&
      (await page.locator('[data-filter-status="live"]').getAttribute('aria-pressed')) === 'false',
    lists(ctx).at(-1),
  )
  await chip(page, 'any')
  await waitRows(page, N)
  check('3: Any drops the status', search(page).get('status') === null && lists(ctx).at(-1) === 'skip=0&take=50')

  // Name text lands on Search only.
  await page.locator('[data-filter-q]').fill('eid')
  const before = lists(ctx).length
  await page.waitForTimeout(300)
  check('3: typing a name sends nothing', lists(ctx).length === before)
  await page.locator('[data-promotions-search]').click()
  await waitRows(page, 1)
  check('3: Search sends the name', search(page).get('q') === 'eid' && lists(ctx).at(-1) === 'q=eid&skip=0&take=50', lists(ctx).at(-1))

  // Clear.
  await page.locator('[data-promotions-clear]').click()
  await waitRows(page, N)
  check('3: Clear resets URL, box and door', search(page).toString() === '' && (await page.locator('[data-filter-q]').inputValue()) === '' && lists(ctx).at(-1) === 'skip=0&take=50')

  // A pasted URL drives the door and the controls; an older link with two statuses keeps the first.
  await page.goto(`${BASE}/hungerstation/promotions?chain=OlaCare&status=draft&status=ended&q=a`)
  await waitRows(page, 1)
  check('3: a pasted URL drives the door (one status: the first it names)', lists(ctx).at(-1) === 'chain=OlaCare&status=draft&q=a&skip=0&take=50', lists(ctx).at(-1))
  check(
    '3: … and the controls',
    (await page.locator('[data-filter-chain]').inputValue()) === 'OlaCare' &&
      (await page.locator('[data-filter-q]').inputValue()) === 'a' &&
      (await page.locator('[data-filter-status="draft"]').getAttribute('aria-pressed')) === 'true' &&
      (await page.locator('[data-filter-status="ended"]').getAttribute('aria-pressed')) === 'false',
  )
  check('2–3: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
if (want('2')) {
  const { context, page, ctx } = await open('ltr', { many: true })
  await page.goto(`${BASE}/hungerstation/promotions`)
  const statusReads = (text) => page.waitForFunction((t) => document.querySelector('[data-status-count]')?.textContent === t, text, { timeout: 20000 })
  await statusReads('Showing 1–50 of 255')
  await cellLoc(page, 'p-live', 'name').waitFor({ timeout: 10000 })
  check('3: total > rows reads "Showing 1–50 of 255"', (await page.locator('[data-status-count]').textContent()) === 'Showing 1–50 of 255')
  check('3: Previous is disabled on the first page', await page.locator('[data-promotions-previous]').isDisabled())
  await page.locator('[data-promotions-next]').click()
  await statusReads('Showing 51–100 of 255')
  check('3: Next sends skip=50 and keeps it in the URL', lists(ctx).at(-1) === 'skip=50&take=50' && search(page).get('skip') === '50', lists(ctx).at(-1))
  // Page 2 starts at the 41st extra row (10 fresh rows, then 245 extras).
  await cellLoc(page, 'p-x041', 'name').waitFor({ timeout: 10000 })
  check('3: … showing page 2’s rows', (await cell(page, 'p-x041', 'name')) === 'Bulk 041' && (await cellLoc(page, 'p-live', 'name').count()) === 0)
  await page.locator('[data-promotions-previous]').click()
  await statusReads('Showing 1–50 of 255')
  await cellLoc(page, 'p-live', 'name').waitFor({ timeout: 10000 })
  check('3: Previous goes back', search(page).get('skip') === null && (await cell(page, 'p-live', 'name')) === 'Ramadan')
  await context.close()
}

// ── 4: the detail ──────────────────────────────────────────────────────────────────────────────
if (want('4')) {
  const { context, page, errors, ctx } = await open('ltr')
  await page.goto(`${BASE}/hungerstation/promotions?status=livePartlyRefused`)
  await waitRows(page, 1)
  await page.locator('[data-promotion-details="p-refused"]').click()
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-refused"]')
  await sheet.locator('[data-promotion-parts] table').waitFor({ timeout: 15000 })
  check('4: Details puts ?promotion= in the URL, keeping the filters', search(page).get('promotion') === 'p-refused' && search(page).get('status') === 'livePartlyRefused')
  check('4: the detail door was read', ctx.calls.some((c) => c.door === 'read' && c.path === 'HungerStationWeb/Promotions/p-refused'))
  const field = async (f) => (await sheet.locator(`[data-promotion-field="${f}"] dd`).innerText()).trim()
  check('4: header — name', (await sheet.locator('[data-promotion-title]').innerText()) === 'Eid B2G1')
  check('4: header — EN and AR display names', (await field('displayNameEn')) === 'Eid B2G1 — up to 20% off' && (await field('displayNameAr')) === 'اشترِ ٢ واحصل على ١')
  check('4: header — HungerStation reason in words', (await field('hsReason')) === 'Overstock')
  check('4: header — limits', (await field('orderLimit')) === '2' && (await field('globalLimit')) === '5,000')
  check('4: header — window', (await field('window')) === '2026-11-01 00:00 – 2026-11-30 23:59', await field('window'))
  check('4: header — status', (await field('status')) === 'Live with refusals')
  check('4: header — type, chain, default discount', (await field('type')) === 'Same-item bundle' && (await field('chain')) === 'OlaCare' && (await field('defaultDiscount')).includes('20%'))
  check('4: header — created by and at; updated by and at', (await field('created')) === '2026-10-27 14:00 by msartawi' && (await field('updated')) === '2026-10-28 09:29 by aalharbi', await field('updated'))

  const partText = async (id, f) => (await sheet.locator(`[data-promotion-part="${id}"] [data-promotion-part-${f}]`).innerText()).replace(/\s+/g, ' ').trim()
  check('4: parts — one row per part', (await sheet.locator('[data-promotion-part]').count()) === 2)
  check('4: parts — the name sent to HungerStation', (await partText('pt-a', 'name')) === 'Eid B2G1 · B2G1 50%' && (await partText('pt-b', 'name')) === 'Eid B2G1 · B3G1 5 SAR')
  check('4: parts — buy/get and discount, read from the combination ("B3G1|ABSOLUTE|5")', (await partText('pt-a', 'combination')) === 'B2G1' && (await partText('pt-b', 'discount')) === 'Amount off 5.000 SAR', await partText('pt-b', 'discount'))
  check('4: parts — the SKU count is the part’s ACTIVE items (a removed one is not counted)', (await partText('pt-a', 'skus')) === '2' && (await partText('pt-b', 'skus')) === '1')
  check('4: parts — each part’s own status (the 24-hour one reads Failed)', (await partText('pt-a', 'status')) === 'Live' && (await partText('pt-b', 'status')) === 'Failed', await partText('pt-b', 'status'))
  check(
    '4: parts — the latest job (Completed; the 24-hour one "No answer from HungerStation", 669)',
    (await partText('pt-a', 'latest-job')) === 'Completed' && (await partText('pt-b', 'latest-job')).startsWith('No answer from HungerStation'),
    await partText('pt-b', 'latest-job'),
  )

  const storeRows = await sheet.locator('[data-promotion-store]').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('td')].map((td) => td.textContent.trim())))
  check(
    '4: stores — code, name, vendor id as sent',
    JSON.stringify(storeRows) === JSON.stringify([['1001', 'صيدلية 1001', 'v-1001'], ['1002', '', 'v-1002'], ['2001', 'صيدلية 2001', 'hs-77821']]),
    JSON.stringify(storeRows),
  )

  // 670's tick column (a live promotion's items are removed from here) is not a data column.
  const itemRows = await sheet.locator('[data-promotion-item]').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('td:not([data-promotion-item-pick-cell])')].map((td) => td.textContent.trim())))
  check(
    '4: items — material, SKU, subtype, value, max qty, buy, get, part, state',
    JSON.stringify(itemRows[0]) === JSON.stringify(['201001', 'SKU-201001', 'Percentage off', '50%', '6', '2', '1', 'Eid B2G1 · B2G1 50%', 'Active']),
    JSON.stringify(itemRows[0]),
  )
  check('4: items — a removed item stays, read as Removed', JSON.stringify(itemRows[3]?.slice(-2)) === JSON.stringify(['Eid B2G1 · B3G1 5 SAR', 'Removed']), JSON.stringify(itemRows[3]))
  check('4: items — an amount reads with SAR at 3 decimals, no max qty blank', itemRows[2]?.[3] === '5.000 SAR' && itemRows[2]?.[4] === '')

  const sendRows = await sheet.locator('[data-promotion-send]').evaluateAll((els) => els.map((e) => e.getAttribute('data-promotion-send')))
  check('4: sends — newest first (the contract sends them oldest first)', JSON.stringify(sendRows) === JSON.stringify(['s-b1', 's-a1', 's-b0']), sendRows.join())
  const sendCells = await sheet.locator('[data-promotion-send="s-b0"] td').allInnerTexts()
  check(
    '4: sends — when, who, reason, what, part, HTTP, job id, job status, error',
    JSON.stringify(sendCells.map((s) => s.trim())) ===
      JSON.stringify(['2026-10-28 09:15', 'aalharbi', 'Ramadan launch', 'Send', 'Eid B2G1 · B3G1 5 SAR', '503', '', 'Not sent', 'HungerStation unavailable', '2026-10-28 09:30', '2026-10-28 09:31']),
    sendCells.join(' | '),
  )
  check(
    '4: sends — the 24-hour job reads "No answer from HungerStation" on its own row only',
    (await sheet.locator('[data-promotion-send="s-b1"] [data-promotion-send-status]').innerText()) === 'No answer from HungerStation' &&
      (await sheet.locator('[data-promotion-send="s-a1"] [data-promotion-send-status]').innerText()) === 'Completed',
  )
  check('4: sends — the kind in words (UPSERT → Send)', (await sheet.locator('[data-promotion-send="s-a1"] [data-promotion-send-kind="UPSERT"]').innerText()) === 'Send')
  await page.screenshot({ path: `${SHOTS}/ltr-detail.png` })

  await page.locator('[data-promotion-close]').click()
  await sheet.waitFor({ state: 'detached', timeout: 10000 })
  check('4: closing drops ?promotion= and keeps the filters', search(page).get('promotion') === null && search(page).get('status') === 'livePartlyRefused')

  // A pasted URL opens the promotion.
  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-draft`)
  const draft = page.locator('dialog[open][data-promotion-sheet="p-draft"]')
  await draft.locator('[data-promotion-items] table').waitFor({ timeout: 15000 })
  check('4: a pasted ?promotion= opens it', (await draft.locator('[data-promotion-title]').innerText()) === 'Winter draft')
  check('4: a draft has no parts and no sends yet, says so', (await draft.locator('[data-promotion-parts]').innerText()).includes('parts are made when the promotion is sent') && (await draft.locator('[data-promotion-sends]').innerText()).includes('Never sent.'))
  check('4: a draft on all stores says so, and lists the stores it targets now', (await draft.locator('[data-promotion-field="storesScope"] dd').innerText()).includes("All the chain's stores") && (await draft.locator('[data-promotion-store]').count()) === 3)
  check('4: a draft item has no SKU and no part yet', (await draft.locator('[data-promotion-item="301001"] [data-promotion-item-sku]').innerText()) === '' && (await draft.locator('[data-promotion-item="301001"] [data-promotion-item-part]').innerText()) === '')
  check('4: a blank row reads the default discount, greyed', (await draft.locator('[data-promotion-item="301001"] [data-promotion-item-value]').innerText()) === '20%' && /italic/.test((await draft.locator('[data-promotion-item="301001"] [data-promotion-item-value]').getAttribute('class')) ?? ''))

  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-gone`)
  const gone = page.locator('dialog[open][data-promotion-sheet="p-gone"] [data-promotion-error="DHS-00016"]')
  await gone.waitFor({ timeout: 15000 })
  check('4: DHS-00016 reads "no such promotion", with its code', (await gone.innerText()).includes('There is no such HungerStation promotion.') && (await gone.innerText()).includes('DHS-00016'))
  check('4: only read doors were called', ctx.calls.every((c) => c.door === 'list' || c.door === 'read'), [...new Set(ctx.calls.map((c) => c.door))].join())
  check('4: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 5: RTL ───────────────────────────────────────────────────────────────────────────────────
if (want('5')) {
  const { context, page, errors } = await open('rtl')
  await page.goto(`${BASE}/hungerstation/promotions`)
  await waitRows(page, N)
  check('5: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('5: the count isolates its number', (await page.locator('[data-status-count] bdi[dir="ltr"]').innerText()) === String(N))
  const windows = await page.evaluate(() => [...document.querySelectorAll('[data-promotions-grid] [col-id="window"] bdi')].map((b) => b.textContent))
  check('5: the window cell is ONE isolate (the core base), not one per end', windows.includes('2026-11-01 00:00 – 2026-11-30 23:59'), windows.slice(0, 2).join(' | '))
  check('5: an unknown status is isolated inside its badge', (await cellLoc(page, 'p-unknown', 'status').locator('bdi[dir="ltr"]').innerText()) === 'paused')
  await page.screenshot({ path: `${SHOTS}/rtl-list.png` })
  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-refused`)
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-refused"]')
  await sheet.locator('[data-promotion-parts] table').waitFor({ timeout: 15000 })
  check('5: the header window is ONE ltr isolate', (await sheet.locator('[data-promotion-field="window"] bdi[dir="ltr"]').allInnerTexts()).join('|') === '2026-11-01 00:00 – 2026-11-30 23:59')
  check('5: display names are free text (bdi, direction auto)', (await sheet.locator('[data-promotion-field="displayNameAr"] bdi:not([dir])').innerText()) === 'اشترِ ٢ واحصل على ١')
  check('5: a part name is free text; its buy/get a machine value', (await sheet.locator('[data-promotion-part="pt-a"] [data-promotion-part-name] bdi:not([dir])').innerText()) === 'Eid B2G1 · B2G1 50%' && (await sheet.locator('[data-promotion-part="pt-a"] [data-promotion-part-combination] bdi[dir="ltr"]').innerText()) === 'B2G1')
  check('5: a vendor id as sent is isolated', (await sheet.locator('[data-promotion-store="2001"] [data-promotion-store-vendor] bdi[dir="ltr"]').innerText()) === 'hs-77821')
  check('5: a money value is ONE isolate with its currency', (await sheet.locator('[data-promotion-item="201003"] [data-promotion-item-value] bdi[dir="ltr"]').innerText()) === '5.000 SAR')
  check('5: the created by-at sentence isolates the time and the user apart (words carry the order)', JSON.stringify(await sheet.locator('[data-promotion-field="created"] bdi[dir="ltr"]').allInnerTexts()) === JSON.stringify(['2026-10-27 14:00', 'msartawi']))
  check('5: an Arabic send reason is free text', (await sheet.locator('[data-promotion-send="s-a1"] [data-promotion-send-reason] bdi:not([dir])').innerText()) === 'إطلاق العيد')
  await page.screenshot({ path: `${SHOTS}/rtl-detail.png` })
  check('5: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ══ 666: the strikethrough editor, Save draft, Send, Refresh ══════════════════════════════════════
// The write doors are filled HERE, as `open(…, { doors })` overrides over a per-run `ctx.saved`.
// Asserts:
//   6. New → chain first → its stores (all ticked, paused kept, the frozen note) → header (start
//      now, end 23:59 of the day picked) → paste (header skipped and said, blank cells → default,
//      a repeat last-wins and counted) → Save draft with a reason: the create body FIELD FOR FIELD
//      (storeCodes a list; `null` for all); the save's answer carries its `check`; a re-save keeps a
//      blank row blank (review B4); Send with a reason: { reason }; the promotion reads Sending, the
//      editor is locked; Refresh sends NO body and re-reads (Live);
//   7. refusals inline: DHS-00019 at the name, DHS-00008 at the reason; a Send refused by a check
//      (DHS-00018, message only) re-runs Check, which marks the row; HungerStationPromotionSent re-reads
//      the promotion and locks the editor; a paste of 20,001 is refused before anything is sent;
//   8. a promotions-only user (no Chains read) types the chain, offered the chains seen;
//   9. RTL: the editor isolates its machine values.
const baseRead = DOORS.find((d) => d.door === 'read').handle
const ONBOARDED = () => [store('1001'), store('1002', { syncActive: false }), store('2001')]

/** A saved draft as the server keeps it: rows AS ENTERED (a blank subtype / value stays `null`). */
function draftOf(promotionId, body, prev = null) {
  const choices = Object.fromEntries(ONBOARDED().map((s) => [s.storeCode, s]))
  let n = 0
  return {
    promotionId,
    chainKey: body.chainKey,
    name: body.name,
    displayNameEn: body.displayNameEn,
    displayNameAr: body.displayNameAr,
    type: body.type,
    hsReason: body.hsReason,
    startAt: body.startAt,
    endAt: body.endAt,
    orderLimit: body.orderLimit,
    globalLimit: body.globalLimit,
    defaultSubtype: body.defaultSubtype,
    defaultValue: body.defaultValue ?? 0,
    currencyKey: 'SAR',
    allStores: body.storeCodes === null,
    status: 'draft',
    replacesPromotionId: null,
    createdAt: prev?.createdAt ?? AT,
    createdBy: 'msartawi',
    updatedAt: AT,
    updatedBy: 'msartawi',
    sentAt: null,
    sentBy: null,
    replacedByPromotionId: null,
    switchedOffAt: null,
    switchedOffBy: null,
    switchedOffReason: null,
    // `null` = every onboarded store of the chain NOW (a draft); a list names them.
    stores: body.storeCodes === null ? ONBOARDED() : body.storeCodes.map((c) => choices[c] ?? store(c)),
    items: body.items.map((i) =>
      item(i.materialNumber, {
        rowNo: ++n,
        sku: null,
        partId: null,
        subtype: i.subtype,
        value: i.value,
        maxQuantity: i.maxQuantity,
        buyQuantity: body.type === 'SAME_ITEM_BUNDLE' ? i.buyQuantity : null,
        getQuantity: body.type === 'SAME_ITEM_BUNDLE' ? i.getQuantity : null,
      }),
    ),
    parts: [],
    sends: [],
  }
}

/**
 * The 666 write doors over `ctx.saved`. `bend` swaps one door's answer for a scenario, and
 * `bend.checkOf(ctx, draft)` is the scenario's Check: the Check door answers it, and so does the
 * `check` key of every save (contract 3212: Save REPORTS the checks).
 */
const doors666 = (bend = {}) => {
  const judge = (ctx, d) => (bend.checkOf ? bend.checkOf(ctx, d) : checkOf(d.promotionId, { itemCount: d.items.length }))
  const saved = (ctx, d) => envelope({ ...d, check: judge(ctx, d) })
  return {
    read: (ctx, m, req, url) => {
      const id = decodeURIComponent(m[1])
      return ctx.saved?.[id] ? envelope(ctx.saved[id]) : baseRead(ctx, m, req, url)
    },
    create: (ctx, m, req) => {
      const bent = bend.create?.(ctx)
      if (bent) return bent
      ctx.saved ??= {}
      const id = `p-new${Object.keys(ctx.saved).length + 1}`
      ctx.saved[id] = draftOf(id, req.postDataJSON())
      return saved(ctx, ctx.saved[id])
    },
    save: (ctx, m, req) => {
      const id = decodeURIComponent(m[1])
      ctx.saved[id] = draftOf(id, req.postDataJSON(), ctx.saved[id])
      return saved(ctx, ctx.saved[id])
    },
    check: async (ctx, m) => {
      if (bend.checkDelay) await new Promise((r) => setTimeout(r, bend.checkDelay))
      const d = ctx.saved?.[decodeURIComponent(m[1])]
      return d ? envelope(judge(ctx, d)) : refuse('DHS-00016')
    },
    send: (ctx, m) => {
      const bent = bend.send?.(ctx)
      if (bent) return bent
      const id = decodeURIComponent(m[1])
      const p = ctx.saved[id]
      ctx.saved[id] = {
        ...p,
        status: 'sending',
        sentAt: AT,
        sentBy: 'msartawi',
        // "All stores" is frozen now.
        stores: p.stores,
        items: p.items.map((i) => ({ ...i, sku: `SKU-${i.materialNumber}`, partId: 'pt-n1' })),
        parts: [part('pt-n1', { name: p.name, status: 'sending', refusals: null })],
        sends: [send('s-n1', { partId: 'pt-n1', sentAt: AT, reason: 'Go live', jobStatus: 'QUEUED', hsUpdatedAt: null, attempts: 0, lastAttemptAt: null })],
      }
      return envelope(ctx.saved[id])
    },
    refresh: (ctx, m) => {
      const id = decodeURIComponent(m[1])
      const p = ctx.saved[id]
      ctx.saved[id] = { ...p, status: 'live', parts: p.parts.map((x) => ({ ...x, status: 'live', refusals: NO_REFUSALS() })), sends: p.sends.map((s) => ({ ...s, jobStatus: 'COMPLETED' })) }
      return envelope(ctx.saved[id])
    },
  }
}

const EDITOR = (id = 'new') => `dialog[open][data-promotion-editor="${id}"]`
const REASON = 'dialog[open] [data-reason-dialog]'
const PASTE = [
  ['Material', 'Subtype', 'Value', 'MaxQty'],
  ['101001', 'PERCENTAGE', '25', '3'],
  ['101002', '', '', ''],
  ['101003', 'FINAL_PRICE', '9.5', ''],
  ['101001', 'PERCENTAGE', '30', ''],
]
  .map((r) => r.join('\t'))
  .join('\r\n')

/** New → chain → header. */
async function startNew(page, { chain = 'OlaCare' } = {}) {
  await page.goto(`${BASE}/hungerstation/promotions`)
  await waitRows(page, N)
  await page.locator('[data-promotions-new]').click()
  const ed = page.locator(EDITOR())
  await ed.waitFor({ timeout: 15000 })
  if (chain) {
    await ed.locator('[data-editor-chain-select]').selectOption(chain)
    await ed.locator('[data-editor-store-list]').waitFor({ timeout: 15000 })
  }
  return ed
}
async function fillHeader(ed) {
  await ed.locator('[data-editor-name]').fill('Ramadan 666')
  await ed.locator('[data-editor-display-en]').fill('Up to 25% off')
  await ed.locator('[data-editor-display-ar]').fill('خصم حتى ٢٥٪')
  await ed.locator('[data-editor-default-value]').fill('20')
}
async function paste(page, ed, text) {
  await ed.locator('[data-editor-paste]').click()
  const dlg = page.locator('dialog[open] [data-import-dialog="promotion-items"]')
  await dlg.waitFor({ timeout: 10000 })
  await dlg.locator('[data-import-text]').fill(text)
  return dlg
}
async function reason(page, text) {
  const dlg = page.locator(REASON)
  await dlg.waitFor({ timeout: 10000 })
  await dlg.locator('[data-reason-input]').fill(text)
  await page.locator('dialog[open] [data-reason-confirm]').click()
}
const itemCell = async (ed, material, col) => (await ed.locator(`[data-editor-items-grid] .ag-row[row-id="${material}"] [col-id="${col}"]`).innerText()).trim()

// ── 6: make, save, send, refresh ─────────────────────────────────────────────────────────────
if (want('6')) {
  const { context, page, errors, ctx } = await open('ltr', { doors: doors666() })
  const ed = await startNew(page)
  check('6: New opens the editor, ?edit=new in the URL', search(page).get('edit') === 'new')
  check('6: the chain comes first; its stores are read for it', callsOf(ctx, 'stores').at(-1)?.query === 'chain=OlaCare', callsOf(ctx, 'stores').at(-1)?.query)
  const ticks = await ed.locator('[data-editor-store]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-editor-store'), e.getAttribute('data-editor-store-on')]))
  check('6: every store of the chain ticked by default', JSON.stringify(ticks) === JSON.stringify([['1001', 'true'], ['1002', 'true'], ['2001', 'true']]), JSON.stringify(ticks))
  check('6: a paused store is offered, and says so', (await ed.locator('[data-editor-store="1002"] [data-editor-store-paused]').count()) === 1)
  check('6: the note says the list is frozen when sent, a later store does not join', /frozen when the promotion is sent: a store onboarded later does not join/.test(await ed.locator('[data-editor-stores-note]').innerText()))
  await ed.locator('[data-editor-stores-search]').fill('2001')
  check('6: the stores search narrows the list', (await ed.locator('[data-editor-store]').count()) === 1)
  await ed.locator('[data-editor-store="2001"] [data-editor-store-tick]').uncheck()
  await ed.locator('[data-editor-stores-search]').fill('')
  check('6: untick one: 2 / 3 ticked', (await ed.locator('[data-editor-stores-count]').innerText()).trim() === '2 / 3 ticked', await ed.locator('[data-editor-stores-count]').innerText())

  const box = (k) => ed.locator(`[data-editor-${k}]`).inputValue()
  check('6: start defaults to now (Saudi local)', (await box('start-date')) === '2026-10-29' && (await box('start-time')) === '11:00')
  check('6: end defaults to 23:59 of that day', (await box('end-date')) === '2026-10-29' && (await box('end-time')) === '23:59')
  await ed.locator('[data-editor-end-time]').fill('18:00')
  await ed.locator('[data-editor-end-date]').fill('2026-11-30')
  check('6: picking an end day takes 23:59 of it', (await box('end-date')) === '2026-11-30' && (await box('end-time')) === '23:59')
  check('6: Competitiveness is the default HungerStation reason', (await box('hs-reason')) === 'COMPETITIVENESS')
  await fillHeader(ed)
  await ed.locator('[data-editor-hs-reason]').selectOption('OVERSTOCK')
  await ed.locator('[data-editor-order-limit]').fill('2')
  check('6: Send waits for a saved draft', await ed.locator('[data-editor-send]').isDisabled())

  const dlg = await paste(page, ed, PASTE)
  await dlg.locator('[data-import-header-skipped]').waitFor({ timeout: 5000 })
  check('6: the header row is skipped and said', (await dlg.locator('[data-import-header-skipped]').innerText()).includes('Material'))
  check('6: the repeat is counted', (await dlg.locator('[data-import-repeats]').getAttribute('data-import-repeats')) === '1')
  await dlg.locator('[data-import-preview] .ag-row[row-index]').first().waitFor({ timeout: 5000 })
  const previewRows = new Set(await dlg.locator('[data-import-preview] .ag-row[row-index]').evaluateAll((els) => els.map((e) => e.getAttribute('row-index')))).size
  check('6: the preview grid shows the three materials', previewRows === 3, String(previewRows))
  check('6: the paste is used through the import dialog', strip(await page.locator('dialog[open] [data-import-send]').innerText()) === 'Use 3 materials')
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="101003"]').waitFor({ timeout: 10000 })
  check('6: three items, the repeat last-wins', (await ed.locator('[data-editor-items-count]').getAttribute('data-editor-items-count')) === '3' && (await itemCell(ed, '101001', 'value')) === '30%')
  check('6: a blank cell shows the default', (await itemCell(ed, '101002', 'subtype')) === 'Percentage off' && (await itemCell(ed, '101002', 'value')) === '20%')
  check('6: a final price reads in SAR', (await itemCell(ed, '101003', 'value')) === '9.500 SAR')
  await page.screenshot({ path: `${SHOTS}/ltr-editor.png` })

  await ed.locator('[data-editor-save]').click()
  await reason(page, '  Ramadan draft  ')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('edit') === 'p-new1', null, { timeout: 15000 })
  const body = callsOf(ctx, 'create')[0]?.body
  const want = {
    chainKey: 'OlaCare',
    name: 'Ramadan 666',
    displayNameEn: 'Up to 25% off',
    displayNameAr: 'خصم حتى ٢٥٪',
    type: 'STRIKETHROUGH',
    hsReason: 'OVERSTOCK',
    startAt: '2026-10-29T11:00:00',
    endAt: '2026-11-30T23:59:00',
    orderLimit: 2,
    globalLimit: null,
    defaultSubtype: 'PERCENTAGE',
    defaultValue: 20,
    storeCodes: ['1001', '1002'],
    items: [
      { materialNumber: '101001', subtype: 'PERCENTAGE', value: 30, maxQuantity: null, buyQuantity: null, getQuantity: null },
      { materialNumber: '101002', subtype: null, value: null, maxQuantity: null, buyQuantity: null, getQuantity: null },
      { materialNumber: '101003', subtype: 'FINAL_PRICE', value: 9.5, maxQuantity: null, buyQuantity: null, getQuantity: null },
    ],
    reason: 'Ramadan draft',
  }
  check('6: Save draft posts the create body field for field (wall time, no UTC, blank = null, the stores by code, reason trimmed)', JSON.stringify(body) === JSON.stringify(want), JSON.stringify(body))
  sameKeys('6: the create body has exactly HungerStationPromotionSaveBody’s fields', 'HungerStationPromotionSaveBody', body)
  check('6: the saved id lands in the URL (?edit=p-new1)', search(page).get('edit') === 'p-new1')
  const ed2 = page.locator(EDITOR('p-new1'))
  await ed2.locator('[data-editor-state="saved"]').waitFor({ timeout: 10000 })
  check('6: saved, nothing reached HungerStation', callsOf(ctx, 'send').length === 0)

  // Every store ticked again is "all": `storeCodes: null`, never [] (which is NO store).
  await ed2.locator('[data-editor-stores-all]').click()
  await ed2.locator('[data-editor-global-limit]').fill('5000')
  await ed2.locator('[data-editor-state="dirty"]').waitFor({ timeout: 5000 })
  check('6: an edit since the save holds Send back', await ed2.locator('[data-editor-send]').isDisabled())
  const checksBefore = callsOf(ctx, 'check').length
  await ed2.locator('[data-editor-save]').click()
  await reason(page, 'More uses')
  await ed2.locator('[data-editor-state="saved"]').waitFor({ timeout: 10000 })
  const put = callsOf(ctx, 'save')[0]
  check('6: saving again is a PUT on the draft', put?.path === 'HungerStationWeb/Promotions/p-new1' && put.body.globalLimit === 5000 && put.body.reason === 'More uses', JSON.stringify(put?.body))
  check('6: all stores is `storeCodes: null` (the contract has no allStores key)', put?.body.storeCodes === null && !('allStores' in (put?.body ?? {})), JSON.stringify(put?.body.storeCodes))
  // Review B4: the saved draft reads back as entered, and a re-save keeps a blank row blank.
  check('6: a blank row is re-saved blank (null), so it keeps following the default', JSON.stringify(put?.body.items[1]) === JSON.stringify(want.items[1]), JSON.stringify(put?.body.items[1]))
  await ed2.locator('[data-check-panel="clean"]').waitFor({ timeout: 10000 })
  check('6: the save’s own `check` fills the panel — no extra Check call', callsOf(ctx, 'check').length === checksBefore)

  // Send.
  await ed2.locator('[data-editor-send]').click()
  await page.locator(REASON).waitFor({ timeout: 10000 })
  const note = await page.locator('dialog[open] [data-editor-send-note]').innerText()
  check('6: the Send dialog says what goes out', note.includes('3 stores with 3 materials'), note)
  await reason(page, 'Go live')
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-new1"]')
  await sheet.waitFor({ timeout: 15000 })
  check('6: Send posts { reason } only', JSON.stringify(callsOf(ctx, 'send')[0]?.body) === JSON.stringify({ reason: 'Go live' }) && callsOf(ctx, 'send')[0]?.path === 'HungerStationWeb/Promotions/p-new1/Send')
  await sheet.locator('[data-promotion-field="status"]').waitFor({ timeout: 10000 })
  check('6: the detail takes over, reading Sending', search(page).get('promotion') === 'p-new1' && search(page).get('edit') === null && (await sheet.locator('[data-promotion-field="status"] dd').innerText()).trim() === 'Sending')
  check('6: a sent promotion offers Refresh, and Edit waits while it is Sending', (await sheet.locator('[data-promotion-refresh]').count()) === 1 && (await sheet.locator('[data-promotion-edit="sending"]').isDisabled()))

  // Sending disables edit.
  await page.goto(`${BASE}/hungerstation/promotions?edit=p-new1`)
  const locked = page.locator(EDITOR('p-new1'))
  await locked.waitFor({ timeout: 20000 })
  await locked.locator('[data-editor-locked="sending"]').waitFor({ timeout: 20000 })
  check('6: while Sending the editor is locked', (await locked.locator('[data-editor-name]').isDisabled()) && (await locked.locator('[data-editor-paste]').isDisabled()) && (await locked.locator('[data-editor-save]').count()) === 0)

  // Refresh re-reads.
  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-new1`)
  const sheet2 = page.locator('dialog[open][data-promotion-sheet="p-new1"]')
  await sheet2.locator('[data-promotion-refresh]').waitFor({ timeout: 15000 })
  // (669's light poll may re-read meanwhile, so the read count is not asserted.)
  await sheet2.locator('[data-promotion-refresh]').click()
  await page.waitForFunction(() => document.querySelector('dialog[open] [data-promotion-field="status"] dd')?.textContent?.trim() === 'Live', null, { timeout: 15000 })
  const r = callsOf(ctx, 'refresh')[0]
  check('6: Refresh posts NO body to …/Refresh', r?.path === 'HungerStationWeb/Promotions/p-new1/Refresh' && r.body === null, JSON.stringify(r))
  check('6: Refresh re-reads: the part Live, its job Completed', (await sheet2.locator('[data-promotion-part="pt-n1"] [data-promotion-part-status]').innerText()).trim() === 'Live' && (await sheet2.locator('[data-promotion-part="pt-n1"] [data-promotion-part-latest-job]').innerText()).trim() === 'Completed')
  check('6: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7: refusals inline, a refused Send, a promotion sent elsewhere, the cap ──────────────────────
if (want('7')) {
  let creates = 0
  const state = { sendRefused: false, sends: 0 }
  const bend = {
    create: () => (++creates === 1 ? refuse('DHS-00019') : creates === 2 ? refuse('DHS-00008') : null),
    // First Send: a check refuses (message only). Second: it was sent elsewhere meanwhile.
    send: (ctx) => {
      state.sends++
      if (state.sends === 1) {
        state.sendRefused = true
        return refuse('DHS-00018')
      }
      ctx.saved['p-new1'] = { ...ctx.saved['p-new1'], status: 'sending', sentAt: AT, parts: [part('pt-x', { name: 'Ramadan 666', status: 'sending' })] }
      return refuse('HungerStationPromotionSent')
    },
    // The Check reads what the server knows: after the refused Send, the row that refused.
    checkOf: (_ctx, d) =>
      state.sendRefused
        ? checkOf(d.promotionId, { canSend: false, itemCount: d.items.length, refusals: [issue({ rowNo: 2, materialNumber: '101002', message: 'row 2: material 101002 is not on the HungerStation material list / …' })] })
        : checkOf(d.promotionId, { itemCount: d.items.length }),
  }
  const { context, page, errors, ctx } = await open('ltr', { doors: doors666(bend) })
  const ed = await startNew(page)
  await fillHeader(ed)
  await ed.locator('[data-editor-end-date]').fill('2026-11-30')
  await paste(page, ed, PASTE)
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="101003"]').waitFor({ timeout: 10000 })

  await ed.locator('[data-editor-save]').click()
  await reason(page, 'first try')
  await page.locator('dialog[open] [data-inline-refusal="DHS-00019"]').first().waitFor({ timeout: 10000 })
  check('7: DHS-00019 (name in use) shows inline, at the name', (await ed.locator('[data-editor-name-refusal] [data-inline-refusal="DHS-00019"]').count()) === 1)
  check('7: … and not as a second banner in the dialog', (await page.locator('dialog[open] [data-reason-error]').count()) === 0)
  await page.locator('dialog[open] [data-reason-input]').fill('second try')
  await page.locator('dialog[open] [data-reason-confirm]').click()
  await page.locator('dialog[open] [data-inline-refusal="DHS-00008"]').waitFor({ timeout: 10000 })
  check('7: DHS-00008 shows inline at the reason, the dialog stays', (await page.locator('dialog[open] [data-inline-refusal="DHS-00008"]').count()) === 1 && (await page.locator(REASON).count()) === 1 && creates === 2)
  await page.locator('dialog[open] [data-reason-input]').fill('third try')
  await page.locator('dialog[open] [data-reason-confirm]').click()
  await page.waitForFunction(() => new URL(location.href).searchParams.get('edit') === 'p-new1', null, { timeout: 15000 })
  const ed2 = page.locator(EDITOR('p-new1'))
  await ed2.locator('[data-check-panel="clean"]').waitFor({ timeout: 10000 })
  const checksBefore = callsOf(ctx, 'check').length
  await ed2.locator('[data-editor-send]').click()
  await reason(page, 'Go live')
  await page.locator('dialog[open] [data-reason-error="DHS-00018"]').waitFor({ timeout: 10000 })
  await page.locator('dialog[open] [data-reason-cancel]').click()
  await ed2.locator('[data-editor-rows-refused="1"]').waitFor({ timeout: 10000 })
  // Send's own pre-check, then the re-run after the refusal.
  check('7: a Send refused by a check (DHS-00018, message only) re-runs Check, and says so', callsOf(ctx, 'check').length === checksBefore + 2 && (await ed2.locator('[data-editor-rechecked]').count()) === 1, String(callsOf(ctx, 'check').length - checksBefore))
  check('7: … which marks the material on its row', (await itemCell(ed2, '101002', 'refusal')) === 'The material is not on the HungerStation material list.' && (await itemCell(ed2, '101001', 'refusal')) === '')
  check('7: a refused Send leaves the draft a draft (no detail swap)', search(page).get('edit') === 'p-new1')
  await page.screenshot({ path: `${SHOTS}/ltr-editor-refused.png` })

  // The cap.
  const before = ctx.calls.length
  const big = Array.from({ length: 20001 }, (_, i) => String(500000 + i)).join('\n')
  await ed2.locator('[data-editor-paste]').click()
  const capDlg = page.locator('dialog[open] [data-import-dialog="promotion-items"]')
  await capDlg.waitFor({ timeout: 10000 })
  // 20,001 lines in one go (Playwright's fill types them too slowly): the native setter + input.
  await capDlg.locator('[data-import-text]').evaluate((el, v) => {
    Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set.call(el, v)
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }, big)
  await capDlg.locator('[data-import-over-cap]').waitFor({ timeout: 20000 })
  check('7: 20,001 materials are refused before anything is sent', (await page.locator('dialog[open] [data-import-send]').isDisabled()) && ctx.calls.length === before)
  await page.keyboard.press('Escape')
  await capDlg.waitFor({ state: 'detached', timeout: 10000 })

  // Sent elsewhere meanwhile: HungerStationPromotionSent re-reads the promotion, the editor locks.
  state.sendRefused = false
  await ed2.locator('[data-check-run]').click()
  await ed2.locator('[data-check-panel="clean"]').waitFor({ timeout: 10000 })
  await ed2.locator('[data-editor-send]').click()
  await reason(page, 'Go again')
  await page.locator('dialog[open] [data-reason-error="HungerStationPromotionSent"]').waitFor({ timeout: 10000 })
  await page.locator('dialog[open] [data-reason-cancel]').click()
  await ed2.locator('[data-editor-locked="sending"]').waitFor({ timeout: 10000 })
  check('7: HungerStationPromotionSent re-reads the promotion: the editor locks behind it', (await ed2.locator('[data-editor-name]').isDisabled()) && (await ed2.locator('[data-editor-send]').count()) === 0)
  check('7: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8: a promotions-only user types the chain ─────────────────────────────────────────────────
if (want('8')) {
  const { context, page, errors, ctx } = await open('ltr', { access: { ...ALL, canManageStores: false }, chains: 'denied', doors: doors666() })
  const ed = await startNew(page, { chain: null })
  check('8: without the stores grant, no Chains read is made', ctx.calls.every((c) => c.path !== 'HungerStationWeb/Chains'))
  const offered = await ed.locator('#hs-promotion-chains option').evaluateAll((els) => els.map((e) => e.value))
  check('8: the chains seen on the list are offered', JSON.stringify(offered) === JSON.stringify(['AlDawaa', 'OlaCare']), offered.join())
  await ed.locator('[data-editor-chain-input]').fill('AlDawaa')
  await ed.locator('[data-editor-chain-input]').press('Enter')
  await ed.locator('[data-editor-store-list]').waitFor({ timeout: 15000 })
  check('8: a typed chain reads its stores through the promotions door', callsOf(ctx, 'stores').at(-1)?.query === 'chain=AlDawaa')
  check('8: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 9: RTL ───────────────────────────────────────────────────────────────────────────────────
if (want('9')) {
  const { context, page, errors } = await open('rtl', { doors: doors666() })
  const ed = await startNew(page)
  check('9: dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  check('9: the ticked count is ONE ltr isolate', (await ed.locator('[data-editor-stores-count] bdi[dir="ltr"]').allInnerTexts()).join('|') === '3 / 3')
  check('9: a store code is isolated', (await ed.locator('[data-editor-store="1001"] bdi[dir="ltr"]').innerText()) === '1001')
  const dlg = await paste(page, ed, PASTE)
  check('9: the pasted rows read left to right', (await dlg.locator('[data-import-text]').getAttribute('dir')) === 'ltr')
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="101003"]').waitFor({ timeout: 10000 })
  check('9: a money cell is ONE isolate with its currency (the grid base)', (await ed.locator('[data-editor-items-grid] .ag-row[row-id="101003"] [col-id="value"] bdi').first().innerText()) === '9.500 SAR')
  await page.screenshot({ path: `${SHOTS}/rtl-editor.png` })
  check('9: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 10: refusals per store, Resend, the light poll (ticket 669) ─────────────────────────────────

const REFUSED_PT_A = {
  invalidVendors: [
    { storeCode: '2001', vendorId: 'hs-77821' },
    { storeCode: null, vendorId: 'hs-00009' },
  ],
  missingSkus: [
    {
      storeCode: '1001',
      vendorId: 'v-1001',
      items: [
        { sku: 'SKU-201001', materialNumber: '201001' },
        { sku: 'HS-ORPHAN', materialNumber: null },
      ],
    },
    { storeCode: '1002', vendorId: 'v-1002', items: [{ sku: 'SKU-201002', materialNumber: '201002' }] },
  ],
  invalidDiscountedSkus: [{ storeCode: '1001', vendorId: 'v-1001', items: [{ sku: 'SKU-201002', materialNumber: '201002' }] }],
}
sameKeys('10: the refusal fixture is exactly HungerStationPromotionRefusals', 'HungerStationPromotionRefusals', REFUSED_PT_A)
sameKeys('10: … its vendor ref, HungerStationPromotionVendorRef', 'HungerStationPromotionVendorRef', REFUSED_PT_A.invalidVendors[0])
sameKeys('10: … its store SKUs, HungerStationPromotionSkuRefusal', 'HungerStationPromotionSkuRefusal', REFUSED_PT_A.missingSkus[0])
sameKeys('10: … a refused SKU, HungerStationPromotionSkuRef', 'HungerStationPromotionSkuRef', REFUSED_PT_A.missingSkus[0].items[0])

/** The p-refused detail as 669 reads it: pt-a refused, pt-b unanswered. A Resend of pt-a answers
 *  Sending (a new QUEUED send); the next read is still Sending; the one after it HungerStation has
 *  answered: Live. */
function refusedDoors(state) {
  const base = () => detailOf(freshRows().find((r) => r.promotionId === 'p-refused'))
  const now = () => {
    const d = base()
    const [a, b] = d.parts
    if (state.resent === 0) return { ...d, parts: [{ ...a, status: 'livePartlyRefused', refusals: REFUSED_PT_A }, b] }
    const answered = state.readsSinceResend >= 3
    return {
      ...d,
      status: answered ? 'live' : 'sending',
      parts: [{ ...a, status: answered ? 'live' : 'sending', refusals: answered ? NO_REFUSALS() : null }, b],
      sends: [...d.sends, send('s-a2', { partId: 'pt-a', sentAt: AT, reason: 'Stock synced', jobStatus: answered ? 'COMPLETED' : 'QUEUED', hsUpdatedAt: null })],
    }
  }
  return {
    read: (_ctx, m) => {
      if (decodeURIComponent(m[1]) !== 'p-refused') return refuse('DHS-00016')
      if (state.resent) state.readsSinceResend++
      return envelope(now())
    },
    resend: () => {
      if (state.refuse) return refuse(state.refuse)
      state.resent++
      state.readsSinceResend = 1 // the resend's own answer is the first post-resend read
      return envelope(now())
    },
  }
}

async function refusalScenario(dir) {
  const state = { resent: 0, readsSinceResend: 0, refuse: null }
  const { context, page, errors, ctx } = await open(dir, { doors: refusedDoors(state) })
  await context.grantPermissions(['clipboard-read', 'clipboard-write'], { origin: BASE })
  const L = '10 ' + dir.toUpperCase() + ': '
  const reads = () => ctx.calls.filter((c) => c.door === 'read').length

  // The list's own filter for it.
  await page.goto(BASE + '/hungerstation/promotions')
  await waitRows(page, N)
  await chip(page, 'livePartlyRefused')
  await waitRows(page, 1)
  check(L + 'the "Live with refusals" filter sends status=livePartlyRefused', lists(ctx).at(-1) === 'status=livePartlyRefused&skip=0&take=50', lists(ctx).at(-1))

  await page.locator('[data-promotion-details="p-refused"]').click()
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-refused"]')
  const box = sheet.locator('[data-promotion-refusals]')
  await box.waitFor({ timeout: 15000 })
  const blocks = await sheet.locator('[data-promotion-refusal-part]').evaluateAll((els) => els.map((e) => e.getAttribute('data-promotion-refusal-part')))
  check(L + 'one refusal block — the refused part only (an unanswered part has none)', blocks.join() === 'pt-a', blocks.join())
  const counts = await box.locator('[data-refusal-list] [data-refusal-count]').allInnerTexts()
  check(L + 'the three lists, counted (2 stores, 3 missing, 1 over list)', JSON.stringify(counts) === JSON.stringify(['2', '3', '1']), counts.join())
  const rowsOf = (list) =>
    box.locator('[data-refusal-list="' + list + '"] tbody tr').evaluateAll((els) => els.map((e) => [...e.querySelectorAll('td')].map((td) => td.textContent.trim())))
  // Under RTL only the direction changes: `lng` stays `en` app-wide (see § 5).
  const unresolved = 'Not one of our stores'
  check(
    L + 'invalid stores — our store code and the vendor id; an unresolved vendor says so',
    JSON.stringify(await rowsOf('invalidVendors')) === JSON.stringify([['2001', 'hs-77821'], [unresolved, 'hs-00009']]),
    JSON.stringify(await rowsOf('invalidVendors')),
  )
  check(
    L + 'missing materials per store — store, vendor, material, SKU',
    JSON.stringify(await rowsOf('missingSkus')) ===
      JSON.stringify([
        ['1001', 'v-1001', '201001', 'SKU-201001'],
        ['1001', 'v-1001', '', 'HS-ORPHAN'],
        ['1002', 'v-1002', '201002', 'SKU-201002'],
      ]),
    JSON.stringify(await rowsOf('missingSkus')),
  )
  check(L + 'promo price above list, per store', JSON.stringify(await rowsOf('invalidDiscountedSkus')) === JSON.stringify([['1001', 'v-1001', '201002', 'SKU-201002']]))

  // The store filter narrows all three; Copy copies as filtered.
  const opts = await box.locator('[data-refusal-store] option').evaluateAll((els) => els.map((e) => e.value))
  check(L + 'the store filter offers every refused store', JSON.stringify(opts) === JSON.stringify(['', '1001', '1002', '2001', 'vendor:hs-00009']), opts.join())
  await box.locator('[data-refusal-store]').selectOption('1001')
  check(
    L + 'store 1001 → no invalid store, 2 missing, 1 over list',
    (await rowsOf('invalidVendors')).length === 0 && (await rowsOf('missingSkus')).length === 2 && (await rowsOf('invalidDiscountedSkus')).length === 1,
  )
  check(L + 'an emptied list disables its Copy', await box.locator('[data-refusal-copy="invalidVendors"]').isDisabled())
  await box.locator('[data-refusal-copy="missingSkus"]').click()
  await page.waitForTimeout(300)
  // The OS clipboard may hand line ends back as CRLF (Windows); the page wrote LF.
  const clip = (await page.evaluate(() => navigator.clipboard.readText())).replace(/\r\n/g, '\n')
  check(L + 'Copy puts the filtered list on the clipboard, tab-separated, no isolates', clip === '1001\tv-1001\t201001\tSKU-201001\n1001\tv-1001\t\tHS-ORPHAN', JSON.stringify(clip))
  await box.locator('[data-refusal-store]').selectOption('')

  // The 24-hour part; HungerStation's own times.
  check(L + 'the 24-hour part says HungerStation never answered, with its hint', (await sheet.locator('[data-promotion-part="pt-b"] [data-promotion-part-unanswered]').count()) === 1)
  check(L + '… and its Resend is offered (it reads Failed, not Sending)', !(await sheet.locator('[data-promotion-part-resend="pt-b"]').isDisabled()))
  check(
    L + 'HungerStation’s own times, local',
    (await sheet.locator('[data-promotion-send="s-a1"] [data-promotion-send-hs-created]').innerText()) === '2026-10-28 09:30' &&
      (await sheet.locator('[data-promotion-send="s-b1"] [data-promotion-send-hs-updated]').innerText()) === '',
  )
  // Review B8: an absence is asserted only once the same answer has visibly rendered — the poll note
  // and the header status come from the SAME read, so the status showing settles the note.
  await sheet.locator('[data-promotion-field="status"] [data-promotion-status="livePartlyRefused"]').waitFor({ timeout: 10000 })
  check(L + 'nothing Sending → no poll note', (await sheet.locator('[data-promotion-polling]').count()) === 0)

  if (dir === 'rtl') {
    const iso = await box.locator('[data-refusal-list="missingSkus"] tbody tr').first().locator('bdi[dir="ltr"]').allInnerTexts()
    check(L + 'a refused store code, vendor id, material and SKU are each ltr isolates', iso.join('|') === '1001|v-1001|201001|SKU-201001', iso.join('|'))
    check(L + 'the part name is free text', (await sheet.locator('[data-promotion-refusal-part="pt-a"] bdi:not([dir])').first().innerText()) === 'Eid B2G1 · B2G1 50%')
  }
  await page.screenshot({ path: SHOTS + '/' + dir + '-refusals.png' })

  // DHS-00017: the part is Sending after all — the dialog keeps it, with its code.
  state.refuse = 'DHS-00017'
  await sheet.locator('[data-promotion-part-resend="pt-a"]').click()
  const dialog = page.locator('dialog[open]:has([data-resend-dialog="pt-a"]):not(:has(dialog))')
  await dialog.waitFor({ timeout: 10000 })
  check(
    L + 'Resend opens the reason dialog naming the part; Confirm waits for a reason',
    (await dialog.innerText()).includes('Eid B2G1 · B2G1 50%') && (await dialog.locator('[data-reason-confirm]').isDisabled()),
  )
  await dialog.locator('textarea').fill('Stock synced')
  await dialog.locator('[data-reason-confirm]').click()
  await dialog.locator('[data-reason-error="DHS-00017"]').waitFor({ timeout: 10000 })
  // Review B8: not "is it visible right after waiting for it" — the refusal carries its code, the
  // dialog is STILL open after the re-read it triggers, and the reason typed is kept.
  await page.waitForTimeout(400)
  check(
    L + 'DHS-00017 stays in the dialog with its code, the reason kept',
    (await page.locator('[data-resend-dialog="pt-a"]').count()) === 1 && (await dialog.locator('textarea').inputValue()) === 'Stock synced' && callsOf(ctx, 'resend').length === 1,
  )
  state.refuse = null

  // Resend for real.
  await dialog.locator('textarea').fill('  Stock synced  ')
  await dialog.locator('[data-reason-confirm]').click()
  await page.locator('[data-resend-dialog]').waitFor({ state: 'detached', timeout: 10000 })
  const resends = callsOf(ctx, 'resend')
  check(
    L + 'Resend posts { reason } (trimmed) to …/Parts/pt-a/Resend',
    resends.length === 2 && resends[1].path === 'HungerStationWeb/Promotions/p-refused/Parts/pt-a/Resend' && JSON.stringify(resends[1].body) === JSON.stringify({ reason: 'Stock synced' }),
    JSON.stringify(resends.at(-1)),
  )
  await sheet.locator('[data-promotion-part="pt-a"][data-promotion-part-state="sending"]').waitFor({ timeout: 10000 })
  check(L + 'the answer lands at once — the part reads Sending, its job Queued, its Resend disabled', (await sheet.locator('[data-promotion-part="pt-a"]').getAttribute('data-promotion-part-job')) === 'QUEUED' && (await sheet.locator('[data-promotion-part-resend="pt-a"]').isDisabled()))
  check(
    L + '… the promotion reads Sending, with the poll note',
    (await sheet.locator('[data-promotion-field="status"] [data-promotion-status]').getAttribute('data-promotion-status')) === 'sending' &&
      (await sheet.locator('[data-promotion-polling]').count()) === 1,
  )
  check(L + '… and the old refusals are gone (no answer yet)', (await sheet.locator('[data-promotion-refusals]').count()) === 0)
  const readsAt = reads()
  // The light poll: the sheet re-reads by itself every 15 s until HungerStation has answered.
  await sheet.locator('[data-promotion-part="pt-a"][data-promotion-part-job="COMPLETED"]').waitFor({ timeout: 45000 })
  check(
    L + 'the light poll re-reads the detail on its own (Sending → Live)',
    reads() > readsAt && (await sheet.locator('[data-promotion-field="status"] [data-promotion-status]').getAttribute('data-promotion-status')) === 'live',
    String(reads() - readsAt),
  )
  check(
    L + '… the Resend is enabled again and the poll note gone',
    !(await sheet.locator('[data-promotion-part-resend="pt-a"]').isDisabled()) && (await sheet.locator('[data-promotion-polling]').count()) === 0,
  )
  const settled = reads()
  await page.waitForTimeout(16000)
  check(L + 'with nothing Sending the poll stops', reads() === settled, String(reads() - settled))
  check(L + 'only list, read and resend doors were called', ctx.calls.every((c) => ['list', 'read', 'resend'].includes(c.door)), [...new Set(ctx.calls.map((c) => c.door))].join())
  check(L + 'no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
if (want('10')) await refusalScenario('ltr')
if (want('10')) await refusalScenario('rtl')

// ── 11: the Check panel (ticket 667, the contract's Check answer) ────────────────────────────────
// Rows are judged from the SAVED draft (the material, the value as it reads with the default) the
// way BackOffice 3212 does; the header refusals the form itself prevents (display name, window, the
// cap, stores) are injected through `state.header`. Review B1/B2 close the section.

const ROW_WORDS = {
  materialNotListed: 'The material is not on the HungerStation material list.',
  materialDisabled: 'The material is disabled on the HungerStation material list.',
  materialDeleted: 'The material is deleted from the HungerStation material list.',
  percentOutOfRange: 'A percentage must be from 1 to 100.',
  valueNotPositive: 'The value must be more than 0.',
  valueTooManyDecimals: 'The value has more than 3 decimals.',
}
const HEADER_WORDS = {
  nameInUse: 'Another promotion of this chain already uses this name.',
  displayNameArMissing: 'The Arabic display name is missing.',
  windowReversed: 'The start must be before the end.',
  endPast: 'The end has already passed.',
  tooManySkus: 'More than 20,000 SKUs: HungerStation takes no more in one promotion.',
  noStores: 'No store is chosen.',
}
/** The header refusals the form prevents, injected; field → code. */
const INJECTED = [
  ['displayNameAr', 'displayNameArMissing'],
  ['startAt', 'windowReversed'],
  ['endAt', 'endPast'],
  ['items', 'tooManySkus'],
  ['stores', 'noStores'],
]
const MATERIAL_REFUSALS = { 900001: 'materialNotListed', 900002: 'materialDisabled', 900003: 'materialDeleted' }
const PASTE667 = [
  ['101001', 'PERCENTAGE', '25', ''],
  ['900001', '', '', ''],
  ['900002', '', '', ''],
  ['900003', '', '', ''],
  ['101004', 'PERCENTAGE', '150', ''],
  ['101005', 'ABSOLUTE', '-5', ''],
  ['101006', 'ABSOLUTE', '1.2345', ''],
  ['101007', 'FINAL_PRICE', '12.5', ''],
]
  .map((r) => r.join('\t'))
  .join('\n')
const PASTE667_FIXED = [
  ['101001', 'PERCENTAGE', '25', ''],
  ['101007', 'FINAL_PRICE', '12.5', ''],
]
  .map((r) => r.join('\t'))
  .join('\n')

/** The stub's Check of a saved draft (contract § Check): refusals per row and header, the price
 *  warning naming its stores. A row reads with the promotion's default where it is blank. */
const judge667 = (state) => (_ctx, d) => {
  const refusals = [
    ...(d.name === 'Taken 667' ? [issue({ code: 'nameInUse', field: 'name', rowNo: null, materialNumber: null, message: 'Name in use. / الاسم مستخدم.' })] : []),
    ...state.header.map(([field, code]) => issue({ code, field, rowNo: null, materialNumber: null, message: `${code} (server words)` })),
  ]
  const warnings = []
  for (const i of d.items) {
    const subtype = i.subtype ?? d.defaultSubtype
    const value = i.value ?? d.defaultValue
    const on = (code, field) => refusals.push(issue({ code, field, rowNo: i.rowNo, materialNumber: i.materialNumber, message: `${code} (server words)` }))
    if (MATERIAL_REFUSALS[i.materialNumber]) on(MATERIAL_REFUSALS[i.materialNumber], 'materialNumber')
    if (subtype === 'PERCENTAGE' && (value < 1 || value > 100)) on('percentOutOfRange', 'value')
    if (value <= 0) on('valueNotPositive', 'value')
    if ((String(value).split('.')[1] ?? '').length > 3) on('valueTooManyDecimals', 'value')
    // Our VAT-inclusive price is 12.00 at 1001 and 2001, 15.00 at 1002: a final price of 12.5 is not below it at two.
    if ((subtype === 'FINAL_PRICE' || subtype === 'ABSOLUTE') && value >= 12)
      warnings.push(issue({ code: 'priceNotBelow', field: 'value', rowNo: i.rowNo, materialNumber: i.materialNumber, storeCodes: ['1001', '2001'], message: 'not below our price / …' }))
  }
  return checkOf(d.promotionId, { canSend: refusals.length === 0, itemCount: d.items.length, refusals, warnings, parts: [previewPart({ name: d.name, skuCount: d.items.length })] })
}

async function checkScenario(dir) {
  const L = '11 ' + dir.toUpperCase() + ': '
  const state = { header: INJECTED }
  const bend = { checkOf: judge667(state), checkDelay: 0 }
  const { context, page, errors, ctx } = await open(dir, { doors: doors666(bend) })
  const ed = await startNew(page)
  await fillHeader(ed)
  await ed.locator('[data-editor-name]').fill('Taken 667')
  await ed.locator('[data-editor-end-date]').fill('2026-11-30')
  await paste(page, ed, PASTE667)
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="101007"]').waitFor({ timeout: 10000 })
  check(L + 'before a save there is nothing to check (Check needs the saved draft)', await ed.locator('[data-check-run]').isDisabled())

  await ed.locator('[data-editor-save]').click()
  await reason(page, 'Check me')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('edit') === 'p-new1', null, { timeout: 15000 })
  const ed2 = page.locator(EDITOR('p-new1'))
  await ed2.locator('[data-check-panel="refused"]').waitFor({ timeout: 15000 })
  const c1 = callsOf(ctx, 'check')
  check(L + 'the new draft checks itself: POST …/Check with NO body', c1.length === 1 && c1[0].path === 'HungerStationWeb/Promotions/p-new1/Check' && c1[0].body === null, JSON.stringify(c1))

  // Every row refusal on its row: the panel, and the preview grid's Check column.
  const want = { 900001: ['materialNotListed'], 900002: ['materialDisabled'], 900003: ['materialDeleted'], 101004: ['percentOutOfRange'], 101005: ['valueNotPositive'], 101006: ['valueTooManyDecimals'] }
  for (const [material, codes] of Object.entries(want))
    for (const code of codes) {
      const li = ed2.locator(`[data-check-row="${material}"][data-check-code="${code}"]`)
      const ok = (await li.count()) === 1 && (await li.innerText()).includes(ROW_WORDS[code])
      check(L + `${code} renders in words on row ${material} (panel)`, ok, (await li.count()) ? await li.innerText() : 'absent')
      check(L + `${code} renders in words on row ${material} (grid)`, (await itemCell(ed2, material, 'refusal')) === ROW_WORDS[code], await itemCell(ed2, material, 'refusal'))
    }
  check(L + 'a clean row has nothing in its Check cell', (await itemCell(ed2, '101001', 'refusal')) === '')
  check(L + 'the refused rows are counted', (await ed2.locator('[data-editor-rows-refused]').getAttribute('data-editor-rows-refused')) === '6')
  // Review C1: no isolate character in a grid value (they reach Ctrl+C).
  const cells = await ed2.locator('[data-editor-items-grid] [col-id="refusal"]').allInnerTexts()
  check(L + 'no Check cell carries an isolate character', cells.length > 0 && cells.every((c) => !/[⁦-⁩]/.test(c)))

  // Every header refusal at its field: the panel, and the field's own error line.
  const headerWant = [['name', 'nameInUse'], ...INJECTED]
  for (const [field, code] of headerWant) {
    const li = ed2.locator(`[data-check-header="${field}"][data-check-code="${code}"]`)
    check(L + `${code} renders in words at ${field} (panel)`, (await li.count()) === 1 && strip(await li.innerText()).includes(HEADER_WORDS[code]), (await li.count()) ? await li.innerText() : 'absent')
  }
  const headerText = await ed2.locator('[data-editor-header]').innerText()
  check(L + 'the header fields carry their refusals under them', ['nameInUse', 'displayNameArMissing', 'windowReversed', 'endPast'].every((c) => headerText.includes(HEADER_WORDS[c])))
  check(L + 'the field with a refusal is announced invalid', (await ed2.locator('[data-editor-display-ar]').getAttribute('aria-invalid')) === 'true')
  check(L + 'no stores: said at the stores', (await ed2.locator('[data-check-field="stores"]').innerText()).trim() === HEADER_WORDS.noStores)
  check(L + 'over 20,000 SKUs: said at the items', strip(await ed2.locator('[data-check-field="items"]').innerText()) === HEADER_WORDS.tooManySkus)
  check(L + 'twelve refusals in all', (await ed2.locator('[data-check-refusals]').getAttribute('data-check-refusals')) === '12')

  // The price warning: its stores, its words, its colour; it never blocks.
  const w = ed2.locator('[data-check-warning="101007"]')
  const stores = await w.locator('[data-check-warning-store]').evaluateAll((els) => els.map((e) => e.getAttribute('data-check-warning-store')))
  check(L + 'the price warning names its stores (1001, 2001)', JSON.stringify(stores) === JSON.stringify(['1001', '2001']), stores.join())
  check(L + '… with each store code and name as ONE ltr isolate', (await w.locator('[data-check-warning-store="1001"] bdi[dir="ltr"]').innerText()) === '1001 · صيدلية 1001')
  check(L + '… in the words "HungerStation will refuse this material at these stores"', (await w.innerText()).includes('HungerStation will refuse this material at these stores'))
  check(L + '… never "error"', !/error/i.test(await ed2.locator('[data-check-warnings-list]').innerText()))
  check(L + '… in the attention colour, not the danger one', /bg-attention-050/.test((await ed2.locator('[data-check-warnings-list]').getAttribute('class')) ?? ''))
  check(L + 'the warned row says so in its grid cell', (await itemCell(ed2, '101007', 'refusal')) === 'HungerStation will refuse it at 2 stores')
  const rowClass = async (id) => (await ed2.locator(`[data-editor-items-grid] .ag-row[row-id="${id}"]`).first().getAttribute('class')) ?? ''
  check(L + 'the grid marks a refused row (danger) and a warned one (attention)', /bg-danger-050/.test(await rowClass('900001')) && /bg-attention-050/.test(await rowClass('101007')) && !/bg-(danger|attention)-050/.test(await rowClass('101001')))

  // Send waits while any refusal stands.
  check(L + 'Send is disabled while a check refuses', (await ed2.locator('[data-editor-send]').isDisabled()) && (await ed2.locator('[data-editor-send]').getAttribute('data-send-blocked')) === 'true')
  check(L + '… and says why', (await ed2.locator('[data-editor-send]').getAttribute('title')) === 'A check refuses: fix it, save, and check again.')

  // Refused rows only.
  const shown = () => ed2.locator('[data-editor-items-grid]').getAttribute('data-editor-items-shown')
  await ed2.locator('[data-editor-refused-only]').click()
  await ed2.locator('[data-editor-items-grid][data-editor-items-shown="6"]').waitFor({ timeout: 5000 })
  await page.waitForTimeout(200)
  const ids = await ed2.locator('[data-editor-items-grid] .ag-row[row-id]').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('row-id')))].sort())
  check(L + 'the refused-only filter shows the six refused rows, no clean or warned one', JSON.stringify(ids) === JSON.stringify(['101004', '101005', '101006', '900001', '900002', '900003']), ids.join())
  await page.screenshot({ path: `${SHOTS}/${dir}-check-refused.png` })
  await ed2.locator('[data-editor-refused-only]').click()
  await ed2.locator('[data-editor-items-grid][data-editor-items-shown="8"]').waitFor({ timeout: 5000 })
  check(L + 'off again: all eight rows', (await shown()) === '8')

  // The fix: a clean paste, a fresh name, the injected header refusals gone → save → clean.
  state.header = []
  await ed2.locator('[data-editor-name]').fill('Ramadan 667')
  await paste(page, ed2, PASTE667_FIXED)
  await page.locator('dialog[open] [data-import-send]').click()
  await ed2.locator('[data-editor-items-grid][data-editor-items-shown="2"]').waitFor({ timeout: 10000 })
  check(L + 'a new paste drops the old check (it was for other rows)', (await ed2.locator('[data-check-panel="none"]').count()) === 1)
  const beforeSave = callsOf(ctx, 'check').length
  await ed2.locator('[data-editor-save]').click()
  await reason(page, 'Fixed')
  await ed2.locator('[data-check-panel="clean"]').waitFor({ timeout: 15000 })
  check(L + 'after the fix the save’s own check is clean (no Check call: Save reports them)', (await ed2.locator('[data-check-clean]').count()) === 1 && (await ed2.locator('[data-check-refusals]').count()) === 0 && callsOf(ctx, 'check').length === beforeSave)
  check(L + '… the price warning still stands', (await ed2.locator('[data-check-warning="101007"]').count()) === 1)
  check(L + '… and Send is enabled: a warning does not stop it', !(await ed2.locator('[data-editor-send]').isDisabled()) && (await ed2.locator('[data-editor-send]').getAttribute('data-send-blocked')) === 'false')

  // Send runs Check first: a refusal found then keeps the dialog shut.
  state.header = [['stores', 'noStores']]
  const before = callsOf(ctx, 'check').length
  await ed2.locator('[data-editor-send]').click()
  await ed2.locator('[data-check-panel="refused"]').waitFor({ timeout: 10000 })
  check(L + 'Send checks first, and a refusal keeps the Send dialog shut', callsOf(ctx, 'check').length === before + 1 && (await page.locator(REASON).count()) === 0 && callsOf(ctx, 'send').length === 0)
  check(L + '… Send is disabled again', await ed2.locator('[data-editor-send]').isDisabled())
  state.header = []
  await ed2.locator('[data-check-run]').click()
  await ed2.locator('[data-check-panel="clean"]').waitFor({ timeout: 10000 })
  check(L + 'Check now re-runs on demand: clean, Send enabled', !(await ed2.locator('[data-editor-send]').isDisabled()) && callsOf(ctx, 'check').length === before + 2)

  // Review B1 / B2: while Send's own Check is in flight, the form is held — an edit made then would
  // otherwise be dropped: the dialog opens on the Check of the SAVED version, and Send posts it.
  bend.checkDelay = 1500
  await ed2.locator('[data-editor-send]').click()
  await ed2.locator('[data-check-run]', { hasText: 'Checking' }).waitFor({ timeout: 5000 })
  const held = await ed2.locator('[data-editor-display-en]').isDisabled()
  check(L + 'B1: while the pre-send Check runs, the form is held (no edit to lose)', held && (await ed2.locator('[data-editor-paste]').isDisabled()))
  if (!held) await ed2.locator('[data-editor-display-en]').fill('Edited while checking')
  await page.waitForFunction(() => !document.querySelector('dialog[open] [data-check-run]')?.textContent?.includes('Checking'), null, { timeout: 10000 })
  await page.waitForTimeout(200)
  const opened = (await page.locator(REASON).count()) === 1
  const stateNow = await ed2.locator('[data-editor-state]').getAttribute('data-editor-state')
  check(L + 'B2: the Send dialog opens only for the form as checked (never over an unsaved edit)', !opened || stateNow === 'saved', `dialog ${opened}, form ${stateNow}`)
  bend.checkDelay = 0
  if (!opened) {
    await ed2.locator('[data-editor-send]').click()
    await page.locator(REASON).waitFor({ timeout: 10000 })
  }
  check(L + 'a clean check opens the Send dialog', (await page.locator(REASON).count()) === 1)
  await reason(page, 'Go live')
  await page.locator('dialog[open][data-promotion-sheet="p-new1"]').waitFor({ timeout: 15000 })
  check(L + 'and the promotion is sent', JSON.stringify(callsOf(ctx, 'send')[0]?.body) === JSON.stringify({ reason: 'Go live' }))

  if (dir === 'rtl') {
    check(L + 'dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  }
  check(L + 'no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
if (want('11')) await checkScenario('ltr')
if (want('11')) await checkScenario('rtl')

// ── 12: the same-item bundle — columns, part preview, Send N promotions, per-part status (668) ───
// The plan is the SERVER's (BackOffice 3213): here the STUB groups the saved draft's rows by (buy,
// get, subtype, value) — a blank subtype / value reading the default — as 3213 does, and names each
// part "<name> · B<buy>G<get> <value><suffix>". There is no promotion buy / get default.

const suffixOf = (subtype) => (subtype === 'PERCENTAGE' ? '%' : subtype === 'ABSOLUTE' ? ' SAR' : ' final')
/** The stub's plan: one part per distinct (buy, get, subtype, value), first seen first. */
function planOf(d) {
  const parts = new Map()
  for (const i of d.items.filter((x) => x.active)) {
    const subtype = i.subtype ?? d.defaultSubtype
    const value = i.value ?? d.defaultValue
    const combination = `B${i.buyQuantity}G${i.getQuantity}|${subtype}|${value}`
    const prev = parts.get(combination)
    if (prev) prev.skuCount++
    else
      parts.set(combination, previewPart({ partNo: parts.size + 1, combination, buyQuantity: i.buyQuantity, getQuantity: i.getQuantity, subtype, value, skuCount: 1, name: `${d.name} · B${i.buyQuantity}G${i.getQuantity} ${value}${suffixOf(subtype)}` }))
  }
  return [...parts.values()]
}
const comboOfItem = (d, i) => `B${i.buyQuantity}G${i.getQuantity}|${i.subtype ?? d.defaultSubtype}|${i.value ?? d.defaultValue}`
const bundleCheck = (_ctx, d) => checkOf(d.promotionId, { itemCount: d.items.length, parts: planOf(d) })
const bundleSend = (ctx, m) => {
  const id = decodeURIComponent(m[1])
  const d = ctx.saved[id]
  const plan = planOf(d)
  const partIdOf = (i) => `pt-b${plan.findIndex((x) => x.combination === comboOfItem(d, i)) + 1}`
  ctx.saved[id] = {
    ...d,
    status: 'sending',
    sentAt: AT,
    sentBy: 'msartawi',
    items: d.items.map((i) => ({ ...i, sku: `SKU-${i.materialNumber}`, partId: partIdOf(i) })),
    parts: plan.map((x, n) => part(`pt-b${n + 1}`, { partNo: x.partNo, name: x.name, combination: x.combination, status: 'sending', refusals: null })),
    sends: plan.map((_, n) => send(`s-b${n + 1}`, { partId: `pt-b${n + 1}`, sentAt: AT, reason: 'Eid go', jobStatus: 'QUEUED', hsUpdatedAt: null })),
  }
  return envelope(ctx.saved[id])
}
/** HungerStation answers: part 2 FAILED, the others COMPLETED — the promotion reads Failed. */
const bundleRefresh = (ctx, m) => {
  const id = decodeURIComponent(m[1])
  const d = ctx.saved[id]
  const job = (pid) => (pid === 'pt-b2' ? 'FAILED' : 'COMPLETED')
  ctx.saved[id] = {
    ...d,
    status: 'failed',
    parts: d.parts.map((x) => ({ ...x, status: x.partId === 'pt-b2' ? 'failed' : 'live', refusals: NO_REFUSALS() })),
    sends: d.sends.map((x) => ({ ...x, jobStatus: job(x.partId) })),
  }
  return envelope(ctx.saved[id])
}

// A mixed 1,000-row sheet: 600 B2G1 rows with a blank discount (→ the default 50%), 300 BOGO, 100 at
// a final price. The first three lines are one of each, so the grid's first rows show each kind.
const PASTE668 = [
  ['Material', 'Buy', 'Get', 'Subtype', 'Value', 'MaxQty'],
  ...Array.from({ length: 1000 }, (_, n) => {
    const material = String(400001 + n)
    const kind = n < 3 ? ['blank', 'bogo', 'final'][n] : n < 602 ? 'blank' : n < 901 ? 'bogo' : 'final'
    return kind === 'blank' ? [material, '2', '1', '', '', ''] : kind === 'bogo' ? [material, '1', '1', 'PERCENTAGE', '100', '2'] : [material, '2', '1', 'FINAL_PRICE', '9.95', '']
  }),
]
  .map((r) => r.join('\t'))
  .join('\r\n')
const PASTE668_BAD = [['400001', '0', '1', '', '', ''], ['400002', '2', '1', '', '', '']].map((r) => r.join('\t')).join('\r\n')
const PART_WORDS = ['Buy 2 get 1 at 50% off', 'Buy 1 get 1 free', 'Buy 2 get 1 for 9.950 SAR']
const PART_NAMES = ['Eid 668 · B2G1 50%', 'Eid 668 · B1G1 100%', 'Eid 668 · B2G1 9.95 final']
{
  const d = { promotionId: 'p', name: 'Eid 668', defaultSubtype: 'PERCENTAGE', defaultValue: 50, items: [item('1', { buyQuantity: 2, getQuantity: 1, subtype: null, value: null })] }
  const plan = bundleCheck(null, d).parts
  sameKeys('12: the previewed part the stub answers is exactly HungerStationPromotionPartPreview', 'HungerStationPromotionPartPreview', plan[0])
  check('12: the stub names a part and its combination as 3213 does', plan[0].name === 'Eid 668 · B2G1 50%' && plan[0].combination === 'B2G1|PERCENTAGE|50', JSON.stringify(plan[0]))
}

async function bundleScenario(dir) {
  const L = '12 ' + dir.toUpperCase() + ': '
  const { context, page, errors, ctx } = await open(dir, { doors: { ...doors666({ checkOf: bundleCheck }), send: bundleSend, refresh: bundleRefresh } })
  const ed = await startNew(page)
  check(L + 'a new promotion is a strikethrough until the type is picked', (await ed.locator('[data-editor-type]').inputValue()) === 'STRIKETHROUGH')
  await ed.locator('[data-editor-type]').selectOption('SAME_ITEM_BUNDLE')
  check(L + 'a bundle has NO default buy / get boxes (the contract has none)', (await ed.locator('[data-editor-default-buy], [data-editor-default-get]').count()) === 0)
  await fillHeader(ed)
  await ed.locator('[data-editor-name]').fill('Eid 668')
  await ed.locator('[data-editor-end-date]').fill('2026-11-30')
  await ed.locator('[data-editor-default-value]').fill('50')
  check(L + 'the items section says rows with different buy/get or discount go out as separate promotions', (await ed.locator('[data-editor-split-note]').innerText()).includes('Rows with different buy/get or discount are sent as separate HungerStation promotions.'))

  // The paste step: the bundle columns.
  const dlg = await paste(page, ed, PASTE668_BAD)
  const format = await dlg.locator('[data-import-format]').innerText()
  check(L + 'the paste step names the bundle columns, says buy / get are each row’s own, and how rows go out', /material, buy, get, subtype .*value, max quantity/.test(format) && format.includes('Buy and get are each row’s own') && format.includes('Rows with different buy/get or discount are sent as separate HungerStation promotions.'))
  await dlg.locator('[data-import-preview] .ag-row[row-index]').first().waitFor({ timeout: 5000 })
  const previewText = await dlg.locator('[data-import-preview]').innerText()
  check(L + 'a buy of 0 is flagged on its line, and holds the paste back', previewText.includes('The buy quantity is not a whole number of at least 1.') && (await page.locator('dialog[open] [data-import-send]').isDisabled()), previewText.slice(0, 300))
  await dlg.locator('[data-import-text]').fill(PASTE668)
  await page.waitForFunction(() => document.querySelector('dialog[open] [data-import-send]')?.textContent?.replace(/[⁦-⁩]/g, '').includes('1,000'), null, { timeout: 15000 })
  check(L + 'the mixed sheet reads as 1,000 materials, the header skipped', (await dlg.locator('[data-import-header-skipped]').count()) === 1 && strip(await page.locator('dialog[open] [data-import-send]').innerText()) === 'Use 1,000 materials')
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="400003"]').waitFor({ timeout: 15000 })
  check(L + '1,000 items in the editor', (await ed.locator('[data-editor-items-count]').getAttribute('data-editor-items-count')) === '1000')
  check(L + 'a row’s own buy / get; its blank discount shows the default, greyed', (await itemCell(ed, '400001', 'buyQuantity')) === '2' && (await itemCell(ed, '400001', 'value')) === '50%' && (await ed.locator('[data-editor-items-grid] .ag-row[row-id="400001"] [col-id="value"].italic').count()) === 1)
  check(L + 'that row reads as its combination', (await itemCell(ed, '400001', 'combination')) === 'Buy 2 get 1 at 50% off', await itemCell(ed, '400001', 'combination'))
  check(L + 'the BOGO row reads "Buy 1 get 1 free"', (await itemCell(ed, '400002', 'combination')) === 'Buy 1 get 1 free', await itemCell(ed, '400002', 'combination'))
  check(L + 'a final-price row reads in SAR', (await itemCell(ed, '400003', 'combination')) === 'Buy 2 get 1 for 9.950 SAR', await itemCell(ed, '400003', 'combination'))
  check(L + 'a grid cell carries no isolate characters', !/[⁦-⁩]/.test(await itemCell(ed, '400003', 'combination')))
  check(L + 'before Check, Send says just Send', strip(await ed.locator('[data-editor-send]').innerText()) === 'Send')

  // Save: the body.
  await ed.locator('[data-editor-save]').click()
  await reason(page, 'Eid draft')
  await page.waitForFunction(() => new URL(location.href).searchParams.get('edit') === 'p-new1', null, { timeout: 20000 })
  const body = callsOf(ctx, 'create')[0]?.body
  check(
    L + 'the save body names the type and the default discount — and no buy / get default',
    body?.type === 'SAME_ITEM_BUNDLE' && body.defaultSubtype === 'PERCENTAGE' && body.defaultValue === 50 && !('defaultBuyQuantity' in body) && !('defaultGetQuantity' in body),
    JSON.stringify({ ...body, items: undefined }),
  )
  check(
    L + 'each row as pasted: a blank discount = null, BOGO 1/1/PERCENTAGE/100, the page never groups them',
    body?.items.length === 1000 &&
      JSON.stringify(body.items.slice(0, 3)) ===
        JSON.stringify([
          { materialNumber: '400001', buyQuantity: 2, getQuantity: 1, subtype: null, value: null, maxQuantity: null },
          { materialNumber: '400002', buyQuantity: 1, getQuantity: 1, subtype: 'PERCENTAGE', value: 100, maxQuantity: 2 },
          { materialNumber: '400003', buyQuantity: 2, getQuantity: 1, subtype: 'FINAL_PRICE', value: 9.95, maxQuantity: null },
        ]),
    JSON.stringify(body?.items.slice(0, 3)),
  )
  if (dir === 'ltr') sameKeys('12: the bundle save body has exactly HungerStationPromotionSaveBody’s fields', 'HungerStationPromotionSaveBody', body)

  // Check: the part preview, as the server planned it.
  const ed2 = page.locator(EDITOR('p-new1'))
  await ed2.locator('[data-check-parts]').waitFor({ timeout: 20000 })
  check(L + 'Check previews the sheet as 3 parts', (await ed2.locator('[data-check-parts]').getAttribute('data-check-parts')) === '3')
  check(L + 'the parts are counted in words', strip(await ed2.locator('[data-check-parts-count]').innerText()).startsWith('3 separate HungerStation promotions'), await ed2.locator('[data-check-parts-count]').innerText())
  const rows = []
  for (let n = 0; n < 3; n++) {
    const r = ed2.locator(`[data-check-part="${n}"]`)
    rows.push([strip(await r.locator('[data-check-part-combination]').innerText()), await r.locator('[data-check-part-skus]').getAttribute('data-check-part-skus'), strip(await r.locator('[data-check-part-name]').innerText())])
  }
  check(
    L + 'each part: the combination in words, its SKU count and its name on HungerStation',
    JSON.stringify(rows) === JSON.stringify([[PART_WORDS[0], '600', PART_NAMES[0]], [PART_WORDS[1], '300', PART_NAMES[1]], [PART_WORDS[2], '100', PART_NAMES[2]]]),
    JSON.stringify(rows),
  )
  check(L + 'Send says "Send 3 promotions to 3 stores"', strip(await ed2.locator('[data-editor-send]').innerText()) === 'Send 3 promotions to 3 stores' && (await ed2.locator('[data-editor-send]').getAttribute('data-editor-send-parts')) === '3', await ed2.locator('[data-editor-send]').innerText())
  if (dir === 'rtl') {
    const raw = await ed2.locator('[data-check-part="0"] [data-check-part-combination]').innerText()
    check(L + 'each value in the part words is isolated whole (FSI…PDI)', raw.includes('\u206850%\u2069') && raw.includes('\u20682\u2069'), JSON.stringify(raw))
    check(L + 'the part name is free text in a <bdi>', (await ed2.locator('[data-check-part="0"] [data-check-part-name] bdi:not([dir])').count()) === 1)
    check(L + 'the SKU count is a machine value', (await ed2.locator('[data-check-part="0"] [data-check-part-skus] bdi[dir="ltr"]').count()) === 1)
    check(L + 'dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  }
  await page.screenshot({ path: `${SHOTS}/${dir}-bundle-parts.png` })

  // Send: three parts go out; the detail shows each one's status.
  await ed2.locator('[data-editor-send]').click()
  await reason(page, 'Eid go')
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-new1"]')
  await sheet.locator('[data-promotion-part="pt-b3"]').waitFor({ timeout: 20000 })
  check(L + 'Send posts { reason } once — the server sends the parts', callsOf(ctx, 'send').length === 1 && JSON.stringify(callsOf(ctx, 'send')[0].body) === JSON.stringify({ reason: 'Eid go' }))
  const jobs = async () => Promise.all(['pt-b1', 'pt-b2', 'pt-b3'].map(async (id) => (await sheet.locator(`[data-promotion-part="${id}"] [data-promotion-part-latest-job]`).innerText()).trim()))
  check(L + 'the detail lists the 3 parts, each queued', (await sheet.locator('[data-promotion-part]').count()) === 3 && (await jobs()).every((x) => x.startsWith('Queued')), JSON.stringify(await jobs()))
  check(L + 'each part names its combination', (await sheet.locator('[data-promotion-part="pt-b3"] [data-promotion-part-discount]').innerText()).includes('9.950 SAR'))
  await sheet.locator('[data-promotion-refresh]').click()
  await page.waitForFunction(() => document.querySelector('dialog[open] [data-promotion-field="status"] dd')?.textContent?.trim() === 'Failed', null, { timeout: 15000 })
  check(L + 'each part shows its own job: one failed, two completed', JSON.stringify(await jobs()) === JSON.stringify(['Completed', 'Failed', 'Completed']), JSON.stringify(await jobs()))
  check(L + '… and its own status', (await sheet.locator('[data-promotion-part="pt-b2"] [data-promotion-part-status]').innerText()).trim() === 'Failed' && (await sheet.locator('[data-promotion-part="pt-b1"] [data-promotion-part-status]').innerText()).trim() === 'Live')
  check(L + 'one failed part makes the promotion Failed', (await sheet.locator('[data-promotion-field="status"] dd').innerText()).trim() === 'Failed')
  check(L + 'each item names its part', (await sheet.locator('[data-promotion-item-part="pt-b2"]').first().innerText()).trim() === PART_NAMES[1])
  await page.screenshot({ path: `${SHOTS}/${dir}-bundle-detail.png` })
  check(L + 'no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
if (want('12')) await bundleScenario('ltr')
if (want('12')) await bundleScenario('rtl')

// ── 13: a live promotion edited in place, items removed with a reason (670) ──────────────────────
// The contract's Check takes no body and has no "changes", so the edit is NOT previewed: the PUT runs
// every check (DHS-00018 / 19 refuse it, nothing sent) and re-plans the parts (3215). The STUB does
// that the way 3215 describes: matched by combination — a part whose rows changed is re-upserted, a
// new combination a new part, a part left empty switched off.

const E670 = 'p-edit'
const NAME_A = 'Eid 670 · B2G1 50%'
const NAME_B = 'Eid 670 · B3G1 5 SAR'
const NAME_N = 'Eid 670 · B3G1 50%'

/** A live bundle: part A (201001, 201002) and part B (201003), sent to 1001 and 1002. */
function live670() {
  const r = row(E670, { name: 'Eid 670', type: 'SAME_ITEM_BUNDLE', status: 'live', storeCount: 2, itemCount: 3 })
  const A = { buyQuantity: 2, getQuantity: 1, subtype: 'PERCENTAGE', value: 50 }
  const B = { buyQuantity: 3, getQuantity: 1, subtype: 'ABSOLUTE', value: 5 }
  return detail(r, {
    defaultValue: 50,
    parts: [part('pt-a', { partNo: 1, name: NAME_A, combination: 'B2G1|PERCENTAGE|50' }), part('pt-b', { partNo: 2, name: NAME_B, combination: 'B3G1|ABSOLUTE|5' })],
    items: [item('201001', { ...A, partId: 'pt-a' }), item('201002', { ...A, partId: 'pt-a' }), item('201003', { ...B, partId: 'pt-b' })],
    sends: [send('s-a1', { partId: 'pt-a' }), send('s-b1', { partId: 'pt-b' })],
  })
}

const doors670 = (state) => ({
  read: (ctx, m, req, url) => (decodeURIComponent(m[1]) === E670 ? envelope(state.d) : baseRead(ctx, m, req, url)),
  // The edit: refused first as an identity change (DHS-00021), then by a check (DHS-00018, message
  // only), then saved — every part it touches re-sent (Sending).
  save: (ctx, m, req) => {
    const refusal = state.refusals.shift()
    if (refusal) return refuse(refusal)
    const body = req.postDataJSON()
    const d = state.d
    const now = new Map()
    for (const i of body.items) {
      const combination = comboOfItem(d, i)
      if (!now.has(combination)) now.set(combination, [])
      now.get(combination).push(i)
    }
    const byCombo = new Map(d.parts.map((p) => [p.combination, p]))
    let n = 0
    const parts = [
      ...d.parts.map((p) => (now.has(p.combination) ? { ...p, status: 'sending', refusals: null } : { ...p, active: false, status: 'sending', refusals: null })),
      ...[...now.keys()].filter((c) => !byCombo.has(c)).map((c) => part(`pt-n${++n}`, { partNo: d.parts.length + n, name: NAME_N, combination: c, status: 'sending', refusals: null })),
    ]
    const partIdOf = (i) => parts.find((p) => p.combination === comboOfItem(d, i)).partId
    const gone = d.items.filter((i) => !body.items.some((b) => b.materialNumber === i.materialNumber)).map((i) => ({ ...i, active: false }))
    state.d = {
      ...d,
      displayNameEn: body.displayNameEn,
      displayNameAr: body.displayNameAr,
      orderLimit: body.orderLimit,
      globalLimit: body.globalLimit,
      status: 'sending',
      updatedAt: AT,
      parts,
      items: [...body.items.map((i, k) => item(i.materialNumber, { rowNo: k + 1, buyQuantity: i.buyQuantity, getQuantity: i.getQuantity, subtype: i.subtype, value: i.value, maxQuantity: i.maxQuantity, partId: partIdOf(i) })), ...gone],
      sends: [...d.sends, ...parts.map((p, k) => send(`s-e${k + 1}`, { partId: p.partId, kind: p.active ? 'UPSERT' : 'SWITCH_OFF', sentAt: AT, reason: body.reason, jobStatus: 'QUEUED', hsUpdatedAt: null }))],
    }
    return envelope({ ...state.d, check: checkOf(E670, { itemCount: body.items.length }) })
  },
  refresh: () => {
    state.d = {
      ...state.d,
      status: 'live',
      parts: state.d.parts.map((p) => ({ ...p, status: p.active ? 'live' : 'switchedOff', refusals: p.active ? NO_REFUSALS() : null })),
      sends: state.d.sends.map((s) => ({ ...s, jobStatus: 'COMPLETED' })),
    }
    return envelope(state.d)
  },
  // Those materials go out `active: false` in their parts; a part left empty is switched off. Its
  // job is open, so the promotion reads Sending until HungerStation answers.
  removeItems: (ctx, m, req) => {
    const body = req.postDataJSON()
    const items = state.d.items.map((i) => (body.materialNumbers.includes(i.materialNumber) ? { ...i, active: false } : i))
    const hit = new Set(state.d.items.filter((i) => body.materialNumbers.includes(i.materialNumber)).map((i) => i.partId))
    state.d = {
      ...state.d,
      status: 'sending',
      items,
      parts: state.d.parts.map((p) => (hit.has(p.partId) ? { ...p, status: 'sending', active: items.some((i) => i.active && i.partId === p.partId) } : p)),
    }
    return envelope(state.d)
  },
})

// 201001 stays B2G1 with a blank discount (the default 50%: part A), 201002 B3G1 50% (a new
// combination), 201003 dropped (part B empties).
const PASTE670 = [
  ['Material', 'Buy', 'Get', 'Subtype', 'Value', 'MaxQty'],
  ['201001', '2', '1', '', '', ''],
  ['201002', '3', '1', 'PERCENTAGE', '50', ''],
]
  .map((r) => r.join('\t'))
  .join('\r\n')

async function editScenario(dir) {
  const L = '13 ' + dir.toUpperCase() + ': '
  const state = { d: live670(), refusals: ['DHS-00021', 'DHS-00018'] }
  const { context, page, errors, ctx } = await open(dir, { doors: { ...doors666(), ...doors670(state) } })
  await page.goto(`${BASE}/hungerstation/promotions?promotion=${E670}`)
  const sheet = page.locator(`dialog[open][data-promotion-sheet="${E670}"]`)
  await sheet.locator('[data-promotion-item="201001"]').waitFor({ timeout: 20000 })
  const editBtn = sheet.locator('[data-promotion-edit]')
  check(L + 'a live promotion offers Edit, in place', (await editBtn.getAttribute('data-promotion-edit')) === 'inPlace' && (await editBtn.isEnabled()) && strip(await editBtn.innerText()) === 'Edit')
  check(L + 'each active item can be ticked for removal', (await sheet.locator('[data-promotion-item-pick]').count()) === 3)

  // ── The editor: the identity locked, everything else editable ──
  await editBtn.click()
  const ed = page.locator(EDITOR(E670))
  await ed.locator('[data-editor-store-list]').waitFor({ timeout: 15000 })
  check(L + '?edit= takes the promotion', search(page).get('edit') === E670)
  check(
    L + "the editor says it edits in place and that the identity is Replace's",
    (await ed.locator('[data-editor-mode="inPlace"]').count()) === 1 && (await ed.locator('[data-editor-locked]').innerText()).includes('changing any of them replaces the promotion'),
  )
  const dis = (sel) => ed.locator(sel).first().isDisabled()
  check(L + 'the name, start and end are locked', (await dis('[data-editor-name]')) && (await dis('[data-editor-start-date]')) && (await dis('[data-editor-start-time]')) && (await dis('[data-editor-end-date]')) && (await dis('[data-editor-end-time]')))
  check(L + 'the stores are locked', (await ed.locator('[data-editor-store-tick]').evaluateAll((els) => els.length === 3 && els.every((e) => e.matches(':disabled')))) && (await dis('[data-editor-stores-search]')))
  const pointers = await ed.locator('[data-editor-replace-pointer]').evaluateAll((els) => els.map((e) => [e.getAttribute('data-editor-replace-pointer'), e.textContent.trim()]))
  check(
    L + 'each locked field says: changing this replaces the promotion, with its Replace… button',
    JSON.stringify(pointers.map((p) => p[0]).sort()) === JSON.stringify(['name', 'stores', 'window']) && pointers.every((p) => p[1] === 'Changing this replaces the promotion.Replace…'),
    JSON.stringify(pointers),
  )
  check(L + 'the chain and the type are fixed once sent', (await dis('[data-editor-chain-select]')) && (await dis('[data-editor-type]')) && (await ed.innerText()).includes('Fixed once the promotion is sent.'))
  check(L + 'each locked field and the note offer Replace (the onReplace hook)', (await ed.locator('[data-editor-replace]').count()) === 4, String(await ed.locator('[data-editor-replace]').count()))
  check(
    L + 'display names, limits, defaults and the paste stay editable',
    !(await dis('[data-editor-display-en]')) && !(await dis('[data-editor-display-ar]')) && !(await dis('[data-editor-order-limit]')) && !(await dis('[data-editor-default-value]')) && !(await dis('[data-editor-paste]')),
  )
  check(
    L + 'the contract’s Check reads the saved promotion only: no Check here, the edit is checked by its save',
    (await ed.locator('[data-check-run]').count()) === 0 && (await ed.locator('[data-editor-edit-checks]').innerText()).includes('An edit is checked when it is saved and re-sent'),
  )
  check(L + 'unchanged: Save and re-send waits; no Save draft, no Send', (await dis('[data-editor-edit-send]')) && (await ed.locator('[data-editor-save]').count()) === 0 && (await ed.locator('[data-editor-send]').count()) === 0)

  // ── The edit: a display name, and the sheet pasted again ──
  await ed.locator('[data-editor-display-en]').fill('Eid: buy more, pay less')
  await paste(page, ed, PASTE670)
  await page.waitForFunction(() => /\b2\b/.test(document.querySelector('dialog[open] [data-import-send]')?.textContent?.replace(/[⁦-⁩]/g, '') ?? ''), null, { timeout: 15000 })
  await page.locator('dialog[open] [data-import-send]').click()
  await ed.locator('[data-editor-items-grid] .ag-row[row-id="201002"]').waitFor({ timeout: 15000 })
  check(L + 'changed: the footer says save and re-send it', (await ed.locator('[data-editor-state]').innerText()).trim() === 'Changed: save and re-send it.')

  // ── Save and re-send: a reason, the PUT checks ──
  await ed.locator('[data-editor-edit-send]').click()
  await page.locator(REASON).waitFor({ timeout: 10000 })
  check(L + 'Save and re-send opens the reason dialog — no Check call (the contract’s takes no edit)', callsOf(ctx, 'check').length === 0)
  check(L + 'the dialog says every check runs first and a refusal sends nothing', strip(await page.locator('dialog[open] [data-editor-edit-note]').innerText()).includes('Every check runs first: a refusal names its rows and sends nothing.'))
  await reason(page, 'Drop 201003, move 201002')
  const refusal = page.locator('dialog[open] [data-editor-needs-replace]')
  await refusal.waitFor({ timeout: 15000 })
  const rtext = await refusal.innerText()
  check(L + 'an identity change refused here (DHS-00021) shows inline and points to Replace', rtext.includes('replaces the promotion: use Replace') && rtext.includes('Changing this replaces the promotion.'), rtext)
  // (Re-typing the reason re-opens the core ReasonDialog's double-submit latch after a refusal.)
  await page.locator('dialog[open] [data-reason-input]').fill('x')
  await page.locator('dialog[open] [data-reason-input]').fill('Drop 201003, move 201002')
  await page.locator('dialog[open] [data-reason-confirm]').click()
  await page.locator('dialog[open] [data-reason-error="DHS-00018"]').waitFor({ timeout: 15000 }).catch(async (e) => {
    console.log('saves', JSON.stringify(callsOf(ctx, 'save').map((c) => c.body?.reason)), await page.locator(REASON).innerText().catch(() => 'no dialog'))
    throw e
  })
  check(L + 'an edit refused by a check (DHS-00018) shows the server’s words naming the row; nothing is swapped', (await page.locator(REASON).innerText()).includes('row 2: material 101002') && search(page).get('edit') === E670)
  // (Re-typing the reason re-opens the core ReasonDialog's double-submit latch after a refusal.)
  await page.locator('dialog[open] [data-reason-input]').fill('x')
  await page.locator('dialog[open] [data-reason-input]').fill('Drop 201003, move 201002')
  await page.locator('dialog[open] [data-reason-confirm]').click()
  await page.waitForFunction((id) => new URL(location.href).searchParams.get('promotion') === id && !new URL(location.href).searchParams.get('edit'), E670, { timeout: 20000 })
  const puts = callsOf(ctx, 'save')
  const pbody = puts.at(-1)?.body
  check(L + 'the edit is a PUT of the promotion with its reason', puts.length === 3 && puts.at(-1).path === `${P}/${E670}` && pbody?.reason === 'Drop 201003, move 201002' && pbody.displayNameEn === 'Eid: buy more, pay less' && pbody.name === 'Eid 670', JSON.stringify({ ...pbody, items: undefined }))
  check(
    L + '… with the identity exactly as sent (the stores by code, as frozen)',
    pbody?.startAt === '2026-11-01T00:00:00' && pbody.endAt === '2026-11-30T23:59:00' && JSON.stringify(pbody.storeCodes) === '["1001","1002"]' && pbody.chainKey === 'OlaCare' && pbody.type === 'SAME_ITEM_BUNDLE',
    JSON.stringify({ ...pbody, items: undefined }),
  )
  check(
    L + '… each row as pasted, the page never moves an item between parts itself',
    JSON.stringify(pbody?.items) ===
      JSON.stringify([
        { materialNumber: '201001', buyQuantity: 2, getQuantity: 1, subtype: null, value: null, maxQuantity: null },
        { materialNumber: '201002', buyQuantity: 3, getQuantity: 1, subtype: 'PERCENTAGE', value: 50, maxQuantity: null },
      ]),
    JSON.stringify(pbody?.items),
  )
  if (dir === 'ltr') sameKeys("13: the edit PUT body has exactly HungerStationPromotionSaveBody's fields", 'HungerStationPromotionSaveBody', pbody)

  // ── The detail takes over: Sending, and every write waits ──
  const sheet2 = page.locator(`dialog[open][data-promotion-sheet="${E670}"]`)
  await sheet2.locator('[data-promotion-part="pt-n1"]').waitFor({ timeout: 20000 })
  check(L + 'the detail reads Sending: the new part, the emptied part switched off (a SWITCH_OFF send)', (await sheet2.locator('[data-promotion-field="status"] dd').innerText()).trim() === 'Sending' && (await sheet2.locator('[data-promotion-part="pt-b"] [data-promotion-part-active]').getAttribute('data-promotion-part-active')) === 'false' && (await sheet2.locator('[data-promotion-send-kind="SWITCH_OFF"]').count()) === 1)
  check(L + 'while Sending, Edit waits', (await sheet2.locator('[data-promotion-edit]').getAttribute('data-promotion-edit')) === 'sending' && (await sheet2.locator('[data-promotion-edit]').isDisabled()))
  check(L + 'while Sending, Remove items waits', (await sheet2.locator('[data-promotion-remove-items]').isDisabled()) && (await sheet2.locator('[data-promotion-item-pick]').evaluateAll((els) => els.length > 0 && els.every((e) => e.matches(':disabled')))))
  check(L + 'the item that left reads Removed, still listed', (await sheet2.locator('[data-promotion-item="201003"]').getAttribute('data-promotion-item-active')) === 'false')
  await page.goto(`${BASE}/hungerstation/promotions?edit=${E670}`)
  const ed2 = page.locator(EDITOR(E670))
  await ed2.locator('[data-editor-locked="sending"]').waitFor({ timeout: 20000 })
  check(L + 'the editor opened while Sending writes nothing', (await ed2.locator('[data-editor-edit-send]').count()) === 0 && (await ed2.locator('[data-editor-display-en]').isDisabled()))
  await page.screenshot({ path: `${SHOTS}/${dir}-edit-sending.png` })

  // ── Remove items, once HungerStation answered ──
  await page.goto(`${BASE}/hungerstation/promotions?promotion=${E670}`)
  const sheet3 = page.locator(`dialog[open][data-promotion-sheet="${E670}"]`)
  await sheet3.locator('[data-promotion-refresh]').click()
  await page.waitForFunction(() => document.querySelector('dialog[open] [data-promotion-field="status"] dd')?.textContent?.trim() === 'Live', null, { timeout: 15000 })
  const removeBtn = sheet3.locator('[data-promotion-remove-items]')
  check(L + 'nothing ticked: Remove items waits', (await removeBtn.isDisabled()) && strip(await removeBtn.innerText()) === 'Remove items')
  await sheet3.locator('[data-promotion-item-pick-all]').check()
  check(
    L + 'every active item ticked: refused (that is a switch-off, 3215), the removed one not offered',
    (await removeBtn.getAttribute('data-promotion-remove-items')) === '2' && (await removeBtn.isDisabled()) && (await sheet3.locator('[data-promotion-remove-bar]').innerText()).includes('removing them all is a switch-off') && (await sheet3.locator('[data-promotion-item="201003"] [data-promotion-item-pick]').count()) === 0,
  )
  await sheet3.locator('[data-promotion-item-pick="201002"]').uncheck()
  check(L + 'untick one: Remove 1 item', strip(await removeBtn.innerText()) === 'Remove 1 item' && !(await removeBtn.isDisabled()))
  await removeBtn.click()
  await page.locator('dialog[open] [data-promotion-remove-dialog="1"]').waitFor({ state: 'attached', timeout: 10000 })
  check(L + 'the dialog says it goes out inactive and stays listed', strip(await page.locator(REASON).innerText()).includes('1 material goes out inactive in its part. It stays listed here as Removed.'))
  await reason(page, 'Delisted by the supplier')
  await page.waitForFunction(() => document.querySelector('dialog[open] [data-promotion-item="201001"]')?.getAttribute('data-promotion-item-active') === 'false', null, { timeout: 15000 })
  const rm = callsOf(ctx, 'removeItems')
  check(L + 'Remove items posts the materials and the reason', rm.length === 1 && rm[0].path === `${P}/${E670}/RemoveItems` && JSON.stringify(rm[0].body) === JSON.stringify({ materialNumbers: ['201001'], reason: 'Delisted by the supplier' }), JSON.stringify(rm[0]?.body))
  if (dir === 'ltr') sameKeys("13: the RemoveItems body has exactly the model's fields", 'HungerStationPromotionRemoveItemsBody', rm[0]?.body)
  check(L + 'the removed item reads Removed and stays listed', (await sheet3.locator('[data-promotion-item="201001"]').count()) === 1 && strip(await sheet3.locator('[data-promotion-item="201001"] td').last().innerText()) === 'Removed')
  check(
    L + 'its part, left empty, is switched off and the promotion reads Sending: every write waits, the sheet polls',
    (await sheet3.locator('[data-promotion-part="pt-a"] [data-promotion-part-active]').getAttribute('data-promotion-part-active')) === 'false' &&
      (await sheet3.locator('[data-promotion-field="status"] dd').innerText()).trim() === 'Sending' &&
      (await sheet3.locator('[data-promotion-edit]').isDisabled()) &&
      (await removeBtn.isDisabled()) &&
      (await sheet3.locator('[data-promotion-polling]').count()) === 1,
  )
  if (dir === 'rtl') check(L + 'dir is rtl', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
  await page.screenshot({ path: `${SHOTS}/${dir}-remove-items.png` })
  check(L + 'no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}
if (want('13')) await editScenario('ltr')
if (want('13')) await editScenario('rtl')

// ── 14: Replace, Switch off, and the Scheduled / Ended / store filters (ticket 671) ─────────────
// Door overrides only: `read` answers from `state.details`, which `replace` and `switchOff` change
// the way BackOffice 3216 describes — the old promotion's parts switched off first (its jobs open:
// it reads Sending), then a NEW record linked through `replacesPromotionId`. A refused switch-off
// (DHS-00020, 409) carries only its message and leaves everything as it was.

function replaceDoors(state) {
  const details = Object.fromEntries(freshRows().map((r) => [r.promotionId, detailOf(r)]))
  // A promotion with ONE part still Sending: both actions wait.
  details['p-failed'] = { ...details['p-failed'], status: 'sending', parts: [part('pt-1', { name: 'Vitamins' }), part('pt-2', { partNo: 2, name: 'Vitamins · 2', status: 'sending', refusals: null })] }
  // The promotion the drive replaces: its one part named as sent; it replaced p-ended earlier (a link).
  details['p-live'] = { ...details['p-live'], replacesPromotionId: 'p-ended', parts: [part('pt-1', { name: 'Ramadan' })] }
  // Two parts, so a switch-off can be refused for one (DHS-00014) and accepted for the other.
  details['p-scheduled'] = { ...details['p-scheduled'], parts: [part('pt-1', { name: 'National Day' }), part('pt-2', { partNo: 2, name: 'National Day · 2' })] }
  // Switched off, but its switch-off job FAILED: it reads Failed and SwitchOff retries the part.
  details['p-offfail'] = detail(row('p-offfail', { name: 'Old offer', status: 'failed' }), {
    switchedOffAt: '2026-10-28T12:00:00',
    switchedOffBy: 'msartawi',
    switchedOffReason: 'Stopped',
    parts: [part('pt-1', { name: 'Old offer', status: 'failed', refusals: null })],
    sends: [send('s-1'), send('s-off1', { kind: 'SWITCH_OFF', sentAt: '2026-10-28T12:00:00', jobStatus: 'FAILED', error: 'Vendor locked' })],
  })
  state.details = details
  const offSends = (d, parts, reason) => parts.map((p) => send(`s-off-${p.partId}`, { partId: p.partId, kind: 'SWITCH_OFF', sentAt: AT, reason, jobStatus: 'QUEUED', hsUpdatedAt: null }))
  return {
    read: (_ctx, m) => {
      const d = state.details[decodeURIComponent(m[1])]
      return d ? envelope(d) : refuse('DHS-00016')
    },
    replace: (_ctx, m, req) => {
      const id = decodeURIComponent(m[1])
      if (state.refuse) return refuse('DHS-00020')
      const b = req.postDataJSON()
      const old = state.details[id]
      // 1. every part of the old one switched off (accepted; the jobs open: it reads Sending) …
      state.details[id] = {
        ...old,
        status: 'sending',
        replacedByPromotionId: 'p-r2',
        switchedOffAt: AT,
        switchedOffBy: 'msartawi',
        switchedOffReason: b.reason,
        parts: old.parts.map((p) => ({ ...p, active: false, status: 'sending' })),
        sends: [...old.sends, ...offSends(old, old.parts, b.reason)],
      }
      // 2. … then the new record: the old header with the changes (a null keeps the old value), the
      // old active items, the new stores (null: as frozen), sent.
      const fresh = row('p-r2', { name: b.name ?? old.name, startAt: b.startAt ?? old.startAt, endAt: b.endAt ?? old.endAt, status: 'sending', sentAt: AT })
      state.details['p-r2'] = detail(fresh, {
        displayNameEn: old.displayNameEn,
        displayNameAr: old.displayNameAr,
        replacesPromotionId: id,
        stores: b.storeCodes ? b.storeCodes.map((c) => store(c)) : old.stores,
        parts: [part('pt-r2', { name: fresh.name, status: 'sending', refusals: null })],
        items: old.items.filter((i) => i.active).map((i) => ({ ...i, partId: 'pt-r2' })),
        sends: [send('s-r2', { partId: 'pt-r2', sentAt: AT, reason: b.reason, jobStatus: 'QUEUED', hsUpdatedAt: null })],
      })
      return envelope(state.details['p-r2'])
    },
    switchOff: (_ctx, m, req) => {
      const id = decodeURIComponent(m[1])
      const b = req.postDataJSON()
      const old = state.details[id]
      // p-scheduled: HungerStation refuses part 2 the first time; part 1 IS switched off.
      if (id === 'p-scheduled' && !state.partlyDone) {
        state.partlyDone = true
        state.details[id] = {
          ...old,
          parts: old.parts.map((p) => (p.partId === 'pt-1' ? { ...p, active: false, status: 'sending' } : p)),
          sends: [...old.sends, ...offSends(old, [old.parts[0]], b.reason), send('s-off-x', { partId: 'pt-2', kind: 'SWITCH_OFF', sentAt: AT, reason: b.reason, httpStatus: 422, jobId: null, jobStatus: null, error: 'Vendor promotion locked' })],
        }
        return refuse('DHS-00014', "HungerStation refused the switch-off of part 2 'National Day · 2' (422 Vendor promotion locked). / رفضت هنقرستيشن إيقاف الجزء 2.")
      }
      const on = old.parts.filter((p) => p.active || p.status === 'failed')
      state.details[id] = {
        ...old,
        // Every part accepted: stored switched off; it reads Sending until the jobs complete.
        status: 'sending',
        switchedOffAt: old.switchedOffAt ?? AT,
        switchedOffBy: old.switchedOffBy ?? 'msartawi',
        switchedOffReason: old.switchedOffReason ?? b.reason,
        parts: old.parts.map((p) => ({ ...p, active: false, status: 'sending' })),
        sends: [...old.sends, ...offSends(old, on, b.reason)],
      }
      return envelope(state.details[id])
    },
  }
}

async function replaceScenario(dir) {
  const state = { refuse: false }
  const { context, page, errors, ctx } = await open(dir, { doors: replaceDoors(state) })
  const L = '14 ' + dir.toUpperCase() + ': '
  const last = () => lists(ctx).at(-1)
  const sheetOf = (id) => page.locator(`dialog[open][data-promotion-sheet="${id}"]`)
  const statusOf = (sheet) => sheet.locator('[data-promotion-field="status"] [data-promotion-status]').getAttribute('data-promotion-status')
  const readsOf = (id) => ctx.calls.filter((c) => c.door === 'read' && c.path === `HungerStationWeb/Promotions/${id}`).length

  // ── The filters ⇄ URL ⇄ door ──
  await page.goto(BASE + '/hungerstation/promotions')
  await waitRows(page, N)
  await chip(page, 'scheduled')
  await waitRows(page, 1)
  check(L + 'Scheduled sends status=scheduled and rides the URL', last() === 'status=scheduled&skip=0&take=50' && search(page).getAll('status').join() === 'scheduled', last())
  check(L + '… and lists the scheduled promotion only', (await cell(page, 'p-scheduled', 'name')) !== null)
  await chip(page, 'ended')
  await waitRows(page, 1)
  check(L + 'Ended replaces it (the door takes one status)', last() === 'status=ended&skip=0&take=50' && search(page).getAll('status').join() === 'ended', last())
  await page.locator('[data-promotions-clear]').click()
  await waitRows(page, N)
  await page.locator('[data-filter-store]').fill(' 2001 ')
  await page.locator('[data-promotions-search]').click()
  await waitRows(page, 2)
  check(L + 'the store box sends store=2001 (trimmed) on Search and rides the URL', last() === 'store=2001&skip=0&take=50' && search(page).get('store') === '2001', last())
  check(L + '… "which promotions target this store": the one sent to 2001, and the all-stores draft', (await cell(page, 'p-refused', 'name')) !== null && (await cell(page, 'p-draft', 'name')) !== null)
  await page.goto(BASE + '/hungerstation/promotions?status=ended&store=1001')
  await waitRows(page, 1)
  check(
    L + 'a pasted URL drives the door and fills the store box and the chip',
    last() === 'status=ended&store=1001&skip=0&take=50' &&
      (await page.locator('[data-filter-store]').inputValue()) === '1001' &&
      (await page.locator('[data-filter-status="ended"]').getAttribute('aria-pressed')) === 'true',
    last(),
  )
  await page.locator('[data-promotions-clear]').click()
  await waitRows(page, N)
  check(L + 'Clear empties the store box and the URL', (await page.locator('[data-filter-store]').inputValue()) === '' && search(page).toString() === '')

  // ── Both actions wait while it reads Sending; neither is offered once it no longer runs ──
  await page.goto(BASE + '/hungerstation/promotions?promotion=p-failed')
  let sheet = sheetOf('p-failed')
  await sheet.locator('[data-promotion-replace]').waitFor({ timeout: 15000 })
  check(
    L + 'a part Sending → Replace and Switch off disabled, saying why',
    (await sheet.locator('[data-promotion-replace]').isDisabled()) &&
      (await sheet.locator('[data-promotion-switch-off]').isDisabled()) &&
      (await sheet.locator('[data-promotion-replace]').getAttribute('title')) === 'Waits until every part has HungerStation’s answer.',
  )
  for (const id of ['p-draft', 'p-off', 'p-replaced', 'p-ended']) {
    await page.goto(BASE + `/hungerstation/promotions?promotion=${id}`)
    await sheetOf(id).locator('[data-promotion-header] [data-promotion-status]').waitFor({ timeout: 15000 })
    check(L + `${id}: neither Replace nor Switch off is offered`, (await sheetOf(id).locator('[data-promotion-replace], [data-promotion-switch-off]').count()) === 0)
  }

  // ── A switch-off that FAILED: Switch off again retries it; no Replace ──
  await page.goto(BASE + '/hungerstation/promotions?promotion=p-offfail')
  sheet = sheetOf('p-offfail')
  await sheet.locator('[data-promotion-switch-off]').waitFor({ timeout: 15000 })
  check(
    L + 'switched off but its switch-off failed (it reads Failed): "Switch off again", no Replace, no Edit',
    (await sheet.locator('[data-promotion-switch-off]').getAttribute('data-promotion-switch-off')) === 'retry' &&
      strip(await sheet.locator('[data-promotion-switch-off]').innerText()) === 'Switch off again' &&
      (await sheet.locator('[data-promotion-replace]').count()) === 0 &&
      (await sheet.locator('[data-promotion-edit]').count()) === 0,
  )
  await sheet.locator('[data-promotion-switch-off]').click()
  let off = page.locator('dialog[open]:has([data-switch-off-dialog="p-offfail"]):not(:has(dialog))')
  await off.waitFor({ timeout: 10000 })
  check(L + '… its dialog says the switch-off did not take and this retries the parts still on', (await off.locator('[data-reason-note]').innerText()).includes('did not take on HungerStation') && strip(await off.locator('[data-reason-confirm]').innerText()) === 'Switch off again')
  await off.locator('[data-reason-input]').fill('Retry')
  await off.locator('[data-reason-confirm]').click()
  await page.locator('[data-switch-off-dialog]').waitFor({ state: 'detached', timeout: 10000 })
  check(L + '… it posts the same door; the promotion reads Sending until HungerStation has switched it off', callsOf(ctx, 'switchOff').at(-1)?.path === 'HungerStationWeb/Promotions/p-offfail/SwitchOff' && (await statusOf(sheet)) === 'sending')

  // ── Replace: a refused switch-off (DHS-00020) says so, in the server's words, and changes nothing ──
  await page.goto(BASE + '/hungerstation/promotions?promotion=p-live')
  sheet = sheetOf('p-live')
  await sheet.locator('[data-promotion-replace]').waitFor({ timeout: 15000 })
  check(L + 'a live promotion offers both, enabled', !(await sheet.locator('[data-promotion-replace]').isDisabled()) && !(await sheet.locator('[data-promotion-switch-off]').isDisabled()))
  await sheet.locator('[data-promotion-replace]').click()
  const dlg = page.locator('dialog[open]:has([data-replace-dialog="p-live"]):not(:has(dialog))')
  await dlg.locator('[data-replace-store="2001"]').waitFor({ timeout: 10000 })
  check(L + 'the dialog says in words what happens', (await dlg.locator('[data-reason-note]').innerText()).trim() === 'HungerStation sees a new promotion. The current one is switched off first; if that is refused, nothing changes.')
  const on = async () => dlg.locator('[data-replace-store-on="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-replace-store')))
  check(
    L + 'it starts as sent: the name, the window, the stores ticked as sent',
    (await dlg.locator('[data-replace-name]').inputValue()) === 'Ramadan' && (await dlg.locator('[data-replace-end-date]').inputValue()) === '2026-11-30' && (await on()).join() === '1001,1002',
    (await on()).join(),
  )
  await dlg.locator('[data-reason-input]').fill('Move to December')
  check(L + 'unchanged → Confirm waits, and says what a replace is for', (await dlg.locator('[data-reason-confirm]').isDisabled()) && (await dlg.locator('[data-replace-unchanged]').count()) === 1)
  await dlg.locator('[data-replace-name]').fill('Ramadan v2')
  await dlg.locator('[data-replace-store="1002"] [data-replace-store-tick]').click()
  await dlg.locator('[data-replace-store="2001"] [data-replace-store-tick]').click()
  await dlg.locator('[data-replace-end-date]').fill('2026-12-15')
  check(L + 'a changed name, stores and end → Confirm enabled', !(await dlg.locator('[data-reason-confirm]').isDisabled()) && (await dlg.locator('[data-replace-unchanged]').count()) === 0)
  state.refuse = true
  const readsBefore = readsOf('p-live')
  await dlg.locator('[data-reason-confirm]').click()
  const refused = dlg.locator('[data-replace-refused]')
  await refused.waitFor({ timeout: 10000 })
  // Only what changed: the start kept (null), the stores by code.
  const want = { name: 'Ramadan v2', startAt: null, endAt: '2026-12-15T23:59:00', allStores: null, storeCodes: ['1001', '2001'], reason: 'Move to December' }
  const replaces = callsOf(ctx, 'replace')
  check(
    L + 'Replace posts only what changed (null keeps the old value) to …/p-live/Replace',
    replaces.length === 1 && replaces[0].path === 'HungerStationWeb/Promotions/p-live/Replace' && JSON.stringify(replaces[0].body) === JSON.stringify(want),
    JSON.stringify(replaces[0]?.body),
  )
  sameKeys(L + "the Replace body has exactly the model's fields", 'HungerStationPromotionReplaceBody', replaces[0]?.body)
  const refusedText = (await refused.innerText()).replace(/\s+/g, ' ')
  check(
    L + 'the refused switch-off says so, nothing changed, and shows the server’s words (the part, HungerStation’s answer) and the code',
    refusedText.includes('HungerStation refused to switch off a part of this promotion.') &&
      refusedText.includes('Nothing new was sent, and this promotion is unchanged.') &&
      refusedText.includes("part 1 'Ramadan'") &&
      refusedText.includes('Vendor promotion locked') &&
      refusedText.includes('DHS-00020'),
    refusedText,
  )
  check(L + '… once, not again in the generic banner', (await dlg.locator('[data-reason-error]').count()) === 0)
  await page.waitForFunction((n) => true, readsBefore)
  await page.waitForTimeout(500)
  check(
    L + '… the old promotion is re-read and shown unchanged (Live, no successor)',
    readsOf('p-live') > readsBefore && (await statusOf(sheet)) === 'live' && (await sheet.locator('[data-promotion-field="replacedBy"]').count()) === 0,
    String(readsOf('p-live') - readsBefore),
  )
  if (dir === 'rtl') check(L + 'the server’s words are free text, isolated', (await refused.locator('[data-replace-refused-answer] bdi:not([dir])').innerText()).includes("'Ramadan'"))
  await page.screenshot({ path: `${SHOTS}/${dir}-replace-refused.png` })

  // ── Replace for real: the new one opens, and the two link to each other ──
  state.refuse = false
  // (Re-typing the reason re-opens the core ReasonDialog's double-submit latch after a refusal.)
  await dlg.locator('[data-reason-input]').fill('x')
  await dlg.locator('[data-reason-input]').fill('Move to December')
  await dlg.locator('[data-reason-confirm]').click()
  const fresh = sheetOf('p-r2')
  await fresh.locator('[data-promotion-replaces-link]').waitFor({ timeout: 15000 })
  check(L + 'the same body again; the NEW promotion opens (URL ?promotion=p-r2)', callsOf(ctx, 'replace').length === 2 && JSON.stringify(callsOf(ctx, 'replace')[1].body) === JSON.stringify(want) && search(page).get('promotion') === 'p-r2')
  check(
    L + 'the new one: its name, its stores, Sending, and a link back to the one it replaces',
    (await fresh.locator('[data-promotion-title]').innerText()).trim() === 'Ramadan v2' &&
      (await fresh.locator('[data-promotion-store]').evaluateAll((els) => els.map((e) => e.getAttribute('data-promotion-store')))).join() === '1001,2001' &&
      (await statusOf(fresh)) === 'sending' &&
      (await fresh.locator('[data-promotion-replaces-link]').getAttribute('data-promotion-replaces-link')) === 'p-live',
  )
  check(L + '… it reads Sending, so its own Replace and Switch off wait', (await fresh.locator('[data-promotion-replace]').isDisabled()) && (await fresh.locator('[data-promotion-switch-off]').isDisabled()))
  if (dir === 'rtl') check(L + 'a linked promotion id is an ltr isolate', (await fresh.locator('[data-promotion-replaces-link] bdi[dir="ltr"]').innerText()) === 'p-live')
  await page.screenshot({ path: `${SHOTS}/${dir}-replace-new.png` })
  await fresh.locator('[data-promotion-replaces-link]').click()
  const old = sheetOf('p-live')
  await old.locator('[data-promotion-replaced-by-link]').waitFor({ timeout: 15000 })
  check(
    L + 'the link opens the old one: Sending until its switch-off jobs complete (then Replaced), linked to its successor, nothing more to offer',
    search(page).get('promotion') === 'p-live' &&
      (await statusOf(old)) === 'sending' &&
      (await old.locator('[data-promotion-replaced-by-link]').getAttribute('data-promotion-replaced-by-link')) === 'p-r2' &&
      (await old.locator('[data-promotion-replace], [data-promotion-switch-off]').count()) === 0,
  )
  check(L + '… its sends show the switch-off', (await old.locator('[data-promotion-send="s-off-pt-1"] [data-promotion-send-kind="SWITCH_OFF"]').count()) === 1)
  await old.locator('[data-promotion-replaced-by-link]').click()
  await sheetOf('p-r2').waitFor({ timeout: 15000 })
  check(L + '… and back again', search(page).get('promotion') === 'p-r2')

  // ── A partial switch-off: DHS-00014 names the refused part; the others ARE off ──
  await page.goto(BASE + '/hungerstation/promotions?promotion=p-scheduled')
  sheet = sheetOf('p-scheduled')
  await sheet.locator('[data-promotion-switch-off]').waitFor({ timeout: 15000 })
  await sheet.locator('[data-promotion-switch-off]').click()
  off = page.locator('dialog[open]:has([data-switch-off-dialog="p-scheduled"]):not(:has(dialog))')
  await off.waitFor({ timeout: 10000 })
  const readsScheduled = readsOf('p-scheduled')
  await off.locator('[data-reason-input]').fill('Cancelled')
  await off.locator('[data-reason-confirm]').click()
  await off.locator('[data-switch-off-partly]').waitFor({ timeout: 10000 })
  check(L + 'a refused part (DHS-00014): the dialog keeps the server’s words naming it, and says the others were switched off', (await off.innerText()).includes("part 2 'National Day · 2'") && (await off.locator('[data-switch-off-partly]').innerText()).includes('Not every part was switched off; the others were.'))
  await page.waitForFunction(() => document.querySelector('[data-promotion-part="pt-1"] [data-promotion-part-active]')?.getAttribute('data-promotion-part-active') === 'false', null, { timeout: 10000 })
  check(L + '… and the detail is re-read: the accepted part reads inactive, the refused one still on', readsOf('p-scheduled') > readsScheduled && (await sheet.locator('[data-promotion-part="pt-2"] [data-promotion-part-active]').getAttribute('data-promotion-part-active')) === 'true')
  // (Re-typing the reason re-opens the core ReasonDialog's double-submit latch after a refusal.)
  await off.locator('[data-reason-input]').fill('Cancelled, try again')
  await off.locator('[data-reason-confirm]').click()
  await page.locator('[data-switch-off-dialog]').waitFor({ state: 'detached', timeout: 10000 })
  check(L + 'Switch off again tries the parts still on', callsOf(ctx, 'switchOff').filter((c) => c.path.endsWith('p-scheduled/SwitchOff')).length === 2 && (await statusOf(sheet)) === 'sending')

  // ── Switch off the whole promotion (an unanswered part reads Failed: it does not wait) ──
  await page.goto(BASE + '/hungerstation/promotions?promotion=p-refused')
  sheet = sheetOf('p-refused')
  await sheet.locator('[data-promotion-switch-off]').waitFor({ timeout: 15000 })
  check(L + 'a part with no answer for 24 hours does not hold Switch off back', !(await sheet.locator('[data-promotion-switch-off]').isDisabled()))
  await sheet.locator('[data-promotion-switch-off]').click()
  off = page.locator('dialog[open]:has([data-switch-off-dialog="p-refused"]):not(:has(dialog))')
  await off.waitFor({ timeout: 10000 })
  const note = (await off.locator('[data-reason-note]').innerText()).replace(/\s+/g, ' ').trim()
  check(
    L + 'Switch off confirms in words, on the danger button, and waits for a reason',
    note ===
      'Switches off every part of Eid B2G1 on HungerStation at once. Nothing is deleted: the promotion, its items and its sends stay here. It reads Sending until HungerStation has switched off every part, then Switched off.' &&
      (await off.locator('[data-reason-confirm]').isDisabled()) &&
      ((await off.locator('[data-reason-confirm]').getAttribute('class')) ?? '').includes('danger'),
    note,
  )
  await off.locator('[data-reason-input]').fill('  Campaign stopped ')
  await off.locator('[data-reason-confirm]').click()
  await page.locator('[data-switch-off-dialog]').waitFor({ state: 'detached', timeout: 10000 })
  const offs = callsOf(ctx, 'switchOff').filter((c) => c.path.endsWith('p-refused/SwitchOff'))
  check(L + 'Switch off posts { reason } (trimmed) to …/p-refused/SwitchOff', offs.length === 1 && JSON.stringify(offs[0].body) === JSON.stringify({ reason: 'Campaign stopped' }), JSON.stringify(offs[0]?.body))
  await page.waitForFunction(() => document.querySelector('dialog[open] [data-promotion-field="switchedOff"]'), null, { timeout: 10000 })
  check(
    L + 'it reads Sending (the switch-off jobs open), with why; every part inactive; nothing deleted; nothing more to offer',
    (await statusOf(sheet)) === 'sending' &&
      (await sheet.locator('[data-promotion-field="switchedOff"]').innerText()).includes('Campaign stopped') &&
      (await sheet.locator('[data-promotion-item]').count()) === 4 &&
      (await sheet.locator('[data-promotion-part-active="false"]').count()) === 2 &&
      (await sheet.locator('[data-promotion-replace], [data-promotion-switch-off]').count()) === 0,
  )
  await page.screenshot({ path: `${SHOTS}/${dir}-switched-off.png` })

  check(L + 'only list, stores, read, replace and switch-off doors were called', ctx.calls.every((c) => ['list', 'stores', 'read', 'replace', 'switchOff'].includes(c.door)), [...new Set(ctx.calls.map((c) => c.door))].join())
  check(L + 'no page errors (beyond the refusals’ own 409 / 502)', errors.length === 0, errors.join(' | '))
  await context.close()
}
if (want('14')) await replaceScenario('ltr')
if (want('14')) await replaceScenario('rtl')

// 14: 670's hook — the editor's "Changing this replaces the promotion" opens the detail on Replace.
if (want('14')) {
  const state = { refuse: false }
  const { context, page } = await open('ltr', { doors: replaceDoors(state) })
  // p-live replaced p-ended: each links to the other, so the sheet can go there and come back.
  state.details['p-ended'] = { ...state.details['p-ended'], replacedByPromotionId: 'p-live' }
  const L = '14 LTR: '
  const dialogUp = () => page.locator('[data-replace-dialog]').count()
  await page.goto(BASE + '/hungerstation/promotions?edit=p-live')
  const hook = page.locator('[data-editor-replace="stores"]')
  await hook.waitFor({ timeout: 15000 })
  // Review B8: not "is it visible" right after waiting for it — it sits under the LOCKED stores.
  check(L + 'the editor of a live promotion points to Replace beside the locked stores', (await page.locator('[data-editor-stores-locked] [data-editor-replace="stores"]').count()) === 1 && (await page.locator('[data-editor-store="1001"] [data-editor-store-tick]').isDisabled()))
  await hook.click()
  const dlg = page.locator('dialog[open]:has([data-replace-dialog="p-live"]):not(:has(dialog))')
  await dlg.waitFor({ timeout: 15000 })
  check(
    L + '… which opens the detail with the Replace dialog up (URL ?promotion=p-live, no ?edit)',
    search(page).get('promotion') === 'p-live' && search(page).get('edit') === null && (await page.locator('dialog[open][data-promotion-sheet="p-live"]').count()) === 1,
    search(page).toString(),
  )
  await dlg.locator('[data-reason-cancel]').click()
  await page.locator('[data-replace-dialog]').waitFor({ state: 'detached', timeout: 10000 })

  // Review B7: a cancelled Replace never comes back — not after following a link and coming back.
  await page.locator('[data-promotion-replaces-link="p-ended"]').click()
  await page.locator('dialog[open][data-promotion-sheet="p-ended"] [data-promotion-header] [data-promotion-status]').waitFor({ timeout: 15000 })
  await page.locator('[data-promotion-replaced-by-link="p-live"]').click()
  await page.locator('dialog[open][data-promotion-sheet="p-live"] [data-promotion-header] [data-promotion-status]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
  check(L + 'B7: a cancelled Replace does not reopen after following a link and coming back', (await dialogUp()) === 0)

  await page.locator('[data-promotion-sheet="p-live"] [data-promotion-close]').first().click()
  await page.locator('[data-promotion-sheet]').waitFor({ state: 'detached', timeout: 10000 })
  await page.locator('[data-promotion-details="p-live"]').click()
  await page.locator('dialog[open][data-promotion-sheet="p-live"] [data-promotion-header] [data-promotion-status]').waitFor({ timeout: 15000 })
  await page.waitForTimeout(600)
  check(L + '… nor on reopening the detail from the list', (await dialogUp()) === 0)
  await context.close()
}

// ── 15: review B3 — a promotion that READS Sending is polled, whatever its parts say ─────────────
// The contract's `sending` is wider than "a part's job is QUEUED": an IN_PROGRESS job, an open
// switch-off. The lock and the light poll follow the promotion's status, so it never sits locked
// with nothing re-reading it.
if (want('15')) {
  let reads = 0
  const inProgress = () => {
    const d = detailOf(freshRows()[0])
    return reads >= 3
      ? d
      : { ...d, status: 'sending', parts: [part('pt-1', { name: 'Ramadan', status: 'live' })], sends: [send('s-1', { jobStatus: 'IN_PROGRESS', hsUpdatedAt: null })] }
  }
  const { context, page, errors } = await open('ltr', { doors: { read: () => (reads++, envelope(inProgress())) } })
  await page.goto(`${BASE}/hungerstation/promotions?promotion=p-live`)
  const sheet = page.locator('dialog[open][data-promotion-sheet="p-live"]')
  await sheet.locator('[data-promotion-field="status"] [data-promotion-status="sending"]').waitFor({ timeout: 15000 })
  check('15: it reads Sending with no part Sending: every write waits, the poll note shows', (await sheet.locator('[data-promotion-edit]').isDisabled()) && (await sheet.locator('[data-promotion-polling]').count()) === 1)
  check('15: an unlisted job status (IN_PROGRESS) is shown as sent', (await sheet.locator('[data-promotion-part="pt-1"] [data-promotion-part-latest-job]').innerText()).trim() === 'IN_PROGRESS')
  await sheet.locator('[data-promotion-field="status"] [data-promotion-status="live"]').waitFor({ timeout: 45000 })
  check('15: … and the sheet re-reads itself until it reads Live', reads >= 3 && !(await sheet.locator('[data-promotion-edit]').isDisabled()), String(reads))
  check('15: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
