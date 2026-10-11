import { useEffect, useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { IdentityBreakRow } from '@/core/models/sap-export'
import ErrorBanner from '@/core/ui/ErrorBanner'
import GridPager from '@/core/ui/GridPager'
import Ltr from '@/core/ui/Ltr'
import { clampToLastPageWhenCurrentPageEmpties, showsPager } from '@/core/ui/pager'
import { formatDay } from '@/core/util/date-format'
import { identityBreaksQuery } from './api'
import { IDENTITY_BREAK_PAGE_SIZE, identityBreakErrorKey, identityBreakKey } from './identity-break-helpers'
import { figure } from './storeday-helpers'

/**
 * The store's identity breaks (BackOffice spec 2579 story 30, ticket 465), from
 * `GET SapExport/IdentityBreaks`: each piece of export evidence that does not add up to exactly one
 * transaction, by kind with its plain-English meaning, paged at 50. None reads "the books add up".
 *
 * Read live by the door (2583), not from the rollup, so a recompute does not re-read it.
 */
export default function IdentityBreaks({ code }: { code: string }) {
  const { t } = useTranslation('sap-export-console')
  const [page, setPage] = useState(1)
  const list = useQuery(identityBreaksQuery(code, page))

  // 🚩 A failed read draws no rows: the kept previous page belongs to the read before it.
  const shown = list.isError ? undefined : list.data
  const total = shown?.total ?? 0

  // A later read can shrink the list under an inner page; an emptied page falls back to the last.
  const settled = shown && !list.isPlaceholderData ? shown : undefined
  useEffect(() => {
    if (!settled) return
    const last = clampToLastPageWhenCurrentPageEmpties({
      page: settled.page,
      rowCount: settled.items.length,
      totalMatches: settled.total,
      pageSize: IDENTITY_BREAK_PAGE_SIZE,
    })
    if (last !== settled.page) setPage((p) => (p === settled.page ? last : p))
  }, [settled])

  const errorKey = list.isError ? identityBreakErrorKey(apiErrorCode(list.error)) : null

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-identity-breaks="">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <h3 className="text-base font-semibold tracking-tight">{t('identityBreaks.title')}</h3>
          <p className="text-xs text-muted-foreground">{t('identityBreaks.hint')}</p>
        </div>
        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          {list.isPlaceholderData && (
            <span className="inline-flex items-center gap-1" role="status">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('identityBreaks.refreshing')}
            </span>
          )}
          {shown && total > 0 && (
            <span data-identity-breaks-count={total}>
              <Trans t={t} i18nKey="identityBreaks.count" count={total} values={{ n: figure(total) }} components={{ n: <Ltr /> }} />
            </span>
          )}
        </div>
      </div>

      {list.isPending && (
        <div className="flex items-center gap-2 py-3 text-sm text-muted-foreground" role="status">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('identityBreaks.loading')}
        </div>
      )}
      {list.isError && <ErrorBanner className="p-3" message={errorKey ? t(errorKey) : apiErrorMessage(list.error, t('identityBreaks.failed'))} />}

      {shown &&
        (shown.items.length === 0 ? (
          page > 1 ? (
            <p className="py-3 text-sm text-muted-foreground" data-identity-breaks-empty-page="">
              {t('identityBreaks.emptyPage')}
            </p>
          ) : (
            // The all-clear, in the success family: only ever on the first page.
            <p className="rounded-md bg-success-050 px-3 py-2 text-sm text-success-800" data-identity-breaks-empty="">
              {t('identityBreaks.empty')}
            </p>
          )
        ) : (
          <div className="overflow-x-auto rounded-md border border-border/60">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border/60 text-xs text-muted-foreground">
                  <Th>{t('identityBreaks.columns.kind')}</Th>
                  <Th>{t('identityBreaks.columns.trxNumber')}</Th>
                  <Th>{t('identityBreaks.columns.machineCode')}</Th>
                  <Th>{t('identityBreaks.columns.day')}</Th>
                  <Th>{t('identityBreaks.columns.meaning')}</Th>
                </tr>
              </thead>
              <tbody>
                {/* Keyed by position: a duplicate key is two rows with the same store and number. */}
                {shown.items.map((row, i) => (
                  <Row key={`${i}-${row.kind}-${row.trxNumber}`} row={row} />
                ))}
              </tbody>
            </table>
          </div>
        ))}

      {/* Drawn beside an empty or failed inner page too: it is the only way back from one. */}
      {((shown && showsPager(total, IDENTITY_BREAK_PAGE_SIZE)) || page > 1) && (
        <div className="overflow-hidden rounded-md border border-border/60">
          <GridPager
            page={page}
            pageSize={IDENTITY_BREAK_PAGE_SIZE}
            totalMatches={shown ? total : page * IDENTITY_BREAK_PAGE_SIZE}
            busy={list.isPlaceholderData}
            onPage={(p) => setPage(Math.max(1, p))}
          />
        </div>
      )}
    </section>
  )
}

function Th({ children }: { children: ReactNode }) {
  return <th className="px-2 py-1.5 text-start font-medium">{children}</th>
}

function Row({ row }: { row: IdentityBreakRow }) {
  const { t } = useTranslation('sap-export-console')
  const key = identityBreakKey(row.kind)
  const cell = 'px-2 py-1.5 align-top'
  return (
    <tr className="border-b border-border/40 last:border-b-0" data-identity-break={row.kind}>
      <td className={cell + ' whitespace-nowrap font-medium'}>{key ? t(key.name) : <Ltr>{row.kind}</Ltr>}</td>
      <td className={cell + ' font-mono text-xs'} data-identity-break-trx="">
        <Ltr>{row.trxNumber}</Ltr>
      </td>
      <td className={cell + ' font-mono text-xs'}>{row.machineCode && <Ltr>{row.machineCode}</Ltr>}</td>
      <td className={cell + ' whitespace-nowrap font-mono text-xs'}>{row.day && <Ltr>{formatDay(row.day)}</Ltr>}</td>
      <td className={cell + ' text-muted-foreground'} data-identity-break-meaning="">
        {key && t(key.meaning)}
      </td>
    </tr>
  )
}
