import { useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { ArrowLeft, Download, Layers, Loader2, Plus, Ticket, Trash2, Upload } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import type { RuleCampaignBudget, RuleCouponBatchCreated, RuleCouponBatchDeletion, RuleCouponBatchSummary } from '@/core/models/rule-campaign'
import { rememberSavedDraft, ruleCampaignApi, ruleCouponBatchExportKey, ruleCouponBatchExportQuery, ruleCouponBatchesQuery } from '@/core/rules/api'
import { campaignPath } from '@/core/rules/campaign-state'
import { listContextSearch } from '@/core/rules/promotion-query'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import { fsi } from '@/core/util/bidi'
import { toIsoDate } from '@/core/util/date-format'
import { downloadCsv } from '@/core/util/download-file'
import { formatNumber } from '@/core/util/number-format'
import { useWorkspace } from './context'
import { batchColumns, codeColumns, type CouponGridContext } from './coupon-columns'
import { BATCH_CODE_STATUSES, codeCounts, readBatchCsv, statusFromParam, visibleCodes, type BatchCode, type CouponStatusFilter } from './coupon-csv'
import { batchTotals, budgetsToAdd, suggestedTemplate, unusedOf, visibleBatches } from './coupon-form'
import CreateCouponsDialog from './CreateCouponsDialog'
import DeleteUnusedDialog from './DeleteUnusedDialog'
import ImportCouponsDialog from './ImportCouponsDialog'
import { draftSave } from './settings-form'
import { Refusal } from './settings-ui'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import Field from '@/core/ui/Field'

/** The batch just created or imported, for the success modal: HQ's answer, the rows an import left
 *  out, and the budgets the page adds to the draft from it. */
type Created = RuleCouponBatchCreated & { imported: boolean; leftOut: number; adding: RuleCampaignBudget[] }

/**
 * The campaign's Coupons (tickets 515, 516; re-pointed onto BackOffice 2755 in ticket 526), in the
 * menu only when the coupons feature is on. HQ lists a campaign's BATCHES
 * (`CouponBatches/List`: codes, used and disabled counts), not its codes, so the page lists the
 * batches with a search over the batch id and the template; opening one (`?batch=`) reads its codes
 * from HQ's export CSV (`CouponBatches/Export`), searched by code or member and filtered by status.
 *
 * Create coupons and Import CSV make a batch through `CouponBatches/Create`; on success a modal shows
 * HQ's batch id and the count, "Show the codes" opens the batch, and the budgets HQ answered for the
 * dialog's "each code once" / "once per customer" are added to the draft (ADR 0094) and said there.
 * Export saves HQ's CSV as HQ wrote it. With a batch open, Delete unused deletes the codes nobody used
 * (`CouponBatches/DeleteUnused`) after a confirmation, and says what HQ did.
 *
 * The search, the status and the batch live in the URL (`?search=&codeStatus=&batch=`, replaced), so
 * a reload or a link keeps the page as it was; beside them, the promotion's list context the workspace
 * keeps (ticket 537).
 */
export default function CouponsPage() {
  const { t, i18n } = useTranslation('campaign-workspace')
  const { draft: d, listContext, link } = useWorkspace()
  const c = d.campaign
  const queryClient = useQueryClient()
  const couponsOn = d.features.includes('coupons')
  // Its own keys (`search`, `codeStatus`, `batch`) beside the promotion's list context the workspace
  // keeps (`promotion`, `q`, `mechanic`, `status`, `page`; ticket 537), which a change here carries on.
  const [params, setParams] = useSearchParams()
  const q = params.get('search') ?? ''
  const status = statusFromParam(params.get('codeStatus'))
  const batch = params.get('batch') ?? ''
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<Created | null>(null)
  const [importing, setImporting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  /** What the last Delete unused did, said above the list until the next batch is made. */
  const [deleted, setDeleted] = useState<RuleCouponBatchDeletion | null>(null)

  const set = (change: { q?: string; status?: CouponStatusFilter; batch?: string }) => {
    const next = { q, status, batch, ...change }
    const out = new URLSearchParams(listContextSearch(listContext))
    if (next.q) out.set('search', next.q)
    if (next.batch && next.status !== 'all') out.set('codeStatus', next.status)
    if (next.batch) out.set('batch', next.batch)
    setParams(out, { replace: true })
  }
  /** Opens a batch (or, with '', goes back to the batches) with a fresh search; an export refused
   *  for another batch is not this one's. */
  const openBatch = (b: string) => {
    download.reset()
    const out = new URLSearchParams(listContextSearch(listContext))
    if (b) out.set('batch', b)
    setParams(out, { replace: true })
  }

  const batches = useQuery({ ...ruleCouponBatchesQuery(c.id), enabled: couponsOn })
  const list = useMemo(() => batches.data ?? [], [batches.data])
  const shownBatches = useMemo(() => visibleBatches(list, q), [list, q])
  const totals = useMemo(() => batchTotals(list), [list])
  const opened = batch ? list.find((b) => b.batchId === batch) : undefined

  // A batch Delete unused emptied is gone from HQ: its codes are not asked for while the view leaves it.
  const emptied = !!deleted && !deleted.kept && deleted.batchId === batch
  const exported = useQuery({ ...ruleCouponBatchExportQuery(c.id, batch), enabled: couponsOn && !!batch && !emptied })
  // A code past its own last day reads as expired at the reader's local day.
  const today = toIsoDate(new Date())
  const codes = useMemo(() => (exported.data ? readBatchCsv(exported.data.csv, today) : []), [exported.data, today])
  const shownCodes = useMemo(() => visibleCodes(codes, { q, status }), [codes, q, status])
  const counts = useMemo(() => codeCounts(codes), [codes])

  /** Export: HQ's CSV, saved as HQ wrote it, under HQ's file name. Every press asks HQ afresh. */
  const download = useMutation({
    mutationFn: (batchId: string) => ruleCampaignApi.exportBatch(batchId),
    onSuccess: (file) => {
      queryClient.setQueryData(ruleCouponBatchExportKey(c.id, file.batchId), file)
      downloadCsv(file.fileName, file.csv)
    },
  })

  /** The budgets a create answered, added to the draft and saved whole at its revision (ADR 0094).
   *  What the draft already has by then (a save that landed though its answer was lost) is not added
   *  twice; with nothing left to add, nothing is sent. */
  const addBudgets = useMutation({
    mutationFn: async (add: RuleCampaignBudget[]) => {
      const missing = budgetsToAdd(c.budgets, add)
      return missing.length ? ruleCampaignApi.save(draftSave(d, { budgets: [...(c.budgets ?? []), ...missing] })) : null
    },
    onSuccess: (saved) => {
      if (saved) rememberSavedDraft(queryClient, saved)
    },
  })
  /** A new batch waits while the last one's budgets are being saved: its boxes read the draft. */
  const busy = addBudgets.isPending

  const madeBatch = (b: RuleCouponBatchCreated, imported: boolean, leftOut: number) => {
    setDeleted(null)
    download.reset()
    addBudgets.reset()
    // A template of another campaign lists its codes there: its budgets are that campaign's.
    const adding = b.campaign === c.id ? budgetsToAdd(c.budgets, b.budgets) : []
    setCreated({ ...b, imported, leftOut, adding })
    if (adding.length) addBudgets.mutate(adding)
  }

  const batchGridColumns = useMemo(() => batchColumns(t), [t])
  const codeGridColumns = useMemo(() => codeColumns(t), [t])
  const gridContext = useMemo<CouponGridContext>(
    () => ({
      statusLabel: (s) => t(`coupons.status.${s}`),
      onBatch: openBatch,
      batchLabel: (b) => t('coupons.openBatch', { batch: fsi(b) }),
    }),
    // `openBatch` only replaces the URL: the context is new when the language is.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [t],
  )

  if (!couponsOn) {
    return (
      <section className="flex flex-col gap-4" data-coupons-page="off">
        <Header />
        <p className="rounded-lg border border-border/60 bg-card p-4 text-sm" data-coupons-off="">
          <Trans
            t={t}
            i18nKey="coupons.off"
            components={{ features: <Link to={link(`${campaignPath(c.id)}/settings/features`)} className="font-medium text-primary hover:underline" /> }}
          />
        </p>
      </section>
    )
  }

  // The status filters a batch's codes only; on the batch list it is not in force.
  const filtered = !!q || (!!batch && status !== 'all')
  const read = batch ? exported : batches

  return (
    <section className="flex flex-col gap-4" data-coupons-page="">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <Header>
          {batches.data && (
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground" data-coupons-counts="">
              {/* Two sentences, each with its own plural: batches, then codes. */}
              <Trans t={t} i18nKey="coupons.countsBatches" count={totals.batches} values={{ n: formatNumber(totals.batches) }} components={{ n: <Ltr /> }} />{' '}
              <Trans
                t={t}
                i18nKey="coupons.countsCodes"
                count={totals.codes}
                values={{ n: formatNumber(totals.codes), used: formatNumber(totals.used), disabled: formatNumber(totals.disabled) }}
                components={{ n: <Ltr />, used: <Ltr />, disabled: <Ltr /> }}
              />
            </p>
          )}
        </Header>
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outlined" onClick={() => setImporting(true)} disabled={!batches.data || busy} data-coupons-import-open="">
            <Upload className="size-3.5" aria-hidden />
            {t('coupons.import.open')}
          </Button>
          <Button variant="primary" onClick={() => setCreating(true)} disabled={!batches.data || busy} data-coupons-create-open="">
            <Plus className="size-3.5" aria-hidden />
            {t('coupons.create.open')}
          </Button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3" data-coupons-filters="">
        {batch && (
          <Button variant="text" onClick={() => openBatch('')} data-coupons-back="">
            <ArrowLeft className="size-3.5 rtl:rotate-180" aria-hidden />
            {t('coupons.back')}
          </Button>
        )}
        {batch && (
          <span className="inline-flex h-7 items-center gap-1.5 rounded-full border border-primary-border bg-primary-050 px-3 text-xs text-primary-800" data-coupons-batch-chip={batch}>
            <Layers className="h-3.5 w-3.5" aria-hidden />
            <span>
              <Trans t={t} i18nKey="coupons.batchChip" values={{ batch }} components={{ batch: <bdi dir="ltr" className="font-mono" /> }} />
            </span>
          </span>
        )}
        <Field label={t('coupons.search.label')} className="min-w-60">
          <Input
            type="search"
            dir="ltr"
            value={q}
            onChange={(e) => set({ q: e.target.value })}
            placeholder={t(batch ? 'coupons.search.codePlaceholder' : 'coupons.search.batchPlaceholder')}
            className="w-full font-mono"
            data-coupons-search=""
          />
        </Field>
        {batch && (
          <Field label={t('coupons.statusFilter')}>
            <Select value={status} onChange={(e) => set({ status: e.target.value as CouponStatusFilter })} data-coupons-status="">
              <option value="all">{t('coupons.anyStatus')}</option>
              {BATCH_CODE_STATUSES.map((s) => (
                <option key={s} value={s}>
                  {t(`coupons.status.${s}`)}
                </option>
              ))}
            </Select>
          </Field>
        )}
        {batch && (
          <Button variant="outlined" onClick={() => download.mutate(batch)} disabled={download.isPending} data-coupons-export="">
            {download.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
            {t('coupons.export.open')}
          </Button>
        )}
        {batch && (
          <Button
            variant="danger-outlined"
            onClick={() => setDeleting(true)}
            disabled={!opened || !unusedOf(opened)}
            title={opened && !unusedOf(opened) ? t('coupons.deleteUnused.none') : undefined}
            data-coupons-delete-open=""
          >
            <Trash2 className="size-3.5" aria-hidden />
            {t('coupons.deleteUnused.open')}
          </Button>
        )}
        {filtered && (
          <Button variant="text" onClick={() => set({ q: '', status: 'all' })} data-coupons-clear="">
            {t('coupons.clearFilters')}
          </Button>
        )}
      </div>

      {download.isError && !created && (
        <div data-coupons-export-refusal="">
          <Refusal title={t('coupons.export.refusedTitle')} fallback={t('coupons.export.refused')} error={download.error} />
        </div>
      )}

      {deleted && (
        <p className="rounded-md border border-border/60 bg-card px-3 py-2 text-sm" role="status" data-coupons-deleted={deleted.batchId}>
          <Trans
            t={t}
            i18nKey="coupons.deleteUnused.done"
            count={deleted.deleted}
            values={{ n: formatNumber(deleted.deleted), kept: formatNumber(deleted.kept), batch: deleted.batchId }}
            components={{ n: <Ltr />, kept: <Ltr />, batch: <bdi dir="ltr" className="font-mono" /> }}
          />
        </p>
      )}

      {read.isError && (
        <div data-coupons-refusal="">
          <Refusal
            title={t(batch ? 'coupons.codesFailedTitle' : 'coupons.failedTitle')}
            fallback={t('coupons.failed')}
            error={read.error}
          />
          <Button variant="outlined" className="mt-2" onClick={() => void read.refetch()} disabled={read.isFetching} data-coupons-retry="">
            {t('coupons.retry')}
          </Button>
        </div>
      )}

      <div className="flex min-w-0 flex-col gap-1">
        <div className="relative h-[calc(100vh-22rem)] min-h-80" data-coupons-grid={batch ? 'codes' : 'batches'}>
          {batch ? (
            <AgGridReact<BatchCode>
              key="codes"
              theme={omsGridTheme}
              // A failed re-read keeps the codes last read on screen, under its refusal.
              rowData={shownCodes}
              columnDefs={codeGridColumns}
              defaultColDef={CODE_COL_DEF}
              getRowId={({ data }) => data.code}
              context={gridContext}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
              loading={exported.isPending}
              noRowsOverlayComponent={NoRows}
              noRowsOverlayComponentParams={{ any: codes.length > 0, kind: 'codes' }}
              suppressNoRowsOverlay={exported.isError && !exported.data}
            />
          ) : (
            <AgGridReact<RuleCouponBatchSummary>
              key="batches"
              theme={omsGridTheme}
              rowData={shownBatches}
              columnDefs={batchGridColumns}
              defaultColDef={BATCH_COL_DEF}
              getRowId={({ data }) => data.batchId}
              context={gridContext}
              rowHeight={OMS_GRID_ROW_HEIGHT}
              headerHeight={OMS_GRID_HEADER_HEIGHT}
              animateRows={false}
              suppressColumnVirtualisation
              loading={batches.isPending}
              noRowsOverlayComponent={NoRows}
              noRowsOverlayComponentParams={{ any: list.length > 0, kind: 'batches' }}
              suppressNoRowsOverlay={batches.isError && !batches.data}
            />
          )}
        </div>
        {(batch ? exported.data : batches.data) && (
          <div
            className="flex h-7 shrink-0 items-center gap-3 rounded-md border border-border bg-card-2 px-3 text-[11.5px] whitespace-nowrap text-muted-foreground"
            data-coupons-status-bar=""
          >
            <span data-coupons-shown="">
              {batch ? (
                <Trans t={t} i18nKey="coupons.shown" count={codes.length} values={{ n: formatNumber(shownCodes.length), total: formatNumber(codes.length) }} components={{ n: <Ltr />, total: <Ltr /> }} />
              ) : (
                <Trans t={t} i18nKey="coupons.shownBatches" count={list.length} values={{ n: formatNumber(shownBatches.length), total: formatNumber(list.length) }} components={{ n: <Ltr />, total: <Ltr /> }} />
              )}
            </span>
            {batch && exported.data && (
              <span data-coupons-code-counts="">
                <Trans
                  t={t}
                  i18nKey="coupons.codeCounts"
                  values={{ unused: formatNumber(counts.unused), used: formatNumber(counts.used), disabled: formatNumber(counts.disabled), expired: formatNumber(counts.expired) }}
                  components={{ unused: <Ltr />, used: <Ltr />, disabled: <Ltr />, expired: <Ltr /> }}
                />
              </span>
            )}
          </div>
        )}
      </div>

      {creating && (
        // Mounted per create, so the form starts from the batches as last read (the newest template).
        <CreateCouponsDialog
          campaign={c}
          templateId={suggestedTemplate(batches.data)}
          open
          onClose={() => setCreating(false)}
          onCreated={(b) => {
            setCreating(false)
            madeBatch(b, false, 0)
          }}
        />
      )}
      {importing && (
        <ImportCouponsDialog
          campaignId={c.id}
          templateId={suggestedTemplate(batches.data)}
          onClose={() => setImporting(false)}
          onImported={(b, leftOut) => {
            setImporting(false)
            madeBatch(b, true, leftOut)
          }}
        />
      )}
      {deleting && opened && (
        <DeleteUnusedDialog
          campaignId={c.id}
          batch={opened}
          onClose={() => setDeleting(false)}
          onDeleted={(result) => {
            setDeleting(false)
            setDeleted(result)
            // A batch with no code left is gone from HQ (its list and its export): back to the batches.
            if (!result.kept) openBatch('')
          }}
        />
      )}
      {created && (
        <Modal
          open
          onClose={() => setCreated(null)}
          title={t(created.imported ? 'coupons.created.importedTitle' : 'coupons.created.title')}
          width="32rem"
          footer={
            <>
              {!created.imported && (
                <Button
                  variant="text"
                  disabled={busy}
                  onClick={() => {
                    setCreated(null)
                    setCreating(true)
                  }}
                  data-coupons-created-more=""
                >
                  {t('coupons.created.more')}
                </Button>
              )}
              <Button variant="outlined" onClick={() => download.mutate(created.batchId)} disabled={download.isPending} data-coupons-created-export="">
                {download.isPending ? <Loader2 className="size-3.5 animate-spin" aria-hidden /> : <Download className="size-3.5" aria-hidden />}
                {t('coupons.created.export')}
              </Button>
              {/* A batch under another campaign's template is listed there, not here. */}
              {created.campaign === c.id && (
                <Button
                  variant="primary"
                  onClick={() => {
                    openBatch(created.batchId)
                    setCreated(null)
                  }}
                  data-coupons-created-show=""
                >
                  {t('coupons.created.show')}
                </Button>
              )}
            </>
          }
        >
          <div className="flex flex-col gap-3" data-coupons-created={created.batchId}>
            <p className="text-sm">
              <Trans
                t={t}
                i18nKey={created.imported ? 'coupons.created.importedBody' : 'coupons.created.body'}
                count={created.codes.length}
                values={{ n: formatNumber(created.codes.length) }}
                components={{ n: <Ltr /> }}
              />
            </p>
            <p className="rounded-md border border-border/60 bg-muted px-3 py-2 text-center font-mono text-lg font-semibold tracking-wide" data-batch-id="">
              <Ltr>{created.batchId}</Ltr>
            </p>
            {created.leftOut > 0 && (
              <p className="text-sm" data-coupons-created-left-out="">
                <Trans t={t} i18nKey="coupons.created.leftOut" count={created.leftOut} values={{ n: formatNumber(created.leftOut) }} components={{ n: <Ltr /> }} />
              </p>
            )}
            {created.campaign !== c.id && (
              <p className="text-sm text-attention-800" data-coupons-created-elsewhere={created.campaign}>
                <Trans t={t} i18nKey="coupons.created.elsewhere" values={{ campaign: created.campaign }} components={{ campaign: <bdi dir="ltr" className="font-mono" /> }} />
              </p>
            )}
            {created.adding.length > 0 && (
              <div className="flex flex-col gap-1.5 text-sm" data-coupons-created-budgets={addBudgets.isPending ? 'adding' : addBudgets.isError ? 'refused' : 'added'}>
                <p>
                  {t(addBudgets.isPending ? 'coupons.created.budgetsAdding' : addBudgets.isError ? 'coupons.created.budgetsNotAdded' : 'coupons.created.budgetsAdded', {
                    count: created.adding.length,
                  })}
                </p>
                <ul className="list-disc ps-5">
                  {created.adding.map((b) => (
                    <li key={b.id} data-coupons-created-budget={b.id}>
                      <bdi>{saysIn(b.name, i18n.language)}</bdi>
                    </li>
                  ))}
                </ul>
                {addBudgets.isError && (
                  <>
                    <Refusal title={t('coupons.created.budgetsRefusedTitle')} fallback={t('coupons.created.budgetsRefused')} error={addBudgets.error} />
                    <div>
                      <Button variant="outlined" onClick={() => addBudgets.mutate(created.adding)} data-coupons-created-budgets-retry="">
                        {t('coupons.created.budgetsRetry')}
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
            {download.isError && (
              <div data-coupons-export-refusal="">
                <Refusal title={t('coupons.export.refusedTitle')} fallback={t('coupons.export.refused')} error={download.error} />
              </div>
            )}
            <p className="text-sm text-muted-foreground">{t('coupons.created.hint')}</p>
          </div>
        </Modal>
      )}
    </section>
  )
}

function Header({ children }: { children?: ReactNode }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <header>
      <h1 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
        <Ticket className="h-4 w-4 text-muted-foreground" aria-hidden />
        {t('coupons.title')}
      </h1>
      <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t('coupons.intro')}</p>
      {children}
    </header>
  )
}

/** The empty grid: none yet, or none matching the filters. */
function NoRows({ any, kind }: { any: boolean; kind: 'batches' | 'codes' }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <span className="text-sm text-muted-foreground" data-coupons-none="">
      {t(any ? 'coupons.noMatch' : kind === 'batches' ? 'coupons.none' : 'coupons.noCodes')}
    </span>
  )
}

const BATCH_COL_DEF: ColDef<RuleCouponBatchSummary> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}

const CODE_COL_DEF: ColDef<BatchCode> = {
  ...OMS_GRID_BASE_COL_DEF,
  sortable: true,
  resizable: true,
  suppressHeaderMenuButton: true,
}
