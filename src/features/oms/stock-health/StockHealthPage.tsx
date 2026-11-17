import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ArrowUpRight, Loader2, RefreshCw } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { StockHealthSignal } from '@/core/models/stock-health'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import { canOpenStockHealth, stockHealthAccessQuery } from './access'
import { stockHealthApi } from './api'
import {
  REFRESH_MS,
  asOf,
  figureLabel,
  figureText,
  figuresShown,
  headerLine,
  reasonText,
  tileHref,
  verdictTone,
  type Tone,
  type Translate,
} from './health'

const READ_KEY = ['oms', 'stock-health', 'read'] as const

/**
 * Stock health (oms 908, BackOffice spec 3991, door 3992): whether batch stock is in good shape, one tile per signal in the
 * server's order. The server judges; the page draws. Re-read every 60 seconds and on Refresh.
 *
 * Behind `canOpenStockHealth` on `StockHealth/Access` (`BackOfficeScreen[StockHealth, 03]`, role `STOCK_HEALTH_VIEWER`),
 * failing closed.
 */
export default function StockHealthPage() {
  const { t } = useTranslation('stock-health')
  return (
    <ScreenGate
      query={stockHealthAccessQuery()}
      can={canOpenStockHealth}
      ns="stock-health"
      title={t('title')}
      subtitle={t('subtitle')}
    >
      <Health />
    </ScreenGate>
  )
}

/**
 * Each tone's tile, from tokens only. `noAnswer` is red-OUTLINED on the card ground (never grey: a dead source is not
 * fine); `bad` is the red ground; `neutral` is the plain card a figure-only signal sits on.
 */
const TILE: Record<Tone, string> = {
  good: 'border border-success-border bg-success-050',
  watch: 'border border-attention-border bg-attention-050',
  bad: 'border border-danger-border bg-danger-050',
  noAnswer: 'border-2 border-danger-800 bg-card',
  neutral: 'border border-border bg-card',
}

const BADGE: Record<Tone, string> = {
  good: 'bg-success-800 text-success-050',
  watch: 'bg-attention-800 text-attention-050',
  bad: 'bg-danger-800 text-danger-050',
  noAnswer: 'border border-danger-800 text-danger-800',
  neutral: 'bg-muted text-muted-foreground',
}

const HEADER: Record<'allGood' | 'attention' | 'empty', string> = {
  allGood: 'text-success-800',
  attention: 'text-danger-800',
  empty: 'text-muted-foreground',
}

function Health() {
  const { t } = useTranslation('stock-health')
  const tr = t as unknown as Translate
  const read = useQuery({
    queryKey: READ_KEY,
    queryFn: () => stockHealthApi.read(),
    refetchInterval: REFRESH_MS,
    retry: false,
  })
  const signals = read.data?.signals ?? []
  const header = headerLine(signals)

  return (
    <div className="flex flex-col gap-3">
      <div
        className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-3"
        data-health-header={read.data ? header.kind : 'loading'}
      >
        <div className={`text-base font-semibold ${read.data ? HEADER[header.kind] : 'text-muted-foreground'}`}>
          {!read.data
            ? read.isPending
              ? t('header.loading')
              : ''
            : header.kind === 'attention'
              ? t('header.attention', { n: fsi(String(header.count)) })
              : t(`header.${header.kind}`)}
        </div>
        {read.data?.readAt && (
          <div className="text-sm text-muted-foreground" data-health-as-of="">
            {t('header.asOf', { at: fsi(asOf(read.data.readAt)) })}
          </div>
        )}
        <div className="ms-auto">
          <Button variant="secondary" onClick={() => void read.refetch()} disabled={read.isFetching} data-health-refresh="">
            {read.isFetching ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" aria-hidden />
            )}
            {read.isFetching ? t('refreshing') : t('refresh')}
          </Button>
        </div>
      </div>

      {read.isError && (
        <ErrorBanner className="p-2.5" title={t('failedTitle')} message={apiErrorMessage(read.error, t('failed'))} />
      )}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3" data-health-tiles="">
        {signals.map((s, i) => (
          <Tile key={`${s.key}-${i}`} signal={s} t={tr} />
        ))}
      </div>
    </div>
  )
}

function Tile({ signal, t }: { signal: StockHealthSignal; t: Translate }) {
  const tone = verdictTone(signal.verdict)
  const href = tileHref(signal.link)
  const name = String(t(`signal.${signal.key}`, { defaultValue: signal.key }))
  const verdictWord = String(
    t(`verdict.${signal.verdict ?? 'none'}`, { defaultValue: signal.verdict ?? '' }),
  )
  const figures = figuresShown(signal)

  const body = (
    <>
      <div className="flex items-start justify-between gap-2">
        <h2 className="text-sm font-semibold">{name}</h2>
        <span
          className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${BADGE[tone]}`}
          data-health-verdict=""
        >
          {verdictWord}
        </span>
      </div>
      <p className="text-[0.8125rem]" data-health-reason="">
        <bdi>{reasonText(t, signal)}</bdi>
      </p>
      {figures.length > 0 && (
        <dl className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs" data-health-figures="">
          {figures.map((f, i) => (
            <div key={`${f.label}-${i}`} className="flex flex-col" data-health-figure={f.label}>
              <dt className="text-muted-foreground">{figureLabel(t, signal.key, f.label)}</dt>
              <dd className="font-medium tabular-nums">
                <Ltr>{figureText(f.value)}</Ltr>
              </dd>
            </div>
          ))}
        </dl>
      )}
      {href && (
        <span className="mt-auto inline-flex items-center gap-1 text-xs text-primary-800" aria-hidden>
          <ArrowUpRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
          {String(t('tile.opens'))}
        </span>
      )}
    </>
  )

  const className = `flex min-h-36 flex-col gap-2 rounded-lg p-3 ${TILE[tone]}`
  const data = { 'data-health-tile': signal.key, 'data-tone': tone }
  return href ? (
    <Link to={href} className={`${className} transition-shadow hover:shadow-md focus-visible:outline-2`} {...data}>
      {body}
    </Link>
  ) : (
    <div className={className} {...data}>
      {body}
    </div>
  )
}
