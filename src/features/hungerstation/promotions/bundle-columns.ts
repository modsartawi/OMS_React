import {
  HUNGERSTATION_PROMOTION_MAX_SKUS,
  type HungerStationPromotionCombination,
  type HungerStationPromotionItemInput,
} from '@/core/models/hungerstation'
import { numberOf, readItemSheet, subtypeOf, type ItemSheetRead } from './strikethrough-columns'

/**
 * A same-item bundle's items as the user pastes them from Excel or picks them as a `.tsv` / `.txt`
 * (ticket 668, spec 3201 § oms-react: "Bundle columns are `Material, Buy, Get, Subtype, Value,
 * MaxQty`") — pure. Read by 666's shared rules (`readItemSheet`: tab split, header skipped, last row
 * of a material wins and is counted, the cap reported never truncated).
 *
 * - **Blank** buy / get / subtype / value: `null` in the body, so the row takes the promotion's
 *   default as it reads when SAVED (666's assumption, carried over). `rowCombination` says on screen
 *   what a blank row will read as.
 * - **Buy** and **Get** are whole numbers of at least 1 (BackOffice 3213's bundle check), else the
 *   line is flagged (`CELL`). Buy-one-get-one-free is `1, 1, PERCENTAGE, 100`.
 * - The page never groups rows into parts: the split is the server's (3213), shown from Check.
 */

/** The spec's columns, in file order. */
export const BUNDLE_COLUMNS = ['material', 'buyQuantity', 'getQuantity', 'subtype', 'value', 'maxQuantity'] as const
export type BundleColumn = (typeof BUNDLE_COLUMNS)[number]

/** A buy / get cell: `null` when blank, `undefined` unless a whole number of at least 1. */
const quantityOf = (cell: string): number | null | undefined => {
  const n = numberOf(cell, true)
  return n === null || n === undefined ? n : n >= 1 ? n : undefined
}

/** A line's cells as the body's item. */
export function bundleItemOf(fields: Record<BundleColumn, string>): HungerStationPromotionItemInput {
  return {
    materialNumber: fields.material,
    buyQuantity: quantityOf(fields.buyQuantity) ?? null,
    getQuantity: quantityOf(fields.getQuantity) ?? null,
    subtype: subtypeOf(fields.subtype) ?? null,
    value: numberOf(fields.value) ?? null,
    maxQuantity: numberOf(fields.maxQuantity, true) ?? null,
  }
}

const badCell = (f: Record<BundleColumn, string>): BundleColumn | null =>
  quantityOf(f.buyQuantity) === undefined
    ? 'buyQuantity'
    : quantityOf(f.getQuantity) === undefined
      ? 'getQuantity'
      : subtypeOf(f.subtype) === undefined
        ? 'subtype'
        : numberOf(f.value) === undefined
          ? 'value'
          : numberOf(f.maxQuantity, true) === undefined
            ? 'maxQuantity'
            : null

export function readBundle(text: string, cap: number = HUNGERSTATION_PROMOTION_MAX_SKUS): ItemSheetRead<BundleColumn> {
  return readItemSheet(text, BUNDLE_COLUMNS, badCell, bundleItemOf, cap)
}

/** The header defaults a blank cell takes. */
export interface BundleDefaults {
  buyQuantity: number | null
  getQuantity: number | null
  subtype: HungerStationPromotionCombination['subtype']
  value: number | null
}

/** One row's combination as it will read once saved: each blank cell the header default. For the
 *  preview grid only — never a part (the server makes those). */
export function rowCombination(item: HungerStationPromotionItemInput, d: BundleDefaults): HungerStationPromotionCombination {
  return {
    buyQuantity: item.buyQuantity ?? d.buyQuantity,
    getQuantity: item.getQuantity ?? d.getQuantity,
    subtype: item.subtype ?? d.subtype,
    value: item.value ?? d.value,
  }
}
