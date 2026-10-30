// Re-pin drafts on Insurance rules ▸ Aliases (BackOffice spec 3271 stories 22, 23, door 3294; oms ticket 705). Drives the
// REAL app in Chromium against STUBS on the real envelope (`tools/fhir-rules-stubs-704.mjs` + `-705.mjs`); never a live SIS.Api.
//
// In LTR and RTL, one HQ store per pass shared by two users. `core/i18n.ts` pins `lng` to `en`, so RTL flips direction with
// English words:
//   1. a path change lists its ruleset; an alias still proposed lists nothing for it;
//   2. a second user approves the alias, and the guards ruleset appears on the list without a reload;
//   3. the author raises the draft, reads before and after and the back-test; patient keys masked; cannot approve;
//   4. the ruleset stays on the list, as pinned, until the draft is approved; HQ's refusal of an own approval shows;
//   5. another user opens the same draft, approves it, and the ruleset leaves the list;
//   6. zero changes says so and can still be approved; a running back-test offers no Approve until it finishes;
//   7. a bare 403 is words; no raw keys; no page errors.
//
//   1. npx vite --port 5215 --strictPort
//   2. DRIVE_PORT=5215 node tools/insurance-fhir-705-drive.mjs
import { createRequire } from 'node:module'
import { envelope, INSURER_SETTINGS } from './insurance-rules-stubs.mjs'
import { BUPA, TAKAFUL_WRONG, UCUM, aliasesStub, newAliasStore } from './fhir-rules-stubs-704.mjs'
import { WHOLE_KEY, WHOLE_KEY_MASKED, newRepinStore, repinStub } from './fhir-rules-stubs-705.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5215}`
const AUTHOR = 'nalharbi'
const APPROVER = 'falotaibi'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const browser = await chromium.launch()

async function open(dir, aliases, repins, user, { deny = [] } = {}) {
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
    const hit = repinStub(req.method(), p, body, { store: repins, aliases, user, deny }) ?? aliasesStub(req.method(), p, body, { store: aliases, user })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/insurance-rules/aliases`)
  await page.locator('[data-repin-list]').waitFor({ timeout: 60000 })
  return { context, page, errors }
}
const noRawKeys = async (page) => !/insurance-(rules|aliases):|\brepin\.[a-zA-Z]/.test(await page.locator('main').innerText())
const toastHas = async (page, text) => {
  try {
    await page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 8000 })
    return true
  } catch {
    return false
  }
}
const stat = async (page, key) => strip(await page.locator(`[data-repin-stat="${key}"] dd`).innerText())

for (const dir of ['ltr', 'rtl']) {
  const tag = (s) => `[${dir}] ${s}`
  const aliases = newAliasStore()
  aliases.rows.push({ id: 'A-2', payer: BUPA, wrongUrl: TAKAFUL_WRONG, canonicalUrl: UCUM, state: 'proposed', proposedBy: AUTHOR, proposedAt: '2026-10-30T09:00:00', approvedBy: null, approvedAt: null })
  const repins = newRepinStore()

  // 1 + 2 — the second user approves the alias
  const b = await open(dir, aliases, repins, APPROVER)
  const monitors = b.page.locator('[data-repin-row="monitors"]')
  await monitors.waitFor({ timeout: 30000 })
  check(tag('a changed path lists its published ruleset'), (await monitors.getAttribute('data-repin-kind')) === 'path' && strip(await monitors.innerText()).includes('copay.percent'))
  check(tag('a proposed alias lists no ruleset'), (await b.page.locator('[data-repin-row="guards"]').count()) === 0)
  await b.page.locator('[data-alias-approve="A-2"]').click()
  await b.page.getByRole('dialog').getByRole('button').last().click()
  const guardsB = b.page.locator('[data-repin-row="guards"]')
  await guardsB.waitFor({ timeout: 15000 })
  check(tag('the approved alias lists the affected ruleset, without a reload'), (await guardsB.getAttribute('data-repin-kind')) === 'alias')
  check(tag('the subject is one isolate holding the payer and wrong URL'), (await guardsB.locator('[data-repin-subject] bdi[dir="ltr"]').count()) === 1 && strip(await guardsB.locator('[data-repin-subject]').innerText()) === `${BUPA} · ${TAKAFUL_WRONG}`)
  check(tag('the ruleset name is isolated as free text'), (await guardsB.locator('bdi[data-repin-ruleset]').innerText()) === 'Guards')
  check(tag('the approval wrote no draft'), repins.writes.length === 0)
  await b.context.close()

  // 3 — the author raises the draft
  const a = await open(dir, aliases, repins, AUTHOR)
  await a.page.locator('[data-repin-raise="guards"]').click()
  const draft = a.page.locator('[data-repin-draft]')
  await draft.waitFor({ timeout: 15000 })
  check(tag('raising the draft POSTs the ruleset and the change'), JSON.stringify(repins.writes[0]?.body) === JSON.stringify({ rulesetId: 'guards', changeId: 'A-2' }))
  check(tag('the draft shows the alias before: nothing pinned'), strip(await draft.locator('[data-repin-before]').innerText()) === 'Nothing pinned')
  check(tag('the draft shows the alias after, one isolate'), (await draft.locator('[data-repin-after] bdi[dir="ltr"]').innerText()) === UCUM)
  check(tag('the draft says it runs as pinned until approved'), (await draft.locator('[data-repin-pinned]').innerText()).includes('runs as pinned'))
  check(tag('the back-test counts the bundles'), (await stat(a.page, 'bundles')) === '120' && (await stat(a.page, 'changed')) === '3' && (await stat(a.page, 'unchanged')) === '117')
  const moves = a.page.locator('[data-repin-moves] [data-repin-move]')
  check(tag('how the decisions move, the most common first'), (await moves.count()) === 2 && (await moves.first().getAttribute('data-repin-move')) === 'PASS/REFUSE' && strip(await moves.first().innerText()).replace(/\s/g, '') === 'PassesRefuses2')
  const rowText = strip(await draft.locator('[data-repin-changes]').innerText())
  check(tag('a patient key that arrives whole is masked'), !rowText.includes(WHOLE_KEY) && strip(await draft.locator('[data-repin-change="B-1"] [data-repin-patient]').innerText()) === WHOLE_KEY_MASKED)
  check(tag('the author is not offered Approve, and is told why'), (await a.page.locator('[data-repin-approve]').count()) === 0 && (await a.page.locator('[data-repin-why]').innerText()).includes('someone else'))
  if (dir === 'rtl') {
    check('[rtl] the document is right-to-left', (await a.page.evaluate(() => document.documentElement.dir)) === 'rtl')
    const beforeX = (await draft.locator('[data-repin-moves] thead th').nth(0).boundingBox()).x
    const afterX = (await draft.locator('[data-repin-moves] thead th').nth(1).boundingBox()).x
    check('[rtl] before reads ahead of after (to the right)', beforeX > afterX, `before ${beforeX}, after ${afterX}`)
  }
  check(tag('no raw keys in the draft'), !/\brepin\.[a-zA-Z]/.test(await draft.innerText()))
  await a.page.locator('[data-repin-close]').click()

  // 4 — still pinned; HQ refuses an own approval even when the client is stale
  const guardsA = a.page.locator('[data-repin-row="guards"]')
  check(tag('the ruleset stays on the list until approved, with its open draft'), (await guardsA.locator('[data-repin-open]').count()) === 1 && repins.done.length === 0)
  check(tag('no page errors for the author'), a.errors.length === 0, a.errors.join(' | '))
  await a.context.close()

  const stale = newRepinStore()
  const staleAliases = newAliasStore()
  const s = await open(dir, staleAliases, stale, APPROVER)
  await s.page.locator('[data-repin-raise="monitors"]').click()
  await s.page.locator('[data-repin-draft]').waitFor({ timeout: 15000 })
  await s.page.route('**/api/InsuranceRules/RepinDrafts/D-1', (route) => route.fulfill(envelope({ ...stale.drafts[0], createdBy: 'stale-name' })))
  await s.page.locator('[data-repin-close]').click()
  await s.page.locator('[data-repin-open="monitors"]').click()
  await s.page.locator('[data-repin-approve]').waitFor({ timeout: 15000 })
  await s.page.locator('[data-repin-approve]').click()
  check(tag("HQ's refusal of an own approval shows its message"), await toastHas(s.page, 'Someone other than the author'))
  check(tag('a refused approval moves nothing'), stale.done.length === 0 && (await s.page.locator('[data-repin-draft]').count()) === 1)
  await s.context.close()

  // 5 — another user opens the same draft and approves
  const c = await open(dir, aliases, repins, APPROVER)
  await c.page.locator('[data-repin-open="guards"]').click()
  await c.page.locator('[data-repin-backtest]').waitFor({ timeout: 15000 })
  check(tag('the approver reads the same back-test'), (await stat(c.page, 'changed')) === '3')
  check(tag('the approver sees who raised it'), strip(await c.page.locator('[data-repin-raised-by]').innerText()).startsWith(AUTHOR))
  await c.page.locator('[data-repin-approve]').click()
  await c.page.locator('[data-repin-row="guards"]').waitFor({ state: 'detached', timeout: 15000 })
  check(tag('approving writes as the second user'), repins.writes.at(-1)?.user === APPROVER && repins.writes.at(-1)?.path === 'InsuranceRules/RepinDrafts/D-1/Approve')
  check(tag('the approved ruleset leaves the list; the other stays'), (await c.page.locator('[data-repin-row="monitors"]').count()) === 1)
  check(tag('the draft closes after approving'), (await c.page.locator('[data-repin-draft]').count()) === 0)
  check(tag('no raw keys for the approver'), await noRawKeys(c.page))
  check(tag('no page errors for the approver'), c.errors.length === 0, c.errors.join(' | '))
  await c.context.close()

  // 6 — zero changes, and a running back-test
  const zero = newRepinStore({ noChange: true, polls: 2 })
  const z = await open(dir, newAliasStore(), zero, AUTHOR)
  await z.page.locator('[data-repin-raise="monitors"]').click()
  await z.page.locator('[data-repin-why]').waitFor({ timeout: 15000 })
  check(tag('while the back-test runs, no Approve, and it says so'), (await z.page.locator('[data-repin-approve]').count()) === 0 && (await z.page.locator('[data-repin-why]').innerText()).includes('finished'))
  await z.page.locator('[data-repin-no-change]').waitFor({ timeout: 15000 })
  check(tag('the running back-test finishes by itself'), (await stat(z.page, 'bundles')) === '120')
  check(tag('zero changes is said in words, with no tables'), (await z.page.locator('[data-repin-no-change]').innerText()).includes('No decision') && (await z.page.locator('[data-repin-moves], [data-repin-changes]').count()) === 0)
  check(tag('zero changes counts every bundle as staying'), (await stat(z.page, 'changed')) === '0' && (await stat(z.page, 'unchanged')) === '120')
  await z.context.close()
  const y = await open(dir, newAliasStore(), zero, APPROVER)
  await y.page.locator('[data-repin-open="monitors"]').click()
  await y.page.locator('[data-repin-approve]').waitFor({ timeout: 15000 })
  check(tag('a zero-change draft can still be approved, by another user'), (await y.page.locator('[data-repin-approve]').count()) === 1)
  await y.context.close()

  // 7 — no access
  const d = await open(dir, newAliasStore(), newRepinStore(), APPROVER, { deny: ['*'] })
  await d.page.locator('[data-repin-denied]').waitFor({ timeout: 30000 })
  check(tag('a bare 403 on the list is said in words'), (await d.page.locator('[data-repin-denied]').innerText()).length > 10 && (await noRawKeys(d.page)))
  await d.context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass).length
console.log(`\n${results.length - failed}/${results.length} passed`)
process.exit(failed ? 1 : 0)
