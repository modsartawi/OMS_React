import { createContext, useContext, useMemo, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'

import { idocInspectorMetadataQuery } from './api'
import { EMPTY_LEGEND, indexLegend, type LegendIndex } from './code-legend'

/**
 * The code legend, fetched **once per session** and read by every code on the
 * screen (ticket 300, BackOffice 1392).
 *
 * 🔑 **A context rather than a prop.** Codes appear at four depths — the rail
 * card, the document strip, the line row, the condition row — and threading the
 * legend down four levels of props would put a `legend` parameter on components
 * whose subject is a document or a line. It is ambient reference data, and this
 * is what ambient reference data looks like.
 *
 * 🚩 **The provider is the ONLY caller of the query**, so "once per session" is
 * structural rather than a convention every render site has to remember. The key
 * and its options live in `api.ts` beside the call, exactly as the access probe's
 * do, so no second consumer can drift.
 *
 * ⚠️ **The screen renders without it.** A legend still in flight, or refused,
 * yields `EMPTY_LEGEND` and every code renders alone — which is the honest answer
 * and still the useful one, because the raw code is what a consultant pastes into
 * a SAP ticket. Nothing on this screen waits for the legend and nothing hides
 * because it is missing: it is the labels that are decoration, never the codes.
 */
const LegendCtx = createContext<LegendIndex>(EMPTY_LEGEND)

export function LegendProvider({ children }: { children: ReactNode }) {
  // 🚩 Inside the gate, never above it. `Metadata` is grant-gated with the rest,
  // so a denied session must not be firing it — and the gate is what has already
  // decided the session may be here at all.
  const metadata = useQuery(idocInspectorMetadataQuery())

  // Indexed once per answer rather than once per code: `describeCode` is a map
  // hit, and re-indexing nine vocabularies on every row would make the cheapest
  // thing on the screen the most expensive.
  const index = useMemo(() => indexLegend(metadata.data), [metadata.data])

  return <LegendCtx.Provider value={index}>{children}</LegendCtx.Provider>
}

/** The legend a component draws its labels from. Never null — an absent legend is
 *  an empty one, so no caller has a not-loaded branch to get wrong. */
export function useLegend(): LegendIndex {
  return useContext(LegendCtx)
}
