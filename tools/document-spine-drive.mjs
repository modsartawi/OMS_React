// Delivery details activity-spine drive (spec 380 D4–D7, D12, ticket 403; rulings 371 §3–4,
// 369 §2–5, 368 §3).
//
// Drives the REAL app in Chromium. The headers are the ticket-078 live captures (replayed
// verbatim, as every document drive does), patched only where a case needs a state no capture
// holds; the Log and Outbox rows are the 371 prototype's synthesized rows (no capture of either
// exists). Only the wire is stubbed.
//
// In light and dark, LTR and RTL (`oms.locale = 'ar'` sets `dir="rtl"`; there is no Arabic locale
// file, so the copy stays English and the stub ROWS carry the Arabic), it asserts:
//   1. the Log and Jobs tabs are gone; the spine sits on the inline START side (right under RTL),
//      340–420px wide, beside the rest of the page at 1440;
//   2. top to bottom: the failed-job banners, the retrying line, the unreached steps furthest
//      first, the Now line, the past newest first;
//   3. ONE banner per F job: line one "<handler> failed · 5 attempts" and its time, line two the
//      last error; its Retry slot draws nothing and there is no Retry button anywhere;
//   4. a P job with an error gets the quiet "failing, retrying automatically · attempt n · next
//      hh:mm" line and its error, never a button;
//   5. the next step carries its window as an EXPECTATION: the schedule's range one ltr isolate
//      that reads left-to-right, the slot's own words a dir-auto <bdi>; never the From == To
//      capture timestamp;
//   6. after a rewind: Ready and Out are struck "earlier pass" rows, the rewinds are AMBER nodes,
//      Created is the current milestone, with no "now" tag on it;
//   7. Cancellation requested is INDIGO (`--fam-cancel-request`), Cancelled is RED, never amber;
//      a request then carried out is a plain event, not struck;
//   8. the who · when meta: the user a <bdi>, the time one ltr isolate reading left-to-right, no
//      isolate characters in the text;
//   9. a Log that fails to load says so inside the spine, and the steps still draw.
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/document-spine-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'
const SHOTS = 'tools/.document-spine-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200, success = true, message = '' } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success, message, errors: [], data }),
})

const CAPTURES = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  CAPTURES[capture.data.documentNo] = capture.data
}

const ARABIC_USER = 'مندوب المتجر'
const ARABIC_NOTE = 'العميل طلب الاتصال قبل الوصول'

const logs = (documentNo, rows) =>
  rows.map(([entryTime, actionType, actionTypeDescription, entryUser, note = '', actionData = '', actionOldData = ''], i) => ({
    logNo: String(i + 1),
    documentNo,
    entryTime,
    entryUser,
    actionType,
    actionTypeDescription,
    actionData,
    actionOldData,
    note,
    staffId: '',
    storeCode: '',
  }))

const jobs = (documentNo, rows) =>
  rows.map(([entryTime, actionTypeDescription, attemptCount, outboxStatus, errorMessage = '', nextAttemptTime = ''], i) => ({
    outboxId: String(9100 + i),
    actionType: 'JOB' + i,
    actionTypeDescription,
    documentNo,
    documentCategory: 'D',
    userId: 'system',
    entryTime,
    attemptCount,
    lastAttemptTime: entryTime,
    nextAttemptTime,
    outboxStatus,
    errorMessage,
  }))

/** The cases, keyed by number. `dir` lets the RTL pass carry Arabic rows. */
function cases(dir) {
  const rtl = dir === 'rtl'
  const base = CAPTURES['8000000121']
  const D = '2026-10-02T'
  const T121 = '2025-03-06T'
  const T174 = '2025-04-24T'
  return {
    // Out for delivery on a real 10:00–12:00 schedule: two failed jobs, one failing and retrying.
    '8000000300': {
      doc: {
        ...base,
        documentNo: '8000000300',
        deliveryScheduleFromTime: `${D}10:00:00`,
        deliveryScheduleToTime: `${D}12:00:00`,
        status: { ...base.status, readyStatus: 'R', deliveryStatus: 'O', closeStatus: '', lastAction: 'DOFD' },
      },
      logs: logs('8000000300', [
        [`${D}09:15:12`, 'DCRT', 'Delivery created', 'call.center.07'],
        [`${D}09:16:40`, 'DADN', 'Note added', rtl ? ARABIC_USER : 'call.center.07', rtl ? ARABIC_NOTE : 'Customer asked to call before arrival.'],
        [`${D}09:30:05`, 'DRDY', 'Ready for delivery', 'store.p019', 'Items checked and packed'],
        [`${D}09:41:22`, 'DOFD', 'Out for delivery', 'system', '', 'Demo driver 1'],
      ]),
      jobs: jobs('8000000300', [
        [`${D}09:15:13`, 'LastMile — create order', 1, 'C'],
        [`${D}09:30:06`, 'Notify customer (SMS)', 5, 'F', 'SMS gateway timeout after 30s'],
        [`${D}09:30:07`, 'SGH — push order', 5, 'F', 'Customer not found in SGH (404)'],
        [`${D}09:41:23`, 'Magento — status push', 2, 'P', 'HTTP 503 Service Unavailable', `${D}09:47:23`],
      ]),
    },
    // The capture as is: returned by driver, then rescheduled (lastAction DRSC); From == To.
    '8000000121': {
      doc: base,
      logs: logs('8000000121', [
        [`${T121}02:46:26`, 'DCRT', 'Delivery created', 'web'],
        [`${T121}03:10:02`, 'DRDY', 'Ready for delivery', 'store.p019'],
        [`${T121}03:40:51`, 'DOFD', 'Out for delivery', 'system', '', 'mohammed sartawi'],
        [`${T121}05:12:09`, 'DRBK', 'Returned by driver', 'driver.app', 'Customer not answering'],
        [`${T121}05:30:44`, 'DRSC', 'Rescheduled', 'call.center.02', 'Customer asked for evening', '8pm - 10 pm', '8am - 12 pm'],
      ]),
      jobs: jobs('8000000121', [
        [`${T121}02:46:27`, 'LastMile — create order', 1, 'C'],
        [`${T121}05:30:45`, 'LastMile — create order', 1, 'C'],
      ]),
    },
    // The capture as is: cancellation requested, and a cancel job failing and retrying.
    '8000000174': {
      doc: CAPTURES['8000000174'],
      logs: logs('8000000174', [
        [`${T174}10:02:00`, 'DCRT', 'Delivery created', 'web'],
        [`${T174}10:20:00`, 'DRDY', 'Ready for delivery', 'store.p004'],
        [`${T174}11:05:00`, 'DRCL', 'Request cancellation', 'call.center.11', 'Customer changed their mind'],
      ]),
      jobs: jobs('8000000174', [
        [`${T174}10:02:01`, 'LastMile — create order', 1, 'C'],
        [`${T174}11:05:01`, 'LastMile — cancel order', 3, 'P', 'Courier API rate limited (429)', `${T174}11:12:00`],
      ]),
    },
    // Cancelled while ready: the request, then the close.
    '8000000902': {
      doc: {
        ...base,
        documentNo: '8000000902',
        status: { ...base.status, readyStatus: 'R', deliveryStatus: '', closeStatus: 'C', lastAction: 'DCLS' },
      },
      logs: logs('8000000902', [
        [`${D}08:00:00`, 'DCRT', 'Delivery created', 'web'],
        [`${D}08:30:00`, 'DRDY', 'Ready for delivery', 'store.p001'],
        [`${D}09:00:00`, 'DRCL', 'Request cancellation', 'call.center.03', 'Duplicate order'],
        [`${D}09:20:00`, 'DCLS', 'Closed', 'AutoClose'],
      ]),
      jobs: [],
    },
    // The Log fails to load; the jobs answer empty.
    '8000000903': {
      doc: { ...base, documentNo: '8000000903', status: { ...base.status, readyStatus: 'R', lastAction: 'DRDY' } },
      logs: 'fail',
      jobs: [],
    },
  }
}

/** Read a value's VISUAL order off character rects: > 0 means it reads left-to-right on screen. */
const READS_LTR = (el) => {
  const walker = el.ownerDocument.createTreeWalker(el, NodeFilter.SHOW_TEXT)
  const nodes = []
  for (let n = walker.nextNode(); n; n = walker.nextNode()) if (n.data.trim()) nodes.push(n)
  if (nodes.length === 0) return null
  const at = (node, offset) => {
    const range = node.ownerDocument.createRange()
    range.setStart(node, offset)
    range.setEnd(node, offset + 1)
    return range.getBoundingClientRect().x
  }
  const first = nodes[0]
  const last = nodes[nodes.length - 1]
  return at(last, last.data.replace(/\s+$/, '').length - 1) - at(first, first.data.search(/\S/))
}

/** Resolve a token to the computed value of a property, through a throwaway probe. */
const RESOLVE = (prop, expr) => {
  const probe = document.createElement('div')
  probe.style[prop] = expr
  document.body.appendChild(probe)
  const v = getComputedStyle(probe)[prop]
  probe.remove()
  return v
}

const ISOLATE_CHARS = /[\u2066-\u2069\u200e\u200f]/

const browser = await chromium.launch()

async function drive({ theme, dir }) {
  const label = `${theme}/${dir}`
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of 400/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    },
    [theme, dir],
  )
  await page.addInitScript(`window.READS_LTR = ${READS_LTR.toString()}; window.RESOLVE = ${RESOLVE.toString()}`)
  const CASES = cases(dir)
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const read = p.match(/^SdDocumentWeb\/Document\/(\d+)\/(Logs|Outbox)$/)
    if (read) {
      const c = CASES[read[1]]
      const rows = read[2] === 'Logs' ? c?.logs : c?.jobs
      if (rows === 'fail')
        return route.fulfill(envelope(null, { status: 400, success: false, message: 'Log store unavailable' }))
      return route.fulfill(envelope(rows ?? []))
    }
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(CASES[doc[1]]?.doc ?? CAPTURES[doc[1]] ?? null))
    return route.fulfill(envelope({}))
  })

  const open = async (no) => {
    await page.goto(`${BASE}/oms/delivery/${no}`)
    await page.locator('[data-spine]').waitFor({ timeout: 20000 })
    await page.waitForFunction(() => !document.querySelector('[data-spine] [role="status"]'), null, { timeout: 20000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(150)
  }

  /** The spine read as one ordered list of what each block is. */
  const readSpine = () =>
    page.evaluate(() => {
      const s = document.querySelector('[data-spine]')
      const blocks = [...s.children].map((el) => {
        if (el.matches('[data-job-banner]')) return `banner:${el.getAttribute('data-job-banner')}`
        if (el.matches('[data-now-line]')) return 'now'
        if (el.matches('ol')) {
          const items = [...el.children].map((li) => {
            const kind = li.getAttribute('data-entry')
            if (!kind) return `future:${li.getAttribute('data-step')}:${li.getAttribute('data-state')}`
            if (kind === 'milestone') return `milestone:${li.getAttribute('data-step')}:${li.getAttribute('data-state')}`
            if (kind === 'superseded') return `superseded:${li.getAttribute('data-step')}`
            if (kind === 'rewind') return `rewind:${li.getAttribute('data-rewind')}`
            if (kind === 'job') return `job:${li.getAttribute('data-outbox-id')}:${li.getAttribute('data-job-state')}`
            return `${kind}:${li.getAttribute('data-action')}`
          })
          return items.join(' ')
        }
        if (el.getAttribute('role') === 'alert') return 'error'
        return el.tagName.toLowerCase()
      })
      return blocks
    })

  // ── 1–5: the out-for-delivery case ────────────────────────────────────────────────────────────
  await open('8000000300')
  const layout = await page.evaluate((rtl) => {
    const s = document.querySelector('[data-spine]')
    const sb = s.getBoundingClientRect()
    const tabs = document.querySelector('[role="tablist"]')
    const rail = document.querySelector('[role="tablist"]')?.closest('.grid')
    const rb = rail.getBoundingClientRect()
    return {
      tabs: [...tabs.querySelectorAll('[role="tab"]')].map((b) => b.id),
      width: Math.round(sb.width),
      beside: Math.abs(sb.top - rb.top) < 4,
      startSide: rtl ? sb.right > rb.right : sb.left < rb.left,
      gridLog: !!document.querySelector('#tab-log, #tab-jobs, #tabpanel-log, #tabpanel-jobs'),
    }
  }, rtl)
  check(`${label}: the Log and Jobs tabs are gone`, !layout.gridLog && layout.tabs.join(',') === 'tab-items,tab-conditions', layout.tabs.join(','))
  check(
    `${label}: the spine sits on the inline start (${rtl ? 'right' : 'left'}), beside the page, 340–420px wide`,
    layout.beside && layout.startSide && layout.width >= 340 && layout.width <= 420,
    `${layout.width}px beside=${layout.beside} start=${layout.startSide}`,
  )
  const out = await readSpine()
  check(
    `${label}: banners, the retrying line, the future furthest first, Now, then the past newest first`,
    JSON.stringify(out) ===
      JSON.stringify([
        'banner:failed',
        'banner:failed',
        'banner:retrying',
        'future:delivered:next',
        'now',
        'job:9103:retrying milestone:out:current job:9102:failed job:9101:failed milestone:ready:done note:DADN job:9100:done milestone:created:done',
      ]),
    JSON.stringify(out),
  )
  const banners = await page.evaluate(() => {
    const read = (el) => ({
      id: el.getAttribute('data-outbox-id'),
      line1: el.children[1].textContent,
      when: el.querySelector('[data-when] bdi[dir="ltr"]')?.textContent ?? null,
      error: el.querySelector('[data-job-error]')?.textContent ?? null,
      slot: el.querySelector('[data-retry-slot]') ? el.querySelector('[data-retry-slot]').childNodes.length : -1,
      buttons: el.querySelectorAll('button').length,
      danger: getComputedStyle(el).color === window.RESOLVE('color', 'var(--danger-800)'),
    })
    return {
      failed: [...document.querySelectorAll('[data-job-banner="failed"]')].map(read),
      retrying: [...document.querySelectorAll('[data-job-banner="retrying"]')].map((el) => ({
        text: el.children[1].textContent,
        error: el.querySelector('[data-job-error]')?.textContent ?? null,
        buttons: el.querySelectorAll('button').length,
      })),
      retryButtons: [...document.querySelectorAll('[data-spine] button')].filter((b) => /retry/i.test(b.textContent)).length,
    }
  })
  const [sgh, sms] = banners.failed
  check(
    `${label}: one banner per F job, newest first, line one "<handler> failed · 5 attempts" + its time`,
    banners.failed.length === 2 &&
      sgh.id === '9102' &&
      sgh.line1.startsWith('SGH — push order failed · 5 attempts') &&
      sgh.when === '2026-10-02 09:30' &&
      sms.line1.startsWith('Notify customer (SMS) failed · 5 attempts'),
    JSON.stringify(banners.failed.map((b) => b.line1)),
  )
  check(
    `${label}: line two is the last error, in danger ink`,
    sgh.error === 'Customer not found in SGH (404)' && sms.error === 'SMS gateway timeout after 30s' && sgh.danger && sms.danger,
  )
  check(
    `${label}: no Retry — the slot is kept and draws nothing, and no banner has a button`,
    banners.failed.every((b) => b.slot === 0 && b.buttons === 0) && banners.retryButtons === 0,
  )
  check(
    `${label}: the P job reads "failing, retrying automatically · attempt 2 · next 09:47" + its error, no button`,
    banners.retrying.length === 1 &&
      banners.retrying[0].text === 'Magento — status pushfailing, retrying automatically · attempt 2 · next 09:47' &&
      banners.retrying[0].error === 'HTTP 503 Service Unavailable' &&
      banners.retrying[0].buttons === 0,
    JSON.stringify(banners.retrying),
  )
  const expect = await page.evaluate(() => {
    const el = document.querySelector('[data-expect]')
    const iso = el?.querySelector('bdi[dir="ltr"]')
    return { text: el?.textContent, iso: iso?.textContent ?? null, order: iso ? window.READS_LTR(iso) : null, italic: el ? getComputedStyle(el).fontStyle : '' }
  })
  check(
    `${label}: the next step expects the schedule's "10:00–12:00", one ltr isolate reading left-to-right`,
    expect.text === 'expected 10:00–12:00' && expect.iso === '10:00–12:00' && expect.order > 0 && expect.italic === 'italic' && !ISOLATE_CHARS.test(expect.text),
    JSON.stringify(expect),
  )
  const meta = await page.evaluate(() => {
    const items = [...document.querySelectorAll('[data-spine] [data-meta]')]
    return items.map((m) => {
      const who = m.querySelector('[data-who] bdi')
      const when = m.querySelector('[data-when] bdi[dir="ltr"]')
      return {
        who: who ? { text: who.textContent, dir: who.getAttribute('dir') } : null,
        when: when?.textContent ?? null,
        order: when ? window.READS_LTR(when) : null,
        whoBeforeWhen: who && when ? (document.dir === 'rtl' ? who.getBoundingClientRect().left > when.getBoundingClientRect().left : who.getBoundingClientRect().right < when.getBoundingClientRect().left) : null,
        clean: !/[\u2066-\u2069\u200e\u200f]/.test(m.textContent),
      }
    })
  })
  check(
    `${label}: every who · when is isolated by kind — the user a dir-auto <bdi>, the time one ltr isolate reading left-to-right`,
    meta.length >= 8 && meta.every((m) => m.when && m.order > 0 && m.clean && (m.who === null || (m.who.dir === null && m.whoBeforeWhen))),
    `${meta.length} metas; ${JSON.stringify(meta.find((m) => !(m.when && m.order > 0 && m.clean)) ?? '')}`,
  )
  const note = await page.evaluate(() => {
    const li = document.querySelector('[data-entry="note"]')
    const who = li.querySelector('[data-who] bdi')
    const text = li.querySelector('[data-detail] bdi')
    return { who: who.textContent, text: text.textContent, whoDir: getComputedStyle(who).direction, textDir: getComputedStyle(text).direction }
  })
  check(
    `${label}: a note row carries its words in its own isolate${rtl ? ' (an Arabic note reads right-to-left)' : ''}`,
    rtl ? note.text === ARABIC_NOTE && note.textDir === 'rtl' && note.who === ARABIC_USER && note.whoDir === 'rtl' : note.text === 'Customer asked to call before arrival.',
    JSON.stringify(note),
  )
  const noNow = await page.evaluate(() =>
    [...document.querySelectorAll('[data-entry="milestone"]')].map((li) => li.textContent).filter((t) => /\bnow\b/i.test(t)),
  )
  check(`${label}: no milestone carries a "now" tag`, noNow.length === 0, noNow.join(' | '))
  const nowLine = await page.evaluate((rtl) => {
    const line = document.querySelector('[data-now-line]')
    const tag = line.firstElementChild
    const lb = line.getBoundingClientRect()
    const tb = tag.getBoundingClientRect()
    return { text: tag.textContent, start: rtl ? lb.right - tb.right : tb.left - lb.left, dashed: getComputedStyle(line).borderTopStyle }
  }, rtl)
  check(
    `${label}: the Now line is a dashed rule labelled Now at its start`,
    nowLine.text === 'Now' && nowLine.dashed === 'dashed' && nowLine.start >= 0 && nowLine.start <= 16,
    JSON.stringify(nowLine),
  )
  await page.screenshot({ path: `${SHOTS}/${theme}-${dir}-out.png`, fullPage: false })

  // ── 5–6: the rewind (the 8000000121 capture) ──────────────────────────────────────────────────
  await open('8000000121')
  const resched = await readSpine()
  check(
    `${label}: after a rewind the future is Delivered, Out, then Ready next; the past strikes Ready and Out`,
    JSON.stringify(resched) ===
      JSON.stringify([
        'future:delivered:later future:out:later future:ready:next',
        'now',
        'job:9101:done rewind:rescheduled rewind:returned superseded:out superseded:ready job:9100:done milestone:created:current',
      ]),
    JSON.stringify(resched),
  )
  const rewind = await page.evaluate(() => {
    const struck = [...document.querySelectorAll('[data-entry="superseded"]')].map((li) => ({
      label: li.querySelector('s')?.textContent ?? null,
      line: getComputedStyle(li.querySelector('s')).textDecorationLine,
      text: li.textContent,
    }))
    const amber = [...document.querySelectorAll('[data-entry="rewind"]')].map((li) => {
      const dot = li.children[1].firstElementChild
      const word = li.querySelector('[data-label]')
      return {
        word: word.textContent,
        dotEdge: getComputedStyle(dot).borderTopColor === window.RESOLVE('color', 'var(--attention)'),
        ink: getComputedStyle(word).color === window.RESOLVE('color', 'var(--attention-800)'),
      }
    })
    const expect = document.querySelector('[data-expect]')
    const iso = expect?.querySelector('bdi')
    const resched = document.querySelector('[data-entry="rewind"][data-rewind="rescheduled"] [data-detail]')
    return {
      struck,
      amber,
      expect: expect?.textContent,
      expectDir: iso?.getAttribute('dir') ?? 'auto',
      detail: [...(resched?.children ?? [])].map((el) => el.textContent),
    }
  })
  check(
    `${label}: Out and Ready are struck through and read "earlier pass"`,
    rewind.struck.length === 2 &&
      rewind.struck.every((s) => s.line === 'line-through' && s.text.includes('earlier pass')) &&
      rewind.struck.map((s) => s.label).join(',') === 'Out for delivery,Ready',
    JSON.stringify(rewind.struck.map((s) => s.label)),
  )
  check(
    `${label}: each rewind is an amber node — Rescheduled, Returned by driver`,
    rewind.amber.map((a) => a.word).join(',') === 'Rescheduled,Returned by driver' && rewind.amber.every((a) => a.dotEdge && a.ink),
    JSON.stringify(rewind.amber),
  )
  check(
    `${label}: From == To expects the slot's own words in a dir-auto <bdi>, never 23:56`,
    rewind.expect === 'expected Monday, 8pm - 10 pm' && rewind.expectDir === 'auto',
    JSON.stringify(rewind.expect),
  )
  check(
    `${label}: a Log row shows its note, its new value and the value it replaced`,
    JSON.stringify(rewind.detail) === JSON.stringify(['Customer asked for evening', '8pm - 10 pm', 'was 8am - 12 pm']),
    JSON.stringify(rewind.detail),
  )
  await page.screenshot({ path: `${SHOTS}/${theme}-${dir}-rewind.png`, fullPage: false })

  // ── 7: indigo vs red ──────────────────────────────────────────────────────────────────────────
  const tone = (step) =>
    page.evaluate((step) => {
      const li = document.querySelector(`[data-entry="milestone"][data-step="${step}"]`)
      const dot = li.children[1].firstElementChild
      const word = li.querySelector('[data-label]')
      const amber = [window.RESOLVE('color', 'var(--attention-800)'), window.RESOLVE('color', 'var(--attention)')]
      return {
        word: word.textContent,
        ink: getComputedStyle(word).color,
        dot: getComputedStyle(dot).backgroundColor,
        indigoInk: window.RESOLVE('color', 'var(--fam-cancel-request)'),
        indigoDot: window.RESOLVE('backgroundColor', 'var(--fam-cancel-request)'),
        redInk: window.RESOLVE('color', 'var(--danger-800)'),
        redDot: window.RESOLVE('backgroundColor', 'var(--danger)'),
        amber: amber.includes(getComputedStyle(word).color) || amber.includes(getComputedStyle(dot).backgroundColor),
      }
    }, step)
  await open('8000000174')
  const requested = await tone('requested')
  check(
    `${label}: Cancellation requested is INDIGO, word and node, never amber`,
    requested.word === 'Cancellation requested' && requested.ink === requested.indigoInk && requested.dot === requested.indigoDot && !requested.amber,
    `${requested.ink} / ${requested.dot}`,
  )
  const req = await readSpine()
  check(
    `${label}: 8000000174 — the retrying cancel job above Now, the request on top of the past`,
    JSON.stringify(req) ===
      JSON.stringify(['banner:retrying', 'now', 'job:9101:retrying milestone:requested:requested milestone:ready:done job:9100:done milestone:created:done']),
    JSON.stringify(req),
  )
  await page.screenshot({ path: `${SHOTS}/${theme}-${dir}-requested.png`, fullPage: false })

  await open('8000000902')
  const cancelled = await tone('cancelled')
  check(
    `${label}: Cancelled is RED, word and node, never amber`,
    cancelled.word === 'Cancelled' && cancelled.ink === cancelled.redInk && cancelled.dot === cancelled.redDot && !cancelled.amber,
    `${cancelled.ink} / ${cancelled.dot}`,
  )
  const cx = await readSpine()
  check(
    `${label}: a request then carried out is a plain event, and nothing sits above Now`,
    JSON.stringify(cx) === JSON.stringify(['now', 'milestone:cancelled:cancelled event:DRCL milestone:ready:done milestone:created:done']),
    JSON.stringify(cx),
  )

  // ── 9: a Log that fails ───────────────────────────────────────────────────────────────────────
  await open('8000000903')
  const failedLog = await page.evaluate(() => {
    const s = document.querySelector('[data-spine]')
    return {
      alert: s.querySelector('[role="alert"]')?.textContent ?? '',
      steps: [...s.querySelectorAll('[data-entry="milestone"]')].map((li) => `${li.getAttribute('data-step')}:${li.querySelector('[data-meta]') ? 'timed' : 'untimed'}`),
    }
  })
  check(
    `${label}: a Log that fails says so inside the spine, and the reached steps still draw, untimed`,
    failedLog.alert.includes('Log store unavailable') && failedLog.steps.join(',') === 'ready:untimed,created:untimed',
    JSON.stringify(failedLog),
  )

  check(`${label}: no page errors`, errors.length === 0, errors.slice(0, 3).join(' | '))
  await context.close()
}

for (const theme of ['light', 'dark']) {
  for (const dir of ['ltr', 'rtl']) await drive({ theme, dir })
}

await browser.close()

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} checks passed`)
console.log(`screenshots → ${SHOTS}/`)
if (failed.length) process.exit(1)
