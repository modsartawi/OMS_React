import type {
  HungerStationHealthFilter,
  HungerStationStoreSync,
  HungerStationStoresQuery,
  HungerStationSyncFilter,
} from '@/core/models/hungerstation'
import type { Severity } from '@/core/ui/severity'

// The HungerStation stores page's pure rules (spec 3028, ticket 551): the health a row reads and
// its highlight, and the URL ⇄ query mapping. Pure: no React, no `t`.

/**
 * What the health cell reads. The server computes `ok` / `failing` / `silent` (contract § Stores);
 * the screen adds `paused` — a paused store is never silent (it is not meant to push) — and
 * `unknown` for a value the contract does not name, so it can never pass for `ok`.
 */
export type HealthReading = 'ok' | 'failing' | 'silent' | 'paused' | 'unknown'

const HEALTHS = ['ok', 'failing', 'silent'] as const

/**
 * A row's health and its highlight (the spec 1872 rule): `failing` red, `silent` amber, else none.
 *
 * Precedence: the server's `failing` wins — a paused store whose newest push in 24 h failed still
 * shows the failure (the contract computes it from the push, not the pause). Otherwise a paused
 * store reads `paused`, whatever health the server sent: the contract says a paused store is `ok`,
 * and the screen says *paused* rather than *ok* so the grid tells the two apart.
 */
export function healthLabel(sync: Pick<HungerStationStoreSync, 'active' | 'health'>): {
  health: HealthReading
  highlight: Extract<Severity, 'bad' | 'warn'> | null
} {
  if (sync.health === 'failing') return { health: 'failing', highlight: 'bad' }
  if (!sync.active) return { health: 'paused', highlight: null }
  if (sync.health === 'silent') return { health: 'silent', highlight: 'warn' }
  return { health: HEALTHS.includes(sync.health) ? sync.health : 'unknown', highlight: null }
}

/** The door's `sync` values, in the order the filter offers them. */
export const SYNC_FILTERS: readonly HungerStationSyncFilter[] = ['any', 'active', 'paused']

/** The door's `health` values, in the order the filter offers them. */
export const HEALTH_FILTERS: readonly HungerStationHealthFilter[] = ['any', 'ok', 'failing', 'silent']

/**
 * The page's query, read from its URL. A `sync` or `health` the door does not know reads as its
 * default, `any` — sending it would be a 400 `HungerStationFilterUnknown`.
 */
export function storesFromParams(params: URLSearchParams): HungerStationStoresQuery {
  const text = (key: string) => {
    const v = params.get(key)?.trim()
    return v ? v : null
  }
  const pick = <T extends string>(key: string, allowed: readonly T[]): T => {
    const v = params.get(key)
    return allowed.includes(v as T) ? (v as T) : allowed[0]
  }
  return { chain: text('chain'), sync: pick('sync', SYNC_FILTERS), health: pick('health', HEALTH_FILTERS), q: text('q') }
}

/** The query as URL params — and, as written, the door's own params: `any` is the default and is left out. */
export function storesToParams(query: HungerStationStoresQuery): URLSearchParams {
  const out = new URLSearchParams()
  if (query.chain) out.set('chain', query.chain)
  if (query.sync !== 'any') out.set('sync', query.sync)
  if (query.health !== 'any') out.set('health', query.health)
  if (query.q) out.set('q', query.q)
  return out
}
