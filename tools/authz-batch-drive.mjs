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
// Ticket 807 — a role's Held by tab, Add holders:
//   search `ahmed` tick 2 (the current holder is disabled "Already holds", the inactive person is tagged
//   and pickable), search `khalid` tick 1 → 3 chips; a capped result says to narrow; Assign to 3 with one
//   stubbed refusal → "2 assigned, 1 refused", the Held by list shows the two; the button is absent for a
//   role outside a delegated scope.
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

// ── Ticket 807 — a role's Held by tab adds several holders found by searching people ──────────
const HELD_ROLE = 'PHARM_LEAD'
const HOLDER_REFUSAL = 'Ahmed Saleh is outside your delegated scope.'
const person = (employeeId, displayName, isActive = true) => ({
  employeeId, displayName, phone: '', phoneClass: 'missing', email: '', deliveryChannel: 'sms', isActive,
  isSeeded: false, credentialState: 'none', isTotpEnrolled: false, lastLoginAt: null,
})
const PEOPLE = {
  ahmed: [person('10001', 'Ahmed Ali'), person('10002', 'Ahmed Saleh', false), person('10003', 'Ahmed Omar')],
  khalid: [person('20001', 'Khalid Nasser'), person('20002', 'Khalid Fahad')],
}
const CAPPED = Array.from({ length: 50 }, (_, i) => person(String(30000 + i), `Person ${i}`))

async function driveHolders(browser, dir, assignableRoles) {
  let holders = [{ userId: '10003', displayName: 'Ahmed Omar', isActive: true }]
  const assigns = []
  const page = await browser.newPage({ viewport: { width: 1500, height: 950 } })
  const pageErrors = []
  page.on('pageerror', (e) => pageErrors.push(String(e)))
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const url = new URL(req.url())
    const path = decodeURIComponent(req.url().split('/api/')[1].split('?')[0])
    if (path === 'Auth/Me')
      return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: '1001' }))
    if (path === 'AuthzAdminWeb/Access')
      return route.fulfill(
        envelope({ screenAllowed: true, canManageRoles: true, canManageUsers: true, assignableRoles, revocableRoles: assignableRoles }),
      )
    if (path === 'AuthzAdminWeb/Roles') return route.fulfill(envelope(CATALOG))
    if (path === 'AuthzAdminWeb/Employees') {
      const term = (url.searchParams.get('term') || '').toLowerCase()
      if (term === 'person') return route.fulfill(envelope({ rows: CAPPED, totalMatches: 120, rowCap: 50, isCapped: true }))
      const rows = PEOPLE[term] ?? []
      return route.fulfill(envelope({ rows, totalMatches: rows.length, rowCap: 50, isCapped: false }))
    }
    if (path === 'AuthzAdminWeb/Users/AssignRole') {
      const body = JSON.parse(req.postData() || '{}')
      assigns.push(`${body.userId}+${body.roleName}`)
      if (body.userId === '10002') return route.fulfill(refusal(403, HOLDER_REFUSAL))
      const p = [...PEOPLE.ahmed, ...PEOPLE.khalid].find((x) => x.employeeId === body.userId)
      if (!holders.some((h) => h.userId === body.userId))
        holders = [...holders, { userId: body.userId, displayName: p?.displayName ?? '', isActive: p?.isActive ?? true }]
      return route.fulfill(envelope({ success: true }))
    }
    const held = /^AuthzAdminWeb\/Roles\/([^/]+)\/Holders$/.exec(path)
    if (held) return route.fulfill(envelope(held[1] === HELD_ROLE ? holders : []))
    const role = /^AuthzAdminWeb\/Roles\/([^/]+)$/.exec(path)
    if (role) {
      const r = CATALOG.find((x) => x.roleName === role[1])
      if (!r) return route.fulfill(refusal(404, 'Unknown role.'))
      return route.fulfill(
        envelope({
          ...r,
          directHolderCount: r.roleName === HELD_ROLE ? holders.length : r.directHolderCount,
          memberSingleRoleNames: [],
          boundGrants: [],
        }),
      )
    }
    if (path === 'AuthzAdminWeb/Audit' || path === 'AuthzAdminWeb/Grants') return route.fulfill(envelope([]))
    if (/^AuthzAdminWeb\/Users\/[^/]+\/Roles$/.test(path)) return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const scoped = assignableRoles[0] !== '*'
  const tag = `[${dir}${scoped ? ' delegated' : ''}]`
  await page.goto(BASE + '/admin/authz')
  await page.waitForSelector('[data-authz-workspace="roles"]', { timeout: 20000 })
  await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir)
  await page.click('[data-authz-workspace="roles"]')
  await page.locator('button', { hasText: HELD_ROLE }).first().click()
  await page.getByRole('tab', { name: 'Held by' }).click()
  await page.locator('main', { hasText: 'Ahmed Omar' }).waitFor({ timeout: 10000 })

  if (scoped) {
    check(`${tag} Add holders is absent for a role outside the delegated scope`, (await page.getByTestId('add-holders-open').count()) === 0)
    await page.locator('button', { hasText: 'OMS_VIEWER' }).first().click()
    await page.getByRole('tab', { name: 'Held by' }).click()
    await page.getByTestId('add-holders-open').waitFor({ timeout: 10000 }).catch(() => {})
    check(`${tag} Add holders shows for a role inside the delegated scope`, (await page.getByTestId('add-holders-open').count()) === 1)
    check(`${tag} no page errors`, pageErrors.length === 0, pageErrors.join(' | '))
    await page.close()
    return
  }

  await page.getByTestId('add-holders-open').click()
  const dialog = page.locator('dialog[open]')
  const search = dialog.locator('[data-checklist-search]')
  await search.waitFor({ timeout: 10000 })
  const rows = () => dialog.locator('[data-checklist-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-checklist-row')))
  const waitRows = (first) => dialog.locator(`[data-checklist-row="${first}"]`).waitFor({ timeout: 10000 })
  check(`${tag} the empty picker says to type`, plain(await dialog.locator('[data-checklist-status]').textContent()) === 'Type a name or employee ID to search.')

  // search ahmed, tick 2 (select all shown skips the current holder)
  await search.fill('ahmed')
  await waitRows('10001')
  check(`${tag} search ahmed lists three people`, JSON.stringify(await rows()) === JSON.stringify(['10001', '10002', '10003']))
  const holderRow = dialog.locator('[data-checklist-row="10003"]')
  check(`${tag} a current holder is disabled "Already holds"`,
    (await holderRow.getAttribute('data-disabled')) === 'true' &&
    (await holderRow.locator('input[type=checkbox]').isDisabled()) &&
    plain(await holderRow.textContent()).includes('Already holds'))
  check(`${tag} an inactive person is tagged and pickable`,
    plain(await dialog.locator('[data-checklist-row="10002"]').textContent()).includes('Inactive') &&
    !(await dialog.locator('[data-checklist-row="10002"] input[type=checkbox]').isDisabled()))
  check(`${tag} the employee ID · name is isolated LTR`,
    (await dialog.locator('[data-checklist-row="10001"] bdi[dir="ltr"]', { hasText: '10001 · Ahmed Ali' }).count()) === 1)
  await dialog.locator('[data-checklist-select-all]').click()
  check(`${tag} Select all shown ticks the two enabled rows`, plain(await dialog.locator('[data-checklist-count]').textContent()) === '2 picked')

  // search khalid, tick 1 — the picks survive
  await search.fill('khalid')
  await waitRows('20001')
  check(`${tag} a new term shows new rows`, JSON.stringify(await rows()) === JSON.stringify(['20001', '20002']))
  await dialog.locator('[data-checklist-row="20001"] input[type=checkbox]').check()
  const chips = await dialog.locator('[data-checklist-chips] [data-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chip')))
  check(`${tag} three chips across two searches`, JSON.stringify(chips) === JSON.stringify(['10001', '10002', '20001']), chips.join(','))
  check(`${tag} a chip off the current page keeps its name`,
    plain(await dialog.locator('[data-chip="10001"]').textContent()).includes('Ahmed Ali'))

  // the cap note
  await search.fill('person')
  await waitRows('30000')
  check(`${tag} a capped result says to narrow the term`,
    plain(await dialog.locator('[data-checklist-status]').textContent()).includes('narrow the term'))
  await search.fill('khalid')
  await waitRows('20001')

  // Assign to 3, one refused
  const submit = page.getByTestId('add-holders-submit')
  check(`${tag} the footer reads Assign to 3`, plain(await submit.textContent()) === 'Assign to 3', plain(await submit.textContent()))
  await submit.click()
  const summary = page.getByTestId('add-holders-summary')
  await summary.waitFor({ timeout: 10000 })
  await page.waitForTimeout(400) // the re-read lands
  check(`${tag} one AssignRole per person, in pick order, past the refusal`,
    JSON.stringify(assigns) === JSON.stringify([`10001+${HELD_ROLE}`, `10002+${HELD_ROLE}`, `20001+${HELD_ROLE}`]), assigns.join(','))
  const firstLine = plain(await summary.locator('p').first().textContent())
  check(`${tag} the dialog says "2 assigned, 1 refused"`, firstLine === '2 assigned, 1 refused', firstLine)
  const refusedLine = plain(await summary.locator('[data-refused="10002"]').textContent())
  check(`${tag} the refused person is named with the server's message`, refusedLine.includes('Ahmed Saleh') && refusedLine.includes(HOLDER_REFUSAL), refusedLine)
  const leftChips = await dialog.locator('[data-checklist-chips] [data-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chip')))
  check(`${tag} assigned people leave the picks; the refused one stays`, JSON.stringify(leftChips) === JSON.stringify(['10002']), leftChips.join(','))
  check(`${tag} the footer now reads Assign to 1`, plain(await submit.textContent()) === 'Assign to 1')
  check(`${tag} an assigned person now shows "Already holds"`,
    (await dialog.locator('[data-checklist-row="20001"]').getAttribute('data-disabled')) === 'true')

  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(300)
  const held = plain(await page.locator('main').textContent())
  check(`${tag} the Held by list shows the two new holders`, held.includes('Ahmed Ali') && held.includes('Khalid Nasser') && !held.includes('Ahmed Saleh'))
  check(`${tag} the holder count reads 3`, held.includes('3 holders'))
  check(`${tag} no page errors`, pageErrors.length === 0, pageErrors.join(' | '))
  await page.close()
}

const browser = await chromium.launch()
try {
  for (const dir of ['ltr', 'rtl']) await drive(browser, dir)
  for (const dir of ['ltr', 'rtl']) await driveHolders(browser, dir, ['*'])
  for (const dir of ['ltr', 'rtl']) await driveHolders(browser, dir, ['OMS_VIEWER'])
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
