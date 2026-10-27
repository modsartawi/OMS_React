/**
 * Ticket 3152 — a change-log row's field-level diff, computed when read from its before / after JSON snapshots (the
 * server stores whole rows by column name, never the diff). Generic over the entity type: the same rule reads a
 * document type, a child row, a delivery type, an action type or a source.
 */
import { describe, expect, it } from 'vitest'
import { columnField, fieldDiff } from './field-diff'

const row = (action: string, before: unknown, after: unknown) => ({
  action,
  beforeJson: before === '' ? '' : JSON.stringify(before),
  afterJson: after === '' ? '' : JSON.stringify(after),
})

describe('fieldDiff', () => {
  it('an update shows only the changed fields, before and after, in the snapshot order', () => {
    const diff = fieldDiff(
      row(
        'Update',
        { DocumentType: 'Q49A', Description: 'Cash', DeliveryFees: 7.5, IsPickedOnOrder: false, AutoClose: false },
        { DocumentType: 'Q49A', Description: 'Cash sale', DeliveryFees: 12.25, IsPickedOnOrder: true, AutoClose: false },
      ),
    )
    expect(diff).toEqual({
      kind: 'update',
      lines: [
        { column: 'Description', before: 'Cash', after: 'Cash sale' },
        { column: 'DeliveryFees', before: 7.5, after: 12.25 },
        { column: 'IsPickedOnOrder', before: false, after: true },
      ],
    })
  })

  it('an update compares as the server does: strings trimmed, amounts by value', () => {
    expect(fieldDiff(row('Update', { DefaultCustomer: '3795407', DeliveryFees: 15 }, { DefaultCustomer: ' 3795407 ', DeliveryFees: 15.0 })).lines).toEqual([])
  })

  it('a create shows every field it set, with no before', () => {
    expect(fieldDiff(row('Create', '', { DocumentType: 'Q52A', ItemCategoryGroup: '', DefaultItemCategory: 'NORM', IsActive: false }))).toEqual({
      kind: 'create',
      lines: [
        { column: 'DocumentType', before: undefined, after: 'Q52A' },
        { column: 'DefaultItemCategory', before: undefined, after: 'NORM' },
        { column: 'IsActive', before: undefined, after: false },
      ],
    })
  })

  it('a copy reads like a create: the new row, field by field', () => {
    expect(fieldDiff(row('Copy', '', { DocumentType: 'Q52C', Description: 'Copy of cash' }))).toEqual({
      kind: 'copy',
      lines: [
        { column: 'DocumentType', before: undefined, after: 'Q52C' },
        { column: 'Description', before: undefined, after: 'Copy of cash' },
      ],
    })
  })

  it('a delete shows every field it removed, with no after', () => {
    expect(fieldDiff(row('Delete', { DocumentType: 'Q52A', PlantNetworkId: 'N1', PlantCode: 'E001' }, ''))).toEqual({
      kind: 'delete',
      lines: [
        { column: 'DocumentType', before: 'Q52A', after: undefined },
        { column: 'PlantNetworkId', before: 'N1', after: undefined },
        { column: 'PlantCode', before: 'E001', after: undefined },
      ],
    })
  })

  it('a field only one side has still shows (a column added since the older snapshot)', () => {
    expect(fieldDiff(row('Update', { A: '1', Old: 'x' }, { A: '1', New: 'y' })).lines).toEqual([
      { column: 'New', before: undefined, after: 'y' },
      { column: 'Old', before: 'x', after: undefined },
    ])
  })

  it('an unreadable snapshot is said, never guessed', () => {
    expect(fieldDiff({ action: 'Update', beforeJson: '{"A":', afterJson: '{"A":"1"}' })).toEqual({ kind: 'unreadable', lines: [] })
    expect(fieldDiff({ action: 'Update', beforeJson: '[1]', afterJson: '{}' })).toEqual({ kind: 'unreadable', lines: [] })
  })
})

describe('columnField', () => {
  it('maps a column name to the screen field it labels', () => {
    expect(columnField('IsPickedOnOrder')).toBe('isPickedOnOrder')
    expect(columnField('DocumentType')).toBe('documentType')
    expect(columnField('')).toBe('')
  })
})
