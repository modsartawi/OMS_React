import { useCallback, useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'

import { slipAccessQuery } from './api'
import { canSeeSlips, isNoSlipRow, type NoSlipToggle } from './slips'

/** What a slip-counted grid draws from its rows and the probe (ticket 320). */
export interface SlipView<Row> {
  /** The probe's answer, fail-closed: the column, the filter and the banner all follow it. */
  showSlips: boolean
  /** The rows the grid shows — narrowed to `slipCount === 0` while "No slip" is on. */
  gridRows: Row[]
  /** Draw the "Slip counts unavailable" banner? Only over a column the session may see. */
  unavailable: boolean
  /** The toolbar's toggle, or `undefined` when the session may not see slips (the hidden filter). */
  noSlip: NoSlipToggle | undefined
  /** Turn the filter off — the toolbar's Reset calls it with the rest. */
  clearNoSlip: () => void
}

/**
 * The slip half of Ready and Cash Collections (ticket 320, BackOffice 2034) —
 * one hook so the two grids cannot read the probe, the filter or the banner two
 * different ways. Each Page still composes its own screen (244 §1); this is one
 * control's plumbing, as `useCsvExport` is.
 *
 * 🔑 The probe is the ONE shared entry (`slipAccessQuery`), read through
 * `canSeeSlips`: pending, refused (503 NOT_SET_UP, 403, network) or malformed all
 * hide the column, the filter and the banner. Called inside the screen gate, so a
 * refused session never asks.
 *
 * "No slip" is client-side over the rows already here — never a server parameter
 * — and `=== 0` only (`isNoSlipRow`): an unknown count never falls in. Off whenever
 * the column is hidden, whatever its last state.
 */
export function useSlipView<Row extends { slipCount: number | null }>(
  rows: Row[],
  slipCountsUnavailable: boolean | undefined,
): SlipView<Row> {
  const access = useQuery(slipAccessQuery())
  const showSlips = canSeeSlips(access.data)
  const [pressed, setPressed] = useState(false)

  const noSlipOn = showSlips && pressed
  const gridRows = useMemo(() => (noSlipOn ? rows.filter(isNoSlipRow) : rows), [rows, noSlipOn])
  const clearNoSlip = useCallback(() => setPressed(false), [])
  const onToggle = useCallback(() => setPressed((v) => !v), [])

  return {
    showSlips,
    gridRows,
    // The rows still answer when the slip register did not: every count is a dash.
    unavailable: showSlips && slipCountsUnavailable === true,
    noSlip: showSlips ? { pressed, onToggle } : undefined,
    clearNoSlip,
  }
}
