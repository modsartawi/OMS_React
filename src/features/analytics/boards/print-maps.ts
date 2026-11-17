/**
 * The maps of the report print page (oms-react 883, BackOffice spec 3630 M37, M38). Pure: no React and no map code.
 *
 * Each map block on the page joins when it mounts. It then either signals `drawn` (the panel's tiles and points are
 * painted, 879), or falls back: it signalled `cannot draw`, or it has not drawn within 20 seconds of joining. A map
 * that fell back prints the table of the same rows with "The map could not be drawn" (M38), and the report is still
 * sent. The page says it is ready (`data-print-ready`) only once every joined map is drawn or fell back (M37), on top
 * of today's rule; with no map that rule is unchanged.
 *
 * The 20 seconds sit inside the report worker's 60-second budget for the whole render.
 */

/** How long a map may take to draw on the print page before it prints as its table (M38). */
export const MAP_PRINT_TIMEOUT_MS = 20_000

export type MapPrintState = 'drawing' | 'drawn' | 'fell-back'

export interface PrintMaps {
  /** A map block is on the page: its 20 seconds start. Returns its leave (the block unmounted). */
  join(id: string): () => void
  drawn(id: string): void
  cannotDraw(id: string): void
  /** A joined map's state; a map that never joined reads `drawing`. */
  state(id: string): MapPrintState
  /** Every joined map has drawn or fallen back. True with no map. */
  settled(): boolean
  /** Told on every change of any map's state. */
  subscribe(listener: () => void): () => void
  /** The page left: every timer stops. */
  close(): void
}

export function createPrintMaps(timeoutMs: number = MAP_PRINT_TIMEOUT_MS): PrintMaps {
  const states = new Map<string, MapPrintState>()
  const timers = new Map<string, ReturnType<typeof setTimeout>>()
  const listeners = new Set<() => void>()
  // Review W3: an ending told before its map joined. React runs a child's effects before its parent's, so a map that
  // cannot start (no graphics) reports it before its block joins; the join takes it as the map's ending, once.
  const early = new Map<string, MapPrintState>()
  const tell = () => listeners.forEach((l) => l())
  const stopTimer = (id: string) => {
    const timer = timers.get(id)
    if (timer !== undefined) clearTimeout(timer)
    timers.delete(id)
  }
  // Only a map still drawing moves: its first ending is its ending, and a late `drawn` after a fall-back changes nothing.
  const end = (id: string, to: MapPrintState) => {
    if (!states.has(id)) {
      if (!early.has(id)) early.set(id, to)
      return
    }
    if (states.get(id) !== 'drawing') return
    stopTimer(id)
    states.set(id, to)
    tell()
  }
  return {
    join(id) {
      stopTimer(id)
      const ended = early.get(id)
      early.delete(id)
      if (ended) {
        states.set(id, ended)
      } else {
        states.set(id, 'drawing')
        timers.set(
          id,
          setTimeout(() => end(id, 'fell-back'), timeoutMs),
        )
      }
      tell()
      return () => {
        stopTimer(id)
        states.delete(id)
        early.delete(id)
        tell()
      }
    },
    drawn: (id) => end(id, 'drawn'),
    cannotDraw: (id) => end(id, 'fell-back'),
    state: (id) => states.get(id) ?? 'drawing',
    settled: () => [...states.values()].every((s) => s !== 'drawing'),
    subscribe(listener) {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    close() {
      ;[...timers.keys()].forEach(stopTimer)
      listeners.clear()
      early.clear()
    },
  }
}

/**
 * The print page's ready marker: today's rule (no request in flight, and the charts' moment to draw has passed) and,
 * on top of it, every map on the page drawn or fallen back.
 */
export function printReady({ idle, settled, maps }: { idle: boolean; settled: boolean; maps: Pick<PrintMaps, 'settled'> }): boolean {
  return idle && settled && maps.settled()
}
