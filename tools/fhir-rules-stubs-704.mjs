// Stub of BackOffice door 3294's alias table for oms 704, on the real envelope. Rows in the store keep the screen's
// words; `wire` sends them as the door does (oms 711). Never a live SIS.Api. 705 extends this store.
import { BUPA, MEDGULF, TAWUNIYA, envelope } from './insurance-rules-stubs.mjs'

export { BUPA, MEDGULF, TAWUNIYA }

/** TAKAFUL's shape: the misspelled UCUM system the ticket names. */
export const TAKAFUL_WRONG = 'http://unitsofmeasure.org/ucum'
export const UCUM = 'http://unitsofmeasure.org'

export function newAliasStore() {
  return {
    next: 2,
    writes: [],
    rows: [
      {
        id: 'A-1',
        payer: TAWUNIYA,
        wrongUrl: 'http://nphies.sa/terminology/CodeSystem/benefit-categry',
        canonicalUrl: 'http://nphies.sa/terminology/CodeSystem/benefit-category',
        state: 'approved',
        proposedBy: 'nalharbi',
        proposedAt: '2026-10-20T09:00:00',
        approvedBy: 'falotaibi',
        approvedAt: '2026-10-21T11:15:00',
      },
    ],
  }
}

const wire = ({ state, proposedBy, approvedBy, approvedAt, ...r }) => ({ ...r, status: state, author: proposedBy, decidedBy: approvedBy ?? '', decidedAt: approvedAt ?? '0001-01-01T00:00:00' })

/** The same (payer, wrong URL) twice, or an own approval, is HQ's to refuse. `deny` answers a bare 403 for those doors. */
export function aliasesStub(method, path, body, { store, user, now = '2026-10-30T10:30:00', deny = [] }) {
  if (!path.startsWith('InsuranceRules/Aliases')) return null
  if (deny.includes(`${method} ${path}`) || deny.includes('*')) return { status: 403, body: '' }

  if (path === 'InsuranceRules/Aliases' && method === 'GET') return envelope(store.rows.map(wire))

  if (path === 'InsuranceRules/Aliases' && method === 'POST') {
    store.writes.push({ path, body, user })
    if (store.rows.some((r) => r.payer === body.payer && r.wrongUrl === body.wrongUrl))
      return envelope(null, { status: 409, success: false, message: 'This payer already has an alias for that URL.', errorCode: 'INSALIAS_EXISTS' })
    const row = { id: `A-${store.next++}`, ...body, state: 'proposed', proposedBy: user, proposedAt: now, approvedBy: null, approvedAt: null }
    store.rows.push(row)
    return envelope(wire(row))
  }

  const approve = /^InsuranceRules\/Aliases\/([^/]+)\/Approve$/.exec(path)
  if (approve && method === 'POST') {
    store.writes.push({ path, body, user })
    const row = store.rows.find((r) => r.id === decodeURIComponent(approve[1]))
    if (!row) return envelope(null, { status: 404, success: false, message: 'No such alias.', errorCode: 'INSALIAS_NOT_FOUND' })
    if (row.proposedBy?.toLowerCase() === user.toLowerCase())
      return envelope(null, { status: 409, success: false, message: 'Someone other than the author must approve an alias.', errorCode: 'INSALIAS_SELF_APPROVAL' })
    Object.assign(row, { state: 'approved', approvedBy: user, approvedAt: now })
    return envelope(wire(row))
  }
  return null
}
