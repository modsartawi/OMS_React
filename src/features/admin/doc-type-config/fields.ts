/**
 * The document type's settings as the screen shows and edits them (BackOffice spec 3148 story 7, ticket 3149): every
 * mapped setting, grouped, in order. The ONE place the detail, the edit form and the diff read their field order,
 * kind, width and lock from. Pure: no React, no `t` — labels are `fields.<field>` and `groups.<group>`.
 */
import type { DocumentTypeField } from './types'

export type FieldKind = 'text' | 'flag' | 'amount'

export interface FieldDef {
  field: DocumentTypeField
  kind: FieldKind
  /** The column's width (`SdDocumentType` DDL): the input never lets through more than the column holds. */
  maxLength?: number
  /** Free text (shown `<bdi>`), not a code (shown `Ltr`). */
  freeText?: boolean
}

export type FieldGroupId =
  | 'identity'
  | 'customer'
  | 'creditCustomer'
  | 'pricing'
  | 'delivery'
  | 'billing'
  | 'picking'
  | 'notifications'
  | 'controls'

export interface FieldGroup {
  group: FieldGroupId
  fields: readonly FieldDef[]
}

const text = (field: DocumentTypeField, maxLength: number, freeText = false): FieldDef => ({ field, kind: 'text', maxLength, freeText })
const flag = (field: DocumentTypeField): FieldDef => ({ field, kind: 'flag' })

export const FIELD_GROUPS: readonly FieldGroup[] = [
  {
    group: 'identity',
    fields: [
      text('documentType', 4),
      text('description', 50, true),
      text('documentCategory', 1),
      text('referenceDocumentCategory', 1),
      text('numberRangeNumber', 2),
    ],
  },
  { group: 'customer', fields: [text('customerDeterminationType', 1), text('defaultCustomer', 15)] },
  {
    group: 'creditCustomer',
    fields: [flag('isReceivableCustomer'), text('receivableCustomer', 15), text('insurancePayerCode', 26)],
  },
  {
    group: 'pricing',
    fields: [text('engineType', 26), text('documentPricingProcedure', 10), flag('promotionDetermination'), flag('isAlternativePriceCapped')],
  },
  {
    group: 'delivery',
    fields: [
      text('defaultDeliveryType', 4),
      text('createDeliveryImmediately', 1),
      text('plantDeterminationType', 1),
      flag('isCalculateDeliveryFees'),
      { field: 'deliveryFees', kind: 'amount' },
    ],
  },
  {
    group: 'billing',
    fields: [text('orderRelatedBillingType', 4), text('deliveryRelatedBillingType', 4), text('createBillingImmediately', 1)],
  },
  { group: 'picking', fields: [flag('isPickedOnOrder'), flag('isDeterminePickingFees')] },
  { group: 'notifications', fields: [text('notifyOnCreation', 1)] },
  {
    group: 'controls',
    fields: [
      text('controlType', 1),
      flag('validateItem'),
      flag('preOrderMaterialOnly'),
      flag('checkOrderNo'),
      flag('canChangeItems'),
      flag('autoClose'),
      flag('diagnosisRequired'),
      flag('approvalProcess'),
      flag('acceptanceRequired'),
    ],
  },
]

/** Every field, in group order. */
export const ALL_FIELDS: readonly FieldDef[] = FIELD_GROUPS.flatMap((g) => g.fields)

/**
 * Locked once the type exists — read-only on the screen and refused by the server (`SDC-00003`): changing them would
 * orphan its documents, break its action types or mix engines on its orders (spec 3148 story 10).
 */
export const LOCKED_FIELDS: ReadonlySet<DocumentTypeField> = new Set<DocumentTypeField>(['documentType', 'documentCategory', 'engineType'])

export const isLocked = (field: DocumentTypeField): boolean => LOCKED_FIELDS.has(field)
