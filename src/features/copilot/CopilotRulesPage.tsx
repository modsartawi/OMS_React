import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { FlaskConical, History, Loader2, RotateCcw, Save, ShieldAlert } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { CopilotPromptSaveRequest, CopilotPromptVersion } from '@/core/models/copilot'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import LeaveGuard from '@/core/ui/LeaveGuard'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import { formatCount, formatPair, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { canCurateCopilot, copilotAccessQuery } from './access'
import { COPILOT_MAX_QUESTION, copilotAnswerModel, questionFits } from './answer'
import { Answer, Refusal } from './AnswerParts'
import { COPILOT_PROMPT_HISTORY_KEY, COPILOT_PROMPT_KEY, copilotRulesApi } from './rules-api'
import {
  HOUSE_RULES_FIELD,
  READINGS_FIELD,
  READINGS_MAX,
  RULES_MAX,
  SAVED_FIRST,
  canSaveRules,
  curatorRefused,
  draftOf,
  historyRows,
  isRulesDirty,
  mergeOffer,
  readingsOf,
  readingsTooLong,
  refusedField,
  rulesTooLong,
  saveRequest,
  tryRequest,
  type HistoryRow,
  type MergeOffer,
  type RulesDraft,
  type RulesFrame,
} from './rules'

/** A `COPILOT-412` the screen shows at its field: the house rules or the default readings. */
interface FieldRefusal {
  field: typeof HOUSE_RULES_FIELD | typeof READINGS_FIELD
  message: string
}

/** Before the read door answers: no built-in text, the default limit. */
const NO_FRAME: RulesFrame = { builtInDefaultReadings: '', defaultReadingsMaxLength: READINGS_MAX }

/**
 * `/copilot/rules` — a copilot curator edits the house rules (ticket 790, BackOffice 3395): the read-only core,
 * the editor (4,000 characters, a note, Save on `baseVersion`), Try with the draft, and the history with restore.
 * Ticket 874 (BackOffice 3593): the default readings beside the house rules, their own 2,000 limit and counter,
 * saved, tried and restored with them; a `COPILOT-412` naming `defaultReadings` marks that field.
 *
 * 🚩 Fails closed twice: the gate reads `canCurate` off `GET Copilot/Access`, and a `COPILOT-410` from any of
 * the five doors shows the same no-access state.
 *
 * Bidi: the core, the house rules and the note are free text in either script (`dir="auto"`, `<bdi>`); the
 * version, the saver's id, the time and the count are machine values (`Ltr`), the count built as one string.
 */
export default function CopilotRulesPage() {
  const { t } = useTranslation('copilot')
  return (
    <ScreenGate
      query={copilotAccessQuery()}
      can={canCurateCopilot}
      ns="copilot"
      keyPrefix="rules.access"
      title={t('rules.title')}
      subtitle={t('rules.subtitle')}
    >
      <RulesScreen />
    </ScreenGate>
  )
}

const queries = {
  prompt: { queryKey: COPILOT_PROMPT_KEY, queryFn: () => copilotRulesApi.prompt(), retry: false, staleTime: 0 } as const,
  history: { queryKey: COPILOT_PROMPT_HISTORY_KEY, queryFn: () => copilotRulesApi.history(), retry: false } as const,
}

function RulesScreen() {
  const { t } = useTranslation('copilot')
  const qc = useQueryClient()
  const prompt = useQuery(queries.prompt)
  const history = useQuery(queries.history)

  /** A `COPILOT-410` from a mutation: the grant went while the screen was open. */
  const [refused, setRefused] = useState(false)
  /** The version the draft was edited from; its number is the save's `baseVersion`. */
  const [base, setBase] = useState<CopilotPromptVersion | null>(null)
  const [draft, setDraft] = useState<RulesDraft>({ text: '', note: '', readings: '' })
  const [fieldError, setFieldError] = useState<FieldRefusal | null>(null)
  const [conflict, setConflict] = useState<{ offer: MergeOffer; theirs: CopilotPromptVersion } | null>(null)
  const [opened, setOpened] = useState<HistoryRow | null>(null)
  const [confirming, setConfirming] = useState<HistoryRow | null>(null)
  /** The default readings' built-in text and limit, from the read door. */
  const frame: RulesFrame = prompt.data ?? NO_FRAME

  // The first load fills the editor; a later refetch never overwrites what the curator is typing.
  useEffect(() => {
    if (base === null && prompt.data) {
      setBase(prompt.data.active)
      setDraft(draftOf(prompt.data.active, prompt.data))
    }
  }, [base, prompt.data])

  /**
   * A `COPILOT-412` (from Save or Try) at the field it names: the default readings, or the house rules. A field this
   * screen does not draw yet (a starter's path, ticket 875) is a toast.
   */
  const fieldRefused = (err: unknown): boolean => {
    const field = refusedField(err)
    if (field === null) return false
    if (field === READINGS_FIELD) setFieldError({ field, message: apiErrorMessage(err, t('rules.readings.invalid')) })
    else if (field === HOUSE_RULES_FIELD) setFieldError({ field, message: apiErrorMessage(err, t('rules.editor.invalid')) })
    else toast.error(apiErrorMessage(err, t('rules.editor.saveFailed')))
    return true
  }

  const denied = (err: unknown) => {
    if (!curatorRefused(err)) return false
    setRefused(true)
    return true
  }
  const refreshAll = () => {
    void qc.invalidateQueries({ queryKey: COPILOT_PROMPT_KEY, exact: true })
    void qc.invalidateQueries({ queryKey: COPILOT_PROMPT_HISTORY_KEY, exact: true })
  }
  /** A version the server saved (by Save or Restore) becomes the editor's base and text. */
  const adopt = (v: CopilotPromptVersion) => {
    setBase(v)
    setDraft(draftOf(v, frame))
    setFieldError(null)
    refreshAll()
  }
  /** The newest active version, asked afresh. */
  const latest = () => qc.fetchQuery(queries.prompt).then((p) => p.active)

  const save = useMutation({
    mutationFn: (body: CopilotPromptSaveRequest) => copilotRulesApi.save(body),
    onSuccess: (v) => {
      adopt(v)
      toast.success(t('rules.editor.saved', { n: fsi(formatNumber(v.version)) }))
    },
    onError: async (err, body) => {
      if (denied(err)) return
      if (fieldRefused(err)) return
      if (apiErrorCode(err) === SAVED_FIRST) {
        // Nothing is lost silently: their version beside mine, and the curator chooses.
        try {
          const theirs = await latest()
          // Mine as it was sent: `""` default readings read back as the built-in text it showed.
          const mine: RulesDraft = {
            text: body.houseRules,
            note: body.note ?? '',
            readings: body.defaultReadings ? body.defaultReadings : frame.builtInDefaultReadings,
          }
          setConflict({ offer: mergeOffer(theirs, mine, frame), theirs })
          void qc.invalidateQueries({ queryKey: COPILOT_PROMPT_HISTORY_KEY, exact: true })
        } catch (e) {
          if (!denied(e)) toast.error(apiErrorMessage(e, t('rules.editor.saveFailed')))
        }
      } else {
        toast.error(apiErrorMessage(err, t('rules.editor.saveFailed')))
      }
    },
  })

  const revert = useMutation({
    mutationFn: (row: HistoryRow) => copilotRulesApi.revert({ version: row.version }),
    onSuccess: (v, row) => {
      adopt(v)
      setOpened(null)
      toast.success(t('rules.history.restored', { from: fsi(formatNumber(row.version)), n: fsi(formatNumber(v.version)) }))
    },
    onError: async (err) => {
      if (denied(err)) return
      toast.error(apiErrorMessage(err, t('rules.history.restoreFailed')))
      // Someone saved first: the history and the editor's base follow, unless the curator has edits to lose.
      if (apiErrorCode(err) === SAVED_FIRST) {
        try {
          const now = await latest()
          if (!isRulesDirty(draft, base, frame)) adopt(now)
          else refreshAll()
        } catch (e) {
          denied(e)
        }
      }
    },
  })

  /** `v4`: a machine value, isolated whole by the caller. */
  const vTag = (n: number) => t('rules.versionTag', { n: formatNumber(n) })
  const busy = save.isPending || revert.isPending
  const dirty = isRulesDirty(draft, base, frame)

  if (refused || curatorRefused(prompt.error) || curatorRefused(history.error)) return <NoAccess />
  if (prompt.isPending || (base === null && prompt.data)) {
    return (
      <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('rules.loading')}
      </div>
    )
  }
  // Only a load with nothing to show is an error: a failed background refetch keeps the editor and the draft.
  if (!prompt.data || base === null) {
    return <ErrorBanner message={apiErrorMessage(prompt.error, t('rules.loadFailed'))} />
  }

  const onSave = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSaveRules(draft, base, busy, frame)) return
    setFieldError(null)
    save.mutate(saveRequest(draft, base.version, frame))
  }
  const tooLong = rulesTooLong(draft.text)
  const blank = draft.text.trim() === ''
  const readingsMax = frame.defaultReadingsMaxLength
  const readingsLong = readingsTooLong(draft.readings, frame)
  /** The version had none of its own and the curator has not changed the built-in text. */
  const readingsBuiltIn = base.defaultReadings === '' && draft.readings === frame.builtInDefaultReadings && draft.readings !== ''
  // The version in force is the server's, not the one the draft was edited from (someone may have saved since).
  const rows = historyRows(history.data, prompt.data.active.version, frame)
  /** The opened row as the history now reads it, so its active mark follows a save. */
  const openedRow = opened ? (rows.find((r) => r.version === opened.version) ?? opened) : null

  return (
    <div className="flex min-h-0 flex-col gap-6 pb-8" data-rules-screen>
      <LeaveGuard dirty={dirty} words={{ title: t('rules.leave.title'), body: t('rules.leave.body'), stay: t('rules.leave.stay'), go: t('rules.leave.go') }} />

      <details className="rounded-lg border border-border/60 bg-card p-3" data-rules-core>
        <summary className="cursor-pointer select-none text-sm font-medium">{t('rules.core.heading')}</summary>
        <p className="mt-2 text-xs text-muted-foreground">{t('rules.core.hint')}</p>
        <TextPane text={prompt.data.core} className="mt-2 max-h-96" data-rules-core-text />
      </details>

      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={onSave} className="flex min-w-0 flex-col gap-3" data-rules-editor>
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">{t('rules.editor.heading')}</h2>
            <VersionMeta v={base} />
          </div>
          <Field
            label={t('rules.editor.label')}
            hideLabel
            error={
              (fieldError?.field === HOUSE_RULES_FIELD ? fieldError.message : undefined) ??
              (tooLong ? t('rules.editor.tooLong', { max: fsi(formatNumber(RULES_MAX)) }) : dirty && blank ? t('rules.editor.blank') : undefined)
            }
            hint={
              <span data-rules-count>
                {t('rules.editor.chars')} <Ltr>{formatCount(formatNumber(draft.text.length), formatNumber(RULES_MAX))}</Ltr>
              </span>
            }
          >
            <Textarea
              rows={16}
              dir="auto"
              value={draft.text}
              onChange={(e) => {
                // Read now: the updater runs later, after React has put the controlled value back.
                const text = e.target.value
                setDraft((d) => ({ ...d, text }))
                setFieldError(null)
              }}
              className="w-full resize-y font-mono text-xs leading-relaxed"
              data-rules-text
            />
          </Field>
          <Field
            label={t('rules.readings.label')}
            error={
              (fieldError?.field === READINGS_FIELD ? fieldError.message : undefined) ??
              (readingsLong ? t('rules.readings.tooLong', { max: fsi(formatNumber(readingsMax)) }) : undefined)
            }
            hint={
              <span className="flex flex-col gap-0.5">
                <span>{t('rules.readings.hint')}</span>
                {readingsBuiltIn && <span data-rules-readings-builtin>{t('rules.readings.builtIn')}</span>}
                <span data-rules-readings-count>
                  {t('rules.editor.chars')} <Ltr>{formatCount(formatNumber(draft.readings.length), formatNumber(readingsMax))}</Ltr>
                </span>
              </span>
            }
          >
            <Textarea
              rows={8}
              dir="auto"
              value={draft.readings}
              onChange={(e) => {
                const readings = e.target.value
                setDraft((d) => ({ ...d, readings }))
                setFieldError(null)
              }}
              className="w-full resize-y font-mono text-xs leading-relaxed"
              data-rules-readings
            />
          </Field>
          <Field label={t('rules.editor.note')}>
            <Input
              dir="auto"
              value={draft.note}
              placeholder={t('rules.editor.notePlaceholder')}
              onChange={(e) => {
                const note = e.target.value
                setDraft((d) => ({ ...d, note }))
              }}
              data-rules-note
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSaveRules(draft, base, busy, frame)} data-rules-save>
              {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
              {save.isPending ? t('rules.editor.saving') : t('rules.editor.save')}
            </Button>
          </div>
        </form>

        <TryBox draft={draft} frame={frame} onRefused={(err) => denied(err) || (refusedField(err) === READINGS_FIELD && fieldRefused(err))} />
      </div>

      <section className="flex flex-col gap-3" data-rules-history>
        <div>
          <h2 className="flex items-center gap-1.5 text-sm font-semibold">
            <History className="h-4 w-4" aria-hidden />
            {t('rules.history.heading')}
          </h2>
          <p className="mt-1 text-xs text-muted-foreground">{t('rules.history.hint')}</p>
        </div>
        {history.isError ? (
          <ErrorBanner message={apiErrorMessage(history.error, t('rules.loadFailed'))} />
        ) : rows.length === 0 ? (
          <p className="text-xs text-muted-foreground">{history.isPending ? t('rules.loading') : t('rules.history.none')}</p>
        ) : (
          <ol className="flex flex-col gap-1">
            {rows.map((r) => (
              <li key={r.version} data-rules-history-row={r.version} data-active={r.active || undefined}>
                <Button
                  variant="ghost"
                  aria-pressed={opened?.version === r.version}
                  onClick={() => setOpened((o) => (o?.version === r.version ? null : r))}
                  className={`h-auto w-full flex-wrap justify-start gap-x-3 gap-y-0.5 rounded-lg py-2 text-start font-normal ${opened?.version === r.version ? 'bg-primary-050 ring-1 ring-primary-border' : ''}`}
                >
                  <span className="font-semibold text-foreground">
                    <Ltr>{vTag(r.version)}</Ltr>
                  </span>
                  {r.active && <StatusBadge sev="ok">{t('rules.history.active')}</StatusBadge>}
                  {r.savedBy && <Ltr>{r.savedBy}</Ltr>}
                  {r.savedAt && <Ltr>{formatDateTime(r.savedAt)}</Ltr>}
                  {r.revertedFrom !== null && (
                    <span className="text-muted-foreground" data-rules-reverted-from={r.revertedFrom}>
                      <Trans t={t} i18nKey="rules.history.revertedFrom" values={{ n: formatNumber(r.revertedFrom) }} components={{ v: <Ltr /> }} />
                    </span>
                  )}
                  <span className="min-w-0 basis-full truncate text-muted-foreground">
                    {r.note ? <bdi>{r.note}</bdi> : t('rules.history.noNote')}
                  </span>
                </Button>
              </li>
            ))}
          </ol>
        )}

        {openedRow && (
          <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3" data-rules-compare={openedRow.version}>
            <div className="grid gap-3 md:grid-cols-2">
              <Pane label={<Ltr>{vTag(openedRow.version)}</Ltr>} text={openedRow.text} data-rules-compare-old />
              <Pane
                label={
                  <>
                    {t('rules.history.current')} <Ltr>{vTag(base.version)}</Ltr>
                  </>
                }
                text={base.text}
                data-rules-compare-current
              />
            </div>
            <h3 className="text-xs font-semibold">{t('rules.readings.history')}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Pane label={<Ltr>{vTag(openedRow.version)}</Ltr>} text={openedRow.readings} data-rules-compare-old-readings />
              <Pane
                label={
                  <>
                    {t('rules.history.current')} <Ltr>{vTag(base.version)}</Ltr>
                  </>
                }
                text={readingsOf(base, frame)}
                data-rules-compare-current-readings
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="text" onClick={() => setOpened(null)}>
                {t('rules.history.close')}
              </Button>
              {!openedRow.active && (
                <Button variant="secondary" disabled={busy} onClick={() => setConfirming(openedRow)} data-rules-restore>
                  <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                  {t('rules.history.restore')}
                </Button>
              )}
            </div>
          </div>
        )}
      </section>

      <Modal
        open={confirming !== null}
        onClose={() => setConfirming(null)}
        title={t('rules.history.confirmTitle', { n: fsi(formatNumber(confirming?.version ?? 0)) })}
        footer={
          <>
            <Button variant="text" onClick={() => setConfirming(null)}>
              {t('rules.history.cancel')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (confirming) revert.mutate(confirming)
                setConfirming(null)
              }}
              data-rules-restore-confirm
            >
              {t('rules.history.confirm')}
            </Button>
          </>
        }
      >
        <div className="flex flex-col gap-2 text-sm" data-rules-restore-dialog>
          <p>{t('rules.history.confirmBody', { n: fsi(formatNumber(confirming?.version ?? 0)) })}</p>
          {dirty && <p className="text-danger-800">{t('rules.history.confirmDirty')}</p>}
        </div>
      </Modal>

      <Modal
        open={conflict !== null}
        onClose={() => setConflict(null)}
        width="64rem"
        title={t('rules.conflict.title')}
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                if (conflict) adopt(conflict.theirs)
                setConflict(null)
              }}
              data-rules-keep-theirs
            >
              {t('rules.conflict.keepTheirs')}
            </Button>
            <Button
              disabled={busy}
              onClick={() => {
                if (!conflict) return
                setBase(conflict.theirs)
                save.mutate(conflict.offer.saveMineOnTop)
                setConflict(null)
              }}
              data-rules-save-mine
            >
              {t('rules.conflict.saveMine')}
            </Button>
          </>
        }
      >
        {conflict && (
          <div className="flex flex-col gap-3" data-rules-conflict>
            <p className="text-sm">{t('rules.conflict.body', { n: fsi(formatNumber(conflict.offer.theirs.version)) })}</p>
            <div className="grid gap-3 md:grid-cols-2">
              <Pane
                label={
                  <>
                    {t('rules.conflict.theirs')} <Ltr>{formatPair(vTag(conflict.offer.theirs.version), conflict.offer.theirs.savedBy)}</Ltr>
                  </>
                }
                text={conflict.offer.theirs.text}
                data-rules-conflict-theirs
              />
              <Pane label={t('rules.conflict.mine')} text={conflict.offer.mine.text} data-rules-conflict-mine />
            </div>
            <h3 className="text-xs font-semibold">{t('rules.readings.history')}</h3>
            <div className="grid gap-3 md:grid-cols-2">
              <Pane label={t('rules.conflict.theirs')} text={conflict.offer.theirs.readings} data-rules-conflict-theirs-readings />
              <Pane label={t('rules.conflict.mine')} text={conflict.offer.mine.readings} data-rules-conflict-mine-readings />
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}

/** Version N, who saved it and when — or the built-in rules (version 0, never saved). */
function VersionMeta({ v }: { v: CopilotPromptVersion }) {
  const { t } = useTranslation('copilot')
  if (v.version === 0) return <span className="text-xs text-muted-foreground" data-rules-version={0}>{t('rules.editor.builtIn')}</span>
  return (
    <span className="flex flex-wrap items-baseline gap-x-1 text-xs text-muted-foreground" data-rules-version={v.version}>
      {t('rules.editor.version')} <Ltr>{formatNumber(v.version)}</Ltr>
      {v.savedBy && (
        <>
          {' '}
          {t('rules.editor.savedBy')} <Ltr>{v.savedBy}</Ltr>
        </>
      )}
      {v.savedAt && (
        <>
          {' '}
          {t('rules.editor.savedAt')} <Ltr>{formatDateTime(v.savedAt)}</Ltr>
        </>
      )}
    </span>
  )
}

/** Read-only text in its own direction. */
function TextPane({ text, className = '', ...rest }: { text: string; className?: string; [data: `data-${string}`]: unknown }) {
  return (
    <div
      dir="auto"
      className={`overflow-y-auto whitespace-pre-wrap rounded-md border border-border/60 bg-muted/40 p-2.5 font-mono text-xs leading-relaxed ${className}`}
      {...rest}
    >
      {text}
    </div>
  )
}

/** One read-only pane of a side-by-side: its label over its text. No diff (ticket 790 boundaries). */
function Pane({ label, text, ...rest }: { label: ReactNode; text: string; [data: `data-${string}`]: unknown }) {
  return (
    <div className="flex min-w-0 flex-col gap-1" {...rest}>
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <TextPane text={text} className="max-h-[50vh] min-h-32" />
    </div>
  )
}

/**
 * Try it: a question answered with the draft house rules and default readings as they stand, saved or not, drawn
 * by the copilot's own answer rendering and labelled a draft. It joins no conversation; it does count toward the
 * copilot limit.
 */
function TryBox({ draft, frame, onRefused }: { draft: RulesDraft; frame: RulesFrame; onRefused: (err: unknown) => boolean }) {
  const { t } = useTranslation('copilot')
  const [question, setQuestion] = useState('')
  const run = useMutation({
    mutationFn: (q: string) => copilotRulesApi.tryDraft(tryRequest(draft, q, frame)),
    onError: (err) => void onRefused(err),
  })
  const tooLong = question.length > COPILOT_MAX_QUESTION
  const canTry =
    questionFits(question) && draft.text.trim() !== '' && !rulesTooLong(draft.text) && !readingsTooLong(draft.readings, frame) && !run.isPending
  const send = (e: FormEvent) => {
    e.preventDefault()
    if (canTry) run.mutate(question.trim())
  }
  return (
    <section className="flex min-w-0 flex-col gap-3" data-rules-try>
      <div>
        <h2 className="flex items-center gap-1.5 text-sm font-semibold">
          <FlaskConical className="h-4 w-4" aria-hidden />
          {t('rules.try.heading')}
        </h2>
        <p className="mt-1 text-xs text-muted-foreground">{t('rules.try.hint')}</p>
      </div>
      <form onSubmit={send} className="flex flex-col gap-2">
        <Field
          label={t('rules.try.label')}
          error={tooLong ? t('box.tooLong', { max: fsi(formatNumber(COPILOT_MAX_QUESTION)) }) : undefined}
          hint={<span data-rules-try-limit>{t('rules.try.limit')}</span>}
        >
          <Textarea
            rows={3}
            dir="auto"
            value={question}
            placeholder={t('rules.try.placeholder')}
            onChange={(e) => setQuestion(e.target.value)}
            className="w-full resize-y"
            data-rules-try-question
          />
        </Field>
        <div className="flex justify-end">
          <Button type="submit" variant="secondary" disabled={!canTry} data-rules-try-run>
            <FlaskConical className="h-3.5 w-3.5" aria-hidden />
            {t('rules.try.run')}
          </Button>
        </div>
      </form>
      {run.isPending ? (
        <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground" data-rules-try-working>
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('rules.try.working')}
        </div>
      ) : run.isError ? (
        curatorRefused(run.error) ? null : <Refusal err={run.error} />
      ) : run.data ? (
        <div className="flex flex-col gap-2 rounded-2xl border border-dashed border-primary-border bg-card px-3.5 py-2.5" data-rules-try-answer>
          <StatusBadge sev="warn">{t('rules.try.draft')}</StatusBadge>
          {/* Answered under the draft, so no "rules vN": that would name a saved version it was not given. */}
          <Answer model={{ ...copilotAnswerModel(run.data), rules: null }} />
        </div>
      ) : null}
    </section>
  )
}

/** The no-access state, for a `COPILOT-410` after the gate let the curator in: the gate's own card and words. */
function NoAccess() {
  const { t } = useTranslation('copilot')
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" data-rules-refused>
      <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />
      <div className="text-base font-semibold tracking-tight">{t('rules.access.deniedTitle')}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t('rules.access.deniedHint')}</p>
    </div>
  )
}
