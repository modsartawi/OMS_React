/**
 * The Open tab's filters (ticket 545; BackOffice 3015): as the URL holds them and as the door is
 * asked. Pure, pinned by `open-filter.test.ts`.
 *
 * - `GET PrescriptionSessionWeb/Sessions?store&state&owner&source&minAgeDays&maxAgeDays&flag` — every
 *   filter optional, together they AND. The store matches the holding store OR the second store.
 * - The **Owed** saved view (`view=owed`) asks `…/Sessions/Owed?store` instead: Dispensed, not
 *   invoiced. It takes the store and nothing else, so its address keeps only the store.
 *
 * 🔑 The URL is the single source of truth (`useUrlQuery`). The tab key is the page's (`./tab`):
 * the Open tab is the default and writes none, so these params never collide with another tab's.
 */
import {
  PRESCRIPTION_HQ_FLAGS,
  PRESCRIPTION_SESSION_STATES,
  PRESCRIPTION_SOURCE_KINDS,
  PRESCRIPTION_STEP_OWNERS,
  type PrescriptionHqFlag,
} from '@/core/prescription-session/words'

/** The states a session is still OPEN in — the list's (an ended one is the Ended tab's, 547). */
export const OPEN_STATES = PRESCRIPTION_SESSION_STATES.slice(0, PRESCRIPTION_SESSION_STATES.indexOf('DISPENSED') + 1)

export interface OpenFilter {
  /** `all` is the list; `owed` is the saved view on `Sessions/Owed`. */
  view: 'all' | 'owed'
  /** A store code, matched against the holding store OR the other store; `''` for every store. */
  store: string
  /** One of `OPEN_STATES`, or `''`. */
  state: string
  /** One of the step owners, or `''`. */
  owner: string
  /** `NPHS | WSFT`, or `''`. */
  source: string
  /** Age in whole days, at least / at most; `''` leaves that end open. Strings, as the inputs hold them. */
  minAge: string
  maxAge: string
  /** The one chip pressed, or `''`. */
  flag: PrescriptionHqFlag | ''
}

export const DEFAULT_OPEN_FILTER: OpenFilter = {
  view: 'all',
  store: '',
  state: '',
  owner: '',
  source: '',
  minAge: '',
  maxAge: '',
  flag: '',
}

const SESSIONS = 'PrescriptionSessionWeb/Sessions'
const OWED = 'PrescriptionSessionWeb/Sessions/Owed'

/** The value when it is one of `list`, else `''`. */
function oneOf<T extends string>(list: readonly T[], value: string | null): T | '' {
  const v = (value ?? '').trim()
  return (list as readonly string[]).includes(v) ? (v as T) : ''
}

/** A whole, non-negative day count as written, else `''`. */
function days(value: string | null): string {
  const v = (value ?? '').trim()
  return /^\d{1,4}$/.test(v) ? String(Number(v)) : ''
}

/** The filter a URL describes. Anything unreadable reads as no filter. */
export function openFilterFromParams(params: URLSearchParams): OpenFilter {
  const store = (params.get('store') ?? '').trim()
  if (params.get('view') === 'owed') return { ...DEFAULT_OPEN_FILTER, view: 'owed', store }
  return {
    view: 'all',
    store,
    state: oneOf(OPEN_STATES, params.get('state')),
    owner: oneOf(PRESCRIPTION_STEP_OWNERS, params.get('owner')),
    source: oneOf(PRESCRIPTION_SOURCE_KINDS, params.get('source')),
    minAge: days(params.get('minAge')),
    maxAge: days(params.get('maxAge')),
    flag: oneOf(PRESCRIPTION_HQ_FLAGS, params.get('flag')),
  }
}

/** The filter as its URL, in a fixed order; empty values are left out. */
export function openFilterToParams(f: OpenFilter): URLSearchParams {
  const qs = new URLSearchParams()
  const put = (key: string, value: string) => {
    if (value.trim()) qs.set(key, value.trim())
  }
  if (f.view === 'owed') {
    qs.set('view', 'owed')
    put('store', f.store)
    return qs
  }
  put('store', f.store)
  put('state', f.state)
  put('owner', f.owner)
  put('source', f.source)
  put('minAge', f.minAge)
  put('maxAge', f.maxAge)
  put('flag', f.flag)
  return qs
}

export interface OpenRequest {
  path: typeof SESSIONS | typeof OWED
  params: Record<string, string | number>
}

/** The door and its parameters, named as SIS.Api binds them. */
export function openRequest(f: OpenFilter): OpenRequest {
  const params: Record<string, string | number> = {}
  const put = (key: string, value: string) => {
    if (value.trim()) params[key] = value.trim()
  }
  const putDays = (key: string, value: string) => {
    if (value.trim() !== '' && Number.isInteger(Number(value))) params[key] = Number(value)
  }
  put('store', f.store)
  if (f.view === 'owed') return { path: OWED, params }
  put('state', f.state)
  put('owner', f.owner)
  put('source', f.source)
  putDays('minAgeDays', f.minAge)
  putDays('maxAgeDays', f.maxAge)
  put('flag', f.flag)
  return { path: SESSIONS, params }
}

/**
 * A flag chip pressed: it sets `flag` (one at a time), pressed again it clears it. The Owed view's
 * door takes no flag, so there a chip changes nothing.
 */
export function withFlag(f: OpenFilter, flag: PrescriptionHqFlag): OpenFilter {
  if (f.view === 'owed') return f
  return { ...f, flag: f.flag === flag ? '' : flag }
}
