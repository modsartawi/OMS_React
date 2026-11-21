import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { formatMoneyIn } from '@/core/money'
import {
  MATCH_URL_MAX,
  PRICE_MATCHING_ERRORS,
  type MatchingCandidate,
  type MatchingQueueItem,
  type PriceWatchCoverage,
} from '@/core/models/price-watch'
import { usePermissions } from '@/core/permissions'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair, fsi } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { canManagePriceWatch } from './access'
import { priceMatchingApi, priceWatchSharedApi } from './api'
import {
  MATCHING_ACTIONS,
  NO_DECISIONS,
  applyDecision,
  closeMaterial,
  confirmByUrl,
  coverageView,
  currentPair,
  requestDiscovery,
  sendDecision,
  suggestedByMindsite,
  urlProblem,
  type MatchingAction,
  type MatchingDecision,
  type MatchingDecisions,
  type MatchingPair,
} from './matching'

const NS = 'price-command-center'
/** The coverage read is shared with the Alerts tab's competitor filter (same key, one request). */
export const COVERAGE_KEY = ['price-watch', 'coverage'] as const
export const queueKey = (competitor: string) => ['price-watch', 'matching', 'queue', competitor] as const
/** Refusals that mean the queue moved since it was read: read it again rather than keep deciding on old rows. */
const STALE_CODES: readonly string[] = [
  PRICE_MATCHING_ERRORS.candidateClosed,
  PRICE_MATCHING_ERRORS.materialAlreadyMatched,
  PRICE_MATCHING_ERRORS.materialNotCarried,
]

/**
 * The Matching tab (oms 937, BackOffice spec 4127 decision 8; doors BO 3501): pick a competitor, then work its queue in
 * our sales order — each candidate beside our product, decided Exact, Comparable, Not the same, or the material Not
 * carried; confirm a product match by URL; request discovery for the competitor; coverage per competitor. A Mindsite
 * suggestion (BO 4135, GUESSED) is labelled. Every action needs the Manage grant (`PriceWatch:06`).
 */
export default function MatchingTab() {
  const { t } = useTranslation(NS)
  const client = useQueryClient()
  const canManage = canManagePriceWatch(usePermissions())
  const coverage = useQuery({ queryKey: COVERAGE_KEY, queryFn: () => priceWatchSharedApi.coverage(), retry: false })
  const rows = coverage.data ?? []
  const [picked, setPicked] = useState('')
  const competitor = rows.some((r) => r.competitorCode === picked) ? picked : (rows[0]?.competitorCode ?? '')

  return (
    <div className="flex flex-col gap-4" data-price-matching="">
      {coverage.isError ? (
        <ErrorBanner className="p-3" title={t('matching.coverage.failed')} message={apiErrorMessage(coverage.error, t('matching.queue.failedHint'))} />
      ) : coverage.isPending ? (
        <p className="text-sm text-muted-foreground">{t('matching.coverage.loading')}</p>
      ) : rows.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('matching.noCompetitors')}</p>
      ) : (
        <>
          <CoverageTable rows={rows} picked={competitor} />
          <div className="flex flex-wrap items-end gap-3">
            <Field label={t('matching.competitor')} className="w-64">
              <Select value={competitor} onChange={(e) => setPicked(e.target.value)} data-matching-competitor="">
                {rows.map((r) => (
                  <option key={r.competitorCode} value={r.competitorCode}>
                    {fsi(formatPair(r.competitorCode, r.competitorName))}
                  </option>
                ))}
              </Select>
            </Field>
            {canManage && <DiscoveryButton competitor={competitor} />}
          </div>
          {/* Keyed by competitor: a new pick starts a fresh queue page with no decisions carried over. */}
          <QueueWorker key={competitor} competitor={competitor} canManage={canManage} onDecided={() => void client.invalidateQueries({ queryKey: COVERAGE_KEY })} />
        </>
      )}
    </div>
  )
}

/** Coverage per competitor: matched (exact + comparable), not carried, still open. */
export function CoverageTable({ rows, picked }: { rows: readonly PriceWatchCoverage[]; picked: string }) {
  const { t } = useTranslation(NS)
  const th = 'px-2 py-1.5 text-start text-xs font-medium text-muted-foreground'
  const td = 'px-2 py-1.5 tabular-nums'
  return (
    <section aria-label={t('matching.coverage.title')} className="overflow-x-auto rounded-lg border border-border/60">
      <table className="w-full text-sm" data-matching-coverage="">
        <thead className="bg-muted/40">
          <tr>
            <th className={th}>{t('matching.coverage.competitor')}</th>
            <th className={th}>{t('matching.coverage.watched')}</th>
            <th className={th} title={t('matching.coverage.matchedHint')}>
              {t('matching.coverage.matched')}
            </th>
            <th className={th}>{t('matching.coverage.notCarried')}</th>
            <th className={th}>{t('matching.coverage.open')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(coverageView).map((row) => (
            <tr
              key={row.competitorCode}
              className={'border-t border-border/60 ' + (row.competitorCode === picked ? 'bg-accent/40' : '')}
              data-coverage-row={row.competitorCode}
            >
              <td className="px-2 py-1.5">
                <Ltr>{formatPair(row.competitorCode, row.competitorName)}</Ltr>
              </td>
              <td className={td}>
                <Ltr>{formatFigure(row.watched)}</Ltr>
              </td>
              <td className={td} data-coverage-matched={row.matched}>
                <Ltr>{formatFigure(row.matched)}</Ltr>
              </td>
              <td className={td} data-coverage-not-carried={row.notCarried}>
                <Ltr>{formatFigure(row.notCarried)}</Ltr>
              </td>
              <td className={td} data-coverage-open={row.open}>
                <Ltr>{formatFigure(row.open)}</Ltr>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

/** Request discovery for the picked competitor — the wire asks per competitor, not per material. */
function DiscoveryButton({ competitor }: { competitor: string }) {
  const { t } = useTranslation(NS)
  const discovery = useMutation({
    mutationFn: () => requestDiscovery(competitor),
    onSuccess: (r) => toast.success(t('matching.discovery.requested', { n: fsi(formatFigure(r.requested)) })),
    onError: (err) => toast.error(apiErrorMessage(err, t('matching.refused'))),
  })
  return (
    <Button
      variant="outlined"
      title={t('matching.discovery.hint')}
      disabled={discovery.isPending}
      onClick={() => discovery.mutate()}
      data-matching-discovery=""
    >
      {discovery.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
      {t('matching.discovery.request')}
    </Button>
  )
}

/** One competitor's queue page, worked pair by pair. */
function QueueWorker({ competitor, canManage, onDecided }: { competitor: string; canManage: boolean; onDecided: () => void }) {
  const { t } = useTranslation(NS)
  const queue = useQuery({ queryKey: queueKey(competitor), queryFn: () => priceMatchingApi.queue(competitor), retry: false })
  const [decisions, setDecisions] = useState<MatchingDecisions>(NO_DECISIONS)
  const [refusal, setRefusal] = useState<unknown>(null)

  const reread = () => {
    setDecisions(NO_DECISIONS)
    void queue.refetch()
  }
  const refused = (err: unknown) => {
    setRefusal(err)
    const code = apiErrorCode(err)
    if (code && STALE_CODES.includes(code)) reread()
  }
  const decide = useMutation({
    mutationFn: (decision: MatchingDecision) => sendDecision(competitor, decision),
    onSuccess: (_r, decision) => {
      setRefusal(null)
      setDecisions((d) => applyDecision(d, decision))
      toast.success(t(`matching.done.${decision.action}`))
      onDecided()
    },
    onError: refused,
  })
  const byUrl = useMutation({
    mutationFn: ({ item, url }: { item: MatchingQueueItem; url: string }) => confirmByUrl(competitor, item, url),
    onSuccess: (_r, { item }) => {
      setRefusal(null)
      setDecisions((d) => closeMaterial(d, item.materialNumber))
      toast.success(t('matching.done.confirmed'))
      onDecided()
    },
    onError: refused,
  })

  if (queue.isError)
    return <ErrorBanner className="p-3" title={t('matching.queue.failed')} message={apiErrorMessage(queue.error, t('matching.queue.failedHint'))} />
  if (queue.isPending) return <p className="text-sm text-muted-foreground">{t('matching.queue.loading')}</p>
  const pair = currentPair(queue.data.items, decisions)
  const busy = decide.isPending || byUrl.isPending

  return (
    <section aria-label={t('matching.queue.title')} className="flex flex-col gap-3" data-matching-queue={competitor}>
      <p className="text-xs text-muted-foreground" data-queue-open={queue.data.open}>
        {t('matching.queue.open', {
          n: fsi(formatFigure(queue.data.open)),
          competitor: fsi(formatPair(queue.data.competitorCode, queue.data.competitorName)),
        })}
      </p>
      {refusal != null && <MatchingRefusal err={refusal} />}
      {pair ? (
        <QueueCard
          key={pair.item.materialNumber}
          pair={pair}
          canManage={canManage}
          busy={busy}
          onDecide={(action) => !busy && decide.mutate({ action, item: pair.item, candidate: pair.candidate })}
          onConfirmUrl={(url) => !busy && byUrl.mutate({ item: pair.item, url })}
        />
      ) : (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/40 p-4 text-sm text-muted-foreground">
          <span data-queue-done={queue.data.items.length === 0 ? 'empty' : 'page'}>
            {queue.data.items.length === 0 ? t('matching.queue.empty') : t('matching.queue.pageDone')}
          </span>
          <Button variant="outlined" onClick={reread} data-queue-reload="">
            {t('matching.queue.reload')}
          </Button>
        </div>
      )}
    </section>
  )
}

/** A refused decision: the server's sentence and its code; a moved queue says it was read again. */
function MatchingRefusal({ err }: { err: unknown }) {
  const { t } = useTranslation(NS)
  const code = apiErrorCode(err)
  const stale = code != null && STALE_CODES.includes(code)
  return (
    <ErrorBanner className="p-3" title={t('matching.refused')} message={stale ? t('matching.stale') : apiErrorMessage(err, t('matching.queue.failedHint'))}>
      {code && (
        <span className="font-mono text-xs" data-matching-refusal={code}>
          <Ltr>{code}</Ltr>
        </span>
      )}
    </ErrorBanner>
  )
}

/** The pair up now: our product beside the candidate, and — with the Manage grant — the decisions. */
export function QueueCard({
  pair,
  canManage,
  busy,
  onDecide,
  onConfirmUrl,
}: {
  pair: MatchingPair
  canManage: boolean
  busy: boolean
  onDecide: (action: MatchingAction) => void
  onConfirmUrl: (url: string) => void
}) {
  const { t } = useTranslation(NS)
  const { item, candidate } = pair
  const index = candidate ? [...item.candidates].sort((a, b) => a.rank - b.rank).indexOf(candidate) + 1 : 0
  // Not carried is about the material; the other three need a candidate.
  const actions = MATCHING_ACTIONS.filter((a) => a === 'notCarried' || candidate !== null)
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3" data-queue-item={item.materialNumber}>
      <div className="grid gap-3 md:grid-cols-2">
        <OurSide item={item} />
        {candidate ? (
          <div className="flex flex-col gap-1" data-queue-candidate={candidate.candidateId}>
            <span className="text-xs text-muted-foreground">
              {t('matching.candidateOf', { n: fsi(formatFigure(index)), of: fsi(formatFigure(item.candidates.length)) })}
            </span>
            <CandidateSide candidate={candidate} />
          </div>
        ) : (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground" data-queue-no-candidate="">
            {t('matching.noCandidate')}
          </p>
        )}
      </div>
      {canManage && (
        <div className="flex flex-col gap-3 border-t border-border/60 pt-3">
          <div role="group" aria-label={t('matching.action.label')} className="flex flex-wrap gap-1.5">
            {actions.map((action) => (
              <Button
                key={action}
                variant={action === 'exact' ? 'primary' : 'outlined'}
                disabled={busy}
                onClick={() => onDecide(action)}
                data-matching-action={action}
              >
                {t(`matching.action.${action}`)}
              </Button>
            ))}
            {busy && <Loader2 className="h-4 w-4 animate-spin self-center text-muted-foreground" aria-hidden />}
          </div>
          <ConfirmByUrlForm busy={busy} onConfirm={onConfirmUrl} />
        </div>
      )}
    </article>
  )
}

/** Confirm by URL: the listing's https address, checked as the server checks it (PWT-00002) before it is sent. */
function ConfirmByUrlForm({ busy, onConfirm }: { busy: boolean; onConfirm: (url: string) => void }) {
  const { t } = useTranslation(NS)
  const [url, setUrl] = useState('')
  const problem = urlProblem(url)
  const shown = url.trim() && problem ? t(`matching.url.problem.${problem}`, { max: fsi(formatFigure(MATCH_URL_MAX)) }) : undefined
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault()
        if (!problem && !busy) onConfirm(url)
      }}
      data-matching-url-form=""
    >
      <Field label={t('matching.url.label')} hint={shown ? undefined : t('matching.url.hint')} error={shown} invalid={!!shown} className="min-w-72 flex-1">
        <Input value={url} onChange={(e) => setUrl(e.target.value)} dir="ltr" inputMode="url" data-matching-url="" />
      </Field>
      <Button type="submit" variant="outlined" disabled={busy || problem !== null} data-matching-url-confirm="">
        {t('matching.url.confirm')}
      </Button>
    </form>
  )
}

/** Our product: image (none on our side today), material, title, size, barcodes, effective price. */
export function OurSide({ item }: { item: MatchingQueueItem }) {
  const { t } = useTranslation(NS)
  const ours = item.ours
  return (
    <div className="flex gap-3" data-queue-ours="">
      <ProductImage url={ours.imageUrl} />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="text-xs font-medium text-muted-foreground">{t('matching.ours')}</span>
        <span className="font-mono text-xs">
          <Ltr>{item.materialNumber}</Ltr>
        </span>
        <span className="font-medium">
          <bdi>{ours.title}</bdi>
        </span>
        {ours.brand && (
          <span className="text-xs text-muted-foreground">
            <bdi>{ours.brand}</bdi>
          </span>
        )}
        <Labelled label={t('matching.size')}>
          <Ltr>{sizeOf(ours.sizeValue, ours.sizeUnit)}</Ltr>
        </Labelled>
        <Barcodes codes={ours.barcodes} />
        {ours.effectivePrice !== null && (
          <Labelled label={t('matching.price')}>
            <Ltr>{formatMoneyIn(ours.effectivePrice, ours.currency)}</Ltr>
          </Labelled>
        )}
        <span className="flex flex-wrap gap-1.5 text-xs text-muted-foreground">
          <span>{t('matching.queue.salesRank', { rank: fsi(formatFigure(item.salesRank)) })}</span>
          {item.isAddition && <StatusBadge sev="mute">{t('matching.queue.addition')}</StatusBadge>}
        </span>
      </div>
    </div>
  )
}

/** The competitor's listing: the Mindsite label when it is one, image, title, size, barcodes, price, seller. */
export function CandidateSide({ candidate }: { candidate: MatchingCandidate }) {
  const { t } = useTranslation(NS)
  const price = candidate.offerPrice ?? candidate.regularPrice
  return (
    <div className="flex gap-3" data-queue-theirs="">
      <ProductImage url={candidate.imageUrl} />
      <div className="flex min-w-0 flex-col gap-1 text-sm">
        <span className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-muted-foreground">
          {t('matching.theirs')}
          {suggestedByMindsite(candidate) && (
            <span title={t('matching.mindsiteHint')} data-mindsite-suggested="">
              <StatusBadge sev="go">{t('matching.mindsite')}</StatusBadge>
            </span>
          )}
        </span>
        <span className="font-medium">
          <bdi>{candidate.title}</bdi>
        </span>
        {candidate.brand && (
          <span className="text-xs text-muted-foreground">
            <bdi>{candidate.brand}</bdi>
          </span>
        )}
        <Labelled label={t('matching.size')}>
          <bdi>{candidate.sizeText || sizeOf(candidate.sizeValue, candidate.sizeUnit)}</bdi>
        </Labelled>
        <Barcodes codes={candidate.barcodes} />
        {price !== null && (
          <Labelled label={t('matching.price')}>
            <Ltr>{formatMoneyIn(price, candidate.currency)}</Ltr>
          </Labelled>
        )}
        {candidate.sellerName && (
          <Labelled label={t('matching.seller')}>
            <bdi>{candidate.sellerName}</bdi>
          </Labelled>
        )}
        {!candidate.inStock && (
          <span>
            <StatusBadge sev="warn">{t('matching.outOfStock')}</StatusBadge>
          </span>
        )}
        {candidate.url && (
          <a
            href={candidate.url}
            target="_blank"
            rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-primary underline-offset-2 hover:underline"
            data-queue-listing=""
          >
            {t('matching.openListing')}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
        )}
      </div>
    </div>
  )
}

/** "24 piece" — one machine value; '' when the size is unknown. */
const sizeOf = (value: number, unit: string) => (value > 0 ? `${formatFigure(value)} ${unit}`.trim() : '')

function ProductImage({ url }: { url: string }) {
  const { t } = useTranslation(NS)
  if (!url)
    return (
      <div className="flex h-24 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border text-center text-xs text-muted-foreground">
        {t('matching.noImage')}
      </div>
    )
  return <img src={url} alt={t('matching.imageAlt')} loading="lazy" referrerPolicy="no-referrer" className="h-24 w-24 shrink-0 rounded-md border border-border/60 object-contain" />
}

function Barcodes({ codes }: { codes: readonly string[] }) {
  const { t } = useTranslation(NS)
  return (
    <Labelled label={t('matching.barcodes')}>
      {codes.length === 0 ? (
        <span className="text-muted-foreground">{t('matching.noBarcode')}</span>
      ) : (
        <span className="flex flex-wrap gap-1.5 font-mono" data-barcodes="">
          {codes.map((code) => (
            <Ltr key={code}>{code}</Ltr>
          ))}
        </span>
      )}
    </Labelled>
  )
}

function Labelled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-baseline gap-1.5 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}
