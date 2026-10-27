/**
 * IDF store lists, pure (BackOffice spec 3157, door 3162; oms ticket 620). A named list of stores (the operation
 * pharmacies, the pilot rollout list) that a store master or a scoped insurer master points at by `storeListId`.
 * The list flagged `isPilotList` cannot be deleted.
 */

/** A row of `GET IdfPriority/store-lists`. */
export interface IdfStoreList {
  storeListId: string
  name: string
  isPilotList?: boolean | null
  storeCodes?: string[] | null
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
