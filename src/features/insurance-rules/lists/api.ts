/**
 * The Lists screen's own doors (BackOffice spec 3126; doors 3132 + 3133, oms ticket 610). The item lists live
 * IN the guard ruleset (they are versioned with it), so saving one is a PUT of the whole draft; the patient and
 * policy and class lists are their own doors (3133 / 3172), edited without approval, every change logged. The reads two features need
 * (the Fields, the patient / policy lists) are `@/core/insurance-rules/registry-api`.
 *
 * ⚠️ Stubbed until oms 618 (`tools/insurance-rules-stubs.mjs`, section 610): no door here has met a real SIS.Api.
 */
import { api } from '@/core/api'
import { INSURANCE_RULES_BASE } from '@/core/insurance-rules/api'
import type { GuardList, GuardRuleset } from '@/core/insurance-rules/model'
import type { KeyedList, KeyedListEntry, KeyedListKind, KeyedListLogRow } from '@/core/insurance-rules/registry'
import { keyedListsKey, keyedListsPath } from '@/core/insurance-rules/registry-api'
import type { EntryBody, NewListBody } from './entry-form'

/** One matched item of a preview. ⚠️ PROVISIONAL spelling (`article`, `name`). */
export interface PreviewItem {
  article: string
  name: string
}

/**
 * `POST InsuranceRules/Lists/Preview` → "matched items (count plus the first page) and the matches-nothing warning".
 * ⚠️ PROVISIONAL spelling (`count`, `items`, `matchesNothing`).
 */
export interface ListPreview {
  count: number
  items: PreviewItem[]
  matchesNothing: boolean
}

export const listsApi = {
  /**
   * `PUT InsuranceRules/Guards/Draft` — the WHOLE ruleset with the revision it was read at → the saved document
   * (its new revision). A stale revision is a 409. (608's editor saves through the same door.)
   */
  saveDraft(ruleset: GuardRuleset): Promise<GuardRuleset> {
    return api.put<GuardRuleset>(`${INSURANCE_RULES_BASE}/Guards/Draft`, ruleset)
  },
  /**
   * `POST InsuranceRules/Lists/Preview` — ⚠️ PROVISIONAL body `{ list, lists }`: the definition being edited and
   * the draft's other lists, so the lists it includes or excludes resolve before the save.
   */
  preview(list: GuardList, lists: GuardList[]): Promise<ListPreview> {
    return api.post<ListPreview>(`${INSURANCE_RULES_BASE}/Lists/Preview`, { list, lists })
  },
  /** `POST InsuranceRules/{Patient|Policy|Class}Lists` `{ id, name, reason }` — a new list (409 `INSLISTS_EXISTS`). */
  createList(kind: KeyedListKind, body: NewListBody): Promise<KeyedList> {
    return api.post<KeyedList>(keyedListsPath(kind), body)
  },
  /** `GET InsuranceRules/{Patient|Policy|Class}Lists/{id}/Entries` — expired entries included (`expired: true`). */
  async entries(kind: KeyedListKind, id: string): Promise<KeyedListEntry[]> {
    return (await api.get<KeyedListEntry[] | null>(`${keyedListsPath(kind)}/${encodeURIComponent(id)}/Entries`)) ?? []
  },
  /**
   * `POST InsuranceRules/{Patient|Policy|Class}Lists/{id}/Entries` `{ key, payer?, reason, expiresOn? }` → the
   * entry. A key already there has its reason and expiry replaced (logged `change`).
   */
  addEntry(kind: KeyedListKind, id: string, body: EntryBody): Promise<KeyedListEntry> {
    return api.post<KeyedListEntry>(`${keyedListsPath(kind)}/${encodeURIComponent(id)}/Entries`, body)
  },
  /**
   * `DELETE InsuranceRules/{Patient|Policy|Class}Lists/{id}/Entries` with a BODY `{ key, payer?, reason }` →
   * `{ key, payer }`. `payer` only on a class list (on the others it is a 400).
   */
  removeEntry(kind: KeyedListKind, id: string, entry: { key: string; payer?: string | null }, reason: string): Promise<unknown> {
    const body = kind === 'class' && entry.payer ? { key: entry.key, payer: entry.payer, reason } : { key: entry.key, reason }
    return api.delWithBody<unknown>(`${keyedListsPath(kind)}/${encodeURIComponent(id)}/Entries`, body)
  },
  /** `GET InsuranceRules/{Patient|Policy|Class}Lists/{id}/Log` — every change, newest first. */
  async log(kind: KeyedListKind, id: string): Promise<KeyedListLogRow[]> {
    return (await api.get<KeyedListLogRow[] | null>(`${keyedListsPath(kind)}/${encodeURIComponent(id)}/Log`)) ?? []
  },
}

export const keyedListKey = (kind: KeyedListKind, id: string) => [...keyedListsKey(kind), id] as const

export function entriesQuery(kind: KeyedListKind, id: string) {
  return { queryKey: [...keyedListKey(kind, id), 'entries'], queryFn: () => listsApi.entries(kind, id), retry: false } as const
}

export function logQuery(kind: KeyedListKind, id: string) {
  return { queryKey: [...keyedListKey(kind, id), 'log'], queryFn: () => listsApi.log(kind, id), retry: false } as const
}
