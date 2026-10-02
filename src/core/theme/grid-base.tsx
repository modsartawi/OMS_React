import type { ColDef, ICellRendererParams } from 'ag-grid-community'

/**
 * Every grid cell's value, bidi-isolated (spec 380 F25, ticket 383; measured in 378 §2).
 *
 * Under RTL a mirrored grid reorders any value whose characters are weak or neutral at an
 * edge: the slot `08:00 - 10:00` read `10:00 - 08:00`, a `+966…` mobile read `…966+`, and
 * `-5.00` read `5.00-`. A `<bdi>` isolates the WHOLE shown value, once — isolating the ends
 * of a range separately still reverses it.
 *
 * `dir` is left to `auto`, so the first strong character decides: digits and Latin run LTR,
 * an Arabic name runs RTL, and a value with no strong character (`10:00 - 12:00`) is LTR,
 * which is `<bdi>`'s own default.
 *
 * It shows `valueFormatted ?? value` — what AG Grid's own text cell would have shown — so a
 * column's `valueFormatter` survives. (`Ltr` used as a renderer read `value` alone and
 * silently dropped the format.) Nothing is added to the text: Ctrl+C and the XLSX export
 * carry the value as it was, with no invisible characters.
 *
 * A function component, not a function that builds a DOM node: under AG Grid React a
 * function `cellRenderer` IS a React component, and returning an element node throws.
 */
export function BdiCell({ value, valueFormatted }: ICellRendererParams) {
  return <bdi>{valueFormatted ?? (value == null ? '' : String(value))}</bdi>
}

/**
 * The core base every grid's `defaultColDef` spreads FIRST:
 * `{ ...OMS_GRID_BASE_COL_DEF, sortable: true, … }`. `npm run lint`'s grid gate
 * (`tools/check-grid-base.mjs`) refuses a `<AgGridReact` mount whose `defaultColDef`
 * does not reach it — an opt-in is exactly what failed for direction, where 5 of 22 grids
 * never spread it.
 *
 * It lives in each grid's own `defaultColDef` rather than in `provideGlobalGridOptions`
 * because a grid's `defaultColDef` REPLACES a global one under AG Grid's shallow merge (378,
 * measured): the global hook carries scalars only.
 *
 * A column with its own `cellRenderer` replaces this one, and isolates its own values. A
 * boolean column left to AG Grid's type inference keeps its checkbox: the data type's
 * renderer is applied over the default column.
 *
 * `satisfies`, not an annotation: typed as the bare `ColDef` (row type `any`) it would not
 * spread into a `ColDef<Row>`, whose `field` is the row's own key union.
 */
export const OMS_GRID_BASE_COL_DEF = {
  cellRenderer: BdiCell,
} satisfies ColDef
