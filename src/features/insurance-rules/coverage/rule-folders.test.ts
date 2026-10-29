/** Ticket 675 — a ruleset's rules cut into folder runs, in the order HQ runs them: never regrouped. */
import { describe, expect, it } from 'vitest'
import { folderOptions, folderPath, folderRuns, ruleFolder } from './rule-folders'

const r = (id: string, folder?: string) => (folder === undefined ? { id } : { id, folder })
const shape = (rules: { id: string; folder?: string }[]) =>
  folderRuns(rules).map((run) => `${run.folder || '-'}${run.continued ? '+' : ''} ${run.first}-${run.last} ${run.rules.map((x) => `${x.position}:${x.rule.id}`).join(',')}`)

describe('folderRuns', () => {
  it('next-to-each-other rules of one folder are one run, with their positions in the whole ruleset', () => {
    expect(shape([r('C-ELITE', 'Segments'), r('C-SABIC', 'Segments'), r('C-EXCEPTION', 'Prescriptions'), r('A01', 'Item master'), r('A02', 'Item master')])).toEqual([
      'Segments 1-2 1:C-ELITE,2:C-SABIC',
      'Prescriptions 3-3 3:C-EXCEPTION',
      'Item master 4-5 4:A01,5:A02',
    ])
  })

  it('a folder the order splits is two runs, the second a continuation; nothing is moved to group it', () => {
    const rules = [r('A', 'Segments'), r('B', 'Segments'), r('C', 'Prescriptions'), r('D', 'Segments')]
    expect(shape(rules)).toEqual(['Segments 1-2 1:A,2:B', 'Prescriptions 3-3 3:C', 'Segments+ 4-4 4:D'])
    expect(folderRuns(rules).flatMap((run) => run.rules.map((x) => x.rule))).toEqual(rules)
  })

  it('a rule with no folder (missing or blank) is in a "no folder" run of its own', () => {
    expect(shape([r('A'), r('B', ''), r('C', 'X'), r('D')])).toEqual(['- 1-2 1:A,2:B', 'X 3-3 3:C', '-+ 4-4 4:D'])
    expect(ruleFolder({ folder: '  ' })).toBe('')
  })

  it('a path is read segment by segment, as the Guards page reads it', () => {
    expect(folderPath(' Chronic care / Refills ')).toBe('Chronic care/Refills')
    expect(folderPath('a//b/')).toBe('a/b')
    expect(shape([r('A', 'Chronic care/Refills'), r('B', 'Chronic care / Refills')])).toEqual(['Chronic care/Refills 1-2 1:A,2:B'])
  })

  it('each run knows which of its folder\'s runs it is', () => {
    expect(folderRuns([r('A', 'S'), r('B', 'P'), r('C', 'S'), r('D', 'S'), r('E', 'P')]).map((run) => `${run.folder}${run.nth}`)).toEqual(['S0', 'P0', 'S1', 'P1'])
  })

  it('an empty ruleset has no runs', () => {
    expect(folderRuns([])).toEqual([])
  })
})

describe('folderOptions', () => {
  it('each folder once, in the order it first appears; whether any rule has none', () => {
    expect(folderOptions([r('A', 'Segments'), r('B'), r('C', 'Item master'), r('D', 'Segments')])).toEqual({ folders: ['Segments', 'Item master'], hasNone: true })
    expect(folderOptions([r('A', 'X')])).toEqual({ folders: ['X'], hasNone: false })
  })
})
