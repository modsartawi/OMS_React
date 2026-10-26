import { describe, expect, it } from 'vitest'
import { orderMoney, storeLogsPath, storesPath } from './order-links'

describe('orderMoney', () => {
  it('is the amount at 3 decimals then the currency — one value, as 554 prints a price', () => {
    expect(orderMoney(18.95, 'SAR')).toBe('18.950 SAR')
    expect(orderMoney(123.45, 'SAR')).toBe('123.450 SAR')
  })
})

describe('storesPath / storeLogsPath', () => {
  it('an unmatched order searches the Stores page by its vendor id', () => {
    expect(storesPath('zz 999')).toBe('/hungerstation/stores?q=zz+999')
  })

  it('a store code opens its logs on the Stores page — the 554 deep link, which a removed store keeps', () => {
    expect(storeLogsPath('1234')).toBe('/hungerstation/stores?logs=1234')
    expect(storeLogsPath('A&B')).toBe('/hungerstation/stores?logs=A%26B')
  })
})
