/**
 * Ticket 3154 — the delivery type pages' rules: edit (code + category locked, Save waits for a change and a reason),
 * copy (every setting editable, a new unused code of at most 4), the per-field refusals, and the code dropdowns (the
 * document type form's default delivery type is one of these).
 */
import { describe, expect, it } from 'vitest'
import { ApiError } from '@/core/api'
import { copyState, normaliseCode } from './copy-form'
import {
  CALLOUT_DISTANCE_MODES,
  DELIVERY_ALL_FIELDS,
  DELIVERY_CATEGORIES,
  DELIVERY_FIELD_GROUPS,
  calloutDistanceMode,
  codeChoices,
  deliveryChangedFields,
  deliveryCopyDraft,
  deliveryCopyRequest,
  deliveryCopyState,
  deliveryNormaliseCode,
  deliveryEditState,
  deliveryFieldRefusals,
  deliveryFieldWarnings,
  deliverySaveRequest,
  distanceModeOnHost,
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
  calloutExpandedRadiusKm: 0,
  calloutDistanceMode: 'OFF',
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

describe('one copy rule for document and delivery types (review G)', () => {
  it("the delivery copy state and code normalisation ARE the copy form's", () => {
    expect(deliveryCopyState).toBe(copyState)
    expect(deliveryNormaliseCode).toBe(normaliseCode)
  })
})

describe('the number range is not read by delivery numbering (review finding 3)', () => {
  it('only numberRangeNumber carries the not-read label', () => {
    expect(DELIVERY_ALL_FIELDS.filter((f) => f.notRead).map((f) => f.field)).toEqual(['numberRangeNumber'])
  })
})

describe('the wider callout radius (ticket 716, BackOffice spec 3326)', () => {
  it('sits in the callouts group right after the callout radius, as a number', () => {
    const callouts = DELIVERY_FIELD_GROUPS.find((g) => g.group === 'callouts')!.fields
    const at = callouts.findIndex((f) => f.field === 'calloutRadiusKm')
    expect(callouts[at + 1]).toEqual({ field: 'calloutExpandedRadiusKm', kind: 'number' })
  })
  it('warns when it is set but not above the callout radius — and still saves (the server accepts it)', () => {
    const loaded = dl({ isCompeted: true, calloutRadiusKm: 5 })
    for (const wider of [5, 3]) {
      const draft = setDeliveryField(loaded, 'calloutExpandedRadiusKm', wider)
      expect(deliveryFieldWarnings(draft)).toEqual({ calloutExpandedRadiusKm: 'expandedRadiusNoEffect' })
      expect(deliveryEditState(loaded, draft, 'qc').canSave).toBe(true)
      expect(deliverySaveRequest(loaded, draft, 'qc').after.calloutExpandedRadiusKm).toBe(wider)
    }
  })

  it('does not warn when off (0), when wider than the radius, or when negative (the server refuses that)', () => {
    expect(deliveryFieldWarnings(dl({ calloutRadiusKm: 5, calloutExpandedRadiusKm: 0 }))).toEqual({})
    expect(deliveryFieldWarnings(dl({ calloutRadiusKm: 5, calloutExpandedRadiusKm: 10 }))).toEqual({})
    expect(deliveryFieldWarnings(dl({ calloutRadiusKm: 5, calloutExpandedRadiusKm: -1 }))).toEqual({})
  })
  it('is followed by the callout distance mode, a choice', () => {
    const callouts = DELIVERY_FIELD_GROUPS.find((g) => g.group === 'callouts')!.fields
    const at = callouts.findIndex((f) => f.field === 'calloutExpandedRadiusKm')
    expect(callouts[at + 1]).toMatchObject({ field: 'calloutDistanceMode', choice: 'distanceMode' })
  })
  it("shows the server's refusal of a negative value on the field (SDC-00053)", () => {
    const message = 'CalloutExpandedRadiusKm cannot be negative. / لا يمكن أن يكون نطاق الاستدعاء الموسّع بالكيلومتر سالباً.'
    const err = new ApiError('business', 'refused', 400, [{ errorCode: 'SDC-00010', internalErrorCode: '', errorMessage: 'refused' }], {
      fields: [{ field: 'CalloutExpandedRadiusKm', errorCode: 'SDC-00053', message }],
    })
    expect(deliveryFieldRefusals(err)).toEqual({ calloutExpandedRadiusKm: { code: 'SDC-00053', message } })
  })
})

describe('the callout distance mode (ticket 857, BackOffice spec 3460 / 3471)', () => {
  it('offers Off, Shadow and On, in that order', () => {
    expect([...CALLOUT_DISTANCE_MODES]).toEqual(['OFF', 'SHADOW', 'ON'])
  })

  it('round-trips: a picked mode is diffed and sent in the save', () => {
    const loaded = dl({ calloutDistanceMode: 'OFF' })
    const draft = setDeliveryField(loaded, 'calloutDistanceMode', 'SHADOW')
    expect(deliveryChangedFields(loaded, draft)).toEqual([{ field: 'calloutDistanceMode', before: 'OFF', after: 'SHADOW' }])
    expect(deliveryEditState(loaded, draft, 'qc goes to shadow').canSave).toBe(true)
    expect(deliverySaveRequest(loaded, draft, 'qc goes to shadow').after.calloutDistanceMode).toBe('SHADOW')
    expect(setDeliveryField(draft, 'calloutDistanceMode', 'ON').calloutDistanceMode).toBe('ON')
  })

  it('refuses an unknown value: the draft is unchanged', () => {
    const loaded = dl({ calloutDistanceMode: 'OFF' })
    for (const bad of ['ROAD', 'off-ish', '', 'X']) expect(setDeliveryField(loaded, 'calloutDistanceMode', bad)).toBe(loaded)
  })

  it('reads a type not yet migrated (blank) as Off, and picking Off there is no change', () => {
    expect(calloutDistanceMode('')).toBe('OFF')
    expect(calloutDistanceMode(' shadow ')).toBe('SHADOW')
    expect(calloutDistanceMode('ROAD')).toBeNull()
    const loaded = dl({ calloutDistanceMode: '' })
    expect(deliveryChangedFields(loaded, setDeliveryField(loaded, 'calloutDistanceMode', 'OFF'))).toEqual([])
  })

  it('a copy of a type not yet migrated sends Off: the server checks every rule on a copy and refuses a blank', () => {
    const draft = { ...deliveryCopyDraft(dl({ calloutDistanceMode: ' ' })), documentType: 'QC2', description: 'Copy' }
    expect(deliveryCopyRequest(draft, 'copy of qc').after.calloutDistanceMode).toBe('OFF')
    const shadow = { ...deliveryCopyDraft(dl({ calloutDistanceMode: 'shadow' })), documentType: 'QC2', description: 'Copy' }
    expect(deliveryCopyRequest(shadow, 'copy of qc').after.calloutDistanceMode).toBe('SHADOW')
  })

  it('a copy from a host that sends no distance mode (before BackOffice 3471) sends none', () => {
    const { calloutDistanceMode: _, ...older } = dl()
    const draft = { ...deliveryCopyDraft(older as DeliveryTypeSettings), documentType: 'QC2', description: 'Copy' }
    expect('calloutDistanceMode' in deliveryCopyRequest(draft, 'copy of qc').after).toBe(false)
  })

  it('a host that sends no distance mode offers none to edit', () => {
    const { calloutDistanceMode: _, ...older } = dl()
    expect(distanceModeOnHost(older as DeliveryTypeSettings)).toBe(false)
    expect(distanceModeOnHost(dl({ calloutDistanceMode: '' }))).toBe(true)
  })

  it("shows the server's bilingual refusal on the field (SDC-00053)", () => {
    const message = "CalloutDistanceMode 'X' is not one of: OFF, SHADOW, ON. / القيمة 'X' غير مسموحة في طريقة قياس مسافة الاستدعاء."
    const err = new ApiError('business', 'refused', 400, [{ errorCode: 'SDC-00010', internalErrorCode: '', errorMessage: 'refused' }], {
      fields: [{ field: 'CalloutDistanceMode', errorCode: 'SDC-00053', message }],
    })
    expect(deliveryFieldRefusals(err)).toEqual({ calloutDistanceMode: { code: 'SDC-00053', message } })
  })
})
