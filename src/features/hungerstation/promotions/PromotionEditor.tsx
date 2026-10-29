import { useId, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import type { ColDef } from 'ag-grid-community'
import { ClipboardPaste, Loader2, Save, Send } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { OMS_GRID_BASE_COL_DEF } from '@/core/theme/grid-base'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { fieldRefusal } from '@/core/hungerstation/reason'
import ReasonDialog, { InlineRefusal } from '@/core/hungerstation/ReasonDialog'
import ImportDialog, { type ImportReading } from '@/core/import/ImportDialog'
import {
  HUNGERSTATION_ERRORS,
  HUNGERSTATION_PROMOTION_ERRORS,
  HUNGERSTATION_PROMOTION_MAX_SKUS,
  type HungerStationPromotionDetail,
  type HungerStationPromotionItemInput,
  type HungerStationPromotionStoreChoice,
} from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { PROMOTIONS_KEY, promotionKey, promotionsApi, promotionStoresKey } from './api'
import { PromotionStatusBadge } from './columns'
import { pickEndDay, windowProblem, type LocalWindow } from './local-window'
import { discountText } from './promotion-display'
import { DISCOUNT_SUBTYPES, HS_REASONS, emptyForm, formFromDetail, formProblems, saveBody, toggleStore, type FormField, type PromotionForm } from './promotion-form'
import { rowRefusals } from './row-refusals'
import { itemOf, readStrikethrough, STRIKETHROUGH_COLUMNS, type StrikethroughColumn } from './strikethrough-columns'

/**
 * The **strikethrough promotion editor** (ticket 666, BackOffice spec 3201 / 3211), on `?edit=new`
 * or `?edit=<promotionId>`. The chain comes first; the stores and materials that follow are that
 * chain's. Then the header (name, EN + AR display names, HungerStation reason, limits, the Saudi
 * local window, the default discount), the stores picker (every HungerStation store of the chain
 * ticked by default — frozen when sent) and the items, pasted from Excel through the core import
 * dialog with the strikethrough column spec.
 *
 * **Save draft** (create, then update) any number of times — nothing reaches HungerStation.
 * **Send** with a reason, once the draft is saved as it reads; the promotion then reads Sending and
 * the editor hands over to the detail. A promotion that is not a draft is shown, never edited here
 * (a live one's edits are 670's). Every write carries a reason (DHS-00008, inline).
 *
 * 🚩 The doors are not built (BackOffice 3211): proven against stubs only.
 */
export default function PromotionEditor({
  promotionId,
  chains,
  chainsKnown,
  onClose,
  onSaved,
  onSent,
}: {
  /** `null` for a new promotion. */
  promotionId: string | null
  /** The chain keys to offer: the `Chains` read, or the chains seen on the list. */
  chains: readonly string[]
  /** `chains` is the `Chains` read — every chain. Otherwise a chain may also be typed. */
  chainsKnown: boolean
  onClose: () => void
  /** A new promotion was saved: the URL takes its id. */
  onSaved: (promotionId: string) => void
  /** Sent: the detail takes over. */
  onSent: (promotionId: string) => void
}) {
  const { t } = useTranslation('hungerstation-promotions')
  const titleId = useId()
  const detail = useQuery({
    queryKey: promotionKey(promotionId ?? ''),
    queryFn: () => promotionsApi.detail(promotionId!),
    enabled: promotionId !== null,
    retry: false,
  })

  return (
    <SideSheet onClose={onClose} width="w-[76rem]" aria-labelledby={titleId} data-promotion-editor={promotionId ?? 'new'}>
      <SideSheetHeader
        titleId={titleId}
        eyebrow={t('editor.eyebrow')}
        title={promotionId === null ? t('editor.newTitle') : detail.data ? <bdi>{detail.data.name}</bdi> : <Ltr>{promotionId}</Ltr>}
        closeLabel={t('detail.close')}
        onClose={onClose}
        closeData={{ 'data-editor-close': '' }}
      />
      {promotionId !== null && detail.isPending ? (
        <p className="flex items-center gap-2 p-4 text-sm text-muted-foreground" data-editor-loading="">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('detail.loading')}
        </p>
      ) : promotionId !== null && detail.isError ? (
        <div className="p-4" data-editor-error={apiErrorCode(detail.error) ?? ''}>
          <ErrorBanner
            className="p-3"
            title={t('detail.failed')}
            message={
              apiErrorCode(detail.error) === HUNGERSTATION_PROMOTION_ERRORS.noSuchPromotion ? t('detail.notFound') : apiErrorMessage(detail.error, t('results.failed'))
            }
          />
        </div>
      ) : (
        <EditorBody
          // A fresh form per promotion read: a save answers the detail, which re-seeds it.
          key={promotionId ?? 'new'}
          saved={detail.data ?? null}
          chains={chains}
          chainsKnown={chainsKnown}
          onSaved={onSaved}
          onSent={onSent}
        />
      )}
    </SideSheet>
  )
}

const ITEM_COL_DEF: ColDef<HungerStationPromotionItemInput> = { ...OMS_GRID_BASE_COL_DEF, sortable: true, resizable: true, suppressHeaderMenuButton: true }

function EditorBody({
  saved,
  chains,
  chainsKnown,
  onSaved,
  onSent,
}: {
  saved: HungerStationPromotionDetail | null
  chains: readonly string[]
  chainsKnown: boolean
  onSaved: (promotionId: string) => void
  onSent: (promotionId: string) => void
}) {
  const { t } = useTranslation('hungerstation-promotions')
  const qc = useQueryClient()
  const [form, setForm] = useState<PromotionForm>(() => (saved ? formFromDetail(saved) : emptyForm(new Date())))
  // What the server holds, to tell a saved draft from one edited since.
  const [savedForm, setSavedForm] = useState(() => (saved ? JSON.stringify(formFromDetail(saved)) : null))
  const [promotion, setPromotion] = useState(saved)
  const [chainText, setChainText] = useState(form.chainKey)
  const [dialog, setDialog] = useState<'items' | 'save' | 'send' | null>(null)
  const [storeQ, setStoreQ] = useState('')

  const set = <F extends keyof PromotionForm>(field: F, value: PromotionForm[F]) => setForm((f) => ({ ...f, [field]: value }))
  const setWindow = (w: LocalWindow) => set('window', w)

  // 🔑 Only a draft is edited here, and nothing while a part is Sending.
  const status = promotion?.status ?? 'draft'
  const editable = status === 'draft'
  const dirty = savedForm !== JSON.stringify(form)
  const problems = formProblems(form, new Date())
  const bad = (f: FormField) => problems.includes(f)

  const stores = useQuery({
    queryKey: promotionStoresKey(form.chainKey),
    queryFn: () => promotionsApi.stores(form.chainKey),
    enabled: form.chainKey.trim() !== '',
    retry: false,
  })
  const storeChoices = useMemo(() => stores.data ?? [], [stores.data])
  const storeCodes = useMemo(() => storeChoices.map((s) => s.storeCode), [storeChoices])

  const settle = (answer: HungerStationPromotionDetail) => {
    qc.setQueryData(promotionKey(answer.promotionId), answer)
    void qc.invalidateQueries({ queryKey: PROMOTIONS_KEY })
    setPromotion(answer)
  }

  const save = useMutation({
    mutationFn: (reason: string) => {
      const body = saveBody(form, reason)
      return promotion ? promotionsApi.save(promotion.promotionId, body) : promotionsApi.create(body)
    },
    onSuccess: (answer) => {
      settle(answer)
      // The form stays as typed; it is now what the server holds.
      setSavedForm(JSON.stringify(form))
      setDialog(null)
      if (!promotion) onSaved(answer.promotionId)
    },
  })
  const send = useMutation({
    mutationFn: (reason: string) => promotionsApi.send(promotion!.promotionId, { reason }),
    onSuccess: (answer) => {
      settle(answer)
      setDialog(null)
      onSent(answer.promotionId)
    },
  })

  const nameRefusal = fieldRefusal(save.error, [HUNGERSTATION_PROMOTION_ERRORS.nameInUse], t('editor.failedHint'))
  const chainRefusal =
    fieldRefusal(save.error, [HUNGERSTATION_ERRORS.noSuchChain], t('editor.failedHint')) ??
    fieldRefusal(stores.error, [HUNGERSTATION_ERRORS.noSuchChain], t('editor.failedHint'))
  const refusedRows = useMemo(() => rowRefusals(send.error), [send.error])

  const changeChain = (chainKey: string) => {
    setForm((f) => (f.chainKey === chainKey ? f : { ...f, chainKey, stores: 'all' }))
    save.reset()
  }

  const itemColumns = useMemo<ColDef<HungerStationPromotionItemInput>[]>(
    () => [
      { colId: 'material', headerName: t('editor.items.material'), field: 'materialNumber', width: 160 },
      {
        colId: 'subtype',
        headerName: t('editor.items.subtype'),
        width: 180,
        valueGetter: ({ data }) => (data ? t(`subtypes.${data.subtype ?? form.defaultSubtype}`) : ''),
        cellClassRules: { 'text-muted-foreground italic': ({ data }) => data?.subtype === null },
      },
      {
        colId: 'value',
        headerName: t('editor.items.value'),
        width: 140,
        type: 'rightAligned',
        valueGetter: ({ data }) => {
          if (!data) return ''
          const value = data.value ?? (form.defaultValue.trim() === '' ? null : Number(form.defaultValue))
          return discountText(data.subtype ?? form.defaultSubtype, value)
        },
        cellClassRules: { 'text-muted-foreground italic': ({ data }) => data?.value === null },
      },
      { colId: 'maxQuantity', headerName: t('editor.items.maxQuantity'), width: 120, type: 'rightAligned', valueGetter: ({ data }) => (data?.maxQuantity == null ? '' : figure(data.maxQuantity)) },
      {
        colId: 'refusal',
        headerName: t('editor.items.refusal'),
        flex: 1,
        minWidth: 260,
        valueGetter: ({ data }) => (data ? (refusedRows.get(data.materialNumber) ?? []).map((p) => p.message).join(' · ') : ''),
        cellClass: 'text-danger-800',
      },
    ],
    [t, form.defaultSubtype, form.defaultValue, refusedRows],
  )

  const shownStores = useMemo(() => {
    const q = storeQ.trim().toLowerCase()
    return q ? storeChoices.filter((s) => s.storeCode.toLowerCase().includes(q) || s.storeName.toLowerCase().includes(q) || s.vendorId.toLowerCase().includes(q)) : storeChoices
  }, [storeChoices, storeQ])
  const ticked = (code: string) => form.stores === 'all' || form.stores.includes(code)
  const tickedCount = form.stores === 'all' ? storeChoices.length : form.stores.length


  const windowIssue = windowProblem(form.window, new Date())
  const lockedNote =
    status === 'sending' ? t('editor.lockedSending') : !editable ? t('editor.lockedSent') : null

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4" data-editor-body="">
        {lockedNote && (
          <p className="flex items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs" data-editor-locked={status}>
            <PromotionStatusBadge t={t} status={status} />
            {lockedNote}
          </p>
        )}

        <fieldset disabled={!editable || save.isPending || send.isPending} className="flex min-w-0 flex-col gap-4">
          {/* ── Chain first ── */}
          <section className="flex flex-col gap-2" data-editor-chain="">
            <h3 className="text-xs font-semibold tracking-tight">{t('editor.chainTitle')}</h3>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('editor.chain')} hint={chainsKnown ? undefined : t('editor.chainTyped')} invalid={chainRefusal !== null}>
                {chainsKnown ? (
                  <Select value={form.chainKey} onChange={(e) => changeChain(e.target.value)} data-editor-chain-select="">
                    <option value="">{t('editor.chainPick')}</option>
                    {chains.map((c) => (
                      <option key={c} value={c}>
                        {fsi(c)}
                      </option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    value={chainText}
                    list="hs-promotion-chains"
                    dir="ltr"
                    className="font-mono"
                    onChange={(e) => setChainText(e.target.value)}
                    onBlur={() => changeChain(chainText.trim())}
                    onKeyDown={(e) => e.key === 'Enter' && changeChain(chainText.trim())}
                    data-editor-chain-input=""
                  />
                )}
              </Field>
              {!chainsKnown && (
                <datalist id="hs-promotion-chains">
                  {chains.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              )}
            </div>
            {chainRefusal && <InlineRefusal message={chainRefusal.message} code={chainRefusal.code} />}
          </section>

          {/* ── Header ── */}
          <section className="grid grid-cols-2 gap-x-4 gap-y-3 md:grid-cols-4" data-editor-header="">
            <Field label={t('editor.name')} className="col-span-2" invalid={nameRefusal !== null}>
              <Input value={form.name} onChange={(e) => {
                  set('name', e.target.value)
                  save.reset()
                }} dir="auto" maxLength={100} data-editor-name="" />
            </Field>
            <Field label={t('editor.hsReason')}>
              <Select value={form.hsReason} onChange={(e) => set('hsReason', e.target.value as PromotionForm['hsReason'])} data-editor-hs-reason="">
                {HS_REASONS.map((r) => (
                  <option key={r} value={r}>
                    {t(`hsReasons.${r}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <div />
            {nameRefusal && (
              <div className="col-span-full" data-editor-name-refusal="">
                <InlineRefusal message={nameRefusal.message} code={nameRefusal.code} />
              </div>
            )}
            <Field label={t('editor.displayNameEn')} className="col-span-2" hint={t('editor.displayNameHint')}>
              <Input value={form.displayNameEn} onChange={(e) => set('displayNameEn', e.target.value)} dir="ltr" lang="en" maxLength={200} data-editor-display-en="" />
            </Field>
            <Field label={t('editor.displayNameAr')} className="col-span-2" hint={t('editor.displayNameHint')}>
              <Input value={form.displayNameAr} onChange={(e) => set('displayNameAr', e.target.value)} dir="rtl" lang="ar" maxLength={200} data-editor-display-ar="" />
            </Field>

            <Field label={t('editor.startDate')}>
              <Input type="date" value={form.window.startDate} onChange={(e) => setWindow({ ...form.window, startDate: e.target.value })} data-editor-start-date="" />
            </Field>
            <Field label={t('editor.startTime')} hint={t('editor.saudiTime')}>
              <Input type="time" value={form.window.startTime} onChange={(e) => setWindow({ ...form.window, startTime: e.target.value })} data-editor-start-time="" />
            </Field>
            <Field label={t('editor.endDate')}>
              <Input type="date" value={form.window.endDate} onChange={(e) => setWindow(pickEndDay(form.window, e.target.value))} data-editor-end-date="" />
            </Field>
            <Field label={t('editor.endTime')} hint={t('editor.saudiTime')}>
              <Input type="time" value={form.window.endTime} onChange={(e) => setWindow({ ...form.window, endTime: e.target.value })} data-editor-end-time="" />
            </Field>
            {windowIssue && (
              <p role="alert" className="col-span-full text-xs text-danger-800" data-editor-window-problem={windowIssue}>
                {t(`editor.windowProblems.${windowIssue}`)}
              </p>
            )}

            <Field label={t('editor.orderLimit')} hint={t('editor.limitHint')} error={bad('orderLimit') ? t('editor.limitInvalid') : undefined}>
              <Input inputMode="numeric" dir="ltr" value={form.orderLimit} onChange={(e) => set('orderLimit', e.target.value)} data-editor-order-limit="" />
            </Field>
            <Field label={t('editor.globalLimit')} hint={t('editor.limitHint')} error={bad('globalLimit') ? t('editor.limitInvalid') : undefined}>
              <Input inputMode="numeric" dir="ltr" value={form.globalLimit} onChange={(e) => set('globalLimit', e.target.value)} data-editor-global-limit="" />
            </Field>
            <Field label={t('editor.defaultSubtype')} hint={t('editor.defaultHint')}>
              <Select value={form.defaultSubtype} onChange={(e) => set('defaultSubtype', e.target.value as PromotionForm['defaultSubtype'])} data-editor-default-subtype="">
                {DISCOUNT_SUBTYPES.map((s) => (
                  <option key={s} value={s}>
                    {t(`subtypes.${s}`)}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label={t('editor.defaultValue')} error={bad('defaultValue') ? t('editor.valueInvalid') : undefined}>
              <Input inputMode="decimal" dir="ltr" value={form.defaultValue} onChange={(e) => set('defaultValue', e.target.value)} data-editor-default-value="" />
            </Field>
          </section>

          {/* ── Stores ── */}
          <section className="flex flex-col gap-2" data-editor-stores="">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-tight">{t('editor.storesTitle')}</h3>
              {storeChoices.length > 0 && (
                <span className="text-xs text-muted-foreground" data-editor-stores-count="">
                  <Trans t={t} i18nKey="editor.storesTicked" values={{ count: formatCount(figure(tickedCount), figure(storeChoices.length)) }} components={{ count: <Ltr /> }} />
                </span>
              )}
            </div>
            <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground" data-editor-stores-note="">
              {t('editor.storesFrozen')}
            </p>
            {!form.chainKey ? (
              <p className="text-sm text-muted-foreground">{t('editor.storesPickChain')}</p>
            ) : stores.isPending ? (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                {t('editor.storesLoading')}
              </p>
            ) : stores.isError ? (
              chainRefusal ? null : <ErrorBanner className="p-2.5" title={t('editor.storesFailed')} message={apiErrorMessage(stores.error, t('results.failed'))} />
            ) : storeChoices.length === 0 ? (
              <p className="text-sm text-muted-foreground" data-editor-stores-empty="">
                {t('editor.storesNone')}
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center gap-2">
                  <Input type="search" value={storeQ} onChange={(e) => setStoreQ(e.target.value)} placeholder={t('editor.storesSearch')} wrapperClassName="w-72" data-editor-stores-search="" />
                  <Button variant="text" onClick={() => set('stores', 'all')} disabled={form.stores === 'all'} data-editor-stores-all="">
                    {t('editor.storesAll')}
                  </Button>
                </div>
                {bad('stores') && (
                  <p role="alert" className="text-xs text-danger-800" data-editor-stores-problem="">
                    {t('editor.storesAtLeastOne')}
                  </p>
                )}
                <ul className="grid max-h-56 grid-cols-1 gap-x-4 overflow-auto rounded-md border border-border/60 p-2 md:grid-cols-3" data-editor-store-list="">
                  {shownStores.map((s) => (
                    <StoreTick key={s.storeCode} store={s} on={ticked(s.storeCode)} onToggle={() => set('stores', toggleStore(form.stores, s.storeCode, storeCodes))} />
                  ))}
                </ul>
              </>
            )}
          </section>

          {/* ── Items ── */}
          <section className="flex flex-col gap-2" data-editor-items="">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="text-xs font-semibold tracking-tight">{t('editor.itemsTitle')}</h3>
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground" data-editor-items-count={form.items.length}>
                  <Trans t={t} i18nKey="editor.itemsCount" count={form.items.length} values={{ n: figure(form.items.length) }} components={{ n: <Ltr /> }} />
                </span>
                <Button variant="outlined" onClick={() => setDialog('items')} data-editor-paste="">
                  <ClipboardPaste className="h-3.5 w-3.5" aria-hidden />
                  {t('editor.paste')}
                </Button>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">{t('editor.itemsHint')}</p>
            {bad('items') && (
              <p role="alert" className="text-xs text-danger-800" data-editor-items-problem="">
                {t('editor.itemsOverCap', { max: fsi(figure(HUNGERSTATION_PROMOTION_MAX_SKUS)) })}
              </p>
            )}
            {refusedRows.size > 0 && (
              <p role="alert" className="text-xs font-medium text-danger-800" data-editor-rows-refused={refusedRows.size}>
                <Trans t={t} i18nKey="editor.rowsRefused" count={refusedRows.size} values={{ n: figure(refusedRows.size) }} components={{ n: <Ltr /> }} />
              </p>
            )}
            {form.items.length > 0 && (
              <div className="h-72" data-editor-items-grid="">
                <AgGridReact<HungerStationPromotionItemInput>
                  theme={omsGridTheme}
                  rowData={form.items}
                  columnDefs={itemColumns}
                  defaultColDef={ITEM_COL_DEF}
                  getRowId={({ data }) => data.materialNumber}
                  rowClassRules={{ 'bg-danger-050': ({ data }) => !!data && refusedRows.has(data.materialNumber) }}
                  rowHeight={OMS_GRID_ROW_HEIGHT}
                  headerHeight={OMS_GRID_HEADER_HEIGHT}
                  animateRows={false}
                  suppressColumnVirtualisation
                />
              </div>
            )}
          </section>
        </fieldset>
      </div>

      {/* ── Footer: Save draft, Send ── */}
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 px-4 py-3" data-editor-footer="">
        <span className="me-auto text-xs text-muted-foreground" data-editor-state={!promotion ? 'new' : dirty ? 'dirty' : 'saved'}>
          {!editable ? null : !promotion ? t('editor.stateNew') : dirty ? t('editor.stateDirty') : t('editor.stateSaved')}
        </span>
        {editable && (
          <>
            <Button variant="outlined" disabled={problems.length > 0 || !dirty} onClick={() => setDialog('save')} data-editor-save="">
              <Save className="h-3.5 w-3.5" aria-hidden />
              {t('editor.save')}
            </Button>
            <Button
              variant="primary"
              disabled={!promotion || dirty || problems.length > 0 || form.items.length === 0}
              title={!promotion || dirty ? t('editor.sendNeedsSave') : form.items.length === 0 ? t('editor.sendNeedsItems') : undefined}
              onClick={() => setDialog('send')}
              data-editor-send=""
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {t('editor.send')}
            </Button>
          </>
        )}
      </footer>

      {dialog === 'items' && (
        <ImportDialog<StrikethroughColumn>
          ns="hungerstation-promotions"
          kind="promotion-items"
          title={t('import.title')}
          format={t('import.format')}
          columns={STRIKETHROUGH_COLUMNS}
          header={(key) => t(`import.columns.${key}`)}
          read={itemsReading}
          apply={(lines) => {
            set('items', lines.map((l) => itemOf(l.fields)))
            send.reset()
            setDialog(null)
          }}
          applyLabel={(count) => t('import.apply', { count, n: fsi(figure(count)) })}
          onClose={() => setDialog(null)}
        />
      )}

      <ReasonDialog
        open={dialog === 'save'}
        title={promotion ? t('editor.saveTitle') : t('editor.createTitle')}
        note={t('editor.saveNote')}
        busy={save.isPending}
        error={save.error}
        confirmLabel={t('editor.save')}
        handledCodes={[HUNGERSTATION_PROMOTION_ERRORS.nameInUse, HUNGERSTATION_ERRORS.noSuchChain]}
        onEdit={() => save.reset()}
        onConfirm={(reason) => save.mutate(reason)}
        onClose={() => setDialog(null)}
      >
        {nameRefusal && <InlineRefusal message={nameRefusal.message} code={nameRefusal.code} />}
        {chainRefusal && <InlineRefusal message={chainRefusal.message} code={chainRefusal.code} />}
      </ReasonDialog>

      <ReasonDialog
        open={dialog === 'send'}
        title={t('editor.sendTitle')}
        note={<SendNote stores={form.stores === 'all' ? storeChoices.length : form.stores.length} items={form.items.length} />}
        busy={send.isPending}
        error={send.error}
        confirmLabel={t('editor.send')}
        onEdit={() => send.reset()}
        onConfirm={(reason) => send.mutate(reason)}
        onClose={() => setDialog(null)}
      />
    </>
  )
}

/** One store of the picker: ticked, code · name, its vendor id, and Paused when its sync is. */
function StoreTick({ store, on, onToggle }: { store: HungerStationPromotionStoreChoice; on: boolean; onToggle: () => void }) {
  const { t } = useTranslation('hungerstation-promotions')
  return (
    <li data-editor-store={store.storeCode} data-editor-store-on={String(on)}>
      <label className="flex items-center gap-2 py-1 text-xs">
        <input type="checkbox" checked={on} onChange={onToggle} data-editor-store-tick="" />
        <span className="font-mono">
          <Ltr>{store.storeCode}</Ltr>
        </span>
        <span className="min-w-0 truncate">{store.storeName ? <bdi>{store.storeName}</bdi> : null}</span>
        {!store.syncActive && (
          <StatusBadge sev="warn">
            <span data-editor-store-paused="">{t('editor.storePaused')}</span>
          </StatusBadge>
        )}
      </label>
    </li>
  )
}

function SendNote({ stores, items }: { stores: number; items: number }): ReactNode {
  const { t } = useTranslation('hungerstation-promotions')
  return (
    <span data-editor-send-note="">
      <Trans t={t} i18nKey="editor.sendNote" values={{ stores: figure(stores), items: figure(items) }} components={{ stores: <Ltr />, items: <Ltr /> }} />
    </span>
  )
}

/** The paste read for the import dialog: its lines, and what it says above them. */
function itemsReading(text: string): ImportReading<StrikethroughColumn> {
  const read = readStrikethrough(text)
  const notes: ReactNode[] = []
  if (read.header !== null)
    notes.push(
      <span key="header" data-import-header-skipped="">
        <Trans ns="hungerstation-promotions" i18nKey="import.headerSkipped" values={{ header: read.header }} components={{ header: <Ltr /> }} />
      </span>,
    )
  if (read.repeats > 0)
    notes.push(
      <span key="repeats" data-import-repeats={read.repeats}>
        <Trans ns="hungerstation-promotions" i18nKey="import.repeats" count={read.repeats} values={{ n: figure(read.repeats) }} components={{ n: <Ltr /> }} />
      </span>,
    )
  if (read.overBy > 0)
    notes.push(
      <span key="cap" role="alert" className="font-medium text-danger-800" data-import-over-cap={read.overBy}>
        <Trans
          ns="hungerstation-promotions"
          i18nKey="import.overCap"
          values={{ n: figure(read.items.length), max: figure(HUNGERSTATION_PROMOTION_MAX_SKUS) }}
          components={{ n: <Ltr />, max: <Ltr /> }}
        />
      </span>,
    )
  return { lines: read.lines, note: notes.length ? notes : undefined, refused: read.overBy > 0 }
}
