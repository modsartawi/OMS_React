// Insurance rules ▸ IDF master ▸ upload → row report → publish, and the version history + restore drive (BackOffice
// spec 3157 / door 3161; oms tickets 622 and 623).
//
// Drives the REAL app in Chromium against STUBS of the masters door and the two upload doors, on the REAL envelope.
// Fixtures and handlers are `tools/idf-stubs.mjs` (`// --- 619 ---`, `// --- 622 ---`, `idfStub`):
//   GET  IdfPriority/masters                                  → `IDF_MASTERS`
//   POST IdfPriority/masters/{id}/uploads   (multipart file)  → a report by file name (`dirty` / `notok` / clean)
//   POST IdfPriority/masters/{id}/uploads/{uploadId}/publish  → the new live version, or a business refusal
//   GET  IdfPriority/masters/{id}/versions                    → the history (623, `IDF_VERSIONS`)
//   POST IdfPriority/masters/{id}/versions/{vid}/restore      → a NEW live version (623)
// 🚩 NOTHING here is driven against a live SIS.Api: BackOffice 3161 is unbuilt. Ticket 628 swaps in the doors.
//
// It verifies, in LTR and RTL:
//   1. a master's name on the list opens its page (`/insurance-rules/idf/masters/:masterId`), the leaf stays lit;
//      the header shows scope, thresholds and the live version;
//   2. a failing file shows its row report (line, item, rule, message; machine values in `bdi[dir=ltr]`, messages
//      in `bdi`) and Publish stays disabled even with a note; `ok: false` with no rows also keeps it disabled;
//   3. a new upload replaces the report; a clean file still needs a note; publishing sends the note, the live
//      version moves on the page and on the list;
//   4. a refused publish shows the server's message (a business outcome);
//   5. an unknown master says so; no raw keys; no page errors;
//   6. (623) Versions lists the history newest first, the live one marked and without Restore; restoring v1 asks for
//      a note, posts it, and makes v4 live at the top — v1 stays listed unchanged; a refused restore shows the
//      server's message; a publish adds its version to the history.
//
//   1. run the app:  npx vite --port 5203 --strictPort   (623 ran it on 5209: DRIVE_PORT=5209)
//   2. node tools/idf-upload-drive.mjs        (DRIVE_PORT overrides 5203)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5203}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { refusePublish = false, refuseRestore = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const state = newIdfState()
  const uploads = {}
  const published = []
  const restored = []
  const calls = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    const multipart = /multipart\/form-data/.test(req.headers()['content-type'] ?? '')
    let body = null
    try {
      body = multipart ? req.postData() : req.postDataJSON()
    } catch {
      body = null
    }
    calls.push({ method: req.method(), path: p, multipart, body })
    if (refusePublish && /\/publish$/.test(p))
      return route.fulfill(envelope(null, { status: 409, success: false, message: 'Another version was published meanwhile; upload again.', errorCode: 'STALE_UPLOAD' }))
    if (refuseRestore && /\/restore$/.test(p))
      return route.fulfill(envelope(null, { status: 400, success: false, message: 'This master is locked while an upload is checked.', errorCode: 'MASTER_LOCKED' }))
    const hit = idfStub(req.method(), p + url.search, body, { state, uploads, published, restored })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, published, restored, calls }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|idf):|upload\.|versions\.|masters\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const ltr = (loc) => loc.locator('bdi[dir="ltr"]').evaluateAll((els) => els.map((e) => e.textContent))
const vrows = (page) => page.locator('[data-idf-versions-rows] tbody tr').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-number')}:${e.getAttribute('data-live')}`))
const file = (name) => ({ name, mimeType: 'text/csv', buffer: Buffer.from('item,group,priority\n100234,G1,1\n') })

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, published, calls } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters`)
    await page.locator('[data-master="M-BUPA"] [data-idf-open-master]').waitFor({ timeout: 60000 })
    await page.locator('[data-master="M-BUPA"] [data-idf-open-master]').click()
    await page.locator('[data-idf-master="M-BUPA"]').waitFor({ timeout: 60000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the name opens the master's page`, new URL(page.url()).pathname === '/insurance-rules/idf/masters/M-BUPA', page.url())
    const leaf = page.locator('a[href="/insurance-rules/idf/masters"][aria-current="page"]')
    check(`${dir} 1. the IDF masters leaf stays lit`, (await leaf.count()) >= 1)
    const head = page.locator('[data-idf-master="M-BUPA"]')
    check(`${dir} 1. header: name in a bdi, payer ltr, thresholds`, strip(await head.locator('h1 bdi').innerText()) === 'Bupa general' && JSON.stringify(await ltr(head.locator('[data-col="payer"]'))) === '["BUPA"]' && strip(await head.locator('[data-col="thresholds"]').innerText()) === 'Hard above 5, reminder above 2')
    check(`${dir} 1. header: live version 3 by · at, note`, JSON.stringify(await ltr(head.locator('[data-live-number]'))) === '["3"]' && strip((await ltr(head.locator('[data-live-by-at]'))).join('')) === 'nalharbi · 2026-10-20 09:15' && strip(await head.locator('[data-live-note] bdi').innerText()) === 'October refresh')

    const publish = page.locator('[data-idf-publish]')
    check(`${dir} 2. Publish is disabled before any upload`, await publish.isDisabled())

    // a failing file
    await page.locator('[data-idf-upload-file]').setInputFiles(file('bupa-dirty.csv'))
    await page.locator('[data-idf-upload-submit]').click()
    await page.locator('[data-idf-report="failed"]').waitFor({ timeout: 30000 })
    const up = calls.filter((c) => c.method === 'POST' && c.path === 'IdfPriority/masters/M-BUPA/uploads')
    check(`${dir} 2. the upload is multipart with the file`, up.length === 1 && up[0].multipart && /filename="bupa-dirty.csv"/.test(up[0].body ?? ''))
    check(`${dir} 2. the summary counts the failing rows`, strip(await page.locator('[data-idf-report-summary]').innerText()).startsWith('3 rows failed.') && JSON.stringify(await ltr(page.locator('[data-idf-report-summary]'))) === '["3"]', strip(await page.locator('[data-idf-report-summary]').innerText()))
    const rows = page.locator('[data-idf-report-rows] tbody tr')
    check(`${dir} 2. every failing row, in the server's order`, JSON.stringify(await rows.evaluateAll((els) => els.map((e) => `${e.getAttribute('data-line')}:${e.getAttribute('data-rule')}`))) === JSON.stringify(['3:unknownItem', '7:notInItemCustomer', '9:badPriority']))
    const r1 = page.locator('[data-idf-report-rows] tbody tr[data-line="7"]')
    check(`${dir} 2. line and item are ltr, the rule in words, the message in a bdi`, JSON.stringify(await ltr(r1.locator('[data-col="line"]'))) === '["7"]' && JSON.stringify(await ltr(r1.locator('[data-col="item"]'))) === '["100871"]' && strip(await r1.locator('[data-col="rule"]').innerText()) === "Item not in the insurer's items" && strip(await r1.locator('[data-col="message"] bdi').innerText()) === "Item 100871 is not one of Bupa's items.")
    await page.locator('[data-idf-publish-note]').fill('November refresh')
    check(`${dir} 2. a dirty report keeps Publish disabled, even with a note`, await publish.isDisabled())

    // ok: false with no rows
    await page.locator('[data-idf-upload-file]').setInputFiles(file('bupa-notok.csv'))
    await page.locator('[data-idf-upload-submit]').click()
    await page.locator('[data-idf-report="failed"] [data-idf-report-summary]').filter({ hasText: 'did not pass' }).waitFor({ timeout: 30000 })
    check(`${dir} 2. ok:false with no rows: no table, Publish disabled`, (await page.locator('[data-idf-report-rows]').count()) === 0 && (await publish.isDisabled()))

    // a clean file replaces the report
    await page.locator('[data-idf-upload-file]').setInputFiles(file('bupa-clean.csv'))
    check(`${dir} 3. picking a new file clears the previous report`, (await page.locator('[data-idf-report]').count()) === 0)
    await page.locator('[data-idf-upload-submit]').click()
    await page.locator('[data-idf-report="clean"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. the clean report replaced the failing one`, (await page.locator('[data-idf-report="failed"], [data-idf-report-rows]').count()) === 0)
    await page.locator('[data-idf-publish-note]').fill('  ')
    check(`${dir} 3. a clean report still needs a note`, await publish.isDisabled())
    await page.locator('[data-idf-publish-note]').fill('November refresh')
    check(`${dir} 3. clean + a note → Publish enabled`, await publish.isEnabled())
    await publish.click()
    await head.locator('[data-live-number]').filter({ hasText: '4' }).waitFor({ timeout: 30000 })
    check(`${dir} 3. publish posts the clean upload with the note`, JSON.stringify(published) === JSON.stringify([{ masterId: 'M-BUPA', uploadId: 'U-3', note: 'November refresh' }]), JSON.stringify(published))
    check(`${dir} 3. the live version moved on the page, with its note`, JSON.stringify(await ltr(head.locator('[data-live-number]'))) === '["4"]' && strip(await head.locator('[data-live-note] bdi').innerText()) === 'November refresh')
    check(`${dir} 3. the consumed report and the note are cleared`, (await page.locator('[data-idf-report]').count()) === 0 && (await page.locator('[data-idf-publish-note]').inputValue()) === '' && (await publish.isDisabled()))
    check(`${dir} 3. a toast says the version is live`, strip(await page.locator('[data-sonner-toast]').first().innerText()).includes('Version 4 is live now.'))
    check(`${dir} 5. no raw keys`, await noRawKeys(page))
    check(`${dir} 6. the publish added its version to the history, live at the top`, JSON.stringify(await vrows(page)) === JSON.stringify(['4:true', '3:false', '2:false', '1:false']), JSON.stringify(await vrows(page)))
    await page.locator('[data-idf-back]').click()
    await page.locator('[data-master="M-BUPA"] [data-col="version"]').waitFor({ timeout: 30000 })
    check(`${dir} 3. the list shows the new live version`, JSON.stringify(await ltr(page.locator('[data-master="M-BUPA"] [data-col="version"]'))) === '["4"]')
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { refusePublish: true })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-OPS`)
    await page.locator('[data-idf-master="M-OPS"]').waitFor({ timeout: 60000 })
    await page.locator('[data-idf-upload-file]').setInputFiles(file('ops-clean.csv'))
    await page.locator('[data-idf-upload-submit]').click()
    await page.locator('[data-idf-report="clean"]').waitFor({ timeout: 30000 })
    await page.locator('[data-idf-publish-note]').fill('Ops refresh')
    await page.locator('[data-idf-publish]').click()
    await page.locator('[data-idf-publish-refused]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 4. a refused publish shows the server's message`, strip(await page.locator('[data-idf-publish-refused]').innerText()).includes('Another version was published meanwhile; upload again.'))
    check(`${dir} 4. the live version did not move`, JSON.stringify(await ltr(page.locator('[data-idf-master="M-OPS"] [data-live-number]'))) === '["1"]')
    check(`${dir} 4. no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  // 623 · versions and restore
  {
    const { context, page, errors, restored } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await page.locator('[data-idf-versions-rows]').waitFor({ timeout: 60000 })
    check(`${dir} 6. the history newest first, only v3 live`, JSON.stringify(await vrows(page)) === JSON.stringify(['3:true', '2:false', '1:false']), JSON.stringify(await vrows(page)))
    const row = (n) => page.locator(`[data-idf-versions-rows] tbody tr[data-number="${n}"]`)
    check(`${dir} 6. the live one is marked and offers no Restore`, (await row(3).locator('[data-live-mark]').count()) === 1 && (await row(3).locator('[data-idf-restore]').count()) === 0)
    check(`${dir} 6. every earlier version offers Restore`, (await row(2).locator('[data-idf-restore]').count()) === 1 && (await row(1).locator('[data-idf-restore]').count()) === 1 && (await page.locator('[data-live-mark]').count()) === 1)
    check(`${dir} 6. number and by · at ltr, the note in a bdi`, JSON.stringify(await ltr(row(1).locator('[data-col="number"]'))) === '["1"]' && strip((await ltr(row(1).locator('[data-col="byAt"]'))).join('')) === 'falotaibi · 2026-09-01 08:00' && strip(await row(1).locator('[data-col="note"] bdi').innerText()) === 'First list')
    await row(1).locator('[data-idf-restore]').click()
    const panel = page.locator('[data-idf-restore-panel="V-2"]')
    await panel.waitFor({ timeout: 30000 })
    check(`${dir} 6. Restore opens a note panel for v1, its number ltr`, JSON.stringify(await ltr(panel.locator('[data-idf-restore-title]'))) === '["1"]')
    const confirm = panel.locator('[data-idf-restore-confirm]')
    check(`${dir} 6. confirm is off on a blank note`, await confirm.isDisabled())
    await panel.locator('[data-idf-restore-note]').fill('  ')
    check(`${dir} 6. confirm is off on a whitespace note`, await confirm.isDisabled())
    await panel.locator('[data-idf-restore-note]').fill('Back to the first list')
    await confirm.click()
    await page.locator('[data-idf-versions-rows] tbody tr[data-number="4"]').waitFor({ timeout: 30000 })
    check(`${dir} 6. restore posts v1 with the note`, JSON.stringify(restored) === JSON.stringify([{ masterId: 'M-BUPA', versionId: 'V-2', note: 'Back to the first list' }]), JSON.stringify(restored))
    check(`${dir} 6. a new v4 is live at the top; v3, v2, v1 all still listed`, JSON.stringify(await vrows(page)) === JSON.stringify(['4:true', '3:false', '2:false', '1:false']), JSON.stringify(await vrows(page)))
    check(`${dir} 6. v1 is unchanged (same by, at, note) and restorable again`, strip((await ltr(row(1).locator('[data-col="byAt"]'))).join('')) === 'falotaibi · 2026-09-01 08:00' && strip(await row(1).locator('[data-col="note"] bdi').innerText()) === 'First list' && (await row(1).locator('[data-idf-restore]').count()) === 1)
    check(`${dir} 6. v4 carries the note and offers no Restore; v3 now does`, strip(await row(4).locator('[data-col="note"] bdi').innerText()) === 'Back to the first list' && (await row(4).locator('[data-idf-restore]').count()) === 0 && (await row(3).locator('[data-idf-restore]').count()) === 1)
    check(`${dir} 6. the panel closed`, (await page.locator('[data-idf-restore-panel]').count()) === 0)
    check(`${dir} 6. the header's live version moved to 4`, JSON.stringify(await ltr(page.locator('[data-idf-master="M-BUPA"] [data-live-number]'))) === '["4"]')
    check(`${dir} 6. a toast names both versions`, strip(await page.locator('[data-sonner-toast]').first().innerText()).includes('Version 1 is live again as version 4.'))
    check(`${dir} 6. no raw keys (versions)`, await noRawKeys(page))
    check(`${dir} 6. no page errors (versions)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir, { refuseRestore: true })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await page.locator('[data-idf-versions-rows]').waitFor({ timeout: 60000 })
    await page.locator('[data-idf-versions-rows] tbody tr[data-number="2"] [data-idf-restore]').click()
    await page.locator('[data-idf-restore-note]').fill('Try')
    await page.locator('[data-idf-restore-confirm]').click()
    await page.locator('[data-idf-restore-refused]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 6. a refused restore shows the server's message`, strip(await page.locator('[data-idf-restore-refused]').innerText()).includes('This master is locked while an upload is checked.'))
    check(`${dir} 6. nothing moved after a refusal`, JSON.stringify(await vrows(page)) === JSON.stringify(['3:true', '2:false', '1:false']))
    check(`${dir} 6. no page errors (refused restore)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-NOPE`)
    await page.locator('[data-idf-master-missing]').waitFor({ timeout: 60000 }).catch(() => {})
    check(`${dir} 5. an unknown master says so`, strip(await page.locator('[data-idf-master-missing]').innerText()) === 'There is no IDF master M-NOPE.' && (await page.locator('[data-idf-upload]').count()) === 0)
    check(`${dir} 5. no page errors (unknown)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
