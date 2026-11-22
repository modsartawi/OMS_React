import type { HybrisStockApprovalFilter, HybrisStockEnabledFilter, HybrisStockMaterialsQuery } from '@/core/models/hybris-stock'

// The materials page's URL ⇄ query ⇄ door mapping (ticket 848). Pure.

export const MATERIALS_PAGE_SIZE = 50

export const ENABLED_FILTERS: readonly HybrisStockEnabledFilter[] = ['any', 'enabled', 'disabled']

/** Hybris's approval (BackOffice 4180). */
export const APPROVAL_FILTERS: readonly HybrisStockApprovalFilter[] = ['any', 'approved', 'unapproved', 'none']

/** `?q=&enabled=&approval=&page=` — an unknown `enabled` / `approval` reads `any`; `page` is a whole number ≥ 1. */
export function materialsFromParams(params: URLSearchParams): HybrisStockMaterialsQuery {
  const enabled = params.get('enabled')
  const approval = params.get('approval')
  const page = Number(params.get('page'))
  return {
    q: params.get('q')?.trim() || null,
    enabled: ENABLED_FILTERS.includes(enabled as HybrisStockEnabledFilter) ? (enabled as HybrisStockEnabledFilter) : 'any',
    approval: APPROVAL_FILTERS.includes(approval as HybrisStockApprovalFilter) ? (approval as HybrisStockApprovalFilter) : 'any',
    page: Number.isInteger(page) && page > 1 ? page : 1,
  }
}

export function materialsToParams(query: HybrisStockMaterialsQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (query.q) out.set('q', query.q)
  if (query.enabled !== 'any') out.set('enabled', query.enabled)
  if (query.approval !== 'any') out.set('approval', query.approval)
  if (query.page > 1) out.set('page', String(query.page))
  return out
}

/** What the door is sent: `any` left off, the page as `skip` / `take`. */
export function materialsDoorParams(query: HybrisStockMaterialsQuery) {
  return {
    q: query.q,
    enabled: query.enabled === 'any' ? null : query.enabled,
    approval: query.approval === 'any' ? null : query.approval,
    skip: (query.page - 1) * MATERIALS_PAGE_SIZE,
    take: MATERIALS_PAGE_SIZE,
  }
}

export { MATERIAL_NUMBER } from '@/core/models/hybris-stock'
