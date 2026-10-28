import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'

import { draftBaseQuery, draftQuery } from './api'
import { draftDiff } from './draft'

/**
 * A master's open draft and its diff against the version it was copied from (oms ticket 645). The draft panel and the
 * items section both call it; the reads are shared through the query cache. `diff` is null until both are read (a
 * draft over no version diffs against nothing: every row added).
 */
export function useDraft(masterId: string) {
  const draft = useQuery(draftQuery(masterId))
  const baseVersionId = draft.data?.baseVersionId ?? null
  const base = useQuery({ ...draftBaseQuery(masterId, baseVersionId ?? ''), enabled: !!draft.data && baseVersionId !== null })
  const rows = draft.data?.rows
  const baseRows = base.data
  const diff = useMemo(() => (rows && (baseVersionId === null || baseRows) ? draftDiff(rows, baseRows ?? []) : null), [rows, baseRows, baseVersionId])
  return { draft, base, diff }
}
