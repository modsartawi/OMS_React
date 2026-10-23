/**
 * Ticket 541 — the board's own view logic: the six tiles, and the filters kept in the URL.
 */
import { describe, expect, it } from 'vitest'
import type { DispatchBoardTiles } from '@/core/models/dispatch-board'
import { boardDoorParams, boardFilterFromParams, boardFilterToParams, boardTiles, isFilteredBoard } from './board-view'

const TILES: DispatchBoardTiles = {
  onCalloutNow: 3,
  oldestOpenAgeSeconds: 185,
  bidsAwaiting: 7,
  bidsAwaitingDark: 2,
  takenLastHour: 12,
  medianSecondsToTake: 41.5,
  fellBack: 1,
  notCompeted: 4,
  withdrawn: 0,
}

describe('boardTiles', () => {
  it('six tiles in the fleet-board order, each with its figure and its line', () => {
    expect(boardTiles(TILES)).toEqual([
      { key: 'onCalloutNow', value: 3, sub: { key: 'tiles.oldest', values: { age: '3:05' } }, attention: false },
      { key: 'bidsAwaiting', value: 7, sub: { key: 'tiles.atDark', values: { n: '2' } }, attention: false },
      { key: 'takenLastHour', value: 12, sub: { key: 'tiles.medianToTake', values: { median: '0:42' } }, attention: false },
      { key: 'fellBack', value: 1, sub: { key: 'tiles.fellBackHint', values: {} }, attention: true },
      { key: 'notCompeted', value: 4, sub: { key: 'tiles.notCompetedHint', values: {} }, attention: false },
      { key: 'withdrawn', value: 0, sub: { key: 'tiles.withdrawnHint', values: {} }, attention: false },
    ])
  })

  it('nothing open and nothing taken read their own lines, not 0:00', () => {
    const tiles = boardTiles({ ...TILES, onCalloutNow: 0, oldestOpenAgeSeconds: null, takenLastHour: 0, medianSecondsToTake: null, fellBack: 0 })
    expect(tiles[0].sub).toEqual({ key: 'tiles.noneOpen', values: {} })
    expect(tiles[2].sub).toEqual({ key: 'tiles.noMedian', values: {} })
    expect(tiles[3].attention).toBe(false)
  })
})

describe('the filters in the URL', () => {
  it('reads channel, city and store, trimmed; absent is blank', () => {
    expect(boardFilterFromParams(new URLSearchParams('channel=HYBR&city=%20Riyadh%20'))).toEqual({ channel: 'HYBR', city: 'Riyadh', store: '' })
  })

  it('writes only what is set, in the door’s order', () => {
    expect(boardFilterToParams({ channel: '', city: 'RUH', store: 'P014' }).toString()).toBe('city=RUH&store=P014')
    expect(boardFilterToParams({ channel: '', city: '', store: '' }).toString()).toBe('')
  })

  it('the door gets the same three names, a blank one dropped by the query builder', () => {
    expect(boardDoorParams({ channel: 'CMRC', city: '', store: ' P001 ' })).toEqual({ channel: 'CMRC', city: '', store: 'P001' })
  })

  it('knows whether any filter narrows the board', () => {
    expect(isFilteredBoard({ channel: '', city: '', store: '' })).toBe(false)
    expect(isFilteredBoard({ channel: '', city: '', store: 'P1' })).toBe(true)
  })
})
