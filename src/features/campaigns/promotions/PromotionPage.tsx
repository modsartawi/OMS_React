import { useState, type ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft, FileSpreadsheet, LayoutTemplate, Plus, Upload } from 'lucide-react'
import { apiErrorCode } from '@/core/api'
import type { RulePromotionSummary } from '@/core/models/rule-promotion'
import { CAMPAIGN_UPLOAD_PATH, PROMOTIONS_PATH, campaignUploadPath } from '@/core/rules/campaign-state'
import { EMPTY_PROMOTION_QUERY, promotionCampaignsBody, promotionQueryFromUrl, urlFromPromotionQuery } from '@/core/rules/promotion-query'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { rulePromotionCampaignsQuery, rulePromotionsQuery } from '@/core/rules/promotion-api'
import CreateCampaignDialog, { type CreateTab } from './CreateCampaignDialog'
import NeverPublishedDrafts from './NeverPublishedDrafts'
import PromotionCampaigns from './PromotionCampaigns'
import { pendingBeyond } from './promotion-page'
import { promotionRowView, type PromotionRowView } from './promotion-row'
import PromotionsRefusal from './PromotionsRefusal'
import PromotionStateBadge from './PromotionStateBadge'

/**
 * A promotion's page (ticket 535; BackOffice brief 2848 D2) — `/campaigns/promotions/:promotionCode`,
 * and `/campaigns/no-promotion` for the hand-built campaigns in no promotion (`promotionCode: null`).
 * One component for both.
 *
 * The header is the promotion's `Promotions/List` row: there is no single-promotion door, so the list
 * query is reused. A code the list does not hold, or one `Promotions/Campaigns` answers 404
 * `RULES_PROMOTION_NOT_FOUND`, is a stale link, said so with the way back. The campaigns are paged and
 * filtered by HQ, every filter in the URL (`./PromotionCampaigns`).
 *
 * An uploaded promotion links its re-upload and its upload; it has no assign, unassign or delete. The
 * no-promotion page keeps the old list's create actions and lists the drafts never published. Grouping
 * is not publishing: there is no promotion budget and no promotion-wide disable.
 */
export default function PromotionPage() {
  const { promotionCode } = useParams()
  // No param: the no-promotion page, the row HQ sends with `promotionCode: null`. Keyed by it, so moving to
  // another promotion starts afresh: no row, search or page of the last one is shown while it loads.
  return <PromotionView key={promotionCode ?? ''} code={promotionCode ?? null} />
}

function PromotionView({ code }: { code: string | null }) {
  const { t } = useTranslation('campaign-promotions')
  const promotions = useQuery(rulePromotionsQuery())
  // HQ keeps codes unique in any case, and the router keeps a typed link's case: match in any case.
  const found = promotions.data?.find((p) => (code === null ? p.promotionCode === null : p.promotionCode?.toLowerCase() === code.toLowerCase()))
  const row = found ? promotionRowView(found) : null

  const { query, update, changedFromOutside } = useUrlQuery(promotionQueryFromUrl, urlFromPromotionQuery)
  // Asked once the row is known, under HQ's spelling of the code.
  const sent = row?.promotionCode ?? null
  const campaigns = useQuery({ ...rulePromotionCampaignsQuery(promotionCampaignsBody(sent, query)), enabled: !!row })
  // "+N pending" weighs the UNFILTERED total: while a filter is on, one row of the whole promotion tells it.
  const filtered = query.q.trim() !== '' || query.mechanic !== '' || query.status !== ''
  const whole = useQuery({ ...rulePromotionCampaignsQuery({ ...promotionCampaignsBody(sent, EMPTY_PROMOTION_QUERY), pageSize: 1 }), enabled: !!row && filtered })
  // A page still shown from the last filter is not the unfiltered total: the one-row read (kept) is.
  const unfilteredTotal = filtered || campaigns.isPlaceholderData ? whole.data?.total : campaigns.data?.total
  const pending = row && unfilteredTotal !== undefined ? pendingBeyond(row.campaignCount, unfilteredTotal) : 0
  const stale = apiErrorCode(campaigns.error) === 'RULES_PROMOTION_NOT_FOUND'

  let body: ReactNode
  if (promotions.isError && !promotions.data) body = <PromotionsRefusal error={promotions.error} at="data-promotion-failed" />
  else if (promotions.isPending) body = <p className="text-sm text-muted-foreground">{t('promotion.loading')}</p>
  // A code the list holds that HQ answers 404 (a stray code: neither a record nor an upload) is a stale link too.
  else if (!row || !found || stale) body = <NotFound />
  else
    body = (
      <>
        <Header row={row} found={found} />
        <section aria-label={t('promotion.tiles.label')} className="grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-2" data-promotion-tiles="">
          <Tile k="campaigns" label={t('promotion.tiles.campaigns')} value={row.campaignCount}>
            {pending > 0 && (
              // dir="auto": the line opens with its isolated count, so its own words, not the page, set its direction.
              <span dir="auto" className="text-xs text-attention-800" data-pending-beyond={pending}>
                <Trans t={t} i18nKey="promotion.tiles.pending" values={{ n: SIGNED.format(pending) }} components={{ n: <Ltr /> }} />
              </span>
            )}
          </Tile>
          <Tile k="skus" label={t('promotion.tiles.skus')} value={row.skuCount} />
          <Tile k="generatedNames" label={t('promotion.tiles.generatedNames')} value={campaigns.data?.generatedNames} />
          {/* BO ask J (BackOffice 2855): shown only once HQ answers it — never a guessed number. */}
          {campaigns.data?.withBudget !== undefined && <Tile k="withBudget" label={t('promotion.tiles.withBudget')} value={campaigns.data.withBudget} />}
        </section>
        <Actions row={row} />
        {row.noPromotion && <NeverPublishedDrafts />}
        <PromotionCampaigns promotionCode={sent} query={query} update={update} changedFromOutside={changedFromOutside} campaigns={campaigns} />
      </>
    )

  return (
    <section className="flex h-full w-full flex-col gap-4" data-campaign-promotion={code ?? ''}>
      <Link to={PROMOTIONS_PATH} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline" data-promotion-back="">
        <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden />
        {t('promotion.back')}
      </Link>
      {body}
    </section>
  )
}

/** A count with its sign (`+12`): the sign is part of the machine value, isolated with it. */
const SIGNED = new Intl.NumberFormat('en-US', { signDisplay: 'always' })

function NotFound() {
  const { t } = useTranslation('campaign-promotions')
  return (
    <p className="text-sm text-muted-foreground" data-promotion-not-found="">
      {t('promotion.notFound')}
    </p>
  )
}

function Header({ row, found }: { row: PromotionRowView; found: RulePromotionSummary }) {
  const { t } = useTranslation('campaign-promotions')
  const note = (found.note ?? '').trim()
  const uploadNote = (found.uploadNote ?? '').trim()
  return (
    <>
      <header className="flex flex-col gap-1" data-promotion-header="">
        <h1 className="text-lg font-semibold tracking-tight">
          {row.noPromotion ? (
            t('list.noPromotion')
          ) : (
            <span className="font-mono">
              <Ltr>{row.promotionCode}</Ltr>
            </span>
          )}
        </h1>
        {row.named && (
          <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground" data-promotion-names="">
            {row.nameEn && <bdi>{row.nameEn}</bdi>}
            {row.nameAr && <bdi>{row.nameAr}</bdi>}
          </p>
        )}
      </header>
      <dl className="flex flex-wrap gap-x-8 gap-y-3">
        {row.kind && (
          <Fact k="kind" label={t('promotion.facts.kind')}>
            {t(`kind.${row.kind}`)}
          </Fact>
        )}
        <Fact k="state" label={t('promotion.facts.state')}>
          <PromotionStateBadge badge={row.badge} />
        </Fact>
        {row.window && (
          <Fact k="window" label={t('promotion.facts.window')}>
            <Ltr>{row.window}</Ltr>
          </Fact>
        )}
        {row.liveVersionNo !== null && (
          <Fact k="liveVersionNo" label={t('promotion.facts.liveVersionNo')}>
            <Ltr>{row.liveVersionNo}</Ltr>
          </Fact>
        )}
        {note && (
          <Fact k="note" label={t('promotion.facts.note')}>
            <bdi>{note}</bdi>
          </Fact>
        )}
        {/* An uploaded promotion's upload note, when it says something the promotion's own does not. */}
        {row.upload && uploadNote && uploadNote !== note && (
          <Fact k="uploadNote" label={t('promotion.facts.uploadNote')}>
            <bdi>{uploadNote}</bdi>
          </Fact>
        )}
      </dl>
    </>
  )
}

function Fact({ k, label, children }: { k: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-promotion-fact={k}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}

/** A figure of the promotion; blank until it is read. */
function Tile({ k, label, value, children }: { k: string; label: string; value: number | undefined; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-start gap-0.5 rounded-lg border border-border/60 bg-card px-3 py-2" data-promotion-tile={k}>
      <span className="font-mono text-xl font-medium tabular-nums" data-tile-count="">
        <Ltr>{value === undefined ? '' : value.toLocaleString('en-US')}</Ltr>
      </span>
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

const LINK = 'inline-flex h-7 items-center gap-1.5 rounded-md border border-border/60 px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent'

/** An uploaded promotion's way to its upload; the no-promotion page's create actions. */
function Actions({ row }: { row: PromotionRowView }) {
  const { t } = useTranslation('campaign-promotions')
  const [creating, setCreating] = useState<CreateTab | null>(null)
  if (row.kind === 'uploaded' && row.promotionCode)
    return (
      <div className="flex flex-wrap items-center gap-2" data-promotion-actions="">
        {/* The workbook names the promotion (its PromotionCode): a re-upload replaces its campaigns. */}
        <Link to={CAMPAIGN_UPLOAD_PATH} className={LINK} data-promotion-reupload="">
          <Upload className="size-3.5" aria-hidden />
          {t('promotion.reupload')}
        </Link>
        <Link to={campaignUploadPath(row.promotionCode)} className={LINK} data-promotion-its-upload="">
          <FileSpreadsheet className="size-3.5" aria-hidden />
          {t('promotion.itsUpload')}
        </Link>
      </div>
    )
  if (!row.noPromotion) return null
  return (
    <div className="flex flex-wrap items-center gap-2" data-promotion-actions="">
      <Button variant="primary" onClick={() => setCreating('blank')} data-new-campaign="">
        <Plus className="size-3.5" aria-hidden />
        {t('create.open')}
      </Button>
      <Button variant="secondary" onClick={() => setCreating('template')} data-from-template="">
        <LayoutTemplate className="size-3.5" aria-hidden />
        {t('create.tabs.template')}
      </Button>
      <CreateCampaignDialog open={creating !== null} startOn={creating ?? 'blank'} onClose={() => setCreating(null)} />
    </div>
  )
}
