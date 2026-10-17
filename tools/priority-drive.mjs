// Priority drive (spec 2737, ticket 513): Campaigns ▸ Priority, the evaluation order (ADR 0090).
//
// Drives the REAL app in Chromium against STUBS. No HQ contract exists yet (BackOffice 2759 is
// unwritten), so the stubs serve the PROVISIONAL shapes of `src/core/models/rule-campaign.ts` on the
// REAL envelope { statusCode, success, message, errors: [{ errorCode, internalErrorCode,
// errorMessage }], data }; ticket 520 re-points them:
//   GET RuleCampaign/Campaigns  → list rows (tools/campaigns-fixtures.mjs `listRow`)
//   GET RuleCampaign/Order      → the draft order: the prototype's sample tree (data.js `tree`)
//   PUT RuleCampaign/Order      → saves it and answers it, a new group re-keyed with HQ's own id;
//                                 the first `refuseSave` saves are refused
// Never a live SIS.Api.
//
// It asserts:
//   1. the Campaigns group has a Priority leaf, ungated, that opens /campaigns/priority and lights itself;
//   2. the base and its groups in HQ's order, each group's mode and scope, both names, the cascade line;
//   3. Save waits for a change; up is off at the top, down at the bottom; a held group's delete is off;
//   4. Add group adds an empty "first that yields, session" group at the end of the base;
//   5. a campaign moves into the new group with Move to; the group takes a mode, a scope and a name,
//      and moves up as one place; a campaign moves down inside a group;
//   6. a blank group name holds the save;
//   7. leaving with unsaved changes asks first, and Stay keeps them;
//   8. a refused save shows the door's own message and keeps the changes;
//   9. Save PUTs the whole order — every campaign once — and the page reads HQ's answer;
//  10. an emptied group is deleted; Discard puts the saved order back;
//  11. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/priority-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { CAMPAIGNS, listRow } from './campaigns-fixtures.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/campaigns-drive.mjs).
const envelope = (data, { status = 200, success = true, message = '', errorCode } = {}) => ({
  status,
  contentType: 'application/json',
  body: JSON.stringify({
    statusCode: status,
    success,
    message,
    errors: errorCode ? [{ errorCode, errorMessage: message, internalErrorCode: '' }] : [],
    data,
  }),
})

const SAVE_REFUSED = 'An item-scope group holds a campaign with a basket discount. / مجموعة على مستوى الصنف تحتوي حملة بخصم على السلة.'

/** The prototype's sample order (BackOffice `.scratch/proto/2734-rule-builder/data.js`, `tree`). */
const ORDER = {
  base: [{ c: 'PCUT-SA01' }, { g: 'g-items' }, { c: 'GP-BEAUTY15' }, { c: 'BDAY-BEAUTY' }, { c: 'GIFT-POUCH' }, { g: 'g-basket' }, { c: 'BH-SPEND10' }, { c: 'NEXT-VISIT' }, { c: 'WLCB' }, { c: 'PRCB-AUG26' }, { c: 'BASE-EARN' }],
  groups: [
    { id: 'g-items', name: 'Item deals', mode: 'highest', scope: 'item', items: ['SUN-3FOR2', 'BABY-BUNDLE'] },
    { id: 'g-basket', name: 'Basket offers', mode: 'first', scope: 'session', items: ['WKND20', 'PTS-50OFF'] },
  ],
}
const idsOf = (o) => o.base.flatMap((n) => ('c' in n ? [n.c] : (o.groups.find((g) => g.id === n.g)?.items ?? [])))

const browser = await chromium.launch()

async function open({ refuseSave = 0 } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const saves = []
  let order = structuredClone(ORDER)
  let refusals = refuseSave
  let minted = 0
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.clock.setFixedTime(new Date('2026-10-16T18:30:00+03:00'))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.split('/api/')[1]
    calls.push(`${req.method()} ${p}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    // PROVISIONAL doors (ticket 520 re-points them).
    if (p === 'RuleCampaign/Campaigns' && req.method() === 'GET') return route.fulfill(envelope(CAMPAIGNS.map(listRow)))
    if (p === 'RuleCampaign/Order' && req.method() === 'GET') return route.fulfill(envelope(order))
    if (p === 'RuleCampaign/Order' && req.method() === 'PUT') {
      const body = req.postDataJSON()
      saves.push(body)
      if (refusals > 0) {
        refusals--
        return route.fulfill(envelope(null, { status: 409, success: false, message: SAVE_REFUSED, errorCode: 'RULE_ORDER_ITEM_SCOPE' }))
      }
      // HQ keys a new group itself.
      const keys = new Map(body.groups.filter((g) => g.id.startsWith('new-')).map((g) => [g.id, `g-hq${++minted}`]))
      order = {
        base: body.base.map((n) => ('g' in n && keys.has(n.g) ? { g: keys.get(n.g) } : n)),
        groups: body.groups.map((g) => (keys.has(g.id) ? { ...g, id: keys.get(g.id) } : g)),
      }
      return route.fulfill(envelope(order))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, saves, order: () => order }
}

/** Every row's campaign id, top to bottom, and the group each sits in ('base' for none). */
const layout = (page) =>
  page.$$eval('[data-order-row]', (rows) =>
    rows.map((r) => `${r.closest('[data-order-group]')?.getAttribute('data-order-group') ?? 'base'}:${r.getAttribute('data-order-row')}`),
  )
const groupIds = (page) => page.$$eval('[data-order-group]', (els) => els.map((e) => e.getAttribute('data-order-group')))
const row = (page, id) => page.locator(`[data-order-row="${id}"]`)
const group = (page, id) => page.locator(`[data-order-group="${id}"]`)
const saveBtn = (page) => page.locator('[data-save-order]')

{
  const { context, page, errors, calls, saves, order } = await open({ refuseSave: 1 })
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/campaigns/priority"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Priority leaf is in the rail', await leaf.isVisible())
  await leaf.click()
  await page.waitForURL(`${BASE}/campaigns/priority`)
  await page.locator('[data-order-row="BASE-EARN"]').waitFor({ timeout: 15000 })
  check('1: it opens /campaigns/priority and lights itself, not Campaigns',
    (await leaf.getAttribute('aria-current')) === 'page' && (await page.locator('a[href="/campaigns"]').first().getAttribute('aria-current')) !== 'page')
  check('1: ungated — no probe call was made', !calls.some((c) => /RuleCampaign\/Access/.test(c)))

  const start = await layout(page)
  const expected = ORDER.base.flatMap((n) => ('c' in n ? [`base:${n.c}`] : ORDER.groups.find((g) => g.id === n.g).items.map((c) => `${n.g}:${c}`)))
  check('2: the base and its groups in HQ\'s order', JSON.stringify(start) === JSON.stringify(expected), JSON.stringify(start))
  check('2: each group shows its mode and scope',
    (await group(page, 'g-items').locator('[data-group-mode]').inputValue()) === 'highest' &&
      (await group(page, 'g-items').locator('[data-group-scope]').inputValue()) === 'item' &&
      (await group(page, 'g-basket').locator('[data-group-mode]').inputValue()) === 'first' &&
      (await group(page, 'g-basket').locator('[data-group-scope]').inputValue()) === 'session')
  {
    const pts = await page.locator('[data-order-points]').count()
    const ordered = [...ORDER.base.filter((n) => 'c' in n).map((n) => n.c), ...ORDER.groups.flatMap((g) => g.items)]
    const want = ordered.filter((id) => CAMPAIGNS.find((c) => c.id === id)?.features.points).length
    check('2: every campaign that earns points says so, and only those (513 review)', want > 0 && pts === want, `${pts} badges, ${want} earn points`)
  }
  check('2: a row shows the code, both names and the state',
    /WKND20/.test(await row(page, 'WKND20').innerText()) &&
      /Weekend coupon: 20% off/.test(await row(page, 'WKND20').innerText()) &&
      (await row(page, 'WKND20').locator('[data-order-name-ar]').innerText()) === 'قسيمة نهاية الأسبوع: خصم 20% حتى 40 ريال' &&
      (await row(page, 'WKND20').locator('[data-campaign-state]').count()) === 1)
  check('2: the line says groups always cascade', /always cascade/.test(await page.locator('[data-cascade]').innerText()))

  check('3: Save waits for a change', await saveBtn(page).isDisabled())
  check('3: up is off at the top, down at the bottom',
    (await row(page, 'PCUT-SA01').locator('[data-move-up]').isDisabled()) &&
      (await row(page, 'BASE-EARN').locator('[data-move-down]').isDisabled()) &&
      (await row(page, 'SUN-3FOR2').locator('[data-move-up]').isDisabled()) &&
      !(await row(page, 'SUN-3FOR2').locator('[data-move-down]').isDisabled()))
  check('3: a group holding campaigns cannot be deleted', (await group(page, 'g-items').locator('[data-delete-group]').getAttribute('aria-disabled')) === 'true')

  // ── 4 ──
  await page.locator('[data-add-group]').click()
  const groups = await groupIds(page)
  check('4: Add group adds one at the end of the base', groups.length === 3 && groups[2] === 'new-1', JSON.stringify(groups))
  const fresh = group(page, 'new-1')
  check('4: …empty, "first that yields", session scope, named',
    (await fresh.locator('[data-group-empty]').count()) === 1 &&
      (await fresh.locator('[data-group-mode]').inputValue()) === 'first' &&
      (await fresh.locator('[data-group-scope]').inputValue()) === 'session' &&
      (await fresh.locator('[data-group-name]').inputValue()) === 'New group 3')
  check('4: Save is on once the order changed', !(await saveBtn(page).isDisabled()))

  // ── 5 ──
  await row(page, 'GP-BEAUTY15').locator('[data-move-to]').selectOption('new-1')
  await row(page, 'BDAY-BEAUTY').locator('[data-move-to]').selectOption('new-1')
  check('5: Move to puts the campaigns in the new group, in the order moved',
    JSON.stringify(await fresh.locator('[data-order-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-order-row')))) === '["GP-BEAUTY15","BDAY-BEAUTY"]' &&
      (await page.locator('[data-order-row="GP-BEAUTY15"]').count()) === 1)
  await fresh.locator('[data-group-mode]').selectOption('highest')
  await fresh.locator('[data-group-scope]').selectOption('item')
  await row(page, 'BDAY-BEAUTY').locator('[data-move-up]').click()
  check('5: up moves a campaign inside its group',
    JSON.stringify(await fresh.locator('[data-order-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-order-row')))) === '["BDAY-BEAUTY","GP-BEAUTY15"]')
  for (let i = 0; i < 6; i++) await fresh.locator('[data-move-up]').first().click()
  check('5: the group moves up as one place in the base', (await groupIds(page)).join(',') === 'g-items,new-1,g-basket', (await groupIds(page)).join(','))
  check('5: the other places keep their campaigns', JSON.stringify((await layout(page)).filter((x) => x.startsWith('g-basket'))) === '["g-basket:WKND20","g-basket:PTS-50OFF"]')

  // ── 6 ──
  await fresh.locator('[data-group-name]').fill('  ')
  check('6: a blank group name holds the save', (await saveBtn(page).isDisabled()) && (await page.locator('[data-blank-group]').count()) === 1)
  await fresh.locator('[data-group-name]').fill('Beauty, best of')
  check('6: …named, it may be saved', !(await saveBtn(page).isDisabled()) && (await page.locator('[data-blank-group]').count()) === 0)
  check('6: Move to lists the group by its name', (await row(page, 'WKND20').locator('[data-move-to] option[value="new-1"]').innerText()).includes('Beauty, best of'))

  // ── 7 ──
  await page.locator('a[href="/campaigns"]').first().click()
  await page.locator('[data-leave-dialog]').waitFor({ timeout: 5000 })
  check('7: leaving with unsaved changes asks first', await page.locator('[data-leave-dialog]').isVisible())
  await page.locator('[data-leave-stay]').click()
  check('7: Stay keeps the page and the changes', page.url() === `${BASE}/campaigns/priority` && (await page.locator('[data-order-group="new-1"]').count()) === 1)

  // ── 8 ──
  await saveBtn(page).click()
  await page.getByText(SAVE_REFUSED).waitFor({ timeout: 5000 })
  check('8: a refused save shows the door\'s own message', await page.getByText(SAVE_REFUSED).isVisible())
  check('8: …and keeps the changes', (await page.locator('[data-order-group="new-1"] [data-order-row]').count()) === 2 && !(await saveBtn(page).isDisabled()))

  // ── 9 ──
  await saveBtn(page).click()
  await page.locator('[data-order-saved]').waitFor({ timeout: 5000 })
  const body = saves.at(-1)
  check('9: Save PUTs the whole order', saves.length === 2 && Array.isArray(body.base) && Array.isArray(body.groups))
  const sent = idsOf(body)
  check('9: …every campaign once', sent.length === 13 && new Set(sent).size === 13 && [...sent].sort().join() === idsOf(ORDER).sort().join(), JSON.stringify(sent))
  const sentGroup = body.groups.find((g) => g.id === 'new-1')
  check('9: …the new group with its name, mode, scope and campaigns',
    JSON.stringify(sentGroup) === JSON.stringify({ id: 'new-1', name: 'Beauty, best of', mode: 'highest', scope: 'item', items: ['BDAY-BEAUTY', 'GP-BEAUTY15'] }), JSON.stringify(sentGroup))
  check('9: …placed second among the groups', body.base.filter((n) => 'g' in n).map((n) => n.g).join() === 'g-items,new-1,g-basket')
  check('9: the page reads HQ\'s answer — the group under HQ\'s own id',
    (await page.locator('[data-order-group="g-hq1"]').count()) === 1 && (await page.locator('[data-order-group="new-1"]').count()) === 0)
  check('9: saved, Save waits for the next change and says it publishes with the version',
    (await saveBtn(page).isDisabled()) && /next published version/.test(await page.locator('[data-order-saved]').innerText()))
  check('9: the order HQ holds is the one shown', JSON.stringify(await layout(page)) === JSON.stringify(order().base.flatMap((n) => ('c' in n ? [`base:${n.c}`] : order().groups.find((g) => g.id === n.g).items.map((c) => `${n.g}:${c}`)))))

  // ── 10 ──
  await row(page, 'BDAY-BEAUTY').locator('[data-move-to]').selectOption('base')
  await row(page, 'GP-BEAUTY15').locator('[data-move-to]').selectOption('base')
  check('10: moved to the base, a campaign lands at its end', (await layout(page)).slice(-2).join() === 'base:BDAY-BEAUTY,base:GP-BEAUTY15', (await layout(page)).slice(-2).join())
  check('10: an emptied group may be deleted', (await group(page, 'g-hq1').locator('[data-delete-group]').getAttribute('aria-disabled')) === null)
  await group(page, 'g-hq1').locator('[data-delete-group]').click()
  check('10: …and it is gone', (await groupIds(page)).join(',') === 'g-items,g-basket')
  await page.locator('[data-discard-order]').click()
  check('10: Discard puts the saved order back', (await groupIds(page)).join(',') === 'g-items,g-hq1,g-basket' && (await saveBtn(page).isDisabled()))
  await page.screenshot({ path: 'tools/.campaigns-shots/513-priority.png', fullPage: true })

  check('11: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
