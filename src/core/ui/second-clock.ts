import { useSyncExternalStore } from 'react'

/**
 * One shared 1 s clock for live countdowns (the dispatch board's grid cells and inspector, 541; a
 * delivery's "On callout" line, 542). Every reader subscribes to the SAME interval: a board of 40 open
 * callouts runs one timer, not 40, and every countdown on screen moves on the same tick. The interval
 * starts with the first reader and stops when the last one leaves.
 */
export const CLOCK_MS = 1000

let now = Date.now()
let timer: ReturnType<typeof setInterval> | null = null
const readers = new Set<() => void>()

function tick() {
  now = Date.now()
  readers.forEach((r) => r())
}

export const secondClock = {
  subscribe(reader: () => void): () => void {
    readers.add(reader)
    if (timer === null) {
      // The clock was idle: its last time is stale, so a joining reader reads the time it joined at.
      now = Date.now()
      timer = setInterval(tick, CLOCK_MS)
    }
    return () => {
      readers.delete(reader)
      if (readers.size === 0 && timer !== null) {
        clearInterval(timer)
        timer = null
      }
    }
  },
  getSnapshot(): number {
    return now
  },
}

/** The current time (ms), moving each second on the shared clock. */
export function useSecondClock(): number {
  return useSyncExternalStore(secondClock.subscribe, secondClock.getSnapshot)
}
