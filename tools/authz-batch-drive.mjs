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
// Ticket 810 — the New role dialog's composite members (see driveNewComposite below).
//
// Ticket 809 — a person's Assign roles dialog:
//   1. full scope offers the whole catalog minus held roles, each tagged with its kind;
//   2. picks survive a change of search; search + tick 3, Assign 3 writes one Users/AssignRole per
//      pick, in pick order, past a refusal;
//   3. the dialog stays open with "2 assigned, 1 refused", the refused role named and still ticked;
//   4. the person's chips show the two assigned roles;
//   5. a delegated admin is offered only their assignable roles.
//
// Ticket 807 — a role's Held by tab, Add holders:
//   search `ahmed` tick 2 (the current holder is disabled "Already holds", the inactive person is tagged
//   and pickable), search `khalid` tick 1 → 3 chips; a capped result says to narrow; Assign to 3 with one
//   stubbed refusal → "2 assigned, 1 refused", the Held by list shows the two; the button is absent for a
//   role outside a delegated scope.
//
// Ticket 808 — Paste IDs in Add holders (see the end of driveHolders):
//   paste 5 IDs (one repeated, one unknown, one current holder, one prefix of another) → one Employees
//   lookup per distinct non-holder ID; 2 chips with names (the prefix picks only its exact match), 1
//   reported "already holds", 1 listed back as not found; Assign to 2 assigns both.
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

// Ticket 810 — the New role dialog, creating a composite with its members picked up front:
//   1. choosing Composite shows the picker, offering single roles only;
//   2. 4 picks + Create send ONE Roles/CreateComposite carrying those 4, in pick order;
//   3. a refused create keeps the dialog open, says why, and keeps the 4 picks;
//   4. the retry creates it, the dialog closes and the new role's Members tab lists the 4.
const NEW_COMPOSITE = 'TEAM_NEW'
const CREATE_REFUSAL = 'A role with this name was just created by someone else.'
const NEW_PICKS = ['PHARM_LEAD', 'DISPENSER', 'OMS_VIEWER', 'PHARM_TECH']

async function driveNewComposite(browser, dir) {
  const catalog = CATALOG.map((r) => ({ ...r }))
  const created = new Map() // roleName → member singles
  const bodies = []
  let refuseCreate = true
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
    if (path === 'AuthzAdminWeb/Roles') return route.fulfill(envelope(catalog))
    if (path === 'AuthzAdminWeb/Roles/CreateComposite') {
      const body = JSON.parse(req.postData() || '{}')
      bodies.push(body)
      if (refuseCreate) {
        refuseCreate = false
        return route.fulfill(refusal(409, CREATE_REFUSAL))
      }
      catalog.push({ roleName: body.roleName, description: body.description, isComposite: true, directHolderCount: 0, isProtected: false })
      created.set(body.roleName, [...body.memberSingleRoleNames])
      return route.fulfill(envelope({ success: true }))
    }
    if (path === 'AuthzAdminWeb/Employees')
      return route.fulfill(envelope({ rows: [], totalMatches: 0, rowCap: 50, isCapped: false }))
    if (/^AuthzAdminWeb\/Roles\/[^/]+\/Holders$/.test(path)) return route.fulfill(envelope([]))
    const role = /^AuthzAdminWeb\/Roles\/([^/]+)$/.exec(path)
    if (role) {
      const r = catalog.find((x) => x.roleName === role[1])
      if (!r) return route.fulfill(refusal(404, 'Unknown role.'))
      return route.fulfill(envelope({ ...r, memberSingleRoleNames: created.get(r.roleName) ?? [], boundGrants: [] }))
    }
    if (path === 'AuthzAdminWeb/Audit' || path === 'AuthzAdminWeb/Grants') return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const tag = `[${dir}] new composite:`
  await page.goto(BASE + '/admin/authz')
  await page.waitForSelector('[data-authz-workspace="roles"]', { timeout: 20000 })
  await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir)
  await page.click('[data-authz-workspace="roles"]')
  await page.click('[data-authz-new-role]')
  const dialog = page.locator('dialog[open]')
  await dialog.locator('select').waitFor({ timeout: 10000 })
  check(`${tag} a single role shows no member picker`, (await dialog.locator('[data-checklist-search]').count()) === 0)

  // 1. composite → the picker, singles only
  await dialog.locator('select').selectOption('composite')
  await dialog.locator('[data-checklist-search]').waitFor({ timeout: 5000 })
  const rows = await dialog.locator('[data-checklist-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-checklist-row')))
  check(`${tag} the picker offers single roles only`,
    JSON.stringify(rows) === JSON.stringify(['PHARM_LEAD', 'PHARM_TECH', 'DISPENSER', 'PHARM_OLD', 'OMS_VIEWER']), rows.join(','))

  await dialog.getByPlaceholder('e.g. WAREHOUSE_LEAD').fill(NEW_COMPOSITE.toLowerCase())
  await dialog.getByPlaceholder('What this role is for').fill('New branch team')
  for (const r of NEW_PICKS) await dialog.locator(`[data-checklist-row="${r}"] input[type=checkbox]`).check()
  check(`${tag} the picked count reads 4`, plain(await dialog.locator('[data-checklist-count]').textContent()) === '4 picked')
  const submit = page.getByTestId('new-role-submit')
  check(`${tag} the footer states the member count`, plain(await submit.textContent()) === 'Create with 4 members', plain(await submit.textContent()))

  // 2+3. a refused create: one write with the 4, the dialog stays, the picks stay
  await submit.click()
  await page.getByTestId('new-role-error').waitFor({ timeout: 10000 })
  check(`${tag} one CreateComposite carrying the 4 picks in order`,
    bodies.length === 1 && bodies[0].roleName === NEW_COMPOSITE &&
    JSON.stringify(bodies[0].memberSingleRoleNames) === JSON.stringify(NEW_PICKS), JSON.stringify(bodies))
  check(`${tag} the refusal is shown in the dialog with the server's message`,
    plain(await page.getByTestId('new-role-error').textContent()).includes(CREATE_REFUSAL))
  check(`${tag} the dialog stays open`, (await dialog.count()) === 1)
  const kept = await dialog.locator('[data-checklist-row][data-picked="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-checklist-row')))
  check(`${tag} the 4 picks are kept`, kept.length === 4 && NEW_PICKS.every((p) => kept.includes(p)), kept.join(','))
  check(`${tag} the role code is isolated LTR`,
    (await dialog.locator('[data-checklist-row="DISPENSER"] bdi[dir="ltr"]', { hasText: 'DISPENSER' }).count()) === 1)

  // 4. retry → created complete
  await submit.click()
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 10000 })
  await page.waitForTimeout(400)
  check(`${tag} the retry sends the same 4`,
    bodies.length === 2 && JSON.stringify(bodies[1].memberSingleRoleNames) === JSON.stringify(NEW_PICKS))
  const memberText = await page.locator('main').textContent()
  check(`${tag} the new role's Members tab lists the 4`,
    memberText.includes(NEW_COMPOSITE) && NEW_PICKS.every((m) => memberText.includes(m)))

  // A composite with no picks still creates.
  await page.click('[data-authz-new-role]')
  await dialog.locator('select').selectOption('composite')
  await dialog.getByPlaceholder('e.g. WAREHOUSE_LEAD').fill('TEAM_EMPTY')
  check(`${tag} with no picks the footer reads Create role`, plain(await submit.textContent()) === 'Create role')
  await submit.click()
  await page.waitForFunction(() => !document.querySelector('dialog[open]'), null, { timeout: 10000 })
  check(`${tag} a composite with no picks is created empty`,
    bodies.length === 3 && bodies[2].roleName === 'TEAM_EMPTY' && bodies[2].memberSingleRoleNames.length === 0)
  check(`${tag} no page errors`, pageErrors.length === 0, pageErrors.join(' | '))
  await page.close()
}

const PERSON = { employeeId: '40123', displayName: 'Huda Saleh', phone: '', phoneClass: 'missing', email: '',
  deliveryChannel: 'sms', isActive: true, isSeeded: false, credentialState: 'active', isTotpEnrolled: false, lastLoginAt: null }
const ASSIGN_REFUSAL = 'PHARM_TECH is outside your assignable scope.'

async function driveAssign(browser, dir, assignableRoles) {
  const delegated = !assignableRoles.includes('*')
  const held = ['OMS_VIEWER']
  let refuse = true
  const assigns = []
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
        envelope({ screenAllowed: true, canManageRoles: true, canManageUsers: true, assignableRoles, revocableRoles: assignableRoles }),
      )
    if (path === 'AuthzAdminWeb/Roles') return route.fulfill(envelope(CATALOG))
    if (path === 'AuthzAdminWeb/Employees')
      return route.fulfill(envelope({ rows: [PERSON], totalMatches: 1, rowCap: 50, isCapped: false }))
    if (path === `AuthzAdminWeb/Users/${PERSON.employeeId}/Roles`) return route.fulfill(envelope([...held]))
    if (path === 'AuthzAdminWeb/Users/AssignRole') {
      const body = JSON.parse(req.postData() || '{}')
      assigns.push(`${body.userId}+${body.roleName}`)
      if (body.roleName === 'PHARM_TECH' && refuse) {
        refuse = false
        return route.fulfill(refusal(403, ASSIGN_REFUSAL))
      }
      if (!held.includes(body.roleName)) held.push(body.roleName)
      return route.fulfill(envelope({ success: true }))
    }
    if (path.endsWith('/EffectiveAuthorizations') || path === 'AuthzAdminWeb/Audit') return route.fulfill(envelope([]))
    return route.fulfill(envelope({}))
  })

  const tag = `[${dir}${delegated ? ' delegated' : ''}]`
  await page.goto(BASE + '/admin/authz')
  await page.waitForSelector('[data-authz-workspace="users"]', { timeout: 20000 })
  await page.evaluate((d) => document.documentElement.setAttribute('dir', d), dir)
  await page.click('[data-authz-workspace="users"]')
  await page.locator('[data-authz-users-search]').fill(PERSON.employeeId)
  await page.click('[data-authz-users-run]')
  await page.locator('tr', { hasText: PERSON.displayName }).first().click()
  await page.getByRole('button', { name: /Assign roles/ }).click()
  const dialog = page.locator('dialog[open]')
  await dialog.locator('[data-checklist-search]').waitFor({ timeout: 10000 })
  const rows = () => dialog.locator('[data-checklist-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-checklist-row')))

  if (delegated) {
    const offered = await rows()
    check(`${tag} a delegated admin is offered only their assignable roles, held left out`,
      JSON.stringify(offered) === JSON.stringify(['PHARM_LEAD', 'PHARM_TECH']), offered.join(','))
    check(`${tag} no page errors`, pageErrors.length === 0, pageErrors.join(' | '))
    await page.close()
    return
  }

  const offered = await rows()
  check(`${tag} full scope offers the whole catalog minus held roles`,
    JSON.stringify(offered) === JSON.stringify(['TEAM_PHARM', 'PHARM_COMPOSITE', 'PHARM_LEAD', 'PHARM_TECH', 'DISPENSER', 'PHARM_OLD']), offered.join(','))
  check(`${tag} a composite row is tagged with its kind`,
    plain(await dialog.locator('[data-checklist-row="TEAM_PHARM"]').textContent()).includes('composite'))

  // search + tick across three searches; picks survive each new term
  const search = dialog.locator('[data-checklist-search]')
  for (const [term, role] of [['leads', 'PHARM_LEAD'], ['technician', 'PHARM_TECH'], ['team', 'TEAM_PHARM']]) {
    await search.fill(term)
    await dialog.locator(`[data-checklist-row="${role}"] input[type=checkbox]`).check()
  }
  check(`${tag} the search narrows by description`, JSON.stringify(await rows()) === JSON.stringify(['TEAM_PHARM']))
  check(`${tag} the picked count reads 3 across searches`, plain(await dialog.locator('[data-checklist-count]').textContent()) === '3 picked')
  const submit = page.getByTestId('assign-role-submit')
  check(`${tag} the footer states the count`, plain(await submit.textContent()) === 'Assign 3', plain(await submit.textContent()))
  await search.fill('')
  await submit.click()
  const summary = page.getByTestId('assign-role-summary')
  await summary.waitFor({ timeout: 10000 })
  await page.waitForTimeout(300)

  check(`${tag} one AssignRole per pick, in pick order, past the refusal`,
    JSON.stringify(assigns) === JSON.stringify(['40123+PHARM_LEAD', '40123+PHARM_TECH', '40123+TEAM_PHARM']), assigns.join(','))
  const firstLine = plain(await summary.locator('p').first().textContent())
  check(`${tag} the dialog stays open with "2 assigned, 1 refused"`, firstLine === '2 assigned, 1 refused', firstLine)
  const refusedLine = plain(await summary.locator('[data-refused="PHARM_TECH"]').textContent())
  check(`${tag} the refused role is named with the server's message`, refusedLine.includes('PHARM_TECH') && refusedLine.includes(ASSIGN_REFUSAL), refusedLine)
  check(`${tag} the refused role is still ticked`,
    (await dialog.locator('[data-checklist-row="PHARM_TECH"]').getAttribute('data-picked')) === 'true')
  const after = await rows()
  check(`${tag} assigned roles leave the list`, !after.includes('PHARM_LEAD') && !after.includes('TEAM_PHARM') && after.includes('PHARM_TECH'), after.join(','))
  check(`${tag} the role code is isolated LTR`,
    (await dialog.locator('[data-checklist-row="PHARM_TECH"] bdi[dir="ltr"]', { hasText: 'PHARM_TECH' }).count()) === 1)
  check(`${tag} the footer now reads Assign 1`, plain(await submit.textContent()) === 'Assign 1')

  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(200)
  const chips = await page.locator('[data-assigned-role]').evaluateAll((els) => els.map((e) => e.getAttribute('data-assigned-role')))
  check(`${tag} the person's chips show the two assigned roles`,
    JSON.stringify(chips) === JSON.stringify(['OMS_VIEWER', 'PHARM_LEAD', 'TEAM_PHARM']), chips.join(','))
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
  // Paste IDs (808): the search is a contains-match, so `4012` also brings back `40123`.
  4012: [person('40123', 'Huda Saleh'), person('4012', 'Sara Nabil')],
  40123: [person('40123', 'Huda Saleh')],
}
const CAPPED = Array.from({ length: 50 }, (_, i) => person(String(30000 + i), `Person ${i}`))

async function driveHolders(browser, dir, assignableRoles) {
  let holders = [{ userId: '10003', displayName: 'Ahmed Omar', isActive: true }]
  const assigns = []
  const lookups = []
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
      lookups.push(term)
      if (term === 'person') return route.fulfill(envelope({ rows: CAPPED, totalMatches: 120, rowCap: 50, isCapped: true }))
      const rows = PEOPLE[term] ?? []
      return route.fulfill(envelope({ rows, totalMatches: rows.length, rowCap: 50, isCapped: false }))
    }
    if (path === 'AuthzAdminWeb/Users/AssignRole') {
      const body = JSON.parse(req.postData() || '{}')
      assigns.push(`${body.userId}+${body.roleName}`)
      if (body.userId === '10002') return route.fulfill(refusal(403, HOLDER_REFUSAL))
      const p = Object.values(PEOPLE).flat().find((x) => x.employeeId === body.userId)
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

  // ── 808: Paste IDs ── 4012 is a prefix of 40123, 4012 is repeated, 10001 now holds, 55555 is nobody.
  await page.getByTestId('add-holders-open').click()
  await search.waitFor({ timeout: 10000 })
  await page.getByTestId('add-holders-paste-open').click()
  const box = page.getByTestId('holders-paste-box')
  await box.waitFor({ timeout: 10000 })
  await box.fill('4012\n40123, 4012\t10001 55555')
  const meter = (await page.getByTestId('holders-paste-meter').locator('span').allTextContents()).map(plain)
  check(`${tag} paste: the meter counts 4 to look up, 1 repeat skipped`,
    JSON.stringify(meter) === JSON.stringify(['4 IDs to look up', '1 repeated or already picked']), meter.join(' | '))
  lookups.length = 0
  assigns.length = 0
  await page.getByTestId('holders-paste-ok').click()
  const report = page.getByTestId('add-holders-paste-report')
  await report.waitFor({ timeout: 10000 })
  check(`${tag} paste: one Employees lookup per distinct ID that does not hold the role`,
    JSON.stringify(lookups) === JSON.stringify(['4012', '40123', '55555']), lookups.join(','))
  const pasteChips = await dialog.locator('[data-checklist-chips] [data-chip]').evaluateAll((els) => els.map((e) => e.getAttribute('data-chip')))
  check(`${tag} paste: 2 chips, the prefix matched exactly`, JSON.stringify(pasteChips) === JSON.stringify(['4012', '40123']), pasteChips.join(','))
  check(`${tag} paste: each chip carries the person's name`,
    plain(await dialog.locator('[data-chip="4012"]').textContent()).includes('Sara Nabil') &&
    plain(await dialog.locator('[data-chip="40123"]').textContent()).includes('Huda Saleh'))
  check(`${tag} paste: the chip's ID · name is isolated LTR`,
    (await dialog.locator('[data-chip="4012"] bdi[dir="ltr"]', { hasText: '4012 · Sara Nabil' }).count()) === 1)
  const outcomeIds = (kind) => report.locator(`[data-paste="${kind}"] [data-paste-id]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-paste-id')))
  check(`${tag} paste: the report says 2 added to the picks`, plain(await report.locator('[data-paste="found"]').textContent()) === '2 added to the picks')
  check(`${tag} paste: the current holder is reported, not picked`, JSON.stringify(await outcomeIds('already-holds')) === JSON.stringify(['10001']))
  check(`${tag} paste: the unknown ID is listed back`, JSON.stringify(await outcomeIds('not-found')) === JSON.stringify(['55555']))
  check(`${tag} paste: a listed ID is isolated LTR`,
    (await report.locator('[data-paste="not-found"] bdi[dir="ltr"]', { hasText: '55555' }).count()) === 1)
  check(`${tag} paste: the footer reads Assign to 2`, plain(await submit.textContent()) === 'Assign to 2', plain(await submit.textContent()))
  await submit.click()
  await page.waitForFunction(
    () => /2 assigned, 0 refused/.test((document.querySelector('[data-testid="add-holders-summary"]')?.textContent ?? '').replace(/[⁦-⁩]/g, '')),
    null,
    { timeout: 10000 },
  ).catch(() => {})
  check(`${tag} paste: Assign to 2 assigns both found people`,
    JSON.stringify(assigns) === JSON.stringify([`4012+${HELD_ROLE}`, `40123+${HELD_ROLE}`]), assigns.join(','))
  check(`${tag} paste: the dialog says "2 assigned, 0 refused"`,
    plain(await page.getByTestId('add-holders-summary').locator('p').first().textContent()) === '2 assigned, 0 refused')
  await page.getByRole('button', { name: 'Done' }).click()
  await page.waitForTimeout(300)
  check(`${tag} paste: the Held by list shows the pasted people`,
    plain(await page.locator('main').textContent()).includes('Sara Nabil') && plain(await page.locator('main').textContent()).includes('Huda Saleh'))
  check(`${tag} no page errors`, pageErrors.length === 0, pageErrors.join(' | '))
  await page.close()
}

const browser = await chromium.launch()
try {
  for (const dir of ['ltr', 'rtl']) {
    await drive(browser, dir)
    await driveNewComposite(browser, dir)
    await driveAssign(browser, dir, ['*'])
    await driveAssign(browser, dir, ['PHARM_LEAD', 'PHARM_TECH', 'OMS_VIEWER'])
    await driveHolders(browser, dir, ['*'])
    await driveHolders(browser, dir, ['OMS_VIEWER'])
  }
} finally {
  await browser.close()
}
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
