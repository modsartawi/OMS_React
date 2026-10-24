import { useEffect, useState } from 'react'
import { keyChoices } from '@/core/util/filter-choices'

/**
 * The chain keys seen on a HungerStation list's rows so far, sorted and distinct — the fallback a
 * chain filter or field offers when the `Chains` read is refused or not made (it rides
 * `canManageStores`). Remembered across filters, so filtering by one chain never shrinks the choice
 * to that chain. Shared by the stores page (551) and the orders monitor (556).
 */
export function useSeenChains(rows: readonly { chainKey: string }[]): string[] {
  const [seen, setSeen] = useState<string[]>([])
  useEffect(() => {
    setSeen((prev) => {
      const next = keyChoices(undefined, [...prev, ...rows.map((r) => r.chainKey)])
      return next.length === prev.length ? prev : next
    })
  }, [rows])
  return seen
}
