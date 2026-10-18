// Priority drive (spec 2737; ticket 513 made it, ticket 524 re-cut it onto BackOffice 2759): Campaigns
// ▸ Priority, the LIVE evaluation order (ADR 0090), and its save with a campaign draft.
//
// Drives the REAL app in Chromium against STUBS of the real doors, on the REAL envelope
// { statusCode, success, message, errors: [{ errorCode, internalErrorCode, errorMessage }], data }:
//   POST Rules/Authoring/Order → the live tree (`TREE`, the prototype's) and campaigns (`orderOf`)
//   POST Rules/Authoring/Drafts/List + Versions/Load { versionNo } → the campaigns list's other two
//        doors (`draftsList`, `rulesetOf`), for each row's state
//   POST Rules/Authoring/Catalogue → the blocks, for a live campaign's points mark
//   POST Rules/Authoring/Drafts/Load | Save → the carrier draft, loaded whole and saved with `tree`
//        (`loadDraft`, `saveDraft`); the first `staleSaves` saves are 409 RULES_DRAFT_STALE
// There is NO order save in 2759: "an order-only change rides a campaign draft". Never a live SIS.Api.
//
// It asserts:
//   1. the Campaigns group has a Priority leaf, ungated, that opens /campaigns/priority and lights itself;
//   2. the base and its groups in the live order, each group's mode and scope, both names, the live
//      version, the cascade line; every row that earns points says so;
//   3. Save waits for a change; up is off at the top, down at the bottom; a held group's delete is off;
//   4. Add group adds an empty "first that yields, session" group at the end of the base;
//   5. a campaign moves into the new group with Move to; the group takes a mode, a scope and both
//      names, and moves up as one place; a campaign moves up inside a group;
//   6. a blank English group name holds the save;
//   7. leaving with unsaved changes asks first, and Stay keeps them;
//   8. Save asks which draft carries the order: only the drafts being edited, saying it goes live when
//      that draft is activated; a draft that already carries an order is not overwritten unasked; a
//      stale carrier is said in our words and the changes are kept;
//   9. picked again, the draft is loaded whole and saved at its revision WITH the tree — every live
//      campaign once, the new group with its names, mode, scope and campaigns; the page says which
//      draft carries it and keeps showing that order, until Show the live order;
//  10. an emptied group is deleted; Discard puts the live order back;
//  11. no page errors;
//  12. with no draft being edited, the carrier dialog says so and cannot save.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/priority-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { CAMPAIGNS, CATALOGUE, LIVE_VERSION, TREE, catalogueFor, draftsList, loadDraft, orderOf, rulesetOf, saveDraft } from './campaigns-fixtures.mjs'
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

const STALE = 'Draft SPRING-DRAFT is at revision 2, not 1: load it again.'
const idsOf = (o) => o.order.flatMap((n) => ('campaign' in n ? [n.campaign] : (o.groups.find((g) => g.id === n.group)?.campaigns ?? [])))
const layoutOf = (o) => o.order.flatMap((n) => ('campaign' in n ? [`base:${n.campaign}`] : o.groups.find((g) => g.id === n.group).campaigns.map((c) => `${n.group}:${c}`)))

/** The block types the catalogue gives to points: a live campaign with none earns no points mark. */
const POINTS = new Set([...CATALOGUE.conditions, ...CATALOGUE.effects].filter((b) => b.feature === 'points').map((b) => b.type))
const usesPoints = (c) => JSON.stringify(c.rules).match(/"(check|effect)":"(\w+)"/g)?.some((m) => POINTS.has(m.split(':')[1].replaceAll('"', ''))) ?? false

const browser = await chromium.launch()

async function open({ staleSaves = 0, edit } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1100 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  const saves = []
  const store = structuredClone(CAMPAIGNS)
  edit?.(store)
  let stale = staleSaves
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.clock.setFixedTime(new Date('2026-10-16T18:30:00+03:00'))
  await page.addInitScript(() => {
    localStorage.setItem('oms.locale', 'en')
    localStorage.setItem('oms.railExpanded', 'true')
  })
  const refused = (out) => envelope(null, { status: out.status, success: false, message: out.message, errorCode: out.refused })
  await page.route('**/api/**', async (route) => {
    const req = route.request()
    const p = new URL(req.url()).pathname.split('/api/')[1]
    calls.push(`${req.method()} ${p}`)
    if (p === 'Auth/Me') return route.fulfill(envelope({ authenticated: true, userId: 'msartawi', currentStoreCode: 'P001' }))
    if (p === 'Rules/Authoring/Order' && req.method() === 'POST') return route.fulfill(envelope(orderOf(store)))
    if (p === 'Rules/Authoring/Drafts/List' && req.method() === 'POST') return route.fulfill(envelope(draftsList(store)))
    if (p === 'Rules/Authoring/Versions/Load' && req.method() === 'POST' && req.postDataJSON()?.versionNo === LIVE_VERSION && !req.postDataJSON()?.campaign) {
      const version = { versionNo: LIVE_VERSION, campaign: 'NATDAY-15', action: 'publish', schemaVersion: 1, publishedAt: '2026-10-12T10:00:00', publishedBy: 'Reem (approver)', requestedBy: 'Omar (marketing)', note: '' }
      return route.fulfill(envelope({ version, ruleset: rulesetOf(store), campaign: null }))
    }
    if (p === 'Rules/Authoring/Catalogue' && req.method() === 'POST') return route.fulfill(envelope(catalogueFor(req.postDataJSON()?.features ?? [])))
    if (p === 'Rules/Authoring/Drafts/Load' && req.method() === 'POST') {
      calls.push(`LOAD ${req.postDataJSON()?.campaign}`)
      const out = loadDraft(store, req.postDataJSON()?.campaign)
      return route.fulfill(out.draft ? envelope(out.draft) : refused(out))
    }
    if (p === 'Rules/Authoring/Drafts/Save' && req.method() === 'POST') {
      const body = req.postDataJSON()
      saves.push(body)
      if (stale > 0) {
        stale--
        return route.fulfill(envelope(null, { status: 409, success: false, message: STALE, errorCode: 'RULES_DRAFT_STALE' }))
      }
      const out = saveDraft(store, body, '2026-10-16 18:30')
      return route.fulfill(out.draft ? envelope(out.draft) : refused(out))
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, saves, store }
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
  // SUMMER-FLASH's draft already carries an order of its own (an earlier Priority save).
  const { context, page, errors, calls, saves, store } = await open({ staleSaves: 1, edit: (s) => (s.find((c) => c.code === 'SUMMER-FLASH').tree = structuredClone(TREE)) })
  const LIVE = orderOf(store)
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/campaigns/priority"]').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Priority leaf is in the rail', await leaf.isVisible())
  await leaf.click()
  await page.waitForURL(`${BASE}/campaigns/priority`)
  await page.locator('[data-order-row="BASE-EARN"]').waitFor({ timeout: 15000 })
  check('1: it opens /campaigns/priority and lights itself, not Campaigns',
    (await leaf.getAttribute('aria-current')) === 'page' && (await page.locator('a[href="/campaigns"]').first().getAttribute('aria-current')) !== 'page')
  check('1: ungated — no probe call was made', !calls.some((c) => /Rules\/.*Access$|RuleCampaign\/Access/.test(c)))
  check('1: it reads the live order (POST Rules/Authoring/Order)', calls.includes('POST Rules/Authoring/Order'))

  const start = await layout(page)
  check('2: the base and its groups in the live order', JSON.stringify(start) === JSON.stringify(layoutOf(LIVE.tree)), JSON.stringify(start))
  check('2: each group shows its mode and scope',
    (await group(page, 'g-items').locator('[data-group-mode]').inputValue()) === 'highest' &&
      (await group(page, 'g-items').locator('[data-group-scope]').inputValue()) === 'item' &&
      (await group(page, 'g-basket').locator('[data-group-mode]').inputValue()) === 'first' &&
      (await group(page, 'g-basket').locator('[data-group-scope]').inputValue()) === 'session')
  check('2: each group shows both its names', (await group(page, 'g-items').locator('[data-group-name]').inputValue()) === 'Item deals' && (await group(page, 'g-items').locator('[data-group-name-ar]').inputValue()) === 'عروض الأصناف')
  check('2: it says which live version runs the order', (await page.locator('[data-order-version]').innerText()).replace(/[⁦-⁩]/g, '') === `The order as live version ${LIVE_VERSION} runs it.`)
  {
    await page.waitForTimeout(500)
    const pts = await page.locator('[data-order-points]').count()
    // A row's features are its draft's; a live campaign with no draft is read from its blocks.
    const want = idsOf(LIVE.tree).filter((id) => {
      const d = store.find((c) => c.code === id)
      return d.source === 'draft' ? d.features.includes('points') : usesPoints(d.campaign)
    }).length
    check('2: every campaign that earns points says so, and only those (513 review)', want > 0 && pts === want, `${pts} badges, ${want} earn points`)
  }
  check('2: a row shows the code, both names and the state',
    /WKND20/.test(await row(page, 'WKND20').innerText()) &&
      /Weekend coupon: 20% off/.test(await row(page, 'WKND20').innerText()) &&
      (await row(page, 'WKND20').locator('[data-order-name-ar]').innerText()) === 'قسيمة نهاية الأسبوع: خصم 20%' &&
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
  await row(page, 'GIFT-POUCH').locator('[data-move-to]').selectOption('new-1')
  check('5: Move to puts the campaigns in the new group, in the order moved',
    JSON.stringify(await fresh.locator('[data-order-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-order-row')))) === '["GP-BEAUTY15","GIFT-POUCH"]' &&
      (await page.locator('[data-order-row="GP-BEAUTY15"]').count()) === 1)
  await fresh.locator('[data-group-mode]').selectOption('highest')
  await fresh.locator('[data-group-scope]').selectOption('item')
  await row(page, 'GIFT-POUCH').locator('[data-move-up]').click()
  check('5: up moves a campaign inside its group',
    JSON.stringify(await fresh.locator('[data-order-row]').evaluateAll((els) => els.map((e) => e.getAttribute('data-order-row')))) === '["GIFT-POUCH","GP-BEAUTY15"]')
  for (let i = 0; i < 7; i++) await fresh.locator('[data-move-up]').first().click()
  check('5: the group moves up as one place in the base', (await groupIds(page)).join(',') === 'g-items,new-1,g-basket', (await groupIds(page)).join(','))
  check('5: the other places keep their campaigns', JSON.stringify((await layout(page)).filter((x) => x.startsWith('g-basket'))) === '["g-basket:WKND20","g-basket:PTS-50OFF"]')

  // ── 6 ──
  await fresh.locator('[data-group-name]').fill('  ')
  check('6: a blank English group name holds the save', (await saveBtn(page).isDisabled()) && (await page.locator('[data-blank-group]').count()) === 1)
  await fresh.locator('[data-group-name]').fill('Beauty, best of')
  await fresh.locator('[data-group-name-ar]').fill('أفضل عروض الجمال')
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
  const carrier = page.locator('[data-carrier]')
  await carrier.locator('[data-carrier-list], [data-carrier-none]').first().waitFor({ timeout: 10000 })
  check('8: Save asks which draft carries the order — no save is sent yet', saves.length === 0)
  const offered = await carrier.locator('[data-carrier-draft]').evaluateAll((els) => els.map((e) => e.getAttribute('data-carrier-draft')))
  check('8: …only the drafts being edited, last saved first (a waiting one is frozen)', JSON.stringify(offered) === '["SPRING-DRAFT","SUMMER-FLASH"]', JSON.stringify(offered))
  check('8: …saying the order goes live when that draft is activated', (await carrier.locator('[data-carrier-live-note]').innerText()) === 'The order goes live when that draft is activated, not before.')
  check('8: nothing is saved until a draft is picked', await page.locator('[data-carrier-save]').isDisabled())
  await carrier.locator('[data-carrier-draft="SUMMER-FLASH"]').check()
  await page.locator('[data-carrier-save]').click()
  await carrier.locator('[data-carrier-refusal]').waitFor({ timeout: 5000 })
  check('8: a draft that already carries an order is not overwritten unasked', saves.length === 0 && (await carrier.locator('[data-carrier-refusal]').innerText()).includes('That draft already carries an order') && (await page.locator('[data-carrier-replace]').isVisible()))
  await carrier.locator('[data-carrier-draft="SPRING-DRAFT"]').check()
  await page.locator('[data-carrier-save]').click()
  await carrier.locator('[data-carrier-refusal]').waitFor({ timeout: 5000 })
  check('8: a stale carrier is said in our words', (await carrier.locator('[data-carrier-refusal]').innerText()).includes('That draft was saved by someone else just now'))
  check('8: …and the changes are kept', (await page.locator('[data-order-group="new-1"] [data-order-row]').count()) === 2)

  // ── 9 ──
  await page.locator('[data-carrier-save]').click()
  await page.locator('[data-order-saved]').waitFor({ timeout: 5000 })
  const body = saves.at(-1)
  const spring = CAMPAIGNS.find((c) => c.code === 'SPRING-DRAFT')
  check('9: the carrier is loaded whole and saved again', saves.length === 2 && calls.filter((c) => c === 'LOAD SPRING-DRAFT').length === 2)
  check(
    '9: …its campaign, features and revision as loaded, WITH the tree',
    JSON.stringify(body.campaign) === JSON.stringify(spring.campaign) && JSON.stringify(body.features) === JSON.stringify(spring.features) && body.revision === spring.revision && Array.isArray(body.tree?.order) && Array.isArray(body.tree?.groups),
    JSON.stringify({ revision: body.revision, features: body.features }),
  )
  const sent = idsOf(body.tree)
  check('9: …every live campaign once', sent.length === 13 && new Set(sent).size === 13 && [...sent].sort().join() === idsOf(LIVE.tree).sort().join(), JSON.stringify(sent))
  const sentGroup = body.tree.groups.find((g) => g.id === 'new-1')
  check(
    '9: …the new group with both names, its mode, scope and campaigns',
    JSON.stringify(sentGroup) === JSON.stringify({ id: 'new-1', name: { en: 'Beauty, best of', ar: 'أفضل عروض الجمال' }, mode: 'highest', scope: 'item', campaigns: ['GIFT-POUCH', 'GP-BEAUTY15'] }),
    JSON.stringify(sentGroup),
  )
  check('9: …placed second among the groups', body.tree.order.filter((n) => 'group' in n).map((n) => n.group).join() === 'g-items,new-1,g-basket')
  check('9: HQ keeps the tree on that draft', JSON.stringify(store.find((c) => c.code === 'SPRING-DRAFT').tree) === JSON.stringify(body.tree))
  check(
    '9: the page says which draft carries it, and when it goes live',
    (await page.locator('[data-order-saved-text]').innerText()).replace(/[⁦-⁩]/g, '') === 'Showing the order saved with the draft of SPRING-DRAFT. It goes live when that draft is activated; until then tills run the live order.',
  )
  check('9: …and keeps showing the order it saved, nothing left to save', JSON.stringify(await layout(page)) === JSON.stringify(layoutOf(body.tree)) && (await groupIds(page)).join(',') === 'g-items,new-1,g-basket' && (await saveBtn(page).isDisabled()))
  await page.locator('[data-show-live]').click()
  check('9: Show the live order puts the live order back, unchanged until that activation', JSON.stringify(await layout(page)) === JSON.stringify(layoutOf(LIVE.tree)) && (await page.locator('[data-order-saved]').count()) === 0)

  // ── 10 ──
  await row(page, 'SUN-3FOR2').locator('[data-move-to]').selectOption('base')
  await row(page, 'BABY-BUNDLE').locator('[data-move-to]').selectOption('base')
  check('10: moved to the base, a campaign lands at its end', (await layout(page)).slice(-2).join() === 'base:SUN-3FOR2,base:BABY-BUNDLE', (await layout(page)).slice(-2).join())
  check('10: an emptied group may be deleted', (await group(page, 'g-items').locator('[data-delete-group]').getAttribute('aria-disabled')) === null)
  await group(page, 'g-items').locator('[data-delete-group]').click()
  check('10: …and it is gone', (await groupIds(page)).join(',') === 'g-basket')
  await page.locator('[data-discard-order]').click()
  check('10: Discard puts the live order back', (await groupIds(page)).join(',') === 'g-items,g-basket' && (await saveBtn(page).isDisabled()))
  await page.screenshot({ path: 'tools/.campaigns-shots/513-priority.png', fullPage: true })

  check('11: no page errors', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 12 ──
{
  const { context, page, errors, saves } = await open({ edit: (store) => store.forEach((d) => d.source === 'draft' && d.state === 'editing' && (d.state = 'sentBack')) })
  await page.goto(`${BASE}/campaigns/priority`)
  await page.locator('[data-order-row="BASE-EARN"]').waitFor({ timeout: 15000 })
  await page.locator('[data-add-group]').click()
  await saveBtn(page).click()
  await page.locator('[data-carrier-none]').waitFor({ timeout: 10000 })
  check('12: with no draft being edited, the dialog says so', (await page.locator('[data-carrier-none]').innerText()).startsWith('No draft is being edited.'))
  check('12: …and cannot save', (await page.locator('[data-carrier-save]').isDisabled()) && saves.length === 0)
  check('11: no page errors (12)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
