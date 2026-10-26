// Insurance rules drive (BackOffice spec 3126; oms ticket 607 creates it — 608–617 EXTEND it with a section of
// their own below 607's, or start a drive of their own on the same stubs module).
//
// Drives the REAL app in Chromium against STUBS of the insurance-rules doors, on the REAL envelope. The fixtures
// and the door handler are `tools/insurance-rules-stubs.mjs` (shared with vitest and later drives):
//   GET InsuranceRules/Guards        → every rule's row (`GUARD_ROWS`)
//   GET InsuranceRules/Guards/Draft  → the guard ruleset (`RULESET`, revision 12)
// 🚩 NOTHING here is driven against a live SIS.Api: the doors (BackOffice 3139, 3141) are unbuilt. Ticket 618
// swaps in the live doors.
//
// It verifies, in LTR and RTL:
//   1. the Insurance rules group is in the rail with its Guards leaf; /insurance-rules opens /insurance-rules/guards;
//   2. every rule in the grid with its state, severity, folder, last fired ("Never" when it never fired) and flags
//      (noisy / silent / jump, each with since when);
//   3. the folder tree: counts include sub-folders; picking a folder keeps it and its sub-folders, lands in the URL
//      and says "n / m"; All rules clears it;
//   4. a row opens /insurance-rules/guards/:ruleId read as sentences — WHEN, IF (G-007: All of, NOT on a leaf,
//      a NOT Any of read "none of these is true"), THEN (severity, EN + AR message, codes, onUnknown) — the id,
//      codes and list ids `Ltr`, the Arabic message `<bdi>`; Back returns to the folder it was left in;
//   5. a supply rule reads its clauses; an unknown id says so;
//   6. a bare 403 on either read is "You do not have access", never an empty list;
//   7. no raw keys and no page errors.
//
//   1. run the app:  npx vite --port 5131 --strictPort
//   2. node tools/insurance-rules-drive.mjs        (DRIVE_PORT overrides 5131)
import { createRequire } from 'node:module'
import { GUARD_ROWS, envelope, insuranceRulesStub } from './insurance-rules-stubs.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5131}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail && !pass ? ' — ' + detail : ''}`)
}

const browser = await chromium.launch()

async function open(dir, { deny = [] } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  page.setDefaultNavigationTimeout(120000)
  const errors = []
  const reads = {}
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
    const hit = insuranceRulesStub(req.method(), p, null, { deny, reads })
    if (hit) return route.fulfill(hit)
    if (/\/Access$/.test(p)) return route.fulfill(envelope({}))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, reads }
}

const strip = (s) => s.replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()
const grid = '[data-guards-grid]'
const rowOf = (page, id) => page.locator(`${grid} .ag-row[row-id="${id}"]`)
const shownIds = (page) =>
  page.locator(`${grid} .ag-row`).evaluateAll((els) => els.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((e) => e.getAttribute('row-id')))
const folderBtn = (page, path) => page.locator(`[data-folder-tree] button[data-folder="${path}"]`)
const noRawKeys = async (page) => !/insurance-(rules|guards):|sentence\.|\bstate\.|severity\.|flag\.|list\.|rule\./.test(await page.locator('main').innerText())

for (const dir of ['ltr', 'rtl']) {
  // ── 1–3: the list ───────────────────────────────────────────────────────────────────────────
  {
    const { context, page, errors, reads } = await open(dir)
    await page.goto(`${BASE}/insurance-rules`)
    await page.locator(`${grid} .ag-row`).first().waitFor({ timeout: 30000 })
    check(`${dir} 0. dir is ${dir}`, (await page.evaluate(() => document.documentElement.dir || 'ltr')) === dir)
    check(`${dir} 1. /insurance-rules opens /insurance-rules/guards`, new URL(page.url()).pathname === '/insurance-rules/guards', page.url())
    check(`${dir} 1. the rail has the Insurance rules group and its Guards leaf`, (await page.getByText('Insurance rules', { exact: true }).count()) >= 1 && (await page.locator('a[href="/insurance-rules/guards"]').count()) >= 1)
    check(`${dir} 1. the title`, strip(await page.locator('h1').first().innerText()) === 'Guards')
    const ids = await shownIds(page)
    check(`${dir} 2. every rule, in the door's order`, JSON.stringify(ids) === JSON.stringify(GUARD_ROWS.map((r) => r.id)), JSON.stringify(ids))
    check(`${dir} 2. one read of the list`, reads.guards === 1, JSON.stringify(reads))

    const g7 = rowOf(page, 'G-007')
    check(`${dir} 2. G-007: name EN and AR`, strip(await g7.locator('[data-name-main]').innerText()) === 'GLP-1 without a diabetes diagnosis' && strip(await g7.locator('[data-name-other]').innerText()) === 'GLP-1 بدون تشخيص سكري')
    check(`${dir} 2. G-007: live, OVERRIDE`, (await g7.locator('[data-state]').getAttribute('data-state')) === 'live' && strip(await g7.locator('[data-state]').innerText()) === 'Live' && (await g7.locator('[data-severity]').getAttribute('data-severity')) === 'OVERRIDE' && strip(await g7.locator('[data-severity]').innerText()) === 'Override')
    check(`${dir} 2. G-007: folder and last fired`, strip(await g7.locator('[col-id="folder"]').innerText()) === 'Specialty medicines/GLP-1' && strip(await g7.locator('[col-id="lastFired"]').innerText()) === '2026-10-27 08:15', strip(await g7.locator('[col-id="lastFired"]').innerText()))
    const flags = await g7.locator('[data-flag]').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-flag')}@${e.getAttribute('data-since')}:${e.textContent}`))
    check(`${dir} 2. G-007 flags: noisy and jump, each with since`, JSON.stringify(flags) === JSON.stringify(['noisy@2026-10-22:Noisy', 'jump@2026-10-26:Jump']), JSON.stringify(flags))
    check(`${dir} 2. a flag's tooltip names since when`, strip((await g7.locator('[data-flag="jump"]').getAttribute('title')) ?? '') === 'Its fires jumped suddenly. Since 2026-10-26')
    const g4 = rowOf(page, 'G-004')
    check(`${dir} 2. G-004: never fired, silent`, strip(await g4.locator('[col-id="lastFired"]').innerText()) === 'Never' && (await g4.locator('[data-flag]').getAttribute('data-flag')) === 'silent')
    const states = await Promise.all(['G-001', 'G-003', 'G-005', 'G-006', 'G-009'].map(async (id) => (await rowOf(page, id).locator('[data-state]').getAttribute('data-state')) + '/' + (await rowOf(page, id).locator('[data-severity]').getAttribute('data-severity'))))
    check(`${dir} 2. every state and severity shows`, JSON.stringify(states) === JSON.stringify(['live/REFUSE', 'shadow/OVERRIDE', 'waiting/WARN', 'draft/WARN', 'disabled/WARN']), JSON.stringify(states))
    check(`${dir} 2. a rule with no flag shows none`, (await rowOf(page, 'G-001').locator('[data-flag]').count()) === 0)

    // 3. the tree
    const counts = await page.locator('[data-folder-tree] button').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-folder')}=${e.querySelector('[data-count]').textContent.replace(/[\u2066-\u2069]/g, '')}`))
    check(
      `${dir} 3. the tree: All, then each folder with its sub-folders, counting descendants`,
      JSON.stringify(counts) ===
        JSON.stringify(['=11', 'Chronic care=3', 'Chronic care/Refills=1', 'Pharmacist conduct=3', 'Reference=3', 'Reference/Formulary=1', 'Reference/SFDA=2', 'Specialty medicines=2', 'Specialty medicines/GLP-1=2']),
      JSON.stringify(counts),
    )
    check(`${dir} 3. All rules is picked at first`, (await folderBtn(page, '').getAttribute('aria-pressed')) === 'true')
    await folderBtn(page, 'Chronic care').click()
    await page.waitForFunction(() => document.querySelectorAll('[data-guards-grid] .ag-row').length === 3, null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 3. Chronic care keeps its rules and its sub-folder's`, JSON.stringify(await shownIds(page)) === JSON.stringify(['G-002', 'G-004', 'G-005']), JSON.stringify(await shownIds(page)))
    check(`${dir} 3. the pick lands in the URL and is pressed`, new URL(page.url()).searchParams.get('folder') === 'Chronic care' && (await folderBtn(page, 'Chronic care').getAttribute('aria-pressed')) === 'true')
    check(`${dir} 3. "n / m" is one ltr isolate`, (await page.locator('[data-shown] bdi[dir="ltr"]').innerText()) === '3 / 11')
    await folderBtn(page, 'Specialty medicines/GLP-1').click()
    await page.waitForFunction(() => document.querySelectorAll('[data-guards-grid] .ag-row').length === 2, null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 3. a sub-folder keeps only its rules`, JSON.stringify(await shownIds(page)) === JSON.stringify(['G-003', 'G-007']), JSON.stringify(await shownIds(page)))
    await folderBtn(page, '').click()
    await page.waitForFunction(() => document.querySelectorAll('[data-guards-grid] .ag-row').length === 11, null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 3. All rules clears the pick`, (await shownIds(page)).length === 11 && !new URL(page.url()).searchParams.has('folder'))
    check(`${dir} 3. no raw keys on the list`, await noRawKeys(page))

    // ── 4: a row → the rule read as sentences ────────────────────────────────────────────────
    await folderBtn(page, 'Specialty medicines/GLP-1').click()
    await page.waitForFunction(() => document.querySelectorAll('[data-guards-grid] .ag-row').length === 2, null, { timeout: 5000 }).catch(() => {})
    await rowOf(page, 'G-007').locator('[col-id="folder"]').click()
    await page.locator('[data-block-then]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 4. the row opens /insurance-rules/guards/G-007`, new URL(page.url()).pathname === '/insurance-rules/guards/G-007', page.url())
    check(`${dir} 4. one read of the ruleset`, reads.draft === 1, JSON.stringify(reads))
    const header = page.locator('[data-rule-header]')
    check(`${dir} 4. the id is an ltr isolate; live; Override`, (await header.locator('[data-rule-id] bdi[dir="ltr"]').innerText()) === 'G-007' && (await header.locator('[data-state]').getAttribute('data-state')) === 'live' && (await header.locator('[data-severity]').getAttribute('data-severity')) === 'OVERRIDE')
    check(`${dir} 4. both names; the Arabic one right to left`, strip(await header.locator('[data-says-en]').innerText()) === 'GLP-1 without a diabetes diagnosis' && (await header.locator('bdi[data-says-ar][dir="rtl"]').innerText()) === 'GLP-1 بدون تشخيص سكري')
    const when = await page.locator('[data-block-when] [data-sentence]').evaluateAll((els) => els.map((e) => e.textContent.replace(/[\u2066-\u2069]/g, '')))
    check(`${dir} 4. WHEN reads channels, stores and window`, JSON.stringify(when) === JSON.stringify(['Checked before a request is sent on NPHIES, Waseel, OMS, and Bupa, at every store', 'From 2026-09-01, with no end']), JSON.stringify(when))
    const ifBlock = page.locator('[data-block-if]')
    const tree = await ifBlock.locator('li').evaluateAll((els) => els.map((e) => `${e.getAttribute('data-check')}:${e.getAttribute('data-not')}:${e.querySelector(':scope > [data-sentence]').textContent.replace(/[\u2066-\u2069]/g, '')}`))
    check(
      `${dir} 4. IF: All of, NOT on a leaf, a NOT Any of reads none of`,
      JSON.stringify(tree) ===
        JSON.stringify([
          'group:false:all of these are true',
          'line:false:the item is in GLP-1 and biologics',
          "formulary:true:it is not true that the line's diagnosis is on the formulary for the item",
          'group:true:none of these is true',
          'patient:false:the patient is on the patient list PL-VIP',
          'policy:false:the policy is on the policy list PO-EXT',
        ]),
      JSON.stringify(tree),
    )
    check(`${dir} 4. a group's conditions are nested under it`, (await ifBlock.locator('[data-conditions="2"] li').count()) === 2)
    check(`${dir} 4. a list id is an ltr isolate, a list name a <bdi>`, (await ifBlock.locator('li[data-check="patient"] [data-value="code"] bdi[dir="ltr"]').innerText()) === 'PL-VIP' && (await ifBlock.locator('li[data-check="line"] [data-value="says"] bdi').innerText()) === 'GLP-1 and biologics')
    check(`${dir} 4. an unknown fact warns`, strip(await page.locator('[data-on-unknown]').innerText()) === 'If a fact is unknown, the pharmacist is warned.')
    const then = page.locator('[data-block-then] [data-effect="OVERRIDE"]')
    check(`${dir} 4. THEN: Override lets the pharmacist go on with a reason`, strip(await then.locator('[data-sentence]').innerText()) === 'let the pharmacist go on with a reason')
    check(`${dir} 4. THEN: the EN message, and the AR one right to left in a <bdi>`, strip(await then.locator('[data-message] [data-says-en]').innerText()) === 'GLP-1 without a diabetes diagnosis' && (await then.locator('[data-message] bdi[data-says-ar][dir="rtl"]').innerText()) === 'GLP-1 بدون تشخيص سكري')
    const codes = await then.locator('[data-codes] bdi[dir="ltr"]').allInnerTexts()
    check(`${dir} 4. THEN: the codes, each an ltr isolate`, strip(await then.locator('[data-codes]').innerText()) === 'conflict code DC · NPHIES code CV-4-5' && JSON.stringify(codes) === JSON.stringify(['DC', 'CV-4-5']), JSON.stringify(codes))
    check(`${dir} 4. no raw keys on the rule`, await noRawKeys(page))
    await page.locator('[data-back]').click()
    await page.locator(`${grid} .ag-row`).first().waitFor({ timeout: 10000 }).catch(() => {})
    await page.waitForFunction(() => document.querySelectorAll('[data-guards-grid] .ag-row').length === 2, null, { timeout: 5000 }).catch(() => {})
    check(`${dir} 4. Back returns to the folder it was left in`, new URL(page.url()).searchParams.get('folder') === 'Specialty medicines/GLP-1' && JSON.stringify(await shownIds(page)) === JSON.stringify(['G-003', 'G-007']), page.url())

    // ── 5: a supply rule, a shadow rule, an unknown id ───────────────────────────────────────
    await page.goto(`${BASE}/insurance-rules/guards/G-002`)
    await page.locator('[data-block-if] li').first().waitFor({ timeout: 20000 })
    const clauses = await page.locator('[data-block-if] [data-clause]').evaluateAll((els) => els.map((e) => e.textContent.replace(/[\u2066-\u2069]/g, '').replace(/^; /, '')))
    check(
      `${dir} 5. a supply rule reads its clauses`,
      JSON.stringify(clauses) === JSON.stringify(['7 days for Controlled drugs', 'early refills add up to 10 spare days over 90 days', 'a supply of unknown length counts as 30 days']),
      JSON.stringify(clauses),
    )
    check(`${dir} 5. its stores are named`, strip(await page.locator('[data-block-when] [data-sentence]').first().innerText()) === 'Checked before a request is sent on NPHIES and Waseel, at stores P001 and P019')
    await page.goto(`${BASE}/insurance-rules/guards/G-003`)
    await page.locator('[data-shadow-since]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 5. a shadow rule says since when, and its suggestion`, strip(await page.locator('[data-shadow-since]').innerText()) === '2026-10-15' && strip(await page.locator('[data-suggest]').innerText()) === 'suggest at most {remaining} units')
    await page.goto(`${BASE}/insurance-rules/guards/G-999`)
    await page.locator('[data-rule-not-found]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 5. an unknown id says so`, strip(await page.locator('[data-rule-not-found]').innerText()) === 'No guard rule has this id: G-999')
    check(`${dir} 7. no page errors`, errors.length === 0, errors.join(' | '))
    await context.close()
  }

  // ── 6: a bare 403 on either read ─────────────────────────────────────────────────────────────
  {
    const { context, page } = await open(dir, { deny: ['guards', 'draft'] })
    await page.goto(`${BASE}/insurance-rules/guards`)
    await page.locator('[data-guards-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the list → "You do not have access", never an empty grid`, (await page.locator('[data-guards-denied]').count()) === 1 && strip(await page.locator('[data-guards-denied]').innerText()).startsWith('You do not have access') && (await page.locator(`${grid}, [data-guards-empty]`).count()) === 0)
    await page.goto(`${BASE}/insurance-rules/guards/G-007`)
    await page.locator('[data-rule-denied]').waitFor({ timeout: 20000 }).catch(() => {})
    check(`${dir} 6. a bare 403 on the ruleset → "You do not have access"`, (await page.locator('[data-rule-denied]').count()) === 1)
    await context.close()
  }
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
