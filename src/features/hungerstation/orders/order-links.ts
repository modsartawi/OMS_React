import { formatMoney3 } from '@/core/util/number-format'

// The orders monitor's pure shapes for money and for the links it offers into the Stores page
// (ticket 556, review fixes). Pure: no React, no `t`.

/**
 * Money with its currency — `18.950 SAR`, the shape 554 prints a price in. ONE machine value: the
 * caller isolates it once (`Ltr`), never each half. In a grid it is the cell's plain value (the grid
 * base isolates it), never `fsi`-wrapped.
 */
export function orderMoney(amount: number, currencyKey: string): string {
  return `${formatMoney3(amount)} ${currencyKey}`
}

/** The Stores page an `unmatched` alert sends a person to, searched by the order's vendor id: an
 *  empty answer confirms no onboarded store holds it, and Onboard there (which also revives a
 *  removed store, ticket 552) is the action. */
export function storesPath(vendorId: string): string {
  return `/hungerstation/stores?${new URLSearchParams({ q: vendorId })}`
}

/** A store's logs on the Stores page — the `?logs=<code>` deep link of ticket 554, which opens for any
 *  store code, so a removed store's history stays readable from the order that names it. */
export function storeLogsPath(storeCode: string): string {
  return `/hungerstation/stores?${new URLSearchParams({ logs: storeCode })}`
}
