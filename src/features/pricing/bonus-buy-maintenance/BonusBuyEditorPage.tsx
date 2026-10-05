import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { confirmAction } from '@/core/services/confirm'
import type {
  BbyBonusBuyDocument,
  BbyMaintainOutcome,
  BbyPromotion,
  BbyTestMark,
} from '@/core/models/bonus-buy-maintenance'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatRange, fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import {
  bbyMaintainAccessQuery,
  bbyMaintainApi,
  bonusBuyKey,
  canMarkTested,
  canOpenBbyMaintain,
  promotionKey,
  promotionListKey,
} from './api'
import ActReport, { type Report } from './ActReport'
import { BuyPanel, type CouponMaterialAction, GetPanel } from './BuyGetPanels'
import EngineRulesTab from './EngineRulesTab'
import { DateInput, INPUT, TextInput } from './fields'
import GroupingDialog from './GroupingDialog'
import {
  BBY_ORG,
  BBY_TEXT_MAX,
  couponMaterialDefault,
  couponMaterialLands,
  couponMaterialOffered,
  editorAccess,
  type EditorAccess,
  type EditorState,
  fillCouponMaterial,
  formChanged,
  fromDocument,
  newEditor,
  orgCurrency,
  readEditorOutcome,
  readGenerateOutcome,
  TEST_NOTE_MAX,
  toRequest,
} from './editor'
import {
  classifyOutcome,
  type EditorMode,
  editorPath,
  isPromotionNotFound,
  overviewSeverity,
  overviewStatus,
  promotionPath,
} from './overview'

/**
 * SAP's Create / Change / Display Bonus Buy (ticket 417, screenshots 2–10), opened from the
 * promotion's overview. Tabs Header Data · Engine Rules · Promotion Data · History of Changes;
 * the header, the organizational data, and the Buy and Get panels. Every decision is
 * `editor.ts`'s; this file lays it out.
 */
export default function BonusBuyEditorPage() {
  const { t } = useTranslation('bonus-buy-maintenance')
  const { promoNumber = '', bbyNumber } = useParams()
  const [search] = useSearchParams()
  const mode: EditorMode = !bbyNumber ? 'create' : search.get('mode') === 'display' ? 'display' : 'change'

  return (
    <ScreenGate
      query={bbyMaintainAccessQuery()}
      can={canOpenBbyMaintain}
      ns="bonus-buy-maintenance"
      title={t(`editor.${mode}Title`)}
      subtitle={t('editor.subtitle', { promo: fsi(promoNumber) })}
    >
      {/* Keyed: Create → Change after a save, or another number, starts a fresh form. */}
      <EditorLoader key={`${mode}:${bbyNumber ?? ''}`} promoNumber={promoNumber} bbyNumber={bbyNumber} mode={mode} />
    </ScreenGate>
  )
}

function EditorLoader({ promoNumber, bbyNumber, mode }: { promoNumber: string; bbyNumber?: string; mode: EditorMode }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const promo = useQuery({
    queryKey: promotionKey(promoNumber),
    queryFn: () => bbyMaintainApi.promotion(promoNumber),
  })
  const doc = useQuery({
    queryKey: bonusBuyKey(bbyNumber ?? ''),
    queryFn: () => bbyMaintainApi.bonusBuy(bbyNumber ?? ''),
    enabled: !!bbyNumber,
    // The form is keyed on the read's version, so a background refetch would rebuild it and drop
    // unsaved edits. Only a save or an explicit Reload reads again; a stale save is refused in-band.
    staleTime: Infinity,
    refetchOnReconnect: false,
    refetchOnWindowFocus: false,
  })
  // The act's outcome lives here, above the form, so it survives the form's remount when a
  // save brings a new version back. Create → Save moves to the Change route, which remounts
  // this loader too, so that save hands its report over in the navigation state.
  const location = useLocation()
  const navigate = useNavigate()
  const [report, setReport] = useState<Report | null>(
    () => (location.state as { report?: Report } | null)?.report ?? null,
  )
  // Consume the handed-over report once: the history entry keeps its state, and a reload or a
  // Back must not show "Saved." again for edits that may not be saved.
  useEffect(() => {
    if ((location.state as { report?: Report } | null)?.report)
      navigate(location.pathname + location.search, { replace: true, state: null })
  }, [location, navigate])

  const back = (
    <Link
      to={promotionPath(promoNumber)}
      className="inline-flex w-fit items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
    >
      {/* Flips under RTL: "back" points to the reading start. */}
      <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" aria-hidden />
      {t('editor.back')}
    </Link>
  )

  const pending = promo.isPending || (!!bbyNumber && doc.isPending)
  let body
  if (pending) {
    body = (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      </div>
    )
  } else if (promo.isError || doc.isError) {
    body = (
      <ErrorBanner
        message={apiErrorMessage(promo.error ?? doc.error, t('editor.loadFailed'))}
        className="px-3 py-2"
      />
    )
  } else if (isPromotionNotFound(promo.data)) {
    body = <ErrorBanner message={t('promotion.notFound', { number: fsi(promoNumber) })} className="px-3 py-2" />
  } else if (bbyNumber && (doc.data?.status !== 'found' || !doc.data.bonusBuy)) {
    body = <ErrorBanner message={t('editor.notFound', { number: fsi(bbyNumber) })} className="px-3 py-2" />
  } else {
    const d = bbyNumber ? (doc.data as BbyBonusBuyDocument) : null
    body = (
      <EditorBody
        // A new version (after a save, or a reload) is a new starting point for the form.
        key={d?.version ?? 'new'}
        mode={mode}
        promo={promo.data as BbyPromotion}
        doc={d}
        report={report}
        setReport={setReport}
      />
    )
  }

  return (
    <>
      {back}
      {body}
    </>
  )
}

type Tab = 'header' | 'engine' | 'promotion' | 'history'
const TABS: Tab[] = ['header', 'engine', 'promotion', 'history']

function EditorBody({
  mode,
  promo,
  doc,
  report,
  setReport,
}: {
  mode: EditorMode
  promo: BbyPromotion
  doc: BbyBonusBuyDocument | null
  report: Report | null
  setReport: (r: Report | null) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  // What the form opened with: Mark Tested attests the saved bonus buy, so it waits on any edit.
  const [opened] = useState<EditorState>(() => (doc ? fromDocument(doc) : newEditor(promo)))
  const [state, setState] = useState<EditorState>(opened)
  // The form as last rendered, for an act that must read it after an await (New coupon material).
  const latestState = useRef(state)
  latestState.current = state
  const [tab, setTab] = useState<Tab>('header')
  const [busy, setBusy] = useState(false)
  const [groupingOpen, setGroupingOpen] = useState(false)
  const [markOpen, setMarkOpen] = useState(false)
  // The Buy line New coupon material was pressed on, while its prompt is open.
  const [couponLineKey, setCouponLineKey] = useState<string | null>(null)
  // The ONE access answer the screen gate already read (same key): the tester grant rides on it.
  const accessAnswer = useQuery(bbyMaintainAccessQuery())
  const access: EditorAccess = editorAccess(mode, doc, canMarkTested(accessAnswer.data))
  const currency = orgCurrency(BBY_ORG.salesOrg)

  const update = (patch: Partial<EditorState>) => setState((s) => ({ ...s, ...patch }))

  async function guarded(act: () => Promise<void>) {
    setBusy(true)
    try {
      await act()
    } catch (err) {
      setReport({
        title: t('editor.actFailed'),
        tone: 'bad',
        rows: [{ message: apiErrorMessage(err, t('editor.actFailed')), refusals: [] }],
      })
    } finally {
      setBusy(false)
    }
  }

  /** Check and Save answer alike: every refusal and warning, each with its code and both languages. */
  function show(kind: 'check' | 'save', outcome: ReturnType<typeof readEditorOutcome>): Report {
    const rows = [
      ...(outcome.refusals.length ? [{ refusals: outcome.refusals }] : []),
      ...(outcome.warnings.length ? [{ outcome: t('editor.warnings'), refusals: outcome.warnings }] : []),
    ]
    const bad = outcome.kind === 'refused' || outcome.kind === 'stale' || outcome.kind === 'notFound'
    const next: Report = {
      title: t(`editor.outcome.${kind}.${outcome.kind}`),
      tone: bad ? 'bad' : 'ok',
      rows,
      stale: outcome.kind === 'stale',
    }
    setReport(next)
    return next
  }

  const check = () =>
    guarded(async () => {
      setReport(null)
      show('check', readEditorOutcome(await bbyMaintainApi.validate(toRequest(state))))
    })

  const save = () =>
    guarded(async () => {
      setReport(null)
      const outcome = readEditorOutcome(await bbyMaintainApi.save(toRequest(state)))
      const shown = show('save', outcome)
      if (outcome.kind !== 'saved') return
      await queryClient.invalidateQueries({ queryKey: promotionKey(promo.promoNumber) })
      await queryClient.invalidateQueries({ queryKey: promotionListKey })
      const number = outcome.number ?? state.bbyNumber
      if (mode === 'create' && number) {
        navigate(editorPath(promo.promoNumber, 'change', number), { replace: true, state: { report: shown } })
        return
      }
      // The new version comes back with the re-read, and the form starts from it.
      if (number) await queryClient.invalidateQueries({ queryKey: bonusBuyKey(number) })
    })

  /** Someone saved after this form was opened: drop the form and read the bonus buy again. */
  const reload = () =>
    guarded(async () => {
      setReport(null)
      if (state.bbyNumber) await queryClient.invalidateQueries({ queryKey: bonusBuyKey(state.bbyNumber) })
    })

  /** SAP's create-with-reference: a new Planned OMS bonus buy in this promotion, opened for Change. */
  const copy = () =>
    guarded(async () => {
      if (!state.bbyNumber) return
      const outcome = await bbyMaintainApi.copy(state.bbyNumber, promo.promoNumber)
      if (outcome.status === 'saved' && outcome.number) {
        // The copy is validated like a save; its warnings travel to the page it opens.
        const warnings = outcome.warnings ?? []
        const handed: Report | null = warnings.length
          ? { title: t('editor.copied'), tone: 'ok', rows: [{ outcome: t('editor.warnings'), refusals: warnings }] }
          : null
        setReport(null)
        await queryClient.invalidateQueries({ queryKey: promotionKey(promo.promoNumber) })
        navigate(editorPath(promo.promoNumber, 'change', outcome.number), { state: { report: handed } })
        return
      }
      setReport({
        title: t('editor.copyRefused'),
        tone: 'bad',
        rows: [{ number: state.bbyNumber, refusals: outcome.refusals ?? [] }],
      })
    })

  /**
   * Mark Tested and Back to Planned (spec 2396): status acts on the SAVED bonus buy, answered
   * in-band like every write. A refusal (the last writer, a validator refusal, a status that
   * moved) is shown as the server worded it, in both languages; on success the bonus buy and
   * the overview are read again, so the lock, the badge and the test mark follow the server.
   */
  async function statusAct(act: 'test' | 'backToPlanned', call: (number: string) => Promise<BbyMaintainOutcome>) {
    const number = state.bbyNumber
    if (!number) return
    await guarded(async () => {
      setReport(null)
      const outcome = classifyOutcome(number, await call(number))
      if (outcome.kind !== 'done') {
        setReport({
          title: t(outcome.kind === 'notFound' ? `${act}.notFound` : `${act}.refused`),
          tone: 'bad',
          rows: outcome.refusals.length ? [{ refusals: outcome.refusals }] : [],
        })
        return
      }
      setReport({ title: t(`${act}.done`), tone: 'ok', rows: [] })
      await queryClient.invalidateQueries({ queryKey: bonusBuyKey(number) })
      await queryClient.invalidateQueries({ queryKey: promotionKey(promo.promoNumber) })
      await queryClient.invalidateQueries({ queryKey: promotionListKey })
    })
  }

  const markTested = (note: string) => {
    setMarkOpen(false)
    void statusAct('test', (number) => bbyMaintainApi.markTested({ number, note: note.trim() || null }))
  }

  const backToPlanned = async () => {
    const number = state.bbyNumber
    if (!number) return
    // An Activated bonus buy is live at every till: going back pulls it off them, so ask first.
    if (
      access.backToPlannedAsks &&
      !(await confirmAction(t('backToPlanned.confirmBody', { number: fsi(number) }), t('backToPlanned.confirmTitle')))
    )
      return
    await statusAct('backToPlanned', (n) => bbyMaintainApi.backToPlanned({ number: n }))
  }

  /**
   * New coupon material (spec 2396 stories 44-52): every press mints a NEW `COUP…` item on the
   * server, so nothing is cached or reused. On `saved` the number fills the line it was asked for,
   * like a typed material, and goes up with the next Save; on `refused` the reason is shown.
   */
  const generateCouponMaterial = (key: string, description: string) => {
    setCouponLineKey(null)
    void guarded(async () => {
      setReport(null)
      const got = readGenerateOutcome(await bbyMaintainApi.generateCouponMaterial({ description: description.trim() }))
      if (got.kind === 'refused') {
        setReport({
          title: t('couponMaterial.refused'),
          tone: 'bad',
          rows: got.refusals.length ? [{ refusals: got.refusals }] : [],
        })
        return
      }
      // The line may have been removed, or made a grouping, while the call was out: then say the
      // material exists but was not placed, rather than claim it is on the line.
      const lands = couponMaterialLands(latestState.current, key)
      setState((s) => fillCouponMaterial(s, key, got.material))
      setReport({
        title: t(lands ? 'couponMaterial.done' : 'couponMaterial.notPlaced', { material: fsi(got.material) }),
        tone: lands ? 'ok' : 'bad',
        rows: [],
      })
    })
  }

  const couponMaterial: CouponMaterialAction = {
    offered: (line) => couponMaterialOffered(access, line),
    onPress: setCouponLineKey,
    busy,
  }

  const stale = report?.stale === true
  const unsaved = formChanged(opened, state)
  const status = doc ? overviewStatus(doc.bbyStatus) : 'planned'

  return (
    <>
      {/* ── SAP's toolbar: Check, Save, Local Material Grouping, plus Copy ── */}
      <div className="flex flex-wrap items-center gap-2">
        {access.canCheck && (
          <Button variant="secondary" disabled={busy} onClick={check}>
            {t('editor.check')}
          </Button>
        )}
        {access.canSave && (
          <Button variant="primary" disabled={busy} onClick={save}>
            {t('editor.save')}
          </Button>
        )}
        <Button variant="secondary" disabled={busy} onClick={() => setGroupingOpen(true)}>
          {t('editor.grouping')}
        </Button>
        {access.canCopy && (
          <Button variant="secondary" disabled={busy} onClick={copy}>
            {t('editor.copy')}
          </Button>
        )}
        {access.canMarkTested && (
          <Button
            variant="secondary"
            disabled={busy || unsaved}
            title={unsaved ? t('test.saveFirst') : undefined}
            onClick={() => setMarkOpen(true)}
          >
            {t('test.mark')}
          </Button>
        )}
        {access.canBackToPlanned && (
          <Button variant="secondary" disabled={busy} onClick={() => void backToPlanned()}>
            {t('backToPlanned.run')}
          </Button>
        )}
        {busy && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden />}
      </div>

      {access.reason && (
        <p className="rounded-md border border-border/60 bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
          {t(`editor.readOnly.${access.reason}`)}
        </p>
      )}

      {report && (
        <div className="flex flex-col gap-2">
          <ActReport report={report} />
          {stale && (
            <div>
              <Button variant="primary" disabled={busy} onClick={reload}>
                {t('editor.reload')}
              </Button>
            </div>
          )}
        </div>
      )}

      {/* ── the tabs ── */}
      <div className="flex flex-col">
        <div role="tablist" className="flex flex-wrap">
          {TABS.map((id) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              onClick={() => setTab(id)}
              className={
                'rounded-t-md border border-b-0 px-3 py-1 text-sm ' +
                (tab === id
                  ? 'border-border/60 bg-card font-semibold'
                  : 'border-transparent text-muted-foreground hover:text-foreground')
              }
            >
              {t(`editor.tab.${id}`)}
            </button>
          ))}
        </div>

        {/* One disabled fieldset governs every input on every tab: display cannot leak a field. */}
        <fieldset
          disabled={access.readOnly}
          data-readonly={access.readOnly ? 'true' : undefined}
          className="flex min-w-0 flex-col gap-3 rounded-e-lg rounded-b-lg border border-border/60 bg-card p-3"
        >
          {tab === 'header' && (
            <HeaderTab
              state={state}
              update={update}
              setState={setState}
              status={status}
              mark={doc}
              currency={currency}
              readOnly={access.readOnly}
              couponMaterial={couponMaterial}
            />
          )}
          {tab === 'engine' && <EngineRulesTab engine={state.engine} onChange={(engine) => update({ engine })} />}
          {tab === 'promotion' && <PromotionTab promo={promo} />}
          {tab === 'history' && <HistoryTab doc={doc} />}
        </fieldset>
      </div>

      <GroupingDialog
        open={groupingOpen}
        readOnly={access.readOnly}
        onClose={() => setGroupingOpen(false)}
        onConfirm={(next) => {
          setState(next)
          setGroupingOpen(false)
        }}
        state={state}
      />

      <MarkTestedDialog open={markOpen} onClose={() => setMarkOpen(false)} onRun={markTested} />

      {/* Mounted per press, so its description starts again from the bonus buy's text. */}
      {couponLineKey && (
        <CouponMaterialDialog
          initial={couponMaterialDefault(state)}
          onClose={() => setCouponLineKey(null)}
          onRun={(description) => generateCouponMaterial(couponLineKey, description)}
        />
      )}
    </>
  )
}

/**
 * New coupon material's prompt: the new item's description, defaulting to the bonus buy's text.
 * No `maxLength`: the server clamps the description to the item master's width (BackOffice 2404).
 */
function CouponMaterialDialog({
  initial,
  onClose,
  onRun,
}: {
  initial: string
  onClose: () => void
  onRun: (description: string) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const [description, setDescription] = useState(initial)
  return (
    <Modal
      open
      onClose={onClose}
      title={t('couponMaterial.title')}
      width="28rem"
      footer={
        <>
          <Button variant="text" onClick={onClose}>
            {t('couponMaterial.cancel')}
          </Button>
          <Button variant="primary" onClick={() => onRun(description)}>
            {t('couponMaterial.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('couponMaterial.hint')}</p>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('couponMaterial.description')}
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className={`${INPUT} w-full`}
            data-testid="bby-coupon-material-description"
            autoFocus
          />
        </label>
      </div>
    </Modal>
  )
}

/** Mark Tested's prompt: an optional note, kept by the server with who and when (spec 2396 story 3). */
function MarkTestedDialog({
  open,
  onClose,
  onRun,
}: {
  open: boolean
  onClose: () => void
  onRun: (note: string) => void
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const [note, setNote] = useState('')
  const close = () => {
    setNote('')
    onClose()
  }
  return (
    <Modal
      open={open}
      onClose={close}
      title={t('test.title')}
      width="28rem"
      footer={
        <>
          <Button variant="text" onClick={close}>
            {t('test.cancel')}
          </Button>
          <Button
            variant="primary"
            onClick={() => {
              const typed = note
              setNote('')
              onRun(typed)
            }}
          >
            {t('test.run')}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-xs text-muted-foreground">{t('test.hint')}</p>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('test.note')}
          <textarea
            value={note}
            maxLength={TEST_NOTE_MAX}
            rows={3}
            placeholder={t('test.notePlaceholder')}
            onChange={(e) => setNote(e.target.value)}
            className="rounded-md border border-border/60 bg-background px-2.5 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
            data-testid="bby-test-note"
            autoFocus
          />
        </label>
      </div>
    </Modal>
  )
}

/**
 * Who marked it Tested, when, and their note (spec 2396 story 7). Data, isolated by kind: the
 * time is a machine value (`Ltr`), the name and the note are free text (`<bdi>`).
 */
function TestMark({ mark }: { mark: BbyTestMark | null }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  if (!mark?.testedBy && !mark?.testedAt) return null
  return (
    <dl className="grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-1 text-sm" data-testid="bby-test-mark">
      <dt className="text-xs font-medium text-muted-foreground">{t('test.by')}</dt>
      <dd>
        <bdi>{mark.testedBy ?? ''}</bdi>
      </dd>
      <dt className="text-xs font-medium text-muted-foreground">{t('test.at')}</dt>
      <dd>
        <Ltr>{formatDateTime(mark.testedAt)}</Ltr>
      </dd>
      {mark.testNote && (
        <>
          <dt className="text-xs font-medium text-muted-foreground">{t('test.noteLabel')}</dt>
          <dd className="max-w-xl whitespace-pre-wrap">
            <bdi>{mark.testNote}</bdi>
          </dd>
        </>
      )}
    </dl>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      <div className="flex h-8 items-center gap-2 text-sm text-foreground">{children}</div>
    </div>
  )
}

function HeaderTab({
  state,
  update,
  setState,
  status,
  mark,
  currency,
  readOnly,
  couponMaterial,
}: {
  state: EditorState
  update: (p: Partial<EditorState>) => void
  setState: React.Dispatch<React.SetStateAction<EditorState>>
  status: ReturnType<typeof overviewStatus>
  mark: BbyTestMark | null
  currency: string
  readOnly: boolean
  couponMaterial: CouponMaterialAction
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <>
      {/* ── the header block ── */}
      <div className="flex flex-wrap items-end gap-3">
        <Field label={t('editor.header.number')}>
          {state.bbyNumber ? (
            <span className="font-mono">
              <Ltr>{state.bbyNumber}</Ltr>
            </span>
          ) : (
            <span className="text-muted-foreground">{t('editor.header.minted')}</span>
          )}
        </Field>
        <TextInput
          label={t('editor.header.text')}
          value={state.description}
          maxLength={BBY_TEXT_MAX}
          onChange={(description) => update({ description })}
          className="w-96"
        />
        <Field label={t('editor.header.status')}>
          <StatusBadge sev={overviewSeverity(status)}>{t(`overview.status.${status}`)}</StatusBadge>
        </Field>
        <Field label={t('editor.header.profile')}>
          <span className="rounded-md border border-border/60 px-2 py-1 font-mono">
            <Ltr>BBCH</Ltr>
          </span>
          {t('editor.header.profileName')}
        </Field>
      </div>
      <TestMark mark={mark} />
      <div className="flex flex-wrap items-end gap-3">
        <DateInput label={t('editor.header.validFrom')} value={state.validFrom} onChange={(validFrom) => update({ validFrom })} />
        <DateInput label={t('editor.header.validTo')} value={state.validTo} onChange={(validTo) => update({ validTo })} />
        <Field label={t('editor.header.currency')}>
          <span className="font-mono">
            <Ltr>{currency}</Ltr>
          </span>
        </Field>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('editor.header.limit')}
          <input
            type="number"
            min={0}
            step={1}
            value={state.limitNumber}
            onChange={(e) => update({ limitNumber: e.target.value })}
            className={`${INPUT} w-28`}
          />
        </label>
      </div>

      {/* ── Organizational Data: the one scope the copy offers, read-only ── */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('editor.org.title')}</h2>
        <label className="flex w-fit flex-col gap-1 text-xs font-medium text-muted-foreground">
          {t('editor.org.type')}
          <select disabled className={`${INPUT} w-56`} value="01">
            <option value="01">{t('editor.org.type01')}</option>
          </select>
        </label>
        <table className="w-fit text-sm">
          <thead>
            <tr className="text-xs text-muted-foreground">
              <th className="pe-6 text-start font-medium">{t('editor.org.salesOrg')}</th>
              <th className="pe-6 text-start font-medium">{t('editor.org.salesOrgName')}</th>
              <th className="pe-6 text-start font-medium">{t('editor.org.channel')}</th>
              <th className="pe-6 text-start font-medium">{t('editor.org.channelName')}</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td className="pe-6 font-mono">
                <Ltr>{BBY_ORG.salesOrg}</Ltr>
              </td>
              <td className="pe-6">{t('editor.org.salesOrg1000')}</td>
              <td className="pe-6 font-mono">
                <Ltr>{BBY_ORG.channel}</Ltr>
              </td>
              <td className="pe-6">{t('editor.org.channel20')}</td>
            </tr>
          </tbody>
        </table>
      </section>

      {/* ── Bonus Buy Details: Buy and Get ── */}
      <section className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold">{t('editor.details')}</h2>
        {/* ⚠️ No item-lookup door on BbyMaintainWeb yet: said on screen, not only in code. */}
        <p className="text-xs text-muted-foreground">{t('editor.line.descriptionPending')}</p>
        <div className="flex flex-col gap-3">
          <BuyPanel
            state={state}
            setState={setState}
            readOnly={readOnly}
            currency={currency}
            couponMaterial={couponMaterial}
          />
          <GetPanel state={state} setState={setState} readOnly={readOnly} currency={currency} />
        </div>
      </section>
    </>
  )
}

function PromotionTab({ promo }: { promo: BbyPromotion }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  return (
    <dl className="grid w-fit grid-cols-[auto_auto] gap-x-6 gap-y-2 text-sm">
      <dt className="text-muted-foreground">{t('editor.promotionData.number')}</dt>
      <dd className="font-mono">
        <Ltr>{promo.promoNumber}</Ltr>
      </dd>
      <dt className="text-muted-foreground">{t('editor.promotionData.name')}</dt>
      <dd>
        <bdi>{promo.name}</bdi>
      </dd>
      <dt className="text-muted-foreground">{t('editor.promotionData.window')}</dt>
      <dd>
        <Ltr>{formatRange(formatDay(promo.salesFrom), formatDay(promo.salesTo))}</Ltr>
      </dd>
    </dl>
  )
}

/**
 * History of Changes. ⚠️ `BbyMaintainWeb` has no audit read: the `BbyMaintainAudit` rows are
 * written (2376) but no door returns them. What the read does give is the header's last write
 * — who and when — so that is the one row shown until the door exists.
 */
function HistoryTab({ doc }: { doc: BbyBonusBuyDocument | null }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  if (!doc) return <p className="text-sm text-muted-foreground">{t('editor.history.none')}</p>
  return (
    <div className="flex flex-col gap-2">
      <table className="w-fit text-sm">
        <thead>
          <tr className="text-xs text-muted-foreground">
            <th className="pe-6 text-start font-medium">{t('editor.history.at')}</th>
            <th className="pe-6 text-start font-medium">{t('editor.history.by')}</th>
            <th className="pe-6 text-start font-medium">{t('editor.history.act')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td className="pe-6">
              <Ltr>{formatDateTime(doc.changedAt)}</Ltr>
            </td>
            <td className="pe-6">
              <bdi>{doc.changedBy ?? ''}</bdi>
            </td>
            <td className="pe-6">{t('editor.history.lastWritten')}</td>
          </tr>
        </tbody>
      </table>
      <p className="text-xs text-muted-foreground">{t('editor.history.pending')}</p>
    </div>
  )
}
