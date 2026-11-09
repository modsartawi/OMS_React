// Insurance rules ▸ Aliases drive (BackOffice spec 3271 story 60, door 3294; oms ticket 704). Drives the REAL app in
// Chromium against STUBS on the real envelope (`tools/fhir-rules-stubs-704.mjs`); door 3294 is unbuilt, never a live SIS.Api.
//
// In LTR and RTL, one HQ store per pass shared by two users. `core/i18n.ts` pins `lng` to `en`, so the RTL pass flips the
// direction and the words stay English (the Arabic file is proved mirrored by `aliases/i18n-keys.test.ts`, not rendered):
//   1. the leaf, the list and "the kept bundle is never rewritten";
//   2. the form refuses empty and identical URLs and writes nothing;
//   3. nalharbi proposes TAKAFUL's misspelled UCUM URL; HQ refuses the same pair twice in its own words;
//   4. the author is told why Approve is not offered; HQ's refusal of an own approval shows its message;
//   5. falotaibi reads the pair, confirms and approves; the author sees it approved;
//   6. under RTL each URL is one ltr isolate, wrong before canonical in reading order (to the right);
//   7. a bare 403 is "no access"; no raw keys; no page errors.
//
//   1. npx vite --port 5214 --strictPort
//   2. DRIVE_PORT=5214 node tools/insurance-fhir-704-drive.mjs
import { createRequire } from 'node:module'
import { envelope, INSURER_SETTINGS } from './insurance-rules-stubs.mjs'
import { BUPA, TAKAFUL_WRONG, UCUM, aliasesStub, newAliasStore } from './fhir-rules-stubs-704.mjs'
import { granted852 } from './access-852-grants.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5214}`
const AUTHOR = 'nalharbi'
const APPROVER = 'falotaibi'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

async function open(dir, store, user, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1500, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: user, currentStoreCode: 'P001' }))
    if (p === 'InsuranceRules/Insurers') return route.fulfill(envelope(Object.values(INSURER_SETTINGS)))
    const body = req.postData() ? JSON.parse(req.postData()) : undefined
    const hit = aliasesStub(req.method(), p, body, { store, user, deny })
    if (hit) return route.fulfill(hit)
    { const g = granted852(p); if (g) return route.fulfill(envelope(g)) } // 852: the leaf's probe answers granted
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/insurance-rules/aliases`)
  return { context, page, errors }
}
const noRawKeys = async (page) => !/insurance-(rules|aliases):|\b(page|access|col|state|approve|form|problem)\.[a-zA-Z]/.test(await page.locator('main').innerText())
const toastHas = async (page, text) => {
  try {
    await page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 8000 })
    return true
  } catch {
    return false
  }
}

for (const dir of ['ltr', 'rtl']) {
  const tag = (s) => `[${dir}] ${s}`
  const store = newAliasStore()
  const a = await open(dir, store, AUTHOR)
  const { page } = a
  await page.locator('[data-alias-row="A-1"]').waitFor({ timeout: 60000 })

  // 1
  check(tag('the leaf is lit in the menu'), (await page.locator('a[href="/insurance-rules/aliases"]').count()) > 0)
  check(tag('the screen says the kept bundle is never rewritten'), (await page.locator('[data-aliases-never-rewritten]').innerText()).includes('never rewritten'))
  check(tag('the approved row reads approved, with no action'), (await page.locator('[data-alias-row="A-1"] [data-alias-approve]').count()) === 0 && (await page.locator('[data-alias-row="A-1"]').getAttribute('data-alias-state')) === 'approved')
  check(tag('an approved row names who approved it'), strip(await page.locator('[data-alias-row="A-1"] [data-alias-approved-by]').innerText()).startsWith(APPROVER))

  // 2
  const submit = page.locator('[data-alias-form-submit]')
  await submit.click()
  const problems = () => page.locator('[data-alias-form-problems] [data-problem]').evaluateAll((els) => els.map((e) => e.getAttribute('data-problem')))
  check(tag('an empty form names all three problems'), JSON.stringify(await problems()) === JSON.stringify(['payerMissing', 'wrongMissing', 'canonicalMissing']))
  await page.locator('[data-alias-form-payer]').selectOption(BUPA)
  await page.locator('[data-alias-form-wrong]').fill(UCUM)
  await page.locator('[data-alias-form-canonical]').fill(UCUM)
  await submit.click()
  check(tag('identical URLs are refused'), JSON.stringify(await problems()) === JSON.stringify(['sameUrl']))
  check(tag('a refused form writes nothing'), store.writes.length === 0)

  // 3
  await page.locator('[data-alias-form-wrong]').fill(TAKAFUL_WRONG)
  await submit.click()
  const row = page.locator('[data-alias-row="A-2"]')
  await row.waitFor({ timeout: 15000 })
  check(tag('the proposal POSTs the trimmed pair'), JSON.stringify(store.writes[0]?.body) === JSON.stringify({ payer: BUPA, wrongUrl: TAKAFUL_WRONG, canonicalUrl: UCUM }))
  check(tag('the new row is proposed, by its author'), (await row.getAttribute('data-alias-state')) === 'proposed' && strip(await row.locator('[data-alias-proposed-by]').innerText()).startsWith(AUTHOR))
  check(tag('the form clears after proposing'), (await page.locator('[data-alias-form-wrong]').inputValue()) === '')
  await page.locator('[data-alias-form-payer]').selectOption(BUPA)
  await page.locator('[data-alias-form-wrong]').fill(TAKAFUL_WRONG)
  await page.locator('[data-alias-form-canonical]').fill(UCUM)
  await submit.click()
  check(tag("HQ's refusal of the same pair shows its own words"), await toastHas(page, 'already has an alias'))
  check(tag('a refused proposal keeps what was typed'), (await page.locator('[data-alias-form-wrong]').inputValue()) === TAKAFUL_WRONG)

  // 4
  check(tag('the author is not offered Approve'), (await row.locator('[data-alias-approve]').count()) === 0)
  check(tag('the author is told why'), (await row.locator('[data-alias-why]').count()) === 1 && (await row.locator('[data-alias-why]').innerText()).length > 10)
  check(tag('no raw keys for the author'), await noRawKeys(page))
  check(tag('no page errors for the author'), a.errors.length === 0, a.errors.join(' | '))
  await a.context.close()

  // HQ decides even if the client is stale: the author appears as someone else on the client, HQ refuses by the session.
  const sneak = newAliasStore()
  sneak.rows.push({ id: 'A-9', payer: BUPA, wrongUrl: TAKAFUL_WRONG, canonicalUrl: UCUM, state: 'proposed', proposedBy: 'stale-name', proposedAt: '2026-10-30T09:00:00', approvedBy: null, approvedAt: null })
  const s = await open(dir, sneak, AUTHOR)
  await s.page.route('**/api/InsuranceRules/Aliases/A-9/Approve', (route) => route.fulfill(envelope(null, { status: 409, success: false, message: 'Someone other than the author must approve an alias.', errorCode: 'INSALIAS_SELF_APPROVAL' })))
  await s.page.locator('[data-alias-approve="A-9"]').click()
  await s.page.getByRole('dialog').getByRole('button').last().click()
  check(tag("a server refusal of an own approval shows the door's message"), await toastHas(s.page, 'Someone other than the author'))
  await s.context.close()

  // 5
  const b = await open(dir, store, APPROVER)
  const row2 = b.page.locator('[data-alias-row="A-2"]')
  await row2.waitFor({ timeout: 60000 })
  check(tag('another grant holder is offered Approve, without a why'), (await row2.locator('[data-alias-approve]').count()) === 1 && (await row2.locator('[data-alias-why]').count()) === 0)

  // 6 — the pair under the page's direction
  const wrongIso = row2.locator('[data-alias-wrong] bdi[dir="ltr"]')
  const canonIso = row2.locator('[data-alias-canonical] bdi[dir="ltr"]')
  check(tag('each URL is exactly one ltr isolate holding the whole value'), (await wrongIso.count()) === 1 && (await canonIso.count()) === 1 && (await wrongIso.innerText()) === TAKAFUL_WRONG && (await canonIso.innerText()) === UCUM)
  const wrongX = (await row2.locator('[data-alias-wrong]').boundingBox()).x
  const canonX = (await row2.locator('[data-alias-canonical]').boundingBox()).x
  check(tag('wrong comes before canonical in reading order'), dir === 'rtl' ? wrongX > canonX : wrongX < canonX, `wrong ${wrongX}, canonical ${canonX}`)
  if (dir === 'rtl') {
    check('[rtl] the document is right-to-left', (await b.page.evaluate(() => document.documentElement.dir)) === 'rtl')
  }

  await row2.locator('[data-alias-approve]').click()
  const dialog = b.page.getByRole('dialog')
  await dialog.waitFor({ timeout: 8000 })
  const raw = await dialog.innerText()
  // The wrong URL starts with the canonical one, so only the whole isolates can tell them apart.
  const wrongAt = raw.indexOf(`⁨${TAKAFUL_WRONG}⁩`)
  const canonAt = raw.indexOf(`⁨${UCUM}⁩`)
  check(tag('the confirmation isolates each URL whole, words between them'), wrongAt >= 0 && canonAt > wrongAt + TAKAFUL_WRONG.length + 2, raw)
  await dialog.getByRole('button').last().click()
  await b.page.locator('[data-alias-row="A-2"][data-alias-state="approved"]').waitFor({ timeout: 15000 })
  check(tag('the approval reads approved, naming the approver'), strip(await row2.locator('[data-alias-approved-by]').innerText()).startsWith(APPROVER))
  check(tag('the approval was written as the second user'), store.writes.at(-1)?.user === APPROVER && store.writes.at(-1)?.path.endsWith('/A-2/Approve'))
  check(tag('nothing is left to do on it'), (await row2.locator('[data-alias-approve]').count()) === 0 && (await row2.locator('[data-alias-why]').count()) === 0)
  check(tag('no raw keys for the approver'), await noRawKeys(b.page))
  check(tag('no page errors for the approver'), b.errors.length === 0, b.errors.join(' | '))
  await b.context.close()

  // 7
  const d = await open(dir, newAliasStore(), APPROVER, { deny: ['*'] })
  await d.page.locator('[data-aliases-denied]').waitFor({ timeout: 60000 })
  check(tag('a bare 403 on the list is said in words'), (await d.page.locator('[data-aliases-denied]').innerText()).length > 10 && (await noRawKeys(d.page)))
  await d.context.close()

  const denied = newAliasStore()
  const e = await open(dir, denied, AUTHOR)
  await e.page.locator('[data-alias-row="A-1"]').waitFor({ timeout: 60000 })
  await e.page.route('**/api/InsuranceRules/Aliases', (route) => (route.request().method() === 'POST' ? route.fulfill({ status: 403, body: '' }) : route.fallback()))
  await e.page.locator('[data-alias-form-payer]').selectOption(BUPA)
  await e.page.locator('[data-alias-form-wrong]').fill(TAKAFUL_WRONG)
  await e.page.locator('[data-alias-form-canonical]').fill(UCUM)
  await e.page.locator('[data-alias-form-submit]').click()
  check(tag('a reader without the grant is told in words'), await toastHas(e.page, 'insurance rules permission'))
  await e.context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
