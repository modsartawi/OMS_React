// Stubs for oms ticket 708 (BackOffice doors 3295, 3296, 3297), on the real envelope, as built (oms 711). Never a live SIS.Api.
// The labels-only re-pin doors are `Repin/Labels/*`: a change is seeded in two rulesets, one with the draft the door raised
// itself and one with no draft yet.
import { envelope } from './insurance-rules-stubs.mjs'

export const SYSTEM_RULE = 'G-002'
const TEXTS = [
  { ruleId: SYSTEM_RULE, before: { en: 'Dental (12) needs a pre-authorisation', ar: 'الأسنان (12) تحتاج إلى موافقة مسبقة' }, after: { en: 'Dental care (12) needs a pre-authorisation', ar: 'عناية الأسنان (12) تحتاج إلى موافقة مسبقة' } },
  { ruleId: 'G-005', before: { en: 'Home nursing (81) is not covered', ar: '' }, after: { en: 'Home nursing (81) is not covered', ar: 'التمريض المنزلي (81) غير مشمول' } },
  { ruleId: 'G-009', before: { en: 'Unmoved (7)', ar: 'لم يتغير (7)' }, after: { en: 'Unmoved (7)', ar: 'لم يتغير (7)' } },
]

const AFFECTED = [
  { changeId: 'CH-LABELS-G', kind: 'labels', rulesetId: 'guard', rulesetName: 'Guards', rulesetVersion: 7, subject: 'benefit-category · 12', before: '14', after: '15', draftId: 'D-L1' },
  { changeId: 'CH-LABELS-M', kind: 'labels', rulesetId: 'monitor', rulesetName: 'Monitors', rulesetVersion: 3, subject: 'benefit-category · 81', before: '14', after: '15', draftId: null },
]

const textsOf = () => ({ texts: TEXTS.map(({ ruleId, before, after }) => ({ ruleId, enBefore: before.en, enAfter: after.en, arBefore: before.ar, arAfter: after.ar })) })

const draftOf = (row, id, requestedBy, requestedAt) => ({
  id,
  kind: row.rulesetId,
  baseVersionNo: row.rulesetVersion,
  state: 'pending',
  requestedBy,
  requestedAt,
  decidedBy: '',
  decidedAt: '0001-01-01T00:00:00',
  labelsOnly: true,
  labelVersionNo: Number(row.after),
  changes: [],
  labelChanges: textsOf(),
  backtest: null,
})

export function newLabelRepinStore() {
  return { nextDraft: 2, drafts: [draftOf(AFFECTED[0], 'D-L1', 'nalharbi', '2026-10-30T08:00:00')], done: [], writes: [] }
}

export function labelRepinStub(method, path, body, { store, user, now = '2026-10-30T11:00:00' }) {
  const openOf = (kind) => store.drafts.find((d) => d.kind === kind && d.state === 'pending')?.id ?? null
  const live = () => AFFECTED.filter((r) => !store.done.includes(r.rulesetId))

  if (path === 'InsuranceRules/Repin/Labels/Affected' && method === 'GET')
    return envelope(live().map((r) => ({ kind: r.rulesetId, versionNo: r.rulesetVersion, labelVersionNo: Number(r.before), latestLabelVersionNo: Number(r.after), pendingDraftId: openOf(r.rulesetId) })))
  if (path === 'InsuranceRules/Repin/Affected' && method === 'GET') return envelope([])
  if (path === 'InsuranceRules/Repin/Drafts' && method === 'GET') return envelope(store.drafts.filter((d) => d.state === 'pending'))
  if (path === 'InsuranceRules/Repin/Labels/Drafts' && method === 'POST') {
    store.writes.push({ path, body, user })
    const row = live().find((r) => r.rulesetId === body.kind)
    if (!row) return envelope(null, { status: 404, success: false, message: 'That ruleset is not on the old form.', errorCode: 'INSREPIN_NOT_FOUND' })
    const draft = draftOf(row, `D-L${store.nextDraft++}`, user, now)
    store.drafts.push(draft)
    return envelope(draft)
  }
  const one = /^InsuranceRules\/Repin\/Drafts\/([^/]+)\/Approve$/.exec(path)
  if (!one || method !== 'POST') return null
  const draft = store.drafts.find((d) => d.id === decodeURIComponent(one[1]))
  if (!draft) return envelope(null, { status: 404, success: false, message: 'No such draft.', errorCode: 'INSREPIN_NOT_FOUND' })
  store.writes.push({ path, body, user })
  if (draft.requestedBy?.toLowerCase() === user.toLowerCase())
    return envelope(null, { status: 409, success: false, message: 'Someone other than the author must approve a re-pin draft.', errorCode: 'INSREPIN_SELF_APPROVAL' })
  Object.assign(draft, { state: 'approved', decidedBy: user, decidedAt: now })
  store.done.push(draft.kind)
  return envelope({ versionNo: draft.baseVersionNo + 1 })
}

const wireItem = (o) => ({ at: '2026-10-30T09:00:00', store: '', pharmacist: '', ruleId: null, item: null, patient: null, reason: null, note: null, exceptionId: null, mark: null, ...o })

/** The items for `createReviewItemStubs`: one upload-due each way, one closed, a package and an empty one. */
export const REVIEW_ITEMS_708 = [
  wireItem({ id: 'D-1', kind: 'upload-due', at: '2026-10-30T09:30:00', uploadDue: { packageVersion: '5.1.0', codeCount: 0, codes: [], isOpen: true, closedByVersion: 0 } }),
  wireItem({ id: 'D-2', kind: 'upload-due', at: '2026-10-30T09:20:00', uploadDue: { packageVersion: '', codeCount: 7, codes: [{ system: 'benefit-category', code: '99' }], isOpen: true, closedByVersion: 0 } }),
  wireItem({ id: 'D-3', kind: 'upload-due', at: '2026-10-30T09:15:00', uploadDue: { packageVersion: '5.0.9', codeCount: 0, codes: [], isOpen: false, closedByVersion: 4 } }),
  wireItem({
    id: 'P-1',
    kind: 'ig-package',
    at: '2026-10-30T09:10:00',
    igPackage: {
      name: 'nphies.fhir',
      version: '5.1.0',
      diff: {
        profiles: { added: ['http://nphies.sa/StructureDefinition/claim-new'], removed: ['http://nphies.sa/StructureDefinition/claim-old'], renamed: [] },
        extensions: { added: [], removed: [], renamed: [{ from: 'http://nphies.sa/extension/copay', to: 'http://nphies.sa/extension/coPay' }] },
        codeSystems: { added: [], removed: [], renamed: [] },
      },
      revalidation: [{ key: 'copay', status: 'ok' }, { key: 'benefitAllowed', status: 'noMatches', why: 'No kept bundle answers it now.' }],
    },
  }),
  wireItem({ id: 'P-2', kind: 'ig-package', at: '2026-10-30T09:00:00', igPackage: { version: '5.0.1', diff: {}, revalidation: [] } }),
]
