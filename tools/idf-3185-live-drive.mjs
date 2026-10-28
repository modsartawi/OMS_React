// The 3185 IDF screens LIVE drive (oms ticket 654; BackOffice spec 3185, doors 3187–3197).
//
// The stubbed drives (tools/idf-{items,export,draft,general,general-upload,changes,groups,upload,masters}-drive.mjs)
// stay the regression for behaviour; this is their live twin. It stubs NOTHING, signs in for real, and asserts what
// holds for any real estate. It is READ-ONLY: it never starts a draft, publishes, applies, sets / clears an item or
// writes a group — it only opens pages, reads doors and clicks downloads. Every IdfPriority write it sees fails it.
//
//   1. GET IdfPriority/Access answers exactly { canViewIdf, canEditIdf, canEditGeneral }, all booleans;
//   2. the masters list ends with the General row (masterId/kind `general`, no live version) and the page shows it with
//      no thresholds, no version and no Edit;
//   3. one live master's page: the entries door answers { page, pageSize, total, rows } with the row keys; paging
//      (?page=2 when there is one); a search (?q=) and a group (?idf=) only ever narrow the total;
//   4. the version picker on an OLDER version (?version=) reads that version's entries and says it is not live;
//   5. the General page's items (same shape) and a group filter narrows;
//   6. the change log (?tab=changes): the row keys (idfNumberBefore / idfNumberAfter included) and a from date narrows;
//   7. the groups list and a search;
//   8. every Export / Template downloads a file with the server's own name (masters: export + template; general:
//      export + template; changes: export; groups: export + template);
//   9. no page errors; every page in LTR (en) and RTL (ar).
//
//   1. point the dev proxy at the SIS.Api under test and run the app:
//        $env:SIS_API='https://<host>'; npx vite --port 5260 --strictPort
//   2. sign in one of three ways, the secret never in the repo:
//        SIS_SIGN_IN=window            — a visible browser opens on /login; sign in there by hand
//        SIS_USER=<id> SIS_PASS=<pw>   — POST Auth/Login through the proxy
//        SIS_COOKIE=<sis_session>      — a cookie copied from a browser session
//   3. DRIVE_PORT=5260 [IDF_MASTER=<masterId>] node tools/idf-3185-live-drive.mjs
//      IDF_MASTER unset = the first master with a live version and at least two versions (else any live one).
import { createRequire } from 'node:module'
import { mkdirSync } from 'node:fs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5260}`
const SHOTS = 'tools/.idf-3185-live-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const keysOf = (o) => Object.keys(o ?? {}).sort()
const hasKeys = (o, want) => same(keysOf(o), [...want].sort())

// ── The doors' keys as built (BackOffice IdfPriorityWebEndpoints / IdfGeneralWebEndpoints / IdfGroupWebEndpoints) ──
const ACCESS = ['canViewIdf', 'canEditIdf', 'canEditGeneral']
const PAGE = ['page', 'pageSize', 'total', 'rows']
const ENTRY = ['itemNumber', 'descriptionEn', 'descriptionAr', 'idfNumber', 'priority']
const CHANGE = ['changeId', 'entity', 'key', 'action', 'before', 'after', 'reason', 'by', 'at', 'uploadId', 'idfNumberBefore', 'idfNumberAfter']
const GROUP = ['idfNumber', 'description', 'dosageForm', 'itemCount']

// ── Sign-in (tools/delivery-statistics-live-drive.mjs) ─────────────────────────────────────────────
const WINDOW = process.env.SIS_SIGN_IN === 'window'
const browser = await chromium.launch({ headless: !WINDOW })
const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, acceptDownloads: true })
if (WINDOW) {
  const login = await context.newPage()
  await login.goto(`${BASE}/login`)
  console.log('Sign in in the browser window that just opened (5 minutes)…')
  let signedIn = false
  for (let i = 0; i < 1500 && !signedIn; i++) {
    signedIn = (await context.cookies(BASE)).some((c) => c.name === 'sis_session') && !new URL(login.url()).pathname.startsWith('/login')
    if (!signedIn) await login.waitForTimeout(200)
  }
  if (!signedIn) {
    console.error('No sign-in within 5 minutes.')
    process.exit(2)
  }
  console.log('Signed in.')
  await login.close()
} else if (process.env.SIS_COOKIE) {
  await context.addCookies([{ name: 'sis_session', value: process.env.SIS_COOKIE, url: BASE }])
} else if (process.env.SIS_USER) {
  const res = await context.request
    .post(`${BASE}/api/Auth/Login`, {
      headers: { 'Content-Type': 'application/json', 'X-Web-Client': '1' },
      data: { userId: process.env.SIS_USER, password: process.env.SIS_PASS ?? '' },
    })
    .catch((e) => {
      console.error(`No dev server answers on ${BASE} (${e.message.split('\n')[0]}). Start vite with SIS_API first.`)
      process.exit(2)
    })
  const body = await res.json().catch(() => null)
  if (!(await context.cookies(BASE)).some((c) => c.name === 'sis_session')) {
    console.error(`Login did not set a session cookie (HTTP ${res.status()}): ${body?.message ?? ''}`)
    console.error('If the account needs an OTP, sign in in a browser and pass SIS_COOKIE instead.')
    process.exit(2)
  }
  console.log(`Signed in as ${body?.data?.userId ?? process.env.SIS_USER}.`)
} else {
  console.error('Set SIS_SIGN_IN=window, SIS_USER + SIS_PASS, or SIS_COOKIE.')
  process.exit(2)
}

// ── The page harness: every IdfPriority answer is recorded; any IdfPriority WRITE is a failure ───────────────────
const answers = []
const writes = []
const errors = []
const page = await context.newPage()
page.setDefaultTimeout(30000)
page.on('pageerror', (e) => errors.push(String(e)))
page.on('request', (req) => {
  const url = new URL(req.url())
  if (url.pathname.includes('/api/IdfPriority/') && req.method() !== 'GET') writes.push(`${req.method()} ${url.pathname}`)
})
page.on('response', async (res) => {
  const url = new URL(res.url())
  if (!url.pathname.includes('/api/IdfPriority/')) return
  const json = /json/.test(res.headers()['content-type'] ?? '')
  const body = json ? await res.json().catch(() => null) : null
  answers.push({ path: url.pathname.replace(/^\/api\//, ''), query: Object.fromEntries(url.searchParams), status: res.status(), body })
})

/** A door read straight through the proxy (the session cookie rides along), unwrapped from the envelope. */
async function door(path) {
  const res = await context.request.get(`${BASE}/api/${path}`, { headers: { 'X-Web-Client': '1' } })
  const body = await res.json().catch(() => null)
  return { status: res.status(), ok: res.ok() && body?.success === true, data: body?.data, body }
}
const why = (a) => (a ? `HTTP ${a.status} ${a.body?.errors?.[0]?.errorCode ?? ''} ${a.body?.message ?? ''}`.trim() : 'no answer')

/** Opens a page in a language and waits for the answer of one door (by path prefix + optional predicate). */
async function open(lang, path, waitFor) {
  await page.addInitScript((l) => {
    localStorage.setItem('oms.locale', l)
    localStorage.setItem('oms.railExpanded', 'true')
  }, lang)
  const since = answers.length
  await page.goto(`${BASE}${path}`)
  if (!waitFor) return null
  for (let i = 0; i < 150; i++) {
    const hit = answers.slice(since).find(waitFor)
    if (hit) return hit
    await page.waitForTimeout(200)
  }
  return null
}
const dirOf = () => page.evaluate(() => document.documentElement.dir || 'ltr')

/** Clicks a download button and compares the saved name with the name the server sends for the same door. */
async function download(label, hook, doorPath) {
  const btn = page.locator(`[${hook}]`).first()
  if ((await btn.count()) === 0) return check(`${label}: the button is there`, false, hook)
  const head = await context.request.get(`${BASE}/api/${doorPath}`, { headers: { 'X-Web-Client': '1' } })
  const disposition = head.headers()['content-disposition'] ?? ''
  const serverName = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition)?.[1] ?? ''
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), btn.click()])
  const saved = dl.suggestedFilename()
  check(`${label}: a file downloads with the server's name`, head.ok() && !!serverName && saved === decodeURIComponent(serverName), `saved ${saved}, server "${serverName}" (HTTP ${head.status()})`)
}

// ── 1. the grant probe ───────────────────────────────────────────────────────────────────────────────
const access = await door('IdfPriority/Access')
check('1. Access answers exactly { canViewIdf, canEditIdf, canEditGeneral }', access.ok && hasKeys(access.data, ACCESS), why(access) + ' ' + JSON.stringify(access.data))
check('1. every flag is a boolean', ACCESS.every((k) => typeof access.data?.[k] === 'boolean'), JSON.stringify(access.data))
console.log(`   grants: ${JSON.stringify(access.data)}`)

// ── 2. the masters list ──────────────────────────────────────────────────────────────────────────────
const masters = await door('IdfPriority/masters')
const list = Array.isArray(masters.data) ? masters.data : []
const last = list[list.length - 1]
check('2. the masters list ends with the General row', masters.ok && last?.masterId === 'general' && last?.kind === 'general' && last?.liveVersion == null, JSON.stringify(last))
check('2. General is listed once', list.filter((m) => m.kind === 'general').length === 1)

let master = list.find((m) => m.masterId === process.env.IDF_MASTER)
let versions = []
if (!master) {
  for (const m of list.filter((x) => x.kind !== 'general' && x.liveVersion)) {
    const v = await door(`IdfPriority/masters/${encodeURIComponent(m.masterId)}/versions`)
    if (!master) master = m
    if ((v.data ?? []).length >= 2) {
      master = m
      versions = v.data
      break
    }
  }
}
if (master && versions.length === 0) versions = (await door(`IdfPriority/masters/${encodeURIComponent(master.masterId)}/versions`)).data ?? []
console.log(`   master: ${master ? `${master.masterId} (${master.nameEn}), ${versions.length} version(s)` : 'none with a live version'}`)

for (const lang of ['en', 'ar']) {
  const dir = lang === 'ar' ? 'RTL' : 'LTR'
  await open(lang, '/insurance-rules/idf/masters', (a) => a.path === 'IdfPriority/masters')
  const row = page.locator('[data-idf-masters] tr[data-kind="general"]')
  await row.waitFor()
  check(`2. ${dir} the page dir is ${dir.toLowerCase()}`, (await dirOf()) === dir.toLowerCase())
  const rows = page.locator('[data-idf-masters] tbody tr')
  check(`2. ${dir} the General row is the list's last`, (await rows.last().getAttribute('data-kind')) === 'general')
  const text = (await row.innerText()).replace(/\s+/g, ' ')
  check(`2. ${dir} the General row shows no thresholds, no version and no Edit`, (await row.locator('[data-col="thresholds"] bdi, [data-col="version"], button').count()) === 0, text)
  await page.screenshot({ path: `${SHOTS}/masters-${lang}.png`, fullPage: true })
}

// ── 3–4. one live master: entries, paging, search, group, an older version ──────────────────────────────
if (master) {
  const mid = encodeURIComponent(master.masterId)
  const live = master.liveVersion.versionId
  const entriesOf = (a) => a.path === `IdfPriority/masters/${master.masterId}/versions/${live}/entries` || a.path === `IdfPriority/masters/${mid}/versions/${encodeURIComponent(live)}/entries`
  for (const lang of ['en', 'ar']) {
    const dir = lang === 'ar' ? 'RTL' : 'LTR'
    const a = await open(lang, `/insurance-rules/idf/masters/${mid}`, (x) => /\/entries$/.test(x.path) && !x.query.pageSize)
    check(`3. ${dir} the live version's entries: { page, pageSize, total, rows }`, a?.body?.success === true && hasKeys(a.body.data, PAGE), why(a))
    const d = a?.body?.data
    check(`3. ${dir} each row has the entries keys`, (d?.rows ?? []).every((r) => hasKeys(r, ENTRY)), JSON.stringify(d?.rows?.[0]))
    if (d?.rows?.length) await page.locator('[data-idf-items] tbody tr[data-item]').first().waitFor()
    check(`3. ${dir} the table draws the page's rows`, (await page.locator('[data-idf-items] tbody tr[data-item]').count()) === (d?.rows?.length ?? 0))
    if (lang === 'en' && d) {
      if (d.total > d.pageSize) {
        const p2 = await open(lang, `/insurance-rules/idf/masters/${mid}?page=2`, (x) => entriesOf(x) || (/\/entries$/.test(x.path) && x.query.page === '2'))
        check('3. page 2 reads page=2 and draws its rows', p2?.body?.data?.page === 2 && (await page.locator('[data-idf-items] tbody tr[data-item]').count()) === p2.body.data.rows.length, why(p2))
      } else console.log('   (one page only: paging not exercised)')
      const sample = d.rows[0]
      if (sample) {
        const q = sample.itemNumber.slice(0, Math.max(3, sample.itemNumber.length - 1))
        const s = await open(lang, `/insurance-rules/idf/masters/${mid}?q=${encodeURIComponent(q)}`, (x) => /\/entries$/.test(x.path) && x.query.search === q)
        check('3. a search sends search= and only ever narrows the total', s?.body?.data?.total <= d.total && s.body.data.total >= 1, why(s))
        const g = await open(lang, `/insurance-rules/idf/masters/${mid}?idf=${encodeURIComponent(sample.idfNumber)}`, (x) => /\/entries$/.test(x.path) && x.query.idf === sample.idfNumber)
        check('3. a group sends idf= and narrows to that group', g?.body?.data?.total <= d.total && (g.body.data.rows ?? []).every((r) => r.idfNumber === sample.idfNumber), why(g))
      }
      await download('8. master export', 'data-idf-master-export', `IdfPriority/masters/${mid}/versions/${encodeURIComponent(live)}/export`)
      await download('8. master template', 'data-idf-master-template', 'IdfPriority/masters/template')
    }
    await page.screenshot({ path: `${SHOTS}/master-${lang}.png`, fullPage: true })
  }
  const old = versions.find((v) => v.versionId !== live)
  if (old) {
    const o = await open('en', `/insurance-rules/idf/masters/${mid}?version=${encodeURIComponent(old.versionId)}`, (x) => x.path.endsWith(`/versions/${old.versionId}/entries`) || x.path.endsWith(`/versions/${encodeURIComponent(old.versionId)}/entries`))
    check('4. an older version reads its own entries', o?.body?.success === true && hasKeys(o.body.data, PAGE), why(o))
    await page.locator('[data-idf-items-not-live]').waitFor({ timeout: 15000 }).catch(() => {})
    check('4. and says it is not the live version', (await page.locator('[data-idf-items-not-live]').count()) === 1)
  } else console.log('   (the master has one version: the old-version picker not exercised)')
} else check('3. a master with a live version exists to read', false, 'set IDF_MASTER')

// ── 5. the General page ──────────────────────────────────────────────────────────────────────────────
for (const lang of ['en', 'ar']) {
  const dir = lang === 'ar' ? 'RTL' : 'LTR'
  const a = await open(lang, '/insurance-rules/idf/general', (x) => x.path === 'IdfPriority/general/items')
  const d = a?.body?.data
  check(`5. ${dir} general items: { page, pageSize, total, rows } with the entries keys`, a?.body?.success === true && hasKeys(d, PAGE) && (d.rows ?? []).every((r) => hasKeys(r, ENTRY)), why(a))
  if (d?.rows?.length) await page.locator('[data-idf-items] tbody tr[data-item]').first().waitFor()
  check(`5. ${dir} the table draws the page's rows`, (await page.locator('[data-idf-items] tbody tr[data-item]').count()) === (d?.rows?.length ?? 0))
  check(`5. ${dir} the page dir is ${dir.toLowerCase()}`, (await dirOf()) === dir.toLowerCase())
  if (lang === 'en' && d?.rows?.[0]) {
    const g0 = d.rows[0].idfNumber
    const g = await open(lang, `/insurance-rules/idf/general?idf=${encodeURIComponent(g0)}`, (x) => x.path === 'IdfPriority/general/items' && x.query.idf === g0)
    check('5. a group filter narrows the general items to it', g?.body?.data?.total <= d.total && (g.body.data.rows ?? []).every((r) => r.idfNumber === g0), why(g))
    await download('8. general export', 'data-idf-general-export', 'IdfPriority/general/export')
    await download('8. general template', 'data-idf-general-template', 'IdfPriority/general/template')
  }
  await page.screenshot({ path: `${SHOTS}/general-${lang}.png`, fullPage: true })
}

// ── 6. the change log ────────────────────────────────────────────────────────────────────────────────
for (const lang of ['en', 'ar']) {
  const dir = lang === 'ar' ? 'RTL' : 'LTR'
  const a = await open(lang, '/insurance-rules/idf/general?tab=changes', (x) => x.path === 'IdfPriority/general/changes')
  const d = a?.body?.data
  check(`6. ${dir} change log: { page, pageSize, total, rows }`, a?.body?.success === true && hasKeys(d, PAGE), why(a))
  check(`6. ${dir} each row has the 3194 keys (idfNumberBefore / idfNumberAfter included)`, (d?.rows ?? []).every((r) => hasKeys(r, CHANGE)), JSON.stringify(d?.rows?.[0]))
  check(`6. ${dir} before / after are an object or null`, (d?.rows ?? []).every((r) => [r.before, r.after].every((s) => s === null || (typeof s === 'object' && !Array.isArray(s)))))
  if (d?.rows?.length) await page.locator('[data-idf-changes] tbody tr[data-change]').first().waitFor()
  check(`6. ${dir} the table draws the page's rows`, (await page.locator('[data-idf-changes] tbody tr[data-change]').count()) === (d?.rows?.length ?? 0))
  if (lang === 'en' && d) {
    const newest = d.rows?.[0]?.at?.slice(0, 10)
    if (newest) {
      const f = await open(lang, `/insurance-rules/idf/general?tab=changes&from=${newest}`, (x) => x.path === 'IdfPriority/general/changes' && x.query.from === newest)
      check('6. a from date sends from= and only ever narrows', f?.body?.success === true && f.body.data.total <= d.total && (f.body.data.rows ?? []).every((r) => r.at.slice(0, 10) >= newest), why(f))
      await download('8. change log export', 'data-idf-changes-export', `IdfPriority/general/changes/export?from=${newest}`)
    } else console.log('   (the change log is empty: its filter and export not exercised)')
  }
  await page.screenshot({ path: `${SHOTS}/changes-${lang}.png`, fullPage: true })
}

// ── 7. the IDF groups ────────────────────────────────────────────────────────────────────────────────
for (const lang of ['en', 'ar']) {
  const dir = lang === 'ar' ? 'RTL' : 'LTR'
  const a = await open(lang, '/insurance-rules/idf/groups', (x) => x.path === 'IdfPriority/groups')
  const d = a?.body?.data
  check(`7. ${dir} groups: { page, pageSize, total, rows } with the group keys`, a?.body?.success === true && hasKeys(d, PAGE) && (d.rows ?? []).every((r) => hasKeys(r, GROUP)), why(a))
  check(`7. ${dir} every group number is at most 8 characters`, (d?.rows ?? []).every((r) => r.idfNumber.length <= 8), (d?.rows ?? []).filter((r) => r.idfNumber.length > 8).map((r) => r.idfNumber).join(', '))
  if (d?.rows?.length) await page.locator('[data-idf-groups] tbody tr[data-group]').first().waitFor()
  check(`7. ${dir} the table draws the page's rows`, (await page.locator('[data-idf-groups] tbody tr[data-group]').count()) === (d?.rows?.length ?? 0))
  if (lang === 'en' && d?.rows?.[0]) {
    const q = d.rows[0].idfNumber
    const s = await open(lang, `/insurance-rules/idf/groups?q=${encodeURIComponent(q)}`, (x) => x.path === 'IdfPriority/groups' && x.query.search === q)
    check('7. a search sends search= and finds the group', s?.body?.success === true && (s.body.data.rows ?? []).some((r) => r.idfNumber === q) && s.body.data.total <= d.total, why(s))
    await download('8. groups export', 'data-idf-groups-export', 'IdfPriority/groups/export')
    await download('8. groups template', 'data-idf-groups-template', 'IdfPriority/groups/template')
  }
  await page.screenshot({ path: `${SHOTS}/groups-${lang}.png`, fullPage: true })
}

// ── 9. read-only, no errors ──────────────────────────────────────────────────────────────────────────
check('9. the drive wrote nothing (no IdfPriority write was sent)', writes.length === 0, writes.join(', '))
check('9. no page errors', errors.length === 0, errors.join(' | '))

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
