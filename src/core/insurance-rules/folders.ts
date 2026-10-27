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

/**
 * The tree of the folders in use, siblings by name; a rule in no folder is in no node. `kept` adds the folders
 * HQ keeps (609, `GET …/Folders`) with no rule in them yet, at a count of 0.
 */
export function folderTree(rows: readonly { folder: string }[], kept: readonly string[] = []): FolderNode[] {
  const root: FolderNode = { path: '', name: '', count: 0, children: [] }
  const place = (folder: string, counts: boolean) => {
    let at = root
    for (const name of segments(folder)) {
      const path = at.path ? `${at.path}/${name}` : name
      let next = at.children.find((c) => c.name === name)
      if (!next) at.children.push((next = { path, name, count: 0, children: [] }))
      if (counts) next.count++
      at = next
    }
  }
  for (const row of rows) place(row.folder, true)
  for (const folder of kept) place(folder, false)
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

// ── 609: new, rename, move (authoring only, no approval) ───────────────────────────────────────

/** A new folder's path under a parent ('' = the top). */
export const childPath = (parent: string, name: string): string => [...segments(parent), name.trim()].join('/')

/** A folder's path once its last segment is renamed; its parent stays. */
export const renamedPath = (path: string, name: string): string => childPath(segments(path).slice(0, -1).join('/'), name)

/** Every folder path of a tree, parents before children. */
export function folderPaths(nodes: readonly FolderNode[]): string[] {
  return nodes.flatMap((n) => [n.path, ...folderPaths(n.children)])
}

export type FolderNameProblem = 'empty' | 'slash' | 'taken'

/**
 * Why a folder name under `parent` is refused, or null: empty, holding a `/` (a path separator), or already
 * a sibling's name (compared without case). `self` is the folder being renamed — keeping its name is no clash.
 */
export function folderNameProblem(name: string, parent: string, tree: readonly FolderNode[], self?: string): FolderNameProblem | null {
  const n = name.trim()
  if (!n) return 'empty'
  if (n.includes('/')) return 'slash'
  let siblings: readonly FolderNode[] = tree
  for (const s of segments(parent)) siblings = siblings.find((c) => c.name === s)?.children ?? []
  return siblings.some((c) => c.path !== self && c.name.toLowerCase() === n.toLowerCase()) ? 'taken' : null
}
