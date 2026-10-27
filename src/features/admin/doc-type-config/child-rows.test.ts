/**
 * Ticket 3151 — a type's item-category assignment and plant network rows: add, change and remove, each with a reason.
 * The dialog's rules as pure functions: the key is locked on a change, a key the type already has is refused before
 * the server sees it, the required columns must be filled, and every request carries the loaded row and the reason.
 */
import { describe, expect, it } from 'vitest'
import {
  ITEM_CATEGORY_ASSIGNMENT,
  PLANT_NETWORK,
  childRowKey,
  childRowRequest,
  childRowState,
  emptyChildRow,
  setChildField,
} from './child-rows'
import type { ItemCategoryAssignmentRow, PlantNetworkRow } from './types'

const ica = (over: Partial<ItemCategoryAssignmentRow> = {}): ItemCategoryAssignmentRow => ({
  documentType: 'BUPA', itemCategoryGroup: '', itemUsage: '', defaultItemCategory: 'STND',
  manualItemCategory1: '', manualItemCategory2: '', manualItemCategory3: '', manualItemCategory4: '', ...over,
})
const pn = (over: Partial<PlantNetworkRow> = {}): PlantNetworkRow => ({ documentType: 'BUPA', plantNetworkId: 'NT0049', plantCode: '1000', ...over })

describe('the key', () => {
  it('joins the key columns after the type (as the server logs them), matched case- and space-blind', () => {
    expect(childRowKey(ITEM_CATEGORY_ASSIGNMENT, ica({ itemCategoryGroup: ' zg1', itemUsage: 'text ' }))).toBe('ZG1|TEXT')
    expect(childRowKey(PLANT_NETWORK, pn({ plantNetworkId: 'nt0049' }))).toBe('NT0049')
  })
})

describe('add', () => {
  const existing = [ica()]

  it('a key the type already has is refused before the server sees it', () => {
    const s = childRowState(ITEM_CATEGORY_ASSIGNMENT, 'add', null, ica({ defaultItemCategory: 'TEXT' }), existing, 'why')
    expect([s.blocker, s.canSave]).toEqual(['duplicate', false])
  })

  it('the required columns must be filled', () => {
    const s = childRowState(ITEM_CATEGORY_ASSIGNMENT, 'add', null, ica({ itemUsage: 'TEXT', defaultItemCategory: '' }), existing, 'why')
    expect(s.missing).toEqual(['defaultItemCategory'])
    expect(s.blocker).toBe('missing')
    const p = childRowState(PLANT_NETWORK, 'add', null, pn({ plantCode: ' ' }), [], 'why')
    expect([p.missing, p.blocker]).toEqual([['plantCode'], 'missing'])
  })

  it('needs a reason, then may be saved', () => {
    const draft = ica({ itemUsage: 'TEXT', defaultItemCategory: 'TEXT' })
    expect(childRowState(ITEM_CATEGORY_ASSIGNMENT, 'add', null, draft, existing, '  ').blocker).toBe('reason')
    expect(childRowState(ITEM_CATEGORY_ASSIGNMENT, 'add', null, draft, existing, 'text lines').canSave).toBe(true)
  })

  it('sends only the after-state and the trimmed reason', () => {
    const draft = emptyChildRow(PLANT_NETWORK, 'BUPA')
    expect(draft).toEqual({ documentType: 'BUPA', plantNetworkId: '', plantCode: '' })
    expect(childRowRequest('add', null, pn(), '  route it ')).toEqual({ after: pn(), reason: 'route it' })
  })
})

describe('change', () => {
  const loaded = ica({ itemUsage: 'TEXT' })

  it('the key is locked: setting a key column leaves the draft as it is', () => {
    expect(setChildField(ITEM_CATEGORY_ASSIGNMENT, 'edit', loaded, 'itemUsage', 'XXXX')).toBe(loaded)
    expect(setChildField(PLANT_NETWORK, 'edit', pn(), 'plantNetworkId', 'NT0001').plantNetworkId).toBe('NT0049')
    expect(setChildField(PLANT_NETWORK, 'add', pn(), 'plantNetworkId', 'NT0001').plantNetworkId).toBe('NT0001')
  })

  it('nothing changed → no save; a changed column lists its before and after', () => {
    expect(childRowState(ITEM_CATEGORY_ASSIGNMENT, 'edit', loaded, loaded, [loaded], 'why').blocker).toBe('noChange')
    const draft = setChildField(ITEM_CATEGORY_ASSIGNMENT, 'edit', loaded, 'manualItemCategory2', 'CASH')
    const s = childRowState(ITEM_CATEGORY_ASSIGNMENT, 'edit', loaded, draft, [loaded], 'why')
    expect(s.changes).toEqual([{ field: 'manualItemCategory2', before: '', after: 'CASH' }])
    expect(s.canSave).toBe(true)
  })

  it('its own key is not a duplicate', () => {
    const draft = { ...loaded, defaultItemCategory: 'TEXT' }
    expect(childRowState(ITEM_CATEGORY_ASSIGNMENT, 'edit', loaded, draft, [loaded], 'why').blocker).toBeNull()
  })

  it('sends the loaded row as the before-state', () => {
    const draft = { ...loaded, defaultItemCategory: 'TEXT' }
    expect(childRowRequest('edit', loaded, draft, 'x')).toEqual({ before: loaded, after: draft, reason: 'x' })
  })
})

describe('remove', () => {
  it('needs only a reason, and sends the row it removes', () => {
    const row = pn()
    expect(childRowState(PLANT_NETWORK, 'remove', row, row, [row], '').blocker).toBe('reason')
    expect(childRowState(PLANT_NETWORK, 'remove', row, row, [row], 'retired').canSave).toBe(true)
    expect(childRowRequest('remove', row, row, ' retired ')).toEqual({ before: row, reason: 'retired' })
  })
})
