// Insurance rules ▸ Metrics ▸ Rejections ▸ "Open as guard draft" drive (BackOffice spec 3271 A10, door 3292; oms 709).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope. 🚩 Nothing is driven against a live SIS.Api.
// It verifies, in LTR and RTL:
//   1. a coded row offers the action, a row with only the payer's words does not;
//   2. the action opens /insurance-rules/guards/new filled in: the payer, a line in a list of the kind, the code in the
//      NPHIES box, with nothing written yet;
//   3. Save writes the draft once, the new list and the rule in it, and moves to the rule's edit URL;
//   4. leaving through Cancel writes nothing;
//   5. a code in the conflict shape lands in the NPHIES box and the editor holds the save until the author moves it;
//   6. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5219 --strictPort
//   2. DRIVE_PORT=5219 node tools/insurance-fhir-709-drive.mjs
import { createRequire } from 'node:module'
import { envelope, guardEditorStub, insuranceMetricsStub, insuranceRulesStub, newGuardStore, RULES } from './insurance-rules-stubs.mjs'
import { REJECTIONS_709 } from './fhir-rules-stubs-709.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5219}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()
const NEXT_ID = `G-${String(Math.max(...RULES.map((r) => Number(r.id.slice(2)))) + 1).padStart(3, '0')}`

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newGuardStore()
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
    if (p === 'InsuranceRules/Rejections') {
      const payer = url.searchParams.get('payer')
      return route.fulfill(envelope(REJECTIONS_709.filter((r) => !payer || r.payer === payer)))
    }
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit = guardEditorStub(req.method(), p, body, { store, reads }) ?? insuranceMetricsStub(req.method(), p, url.searchParams, {}) ?? insuranceRulesStub(req.method(), p, body, { reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const rowOf = (page, code) => page.locator('[data-rejection-row]').filter({ has: page.locator(`[data-code]:has-text("${code}")`) })
const openReport = async (page) => {
  await page.goto(`${BASE}/insurance-rules/metrics?tab=rejections`)
  await page.locator('[data-rejections-tab] [data-rejections-table]').waitFor({ timeout: 45000 })
}
const openFrom = async (page, code) => {
  await rowOf(page, code).locator('[data-open-guard-draft]').click()
  await page.locator('[data-guard-editor] [data-editor-header]').waitFor({ timeout: 30000 })
}
const noRawKeys = async (page) => !/insurance-(rules|guards|metrics):|\beditor\.\w|\brejections\.\w|\bsentence\.\w/.test(await page.locator('main').innerText())

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, store } = await open(dir)

  // ── 1: the action ────────────────────────────────────────────────────────────────────────────
  await openReport(page)
  check(`${dir} 1. a coded row offers the action`, (await rowOf(page, 'CV-4-5').locator('[data-open-guard-draft]').count()) === 1)
  const wordsRow = page.locator('[data-rejection-row]').filter({ has: page.locator('[data-words]') })
  check(`${dir} 1. a row with only words offers nothing`, (await wordsRow.count()) === 1 && (await wordsRow.locator('[data-open-guard-draft]').count()) === 0)
  check(`${dir} 1. every coded row offers it`, (await page.locator('[data-open-guard-draft]').count()) === REJECTIONS_709.filter((r) => r.code).length)
  check(`${dir} 1. no raw keys on the report`, await noRawKeys(page))

  // ── 2: filled in, nothing written ───────────────────────────────────────────────────────────
  await openFrom(page, 'CV-4-5')
  check(`${dir} 2. opens guards/new`, new URL(page.url()).pathname === '/insurance-rules/guards/new', page.url())
  check(`${dir} 2. says where it came from`, (await page.locator('[data-from-rejection]').count()) === 1)
  check(`${dir} 2. the next free id, a draft`, strip(await page.locator('[data-editor-header] [data-rule-id]').innerText()) === NEXT_ID)
  const blocks = await page.locator('[data-condition-root] [data-check]').evaluateAll((els) => els.map((e) => e.getAttribute('data-check')))
  check(`${dir} 2. a payer block and a line block`, JSON.stringify(blocks) === JSON.stringify(['request', 'line']), JSON.stringify(blocks))
  check(`${dir} 2. the payer is in the codes`, (await page.locator('[data-check="request"] [data-input="codes"]').inputValue()) === 'TAWUNIYA')
  check(`${dir} 2. the line reads the kind's list`, (await page.locator('[data-check="line"] [data-input="inList"]').inputValue()) === 'kind-E1497')
  check(`${dir} 2. the code is in the NPHIES box`, (await page.locator('[data-input="nphies"]').inputValue()) === 'CV-4-5')
  check(`${dir} 2. the name is left to the author`, (await page.locator('[data-input="name.en"]').inputValue()) === '')
  check(`${dir} 2. reads as the payer and the kind`, /TAWUNIYA/.test(await page.locator('[data-reads-as]').innerText()) && /E1497/.test(await page.locator('[data-reads-as]').innerText()))
  check(`${dir} 2. nothing is written`, store.puts.length === 0)
  check(`${dir} 2. it is unsaved`, (await page.locator('[data-unsaved]').count()) === 1)
  check(`${dir} 2. no raw keys in the editor`, await noRawKeys(page))

  // ── 3: the author saves ──────────────────────────────────────────────────────────────────────
  await page.locator('[data-input="name.en"]').fill('Tawuniya rejects E1497')
  await page.locator('[data-input="name.ar"]').fill('تكرار رفض التعاونية')
  await page.locator('[data-save]').click()
  await page.waitForURL(`**/insurance-rules/guards/${NEXT_ID}/edit`, { timeout: 15000 }).catch(() => {})
  check(`${dir} 3. Save writes once`, store.puts.length === 1, String(store.puts.length))
  const put = store.puts[0]
  const saved = put?.rules?.find((r) => r.id === NEXT_ID)
  check(`${dir} 3. the rule goes on the wire as the engine spells it`, JSON.stringify(saved?.when) === JSON.stringify([{ check: 'request', field: 'payer', anyOf: ['TAWUNIYA'] }, { check: 'line', inList: 'kind-E1497' }]), JSON.stringify(saved?.when))
  check(`${dir} 3. the code in codes.nphies, a draft`, saved?.then?.[0]?.codes?.nphies === 'CV-4-5' && saved?.state === 'draft', JSON.stringify(saved?.then?.[0]?.codes))
  const list = put?.lists?.find((l) => l.id === 'kind-E1497')
  check(`${dir} 3. the kind's list goes with it`, JSON.stringify(list?.filters?.[0]?.attributes) === JSON.stringify([{ field: 'ECode', anyOf: ['E1497'] }]), JSON.stringify(list))
  check(`${dir} 3. moves to the rule's edit URL`, new URL(page.url()).pathname === `/insurance-rules/guards/${NEXT_ID}/edit`, page.url())
  await page.locator('[data-from-rejection]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  check(`${dir} 3. the seed's note has gone`, (await page.locator('[data-from-rejection]').count()) === 0)

  // ── 4: Cancel writes nothing ─────────────────────────────────────────────────────────────────
  await openReport(page)
  await openFrom(page, 'BE-1-4')
  check(`${dir} 4. another row seeds its own code`, (await page.locator('[data-input="nphies"]').inputValue()) === 'BE-1-4')
  await page.locator('[data-cancel]').click()
  await page.locator('[data-new-guard]').waitFor({ timeout: 30000 }).catch(() => {})
  check(`${dir} 4. Cancel leaves for the list, writing nothing`, new URL(page.url()).pathname === '/insurance-rules/guards' && store.puts.length === 1, page.url())

  // ── 5: a code in the conflict shape ──────────────────────────────────────────────────────────
  await openReport(page)
  await openFrom(page, 'ER')
  check(`${dir} 5. the conflict-shaped code is in the NPHIES box`, (await page.locator('[data-input="nphies"]').inputValue()) === 'ER')
  await page.locator('[data-input="name.en"]').fill('x')
  check(`${dir} 5. the editor holds the save`, await page.locator('[data-save]').isDisabled())
  await page.locator('[data-input="nphies"]').fill('')
  await page.locator('[data-input="conflict"]').fill('ER')
  check(`${dir} 5. moved to its box, the save is free`, await page.locator('[data-save]').isEnabled())

  check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
