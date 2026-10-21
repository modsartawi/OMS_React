import type { ReactNode } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useParams } from 'react-router'
import { ArrowLeft } from 'lucide-react'
import { PROMOTIONS_PATH } from '@/core/rules/campaign-state'
import Ltr from '@/core/ui/Ltr'
import { promotionsQuery } from './api'
import { promotionRowView } from './promotion-row'
import PromotionsRefusal from './PromotionsRefusal'
import PromotionStateBadge from './PromotionStateBadge'

/**
 * A promotion's page — `/campaigns/promotions/:promotionCode`, and `/campaigns/no-promotion` for the
 * hand-built campaigns in no promotion (ticket 534 routes the list's rows here; ticket 535 lists the
 * campaigns from `Promotions/Campaigns`). One component for both.
 *
 * The header is the promotion's `Promotions/List` row: there is no single-promotion door, so the list
 * query is reused. A code the list does not hold is a stale link, said so with the way back.
 */
export default function PromotionPage() {
  const { t } = useTranslation('campaign-promotions')
  const { promotionCode } = useParams()
  // No param: the no-promotion page, the row HQ sends with `promotionCode: null`.
  const code = promotionCode ?? null
  const promotions = useQuery(promotionsQuery())
  // HQ keeps codes unique in any case, and the router keeps a typed link's case: match in any case.
  const found = promotions.data?.find((p) => (code === null ? p.promotionCode === null : p.promotionCode?.toLowerCase() === code.toLowerCase()))
  const row = found ? promotionRowView(found) : null

  let body: ReactNode
  if (promotions.isError && !promotions.data)
    body = <PromotionsRefusal error={promotions.error} at="data-promotion-failed" />
  else if (promotions.isPending) body = <p className="text-sm text-muted-foreground">{t('promotion.loading')}</p>
  else if (!row)
    body = (
      <p className="text-sm text-muted-foreground" data-promotion-not-found="">
        {t('promotion.notFound')}
      </p>
    )
  else
    body = (
      <>
        <header className="flex flex-col gap-1" data-promotion-header="">
          <h1 className="text-lg font-semibold tracking-tight">
            {row.noPromotion ? t('list.noPromotion') : <span className="font-mono">
                <Ltr>{row.promotionCode}</Ltr>
              </span>}
          </h1>
          {row.named && (
            <p className="flex flex-wrap gap-x-3 text-sm text-muted-foreground" data-promotion-names="">
              {row.nameEn && <bdi>{row.nameEn}</bdi>}
              {row.nameAr && <bdi>{row.nameAr}</bdi>}
            </p>
          )}
        </header>
        <dl className="flex flex-wrap gap-x-8 gap-y-3">
          {row.kind && <Fact k="kind" label={t('promotion.facts.kind')}>{t(`kind.${row.kind}`)}</Fact>}
          <Fact k="state" label={t('promotion.facts.state')}>
            <PromotionStateBadge badge={row.badge} />
          </Fact>
          {row.window && (
            <Fact k="window" label={t('promotion.facts.window')}>
              <Ltr>{row.window}</Ltr>
            </Fact>
          )}
          <Fact k="campaignCount" label={t('promotion.facts.campaignCount')}>
            <Ltr>{row.campaignCount}</Ltr>
          </Fact>
          <Fact k="skuCount" label={t('promotion.facts.skuCount')}>
            <Ltr>{row.skuCount}</Ltr>
          </Fact>
          {row.liveVersionNo !== null && (
            <Fact k="liveVersionNo" label={t('promotion.facts.liveVersionNo')}>
              <Ltr>{row.liveVersionNo}</Ltr>
            </Fact>
          )}
        </dl>
        <p className="text-sm text-muted-foreground">{t('promotion.campaignsLater')}</p>
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

function Fact({ k, label, children }: { k: string; label: string; children: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-0.5" data-promotion-fact={k}>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm break-words">{children}</dd>
    </div>
  )
}
