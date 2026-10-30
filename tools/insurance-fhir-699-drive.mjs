// Monitor rules on the guard list and builder (BackOffice spec 3271, doors 3290 / 3292; oms ticket 699).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/fhir-rules-stubs-699.mjs`): never a live SIS.Api.
// In LTR and RTL: the list says a monitor never touches a sale and offers a new one; the editor offers info / action and EN + AR
// text and none of the guard's till effects; a "reissue cut the approved quantity" monitor is built, saved, reopened and read;
// a guard on the same screens still gets its own effects and no $previous key.
//
//   1. npx vite --port 5209 --strictPort
//   2. DRIVE_PORT=5209 node tools/insurance-fhir-699-drive.mjs
import { createRequire } from 'node:module'
import { envelope, guardEditorStub, insuranceRulesStub, newGuardStore } from './insurance-rules-stubs.mjs'
import { monitorStub } from './fhir-rules-stubs-699.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5209}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const browser = await chromium.launch()
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)
const CUT = 'line.claimResponse.approvedQuantity < previous.line.claimResponse.approvedQuantity'

for (const dir of ['ltr', 'rtl']) {
  const context = await browser.newContext({ viewport: { width: 1700, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newGuardStore()
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.addInitScript((d) => {
    localStorage.setItem('oms.locale', d === 'rtl' ? 'ar' : 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  }, dir)
  await context.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const p = url.pathname.replace(/^\/api\//, '')
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    const body = req.method() === 'GET' ? null : req.postDataJSON()
    const hit = monitorStub(req.method(), p, store) ?? guardEditorStub(req.method(), p, body, { store, reads: {} }) ?? insuranceRulesStub(req.method(), p, body, {})
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })

  // ── the list ──────────────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards`)
  await page.locator('[data-guards-grid] .ag-row').first().waitFor({ timeout: 60000 })
  check(`${dir} the list says a monitor never touches a sale`, (await page.locator('[data-monitor-never]').count()) === 1)
  check(`${dir} the list offers a new guard and a new monitor`, (await page.locator('[data-new-guard]').count()) === 1 && (await page.locator('[data-new-monitor]').count()) === 1)
  const kinds = await page.locator('[data-guards-grid] .ag-row [col-id="kind"]').allInnerTexts()
  // RTL is direction only (692's finding: `lng` stays `en`); the Arabic words are proved in monitor.test.ts.
  const guardWord = 'Guard'
  check(`${dir} a rule without a kind lists as a guard`, kinds.length > 0 && kinds.every((k) => k.trim() === guardWord), kinds.join())

  // ── what the editor offers ────────────────────────────────────────────────────────────────────
  await page.locator('[data-new-monitor]').click()
  await page.locator('[data-editor-header]').waitFor({ timeout: 60000 })
  check(`${dir} the editor takes the next monitor id`, (await page.locator('[data-editor-header] [data-rule-id]').innerText()).includes('M-001'))
  check(`${dir} the editor says a monitor never touches a sale`, (await page.locator('[data-editor-header] [data-monitor-never]').count()) === 1)
  check(`${dir} the scope is the claim response`, (await page.locator('[data-monitor-scope="claimResponse"]').count()) === 1)
  const picks = await page.locator('[data-editor-then] [data-severity-pick]').evaluateAll((e) => e.map((x) => x.getAttribute('data-severity-pick')))
  check(`${dir} severity is info and action only`, same(picks, ['info', 'action']), picks.join())
  const none = async (hook) => (await page.locator(hook).count()) === 0
  check(`${dir} no codes`, await none('[data-codes-editor]'))
  check(`${dir} no suggestion to the pharmacist`, await none('[data-suggest-editor]'))
  check(`${dir} no pharmacist placeholders`, await none('[data-placeholders]'))
  check(`${dir} no channel, store or window`, await none('[data-audience-editor]'))
  check(`${dir} no warn-on-unknown; it says what unknown does`, (await none('[data-on-unknown-editor]')) && (await page.locator('[data-monitor-unknown]').count()) === 1)
  check(`${dir} EN and AR text are offered`, (await page.locator('[data-input="says.en"]').count()) === 1 && (await page.locator('[data-input="says.ar"]').count()) === 1)
  const palette = await page.locator('select[data-add-condition=""] option').evaluateAll((e) => e.map((x) => x.value).filter(Boolean))
  check(`${dir} the palette has only what an answer can answer`, same(palette, ['history', 'fact', 'formula', 'group']), palette.join())

  // ── the last use stays ────────────────────────────────────────────────────────────────────────
  const use = (u) => page.locator(`[data-monitor-use="${u}"]`)
  await use('claim').click()
  await use('preauthorization').click()
  check(`${dir} the last use cannot be turned off`, (await use('preauthorization').getAttribute('aria-pressed')) === 'true')

  // ── the catalog ───────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-input="name.en"]').fill('Reissue cut the approved quantity')
  await page.locator('[data-input="name.ar"]').fill('خفضت إعادة الإصدار الكمية الموافق عليها')
  await page.locator('select[data-add-condition=""]').selectOption('fact')
  const fact = page.locator('[data-block="0"]')
  check(`${dir} a fact starts on the answer, with no till fact to choose`, (await fact.locator('[data-fact-key="$claimResponse.outcome"]').count()) === 1 && (await fact.locator('[data-input="fact"]').count()) === 0)
  await fact.locator('[data-catalog-open]').click()
  await page.locator('[data-catalog]').waitFor()
  const messages = await page.locator('[data-catalog-message]').evaluateAll((e) => e.map((x) => x.getAttribute('data-catalog-message')))
  check(`${dir} the catalog offers the answer and the answer before, nothing else`, same(messages, ['claimResponse', 'previous']), messages.join())
  check(`${dir} a $previous key is offered`, (await page.locator('[data-catalog-row="$previous.line.claimResponse.approvedQuantity"]').count()) === 1)
  await page.locator('[data-catalog-row="$claimResponse.reissue.reason"] [data-catalog-pick]').click()
  check(`${dir} the reissue reason can be picked`, (await fact.locator('[data-fact-key="$claimResponse.reissue.reason"]').count()) === 1)

  // ── the formula ───────────────────────────────────────────────────────────────────────────────
  await page.locator('select[data-add-condition=""]').selectOption('formula')
  const formula = page.locator('[data-block="1"]')
  await formula.locator('[data-fx-toggle]').click()
  const fx = formula.locator('[data-fx-helper]')
  check(`${dir} ƒx offers the $previous path`, (await fx.locator('[data-fx-item="previous.line.claimResponse.approvedQuantity"]').count()) === 1)
  check(`${dir} ƒx offers no till fact`, (await fx.locator('[data-fx-item="line.price"]').count()) === 0)
  await fx.locator('[data-fx-tab="recipes"]').click()
  await fx.locator('[data-fx-use="cutQuantity"]').click()
  check(`${dir} the recipe writes the comparison, and it reads`, (await formula.locator('[data-input="formula"]').inputValue()) === CUT && (await formula.locator('[data-fx-status="ok"]').count()) === 1)

  // ── save ──────────────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-editor-then] [data-severity-pick="action"]').click()
  await page.locator('[data-input="says.en"]').fill('The reissue cut the approved quantity')
  await page.locator('[data-input="says.ar"]').fill('خفضت إعادة الإصدار الكمية الموافق عليها')
  await page.locator('[data-save]').click()
  await page.waitForURL('**/insurance-rules/guards/M-001/edit', { timeout: 30000 })
  const put = store.puts?.at?.(-1) ?? store.draft
  const saved = (put.rules ?? []).find((r) => r.id === 'M-001')
  check(`${dir} saved with its kind, scope and use`, saved?.kind === 'monitor' && saved?.scope === 'claimResponse' && same(saved?.uses, ['preauthorization']), JSON.stringify(saved))
  check(`${dir} saved with only a review item`, same(saved?.then, [{ effect: 'reviewItem', severity: 'action', says: { en: 'The reissue cut the approved quantity', ar: 'خفضت إعادة الإصدار الكمية الموافق عليها' } }]), JSON.stringify(saved?.then))
  check(`${dir} saved with no audience and no onUnknown`, saved && !('audience' in saved) && !('onUnknown' in saved))
  check(`${dir} the wire reads the fact and the compare`, saved?.when?.[0]?.check === 'claimResponse' && saved?.when?.[0]?.field === 'reissue.reason' && same(saved?.when?.[1]?.expr, ['<', '$line.claimResponse.approvedQuantity', '$previous.line.claimResponse.approvedQuantity']), JSON.stringify(saved?.when))

  // ── reopen and read ───────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/M-001/edit`)
  await page.locator('[data-editor-header]').waitFor({ timeout: 60000 })
  check(`${dir} reopened on the monitor builder`, (await page.locator('[data-monitor-effect]').count()) === 1 && (await page.locator('[data-effect-editor]').count()) === 0)
  check(`${dir} reopened with its formula, severity and use`, (await page.locator('[data-block="1"] [data-input="formula"]').inputValue()) === CUT && (await page.locator('[data-severity-pick="action"]').getAttribute('aria-pressed')) === 'true' && (await use('claim').getAttribute('aria-pressed')) === 'false')

  await page.goto(`${BASE}/insurance-rules/guards/M-001`)
  await page.locator('[data-rule-header]').waitFor({ timeout: 60000 })
  const when = await page.locator('[data-block-when]').innerText()
  check(`${dir} it reads which answers it watches`, /pre-authorization|موافقة مسبقة/.test(when) && !/claim\b|مطالبة/.test(when), when)
  const then = await page.locator('[data-block-then]').innerText()
  check(`${dir} it reads as a review item`, /review list|قائمة المراجعة/.test(then) && (await page.locator('[data-block-then] [data-severity="action"]').count()) === 1, then)
  check(`${dir} the rule page says it never touches a sale`, (await page.locator('[data-rule-header] [data-monitor-never]').count()) === 1)
  check(`${dir} no codes or suggestion read`, (await page.locator('[data-codes],[data-suggest]').count()) === 0)
  check(`${dir} no playground and no template, which would make a guard`, (await page.locator('[data-save-template]').count()) === 0 && !/playground|الملعب/i.test(await page.locator('[data-rule-header]').innerText()))
  check(`${dir} no raw key on the page`, !/\b(sentence|monitor|editor)\.[a-zA-Z]/.test(await page.locator('main').innerText()))

  await page.goto(`${BASE}/insurance-rules/guards`)
  await page.locator('[data-guards-grid] .ag-row').first().waitFor({ timeout: 60000 })
  const row = page.locator('[data-guards-grid] .ag-row[row-id="M-001"]')
  check(`${dir} the list shows it beside the guards, by its kind and severity`, (await row.locator('[col-id="kind"]').innerText()).trim() === 'Monitor' && (await row.locator('[data-severity="action"]').count()) === 1)

  // ── a guard stays a guard ─────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/new`)
  await page.locator('[data-editor-header]').waitFor({ timeout: 60000 })
  const guardPicks = await page.locator('[data-editor-then] [data-severity-pick]').evaluateAll((e) => e.map((x) => x.getAttribute('data-severity-pick')))
  check(`${dir} a guard offers no monitor severity`, same(guardPicks, ['REFUSE', 'OVERRIDE', 'WARN']), guardPicks.join())
  check(`${dir} a guard keeps its codes, suggestion, audience and unknown rule`, (await page.locator('[data-codes-editor]').count()) === 1 && (await page.locator('[data-suggest-editor]').count()) === 1 && (await page.locator('[data-audience-editor]').count()) === 1 && (await page.locator('[data-on-unknown-editor]').count()) === 1)
  check(`${dir} a guard is not told it never touches a sale`, (await page.locator('[data-monitor-never]').count()) === 0)
  await page.locator('select[data-add-condition=""]').selectOption('fact')
  await page.locator('[data-block="0"] [data-catalog-open]').click()
  await page.locator('[data-catalog]').waitFor()
  check(`${dir} a guard is offered no $previous key and no reissue reason`, (await page.locator('[data-catalog-row^="$previous"]').count()) === 0 && (await page.locator('[data-catalog-row="$claimResponse.reissue.reason"]').count()) === 0 && (await page.locator('[data-catalog-message="previous"]').count()) === 0)

  check(`${dir} no page error`, errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
