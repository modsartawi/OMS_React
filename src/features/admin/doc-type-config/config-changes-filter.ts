/**
 * The Config changes page's filter (ticket 3152). Pure: no React, no `t`.
 */
import type { ConfigChangeFilter } from './change-log-types'

export const EMPTY_CONFIG_CHANGE_FILTER: ConfigChangeFilter = { entityType: '', entityKey: '', user: '', from: '', to: '' }

/** The query parameters the doors bind: trimmed, blank left in as '' (`api` drops it). Days go as typed, local. */
export function configChangeParams(filter: ConfigChangeFilter): Record<string, string> {
  return {
    entityType: filter.entityType.trim(),
    entityKey: filter.entityKey.trim(),
    user: filter.user.trim(),
    from: filter.from,
    to: filter.to,
  }
}

/** From after To is refused here rather than sent (the server says `SDC-00030` too). `yyyy-MM-dd` sorts as text. */
export const configChangeRangeValid = (filter: ConfigChangeFilter): boolean => !filter.from || !filter.to || filter.from <= filter.to

export const isFilteredConfigChanges = (filter: ConfigChangeFilter): boolean =>
  Object.values(configChangeParams(filter)).some((v) => v !== '')
