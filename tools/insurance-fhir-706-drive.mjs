// Insurance rules ▸ Code labels drive (BackOffice spec 3271, doors 3295 + 3296; oms ticket 706).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/fhir-rules-stubs-706.mjs`).
// 🚩 NOTHING here is driven against a live SIS.Api: the doors are unbuilt; 711 reconciles the shapes.
//
// It verifies, in LTR and RTL:
//   1. the rail's leaf; the past loads with workbook, version, file, who + when, and the file hash;
//   2. upload waits for a file; one multipart POST carrying the file;
//   3. the reply: workbook, version, the diff grouped added / changed / removed with before and after,
//      labels shown as sent in <bdi>, codes in ltr isolates; the new change-log rows; the log gains the load;
//   4. an older version and an unknown layout are refused with the door's message, nothing is shown as loaded,
//      and the log is unchanged;
//   5. a workbook that changes nothing says so;
//   6. a bare 403 on the read is "You do not have access"; on the upload it says so too;
//   7. no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5216 --strictPort
//   2. node tools/insurance-fhir-706-drive.mjs        (DRIVE_PORT overrides 5216)
import { createRequire } from 'node:module'
import { envelope } from './insurance-rules-stubs.mjs'
import { NEW_HASH, PAST_LOADS, SYSTEM, labelsStub, newLabelsState } from './fhir-rules-stubs-706.mjs'
import { granted852 } from './access-852-grants.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5216}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const posts = []
  const state = newLabelsState()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    let fileName = ''
    if (req.method() === 'POST') {
      const text = req.postDataBuffer()?.toString('utf8') ?? ''
      fileName = /name="file"; filename="([^"]*)"/.exec(text)?.[1] ?? ''
      posts.push({ path: p, fileName, parts: [...text.matchAll(/; name="([^"]+)"/g)].map((m) => m[1]) })
    }
    const hit = labelsStub(req.method(), p, { state, fileName, deny })
    if (hit) return route.fulfill(hit)
    { const g = granted852(p); if (g) return route.fulfill(envelope(g)) } // 852: the leaf's probe answers granted
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, posts }
}

const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|labels):|\b(page|workbook|upload|result|diff|changeLog|log|access)\.[a-zA-Z]/.test(await page.locator('main').innerText())
const loadIds = (page) => page.locator('[data-load]').evaluateAll((els) => els.map((e) => e.getAttribute('data-load')))
const send = async (page, name) => {
  await page.locator('[data-upload-file]').setInputFiles({ name, mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', buffer: Buffer.from('PK-fake-xlsx') })
  await page.locator('[data-upload-submit]').click()
}
const ltrText = (loc) => loc.locator('bdi[dir="ltr"]').first().innerText()

for (const dir of ['ltr', 'rtl']) {
  // `oms.locale` sets the direction only: `lng` stays `en` (core/i18n), so the words are English in both passes.
  const words = { title: 'Code labels', cc: 'Codeable Concept workbook', denied: 'You do not have access', noDiff: 'This workbook changes no label.', noLog: 'This workbook adds no change-log row.', profiles: 'Profiles workbook' }

  {
    const { context, page, errors, posts } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/code-labels`)
    await page.locator('[data-load]').first().waitFor({ timeout: 60000 })

    // 1. the log
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. the rail has the Code labels leaf`, (await page.locator('a[href="/insurance-rules/code-labels"]').count()) >= 1)
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === words.title)
    check(`${dir} 1. the past loads in the door's order`, JSON.stringify(await loadIds(page)) === JSON.stringify(PAST_LOADS.map((l) => l.id)))
    const past = page.locator('[data-load="WB-1"]')
    check(`${dir} 1. a load: workbook, version, file`, strip(await past.locator('[data-col="workbook"]').innerText()) === words.cc && (await ltrText(past.locator('[data-col="version"]'))) === '3.0.0' && strip(await past.locator('[data-col="file"] bdi').innerText()) === 'Codeable Concept v3.0.xlsx')
    check(`${dir} 1. a load: who and when as one ltr isolate`, strip(await ltrText(past.locator('[data-col="uploaded"]'))) === 'nalharbi · 2026-08-02 11:05', strip(await past.locator('[data-col="uploaded"]').innerText()))
    check(`${dir} 1. a load: the whole file hash, an ltr isolate`, (await ltrText(past.locator('[data-col="hash"]'))) === 'a'.repeat(64))
    check(`${dir} 1. nothing shown as uploaded yet`, (await page.locator('[data-upload-result]').count()) === 0)

    // 4. refusals, before any success so nothing could be left on screen by a load
    const submit = page.locator('[data-upload-submit]')
    check(`${dir} 2. Upload waits for a file`, await submit.isDisabled())
    await send(page, 'Codeable Concept v2.xlsx')
    await page.locator('[data-upload-refused]').waitFor({ timeout: 10000 })
    check(`${dir} 4. an older version: the door's message`, strip(await page.locator('[data-upload-refused]').innerText()) === 'Version 2.0.0 is older than the loaded version 3.0.0.', strip(await page.locator('[data-upload-refused]').innerText()))
    check(`${dir} 4. an older version: no result, the log unchanged`, (await page.locator('[data-upload-result]').count()) === 0 && (await loadIds(page)).length === 2)
    await page.locator('[data-upload-file]').setInputFiles({ name: 'Some other sheet.xlsx', mimeType: 'application/vnd.ms-excel', buffer: Buffer.from('x') })
    check(`${dir} 4. picking another file clears the refusal`, (await page.locator('[data-upload-refused]').count()) === 0)
    await submit.click()
    await page.locator('[data-upload-refused]').waitFor({ timeout: 10000 })
    check(`${dir} 4. an unknown layout: the door's message`, strip(await page.locator('[data-upload-refused]').innerText()) === 'This workbook has an unknown layout.')
    check(`${dir} 4. an unknown layout: no result, the log unchanged`, (await page.locator('[data-upload-result]').count()) === 0 && (await loadIds(page)).length === 2)

    // 2–3. a real load
    await send(page, 'Codeable Concept v3.1.xlsx')
    await page.locator('[data-upload-result]').waitFor({ timeout: 10000 })
    const last = posts.at(-1)
    check(`${dir} 2. one multipart POST with the file alone`, last.path === 'InsuranceRules/Labels/Workbooks' && last.fileName === 'Codeable Concept v3.1.xlsx' && JSON.stringify(last.parts.filter((n) => n !== 'file')) === '[]', JSON.stringify(last))
    check(`${dir} 3. the refusal is gone`, (await page.locator('[data-upload-refused]').count()) === 0)
    const result = page.locator('[data-upload-result]')
    check(`${dir} 3. the workbook and its version`, strip(await result.locator('[data-result-workbook]').innerText()) === words.cc && (await ltrText(result.locator('[data-result-version]'))) === '3.1.0')
    check(`${dir} 3. who and when`, strip(await ltrText(result.locator('[data-result-uploaded]'))) === 'msartawi · 2026-10-30 10:30')
    const groups = await result.locator('[data-diff-group]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-diff-group')}=${[...e.querySelectorAll('[data-diff-row]')].map((r) => r.getAttribute('data-diff-row')).join(',')}`))
    check(`${dir} 3. grouped added, changed, removed, each in the door's order`, JSON.stringify(groups) === JSON.stringify(['added=81,82', 'changed=12', 'removed=44']), JSON.stringify(groups))
    const counts = await result.locator('[data-diff-group] h4 bdi[dir="ltr"]').allInnerTexts()
    check(`${dir} 3. each group is counted`, JSON.stringify(counts) === JSON.stringify(['2', '1', '1']), JSON.stringify(counts))
    const changed = result.locator('[data-diff-row="12"]')
    check(`${dir} 3. changed: before and after, labels as sent`, strip(await changed.locator('[data-col="before"] [data-label="en"] bdi').innerText()) === 'Dental' && (await changed.locator('[data-col="before"] [data-label="ar"]').count()) === 0 && strip(await changed.locator('[data-col="after"] [data-label="en"] bdi').innerText()) === 'Dental care' && strip(await changed.locator('[data-col="after"] [data-label="ar"] bdi').innerText()) === 'عناية الأسنان')
    check(`${dir} 3. code and system are ltr isolates`, (await ltrText(changed.locator('[data-col="code"]'))) === '12' && (await ltrText(changed.locator('[data-col="system"]'))) === SYSTEM)
    check(`${dir} 3. an added row has no before, a removed row no after`, (await result.locator('[data-diff-row="81"] [data-col="before"]').count()) === 0 && (await result.locator('[data-diff-row="44"] [data-col="after"]').count()) === 0)
    const rows = result.locator('[data-change-log-row]')
    check(`${dir} 3. the new change-log rows, in the workbook's words`, (await rows.count()) === 2 && strip(await rows.nth(0).locator('[data-col="change"] bdi').innerText()) === 'Added Home nursing' && (await ltrText(rows.nth(0).locator('[data-col="code"]'))) === '81' && (await ltrText(rows.nth(0).locator('[data-col="date"]'))) === '2026-10-15')
    await page.locator('[data-load="WB-3"]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 3. the load tops the log`, (await loadIds(page))[0] === 'WB-3' && (await ltrText(page.locator('[data-load="WB-3"] [data-col="hash"]'))) === NEW_HASH)
    check(`${dir} 3. the file box empties, so a second click cannot resend it`, await submit.isDisabled())
    check(`${dir} 7. no raw keys with a result`, await noRawKeys(page))

    // 5. nothing changed
    await send(page, 'Profiles same labels.xlsx')
    await page.locator('[data-diff-empty]').waitFor({ timeout: 10000 })
    check(`${dir} 5. an empty diff says so, with no groups`, strip(await page.locator('[data-diff-empty]').innerText()) === words.noDiff && (await page.locator('[data-diff-group]').count()) === 0)
    check(`${dir} 5. no new change-log rows says so`, strip(await page.locator('[data-change-log-empty]').innerText()) === words.noLog)
    check(`${dir} 5. the new reply replaces the last one`, strip(await page.locator('[data-result-workbook]').innerText()) === words.profiles)
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 6. a bare 403
  {
    const { context, page } = await open(dir, { deny: ['loads'] })
    await page.goto(`${BASE}/insurance-rules/code-labels`)
    await page.locator('[data-code-labels-denied]').waitFor({ timeout: 30000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the read: no access, and no upload offered`, strip(await page.locator('[data-code-labels-denied]').innerText()).startsWith(words.denied) && (await page.locator('[data-upload]').count()) === 0)
    await context.close()
  }
  {
    const { context, page } = await open(dir, { deny: ['upload'] })
    await page.goto(`${BASE}/insurance-rules/code-labels`)
    await page.locator('[data-load]').first().waitFor({ timeout: 30000 })
    await send(page, 'Codeable Concept v3.1.xlsx')
    await page.locator('[data-upload-refused]').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the upload says no access`, strip(await page.locator('[data-upload-refused]').innerText().catch(() => '')) === words.denied)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
