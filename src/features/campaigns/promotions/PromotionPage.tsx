import { Fragment, useState, type ReactNode } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { ArrowLeft, FileSpreadsheet, LayoutTemplate, ListPlus, ListX, Pencil, Plus, Trash2, Upload } from 'lucide-react'
import { apiErrorCode } from '@/core/api'
import type { RulePromotionSummary } from '@/core/models/rule-promotion'
import { CAMPAIGN_UPLOAD_PATH, PROMOTIONS_PATH, campaignUploadPath } from '@/core/rules/campaign-state'
import { EMPTY_PROMOTION_QUERY, findRulePromotion, promotionCampaignsBody, promotionQueryFromUrl, urlFromPromotionQuery } from '@/core/rules/promotion-query'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import Ltr from '@/core/ui/Ltr'
import { useUrlQuery } from '@/core/ui/use-url-query'
import { rulePromotionCampaignsQuery, rulePromotionsQuery } from '@/core/rules/promotion-api'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import { promotionWriteApi, refreshPromotions } from './api'
import AssignCampaignsDialog from './AssignCampaignsDialog'
import ConfirmWriteDialog from './ConfirmWriteDialog'
import CreateCampaignDialog, { type CreateTab } from './CreateCampaignDialog'
import NeverPublishedDrafts from './NeverPublishedDrafts'
import PromotionCampaigns from './PromotionCampaigns'
import { pendingBeyond } from './promotion-page'
import { promotionRowView, type PromotionRowView } from './promotion-row'
import PromotionFormDialog from './PromotionFormDialog'
import { assignmentLine, assignmentSummary, promotionEmptiness, type AssignmentSummary, type PromotionEmptiness } from './promotion-write'
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
 * An uploaded promotion links its re-upload and its upload, and may be renamed (names and note); it has
 * no assign, unassign or delete — its campaigns are its upload's. A hand-made promotion (ticket 536)
 * is renamed, assigned campaigns (a search over every campaign), unassigned the ticked rows and
 * deleted once empty; every write happens at once and its refusal reads in the dialog that made it.
 * The buttons are offered to every reader: there is no access probe, so the author's grant is HQ's to
 * check. The no-promotion page keeps the old list's create actions and lists the drafts never
 * published. Grouping is not publishing: there is no promotion budget and no promotion-wide disable.
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
  const found = findRulePromotion(promotions.data, code)
  const row = found ? promotionRowView(found) : null

  const { query, update, changedFromOutside } = useUrlQuery(promotionQueryFromUrl, urlFromPromotionQuery)
  // Asked once the row is known, under HQ's spelling of the code.
  const sent = row?.promotionCode ?? null
  const campaigns = useQuery({ ...rulePromotionCampaignsQuery(promotionCampaignsBody(sent, query)), enabled: !!row })
  // "+N pending" weighs the UNFILTERED total: while a filter is on, one row of the whole promotion tells it.
  const filtered = query.q.trim() !== '' || query.mechanic !== '' || query.status !== ''
  const whole = useQuery({ ...rulePromotionCampaignsQuery({ ...promotionCampaignsBody(sent, EMPTY_PROMOTION_QUERY), pageSize: 1 }), enabled: !!row && filtered })
  // A page still shown while the next loads may be the last filter's: the one-row read (cached once a filter
  // was on) is the unfiltered total, and without one the shown page is unfiltered too, so "+N" holds on a page turn.
  const unfilteredTotal = filtered ? whole.data?.total : campaigns.isPlaceholderData ? (whole.data?.total ?? campaigns.data?.total) : campaigns.data?.total
  const pending = row && unfilteredTotal !== undefined ? pendingBeyond(row.campaignCount, unfilteredTotal) : 0
  const stale = apiErrorCode(campaigns.error) === 'RULES_PROMOTION_NOT_FOUND'
  // The ticked rows (a hand-made promotion's, for Unassign) and what the last write did.
  const [ticked, setTicked] = useState<string[]>([])
  const [done, setDone] = useState<WriteDone | null>(null)
  // Delete is offered only once empty; the hint only once it is known to hold campaigns.
  const emptiness = row ? promotionEmptiness(row.campaignCount, unfilteredTotal) : 'unknown'

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
        <Actions row={row} found={found} ticked={ticked} emptiness={emptiness} onDone={setDone} onUnassigned={() => setTicked([])} />
        {done && <Done done={done} />}
        {row.noPromotion && <NeverPublishedDrafts />}
        <PromotionCampaigns
          promotionCode={sent}
          query={query}
          update={update}
          changedFromOutside={changedFromOutside}
          campaigns={campaigns}
          onTicked={row.kind === 'handMade' ? setTicked : undefined}
        />
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

/** A link that sits among the page's outlined actions: the outlined Button's look (594), on a router `<Link>`. */
const LINK = buttonClass('outlined')

/** What the last write on this page did, said under the actions until the next one. */
type WriteDone = { kind: 'assigned'; summary: AssignmentSummary } | { kind: 'unassigned'; count: number } | { kind: 'renamed' }

function Done({ done }: { done: WriteDone }) {
  const { t } = useTranslation('campaign-promotions')
  return (
    // dir="auto": the line opens with an isolated count, so its own words, not the page, set its direction.
    <p role="status" dir="auto" className="rounded-lg border border-success-border bg-success-050 px-3 py-2 text-sm text-success-800" data-promotion-done={done.kind}>
      {done.kind === 'assigned'
        ? // "3 assigned, 1 moved from X": each count and each promotion isolated, the words carrying the order;
          // the parts are joined by the locale's own joiner, never a comma written here.
          assignmentLine(done.summary).map((part, i) => (
            <Fragment key={i}>
              {i > 0 && t('assign.joiner')}
              {part.key === 'assign.done' ? (
                <Trans t={t} i18nKey={part.key} values={{ n: part.count.toLocaleString('en-US') }} components={{ n: <Ltr /> }} />
              ) : (
                <Trans t={t} i18nKey={part.key} values={{ n: part.count.toLocaleString('en-US'), from: part.from }} components={{ n: <Ltr />, from: <Ltr /> }} />
              )}
            </Fragment>
          ))
        : done.kind === 'unassigned'
          ? <Trans t={t} i18nKey="unassign.done" count={done.count} values={{ n: done.count.toLocaleString('en-US') }} components={{ n: <Ltr /> }} />
          : t('rename.done')}
    </p>
  )
}

type Writing = 'rename' | 'assign' | 'unassign' | 'remove'

/**
 * A promotion's actions: Rename on any promotion (names and note); an uploaded one's way to its
 * upload; a hand-made one's Assign, Unassign (the ticked rows) and Delete (only once empty); the
 * no-promotion page's create actions.
 */
function Actions({
  row,
  found,
  ticked,
  emptiness,
  onDone,
  onUnassigned,
}: {
  row: PromotionRowView
  found: RulePromotionSummary
  ticked: string[]
  emptiness: PromotionEmptiness
  onDone: (done: WriteDone | null) => void
  /** The ticked campaigns are out: no tick is left to send again. */
  onUnassigned: () => void
}) {
  const { t } = useTranslation('campaign-promotions')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState<CreateTab | null>(null)
  const [writing, setWriting] = useState<Writing | null>(null)
  const code = row.promotionCode
  const start = (w: Writing) => {
    onDone(null)
    setWriting(w)
  }
  const finish = (done: WriteDone) => {
    setWriting(null)
    onDone(done)
  }

  if (code && (row.kind === 'uploaded' || row.kind === 'handMade')) {
    const handMade = row.kind === 'handMade'
    return (
      <div className="flex flex-wrap items-center gap-2" data-promotion-actions="">
        {!handMade && (
          <>
            {/* The workbook names the promotion (its PromotionCode): a re-upload replaces its campaigns. */}
            <Link to={CAMPAIGN_UPLOAD_PATH} className={LINK} data-promotion-reupload="">
              <Upload className="size-3.5" aria-hidden />
              {t('promotion.reupload')}
            </Link>
            <Link to={campaignUploadPath(code)} className={LINK} data-promotion-its-upload="">
              <FileSpreadsheet className="size-3.5" aria-hidden />
              {t('promotion.itsUpload')}
            </Link>
          </>
        )}
        {handMade && (
          <>
            <Button variant="primary" onClick={() => start('assign')} data-promotion-assign="">
              <ListPlus className="size-3.5" aria-hidden />
              {t('assign.open')}
            </Button>
            <Button variant="secondary" disabled={ticked.length === 0} onClick={() => start('unassign')} data-promotion-unassign={ticked.length}>
              <ListX className="size-3.5" aria-hidden />
              {t('unassign.open')}
            </Button>
          </>
        )}
        <Button variant="secondary" onClick={() => start('rename')} data-promotion-rename="">
          <Pencil className="size-3.5" aria-hidden />
          {t('rename.open')}
        </Button>
        {handMade && (
          <>
            <Button variant="danger-outlined" disabled={emptiness !== 'empty'} onClick={() => start('remove')} data-promotion-delete="">
              <Trash2 className="size-3.5" aria-hidden />
              {t('remove.open')}
            </Button>
            {emptiness === 'held' && (
              <span className="text-xs text-muted-foreground" data-promotion-delete-hint="">
                {t('remove.notEmpty')}
              </span>
            )}
          </>
        )}

        {writing === 'rename' && (
          <PromotionFormDialog
            mode="rename"
            initial={{ promotionCode: code, nameEn: found.nameEn ?? '', nameAr: found.nameAr ?? '', note: found.note ?? '' }}
            onClose={() => setWriting(null)}
            onSaved={() => finish({ kind: 'renamed' })}
          />
        )}
        {writing === 'assign' && (
          <AssignCampaignsDialog
            promotionCode={code}
            onClose={() => setWriting(null)}
            onAssigned={(reply) => finish({ kind: 'assigned', summary: assignmentSummary(reply) })}
          />
        )}
        {writing === 'unassign' && (
          <ConfirmWriteDialog
            title={t('unassign.title')}
            confirm={t('unassign.submit')}
            refusedTitle={t('unassign.refusedTitle')}
            run={() => promotionWriteApi.unassign(ticked)}
            onClose={() => setWriting(null)}
            onDone={(reply) => {
              onUnassigned()
              finish({ kind: 'unassigned', count: reply.changed.length })
            }}
            data="unassign"
          >
            <Trans t={t} i18nKey="unassign.body" count={ticked.length} values={{ n: ticked.length.toLocaleString('en-US'), code }} components={{ n: <Ltr />, code: <Ltr /> }} />
          </ConfirmWriteDialog>
        )}
        {writing === 'remove' && (
          <ConfirmWriteDialog
            title={t('remove.title')}
            confirm={t('remove.submit')}
            refusedTitle={t('remove.refusedTitle')}
            run={() => promotionWriteApi.remove(code)}
            onClose={() => setWriting(null)}
            onDone={() => {
              setWriting(null)
              notify.success(t('remove.done', { code: fsi(code) }))
              navigate(PROMOTIONS_PATH)
              // The page may still be mounted this tick: the deleted promotion's campaigns are left out, so HQ is not asked for them (a 404).
              void refreshPromotions(queryClient, code)
            }}
            danger
            leaves
            data="remove"
          >
            <Trans t={t} i18nKey="remove.body" values={{ code }} components={{ code: <Ltr /> }} />
          </ConfirmWriteDialog>
        )}
      </div>
    )
  }
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
