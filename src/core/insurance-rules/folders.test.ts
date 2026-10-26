/**
 * Ticket 607 — the Guards list's folder tree. A folder is a `/` path on the rule (K14: only the builder reads
 * it); the tree is built from the paths in use, a parent counts its descendants, and picking a folder keeps
 * the rules in it and under it.
 */
import { describe, expect, it } from 'vitest'
import { GUARD_ROWS } from '../../../tools/insurance-rules-stubs.mjs'
import { folderTree, inFolder, type FolderNode } from './folders'

const shape = (n: FolderNode): unknown => [n.path, n.name, n.count, n.children.map(shape)]

describe('folderTree', () => {
  it('builds the tree from the paths in use, sorted by name, each folder counting its descendants', () => {
    expect(folderTree(GUARD_ROWS).map(shape)).toEqual([
      ['Chronic care', 'Chronic care', 3, [['Chronic care/Refills', 'Refills', 1, []]]],
      ['Pharmacist conduct', 'Pharmacist conduct', 3, []],
      ['Reference', 'Reference', 3, [['Reference/Formulary', 'Formulary', 1, []], ['Reference/SFDA', 'SFDA', 2, []]]],
      ['Specialty medicines', 'Specialty medicines', 2, [['Specialty medicines/GLP-1', 'GLP-1', 2, []]]],
    ])
  })

  it('a rule in no folder is in no node, and stray slashes do not make empty folders', () => {
    expect(folderTree([{ folder: '' }, { folder: '/A//B/' }]).map(shape)).toEqual([['A', 'A', 1, [['A/B', 'B', 1, []]]]])
  })
})

describe('inFolder', () => {
  it('keeps the folder and every folder under it, never a sibling that only shares a prefix', () => {
    expect(GUARD_ROWS.filter((r) => inFolder(r.folder, 'Chronic care')).map((r) => r.id)).toEqual(['G-002', 'G-004', 'G-005'])
    expect(inFolder('Chronic carex', 'Chronic care')).toBe(false)
    expect(inFolder('', null)).toBe(true)
    expect(inFolder('Reference/SFDA', '')).toBe(true)
  })
})
