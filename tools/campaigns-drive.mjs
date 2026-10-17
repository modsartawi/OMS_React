// Campaigns drive (spec 2737; ticket 501 creates it — the workspace slices 502–512, 515 and 516
// EXTEND it with a section of their own, below 501's, and leave 501's checks unchanged).
//
// Drives the REAL app in Chromium against STUBS of the rule-campaign doors, on the REAL envelope
// { statusCode, success, message, errors: [{ errorCode, internalErrorCode, errorMessage }], data }.
// Ticket 522 re-pointed the draft doors onto BackOffice 2758/2759's real shapes (the campaign JSON,
// schema 1, inside the `Drafts/Load` reply); the doors 523-526 still own keep their PROVISIONAL paths:
//   POST Rules/Authoring/Drafts/Load { campaign } → the draft (`loadDraft`); 404 RULES_DRAFT_NOT_FOUND
//   POST Rules/Authoring/Drafts/Save { campaign, features, revision } → the draft one revision higher
//       (`saveDraft`) — a create is revision 0 with the author's id; 409 RULES_DRAFT_STALE / PENDING;
//       the first `staleSaves` saves answer RULES_DRAFT_STALE; `refuseSave` / `refuseSettings` refuse
//       every save (pending), `refuseCreate` refuses a revision-0 save (RULES_DRAFT_STALE: a draft under that id was saved since)
//   POST Rules/Authoring/Drafts/Delete { campaign, revision } → `{ campaign, deleted: true }`
//   The checks and Offline read the draft's own `validation`; `checksFor(id, n)` answers the issues
//   of the n-th draft reply of a campaign (508).
//   GET RuleCampaign/Campaigns        → list rows (tools/campaigns-fixtures.mjs `listRow`)
//   POST RuleCampaign/Campaigns/{id}/Copy → an independent draft "<name> (copy)" (502, `copyOf`)
//   GET RuleCampaign/Templates        → the prototype's three templates (503, `TEMPLATES`), or refused
//       with `refuseTemplates`
//   POST RuleCampaign/Templates/{id}/Create → a draft from { values, draft } (503, `createFromTemplate`);
//       a disabled template is refused; the first `refuseFromTemplate` creates are refused
//   GET RuleCampaign/Catalogue        → the block catalogue (504, `CATALOGUE`)
//   GET RuleCampaign/Lookups/{Categories|Collections|Materials}?search= → the hits (506, `lookup`)
//   GET RuleCampaign/Roles            → the reader's roles: an author unless `as('approver' | 'both' |
//       'none')` says otherwise (read on the next page load), or refused with `refuseRoles` (511)
//   POST RuleCampaign/Campaigns/{id}/{AskForApproval|Activate|SendBack|Disable} → the campaign moved
//       (`lifecycle`); the first `refuseActivate` activations are refused (511)
//   GET RuleCampaign/Lookups/{Countries|Channels|Stores}?search= → Settings ▸ Audience's lists (509)
//   GET RuleCampaign/Campaigns/{id}/BudgetUsage → the counters (`budgetUsage`), or refused with `refuseUsage` (510)
//   PUT RuleCampaign/Campaigns/{id}/Budgets/{budgetId}/Limit → a live limit changed (`changeLimit`); the
//       first `refuseLimit` changes are refused (510)
//   GET RuleCampaign/Campaigns/{id}/Versions → the published versions without rules (`versionsOf`,
//       `versionRow`), or refused with `refuseVersions`; an Activate publishes one (`publishVersion`) (512)
//   GET RuleCampaign/Campaigns/{id}/Versions/{n} → one version with its rules (512)
//   POST RuleCampaign/Campaigns/{id}/Versions/{n}/Restore → the version is the new draft
//       (`restoreVersion`); the first `refuseRestore` restores are refused (512)
//   GET RuleCampaign/Campaigns/{id}/Coupons → the campaign's codes (`COUPONS`), or refused with `refuseCoupons` (515)
//   POST RuleCampaign/Campaigns/{id}/Coupons/Batches → one batch minted (`createBatch`); a taken universal
//       code is refused; the first `refuseBatch` creates are refused (515)
//   POST RuleCampaign/Campaigns/{id}/Coupons/Imports/Check → codes in use and unknown members (`checkImport`);
//       the first `refuseImportCheck` checks are refused (516)
//   POST RuleCampaign/Campaigns/{id}/Coupons/Imports → one batch of imported codes (`importBatch`) (516)
//   DELETE RuleCampaign/Campaigns/{id}/Coupons/Batches/{b}/Unused → the batch's unused codes deleted
//       (`deleteUnused`); the first `refuseDelete` deletes are refused (516)
// Each browser context has its own copy of the fixtures, so a create or a copy stays in its run.
// Never a live SIS.Api. The browser runs in Asia/Riyadh (UTC+3) with its clock fixed, so the local
// day and the UTC day can be made to disagree.
//
// ── 501 ── it asserts:
//   1. the Campaigns group is in the rail with its Campaigns leaf, ungated, and opens /campaigns;
//   2. a tile per state with its count at the local now (all 16 · draft 1 · waiting 1 · scheduled 1
//      · running 11 · expired 1 · disabled 1), every row in the grid, both names shown;
//   3. a tile filters the grid and is pressed, lands in the URL, and All clears it;
//   4. the search matches the English name, the Arabic name and the code, and says "n of m";
//   5. a row opens /campaigns/:id on its Dashboard — Details (both names, code, features), State,
//      Schedule ("Ends in N days", the weekdays) — with ONE read of the campaign; the side menu shows
//      only the landed pages (Dashboard, and Rule builder since 504); Back returns to the list as it was left;
//   6. the name link opens a scheduled campaign: "Starts in 3 days", its daily hours one range;
//      a waiting campaign names who asked and the note; a draft with no schedule says "No time limit";
//   7. at 02:30 local (23:30 UTC the day before) the counts and "Starts in 3 days" are unchanged;
//   8. an unknown campaign shows the door's own refusal and the way back;
//   9. no page errors.
//
//   1. run the app:  npx vite --port 5199 --strictPort
//   2. node tools/campaigns-drive.mjs          (DRIVE_PORT overrides 5199)
import { createRequire } from 'node:module'
import { mkdirSync, readFileSync } from 'node:fs'
import { CAMPAIGNS, CATALOGUE, COUPONS, TEMPLATES, budgetUsage, changeLimit, copyOf, checkImport, createBatch, deleteDraft, deleteUnused, importBatch, createFromTemplate, lifecycle, listRow, loadDraft, lookup, publishVersion, restoreVersion, saveDraft, versionRow, versionsOf } from './campaigns-fixtures.mjs'
const require = createRequire('C:/Playground/frontend/package.json')
const { chromium } = require('playwright')

const BASE = `http://localhost:${process.env.DRIVE_PORT || 5199}`
const SHOTS = 'tools/.campaigns-shots'
mkdirSync(SHOTS, { recursive: true })

const results = []
const check = (name, pass, detail = '') => {
  results.push({ name, pass })
  console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`)
}

// The REAL SIS.Api envelope (copied from tools/deliverect-stores-drive.mjs).
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

const NOT_FOUND = 'No draft or version of this campaign.'
const CATALOGUE_REFUSED = 'The block catalogue is not available. / كتالوج الكتل غير متاح.'
const CREATE_REFUSED = 'A draft of this campaign was saved since: load it again. / حُفظت مسودة لهذه الحملة منذ ذلك الحين.'
const LOOKUP_REFUSED = 'The product search is not available. / البحث عن المنتجات غير متاح.'
const STALE = 'The draft changed since it was loaded: load it again. / تغيّرت المسودة منذ تحميلها.'
const ROLES_REFUSED = 'Your rule-campaign permissions could not be read. / تعذرت قراءة صلاحياتك.'
const ACTIVATE_REFUSED = 'You asked for this approval; another approver must activate it. / طلبت هذه الموافقة بنفسك.'
const SETTINGS_REFUSED = 'The request could not be read: an unknown feature. / تعذرت قراءة الطلب: ميزة غير معروفة.'
const USAGE_REFUSED = 'The budget counters are not available. / عدادات الميزانية غير متاحة.'
const LIMIT_REFUSED = 'The limit could not be changed right now. / تعذر تغيير الحد الآن.'
const VERSIONS_REFUSED = 'The version history is not available. / سجل الإصدارات غير متاح.'
const TEMPLATES_REFUSED = 'The templates are not available. / القوالب غير متاحة.'
const FROM_TEMPLATE_REFUSED = 'Percent off may be at most 30. / الخصم 30% كحد أقصى.'
const RESTORE_REFUSED = 'The version could not be restored right now. / تعذرت استعادة الإصدار الآن.'
const STALE_PENDING = 'The draft waits for approval. / المسودة بانتظار الموافقة.'
const SAVE_REFUSED = 'This campaign is waiting for approval and cannot be edited. / الحملة بانتظار الموافقة ولا يمكن تعديلها.'
const COUPONS_REFUSED = 'The coupon codes are not available. / رموز القسائم غير متاحة.'
const BATCH_REFUSED = 'SIS.Coupons is not answering; no code was created. / خدمة القسائم لا تستجيب.'
const IMPORT_CHECK_REFUSED = 'SIS.Coupons could not check the rows. / تعذر التحقق من الصفوف.'
const DELETE_REFUSED = 'SIS.Coupons is not answering; no code was deleted. / لم يُحذف أي رمز.'
/** The stubbed HQ's local clock for a create or a copy — the drive's EVENING. */
const NOW_LOCAL = '2026-10-16 18:30'

/** 2026-10-16 18:30 in Riyadh — the prototype's simulator moment. */
const EVENING = new Date('2026-10-16T18:30:00+03:00')
/** 2026-10-16 02:30 in Riyadh = 2026-10-15 23:30 UTC: the local day and the UTC day disagree. */
const SMALL_HOURS = new Date('2026-10-16T02:30:00+03:00')

const browser = await chromium.launch()

async function open({ refuseImportCheck = 0, refuseDelete = 0, refuseCoupons = false, refuseBatch = 0, refuseTemplates = false, refuseFromTemplate = 0, refuseVersions = false, refuseRestore = 0, at = EVENING, refuseUsage = false, refuseLimit = 0, refuseSettings = false, refuseRoles = false, refuseActivate = 0, refuseCreate = false, refuseCatalogue = false, refuseSave = false, pendingSaves = false, refuseLookup = false, staleSaves = 0, checksFor, edit } = {}) {
  const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, timezoneId: 'Asia/Riyadh' })
  const page = await context.newPage()
  const errors = []
  const calls = []
  /** This context's HQ: the fixtures, copied, so a create or a copy (502) stays in its own run. */
  const store = structuredClone(CAMPAIGNS)
  edit?.(store)
  /** 504: the catalogue door refuses until `heal()`. */
  let catalogueDown = refuseCatalogue
  const bodies = []
  /** 505: every draft save's body, in order. */
  const saves = []
  /** 506: every lookup, `<kind> <search>`. */
  const lookups = []
  /** 508: every draft reply by campaign id, in order (`checksFor`'s n). */
  const validations = []
  let staleRefusals = staleSaves
  /** 511: the reader's roles, and every lifecycle act `<act> <id>` with its body. */
  const ROLE = { author: { author: true, approver: false }, approver: { author: false, approver: true }, both: { author: true, approver: true }, none: { author: false, approver: false } }
  let role = 'author'
  let activateRefusals = refuseActivate
  const acts = []
  /** 510: every budget counter read (campaign id) and every live limit change `{ id, budgetId, body }`. */
  const usageReads = []
  const limits = []
  let limitRefusals = refuseLimit
  /** 512: this context's version history, and every restore `<id> <n>`. */
  const versions = versionsOf(store)
  const restores = []
  let restoreRefusals = refuseRestore
  /** 503: every create-from-template `{ id, body }`, in order. */
  const fromTemplate = []
  let fromTemplateRefusals = refuseFromTemplate
  /** 515: this context's coupon codes by campaign id, and every batch create `{ id, body }`, in order. */
  const coupons = structuredClone(COUPONS)
  const batches = []
  let batchRefusals = refuseBatch
  /** 516: every import check, import and delete unused `{ id, body | batch }`, in order. */
  const importChecks = []
  const imports = []
  const deletes = []
  let importCheckRefusals = refuseImportCheck
  let deleteRefusals = refuseDelete
  page.on('pageerror', (e) => errors.push(String(e)))
  page.on('console', (m) => m.type() === 'error' && !/status of [45]\d\d/.test(m.text()) && errors.push(m.text()))
  await page.clock.setFixedTime(at)
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
    if (p === 'RuleCampaign/Catalogue' && req.method() === 'GET')
      return route.fulfill(catalogueDown ? envelope(null, { status: 503, success: false, message: CATALOGUE_REFUSED, errorCode: 'RULE_CATALOGUE_UNAVAILABLE' }) : envelope(CATALOGUE))
    const lk = /^RuleCampaign\/Lookups\/(Categories|Collections|Materials|Countries|Channels|Stores)$/.exec(p)
    if (lk && req.method() === 'GET') {
      const kind = lk[1].toLowerCase()
      const search = new URL(req.url()).searchParams.get('search') ?? ''
      lookups.push(`${kind} ${search}`)
      if (refuseLookup) return route.fulfill(envelope(null, { status: 503, success: false, message: LOOKUP_REFUSED, errorCode: 'RULE_LOOKUP_UNAVAILABLE' }))
      return route.fulfill(envelope(lookup(kind, search)))
    }
    if (p === 'RuleCampaign/Campaigns' && req.method() === 'GET') return route.fulfill(envelope(store.map(listRow)))
    // The draft doors (ticket 522): BackOffice 2758 + 2759's real shapes.
    const refused = (out) => envelope(null, { status: out.status, success: false, message: out.message, errorCode: out.refused })
    /** A draft as answered: its validation, unless `checksFor` gives this reply's issues (508). */
    const answer = (d) => {
      const n = validations.filter((v) => v === d.code).length
      validations.push(d.code)
      const issues = checksFor?.(d.code, n)
      if (!issues) return d
      const errors = issues.filter((x) => x.severity !== 'warning')
      return { ...d, validation: { canActivate: errors.length === 0, errors, warnings: issues.filter((x) => x.severity === 'warning'), offline: errors.length ? null : d.validation?.offline ?? null } }
    }
    if (p === 'Rules/Authoring/Drafts/Load' && req.method() === 'POST') {
      const code = req.postDataJSON()?.campaign
      calls.push(`LOAD ${code}`)
      const out = loadDraft(store, code)
      return route.fulfill(out.draft ? envelope(answer(out.draft)) : refused(out))
    }
    if (p === 'Rules/Authoring/Drafts/Save' && req.method() === 'POST') {
      const body = req.postDataJSON()
      saves.push(body)
      if (body.revision === 0 && !store.some((x) => x.code === body.campaign?.id)) bodies.push(body)
      if (staleRefusals > 0) {
        staleRefusals--
        return route.fulfill(envelope(null, { status: 409, success: false, message: STALE, errorCode: 'RULES_DRAFT_STALE' }))
      }
      if (refuseCreate && body.revision === 0) return route.fulfill(envelope(null, { status: 409, success: false, message: CREATE_REFUSED, errorCode: 'RULES_DRAFT_STALE' }))
      if (pendingSaves) return route.fulfill(envelope(null, { status: 409, success: false, message: STALE_PENDING, errorCode: 'RULES_DRAFT_PENDING' }))
      if (refuseSave || refuseSettings) return route.fulfill(envelope(null, { status: 400, success: false, message: refuseSave ? SAVE_REFUSED : SETTINGS_REFUSED, errorCode: 'RULES_BAD_REQUEST' }))
      const out = saveDraft(store, body, NOW_LOCAL)
      return route.fulfill(out.draft ? envelope(answer(out.draft)) : refused(out))
    }
    if (p === 'Rules/Authoring/Drafts/Delete' && req.method() === 'POST') {
      const body = req.postDataJSON()
      acts.push({ act: `Delete ${body?.campaign}`, body })
      const out = deleteDraft(store, body)
      return route.fulfill(out.deleted ? envelope(out.deleted) : refused(out))
    }
    // PROVISIONAL doors (tickets 523-526 re-point them).
    const usage = /^RuleCampaign\/Campaigns\/([^/]+)\/BudgetUsage$/.exec(p)
    if (usage && req.method() === 'GET') {
      usageReads.push(decodeURIComponent(usage[1]))
      const c = store.find((x) => x.code === decodeURIComponent(usage[1]))
      if (!c) return route.fulfill(envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
      if (refuseUsage) return route.fulfill(envelope(null, { status: 503, success: false, message: USAGE_REFUSED, errorCode: 'RULE_BUDGET_USAGE_UNAVAILABLE' }))
      return route.fulfill(envelope(budgetUsage(c)))
    }
    const limit = /^RuleCampaign\/Campaigns\/([^/]+)\/Budgets\/([^/]+)\/Limit$/.exec(p)
    if (limit && req.method() === 'PUT') {
      const body = req.postDataJSON()
      limits.push({ id: decodeURIComponent(limit[1]), budgetId: decodeURIComponent(limit[2]), body })
      const c = store.find((x) => x.code === decodeURIComponent(limit[1]))
      if (!c) return route.fulfill(envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
      if (limitRefusals > 0) {
        limitRefusals--
        return route.fulfill(envelope(null, { status: 503, success: false, message: LIMIT_REFUSED, errorCode: 'RULE_BUDGET_LIMIT_UNAVAILABLE' }))
      }
      const out = changeLimit(c, decodeURIComponent(limit[2]), body.value)
      return route.fulfill(out.campaign ? envelope(out.campaign) : envelope(null, { status: 409, success: false, message: out.message, errorCode: out.refused }))
    }
    const copy = /^RuleCampaign\/Campaigns\/([^/]+)\/Copy$/.exec(p)
    if (copy && req.method() === 'POST') {
      const c = store.find((x) => x.code === decodeURIComponent(copy[1]))
      return route.fulfill(c ? envelope(copyOf(store, c, NOW_LOCAL)) : envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
    }
    if (p === 'RuleCampaign/Templates' && req.method() === 'GET')
      return route.fulfill(refuseTemplates ? envelope(null, { status: 503, success: false, message: TEMPLATES_REFUSED, errorCode: 'RULE_TEMPLATES_UNAVAILABLE' }) : envelope(TEMPLATES))
    const tpl = /^RuleCampaign\/Templates\/([^/]+)\/Create$/.exec(p)
    if (tpl && req.method() === 'POST') {
      const body = req.postDataJSON()
      const tid = decodeURIComponent(tpl[1])
      fromTemplate.push({ id: tid, body })
      const x = TEMPLATES.find((t) => t.id === tid)
      if (!x || !x.enabled) return route.fulfill(envelope(null, { status: 409, success: false, message: 'This template cannot be used.', errorCode: 'RULE_TEMPLATE_NOT_ENABLED' }))
      if (fromTemplateRefusals > 0) {
        fromTemplateRefusals--
        return route.fulfill(envelope(null, { status: 409, success: false, message: FROM_TEMPLATE_REFUSED, errorCode: 'RULE_TEMPLATE_VALUE_OUT_OF_BOUNDS' }))
      }
      return route.fulfill(envelope(createFromTemplate(store, x, body, NOW_LOCAL)))
    }
    if (p === 'RuleCampaign/Roles' && req.method() === 'GET')
      return route.fulfill(refuseRoles ? envelope(null, { status: 503, success: false, message: ROLES_REFUSED, errorCode: 'RULE_ROLES_UNAVAILABLE' }) : envelope(ROLE[role]))
    const life = /^RuleCampaign\/Campaigns\/([^/]+)\/(AskForApproval|Activate|SendBack|Disable)$/.exec(p)
    if (life && req.method() === 'POST') {
      const body = req.postDataJSON()
      acts.push({ act: `${life[2]} ${decodeURIComponent(life[1])}`, body })
      const c = store.find((x) => x.code === decodeURIComponent(life[1]))
      if (!c) return route.fulfill(envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
      if (life[2] === 'Activate' && activateRefusals > 0) {
        activateRefusals--
        return route.fulfill(envelope(null, { status: 409, success: false, message: ACTIVATE_REFUSED, errorCode: 'RULE_CAMPAIGN_SELF_APPROVAL' }))
      }
      const by = role === 'approver' ? 'Reem (approver)' : 'Omar (marketing)'
      const out = lifecycle(c, life[2], { note: body.note, by, at: NOW_LOCAL })
      if (out.campaign && life[2] === 'Activate') publishVersion(versions, c, body.note)
      return route.fulfill(out.campaign ? envelope(out.campaign) : envelope(null, { status: 409, success: false, message: 'Wrong state.', errorCode: out.refused }))
    }
    const vers = /^RuleCampaign\/Campaigns\/([^/]+)\/Versions(?:\/(\d+))?(\/Restore)?$/.exec(p)
    if (vers) {
      const id = decodeURIComponent(vers[1])
      const c = store.find((x) => x.code === id)
      if (!c) return route.fulfill(envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
      const list = versions.get(id) ?? []
      if (!vers[2] && req.method() === 'GET') {
        if (refuseVersions) return route.fulfill(envelope(null, { status: 503, success: false, message: VERSIONS_REFUSED, errorCode: 'RULE_VERSIONS_UNAVAILABLE' }))
        // Oldest first, as a table would answer: the page orders them itself.
        return route.fulfill(envelope(list.map(versionRow)))
      }
      const n = Number(vers[2])
      if (!vers[3] && req.method() === 'GET') {
        const v = list.find((x) => x.version === n)
        return route.fulfill(v ? envelope(v) : envelope(null, { status: 404, success: false, message: 'No such version.', errorCode: 'RULE_VERSION_NOT_FOUND' }))
      }
      if (vers[3] && req.method() === 'POST') {
        restores.push(`${id} ${n}`)
        if (restoreRefusals > 0) {
          restoreRefusals--
          return route.fulfill(envelope(null, { status: 503, success: false, message: RESTORE_REFUSED, errorCode: 'RULE_RESTORE_UNAVAILABLE' }))
        }
        const out = restoreVersion(c, versions, n)
        return route.fulfill(out.campaign ? envelope(out.campaign) : envelope(null, { status: 409, success: false, message: out.message, errorCode: out.refused }))
      }
    }
    const imp = /^RuleCampaign\/Campaigns\/([^/]+)\/Coupons\/(Imports(?:\/Check)?|Batches\/([^/]+)\/Unused)$/.exec(p)
    if (imp) {
      const id = decodeURIComponent(imp[1])
      const c = store.find((x) => x.code === id)
      if (!c) return route.fulfill(envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
      const list = (coupons[id] ??= [])
      if (imp[2] === 'Imports/Check' && req.method() === 'POST') {
        const body = req.postDataJSON()
        importChecks.push({ id, body })
        if (importCheckRefusals > 0) {
          importCheckRefusals--
          return route.fulfill(envelope(null, { status: 503, success: false, message: IMPORT_CHECK_REFUSED, errorCode: 'RULE_COUPONS_UNAVAILABLE' }))
        }
        return route.fulfill(envelope(checkImport(list, body.rows)))
      }
      if (imp[2] === 'Imports' && req.method() === 'POST') {
        const body = req.postDataJSON()
        imports.push({ id, body })
        const out = importBatch(c, list, body.rows, NOW_LOCAL)
        return route.fulfill(out.batch ? envelope(out.batch) : envelope(null, { status: 409, success: false, message: out.message, errorCode: out.refused }))
      }
      if (imp[3] && req.method() === 'DELETE') {
        const batch = decodeURIComponent(imp[3])
        deletes.push({ id, batch })
        if (deleteRefusals > 0) {
          deleteRefusals--
          return route.fulfill(envelope(null, { status: 503, success: false, message: DELETE_REFUSED, errorCode: 'RULE_COUPONS_UNAVAILABLE' }))
        }
        return route.fulfill(envelope(deleteUnused(list, batch)))
      }
    }
    const cps = /^RuleCampaign\/Campaigns\/([^/]+)\/Coupons(\/Batches)?$/.exec(p)
    if (cps) {
      const id = decodeURIComponent(cps[1])
      const c = store.find((x) => x.code === id)
      if (!c) return route.fulfill(envelope(null, { status: 404, success: false, message: NOT_FOUND, errorCode: 'RULE_CAMPAIGN_NOT_FOUND' }))
      const list = (coupons[id] ??= [])
      if (!cps[2] && req.method() === 'GET') {
        if (refuseCoupons) return route.fulfill(envelope(null, { status: 503, success: false, message: COUPONS_REFUSED, errorCode: 'RULE_COUPONS_UNAVAILABLE' }))
        return route.fulfill(envelope(list))
      }
      if (cps[2] && req.method() === 'POST') {
        const body = req.postDataJSON()
        batches.push({ id, body })
        if (batchRefusals > 0) {
          batchRefusals--
          return route.fulfill(envelope(null, { status: 503, success: false, message: BATCH_REFUSED, errorCode: 'RULE_COUPONS_UNAVAILABLE' }))
        }
        const out = createBatch(c, list, body, NOW_LOCAL)
        return route.fulfill(out.batch ? envelope(out.batch) : envelope(null, { status: 409, success: false, message: out.message, errorCode: out.refused }))
      }
    }
    if (/Access$/.test(p))
      return route.fulfill(envelope({ canOpen: false, screenAllowed: false, allowed: false, canAdmin: false, canSupport: false }))
    return route.fulfill(envelope([]))
  })
  return { context, page, errors, calls, store, coupons, batches, importChecks, imports, deletes, bodies, fromTemplate, saves, lookups, validations, acts, usageReads, limits, versions, restores, as: (r) => (role = r), heal: () => (catalogueDown = false) }
}

const grid = '[data-campaigns-grid]'
/** The row ids the grid shows, in order. */
const rowIds = (page) =>
  page.$$eval(`${grid} .ag-row[row-id]`, (rows) => [
    ...new Map(
      rows.sort((a, b) => Number(a.getAttribute('row-index')) - Number(b.getAttribute('row-index'))).map((r) => [r.getAttribute('row-id'), 1]),
    ).keys(),
  ])
const waitRows = async (page, n) => {
  await page.waitForFunction(
    ([sel, count]) =>
      new Set([...document.querySelectorAll(`${sel} .ag-row[row-id]`)].map((r) => r.getAttribute('row-id'))).size === count &&
      !document.querySelector(`${sel} .ag-overlay-loading-center`),
    [grid, n],
    { timeout: 15000 },
  )
  await page.waitForTimeout(100)
}
const cell = (page, id, col) => page.locator(`${grid} .ag-row[row-id="${id}"] .ag-cell[col-id="${col}"]`).innerText()
const tileCount = async (page, tile) => (await page.locator(`[data-tile="${tile}"] [data-tile-count]`).innerText()).trim()
const COUNTS = { all: '16', draft: '1', waitingForApproval: '1', scheduled: '1', running: '11', expired: '1', disabled: '1' }
const readCounts = async (page) => Object.fromEntries(await Promise.all(Object.keys(COUNTS).map(async (k) => [k, await tileCount(page, k)])))

// ── 1–5 ──
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/`)
  const leaf = page.locator('a[href="/campaigns"]:not([data-workspace-back])').first()
  await leaf.waitFor({ timeout: 15000 })
  check('1: the Campaigns leaf is in the rail', await leaf.isVisible())
  await leaf.click()
  await page.waitForURL(`${BASE}/campaigns`)
  await waitRows(page, 16)
  check('1: the leaf opens /campaigns', page.url() === `${BASE}/campaigns`)
  check('1: ungated — no probe call was made for the group', !calls.some((c) => /RuleCampaign\/Access/.test(c)))

  const counts = await readCounts(page)
  check('2: a tile per state with its count at the local now', JSON.stringify(counts) === JSON.stringify(COUNTS), JSON.stringify(counts))
  check('2: every campaign is a row', (await rowIds(page)).length === 16)
  check('2: the English and the Arabic name are both shown', (await cell(page, 'BABY-BUNDLE', 'name')) === 'Diapers + two packs of wipes for SAR 85' && (await cell(page, 'BABY-BUNDLE', 'nameAr')) === 'حفاضات مع عبوتي مناديل بـ 85 ريال')
  check('2: the state column reads the derived state', (await cell(page, 'PRCB-AUG26', 'state')) === 'Expired' && (await cell(page, 'NATDAY-15', 'state')) === 'Scheduled' && (await cell(page, 'BDAY-BEAUTY', 'state')) === 'Waiting for approval')
  check('2: start and end are the local days; no end reads Open-ended', (await cell(page, 'WKND20', 'start')) === '2026-10-01' && (await cell(page, 'BASE-EARN', 'end')) === 'Open-ended')
  await page.screenshot({ path: `${SHOTS}/list.png` })

  await page.locator('[data-tile="expired"]').click()
  await waitRows(page, 1)
  check('3: the Expired tile shows only the expired campaign', JSON.stringify(await rowIds(page)) === '["PRCB-AUG26"]')
  check('3: the tile is pressed and lands in the URL', (await page.locator('[data-tile="expired"]').getAttribute('aria-pressed')) === 'true' && page.url().endsWith('?state=expired'))
  await page.locator('[data-tile="running"]').click()
  await waitRows(page, 11)
  check('3: the Running tile shows its eleven', (await rowIds(page)).length === 11 && !(await rowIds(page)).includes('NATDAY-15'))
  await page.locator('[data-tile="all"]').click()
  await waitRows(page, 16)
  check('3: All clears the filter', page.url() === `${BASE}/campaigns`)

  await page.locator('[data-campaign-search]').fill('حفاضات')
  await waitRows(page, 1)
  check('4: the Arabic name is searched', JSON.stringify(await rowIds(page)) === '["BABY-BUNDLE"]')
  await page.locator('[data-campaign-search]').fill('weekend')
  await waitRows(page, 2)
  check('4: the English name is searched', JSON.stringify((await rowIds(page)).sort()) === '["NEXT-VISIT","WKND20"]')
  check('4: the status bar says n of m', (await page.locator('[data-status-count]').innerText()) === 'Showing 2 of 16 campaigns', await page.locator('[data-status-count]').innerText())
  await page.locator('[data-campaign-search]').fill('gp-beauty')
  await waitRows(page, 1)
  check('4: the code is searched', JSON.stringify(await rowIds(page)) === '["GP-BEAUTY15"]')
  await page.locator('[data-tile="disabled"]').click()
  await page.waitForFunction(() => document.querySelector('[data-campaigns-grid] .ag-overlay-no-rows-center, [data-campaigns-grid] .ag-overlay')?.textContent?.includes('No campaign matches.'), null, { timeout: 5000 }).catch(() => {})
  check('4: a tile and the search together can match nothing, and say so', (await page.locator(grid).innerText()).includes('No campaign matches.'))
  await page.locator('[data-tile="all"]').click()
  // Let the tile's render COMMIT before typing (the URL changes first, the render follows in a
  // transition): the search writes the tile it was rendered with.
  await page.waitForFunction(() => document.querySelector('[data-tile="all"]')?.getAttribute('aria-pressed') === 'true')
  await page.locator('[data-campaign-search]').fill('weekend')
  await waitRows(page, 2)

  const reads = () => calls.filter((c) => c === 'LOAD WKND20').length
  await page.locator(`${grid} .ag-row[row-id="WKND20"] .ag-cell[col-id="code"]`).click()
  await page.waitForURL(`${BASE}/campaigns/WKND20`)
  await page.locator('[data-dashboard]').waitFor({ timeout: 10000 })
  check('5: a row click opens the campaign at /campaigns/:id on its Dashboard', page.url() === `${BASE}/campaigns/WKND20`)
  const details = page.locator('[data-dashboard-cell="details"]')
  check('5: Details shows the English name', (await details.locator('[data-line="nameEn"] dd').innerText()) === 'Weekend coupon: 20% off')
  check('5: Details shows the Arabic name, isolated as free text', (await details.locator('[data-line="nameAr"] dd > bdi:not([dir])').innerText()) === 'قسيمة نهاية الأسبوع: خصم 20%')
  check('5: Details shows the code and the features', (await details.locator('[data-line="code"] dd').innerText()) === 'WKND20' && (await details.locator('[data-feature]').allInnerTexts()).join('|') === 'Coupons|Loyalty points (Arbahi)')
  // 522: the draft carries no "created" stamp; Details says who last saved it (`updatedAt` / `updatedBy`).
  check('5: Details shows who last saved it, in local time', (await details.locator('[data-line="updated"] dd').innerText()) === '2026-09-28 11:30 by Sara (CRM)', await details.locator('[data-line="updated"] dd').innerText())
  const state = page.locator('[data-dashboard-cell="state"]')
  check('5: State reads Running with its live version', (await state.locator('[data-campaign-state]').innerText()) === 'Running' && (await state.locator('[data-live-version]').innerText()) === 'Tills run version 1.')
  const sched = page.locator('[data-dashboard-cell="schedule"]')
  check('5: Schedule says "Ends in 76 days"', (await sched.locator('[data-schedule-relative]').innerText()) === 'Ends in 76 days', await sched.locator('[data-schedule-relative]').innerText())
  check('5: Schedule shows the local days and the weekdays', (await sched.locator('[data-line="start"] dd').innerText()) === '2026-10-01' && (await sched.locator('[data-line="end"] dd').innerText()) === '2026-12-31' && (await sched.locator('[data-line="days"] dd').innerText()) === 'Thursday, Friday, Saturday')
  check('5: the campaign was read ONCE for the shell and the dashboard', reads() === 1, String(reads()))
  // 504 lands the Rule builder, 512 Versions and 515 Coupons (the coupons feature is on here).
  check('5: the side menu shows Dashboard, Rule builder, Coupons (515), Versions (512) and Settings', JSON.stringify(await page.locator('[data-workspace-menu]').evaluateAll((els) => els.map((e) => e.getAttribute('data-workspace-menu')))) === '["dashboard","rules","coupons","versions","settings"]')
  check('5: Dashboard is the current menu item', (await page.locator('[data-workspace-menu="dashboard"]').getAttribute('aria-current')) === 'page')
  check('5: the rail still lights the Campaigns leaf', (await page.locator('a[href="/campaigns"]:not([data-workspace-back])').first().getAttribute('aria-current')) === 'page')
  await page.screenshot({ path: `${SHOTS}/dashboard-wknd20.png` })
  await page.goBack()
  await waitRows(page, 2)
  check('5: Back returns to the list as it was left', page.url() === `${BASE}/campaigns?q=weekend`, page.url())
  check('9: no page errors (1–5)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 6 ──
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-campaign-link="NATDAY-15"]').click()
  await page.waitForURL(`${BASE}/campaigns/NATDAY-15`)
  await page.locator('[data-dashboard]').waitFor()
  check('6: the name link opens the campaign', page.url() === `${BASE}/campaigns/NATDAY-15`)
  check('6: a scheduled campaign "Starts in 3 days"', (await page.locator('[data-schedule-relative]').innerText()) === 'Starts in 3 days', await page.locator('[data-schedule-relative]').innerText())
  check('6: …reads Scheduled', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Scheduled')
  check('6: its daily hours are one isolated range', (await page.locator('[data-line="hours"] dd bdi[dir="ltr"]').innerText()) === '16:00–23:00')
  await page.screenshot({ path: `${SHOTS}/dashboard-natday.png` })

  await page.locator('[data-workspace-back]').click()
  await waitRows(page, 16)
  await page.locator('[data-campaign-link="BDAY-BEAUTY"]').click()
  await page.locator('[data-dashboard]').waitFor()
  check('6: a waiting campaign names who asked, and when', (await page.locator('[data-state-sentence="waitingForApproval"]').innerText()) === 'Omar (marketing) asked for approval on 2026-10-15 16:20.')
  check('6: …and shows the note', (await page.locator('[data-approval-note]').innerText()) === 'Ready for the November CRM push.')

  await page.goto(`${BASE}/campaigns/SPRING-DRAFT`)
  await page.locator('[data-dashboard]').waitFor()
  check('6: a draft with no schedule says "No time limit"', (await page.locator('[data-schedule-relative]').innerText()) === 'No time limit')
  check('6: …reads Draft', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Draft')
  check('6: …and says it has no Arabic name yet', (await page.locator('[data-line="nameAr"] dd').innerText()) === 'No Arabic name yet.')
  check('9: no page errors (6)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 7 ──
{
  const { context, page, errors } = await open({ at: SMALL_HOURS })
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  const counts = await readCounts(page)
  check('7: at 02:30 local (23:30 UTC the day before) the counts are the local day’s', JSON.stringify(counts) === JSON.stringify(COUNTS), JSON.stringify(counts))
  await page.goto(`${BASE}/campaigns/NATDAY-15`)
  await page.locator('[data-dashboard]').waitFor()
  check('7: …and the scheduled campaign still "Starts in 3 days"', (await page.locator('[data-schedule-relative]').innerText()) === 'Starts in 3 days', await page.locator('[data-schedule-relative]').innerText())
  check('9: no page errors (7)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 8 ──
{
  const { context, page, errors } = await open()
  await page.goto(`${BASE}/campaigns/NOPE`)
  const banner = page.locator('[role="alert"]').first()
  await banner.waitFor({ timeout: 10000 })
  check('8: an unknown campaign shows the door’s own refusal', (await banner.innerText()).includes(NOT_FOUND), await banner.innerText())
  await page.locator('[data-workspace-back]').click()
  await page.waitForURL(`${BASE}/campaigns`)
  check('8: …and the way back to the list', page.url() === `${BASE}/campaigns`)
  check('9: no page errors (8)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 502 ── it asserts:
//  10. New campaign opens Create campaign: an English and an Arabic name (the Arabic one dir=rtl),
//      Coupons off and Loyalty points on, each with its line saying what it switches on;
//  11. Create with a name missing says so at the field and sends nothing; Cancel sends nothing;
//      a reopened dialog is a fresh form;
//  12. both names + Coupons → the id is suggested from the English name (522: the author picks it);
//      a static leaf (`priority`) is refused at the field and nothing is sent; Enter sends ONE
//      Drafts/Save at revision 0 with the typed id, both names trimmed, no rule and the features →
//      the new draft's dashboard (both names, its id, Draft, its features, "No time limit"),
//      toasted; the list counts it;
//  13. a refusal is the door's own message, in the dialog, with the form kept; an edit clears it;
//  14. ⋯ › Copy campaign → an independent draft "<name> (copy)" in both languages, opened on its
//      dashboard as a Draft with no live version; the original is untouched (its name, Running,
//      version 1); the list counts both new drafts; Escape closes the ⋯ menu;
//  15. no page errors.
{
  const { context, page, errors, calls, bodies } = await open()
  const posts = () => bodies.length
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-new-campaign]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  check('10: New campaign opens Create campaign', (await dialog.locator('#modal-title').innerText()) === 'Create campaign')
  check('10: an English and an Arabic name, the Arabic one right-to-left', (await dialog.locator('[data-create-field="nameEn"]').getAttribute('dir')) === 'ltr' && (await dialog.locator('[data-create-field="nameAr"]').getAttribute('dir')) === 'rtl')
  check('10: Coupons starts off and Loyalty points on', !(await dialog.locator('[data-create-feature="coupons"]').isChecked()) && (await dialog.locator('[data-create-feature="points"]').isChecked()))
  const features = await dialog.locator('[data-create-features]').innerText()
  check('10: each feature says what it switches on', features.includes('Adds the Coupons page and the coupon condition.') && features.includes('Adds the Arbahi earn and burn conditions and effects.'))
  await page.screenshot({ path: `${SHOTS}/create-dialog.png` })

  await dialog.locator('[data-create-submit]').click()
  check('11: with no names, both fields say they are required', (await dialog.locator('[data-create-problem="nameEn"]').innerText()) === 'Enter the campaign’s English name.' && (await dialog.locator('[data-create-problem="nameAr"]').innerText()) === 'Enter the campaign’s Arabic name.')
  await dialog.locator('[data-create-field="nameEn"]').fill('Ramadan nights')
  await dialog.locator('[data-create-submit]').click()
  check('11: with only the English name, the Arabic one is still asked for', (await dialog.locator('[data-create-problem]').count()) === 1 && (await dialog.locator('[data-create-problem="nameAr"]').isVisible()))
  check('11: …and nothing was sent', posts() === 0)
  await dialog.getByRole('button', { name: 'Cancel' }).click()
  await page.waitForFunction(() => !document.querySelector('dialog[open]'))
  check('11: Cancel closes the dialog and sends nothing', posts() === 0)

  await page.locator('[data-new-campaign]').click()
  await dialog.waitFor()
  check('11: a reopened dialog is a fresh form', (await dialog.locator('[data-create-field="nameEn"]').inputValue()) === '' && (await dialog.locator('[data-create-problem]').count()) === 0)
  await dialog.locator('[data-create-field="nameEn"]').fill('  Ramadan nights ')
  await dialog.locator('[data-create-field="nameAr"]').fill(' ليالي رمضان ')
  await dialog.locator('[data-create-feature="coupons"]').check()
  const idField = dialog.locator('[data-create-field="id"]')
  check('12: the id is suggested from the English name', (await idField.inputValue()) === 'RAMADAN-NIGHTS', await idField.inputValue())
  await idField.fill('priority')
  await dialog.locator('[data-create-submit]').click()
  check('12: a static leaf is refused at the id field', await dialog.locator('[data-create-problem="id"]').isVisible())
  check('12: …and nothing was sent', posts() === 0)
  // 522 review: a first save at revision 0 would draft over a live campaign with no draft.
  await idField.fill('wknd20')
  check('12: a listed campaign’s id is refused, in any case', (await dialog.locator('[data-create-problem="id"]').innerText()).includes('A campaign already has this id') && posts() === 0)
  await idField.fill('RAMADAN-NIGHTS')
  await dialog.locator('[data-create-field="nameAr"]').press('Enter')
  await page.waitForURL(`${BASE}/campaigns/RAMADAN-NIGHTS`, { timeout: 10000 })
  await page.locator('[data-dashboard]').waitFor()
  check('12: Enter sends ONE Drafts/Save', posts() === 1, String(posts()))
  check(
    '12: …at revision 0, with the typed id, both names trimmed, no rule and the features chosen',
    bodies[0]?.revision === 0 && bodies[0]?.campaign?.id === 'RAMADAN-NIGHTS' && JSON.stringify(bodies[0]?.campaign?.name) === JSON.stringify({ en: 'Ramadan nights', ar: 'ليالي رمضان' }) && JSON.stringify(bodies[0]?.campaign?.rules) === '[]' && JSON.stringify(bodies[0]?.features) === '["coupons","points"]',
    JSON.stringify(bodies[0]),
  )
  check('12: it lands on the new draft’s dashboard', page.url() === `${BASE}/campaigns/RAMADAN-NIGHTS`)
  const details = page.locator('[data-dashboard-cell="details"]')
  check('12: the dashboard shows both names', (await details.locator('[data-line="nameEn"] dd').innerText()) === 'Ramadan nights' && (await details.locator('[data-line="nameAr"] dd').innerText()) === 'ليالي رمضان')
  check('12: …the id the author typed and both features', (await details.locator('[data-line="code"] dd').innerText()) === 'RAMADAN-NIGHTS' && (await details.locator('[data-feature]').allInnerTexts()).join('|') === 'Coupons|Loyalty points (Arbahi)')
  check('12: …a Draft with no time limit', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Draft' && (await page.locator('[data-schedule-relative]').innerText()) === 'No time limit')
  check('12: a toast says it was created', (await page.locator('[data-sonner-toast]').allInnerTexts()).some((x) => x.includes('Campaign created as a draft.')))
  check('12: the dialog has closed', (await page.locator('dialog[open]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/created-draft.png` })
  await page.locator('[data-workspace-back]').click()
  await waitRows(page, 17)
  check('12: the list counts the new draft', (await tileCount(page, 'all')) === '17' && (await tileCount(page, 'draft')) === '2')

  // ── 14 ──
  await page.goto(`${BASE}/campaigns/WKND20`)
  await page.locator('[data-dashboard]').waitFor()
  await page.locator('[data-campaign-actions]').click()
  const menu = page.locator('[data-campaign-actions-menu]')
  await menu.waitFor()
  check('14: ⋯ opens a menu with Copy campaign, focused', (await menu.locator('[data-campaign-action="copy"]').innerText()) === 'Copy campaign' && (await page.evaluate(() => document.activeElement?.getAttribute('data-campaign-action'))) === 'copy')
  await page.keyboard.press('Escape')
  await menu.waitFor({ state: 'detached' })
  check('14: Escape closes it, focus back on ⋯', (await page.evaluate(() => document.activeElement?.hasAttribute('data-campaign-actions'))) === true)
  const copies = () => calls.filter((c) => c === 'POST RuleCampaign/Campaigns/WKND20/Copy').length
  check('14: …and copied nothing', copies() === 0)
  await page.locator('[data-campaign-actions]').click()
  await menu.locator('[data-campaign-action="copy"]').click()
  await page.waitForURL(`${BASE}/campaigns/WKND20-COPY`, { timeout: 10000 })
  await page.waitForFunction(() => document.querySelector('[data-line="code"] dd')?.textContent === 'WKND20-COPY', null, { timeout: 10000 })
  check('14: ONE copy was asked for', copies() === 1, String(copies()))
  const cd = page.locator('[data-dashboard-cell="details"]')
  check('14: the copy is "<name> (copy)" in English…', (await cd.locator('[data-line="nameEn"] dd').innerText()) === 'Weekend coupon: 20% off (copy)')
  check('14: …and in Arabic', (await cd.locator('[data-line="nameAr"] dd').innerText()) === 'قسيمة نهاية الأسبوع: خصم 20% (نسخة)')
  check('14: the copy is a Draft with no live version', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Draft' && (await page.locator('[data-live-version]').count()) === 0)
  check('14: a toast says it was copied', (await page.locator('[data-sonner-toast]').allInnerTexts()).some((x) => x.includes('Copied as a new draft.')))
  await page.screenshot({ path: `${SHOTS}/copied-draft.png` })
  await page.goto(`${BASE}/campaigns/WKND20`)
  await page.locator('[data-dashboard]').waitFor()
  check('14: the original is untouched — its name, Running, version 1', (await page.locator('[data-line="nameEn"] dd').innerText()) === 'Weekend coupon: 20% off' && (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Running' && (await page.locator('[data-live-version]').innerText()) === 'Tills run version 1.')
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 18)
  check('14: the list counts both new drafts', (await tileCount(page, 'all')) === '18' && (await tileCount(page, 'draft')) === '3' && (await tileCount(page, 'running')) === '11')
  check('15: no page errors (10–14)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 13 ──
{
  const { context, page, errors } = await open({ refuseCreate: true })
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-new-campaign]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await dialog.locator('[data-create-field="nameEn"]').fill('Weekend coupon')
  await dialog.locator('[data-create-field="nameAr"]').fill('قسيمة نهاية الأسبوع')
  await dialog.locator('[data-create-field="id"]').fill('WKND-NEW')
  await dialog.locator('[data-create-submit]').click()
  const banner = dialog.locator('[role="alert"]')
  await banner.waitFor({ timeout: 10000 })
  check('13: a refused create shows the door’s own message in the dialog', (await banner.innerText()).includes(CREATE_REFUSED), await banner.innerText())
  check('13: …keeps the form and stays on the list', (await dialog.locator('[data-create-field="nameEn"]').inputValue()) === 'Weekend coupon' && page.url() === `${BASE}/campaigns`)
  await dialog.locator('[data-create-field="nameEn"]').fill('Weekend coupon 2')
  check('13: an edit clears the refusal, which was about the name as sent', (await dialog.locator('[role="alert"]').count()) === 0)
  check('15: no page errors (13)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 503 ── it asserts:
// 100. Create campaign opens on its Blank campaign tab; From a template lists HQ's templates, each
//      with both names, its one line and what it asks for; a draft template is marked and cannot
//      be picked;
// 101. picking one asks for its placeholders at their defaults — a number with its bounds, the
//      builder's item picker for a category — and shows the name the draft will have;
// 102. a value out of bounds or missing is said at its field once Create is tried, and nothing is sent;
//      Create with no template picked asks for one; Enter in the item search sends nothing and
//      Escape there clears the search, not the dialog;
// 103. the values typed and a second category picked → ONE create from that template, with the
//      typed values and a draft whose every placeholder is filled;
// 104. it lands on the new draft's dashboard (both filled names, Draft, toasted), and its rule
//      builder reads the filled values: the threshold, the percent, both categories, both labels;
// 105. a refusal is the door's own message, in the dialog, with the values kept; an edit clears it;
//      a refused templates door says so in the tab;
// 106. a reopened dialog is back on the blank tab; no page errors.
{
  const { context, page, errors, calls, fromTemplate } = await open()
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-new-campaign]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  const tab = (x) => dialog.locator(`[data-create-tab="${x}"]`)
  check('100: the dialog opens on Blank campaign', (await tab('blank').getAttribute('aria-selected')) === 'true' && (await tab('template').innerText()) === 'From a template')
  check('100: …and reads no template until its tab opens', !calls.includes('GET RuleCampaign/Templates'))
  await tab('template').click()
  await dialog.locator('[data-template-list]').waitFor({ timeout: 10000 })
  check('100: From a template is the open tab', (await tab('template').getAttribute('aria-selected')) === 'true')
  const ids = await dialog.locator('[data-template]').evaluateAll((els) => els.map((e) => e.getAttribute('data-template')))
  check('100: every template is listed', JSON.stringify(ids) === '["T-SPEND-PCT","T-BUY-N","T-TIER-PTS"]', JSON.stringify(ids))
  const spend = dialog.locator('[data-template="T-SPEND-PCT"]')
  const spendText = await spend.innerText()
  check('100: a template shows both names and its one line', spendText.includes('Spend X, get Y% off a category') && spendText.includes('أنفق مبلغاً واحصل على خصم على فئة') && spendText.includes('A basket threshold and a percent off the categories picked.'), spendText)
  const asks = (await spend.locator('[data-template-asks]').innerText()).replace(/[⁦-⁩]/g, '')
  check('100: …and what it asks for', asks === 'Asks for: Minimum basket (SAR), Percent off, and Category', asks)
  const tier = dialog.locator('[data-template="T-TIER-PTS"]')
  check('100: a draft template is marked and cannot be picked', (await tier.locator('[data-template-draft]').count()) === 1 && (await tier.isDisabled()))

  await dialog.locator('[data-create-submit]').click()
  check('102: Create with no template picked asks for one', (await dialog.locator('[data-template-pick="missing"]').innerText()) === 'Pick a template first.')
  check('102: …and sent nothing', !calls.some((c) => c.startsWith('POST RuleCampaign/Templates/')))

  await spend.click()
  const fill = dialog.locator('[data-template-fill="T-SPEND-PCT"]')
  await fill.waitFor()
  check('101: the picked template is pressed', (await spend.getAttribute('aria-pressed')) === 'true')
  const input = (k) => fill.locator(`[data-template-input="${k}"]`)
  check('101: the numbers start at their defaults', (await input('minSpend').inputValue()) === '200' && (await input('pct').inputValue()) === '10')
  check('101: a number says its bounds, as one isolate', (await fill.locator('[data-template-hint="minSpend"]').innerText()) === 'Between 50–1000.' && (await fill.locator('[data-template-hint="minSpend"] bdi[dir="ltr"]').innerText()) === '50–1000')
  const picks = (k) => fill.locator(`[data-picks="template-${k}"] [data-pick]`).evaluateAll((els) => els.map((e) => e.getAttribute('data-pick')))
  check('101: the category is the builder’s item picker, at its default', JSON.stringify(await picks('cats')) === '["A002"]' && (await fill.locator('[data-lookup="template-cats"]').count()) === 1)
  const preview = (lang) => fill.locator(`[data-template-preview-name="${lang}"]`).innerText()
  check('101: the draft’s name is shown in both languages', (await preview('en')) === 'Spend SAR 200, get 10% off' && (await preview('ar')) === 'أنفق 200 ريال واحصل على خصم 10%')
  await page.screenshot({ path: `${SHOTS}/from-template.png` })

  const creates = () => calls.filter((c) => c.startsWith('POST RuleCampaign/Templates/')).length
  await input('minSpend').fill('1200')
  await input('pct').fill('')
  check('101: no name is shown while a value is wrong', (await fill.locator('[data-template-preview]').count()) === 0)
  await dialog.locator('[data-create-submit]').click()
  check('102: out of bounds says so at its field', (await fill.locator('[data-template-problem="minSpend"]').innerText()).replace(/[⁦-⁩]/g, '') === 'Enter 1000 or less.')
  check('102: an empty value says so at its field', (await fill.locator('[data-template-problem="pct"]').innerText()) === 'Enter a value.')
  check('102: …and nothing was sent', creates() === 0)

  await input('minSpend').fill('250')
  await input('pct').fill('15')
  await fill.locator('[data-lookup="template-cats"]').fill('baby')
  await fill.locator('[data-lookup-hit="A003"]').waitFor({ timeout: 10000 })
  await fill.locator('[data-lookup="template-cats"]').press('Enter')
  await page.waitForTimeout(300)
  check('102: Enter in the item search sends nothing', creates() === 0 && (await dialog.count()) === 1)
  await fill.locator('[data-lookup="template-cats"]').press('Escape')
  await page.waitForTimeout(200)
  check('102: Escape there clears the search and keeps the dialog', (await fill.locator('[data-lookup="template-cats"]').inputValue()) === '' && (await page.locator('dialog[open]').count()) === 1 && (await input('minSpend').inputValue()) === '250')
  await fill.locator('[data-lookup="template-cats"]').fill('baby')
  await fill.locator('[data-lookup-hit="A003"]').click({ timeout: 10000 })
  check('103: a second category is picked', JSON.stringify(await picks('cats')) === '["A002","A003"]')
  check('103: the name follows the values', (await preview('en')) === 'Spend SAR 250, get 15% off')
  await dialog.locator('[data-create-submit]').click()
  await page.waitForURL(`${BASE}/campaigns/SPEND-SAR-250-GE`, { timeout: 10000 })
  await page.locator('[data-dashboard]').waitFor()
  check('103: ONE create from the template', creates() === 1 && fromTemplate[0]?.id === 'T-SPEND-PCT', String(creates()))
  const sent = fromTemplate[0]?.body
  check('103: …with the values as typed', JSON.stringify(sent?.values) === JSON.stringify({ minSpend: 250, pct: 15, cats: ['A002', 'A003'] }), JSON.stringify(sent?.values))
  const rule = sent?.draft.rules[0]
  check(
    '103: …and a schema-1 draft with every placeholder filled',
    !/placeholder|\{\{/.test(JSON.stringify(sent?.draft)) && rule?.when[0].amount === 250 && rule?.then[0].value === 15 && JSON.stringify(rule?.filters[0].categories) === '["A002","A003"]',
    JSON.stringify(sent?.draft),
  )

  const details = page.locator('[data-dashboard-cell="details"]')
  check('104: the dashboard shows both filled names', (await details.locator('[data-line="nameEn"] dd').innerText()) === 'Spend SAR 250, get 15% off' && (await details.locator('[data-line="nameAr"] dd').innerText()) === 'أنفق 250 ريال واحصل على خصم 15%')
  check('104: …a Draft', (await page.locator('[data-dashboard-cell="state"] [data-campaign-state]').innerText()) === 'Draft')
  check('104: a toast says it was created', (await page.locator('[data-sonner-toast]').allInnerTexts()).some((x) => x.includes('Campaign created as a draft.')))
  await page.locator('[data-workspace-menu="rules"]').click()
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  const card = page.locator('[data-rule-card]').first()
  check('104: the rule’s name is filled', (await card.locator('[data-rule-name]').inputValue()) === '15% off the category')
  const condition = await card.locator('[data-condition] [data-block-sentence]').innerText()
  check('104: the condition reads the threshold', condition.includes('250.00'), condition)
  const effect = await card.locator('[data-effect] [data-block-sentence]').innerText()
  check('104: the effect reads the percent', effect.includes('15%') && effect.includes('target'), effect)
  const links = await card.locator('[data-filter] [data-filter-link]').allInnerTexts()
  check('104: the filter keeps both categories picked', links.some((l) => l.includes('A002') && l.includes('A003')), JSON.stringify(links))
  const notMet = card.locator('[data-condition] [data-says="notMet"]')
  check('104: the "not met" message is filled in both languages', (await notMet.locator('[data-says-en]').innerText()) === 'a basket of SAR 250' && (await notMet.locator('[data-says-ar]').innerText()) === 'سلة بقيمة 250 ريال')
  const label = card.locator('[data-effect] [data-says="receiptLabel"]')
  check('104: the receipt label is filled in both languages', (await label.locator('[data-says-en]').innerText()) === '15% off' && (await label.locator('[data-says-ar]').innerText()) === 'خصم 15%')
  await page.screenshot({ path: `${SHOTS}/from-template-rules.png`, fullPage: true })

  await page.locator('[data-workspace-back]').click()
  await waitRows(page, 17)
  check('104: the list counts the new draft', (await tileCount(page, 'all')) === '17' && (await tileCount(page, 'draft')) === '2')
  await page.locator('[data-new-campaign]').click()
  await dialog.waitFor()
  check('106: a reopened dialog is back on the blank tab', (await tab('blank').getAttribute('aria-selected')) === 'true' && (await dialog.locator('[data-create-field="nameEn"]').count()) === 1)
  check('106: no page errors (100–104)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 105 ──
{
  const { context, page, errors } = await open({ refuseFromTemplate: 1 })
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-new-campaign]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await dialog.locator('[data-create-tab="template"]').click()
  await dialog.locator('[data-template="T-BUY-N"]').click()
  const fill = dialog.locator('[data-template-fill="T-BUY-N"]')
  await fill.waitFor()
  check('105: a collection is picked with the builder’s picker', JSON.stringify(await fill.locator('[data-picks="template-coll"] [data-pick]').evaluateAll((els) => els.map((e) => e.getAttribute('data-pick')))) === '["SUNCARE"]')
  await fill.locator('[data-template-input="buy"]').fill('4')
  await dialog.locator('[data-create-submit]').click()
  const banner = dialog.locator('[role="alert"]')
  await banner.waitFor({ timeout: 10000 })
  check('105: a refused create shows the door’s own message in the dialog', (await banner.innerText()).includes(FROM_TEMPLATE_REFUSED), await banner.innerText())
  check('105: …keeps the values and stays on the list', (await fill.locator('[data-template-input="buy"]').inputValue()) === '4' && page.url() === `${BASE}/campaigns`)
  await fill.locator('[data-template-input="free"]').fill('2')
  check('105: an edit clears the refusal', (await dialog.locator('[role="alert"]').count()) === 0)
  await dialog.locator('[data-create-submit]').click()
  await page.waitForURL(`${BASE}/campaigns/BUY-4-GET-2-FREE`, { timeout: 10000 })
  await page.locator('[data-dashboard]').waitFor()
  check('105: sent again, it lands on the draft', (await page.locator('[data-line="nameEn"] dd').innerText()) === 'Buy 4, get 2 free')
  check('106: no page errors (105)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open({ refuseTemplates: true })
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  await page.locator('[data-new-campaign]').click()
  const dialog = page.locator('dialog[open]')
  await dialog.waitFor()
  await dialog.locator('[data-create-tab="template"]').click()
  const banner = dialog.locator('[role="alert"]')
  await banner.waitFor({ timeout: 10000 })
  check('105: a refused templates door says so in the tab, in its own words', (await banner.innerText()).includes('The templates could not be read') && (await banner.innerText()).includes(TEMPLATES_REFUSED), await banner.innerText())
  check('106: no page errors (105, templates refused)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 504 ── it asserts:
//  16. the side menu's Rule builder opens /campaigns/:id/rules; the block catalogue is read ONCE
//      for every builder page of the app's life (two campaigns, in-app navigation);
//  17. SUN-3FOR2 reads as sentences: its filter as a chain, When all, two conditions and one
//      effect in words, values isolated by kind (money and counts in a dir=ltr isolate, the filter's
//      name in a plain <bdi>), and the marketer's EN + AR lines under each block, the Arabic dir=rtl;
//  18. EVERY sample campaign renders every block as a sentence: no unknown block, no raw key, no
//      template brace, no raw type id;
//  19. a rule with no condition reads "Always", and its summary says so;
//  20. a filter renamed on HQ reads by its new name — conditions and effects find it by id;
//  21. a card collapses and expands (aria-expanded, the summary stays); Collapse all / Expand all;
//  22. a refused catalogue is the door's own message, and Try again reads it afresh;
//  23. no page errors.
{
  const { context, page, errors, calls } = await open()
  const catalogueReads = () => calls.filter((c) => c === 'GET RuleCampaign/Catalogue').length
  await page.goto(`${BASE}/campaigns/SUN-3FOR2`)
  await page.locator('[data-dashboard]').waitFor()
  check('16: the catalogue is not read before the builder opens', catalogueReads() === 0)
  await page.locator('[data-workspace-menu="rules"]').click()
  await page.waitForURL(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  check('16: Rule builder opens /campaigns/:id/rules, the current menu item', (await page.locator('[data-workspace-menu="rules"]').getAttribute('aria-current')) === 'page')
  check('16: one card per rule', (await page.locator('[data-rule-card]').count()) === 1)

  const card = page.locator('[data-rule-card]').first()
  check('17: the card is headed by its rule number and name', (await card.locator('[data-rule-name]').inputValue()) === 'Cheapest of every three suncare units free')
  check('17: its summary counts filters, conditions and effects', (await card.locator('[data-rule-summary]').innerText()).replace(/\s+/g, ' ') === '1 cart item filter 2 conditions 1 effect', await card.locator('[data-rule-summary]').innerText())
  const filter = card.locator('[data-filter]').first()
  check('17: the filter reads as a chain, by name', (await filter.locator('[data-filter-name]').innerText()) === 'sun' && JSON.stringify(await filter.locator('[data-filter-link]').allInnerTexts()) === '["product SUN-50, SUN-30, or SUN-KID"]', JSON.stringify(await filter.locator('[data-filter-link]').allInnerTexts()))
  check('17: When all', (await card.locator('[data-when]').innerText()) === 'When all of these are true')
  const sentences = await card.locator('[data-condition] [data-block-sentence]').allInnerTexts()
  check('17: the conditions read as sentences', JSON.stringify(sentences) === JSON.stringify(['At least 3 units of sun', 'The value of all merchandise is at least SAR 150.00, before any offer']), JSON.stringify(sentences))
  check('17: the effect reads as a sentence', (await card.locator('[data-effect] [data-block-sentence]').innerText()) === 'For every 3 of sun, the cheapest 1 unit is free')
  check('17: money is one dir=ltr isolate', (await card.locator('[data-condition] [data-value="money"] bdi[dir="ltr"]').innerText()) === 'SAR 150.00')
  check('17: a count is a dir=ltr isolate', (await card.locator('[data-condition] [data-value="number"] bdi[dir="ltr"]').first().innerText()) === '3')
  check('17: the filter’s name is free text in a plain <bdi>', (await card.locator('[data-condition] [data-value="name"] > bdi:not([dir])').first().innerText()) === 'sun')
  const notMet = card.locator('[data-condition]').first().locator('[data-says="notMet"]')
  check('17: a condition’s "not met" line shows the English and the Arabic', (await notMet.locator('[data-says-en]').innerText()) === 'three suncare items' && (await notMet.locator('[data-says-ar]').innerText()) === 'ثلاثة منتجات للعناية بالشمس')
  check('17: …the Arabic one right-to-left', (await notMet.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')
  const label = card.locator('[data-effect] [data-says="receiptLabel"]')
  check('17: the discount’s receipt label shows both languages', (await label.locator('[data-says-en]').innerText()) === 'Suncare 3 for 2' && (await label.locator('[data-says-ar]').innerText()) === 'العناية بالشمس 3 بسعر 2')
  await page.screenshot({ path: `${SHOTS}/rules-sun.png`, fullPage: true })

  // In-app to a second campaign's builder: the catalogue is not read again.
  await page.locator('[data-workspace-back]').click()
  await waitRows(page, 16)
  await page.locator('[data-campaign-link="GP-BEAUTY15"]').click()
  await page.locator('[data-dashboard]').waitFor()
  await page.locator('[data-workspace-menu="rules"]').click()
  await page.locator('[data-rules]').waitFor()
  check('16: the catalogue was read ONCE for two builder pages', catalogueReads() === 1, String(catalogueReads()))
  check('17: a choice reads in words: the tier', (await page.locator('[data-condition] [data-block-sentence]').first().innerText()) === 'The member’s tier is Gold or Platinum')
  check('17: a percent reads as one isolate', (await page.locator('[data-effect] [data-block-sentence]').innerText()) === 'Take 15% off each item of beauty' && (await page.locator('[data-effect] [data-value="percent"] bdi[dir="ltr"]').innerText()) === '15%')
  check('23: no page errors (16–17)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 18, 19 ──
{
  const { context, page, errors } = await open()
  const TYPE_IDS = CATALOGUE.blocks.map((b) => b.type).filter((type) => /[A-Z]/.test(type))
  const leaves = (items) => items.flatMap((c) => (c.check === 'group' ? leaves(c.conditions) : [c]))
  const bad = []
  let read = 0
  for (const c of CAMPAIGNS.filter((x) => x.campaign.rules.length)) {
    await page.goto(`${BASE}/campaigns/${c.code}/rules`)
    await page.locator('[data-rules]').waitFor({ timeout: 10000 })
    const blocks = c.campaign.rules.reduce((n, r) => n + leaves(r.when).length + r.then.length, 0)
    const shown = await page.locator('[data-condition], [data-effect]').count()
    const unknown = await page.locator('[data-sentence="sentence.unknown"]').count()
    const text = await page.locator('[data-rule-builder]').innerText()
    const leaks = TYPE_IDS.filter((id) => text.includes(id))
    if (shown !== blocks || unknown || /sentence\.|rules\.|\{\{|\}\}/.test(text) || leaks.length)
      bad.push(`${c.code}: ${shown}/${blocks} shown, ${unknown} unknown, leaks ${leaks.join(',')}`)
    read += shown
  }
  check('18: every sample campaign reads every block as a sentence, no raw key, no type id', bad.length === 0 && read > 0, bad.join(' | ') || `${read} blocks`)

  await page.goto(`${BASE}/campaigns/WLCB/rules`)
  await page.locator('[data-rules]').waitFor()
  check('18: a formula is shown as written, in one isolate', (await page.locator('[data-condition] [data-value="formula"] bdi[dir="ltr"]').innerText()) === 'back > 0')
  // 522: a value is { name, expr }; its box shows the expression as text (core/rules/expr).
  const valueNames = await page.locator('[data-rule-section="values"] [data-value-name]').evaluateAll((els) => els.map((e) => e.value))
  const valueTexts = await page.locator('[data-rule-section="values"] [data-fx-input]').evaluateAll((els) => els.map((e) => e.value))
  check('18: named values read with their expression as text', JSON.stringify(valueNames.map((n, i) => `${n} = ${valueTexts[i]}`)) === JSON.stringify(["eligible = sum(items('Eligible'), item.net)", 'back = round(eligible * 0.1, 0, halfUp)']), JSON.stringify([valueNames, valueTexts]))
  check('18: points read in words, with when they activate and expire', (await page.locator('[data-effect] [data-block-sentence]').innerText()) === 'Award back in SAR of points under the activity WLCB, usable after 7 days, expiring after 30 days')
  check('18: Prescription is named in the chain', (await page.locator('[data-filter-link]').allInnerTexts()).includes('not Prescription A006'))
  await page.screenshot({ path: `${SHOTS}/rules-wlcb.png`, fullPage: true })

  await page.goto(`${BASE}/campaigns/BH-SPEND10/rules`)
  await page.locator('[data-rules]').waitFor()
  check('18: a Bahraini amount reads to the fils', (await page.locator('[data-condition] [data-value="money"]').innerText()) === 'BHD 10.000')

  await page.goto(`${BASE}/campaigns/PCUT-SA01/rules`)
  await page.locator('[data-rules]').waitFor()
  check('19: a rule with no condition reads "Always"', (await page.locator('[data-when]').innerText()) === 'Always' && (await page.locator('[data-when]').getAttribute('data-when')) === 'always')
  check('19: …says what that means', (await page.locator('[data-rule-section="when"]').innerText()).includes('No condition: the effects apply to every sale the campaign reaches.'))
  check('19: …and its summary says always', (await page.locator('[data-rule-summary]').innerText()).includes('always'))
  check('19: a rule with no filter says it looks at all merchandise', (await page.locator('[data-rule-section="filters"]').innerText()).includes('No filter: the rule looks at all merchandise.'))
  check('23: no page errors (18–19)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 20, 21 ──
{
  const { context, page, errors } = await open({
    edit: (store) => {
      const sun = store.find((c) => c.code === 'SUN-3FOR2')
      sun.campaign.rules[0].filters[0].name = 'Suncare'
      sun.campaign.rules.push({ id: 'r-extra', name: 'Pouch with every suncare basket', filters: [], values: [], when: [], then: [{ effect: 'cashierMessage', text: { en: 'Ask about the pouch', ar: '' } }] })
    },
  })
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor()
  const first = page.locator('[data-rule-card]').first()
  check('20: a renamed filter reads by its new name, found by id', (await first.locator('[data-condition] [data-block-sentence]').first().innerText()) === 'At least 3 units of Suncare' && (await first.locator('[data-effect] [data-block-sentence]').innerText()) === 'For every 3 of Suncare, the cheapest 1 unit is free')
  const second = page.locator('[data-rule-card="r-extra"]')
  check('21: a message with no Arabic yet says so', (await second.locator('[data-says="message"] [data-says-ar]').innerText()) === 'No Arabic yet.')

  const toggle = first.locator('[data-rule-toggle]')
  check('21: a card opens expanded', (await toggle.getAttribute('aria-expanded')) === 'true' && (await first.locator('[data-rule-body]').count()) === 1)
  await toggle.click()
  check('21: its toggle collapses it to the header and the summary', (await toggle.getAttribute('aria-expanded')) === 'false' && (await first.locator('[data-rule-body]').count()) === 0 && (await first.locator('[data-rule-summary]').isVisible()))
  check('21: …the other card stays open', (await second.locator('[data-rule-body]').count()) === 1)
  await toggle.click()
  check('21: and expands it again', (await toggle.getAttribute('aria-expanded')) === 'true' && (await first.locator('[data-rule-body]').count()) === 1)
  await page.locator('[data-rules-collapse-all]').click()
  check('21: Collapse all closes every card', (await page.locator('[data-rule-body]').count()) === 0 && (await page.locator('[data-rule-toggle][aria-expanded="false"]').count()) === 2)
  await page.screenshot({ path: `${SHOTS}/rules-collapsed.png`, fullPage: true })
  await page.locator('[data-rules-expand-all]').click()
  check('21: Expand all opens them again', (await page.locator('[data-rule-body]').count()) === 2)
  check('23: no page errors (20–21)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 22 ──
{
  const { context, page, errors, heal } = await open({ refuseCatalogue: true })
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  const banner = page.locator('[role="alert"]').first()
  await banner.waitFor({ timeout: 10000 })
  check('22: a refused catalogue shows the door’s own message', (await banner.innerText()).includes(CATALOGUE_REFUSED), await banner.innerText())
  check('22: …and no rule is drawn half-read', (await page.locator('[data-rule-card]').count()) === 0)
  heal()
  await page.locator('[data-catalogue-retry]').click()
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  check('22: Try again reads the catalogue afresh and draws the rules', (await page.locator('[data-rule-card]').count()) === 1 && (await page.locator('[role="alert"]').count()) === 0)
  check('23: no page errors (22)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 505 ── it asserts:
//  24. the builder bar: Undo / Redo / Cancel / Save, all disabled on an unedited campaign;
//  25. + Condition opens the palette by group — only blocks the features switch on (points yes,
//      coupons no on SUN-3FOR2, saying where coupon blocks are), never a "not decided" one (the
//      formula block is offered since 507); a coupons campaign offers the coupon condition; Escape closes it;
//  26. a pick adds the block with its panel open; the panel's typed fields (a count, the rule's
//      filters by id) and the EN + AR "not met" pair (the Arabic dir=rtl) edit it live; Done closes
//      it and the sentence and both lines read the edit;
//  27. "Unsaved changes" shows; Undo steps back one edit (the typed pair is ONE step), Redo
//      forward; Undo to the start is clean again;
//  28. Save sends ONE draft save with the rules as edited (filters by id, the pair, the browser's
//      block id), clears the history, toasts; a reload reads the saved rule back;
//  29. + Effect, a discount filled in its panel, reorder of effects, delete; Cancel goes back to
//      the saved rules;
//  30. Add rule, name it, move it up, delete it; a group with a condition inside it (an empty one
//      leaves the rule "Always"); codes typed with commas, and Undo empties the input too;
//  31. leaving with unsaved changes asks: Stay keeps them, Leave and discard goes;
//  32. a refused save is the door's own message, the edits kept; a formula opens in its panel in
//      the ƒx box (507);
//  33. no page errors.
{
  const { context, page, errors, saves } = await open()
  const sun = CAMPAIGNS.find((c) => c.code === 'SUN-3FOR2')
  const sunFilter = sun.campaign.rules[0].filters[0].id
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  const bar = page.locator('[data-builder-bar]')
  const disabled = async (sel) => bar.locator(sel).isDisabled()
  check('24: Undo, Redo, Cancel and Save are all disabled on an unedited campaign', (await disabled('[data-undo]')) && (await disabled('[data-redo]')) && (await disabled('[data-cancel]')) && (await disabled('[data-save]')) && (await page.locator('[data-unsaved]').count()) === 0)

  // ── 25 ──
  const card = page.locator('[data-rule-card]').first()
  await card.locator('[data-palette-open="when"]').click()
  const palette = card.locator('[data-palette="when"]')
  await palette.waitFor()
  const offered = await palette.locator('[data-palette-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-block')))
  const groups = await palette.locator('[data-palette-group]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-group')))
  check('25: the palette is grouped by category', JSON.stringify(groups) === JSON.stringify(['cart', 'customer', 'context', 'limits', 'advanced']), JSON.stringify(groups))
  check('25: points blocks with points on, no coupon block with coupons off', offered.includes('minPoints') && !offered.includes('coupon'), offered.join(','))
  check('25: …and it says where the coupon blocks are', (await palette.locator('[data-palette-hidden="coupons"]').count()) === 1 && (await palette.locator('[data-palette-hidden="points"]').count()) === 0)
  check('25: "not decided" blocks are left out; the formula block is offered (507)', !offered.includes('audience') && offered.includes('formula'))
  check('25: blocks read in words', (await palette.locator('[data-palette-block="minCount"]').innerText()) === 'Number of items is at least')
  check('25: focus moves into the palette', await palette.locator('[data-palette-block="minSubtotal"]').evaluate((e) => e === document.activeElement))
  await page.keyboard.press('Escape')
  check('25: Escape closes it, focus back on its button', (await card.locator('[data-palette="when"]').count()) === 0 && (await card.locator('[data-palette-open="when"]').evaluate((e) => e === document.activeElement)))

  // ── 26 ──
  await card.locator('[data-palette-open="when"]').click()
  await card.locator('[data-palette="when"] [data-palette-block="minCount"]').click()
  const added = card.locator('[data-condition]').nth(2)
  const panel = added.locator('[data-block-panel]')
  check('26: a pick adds the block at the end of When, its panel open', (await card.locator('[data-condition]').count()) === 3 && (await panel.count()) === 1 && (await card.locator('[data-palette="when"]').count()) === 0)
  check('26: a new block reads with its number not picked yet', (await added.locator('[data-block-sentence]').innerText()) === 'At least not picked yet units of all merchandise', await added.locator('[data-block-sentence]').innerText())
  check('26: …and the summary counts it', (await card.locator('[data-rule-summary]').innerText()).includes('3 conditions'))
  await panel.locator('[data-panel-field="count"]').fill('2')
  await panel.locator('[data-panel-field="of"]').selectOption(sunFilter)
  check('26: the items field offers the rule’s filters by name', JSON.stringify(await panel.locator('[data-panel-field="of"] option').allInnerTexts()).includes('sun'))
  const ar = panel.locator('[data-panel-says="notMet"] [data-panel-says-ar]')
  check('26: the Arabic half is its own right-to-left input', (await ar.getAttribute('dir')) === 'rtl' && (await panel.locator('[data-panel-says="notMet"] [data-panel-says-en]').getAttribute('dir')) === 'ltr')
  await panel.locator('[data-panel-says="notMet"] [data-panel-says-en]').fill('two suncare items')
  await ar.fill('منتجان للعناية بالشمس')
  check('26: the sentence reads the panel live', (await added.locator('[data-block-sentence]').innerText()) === 'At least 2 units of sun', await added.locator('[data-block-sentence]').innerText())
  await page.screenshot({ path: `${SHOTS}/builder-panel.png`, fullPage: true })
  await panel.locator('[data-panel-done]').click()
  check('26: Done closes the panel', (await added.locator('[data-block-panel]').count()) === 0)
  const notMetLine = added.locator('[data-says="notMet"]')
  check('26: both halves of the "not met" pair show, the Arabic dir=rtl', (await notMetLine.locator('[data-says-en]').innerText()) === 'two suncare items' && (await notMetLine.locator('[data-says-ar]').innerText()) === 'منتجان للعناية بالشمس' && (await notMetLine.locator('[data-says-ar]').getAttribute('dir')) === 'rtl')

  // ── 27 ──
  check('27: Unsaved changes shows, Save and Undo are enabled', (await page.locator('[data-unsaved]').count()) === 1 && !(await disabled('[data-save]')) && !(await disabled('[data-undo]')) && (await disabled('[data-redo]')))
  await bar.locator('[data-undo]').click()
  check('27: Undo takes back the typed pair as ONE step', (await added.locator('[data-says="notMet"]').count()) === 0 && (await added.locator('[data-block-sentence]').innerText()) === 'At least 2 units of sun')
  await bar.locator('[data-redo]').click()
  check('27: Redo puts it back', (await added.locator('[data-says="notMet"] [data-says-ar]').innerText()) === 'منتجان للعناية بالشمس')
  for (let i = 0; i < 4; i++) await bar.locator('[data-undo]').click()
  check('27: Undo to the start removes the block and is clean again', (await card.locator('[data-condition]').count()) === 2 && (await page.locator('[data-unsaved]').count()) === 0 && (await disabled('[data-save]')) && (await disabled('[data-undo]')))
  for (let i = 0; i < 4; i++) await bar.locator('[data-redo]').click()
  check('27: Redo all the way brings it back whole', (await card.locator('[data-condition]').count()) === 3 && (await card.locator('[data-condition]').nth(2).locator('[data-block-sentence]').innerText()) === 'At least 2 units of sun' && (await disabled('[data-redo]')))

  // ── 28 ──
  await bar.locator('[data-save]').click()
  await page.locator('[data-unsaved]').waitFor({ state: 'detached', timeout: 10000 })
  const sent = saves[0]?.campaign?.rules?.[0]?.when?.[2]
  check('28: Save sends ONE Drafts/Save', saves.length === 1)
  check('28: …the WHOLE campaign at the revision loaded, with its features', saves[0]?.revision === sun.revision && saves[0]?.campaign?.id === 'SUN-3FOR2' && JSON.stringify(saves[0]?.campaign?.window) === JSON.stringify(sun.campaign.window) && JSON.stringify(saves[0]?.campaign?.name) === JSON.stringify(sun.campaign.name) && JSON.stringify(saves[0]?.features) === JSON.stringify(sun.features), JSON.stringify(saves[0]))
  check('28: …with the block as edited, keyed by check, items by filter id, both languages, and no client key', sent?.check === 'minCount' && sent.count === 2 && sent.of === sunFilter && sent.says?.en === 'two suncare items' && sent.says?.ar === 'منتجان للعناية بالشمس' && !('id' in sent) && !('type' in sent), JSON.stringify(sent))
  check('28: …and the other blocks untouched', JSON.stringify(saves[0]?.campaign?.rules?.[0]?.then) === JSON.stringify(sun.campaign.rules[0].then))
  check('28: saved: no unsaved pill, Save, Undo and Cancel disabled', (await disabled('[data-save]')) && (await disabled('[data-undo]')) && (await disabled('[data-cancel]')))
  check('28: a toast says so', await page.getByText('The rules are saved.').first().isVisible())
  await page.reload()
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  check('28: a reload reads the saved rule back', (await page.locator('[data-condition]').nth(2).locator('[data-block-sentence]').innerText()) === 'At least 2 units of sun')

  // ── 29 ──
  const card2 = page.locator('[data-rule-card]').first()
  await card2.locator('[data-palette-open="then"]').click()
  const effects = await card2.locator('[data-palette="then"] [data-palette-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-block')))
  check('29: the effect palette offers points blocks with points on', effects.includes('awardPoints') && effects.includes('discountItems'), effects.join(','))
  await card2.locator('[data-palette="then"] [data-palette-block="discountItems"]').click()
  const effect = card2.locator('[data-effect]').nth(1)
  const ep = effect.locator('[data-block-panel]')
  check('29: the new effect works on the rule’s filter', (await ep.locator('[data-panel-field="filter"]').inputValue()) === sunFilter)
  await ep.locator('[data-panel-field="value"]').fill('10')
  await ep.locator('[data-panel-says="receiptLabel"] [data-panel-says-en]').fill('Sun 10%')
  await ep.locator('[data-panel-says="receiptLabel"] [data-panel-says-ar]').fill('خصم الشمس 10%')
  check('29: a discount’s receipt label is an EN + AR pair, the Arabic dir=rtl', (await ep.locator('[data-panel-says="receiptLabel"] [data-panel-says-ar]').getAttribute('dir')) === 'rtl')
  check('29: a percent reads as a percent', (await effect.locator('[data-block-sentence]').innerText()) === 'Take 10% off each item of sun', await effect.locator('[data-block-sentence]').innerText())
  await ep.locator('[data-panel-done]').click()
  await effect.locator('[data-move-up="block"]').click()
  check('29: an effect moves up', (await card2.locator('[data-effect]').first().locator('[data-block-sentence]').innerText()) === 'Take 10% off each item of sun')
  check('29: …the first cannot move up, the last cannot move down', (await card2.locator('[data-effect]').first().locator('[data-move-up="block"]').isDisabled()) && (await card2.locator('[data-effect]').last().locator('[data-move-down="block"]').isDisabled()))
  await card2.locator('[data-effect]').first().locator('[data-delete="block"]').click()
  check('29: delete removes it', (await card2.locator('[data-effect]').count()) === 1)
  await card2.locator('[data-effect]').first().locator('[data-block-edit]').click()
  check('29: a sentence opens its panel', (await card2.locator('[data-effect] [data-block-panel]').count()) === 1)
  await card2.locator('[data-effect] [data-panel-field="buy"]').fill('4')
  check('29: …which edits the saved block', (await card2.locator('[data-effect] [data-block-sentence]').innerText()) === 'For every 4 of sun, the cheapest 1 unit is free')
  await bar.locator('[data-cancel]').click()
  check('29: Cancel goes back to the saved rules', (await card2.locator('[data-effect]').count()) === 1 && (await card2.locator('[data-effect] [data-block-sentence]').innerText()) === 'For every 3 of sun, the cheapest 1 unit is free' && (await page.locator('[data-unsaved]').count()) === 0 && (await disabled('[data-undo]')))

  // ── 30 ──
  await page.locator('[data-add-rule]').click()
  const fresh = page.locator('[data-rule-card]').nth(1)
  check('30: Add rule adds an empty rule that reads "Always"', (await page.locator('[data-rule-card]').count()) === 2 && (await fresh.locator('[data-when]').innerText()) === 'Always')
  await fresh.locator('[data-rule-name]').fill('Gift for big baskets')
  await fresh.locator('[data-move-up="rule"]').click()
  check('30: a named rule moves up', (await page.locator('[data-rule-card]').first().locator('[data-rule-name]').inputValue()) === 'Gift for big baskets')
  const top = page.locator('[data-rule-card]').first()
  await top.locator('[data-palette-open="when"]').click()
  await top.locator('[data-palette="when"] [data-palette-block="group"]').click()
  const group = top.locator('[data-condition-group]')
  check('30: a group is added, empty, with its own palette', (await group.count()) === 1 && (await group.innerText()).includes('Nothing in this group yet.'))
  check('30: …and an empty group leaves the rule "Always", with no all / any to pick', (await top.locator('[data-when]').innerText()) === 'Always' && (await top.locator('[data-match="when"]').count()) === 0)
  await group.locator('[data-match]').selectOption('any')
  await group.locator('[data-palette-open]').click()
  await group.locator('[data-palette-block="member"]').click()
  check('30: a condition goes into the group, its panel open', (await group.locator('[data-condition]').count()) === 1 && (await group.locator('[data-block-panel]').count()) === 1 && (await group.locator('p').first().innerText()) === 'Any of these is true')
  await group.locator('[data-panel-done]').click()
  check('30: …and reads as a sentence', (await group.locator('[data-condition] [data-block-sentence]').innerText()).startsWith('The customer is'))
  await top.locator('[data-palette-open="when"]').click()
  await top.locator('[data-palette="when"] [data-palette-block="store"]').click()
  const stores = top.locator('[data-condition][data-sentence="sentence.condition.store"]')
  await stores.locator('[data-panel-field="in"]').fill('P001, P002')
  check('30: codes typed with commas read as a list', (await stores.locator('[data-block-sentence]').innerText()) === 'The store is P001 or P002', await stores.locator('[data-block-sentence]').innerText())
  await bar.locator('[data-undo]').click()
  check('30: Undo empties the codes input too', (await stores.locator('[data-panel-field="in"]').inputValue()) === '' && (await stores.locator('[data-block-sentence]').innerText()) === 'The store is nothing picked yet')
  await stores.locator('[data-panel-done]').click()
  await top.locator('[data-delete="rule"]').click()
  check('30: delete removes the rule', (await page.locator('[data-rule-card]').count()) === 1 && (await page.locator('[data-rule-card]').first().locator('[data-rule-name]').inputValue()) === 'Cheapest of every three suncare units free')

  // ── 31 ──
  await page.locator('[data-rule-card]').first().locator('[data-rule-name]').fill('Suncare 3 for 2')
  await page.locator('[data-workspace-menu="dashboard"]').click()
  const leave = page.locator('[data-leave-dialog]')
  await leave.waitFor({ timeout: 5000 })
  check('31: leaving with unsaved changes asks first', page.url().endsWith('/campaigns/SUN-3FOR2/rules'))
  await page.locator('[data-leave-stay]').click()
  await page.locator('[data-leave-dialog]').waitFor({ state: 'detached', timeout: 5000 })
  check('31: Stay keeps the page and the edit', (await page.locator('[data-leave-dialog]').count()) === 0 && page.url().endsWith('/rules') && (await page.locator('[data-rule-name]').first().inputValue()) === 'Suncare 3 for 2', `${await page.locator('[data-leave-dialog]').count()} ${page.url()} ${await page.locator('[data-rule-name]').first().inputValue()}`)
  await page.locator('[data-workspace-menu="dashboard"]').click()
  await page.locator('[data-leave-go]').click()
  await page.locator('[data-dashboard]').waitFor()
  check('31: Leave and discard goes', page.url().endsWith('/campaigns/SUN-3FOR2'))
  await page.locator('[data-workspace-menu="rules"]').click()
  await page.locator('[data-rules]').waitFor()
  check('31: …and the builder reads the saved rules again', (await page.locator('[data-rule-name]').first().inputValue()) === 'Cheapest of every three suncare units free' && (await page.locator('[data-unsaved]').count()) === 0)
  check('31: a clean builder leaves without asking', await (async () => {
    await page.locator('[data-workspace-menu="dashboard"]').click()
    await page.locator('[data-dashboard]').waitFor()
    return (await page.locator('[data-leave-dialog]').count()) === 0
  })())
  check('33: no page errors (24–31)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 32 ──
{
  const { context, page, errors, saves } = await open({ refuseSave: true })
  await page.goto(`${BASE}/campaigns/WLCB/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  const expr = page.locator('[data-condition][data-sentence="sentence.condition.formula"]')
  await expr.locator('[data-block-edit]').click()
  const fp = expr.locator('[data-block-panel]')
  check('32: a formula opens in its panel, in the ƒx box', (await fp.locator('[data-panel-field="expr"] [data-fx-input]').inputValue()) === 'back > 0')
  await fp.locator('[data-panel-says="notMet"] [data-panel-says-en]').fill('something to give back')
  await fp.locator('[data-panel-done]').click()
  const award = page.locator('[data-effect]').first()
  await award.locator('[data-block-edit]').click()
  const source = await award.locator('[data-panel-value-source] option:checked').first().innerText({ timeout: 5000 }).catch(() => '')
  check('32: a points value names its named value', source.replace(/[⁨⁩]/g, '') === 'back', (await award.locator('[data-block-panel]').innerHTML().catch(() => '')).slice(0, 1500))
  await page.locator('[data-builder-bar] [data-save]').click()
  const banner = page.locator('[role="alert"]').first()
  await banner.waitFor({ timeout: 10000 })
  check('32: a refused save shows the door’s own message', (await banner.innerText()).includes(SAVE_REFUSED) && saves.length === 1, await banner.innerText())
  check('32: …and the edits are kept, still unsaved', (await page.locator('[data-unsaved]').count()) === 1 && (await expr.locator('[data-says="notMet"] [data-says-en]').innerText()) === 'something to give back')
  await page.screenshot({ path: `${SHOTS}/builder-refused.png`, fullPage: true })
  check('33: no page errors (32)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 25 (features) ──
{
  const { context, page, errors } = await open({ edit: (store) => (store.find((c) => c.code === 'WKND20').features = ['coupons']) })
  await page.goto(`${BASE}/campaigns/WKND20/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  await page.locator('[data-palette-open="when"]').click()
  const cond = await page.locator('[data-palette="when"] [data-palette-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-block')))
  check('25: a coupons campaign offers the coupon condition; points off hides minPoints', cond.includes('coupon') && !cond.includes('minPoints'), cond.join(','))
  await page.locator('[data-palette-close]').click()
  await page.locator('[data-palette-open="then"]').click()
  const eff = await page.locator('[data-palette="then"] [data-palette-block]').evaluateAll((els) => els.map((e) => e.getAttribute('data-palette-block')))
  check('25: points off hides the earn and burn effects, and says where they are', !eff.includes('awardPoints') && !eff.includes('burnPoints') && (await page.locator('[data-palette="then"] [data-palette-hidden="points"]').count()) === 1, eff.join(','))
  check('33: no page errors (25 features)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 506 ── it asserts:
//  34. a sample filter that does not keep Prescription out is flagged red, and so is the discount on it;
//  35. an effect's items field offers All items / the rule's filters / Certain items…, which opens the
//      picker AT the field, a new filter with Prescription (A006) kept out;
//  36. a product is found on HQ by SKU and by name (the lookup door is called with the search) and picked;
//  37. a taken name is refused; Save filter adds the named filter to the rule and points the field at it
//      by id; the chain reads "not Prescription A006", nothing flagged; ONE Undo takes back both;
//  38. renaming the filter on the card keeps every block that uses it: the sentence follows, the id stays;
//      a filter in use cannot be deleted;
//  39. letting A006 in flags the filter and the discount red; "Keep Prescription out" clears it; a
//      discount on all merchandise is flagged too;
//  40. a category picked at a condition's field; Add filter (A006 kept out), a taken name shown on the
//      chain, and delete an unused one;
//      Copy filter from rule N copies it under a new id;
//  41. Save sends the filters and every reference by id;
//  42. a refused lookup is the door's own message, in the picker;
//  43. no page errors.
{
  const { context, page, errors, saves, lookups } = await open()
  const sun = CAMPAIGNS.find((c) => c.code === 'SUN-3FOR2')
  const sunFilter = sun.campaign.rules[0].filters[0].id
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  const card = page.locator('[data-rule-card]').first()
  const bar = page.locator('[data-builder-bar]')
  const sentenceOf = (loc) => loc.locator('[data-block-sentence]').innerText()

  // ── 34 ──
  const sunRow = card.locator(`[data-filter="${sunFilter}"]`)
  check('34: a filter that does not keep Prescription out is flagged red', (await sunRow.locator('[data-rx-flag]').innerText()) === 'Rx not excluded')
  const free = card.locator('[data-effect]').first()
  check('34: …and so is the discount on it', (await free.getAttribute('data-block-rx')) === '' && (await free.locator('[data-rx-flag]').innerText()) === 'Discounts Prescription items')

  // ── 35 ──
  await card.locator('[data-palette-open="then"]').click()
  await card.locator('[data-palette="then"] [data-palette-block="discountItems"]').click()
  const effect = card.locator('[data-effect]').nth(1)
  const ep = effect.locator('[data-block-panel]')
  await ep.locator('[data-panel-field="value"]').fill('10')
  const options = (await ep.locator('[data-panel-field="filter"] option').allInnerTexts()).map((x) => x.replace(/[⁨⁩]/g, ''))
  check('35: the items field offers All items, the rule’s filters and Certain items…', JSON.stringify(options) === '["all merchandise","sun","Certain items…"]', JSON.stringify(options))
  await ep.locator('[data-panel-field="filter"]').selectOption({ label: 'Certain items…' })
  const picker = ep.locator('[data-filter-editor="filter-new"]')
  await picker.waitFor({ timeout: 5000 })
  check('35: Certain items… opens the picker at the field, inside the panel', (await picker.count()) === 1 && (await page.locator('[data-filter-editor]').count()) === 1)
  check('35: …a new filter with Prescription (A006) kept out, named items1', JSON.stringify(await picker.locator('[data-picks="exclude"] [data-pick]').evaluateAll((els) => els.map((e) => e.getAttribute('data-pick')))) === '["A006"]' && (await picker.locator('[data-rx-missing]').count()) === 0 && (await picker.locator('[data-filter-name-input]').inputValue()) === 'items1')

  // ── 36 ──
  await picker.locator('[data-lookup="articles"]').fill('vitamin')
  await picker.locator('[data-lookup-hit="SER-VC"]').waitFor({ timeout: 5000 })
  check('36: a product is found by its name on HQ', lookups.includes('materials vitamin') && (await picker.locator('[data-lookup-hits="articles"] [data-lookup-hit]').count()) === 1)
  await picker.locator('[data-lookup="articles"]').fill('SER-')
  // The hit of "vitamin" is SER-VC too: wait for the SKU search itself to reach HQ and be drawn.
  for (let i = 0; i < 50 && !lookups.includes('materials SER-'); i++) await page.waitForTimeout(100)
  await page.locator('[data-lookup-hits="articles"] p').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  await page.waitForFunction(() => document.querySelector('[data-lookup-hits="articles"] [data-lookup-hit="SER-VC"]') && document.querySelectorAll('[data-lookup-hits="articles"] [data-lookup-hit]').length === 1, null, { timeout: 5000 })
  check('36: …and by its SKU, the hit reads code · name', lookups.includes('materials SER-') && (await picker.locator('[data-lookup-hit="SER-VC"]').innerText()) === 'SER-VC · Vitamin C serum 30ml', await picker.locator('[data-lookup-hit="SER-VC"]').innerText())
  await picker.locator('[data-lookup-hit="SER-VC"]').click()
  check('36: a hit is picked, and the search clears', JSON.stringify(await picker.locator('[data-picks="articles"] [data-pick]').evaluateAll((els) => els.map((e) => e.getAttribute('data-pick')))) === '["SER-VC"]' && (await picker.locator('[data-lookup="articles"]').inputValue()) === '')

  // ── 37 ──
  await picker.locator('[data-filter-name-input]').fill('Sun')
  check('37: a name the rule already has is refused', (await picker.locator('[data-filter-name-problem="taken"]').count()) === 1 && (await picker.locator('[data-filter-save]').isDisabled()))
  await picker.locator('[data-filter-name-input]').fill('serum')
  await picker.locator('[data-filter-save]').click()
  check('37: Save filter closes the picker', (await page.locator('[data-filter-editor]').count()) === 0)
  const filters = card.locator('[data-rule-section="filters"] [data-filter]')
  const serumId = await filters.nth(1).getAttribute('data-filter')
  const serumRow = card.locator(`[data-filter="${serumId}"]`)
  check('37: a named filter is added to the rule', (await filters.count()) === 2 && (await serumRow.locator('[data-filter-name]').innerText()) === 'serum')
  check('37: …its chain reads the product and "not Prescription A006", nothing flagged', JSON.stringify(await serumRow.locator('[data-filter-link]').allInnerTexts()) === '["product SER-VC","not Prescription A006"]' && (await serumRow.locator('[data-rx-flag]').count()) === 0, JSON.stringify(await serumRow.locator('[data-filter-link]').allInnerTexts()))
  check('37: the field points at it by id', (await ep.locator('[data-panel-field="filter"]').inputValue()) === serumId && serumId !== sunFilter)
  check('37: the discount reads the filter, and is not flagged', (await sentenceOf(effect)) === 'Take 10% off each item of serum' && (await effect.getAttribute('data-block-rx')) === null, await sentenceOf(effect))
  await bar.locator('[data-undo]').click()
  check('37: ONE Undo takes back the filter and the field together', (await filters.count()) === 1 && (await ep.locator('[data-panel-field="filter"]').inputValue()) === sunFilter, `${await filters.count()} ${await ep.locator('[data-panel-field="filter"]').inputValue()}`)
  await bar.locator('[data-redo]').click()
  check('37: …and Redo puts both back', (await filters.count()) === 2 && (await ep.locator('[data-panel-field="filter"]').inputValue()) === serumId)
  await ep.locator('[data-panel-done]').click()

  // ── 38 ──
  await serumRow.locator('[data-filter-edit]').click()
  const editor = serumRow.locator('[data-filter-editor]')
  check('38: the chain opens its editor on the card', (await editor.count()) === 1 && (await card.locator('[data-block-panel]').count()) === 0)
  await editor.locator('[data-filter-name-input]').fill('vitc')
  check('38: renaming keeps the reference: the sentence follows', (await sentenceOf(effect)) === 'Take 10% off each item of vitc' && (await serumRow.locator('[data-filter-name]').innerText()) === 'vitc', await sentenceOf(effect))
  check('38: …and the filter keeps its id', (await card.locator(`[data-filter="${serumId}"]`).count()) === 1)
  check('38: a filter in use cannot be deleted, and says why', (await editor.locator('[data-filter-delete]').isDisabled()) && (await editor.locator('[data-filter-uses]').innerText()) === 'Used by 1 condition or effect.')
  await bar.locator('[data-undo]').click()
  check('38: the rename is ONE Undo step', (await sentenceOf(effect)) === 'Take 10% off each item of serum')
  await bar.locator('[data-redo]').click()

  // ── 39 ──
  await editor.locator('[data-picks="exclude"] [data-pick-remove="A006"]').click()
  check('39: letting A006 in flags the filter red, in its editor and on its chain', (await editor.locator('[data-rx-missing]').count()) === 1 && (await serumRow.locator('[data-rx-flag]').count()) === 1)
  check('39: …and the discount on it', (await effect.getAttribute('data-block-rx')) === '' && (await effect.locator('[data-rx-flag]').count()) === 1)
  await page.screenshot({ path: `${SHOTS}/filter-rx.png`, fullPage: true })
  await editor.locator('[data-keep-rx-out]').click()
  check('39: Keep Prescription out clears both flags', (await serumRow.locator('[data-rx-flag]').count()) === 0 && (await effect.getAttribute('data-block-rx')) === null)
  await editor.locator('[data-filter-done]').click()
  check('39: Done closes the editor', (await card.locator('[data-filter-editor]').count()) === 0)
  await effect.locator('[data-block-edit]').click()
  await ep.locator('[data-panel-field="filter"]').selectOption('')
  check('39: a discount on all merchandise is flagged', (await effect.getAttribute('data-block-rx')) === '' && (await sentenceOf(effect)) === 'Take 10% off each item of all merchandise')
  await ep.locator('[data-panel-field="filter"]').selectOption(serumId)
  await ep.locator('[data-panel-done]').click()

  // ── 40 ──
  const minCount = card.locator('[data-condition]').first()
  await minCount.locator('[data-block-edit]').click()
  await minCount.locator('[data-panel-field="of"]').selectOption({ label: 'Certain items…' })
  const cp = minCount.locator('[data-filter-editor="of-new"]')
  check('40: a condition’s items field opens the picker too, named after the free number', (await cp.locator('[data-filter-name-input]').inputValue()) === 'items1')
  await cp.locator('[data-lookup="categories"]').fill('beauty')
  await cp.locator('[data-lookup-hit="A002"]').click()
  await cp.locator('[data-filter-name-input]').fill('beauty')
  await cp.locator('[data-filter-save]').click()
  const beautyRow = card.locator('[data-rule-section="filters"] [data-filter]').nth(2)
  const beautyId = await beautyRow.getAttribute('data-filter')
  check('40: a category picked at the field', lookups.includes('categories beauty') && JSON.stringify(await beautyRow.locator('[data-filter-link]').allInnerTexts()) === '["category A002","not Prescription A006"]' && (await sentenceOf(minCount)) === 'At least 3 units of beauty', await sentenceOf(minCount))
  await minCount.locator('[data-panel-done]').click()
  await card.locator('[data-filter-add]').click()
  const added = card.locator('[data-rule-section="filters"] [data-filter]').nth(3)
  check('40: Add filter opens a new one, Prescription kept out', (await added.locator('[data-filter-editor]').count()) === 1 && (await added.locator('[data-filter-name]').innerText()) === 'items1' && JSON.stringify(await added.locator('[data-filter-link]').allInnerTexts()) === '["any cart item","not Prescription A006"]')
  await added.locator('[data-filter-name-input]').fill('sun')
  check('40: a taken name keeps the editor from closing with Done', await added.locator('[data-filter-done]').isDisabled())
  await minCount.locator('[data-block-edit]').click()
  check('40: …and once another panel opens, the chain says the name is taken', (await added.locator('[data-filter-editor]').count()) === 0 && (await added.locator('[data-filter-chain-problem="taken"]').innerText()) === 'This rule already has a filter or a value with this name.')
  await minCount.locator('[data-panel-done]').click()
  await added.locator('[data-filter-edit]').click()
  check('40: …an unused filter can be deleted', !(await added.locator('[data-filter-delete]').isDisabled()))
  await added.locator('[data-filter-delete]').click()
  check('40: delete removes it', (await card.locator('[data-rule-section="filters"] [data-filter]').count()) === 3)
  await page.locator('[data-add-rule]').click()
  const second = page.locator('[data-rule-card]').nth(1)
  const copyOptions = (await second.locator('[data-filter-copy] option').allInnerTexts()).map((x) => x.replace(/[⁨⁩]/g, ''))
  check('40: Copy filter from rule N lists the other rules’ filters', JSON.stringify(copyOptions) === '["Copy filter from rule…","sun","vitc","beauty"]' && (await second.locator('[data-filter-copy] optgroup').getAttribute('label')).replace(/[⁨⁩]/g, '') === 'Rule 1', JSON.stringify(copyOptions))
  await second.locator('[data-filter-copy]').selectOption('0/1')
  const copied = second.locator('[data-filter]').first()
  check('40: …and copies it under a new id', (await copied.locator('[data-filter-name]').innerText()) === 'vitc' && (await copied.getAttribute('data-filter')) !== serumId && JSON.stringify(await copied.locator('[data-filter-link]').allInnerTexts()) === '["product SER-VC","not Prescription A006"]')
  await second.locator('[data-delete="rule"]').click()

  // ── 41 ──
  await bar.locator('[data-save]').click()
  await page.locator('[data-unsaved]').waitFor({ state: 'detached', timeout: 10000 })
  const sent = saves[0]?.campaign?.rules?.[0]
  const sentSerum = sent?.filters?.find((f) => f.id === serumId)
  check('41: Save sends the filter by id, its articles and its exclusion', saves.length === 1 && sentSerum?.name === 'vitc' && JSON.stringify(sentSerum.articles) === '["SER-VC"]' && JSON.stringify(sentSerum.exclude?.categories) === '["A006"]', JSON.stringify(sent?.filters))
  check('41: …and every reference by id, never by name (`filter` on effects, `of` on conditions)', sent?.then?.[1]?.filter === serumId && sent?.when?.[0]?.of === beautyId && sent?.then?.[0]?.filter === sunFilter)
  check('43: no page errors (34–41)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 42 ──
{
  const { context, page, errors } = await open({ refuseLookup: true })
  await page.goto(`${BASE}/campaigns/GIFT-POUCH/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  const cond = page.locator('[data-condition]').first()
  await cond.locator('[data-block-edit]').click()
  await cond.locator('[data-panel-field="of"]').selectOption({ label: 'Certain items…' })
  await cond.locator('[data-lookup="articles"]').fill('pouch')
  const alert = cond.locator('[data-lookup-hits="articles"] [role="alert"]')
  await alert.waitFor({ timeout: 5000 })
  check('42: a refused lookup is the door’s own message, in the picker', (await alert.innerText()) === LOOKUP_REFUSED)
  await cond.locator('[data-filter-cancel]').click()
  check('42: Cancel leaves the field as it was', (await cond.locator('[data-filter-editor]').count()) === 0 && (await cond.locator('[data-panel-field="of"] option:checked').innerText()).replace(/[⁨⁩]/g, '') === 'serum')
  check('43: no page errors (42)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 507 ── it asserts (re-cut in 522: a value is { name, expr }, the box is text read by the pure
// codec `core/rules/expr`, and there is NO formula-check door — the helper shows the codec's own
// syntax problem, and HQ's issues whose path is the value's path, from the draft's validation):
//  44. each value's box shows its expression as text, valid; HQ's issue on a value's path shows under it;
//  45. Add a value → value1, "write a number or a formula"; a typed formula is read (valid); ONE Undo step;
//  47. renamed, the value is picked at the award's points field: the sentence reads it, the value
//      says it is read and cannot be deleted; a taken name is refused;
//  48. the formula condition: a syntax slip is marked at the box (aria-invalid) with the codec's
//      words, and mended;
//  50. Save sends the value as { name, expr } (operator-first JSON) and the award's `amount` as `$name`;
//  52. no page errors.
{
  const ISSUE = 'unknown name: this rule has no named value before here'
  const { context, page, errors, saves } = await open({
    checksFor: (id, n) =>
      id === 'WLCB' && n === 0
        ? [{ severity: 'error', rule: 0, ruleId: 'r1', block: 'value', index: 1, field: 'expr', where: 'rule 1 → value 2 → expr', message: ISSUE, path: 'campaign.rules[0].values[1].expr' }]
        : [],
  })
  await page.goto(`${BASE}/campaigns/WLCB/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  const card = page.locator('[data-rule-card]').first()
  const bar = page.locator('[data-builder-bar]')
  const values = card.locator('[data-rule-section="values"]')
  const boxes = values.locator('[data-fx-input]')
  const names = values.locator('[data-value-name]')

  // ── 44 ──
  check('44: each value’s box shows its expression as text', JSON.stringify(await boxes.evaluateAll((els) => els.map((e) => e.value))) === JSON.stringify(["sum(items('Eligible'), item.net)", 'round(eligible * 0.1, 0, halfUp)']))
  check('44: HQ’s issue on a value’s path shows under that value', (await values.locator('[data-fx-issue]').count()) >= 1 && (await values.innerText()).includes(ISSUE))

  // ── 45 ──
  await card.locator('[data-value-add]').click()
  check('45: Add a value adds value1, its formula still to write', (await names.nth(2).inputValue()) === 'value1' && (await boxes.nth(2).inputValue()) === '')
  await boxes.nth(2).fill('round(eligible * 10 / 100, 0, halfUp)')
  check('45: a typed formula is read and valid', (await boxes.nth(2).getAttribute('aria-invalid')) !== 'true')
  await bar.locator('[data-undo]').click()
  check('45: the typing is ONE Undo step', (await boxes.nth(2).inputValue()) === '')
  await bar.locator('[data-redo]').click()

  // ── 47 ──
  await names.nth(2).fill('cashback')
  const award = card.locator('[data-effect]').first()
  await award.locator('[data-block-edit]').click()
  await award.locator('[data-panel-value-source="amount"]').selectOption('$cashback')
  check('47: the award reads the new value by name in its sentence', (await award.locator('[data-block-sentence]').innerText()).startsWith('Award cashback in SAR of points'), await award.locator('[data-block-sentence]').innerText())
  await award.locator('[data-panel-done]').click()
  check('47: the value says it is read, and cannot be deleted', (await values.locator('[data-value-delete]').nth(2).isDisabled()))
  await names.nth(2).fill('eligible')
  check('47: a name another value has is refused, at the renamed value', (await values.locator('[data-value-index="2"] [data-value-name-problem="taken"]').count()) === 1)
  await names.nth(2).fill('cashback')

  // ── 48 ──
  const expr = card.locator('[data-condition][data-sentence="sentence.condition.formula"]')
  await expr.locator('[data-block-edit]').click()
  const ebox = expr.locator('[data-fx-input]')
  check('48: the formula condition opens as text', (await ebox.inputValue()) === 'back > 0')
  await ebox.fill('back > ')
  check('48: a syntax slip marks the box invalid, with the codec’s words', (await ebox.getAttribute('aria-invalid')) === 'true' && (await expr.locator('[data-fx-error]').count()) === 1)
  await ebox.fill('back > 0')
  check('48: …and mended, it is valid again', (await ebox.getAttribute('aria-invalid')) !== 'true')
  await expr.locator('[data-panel-done]').click()

  // ── 50 ──
  await bar.locator('[data-save]').click()
  await page.locator('[data-unsaved]').waitFor({ state: 'detached', timeout: 10000 })
  const sent = saves[0]?.campaign?.rules?.[0]
  check(
    '50: Save sends the value as { name, expr }, the expression as operator-first JSON',
    saves.length === 1 && JSON.stringify(sent?.values?.[2]) === JSON.stringify({ name: 'cashback', expr: ['round', ['/', ['*', '$eligible', 10], 100], 0, 'halfUp'] }),
    JSON.stringify(sent?.values),
  )
  check('50: …the untouched values exactly as loaded', JSON.stringify(sent?.values?.slice(0, 2)) === JSON.stringify(CAMPAIGNS.find((c) => c.code === 'WLCB').campaign.rules[0].values))
  check('50: …the formula condition as JSON, and the award reads `$cashback`', JSON.stringify(sent?.when?.[3]?.expr) === '[">","$back",0]' && sent?.then?.[0]?.amount === '$cashback', JSON.stringify(sent?.then?.[0]))
  check('52: no page errors (44–50)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 508 ── it asserts:
//  (522: the checks are the draft's own `validation`, its issues pointed by `path`; there is no
//  separate checks door to refuse, so 508's old 60 went — a failed Load is the workspace's refusal.)
//  53. a draft with no messages: the pill reads "All checks pass", and nothing blocks approval;
//      Escape closes the list;
//  54. HQ's error and warnings: the pill counts them ("1 error", "3 warnings"); a closed block shows
//      its own message, isolated, and is marked;
//  55. the pill lists errors first, each with where it points (Rule 1 › Condition 2 › At least) and
//      HQ's text; a campaign message and one on a block deleted since the save (named by its rule)
//      cannot be jumped to;
//      the errors block "Ask for approval";
//  56. a click on the error expands the collapsed rule, opens the condition's panel and focuses its
//      amount — where the message also shows;
//  57. a click on the warning opens the effect and focuses the receipt label's English input, the
//      message under the EN + AR pair;
//  58. warnings alone never block approval;
//  59. while there are unsaved changes the list says the checks are the last save's; Save asks HQ
//      again, and the pill follows its answer;
//  61. no page errors.
{
  const pts = CAMPAIGNS.find((c) => c.code === 'PTS-50OFF')
  const rule = pts.campaign.rules[0]
  const amount = rule.when[2]
  const discount = rule.then[1]
  const AMOUNT = 'The basket minimum must be above the points burned (SAR 30).'
  const LABEL = 'The Arabic receipt label is longer than a till line.'
  const BUDGET = 'No budget limits the points burned.'
  const GONE = 'This condition repeats another.'
  // 522: HQ's issues (`RuleIssue`) point by `path`; they come with the draft's validation.
  const issue = (severity, message, path, o = {}) => ({ severity, rule: null, ruleId: null, block: 'campaign', index: null, field: null, where: path, message, path, ...o })
  const messages = [
    issue('warning', BUDGET, 'campaign'),
    issue('warning', LABEL, 'campaign.rules[0].then[1].label', { rule: 0, ruleId: rule.id, block: 'effect', index: 1, field: 'label' }),
    issue('error', AMOUNT, 'campaign.rules[0].when[2].amount', { rule: 0, ruleId: rule.id, block: 'condition', index: 2, field: 'amount' }),
    issue('warning', GONE, 'campaign.rules[0].when[9]', { rule: 0, ruleId: rule.id, block: 'condition', index: 9 }),
  ]
  const { context, page, errors, validations } = await open({
    checksFor: (id, n) =>
      id === 'PTS-50OFF' ? (n === 0 ? messages : []) : id === 'WLCB' ? [issue('warning', LABEL, 'campaign')] : [],
  })
  const pill = page.locator('[data-checks-pill]')
  const list = page.locator('[data-checks-list]')
  const bar = page.locator('[data-builder-bar]')
  const active = () => page.evaluate(() => document.activeElement?.id ?? '')

  // ── 53 ──
  await page.goto(`${BASE}/campaigns/WKND20/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  await page.locator('[data-checks-pill="pass"]').waitFor({ timeout: 5000 })
  check('53: no messages: the pill reads "All checks pass"', (await pill.innerText()).trim() === 'All checks pass')
  await pill.click()
  check('53: …and nothing blocks approval', (await list.locator('[data-checks-verdict="clear"]').innerText()) === 'Nothing blocks “Ask for approval”.')
  check('53: the draft was checked once, by its id', JSON.stringify(validations) === '["WKND20"]', JSON.stringify(validations))
  await page.keyboard.press('Escape')
  check('53: Escape closes the list', (await list.count()) === 0 && (await pill.getAttribute('aria-expanded')) === 'false')

  // ── 54 ──
  await page.goto(`${BASE}/campaigns/PTS-50OFF/rules`)
  await page.locator('[data-checks-pill="errors"]').waitFor({ timeout: 10000 })
  check(
    '54: the pill counts HQ’s error and warnings',
    (await pill.locator('[data-checks-errors]').innerText()).trim() === '1 error' && (await pill.locator('[data-checks-warnings]').innerText()).trim() === '3 warnings',
    await pill.innerText(),
  )
  const cond = page.locator('[data-rule-card] [data-block-path="when.2"]')
  check(
    '54: a closed block is marked and shows its own message, isolated',
    (await cond.getAttribute('data-block-checks')) === 'error' && (await cond.locator('[data-check-note="error"] bdi[data-check-message]').innerText()) === AMOUNT,
  )
  check('54: a block with only a warning is marked as such', (await page.locator('[data-rule-card] [data-block-path="then.1"]').getAttribute('data-block-checks')) === 'warning')

  // ── 55 ──
  await page.locator('[data-rule-toggle]').click()
  await page.locator('[data-rule-body]').waitFor({ state: 'detached' })
  await pill.click()
  const items = list.locator('[data-check-item]')
  check(
    '55: errors first, then the warnings in HQ’s order',
    JSON.stringify(await items.locator('bdi[data-check-message]').allInnerTexts()) === JSON.stringify([AMOUNT, BUDGET, LABEL, GONE]),
  )
  const first = items.nth(0)
  const where = (await first.locator('[data-check-where]').innerText()).replace(/\s+/g, ' ').trim()
  check('55: the error says where it points: rule › condition › field', where.startsWith(`Rule 1 ${rule.name} Condition 3`), where)
  check('55: …and HQ’s text, isolated', (await first.locator('bdi[data-check-message]').innerText()) === AMOUNT)
  check(
    '55: a campaign message and one on a deleted block cannot be jumped to',
    (await items.nth(1).locator('[data-check-go]').count()) === 0 &&
      (await items.nth(3).locator('[data-check-go]').count()) === 0 &&
      (await items.nth(1).locator('[data-check-where]').innerText()) === 'The campaign' &&
      (await items.nth(3).locator('[data-check-where]').innerText()).replace(/\s+/g, ' ').trim() === `Rule 1 ${rule.name} No longer in the rules`,
  )
  check('55: the errors block “Ask for approval”', (await list.locator('[data-checks-verdict]').getAttribute('data-checks-verdict')) === 'blocked')
  await page.screenshot({ path: `${SHOTS}/checks-list.png` })

  // ── 56 ──
  await first.locator('[data-check-go]').click()
  const focusedRow = () => page.evaluate(() => document.activeElement?.closest('[data-panel-row]')?.getAttribute('data-panel-row') ?? '')
  await page.waitForFunction(() => document.activeElement?.closest('[data-panel-row="amount"]'), null, { timeout: 5000 }).catch(() => {})
  check('56: the click expands the rule', (await page.locator('[data-rule-body]').count()) === 1)
  check('56: …opens the condition’s panel', (await cond.locator('[data-block-panel]').count()) === 1 && (await cond.getAttribute('data-open')) === '')
  check('56: …and focuses the field', (await focusedRow()) === 'amount', await active())
  check('56: the message shows at the field', (await cond.locator('[data-block-panel] [data-panel-row="amount"] bdi[data-check-message]').innerText()) === AMOUNT)
  check('56: the list closed', (await list.count()) === 0)
  await page.screenshot({ path: `${SHOTS}/checks-field.png` })

  // ── 57 ──
  await pill.click()
  await list.locator('[data-check-item]').filter({ hasText: LABEL }).locator('[data-check-go]').click()
  await page.waitForFunction(() => document.activeElement?.hasAttribute('data-panel-says-en'), null, { timeout: 5000 }).catch(() => {})
  const effectPanel = page.locator('[data-rule-card] [data-block-path="then.1"] [data-block-panel]')
  check('57: the warning opens the effect and focuses the receipt label’s English input', await page.evaluate(() => !!document.activeElement?.closest('[data-panel-says="receiptLabel"]') && document.activeElement.hasAttribute('data-panel-says-en')), await active())
  check('57: …one panel open at a time', (await page.locator('[data-block-panel]').count()) === 1)
  check(
    '57: the warning shows under the EN + AR pair',
    (await effectPanel.locator('[data-panel-says="receiptLabel"] [data-check-note="warning"] bdi').innerText()) === LABEL,
  )

  // ── 59 ──
  await page.locator('[data-rule-name]').fill('Burn 30, take 50 off')
  await pill.click()
  check('59: with unsaved changes the list says the checks are the last save’s', await list.locator('[data-checks-stale]').isVisible())
  await pill.click()
  await bar.locator('[data-save]').click()
  await page.locator('[data-checks-pill="pass"]').waitFor({ timeout: 10000 }).catch(() => {})
  check(
    '59: Save asks HQ again, and the pill follows its answer',
    validations.filter((v) => v === 'PTS-50OFF').length === 2 && (await pill.getAttribute('data-checks-pill')) === 'pass',
    JSON.stringify(validations),
  )
  check('59: …and the field’s message is gone with it', (await page.locator('[data-check-note]').count()) === 0)

  // ── 58 ──
  await page.goto(`${BASE}/campaigns/WLCB/rules`)
  await page.locator('[data-checks-pill="warnings"]').waitFor({ timeout: 10000 })
  await pill.click()
  check(
    '58: warnings alone never block approval',
    (await list.locator('[data-checks-verdict]').getAttribute('data-checks-verdict')) === 'clear' &&
      (await list.locator('[data-checks-verdict]').innerText()) === 'Warnings do not block “Ask for approval”.',
  )
  check('61: no page errors (53–59)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 511 ── it asserts:
//  62. an author's draft shows the pre-activation steps, each ticked or linked — the rules step to
//      the rule builder, named, schedule and budgets to their Settings pages (509, 510);
//  63. the author is offered Ask for approval and Delete draft, never Activate; HQ's error in the
//      saved draft disables Ask, saying why, with the way to the builder;
//  64. with clean checks the author asks with a note: HQ gets it, the State turns Waiting for
//      approval naming who asked and the note, the shell's badge follows, the author is offered
//      nothing and told an approver activates; the list's tiles count it under Waiting;
//  65. an approver reads the pending changes and is offered Activate and Send back, not Ask or Delete;
//  66. Send back wants a note; it returns the draft to its author, who reads who sent it back and why;
//  67. asked again, a refused Activate keeps the dialog open with the envelope's message and code;
//  68. Activate again: the campaign is live (Running, version 1, by the approver), the steps are gone;
//      the approver may now Disable it, it reads Disabled, and the list's tiles follow;
//  69. a draft with no rule cannot be asked yet, saying so; an author's Delete draft asks first;
//      confirmed, the draft is gone and the list counts it out;
//  70. a refused roles door is its own message and code, and offers no act;
//  71. no page errors.
{
  const NO_RULES = { severity: 'error', rule: null, ruleId: null, block: 'campaign', index: null, field: null, where: 'campaign', message: 'A campaign needs a rule.', path: 'campaign' }
  const { context, page, errors, acts, as } = await open({
    refuseActivate: 1,
    // The bare draft gets one rule, so HQ's checks are what gate it (no rule gates it first — 69).
    edit: (store) => (store.find((c) => c.code === 'SPRING-DRAFT').campaign.rules = structuredClone(store.find((c) => c.code === 'WKND20').campaign.rules.slice(0, 1))),
    checksFor: (id, n) => (id === 'SPRING-DRAFT' && n === 0 ? [NO_RULES] : []),
  })
  const stateCell = page.locator('[data-dashboard-cell="state"]')
  const stateBadge = () => stateCell.locator('[data-campaign-state]').innerText()
  const action = (a) => page.locator(`[data-approval-action="${a}"]`)
  const offered = () => page.locator('[data-approval-action]').evaluateAll((els) => els.map((e) => e.getAttribute('data-approval-action')))
  const dialog = page.locator('[data-approval-dialog]')
  const dash = async (id) => {
    await page.goto(`${BASE}/campaigns/${id}`)
    await page.locator('[data-approval]:not([data-approval="loading"])').waitFor({ timeout: 10000 })
  }

  // ── 62 ──
  await dash('SPRING-DRAFT')
  const steps = page.locator('[data-steps] [data-step]')
  check('62: the four steps, in order', JSON.stringify(await steps.evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))) === '["named","rules","schedule","budgets"]')
  await page.locator('[data-approval-gate="errors"]').waitFor({ timeout: 5000 }).catch(() => {})
  check('62: none is ticked on this draft (no Arabic name, an error in its rule, no schedule, no budget)', (await page.locator('[data-steps] [data-step-done]').count()) === 0)
  check('62: the rules step links to the rule builder', (await page.locator('[data-step="rules"] [data-step-link]').getAttribute('href')) === '/campaigns/SPRING-DRAFT/rules')
  check(
    '62: the named, schedule and budgets steps link to their Settings pages (509, 510)',
    (await page.locator('[data-step="named"] [data-step-link]').getAttribute('href')) === '/campaigns/SPRING-DRAFT/settings/details' &&
      (await page.locator('[data-step="schedule"] [data-step-link]').getAttribute('href')) === '/campaigns/SPRING-DRAFT/settings/schedule' &&
      (await page.locator('[data-step="budgets"] [data-step-link]').getAttribute('href')) === '/campaigns/SPRING-DRAFT/settings/budgets',
  )

  // ── 63 ──
  check('63: an author is offered Ask for approval and Delete draft, never Activate', JSON.stringify(await offered()) === '["askForApproval","deleteDraft"]', JSON.stringify(await offered()))
  check('63: HQ’s error disables Ask for approval', await action('askForApproval').isDisabled())
  check(
    '63: …saying why, with the way to the builder',
    (await page.locator('[data-approval-gate="errors"]').innerText()).startsWith('The saved draft has errors') &&
      (await page.locator('[data-approval-gate-link]').getAttribute('href')) === '/campaigns/SPRING-DRAFT/rules',
  )
  await page.screenshot({ path: `${SHOTS}/approval-author-blocked.png` })

  // ── 64 ──
  await dash('SPRING-DRAFT') // a fresh load re-reads the checks: clean now
  await page.locator('[data-approval-gate]').waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check('64: clean checks enable Ask for approval', await action('askForApproval').isEnabled())
  check('64: …and tick the rules step, the others still to do', JSON.stringify(await page.locator('[data-step][data-step-done]').evaluateAll((els) => els.map((e) => e.getAttribute('data-step')))) === '["rules"]')
  await page.locator('[data-ask-note]').fill('Spring range ready for review.')
  await action('askForApproval').click()
  await page.locator('[data-state-sentence="waitingForApproval"]').waitFor({ timeout: 5000 })
  check(
    '64: HQ got the ask with its note',
    JSON.stringify(acts.at(-1)) === JSON.stringify({ act: 'AskForApproval SPRING-DRAFT', body: { note: 'Spring range ready for review.' } }),
    JSON.stringify(acts.at(-1)),
  )
  check(
    '64: the State reads Waiting for approval, naming who asked',
    (await stateBadge()) === 'Waiting for approval' &&
      (await page.locator('[data-state-sentence="waitingForApproval"]').innerText()) === 'Omar (marketing) asked for approval on 2026-10-16 18:30.',
  )
  check('64: …and the note', (await page.locator('[data-approval-note]').innerText()) === 'Spring range ready for review.')
  check('64: the shell’s badge follows', (await page.locator('[data-workspace-name] [data-campaign-state]').getAttribute('data-campaign-state')) === 'waitingForApproval')
  check('64: the author is offered nothing now, and told an approver activates', (await offered()).length === 0 && (await page.locator('[data-approval-hint="authorWaiting"]').isVisible()))
  await page.screenshot({ path: `${SHOTS}/approval-author-waiting.png` })
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  check('64: the list counts it under Waiting', (await tileCount(page, 'draft')) === '0' && (await tileCount(page, 'waitingForApproval')) === '2', JSON.stringify(await readCounts(page)))

  // ── 65 ──
  as('approver')
  await dash('SPRING-DRAFT')
  check('65: an approver is offered Activate and Send back, not Ask or Delete', JSON.stringify(await offered()) === '["activate","sendBack"]', JSON.stringify(await offered()))
  check(
    '65: …reads the pending changes, a first version, and the way to its rules',
    (await page.locator('[data-pending-changes]').innerText()).includes('The first version') &&
      (await page.locator('[data-pending-open]').getAttribute('href')) === '/campaigns/SPRING-DRAFT/rules',
  )
  await page.screenshot({ path: `${SHOTS}/approval-approver.png` })

  // ── 66 ──
  await action('sendBack').click()
  await dialog.waitFor({ timeout: 5000 })
  check('66: Send back wants a note', await page.locator('[data-approval-confirm]').isDisabled())
  await page.locator('[data-approval-dialog-note]').fill('Add the Arabic name first.')
  await page.locator('[data-approval-confirm]').click()
  await page.locator('[data-state-sentence="draft"]').waitFor({ timeout: 5000 })
  check(
    '66: HQ got the note, and the campaign is a draft again',
    acts.at(-1).act === 'SendBack SPRING-DRAFT' && acts.at(-1).body.note === 'Add the Arabic name first.' && (await stateBadge()) === 'Draft',
  )
  as('author')
  await dash('SPRING-DRAFT')
  check(
    '66: the author reads who sent it back, and why',
    (await page.locator('[data-state-sentence="draft"]').innerText()).startsWith('Reem (approver) sent it back on 2026-10-16 18:30.') &&
      (await page.locator('[data-sent-back-note]').innerText()) === 'Add the Arabic name first.',
  )

  // ── 67 ──
  await action('askForApproval').click()
  await page.locator('[data-state-sentence="waitingForApproval"]').waitFor({ timeout: 5000 })
  as('approver')
  await dash('SPRING-DRAFT')
  await page.locator('[data-approval-action="activate"]:not([disabled])').waitFor({ timeout: 5000 })
  await action('activate').click()
  await dialog.waitFor({ timeout: 5000 })
  await page.locator('[data-approval-dialog-note]').fill('First spring version.')
  await page.locator('[data-approval-confirm]').click()
  await page.locator('[data-approval-refusal="activate"]').waitFor({ timeout: 5000 })
  check('67: a refused Activate shows the envelope’s message', (await page.locator('[data-approval-refusal="activate"] bdi').first().innerText()) === ACTIVATE_REFUSED)
  check(
    '67: …and its code',
    (await page.locator('[data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_CAMPAIGN_SELF_APPROVAL' &&
      (await page.locator('[data-refusal-code]').innerText()) === 'Code RULE_CAMPAIGN_SELF_APPROVAL',
  )
  check('67: …and the dialog stays open, the campaign still waiting', (await dialog.count()) === 1 && (await stateBadge()) === 'Waiting for approval')
  await page.screenshot({ path: `${SHOTS}/approval-refused.png` })

  // ── 68 ──
  await page.locator('[data-approval-confirm]').click()
  await dialog.waitFor({ state: 'detached', timeout: 5000 })
  check(
    '68: Activate again: the campaign is live, version 1 by the approver',
    (await stateBadge()) === 'Running' && (await page.locator('[data-live-version]').innerText()) === 'Tills run version 1.',
  )
  check('68: HQ got the version note', acts.at(-1).act === 'Activate SPRING-DRAFT' && acts.at(-1).body.note === 'First spring version.')
  check('68: the steps are gone once published', (await page.locator('[data-steps]').count()) === 0)
  check('68: the approver may now Disable it', JSON.stringify(await offered()) === '["disable"]', JSON.stringify(await offered()))
  await action('disable').click()
  await dialog.waitFor({ timeout: 5000 })
  await page.locator('[data-approval-confirm]').click()
  await dialog.waitFor({ state: 'detached', timeout: 5000 })
  check('68: …and it reads Disabled', (await stateBadge()) === 'Disabled' && acts.at(-1).act === 'Disable SPRING-DRAFT')
  await page.goto(`${BASE}/campaigns`)
  await waitRows(page, 16)
  check('68: the list’s tiles follow', (await tileCount(page, 'waitingForApproval')) === '1' && (await tileCount(page, 'disabled')) === '2', JSON.stringify(await readCounts(page)))
  check('71: no page errors (62–68)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 69 ──
{
  const { context, page, errors, acts } = await open()
  await page.goto(`${BASE}/campaigns/SPRING-DRAFT`)
  await page.locator('[data-approval-gate="noRules"]').waitFor({ timeout: 10000 })
  check('69: a draft with no rule cannot be asked yet, saying so', (await page.locator('[data-approval-action="askForApproval"]').isDisabled()) && (await page.locator('[data-approval-gate="noRules"]').innerText()).startsWith('The saved draft has no rule yet'))
  await page.locator('[data-approval-action="deleteDraft"]').click()
  const dialog = page.locator('[data-approval-dialog="deleteDraft"]')
  await dialog.waitFor({ timeout: 5000 })
  check('69: Delete draft asks first, naming the code', (await dialog.innerText()).includes('Delete Spring skincare (draft), code SPRING-DRAFT?') && !acts.length)
  await page.locator('[data-approval-confirm]').click()
  await page.waitForURL(`${BASE}/campaigns`, { timeout: 5000 }).catch(() => {})
  await waitRows(page, 15)
  check(
    '69: confirmed, HQ deletes it and the list opens without it',
    acts.at(-1)?.act === 'Delete SPRING-DRAFT' && !(await rowIds(page)).includes('SPRING-DRAFT') && (await tileCount(page, 'draft')) === '0',
  )
  check('71: no page errors (69)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 70 ──
{
  const { context, page, errors } = await open({ refuseRoles: true })
  await page.goto(`${BASE}/campaigns/BDAY-BEAUTY`)
  await page.locator('[data-approval-refusal="roles"]').waitFor({ timeout: 10000 })
  check(
    '70: a refused roles door is its own message and code',
    (await page.locator('[data-approval-refusal="roles"]').innerText()).includes(ROLES_REFUSED) &&
      (await page.locator('[data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_ROLES_UNAVAILABLE',
  )
  check('70: …and offers no act, only Try again', (await page.locator('[data-approval-action]').count()) === 0 && (await page.locator('[data-approval-roles-retry]').isVisible()))
  check('71: no page errors (70)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 509 ── it asserts (re-cut in 522: every Settings page edits the loaded draft and saves it
// WHOLE through Drafts/Save at its revision; there is no description, budget names are EN + AR,
// hours may cross midnight, and Offline reads the draft's own `validation.offline`):
//  72. Settings ▸ in the side menu opens Details, its pages listed beneath it — Details, Schedule,
//      Audience, Features, Budgets (510), Offline; the crumb still names the campaign; an unknown
//      page's address opens Details;
//  73. Details: both names required (said at the field, nothing sent); the Arabic name is typed
//      right to left; Save sends the WHOLE campaign at the loaded revision with both names trimmed;
//      a reload reads them back, the shell shows the Arabic name, the dashboard's "named" step is ticked;
//  74. Schedule, at 02:30 local (the UTC day is yesterday): an end not after the start holds Save
//      back, saying why; hours across midnight are allowed; Save sends the window's local days,
//      weekday words and hours as typed — no shift, no `Z`; a reload reads them back; the dashboard
//      reads the new window; clearing the start leaves `from` out;
//  75. Audience: countries and channels, a store found on HQ's lookup, members only; Save sends
//      them in the campaign; a reload reads them back;
//  76. Features: switching points off while a rule burns them is refused at the page, naming the
//      rule, and nothing is sent; switching coupons on is saved (the draft's `features`) and reads back;
//  77. Offline: a campaign HQ finds unsafe reads Online only with HQ's reasons (validation.offline);
//      a safe one reads Offline-safe and opts out with "Online only" (`onlineOnly: true`), saved and
//      read back;
//  78. a refused save keeps the page's changes and shows the envelope's message and code;
//  78b. a STALE save (409 RULES_DRAFT_STALE) says so and offers to reload; Reload reads the draft again;
//  79. leaving a page with unsaved changes asks first; Stay keeps them, and so does a re-read of the
//      campaign in the background; Cancel goes back to what HQ saved last;
//  80. no page errors.
{
  const { context, page, errors, saves, store, calls } = await open()
  const settingsPage = async (id, part) => {
    await page.goto(`${BASE}/campaigns/${id}/settings/${part}`)
    await page.locator(`[data-settings="${part}"]`).waitFor({ timeout: 10000 })
  }
  const field = (k) => page.locator(`[data-settings-field="${k}"]`)
  const save = page.locator('[data-settings-save]')
  const saved = async (n) => {
    await page.waitForFunction(() => !document.querySelector('[data-settings-dirty]'), null, { timeout: 5000 }).catch(() => {})
    return saves.length === n
  }
  /** The draft as loaded, for comparing a save's untouched parts. */
  const loaded = (code) => CAMPAIGNS.find((c) => c.code === code)

  // ── 72 ──
  await page.goto(`${BASE}/campaigns/SPRING-DRAFT`)
  await page.locator('[data-dashboard]').waitFor({ timeout: 10000 })
  check('72: the Settings sub-menu is closed on the dashboard', (await page.locator('[data-workspace-menu="settings"]').getAttribute('aria-expanded')) === 'false')
  await page.locator('[data-workspace-menu="settings"]').click()
  await page.locator('[data-settings="details"]').waitFor({ timeout: 5000 })
  check('72: Settings opens Details', page.url() === `${BASE}/campaigns/SPRING-DRAFT/settings/details`)
  check(
    '72: its pages are listed beneath it, Budgets since 510',
    JSON.stringify(await page.locator('[data-workspace-settings]').evaluateAll((els) => els.map((e) => e.getAttribute('data-workspace-settings')))) ===
      '["details","schedule","audience","features","budgets","offline"]',
  )
  check('72: Details is the current page', (await page.locator('[data-workspace-settings="details"]').getAttribute('aria-current')) === 'page')
  check('72: the crumb still names the campaign', (await page.locator('[data-crumb-record]').innerText()) === 'SPRING-DRAFT')
  await page.goto(`${BASE}/campaigns/SPRING-DRAFT/settings/nonsense`)
  await page.locator('[data-settings="details"]').waitFor({ timeout: 10000 })
  check('72: an unknown page opens Details', page.url() === `${BASE}/campaigns/SPRING-DRAFT/settings/details`)

  // ── 73 ──
  check(
    '73: the id is shown, the names as HQ saved them',
    (await page.locator('[data-settings-code]').innerText()) === 'SPRING-DRAFT' && (await field('nameEn').inputValue()) === 'Spring skincare (draft)' && (await field('nameAr').inputValue()) === '',
  )
  check('73: Save waits for a change', await save.isDisabled())
  await field('nameEn').fill('   ')
  await save.click()
  check(
    '73: both names are required, said at the field, nothing sent',
    (await page.locator('[data-settings-problem="nameEnRequired"]').isVisible()) && (await page.locator('[data-settings-problem="nameArRequired"]').isVisible()) && saves.length === 0,
  )
  check('73: the Arabic name is typed right to left', (await field('nameAr').getAttribute('dir')) === 'rtl')
  await field('nameEn').fill(' Spring skincare ')
  await field('nameAr').fill(' العناية بالبشرة في الربيع ')
  await save.click()
  check(
    '73: Save sends the WHOLE campaign at the loaded revision, both names trimmed',
    (await saved(1)) &&
      saves[0].revision === loaded('SPRING-DRAFT').revision &&
      JSON.stringify(saves[0].campaign) === JSON.stringify({ ...loaded('SPRING-DRAFT').campaign, name: { en: 'Spring skincare', ar: 'العناية بالبشرة في الربيع' } }) &&
      JSON.stringify(saves[0].features) === JSON.stringify(loaded('SPRING-DRAFT').features),
    JSON.stringify(saves[0]),
  )
  check('73: a toast says so', await page.getByText('The details are saved.').first().isVisible())
  await page.screenshot({ path: `${SHOTS}/settings-details.png` })
  await settingsPage('SPRING-DRAFT', 'details')
  check('73: a reload reads them back', (await field('nameEn').inputValue()) === 'Spring skincare' && (await field('nameAr').inputValue()) === 'العناية بالبشرة في الربيع')
  check('73: the shell shows both names', (await page.locator('[data-workspace-name]').innerText()).includes('العناية بالبشرة في الربيع'))
  await page.locator('[data-workspace-menu="dashboard"]').click()
  await page.locator('[data-steps]').waitFor({ timeout: 5000 })
  check('73: the dashboard’s "named" step is ticked', (await page.locator('[data-step="named"][data-step-done]').count()) === 1)

  // ── 75 ──
  await settingsPage('SPRING-DRAFT', 'audience')
  await page.locator('[data-settings-toggles="countries"]').waitFor({ timeout: 5000 })
  await page.locator('[data-settings-toggle="SA"]').click()
  await page.locator('[data-settings-toggles="channels"] [data-settings-toggle="POS"]').click()
  await page.locator('[data-lookup="stores"]').fill('riy')
  await page.locator('[data-lookup-hit="R101"]').click()
  await field('members').selectOption('identified')
  await save.click()
  const aud = saves[1]?.campaign?.audience
  check(
    '75: Save sends countries, channels, stores and members in the campaign, at the new revision',
    (await saved(2)) && saves[1].revision === saves[0].revision + 1 && JSON.stringify(aud?.countries) === '["SA"]' && JSON.stringify(aud?.channels) === '["POS"]' && JSON.stringify(aud?.stores) === '["R101"]' && aud?.members === 'identified',
    JSON.stringify(saves[1]),
  )
  await page.screenshot({ path: `${SHOTS}/settings-audience.png` })
  await settingsPage('SPRING-DRAFT', 'audience')
  await page.locator('[data-settings-toggles="countries"]').waitFor({ timeout: 5000 })
  check(
    '75: a reload reads them back',
    (await page.locator('[data-settings-toggle="SA"]').getAttribute('aria-pressed')) === 'true' &&
      (await page.locator('[data-settings-toggle="POS"]').getAttribute('aria-pressed')) === 'true' &&
      (await page.locator('[data-picks="stores"] [data-pick="R101"]').count()) === 1 &&
      (await field('members').inputValue()) === 'identified',
  )

  // ── 76 ──
  await settingsPage('PTS-50OFF', 'features')
  await page.locator('[data-settings-feature="points"]').uncheck()
  await page.locator('[data-feature-in-use="points"]').waitFor({ timeout: 5000 })
  check(
    '76: points cannot be switched off while a rule burns them, naming the rule',
    (await page.locator('[data-feature-in-use="points"]').innerText()).startsWith('Loyalty points cannot be switched off: these rules use it.') &&
      (await page.locator('[data-feature-in-use="points"] [data-feature-in-use-rule]').allInnerTexts()).join('|') === 'Burn 30, take 50 off, together or not at all',
  )
  check('76: …Save is held back, nothing sent', (await save.isDisabled()) && saves.length === 2)
  await page.screenshot({ path: `${SHOTS}/settings-features-in-use.png` })
  await page.locator('[data-settings-feature="points"]').check()
  check('76: switched back on, the refusal goes', (await page.locator('[data-feature-in-use]').count()) === 0)
  await page.locator('[data-settings-feature="coupons"]').check()
  await save.click()
  check(
    '76: switching coupons on is saved as the draft’s features, the campaign untouched',
    (await saved(3)) && JSON.stringify([...saves[2].features].sort()) === '["coupons","points"]' && JSON.stringify(saves[2].campaign) === JSON.stringify(loaded('PTS-50OFF').campaign) && saves[2].revision === 0,
    JSON.stringify(saves[2]),
  )
  await settingsPage('PTS-50OFF', 'features')
  check('76: a reload reads it back', await page.locator('[data-settings-feature="coupons"]').isChecked())

  // ── 77 ──
  await settingsPage('PTS-50OFF', 'offline')
  await page.locator('[data-offline-verdict]').waitFor({ timeout: 5000 })
  check('77: a campaign HQ finds unsafe reads Online only', (await page.locator('[data-offline-verdict]').getAttribute('data-offline-verdict')) === 'online')
  check(
    '77: …with HQ’s reasons, from the draft’s validation',
    (await page.locator('[data-offline-reason]').allInnerTexts()).join('|').includes('reads the member profile, looked up at HQ') &&
      (await page.locator('[data-offline-reason]').allInnerTexts()).join('|').includes('awards or takes points'),
    (await page.locator('[data-offline-reason]').allInnerTexts()).join('|'),
  )
  check('77: …and no "online only" to choose', (await page.locator('[data-offline-opt-out]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/settings-offline-unsafe.png` })
  await settingsPage('SUN-3FOR2', 'offline')
  await page.locator('[data-offline-verdict]').waitFor({ timeout: 5000 })
  check(
    '77: a safe one reads Offline-safe',
    (await page.locator('[data-offline-verdict]').getAttribute('data-offline-verdict')) === 'safe' && (await page.locator('[data-offline-verdict]').innerText()).startsWith('Offline-safe'),
  )
  await page.locator('[data-offline-opt-out]').check()
  await save.click()
  check(
    '77: "Online only" is saved as the campaign’s onlineOnly',
    (await saved(4)) && saves[3].campaign.id === 'SUN-3FOR2' && saves[3].campaign.onlineOnly === true && JSON.stringify(saves[3].campaign.rules) === JSON.stringify(loaded('SUN-3FOR2').campaign.rules),
    JSON.stringify(saves[3]),
  )
  await settingsPage('SUN-3FOR2', 'offline')
  await page.locator('[data-offline-verdict]').waitFor({ timeout: 5000 })
  check(
    '77: a reload reads it back: Online only, by choice',
    (await page.locator('[data-offline-verdict]').getAttribute('data-offline-verdict')) === 'optedOut' && (await page.locator('[data-offline-opt-out]').isChecked()),
  )
  await page.screenshot({ path: `${SHOTS}/settings-offline-opted-out.png` })

  // ── 79 ──
  await settingsPage('SUN-3FOR2', 'details')
  await field('nameAr').fill('تعديل غير محفوظ')
  await page.locator('[data-workspace-settings="schedule"]').click()
  await page.locator('[data-leave-dialog]').waitFor({ timeout: 5000 })
  check('79: leaving with unsaved changes asks first', page.url().endsWith('/settings/details'))
  await page.locator('[data-leave-stay]').click()
  check('79: Stay keeps the change', (await field('nameAr').inputValue()) === 'تعديل غير محفوظ')
  // Someone renames it elsewhere; the campaign is re-read when the browser comes back online.
  const sun = store.find((c) => c.code === 'SUN-3FOR2')
  sun.name = { ...sun.name, en: 'Renamed elsewhere' }
  sun.campaign.name = { ...sun.campaign.name, en: 'Renamed elsewhere' }
  await context.setOffline(true)
  await context.setOffline(false)
  await page.waitForFunction(() => document.querySelector('[data-workspace-name]')?.textContent?.includes('Renamed elsewhere'), null, { timeout: 5000 }).catch(() => {})
  check(
    '79: a re-read in the background keeps the unsaved change',
    (await page.locator('[data-workspace-name]').innerText()).includes('Renamed elsewhere') && (await field('nameAr').inputValue()) === 'تعديل غير محفوظ',
  )
  await page.locator('[data-settings-cancel]').click()
  check(
    '79: Cancel goes back to what HQ saved',
    (await field('nameAr').inputValue()) === loaded('SUN-3FOR2').name.ar && (await field('nameEn').inputValue()) === 'Renamed elsewhere' && (await save.isDisabled()),
  )
  await page.locator('[data-workspace-settings="schedule"]').click()
  await page.locator('[data-settings="schedule"]').waitFor({ timeout: 5000 })
  check('79: …and then leaves without asking', (await page.locator('[data-leave-dialog]').count()) === 0 && saves.length === 4)
  check('80: no page errors (72–77, 79)', errors.length === 0, errors.join(' | '))
  void calls
  await context.close()
}

// ── 74 ──
{
  const { context, page, errors, saves } = await open({ at: SMALL_HOURS })
  const field = (k) => page.locator(`[data-settings-field="${k}"]`)
  const save = page.locator('[data-settings-save]')
  const settled = () => page.waitForFunction(() => !document.querySelector('[data-settings-dirty]'), null, { timeout: 5000 }).catch(() => {})
  await page.goto(`${BASE}/campaigns/NATDAY-15/settings/schedule`)
  await page.locator('[data-settings="schedule"]').waitFor({ timeout: 10000 })
  check(
    '74: the window reads as HQ saved it, in local days and hours',
    (await field('from').inputValue()) === '2026-10-19' &&
      (await field('until').inputValue()) === '2026-10-26' &&
      (await field('hoursFrom').inputValue()) === '16:00' &&
      (await field('hoursTo').inputValue()) === '23:00',
  )
  await field('from').fill('2026-10-16')
  await field('until').fill('2026-10-16')
  check('74: an end not after the start holds Save back, saying why', (await page.locator('[data-settings-problem="untilNotAfterFrom"]').isVisible()) && (await save.isDisabled()))
  await field('until').fill('2026-10-23')
  await field('hoursFrom').fill('22:00')
  await field('hoursTo').fill('02:00')
  check('74: hours across midnight are allowed (2758: "hours may cross midnight")', (await page.locator('[data-settings-problem]').count()) === 0 && !(await save.isDisabled()))
  await field('hoursTo').fill('22:00')
  check('74: hours that end when they start hold Save back', (await page.locator('[data-settings-problem="hoursSame"]').isVisible()) && (await save.isDisabled()))
  await field('hoursFrom').fill('00:30')
  await field('hoursTo').fill('23:30')
  await page.locator('[data-settings-day="thu"]').click()
  await page.locator('[data-settings-day="fri"]').click()
  check('74: the weekdays are pressed', (await page.locator('[data-settings-day="thu"]').getAttribute('aria-pressed')) === 'true')
  await save.click()
  await settled()
  check(
    '74: Save sends the window as typed — local days, weekday words, hours — at 02:30 local (23:30 UTC the day before)',
    JSON.stringify(saves[0]?.campaign?.window) === JSON.stringify({ from: '2026-10-16', until: '2026-10-23', days: ['thu', 'fri'], hours: { from: '00:30', until: '23:30' } }),
    JSON.stringify(saves[0]?.campaign?.window),
  )
  await page.screenshot({ path: `${SHOTS}/settings-schedule.png` })
  await page.reload()
  await page.locator('[data-settings="schedule"]').waitFor({ timeout: 10000 })
  check(
    '74: a reload reads them back',
    (await field('from').inputValue()) === '2026-10-16' &&
      (await field('until').inputValue()) === '2026-10-23' &&
      (await field('hoursFrom').inputValue()) === '00:30' &&
      (await page.locator('[data-settings-day][aria-pressed="true"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-settings-day')))).join() === 'thu,fri',
  )
  await page.locator('[data-workspace-menu="dashboard"]').click()
  await page.locator('[data-dashboard]').waitFor({ timeout: 5000 })
  check(
    '74: the dashboard reads the new window: running from today, local',
    (await page.locator('[data-dashboard-cell="schedule"] [data-schedule-relative]').getAttribute('data-schedule-relative')) === 'endsIn' &&
      (await page.locator('[data-dashboard-cell="schedule"]').innerText()).includes('2026-10-16'),
  )
  await page.goto(`${BASE}/campaigns/NATDAY-15/settings/schedule`)
  await page.locator('[data-settings="schedule"]').waitFor({ timeout: 10000 })
  await page.locator('[data-settings-clear="from"]').click()
  await save.click()
  await settled()
  check('74: clearing the start leaves `from` out (immediately)', saves[1] && !('from' in saves[1].campaign.window) && saves[1].campaign.window.until === '2026-10-23', JSON.stringify(saves[1]?.campaign?.window))
  check('80: no page errors (74)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 78 ──
{
  const { context, page, errors, saves } = await open({ refuseSettings: true })
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/settings/details`)
  await page.locator('[data-settings="details"]').waitFor({ timeout: 10000 })
  await page.locator('[data-settings-field="nameEn"]').fill('A new name')
  await page.locator('[data-settings-save]').click()
  await page.locator('[data-settings-refusal="details"]').waitFor({ timeout: 5000 })
  check(
    '78: a refused save shows the envelope’s message and code',
    (await page.locator('[data-settings-refusal="details"]').innerText()).includes(SETTINGS_REFUSED) &&
      (await page.locator('[data-settings-refusal="details"] [data-refusal-code]').getAttribute('data-refusal-code')) === 'RULES_BAD_REQUEST',
  )
  check('78: …and keeps the change', (await page.locator('[data-settings-field="nameEn"]').inputValue()) === 'A new name' && saves.length === 1)
  await page.screenshot({ path: `${SHOTS}/settings-refused.png` })
  check('80: no page errors (78)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 78b: a stale save offers to reload (ticket 522) ──
{
  const { context, page, errors, saves, calls } = await open({ staleSaves: 1 })
  const loads = () => calls.filter((c) => c === 'LOAD SUN-3FOR2').length
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/settings/details`)
  await page.locator('[data-settings="details"]').waitFor({ timeout: 10000 })
  const before = loads()
  await page.locator('[data-settings-field="nameEn"]').fill('Suncare, renamed')
  await page.locator('[data-settings-save]').click()
  const stale = page.locator('[data-draft-stale]')
  await stale.waitFor({ timeout: 5000 })
  check('78b: a stale save says the draft changed since it was loaded', saves.length === 1 && (await stale.isVisible()))
  check('78b: …and offers to reload', await page.locator('[data-draft-reload]').isVisible())
  await page.screenshot({ path: `${SHOTS}/settings-stale.png` })
  await page.locator('[data-draft-reload]').click()
  for (let i = 0; i < 50 && loads() === before; i++) await page.waitForTimeout(100)
  check('78b: Reload reads the draft again (Drafts/Load)', loads() > before, `${before} → ${loads()}`)
  await stale.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check(
    '78b: …and drops the unsaved change with the refusal, as its words say',
    (await stale.count()) === 0 && (await page.locator('[data-settings-field="nameEn"]').inputValue()) === CAMPAIGNS.find((c) => c.code === 'SUN-3FOR2').campaign.name.en,
    await page.locator('[data-settings-field="nameEn"]').inputValue(),
  )
  check('80: no page errors (78b)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 78d: a draft frozen since it was read (409 RULES_DRAFT_PENDING) is said in the page's own words ──
{
  const { context, page, errors, saves } = await open({ pendingSaves: true })
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/settings/details`)
  await page.locator('[data-settings="details"]').waitFor({ timeout: 10000 })
  await page.locator('[data-settings-field="nameEn"]').fill('Suncare, renamed')
  await page.locator('[data-settings-save]').click()
  await page.locator('[data-settings-refusal="details"]').waitFor({ timeout: 5000 })
  check('78d: a pending refusal says the draft waits for an approver', saves.length === 1 && (await page.locator('[data-settings-refusal="details"]').innerText()).includes('The draft waits for an approver, so nothing can be saved'))
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  await page.locator('[data-rule-name]').first().fill('Suncare 3 for 2')
  await page.locator('[data-builder-bar] [data-save]').click()
  await page.locator('[data-save-refused="RULES_DRAFT_PENDING"]').waitFor({ timeout: 5000 })
  check('78d: …and so does the builder', (await page.locator('[data-save-refused]').innerText()).includes('This draft waits for an approver, so it cannot be saved.'))
  check('80: no page errors (78d)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 78c: the builder's own Save is stale too ──
{
  const { context, page, errors, saves } = await open({ staleSaves: 1 })
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/rules`)
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  await page.locator('[data-rule-name]').first().fill('Suncare 3 for 2')
  await page.locator('[data-builder-bar] [data-save]').click()
  await page.locator('[data-save-stale]').waitFor({ timeout: 5000 })
  check('78c: a stale rules save offers to reload, the edit kept', saves.length === 1 && (await page.locator('[data-save-reload]').isVisible()) && (await page.locator('[data-rule-name]').first().inputValue()) === 'Suncare 3 for 2')
  check('80: no page errors (78c)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 510 ── it asserts:
//  81. Settings ▸ Budgets on a draft: a section per scope (Coupon only with the coupons feature), no
//      budget yet, and no counters read — a draft has none;
//  82. + Budget opens the drawer, "Limit the … to … per … (per period)", its sentence read as it is
//      answered; a figure that is not above zero, or uses not whole, is said at the field; Create
//      saves the budgets with the new one and the sentence reads in its section; a reload reads it
//      back, and the dashboard's budgets step is ticked;
//  83. a click on the sentence opens the drawer on it; Save waits for a change; a new figure is saved;
//  84. Delete asks first; confirmed, the budgets are saved without it;
//  85. a live campaign reads its counters: used / limit, in the campaign's currency, and no overshoot
//      while under; a member budget past its limit shows "Over by …";
//  86. on a live campaign a click on a sentence changes only the limit — what it counts, per what,
//      how often and its name are shown, not edited; a refused change keeps the drawer open with the
//      envelope's message and code; the change goes to the limit's own door, with NO publish call
//      (no Settings, Draft, Ask for approval or Activate); the sentence reads the new limit and the
//      counters are read again;
//  87. BHD has three decimals: a Bahrain budget reads BHD 1,250.500, and a fourth decimal is refused;
//  88. a refused counter read is its own message and code, with Try again; a refused save keeps the
//      drawer open, with the envelope's message and code;
//  89. no page errors.
{
  const { context, page, errors, saves, usageReads } = await open()
  const field = (k) => page.locator(`[data-budget-field="${k}"]`)
  const drawer = page.locator('[data-budget-drawer]')
  const budgetsPage = async (id) => {
    await page.goto(`${BASE}/campaigns/${id}/settings/budgets`)
    await page.locator('[data-settings="budgets"]').waitFor({ timeout: 10000 })
  }
  const closed = () => drawer.waitFor({ state: 'detached', timeout: 5000 }).then(() => true, () => false)

  // ── 81 ──
  await budgetsPage('SPRING-DRAFT')
  check(
    '81: a section per scope, Coupon only with the coupons feature',
    JSON.stringify(await page.locator('[data-budget-scope]').evaluateAll((els) => els.map((e) => e.getAttribute('data-budget-scope')))) === '["campaign","profile","store","session"]',
  )
  check('81: no budget yet, and no counters read for a draft', (await page.locator('[data-budget]').count()) === 0 && usageReads.length === 0 && (await page.locator('[data-budgets-live="draft"]').count()) === 1)
  check('81: Budgets is the current page', (await page.locator('[data-workspace-settings="budgets"]').getAttribute('aria-current')) === 'page')

  // ── 82 ──
  await page.locator('[data-budget-add]').click()
  await page.locator('[data-budget-drawer="add"]').waitFor({ timeout: 5000 })
  // 522: schema 1 has no campaign currency; it is the one country's (`campaignCurrency`), and this
  // draft has no audience yet, so the figure carries no code.
  check('82: + Budget opens the drawer on a campaign money budget', (await page.locator('[data-budget-preview]').innerText()) === 'Limit the discount money to 10,000.00 per campaign', await page.locator('[data-budget-preview]').innerText())
  await field('limit').selectOption('uses')
  await field('value').fill('1.5')
  check('82: uses are whole, said at the field', await page.locator('[data-budget-problem="notWhole"]').isVisible())
  await field('value').fill('0')
  check('82: a limit not above zero is said at the field', await page.locator('[data-budget-problem="notAboveZero"]').isVisible())
  await field('value').fill('1')
  await field('scope').selectOption('profile')
  await field('period').selectOption('month')
  check('82: the drawer reads its sentence', (await page.locator('[data-budget-preview]').innerText()) === 'Limit the uses to 1 per member per month', await page.locator('[data-budget-preview]').innerText())
  await page.screenshot({ path: `${SHOTS}/budgets-drawer-add.png` })
  await page.locator('[data-budget-save]').click()
  const isClosed = await closed()
  const added = saves[0]?.campaign?.budgets?.[0]
  check(
    '82: Create saves the draft whole, its budgets with the new one (EN + AR name, no `year` period)',
    isClosed &&
      saves.length === 1 &&
      saves[0].campaign.id === 'SPRING-DRAFT' &&
      saves[0].campaign.budgets.length === 1 &&
      typeof added?.id === 'string' &&
      added.id.length > 0 &&
      added.id.length <= 40 &&
      typeof added.name?.en === 'string' && typeof added.name?.ar === 'string' &&
      JSON.stringify({ scope: added.scope, limit: added.limit, value: added.value, period: added.period }) === JSON.stringify({ scope: 'profile', limit: 'uses', value: 1, period: 'month' }),
    JSON.stringify(saves),
  )
  check('82: a toast says so', await page.getByText('The budgets are saved.').first().isVisible())
  check('82: the sentence reads in the member section', (await page.locator(`[data-budget-scope="profile"] [data-budget-sentence="${added?.id}"]`).innerText()) === 'Limit the uses to 1 per member per month')
  await budgetsPage('SPRING-DRAFT')
  check('82: a reload reads it back', (await page.locator(`[data-budget-sentence="${added?.id}"]`).count()) === 1)
  await page.locator('[data-workspace-menu="dashboard"]').click()
  await page.locator('[data-steps]').waitFor({ timeout: 5000 })
  check('82: the dashboard’s budgets step is ticked', (await page.locator('[data-step="budgets"][data-step-done]').count()) === 1)

  // ── 83 ──
  await budgetsPage('SPRING-DRAFT')
  await page.locator(`[data-budget-sentence="${added?.id}"]`).click()
  await page.locator('[data-budget-drawer="edit"]').waitFor({ timeout: 5000 })
  check('83: a click on the sentence opens it; Save waits for a change', (await field('value').inputValue()) === '1' && (await page.locator('[data-budget-save]').isDisabled()))
  await field('value').fill('2')
  await page.locator('[data-budget-save]').click()
  check('83: the new figure is saved', (await closed()) && saves.length === 2 && saves[1].campaign.budgets[0].value === 2 && saves[1].campaign.budgets[0].id === added?.id && saves[1].revision === saves[0].revision + 1, JSON.stringify(saves[1]))
  check('83: …and read', (await page.locator(`[data-budget-sentence="${added?.id}"]`).innerText()) === 'Limit the uses to 2 per member per month')

  // ── 84 ──
  await page.locator(`[data-budget-delete="${added?.id}"]`).click()
  await page.locator('[data-budget-delete-dialog]').waitFor({ timeout: 5000 })
  check('84: Delete asks first, nothing sent', saves.length === 2)
  await page.locator('[data-budget-delete-confirm]').click()
  await page.locator('[data-budget-delete-dialog]').waitFor({ state: 'detached', timeout: 5000 })
  check('84: confirmed, the draft is saved without it', saves.length === 3 && (saves[2].campaign.budgets ?? []).length === 0 && (await page.locator('[data-budget]').count()) === 0)
  check('89: no page errors (81–84)', errors.length === 0, errors.join(' | '))
  await context.close()
}

{
  const { context, page, errors, saves, usageReads, limits, calls, store } = await open({ refuseLimit: 1 })
  const field = (k) => page.locator(`[data-budget-field="${k}"]`)
  const drawer = page.locator('[data-budget-drawer]')
  const budgetsPage = async (id) => {
    await page.goto(`${BASE}/campaigns/${id}/settings/budgets`)
    await page.locator('[data-settings="budgets"]').waitFor({ timeout: 10000 })
    await page.locator('[data-budget-usage], [data-budget-usage-refusal]').first().waitFor({ timeout: 5000 }).catch(() => {})
  }
  const wknd = store.find((c) => c.code === 'WKND20').campaign.budgets[0].id
  const gp = store.find((c) => c.code === 'GP-BEAUTY15').campaign.budgets[0].id

  // ── 85 ──
  await budgetsPage('WKND20')
  check('85: a live campaign reads its counters', usageReads.includes('WKND20') && (await page.locator('[data-budgets-live="live"]').count()) === 1)
  check('85: the coupons feature shows the Coupon section', (await page.locator('[data-budget-scope="coupon"]').count()) === 1)
  check(
    '85: used / limit, in the campaign’s currency, no overshoot while under',
    (await page.locator(`[data-budget-usage="${wknd}"] [data-budget-used]`).innerText()) === 'SAR 12,345.50 / SAR 50,000.00' &&
      (await page.locator(`[data-budget-usage="${wknd}"] [data-budget-overshoot]`).count()) === 0,
    await page.locator(`[data-budget-usage="${wknd}"]`).innerText(),
  )
  await page.screenshot({ path: `${SHOTS}/budgets-live.png` })
  await budgetsPage('GP-BEAUTY15')
  check(
    '85: a member budget past its limit shows the overshoot',
    (await page.locator(`[data-budget-usage="${gp}"] [data-budget-used]`).innerText()) === '3 / 2' &&
      (await page.locator(`[data-budget-usage="${gp}"] [data-budget-overshoot]`).innerText()) === 'Over by 1' &&
      (await page.locator(`[data-budget-usage="${gp}"]`).innerText()).startsWith('Most used by one member'),
    await page.locator(`[data-budget-usage="${gp}"]`).innerText(),
  )
  await page.screenshot({ path: `${SHOTS}/budgets-overshoot.png` })

  // ── 86 ──
  await budgetsPage('WKND20')
  const readsBefore = usageReads.filter((x) => x === 'WKND20').length
  await page.locator(`[data-budget-sentence="${wknd}"]`).click()
  await page.locator('[data-budget-drawer="live"]').waitFor({ timeout: 5000 })
  check(
    '86: on a live campaign only the limit changes; the rest is shown, not edited',
    (await page.locator('[data-budget-live-note]').isVisible()) &&
      (await field('limit').isDisabled()) &&
      (await field('scope').isDisabled()) &&
      (await field('period').isDisabled()) &&
      (await field('nameEn').isDisabled()) &&
      (await field('value').isEnabled()) &&
      (await field('nameEn').inputValue()) === 'campaign money',
  )
  await field('value').fill('60000')
  await page.locator('[data-budget-save]').click()
  await page.locator('[data-budget-refusal]').waitFor({ timeout: 5000 })
  check(
    '86: a refused change keeps the drawer open, with the envelope’s message and code',
    (await page.locator('[data-budget-refusal]').innerText()).includes(LIMIT_REFUSED) &&
      (await page.locator('[data-budget-refusal] [data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_BUDGET_LIMIT_UNAVAILABLE' &&
      (await field('value').inputValue()) === '60000',
  )
  await page.screenshot({ path: `${SHOTS}/budgets-limit-refused.png` })
  await page.locator('[data-budget-save]').click()
  await drawer.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  check('86: the change goes to the limit’s own door', limits.length === 2 && JSON.stringify(limits[1]) === JSON.stringify({ id: 'WKND20', budgetId: wknd, body: { value: 60000 } }), JSON.stringify(limits))
  check(
    '86: …with NO publish call — no Drafts/Save, Ask for approval or Activate',
    !calls.some((c) => /^POST .*\/(AskForApproval|Activate)$/.test(c)) && saves.length === 0,
    calls.filter((c) => !c.startsWith('GET')).join(' | '),
  )
  check('86: a toast says nothing was republished', await page.getByText('The new limit applies now. Nothing was republished.').first().isVisible())
  await page
    .waitForFunction(([sel, n]) => document.querySelector(sel)?.textContent?.includes(n), [`[data-budget-usage="${wknd}"] [data-budget-used]`, '60,000.00'], { timeout: 5000 })
    .catch(() => {})
  check('86: the sentence reads the new limit', (await page.locator(`[data-budget-sentence="${wknd}"]`).innerText()) === 'Limit the discount money to SAR 60,000.00 per campaign')
  check(
    '86: …and the counters are read again',
    usageReads.filter((x) => x === 'WKND20').length > readsBefore && (await page.locator(`[data-budget-usage="${wknd}"] [data-budget-used]`).innerText()) === 'SAR 12,345.50 / SAR 60,000.00',
  )
  check('86: the campaign is still live, on the same version', store.find((c) => c.code === 'WKND20').campaignStatus === 'Published' && store.find((c) => c.code === 'WKND20').publishedVersionNo === 1)

  // ── 87 ──
  await budgetsPage('BH-SPEND10')
  await page.locator('[data-budget-add-scope="campaign"]').click()
  await page.locator('[data-budget-drawer="add"]').waitFor({ timeout: 5000 })
  check('87: the figure’s currency is BHD', (await page.locator('[data-budget-currency]').innerText()) === 'BHD')
  await field('value').fill('1.2345')
  check('87: a fourth decimal is refused', await page.locator('[data-budget-problem="tooManyDecimals"]').isVisible())
  await field('value').fill('1250.5')
  check('87: BHD reads three decimals', (await page.locator('[data-budget-preview]').innerText()) === 'Limit the discount money to BHD 1,250.500 per campaign', await page.locator('[data-budget-preview]').innerText())
  await page.locator('[data-budget-save]').click()
  await drawer.waitFor({ state: 'detached', timeout: 5000 }).catch(() => {})
  const bh = saves[0]?.campaign?.budgets?.[0]
  check('87: adding one to a live campaign saves its draft with the budget', saves.length === 1 && saves[0].campaign.id === 'BH-SPEND10' && saves[0].revision === 0 && bh?.value === 1250.5 && limits.length === 2)
  await page.locator(`[data-budget-usage="${bh?.id}"]`).waitFor({ timeout: 5000 }).catch(() => {})
  check('87: …and its counter reads BHD 0.000 / BHD 1,250.500', (await page.locator(`[data-budget-usage="${bh?.id}"] [data-budget-used]`).innerText()) === 'BHD 0.000 / BHD 1,250.500')
  check('89: no page errors (85–87)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 88 ──
{
  const { context, page, errors, saves } = await open({ refuseUsage: true, refuseSettings: true })
  await page.goto(`${BASE}/campaigns/WKND20/settings/budgets`)
  await page.locator('[data-budget-usage-refusal]').waitFor({ timeout: 10000 })
  check(
    '88: a refused counter read is its own message and code, with Try again',
    (await page.locator('[data-budget-usage-refusal]').innerText()).includes(USAGE_REFUSED) &&
      (await page.locator('[data-budget-usage-refusal] [data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_BUDGET_USAGE_UNAVAILABLE' &&
      (await page.locator('[data-budget-usage-retry]').isVisible()),
  )
  check('88: …the budgets themselves still shown', (await page.locator('[data-budget-sentence]').count()) === 1)
  await page.goto(`${BASE}/campaigns/SPRING-DRAFT/settings/budgets`)
  await page.locator('[data-settings="budgets"]').waitFor({ timeout: 10000 })
  await page.locator('[data-budget-add-scope="store"]').click()
  await page.locator('[data-budget-save]').click()
  await page.locator('[data-budget-refusal]').waitFor({ timeout: 5000 })
  check(
    '88: a refused save keeps the drawer open, with the envelope’s message and code',
    (await page.locator('[data-budget-drawer="add"]').isVisible()) &&
      (await page.locator('[data-budget-refusal]').innerText()).includes(SETTINGS_REFUSED) &&
      (await page.locator('[data-budget-refusal] [data-refusal-code]').getAttribute('data-refusal-code')) === 'RULES_BAD_REQUEST' &&
      saves.length === 1,
  )
  check('89: no page errors (88)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 512 ── it asserts:
//  90. the campaign menu has Versions, which opens /campaigns/:id/versions as the current item;
//  91. every published version, newest first, with its number, who, when (local) and the note — the
//      live one marked Live;
//  92. every version of a live campaign offers Restore, the live one too (its draft may hold saved
//      edits, and restoring the live version is how they are thrown away);
//  93. a version opens read-only as its rules in sentences, with its EN + AR lines, and nothing to edit;
//  94. Restore on a live campaign asks first (saved edits may be in its draft): Keep the draft sends
//      nothing; Replace the draft restores once, the dashboard shows a Draft and the live version it
//      still runs, unchanged (version 3); the rule builder reads the restored rules;
//  95. over that draft, Restore asks first: Keep the draft sends nothing; Replace the draft restores;
//      the live version may be restored too now (it throws the draft away);
//  96. a refused restore is the envelope's message and code, on the page, and nothing moves;
//  97. a refused versions read is its own message and code with Try again; a campaign never
//      published has no versions yet;
//  98. while a request waits, Restore is held and says why; activated, the new version is listed
//      first, Live, by the approver, with the note;
//  99. no page errors.
{
  const { context, page, errors, store, restores } = await open()
  const vers = async (id) => {
    await page.goto(`${BASE}/campaigns/${id}/versions`)
    await page.locator('[data-versions], [data-versions-empty], [data-versions-refusal]').first().waitFor({ timeout: 10000 })
  }
  const order = () => page.locator('[data-version]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-version'))))
  const item = (n) => page.locator(`[data-version="${n}"]`)
  const restorable = () => page.locator('[data-version]:has([data-version-restore])').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-version'))))
  const pouch = () => store.find((c) => c.code === 'GIFT-POUCH')

  // ── 90 ──
  await page.goto(`${BASE}/campaigns/GIFT-POUCH`)
  await page.locator('[data-dashboard]').waitFor({ timeout: 10000 })
  await page.locator('[data-workspace-menu="versions"]').click()
  await page.waitForURL(`${BASE}/campaigns/GIFT-POUCH/versions`)
  await page.locator('[data-versions]').waitFor({ timeout: 10000 })
  check('90: Versions opens /campaigns/:id/versions, the current menu item', (await page.locator('[data-workspace-menu="versions"]').getAttribute('aria-current')) === 'page')

  // ── 91 ──
  check('91: three versions, newest first', JSON.stringify(await order()) === '[3,2,1]', JSON.stringify(await order()))
  check('91: version 3 is marked Live, and only it', (await item(3).locator('[data-version-marker]').innerText()) === 'Live' && (await page.locator('[data-version-marker]').count()) === 1)
  check('91: each says its number', (await item(2).locator('[data-version-number]').innerText()) === 'Version 2')
  check(
    '91: who and when, in local time',
    (await item(3).locator('[data-version-stamp]').innerText()) === '2026-10-10 15:00 by Omar (marketing)' &&
      (await item(2).locator('[data-version-stamp]').innerText()) === '2026-10-06 12:30 by Reem (approver)',
    await item(2).locator('[data-version-stamp]').innerText(),
  )
  check(
    '91: and the note',
    (await item(2).locator('[data-version-note]').innerText()) === 'The cashier is prompted to scan the pouch.' &&
      (await item(1).locator('[data-version-note]').innerText()) === 'First version: the pouch is free with the serum.',
  )

  // ── 92 ──
  check('92: every version of a live campaign offers Restore, the live one too', JSON.stringify(await restorable()) === '[3,2,1]', JSON.stringify(await restorable()))

  // ── 93 ──
  await item(2).locator('[data-version-view]').click()
  const rules2 = page.locator('[data-version-rules="2"]')
  await rules2.locator('[data-version-rule]').first().waitFor({ timeout: 5000 })
  check('93: View opens the version’s rules', (await item(2).locator('[data-version-view]').getAttribute('aria-expanded')) === 'true' && (await rules2.locator('[data-version-rule]').count()) === 1)
  // 522: schema 1's freeProduct names its filter (`pouch`, the articles GIFT-BAG), as the builder does.
  check('93: …read as sentences', (await rules2.locator('[data-effect] [data-block-sentence]').innerText()) === 'Give 1 unit of pouch free when it is scanned', await rules2.locator('[data-effect] [data-block-sentence]').innerText())
  check(
    '93: …with the cashier prompt in English and Arabic',
    (await rules2.locator('[data-says="cashierPrompt"] [data-says-en]').innerText()) === 'Scan a travel pouch: it is free with the serum' &&
      (await rules2.locator('[data-says="cashierPrompt"] [data-says-ar]').getAttribute('dir')) === 'rtl',
  )
  check('93: …and its receipt label as it was then', (await rules2.locator('[data-says="receiptLabel"] [data-says-en]').innerText()) === 'Gift pouch')
  check('93: nothing in it edits', (await rules2.locator('input, select, textarea, [data-block-edit], [data-palette-open]').count()) === 0)
  check('93: a filter that lets Prescription in carries the red flag, as in the builder (512 review)',
    (await rules2.locator('[data-filter][data-filter-rx] [data-rx-flag]').count()) === (await rules2.locator('[data-filter][data-filter-rx]').count()) &&
      (await rules2.locator('[data-filter][data-filter-rx]').count()) > 0,
    String(await rules2.locator('[data-rx-flag]').count()))
  await item(1).locator('[data-version-view]').click()
  await page.locator('[data-version-rules="1"] [data-version-rule]').waitFor({ timeout: 5000 })
  check('93: version 1 had no cashier prompt', (await page.locator('[data-version-rules="1"] [data-says="cashierPrompt"]').count()) === 0)
  await page.screenshot({ path: `${SHOTS}/512-versions.png`, fullPage: true })

  // ── 94 ──
  await item(2).locator('[data-version-restore]').click()
  const askLive = page.locator('[data-restore-dialog="2"]')
  await askLive.waitFor({ timeout: 5000 })
  check('94: Restore on a live campaign asks first, saying the live version stays', (await askLive.innerText()).includes('Tills keep running version 3'))
  await page.locator('[data-restore-cancel]').click()
  await askLive.waitFor({ state: 'detached', timeout: 5000 })
  check('94: Keep the draft sends nothing', restores.length === 0 && pouch().source === 'published', JSON.stringify(restores))
  await item(2).locator('[data-version-restore]').click()
  await page.locator('[data-restore-confirm]').click()
  await page.waitForURL(`${BASE}/campaigns/GIFT-POUCH`, { timeout: 5000 }).catch(() => {})
  await page.locator('[data-dashboard]').waitFor({ timeout: 5000 })
  check('94: Replace the draft restores once and goes to the dashboard', page.url() === `${BASE}/campaigns/GIFT-POUCH` && JSON.stringify(restores) === '["GIFT-POUCH 2"]', JSON.stringify(restores))
  const stateCell = page.locator('[data-dashboard-cell="state"]')
  // 522: a published campaign with an editing draft is read by its window (campaignStatus decides,
  // HITL-522), and the Drafts/Load reply carries no activation stamp of the live version.
  check('94: the dashboard still reads the live campaign Running', (await stateCell.locator('[data-campaign-state]').innerText()) === 'Running')
  check(
    '94: …and the live version it still runs, unchanged, until the draft is activated',
    (await stateCell.locator('[data-live-under-draft]').innerText()) === 'Tills still run version 3 until this draft is activated.',
    await stateCell.locator('[data-live-under-draft]').innerText(),
  )
  check('94: HQ’s campaign: a draft with version 2’s rules (origin restore:2), live version 3 untouched', pouch().source === 'draft' && pouch().origin === 'restore:2' && pouch().campaignStatus === 'Published' && pouch().publishedVersionNo === 3 && pouch().campaign.rules[0].then[0].label.en === 'Gift pouch')
  await page.screenshot({ path: `${SHOTS}/512-restored.png`, fullPage: true })
  await page.locator('[data-workspace-menu="rules"]').click()
  await page.locator('[data-rules]').waitFor({ timeout: 10000 })
  check('94: the rule builder reads the restored rules', (await page.locator('[data-effect] [data-says="receiptLabel"] [data-says-en]').innerText()) === 'Gift pouch')

  // ── 95 ──
  await vers('GIFT-POUCH')
  check('95: version 3 is still Live', (await item(3).locator('[data-version-marker]').innerText()) === 'Live')
  check('95: over the draft, every version offers Restore — the live one too', JSON.stringify(await restorable()) === '[3,2,1]', JSON.stringify(await restorable()))
  await item(1).locator('[data-version-restore]').click()
  const ask = page.locator('[data-restore-dialog="1"]')
  await ask.waitFor({ timeout: 5000 })
  check('95: Restore over a draft asks first, saying the live version stays', (await ask.innerText()).includes('Tills keep running version 3'))
  await page.locator('[data-restore-cancel]').click()
  await ask.waitFor({ state: 'detached', timeout: 5000 })
  check('95: Keep the draft sends nothing', restores.length === 1 && pouch().campaign.rules[0].then[0].label.en === 'Gift pouch')
  await item(1).locator('[data-version-restore]').click()
  await page.locator('[data-restore-confirm]').click()
  await page.waitForURL(`${BASE}/campaigns/GIFT-POUCH`, { timeout: 5000 }).catch(() => {})
  await page.locator('[data-dashboard]').waitFor({ timeout: 5000 })
  check('95: Replace the draft restores version 1', JSON.stringify(restores) === '["GIFT-POUCH 2","GIFT-POUCH 1"]' && pouch().origin === 'restore:1' && pouch().publishedVersionNo === 3)
  check('99: no page errors (90–95)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 96, 97 ──
{
  const { context, page, errors, store, restores } = await open({ refuseRestore: 1 })
  await page.goto(`${BASE}/campaigns/GIFT-POUCH/versions`)
  await page.locator('[data-versions]').waitFor({ timeout: 10000 })
  await page.locator('[data-version="1"] [data-version-restore]').click()
  await page.locator('[data-restore-confirm]').click()
  await page.locator('[data-restore-refusal]').waitFor({ timeout: 5000 })
  check(
    '96: a refused restore is the envelope’s message and code, on the page',
    (await page.locator('[data-restore-refusal]').innerText()).includes(RESTORE_REFUSED) &&
      (await page.locator('[data-restore-refusal] [data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_RESTORE_UNAVAILABLE' &&
      page.url().endsWith('/campaigns/GIFT-POUCH/versions'),
  )
  const pouch = store.find((c) => c.code === 'GIFT-POUCH')
  check('96: …and nothing moved', restores.length === 1 && pouch.source === 'published' && pouch.campaign.rules[0].then[0].label.en === 'Free pouch')
  await page.goto(`${BASE}/campaigns/SPRING-DRAFT/versions`)
  await page.locator('[data-versions-empty]').waitFor({ timeout: 10000 })
  check('97: a campaign never published has no versions yet', (await page.locator('[data-versions-empty]').innerText()) === 'No versions yet. Activating the campaign publishes its first.')
  await page.goto(`${BASE}/campaigns/SUMMER-FLASH/versions`)
  await page.locator('[data-versions]').waitFor({ timeout: 10000 })
  check(
    '98: a disabled campaign holds Restore, says why, and marks its last version as disabled',
    (await page.locator('[data-versions-held="disabled"]').isVisible()) &&
      (await page.locator('[data-version-restore]').count()) === 0 &&
      (await page.locator('[data-version="1"] [data-version-marker]').innerText()) === 'Last published, disabled',
  )
  check('99: no page errors (96, 97)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open({ refuseVersions: true })
  await page.goto(`${BASE}/campaigns/GIFT-POUCH/versions`)
  await page.locator('[data-versions-refusal]').waitFor({ timeout: 10000 })
  check(
    '97: a refused versions read is its own message and code, with Try again',
    (await page.locator('[data-versions-refusal]').innerText()).includes(VERSIONS_REFUSED) &&
      (await page.locator('[data-versions-refusal] [data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_VERSIONS_UNAVAILABLE' &&
      (await page.locator('[data-versions-retry]').isVisible()),
  )
  check('99: no page errors (97)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 98 ──
{
  const { context, page, errors, as } = await open({
    // The pouch's draft over version 3 waits for an approver.
    edit: (store) =>
      Object.assign(store.find((c) => c.code === 'GIFT-POUCH'), {
        source: 'draft',
        revision: 2,
        state: 'pending',
        requestedAt: '2026-10-16T09:00:00',
        requestedBy: 'Omar (marketing)',
        requestNote: 'Back to the gift pouch label.',
      }),
  })
  await page.goto(`${BASE}/campaigns/GIFT-POUCH/versions`)
  await page.locator('[data-versions]').waitFor({ timeout: 10000 })
  check('98: while a request waits, Restore is held and says why', (await page.locator('[data-versions-held="waiting"]').isVisible()) && (await page.locator('[data-version-restore]').count()) === 0)
  check('98: …version 3 still Live', (await page.locator('[data-version="3"] [data-version-marker]').innerText()) === 'Live')
  as('approver')
  await page.goto(`${BASE}/campaigns/GIFT-POUCH`)
  await page.locator('[data-approval-action="activate"]').waitFor({ timeout: 10000 })
  await page.locator('[data-approval-action="activate"]').click()
  await page.locator('[data-approval-dialog-note]').fill('Gift pouch label again.')
  await page.locator('[data-approval-confirm]:not([disabled])').click({ timeout: 5000 })
  await page.locator('[data-approval-dialog]').waitFor({ state: 'detached', timeout: 5000 })
  await page.locator('[data-workspace-menu="versions"]').click()
  await page.locator('[data-version="4"]').waitFor({ timeout: 5000 }).catch(() => {})
  const listed = await page.locator('[data-version]').evaluateAll((els) => els.map((e) => Number(e.getAttribute('data-version'))))
  check('98: activated, the new version is listed first', JSON.stringify(listed) === '[4,3,2,1]', JSON.stringify(listed))
  check(
    '98: …Live, by the approver, with the note',
    (await page.locator('[data-version="4"] [data-version-marker]').innerText()) === 'Live' &&
      (await page.locator('[data-version="4"] [data-version-stamp]').innerText()) === '2026-10-16 18:30 by Reem (approver)' &&
      (await page.locator('[data-version="4"] [data-version-note]').innerText()) === 'Gift pouch label again.' &&
      (await page.locator('[data-version="3"] [data-version-marker]').count()) === 0,
  )
  check('99: no page errors (98)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 515 ── it asserts:
// 110. a coupons campaign's menu has Coupons, which opens /campaigns/:id/coupons as the current item:
//      every code in the grid, the counts by status, and ONE read of the codes;
// 111. each code reads its status, kind, uses (a count, never "n / limit"), validity as local days,
//      its member or Anyone, and its batch;
// 112. the search matches part of the code in any case and the status filter its status, both in
//      the URL; Clear filters shows every code again;
// 113. a batch id in the grid filters the list to its batch, with a chip that clears it;
// 114. Create coupons opens on Random codes, with NO redemption-limit field anywhere in the dialog —
//      a line says the limits are budgets and links to Settings ▸ Budgets;
// 115. a count out of range is said at its field once Create is tried, and nothing is sent;
// 116. a random batch sends ONE POST with exactly the random kind's fields, the days as typed; the
//      success modal shows HQ's batch id and the count;
// 117. Show the codes lists that batch only (?batch=), its 25 codes with their local validity;
// 118. a universal code the campaign already has is said at its field and not sent; a new one is
//      sent upper-cased with only its own fields, and the modal shows its batch id and "1 code";
// 119. personal codes: pasted member ids, a repeat counted once, sent as each id once; the modal shows
//      the batch id, and the batch lists one code per member;
// 120. HQ's refusal shows in the dialog with its message and code, and the form is kept;
// 121. a refused codes read is its own message and code with Try again;
// 122. a campaign without the coupons feature has no Coupons item, and its coupons page says so,
//      linking to Settings ▸ Features, and reads no codes;
// 123. no page errors.
{
  const { context, page, errors, calls, batches } = await open()
  const cgrid = '[data-coupons-grid]'
  const shown = () => page.locator('[data-coupons-shown]').innerText()
  const waitShown = (text) =>
    page.waitForFunction((t) => document.querySelector('[data-coupons-shown]')?.textContent === t, text, { timeout: 20000 }).catch(() => {})
  const ccell = (codeId, col) => page.locator(`${cgrid} .ag-row[row-id="${codeId}"] .ag-cell[col-id="${col}"]`).first().innerText()
  const dialog = page.locator('form[data-coupons-create]')
  const field = (f) => dialog.locator(`[data-coupon-field="${f}"]`)
  const createButton = page.locator('[data-coupons-create-open]')

  await page.goto(`${BASE}/campaigns/WKND20`)
  await page.locator('[data-dashboard]').waitFor({ timeout: 10000 })
  await page.locator('[data-workspace-menu="coupons"]').click()
  await page.waitForURL(`${BASE}/campaigns/WKND20/coupons`)
  await waitShown('Showing 6 of 6 codes')
  check('110: the menu’s Coupons opens /campaigns/WKND20/coupons', page.url() === `${BASE}/campaigns/WKND20/coupons`)
  check('110: …as the current item', (await page.locator('[data-workspace-menu="coupons"]').getAttribute('aria-current')) === 'page')
  check('110: every code is listed', (await shown()) === 'Showing 6 of 6 codes', await shown())
  check('110: the counts by status', (await page.locator('[data-coupons-counts]').innerText()) === '6 codes: 2 unused, 2 used, 1 disabled, 1 expired.', await page.locator('[data-coupons-counts]').innerText())
  check('110: the codes were read once', calls.filter((x) => x === 'GET RuleCampaign/Campaigns/WKND20/Coupons').length === 1)

  check('111: a status reads as its badge', (await ccell('WKND-B3N6QW', 'status')) === 'Expired' && (await ccell('WKND-P5R8ZD', 'status')) === 'Disabled')
  check('111: the universal code: its kind and its uses as a count', (await ccell('WKND-FLYER', 'kind')) === 'Universal' && (await ccell('WKND-FLYER', 'uses')) === '12')
  check('111: …its validity in local days', (await ccell('WKND-FLYER', 'from')) === '2026-10-01' && (await ccell('WKND-FLYER', 'until')) === '2026-10-31')
  check('111: no validity reads At once / No end; no member reads Anyone', (await ccell('WKND-4F7K2Q', 'from')) === 'At once' && (await ccell('WKND-4F7K2Q', 'until')) === 'No end' && (await ccell('WKND-4F7K2Q', 'member')) === 'Anyone')
  check('111: the batch column', (await ccell('WKND-4F7K2Q', 'batch')) === 'k3m9q2xa')
  check('111: no column reads a limit', !/limit/i.test(await page.locator(`${cgrid} .ag-header`).innerText()))
  await page.screenshot({ path: `${SHOTS}/coupons.png` })

  await page.locator('[data-coupons-search]').fill('flyer')
  await waitShown('Showing 1 of 6 codes')
  check('112: the search matches part of the code, any case', (await shown()) === 'Showing 1 of 6 codes' && page.url().endsWith('?q=flyer'), page.url())
  await page.locator('[data-coupons-search]').fill('')
  // Let the cleared search's render COMMIT before the next filter (as 501's tile and search).
  await waitShown('Showing 6 of 6 codes')
  await page.locator('[data-coupons-status]').selectOption('used')
  await waitShown('Showing 2 of 6 codes')
  check('112: the status filter, in the URL', (await shown()) === 'Showing 2 of 6 codes' && page.url().endsWith('?status=used'), page.url())
  await page.locator('[data-coupons-clear]').click()
  await waitShown('Showing 6 of 6 codes')
  check('112: Clear filters shows every code', (await shown()) === 'Showing 6 of 6 codes' && page.url() === `${BASE}/campaigns/WKND20/coupons`)

  await page.locator(`${cgrid} [data-coupon-batch="u7d2w4pe"]`).click()
  await waitShown('Showing 1 of 6 codes')
  check('113: a batch id filters the list to its batch', (await shown()) === 'Showing 1 of 6 codes' && page.url().endsWith('?batch=u7d2w4pe'), page.url())
  check('113: …with its chip', (await page.locator('[data-coupons-batch-chip="u7d2w4pe"]').innerText()).trim() === 'Batch u7d2w4pe', await page.locator('[data-coupons-batch-chip]').innerText())
  await page.locator('[data-coupons-batch-clear]').click()
  await waitShown('Showing 6 of 6 codes')
  check('113: the chip clears it', (await page.locator('[data-coupons-batch-chip]').count()) === 0)

  await createButton.click()
  await dialog.waitFor({ timeout: 5000 })
  check('114: Create coupons opens on Random codes', (await dialog.locator('[data-coupon-kind="random"]').getAttribute('aria-checked')) === 'true')
  const noLimits = async () => {
    const text = await dialog.innerText()
    const labels = await dialog.locator('label, legend').allInnerTexts()
    return (await dialog.locator('input[type="checkbox"]').count()) === 0 && !labels.some((l) => /limit|once|per customer|per member|uses/i.test(l)) && !/each code works once/i.test(text)
  }
  let all = true
  for (const kind of ['random', 'universal', 'personal']) {
    await dialog.locator(`[data-coupon-kind="${kind}"]`).click()
    all = all && (await noLimits())
  }
  check('114: no redemption-limit field for any kind', all)
  check('114: the line says limits are budgets and links to Settings ▸ Budgets', (await dialog.locator('[data-coupon-budgets-link]').getAttribute('href')) === '/campaigns/WKND20/settings/budgets' && (await dialog.locator('[data-coupon-limits]').innerText()).includes('coupon and profile budgets'))

  await dialog.locator('[data-coupon-kind="random"]').click()
  await field('count').fill('0')
  await page.locator('[data-coupons-create-submit]').click()
  check('115: a count out of range is said at its field', (await dialog.locator('[data-coupon-problem="countRange"]').innerText()).replace(/[⁦-⁩]/g, '') === 'Enter a whole number from 1 to 5000.', await dialog.locator('[data-coupon-problem="countRange"]').innerText())
  check('115: …and nothing is sent', batches.length === 0)

  await field('count').fill('25')
  await field('prefix').fill('wknd')
  await field('length').fill('8')
  await field('from').fill('2026-11-01')
  await field('until').fill('2026-11-30')
  check('116: the example shows the shape', (await dialog.locator('[data-coupon-example]').innerText()) === 'Looks like WKND-K7Q2M9X4', await dialog.locator('[data-coupon-example]').innerText())
  await page.screenshot({ path: `${SHOTS}/coupons-create.png` })
  await page.locator('[data-coupons-create-submit]').click()
  const created = page.locator('[data-coupons-created]')
  await created.waitFor({ timeout: 5000 })
  check('116: ONE POST with exactly the random kind’s fields, the days as typed', batches.length === 1 && JSON.stringify(batches[0].body) === JSON.stringify({ kind: 'random', count: 25, prefix: 'WKND', suffix: '', length: 8, charset: 'lettersAndDigits', from: '2026-11-01', until: '2026-11-30' }), JSON.stringify(batches[0]?.body))
  const firstBatch = await created.getAttribute('data-coupons-created')
  check('116: the modal shows HQ’s batch id', /^nb\d{6}$/.test(firstBatch) && (await created.locator('[data-batch-id]').innerText()) === firstBatch, firstBatch)
  check('116: …and the count', (await created.innerText()).includes('identifies the 25 codes you just created'))
  check('116: the create dialog is closed', !(await dialog.isVisible()))
  await page.screenshot({ path: `${SHOTS}/coupons-created.png` })

  await page.locator('[data-coupons-created-show]').click()
  await waitShown('Showing 25 of 31 codes')
  await page.waitForFunction((sel) => !document.querySelector(`${sel} .ag-row[row-id="WKND-FLYER"]`), cgrid, { timeout: 5000 }).catch(() => {})
  check('117: Show the codes lists that batch only', (await shown()) === 'Showing 25 of 31 codes' && page.url().endsWith(`?batch=${firstBatch}`), `${await shown()} ${page.url()}`)
  const firstRow = await page.locator(`${cgrid} .ag-row[row-index="0"]`).first().getAttribute('row-id')
  check('117: …with its local validity and batch', (await ccell(firstRow, 'from')) === '2026-11-01' && (await ccell(firstRow, 'until')) === '2026-11-30' && (await ccell(firstRow, 'batch')) === firstBatch && (await ccell(firstRow, 'kind')) === 'Random')
  check('117: the counts include it', (await page.locator('[data-coupons-counts]').innerText()).startsWith('31 codes: 27 unused'), await page.locator('[data-coupons-counts]').innerText())
  await page.screenshot({ path: `${SHOTS}/coupons-batch.png` })

  await createButton.click()
  await dialog.waitFor()
  check('118: a reopened dialog is a fresh form', (await field('count').inputValue()) === '100' && (await dialog.locator('[data-coupon-kind="random"]').getAttribute('aria-checked')) === 'true')
  await dialog.locator('[data-coupon-kind="universal"]').click()
  await field('code').fill('wknd-flyer')
  await page.locator('[data-coupons-create-submit]').click()
  check('118: a code the campaign has is said at its field, and not sent', (await dialog.locator('[data-coupon-problem="codeTaken"]').count()) === 1 && batches.length === 1)
  await field('code').fill('hayak-wknd')
  check('118: the code is upper-cased as typed', (await field('code').inputValue()) === 'HAYAK-WKND')
  await page.locator('[data-coupons-create-submit]').click()
  await created.waitFor({ timeout: 5000 })
  check('118: only the universal kind’s fields are sent', JSON.stringify(batches[1]?.body) === JSON.stringify({ kind: 'universal', code: 'HAYAK-WKND', from: null, until: null }), JSON.stringify(batches[1]?.body))
  const uniBatch = await created.getAttribute('data-coupons-created')
  check('118: the modal shows its batch id and "1 code"', uniBatch !== firstBatch && (await created.locator('[data-batch-id]').innerText()) === uniBatch && (await created.innerText()).includes('identifies the 1 code you just created'))

  await page.locator('[data-coupons-created-more]').click()
  await dialog.waitFor()
  await dialog.locator('[data-coupon-kind="personal"]').click()
  await page.locator('[data-coupons-create-submit]').click()
  check('119: no member is said at its field', (await dialog.locator('[data-coupon-problem="membersEmpty"]').count()) === 1 && batches.length === 2)
  await field('members').fill('M-100231\nM-055410, M-100231')
  check('119: the ids are counted, a repeat once', (await dialog.locator('[data-coupon-members-count]').innerText()) === '2 members get a code each. 1 repeated id is counted once.', await dialog.locator('[data-coupon-members-count]').innerText())
  await page.locator('[data-coupons-create-submit]').click()
  await created.waitFor({ timeout: 5000 })
  check('119: each member id is sent once, with the shape', JSON.stringify(batches[2]?.body) === JSON.stringify({ kind: 'personal', members: ['M-100231', 'M-055410'], prefix: 'WKND20', suffix: '', length: 6, charset: 'lettersAndDigits', from: null, until: null }), JSON.stringify(batches[2]?.body))
  const perBatch = await created.getAttribute('data-coupons-created')
  check('119: the modal shows its batch id and "2 codes"', ![firstBatch, uniBatch].includes(perBatch) && (await created.locator('[data-batch-id]').innerText()) === perBatch && (await created.innerText()).includes('identifies the 2 codes you just created'))
  await page.locator('[data-coupons-created-show]').click()
  await waitShown('Showing 2 of 34 codes')
  // The status bar counts at once; the grid's rows follow its rowData a moment later.
  await page.waitForFunction((sel) => document.querySelectorAll(`${sel} .ag-cell[col-id="member"]`).length === 2, cgrid, { timeout: 5000 }).catch(() => {})
  const members = await page.locator(`${cgrid} .ag-cell[col-id="member"]`).allInnerTexts()
  check('119: the batch lists one code per member', (await shown()) === 'Showing 2 of 34 codes' && JSON.stringify(members.sort()) === '["M-055410","M-100231"]', JSON.stringify(members))
  check('123: no page errors (110–119)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 120, 121 ──
{
  const { context, page, errors, batches } = await open({ refuseBatch: 1 })
  await page.goto(`${BASE}/campaigns/WKND20/coupons`)
  await page.locator('[data-coupons-shown]').waitFor({ timeout: 20000 })
  await page.locator('[data-coupons-create-open]').click()
  const dialog = page.locator('form[data-coupons-create]')
  await dialog.locator('[data-coupon-field="count"]').fill('10')
  await page.locator('[data-coupons-create-submit]').click()
  const refusal = dialog.locator('[data-coupons-create-refusal]')
  await refusal.waitFor({ timeout: 5000 })
  check('120: HQ’s refusal shows in the dialog with its message', (await refusal.innerText()).includes(BATCH_REFUSED))
  check('120: …and its code', (await refusal.locator('[data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_COUPONS_UNAVAILABLE')
  check('120: the form is kept, no modal', (await dialog.locator('[data-coupon-field="count"]').inputValue()) === '10' && (await page.locator('[data-coupons-created]').count()) === 0 && batches.length === 1)
  await page.locator('[data-coupons-create-submit]').click()
  await page.locator('[data-coupons-created]').waitFor({ timeout: 5000 })
  check('120: Create again goes through', batches.length === 2 && (await page.locator('[data-coupons-created] [data-batch-id]').innerText()).startsWith('nb'))
  check('123: no page errors (120)', errors.length === 0, errors.join(' | '))
  await context.close()
}
{
  const { context, page, errors } = await open({ refuseCoupons: true })
  await page.goto(`${BASE}/campaigns/WKND20/coupons`)
  const refusal = page.locator('[data-coupons-refusal]')
  await refusal.waitFor({ timeout: 20000 })
  check('121: a refused codes read is its own message and code', (await refusal.innerText()).includes(COUPONS_REFUSED) && (await refusal.locator('[data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_COUPONS_UNAVAILABLE')
  check('121: …with Try again, and Create coupons waits for the codes', (await page.locator('[data-coupons-retry]').isVisible()) && (await page.locator('[data-coupons-create-open]').isDisabled()))
  check('123: no page errors (121)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 122 ──
{
  const { context, page, errors, calls } = await open()
  await page.goto(`${BASE}/campaigns/SUN-3FOR2`)
  await page.locator('[data-dashboard]').waitFor({ timeout: 10000 })
  check('122: a campaign without coupons has no Coupons item', (await page.locator('[data-workspace-menu="coupons"]').count()) === 0)
  await page.goto(`${BASE}/campaigns/SUN-3FOR2/coupons`)
  await page.locator('[data-coupons-off]').waitFor({ timeout: 20000 })
  check('122: its coupons page says coupons are off, linking to Settings ▸ Features', (await page.locator('[data-coupons-off] a').getAttribute('href')) === '/campaigns/SUN-3FOR2/settings/features')
  check('122: …and reads no codes', !calls.some((x) => /Coupons$/.test(x)))
  check('123: no page errors (122)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 516 ── it asserts:
// 124. the Coupons page offers Import CSV, Export (with how many codes it writes) and Create coupons;
// 125. Export writes every code to WKND20-coupons.csv: a BOM, the import's own header, a line a
//      code with its machine values, CRLF, and no bidi isolate anywhere;
// 126. with a filter on, Export writes the filtered list only, and says so;
// 127. a chosen CSV file is checked at once, row by row: the one bad row is shown with its reason,
//      HQ's check is sent only the good rows, and Import sends exactly the good rows, upper-cased;
// 128. the success modal says "Coupons imported" with HQ's batch id, the count and the row left out;
//      Export the codes writes that batch alone to WKND20-<batch>.csv; Show the codes lists it,
//      each code Imported, bound to its member;
// 129. pasted rows are checked with Check the rows: a missing code, bad characters, a repeat, a code
//      the campaign has, a code SIS.Coupons holds (HQ) and an unknown member (HQ), each with its
//      reason; an edit makes the check stale; Cancel imports nothing;
// 130. a file dropped on the drop zone is read and checked like a chosen one;
// 131. a refused check shows its message and code, Import stays off, and checking again goes through;
// 132. with a batch filtered, Delete unused confirms with the counts — the unused that go, the used,
//      disabled and expired that stay — sends ONE delete for the batch, says what HQ did, and the
//      used codes stay listed; a batch with no unused code cannot be asked;
// 133. a refused delete shows in the confirmation, the codes are unchanged, and confirming again
//      goes through;
// 134. no page errors.
{
  const { context, page, errors, importChecks, imports } = await open()
  const cgrid = '[data-coupons-grid]'
  const shown = () => page.locator('[data-coupons-shown]').innerText()
  const waitShown = (text) =>
    page.waitForFunction((t) => document.querySelector('[data-coupons-shown]')?.textContent === t, text, { timeout: 20000 }).catch(() => {})
  const ccell = (codeId, col) => page.locator(`${cgrid} .ag-row[row-id="${codeId}"] .ag-cell[col-id="${col}"]`).first().innerText()
  const dialog = page.locator('[data-coupons-import]')
  const verdict = (line) => dialog.locator(`[data-coupons-import-preview] .ag-row[row-id="${line}"] [data-coupons-import-row]`).first()
  const download = async (button) => {
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 10000 }), page.locator(button).click()])
    return { name: dl.suggestedFilename(), text: readFileSync(await dl.path(), 'utf8') }
  }
  const HEADER = '﻿code,member,status,kind,uses,batch,valid_from,valid_until,created'

  await page.goto(`${BASE}/campaigns/WKND20/coupons`)
  await waitShown('Showing 6 of 6 codes')
  check('124: Import CSV, Export and Create coupons are offered', (await page.locator('[data-coupons-import-open]').isEnabled()) && (await page.locator('[data-coupons-create-open]').isEnabled()))
  check('124: Export says how many codes it writes', (await page.locator('[data-coupons-export]').innerText()).replace(/[⁦-⁩]/g, '') === 'Export 6 codes', await page.locator('[data-coupons-export]').innerText())

  const all = await download('[data-coupons-export]')
  const lines = all.text.split('\r\n')
  check('125: Export writes WKND20-coupons.csv', all.name === 'WKND20-coupons.csv', all.name)
  check('125: a BOM and the import’s own header', lines[0] === HEADER, JSON.stringify(lines[0]))
  check('125: a line a code, CRLF, ending in one', lines.length === 8 && lines[7] === '', String(lines.length))
  check('125: a code’s machine values, its days local', lines.includes('WKND-FLYER,,used,universal,12,u7d2w4pe,2026-10-01,2026-10-31,2026-10-01T09:00:00'), lines.join(' | '))
  check('125: no bidi isolate anywhere in the file', !/[⁦-⁩‎‏]/.test(all.text))

  await page.locator('[data-coupons-status]').selectOption('used')
  await waitShown('Showing 2 of 6 codes')
  check('126: with a filter, Export says it writes the shown codes', (await page.locator('[data-coupons-export]').innerText()).replace(/[⁦-⁩]/g, '') === 'Export 2 shown codes', await page.locator('[data-coupons-export]').innerText())
  const used = await download('[data-coupons-export]')
  const usedCodes = used.text.split('\r\n').slice(1, -1).map((l) => l.split(',')[0])
  check('126: …and writes the filtered list only', JSON.stringify(usedCodes.sort()) === '["WKND-9XH3PL","WKND-FLYER"]', JSON.stringify(usedCodes))
  await page.locator('[data-coupons-clear]').click()
  await waitShown('Showing 6 of 6 codes')

  // 127: a chosen file, one bad row.
  await page.locator('[data-coupons-import-open]').click()
  await dialog.waitFor({ timeout: 5000 })
  check('127: Import stays off until rows are checked', await page.locator('[data-coupons-import-submit]').isDisabled())
  await page.setInputFiles('[data-coupons-import-file]', {
    name: 'wknd-print.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('code,member\r\nwknd-imp001,\r\nWKND-IMP002,M-100231\r\nWKND IMP3,\r\nWKND-IMP004,M-055410\r\n'),
  })
  const tally = dialog.locator('[data-coupons-import-tally]')
  await tally.waitFor({ timeout: 10000 })
  check('127: the file is checked at once', (await tally.innerText()) === '4 rows: 3 ready, 1 rejected.', await tally.innerText())
  check('127: the file fills the text box', (await dialog.locator('[data-coupons-import-text]').inputValue()).startsWith('code,member'))
  await verdict(4).waitFor({ timeout: 5000 })
  check('127: the bad row is shown with its reason', (await verdict(4).getAttribute('data-coupons-import-row')) === 'badCode' && (await verdict(4).innerText()).startsWith('Bad characters'), await verdict(4).innerText())
  check('127: the good rows read Ready', (await verdict(2).getAttribute('data-coupons-import-row')) === 'ok' && (await verdict(3).getAttribute('data-coupons-import-row')) === 'ok')
  check(
    '127: HQ’s check was sent the good rows only',
    importChecks.length === 1 && JSON.stringify(importChecks[0].body) === JSON.stringify({ rows: [{ code: 'WKND-IMP001', member: null }, { code: 'WKND-IMP002', member: 'M-100231' }, { code: 'WKND-IMP004', member: 'M-055410' }] }),
    JSON.stringify(importChecks[0]?.body),
  )
  check('127: Import counts the good rows', (await page.locator('[data-coupons-import-submit]').innerText()).replace(/[⁦-⁩]/g, '') === 'Import 3 codes')
  await page.screenshot({ path: `${SHOTS}/coupons-import.png` })
  await page.locator('[data-coupons-import-submit]').click()
  const created = page.locator('[data-coupons-created]')
  await created.waitFor({ timeout: 5000 })
  check(
    '127: Import sends exactly the good rows, upper-cased, once',
    imports.length === 1 && JSON.stringify(imports[0].body) === JSON.stringify({ rows: [{ code: 'WKND-IMP001', member: null }, { code: 'WKND-IMP002', member: 'M-100231' }, { code: 'WKND-IMP004', member: 'M-055410' }] }),
    JSON.stringify(imports[0]?.body),
  )
  const impBatch = await created.getAttribute('data-coupons-created')
  check('128: the modal says Coupons imported, with HQ’s batch id', /^im\d{6}$/.test(impBatch) && (await page.locator('dialog[open] #modal-title').innerText()).includes('Coupons imported') && (await created.locator('[data-batch-id]').innerText()) === impBatch, impBatch)
  check('128: …the count and the row left out', (await created.innerText()).includes('identifies the 3 codes you just imported') && (await created.locator('[data-coupons-created-left-out]').innerText()) === '1 rejected row was left out.')
  check('128: the import dialog is closed', (await dialog.count()) === 0)
  const one = await download('[data-coupons-created-export]')
  const oneCodes = one.text.split('\r\n').slice(1, -1).map((l) => l.split(',').slice(0, 2).join(','))
  check('128: Export the codes writes that batch alone', one.name === `WKND20-${impBatch}.csv` && JSON.stringify(oneCodes.sort()) === '["WKND-IMP001,","WKND-IMP002,M-100231","WKND-IMP004,M-055410"]', `${one.name} ${JSON.stringify(oneCodes)}`)
  await page.screenshot({ path: `${SHOTS}/coupons-imported.png` })
  await page.locator('[data-coupons-created-show]').click()
  await waitShown('Showing 3 of 9 codes')
  await page.waitForFunction((sel) => document.querySelectorAll(`${sel} .ag-cell[col-id="kind"]`).length === 3, cgrid, { timeout: 5000 }).catch(() => {})
  check('128: Show the codes lists the imported batch', (await shown()) === 'Showing 3 of 9 codes' && page.url().endsWith(`?batch=${impBatch}`), `${await shown()} ${page.url()}`)
  check('128: …each code Imported, bound to its member', (await ccell('WKND-IMP002', 'kind')) === 'Imported' && (await ccell('WKND-IMP002', 'member')) === 'M-100231' && (await ccell('WKND-IMP001', 'member')) === 'Anyone')

  // 129: pasted rows, every reason.
  await page.locator('[data-coupons-batch-clear]').click()
  await waitShown('Showing 9 of 9 codes')
  await page.locator('[data-coupons-import-open]').click()
  await dialog.waitFor({ timeout: 5000 })
  const pasted = ['code;member', ';M-100231', 'WKND-NEW1;', 'wknd new2;', 'WKND-new1;', 'WKND-4F7K2Q;', 'hayak15;', 'WKND-NEW3;M-999999', 'WKND-NEW4;M-200118'].join('\n')
  await dialog.locator('[data-coupons-import-text]').fill(pasted)
  check('129: pasted rows wait for Check the rows', (await tally.count()) === 0 && (await page.locator('[data-coupons-import-submit]').isDisabled()))
  await dialog.locator('[data-coupons-import-check]').click()
  await tally.waitFor({ timeout: 10000 })
  check('129: the tally', (await tally.innerText()) === '8 rows: 2 ready, 6 rejected.', await tally.innerText())
  await verdict(9).waitFor({ timeout: 5000 })
  const reasons = []
  for (let line = 2; line <= 9; line++) reasons.push(await verdict(line).getAttribute('data-coupons-import-row'))
  check('129: each row with its reason (missing, ok, bad characters, repeat, taken, in use, unknown member, ok)', JSON.stringify(reasons) === JSON.stringify(['noCode', 'ok', 'badCode', 'repeated', 'taken', 'inUse', 'unknownMember', 'ok']), JSON.stringify(reasons))
  check('129: HQ’s reasons read as words', (await verdict(7).innerText()) === 'Already a code in SIS.Coupons' && (await verdict(8).innerText()) === 'No member has this id')
  check('129: HQ was asked about the rows good on this side only', importChecks.length === 2 && importChecks[1].body.rows.length === 4, JSON.stringify(importChecks[1]?.body))
  await page.screenshot({ path: `${SHOTS}/coupons-import-reasons.png` })
  await dialog.locator('[data-coupons-import-text]').fill(pasted + '\nWKND-NEW5;')
  check('129: an edit makes the check stale', (await tally.count()) === 0 && (await page.locator('[data-coupons-import-submit]').isDisabled()))
  await page.locator('dialog[open] button', { hasText: 'Cancel' }).click()
  check('129: Cancel imports nothing', (await dialog.count()) === 0 && imports.length === 1)

  // 130: a dropped file.
  await page.locator('[data-coupons-import-open]').click()
  await dialog.waitFor({ timeout: 5000 })
  const dt = await page.evaluateHandle(() => {
    const d = new DataTransfer()
    d.items.add(new File(['WKND-DROP1\nWKND-DROP2,M-100231\n'], 'dropped.csv', { type: 'text/csv' }))
    return d
  })
  await page.dispatchEvent('[data-coupons-import-drop]', 'drop', { dataTransfer: dt })
  await tally.waitFor({ timeout: 10000 })
  check('130: a dropped file is read and checked, no header read by position', (await tally.innerText()) === '2 rows: 2 ready, 0 rejected.' && importChecks.length === 3, await tally.innerText())
  await page.locator('dialog[open] button', { hasText: 'Cancel' }).click()
  check('134: no page errors (124–130)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 131 ──
{
  const { context, page, errors, importChecks } = await open({ refuseImportCheck: 1 })
  await page.goto(`${BASE}/campaigns/WKND20/coupons`)
  await page.locator('[data-coupons-shown]').waitFor({ timeout: 20000 })
  await page.locator('[data-coupons-import-open]').click()
  const dialog = page.locator('[data-coupons-import]')
  await dialog.locator('[data-coupons-import-text]').fill('WKND-R1\nWKND-R2')
  await dialog.locator('[data-coupons-import-check]').click()
  const refusal = dialog.locator('[data-coupons-import-check-refusal]')
  await refusal.waitFor({ timeout: 10000 })
  check('131: a refused check shows its message and code', (await refusal.innerText()).includes(IMPORT_CHECK_REFUSED) && (await refusal.locator('[data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_COUPONS_UNAVAILABLE')
  check('131: …and Import stays off', await page.locator('[data-coupons-import-submit]').isDisabled())
  await dialog.locator('[data-coupons-import-check]').click()
  await dialog.locator('[data-coupons-import-tally]').waitFor({ timeout: 10000 })
  check('131: checking again goes through', importChecks.length === 2 && (await refusal.count()) === 0 && (await page.locator('[data-coupons-import-submit]').isEnabled()))
  check('134: no page errors (131)', errors.length === 0, errors.join(' | '))
  await context.close()
}

// ── 132, 133 ──
{
  const { context, page, errors, deletes, calls } = await open({ refuseDelete: 1 })
  const cgrid = '[data-coupons-grid]'
  const waitShown = (text) =>
    page.waitForFunction((t) => document.querySelector('[data-coupons-shown]')?.textContent === t, text, { timeout: 20000 }).catch(() => {})
  await page.goto(`${BASE}/campaigns/WKND20/coupons?batch=k3m9q2xa`)
  await waitShown('Showing 5 of 6 codes')
  const del = page.locator('[data-coupons-delete-open]')
  check('132: with a batch filtered, Delete unused is offered', await del.isEnabled())
  await del.click()
  const confirm = page.locator('[data-coupons-delete]')
  await confirm.waitFor({ timeout: 5000 })
  const plain = async (sel) => (await confirm.locator(sel).innerText()).replace(/[⁦-⁩]/g, '')
  check('132: the confirmation says the unused codes that go', (await plain('[data-coupons-delete-unused]')) === 'Delete the 2 unused codes of batch k3m9q2xa? They stop working at once.', await plain('[data-coupons-delete-unused]'))
  check('132: …and the codes that stay, by status', (await plain('[data-coupons-delete-stay]')) === '3 codes stay for the history: 1 used, 1 disabled, 1 expired.', await plain('[data-coupons-delete-stay]'))
  await page.screenshot({ path: `${SHOTS}/coupons-delete-unused.png` })
  await page.locator('[data-coupons-delete-confirm]').click()
  const refusal = confirm.locator('[data-coupons-delete-refusal]')
  await refusal.waitFor({ timeout: 5000 })
  const reads = calls.filter((x) => x === 'GET RuleCampaign/Campaigns/WKND20/Coupons').length
  check('133: a refused delete shows its message and code', (await refusal.innerText()).includes(DELETE_REFUSED) && (await refusal.locator('[data-refusal-code]').getAttribute('data-refusal-code')) === 'RULE_COUPONS_UNAVAILABLE')
  check('133: …and the codes are unchanged', (await page.locator('[data-coupons-shown]').innerText()) === 'Showing 5 of 6 codes' && deletes.length === 1)
  await page.locator('[data-coupons-delete-confirm]').click()
  const done = page.locator('[data-coupons-deleted]')
  await done.waitFor({ timeout: 5000 })
  check('133: confirming again goes through', deletes.length === 2)
  check('132: ONE delete per confirmation, for the batch', deletes.every((d) => d.id === 'WKND20' && d.batch === 'k3m9q2xa'), JSON.stringify(deletes))
  check('132: the page says what HQ did', (await done.innerText()).replace(/[⁦-⁩]/g, '') === '2 unused codes of batch k3m9q2xa were deleted; 3 stay.', await done.innerText())
  await waitShown('Showing 3 of 4 codes')
  check('132: the codes are read afresh', calls.filter((x) => x === 'GET RuleCampaign/Campaigns/WKND20/Coupons').length === reads + 1)
  await page.waitForFunction((sel) => !document.querySelector(`${sel} .ag-row[row-id="WKND-4F7K2Q"]`), cgrid, { timeout: 5000 }).catch(() => {})
  const left = await page.locator(`${cgrid} .ag-row`).evaluateAll((rows) => [...new Set(rows.map((r) => r.getAttribute('row-id')))].sort())
  check('132: the used, disabled and expired codes stay listed', JSON.stringify(left) === '["WKND-9XH3PL","WKND-B3N6QW","WKND-P5R8ZD"]', JSON.stringify(left))
  check('132: a batch with no unused code cannot be asked', await del.isDisabled())
  await page.screenshot({ path: `${SHOTS}/coupons-deleted.png` })
  check('134: no page errors (132, 133)', errors.length === 0, errors.join(' | '))
  await context.close()
}

await browser.close()
const failed = results.filter((r) => !r.pass)
console.log(`\n${results.length - failed.length}/${results.length} passed`)
process.exit(failed.length ? 1 : 0)
