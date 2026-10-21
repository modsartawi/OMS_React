import { useMemo, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useNavigate, useParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef, ICellRendererParams } from 'ag-grid-community'
import { ArrowLeft, Loader2 } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type { RuleUploadActivation, RuleUploadCampaignItem, RuleUploadDetail, RuleUploadSummary } from '@/core/models/rule-upload'
import { RULE_CAMPAIGNS_KEY, RULE_PROMOTIONS_KEY } from '@/core/rules/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { windowDays } from '@/core/rules/wire-days'
import { formatDateTime } from '@/core/util/date-format'
import { CAMPAIGN_UPLOADS_PATH } from '@/core/rules/campaign-state'
import { CAMPAIGN_UPLOADS_KEY, campaignUploadKey, campaignUploadQuery } from './api'
import CampaignJsonDrawer from './CampaignJsonDrawer'
import { Fact, Tile } from './ReadReport'
import ReviewDialog from './ReviewDialog'
import { CHANGE_SEV, compareCampaign, isKnownStacking, type ReviewAction } from './review'
import UploadStateBadge from './UploadStateBadge'

/**
 * Campaigns ▸ Campaign uploads ▸ one promotion's upload (ticket 532; BackOffice brief 2839 U3), from
 * `Uploads/Load`: the summary, the last review, each campaign beside the live one of its id, the
 * live campaigns an activation disables, and what it would refuse now. An approver activates the
 * WHOLE upload as one ruleset version, or sends it back with a note — never one campaign of it, and
 * nothing of it is edited here: the fix for a bad campaign is a new workbook.
 *
 * The buttons show on a pending upload (they follow its state, never a guessed role): there is no
 * access probe, so a session without the approver's grant is refused by HQ with a bare 403, which
 * the dialog names. Four-eyes is HQ's too (`RULES_SELF_APPROVAL`).
 */
export default function UploadPage() {
  const { promotionCode = '' } = useParams()
  // Keyed: another promotion's page starts with no activation line and no dialog.
  return <OpenedUpload key={promotionCode} promotionCode={promotionCode} />
}

function OpenedUpload({ promotionCode }: { promotionCode: string }) {
  const { t } = useTranslation('campaign-uploads')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const upload = useQuery(campaignUploadQuery(promotionCode))
  const [dialog, setDialog] = useState<ReviewAction | null>(null)
  const [activation, setActivation] = useState<RuleUploadActivation | null>(null)
  const [sentBack, setSentBack] = useState(false)
  const [compare, setCompare] = useState<RuleUploadCampaignItem | null>(null)

  const refresh = () => void queryClient.invalidateQueries({ queryKey: CAMPAIGN_UPLOADS_KEY })

  const onActivated = (done: RuleUploadActivation) => {
    setDialog(null)
    setSentBack(false)
    setActivation(done)
    refresh()
    // The new version holds every campaign of the promotion: its campaigns, Versions and the promotions
    // (their lists and pages) read again.
    void queryClient.invalidateQueries({ queryKey: RULE_CAMPAIGNS_KEY })
    void queryClient.invalidateQueries({ queryKey: RULE_PROMOTIONS_KEY })
  }
  const onSentBack = (summary: RuleUploadSummary) => {
    setDialog(null)
    setActivation(null)
    setSentBack(true)
    queryClient.setQueryData<RuleUploadDetail>(campaignUploadKey(promotionCode), (old) => (old ? { ...old, upload: summary } : old))
    refresh()
  }

  return (
    <section className="flex w-full max-w-7xl flex-col gap-4" data-campaign-upload-review={promotionCode}>
      <Link to={CAMPAIGN_UPLOADS_PATH} className="inline-flex w-fit items-center gap-1 text-sm font-medium text-primary hover:underline" data-review-back="">
        <ArrowLeft className="size-3.5 rtl:-scale-x-100" aria-hidden />
        {t('review.back')}
      </Link>
      <header className="flex flex-wrap items-center gap-2">
        <h1 className="text-lg font-semibold tracking-tight">{t('review.title')}</h1>
        <span className="font-mono text-lg font-semibold">
          <Ltr>{promotionCode}</Ltr>
        </span>
        {upload.data && <UploadStateBadge state={upload.data.upload.state} />}
      </header>

      {/* A failed refetch keeps the upload already shown (and the activation line); only an upload
          never read is replaced by the refusal. */}
      {upload.isPending ? (
        <p role="status" className="inline-flex items-center gap-2 text-sm text-muted-foreground" data-review-loading="">
          <Loader2 className="size-3.5 animate-spin" aria-hidden />
          {t('review.loading')}
        </p>
      ) : !upload.data ? (
        <LoadFailure error={upload.error} />
      ) : (
        <>
          {activation && <Activated activation={activation} />}
          {sentBack && (
            <p role="status" className="rounded-lg border border-border bg-muted p-3 text-sm font-medium" data-review-sent-back="">
              {t('review.sentBack')}
            </p>
          )}
          <Summary upload={upload.data.upload} />
          {upload.data.upload.reviewedBy && <LastReview upload={upload.data.upload} />}
          <Campaigns items={upload.data.campaigns} onOpen={setCompare} />
          {upload.data.disabling.length > 0 && <Disabling items={upload.data.disabling} onOpen={setCompare} />}
          {upload.data.errors.length > 0 && <WouldRefuse lines={upload.data.errors} />}

          {upload.data.upload.state === 'pending' ? (
            // Held while the upload is read again: an act must be on the revision now loaded.
            <div className="flex flex-wrap items-center gap-2" data-review-actions="">
              <Button variant="primary" disabled={upload.isFetching} onClick={() => setDialog('activate')} data-review-action="activate">
                {t('review.actions.activate')}
              </Button>
              <Button variant="secondary" disabled={upload.isFetching} onClick={() => setDialog('sendBack')} data-review-action="sendBack">
                {t('review.actions.sendBack')}
              </Button>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground" data-review-not-pending="">
              {t('review.actions.notPending')}
            </p>
          )}

          {dialog && (
            <ReviewDialog
              key={dialog}
              detail={upload.data}
              action={dialog}
              onClose={() => setDialog(null)}
              onSendBack={() => setDialog('sendBack')}
              onReload={() => {
                setDialog(null)
                refresh()
              }}
              onList={() => navigate(CAMPAIGN_UPLOADS_PATH)}
              onActivated={onActivated}
              onSentBack={onSentBack}
            />
          )}
        </>
      )}

      {compare && (
        <CampaignJsonDrawer
          id={compare.id}
          eyebrow={t('compare.eyebrow')}
          sides={[
            { key: 'uploaded', label: t('compare.uploaded'), campaign: compare.campaign, none: t('compare.notUploaded') },
            { key: 'live', label: t('compare.live'), campaign: compare.live, none: t('compare.notLive') },
          ]}
          onClose={() => setCompare(null)}
        />
      )}
    </section>
  )
}

/** Load refused: the missing grant in our words, a stale link with the way back, else HQ's message. */
function LoadFailure({ error }: { error: unknown }) {
  const { t } = useTranslation('campaign-uploads')
  const denied = isBareDenial(error)
  const notFound = apiErrorCode(error) === 'RULES_UPLOAD_NOT_FOUND'
  return (
    <div data-review-failed={denied ? 'denied' : notFound ? 'notFound' : 'failed'} data-upload-denied={denied ? '' : undefined}>
      <ErrorBanner
        className="p-2.5"
        title={denied || notFound ? undefined : t('review.failedTitle')}
        message={denied ? t('denied') : notFound ? t('review.notFound') : apiErrorMessage(error, t('review.failed'))}
      />
    </div>
  )
}

/** "Version N is live: A campaigns activated, D disabled", each number isolated, and the checker's warnings. */
function Activated({ activation: a }: { activation: RuleUploadActivation }) {
  const { t } = useTranslation('campaign-uploads')
  return (
    <div role="status" className="flex flex-col gap-2 rounded-lg border border-success-border bg-success-050 p-4 text-success-800" data-review-activated="">
      <p className="text-base font-semibold" data-review-activated-line="">
        <Trans
          t={t}
          i18nKey="review.activated.line"
          count={a.activated.length}
          values={{ version: a.versionNo, disabled: a.disabled.length }}
          components={{ version: <Ltr />, activated: <Ltr />, disabled: <Ltr /> }}
        />
      </p>
      <p className="text-sm" data-review-activated-by="">
        <Trans t={t} i18nKey="review.activated.by" values={{ by: a.publishedBy, at: formatDateTime(a.publishedAt) }} components={{ by: <Ltr />, at: <Ltr /> }} />
      </p>
      {a.warnings.length > 0 && (
        <div className="text-sm" data-review-activated-warnings={a.warnings.length}>
          <p className="font-medium">{t('review.activated.warnings')}</p>
          <ul className="list-disc ps-5">
            {a.warnings.map((w, i) => (
              <li key={i}>
                <bdi>{w}</bdi>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

function Summary({ upload: u }: { upload: RuleUploadSummary }) {
  const { t } = useTranslation('campaign-uploads')
  const days = windowDays(u.windowFrom, u.windowUntil)
  const mechanics = Object.entries(u.summary?.mechanics ?? {})
  const generated = u.summary?.generatedNames ?? 0
  const warnings = u.summary?.warnings ?? []
  return (
    <section className="flex flex-col gap-3" data-review-summary="">
      <h2 className="text-sm font-semibold">{t('review.summary.title')}</h2>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4" data-review-header="">
        <Fact k="promotion" label={t('review.summary.promotion')}>
          <span className="font-mono font-medium">
            <Ltr>{u.promotionCode}</Ltr>
          </span>
        </Fact>
        <Fact k="state" label={t('review.summary.state')}>
          <UploadStateBadge state={u.state} />
        </Fact>
        <Fact k="revision" label={t('review.summary.revision')}>
          <Ltr>{u.revision}</Ltr>
        </Fact>
        <Fact k="stacking" label={t('review.summary.stacking')}>
          {/* The grid's words for a listed stacking; an unlisted one as sent. */}
          {isKnownStacking(u.stacking) ? t(`stacking.${u.stacking}`) : <Ltr>{u.stacking}</Ltr>}
        </Fact>
        <Fact k="note" label={t('review.summary.note')}>
          <bdi>{u.note}</bdi>
        </Fact>
        <Fact k="file" label={t('review.summary.file')}>
          <bdi>{u.fileName}</bdi>
        </Fact>
        <Fact k="uploadedBy" label={t('review.summary.uploadedBy')}>
          <Ltr>{u.uploadedBy}</Ltr>
        </Fact>
        <Fact k="uploadedAt" label={t('review.summary.uploadedAt')}>
          <Ltr>{formatDateTime(u.uploadedAt)}</Ltr>
        </Fact>
      </dl>

      <ul className="flex flex-wrap gap-2" aria-label={t('review.summary.tiles')} data-review-tiles="">
        <Tile k="campaigns" label={t('review.summary.campaigns')}>
          <Ltr>{u.campaignCount}</Ltr>
        </Tile>
        {mechanics.map(([mechanic, count]) => (
          // The workbook's own word (a closed list HQ may grow): shown as sent, every key it holds.
          <Tile key={mechanic} k={`mechanic:${mechanic}`} label={<Ltr>{mechanic}</Ltr>} title={t('review.summary.mechanicTile')}>
            <Ltr>{count}</Ltr>
          </Tile>
        ))}
        <Tile k="generated" label={t('review.summary.generated')}>
          <span className="inline-flex items-center gap-2">
            <Ltr>{generated}</Ltr>
            {generated > 0 && (
              <span data-review-generated-flag="">
                <StatusBadge sev="warn">{t('review.summary.generatedFlag')}</StatusBadge>
              </span>
            )}
          </span>
        </Tile>
        <Tile k="skus" label={t('review.summary.skus')}>
          <Ltr>{u.skuCount}</Ltr>
        </Tile>
        <Tile k="window" label={t('review.summary.window')}>
          {days ? <Ltr>{days}</Ltr> : <span className="text-muted-foreground">{t('review.summary.noWindow')}</span>}
        </Tile>
      </ul>

      <div className="flex flex-col gap-1" data-review-warnings={warnings.length}>
        <h3 className="text-xs font-semibold">{t('review.summary.warnings')}</h3>
        {warnings.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('review.summary.noWarnings')}</p>
        ) : (
          <ul className="flex flex-col gap-0.5 text-sm">
            {warnings.map((w, i) => (
              <li key={i} className="flex flex-wrap gap-x-2" data-review-warning="">
                <span className="font-mono text-xs text-muted-foreground">
                  <Ltr>{w.at}</Ltr>
                </span>
                <bdi>{w.message}</bdi>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}

function LastReview({ upload: u }: { upload: RuleUploadSummary }) {
  const { t } = useTranslation('campaign-uploads')
  return (
    <section className="flex flex-col gap-2" data-review-last="">
      <h2 className="text-sm font-semibold">{t('review.lastReview.title')}</h2>
      <dl className="grid grid-cols-2 gap-3 rounded-lg border border-border bg-card p-4 sm:grid-cols-4">
        <Fact k="reviewedBy" label={t('review.lastReview.by')}>
          <Ltr>{u.reviewedBy}</Ltr>
        </Fact>
        <Fact k="reviewedAt" label={t('review.lastReview.at')}>
          <Ltr>{formatDateTime(u.reviewedAt)}</Ltr>
        </Fact>
        <Fact k="reviewNote" label={t('review.lastReview.note')}>
          <bdi>{u.reviewNote}</bdi>
        </Fact>
        {u.versionNo > 0 && (
          <Fact k="versionNo" label={t('review.lastReview.version')}>
            <Ltr>{u.versionNo}</Ltr>
          </Fact>
        )}
      </dl>
    </section>
  )
}

interface CampaignsContext {
  open: (item: RuleUploadCampaignItem) => void
}

function ChangeCell({ data }: ICellRendererParams<RuleUploadCampaignItem>) {
  const { t } = useTranslation('campaign-uploads')
  if (!data) return null
  const change = compareCampaign(data)
  return (
    <span data-review-change={change}>
      <StatusBadge sev={CHANGE_SEV[change]}>{t(`review.campaigns.change.${change}`)}</StatusBadge>
    </span>
  )
}

function CompareCell({ context, data }: ICellRendererParams<RuleUploadCampaignItem, unknown, CampaignsContext>) {
  const { t } = useTranslation('campaign-uploads')
  if (!data) return null
  return (
    <button
      type="button"
      onClick={() => context.open(data)}
      className="font-medium text-primary hover:underline"
      data-review-compare={data.id}
    >
      {t('review.campaigns.compare')}
    </button>
  )
}

const CAMPAIGN_COL_DEF: ColDef<RuleUploadCampaignItem> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

/** The upload's campaigns, each against the live one of its id; a row opens both side by side. */
function Campaigns({ items, onOpen }: { items: RuleUploadCampaignItem[]; onOpen: (item: RuleUploadCampaignItem) => void }) {
  const { t } = useTranslation('campaign-uploads')
  const context = useMemo((): CampaignsContext => ({ open: onOpen }), [onOpen])
  const columns = useMemo(
    (): ColDef<RuleUploadCampaignItem>[] => [
      { colId: 'id', field: 'id', headerName: t('review.campaigns.columns.id'), flex: 1, minWidth: 280, cellClass: 'font-mono' },
      {
        colId: 'stacking',
        headerName: t('review.campaigns.columns.stacking'),
        valueGetter: ({ data }) => (data ? t(data.competes ? 'stacking.compete' : 'stacking.stacks') : ''),
        width: 130,
      },
      {
        colId: 'change',
        headerName: t('review.campaigns.columns.change'),
        valueGetter: ({ data }) => (data ? compareCampaign(data) : ''),
        cellRenderer: ChangeCell,
        width: 150,
      },
      { colId: 'compare', headerName: t('review.campaigns.columns.compare'), cellRenderer: CompareCell, width: 110, sortable: false },
    ],
    [t],
  )
  return (
    <section className="flex flex-col gap-2" data-review-campaigns={items.length}>
      <h2 className="text-sm font-semibold">{t('review.campaigns.title')}</h2>
      <p className="text-xs text-muted-foreground">{t('review.campaigns.lede')}</p>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('review.campaigns.none')}</p>
      ) : (
        <div data-review-campaigns-grid="">
          <AgGridReact<RuleUploadCampaignItem>
            theme={omsGridTheme}
            rowData={items}
            columnDefs={columns}
            defaultColDef={CAMPAIGN_COL_DEF}
            context={context}
            getRowId={({ data }) => data.id}
            onRowClicked={({ data, event }) => {
              // The Compare button opens it itself: AG Grid's row listener fires before React's.
              if ((event?.target as Element | null)?.closest?.('button')) return
              if (data) onOpen(data)
            }}
            rowClass="cursor-pointer"
            rowHeight={OMS_GRID_ROW_HEIGHT}
            headerHeight={OMS_GRID_HEADER_HEIGHT}
            animateRows={false}
            suppressColumnVirtualisation
            domLayout="autoHeight"
          />
        </div>
      )}
    </section>
  )
}

/** The promotion's live campaigns the upload no longer holds, red: an activation switches them off. */
function Disabling({ items, onOpen }: { items: RuleUploadCampaignItem[]; onOpen: (item: RuleUploadCampaignItem) => void }) {
  const { t } = useTranslation('campaign-uploads')
  return (
    <section className="flex flex-col gap-2 rounded-lg border-2 border-danger-border bg-danger-050 p-4 text-danger-800" data-review-disabling={items.length}>
      <h2 className="text-sm font-semibold" data-review-disabling-title="">
        <Trans t={t} i18nKey="review.disabling.title" count={items.length} components={{ n: <Ltr /> }} />
      </h2>
      <ul className="flex flex-col gap-1">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 text-sm" data-review-disabling-id={item.id}>
            <span className="font-mono">
              <Ltr>{item.id}</Ltr>
            </span>
            <button type="button" onClick={() => onOpen(item)} className="text-xs font-medium underline" data-review-disabling-view={item.id}>
              {t('review.disabling.view')}
            </button>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** What an activation would refuse now, HQ's lines as sent (a stale-order line first). */
function WouldRefuse({ lines }: { lines: string[] }) {
  const { t } = useTranslation('campaign-uploads')
  return (
    <section className="flex flex-col gap-1.5 rounded-lg border border-danger-border p-4" data-review-would-refuse={lines.length}>
      <h2 className="text-sm font-semibold text-danger-800">{t('review.refuse.title')}</h2>
      <ul className="flex list-disc flex-col gap-0.5 ps-5 text-sm">
        {lines.map((line, i) => (
          <li key={i} data-review-would-refuse-line="">
            <bdi>{line}</bdi>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">{t('review.refuse.hint')}</p>
    </section>
  )
}
