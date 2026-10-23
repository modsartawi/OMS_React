import { useEffect, useState } from 'react'

/** The board's 1 s clock: the countdowns move on it between the 30 s reads. */
export const CLOCK_MS = 1000

export function useNow(ms = CLOCK_MS): number {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), ms)
    return () => clearInterval(id)
  }, [ms])
  return now
}
