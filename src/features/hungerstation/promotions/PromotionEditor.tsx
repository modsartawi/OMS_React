import { useEffect, useId, useMemo, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { AgGridReact } from 'ag-grid-react'
import { ClipboardPaste, Loader2, Repeat, Save, Send } from 'lucide-react'
// Side-effect import: registers AG Grid Community modules within this chunk.
import '@/core/ag-grid-setup'
import { OMS_GRID_HEADER_HEIGHT, OMS_GRID_ROW_HEIGHT, omsGridTheme } from '@/core/theme/ag-grid-theme'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import { fieldRefusal } from '@/core/hungerstation/reason'
import ReasonDialog, { InlineRefusal } from '@/core/hungerstation/ReasonDialog'
import ImportDialog, { type ImportReading } from '@/core/import/ImportDialog'
import {
  HUNGERSTATION_ERRORS,
  HUNGERSTATION_PROMOTION_ERRORS,
  HUNGERSTATION_PROMOTION_MAX_SKUS,
  type HungerStationPromotionCheck,
  type HungerStationPromotionDetail,
} from '@/core/models/hungerstation'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import SideSheet from '@/core/ui/SideSheet'
import SideSheetHeader from '@/core/ui/SideSheetHeader'
import { fsi } from '@/core/util/bidi'
import { formatFigure as figure } from '@/core/util/number-format'
import { PROMOTIONS_KEY, promotionKey, promotionsApi, promotionStoresKey } from './api'
import { PromotionStatusBadge } from './columns'
import { pickEndDay, windowProblem, type LocalWindow } from './local-window'
import { emptyForm, formFromDetail, formProblems, saveBody, type FormField, type PromotionForm } from './promotion-form'
import CheckPanel from './CheckPanel'
import { checkRefused, checkSummary, fieldWords } from './check-summary'
import { itemOf, readStrikethrough, STRIKETHROUGH_COLUMNS, type ItemSheetRead, type StrikethroughColumn } from './strikethrough-columns'
import { BUNDLE_COLUMNS, bundleItemOf, readBundle, type BundleColumn } from './bundle-columns'
import { editorItemColumns, ITEM_COL_DEF, rowKind, type ItemRow } from './editor-columns'
import EditorStores from './EditorStores'
import { editMode, lockOf, type EditField } from './promotion-edit'
import { DISCOUNT_SUBTYPES, HS_REASONS, PROMOTION_TYPES } from './promotion-words'

/** After these the promotion the editor holds is no longer what the server has: re-read it (the
 *  editor then locks behind it). DHS-00017 — it or a part is Sending; HungerStationPromotionSent —
 *  it was sent, switched off or replaced meanwhile. */
const STALE: readonly (string | null)[] = [HUNGERSTATION_PROMOTION_ERRORS.sending, HUNGERSTATION_PROMOTION_ERRORS.promotionSent]

/**
 * The **promotion editor** (ticket 666 strikethrough, 668 same-item bundle; BackOffice spec 3201 /
 * 3211 / 3213, reconciled to the door contract 2026-10-29), on `?edit=new` or `?edit=<promotionId>`.
 * The chain comes first; the stores and materials that follow are that chain's. Then the header
 * (name, EN + AR display names, HungerStation reason, limits, the Saudi local window, the default
 * discount), the stores picker (every HungerStation store of the chain ticked by default — frozen
 * when sent) and the items, pasted from Excel through the core import dialog.
 *
 * **Save draft** (create, then update) any number of times — nothing reaches HungerStation; the
 * save's answer carries its Check. **Send** with a reason, once the draft is saved as it reads; it
 * runs Check first and opens only on a clean answer. A Send refused by a check (DHS-00018 / 19)
 * carries only a message, so Check runs again for the rows. Every write carries a reason
 * (DHS-00008, inline).
 *
 * **Same-item bundle** (668): each row carries its own buy and get (there is no promotion default)
 * and its subtype and value (a blank one the header default). The SERVER plans one HungerStation
 * promotion part per combination (3213); the Check panel shows the parts it answered, and Send then
 * reads "Send N promotions to M stores".
 *
 * **A sent promotion** (670, BackOffice 3215) is edited IN PLACE while it runs: items (paste again),
 * values, max quantities, limits, display names, the defaults. The name, stores, start and end are
 * its HungerStation identity and are locked, each pointing to **Replace** (`onReplace`). The
 * contract's Check reads the saved promotion only, so the edit is not previewed: **Save and
 * re-send** takes a reason and the PUT runs every check (a refusal names its rows, nothing is sent).
 * Nothing is edited while it reads Sending.
 *
 * 🚩 Proven against stubs only: no live SIS.Api call.
 */
export default function PromotionEditor({
  promotionId,
  chains,
  chainsKnown,
  onClose,
  onSaved,
  onSent,
  onReplace,
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
  /** 670 → 671: open the Replace dialog for this sent promotion. Without it the locked fields still
   *  say that changing them replaces the promotion, and offer no button. */
  onReplace?: () => void
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
          onReplace={onReplace}
        />
      )}
    </SideSheet>
  )
}

function EditorBody({
  saved,
  chains,
  chainsKnown,
  onSaved,
  onSent,
  onReplace,
}: {
  saved: HungerStationPromotionDetail | null
  chains: readonly string[]
  chainsKnown: boolean
  onSaved: (promotionId: string) => void
  onSent: (promotionId: string) => void
  onReplace?: () => void
}) {
  const { t } = useTranslation('hungerstation-promotions')
  const qc = useQueryClient()
  const [form, setForm] = useState<PromotionForm>(() => (saved ? formFromDetail(saved) : emptyForm(new Date())))
  // What the server holds, to tell a saved draft from one edited since.
  const [savedForm, setSavedForm] = useState(() => (saved ? JSON.stringify(formFromDetail(saved)) : null))
  const [promotion, setPromotion] = useState(saved)
  const [chainText, setChainText] = useState(form.chainKey)
  const [dialog, setDialog] = useState<'items' | 'save' | 'send' | 'edit' | null>(null)
  // 667: the latest Check answer for the SAVED promotion (the Check door's, or a save's `check`), and
  // the preview grid's refused-only filter.
  const [checked, setChecked] = useState<HungerStationPromotionCheck | null>(null)
  const [refusedOnly, setRefusedOnly] = useState(false)
  // A Send a check refused: the Check below was run again for its rows.
  const [rechecked, setRechecked] = useState(false)

  const set = <F extends keyof PromotionForm>(field: F, value: PromotionForm[F]) => setForm((f) => ({ ...f, [field]: value }))
  const setWindow = (w: LocalWindow) => set('window', w)

  // 🔑 A draft is edited whole; a sent promotion in place, its identity locked (670); nothing while
  // it reads Sending; a closed one is only shown.
  const status = promotion?.status ?? 'draft'
  const mode = promotion ? editMode(promotion) : 'draft'
  const editable = mode === 'draft'
  const inPlace = mode === 'inPlace'
  const lock = (f: EditField) => lockOf(status, f)
  const formJson = JSON.stringify(form)
  // Review B2: the form as it reads NOW, for a Check answer to compare against the form it was asked
  // for — Send posts the SAVED version, so its dialog opens only while the form still is that version.
  const formNow = useRef(formJson)
  formNow.current = formJson
  const dirty = savedForm !== formJson
  const problems = formProblems(form, new Date())
  const bad = (f: FormField) => problems.includes(f)

  const stores = useQuery({
    queryKey: promotionStoresKey(form.chainKey),
    queryFn: () => promotionsApi.stores(form.chainKey),
    enabled: form.chainKey.trim() !== '',
    retry: false,
  })
  const storeChoices = useMemo(() => stores.data ?? [], [stores.data])
  const storeNames = useMemo(() => new Map(storeChoices.map((s) => [s.storeCode, s.storeName])), [storeChoices])
  const tickedCount = form.stores === 'all' ? storeChoices.length : form.stores.length

  const settle = (answer: HungerStationPromotionDetail) => {
    qc.setQueryData(promotionKey(answer.promotionId), answer)
    void qc.invalidateQueries({ queryKey: PROMOTIONS_KEY })
    setPromotion(answer)
  }
  /** The promotion changed on the server under this editor: read it again, and lock behind it. */
  const reread = (err: unknown) => {
    if (promotion && STALE.includes(apiErrorCode(err))) void promotionsApi.detail(promotion.promotionId).then(settle, () => undefined)
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
      // Save never refuses on the checks: it REPORTS them as its `check`. A new draft's editor
      // re-mounts on its id and checks itself there.
      setChecked(answer.check ?? null)
      setRechecked(false)
      if (!promotion) onSaved(answer.promotionId)
    },
    onError: reread,
  })
  // 667: Check on demand, and before Send — only a clean answer opens the Send dialog.
  const check = useMutation({
    mutationFn: ({ promotionId }: { promotionId: string; thenSend: boolean; form: string }) => promotionsApi.check(promotionId),
    onSuccess: (answer, { thenSend, form: askedFor }) => {
      setChecked(answer)
      if (thenSend && askedFor === formNow.current && !checkSummary(answer).blocksSend) setDialog('send')
    },
  })
  // A saved draft opened here is checked at once — once (the ref survives StrictMode's re-run),
  // and by a plain call: a mutation fired from a mount effect is lost to StrictMode's re-subscribe.
  const checkedOnOpen = useRef(false)
  const [openCheck, setOpenCheck] = useState<{ pending: boolean; error: unknown }>({ pending: false, error: null })
  useEffect(() => {
    if (checkedOnOpen.current || saved?.status !== 'draft') return
    checkedOnOpen.current = true
    setOpenCheck({ pending: true, error: null })
    promotionsApi.check(saved.promotionId).then(
      (answer) => {
        setChecked((c) => c ?? answer)
        setOpenCheck({ pending: false, error: null })
      },
      (error: unknown) => setOpenCheck({ pending: false, error }),
    )
  }, [saved])
  const checking = check.isPending || openCheck.pending
  const send = useMutation({
    mutationFn: (reason: string) => promotionsApi.send(promotion!.promotionId, { reason }),
    onSuccess: (answer) => {
      settle(answer)
      setDialog(null)
      onSent(answer.promotionId)
    },
    // A Send refused for its checks carries only the message: run Check again for the rows.
    onError: (err) => {
      if (checkRefused(err) && promotion) {
        setRechecked(true)
        check.mutate({ promotionId: promotion.promotionId, thenSend: false, form: formJson })
      }
      reread(err)
    },
  })

  // 670: save and re-send the edit in place. Every check runs in the PUT; the detail then takes over.
  const edit = useMutation({
    mutationFn: (reason: string) => promotionsApi.save(promotion!.promotionId, saveBody(form, reason)),
    onSuccess: (answer) => {
      settle(answer)
      setDialog(null)
      onSent(answer.promotionId)
    },
    onError: reread,
  })
  // The server refuses an identity change here (DHS-00021): that is a Replace.
  const replaceRefusal = fieldRefusal(edit.error, [HUNGERSTATION_PROMOTION_ERRORS.needsReplace], t('editor.failedHint'))

  const nameRefusal = fieldRefusal(save.error, [HUNGERSTATION_PROMOTION_ERRORS.nameInUse], t('editor.failedHint'))
  const chainRefusal =
    fieldRefusal(save.error, [HUNGERSTATION_ERRORS.noSuchChain], t('editor.failedHint')) ??
    fieldRefusal(stores.error, [HUNGERSTATION_ERRORS.noSuchChain], t('editor.failedHint'))
  // A draft's Check reads the SAVED promotion; an in-place edit has none (the PUT checks it).
  const summary = useMemo(() => (checked && editable ? checkSummary(checked) : null), [checked, editable])
  const rowCheck = summary?.rows
  const showRefusedOnly = refusedOnly && (summary?.refusedRows ?? 0) > 0
  const shownItems = useMemo(() => {
    const rows: ItemRow[] = form.items.map((i) => ({ ...i, check: rowCheck?.get(i.materialNumber) ?? null }))
    return showRefusedOnly ? rows.filter((r) => rowKind(r) === 'refused') : rows
  }, [showRefusedOnly, form.items, rowCheck])
  const headerWords = (...fields: string[]) => fieldWords(t, summary, ...fields)

  const bundle = form.type === 'SAME_ITEM_BUNDLE'
  // 668: the columns differ by type, so a type change drops the pasted items (and the check of them).
  const changeType = (type: PromotionForm['type']) => {
    setForm((f) => (f.type === type ? f : { ...f, type, items: [] }))
    setChecked(null)
    setRefusedOnly(false)
  }
  const defaults = useMemo(
    () => ({ subtype: form.defaultSubtype, value: form.defaultValue.trim() === '' || Number.isNaN(Number(form.defaultValue)) ? null : Number(form.defaultValue) }),
    [form.defaultSubtype, form.defaultValue],
  )
  const itemColumns = useMemo(() => editorItemColumns(t, bundle, defaults), [t, bundle, defaults])

  const changeChain = (chainKey: string) => {
    setForm((f) => (f.chainKey === chainKey ? f : { ...f, chainKey, stores: 'all' }))
    save.reset()
  }

  // 668: how many HungerStation promotions the latest Check said this goes out as (the server's plan).
  const parts = summary?.parts.length ?? 0

  const windowIssue = windowProblem(form.window, new Date())
  const lockedNote = mode === 'sending' ? t('editor.lockedSending') : mode === 'inPlace' ? t('editor.lockedLive') : mode === 'closed' ? t('editor.lockedSent') : null
  // Review B1: a Check in flight holds the form too — an edit made then would be dropped (Send posts
  // the saved version the Check answered for).
  const busy = save.isPending || send.isPending || edit.isPending || checking
  /** Said under a field that only Replace changes (or that never changes once sent). */
  const lockHint = (f: EditField) => (lock(f) === 'replace' ? <ReplacePointer field={f} onReplace={onReplace} /> : lock(f) === 'fixed' ? t('editor.fixedOnceSent') : undefined)
  const takeItems = (items: PromotionForm['items']) => {
    set('items', items)
    send.reset()
    setChecked(null)
    setDialog(null)
  }

  return (
    <>
      <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-auto p-4" data-editor-body="">
        {lockedNote && (
          <p className="flex flex-wrap items-center gap-2 rounded-md bg-muted px-3 py-2 text-xs" data-editor-locked={mode === 'sending' ? 'sending' : status} data-editor-mode={mode}>
            <PromotionStatusBadge t={t} status={status} />
            {lockedNote}
            {inPlace && onReplace && (
              <Button variant="text" onClick={onReplace} data-editor-replace="note">
                <Repeat className="h-3.5 w-3.5" aria-hidden />
                {t('editor.replace')}
              </Button>
            )}
          </p>
        )}

        <fieldset disabled={!(editable || inPlace) || busy} className="flex min-w-0 flex-col gap-4" data-editor-fieldset="">
          {/* ── Chain first ── */}
          <section className="flex flex-col gap-2" data-editor-chain="">
            <h3 className="text-xs font-semibold tracking-tight">{t('editor.chainTitle')}</h3>
            <div className="flex flex-wrap items-end gap-3">
              <Field label={t('editor.type')} hint={lockHint('type') ?? (form.items.length > 0 ? t('editor.typeClears') : undefined)}>
                <Select value={form.type} disabled={lock('type') !== null} onChange={(e) => changeType(e.target.value as PromotionForm['type'])} data-editor-type="">
                  {PROMOTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {t(`types.${type}`)}
                    </option>
                  ))}
                </Select>
              </Field>
              <Field label={t('editor.chain')} hint={lockHint('chainKey') ?? (chainsKnown ? undefined : t('editor.chainTyped'))} invalid={chainRefusal !== null}>
                {chainsKnown ? (
                  <Select value={form.chainKey} disabled={lock('chainKey') !== null} onChange={(e) => changeChain(e.target.value)} data-editor-chain-select="">
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
                    disabled={lock('chainKey') !== null}
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
            <Field label={t('editor.name')} className="col-span-2" hint={lockHint('name')} invalid={nameRefusal !== null} error={headerWords('name')}>
              <Input
                value={form.name}
                disabled={lock('name') !== null}
                data-editor-locked-field={lock('name') ?? undefined}
                onChange={(e) => {
                  set('name', e.target.value)
                  save.reset()
                }}
                dir="auto"
                maxLength={100}
                data-editor-name=""
              />
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
            <Field label={t('editor.displayNameEn')} className="col-span-2" hint={t('editor.displayNameHint')} error={headerWords('displayNameEn')}>
              <Input value={form.displayNameEn} onChange={(e) => set('displayNameEn', e.target.value)} dir="ltr" lang="en" maxLength={200} data-editor-display-en="" />
            </Field>
            <Field label={t('editor.displayNameAr')} className="col-span-2" hint={t('editor.displayNameHint')} error={headerWords('displayNameAr')}>
              <Input value={form.displayNameAr} onChange={(e) => set('displayNameAr', e.target.value)} dir="rtl" lang="ar" maxLength={200} data-editor-display-ar="" />
            </Field>

            <Field label={t('editor.startDate')} error={headerWords('startAt')}>
              <Input type="date" value={form.window.startDate} disabled={lock('window') !== null} data-editor-locked-field={lock('window') ?? undefined} onChange={(e) => setWindow({ ...form.window, startDate: e.target.value })} data-editor-start-date="" />
            </Field>
            <Field label={t('editor.startTime')} hint={t('editor.saudiTime')}>
              <Input type="time" value={form.window.startTime} disabled={lock('window') !== null} onChange={(e) => setWindow({ ...form.window, startTime: e.target.value })} data-editor-start-time="" />
            </Field>
            <Field label={t('editor.endDate')} error={headerWords('endAt')}>
              <Input type="date" value={form.window.endDate} disabled={lock('window') !== null} data-editor-locked-field={lock('window') ?? undefined} onChange={(e) => setWindow(pickEndDay(form.window, e.target.value))} data-editor-end-date="" />
            </Field>
            <Field label={t('editor.endTime')} hint={t('editor.saudiTime')}>
              <Input type="time" value={form.window.endTime} disabled={lock('window') !== null} onChange={(e) => setWindow({ ...form.window, endTime: e.target.value })} data-editor-end-time="" />
            </Field>
            {lock('window') === 'replace' && (
              <p className="col-span-full text-xs text-muted-foreground" data-editor-window-locked="">
                <ReplacePointer field="window" onReplace={onReplace} />
              </p>
            )}
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
          <EditorStores
            chainKey={form.chainKey}
            stores={stores}
            value={form.stores}
            onChange={(next) => set('stores', next)}
            locked={lock('stores') !== null}
            lockedNote={lock('stores') === 'replace' ? <ReplacePointer field="stores" onReplace={onReplace} /> : undefined}
            checkWords={headerWords('stores')}
            showProblem={bad('stores')}
            hideError={chainRefusal !== null}
          />

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
            {bundle && (
              <p className="text-xs text-muted-foreground" data-editor-split-note="">
                {t('import.bundleSplit')}
              </p>
            )}
            {bad('items') && (
              <p role="alert" className="text-xs text-danger-800" data-editor-items-problem="">
                {t('editor.itemsOverCap', { max: fsi(figure(HUNGERSTATION_PROMOTION_MAX_SKUS)) })}
              </p>
            )}
            {headerWords('items') && (
              <p role="alert" className="text-xs text-danger-800" data-check-field="items">
                {headerWords('items')}
              </p>
            )}
            {(summary?.refusedRows ?? 0) > 0 && (
              <div className="flex items-center gap-2">
                <Chip on={showRefusedOnly} onClick={() => setRefusedOnly((v) => !v)} data-editor-refused-only={String(showRefusedOnly)}>
                  {t('check.refusedOnly')}
                </Chip>
              </div>
            )}
            {form.items.length > 0 && (
              <div className="h-72" data-editor-items-grid="" data-editor-items-shown={shownItems.length}>
                <AgGridReact<ItemRow>
                  theme={omsGridTheme}
                  rowData={shownItems}
                  columnDefs={itemColumns}
                  defaultColDef={ITEM_COL_DEF}
                  getRowId={({ data }) => data.materialNumber}
                  rowClassRules={{ 'bg-danger-050': ({ data }) => rowKind(data) === 'refused', 'bg-attention-050': ({ data }) => rowKind(data) === 'warned' }}
                  rowHeight={OMS_GRID_ROW_HEIGHT}
                  headerHeight={OMS_GRID_HEADER_HEIGHT}
                  animateRows={false}
                  suppressColumnVirtualisation
                />
              </div>
            )}
          </section>
        </fieldset>

        {/* ── Check (667) ── */}
        {editable && (
          <>
            {rechecked && (
              <p role="alert" className="text-xs text-danger-800" data-editor-rechecked="">
                {t('editor.refusedRechecked')}
              </p>
            )}
            <CheckPanel
              summary={summary}
              checking={checking}
              error={check.error ?? (check.isIdle ? openCheck.error : null)}
              canCheck={!!promotion && !dirty}
              onCheck={() => check.mutate({ promotionId: promotion!.promotionId, thenSend: false, form: formJson })}
              storeName={(code) => storeNames.get(code) || null}
              showParts={bundle}
            />
          </>
        )}
        {/* ── 670: the edit is checked by its PUT; the contract's Check reads the saved promotion ── */}
        {inPlace && (
          <p className="rounded-md border border-border/60 p-3 text-xs text-muted-foreground" data-editor-edit-checks="">
            {t('check.editChecks')}
          </p>
        )}
      </div>

      {/* ── Footer: Save draft, Send ── */}
      <footer className="flex shrink-0 flex-wrap items-center justify-end gap-2 border-t border-border/60 px-4 py-3" data-editor-footer="">
        <span className="me-auto text-xs text-muted-foreground" data-editor-state={!promotion ? 'new' : dirty ? 'dirty' : 'saved'}>
          {inPlace ? (dirty ? t('editor.stateEditDirty') : t('editor.stateLive')) : !editable ? null : !promotion ? t('editor.stateNew') : dirty ? t('editor.stateDirty') : t('editor.stateSaved')}
        </span>
        {inPlace && (
          <Button
            variant="primary"
            disabled={!dirty || problems.length > 0 || form.items.length === 0 || busy}
            title={!dirty ? t('editor.editNeedsChange') : undefined}
            onClick={() => setDialog('edit')}
            data-editor-edit-send=""
          >
            <Send className="h-3.5 w-3.5" aria-hidden />
            {t('editor.editSend')}
          </Button>
        )}
        {editable && (
          <>
            <Button variant="outlined" disabled={problems.length > 0 || !dirty} onClick={() => setDialog('save')} data-editor-save="">
              <Save className="h-3.5 w-3.5" aria-hidden />
              {t('editor.save')}
            </Button>
            <Button
              variant="primary"
              disabled={!promotion || dirty || problems.length > 0 || form.items.length === 0 || summary?.blocksSend === true || checking}
              title={
                !promotion || dirty ? t('editor.sendNeedsSave') : form.items.length === 0 ? t('editor.sendNeedsItems') : summary?.blocksSend ? t('check.sendBlocked') : undefined
              }
              // Send runs the checks first; only a clean answer opens the reason dialog.
              onClick={() => check.mutate({ promotionId: promotion!.promotionId, thenSend: true, form: formJson })}
              data-send-blocked={String(summary?.blocksSend === true)}
              data-editor-send-parts={parts}
              data-editor-send=""
            >
              <Send className="h-3.5 w-3.5" aria-hidden />
              {parts > 1 ? t('editor.sendParts', { count: parts, n: fsi(figure(parts)), stores: fsi(figure(tickedCount)) }) : t('editor.send')}
            </Button>
          </>
        )}
      </footer>

      {dialog === 'items' && bundle && (
        <ImportDialog<BundleColumn>
          ns="hungerstation-promotions"
          kind="promotion-items"
          title={t('import.bundleTitle')}
          // Ends "Rows with different buy/get or discount are sent as separate HungerStation
          // promotions." — said on the paste step (668).
          format={t('import.bundleFormat')}
          columns={BUNDLE_COLUMNS}
          header={(key) => t(`import.columns.${key}`)}
          read={(text) => itemsReading(readBundle(text))}
          apply={(lines) => takeItems(lines.map((l) => bundleItemOf(l.fields)))}
          applyLabel={(count) => t('import.apply', { count, n: fsi(figure(count)) })}
          onClose={() => setDialog(null)}
        />
      )}
      {dialog === 'items' && !bundle && (
        <ImportDialog<StrikethroughColumn>
          ns="hungerstation-promotions"
          kind="promotion-items"
          title={t('import.title')}
          format={t('import.format')}
          columns={STRIKETHROUGH_COLUMNS}
          header={(key) => t(`import.columns.${key}`)}
          read={(text) => itemsReading(readStrikethrough(text))}
          apply={(lines) => takeItems(lines.map((l) => itemOf(l.fields)))}
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

      {/* 670: save and re-send the edit in place. */}
      <ReasonDialog
        open={dialog === 'edit'}
        title={t('editor.editTitle')}
        note={<span data-editor-edit-note="">{t('editor.editNote')}</span>}
        busy={edit.isPending}
        error={edit.error}
        confirmLabel={t('editor.editSend')}
        handledCodes={[HUNGERSTATION_PROMOTION_ERRORS.needsReplace]}
        onEdit={() => edit.reset()}
        onConfirm={(reason) => edit.mutate(reason)}
        onClose={() => setDialog(null)}
      >
        <span data-editor-edit-dialog="" hidden />
        {replaceRefusal && (
          <div className="flex flex-col gap-1" data-editor-needs-replace="">
            <InlineRefusal message={replaceRefusal.message} code={replaceRefusal.code} />
            <ReplacePointer field="refusal" onReplace={onReplace} />
          </div>
        )}
      </ReasonDialog>

      <ReasonDialog
        open={dialog === 'send'}
        title={t('editor.sendTitle')}
        note={<SendNote stores={tickedCount} items={form.items.length} />}
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

/** 670: under a field only Replace changes: the words, and Replace once 671 hands its dialog over. */
function ReplacePointer({ field, onReplace }: { field: string; onReplace?: () => void }) {
  const { t } = useTranslation('hungerstation-promotions')
  return (
    <span className="inline-flex flex-wrap items-center gap-1.5" data-editor-replace-pointer={field}>
      {t('editor.replaceHint')}
      {onReplace && (
        <Button variant="text" onClick={onReplace} data-editor-replace={field}>
          {t('editor.replace')}
        </Button>
      )}
    </span>
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
function itemsReading<K extends string>(read: ItemSheetRead<K>): ImportReading<K> {
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
