import { describe, expect, it } from 'vitest'
import type { SdDocumentTypeModel, StoreDetailModel } from '@/core/models/lookups'
import { orderTypeOptions, storeOptions } from './scope-options'

const store = (storeCode: string, city: string) => ({ storeCode, city }) as StoreDetailModel
const type = (documentType: string, description: string, documentCategory: string): SdDocumentTypeModel => ({
  documentType,
  description,
  documentCategory,
})

describe('storeOptions', () => {
  it('labels each store as one code · city pair, in code order, each once', () => {
    expect(storeOptions([store('P019', 'Jeddah'), store('P001', 'Riyadh'), store('P019', 'Jeddah')])).toEqual([
      { value: 'P001', text: 'P001 · Riyadh' },
      { value: 'P019', text: 'P019 · Jeddah' },
    ])
  })

  it('a store with no city reads as its code; a row with no code is dropped', () => {
    expect(storeOptions([store(' P002 ', ' '), store('', 'Dammam')])).toEqual([{ value: 'P002', text: 'P002' }])
  })

  it('no lookup yet is no options', () => {
    expect(storeOptions(undefined)).toEqual([])
  })
})

describe('orderTypeOptions', () => {
  it('offers the order and Erx types only, as the till does, captioned by description in caption order', () => {
    expect(
      orderTypeOptions([
        type('ZO', 'Online order', 'O'),
        type('ZD', 'Delivery', 'D'),
        type('ZX', 'Erx prescription', 'X'),
        type('ZB', 'Billing', 'B'),
        type('ZC', 'Call center order', 'O'),
      ]),
    ).toEqual([
      { value: 'ZC', text: 'Call center order' },
      { value: 'ZX', text: 'Erx prescription' },
      { value: 'ZO', text: 'Online order' },
    ])
  })

  it('a blank description reads as the code; a blank code is dropped; a code is offered once', () => {
    expect(orderTypeOptions([type('ZO', ' ', 'O'), type('', 'Nothing', 'O'), type('ZO', 'Again', 'X')])).toEqual([{ value: 'ZO', text: 'ZO' }])
  })

  it('reads a padded or lower-case category as its letter', () => {
    expect(orderTypeOptions([type('ZO', 'Online order', 'O '), type('ZX', 'Erx prescription', 'x')]).map((o) => o.value)).toEqual(['ZX', 'ZO'])
  })

  it('no lookup yet is no options', () => {
    expect(orderTypeOptions(undefined)).toEqual([])
  })
})
