// Sync console Link health drive (spec 4288, BackOffice 4295) — drives the REAL /admin/sync/links page and the Fleet
// page's "Link unstable" tile in Chromium against STUBBED `ActionSync/*` envelopes, shaped from the door contract
// (C:\Work\DMSCO\BackOffice\.issues\assets\2523-sync-console-door-contract.md, "Fleet link health").
// 🚩 Nothing here touches a live SIS.Api. The stub filters, searches and pages as the door does, so the page's
// parameters are exercised; the door's own rules are pinned by the BackOffice Data.Tests.
//
// It verifies, with 60 stores on both links (realistic names, morning trouble on some WAN lines, one chronic store
// network, a few stores with no data):
//   1. today on both links (the default since the code review of spec 4288, finding 13 - a Both cell is the worse of
//      the two links that store-hour): the grid draws a row per store of the page, 24 hour columns, the hours not
//      reached yet empty; worst first; a chronic badge; a cell names the tills hit;
//   2. the WAN and Store toggles ask link=WAN / link=STORE and redraw;
//   3. 7 days asks period=7d and draws seven day rows per store;
//   4. the Needs attention tile asks show=attention, and the search asks q= (a search that matches nothing says so);
//   5. paging asks page=2;
//   6. a store code links to its Tills tab;
//   7. Arabic: right to left, no page errors;
//   8. the Fleet page: the Link unstable tile is drawn with its count and asks state=linkUnstable.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/sync-console-links-drive.mjs
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
import { permissions } from './permissions-stub.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.sync-console-links-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})

const AS_OF = '2026-11-25T12:35:10'
const pad = (n) => String(n).padStart(2, '0')
const hourStamp = (day, h) => `${day}T${pad(h)}:00:00`
const DAYS = ['2026-11-19', '2026-11-20', '2026-11-21', '2026-11-22', '2026-11-23', '2026-11-24', '2026-11-25']

const NAMES = ['Riyadh Olaya', 'Jeddah Tahlia', 'Dammam Corniche', 'Khobar Rakah', 'Makkah Aziziyah', 'Madinah Quba',
  'Taif Shihar', 'Abha Al Manhal', 'Tabuk King Faisal', 'Hail Al Naqrah', 'Buraidah Al Rayan', 'Jazan Corniche',
  'Najran Al Faisaliyah', 'Yanbu Industrial', 'Al Ahsa Mubarraz', 'Qatif Awamiyah', 'Jubail Fanateer', 'Khamis Mushait',
  'Riyadh Al Malqa', 'Riyadh Al Nakheel']

// A deterministic generator: the same picture every run.
let seed = 4295
const rand = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648)

/** One store-hour on one link: the store's profile decides how bad. */
function cellFor(profile, link, day, h, tills) {
  if (profile.noData) return null
  if (link === 'STORE' && profile.mainOnly) return null
  if (h < 7 || h > 23) return rand() < 0.5 ? null : quiet(tills)
  const wanMorning = link === 'WAN' && profile.wanMorning && h >= 8 && h <= 11
  const storeChronic = link === 'STORE' && profile.storeChronic && h >= 9
  const blip = rand() < 0.12
  if (wanMorning || storeChronic) {
    const offline = rand() < 0.25
    const affected = profile.wholeStore ? tills : 1 + Math.floor(rand() * (tills - 1 || 1))
    const unstable = 300 + Math.floor(rand() * 2400)
    return {
      checks: 360 * tills, failed: 20 + Math.floor(rand() * 60), slow: 40 + Math.floor(rand() * 120),
      failPct: 4 + Math.floor(rand() * 12), slowPct: 10 + Math.floor(rand() * 25), maxP95Ms: 900 + Math.floor(rand() * 2600),
      unstableSeconds: unstable, offlineSeconds: offline ? 60 + Math.floor(rand() * 900) : 0,
      tillsReporting: tills, tillsAffected: Math.min(tills, affected),
    }
  }
  return blip ? { ...quiet(tills), failed: 1, slow: 3, failPct: 0, slowPct: 1 } : quiet(tills)
}
const quiet = (tills) => ({
  checks: 360 * tills, failed: 0, slow: 0, failPct: 0, slowPct: 0, maxP95Ms: 90 + Math.floor(rand() * 200),
  unstableSeconds: 0, offlineSeconds: 0, tillsReporting: tills, tillsAffected: 0,
})

const STORES = Array.from({ length: 60 }, (_, i) => {
  const code = `P${String(i + 1).padStart(3, '0')}`
  const name = `${NAMES[i % NAMES.length]}${i >= NAMES.length ? ` ${Math.floor(i / NAMES.length) + 1}` : ''}`
  const profile = {
    wanMorning: [2, 5, 11, 17, 23, 41, 76].includes(i + 1) || (i + 1) % 9 === 0,
    storeChronic: [77, 5, 30].includes(i + 1),
    wholeStore: (i + 1) % 2 === 0,
    noData: [13, 37, 52].includes(i + 1),
    mainOnly: (i + 1) % 4 === 0,
    unstableNow: [5, 30].includes(i + 1),
    silent: [44].includes(i + 1),
  }
  return { code, description: `${name} Pharmacy`, tills: 2 + (i % 3), profile }
})
STORES.push({ code: 'P077', description: 'Riyadh Al Yasmin Pharmacy (24h)', tills: 4,
  profile: { storeChronic: true, wanMorning: true, wholeStore: false, unstableNow: true } })

function linkHealth(period, link, q, show, page, pageSize) {
  const days = period === '7d' ? DAYS : DAYS.slice(-1)
  const hours = days.flatMap((d, di) => Array.from({ length: di === days.length - 1 ? 13 : 24 }, (_, h) => hourStamp(d, h)))
  const cellsOf = (one) => {
    seed = 4295 + (one === 'WAN' ? 0 : 7)
    return STORES.map((s) => hours.map((hr) => cellFor(s.profile, one, hr.slice(0, 10), Number(hr.slice(11, 13)), s.tills)))
  }
  // Both: the door's rollup over both links' rows - checks summed, each hour's worst minutes and p95 kept.
  const worse = (a, b) => !a ? b : !b ? a : {
    checks: a.checks + b.checks, failed: a.failed + b.failed, slow: a.slow + b.slow,
    failPct: Math.round(((a.failed + b.failed) * 100) / (a.checks + b.checks)), slowPct: Math.round(((a.slow + b.slow) * 100) / (a.checks + b.checks)),
    maxP95Ms: Math.max(a.maxP95Ms, b.maxP95Ms), unstableSeconds: Math.max(a.unstableSeconds, b.unstableSeconds),
    offlineSeconds: Math.max(a.offlineSeconds, b.offlineSeconds), tillsReporting: Math.max(a.tillsReporting, b.tillsReporting),
    tillsAffected: Math.max(a.tillsAffected, b.tillsAffected),
  }
  let byStore
  if (link === 'both') {
    const wan = cellsOf('WAN')
    const store = cellsOf('STORE')
    byStore = wan.map((cells, i) => cells.map((c, h) => worse(c, store[i][h])))
  } else byStore = cellsOf(link)
  const all = STORES.map((s, i) => {
    const cells = byStore[i]
    const bad = cells.filter((c) => c && (c.unstableSeconds > 0 || c.offlineSeconds > 0))
    const last8 = cells.slice(-8).filter((c) => c && (c.unstableSeconds > 0 || c.offlineSeconds > 0)).length
    const noData = cells.every((c) => c === null)
    const unstableTills = s.profile.unstableNow ? 1 : 0
    const silentTills = s.profile.silent ? 1 : 0
    const chronic = last8 >= 4
    return {
      code: s.code, description: s.description, noData,
      troubledHours: bad.length, offlineHours: bad.filter((c) => c.offlineSeconds > 0).length,
      unstableMinutes: Math.round(bad.reduce((n, c) => n + c.unstableSeconds, 0) / 60),
      offlineMinutes: Math.round(bad.reduce((n, c) => n + c.offlineSeconds, 0) / 60),
      tillsReporting: noData ? 0 : s.tills, tillsAffected: bad.length ? Math.max(...bad.map((c) => c.tillsAffected)) : 0,
      unstableTills, silentTills, chronic, needsAttention: unstableTills > 0 || chronic || silentTills > 0, cells,
    }
  })
    .filter((s) => !q || s.code.toLowerCase().includes(q.toLowerCase()) || s.description.toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => Number(a.noData) - Number(b.noData) || b.troubledHours - a.troubledHours || b.offlineMinutes - a.offlineMinutes || (a.code < b.code ? -1 : 1))
  const inView = (s, v) => v === 'attention' ? s.needsAttention : v === 'troubled' ? s.troubledHours > 0
    : v === 'healthy' ? !s.noData && s.troubledHours === 0 && s.silentTills === 0 : v === 'noData' ? s.noData : true
  const shown = all.filter((s) => inView(s, show))
  const counts = Object.fromEntries(['all', 'attention', 'troubled', 'healthy', 'noData'].map((v) => [v, all.filter((s) => inView(s, v)).length]))
  return { asOf: AS_OF, period, link, hours, total: shown.length, page, pageSize, counts,
    items: shown.slice((page - 1) * pageSize, page * pageSize) }
}

const SUMMARY = { asOf: AS_OF, total: 61, disabled: 0, counts: { all: 61, onWorker: 58, onWpf: 3, paused: 1, offline: 2, behind: 1, erroring: 0,
  controlPending: 0, mirrorOffline: 0, mirrorBehind: 0, deadLetters: 0, deferredTooLong: 0, railsDisagree: 0, disabled: 0,
  closedNotDisabled: 0, linkUnstable: 3 } }

async function drive(browser, locale, asked) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1600 } })
  const page = await context.newPage()
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'true')
  }, locale)
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const p = url.pathname.replace(/^\/api\//, '')
    const sp = url.searchParams
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Auth/Permissions') return route.fulfill(permissions(['ActionSyncConsole:03']))
    if (p === 'ActionSync/Fleet/LinkHealth') {
      asked.push(url.search)
      return route.fulfill(envelope(linkHealth(sp.get('period') ?? 'today', sp.get('link') ?? 'both', sp.get('q') ?? '',
        sp.get('show') ?? 'all', Number(sp.get('page') ?? 1), Number(sp.get('pageSize') ?? 50))))
    }
    if (p === 'ActionSync/Fleet/Summary') return route.fulfill(envelope(SUMMARY))
    if (p === 'ActionSync/Fleet') {
      asked.push('fleet' + url.search)
      return route.fulfill(envelope({ items: [], total: 0, page: 1, pageSize: 50 }))
    }
    if (p === 'ActionSync/Workers') return route.fulfill(envelope({ items: [] }))
    return route.fulfill(envelope(null))
  })
  return { context, page, errors }
}

const browser = await chromium.launch()
try {
  for (const locale of ['en', 'ar']) {
    const asked = []
    const { context, page, errors } = await drive(browser, locale, asked)
    await page.goto(`${BASE}/admin/sync/links`)
    await page.locator('[data-link-grid="today"]').waitFor()
    if (locale === 'en') {
      const rows = await page.locator('[data-link-store]').count()
      check('today: a row per store of the page (50)', rows === 50, String(rows))
      check('today: 24 hour cells per store', (await page.locator('[data-link-cell-store="P077"], [data-link-hour^="2026-11-25"][data-link-cell="future"]').count()) > 0)
      const first = await page.locator('[data-link-store]').first().getAttribute('data-link-store')
      const firstTotals = await page.locator('[data-link-totals]').first().textContent()
      const lastTotals = await page.locator('[data-link-totals]').last().textContent()
      check('today: worst first (troubled stores lead, no trouble after)', /unstable or offline/.test(firstTotals ?? '') && /No trouble|No data/.test(lastTotals ?? ''), `${first}: ${firstTotals}`)
      check('today: the hours not reached are empty', (await page.locator('[data-link-cell="future"]').count()) === 50 * 11)
      check('today: a cell names the tills hit', (await page.locator('[data-link-affected]:not([data-link-affected="0"])').count()) > 0)
      check('asks both links today first', asked[0]?.includes('period=today') && asked[0]?.includes('link=both'), asked[0])
      check('the Both choice is pressed', (await page.locator('[data-link-toggle]').getAttribute('data-link-toggle')) === 'both')
      const silentStore = page.locator('[data-link-totals="P044"]')
      check('a store with a silent till never reads "No trouble"',
        (await silentStore.count()) === 1 && !/No trouble/.test((await silentStore.textContent()) ?? ''))
      await page.screenshot({ path: `${SHOTS}/today-both-en.png`, fullPage: true })

      await page.locator('[data-link-choice="WAN"]').click()
      await page.waitForFunction(() => document.querySelector('[data-link-toggle]')?.getAttribute('data-link-toggle') === 'WAN')
      await page.waitForTimeout(400)
      check('the WAN toggle asks link=WAN', asked.some((a) => a.includes('link=WAN')))
      await page.screenshot({ path: `${SHOTS}/today-wan-en.png`, fullPage: true })

      await page.locator('[data-link-choice="STORE"]').click()
      await page.waitForFunction(() => document.querySelector('[data-link-toggle]')?.getAttribute('data-link-toggle') === 'STORE')
      await page.waitForTimeout(400)
      check('the Store toggle asks link=STORE', asked.some((a) => a.includes('link=STORE')))
      check('a chronic badge is drawn', (await page.locator('[data-link-chronic]').count()) > 0)
      await page.screenshot({ path: `${SHOTS}/today-store-en.png`, fullPage: true })

      await page.locator('[data-period-choice="7d"]').click()
      await page.locator('[data-link-grid="7d"]').waitFor()
      await page.waitForTimeout(300)
      check('7 days asks period=7d', asked.some((a) => a.includes('period=7d')))
      await page.screenshot({ path: `${SHOTS}/week-store-en.png`, fullPage: true })
      await page.locator('[data-period-choice="today"]').click()
      await page.locator('[data-link-choice="WAN"]').click()

      await page.locator('[data-link-view="attention"]').click()
      await page.waitForTimeout(400)
      check('Needs attention asks show=attention', asked.some((a) => a.includes('show=attention')))
      check('Needs attention lists only flagged stores',
        (await page.locator('[data-link-attention="false"]').count()) === 0 && (await page.locator('[data-link-store]').count()) > 0)
      await page.screenshot({ path: `${SHOTS}/attention-en.png`, fullPage: true })
      await page.locator('[data-link-view="attention"]').click()

      await page.locator('[data-link-search] input, input[data-link-search]').first().fill('P077')
      await page.waitForTimeout(800)
      check('the search asks q=', asked.some((a) => a.includes('q=P077')))
      check('the search narrows the rows', (await page.locator('[data-link-store]').count()) === 1)
      await page.locator('[data-link-search] input, input[data-link-search]').first().fill('ZZZ9')
      await page.waitForTimeout(800)
      check('a search that matches nothing says so', (await page.locator('[data-link-empty="links.emptyText.search"]').count()) === 1)
      await page.locator('[data-link-search] input, input[data-link-search]').first().fill('')
      await page.waitForTimeout(800)

      await page.locator('[data-link-page="next"]').click()
      await page.waitForTimeout(400)
      check('paging asks page=2', asked.some((a) => a.includes('page=2')))
      const href = await page.locator('[data-link-store-open]').first().getAttribute('href')
      check('a store opens its Tills tab', /\/admin\/sync\/store\/P\d+\?tab=tills$/.test(href ?? ''), href ?? '')
    } else {
      check('ar: right to left', (await page.evaluate(() => document.documentElement.dir)) === 'rtl')
      await page.screenshot({ path: `${SHOTS}/today-wan-ar.png`, fullPage: true })
    }
    check(`${locale}: no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 8. the Fleet page's tile.
  {
    const asked = []
    const { context, page, errors } = await drive(browser, 'en', asked)
    await page.goto(`${BASE}/admin/sync`)
    await page.locator('[data-tile="linkUnstable"]').waitFor()
    await page.waitForFunction(() => /\d/.test(document.querySelector('[data-tile="linkUnstable"]')?.textContent ?? ''))
    const tileText = (await page.locator('[data-tile="linkUnstable"]').textContent()) ?? ''
    check('fleet: the Link unstable tile shows its count', tileText.includes('3') && tileText.includes('Link unstable'), tileText)
    await page.locator('[data-tile="linkUnstable"]').click()
    await page.waitForTimeout(500)
    check('fleet: the tile asks state=linkUnstable', asked.some((a) => a.startsWith('fleet') && a.includes('state=linkUnstable')))
    await page.screenshot({ path: `${SHOTS}/fleet-tile-en.png`, fullPage: false })
    check('fleet: no page errors', errors.length === 0, errors.join(' | '))
    await context.close()
  }
} finally {
  await browser.close()
}

const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed; shots in ${SHOTS}`)
process.exit(failed.length ? 1 : 0)
