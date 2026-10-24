// HQ prescription sessions drive — "Close without invoice" (ticket 548; BackOffice spec 2994 story 72, door 3015).
//
// Drives the REAL app in Chromium against a STUB of the doors (no live SIS.Api; BackOffice 3015 is on
// branch spec2994, not deployed). In LTR and RTL (`oms.locale = 'ar'` sets dir="rtl"; i18n stays
// `lng: 'en'`), it asserts:
//   1. the button shows on DISPENSED rows only, in the All view and in the Owed view;
//   2. the dialog names the session and its holding store; Confirm waits for a reason; Other blocks
//      without a note; Goods never left says the units go to put-back;
//   3. each reason written off: the body is `{ reason, note }` trimmed, the dialog closes, a toast
//      names the session, the list is re-read, the row leaves it and the Owed count drops;
//   4. an OTHER with an Arabic note: the body carries it unchanged;
//   5. `PSES-00009`: the envelope message, its words and its code in the dialog, no toast, row kept;
//   6. a bare 403: "you don't hold the write-off grant" in the dialog, Confirm off; once closed, every
//      row's button is hidden for the visit.
//
//   1. run the app:  npx vite --port 5216 --strictPort
//   2. DRIVE_PORT=5216 node tools/prescription-sessions-write-off-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5216}`
const SHOTS = 'tools/.prescription-sessions-write-off-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
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

const row = (id, over = {}) => ({
  sessionId: id,
  displayId: `PS-${id}`,
  sourceKind: 'NPHS',
  sourceKey: `NP-${id}`,
  beneficiaryId: `10${id}00000`,
  beneficiaryName: 'Sara Ali',
  holdingStore: `P0${id}`,
  otherStore: null,
  otherStoreReason: null,
  state: 'DISPENSED',
  route: 'COUNTER',
  orderNo: `20000006${id}`,
  step: { code: 'INVOICE', label: 'Invoice the sale', owner: 'HOLDING_STORE', waitingOn: null, isParked: false, parkNote: null, badges: [] },
  createdAt: '2026-10-10T09:00:00',
  ageDays: 14,
  idleSince: '2026-10-20T10:00:00',
  idleDays: 4,
  isStalled: false,
  isAboutToLapse: false,
  isOwed: true,
  lapsesAtEndOf: null,
  dispensedAt: '2026-10-21T16:20:00',
  invoiceOwedAt: '2026-10-21T23:59:00',
  openItems: ['INVOICE_OWED'],
  hasOpenItem: true,
  ...over,
})

// 55-58 write off (one per reason), 61 is refused PSES-00009, 62 meets a bare 403; 12 is not dispensed.
const ALL = ['12', '55', '56', '57', '58', '61', '62']
const base = (id) => (id === '12' ? row(id, { state: 'PICKING', isOwed: false, openItems: [], hasOpenItem: false, dispensedAt: null, invoiceOwedAt: null }) : row(id))

const ARABIC_NOTE = 'المريض سافر ولن يعود — الوصفة 7781'

const browser = await chromium.launch()

async function drive(dir) {
  const rtl = dir === 'rtl'
  const L = dir
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of (400|403)/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)

  const gone = new Set()
  const reads = []
  const posts = []
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const u = new URL(req.url())
    const p = u.pathname.split('/api/')[1]
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'hq.user', currentStoreCode: 'HQ01' }))
    if (p === 'PrescriptionSessionWeb/Sessions' || p === 'PrescriptionSessionWeb/Sessions/Owed') {
      reads.push(p)
      const rows = ALL.filter((id) => !gone.has(id)).map(base).filter((r) => !p.endsWith('/Owed') || r.state === 'DISPENSED')
      const owed = rows.filter((r) => r.isOwed).length
      return route.fulfill(envelope({ rows, total: rows.length, stalled: 0, aboutToLapse: 0, owed, isTruncated: false }))
    }
    const m = /^PrescriptionSessionWeb\/([^/]+)\/WriteOff$/.exec(p ?? '')
    if (m && req.method() === 'POST') {
      const id = decodeURIComponent(m[1])
      posts.push({ id, body: req.postDataJSON() })
      if (id === '61')
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'PS-61 is not Dispensed, or a return is still pending.', errorCode: 'PSES-00009' }))
      if (id === '62') return route.fulfill({ status: 403, contentType: 'text/plain', body: '' })
      gone.add(id)
      return route.fulfill(envelope({ ...base(id), state: 'WRITTEN_OFF' }))
    }
    return route.fulfill(envelope({}))
  })

  const waitRows = (n) => page.waitForFunction((k) => document.querySelectorAll('[data-ps-grid] .ag-row').length === k, n, { timeout: 10000 })
  const ids = () =>
    page.evaluate(() =>
      [...document.querySelectorAll('[data-ps-grid] .ag-row')]
        .sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index')))
        .map((r) => ({ id: r.querySelector('[col-id="displayId"]')?.textContent ?? '', act: !!r.querySelector('[data-ps-write-off]') })),
    )
  const owedCount = () => page.locator('[data-ps-chip="OWED"] [data-ps-chip-count]').textContent()
  const dialog = () => page.locator('[data-ps-write-off-dialog]')
  const confirm = () => page.locator('[data-ps-write-off-confirm]')
  const openDialog = async (id) => {
    await page.locator(`[data-ps-write-off="${id}"]`).click()
    await page.locator(`[data-ps-write-off-dialog="${id}"]`).waitFor({ timeout: 5000 })
  }
  // The toast that names this session (sonner owns its DOM: never remove its nodes from here).
  const toastText = async (id) => {
    const t = page.locator('[data-sonner-toast]', { hasText: `PS-${id}` }).first()
    await t.waitFor({ timeout: 5000 })
    return t.textContent()
  }
  const toastsBefore61 = () => page.locator('[data-sonner-toast]', { hasText: 'PS-61' }).count()

  await page.goto(`${BASE}/oms/prescription-sessions`)
  await page.locator('[data-ps-hq]').waitFor({ timeout: 20000 })
  await waitRows(7)
  check(`${L}: the page is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)

  // ── 1: where the button shows ──────────────────────────────────────────────────────────────
  let g = await ids()
  check(`${L}: the button shows on DISPENSED rows only`, g.map((r) => `${r.id}:${r.act}`).join() === 'PS-12:false,PS-55:true,PS-56:true,PS-57:true,PS-58:true,PS-61:true,PS-62:true', g.map((r) => `${r.id}:${r.act}`).join())
  check(`${L}: the button reads Close without invoice`, (await page.locator('[data-ps-write-off="55"]').textContent()) === 'Close without invoice')
  await page.locator('[data-ps-view-button="owed"]').click()
  await waitRows(6)
  g = await ids()
  check(`${L}: the Owed view offers it too`, g.every((r) => r.act), g.map((r) => `${r.id}:${r.act}`).join())
  await page.locator('[data-ps-view-button="all"]').click()
  await waitRows(7)
  check(`${L}: the Owed count starts at 6`, (await owedCount()) === '6', await owedCount())

  // ── 2: the dialog ──────────────────────────────────────────────────────────────────────────
  await openDialog('55')
  const names = page.locator('[data-ps-write-off-names]')
  const named = await names.evaluate((el) => [...el.querySelectorAll('bdi[dir="ltr"]')].map((b) => b.textContent))
  check(`${L}: the confirm names the session and its holding store, each isolated`, named.join('|') === 'PS-55|P055', named.join('|'))
  const reasons = await page.evaluate(() => [...document.querySelectorAll('[data-ps-write-off-reason]')].map((r) => `${r.value}=${r.closest('label').textContent}`))
  check(
    `${L}: the four coded reasons, worded from core`,
    reasons.join('|') ===
      'PAYER_REFUSED=Payer refused / no coverage|SALE_LOST=Sale lost or made outside the session|GOODS_NEVER_LEFT=Goods never left the storeThe session\'s held units go to put-back.|OTHER=Other',
    reasons.join('|'),
  )
  check(`${L}: Confirm waits for a reason`, await confirm().isDisabled())
  await page.locator('[data-ps-write-off-reason="OTHER"]').check()
  check(`${L}: Other without a note blocks, and says so`, (await confirm().isDisabled()) && (await page.locator('[data-ps-write-off-note-hint]').count()) === 1)
  await page.locator('[data-ps-write-off-note]').fill('   ')
  check(`${L}: Other with only spaces still blocks`, await confirm().isDisabled())
  await page.locator('[data-ps-write-off-note]').fill('')
  await page.locator('[data-ps-write-off-reason="PAYER_REFUSED"]').check()
  check(`${L}: another reason needs no note`, !(await confirm().isDisabled()) && (await page.locator('[data-ps-write-off-note-hint]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/${L}-dialog.png`, fullPage: true })

  // ── 3 + 4: each reason written off ─────────────────────────────────────────────────────────
  const writeOff = async (id, reason, note, wantNote, owedAfter) => {
    if ((await dialog().count()) === 0) await openDialog(id)
    await page.locator('[data-ps-write-off-reason="' + reason + '"]').check()
    if (note !== null) await page.locator('[data-ps-write-off-note]').fill(note)
    const readsBefore = reads.length
    await confirm().click()
    await dialog().waitFor({ state: 'detached', timeout: 5000 })
    const last = posts[posts.length - 1]
    check(`${L}: ${reason} sends { reason, note } trimmed`, last.id === id && JSON.stringify(last.body) === JSON.stringify({ reason, note: wantNote }), JSON.stringify(last))
    const toast = await toastText(id)
    check(`${L}: ${reason} toasts the session written off`, toast.includes('PS-' + id) && /written off/.test(toast), toast)
    await page.waitForFunction((n) => !document.querySelector(`[data-ps-write-off="${n}"]`), id, { timeout: 10000 })
    check(`${L}: ${reason} re-reads the list`, reads.length > readsBefore)
    g = await ids()
    check(`${L}: ${reason}: PS-${id} leaves the list`, !g.some((r) => r.id === 'PS-' + id), g.map((r) => r.id).join())
    check(`${L}: ${reason}: the Owed count drops to ${owedAfter}`, (await owedCount()) === String(owedAfter), await owedCount())
  }
  await writeOff('55', 'PAYER_REFUSED', null, '', 5)
  await writeOff('56', 'SALE_LOST', '  sold at the counter  ', 'sold at the counter', 4)
  await openDialog('57')
  check(`${L}: Goods never left says the units go to put-back`, (await page.locator('[data-ps-write-off-put-back]').textContent()) === "The session's held units go to put-back.")
  await writeOff('57', 'GOODS_NEVER_LEFT', null, '', 3)
  await openDialog('58')
  await page.locator('[data-ps-write-off-reason="OTHER"]').check()
  await page.locator('[data-ps-write-off-note]').fill(ARABIC_NOTE)
  check(`${L}: the Arabic note reads in its own direction`, (await page.locator('[data-ps-write-off-note]').getAttribute('dir')) === 'auto')
  await page.screenshot({ path: `${SHOTS}/${L}-other-arabic.png`, fullPage: true })
  await writeOff('58', 'OTHER', null, ARABIC_NOTE, 2)

  // ── 5: PSES-00009 ──────────────────────────────────────────────────────────────────────────
  await openDialog('61')
  await page.locator('[data-ps-write-off-reason="SALE_LOST"]').check()
  await confirm().click()
  const code = page.locator('[data-ps-write-off-refusal="PSES-00009"]')
  await code.waitFor({ timeout: 5000 })
  const banner = await dialog().locator('[role="alert"]').textContent()
  check(`${L}: PSES-00009 shows the envelope message in the dialog`, banner.includes('PS-61 is not Dispensed, or a return is still pending.'), banner)
  check(`${L}: PSES-00009 shows its words and its code, isolated`, (await page.locator('[data-ps-write-off-refusal-label]').textContent()) === 'Not dispensed, or something is still pending' && (await code.locator('bdi[dir="ltr"]').textContent()) === 'PSES-00009')
  check(`${L}: PSES-00009: no toast, the dialog stays open, the row stays`, (await toastsBefore61()) === 0 && (await dialog().count()) === 1 && (await ids()).some((r) => r.id === 'PS-61'))
  await page.screenshot({ path: `${SHOTS}/${L}-pses-00009.png`, fullPage: true })
  await page.locator('[data-ps-write-off-cancel]').click()
  await dialog().waitFor({ state: 'detached', timeout: 5000 })
  check(`${L}: after a business refusal the buttons stay`, (await page.locator('[data-ps-write-off]').count()) === 2)

  // ── 6: bare 403 ────────────────────────────────────────────────────────────────────────────
  await openDialog('62')
  await page.locator('[data-ps-write-off-reason="PAYER_REFUSED"]').check()
  await confirm().click()
  await page.locator('[data-ps-write-off-refusal="notGranted"]').waitFor({ state: 'attached', timeout: 5000 })
  const denied = await dialog().locator('[role="alert"]').textContent()
  check(`${L}: a bare 403 says the write-off grant is not held, in the dialog`, /don't hold the write-off grant/.test(denied), denied)
  check(`${L}: a bare 403 turns Confirm off`, await confirm().isDisabled())
  await page.screenshot({ path: `${SHOTS}/${L}-not-granted.png`, fullPage: true })
  await page.locator('[data-ps-write-off-cancel]').click()
  await dialog().waitFor({ state: 'detached', timeout: 5000 })
  check(`${L}: after a bare 403 every row's button is hidden`, (await page.locator('[data-ps-write-off]').count()) === 0 && (await ids()).length === 3)
  check(`${L}: the POST never carried an actor`, posts.every((x) => Object.keys(x.body).join() === 'reason,note'))

  check(`${L}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await drive('ltr')
await drive('rtl')
await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
