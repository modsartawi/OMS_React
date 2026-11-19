import { describe, expect, it } from 'vitest'
import en from '@/locales/en/boards.json'
import ar from '@/locales/ar/boards.json'
import { shareRights } from './share-rights'

const valueAt = (o: unknown, path: string): unknown => path.split('.').reduce<unknown>((x, k) => (x && typeof x === 'object' ? (x as Record<string, unknown>)[k] : undefined), o)

/** Every kind a tier action, the share dialog or the reassign dialog can be opened on (926 adds the item list). */
const KINDS = ['view', 'board', 'report', 'itemlist'] as const

describe('the tier dialogs say every kind in both languages (926 review)', () => {
  it('the delete and un-certify confirms, and the untitled share, narrow and reassign titles, name each kind', () => {
    for (const bundle of [en, ar])
      for (const kind of KINDS)
        for (const key of [`tierActions.confirm.delete.body.${kind}`, `tierActions.confirm.uncertify.body.${kind}`, `share.untitled.share.${kind}`, `share.untitled.narrow.${kind}`, `reassign.untitled.${kind}`])
          expect(valueAt(bundle, key), key).toBeTruthy()
  })
  it('what a shared item list lets its audience do, and what not, has its own words', () => {
    for (const bundle of [en, ar])
      for (const kind of KINDS) {
        const r = shareRights(kind)
        for (const k of r.can) expect(valueAt(bundle, `share.can.${k}`), `${kind} can ${k}`).toBeTruthy()
        for (const k of r.cannot) expect(valueAt(bundle, `share.cannot.${k}`), `${kind} cannot ${k}`).toBeTruthy()
      }
  })
})

describe('shareRights: the share dialog’s can / cannot lists by kind', () => {
  it('a view, board or report is run with its parameters; an item list is read and exported, never run', () => {
    expect(shareRights('view')).toEqual({ can: ['run', 'params', 'export', 'link'], cannot: ['edit', 'ai', 'copy'] })
    expect(shareRights('report')).toEqual(shareRights('view'))
    expect(shareRights('itemlist')).toEqual({ can: ['readList', 'exportList'], cannot: ['changeList'] })
  })
})
