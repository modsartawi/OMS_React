/**
 * Every decision the bonded-return screen makes, in one dependency-free module
 * (spec 289 D3): no React, no `t()`, no network, no clock. This slice carries
 * the first of them — the **line projection**.
 *
 * It lives beside `change-store.ts` and `reschedule.ts` for the same reason
 * those do: the arithmetic is where a regression is silent, and none of it
 * needs a browser to be exercised.
 */
import type { SdDocumentLineModel } from '@/core/models/sd-document'

/** One line as the return screen offers it. */
export interface ReturnableLine {
  lineNumber: number
  itemNumber: string
  itemDescription: string
  /** What was delivered — the line's `quantity`. */
  delivered: number
  /** What earlier returns have already taken back. */
  returned: number
  /** `delivered − returned`, never below zero. The cap on what may be sent back. */
  remaining: number
}

/** The projection: the rows to render, and what was left out of them. */
export interface ReturnableLineProjection {
  rows: ReturnableLine[]
  /**
   * How many lines were omitted because nothing is left on them. The grid
   * renders what it is handed and the header states this count — a line that
   * silently vanishes is a line an operator will look for.
   */
  hiddenCount: number
}

/**
 * A payload number, or `0`.
 *
 * ⚠ `returnedQuantity` is a BackOffice spec 1283 §2b addition that does not
 * exist on the wire yet, so it is **optional** on the model and absent on every
 * captured payload. Absent means *nothing has been returned* — never `NaN`,
 * which would poison `remaining` and every comparison downstream.
 */
function finiteOrZero(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0
}

/** Hold a number inside `[low, high]`. */
function clamp(value: number, low: number, high: number): number {
  return Math.min(Math.max(value, low), high)
}

/**
 * Project a delivery's lines into the rows a return may be created from.
 *
 * `remaining = quantity − returnedQuantity`, per 1283 §2b's own formula. A line
 * with nothing left is **omitted from the rows and counted in the tally** —
 * hiding is the projection's job, not the grid's.
 *
 * A remainder is clamped to `[0, delivered]`. A server that reports more
 * returned than delivered — or, while the field's spelling is still a guess,
 * one that reports it negative — is a data question, and neither answer is a
 * licence to offer a quantity outside what was delivered.
 */
export function returnableLines(
  lines: SdDocumentLineModel[] | null | undefined,
): ReturnableLineProjection {
  const rows: ReturnableLine[] = []
  let hiddenCount = 0

  for (const line of lines ?? []) {
    const delivered = Math.max(0, finiteOrZero(line.quantity))
    const returned = finiteOrZero(line.returnedQuantity)
    const remaining = clamp(delivered - returned, 0, delivered)
    if (remaining <= 0) {
      hiddenCount += 1
      continue
    }
    rows.push({
      lineNumber: line.lineNumber,
      itemNumber: line.itemNumber,
      itemDescription: line.itemDescription,
      delivered,
      returned,
      remaining,
    })
  }

  return { rows, hiddenCount }
}
