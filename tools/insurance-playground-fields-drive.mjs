// Insurance rules ▸ Playground — registry and scratch fields in a formula (BackOffice spec 3243, ADR 0117; oms ticket 681).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/insurance-rules-stubs.mjs`, sections
// 677 + 681): `playgroundStub` answers Evaluate; `playgroundFieldsStub` serves `GET InsuranceRules/Fields` and counts
// any write to the registry. 🚩 Nothing here is driven against a live SIS.Api (ticket 691).
//
// It verifies, in LTR and RTL:
//   1. a guard rule with a formula block shows the real formula box, and a Fields button with no fields declared;
//   2. the Fields drawer lists the live registry fields a formula reads as a field (item → line.field.*, request,
//      patient; not a retired one, not an eligibility fact); picking one declares it as registry;
//   3. a scratch field is declared (key, scope, type); a duplicate key and an unreadable key are refused in the drawer;
//      one is removed again; the JSON's `fields` holds exactly the two, `{ key, scope, type }`;
//   4. nothing is ever written to the registry;
//   5. ƒx in the formula block offers both fields (inserted as <scope>.field.<Key>, each with its type) and
//      request.lines; inserting them writes `$line.field.*` into the rule's `expr`;
//   6. Functions offer lines / filter / sum / count; the cross-line recipe writes its formula and the expr;
//   7. `eligibility.field.X` is refused in words (badField), with no raw key;
//   8. no raw keys and no page errors.
// The real guard editor's ƒx is unchanged: tools/insurance-guard-editor-drive.mjs stays green.
//
//   1. run the app:  npx vite --port 5381 --strictPort
//   2. node tools/insurance-playground-fields-drive.mjs        (DRIVE_PORT overrides 5381)
import { createRequire } from 'node:module'
import { envelope, insuranceRulesStub, newPlaygroundStore, playgroundFieldsStub, playgroundStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5381}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const store = newPlaygroundStore()
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
    const hit = playgroundFieldsStub(req.method(), p, { store }) ?? playgroundStub(req.method(), p, body, { store }) ?? insuranceRulesStub(req.method(), p, body)
    if (hit) return route.fulfill(hit).catch(() => {})
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, store }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|playground|guards):|\b(fields|fx|run|rule|ruleset)\.[a-z]\w*\.?\w*/.test(await page.locator('body').innerText())
const box = (page, b) => page.locator(`textarea[data-json-box="${b}"]`)
const docText = async (page) => JSON.parse(await box(page, 'document').inputValue())
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

const FORMULA_DOC = {
  schema: 1,
  kind: 'guard',
  revision: 0,
  fields: [],
  lists: [],
  rules: [
    {
      id: 'G-1',
      name: { en: 'Many units', ar: 'وحدات كثيرة' },
      onUnknown: 'none',
      when: [{ check: 'formula', expr: ['>', '$line.quantity', 1] }],
      then: [{ effect: 'guard', severity: 'WARN', says: { en: 'More than one unit', ar: 'أكثر من وحدة' } }],
    },
  ],
}

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, store } = await open(dir)
  await page.goto(`${BASE}/insurance-rules/playground`)
  await page.locator('[data-playground-page]').waitFor({ timeout: 60000 })
  await box(page, 'document').fill(JSON.stringify(FORMULA_DOC, null, 2))
  const fxBox = page.locator('[data-rule-slot="0"] [data-fx-box="guard"]')
  await fxBox.waitFor({ timeout: 10000 })
  const input = fxBox.locator('[data-fx-input]')

  // 1.
  check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
  check(`${dir} 1. the formula block shows the real formula box, reading`, (await input.inputValue()) === 'line.quantity > 1' && (await fxBox.locator('[data-fx-status="ok"]').count()) === 1, await input.inputValue())
  check(`${dir} 1. a Fields button, none declared`, (await page.locator('[data-open-fields] [data-fields-count="0"]').count()) === 1)

  // 2.
  await page.locator('[data-open-fields]').click()
  const drawer = page.locator('[data-fields-drawer]')
  await drawer.waitFor({ timeout: 5000 })
  const offered = await drawer.locator('[data-registry-field]').evaluateAll((els) => els.map((e) => e.getAttribute('data-registry-field')))
  check(`${dir} 2. the registry fields a formula reads: live item, request and patient ones`, JSON.stringify(offered) === JSON.stringify(['ECode', 'ATC', 'DosageForm', 'daysSupply', 'age']), JSON.stringify(offered))
  check(`${dir} 2. an item field is offered as line.field.*`, strip(await drawer.locator('[data-registry-field="ECode"] code').innerText()) === 'line.field.ECode')
  check(`${dir} 2. its label is isolated`, (await drawer.locator('[data-registry-field="ECode"] bdi').count()) >= 1)
  check(`${dir} 2. none declared yet`, (await drawer.locator('[data-fields-none]').count()) === 1)
  await drawer.locator('[data-pick-field="ECode"]').click()
  check(`${dir} 2. picking it declares it, from the registry`, (await drawer.locator('[data-declared-field="ECode"][data-source="registry"]').count()) === 1)
  check(`${dir} 2. and it is no longer offered`, (await drawer.locator('[data-registry-field="ECode"]').count()) === 0)

  // 3.
  await drawer.locator('[data-scratch-key]').fill('HouseBrand')
  await drawer.locator('[data-scratch-scope]').selectOption('line')
  await drawer.locator('[data-scratch-type]').selectOption('flag')
  await drawer.locator('[data-scratch-add]').click()
  check(`${dir} 3. a scratch field is declared`, (await drawer.locator('[data-declared-field="HouseBrand"][data-source="scratch"]').count()) === 1)
  check(`${dir} 3. the key box is cleared`, (await drawer.locator('[data-scratch-key]').inputValue()) === '')
  await drawer.locator('[data-scratch-key]').fill('housebrand')
  await drawer.locator('[data-scratch-add]').click()
  check(`${dir} 3. a duplicate key is refused`, (await drawer.locator('[data-scratch-problem="duplicate"]').count()) === 1 && (await drawer.locator('[data-declared-field]').count()) === 2)
  await drawer.locator('[data-scratch-key]').fill('House Brand')
  await drawer.locator('[data-scratch-add]').click()
  check(`${dir} 3. a key a formula cannot read is refused`, (await drawer.locator('[data-scratch-problem="key"]').count()) === 1)
  await drawer.locator('[data-scratch-key]').fill('Tmp')
  await drawer.locator('[data-scratch-scope]').selectOption('patient')
  await drawer.locator('[data-scratch-add]').click()
  check(`${dir} 3. a third one is declared`, (await drawer.locator('[data-declared-field="Tmp"]').count()) === 1)
  await drawer.locator('[data-remove-field="Tmp"]').click()
  check(`${dir} 3. removing one drops it`, (await drawer.locator('[data-declared-field="Tmp"]').count()) === 0 && (await drawer.locator('[data-declared-field]').count()) === 2)
  const fields = (await docText(page)).fields
  check(
    `${dir} 3. the JSON's fields holds the two, { key, scope, type }`,
    JSON.stringify(fields) ===
      JSON.stringify([
        { key: 'ECode', scope: 'line', type: 'text' },
        { key: 'HouseBrand', scope: 'line', type: 'flag' },
      ]),
    JSON.stringify(fields),
  )
  check(`${dir} 3. the rules are untouched`, JSON.stringify((await docText(page)).rules) === JSON.stringify(FORMULA_DOC.rules))
  check(`${dir} 8. no raw keys (drawer)`, await noRawKeys(page))
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-fields-drawer.png` }).catch(() => {})
  await drawer.locator('header button').click()
  await drawer.waitFor({ state: 'detached', timeout: 5000 })
  check(`${dir} 3. the button counts two`, (await page.locator('[data-open-fields] [data-fields-count="2"]').count()) === 1)

  // 4.
  check(`${dir} 4. nothing is written to the registry`, (store.fieldPosts ?? 0) === 0, String(store.fieldPosts))

  // 5.
  await fxBox.locator('[data-fx-toggle]').click()
  const fx = fxBox.locator('[data-fx-helper]')
  await fx.waitFor({ timeout: 5000 })
  const groups = await fx.locator('[data-fx-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-fx-group')))
  check(`${dir} 5. the Fields tab leads with the declared group`, groups[0] === 'declared' && groups.includes('line'), JSON.stringify(groups))
  check(`${dir} 5. the registry field with its type`, (await fx.locator('[data-fx-item="line.field.ECode"] [data-fx-type="text"]').count()) === 1)
  check(`${dir} 5. the scratch field with its type`, (await fx.locator('[data-fx-item="line.field.HouseBrand"] [data-fx-type="bool"]').count()) === 1)
  check(`${dir} 5. an undeclared registry field is offered too`, (await fx.locator('[data-fx-item="request.field.daysSupply"]').count()) === 1 && (await fx.locator('[data-fx-item="patient.field.age"]').count()) === 1)
  check(`${dir} 5. no retired or eligibility field`, (await fx.locator('[data-fx-item="line.field.OldGroup"], [data-fx-item*="coverage.periodEnd"]').count()) === 0)
  check(`${dir} 5. request.lines is offered as a list`, (await fx.locator('[data-fx-item="request.lines"] [data-fx-type="items"]').count()) === 1)
  await input.fill('')
  await fx.locator('[data-fx-item="line.field.HouseBrand"]').click()
  await fx.locator('[data-fx-op="and"]').click()
  await fx.locator('[data-fx-item="line.field.ECode"]').click()
  await fx.locator('[data-fx-op="!="]').click()
  await fx.locator('[data-fx-op="text"]').click()
  await page.keyboard.type('E1')
  await sleep(400)
  const typed = await input.inputValue()
  check(`${dir} 5. both fields go in as <scope>.field.<Key>`, typed === "line.field.HouseBrand and line.field.ECode != 'E1'", typed)
  check(`${dir} 5. and it reads`, (await fxBox.locator('[data-fx-status="ok"]').count()) === 1)
  const expr1 = (await docText(page)).rules[0].when[0].expr
  check(`${dir} 5. the rule's expr reads the fields`, JSON.stringify(expr1) === JSON.stringify(['and', '$line.field.HouseBrand', ['!=', '$line.field.ECode', 'E1']]), JSON.stringify(expr1))

  // 6.
  await fx.locator('[data-fx-tab="functions"]').click()
  const fns = await fx.locator('[data-fx-function]').evaluateAll((els) => els.map((e) => e.getAttribute('data-fx-function')))
  check(`${dir} 6. lines, filter, sum and count are offered`, ['lines', 'filter', 'sum', 'count'].every((n) => fns.includes(n)) && fns.includes('in'), JSON.stringify(fns))
  check(`${dir} 6. count sums units, lines counts lines`, /units/.test(await fx.locator('[data-fx-function="count"]').innerText()) && /lines/.test(await fx.locator('[data-fx-function="lines"]').innerText()))
  await fx.locator('[data-fx-tab="recipes"]').click()
  check(`${dir} 6. the cross-line recipe`, strip(await fx.locator('[data-fx-recipe="itemOnRequest"] [data-fx-recipe-formula]').innerText()) === "count(filter(request.lines, line.item == '200021')) > 0")
  await fx.locator('[data-fx-use="itemOnRequest"]').click()
  await sleep(400)
  check(`${dir} 6. it writes its formula, which reads`, (await input.inputValue()) === "count(filter(request.lines, line.item == '200021')) > 0" && (await fxBox.locator('[data-fx-status="ok"]').count()) === 1, await input.inputValue())
  const expr2 = (await docText(page)).rules[0].when[0].expr
  check(`${dir} 6. the expr walks request.lines`, JSON.stringify(expr2) === JSON.stringify(['>', ['count', ['filter', '$request.lines', ['==', '$line.item', '200021']]], 0]), JSON.stringify(expr2))

  // 7.
  await input.fill('eligibility.field.X > 1')
  await sleep(300)
  check(`${dir} 7. eligibility.field.X is refused: badField`, (await fxBox.locator('[data-fx-error="badField"]').count()) === 1)
  check(`${dir} 7. in words`, /line\.field\.Key/.test(strip(await fxBox.locator('[data-fx-error="badField"]').innerText())), strip(await fxBox.locator('[data-fx-error]').innerText()))
  check(`${dir} 8. no raw keys`, await noRawKeys(page))
  check(`${dir} 8. no page errors`, errors.length === 0, errors.join(' | '))
  await page.screenshot({ path: `tools/.insurance-playground-shots/${dir}-fields-fx.png`, fullPage: true }).catch(() => {})
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
