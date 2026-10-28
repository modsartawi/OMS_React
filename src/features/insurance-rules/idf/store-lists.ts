/**
 * IDF store lists, pure (BackOffice spec 3157, door 3162; oms ticket 620). A named list of stores (the operation
 * pharmacies, the pilot rollout list) that a store master or a scoped insurer master points at by `storeListId`.
 *
 * Doors as built (3162): a list has a `code` (plain ASCII, at most 26, unique, never changes) and EN + AR names; the
 * names are renamed together; the stores are saved as the whole set. There is no delete door (the pilot list, flagged
 * `isPilotList`, comes first).
 */

/** A row of `GET IdfPriority/store-lists`. `addedTime` is local wall-clock, no `Z`. */
export interface IdfStoreList {
  storeListId: string
  code: string
  nameEn: string
  nameAr: string
  isPilotList?: boolean | null
  storeCodes?: string[] | null
  addedTime?: string | null
}

/** `POST IdfPriority/store-lists`. */
export interface IdfStoreListCreateBody {
  code: string
  nameEn: string
  nameAr: string
  storeCodes?: string[]
}

/** `PUT IdfPriority/store-lists/{id}` — a rename; the code never changes. */
export interface IdfStoreListRenameBody {
  nameEn: string
  nameAr: string
}

/** The longest code 3162 accepts. */
export const STORE_LIST_CODE_MAX = 26

/** The list's name in the reader's language; English when the Arabic is blank, the code when both are. */
export function storeListName(l: Pick<IdfStoreList, 'nameEn' | 'nameAr' | 'code'>, lang: string): string {
  return (lang.startsWith('ar') && l.nameAr ? l.nameAr : l.nameEn || l.nameAr) || l.code
}

export type IdfStoreListProblem = 'codeRequired' | 'codeAscii' | 'codeTooLong' | 'nameRequired'

/** Why a new list may not be sent yet (the server's `IDF-00017` stays the authority on a taken code). */
export function createListProblems(b: IdfStoreListCreateBody): Partial<Record<'code' | 'nameEn' | 'nameAr', IdfStoreListProblem>> {
  const out: Partial<Record<'code' | 'nameEn' | 'nameAr', IdfStoreListProblem>> = {}
  const code = b.code.trim()
  if (!code) out.code = 'codeRequired'
  else if (!/^[!-~]+$/.test(code) || code.includes(',')) out.code = 'codeAscii' // 3162: 0x21–0x7E, no comma
  else if (code.length > STORE_LIST_CODE_MAX) out.code = 'codeTooLong'
  if (!b.nameEn.trim()) out.nameEn = 'nameRequired'
  if (!b.nameAr.trim()) out.nameAr = 'nameRequired'
  return out
}

/** A typed entry split into store codes: commas, semicolons and whitespace separate; codes are upper-cased. */
export function parseStoreCodes(typed: string): string[] {
  return typed
    .split(/[\s,;]+/)
    .map((c) => c.trim().toUpperCase())
    .filter(Boolean)
}

/** The set with the typed codes appended, each code once, the set's order kept. A new array. */
export function addStores(set: string[], typed: string): string[] {
  return [...new Set([...set, ...parseStoreCodes(typed)])]
}

/** The set without `code`. A new array. */
export function removeStore(set: string[], code: string): string[] {
  return set.filter((c) => c !== code)
}

/** The body of `PUT IdfPriority/store-lists/{id}/stores`: the whole set, exactly as shown. */
export function storeSetBody(set: string[]): { storeCodes: string[] } {
  return { storeCodes: [...set] }
}

/** Whether two store sets hold the same codes, whatever their order (the editor's "is there anything to save"). */
export function sameStoreSet(a: readonly string[], b: readonly string[]): boolean {
  const right = new Set(b)
  const left = new Set(a)
  return left.size === right.size && [...left].every((c) => right.has(c))
}
