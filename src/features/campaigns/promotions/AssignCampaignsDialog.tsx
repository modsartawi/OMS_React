import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'
import { apiErrorMessage, isBareDenial } from '@/core/api'
import type { RulePromotionAssignment } from '@/core/models/rule-promotion'
import { rulePromotionCampaignsQuery } from '@/core/rules/promotion-api'
import { PROMOTION_PAGE_SIZE } from '@/core/rules/promotion-query'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { promotionWriteApi, refreshPromotions } from './api'
import { CAMPAIGN_ROW_STATUS_SEV, campaignRowStatus } from './promotion-page'
import { ASSIGN_MAX, sendable, togglePick } from './promotion-write'
import WriteRefusal from './WriteRefusal'

/** How long typing settles before the search reaches HQ. */
const SEARCH_SETTLE_MS = 300

/**
 * Assign campaigns (ticket 536; BackOffice brief 2848 D3): a search over EVERY campaign
 * (`Promotions/Campaigns { all: true, q }`, the first page of results — no screen pages through the
 * whole list) with a checkbox each, then `Promotions/Assign { promotionCode, campaigns }`. The picks
 * outlive a new search, so campaigns found under two searches go in one call; at most 2,000.
 *
 * All or none: a refusal (an uploaded campaign HQ will not move, a draft never published) shows here,
 * one detail line per campaign, the picks and the promotion as they were. On success the caller says
 * how many were assigned and which were moved from another promotion.
 */
export default function AssignCampaignsDialog({
  promotionCode,
  onClose,
  onAssigned,
}: {
  promotionCode: string
  onClose: () => void
  onAssigned: (reply: RulePromotionAssignment) => void
}) {
  const { t } = useTranslation('campaign-promotions')
  const queryClient = useQueryClient()
  const [typed, setTyped] = useState('')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  useEffect(() => {
    if (typed === q) return
    const timer = setTimeout(() => setQ(typed), SEARCH_SETTLE_MS)
    return () => clearTimeout(timer)
  }, [typed, q])

  const trimmed = q.trim()
  const hits = useQuery(rulePromotionCampaignsQuery({ promotionCode: null, all: true, ...(trimmed ? { q: trimmed } : {}), page: 1, pageSize: PROMOTION_PAGE_SIZE }))
  const assign = useMutation({
    mutationFn: (campaigns: string[]) => promotionWriteApi.assign(promotionCode, campaigns),
    // Read afresh after a refusal too: an unknown or owned campaign may say this page is stale.
    onSettled: () => refreshPromotions(queryClient),
  })
  const close = () => !assign.isPending && onClose()
  const ready = sendable(picked.length) && !assign.isPending
  const pick = (id: string) => {
    setPicked((p) => togglePick(p, id))
    // A refusal was about the picks as they were sent.
    if (assign.isError) assign.reset()
  }
  const rows = hits.data?.campaigns ?? []
  const total = hits.data?.total ?? 0
  const denied = isBareDenial(hits.error)

  return (
    <Modal
      open
      onClose={close}
      title={t('assign.title', { code: fsi(promotionCode) })}
      width="44rem"
      footer={
        <>
          <span className="me-auto text-xs text-muted-foreground" data-assign-picked={picked.length}>
            <Trans t={t} i18nKey="assign.picked" count={picked.length} components={{ n: <Ltr /> }} />
          </span>
          <Button variant="text" disabled={assign.isPending} onClick={close}>
            {t('form.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} onClick={() => ready && assign.mutate(picked, { onSuccess: onAssigned })} data-assign-submit="">
            {assign.isPending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
            {t('assign.submit')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3" data-assign-dialog={promotionCode}>
        <p className="text-sm text-muted-foreground">{t('assign.lede')}</p>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('assign.search')}
          <span className="relative">
            <Search className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" aria-hidden />
            <input
              type="search"
              dir="auto"
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              placeholder={t('assign.placeholder')}
              className="h-9 w-full rounded-md border border-border/60 bg-background ps-8 pe-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
              data-assign-search=""
            />
          </span>
        </label>

        {hits.isError ? (
          <div data-assign-failed="" data-denied={denied ? '' : undefined}>
            <ErrorBanner className="p-2.5" title={denied ? undefined : t('assign.failedTitle')} message={denied ? t('denied') : apiErrorMessage(hits.error, t('assign.failed'))} />
          </div>
        ) : hits.isPending ? (
          <p className="text-sm text-muted-foreground">{t('assign.loading')}</p>
        ) : rows.length === 0 ? (
          <p className="text-sm text-muted-foreground" data-assign-none="">
            {t('assign.none')}
          </p>
        ) : (
          <ul className="flex max-h-80 flex-col overflow-y-auto rounded-md border border-border/60" data-assign-hits={rows.length}>
            {rows.map((r) => {
              const status = campaignRowStatus(r.status)
              return (
                <li key={r.id} className="border-b border-border/40 last:border-b-0">
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-1.5 text-sm hover:bg-accent">
                    {/* A Pending campaign is held by a pending upload only: an upload owns it, so HQ never moves it. */}
                    <input type="checkbox" checked={picked.includes(r.id)} onChange={() => pick(r.id)} disabled={assign.isPending || status === 'Pending'} data-assign-pick={r.id} />
                    <span className="min-w-0 flex-1">
                      <span className="block font-mono text-xs font-medium">
                        <Ltr>{r.id}</Ltr>
                      </span>
                      <span className="flex flex-wrap gap-x-3 text-xs text-muted-foreground">
                        {r.nameEn && <bdi>{r.nameEn}</bdi>}
                        {r.nameAr && <bdi>{r.nameAr}</bdi>}
                      </span>
                    </span>
                    <StatusBadge sev={CAMPAIGN_ROW_STATUS_SEV[status]}>{t(`promotion.status.${status}`)}</StatusBadge>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
        {total > rows.length && (
          <p className="text-xs text-muted-foreground" data-assign-more="">
            <Trans
              t={t}
              i18nKey="assign.more"
              values={{ shown: rows.length.toLocaleString('en-US'), total: total.toLocaleString('en-US') }}
              components={{ shown: <Ltr />, total: <Ltr /> }}
            />
          </p>
        )}
        {picked.length > ASSIGN_MAX && (
          <p className="text-xs text-danger-800" data-assign-too-many="">
            {t('assign.tooMany')}
          </p>
        )}
        {assign.isError && <WriteRefusal title={t('assign.refusedTitle')} error={assign.error} />}
      </div>
    </Modal>
  )
}
