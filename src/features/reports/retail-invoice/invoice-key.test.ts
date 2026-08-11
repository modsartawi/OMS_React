import { describe, expect, it } from 'vitest'

import type { RetailInvoiceKey } from '@/core/models/retail-invoice'

import { fallbackFileName, invoiceRowKey } from './invoice-key'

const KEY: RetailInvoiceKey = {
  storeCode: 'P001',
  machineCode: '01',
  trxNumber: '00114600051234',
}

describe('invoiceRowKey', () => {
  it('spells the row as its three key parts', () => {
    expect(invoiceRowKey(KEY)).toBe('P001/01/00114600051234')
  })

  it('separates two rows that differ only by till', () => {
    expect(invoiceRowKey({ ...KEY, machineCode: '02' })).not.toBe(invoiceRowKey(KEY))
  })

  it('separates two tills of different stores that share a trx number', () => {
    // ⚠️ The near-collision the numbering scheme actually permits: a trx number
    // is store-last-3 + till-last-1 + day + time fraction, so two stores CAN
    // share one if they share those characters. The key must still split them.
    expect(invoiceRowKey({ ...KEY, storeCode: 'P002' })).not.toBe(invoiceRowKey(KEY))
  })
})

describe('fallbackFileName', () => {
  it('names the file from the three key parts, with no date', () => {
    // 🚩 No date, deliberately (contract §6.5) — asserted rather than assumed,
    // because "helpfully" adding one is the obvious change to make here.
    expect(fallbackFileName(KEY)).toBe('Invoice-P001-01-00114600051234.pdf')
  })

  it('always ends in .pdf', () => {
    expect(fallbackFileName({ ...KEY, trxNumber: '9' }).endsWith('.pdf')).toBe(true)
  })

  it('carries three key parts, never four', () => {
    // ⚠️ `Client` is a fixed '000' estate-wide and is not on the wire (988), so
    // the name is `Invoice` + exactly three parts. Counted rather than matched
    // on the literal '000' — a trx number contains that run of digits often
    // enough that such an assertion would pass or fail for the wrong reason.
    expect(fallbackFileName(KEY).split('-')).toHaveLength(4)
  })
})
