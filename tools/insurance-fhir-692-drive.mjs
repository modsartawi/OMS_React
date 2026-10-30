// FHIR catalog drive (BackOffice spec 3271; oms ticket 692). STUBBED: every door here is on the real envelope, never
// a live SIS.Api; 711 swaps in the live doors.
//
// In LTR and RTL:
//   1. a condition's fact opens the catalog, grouped by message then level; each row shows EN + AR, type, channel dots;
//   2. the FHIRPath opens on demand and its value is a machine isolate; a line field shows no sequence number;
//   3. a line field, a message field and a phase-1 field each store their key, on screen and in the saved document;
//   4. a parameterised field cannot store a key with no code;
//   5. a phase-1 rule opens and saves with its key unchanged;
//   6. the Fields page lists the same catalog, with nothing to pick;
//   7. a denied catalog says so, and no raw keys or page errors.
//
//   1. npx vite --port 5202 --strictPort
//   2. DRIVE_PORT=5202 node tools/insurance-fhir-692-drive.mjs
import { createRequire } from 'node:module'
import { FHIR_CATALOG, fhirCatalogStub } from './fhir-rules-stubs-692.mjs'
import { RULES, envelope, guardEditorStub, insuranceListsStub, insuranceRulesStub, newGuardStore, newListsState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5202}`
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass: !!pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, deny = []) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const store = newGuardStore()
  const registry = newListsState()
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
    let body = null
    try {
      body = req.postDataJSON()
    } catch {
      body = null
    }
    const hit =
      fhirCatalogStub(req.method(), p, { reads, deny }) ??
      guardEditorStub(req.method(), p, body, { store, reads }) ??
      insuranceListsStub(req.method(), p, body, { state: registry, query: new URL(req.url()).searchParams }) ??
      insuranceRulesStub(req.method(), p, body, { reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, store }
}

const noRawKeys = async (page) => !/insurance-(rules|fields):|\bcatalog\.[a-z]/.test(await page.locator('main').innerText())
const catalogRow = (scope, key) => scope.locator(`[data-catalog-row="${key}"]`)
const add = (page, parent, check) => page.locator(`select[data-add-condition="${parent}"]`).selectOption(check)

/** Opens a new guard with one fact block, and the block's catalog. */
async function newFactBlock(page) {
  await page.goto(`${BASE}/insurance-rules/guards/new`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-guard-editor] [data-editor-header]').waitFor({ timeout: 30000 })
  await add(page, '', 'fact')
  await page.locator('[data-block="0"] [data-catalog-open]').waitFor({ timeout: 10000 })
}
const pick = async (page, block, key) => {
  await page.locator(`[data-block="${block}"] [data-catalog-open]`).click()
  await page.locator('dialog [data-catalog]').waitFor({ timeout: 10000 })
  await catalogRow(page.locator('dialog'), key).locator('[data-catalog-pick]').click()
  await page.locator('dialog').waitFor({ state: 'detached', timeout: 5000 })
}
const shownKey = (page, block) => page.locator(`[data-block="${block}"] [data-fact-key]`).getAttribute('data-fact-key')

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads, store } = await open(dir)
    await newFactBlock(page)
    check(`${dir} 0. the catalog is not read until it is opened`, !reads.catalog)

    // ── 1: the catalog ───────────────────────────────────────────────────────────────────────
    await page.locator('[data-block="0"] [data-catalog-open]').click()
    const dialog = page.locator('dialog')
    await dialog.locator('[data-catalog]').waitFor({ timeout: 10000 })
    const messages = await dialog.locator('[data-catalog-message]').evaluateAll((els) => els.map((e) => e.getAttribute('data-catalog-message')))
    check(`${dir} 1. grouped by message`, JSON.stringify(messages) === JSON.stringify(['eligibility', 'claim', 'claimResponse']), JSON.stringify(messages))
    const claimLevels = await dialog.locator('[data-catalog-message="claim"] [data-catalog-level]').evaluateAll((els) => els.map((e) => e.getAttribute('data-catalog-level')))
    check(`${dir} 1. message-level then line-level`, JSON.stringify(claimLevels) === JSON.stringify(['message', 'line']), JSON.stringify(claimLevels))
    check(`${dir} 1. every field is listed`, (await dialog.locator('[data-catalog-row]').count()) === FHIR_CATALOG.length)

    const copay = catalogRow(dialog, '$line.claimResponse.copay')
    check(`${dir} 1. line copay sits under the claim response's lines`, (await dialog.locator('[data-catalog-message="claimResponse"] [data-catalog-level="line"] [data-catalog-row="$line.claimResponse.copay"]').count()) === 1)
    check(`${dir} 1. its EN and AR labels`, (await copay.locator('[data-says-en]').innerText()) === 'Line copay' && (await copay.locator('[data-says-ar]').innerText()) === 'تحمل البند')
    check(`${dir} 1. its type`, (await copay.locator('[data-catalog-type]').getAttribute('data-catalog-type')) === 'money')
    const dots = await copay.locator('[data-channel]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-channel')}:${e.querySelector('[data-answer]').getAttribute('data-answer')}`))
    check(`${dir} 1. a dot per channel`, JSON.stringify(dots) === JSON.stringify(['nphies:sometimes', 'bupa:never', 'waseel:sometimes', 'oms:never']), JSON.stringify(dots))
    const word = await copay.locator('[data-channel="bupa"] [data-answer]').getAttribute('aria-label')
    // The app renders English under either direction (`core/i18n.ts` holds `lng: 'en'`), so `ar` here is the RTL layout
    // and the catalog's Arabic labels from data; the `ar` chrome keys are proved mirrored in `fhir-catalog.test.ts`.
    check(`${dir} 1. a dot says it in words`, word === 'Never answers', word)
    check(`${dir} 1. the page runs in its direction`, (await page.locator('html').getAttribute('dir')) === dir)
    check(`${dir} 1. the key is a machine isolate`, (await copay.locator('[data-catalog-key] bdi[dir="ltr"]').innerText()) === '$line.claimResponse.copay')

    // ── 2: the FHIRPath, on demand ───────────────────────────────────────────────────────────
    check(`${dir} 2. the FHIRPath is hidden first`, (await copay.locator('[data-catalog-path]').count()) === 0)
    await copay.locator('[data-catalog-path-toggle]').click()
    const shown = await copay.locator('[data-catalog-path] bdi[dir="ltr"]').first().innerText()
    check(`${dir} 2. it opens on demand, reading copay`, shown === "adjudication.where(category.coding.code = 'copay').amount", shown)
    check(`${dir} 2. a line field names no sequence`, !/sequence/i.test(await dialog.locator('[data-catalog-level="line"]').first().innerText()))
    await copay.locator('[data-catalog-path-toggle]').click()
    check(`${dir} 2. and closes`, (await copay.locator('[data-catalog-path]').count()) === 0)

    // ── 4: a parameterised field ─────────────────────────────────────────────────────────────
    const param = catalogRow(dialog, '$eligibility.benefit[*].copayPct').locator('[data-catalog-pick]')
    // 694 lifted the block: Pick now opens the category list (its own drive), and still stores nothing by itself.
    await param.click()
    check(`${dir} 4. a field needing a category stores nothing`, (await param.getAttribute('aria-expanded')) === 'true' && (await dialog.count()) === 1)
    await page.keyboard.press('Escape')
    await dialog.waitFor({ state: 'detached', timeout: 5000 })

    // ── 3: picks store their keys ────────────────────────────────────────────────────────────
    await pick(page, 0, '$line.claim.quantity')
    check(`${dir} 3. a claim line field's key`, (await shownKey(page, 0)) === '$line.claim.quantity')
    await add(page, '', 'fact')
    await page.locator('[data-block="1"] [data-catalog-open]').waitFor()
    await pick(page, 1, '$line.claimResponse.copay')
    check(`${dir} 3. a claim response line field's key`, (await shownKey(page, 1)) === '$line.claimResponse.copay')
    await add(page, '', 'fact')
    await page.locator('[data-block="2"] [data-catalog-open]').waitFor()
    await pick(page, 2, '$claim.hasAttachment')
    check(`${dir} 3. a message field's key`, (await shownKey(page, 2)) === '$claim.hasAttachment')
    await add(page, '', 'fact')
    await page.locator('[data-block="3"] [data-catalog-open]').waitFor()
    await pick(page, 3, '$eligibility.coverage.class')
    check(`${dir} 3. a phase-1 field's key`, (await shownKey(page, 3)) === '$eligibility.coverage.class')

    await page.locator('[data-input="name.en"]').first().fill('Catalog rule')
    await page.locator('[data-input="name.ar"]').first().fill('قاعدة الدليل')
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 15000 }).catch(() => {})
    const saved = store.puts.at(-1)?.rules.find((r) => r.name?.en === 'Catalog rule')
    const when = JSON.stringify(saved?.when)
    check(
      `${dir} 3. the saved rule holds each key`,
      when === JSON.stringify([{ check: 'line', field: 'claim.quantity', atLeast: 0 }, { check: 'line', field: 'claimResponse.copay', atLeast: 0 }, { check: 'claim', field: 'hasAttachment', anyOf: [] }, { check: 'eligibility', field: 'coverage.class', anyOf: [] }]),
      when,
    )
    check(`${dir} 7. no raw keys in the editor, no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 5: a phase-1 rule ──────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, store } = await open(dir)
    const phase1 = { check: 'eligibility', field: 'benefit.genericCopayPct', atLeast: 20 }
    const target = store.draft.rules.find((r) => r.id === RULES[0].id)
    target.when = [phase1]
    await page.goto(`${BASE}/insurance-rules/guards/${encodeURIComponent(target.id)}/edit`, { waitUntil: 'domcontentloaded' })
    await page.locator('[data-block="0"] [data-fact-key]').waitFor({ timeout: 30000 })
    check(`${dir} 5. a phase-1 rule opens on its key`, (await shownKey(page, 0)) === '$eligibility.benefit.genericCopayPct')
    await page.locator('[data-input="name.en"]').first().fill('Phase one, renamed')
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 15000 }).catch(() => {})
    const after = JSON.stringify(store.puts.at(-1)?.rules.find((r) => r.id === target.id)?.when)
    check(`${dir} 5. and saves with its key unchanged`, after === JSON.stringify([phase1]), after)
    check(`${dir} 5. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: the Fields page ─────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/fields`, { waitUntil: 'domcontentloaded' })
    const section = page.locator('[data-fields-catalog]')
    await section.locator('[data-catalog]').waitFor({ timeout: 30000 })
    check(`${dir} 6. the Fields page lists the same catalog`, (await section.locator('[data-catalog-row]').count()) === FHIR_CATALOG.length)
    check(`${dir} 6. nothing to pick there`, (await section.locator('[data-catalog-pick]').count()) === 0)
    await catalogRow(section, '$claim.total').locator('[data-catalog-path-toggle]').click()
    check(`${dir} 6. its FHIRPath opens there too`, (await catalogRow(section, '$claim.total').locator('[data-catalog-path] bdi').first().innerText()) === 'total')
    check(`${dir} 7. no raw keys on the page, no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 7: denied ──────────────────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, ['catalog'])
    await page.goto(`${BASE}/insurance-rules/fields`, { waitUntil: 'domcontentloaded' })
    const section = page.locator('[data-fields-catalog]')
    await section.getByText('You do not have access to the FHIR fact catalog.').waitFor({ timeout: 30000 })
    check(`${dir} 7. a denied catalog says so, and the rest of the page stands`, (await page.locator('[data-fields-scope="item"]').count()) === 1)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
