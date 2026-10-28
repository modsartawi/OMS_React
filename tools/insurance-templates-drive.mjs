// Guard templates + folders drive (BackOffice spec 3126; oms ticket 609).
//
// Drives the REAL app in Chromium against STUBS of the templates and folders doors, on the REAL envelope
// (`tools/insurance-rules-stubs.mjs`, its `// --- 609 ---` section, on 608's stateful draft):
//   GET  InsuranceRules/Guards/Templates             → 3093's phase-1 templates + team templates (blank PATHS, HQ names none)
//   POST InsuranceRules/Guards/Templates             → `{ id, ruleId, name, blanks }` → a team template
//   POST InsuranceRules/Guards/Templates/{id}/Create → `{ revision, ruleId, folder, values }` → the draft (the client names the rule)
//   GET / POST / PUT InsuranceRules/Guards/Folders   → `{ folders }`; `{ path }` new, `{ from, to }` rename, `{ ruleId, folder }` move
// The stubs serve the doors AS BUILT (oms 618); the drive's re-run against staging is 618's Done-when.
//
// It verifies, in LTR and RTL:
//   1. the gallery: every phase-1 template with its DUR conflict code (an LTR isolate) and severity; no team one yet;
//   2. a template's blanks make a draft rule: Create waits for the empty blanks; the values, the folder and the
//      read-as preview; the POST carries the values by path; the editor opens on the new draft, which HQ holds
//      with the blanks' values; the template itself is untouched;
//   3. Save as template from the rule page: the chosen values become blanks; the team template shows in the
//      gallery; refilling it makes another, independent draft rule;
//   4. move a rule to a folder (no approval) from its page; the Guards tree counts it there;
//   5. a new folder under the picked one (a sibling's name refused, any case) and a rename (its rules follow);
//   6. a bare 403 on the gallery is "You do not have access"; no raw keys; no page errors.
//
//   1. run the app:  npx vite --port 5207 --strictPort
//   2. node tools/insurance-templates-drive.mjs        (DRIVE_PORT overrides 5207)
import { createRequire } from 'node:module'
import { RULES, TEMPLATES, envelope, insuranceRulesStub, newTemplatesState, templatesStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5207}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, deny = []) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
  const state = newTemplatesState()
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
    const hit = templatesStub(req.method(), p, body, { state, reads, deny }) ?? insuranceRulesStub(req.method(), p, body, { reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads, state }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const noRawKeys = async (page) => !/insurance-(rules|guards|templates):|\bfill\.|\bsource\.|organize\.|saveTemplate\.|folders\.|template\.blank|sentence\./.test(await page.locator('main').innerText())
const card = (page, id) => page.locator(`[data-template="${id}"]`)
const dialog = (page) => page.locator('[data-fill-dialog]')
const input = (scope, name) => scope.locator(`[data-input="${name}"]`).first()
/** Picks a folder in the tree and waits for the pick to land (the URL's `?folder=`). */
const pick = async (page, path) => {
  await page.locator(`[data-folder="${path}"]`).click()
  await page.locator(`[data-folder="${path}"][aria-pressed="true"]`).waitFor({ timeout: 10000 })
}
const lastWrite = (state, door) => [...state.writes].reverse().find((w) => w.door === door)
const NEXT = (n) => `G-${String(Math.max(...RULES.map((r) => Number(r.id.slice(2)))) + n).padStart(3, '0')}`
const QTY = TEMPLATES.find((t) => t.id === 'T-QTY')

for (const dir of ['ltr', 'rtl']) {
  const { context, page, errors, state } = await open(dir)

  // ── 1: the gallery ─────────────────────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/templates`)
  await page.locator('[data-templates="phase1"] [data-template]').first().waitFor({ timeout: 30000 })
  check(`${dir} 1. every phase-1 template is in the gallery`, (await page.locator('[data-templates="phase1"] [data-template]').count()) === TEMPLATES.length)
  check(`${dir} 1. the menu leaf is lit`, (await page.locator('a[href="/insurance-rules/templates"][aria-current="page"]').count()) >= 1)
  const dup = card(page, 'T-DUP')
  check(
    `${dir} 1. Duplicate dispense: DUR conflict 83, an LTR isolate; REFUSE`,
    (await dup.locator('[data-conflict-code="83"] bdi[dir="ltr"]').innerText()) === '83' && (await dup.locator('[data-severity="REFUSE"]').count()) === 1,
  )
  check(`${dir} 1. a template with no conflict code shows none`, (await card(page, 'T-HOP').locator('[data-conflict-code]').count()) === 0)
  check(`${dir} 1. its conditions read as sentences`, (await dup.locator('[data-template-reads] [data-check="history"]').count()) === 1)
  check(`${dir} 1. no team template yet`, (await page.locator('[data-templates-empty="team"]').count()) === 1)
  check(`${dir} 1. no raw keys in the gallery`, await noRawKeys(page))

  // ── 2: fill T-QTY ─────────────────────────────────────────────────────────────────────────────
  await page.locator('[data-use-template="T-QTY"]').click()
  await dialog(page).waitFor()
  check(`${dir} 2. one control per blank`, (await dialog(page).locator('[data-blank]').count()) === QTY.blanks.length)
  check(`${dir} 2. Create waits: the name and the item list are empty`, (await page.locator('[data-fill-create]').isDisabled()) && (await page.locator('[data-missing]').getAttribute('data-missing')) === '2')
  check(`${dir} 2. a number blank keeps its default`, (await input(dialog(page), 'when[0].windowDays').inputValue()) === '28')
  const listLabel = strip(await dialog(page).locator('[data-blank="when[0].match"] [data-blank-label]').innerText())
  check(`${dir} 2. a blank is named by its key's word and its path (HQ sends paths only)`, listLabel.includes('when[0].match') && !listLabel.includes('template.blank'), listLabel)
  check(`${dir} 2. a match naming a list is picked from the ruleset's lists`, (await dialog(page).locator('[data-blank="when[0].match"]').getAttribute('data-blank-kind')) === 'list')
  await input(dialog(page), 'name.en').fill('GLP-1: two pens per 14 days')
  await input(dialog(page), 'name.ar').fill('GLP-1: قلمان كل 14 يوماً')
  await input(dialog(page), 'when[0].match').selectOption('glp1')
  await input(dialog(page), 'when[0].windowDays').fill('14')
  await input(dialog(page), 'when[0].atLeast').fill('3')
  await input(dialog(page), 'folder').fill('Specialty medicines/GLP-1')
  const previewText = strip(await dialog(page).locator('[data-fill-preview]').innerText())
  check(`${dir} 2. the preview reads the filled values (14 days, the GLP-1 list)`, previewText.includes('14') && previewText.includes('GLP-1'), previewText)
  check(`${dir} 2. Create is on once every blank is filled`, !(await page.locator('[data-fill-create]').isDisabled()) && (await page.locator('[data-missing]').count()) === 0)
  await page.locator('[data-fill-create]').click()
  await page.waitForURL(/\/guards\/G-\d+\/edit$/, { timeout: 15000 }).catch(() => {})
  const id1 = NEXT(1)
  const w = lastWrite(state, 'templates.create')
  check(
    `${dir} 2. the POST carries the draft's revision, the rule id, the changed values by path, and the folder`,
    w && w.body.revision === 12 && w.body.ruleId === NEXT(1) && w.body.values['when[0].match'] === 'list:glp1' && w.body.values['when[0].windowDays'] === 14 && w.body.values['when[0].atLeast'] === 3 && w.body.values.name?.ar === 'GLP-1: قلمان كل 14 يوماً' && w.body.folder === 'Specialty medicines/GLP-1',
    JSON.stringify(w?.body),
  )
  check(`${dir} 2. the editor opens on the new draft rule`, new URL(page.url()).pathname === `/insurance-rules/guards/${id1}/edit`, page.url())
  await page.locator('[data-editor-header]').waitFor({ timeout: 15000 }).catch(() => {})
  check(`${dir} 2. the editor shows its name; a draft`, (await input(page, 'name.en').inputValue()) === 'GLP-1: two pens per 14 days' && (await page.locator('[data-editor-header] [data-state]').getAttribute('data-state')) === 'draft')
  const r1 = state.store.draft.rules.find((r) => r.id === id1)
  check(
    `${dir} 2. HQ holds the rule with the blanks' values`,
    r1 && r1.when[0].match === 'list:glp1' && r1.when[0].windowDays === 14 && r1.when[0].atLeast === 3 && r1.folder === 'Specialty medicines/GLP-1' && r1.then[0].codes?.conflict === 'HD',
    JSON.stringify(r1),
  )
  const tq = state.templates.find((t) => t.id === 'T-QTY')
  check(`${dir} 2. the template is untouched`, tq.rule.when[0].match === '' && tq.rule.when[0].windowDays === 28 && tq.rule.name.en === '')

  // ── 3: save the rule as a team template ───────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/${id1}`)
  await page.locator('[data-save-template]').waitFor({ timeout: 20000 })
  await page.locator('[data-save-template]').click()
  await page.locator('[data-save-template-dialog]').waitFor()
  const offered = await page.locator('[data-candidate]').evaluateAll((els) => els.map((e) => e.getAttribute('data-candidate')))
  check(`${dir} 3. the values offered as blanks`, JSON.stringify(offered) === JSON.stringify(['name', 'when[0].match', 'when[0].windowDays', 'when[0].atLeast', 'then[0].says']), JSON.stringify(offered))
  check(`${dir} 3. a value shows as it reads now (an LTR isolate)`, (await page.locator('[data-candidate="when[0].windowDays"] bdi[dir="ltr"]').last().innerText()) === '14')
  await page.locator('[data-blank-toggle="when[0].match"]').check()
  await page.locator('[data-blank-toggle="when[0].atLeast"]').check()
  check(`${dir} 3. two blanks chosen`, (await page.locator('[data-blank-count]').getAttribute('data-blank-count')) === '2')
  await input(page, 'template-name.en').fill('Pens per fortnight')
  await input(page, 'template-name.ar').fill('أقلام كل أسبوعين')
  await page.locator('[data-save-template-confirm]').click()
  await page.locator('[data-save-template-dialog]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
  const sw = lastWrite(state, 'templates.save')
  check(
    `${dir} 3. the POST names the template id, the rule, the name and the blanks (in the rule's order)`,
    sw && sw.body.id === `team-${id1}` && sw.body.ruleId === id1 && sw.body.name.en === 'Pens per fortnight' && JSON.stringify(sw.body.blanks) === JSON.stringify(['when[0].match', 'when[0].atLeast']),
    JSON.stringify(sw?.body),
  )
  await page.goto(`${BASE}/insurance-rules/templates`)
  await page.locator('[data-templates="team"] [data-template]').first().waitFor({ timeout: 20000 }).catch(() => {})
  const team = page.locator('[data-templates="team"] [data-template]')
  check(`${dir} 3. the team template is in the gallery, with its two blanks`, (await team.count()) === 1 && (await team.locator('[data-blanks]').getAttribute('data-blanks')) === '2')
  check(`${dir} 3. its author is named`, (await team.locator('[data-template-by]').count()) === 1)
  // refill it
  const teamId = await team.getAttribute('data-template')
  await page.locator(`[data-use-template="${teamId}"]`).click()
  await dialog(page).waitFor()
  check(`${dir} 3. each blank starts from the rule's value (HQ keeps it as the default)`, (await input(dialog(page), 'when[0].match').inputValue()) === 'glp1' && (await input(dialog(page), 'when[0].atLeast').inputValue()) === '3')
  check(`${dir} 3. a team blank is named by its path`, strip(await dialog(page).locator('[data-blank="when[0].atLeast"] [data-blank-label]').innerText()).includes('when[0].atLeast'))
  await input(dialog(page), 'when[0].match').selectOption('controlled')
  await input(dialog(page), 'when[0].atLeast').fill('6')
  await page.locator('[data-fill-create]').click()
  const id2 = NEXT(2)
  await page.waitForURL(new RegExp(`/guards/${id2}/edit$`), { timeout: 15000 }).catch(() => {})
  const r2 = state.store.draft.rules.find((r) => r.id === id2)
  const r1again = state.store.draft.rules.find((r) => r.id === id1)
  check(`${dir} 3. refilled: another draft rule with the new values`, r2 && r2.when[0].match === 'list:controlled' && r2.when[0].atLeast === 6 && r2.when[0].windowDays === 14 && r2.name.en === r1.name.en, JSON.stringify(r2))
  check(`${dir} 3. the first rule is untouched`, r1again.when[0].match === 'list:glp1' && r1again.when[0].atLeast === 3)

  // ── 4: move a rule to a folder from its page ──────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards/${id2}`)
  await page.locator('[data-organize]').waitFor({ timeout: 20000 })
  await page.waitForFunction(() => [...document.querySelectorAll('[data-input="move-to"] option')].some((o) => o.value === 'Specialty medicines/Biologics'), null, { timeout: 10000 }).catch(() => {})
  check(`${dir} 4. Move is off until another folder is picked`, await page.locator('[data-move]').isDisabled())
  check(`${dir} 4. an empty folder HQ keeps is offered`, (await page.locator('[data-input="move-to"] option[value="Specialty medicines/Biologics"]').count()) === 1)
  await page.locator('[data-input="move-to"]').selectOption('Specialty medicines/Biologics')
  await page.locator('[data-move]').click()
  await page.waitForFunction(() => document.querySelector('[data-rule-folder]')?.textContent?.includes('Biologics'), null, { timeout: 10000 }).catch(() => {})
  const mv = lastWrite(state, 'folders.move')
  check(`${dir} 4. one PUT moves the rule, no approval asked`, mv && JSON.stringify(mv.body) === JSON.stringify({ ruleId: id2, folder: 'Specialty medicines/Biologics' }) && state.store.draft.rules.find((r) => r.id === id2)?.state === 'draft', JSON.stringify(mv?.body))
  check(`${dir} 4. the page reads the new folder`, strip(await page.locator('[data-rule-folder]').innerText()) === 'Specialty medicines/Biologics')

  // ── 5: folders on the Guards list ─────────────────────────────────────────────────────────────
  await page.goto(`${BASE}/insurance-rules/guards`)
  await page.locator('[data-folder-tree]').waitFor({ timeout: 20000 })
  await page.locator('[data-folder="Specialty medicines/Biologics"]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 5. the tree counts the moved rule in its folder`, (await page.locator('[data-folder="Specialty medicines/Biologics"] [data-count]').innerText()) === '1')
  check(`${dir} 5. Rename is offered only for a picked folder`, (await page.locator('[data-folder-rename]').count()) === 0)
  await pick(page, 'Chronic care')
  await page.locator('[data-folder-new]').click()
  await input(page, 'folder-name').fill('refills')
  check(`${dir} 5. a sibling's name is refused, any case`, (await page.locator('[data-folder-problem="taken"]').count()) === 1 && (await page.locator('[data-folder-save]').isDisabled()))
  await input(page, 'folder-name').fill('a/b')
  check(`${dir} 5. a slash is refused`, (await page.locator('[data-folder-problem="slash"]').count()) === 1)
  await input(page, 'folder-name').fill('Diabetes')
  await page.locator('[data-folder-save]').click()
  await page.locator('[data-folder="Chronic care/Diabetes"]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 5. POST makes the folder under the picked one`, JSON.stringify(lastWrite(state, 'folders.create')?.body) === JSON.stringify({ path: 'Chronic care/Diabetes' }))
  await page.locator('[data-folder="Chronic care/Diabetes"][aria-pressed="true"]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 5. the new, empty folder is in the tree and picked`, (await page.locator('[data-folder="Chronic care/Diabetes"]').count()) === 1 && (await page.locator('[data-folder="Chronic care/Diabetes"]').getAttribute('aria-pressed')) === 'true' && new URL(page.url()).searchParams.get('folder') === 'Chronic care/Diabetes', `${await page.locator('[data-folder="Chronic care/Diabetes"]').count()} ${await page.locator('[data-folder="Chronic care/Diabetes"]').getAttribute('aria-pressed').catch(() => '-')} ${page.url()}`)
  // rename
  await pick(page, 'Specialty medicines/Biologics')
  await page.locator('[data-folder-rename]').click()
  check(`${dir} 5. rename starts from the folder's name`, (await input(page, 'folder-name').inputValue()) === 'Biologics')
  await input(page, 'folder-name').fill('Biologic drugs')
  await page.locator('[data-folder-save]').click()
  await page.locator('[data-folder="Specialty medicines/Biologic drugs"]').waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 5. PUT renames the folder`, JSON.stringify(lastWrite(state, 'folders.rename')?.body) === JSON.stringify({ from: 'Specialty medicines/Biologics', to: 'Specialty medicines/Biologic drugs' }))
  check(`${dir} 5. its rule follows; the old folder is gone`, state.store.draft.rules.find((r) => r.id === id2)?.folder === 'Specialty medicines/Biologic drugs' && (await page.locator('[data-folder="Specialty medicines/Biologics"]').count()) === 0)
  await page.locator(`[data-guards-grid] [row-id="${id2}"]`).first().waitFor({ timeout: 10000 }).catch(() => {})
  check(`${dir} 5. the renamed folder stays picked, its rule in the grid`, new URL(page.url()).searchParams.get('folder') === 'Specialty medicines/Biologic drugs' && (await page.locator(`[data-guards-grid] [row-id="${id2}"]`).count()) >= 1, page.url())
  check(`${dir} 6. no raw keys on the list`, await noRawKeys(page))
  check(`${dir} 6. no page errors`, errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6: a bare 403 on the gallery ────────────────────────────────────────────────────────────────
{
  const { context, page, errors } = await open('ltr', ['templates'])
  await page.goto(`${BASE}/insurance-rules/templates`)
  await page.locator('[data-templates-denied]').waitFor({ timeout: 30000 }).catch(() => {})
  check('ltr 6. a bare 403 says "You do not have access"', (await page.locator('[data-templates-denied]').count()) === 1 && (await page.locator('[data-template]').count()) === 0)
  check('ltr 6. no page errors (denied)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
