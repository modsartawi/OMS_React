// Stubs for oms ticket 706: the workbook upload and the load log (BackOffice 3295 + 3296, both unbuilt, shapes guessed;
// 711 reconciles). On the real envelope:
//   GET  InsuranceRules/Labels/Workbooks             → the past loads, newest first
//   POST InsuranceRules/Labels/Workbooks (multipart) → { load, diff, changeLog }, or a refusal the file's name picks
import { envelope } from './insurance-rules-stubs.mjs'

const hash = (c) => c.repeat(64)

const load = (id, workbook, version, fileName, c, uploadedBy, uploadedAt) => ({ id, workbook, version, fileName, fileHash: hash(c), uploadedBy, uploadedAt })

export const PAST_LOADS = [
  load('WB-2', 'validationRule', '2.1.0', 'Validation Rules v2.1.xlsx', 'b', 'falotaibi', '2026-09-20T09:30:00'),
  load('WB-1', 'codeableConcept', '3.0.0', 'Codeable Concept v3.0.xlsx', 'a', 'nalharbi', '2026-08-02T11:05:00'),
]

export const NEW_HASH = hash('c')
export const SYSTEM = 'http://nphies.sa/terminology/CodeSystem/benefit-category'

/** What each stubbed file answers. An Arabic label is the door's word, as sent. */
export const REPLIES = {
  'Codeable Concept v3.1.xlsx': {
    workbook: 'codeableConcept',
    version: '3.1.0',
    diff: [
      { system: SYSTEM, code: '12', change: 'changed', before: { en: 'Dental', ar: null }, after: { en: 'Dental care', ar: 'عناية الأسنان' } },
      { system: SYSTEM, code: '81', change: 'added', before: null, after: { en: 'Home nursing', ar: null } },
      { system: SYSTEM, code: '44', change: 'removed', before: { en: 'Optical (old)', ar: 'البصريات' }, after: null },
      { system: SYSTEM, code: '82', change: 'added', before: null, after: { en: 'Tele-consult', ar: 'استشارة عن بعد' } },
    ],
    changeLog: [
      { version: '3.1.0', date: '2026-10-15', system: SYSTEM, code: '81', change: 'Added Home nursing' },
      { version: '3.1.0', date: '2026-10-15', system: null, code: null, change: 'Reworded the dental family' },
    ],
  },
  'Profiles same labels.xlsx': { workbook: 'profiles', version: '1.4.0', diff: [], changeLog: [] },
}

export const REFUSALS = {
  'Codeable Concept v2.xlsx': { status: 409, success: false, message: 'Version 2.0.0 is older than the loaded version 3.0.0.', errorCode: 'WORKBOOK_OLDER_VERSION' },
  'Some other sheet.xlsx': { status: 400, success: false, message: 'This workbook has an unknown layout.', errorCode: 'WORKBOOK_UNKNOWN_LAYOUT' },
}

export const newLabelsState = () => ({ loads: PAST_LOADS.map((l) => ({ ...l })), next: 3 })

/** `opts`: `{ state, fileName, user, now, deny: string[] }`; `fileName` is what the multipart carried. */
export function labelsStub(method, path, opts = {}) {
  if (path !== 'InsuranceRules/Labels/Workbooks') return null
  const { state, fileName = '', user = 'msartawi', now = '2026-10-30T10:30:00', deny = [] } = opts
  if (method === 'GET') return deny.includes('loads') ? { status: 403, body: '' } : envelope(state.loads)
  if (method !== 'POST') return null
  if (deny.includes('upload')) return { status: 403, body: '' }
  const refusal = REFUSALS[fileName]
  if (refusal) return envelope(null, refusal)
  const reply = REPLIES[fileName]
  if (!reply) return envelope(null, REFUSALS['Some other sheet.xlsx'])
  const row = { id: `WB-${state.next++}`, workbook: reply.workbook, version: reply.version, fileName, fileHash: NEW_HASH, uploadedBy: user, uploadedAt: now }
  state.loads.unshift(row)
  return envelope({ load: row, diff: reply.diff, changeLog: reply.changeLog })
}
