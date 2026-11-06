// Authz batch pickers drive (spec 805). Mocked `AuthzAdminWeb/*`, real app, real browser (the
// tools/ua-bulk-create-drive.mjs idiom). Run in LTR and again with `dir="rtl"`.
//
// Ticket 806 — a composite's Add member dialog:
//   1. search `PHARM` narrows by name AND description, offers only singles that are not yet members;
//   2. Select all shown + Add 3 writes one Roles/AddMember per pick, in pick order, past a refusal;
//   3. the dialog stays open with "2 added, 1 refused", names the refused role with the server's
//      message, keeps it ticked, and the added roles leave the list;
//   4. Add 1 retries just the refused role and it succeeds;
//   5. role codes are isolated LTR (bidi rule) in both directions.
//
//   1. run the app:  npx vite --port 5199
//   2. node tools/authz-batch-drive.mjs          (DRIVE_PORT=<port> for another port)
import { createRequire } from 'node:module'

const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')
const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}
// fsi() isolates reach textContent; compare the words a person reads.
const plain = (s) => (s ?? '').replace(/[\u2066-\u2069]/g, '').replace(/\s+/g, ' ').trim()

const envelope = (data) => ({
  status: 200,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }),
})
const refusal = (status, message) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({ statusCode: status, success: false, message, errors: [], data: null }),
})

const COMPOSITE = 'TEAM_PHARM'
const REFUSAL = 'PHARM_TECH is outside your assignable scope.'
const single = (roleName, description) => ({ roleName, description, isComposite: false, directHolderCount: 1, isProtected: false })
const CATALOG = [
  { roleName: COMPOSITE, description: 'Branch pharmacy team', isComposite: true, directHolderCount: 4, isProtected: false },
  { roleName: 'PHARM_COMPOSITE', description: 'Another composite', isComposite: true, directHolderCount: 0, isProtected: false },
  single('PHARM_LEAD', 'Leads a branch'),
  single('PHARM_TECH', 'Technician'),
  single('DISPENSER', 'Dispenses at the pharmacy counter'), // matched by its description
  single('PHARM_OLD', 'Already a member'),
  single('OMS_VIEWER', 'Read the OMS screens'),
]

let members
let refuseTech
let calls

async function drive(browser, dir) {
  members = ['PHARM_OLD']
  refuseTech = true
  calls = []
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))

  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const path = decodeURIComponent(req.url().split('/api/')[1].split('?')[0])
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'AuthzAdminWeb/Access')
      return route.fulfill(
        envelope({ screenAllowed: true, canManageRoles: true, canManageUsers: true, assignableRoles: ['*'], revocableRoles: ['*'] }),
      )
    if (path === 'AuthzAdminWeb/Roles') return route.fulfill(envelope(CATALOG))
    if (path === 'AuthzAdminWeb/Roles/AddMember') {
      const body = JSON.parse(req.postData() || '{}')
      calls.push(`${body.compositeRoleName}+${body.singleRoleName}`)
      if (body.singleRoleName === 'PHARM_TECH' && refuseTech) {
        refuseTech = false
        return route.fulfill(refusal(403, REFUSAL))
      }
      if (!members.includes(body.singleRoleName)) members.push(body.singleRoleName)
      return route.fulfill(envelope({ success: true }))
    }
    if (path === 'AuthzAdminWeb/Employees')
      return route.fulfill(envelope({ rows: [], totalMatches: 0, rowCap: 50, isCapped: false }))
    if (/^AuthzAdminWeb\/Roles\/[^/]+\/Holders$/.test(path)) return route.fulfill(envelope([]))
    const role = /^AuthzAdminWeb\/Roles\/([^/]+)$/.exec(path)
    if (role) {
      const r = CATALOG.find((x) => x.roleName === role[1])
      if (!r) return route.fulfill(refusal(404, 'Unknown role.'))
      return route.fulfill(
        envelope({
          ...r,
          memberSingleRoleNames: r.roleName === COMPOSITE ? [...members] : [],
          boundGrants: [],
        }),
      )
    }
    if (path === 'AuthzAdminWeb/Audit' || path === 'AuthzAdminWeb/Grants') return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const tag = `[${dir}]`
  await page.goto(BASE + '/admin/authz')
  await page.waitForSelector('[data-authz-workspace="roles"]', { timeout: 20000 })
  await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir)
  await page.click('[data-authz-workspace="roles"]')
  await page.locator('button', { hasText: COMPOSITE }).first().click()
  await page.getByRole('button', { name: /Add member role/ }).click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-checklist-search]').waitFor({ timeout: 10000 })

  const rows = () => dialog.locator('[data-checklist-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-checklist-row')))
  const before = await rows()
  check(`${tag} the list offers singles only, members left out`, JSON.stringify(before) === JSON.stringify(['PHARM_LEAD', 'PHARM_TECH', 'DISPENSER', 'OMS_VIEWER']), before.join(','))

  // 1. narrow
  await dialog.locator('[data-checklist-search]').fill('PHARM')
  const shown = await rows()
  check(`${tag} search PHARM narrows by name and description`, JSON.stringify(shown) === JSON.stringify(['PHARM_LEAD', 'PHARM_TECH', 'DISPENSER']), shown.join(','))
  await dialog.locator('[data-checklist-search]').fill('nothing-like-this')
  check(`${tag} a search that matches nothing says so`, plain(await dialog.locator('[data-checklist-status]').textContent()) === 'No single role matches this search.')
  await dialog.locator('[data-checklist-search]').fill('PHARM')

  // 2. select all shown + Add 3
  await dialog.locator('[data-checklist-select-all]').click()
  const submit = page.getByTestId('add-member-submit')
  check(`${tag} the footer states the count`, plain(await submit.textContent()) === 'Add 3', plain(await submit.textContent()))
  check(`${tag} the picked count reads 3`, plain(await dialog.locator('[data-checklist-count]').textContent()) === '3 picked')
  await submit.click()
  const summary = page.getByTestId('add-member-summary')
  await summary.waitFor({ timeout: 10000 })
  await page.waitForTimeout(300) // the re-read lands

  check(`${tag} one AddMember per pick, in pick order, past the refusal`,
    JSON.stringify(calls) === JSON.stringify([`${COMPOSITE}+PHARM_LEAD`, `${COMPOSITE}+PHARM_TECH`, `${COMPOSITE}+DISPENSER`]), calls.join(','))
  // 3. summary + refused kept ticked
  const firstLine = plain(await summary.locator('p').first().textContent())
  check(`${tag} the dialog says "2 added, 1 refused"`, firstLine === '2 added, 1 refused', firstLine)
  const refusedLine = plain(await summary.locator('[data-refused="PHARM_TECH"]').textContent())
  check(`${tag} the refused role is named with the server's message`, refusedLine.includes('PHARM_TECH') && refusedLine.includes(REFUSAL), refusedLine)
  const after = await rows()
  check(`${tag} added roles leave the list; the refused one stays`, JSON.stringify(after) === JSON.stringify(['PHARM_TECH']), after.join(','))
  check(`${tag} the refused role is still ticked`,
    (await dialog.locator('[data-checklist-row="PHARM_TECH"]').getAttribute('data-picked')) === 'true' &&
    (await dialog.locator('[data-checklist-row="PHARM_TECH"] input[type=checkbox]').isChecked()))
  check(`${tag} the role code is isolated LTR`,
    (await dialog.locator('[data-checklist-row="PHARM_TECH"] bdi[dir="ltr"]', { hasText: 'PHARM_TECH' }).count()) === 1)

  // 4. retry
  check(`${tag} the footer now reads Add 1`, plain(await submit.textContent()) === 'Add 1')
  await submit.click()
  await page.waitForFunction(
    () => /1 added, 0 refused/.test((document.querySelector('[data-testid="add-member-summary"]')?.textContent ?? '').replace(/[\u2066-\u2069]/g, '')),
    null,
    { timeout: 10000 },
  )
  await page.waitForTimeout(300)
  check(`${tag} the retry sends only the refused role`, calls.length === 4 && calls[3] === `${COMPOSITE}+PHARM_TECH`, calls.join(','))
  check(`${tag} the retried role leaves the list`, (await rows()).length === 0)
  check(`${tag} the footer is disabled with nothing picked`, await submit.isDisabled())

  // Close: the composite's Members tab shows the new members.
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(200)
  const memberText = await page.locator('main').textContent()
  check(`${tag} the Members tab lists every added role`,
    ['PHARM_LEAD', 'PHARM_TECH', 'DISPENSER'].every((m) => memberText.includes(m)))
  check(`${tag} no page errors`, pageErrors.length === 0, pageErrors.join(' | '))
  await page.close()
}

const browser = await chromium.launch()
try {
  for (const dir of ['ltr', 'rtl']) await drive(browser, dir)
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
