// The Review list's address (ticket 614): `?kind=&pharmacist=&store=&rule=&reason=`, each optional. Module-level
// and pure, as `useUrlQuery` needs. An empty `kind` is every kind.
import { REVIEW_KINDS, type ReviewKind } from './model'

export interface ReviewQuery {
  kind: ReviewKind | ''
  pharmacist: string
  store: string
  rule: string
  reason: string
}

export const EMPTY_REVIEW_QUERY: ReviewQuery = { kind: '', pharmacist: '', store: '', rule: '', reason: '' }

export function reviewFromParams(p: URLSearchParams): ReviewQuery {
  const kind = p.get('kind') ?? ''
  return {
    kind: (REVIEW_KINDS as readonly string[]).includes(kind) ? (kind as ReviewKind) : '',
    pharmacist: p.get('pharmacist')?.trim() ?? '',
    store: p.get('store')?.trim() ?? '',
    rule: p.get('rule')?.trim() ?? '',
    reason: p.get('reason')?.trim() ?? '',
  }
}

export function reviewToParams(q: ReviewQuery): URLSearchParams {
  const out = new URLSearchParams()
  for (const key of ['kind', 'pharmacist', 'store', 'rule', 'reason'] as const) if (q[key].trim()) out.set(key, q[key].trim())
  return out
}
