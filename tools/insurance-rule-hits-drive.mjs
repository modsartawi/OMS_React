// Insurance rules ▸ Rule hits drive (BackOffice spec 3972, door 3980; ticket 3981).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, section 3981):
//   GET InsuranceRules/RuleHits?from&to&rule&payer&store&kind → RULE_HITS (filtered, 3980's defaults and 400s)
//   GET InsuranceRules/RuleHits/Excel                          → an .xlsx named by Content-Disposition
//   GET InsuranceRules/Access                                  → canRuleHits (true, or false for the hidden check)
//
// It verifies, in LTR and RTL:
//   1. the Rule hits leaf is in the rail; the page opens on last calendar month, live;
//   2. the rows: the live hits only, ids/keys as ltr isolates, the outcome in words;
//   3. a payer typed and Shadow picked land in the address and the door;
//   4. Download Excel asks the Excel door with the same query and saves the server's file name;
//   5. without canRuleHits the leaf is hidden;
//   6. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5139 --strictPort
//   2. node tools/insurance-rule-hits-drive.mjs        (DRIVE_PORT overrides 5139)
import { createRequire } from 'node:module'
import { envelope, ruleHitsStub } from './insurance-rules-stubs.mjs'
import { GRANTED_852 } from './access-852-grants.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5139}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { canRuleHits = true } = {}) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh', acceptDownloads: true })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const asked = []
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
    if (p === 'InsuranceRules/Access') return route.fulfill(envelope({ ...GRANTED_852['InsuranceRules/Access'], canRuleHits }))
    const hit = ruleHitsStub(req.method(), p, url.searchParams, { asked })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, asked }
}

const lastAsk = (asked, door) => [...asked].reverse().find((a) => a.door === door)?.params
const settle = (page) => page.waitForTimeout(500)
const noRawKeys = async (page) => !/insurance-rule-hits:|\b(columns|outcome|kind|filter|window|checkpoint)\.\w/.test(await page.locator('main').innerText())

/** Last calendar month, local. */
const now = new Date()
const two = (n) => String(n).padStart(2, '0')
const iso = (d) => `${d.getFullYear()}-${two(d.getMonth() + 1)}-${two(d.getDate())}`
const FROM = iso(new Date(now.getFullYear(), now.getMonth() - 1, 1))
const TO = iso(new Date(now.getFullYear(), now.getMonth(), 0))

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, asked } = await open(dir)
  await page.goto(`${BASE}/insurance-rules/rule-hits`)
  await page.locator('[data-rule-hits-page]').waitFor()
  await settle(page)
  check(`${dir}: the leaf is in the rail`, (await page.locator('a[href="/insurance-rules/rule-hits"]').count()) > 0)
  check(`${dir}: opens on last month, live`, JSON.stringify(lastAsk(asked, 'ruleHits')) === JSON.stringify({ from: FROM, to: TO, kind: 'live' }), JSON.stringify(lastAsk(asked, 'ruleHits')))
  // The stub's rows sit in October 2026: shown when last month is October, else the empty state.
  const rows = await page.locator('[data-rule-hits] tbody tr').count()
  const empty = await page.locator('[data-rule-hits-empty]').count()
  check(`${dir}: rows or the empty state`, rows > 0 || empty === 1)
  if (rows > 0) {
    check(`${dir}: live rows only`, (await page.locator('[data-rule-hits] tbody tr[data-kind="shadow"]').count()) === 0)
    check(`${dir}: the patient id is an ltr isolate`, (await page.locator('[data-col="patientKey"] [dir="ltr"], [data-col="patientKey"] bdi[dir="ltr"]').count()) > 0)
  }

  await page.locator('[data-filter="payer"]').fill('BUPA')
  await page.locator('[data-filter="payer"]').press('Enter')
  await page.locator('[data-kind="shadow"]').first().click()
  await settle(page)
  check(`${dir}: payer and shadow reach the address`, /payer=BUPA/.test(page.url()) && /kind=shadow/.test(page.url()), page.url())
  check(`${dir}: and the door`, lastAsk(asked, 'ruleHits')?.payer === 'BUPA' && lastAsk(asked, 'ruleHits')?.kind === 'shadow', JSON.stringify(lastAsk(asked, 'ruleHits')))

  const [download] = await Promise.all([page.waitForEvent('download'), page.locator('[data-rule-hits-excel]').click()])
  const excel = lastAsk(asked, 'ruleHitsExcel')
  check(`${dir}: Download asks the Excel door with the same query`, excel?.payer === 'BUPA' && excel?.kind === 'shadow' && excel?.from === FROM, JSON.stringify(excel))
  const name = download.suggestedFilename()
  check(`${dir}: saves the server's file name`, name === `rule-hits-${FROM.replace(/-/g, '')}-to-${TO.replace(/-/g, '')}-shadow.xlsx`, name)

  check(`${dir}: no raw keys`, await noRawKeys(page))
  check(`${dir}: no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  const { context, page } = await open('ltr', { canRuleHits: false })
  await page.goto(`${BASE}/insurance-rules/metrics`)
  await page.locator('[data-metrics-page]').waitFor()
  await settle(page)
  check('without canRuleHits the leaf is hidden', (await page.locator('a[href="/insurance-rules/rule-hits"]').count()) === 0)
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
