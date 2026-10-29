// The category and coverage rule lists' folders (oms 675). A ruleset's ORDER is its meaning (`./ruleset-edit`), so
// folders are shown INSIDE the one ordered list, never instead of it: the list is cut into runs of next-to-each-other
// rules that share a folder, and a folder the order splits shows again where it continues. Nothing here moves a rule.

/** A folder path as the list groups it: each `/` segment trimmed, blank segments dropped (as `@/core/insurance-rules/folders`). */
export const folderPath = (folder: string | null | undefined): string =>
  (folder ?? '')
    .split('/')
    .map((x) => x.trim())
    .filter(Boolean)
    .join('/')

/** A rule's folder as the list groups it; `''` when it has none. */
export const ruleFolder = (rule: { folder?: string | null }): string => folderPath(rule.folder)

/** One run of the list: next-to-each-other rules in one folder, each with its position (1…n) in the whole ruleset. */
export interface FolderRun<R> {
  /** `''` for rules in no folder. */
  folder: string
  /** True when an earlier run has the same folder: the order splits it, and this is where it continues. */
  continued: boolean
  /** Which of its folder's runs this is (0 for the first): with the folder, the run's key, so a collapsed run stays collapsed when a move elsewhere re-cuts the list. */
  nth: number
  first: number
  last: number
  rules: { rule: R; position: number }[]
}

/** The rules, in document order, cut where the folder changes. */
export function folderRuns<R extends { folder?: string | null }>(rules: readonly R[]): FolderRun<R>[] {
  const runs: FolderRun<R>[] = []
  const seen = new Map<string, number>()
  rules.forEach((rule, i) => {
    const folder = ruleFolder(rule)
    const position = i + 1
    const last = runs.at(-1)
    if (last && last.folder === folder) {
      last.rules.push({ rule, position })
      last.last = position
      return
    }
    const nth = seen.get(folder) ?? 0
    runs.push({ folder, continued: nth > 0, nth, first: position, last: position, rules: [{ rule, position }] })
    seen.set(folder, nth + 1)
  })
  return runs
}

/** The document's folders, each once in the order it first appears, and whether any rule is in none. */
export function folderOptions(rules: readonly { folder?: string | null }[]): { folders: string[]; hasNone: boolean } {
  const folders: string[] = []
  let hasNone = false
  for (const rule of rules) {
    const folder = ruleFolder(rule)
    if (!folder) hasNone = true
    else if (!folders.includes(folder)) folders.push(folder)
  }
  return { folders, hasNone }
}
