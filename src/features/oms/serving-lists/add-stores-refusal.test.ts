/**
 * Ticket 569 — what a refused batch add reads as in the add-stores dialog. `SVL-00002` / `SVL-00003` carry
 * `data.badStoreCodes` (the request's spelling, trimmed); a `data` missing or of the wrong shape falls back to the
 * server's message. `stale` — the list gone, or a code already on it — means the dialog re-reads the list. Pure.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { addStoresRefusal, isBadCode } from './add-stores-refusal'

const refused = (code: string, message: string, data: unknown = null, statusCode = 400) =>
  new ApiError('business', message, statusCode, [{ errorCode: code, errorMessage: message, internalErrorCode: '' }], data)

describe('addStoresRefusal', () => {
  it('SVL-00002 with badStoreCodes marks exactly those codes as unknown', () => {
    const err = refused('SVL-00002', 'No such store: X1, x2. Nothing was added. / …', { badStoreCodes: ['X1', 'x2'] })
    expect(addStoresRefusal(err)).toEqual({
      kind: 'badCodes',
      code: 'SVL-00002',
      labelKey: 'addStores.refusal.unknownStores',
      codes: ['X1', 'x2'],
      message: 'No such store: X1, x2. Nothing was added. / …',
      stale: false,
    })
  })

  it('SVL-00003 with badStoreCodes marks exactly those codes as already on the list', () => {
    const err = refused('SVL-00003', 'Already on serving list 01J…: 1001. Nothing was added.', { badStoreCodes: ['1001'] })
    expect(addStoresRefusal(err)).toMatchObject({ kind: 'badCodes', code: 'SVL-00003', labelKey: 'addStores.refusal.alreadyMembers', codes: ['1001'], stale: true })
  })

  it.each([
    ['no data', null],
    ['data without the field', { other: 1 }],
    ['a field that is not a list', { badStoreCodes: 'X1' }],
    ['a list that is not all strings', { badStoreCodes: ['X1', 7] }],
    ['an empty list', { badStoreCodes: [] }],
    ['data that is a string', 'X1'],
  ])('SVL-00002 with %s falls back to the message', (_name, data) => {
    const err = refused('SVL-00002', 'No such store: X1. Nothing was added.', data)
    expect(addStoresRefusal(err)).toEqual({
      kind: 'refused',
      code: 'SVL-00002',
      labelKey: 'addStores.refusal.unknownStores',
      message: 'No such store: X1. Nothing was added.',
      stale: false,
    })
  })

  it('SVL-00001: the list is gone', () => {
    expect(addStoresRefusal(refused('SVL-00001', 'Serving list 01J does not exist.'))).toMatchObject({
      kind: 'refused',
      code: 'SVL-00001',
      labelKey: 'addStores.refusal.unknownList',
      stale: true,
    })
  })

  it('SVL-00008: no code to add', () => {
    expect(addStoresRefusal(refused('SVL-00008', 'Name at least one store to add.'))).toMatchObject({
      kind: 'refused',
      labelKey: 'addStores.refusal.noCodes',
    })
  })

  it('an unknown code keeps its code and the server text, no label', () => {
    expect(addStoresRefusal(refused('SVL-00042', 'Something new.'))).toEqual({ kind: 'refused', code: 'SVL-00042', labelKey: null, message: 'Something new.', stale: false })
  })

  it('a bare 403 is the Execute grant not held', () => {
    expect(addStoresRefusal(new ApiError('auth', 'Unexpected API error (HTTP 403)', 403))).toEqual({ kind: 'notGranted' })
  })

  it('a failure with no code reads as failed', () => {
    expect(addStoresRefusal(new ApiError('network', 'Network down', 0))).toEqual({ kind: 'failed', message: 'Network down' })
    expect(addStoresRefusal(new Error('boom'))).toEqual({ kind: 'failed', message: '' })
  })
})

describe('isBadCode', () => {
  it('matches a basket code against the refused codes case-insensitively', () => {
    expect(isBadCode(['X1', 'p019'], 'x1')).toBe(true)
    expect(isBadCode(['X1', 'p019'], 'P019')).toBe(true)
    expect(isBadCode(['X1', 'p019'], '1001')).toBe(false)
  })
})
