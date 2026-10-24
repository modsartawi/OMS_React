/**
 * Ticket 556 — an order's lines in the order given, each replacement shown right after the line it
 * replaced (a replacement of a replacement right after that one), nothing lost or repeated.
 */
import { describe, expect, it } from 'vitest'
import type { HungerStationOrderLine } from '@/core/models/hungerstation'
import { lineOrder } from './order-lines'

const line = (itemId: string, replacedId: string | null = null): HungerStationOrderLine => ({
  itemId,
  replacedId,
  sku: `SKU-${itemId}`,
  name: 'Panadol',
  status: replacedId ? 'IN_CART' : 'IN_CART',
  quantity: 1,
  unitPrice: 10,
  totalPrice: 10,
  discount: 0,
  materialNumber: null,
})
const ids = (lines: HungerStationOrderLine[]) => lineOrder(lines).map((l) => l.itemId)

describe('lineOrder', () => {
  it('lines with no replacement keep the order given', () => {
    expect(ids([line('3'), line('1'), line('2')])).toEqual(['3', '1', '2'])
  })

  it('the door’s own order (replacement already after its line) is kept as it is', () => {
    expect(ids([line('1'), line('2'), line('9', '2'), line('3')])).toEqual(['1', '2', '9', '3'])
  })

  it('🚩 a replacement listed apart from its line moves right after it', () => {
    expect(ids([line('1'), line('2'), line('3'), line('9', '1')])).toEqual(['1', '9', '2', '3'])
  })

  it('a replacement listed BEFORE its line still lands after it', () => {
    expect(ids([line('9', '2'), line('1'), line('2')])).toEqual(['1', '2', '9'])
  })

  it('a replacement of a replacement follows that replacement; two of one line keep their order', () => {
    expect(ids([line('1'), line('8', '1'), line('2'), line('7', '8'), line('6', '1')])).toEqual(['1', '8', '7', '6', '2'])
  })

  it('a replacement whose line is not in the order stays where it was given', () => {
    expect(ids([line('1'), line('9', 'gone'), line('2')])).toEqual(['1', '9', '2'])
  })

  it('a cycle in bad data loses no line and repeats none', () => {
    expect(ids([line('1', '2'), line('2', '1'), line('3')]).sort()).toEqual(['1', '2', '3'])
  })
})
