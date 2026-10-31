// Insurance rules ▸ Code labels ▸ curation drive (BackOffice spec 3271 stories 65, 66, L12, L13, door 3297; oms ticket 707).
//
// Drives the REAL app in Chromium against STUBS on the REAL envelope (`tools/fhir-rules-stubs-707.mjs`).
// 🚩 NOTHING here is driven against a live SIS.Api: the door is unbuilt; 711 reconciles the shapes.
//
// In LTR and RTL, one HQ state per pass shared by two users. `core/i18n.ts` pins `lng` to `en`, so the RTL pass flips the
// direction and the words stay English (the Arabic file is proved mirrored by `labels/i18n-keys.test.ts`, not rendered):
//   1. the worklist keeps the door's order on load, and a refetch, with no client sort; each row's parts are isolated;
//   2. a row opens the editor with its code and label today; nothing offers a translation; the boxes start empty;
//   3. neither label is refused and writes nothing;
//   4. the author proposes Arabic; the row stays, marked awaiting approval; a proposals row names it;
//   5. the author is told why Approve is not offered; HQ's refusal of an own approval shows its message;
//   6. another user reads current and proposed, approves, and the row leaves the list and the proposals;
//   7. a code off the worklist takes a corrected English label; a door's refusal keeps what was typed;
//   8. a bare 403 on the worklist and on a propose says no access; an unknown reason shows as sent; no raw keys or errors.
//
//   1. npx vite --port 5217 --strictPort
//   2. DRIVE_PORT=5217 node tools/insurance-fhir-707-drive.mjs
import { createRequire } from 'node:module'
import { envelope } from './insurance-rules-stubs.mjs'
import { ERRORS, SYSTEM, WORKLIST, curationStub, newCurationState } from './fhir-rules-stubs-707.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5217}`
const AUTHOR = 'nalharbi'
const APPROVER = 'falotaibi'
const ARABIC = 'عناية الأسنان'
const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}
const strip = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()

const browser = await chromium.launch()

async function open(dir, state, user, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = []
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
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: user, currentStoreCode: 'P001' }))
    if (req.method() === 'GET') reads.push(`${p}${url.search}`)
    const body = req.postData() ? JSON.parse(req.postData()) : undefined
    const hit = curationStub(req.method(), p, body, { state, query: url.searchParams, user, deny })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  await page.goto(`${BASE}/insurance-rules/code-labels`)
  return { context, page, errors, reads }
}
const rowCodes = (page) => page.locator('[data-worklist-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-worklist-row')))
const ltrText = (loc) => loc.locator('bdi[dir="ltr"]').first().innerText()
const noRawKeys = async (page) => !/insurance-(rules|labels):|\b(worklist|proposals|override|problem)\.[a-zA-Z]/.test(await page.locator('main').innerText())
const toastHas = async (page, text) => {
  try {
    await page.locator('[data-sonner-toast]', { hasText: text }).first().waitFor({ timeout: 8000 })
    return true
  } catch {
    return false
  }
}

for (const dir of ['ltr', 'rtl']) {
  const tag = (s) => `${dir} ${s}`
  const state = newCurationState()
  const doorOrder = WORKLIST.map((r) => r.code)

  // --- the author
  {
    const { context, page, errors, reads } = await open(dir, state, AUTHOR)
    await page.locator('[data-worklist-row]').first().waitFor({ timeout: 60000 })

    // 1
    check(tag('1. dir'), (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(tag("1. the worklist is the door's order on load"), JSON.stringify(await rowCodes(page)) === JSON.stringify(doorOrder), JSON.stringify(await rowCodes(page)))
    check(tag('1. the proposals read asks for proposed ones'), reads.includes('InsuranceRules/Labels/Overrides?waiting=true'), reads.join(' '))
    const first = page.locator('[data-worklist-row="12"]')
    check(tag('1. code and system are ltr isolates'), (await ltrText(first.locator('[data-col="code"]'))) === '12' && (await ltrText(first.locator('[data-col="system"]'))) === SYSTEM)
    check(tag('1. the label is a bdi, frequency an ltr isolate'), strip(await first.locator('[data-col="current"] [data-label="en"] bdi').innerText()) === 'Dental care' && (await ltrText(first.locator('[data-col="frequency"]'))) === '900')
    check(tag('1. the reasons read in words'), strip(await first.locator('[data-col="reason"]').innerText()) === 'Lacks Arabic' && strip(await page.locator('[data-worklist-row="7"] [data-col="reason"]').innerText()) === 'Unlabelled')
    check(tag('1. an unlabelled code says so'), strip(await page.locator('[data-worklist-row="7"] [data-col="current"]').innerText()) === 'No label')
    check(tag('8. a reason the screen does not know shows as sent'), (await ltrText(page.locator('[data-worklist-row="99"] [data-col="reason"]'))) === 'nextRelease')
    check(tag('1. no proposals yet says so'), (await page.locator('[data-proposals-empty]').count()) === 1)

    // 2
    await page.locator('[data-worklist-open="12"]').click()
    const editor = page.getByRole('dialog')
    await editor.locator('[data-override-editor]').waitFor({ timeout: 10000 })
    check(tag('2. the editor names the code and its label today'), (await ltrText(editor.locator('[data-override-code]'))) === '12' && (await ltrText(editor.locator('[data-override-system]'))) === SYSTEM && strip(await editor.locator('[data-override-current] [data-label="en"] bdi').innerText()) === 'Dental care')
    check(tag('2. the boxes start empty'), (await editor.locator('[data-override-ar]').inputValue()) === '' && (await editor.locator('[data-override-en]').inputValue()) === '')
    check(tag('2. the Arabic box reads rtl, the English ltr'), (await editor.locator('[data-override-ar]').getAttribute('dir')) === 'rtl' && (await editor.locator('[data-override-en]').getAttribute('dir')) === 'ltr')
    check(tag('2. nothing offers a machine translation'), !/translat/i.test(await editor.innerText()) && (await editor.getByRole('button').allInnerTexts()).length === 2)

    // 3
    await editor.locator('[data-override-submit]').click()
    check(tag('3. neither label is refused by the form'), (await editor.locator('[data-override-problem="labelMissing"]').count()) === 1)
    await editor.locator('[data-override-en]').fill('   ')
    await editor.locator('[data-override-submit]').click()
    check(tag('3. spaces are not a label, and nothing is written'), (await editor.locator('[data-override-problem="labelMissing"]').count()) === 1 && state.writes.length === 0)

    // 4
    await editor.locator('[data-override-en]').fill('')
    await editor.locator('[data-override-ar]').fill(`  ${ARABIC} `)
    await editor.locator('[data-override-submit]').click()
    await page.locator('[data-proposal="O-1"]').waitFor({ timeout: 10000 })
    check(tag('4. the propose sends the trimmed Arabic and a null English'), JSON.stringify(state.writes[0]?.body) === JSON.stringify({ system: SYSTEM, code: '12', en: null, ar: ARABIC }), JSON.stringify(state.writes[0]?.body))
    check(tag('4. the toast says it awaits someone else'), await toastHas(page, "another person's approval"))
    check(tag('4. the editor closes'), (await page.getByRole('dialog').count()) === 0)
    check(tag('4. the row stays, marked, in its place'), JSON.stringify(await rowCodes(page)) === JSON.stringify(doorOrder) && /Awaiting approval/.test(await page.locator('[data-worklist-row="12"]').innerText()))
    const proposal = page.locator('[data-proposal="O-1"]')
    check(tag('4. the proposals row: code, words as a bdi, the author'), (await ltrText(proposal.locator('[data-col="code"]'))) === '12' && strip(await proposal.locator('[data-col="proposed"] [data-label="ar"] bdi').innerText()) === ARABIC && strip(await proposal.locator('[data-col="by"]').innerText()).startsWith(AUTHOR))

    // 5
    await page.locator('[data-worklist-open="12"]').click()
    const review = page.getByRole('dialog')
    await review.locator('[data-override-review]').waitFor({ timeout: 10000 })
    check(tag('5. the author is not offered Approve'), (await review.locator('[data-override-approve]').count()) === 0)
    check(tag('5. the author is told why'), /someone else must approve/.test(await review.locator('[data-override-why]').innerText()))
    await review.getByRole('button').first().click()
    check(tag('8. no raw keys for the author'), await noRawKeys(page))
    check(tag('8. no page errors for the author'), errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // HQ decides even if the client is stale: the row names someone else, HQ refuses by the session.
  {
    const stale = newCurationState()
    stale.overrides.push({ id: 'O-9', system: SYSTEM, code: '12', en: null, ar: ARABIC, state: 'proposed', current: { en: 'Dental care', ar: null }, proposedBy: 'stale-name', proposedAt: '2026-10-30T09:00:00', approvedBy: null, approvedAt: null })
    const { context, page } = await open(dir, stale, AUTHOR)
    await page.route('**/api/InsuranceRules/Labels/Overrides/O-9/Approve', (route) => route.fulfill(envelope(null, { status: 409, success: false, message: 'Someone other than the author must approve a label.', errorCode: 'LABEL_OVERRIDE_SELF_APPROVAL' })))
    await page.locator('[data-proposal-open="O-9"]').click()
    await page.locator('[data-override-approve]').click()
    await page.locator('[data-override-refused]').waitFor({ timeout: 10000 })
    check(tag("5. a server refusal of an own approval shows the door's message"), strip(await page.locator('[data-override-refused]').innerText()) === 'Someone other than the author must approve a label.')
    check(tag('5. the refused row stays'), (await rowCodes(page)).includes('12'))
    await context.close()
  }

  // --- the second person
  {
    const { context, page, errors } = await open(dir, state, APPROVER)
    await page.locator('[data-proposal="O-1"]').waitFor({ timeout: 60000 })
    await page.locator('[data-worklist-open="12"]').click()
    const review = page.getByRole('dialog')
    await review.locator('[data-override-review]').waitFor({ timeout: 10000 })
    check(tag('6. the approver reads today and the proposal'), strip(await review.locator('[data-override-current] [data-label="en"] bdi').innerText()) === 'Dental care' && strip(await review.locator('[data-override-proposed] [data-label="ar"] bdi').innerText()) === ARABIC)
    check(tag('6. the approver reads who proposed it'), strip(await review.locator('[data-override-by]').innerText()).startsWith(AUTHOR))
    await review.locator('[data-override-approve]').click()
    await page.locator('[data-worklist-row="12"]').waitFor({ state: 'detached', timeout: 10000 }).catch(() => {})
    const write = state.writes.at(-1)
    check(tag('6. the approve POSTs that proposal as the second person'), write.path === 'InsuranceRules/Labels/Overrides/O-1/Approve' && write.user === APPROVER)
    check(tag('6. the row leaves the list; the rest keep their order'), JSON.stringify(await rowCodes(page)) === JSON.stringify(doorOrder.filter((c) => c !== '12')), JSON.stringify(await rowCodes(page)))
    check(tag('6. the proposals empty'), (await page.locator('[data-proposal]').count()) === 0 && (await page.locator('[data-proposals-empty]').count()) === 1)
    check(tag('6. the toast says approved'), await toastHas(page, 'Label approved'))
    check(tag('6. the editor closes'), (await page.getByRole('dialog').count()) === 0)

    // 7
    await page.locator('[data-override-new]').click()
    const blank = page.getByRole('dialog')
    await blank.locator('[data-override-submit]').click()
    check(tag('7. a hand-named code needs its system and code'), /Enter the code system/.test(await blank.innerText()) && /Enter the code\./.test(await blank.innerText()))
    const writes = state.writes.length
    await blank.locator('[data-override-system-input]').fill(ERRORS)
    await blank.locator('[data-override-code-input]').fill('NOPE')
    await blank.locator('[data-override-en]').fill('Corrected')
    await blank.locator('[data-override-submit]').click()
    await blank.locator('[data-override-refused]').waitFor({ timeout: 10000 })
    check(tag("7. a door's refusal shows its words and keeps the typing"), strip(await blank.locator('[data-override-refused]').innerText()) === 'No source lists this code.' && (await blank.locator('[data-override-en]').inputValue()) === 'Corrected' && state.writes.length === writes + 1)
    await blank.locator('[data-override-code-input]').fill('E-1')
    check(tag('7. changing the form clears the refusal'), (await blank.locator('[data-override-refused]').count()) === 0)
    await blank.locator('[data-override-submit]').click()
    await page.locator('[data-proposal="O-2"]').waitFor({ timeout: 10000 })
    check(tag('7. an English correction off the worklist is proposed'), JSON.stringify(state.writes.at(-1).body) === JSON.stringify({ system: ERRORS, code: 'E-1', en: 'Corrected', ar: null }))
    check(tag('7. and waits in the proposals, not the worklist'), !(await rowCodes(page)).includes('E-1'))
    check(tag('8. no raw keys for the approver'), await noRawKeys(page))
    check(tag('8. no page errors for the approver'), errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // 8. a bare 403
  {
    const { context, page } = await open(dir, newCurationState(), AUTHOR, { deny: ['worklist'] })
    await page.locator('[data-worklist] [role="alert"], [data-worklist] :text("You do not have access")').first().waitFor({ timeout: 30000 }).catch(() => {})
    check(tag('8. a bare 403 on the worklist says no access'), /You do not have access/.test(await page.locator('[data-worklist]').innerText()))
    await context.close()
  }
  {
    const { context, page } = await open(dir, newCurationState(), AUTHOR, { deny: ['propose'] })
    await page.locator('[data-worklist-open="12"]').click()
    const editor = page.getByRole('dialog')
    await editor.locator('[data-override-ar]').fill(ARABIC)
    await editor.locator('[data-override-submit]').click()
    await editor.locator('[data-override-refused]').waitFor({ timeout: 10000 })
    check(tag('8. a bare 403 on a propose says no access and keeps the typing'), strip(await editor.locator('[data-override-refused]').innerText()) === 'You do not have access' && (await editor.locator('[data-override-ar]').inputValue()) === ARABIC)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
