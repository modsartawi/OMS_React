import type { AcrForm } from '@/core/models/collection'

/* The ACR form's header strip, as data: two rows of labelled cells above the table,
 * in the RTL order they print. `CollectionAcr.tsx` draws exactly this list and adds
 * nothing to it, so what the header prints is decided — and tested — here.
 *
 * ⚠ DOCUMENTED EXCEPTION, `CollectionAcr.tsx`'s own (spec 249, tickets 251/252): the
 * Arabic IS the paper form rather than UI copy, so these labels are not `t()` keys.
 *
 * Ticket 341 lifted the list out of the markup so that it can be read by a test: the
 * component imports a stylesheet and an image, which the node test runner cannot.
 *
 * The labels carry a TRAILING SPACE (`'عن يوم: '`), as the XAML's do; the stylesheet
 * keeps it (`white-space: pre`). */

/** The form's string fields — the only ones a header cell may print. An optional
 *  one (`acrNo`, absent from an older SIS.Api) counts too; it prints blank or its
 *  cell's `fallback`. */
type AcrFormText = {
  [K in keyof AcrForm]-?: NonNullable<AcrForm[K]> extends string ? K : never
}[keyof AcrForm]

/** One labelled cell of the header. `field` is the server's pre-formatted string. */
export type AcrHeaderCell = {
  label: string
  field: AcrFormText
  /**
   * What prints when `field` is absent or blank — the old `acrNumberText` under a
   * SIS.Api that does not send `acrNo` yet (ticket 425). Never a client-built value.
   */
  fallback?: AcrFormText
  /** The ACR's own serial prints bold. */
  strong?: boolean
  /** Keep the value's own runs of spaces — أُغلق بواسطة's `name  (id)` carries two. */
  keepSpaces?: boolean
  /**
   * A machine value, isolated left-to-right on the RTL sheet (the bidi rule).
   * `6498-2610-0001` read inside an Arabic line would otherwise come out
   * `0001-2610-6498`.
   */
  ltr?: boolean
}

/**
 * What a header cell prints: its field as sent; for a cell with a `fallback`, that
 * fallback when the field is absent or blank; else blank.
 */
export function headerCellValue(form: AcrForm, cell: AcrHeaderCell): string {
  const value = form[cell.field] ?? ''
  if (!cell.fallback || value.trim() !== '') return value
  return form[cell.fallback] ?? ''
}

export const ACR_HEADER_ROWS: readonly (readonly AcrHeaderCell[])[] = [
  [
    // BackOffice 2145 — `الموافق` (Hijri) is gone, by owner ruling.
    { label: 'عن يوم: ', field: 'acrDateText' },
    // 247's amendment 2 — `نموذج رقم ( )` becomes `رقم التجميعي`: the field is the
    // ACR's own serial, not a form-stock number. The pad's parentheses went with it;
    // they bracket a blank a collector wrote into, and this is printed.
    // Ticket 425 (ADR 0066) — the number as printed, `6498-2610-0001` or a legacy
    // plain number, formatted by the server. `acrNumberText` only under a SIS.Api
    // that does not send `acrNo` yet.
    { label: 'رقم التجميعي: ', field: 'acrNo', fallback: 'acrNumberText', strong: true, ltr: true },
    // BackOffice 2145 — المنطقة (Store.Area) became المدينة (Store.City).
    { label: 'المدينة: ', field: 'cities' },
  ],
  // 247's amendment 3 — NO deposit mark, here or in the summary below. 242 §8-O7
  // answered OUT and wider than it was asked: the ACR states what was COLLECTED;
  // where the money went afterwards is the deposit's own document.
  // `depositNumberText`, `depositStatus` and `depositText` all left the contract, so
  // there is nothing here to bind.
  [
    // BackOffice 2145 — the day the ACR was opened, never blank. It used to bind
    // `closedAtText`, which printed an empty slot on every OPEN ACR.
    { label: 'تاريخ التحصيل: ', field: 'collectionDateText' },
    // Ticket 341 (BackOffice 2149 D14) — the description line (الوصف, the ACR's label)
    // is gone from the header, by owner ruling. The label itself stays on the list.
    { label: 'الحالة: ', field: 'status' },
    // BackOffice 1987 (ticket 313) — who closed it, the last cell of this row.
    // `closedByText` is the server's whole string: `النظام (SYSTEM)` for the 23:59
    // sweep, `name  (id)` for the collector, `''` while OPEN or when nothing was
    // recorded — rendered as given, never re-derived from a raw `closedBy`, and blank
    // when empty.
    { label: 'أُغلق بواسطة: ', field: 'closedByText', keepSpaces: true },
  ],
]
