// Insurance rules ▸ IDF master ▸ Export + Template drive (BackOffice spec 3185 / door 3188; oms ticket 644).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope. Fixtures and handlers are `tools/idf-stubs.mjs`
// (`// --- 619 ---`, `// --- 623 ---`, `// --- 643 ---`, `// --- 644 ---`, `idfStub`):
//   GET IdfPriority/masters/{id}/versions/{vid}/export → that version as `.xlsx` (`IDF_MASTER_EXPORT_NAME`)
//   GET IdfPriority/masters/template                  → the blank file (`IDF_MASTER_TEMPLATE_NAME`)
//
// It verifies, in LTR and RTL:
//   1. Export by the Items section saves the LIVE version under the server's name; Template by Upload saves the blank;
//   2. picking an old version exports THAT version; a link naming an old version exports it too;
//   3. with no server name the fallback names the master and the version (and the template its own);
//   4. a refused export / template (JSON 400 envelope) toasts its message and saves nothing;
//   5. a master with no live version offers no Export, still the Template;
//   6. no raw keys, no page errors.
//
//   1. run the app:  npx vite --port 5212 --strictPort
//   2. node tools/idf-export-drive.mjs        (DRIVE_PORT overrides 5212)
import { createRequire } from 'node:module'
import { envelope, idfStub, newIdfState, IDF_MASTER_EXPORT_NAME, IDF_MASTER_TEMPLATE_NAME } from './idf-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5212}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [], noFileName = false } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh', acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const state = newIdfState()
  const reads = {}
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
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit = idfStub(req.method(), p + url.search, body, { state, reads, deny, noFileName })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads }
}

const noRawKeys = async (page) => !/insurance-(rules|idf):|items\.|upload\.|versions\.|masters\.|download\.|menu\.idf|access\./.test(await page.locator('main').innerText())
const EXPORT = '[data-idf-master-export]'
const TEMPLATE = '[data-idf-master-template]'
const download = async (page, sel) => {
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 30000 }), page.locator(sel).click()])
  return { name: dl.suggestedFilename(), saved: (await dl.path()) != null }
}
const lastExport = (reads) => reads.masterExport?.at(-1) ?? null
const ready = (page) => page.locator('[data-idf-items] tbody tr').first().waitFor({ timeout: 60000 })

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await ready(page)
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(
      `${dir} 1. Export sits in the Items section, Template in the Upload step`,
      (await page.locator(`[data-idf-items-section] ${EXPORT}`).count()) === 1 && (await page.locator(`[data-idf-upload] ${TEMPLATE}`).count()) === 1,
    )
    const live = await download(page, EXPORT)
    check(
      `${dir} 1. Export saves the live version under the server's name`,
      live.saved && live.name === IDF_MASTER_EXPORT_NAME('M-BUPA', 'V-11') && JSON.stringify(lastExport(reads)) === JSON.stringify({ masterId: 'M-BUPA', versionId: 'V-11' }),
      `${live.name} ${JSON.stringify(lastExport(reads))}`,
    )
    const tpl = await download(page, TEMPLATE)
    check(`${dir} 1. Template saves the blank file`, tpl.saved && tpl.name === IDF_MASTER_TEMPLATE_NAME && reads.masterTemplate === 1, tpl.name)

    await page.locator('[data-idf-items-version]').selectOption('V-7')
    await page.locator('[data-idf-items-not-live="V-7"]').waitFor({ timeout: 30000 })
    const old = await download(page, EXPORT)
    check(`${dir} 2. a picked old version exports that version`, old.name === IDF_MASTER_EXPORT_NAME('M-BUPA', 'V-7') && lastExport(reads)?.versionId === 'V-7', old.name)

    check(`${dir} 6. no raw keys`, await noRawKeys(page))
    check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, reads } = await open(dir, { noFileName: true })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA?version=V-2`)
    await page.locator('[data-idf-items-not-live="V-2"]').waitFor({ timeout: 60000 })
    await ready(page)
    const linked = await download(page, EXPORT)
    check(
      `${dir} 2+3. a link naming an old version exports it; no server name → the master and the version`,
      linked.name === 'idf-master-M-BUPA-v1.xlsx' && lastExport(reads)?.versionId === 'V-2',
      `${linked.name} ${JSON.stringify(lastExport(reads))}`,
    )
    const tpl = await download(page, TEMPLATE)
    check(`${dir} 3. no server name → the template's own fallback`, tpl.name === 'idf-master-template.xlsx', tpl.name)
    check(`${dir} 3. no page errors (fallback names)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, reads } = await open(dir, { deny: ['masterExport', 'masterTemplate'] })
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-BUPA`)
    await ready(page)
    let downloaded = false
    page.on('download', () => (downloaded = true))
    await page.locator(EXPORT).click()
    const exportToast = page.locator('[data-sonner-toast]', { hasText: 'The file could not be exported' })
    await exportToast.waitFor({ timeout: 10000 }).catch(() => {})
    check(
      `${dir} 4. a refused export toasts the server's message, no file`,
      (await exportToast.count()) === 1 && /This version could not be exported/.test(await exportToast.innerText()) && !downloaded && reads.masterExport?.length === 1,
    )
    await page.locator(TEMPLATE).click()
    const tplToast = page.locator('[data-sonner-toast]', { hasText: 'The template could not be downloaded' })
    await tplToast.waitFor({ timeout: 10000 }).catch(() => {})
    check(`${dir} 4. a refused template toasts the server's message, no file`, (await tplToast.count()) === 1 && /The template could not be built/.test(await tplToast.innerText()) && !downloaded)
    check(`${dir} 4. the buttons are usable again after a refusal`, (await page.locator(EXPORT).isEnabled()) && (await page.locator(TEMPLATE).isEnabled()))
    check(`${dir} 4. no page errors (refused)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/idf/masters/M-TAW-PILOT`)
    await page.locator('[data-idf-items-no-live]').waitFor({ timeout: 60000 })
    check(`${dir} 5. no live version → no Export, still the Template`, (await page.locator(EXPORT).count()) === 0 && (await page.locator(TEMPLATE).count()) === 1)
    const tpl = await download(page, TEMPLATE)
    check(`${dir} 5. the Template downloads without a live version`, tpl.name === IDF_MASTER_TEMPLATE_NAME && !reads.masterExport)
    check(`${dir} 6. no raw keys (no live)`, await noRawKeys(page))
    check(`${dir} 6. no page errors (no live)`, errors.length === 0, errors.join(' | '))
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
