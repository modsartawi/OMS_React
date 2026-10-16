import type { RuleMemberKey } from '@/core/models/rule-campaign'

// Customers' URL (ticket 519): the member looked up lives in the address — `?loyaltyId=` or
// `?mobile=`, replaced — so a reload, a pasted link or the coupon finder's member link lands on
// them. Pure: no React, no i18n.

export const MEMBER_KEYS: readonly RuleMemberKey[] = ['loyaltyId', 'mobile']

/** The look-up as the address holds it: '' = none asked. */
export interface MemberQuery {
  by: RuleMemberKey
  value: string
}

/** A loyalty id wins when both are present: it names one member, a mobile may name several. */
export function memberQueryFromParams(params: URLSearchParams): MemberQuery {
  const id = (params.get('loyaltyId') ?? '').trim()
  if (id) return { by: 'loyaltyId', value: id }
  const mobile = (params.get('mobile') ?? '').trim()
  if (mobile) return { by: 'mobile', value: mobile }
  return { by: params.has('mobile') ? 'mobile' : 'loyaltyId', value: '' }
}

export function memberQueryToParams(q: MemberQuery): URLSearchParams {
  const out = new URLSearchParams()
  const value = q.value.trim()
  if (value) out.set(q.by, value)
  return out
}
