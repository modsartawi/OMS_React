/**
 * The engine-rules form → the bulk request's operations (BackOffice spec 4190 story 24, oms 958).
 * Every field defaults to Leave, and a Leave field is never sent.
 */
import { describe, expect, it } from 'vitest'
import { EMPTY_FORM, type BulkForm, fromOperations, hasOperations, toOperations } from './operations'

const form = (patch: Partial<BulkForm> = {}): BulkForm => ({ ...EMPTY_FORM, ...patch })
const lists = (patch: Partial<BulkForm['lists']>): BulkForm['lists'] => ({ ...EMPTY_FORM.lists, ...patch })

describe('form → bulk operations', () => {
  it('an untouched form is all Leave: no operation at all', () => {
    expect(toOperations(EMPTY_FORM)).toEqual({ operations: {}, problems: [] })
    expect(hasOperations({})).toBe(false)
  })

  it('Leave fields are omitted; the operated ones are carried', () => {
    const { operations, problems } = toOperations(
      form({ score: { op: 'set', value: '40' }, isStackable: 'no' }),
    )
    expect(problems).toEqual([])
    expect(operations).toEqual({ score: { op: 'set', value: 40 }, isStackable: { op: 'set', value: false } })
    expect(hasOperations(operations)).toBe(true)
  })

  it('list operations are carried with their codes as typed; Clear carries none', () => {
    const { operations } = toOperations(
      form({
        lists: lists({
          excludes: { op: 'add', value: '100234, 100567' },
          originFilter: { op: 'replace', value: 'C\nM' },
          loyTiers: { op: 'remove', value: 'GOLD' },
          includes: { op: 'clear', value: 'ignored' },
          stackingExcludes: { op: 'leave', value: 'OMS000000001' },
        }),
      }),
    )
    expect(operations).toEqual({
      excludes: { op: 'add', value: '100234, 100567' },
      originFilter: { op: 'replace', value: 'C\nM' },
      loyTiers: { op: 'remove', value: 'GOLD' },
      includes: { op: 'clear' },
    })
  })

  it('stackable Yes, max value and the time window are sent in wire form (HHmmss)', () => {
    const { operations } = toOperations(
      form({
        isStackable: 'yes',
        maxValue: { op: 'set', value: '12.5' },
        timeWindow: { op: 'set', from: '15:00', to: '18:30:15' },
      }),
    )
    expect(operations).toEqual({
      isStackable: { op: 'set', value: true },
      maxValue: { op: 'set', value: 12.5 },
      timeWindow: { op: 'set', from: '150000', to: '183015' },
    })
    expect(toOperations(form({ timeWindow: { op: 'clear', from: '15:00', to: '' } })).operations).toEqual({
      timeWindow: { op: 'clear' },
    })
  })

  it('🚩 an operated field with nothing usable is a problem, never sent as a blank or a zero', () => {
    const { operations, problems } = toOperations(
      form({
        score: { op: 'set', value: '' },
        maxValue: { op: 'set', value: '-1' },
        timeWindow: { op: 'set', from: '15:00', to: '' },
        lists: lists({ excludes: { op: 'add', value: ' , ;' }, includes: { op: 'replace', value: '' } }),
      }),
    )
    expect(problems).toEqual(['score', 'maxValue', 'timeWindow', 'includes', 'excludes'])
    expect(operations).toEqual({})
  })

  it('a max value may be written without its leading zero, but never negative or in hex', () => {
    expect(toOperations(form({ maxValue: { op: 'set', value: '.5' } })).operations).toEqual({ maxValue: { op: 'set', value: 0.5 } })
    expect(toOperations(form({ maxValue: { op: 'set', value: '-.5' } })).problems).toEqual(['maxValue'])
    expect(toOperations(form({ maxValue: { op: 'set', value: '0x10' } })).problems).toEqual(['maxValue'])
    expect(toOperations(form({ maxValue: { op: 'set', value: '.' } })).problems).toEqual(['maxValue'])
  })

  it('a score must be a whole number', () => {
    expect(toOperations(form({ score: { op: 'set', value: '2.5' } })).problems).toEqual(['score'])
    expect(toOperations(form({ score: { op: 'set', value: '0' } })).operations).toEqual({ score: { op: 'set', value: 0 } })
  })

  it('a saved operations set reads back into the form (presets start the form from it)', () => {
    const ops = {
      score: { op: 'set', value: 7 },
      isStackable: { op: 'set', value: true },
      timeWindow: { op: 'set', from: '080000', to: '120000' },
      excludes: { op: 'add', value: '100234' },
      loyGroups: { op: 'clear' },
    } as const
    const back = fromOperations(ops)
    expect(back.score).toEqual({ op: 'set', value: '7' })
    expect(back.isStackable).toBe('yes')
    expect(back.timeWindow).toEqual({ op: 'set', from: '08:00:00', to: '12:00:00' })
    expect(back.lists.excludes).toEqual({ op: 'add', value: '100234' })
    expect(back.lists.loyGroups).toEqual({ op: 'clear', value: '' })
    expect(back.lists.includes).toEqual({ op: 'leave', value: '' })
    expect(back.maxValue).toEqual({ op: 'leave', value: '' })
    expect(toOperations(back).operations).toEqual(ops)
  })
})
