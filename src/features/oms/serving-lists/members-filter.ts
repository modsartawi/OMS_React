/**
 * The Members tab's filters (oms ticket 568, BackOffice spec 3042): as the URL holds them and as the door
 * is asked — `GET ServingListWeb/Lists/{id}/Members?city=&enabled=&duty=`. Pure, pinned by
 * `members-filter.test.ts`.
 *
 * - `city` — free text; the door trims it and matches case-insensitively.
 * - `enabled` — any / enabled / disabled, the door's `true` / `false` / absent.
 * - `duty` — any / one of `SERVING_LIST_DUTY_STATES`. The door refuses anything else with `SVL-00009`, so an
 *   unlisted value in the URL reads as "any" and is never sent.
 *
 * Members is the detail page's default tab (`./tab`), so this address writes no `tab` key.
 */
import { SERVING_LIST_DUTY_STATES, type ServingListMembersFilter } from '@/core/models/serving-list'

export const MEMBER_DUTY_OPTIONS = SERVING_LIST_DUTY_STATES
export type MemberDutyOption = (typeof MEMBER_DUTY_OPTIONS)[number]

export const MEMBER_ENABLED_OPTIONS = ['enabled', 'disabled'] as const
export type MemberEnabledOption = (typeof MEMBER_ENABLED_OPTIONS)[number]

export interface MembersFilter {
  city: string
  enabled: MemberEnabledOption | ''
  duty: MemberDutyOption | ''
}

export const EMPTY_MEMBERS_FILTER: MembersFilter = { city: '', enabled: '', duty: '' }

/** The value when it is one of `list`, else `''`. Case-sensitive, as the URL is the screen's own. */
function oneOf<T extends string>(list: readonly T[], value: string | null): T | '' {
  const v = (value ?? '').trim()
  return (list as readonly string[]).includes(v) ? (v as T) : ''
}

export function membersFilterFromParams(params: URLSearchParams): MembersFilter {
  return {
    city: (params.get('city') ?? '').trim(),
    enabled: oneOf(MEMBER_ENABLED_OPTIONS, params.get('enabled')),
    duty: oneOf(MEMBER_DUTY_OPTIONS, params.get('duty')),
  }
}

export function membersFilterToParams(f: MembersFilter): URLSearchParams {
  const qs = new URLSearchParams()
  const city = f.city.trim()
  if (city) qs.set('city', city)
  const enabled = oneOf(MEMBER_ENABLED_OPTIONS, f.enabled)
  if (enabled) qs.set('enabled', enabled)
  const duty = oneOf(MEMBER_DUTY_OPTIONS, f.duty)
  if (duty) qs.set('duty', duty)
  return qs
}

/** The door's query. `api.get` drops `undefined`, so an unset filter is never sent. */
export function membersDoorFilter(f: MembersFilter): ServingListMembersFilter {
  const duty = oneOf(MEMBER_DUTY_OPTIONS, f.duty)
  return {
    city: f.city.trim() || undefined,
    enabled: f.enabled === 'enabled' ? true : f.enabled === 'disabled' ? false : undefined,
    duty: duty || undefined,
  }
}

export function isFilteredMembers(f: MembersFilter): boolean {
  return membersFilterToParams(f).toString() !== ''
}
