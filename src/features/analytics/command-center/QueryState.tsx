import type { ReactNode } from 'react'
import type { UseQueryResult } from '@tanstack/react-query'
import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'

/**
 * A command center read's three states (oms 946-949): waiting (the page's sentence), failed (the server's message, or
 * the page's sentence, through `apiErrorMessage`), or its answer drawn by `children`.
 */
export default function QueryState<T>({
  query,
  loading,
  failed,
  children,
}: {
  query: UseQueryResult<T>
  loading: string
  failed: string
  children: (data: T) => ReactNode
}) {
  if (query.isPending)
    return (
      <p className="text-sm text-muted-foreground" role="status">
        {loading}
      </p>
    )
  if (query.isError) return <ErrorBanner message={apiErrorMessage(query.error, failed)} />
  return <>{children(query.data)}</>
}
