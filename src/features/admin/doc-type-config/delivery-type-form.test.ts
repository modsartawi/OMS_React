/**
 * Ticket 3154 — the delivery type pages' rules: edit (code + category locked, Save waits for a change and a reason),
 * copy (every setting editable, a new unused code of at most 4), the per-field refusals, and the code dropdowns (the
 * document type form's default delivery type is one of these).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import {
  DELIVERY_ALL_FIELDS,
  DELIVERY_CATEGORIES,
  codeChoices,
  deliveryChangedFields,
  deliveryCopyDraft,
  deliveryCopyRequest,
  deliveryCopyState,
  deliveryEditState,
  deliveryFieldRefusals,
  deliverySaveRequest,
  isDeliveryLocked,
  setDeliveryField,
} from './delivery-type-form'
import type { DeliveryTypeSettings } from './delivery-type-types'

const dl = (over: Partial<DeliveryTypeSettings> = {}): DeliveryTypeSettings => ({
  documentType: 'DL',
  description: 'Delivery',
  documentCategory: 'D',
  numberRangeNumber: '',
  defaultDocumentType: '',
  isCompeted: false,
  calloutRadiusKm: 0,
  calloutStockCheck: false,
  calloutLocksDelivery: false,
  calloutLifetimeMinutes: 0,
  calloutDutyCheck: false,
  servingListId: '',
  ...over,
})

describe('editing a delivery type', () => {
  it('locks code and category, nothing else', () => {
    expect(DELIVERY_ALL_FIELDS.filter((f) => isDeliveryLocked(f.field)).map((f) => f.field)).toEqual(['documentType', 'documentCategory'])
    const loaded = dl()
    expect(setDeliveryField(loaded, 'documentCategory', 'T')).toBe(loaded)
    expect(setDeliveryField(loaded, 'documentType', 'XX')).toBe(loaded)
    expect(setDeliveryField(loaded, 'isCompeted', true).isCompeted).toBe(true)
  })

  it('diffs as the server compares: trimmed strings, numbers by value, in field order', () => {
    const changes = deliveryChangedFields(dl({ description: 'Delivery' }), dl({ description: 'Delivery ', calloutRadiusKm: 3, isCompeted: true }))
    expect(changes.map((c) => c.field)).toEqual(['isCompeted', 'calloutRadiusKm'])
    expect(changes[1]).toEqual({ field: 'calloutRadiusKm', before: 0, after: 3 })
  })

  it('waits for a change AND a reason, then sends the loaded before-state', () => {
    const loaded = dl()
    expect(deliveryEditState(loaded, loaded, 'why').blocker).toBe('noChange')
    const draft = setDeliveryField(loaded, 'calloutLifetimeMinutes', 5)
    expect(deliveryEditState(loaded, draft, '  ').blocker).toBe('reason')
    expect(deliveryEditState(loaded, draft, 'x'.repeat(201)).blocker).toBe('reason')
    expect(deliveryEditState(loaded, draft, ' callouts ').canSave).toBe(true)
    expect(deliverySaveRequest(loaded, draft, ' callouts ')).toEqual({ before: loaded, after: draft, reason: 'callouts' })
  })
})

describe('copying a delivery type', () => {
  it('starts from the source with a blank code and description, every setting editable', () => {
    const draft = deliveryCopyDraft(dl({ isCompeted: true, calloutRadiusKm: 3 }))
    expect(draft).toMatchObject({ documentType: '', description: '', isCompeted: true, calloutRadiusKm: 3 })
    expect(setDeliveryField(draft, 'documentCategory', 'T', { copy: true }).documentCategory).toBe('T')
  })

  it('waits for a new unused code of at most 4, a description and a reason', () => {
    const existing = ['DL', 'QC']
    const draft = (over: Partial<DeliveryTypeSettings>) => ({ ...deliveryCopyDraft(dl()), description: 'New lane', ...over })
    expect(deliveryCopyState(draft({ documentType: ' ' }), 'r', existing).blocker).toBe('codeRequired')
    expect(deliveryCopyState(draft({ documentType: 'QCQCQ' }), 'r', existing).blocker).toBe('codeTooLong')
    expect(deliveryCopyState(draft({ documentType: 'qc' }), 'r', existing).blocker).toBe('codeExists')
    expect(deliveryCopyState(draft({ documentType: 'QN', description: ' ' }), 'r', existing).blocker).toBe('descriptionRequired')
    expect(deliveryCopyState(draft({ documentType: 'QN' }), '', existing).blocker).toBe('reason')
    expect(deliveryCopyState(draft({ documentType: 'qn ' }), 'lane', existing)).toMatchObject({ code: 'QN', canSave: true })
    expect(deliveryCopyRequest(draft({ documentType: 'qn ' }), ' lane ').after.documentType).toBe('QN')
    expect(deliveryCopyRequest(draft({ documentType: 'qn ' }), ' lane ').reason).toBe('lane')
  })

  it('offers only the delivery categories', () => {
    expect(DELIVERY_CATEGORIES).toEqual(['D', 'T'])
  })
})

describe('the server refusals, on their fields', () => {
  it('maps SDC-00010 data.fields onto the settings keys', () => {
    const err = new ApiError('business', 'refused', 400, [{ errorCode: 'SDC-00010', internalErrorCode: '', errorMessage: 'refused' }], {
      fields: [
        { field: 'ServingListId', errorCode: 'SDC-00052', message: 'no list / لا' },
        { field: 'DefaultDocumentType', errorCode: 'SDC-00051', message: 'no type / لا' },
      ],
    })
    expect(deliveryFieldRefusals(err)).toEqual({
      servingListId: { code: 'SDC-00052', message: 'no list / لا' },
      defaultDocumentType: { code: 'SDC-00051', message: 'no type / لا' },
    })
    expect(deliveryFieldRefusals(new Error('boom'))).toEqual({})
  })
})

describe('code dropdowns (default delivery type, default document type)', () => {
  const rows = [
    { code: 'QC', description: 'Quick Commerce' },
    { code: 'DL', description: 'Delivery' },
  ]

  it('is blank first, then every code by code', () => {
    expect(codeChoices(rows, 'DL')).toEqual([
      { value: '', description: '' },
      { value: 'DL', description: 'Delivery' },
      { value: 'QC', description: 'Quick Commerce' },
    ])
  })

  it('keeps a held value the list does not know, so opening the form never changes it', () => {
    expect(codeChoices(rows, ' ZZ ')!.map((c) => c.value)).toEqual(['', 'DL', 'QC', 'ZZ'])
  })

  it('is null while the list is not loaded (the form falls back to a text box)', () => {
    expect(codeChoices(undefined, 'DL')).toBeNull()
  })
})
