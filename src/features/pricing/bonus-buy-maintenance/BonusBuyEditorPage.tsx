import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useParams, useSearchParams } from 'react-router'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, Loader2 } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { BbyBonusBuyDocument, BbyPromotion } from '@/core/models/bonus-buy-maintenance'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatRange, fsi } from '@/core/util/bidi'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import {
  bbyMaintainAccessQuery,
  bbyMaintainApi,
  bonusBuyKey,
  canOpenBbyMaintain,
  promotionKey,
  promotionListKey,
} from './api'
import ActReport, { type Report } from './ActReport'
import { BuyPanel, GetPanel } from './BuyGetPanels'
import EngineRulesTab from './EngineRulesTab'
import { DateInput, INPUT, TextInput } from './fields'
import GroupingDialog from './GroupingDialog'
import {
  BBY_ORG,
  BBY_TEXT_MAX,
  editorAccess,
  type EditorAccess,
  type EditorState,
  fromDocument,
  newEditor,
  orgCurrency,
  readEditorOutcome,
  toRequest,
} from './editor'
import {
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
  const [state, setState] = useState<EditorState>(() => (doc ? fromDocument(doc) : newEditor(promo)))
  const [tab, setTab] = useState<Tab>('header')
  const [busy, setBusy] = useState(false)
  const [groupingOpen, setGroupingOpen] = useState(false)
  const access: EditorAccess = editorAccess(mode, doc)
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

  const stale = report?.stale === true
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
            <HeaderTab state={state} update={update} setState={setState} status={status} currency={currency} readOnly={access.readOnly} />
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
    </>
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
  currency,
  readOnly,
}: {
  state: EditorState
  update: (p: Partial<EditorState>) => void
  setState: React.Dispatch<React.SetStateAction<EditorState>>
  status: ReturnType<typeof overviewStatus>
  currency: string
  readOnly: boolean
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
          <BuyPanel state={state} setState={setState} readOnly={readOnly} currency={currency} />
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
