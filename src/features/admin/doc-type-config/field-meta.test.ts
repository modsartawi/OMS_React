/**
 * Ticket 3150 — DocumentTypeForm validation: coded settings are dropdowns of the server's allowed values, a server
 * refusal is shown on the field it names, and each changed field in the diff says whether it reaches open orders.
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { changedFields } from './diff'
import { changeLabels, fieldMetaIndex, optionsFor, wireField } from './field-meta'
import { ALL_FIELDS } from './fields'
import { settingsRefusals } from './settings-refusal'
import { fieldMetas, settings } from './test-fixtures'

describe('wireField', () => {
  it('turns the server column name into the wire key', () => {
    expect(wireField('CustomerDeterminationType')).toBe('customerDeterminationType')
    expect(wireField('IsQuantityAllocation')).toBe('isQuantityAllocation')
  })
})

describe('the dropdowns', () => {
  const index = fieldMetaIndex(fieldMetas())

  it('every field the form shows has a classification', () => {
    for (const { field } of ALL_FIELDS) expect([field, index.has(field)]).toEqual([field, true])
  })

  it('a coded field offers exactly its allowed values, blank included', () => {
    expect(optionsFor(index, 'customerDeterminationType', 'A')).toEqual(['', 'A', 'B', 'C', 'D'])
    expect(optionsFor(index, 'notifyOnCancellation', 'X')).toEqual(['', 'X', 'O', 'D'])
  })

  it('a free or referenced field is not a dropdown', () => {
    expect(optionsFor(index, 'description', 'Bupa')).toBeNull()
    expect(optionsFor(index, 'defaultCustomer', '3795407')).toBeNull()
  })

  it('🚩 a legacy value outside the list stays visible, so opening the form never silently changes it', () => {
    expect(optionsFor(index, 'customerDeterminationType', 'X')).toEqual(['', 'A', 'B', 'C', 'D', 'X'])
  })

  it('no metadata yet (loading or failed): no dropdown', () => {
    expect(optionsFor(fieldMetaIndex(undefined), 'controlType', '')).toBeNull()
  })
})

describe('the diff labels', () => {
  const index = fieldMetaIndex(fieldMetas())

  it('each changed field says open orders or new orders only', () => {
    const changes = changedFields(settings(), settings({ controlType: 'W', engineType: 'LEGACY', defaultCustomer: '1' }))
    expect(changeLabels(changes, index)).toEqual([
      { field: 'defaultCustomer', effectKey: 'effect.NewOrdersOnly', notRead: false },
      { field: 'engineType', effectKey: 'effect.NewOrdersOnly', notRead: false },
      { field: 'controlType', effectKey: 'effect.OpenOrders', notRead: false },
    ])
  })

  it('the three billing settings are labelled not read by order processing', () => {
    const changes = changedFields(
      settings(),
      settings({ orderRelatedBillingType: 'POSI', deliveryRelatedBillingType: 'POSR', createBillingImmediately: 'X' }),
    )
    expect(changeLabels(changes, index).map((l) => l.notRead)).toEqual([true, true, true])
  })

  it('without metadata a change carries no label rather than a wrong one', () => {
    const changes = changedFields(settings(), settings({ controlType: 'W' }))
    expect(changeLabels(changes, fieldMetaIndex(undefined))).toEqual([{ field: 'controlType', effectKey: null, notRead: false }])
  })
})

describe('settingsRefusals — the server refusal on its field', () => {
  const refused = (data: unknown, code = 'SDC-00010') =>
    new ApiError('business', 'refused', 400, [{ errorCode: code, internalErrorCode: '', errorMessage: 'refused' }], data)

  it('maps every refused field to its own code and message', () => {
    const err = refused({
      fields: [
        { field: 'DefaultCustomer', errorCode: 'SDC-00012', message: "DefaultCustomer 'X' is not a customer. / ..." },
        { field: 'ControlType', errorCode: 'SDC-00011', message: "ControlType 'Z' is not one of ... / ..." },
      ],
    })
    expect(settingsRefusals(err)).toEqual({
      defaultCustomer: { code: 'SDC-00012', message: "DefaultCustomer 'X' is not a customer. / ..." },
      controlType: { code: 'SDC-00011', message: "ControlType 'Z' is not one of ... / ..." },
    })
  })

  it('is empty for another refusal, a malformed body or no error', () => {
    expect(settingsRefusals(refused({ fields: [] }, 'SDC-00004'))).toEqual({})
    expect(settingsRefusals(refused(null))).toEqual({})
    expect(settingsRefusals(refused({ fields: [{ nope: 1 }] }))).toEqual({})
    expect(settingsRefusals(null)).toEqual({})
  })
})
