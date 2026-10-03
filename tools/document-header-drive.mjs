// Delivery details header drive (spec 380 D2, ticket 402; rulings 371 §1, 369 §1, 368 §3).
//
// Drives the REAL app in Chromium against the five captured payloads in
// `.issues/assets/078-document-payloads/` (replayed verbatim, as every document drive does), plus
// three stubs patched from them: a MOVING delivery (out for delivery, Dawaa Now, paid), a
// CANCELLED one and the captured CANCELLATION-REQUESTED one. Only the wire is stubbed.
//
// In light and dark, LTR and RTL (`oms.locale = 'ar'` sets `dir="rtl"`; there is no Arabic locale
// file, so the copy stays English and the stub ROWS carry the Arabic), it asserts:
//   1. the header is a light `--card` card, never the old `--brand-panel` slab, and the pill rail
//      is gone;
//   2. line one reads Back, the number (Plex Mono 600, one ltr isolate that reads left-to-right
//      under RTL), the now-step badge, the due/paid tag, the tags; All statuses and Refresh sit at
//      the inline END (left under RTL);
//   3. the now-step badge per delivery: Out for delivery primary, Cancellation requested INDIGO
//      (`--fam-cancel-request` ink and edge), Cancelled RED (`--danger-800` on `--danger-050`),
//      Delivered success; never amber;
//   4. the due/paid tag: "Due 103.10" (amber = attention, the amount one ltr isolate with no
//      isolate characters) and "Paid";
//   5. the tags: Dawaa Now gold with navy ink, e-Rx, the Overall code in mono (absent on the
//      three captures with no overall status);
//   6. line two: the six sub-ids per capture in D2's order, IDs in mono and isolated, a word in a
//      `<bdi>` (an Arabic type word reads right-to-left in its own isolate);
//   7. the band's customer block is gone from the header;
//   8. the command bar sits directly beneath the header;
//   9. All statuses discloses the thirteen statuses plus the provenance group;
//  10. Back is a chevron to the list that mirrors under RTL.
//
//   1. run the app:  npx vite --port 5280 --strictPort
//   2. DRIVE_PORT=5280 node tools/document-header-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync, readdirSync } from 'node:fs'
import path from 'node:path'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const PAYLOAD_DIR = '.issues/assets/078-document-payloads'
const SHOTS = 'tools/.document-header-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data, { status = 200 } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: true, message: '', errors: [], data }),
})

const CAPTURES = {}
for (const file of readdirSync(PAYLOAD_DIR)) {
  const capture = JSON.parse(readFileSync(path.join(PAYLOAD_DIR, file), 'utf8'))
  CAPTURES[capture.data.documentNo] = capture.data
}

const ARABIC_TYPE = 'نقدي'
const ARABIC_NAME = 'محمد السرطاوي'

/** The stubs, keyed by number. `dir` lets the RTL pass carry Arabic rows. */
function documents(dir) {
  const base = CAPTURES['8000000121']
  const arabic = dir === 'rtl' ? { documentTypeDescription: ARABIC_TYPE } : {}
  return {
    ...CAPTURES,
    // Moving: ready and out for delivery, an express order, nothing left to pay.
    '8000000901': {
      ...base,
      ...arabic,
      documentNo: '8000000901',
      isExpressDelivery: true,
      amountDue: 0,
      customer: { ...base.customer, customerName: dir === 'rtl' ? ARABIC_NAME : base.customer?.customerName },
      status: { ...base.status, readyStatus: 'R', deliveryStatus: 'O', closeStatus: '', lastAction: 'DOFD' },
    },
    // Cancelled while ready.
    '8000000902': {
      ...base,
      documentNo: '8000000902',
      status: { ...base.status, readyStatus: 'R', deliveryStatus: '', closeStatus: 'C', lastAction: 'DCLS' },
    },
  }
}

/** [route, number, expected now-step, word, the badge's ink and ground tokens]. */
const BADGES = [
  ['delivery', '8000000901', 'out', 'Out for delivery', '--primary-800', '--primary-050'],
  ['delivery', '8000000174', 'requested', 'Cancellation requested', '--fam-cancel-request', '--card'],
  ['delivery', '8000000902', 'cancelled', 'Cancelled', '--danger-800', '--danger-050'],
  ['delivery', '8000000253', 'delivered', 'Delivered', '--success-800', '--success-050'],
  ['document', '2000000551', 'ready', 'Ready', '--muted-foreground', '--card'],
]

// The sub-ids each capture renders, in D2's order (the band drive's table, plus the document no.).
const EXPECTED_SUBIDS = {
  '2000000551': ['Order i987123-260620', 'Type NUPP', 'Placed June 20, 2026 · 21:37', 'Store P100'],
  '8000000121': [
    'Order XXXC886',
    'Type Cash',
    'Delivery doc Delivery',
    'Placed March 6, 2025 · 02:46',
    'Store P001',
    'Document 1000000247',
  ],
  '8000000174': [
    'Order FE000002',
    'Type Cash',
    'Delivery doc Delivery',
    'Placed April 24, 2025 · 22:29',
    'Store E001',
    'Document 1000000303',
  ],
  '8000000253': [
    'Order 100371607',
    'Type ECommerce (Hybris)',
    'Delivery doc Delivery',
    'Placed July 14, 2026 · 00:44',
    'Store P001',
    'Document 1000000393',
  ],
  '9000000003': [
    'Order 108020032',
    'Type ORRT',
    'Delivery doc Delivery Return',
    'Placed June 23, 2026 · 23:26',
    'Store BZ02',
    'Document 3000000007',
  ],
}
const OVERALL = { '2000000551': 'C', '8000000253': 'C' }
const ROUTE_OF = { '2000000551': 'document', '9000000003': 'document' }

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

const ISOLATE_CHARS = /[\u2066-\u2069\u200e\u200f]/

const browser = await chromium.launch()

async function drive({ theme, dir }) {
  const label = `${theme}/${dir}`
  const rtl = dir === 'rtl'
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()))
  await page.addInitScript(
    ([t, d]) => {
      localStorage.setItem('oms.darkMode', String(t === 'dark'))
      localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    },
    [theme, dir],
  )
  await page.addInitScript(`window.READS_LTR = ${READS_LTR.toString()}`)
  const DOCS = documents(dir)
  await page.route('**/api/**', async (route) => {
    const p = route.request().url().split('/api/')[1].split('?')[0]
    if (p === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'SdDocumentWeb/Access') return route.fulfill(envelope({ canOpenList: true, canOpenDetail: true }))
    const doc = p.match(/^SdDocumentWeb\/(?:Document|Delivery)\/(\d+)$/)
    if (doc) return route.fulfill(envelope(DOCS[doc[1]] ?? null))
    if (/\/(Logs|Outbox)$/.test(p)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const header = () => page.locator('header[aria-label="Document identity"]')
  const open = async (kind, no) => {
    await page.goto(`${BASE}/oms/${kind}/${no}`)
    await page.locator('[data-now-step]').waitFor({ timeout: 20000 })
    await page.evaluate(() => document.fonts.ready)
    await page.waitForTimeout(150)
  }

  // ── 1–3, 8: the card, line one's order and ends, the badge per delivery ──────────────────────
  for (const [kind, no, step, word, ink, ground] of BADGES) {
    await open(kind, no)
    const r = await page.evaluate(
      ({ ink, ground, rtl }) => {
        const resolve = (prop, expr) => {
          const probe = document.createElement('div')
          probe.style[prop] = expr
          document.body.appendChild(probe)
          const v = getComputedStyle(probe)[prop]
          probe.remove()
          return v
        }
        const h = document.querySelector('header[aria-label="Document identity"]')
        const line = h.firstElementChild
        const badge = h.querySelector('[data-now-step]')
        const bs = getComputedStyle(badge)
        const noEl = h.querySelector('[data-header-no]')
        const noBdi = noEl?.querySelector('bdi[dir="ltr"]')
        const refresh = [...h.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Refresh')
        const summary = h.querySelector('details > summary')
        const hb = h.getBoundingClientRect()
        const end = (el) => {
          const b = el.getBoundingClientRect()
          return rtl ? b.left - hb.left : hb.right - b.right
        }
        const bar = document.querySelector('section[aria-label="Actions"]')
        // Line one's children in DOM order, by what they are.
        const kinds = [...line.children].map((el) =>
          el.tagName === 'A'
            ? 'back'
            : el.hasAttribute('data-header-no')
              ? 'no'
              : el.hasAttribute('data-now-step')
                ? 'badge'
                : el.hasAttribute('data-due')
                  ? 'due'
                  : el.hasAttribute('data-tag')
                    ? 'tag'
                    : el.querySelector('details')
                      ? 'end'
                      : '?',
        )
        return {
          bg: getComputedStyle(h).backgroundColor,
          card: resolve('backgroundColor', 'var(--card)'),
          slab: resolve('backgroundColor', 'var(--brand-panel)'),
          pillRail: document.querySelectorAll('[aria-label="Document status"]').length,
          kinds: kinds.join(' '),
          step: badge.getAttribute('data-now-step'),
          word: badge.textContent.trim(),
          inkOk: bs.color === resolve('color', `var(${ink})`),
          groundOk: bs.backgroundColor === resolve('backgroundColor', `var(${ground})`),
          edgeIndigo: bs.borderTopColor === resolve('color', 'var(--fam-cancel-request)'),
          amber:
            bs.color === resolve('color', 'var(--attention-800)') ||
            bs.backgroundColor === resolve('backgroundColor', 'var(--attention-050)'),
          color: bs.color,
          no: noBdi?.textContent ?? null,
          noFont: noEl ? getComputedStyle(noEl).fontFamily : '',
          noWeight: noEl ? getComputedStyle(noEl).fontWeight : '',
          noOrder: noBdi ? window.READS_LTR(noBdi) : null,
          refreshEnd: refresh ? Math.round(end(refresh)) : -1,
          statusesBeforeRefresh:
            !!refresh && !!summary && (rtl ? summary.getBoundingClientRect().left > refresh.getBoundingClientRect().left : summary.getBoundingClientRect().right < refresh.getBoundingClientRect().left),
          barNext: h.nextElementSibling === bar,
          barGap: bar ? Math.round(bar.getBoundingClientRect().top - hb.bottom) : -1,
        }
      },
      { ink, ground, rtl },
    )
    check(`${label} ${no}: the header is a light --card card, not the --brand-panel slab`, r.bg === r.card && r.bg !== r.slab, r.bg)
    check(`${label} ${no}: the pill rail is gone`, r.pillRail === 0)
    check(
      `${label} ${no}: line one reads Back, number, badge, due tag, tags, then the end group`,
      /^back no badge due( tag)* end$/.test(r.kinds),
      r.kinds,
    )
    check(
      `${label} ${no}: the number is Plex Mono 600 in one ltr isolate that reads left-to-right`,
      r.no === no && /Plex Mono/.test(r.noFont) && r.noWeight === '600' && r.noOrder > 0,
      `${r.no} · ${r.noFont.split(',')[0]} ${r.noWeight} · order ${Math.round(r.noOrder ?? 0)}`,
    )
    check(
      `${label} ${no}: the now-step badge reads "${word}" in ${ink} on ${ground}`,
      r.step === step && r.word === word && r.inkOk && r.groundOk,
      `${r.step} "${r.word}" color ${r.color}`,
    )
    check(`${label} ${no}: the badge is never amber`, !r.amber)
    if (step === 'requested')
      check(`${label} ${no}: Cancellation requested is indigo, ink AND edge`, r.inkOk && r.edgeIndigo, r.color)
    check(
      `${label} ${no}: All statuses then Refresh sit at the inline end (${rtl ? 'left' : 'right'})`,
      r.refreshEnd >= 0 && r.refreshEnd <= 16 && r.statusesBeforeRefresh,
      `Refresh ${r.refreshEnd}px from the end`,
    )
    check(`${label} ${no}: the command bar sits directly beneath the header`, r.barNext && r.barGap >= 0 && r.barGap <= 12, `gap ${r.barGap}px`)
    if (no === '8000000174' || no === '8000000902')
      await page.screenshot({ path: `${SHOTS}/${theme}-${dir}-${no}.png`, fullPage: false })
  }

  // ── 4–5, 7: the due tag, the tags, no customer block ─────────────────────────────────────────
  await open('delivery', '8000000174')
  const owed = await page.evaluate(() => {
    const h = document.querySelector('header[aria-label="Document identity"]')
    const due = h.querySelector('[data-due]')
    const resolve = (prop, expr) => {
      const probe = document.createElement('div')
      probe.style[prop] = expr
      document.body.appendChild(probe)
      const v = getComputedStyle(probe)[prop]
      probe.remove()
      return v
    }
    // The word and the amount must not touch on screen: a flex container would drop the
    // word's trailing space, which textContent still reports.
    const amountEl = due?.querySelector('bdi[dir="ltr"]')
    const word = amountEl?.previousSibling
    let space = -1
    if (word?.nodeType === 3 && amountEl) {
      // The word alone: its own trailing space is the gap being measured.
      const r = document.createRange()
      r.setStart(word, 0)
      r.setEnd(word, word.data.trimEnd().length)
      const w = r.getBoundingClientRect()
      const a = amountEl.getBoundingClientRect()
      space = document.dir === 'rtl' ? w.left - a.right : a.left - w.right
    }
    return {
      space,
      kind: due?.getAttribute('data-due'),
      text: due?.textContent ?? '',
      amount: due?.querySelector('bdi[dir="ltr"]')?.textContent ?? null,
      amber: due ? getComputedStyle(due).color === resolve('color', 'var(--attention-800)') : false,
      headerText: h.textContent,
    }
  })
  check(
    `${label}: 8000000174 owes — "Due 103.10", amber, the amount one ltr isolate`,
    owed.kind === 'due' && owed.text === 'Due 103.10' && owed.amount === '103.10' && owed.amber && !ISOLATE_CHARS.test(owed.text),
    JSON.stringify(owed.text),
  )
  check(`${label}: the word and the amount are spaced apart on screen`, owed.space >= 2, `${Math.round(owed.space)}px`)
  check(
    `${label}: the band's customer block is gone from the header`,
    !owed.headerText.includes('MOHAMMED SARTAWI') && !owed.headerText.includes('966501076360'),
  )

  await open('delivery', '8000000901')
  const moving = await page.evaluate(() => {
    const h = document.querySelector('header[aria-label="Document identity"]')
    const resolve = (prop, expr) => {
      const probe = document.createElement('div')
      probe.style[prop] = expr
      document.body.appendChild(probe)
      const v = getComputedStyle(probe)[prop]
      probe.remove()
      return v
    }
    const gold = h.querySelector('[data-tag="dawaaNow"]')
    const type = h.querySelector('[data-subid="documentType"] b > bdi')
    return {
      due: h.querySelector('[data-due]')?.textContent ?? '',
      gold: !!gold && getComputedStyle(gold).backgroundColor === resolve('backgroundColor', 'var(--gold)'),
      navyInk: !!gold && getComputedStyle(gold).color === resolve('color', 'var(--gold-foreground)'),
      goldText: gold?.textContent ?? '',
      typeAuto: !!type && !type.hasAttribute('dir'),
      typeText: type?.textContent ?? '',
      typeOrder: type ? window.READS_LTR(type) : null,
      headerText: h.textContent,
    }
  })
  check(`${label}: a paid delivery reads "Paid"`, moving.due === 'Paid', moving.due)
  check(`${label}: Dawaa Now is a gold fill with navy ink`, moving.gold && moving.navyInk && moving.goldText === 'Dawaa Now', moving.goldText)
  if (rtl) {
    check(
      `${label}: an Arabic type word sits in its own <bdi> and reads right-to-left`,
      moving.typeAuto && moving.typeText === ARABIC_TYPE && moving.typeOrder < 0,
      `${moving.typeText} order ${Math.round(moving.typeOrder ?? 0)}`,
    )
    check(`${label}: the Arabic customer name is not in the header`, !moving.headerText.includes(ARABIC_NAME))
  }

  // ── 5–6: the five captures' sub-ids, the Overall code and e-Rx ───────────────────────────────
  for (const [no, expected] of Object.entries(EXPECTED_SUBIDS)) {
    await open(ROUTE_OF[no] ?? 'delivery', no)
    const r = await page.evaluate(() => {
      const h = document.querySelector('header[aria-label="Document identity"]')
      const subs = [...h.querySelectorAll('[data-subid]')]
      return {
        read: subs.map((s) => s.textContent.replace(/\s+/g, ' ').trim()),
        mono: subs
          .filter((s) => ['orderNo', 'storeCode', 'refDocumentNo'].includes(s.getAttribute('data-subid')))
          .every((s) => /Plex Mono/.test(getComputedStyle(s.querySelector('b')).fontFamily) && s.querySelector('b > bdi[dir="ltr"]')),
        placedIsolated: !!h.querySelector('[data-subid="placed"] b > bdi[dir="ltr"]'),
        overall: h.querySelector('[data-tag="overall"] .font-mono')?.textContent ?? null,
        overallMono: (() => {
          const code = h.querySelector('[data-tag="overall"] .font-mono')
          return !!code && /Plex Mono/.test(getComputedStyle(code).fontFamily)
        })(),
        eRx: !!h.querySelector('[data-tag="eRx"]'),
        isolateChars: /[\u2066-\u2069\u200e\u200f]/.test(h.textContent),
      }
    })
    check(`${label} ${no}: line two reads D2's sub-ids`, JSON.stringify(r.read) === JSON.stringify(expected), r.read.join(' · '))
    check(`${label} ${no}: the IDs are mono and isolated, Placed is one isolate`, r.mono && r.placedIsolated && !r.isolateChars)
    check(
      `${label} ${no}: the Overall tag ${OVERALL[no] ? `reads ${OVERALL[no]} in mono` : 'is absent'}`,
      OVERALL[no] ? r.overall === OVERALL[no] && r.overallMono : r.overall === null,
      String(r.overall),
    )
    check(`${label} ${no}: e-Rx ${no === '2000000551' ? 'shows' : 'is absent'}`, r.eRx === (no === '2000000551'))
  }

  // ── 9: All statuses discloses the thirteen plus provenance ──────────────────────────────────
  await open('delivery', '8000000174')
  const summary = header().locator('details > summary')
  const summaryText = (await summary.innerText()).replace(/\s+/g, ' ').trim()
  await summary.click()
  await page.waitForTimeout(120)
  const disclosed = await page.evaluate(() => {
    const d = document.querySelector('header[aria-label="Document identity"] details[open]')
    if (!d) return null
    const groups = [...d.querySelectorAll('section')].map((s) => ({
      title: s.querySelector('h3')?.textContent ?? '',
      rows: [...s.querySelectorAll('dt')].map((x) => x.textContent),
    }))
    const box = d.querySelector('section')?.getBoundingClientRect()
    return { groups, visible: !!box && box.height > 0 }
  })
  check(`${label}: the summary reads "All statuses 13"`, summaryText === 'All statuses 13', summaryText)
  check(
    `${label}: All statuses discloses the thirteen statuses`,
    disclosed?.visible && disclosed.groups[0]?.title === 'All statuses' && disclosed.groups[0].rows.length === 13,
    disclosed ? `${disclosed.groups[0]?.rows.length} rows` : 'closed',
  )
  check(
    `${label}: and the provenance beside them`,
    disclosed?.groups[1]?.title === 'Where it came from' &&
      ['Ref Document No', 'Source', 'Entry User'].every((l) => disclosed.groups[1].rows.includes(l)),
    disclosed?.groups[1]?.rows.join(', '),
  )
  await page.screenshot({ path: `${SHOTS}/${theme}-${dir}-all-statuses.png`, fullPage: false })
  await summary.click()

  // ── 10: Back ─────────────────────────────────────────────────────────────────────────────────
  const back = await page.evaluate(() => {
    const a = document.querySelector('header[aria-label="Document identity"] a')
    const svg = a?.querySelector('svg')
    const s = svg ? getComputedStyle(svg) : null
    return {
      href: a?.getAttribute('href'),
      label: a?.getAttribute('aria-label'),
      flipped: !!s && (s.scale.startsWith('-1') || s.transform.startsWith('matrix(-1')),
    }
  })
  check(
    `${label}: Back is a chevron to the list${rtl ? ' that mirrors under RTL' : ''}`,
    back.href === '/oms/deliveries' && back.label === 'Back to Delivery Documents' && back.flipped === rtl,
    JSON.stringify(back),
  )

  // A load that never answers: the header still offers Back, with the route id and no facts.
  await page.route('**/api/SdDocumentWeb/Delivery/8000000999', () => {})
  await page.goto(`${BASE}/oms/delivery/8000000999`)
  await header().waitFor()
  await page.waitForTimeout(200)
  const loading = await page.evaluate(() => {
    const h = document.querySelector('header[aria-label="Document identity"]')
    return {
      no: h.querySelector('[data-header-no]')?.textContent,
      back: !!h.querySelector('a[href="/oms/deliveries"]'),
      facts: h.querySelectorAll('[data-now-step], [data-due], details').length,
    }
  })
  check(`${label}: while loading, the header shows Back and the route id only`, loading.no === '8000000999' && loading.back && loading.facts === 0, JSON.stringify(loading))

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
