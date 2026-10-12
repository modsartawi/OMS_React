import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Copy, Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { ReplayRegister, ReplayRequest, ReplayResult } from '@/core/models/sync-console'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import { formatPair, fsi } from '@/core/util/bidi'
import { copyText, type CopyOutcome } from '@/core/util/copy-text'
import { formatDateTime } from '@/core/util/date-format'
import { formatMoney3 } from '@/core/util/number-format'
import { AUDIT_KEY, canReplayReceipts, replayRegistersQuery, syncConsoleAccessQuery, syncConsoleApi } from './api'
import { figure } from './helpers'
import {
  lineColumn,
  pushReady,
  removedLabel,
  replayPreflight,
  replayRefusal,
  replayRequest,
  rereadsRegisters,
  targetStoreCode,
  type ReplayPreflight,
  type ReplaySummary,
  type ReplayWarning,
} from './replay-helpers'
import { shownSource, useReplayDraft } from './replay-draft'
import ConsoleNav from './ConsoleNav'
import Loading from './Loading'
import { TextField } from './TextField'

/**
 * **Receipt replay** (spec 470, ticket 472) — `/admin/sync/replay`, a page of the store
 * sync console for holders of `ActionSync.Replay` (`canReplay`, independent of
 * `canOperate`). A tester pastes a NewPos receipt snapshot, sees what it is (the
 * preflight), picks a target store and register, confirms, and pushes; the server writes
 * it into that store as a new sale with a fresh receipt number, kept out of HQ and SAP
 * (BackOffice ADR 0076). The result shows the new receipt number, ready to copy.
 *
 * 🚩 Privacy: the JSON carries customer, loyalty and tender data. It lives in this page's
 * state only: never logged, never stored, never in the URL.
 *
 * Push needs a completed, non-training sale that balances: the preflight words each reason
 * it cannot be pushed (473). Each refusal of the doors reads in its own words: the
 * registers door's under the store field, the push's in the result area; anything else is
 * the console's usual failure (`replayRefusal`). The recent replays are 475's.
 *
 * The JSON box is the console's in-memory replay **draft** (`useReplayDraft`, 474): the
 * receipt drawer's Replay… fills it and lands here, it survives moving between the
 * console's pages, a reload empties it, and a push keeps it to replay again.
 */
export default function ReplayPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canReplayReceipts}
      ns="sync-console"
      keyPrefix="replay.access"
      title={t('replay.title')}
      subtitle={t('replay.subtitle')}
    >
      <Replay />
    </ScreenGate>
  )
}

/** How long the JSON must stand still before the preflight reads it. */
const PREFLIGHT_DEBOUNCE_MS = 250

const SELECT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-60'

function Replay() {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()

  const text = useReplayDraft((d) => d.text)
  const editDraft = useReplayDraft((d) => d.edit)
  // A result is about the JSON and the target it was pushed with: changing either retires it.
  const [result, setResult] = useState<ReplayResult | null>(null)
  // A refused push shows where its result would have: about the same JSON and target, so retired with them.
  const [pushError, setPushError] = useState<unknown>(null)
  const retireOutcome = () => {
    setResult(null)
    setPushError(null)
  }
  const editText = (next: string) => {
    editDraft(next)
    retireOutcome()
  }
  const settledText = useDebounced(text, PREFLIGHT_DEBOUNCE_MS)
  const preflight = useMemo(() => replayPreflight(settledText), [settledText])
  // Push reads the text as it is now, so it waits for the preflight to have read the same.
  const preflightCurrent = settledText === text
  // The receipt the drawer brought, named only while the box still holds it.
  const source = shownSource(
    useReplayDraft((d) => d.source),
    preflight.kind === 'summary' ? preflight.summary.sourceReceiptNumber : null,
  )

  // The typed code, and the one committed (Enter or blur) whose registers are read.
  const [storeInput, setStoreInput] = useState('')
  const [store, setStore] = useState('')
  const [registerId, setRegisterId] = useState('')
  const commitStore = () => {
    const code = targetStoreCode(storeInput)
    setStoreInput(code)
    if (code === store) {
      // The same code again is the way to ask a refused store once more.
      if (registers.isError) void registers.refetch()
      return
    }
    setStore(code)
    setRegisterId('')
    retireOutcome()
  }
  const registers = useQuery({ ...replayRegistersQuery(store), enabled: store !== '' })
  const pickRegister = (id: string) => {
    setRegisterId(id)
    retireOutcome()
  }
  const register = registers.data?.registers.find((r) => r.registerId === registerId)

  const [confirming, setConfirming] = useState<{ request: ReplayRequest; register: ReplayRegister } | null>(null)
  const push = useMutation({
    mutationFn: (body: ReplayRequest) => syncConsoleApi.replay(body),
    // 🚩 The mutation's variables ARE the snapshot: nothing of it is kept in the cache once settled.
    gcTime: 0,
    onSuccess: (answer) => {
      setResult(answer)
      setConfirming(null)
      push.reset()
      // The door writes one audit row per push.
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
    },
    // The confirm has done its job: a refusal (or a 500) is read in the result area, beside what it is about.
    onError: (err, body) => {
      setPushError(err)
      setConfirming(null)
      push.reset()
      // A store or register the door refused: read the registers again, so the target agrees with it.
      if (rereadsRegisters(apiErrorCode(err))) void qc.invalidateQueries({ queryKey: replayRegistersQuery(body.targetStoreCode).queryKey })
    },
  })

  // The preflight has read the text as it is now (`preflightCurrent`), so the body is built from it only on Push.
  const canPush = preflightCurrent && pushReady(preflight) && register !== undefined && !registers.isError
  const openConfirm = () => {
    const request = canPush && register ? replayRequest(text, store, register.registerId) : null
    if (!request || !register) return
    push.reset()
    retireOutcome()
    setConfirming({ request, register })
  }
  const closeConfirm = () => {
    if (push.isPending) return
    push.reset()
    setConfirming(null)
  }

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <ConsoleNav />

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('replay.json.label')}
          <textarea
            value={text}
            onChange={(e) => editText(e.target.value)}
            dir="ltr"
            spellCheck={false}
            autoComplete="off"
            rows={20}
            className="min-h-[20rem] rounded-md border border-border/60 bg-background p-2 font-mono text-xs font-normal text-foreground outline-none focus:border-primary/60"
            data-replay-json=""
          />
          <span className="font-normal text-muted-foreground">{t('replay.json.hint')}</span>
          {source && (
            <span className="font-normal text-muted-foreground" data-replay-source={source.receiptNumber}>
              <Trans
                t={t}
                i18nKey="replay.json.from"
                values={{ receipt: source.receiptNumber, store: source.storeCode }}
                components={{ v: <Ltr /> }}
              />
            </span>
          )}
        </label>

        <div className="flex flex-col gap-4">
          <section className="flex flex-col gap-2" aria-label={t('replay.preflight.title')}>
            <h2 className="text-sm font-semibold">{t('replay.preflight.title')}</h2>
            <Preflight text={settledText} preflight={preflight} />
          </section>

          <section className="flex flex-col gap-2" aria-label={t('replay.target.title')} data-replay-target="">
            <h2 className="text-sm font-semibold">{t('replay.target.title')}</h2>
            <div className="flex flex-wrap items-start gap-3">
              <TextField
                label={t('replay.target.store')}
                hint={t('replay.target.storeHint')}
                value={storeInput}
                onChange={setStoreInput}
                onCommit={commitStore}
                ltr
                data="replay-store"
              />
              <label className="flex flex-col gap-1 text-xs font-medium">
                {t('replay.target.register')}
                <select
                  value={register ? registerId : ''}
                  onChange={(e) => pickRegister(e.target.value)}
                  disabled={!registers.data || registers.isError || registers.data.registers.length === 0}
                  className={SELECT}
                  data-replay-register=""
                >
                  <option value="">{t('replay.target.pickRegister')}</option>
                  {registers.data?.registers.map((r) => (
                    // A native option takes a string only: the pair is isolated whole.
                    <option key={r.registerId} value={r.registerId}>
                      {fsi(formatPair(r.registerId, r.name))}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {store !== '' && registers.isPending && <Loading label={t('replay.target.loading')} />}
            {registers.isError && <Refusal error={registers.error} failedKey="replay.target.failed" data="registers" />}
            {registers.data?.registers.length === 0 && (
              <p className="text-xs text-muted-foreground" data-replay-no-registers="">
                {t('replay.target.none')}
              </p>
            )}
          </section>

          <div>
            <Button variant="primary" disabled={!canPush} onClick={openConfirm} data-replay-push="">
              {t('replay.push')}
            </Button>
          </div>
        </div>
      </div>

      {result && <Result result={result} />}
      {pushError !== null && <Refusal error={pushError} failedKey="replay.confirm.failed" data="push" />}

      {confirming && (
        <Modal
          open
          onClose={closeConfirm}
          title={t('replay.confirm.title')}
          width="30rem"
          footer={
            <>
              <Button variant="text" onClick={closeConfirm} disabled={push.isPending} data-replay-confirm-cancel="">
                {t('dialog.cancel')}
              </Button>
              <Button
                variant="primary"
                disabled={push.isPending}
                onClick={() => push.mutate(confirming.request)}
                data-replay-confirm-push=""
              >
                {push.isPending && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {push.isPending ? t('replay.confirm.pushing') : t('replay.confirm.push')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm" data-replay-confirm="">
            <p data-replay-confirm-body="">
              <Trans
                t={t}
                i18nKey="replay.confirm.body"
                values={{
                  store: confirming.request.targetStoreCode,
                  register: formatPair(confirming.register.registerId, confirming.register.name),
                }}
                components={{ v: <Ltr /> }}
              />
            </p>
            <p className="text-xs text-muted-foreground">{t('replay.confirm.note')}</p>
          </div>
        </Modal>
      )}
    </div>
  )
}

/** The preflight's verdict: where the JSON breaks or why it is not a receipt, or its summary. */
function Preflight({ text, preflight }: { text: string; preflight: ReplayPreflight }) {
  const { t } = useTranslation('sync-console')
  if (preflight.kind === 'invalid') {
    if (preflight.reason === 'empty')
      return (
        <p className="text-xs text-muted-foreground" data-replay-preflight="empty">
          {t('replay.preflight.invalid.empty')}
        </p>
      )
    const where = preflight.at === null ? null : lineColumn(text, preflight.at)
    const reason = t(`replay.preflight.invalid.${preflight.reason}`)
    return (
      <div data-replay-preflight="invalid" data-replay-invalid={preflight.reason}>
        {where ? (
          <ErrorBanner
            className="p-3"
            title={reason}
            message={t('replay.preflight.at', { line: fsi(figure(where.line)), column: fsi(figure(where.column)) })}
          />
        ) : (
          <ErrorBanner className="p-3" message={reason} />
        )}
      </div>
    )
  }
  return <Summary summary={preflight.summary} />
}

function Summary({ summary: s }: { summary: ReplaySummary }) {
  const { t } = useTranslation('sync-console')
  const yesNo = (v: boolean) => t(v ? 'replay.preflight.yes' : 'replay.preflight.no')
  const code = (v: string | null) => (v === null ? t('replay.preflight.none') : <Ltr>{v}</Ltr>)
  return (
    <div className="flex flex-col gap-2" data-replay-preflight="summary">
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 rounded-md border border-border/60 bg-card p-3 text-xs">
        <Fact label={t('replay.preflight.sourceStore')} field="sourceStore" mono>
          {code(s.sourceStoreCode)}
        </Fact>
        <Fact label={t('replay.preflight.sourceReceipt')} field="sourceReceipt" mono>
          {code(s.sourceReceiptNumber)}
        </Fact>
        <Fact label={t('replay.preflight.sourceTransaction')} field="sourceTransaction" mono>
          {code(s.sourceTransactionId)}
        </Fact>
        <Fact label={t('replay.preflight.kind')} field="kind">
          {t(`replay.preflight.kinds.${s.docKind}`)}
        </Fact>
        <Fact label={t('replay.preflight.completed')} field="completed">
          {yesNo(s.completed)}
        </Fact>
        <Fact label={t('replay.preflight.training')} field="training">
          {yesNo(s.training)}
        </Fact>
        <Fact label={t('replay.preflight.lines')} field="lines">
          <Ltr>{figure(s.lineCount)}</Ltr>
        </Fact>
        <Fact label={t('replay.preflight.total')} field="total" mono>
          <Ltr>{formatMoney3(s.total)}</Ltr>
        </Fact>
        <Fact label={t('replay.preflight.tenderTotal')} field="tenderTotal" mono>
          <Ltr>{formatMoney3(s.tenderTotal)}</Ltr>
        </Fact>
        <Fact label={t('replay.preflight.balanced')} field="balanced">
          {yesNo(s.balanced)}
        </Fact>
      </dl>
      {s.warnings.length > 0 && <Warnings summary={s} />}
    </div>
  )
}

/** Each reason this paste cannot be pushed, in words; the balance with both its figures. */
function Warnings({ summary: s }: { summary: ReplaySummary }) {
  const { t } = useTranslation('sync-console')
  const words = (w: ReplayWarning) =>
    w === 'unbalanced'
      ? t('replay.warn.unbalanced', { tendered: fsi(formatMoney3(s.tenderTotal)), total: fsi(formatMoney3(s.total)) })
      : t(`replay.warn.${w}`)
  return (
    // A status, not an alert: it re-reads as the tester types, and must not interrupt them each time.
    <div
      role="status"
      className="flex flex-col gap-1 rounded-md border border-attention-border bg-attention-050 p-3 text-xs text-attention-800"
      data-replay-warnings=""
    >
      <span className="font-semibold">{t('replay.warn.title')}</span>
      <ul className="list-disc ps-5">
        {s.warnings.map((w) => (
          <li key={w} data-replay-warning={w}>
            {words(w)}
          </li>
        ))}
      </ul>
    </div>
  )
}

function Fact({ label, field, mono = false, children }: { label: string; field: string; mono?: boolean; children: ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={mono ? 'font-mono' : ''} data-summary={field}>
        {children}
      </dd>
    </>
  )
}

/** How long the copy's status line stays beside the button. */
const COPY_STATUS_MS = 4000

/** The status line's words and severity token for each outcome. */
const COPY_STATUS = {
  copied: { key: 'replay.result.copied', tone: 'text-success-800' },
  failed: { key: 'replay.result.copyFailed', tone: 'text-danger-800' },
} as const satisfies Record<CopyOutcome, { key: string; tone: string }>

/** The new sale: its receipt number to copy, where and when it was written, its source, and what was removed. */
function Result({ result: r }: { result: ReplayResult }) {
  const { t } = useTranslation('sync-console')
  const [copyOutcome, setCopyOutcome] = useState<CopyOutcome | null>(null)
  useEffect(() => {
    if (!copyOutcome) return
    const timer = window.setTimeout(() => setCopyOutcome(null), COPY_STATUS_MS)
    return () => window.clearTimeout(timer)
  }, [copyOutcome])
  const copy = () => {
    setCopyOutcome(null)
    void copyText(r.receiptNumber).then(setCopyOutcome)
  }
  const copyStatus = copyOutcome ? COPY_STATUS[copyOutcome] : null

  return (
    <section
      className="flex flex-col gap-3 rounded-md border border-border/60 bg-card p-4"
      aria-label={t('replay.result.title')}
      data-replay-result={r.transactionId}
    >
      <h2 className="text-sm font-semibold">{t('replay.result.title')}</h2>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs text-muted-foreground">{t('replay.result.receipt')}</span>
        <span className="font-mono text-lg font-semibold" data-replay-receipt="">
          <Ltr>{r.receiptNumber}</Ltr>
        </span>
        <Button variant="secondary" onClick={copy} aria-label={t('replay.result.copyLabel')} data-replay-copy="">
          <Copy className="h-3.5 w-3.5" aria-hidden />
          {t('replay.result.copy')}
        </Button>
        <span role="status" className={'min-w-[6rem] text-xs font-medium ' + (copyStatus?.tone ?? '')} data-replay-copy-status={copyOutcome ?? ''}>
          {copyStatus && t(copyStatus.key)}
        </span>
      </div>
      <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-xs">
        <Fact label={t('replay.result.transaction')} field="transaction" mono>
          <Ltr>{r.transactionId}</Ltr>
        </Fact>
        <Fact label={t('replay.result.store')} field="store" mono>
          <Ltr>{r.storeCode}</Ltr>
        </Fact>
        <Fact label={t('replay.result.register')} field="register" mono>
          <Ltr>{r.registerId}</Ltr>
        </Fact>
        <Fact label={t('replay.result.at')} field="at">
          <Ltr>{formatDateTime(r.replayedAt)}</Ltr>
        </Fact>
      </dl>
      <p className="text-xs" data-replay-of="">
        {t('replay.result.replayOf', { receipt: fsi(r.replayOf.receiptNumber), store: fsi(r.replayOf.storeCode) })}
      </p>
      <div className="flex flex-col gap-1 text-xs" data-replay-removed="">
        <span className="font-medium">{t('replay.result.removedTitle')}</span>
        {r.removed.length === 0 ? (
          <span className="text-muted-foreground">{t('replay.result.removedNone')}</span>
        ) : (
          <ul className="list-disc ps-5">
            {r.removed.map((link) => {
              const key = removedLabel(link)
              return (
                <li key={link} data-replay-removed-link={link}>
                  {key ? t(key) : <Ltr>{link}</Ltr>}
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </section>
  )
}

/**
 * A refused registers read or push: a replay code in its own words; any other code as the
 * console's usual failure (its shared words or the server's message, with the code beside);
 * a codeless failure (a 500) under the given sentence alone.
 */
function Refusal({ error, failedKey, data }: { error: unknown; failedKey: string; data: string }) {
  const { t } = useTranslation('sync-console')
  const code = apiErrorCode(error)
  const { labelKey, showCode } = replayRefusal(code)
  const message = labelKey ? t(labelKey) : apiErrorMessage(error, '')
  return (
    <div data-replay-error={data} data-replay-error-code={code ?? ''}>
      <ErrorBanner className="p-3" title={message ? t(failedKey) : undefined} message={message || t(failedKey)}>
        {showCode && code && (
          <p className="font-mono text-xs">
            <Ltr>{code}</Ltr>
          </p>
        )}
      </ErrorBanner>
    </div>
  )
}

/** `value`, once it has stood still for `ms`. */
function useDebounced<T>(value: T, ms: number): T {
  const [settled, setSettled] = useState(value)
  useEffect(() => {
    const id = setTimeout(() => setSettled(value), ms)
    return () => clearTimeout(id)
  }, [value, ms])
  return settled
}
