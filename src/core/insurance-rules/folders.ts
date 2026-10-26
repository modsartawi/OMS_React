// Folders of the insurance rules (ticket 607; K14 — only the builder reads them, they never change evaluation).
// A folder is a `/`-separated path on the rule. The tree is built from the paths in use; 609 adds creating,
// renaming and moving folders through `…/Folders`, whose path tree this same shape reads.

export interface FolderNode {
  /** The whole path, `Chronic care/Refills` — what a rule's `folder` holds and the URL's `?folder=`. */
  path: string
  /** The last segment, as shown. */
  name: string
  /** Rules in this folder and every folder under it. */
  count: number
  children: FolderNode[]
}

const segments = (folder: string): string[] => folder.split('/').map((s) => s.trim()).filter(Boolean)

/** The tree of the folders in use, siblings by name; a rule in no folder is in no node. */
export function folderTree(rows: readonly { folder: string }[]): FolderNode[] {
  const root: FolderNode = { path: '', name: '', count: 0, children: [] }
  for (const row of rows) {
    let at = root
    for (const name of segments(row.folder)) {
      const path = at.path ? `${at.path}/${name}` : name
      let next = at.children.find((c) => c.name === name)
      if (!next) at.children.push((next = { path, name, count: 0, children: [] }))
      next.count++
      at = next
    }
  }
  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.name.localeCompare(b.name))
    nodes.forEach((n) => sort(n.children))
    return nodes
  }
  return sort(root.children)
}

/** Whether a rule's folder is the picked folder or under it. No pick (null or '') keeps every rule. */
export function inFolder(folder: string, picked: string | null | undefined): boolean {
  const want = segments(picked ?? '')
  if (want.length === 0) return true
  const have = segments(folder)
  return want.length <= have.length && want.every((s, i) => s === have[i])
}
