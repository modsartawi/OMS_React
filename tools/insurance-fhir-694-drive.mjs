// Category parameters + legacy drive (BackOffice spec 3271; oms ticket 694). STUBBED: every door is on the real
// envelope, never a live SIS.Api; 711 swaps in the live doors.
//
// In LTR and RTL:
//   1. a parameter field's Pick offers the whole workbook list, with what the census saw; nothing is stored yet;
//   2. category 66 goes into the key, on screen and in the saved document, and reads back into the picker;
//   3. a category nobody has sent can be named, and reads as never seen;
//   4. a legacy field shows its date and replacement in the catalog and on the condition, and can still be picked;
//   5. a rule on a current field shows no legacy badge, a patient fact does not read the catalog;
//   6. a denied list says so, with no key stored.
//
//   1. npx vite --port 5204 --strictPort
//   2. DRIVE_PORT=5204 node tools/insurance-fhir-694-drive.mjs
import { createRequire } from 'node:module'
import { fhirCatalogStub } from './fhir-rules-stubs-692.mjs'
import { fhirParameterStub } from './fhir-rules-stubs-694.mjs'
import { envelope, guardEditorStub, insuranceListsStub, insuranceRulesStub, newGuardStore, newListsState } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5204}`
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
      fhirParameterStub(req.method(), p, { reads, deny }) ??
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

const COPAY = '$eligibility.benefit[*].copayPct'
const REASON = '$eligibility.response.notInForceReason'
const noRawKeys = async (page) => !/insurance-(rules|fields):|\bcatalog\.[a-z]/.test(await page.locator('main').innerText())
const shownKey = (page, block) => page.locator(`[data-block="${block}"] [data-fact-key]`).getAttribute('data-fact-key')

async function newFactBlock(page) {
  await page.goto(`${BASE}/insurance-rules/guards/new`, { waitUntil: 'domcontentloaded' })
  await page.locator('[data-guard-editor] [data-editor-header]').waitFor({ timeout: 30000 })
  await page.locator('select[data-add-condition=""]').selectOption('fact')
  await page.locator('[data-block="0"] [data-catalog-open]').waitFor({ timeout: 10000 })
}
async function openCatalog(page, block) {
  await page.locator(`[data-block="${block}"] [data-catalog-open]`).click()
  const dialog = page.locator('dialog')
  await dialog.locator('[data-catalog]').waitFor({ timeout: 10000 })
  return dialog
}
const closed = (page) => page.locator('dialog').waitFor({ state: 'detached', timeout: 5000 })
async function pickCode(page, block, code) {
  const dialog = await openCatalog(page, block)
  const row = dialog.locator(`[data-catalog-row="${COPAY}"]`)
  if ((await row.locator('[data-parameter-picker]').count()) === 0) await row.locator('[data-catalog-pick]').click()
  await row.locator('[data-parameter-select]').selectOption(code)
  await row.locator('[data-parameter-use]').click()
  await closed(page)
}

for (const dir of ['ltr', 'rtl']) {
  {
    const { context, page, errors, reads, store } = await open(dir)
    await newFactBlock(page)
    check(`${dir} 5. a patient fact does not read the catalog`, !reads.catalog)
    check(`${dir} 5. and shows no legacy badge`, (await page.locator('[data-block="0"] [data-legacy]').count()) === 0)

    // ── 1: the whole list ────────────────────────────────────────────────────────────────────
    const dialog = await openCatalog(page, 0)
    check(`${dir} 1. the list is not read until a field asks for it`, !reads.parameter)
    const row = dialog.locator(`[data-catalog-row="${COPAY}"]`)
    await row.locator('[data-catalog-pick]').click()
    const select = row.locator('[data-parameter-select]')
    await select.waitFor({ timeout: 10000 })
    const options = await select.locator('option[data-seen]').evaluateAll((els) => els.map((e) => ({ code: e.value, seen: e.getAttribute('data-seen'), text: e.textContent })))
    check(`${dir} 1. every workbook code, 1 to 80`, options.length === 80 && options[0].code === '1' && options[79].code === '80', String(options.length))
    check(`${dir} 1. four the census saw, the rest offered as never seen`, options.filter((o) => o.seen === 'seen').length === 4 && options.filter((o) => o.seen === 'never').length === 76)
    const o66 = options.find((o) => o.code === '66')
    check(`${dir} 1. a seen code says how often`, /66/.test(o66.text) && /28/.test(o66.text), o66.text)
    check(`${dir} 1. nothing is stored yet`, (await dialog.count()) === 1 && (await shownKey(page, 0)) === '$patient.age')
    check(`${dir} 1. nothing to use before a code is chosen`, await row.locator('[data-parameter-use]').isDisabled())

    await select.selectOption('66')
    check(`${dir} 1. the census count is a machine isolate`, (await row.locator('[data-parameter-census="seen"] bdi[dir="ltr"]').innerText()) === '28')

    // ── 3: a never-seen code reads as such ───────────────────────────────────────────────────
    await select.selectOption('79')
    check(`${dir} 3. a never-seen code reads as such`, (await row.locator('[data-parameter-census="never"]').innerText()) === 'The census has not seen this yet')

    // ── 2: category 66 in the key ────────────────────────────────────────────────────────────
    await select.selectOption('66')
    await row.locator('[data-parameter-use]').click()
    await closed(page)
    check(`${dir} 2. the code is in the key on screen`, (await shownKey(page, 0)) === '$eligibility.benefit[66].copayPct', await shownKey(page, 0))

    const again = await openCatalog(page, 0)
    const back = again.locator(`[data-catalog-row="${COPAY}"] [data-parameter-select]`)
    await back.waitFor({ timeout: 10000 })
    check(`${dir} 2. the key reads back into the picker`, (await back.inputValue()) === '66')
    await page.keyboard.press('Escape')
    await closed(page)

    // ── 3: a rule may name a category nobody has sent ────────────────────────────────────────
    await page.locator('select[data-add-condition=""]').selectOption('fact')
    await page.locator('[data-block="1"] [data-catalog-open]').waitFor()
    await pickCode(page, 1, '79')
    check(`${dir} 3. a rule may name it`, (await shownKey(page, 1)) === '$eligibility.benefit[79].copayPct')

    // ── 4: a legacy field ────────────────────────────────────────────────────────────────────
    const catalog = await openCatalog(page, 1)
    const legacy = catalog.locator(`[data-catalog-row="${REASON}"]`)
    check(`${dir} 4. the catalog marks it legacy, with its date`, (await legacy.locator('[data-legacy]').getAttribute('data-legacy')) === '2022-04-20')
    const note = await legacy.locator('[data-legacy-note]').innerText()
    check(`${dir} 4. and its replacement`, note.includes('2022-04-20') && note.includes('response.siteEligibility'), note)
    check(`${dir} 4. a current field has no badge`, (await catalog.locator('[data-catalog-row="$claim.total"] [data-legacy]').count()) === 0)
    await legacy.locator('[data-catalog-pick]').click()
    await closed(page)
    check(`${dir} 4. it can still be picked`, (await shownKey(page, 1)) === REASON)
    const onCondition = page.locator('[data-block="1"] [data-legacy-note]')
    await onCondition.waitFor({ timeout: 10000 })
    const said = await onCondition.innerText()
    check(`${dir} 4. the condition shows its date and replacement`, said.includes('2022-04-20') && said.includes('response.siteEligibility'), said)
    check(`${dir} 5. a condition on a current field shows none`, (await page.locator('[data-block="0"] [data-legacy]').count()) === 0)

    // The saved document holds the keys.
    await page.locator('[data-input="name.en"]').first().fill('Category rule')
    await page.locator('[data-input="name.ar"]').first().fill('قاعدة الفئة')
    await page.locator('[data-save]').click()
    await page.waitForFunction(() => !document.querySelector('[data-unsaved]'), null, { timeout: 15000 }).catch(() => {})
    const saved = JSON.stringify(store.puts.at(-1)?.rules.find((r) => r.name?.en === 'Category rule')?.when)
    check(
      `${dir} 2. the saved rule holds the code`,
      saved === JSON.stringify([{ check: 'eligibility', field: 'benefit[66].copayPct', atLeast: 0 }, { check: 'eligibility', field: 'response.notInForceReason', anyOf: [], system: 'http://nphies.sa/terminology/CodeSystem/not-in-force-reason' }]),
      saved,
    )
    check(`${dir} no raw keys, no page errors`, (await noRawKeys(page)) && errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 4: on the Fields page too, with nothing to pick ────────────────────────────────────────
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules/fields`, { waitUntil: 'domcontentloaded' })
    const section = page.locator('[data-fields-catalog]')
    await section.locator('[data-catalog]').waitFor({ timeout: 30000 })
    check(`${dir} 4. the Fields page badges it too`, (await section.locator(`[data-catalog-row="${REASON}"] [data-legacy]`).count()) === 1)
    check(`${dir} 1. the Fields page reads no parameter list`, !reads.parameter && errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: denied ──────────────────────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, ['parameter'])
    await newFactBlock(page)
    const dialog = await openCatalog(page, 0)
    await dialog.locator(`[data-catalog-row="${COPAY}"] [data-catalog-pick]`).click()
    await dialog.getByText('You do not have access to the category list.').waitFor({ timeout: 10000 })
    check(`${dir} 6. a denied list says so, and stores nothing`, (await shownKey(page, 0)) === '$patient.age')
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
