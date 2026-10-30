// Stubs for oms ticket 708 (BackOffice doors 3295, 3296, 3297, all unbuilt; shapes guessed, 711 reconciles), on the real
// envelope. Never a live SIS.Api. The labels-only re-pin door is 705's, with `kind: 'labels'`, no back-test and `texts`:
// here a change is seeded in two rulesets, one with the draft the door raised itself and one with no draft yet.
import { envelope } from './insurance-rules-stubs.mjs'

export const SYSTEM_RULE = 'G-002'
const TEXTS = [
  { ruleId: SYSTEM_RULE, before: { en: 'Dental (12) needs a pre-authorisation', ar: 'الأسنان (12) تحتاج إلى موافقة مسبقة' }, after: { en: 'Dental care (12) needs a pre-authorisation', ar: 'عناية الأسنان (12) تحتاج إلى موافقة مسبقة' } },
  { ruleId: 'G-005', before: { en: 'Home nursing (81) is not covered', ar: '' }, after: { en: 'Home nursing (81) is not covered', ar: 'التمريض المنزلي (81) غير مشمول' } },
  { ruleId: 'G-009', before: { en: 'Unmoved (7)', ar: 'لم يتغير (7)' }, after: { en: 'Unmoved (7)', ar: 'لم يتغير (7)' } },
]

const AFFECTED = [
  { changeId: 'CH-LABELS-G', kind: 'labels', rulesetId: 'guards', rulesetName: 'Guards', rulesetVersion: 7, subject: 'benefit-category · 12', before: '14', after: '15', draftId: 'D-L1' },
  { changeId: 'CH-LABELS-M', kind: 'labels', rulesetId: 'monitors', rulesetName: 'Monitors', rulesetVersion: 3, subject: 'benefit-category · 81', before: '14', after: '15', draftId: null },
]

const draftOf = (row, id, createdBy, createdAt) => {
  const { draftId: _open, ...rest } = row
  return { id, ...rest, state: 'open', createdBy, createdAt, approvedBy: null, approvedAt: null, backtest: null, texts: TEXTS }
}

export function newLabelRepinStore() {
  return { nextDraft: 2, drafts: [draftOf(AFFECTED[0], 'D-L1', 'nalharbi', '2026-10-30T08:00:00')], done: [], writes: [] }
}

export function labelRepinStub(method, path, body, { store, user, now = '2026-10-30T11:00:00' }) {
  if (!path.startsWith('InsuranceRules/RepinDrafts')) return null
  const affected = () =>
    AFFECTED.filter((r) => !store.done.includes(r.changeId)).map((r) => ({ ...r, draftId: store.drafts.find((d) => d.changeId === r.changeId && d.state === 'open')?.id ?? null }))

  if (path === 'InsuranceRules/RepinDrafts/Affected' && method === 'GET') return envelope(affected())
  if (path === 'InsuranceRules/RepinDrafts' && method === 'POST') {
    store.writes.push({ path, body, user })
    const row = affected().find((r) => r.changeId === body.changeId && r.rulesetId === body.rulesetId)
    if (!row) return envelope(null, { status: 404, success: false, message: 'That ruleset is not on the old form.', errorCode: 'INSREPIN_NOT_FOUND' })
    const draft = draftOf(row, `D-L${store.nextDraft++}`, user, now)
    store.drafts.push(draft)
    return envelope(draft)
  }
  const one = /^InsuranceRules\/RepinDrafts\/([^/]+)(\/Approve)?$/.exec(path)
  if (!one) return null
  const draft = store.drafts.find((d) => d.id === decodeURIComponent(one[1]))
  if (!draft) return envelope(null, { status: 404, success: false, message: 'No such draft.', errorCode: 'INSREPIN_NOT_FOUND' })
  if (method === 'GET' && !one[2]) return envelope(draft)
  if (method === 'POST' && one[2]) {
    store.writes.push({ path, body, user })
    if (draft.createdBy?.toLowerCase() === user.toLowerCase())
      return envelope(null, { status: 409, success: false, message: 'Someone other than the author must approve a re-pin draft.', errorCode: 'INSREPIN_SELF_APPROVAL' })
    Object.assign(draft, { state: 'approved', approvedBy: user, approvedAt: now })
    store.done.push(draft.changeId)
    return envelope(draft)
  }
  return null
}

const wireItem = (o) => ({ at: '2026-10-30T09:00:00', store: '', pharmacist: '', ruleId: null, item: null, patient: null, reason: null, note: null, exceptionId: null, mark: null, cleared: null, ...o })

/** The items for `createReviewItemStubs`: one labels-changed each way, one upload-due each way, a package and an empty one. */
export const REVIEW_ITEMS_708 = [
  wireItem({ id: 'L-1', kind: 'labelsChanged', at: '2026-10-30T09:50:00', ruleset: { id: 'guards', name: 'Guards', version: 7 }, draftId: 'D-L1' }),
  wireItem({ id: 'L-2', kind: 'labelsChanged', at: '2026-10-30T09:40:00', ruleset: { id: 'monitors', name: 'Monitors', version: 3 }, draftId: null }),
  wireItem({ id: 'D-1', kind: 'uploadDue', at: '2026-10-30T09:30:00', due: { why: 'newPackage', version: '5.1.0', system: null, code: null } }),
  wireItem({ id: 'D-2', kind: 'uploadDue', at: '2026-10-30T09:20:00', due: { why: 'unlistedCode', version: null, system: 'benefit-category', code: '99' } }),
  wireItem({
    id: 'P-1',
    kind: 'package',
    at: '2026-10-30T09:10:00',
    package: {
      version: '5.1.0',
      previousVersion: '5.0.0',
      profiles: { added: ['http://nphies.sa/StructureDefinition/claim-new'], removed: ['http://nphies.sa/StructureDefinition/claim-old'], renamed: [] },
      extensions: { added: [], removed: [], renamed: [{ from: 'http://nphies.sa/extension/copay', to: 'http://nphies.sa/extension/coPay' }] },
      codeSystems: { added: [], removed: [], renamed: [] },
    },
  }),
  wireItem({ id: 'P-2', kind: 'package', at: '2026-10-30T09:00:00', package: { version: '5.0.1', previousVersion: '5.0.0' } }),
]
