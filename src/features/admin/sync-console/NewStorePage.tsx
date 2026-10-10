import { useEffect, useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useLocation, useSearchParams } from 'react-router'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { fsi } from '@/core/util/bidi'
import type { LocationRowInput, StoreInput, SyncCommand } from '@/core/models/sync-console'
import {
  AUDIT_KEY,
  COMMANDS_KEY,
  FLEET_KEY,
  PENDING_KEY,
  canOpenSyncConsole,
  syncConsoleAccessQuery,
  syncConsoleApi,
} from './api'
import { pollUntilTerminal } from './command-helpers'
import { cleanReason, controlResultSummary, reasonReady, type ResultSummary } from './control-helpers'
import { notifyOutcome } from './ControlDialog'
import { figure } from './helpers'
import {
  DEFAULT_LOCATION_TEMPLATE,
  DEFAULT_TEMPLATE_STORE,
  LOCATION_COLUMNS,
  LOCATION_TEMPLATE_CHOICES,
  MASTER_COLUMNS,
  PASTE_CAP,
  codeProblem,
  locationRow,
  onboardResultSummary,
  onboardRow,
  parsePastedStores,
  pasteReady,
  wizardStart,
  type PastedStores,
  type WizardMode,
  type WizardResultRow,
} from './onboard-helpers'
import { buildPasteColumns, buildResultColumns, type FollowedTests } from './onboard-columns'
import ConsoleNav from './ConsoleNav'
import TabGrid from './TabGrid'
import { TextField } from './TextField'

/**
 * The New store wizard (spec 444, ticket 449) — `/admin/sync/new-store`. Onboarding
 * is one job in one place (BackOffice 2520):
 *
 * - **Step 1, the store master** (only with `canOnboard`): code, description, city,
 *   area, address, phone, CR and the template store.
 * - **Step 2, the sync location**: the IP and the template location (`P001`, or the
 *   call centre `C011` in one click).
 *
 * One store, or pasted rows (TSV/CSV) parsed into a grid with every bad row marked
 * before any call. **Preview** first; **Create** posts the same inputs and is offered
 * only while they still match the preview. The answer is a row each, and a new
 * location's connection test is followed to its end — its failure is a warning.
 *
 * With `canOnboard` the wizard posts `Store/Onboard` (`alsoCreateLocation`); without
 * it, or for **Finish** from Sync pending (`?code=`), it starts at step 2 and posts
 * `ActionSync/Locations`. A holder who may do neither sees no form at all.
 */
export default function NewStorePage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('onboard.title')}
      subtitle={t('onboard.subtitle')}
    >
      <NewStore />
    </ScreenGate>
  )
}

function NewStore() {
  const { t } = useTranslation('sync-console')
  const access = useQuery(syncConsoleAccessQuery())
  const [params] = useSearchParams()
  const routerState = useLocation().state as { description?: unknown } | null
  const finishCode = params.get('code')
  const start = wizardStart(access.data, finishCode)
  const finishDescription = typeof routerState?.description === 'string' ? routerState.description : ''

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ConsoleNav />
      {start ? (
        // Keyed on the Finish code, so a second Finish starts a fresh wizard.
        <Wizard
          key={finishCode ?? ''}
          start={start}
          canOperate={access.data?.canOperate === true}
          canOnboard={access.data?.canOnboard === true}
          finish={start === 'location' && finishCode ? { code: finishCode, description: finishDescription } : null}
          initialCode={finishCode ?? ''}
        />
      ) : (
        <p className="rounded-md bg-muted px-3 py-2 text-sm text-muted-foreground" data-onboard-none="">
          {t('onboard.viewOnly')}
        </p>
      )}
    </div>
  )
}

type InputMode = 'one' | 'paste'

/** The one-store form, as typed. */
interface OneStore {
  code: string
  description: string
  city: string
  area: string
  address: string
  phone: string
  cr: string
  ip: string
}

const EMPTY_ONE: OneStore = { code: '', description: '', city: '', area: '', address: '', phone: '', cr: '', ip: '' }

/** What one send answered: its rows, its summary, and the sentence that says it. */
interface Answer {
  rows: WizardResultRow[]
  summary: ResultSummary
  sentence: string
}

const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60 disabled:opacity-60'

function Wizard({
  start,
  canOperate,
  canOnboard,
  finish,
  initialCode,
}: {
  start: WizardMode
  canOperate: boolean
  canOnboard: boolean
  /** Finish from Sync pending: step 2 alone, for this one store, its code fixed. */
  finish: { code: string; description: string } | null
  /** A `?code=` a master wizard could not finish (no `canOperate`): typed in for it, not fixed. */
  initialCode: string
}) {
  const { t } = useTranslation('sync-console')
  const qc = useQueryClient()
  const [mode, setMode] = useState<WizardMode>(start)
  const [step, setStep] = useState<1 | 2>(start === 'master' ? 1 : 2)
  const [input, setInput] = useState<InputMode>('one')
  const blankForm = (): OneStore => ({ ...EMPTY_ONE, code: finish?.code ?? initialCode, description: finish?.description ?? '' })
  const [one, setOne] = useState<OneStore>(blankForm)
  const [paste, setPaste] = useState('')
  const [templateStore, setTemplateStore] = useState(DEFAULT_TEMPLATE_STORE)
  const [templateLocation, setTemplateLocation] = useState(DEFAULT_LOCATION_TEMPLATE)
  const [reason, setReason] = useState('')
  const [preview, setPreview] = useState<(Answer & { key: string }) | null>(null)
  const [done, setDone] = useState<(Answer & { master: boolean }) | null>(null)

  const master = mode === 'master'
  const columns = master ? MASTER_COLUMNS : LOCATION_COLUMNS
  const parsed = useMemo(() => parsePastedStores(paste, columns), [paste, columns])
  const setField = (field: keyof OneStore) => (value: string) => setOne((o) => ({ ...o, [field]: value }))

  // ── What would be sent: the rows and the templates. The reason is not part of it (448's ruling).
  const masterRows: StoreInput[] =
    input === 'one'
      ? [
          {
            code: one.code,
            description: one.description.trim(),
            city: one.city.trim(),
            area: one.area.trim(),
            address: one.address.trim(),
            phone: one.phone.trim(),
            cr: one.cr.trim(),
            ip: one.ip.trim(),
          },
        ]
      : parsed.rows.map(({ fields: f }) => ({
          code: f.code,
          description: f.description ?? '',
          city: f.city ?? '',
          area: f.area ?? '',
          address: f.address ?? '',
          phone: f.phone ?? '',
          cr: f.cr ?? '',
          ip: f.ip ?? '',
        }))
  const locationRows: LocationRowInput[] =
    input === 'one'
      ? [{ code: one.code, description: one.description.trim(), ip: one.ip.trim() }]
      : parsed.rows.map(({ fields: f }) => ({ code: f.code, description: f.description ?? '', ip: f.ip ?? '' }))
  const inputs = {
    mode,
    rows: master ? masterRows : locationRows,
    templateStore: master ? templateStore.trim() : null,
    templateLocation: templateLocation.trim(),
  }
  const inputsKey = JSON.stringify(inputs)

  const oneCodeOk = codeProblem(one.code) === null
  const step1Ready = templateStore.trim() !== '' && (input === 'one' ? oneCodeOk : pasteReady(parsed.rows))
  const step2Ready =
    templateLocation.trim() !== '' &&
    (master ? step1Ready : true) &&
    (input === 'one' ? oneCodeOk && one.ip.trim() !== '' : pasteReady(parsed.rows))

  const send = useMutation({
    mutationFn: async ({ asPreview }: { asPreview: boolean; key: string }): Promise<Answer> => {
      const why = cleanReason(reason)
      const when = asPreview ? 'preview' : 'done'
      if (master) {
        const res = await syncConsoleApi.onboard(
          {
            templateStore: inputs.templateStore ?? '',
            rows: masterRows,
            reason: why,
            alsoCreateLocation: true,
            locationTemplateCode: inputs.templateLocation,
          },
          asPreview,
        )
        const s = onboardResultSummary(res.results)
        return {
          rows: res.results.map(onboardRow),
          summary: s,
          sentence: t(`onboard.sentence.${when}`, {
            created: fsi(figure(s.created)),
            skipped: fsi(figure(s.skipped)),
            failed: fsi(figure(s.failed)),
            warnings: fsi(figure(s.warnings.length)),
          }),
        }
      }
      const res = await syncConsoleApi.createLocations({
        templateCode: inputs.templateLocation,
        rows: locationRows,
        reason: why,
        preview: asPreview,
      })
      const s = controlResultSummary(res.results)
      return {
        rows: res.results.map(locationRow),
        summary: s,
        sentence: t(`onboard.locationSentence.${when}`, { ok: fsi(figure(s.ok)), failed: fsi(figure(s.failed)) }),
      }
    },
    onSuccess: (answer, { asPreview, key }) => {
      if (asPreview) {
        // Keyed on what was SENT: an edit made while the preview was in flight leaves it stale.
        setPreview({ ...answer, key })
        return
      }
      notifyOutcome(answer.summary, answer.sentence)
      setDone({ ...answer, master })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
      void qc.invalidateQueries({ queryKey: PENDING_KEY })
      void qc.invalidateQueries({ queryKey: AUDIT_KEY })
      void qc.invalidateQueries({ queryKey: COMMANDS_KEY })
    },
  })

  const busy = send.isPending
  const fresh = preview !== null && preview.key === inputsKey
  const previewColumns = useMemo(
    () => buildResultColumns(t, { preview: true, master: preview?.rows.some((r) => r.store !== null) ?? false, tests: null }),
    [t, preview],
  )
  const canPreview = step2Ready && reasonReady(reason) && !busy
  const canCreate = fresh && preview.rows.some((r) => r.ok) && reasonReady(reason) && !busy

  const restart = () => {
    send.reset()
    setMode(start)
    setStep(start === 'master' ? 1 : 2)
    setOne(blankForm())
    setPaste('')
    setReason('')
    setPreview(null)
    setDone(null)
  }

  const switchMode = (next: WizardMode) => {
    send.reset()
    setMode(next)
    setStep(next === 'master' ? 1 : 2)
  }

  const steps: { key: string; on: boolean }[] = [
    ...(master ? [{ key: 'master', on: !done && step === 1 }] : []),
    { key: 'location', on: !done && step === 2 },
    { key: 'result', on: done !== null },
  ]

  return (
    <div className="flex flex-col gap-3" data-wizard={mode} data-wizard-step={done ? 'result' : step}>
      <ol className="flex flex-wrap gap-2 text-xs" aria-label={t('onboard.steps.label')}>
        {steps.map((s) => (
          <li
            key={s.key}
            aria-current={s.on ? 'step' : undefined}
            className={
              'rounded-full border px-3 py-1 ' +
              (s.on ? 'border-primary bg-primary/10 font-semibold text-primary' : 'border-border/60 text-muted-foreground')
            }
            data-step={s.key}
          >
            {t(`onboard.steps.${s.key}`)}
          </li>
        ))}
      </ol>

      {!done && (
        <div className="flex flex-wrap items-center gap-3 text-sm" data-wizard-input="">
          {/* Chosen where the rows are typed: step 1 of the master wizard, or step 2 alone. */}
          {/* A Finish is the one store it names: no paste. */}
          {(!master || step === 1) && !finish && (
            <fieldset className="flex items-center gap-3" disabled={busy}>
              <legend className="sr-only">{t('onboard.input.label')}</legend>
              {(['one', 'paste'] as const).map((m) => (
                <label key={m} className="flex items-center gap-1.5">
                  <input type="radio" name="onboard-input" checked={input === m} onChange={() => setInput(m)} data-input-mode={m} />
                  {t(`onboard.input.${m}`)}
                </label>
              ))}
            </fieldset>
          )}
          {master && step === 1 && canOperate && (
            <Button variant="text" onClick={() => switchMode('location')} data-wizard-skip="">
              {t('onboard.skipToLocation')}
            </Button>
          )}
          {!master && canOnboard && !finish && (
            <Button variant="text" onClick={() => switchMode('master')} data-wizard-master="">
              {t('onboard.backToMaster')}
            </Button>
          )}
        </div>
      )}

      <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-wizard-panel="">
        {done ? (
          <Result answer={done} onAgain={restart} />
        ) : step === 1 ? (
          <>
            <h2 className="text-sm font-semibold">{t('onboard.steps.master')}</h2>
            {input === 'one' ? (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
                <CodeField value={one.code} onChange={setField('code')} />
                <TextField label={t('onboard.fields.description')} value={one.description} onChange={setField('description')} data="description" />
                <TextField label={t('onboard.fields.city')} value={one.city} onChange={setField('city')} data="city" />
                <TextField label={t('onboard.fields.area')} value={one.area} onChange={setField('area')} data="area" />
                <TextField label={t('onboard.fields.address')} value={one.address} onChange={setField('address')} data="address" />
                <TextField label={t('onboard.fields.phone')} value={one.phone} onChange={setField('phone')} data="phone" ltr />
                <TextField label={t('onboard.fields.cr')} value={one.cr} onChange={setField('cr')} data="cr" ltr />
              </div>
            ) : (
              <PasteBox text={paste} onChange={setPaste} columns={MASTER_COLUMNS} parsed={parsed} />
            )}
            <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
              <TextField
                label={t('onboard.fields.templateStore')}
                hint={t('onboard.templateStoreHint')}
                value={templateStore}
                onChange={setTemplateStore}
                data="template-store"
                ltr
              />
            </div>
            <div className="flex justify-end">
              <Button disabled={!step1Ready} onClick={() => setStep(2)} data-wizard-next="">
                {t('onboard.next')}
              </Button>
            </div>
          </>
        ) : (
          <>
            <h2 className="text-sm font-semibold">{t('onboard.steps.location')}</h2>
            {input === 'paste' && !master ? (
              <PasteBox text={paste} onChange={setPaste} columns={LOCATION_COLUMNS} parsed={parsed} />
            ) : (
              <div className="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-3">
                {master ? (
                  input === 'one' && (
                    <p className="self-end text-sm" data-wizard-code="">
                      <span className="text-muted-foreground">{t('onboard.fields.code')} </span>
                      <span className="font-mono">
                        <Ltr>{one.code}</Ltr>
                      </span>
                    </p>
                  )
                ) : (
                  <>
                    <CodeField value={one.code} onChange={setField('code')} readOnly={finish !== null} />
                    <TextField label={t('onboard.fields.description')} value={one.description} onChange={setField('description')} data="description" />
                  </>
                )}
                {input === 'one' && <TextField label={t('onboard.fields.ip')} value={one.ip} onChange={setField('ip')} data="ip" ltr />}
              </div>
            )}
            {master && input === 'paste' && (
              <p className="text-xs text-muted-foreground" data-wizard-paste-ip="">
                {t('onboard.paste.ipFromRows', { count: parsed.rows.length, n: fsi(figure(parsed.rows.length)) })}
              </p>
            )}
            <TemplateLocationField value={templateLocation} onChange={setTemplateLocation} />
            <ul className="flex flex-col gap-1 rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">
              <li>{t('onboard.notes.credentials')}</li>
              <li>{t('onboard.notes.test')}</li>
            </ul>
            <label className="flex flex-col gap-1 text-xs font-medium">
              {t('dialog.reason')}
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
                required
                disabled={busy}
                className="rounded-md border border-border/60 bg-background px-2 py-1.5 text-sm font-normal text-foreground outline-none focus:border-primary/60"
                data-reason-input=""
              />
            </label>

            {preview && (
              <div className="flex flex-col gap-2" data-wizard-preview={fresh ? 'fresh' : 'stale'}>
                <p className="text-sm" data-preview-sentence="">
                  {preview.sentence}
                </p>
                <TabGrid
                  rows={preview.rows}
                  columns={previewColumns}
                  pending={false}
                  error={null}
                  failed=""
                  empty={t('onboard.result.empty')}
                  loading=""
                  data="onboard-preview"
                />
              </div>
            )}
            {!fresh && (
              <p className="text-xs text-muted-foreground" data-preview-hint="">
                {t(preview ? 'onboard.previewStale' : 'onboard.previewFirst')}
              </p>
            )}
            {send.error != null && (
              <ErrorBanner className="p-2" title={t('onboard.failed')} message={apiErrorMessage(send.error, t('dialog.failedHint'))}>
                {apiErrorCode(send.error) && (
                  <span className="font-mono text-xs" data-onboard-error={apiErrorCode(send.error) ?? ''}>
                    <Ltr>{apiErrorCode(send.error)}</Ltr>
                  </span>
                )}
              </ErrorBanner>
            )}

            {/* The Counter = 0 assumption sits beside Create (BackOffice 2520 decision 4). */}
            <p className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800" data-counter-note="">
              {t('onboard.notes.counters')}
            </p>
            <div className="flex flex-wrap items-center justify-end gap-2">
              {master && (
                <Button variant="text" onClick={() => setStep(1)} disabled={busy} data-wizard-back="">
                  {t('onboard.back')}
                </Button>
              )}
              <Button variant="secondary" disabled={!canPreview} onClick={() => send.mutate({ asPreview: true, key: inputsKey })} data-wizard-preview-button="">
                {busy && send.variables?.asPreview && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {t('onboard.preview')}
              </Button>
              <Button disabled={!canCreate} onClick={() => send.mutate({ asPreview: false, key: inputsKey })} data-wizard-create="">
                {busy && send.variables?.asPreview === false && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
                {t(master ? 'onboard.createMaster' : 'onboard.createLocation')}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

/** The answer of Create: the sentence, a row each, and each new location's connection test. */
function Result({ answer, onAgain }: { answer: Answer & { master: boolean }; onAgain: () => void }) {
  const { t } = useTranslation('sync-console')
  const testIds = useMemo(
    () => answer.rows.flatMap((r) => (r.testCommandId ? [r.testCommandId] : [])),
    [answer.rows],
  )
  const tests = useFollowedTests(testIds)
  const columns = useMemo(() => buildResultColumns(t, { preview: false, master: answer.master, tests }), [t, answer.master, tests])
  return (
    <div className="flex flex-col gap-3" data-wizard-result="">
      <h2 className="text-sm font-semibold">{t('onboard.steps.result')}</h2>
      <p className="text-sm" data-result-sentence="">
        {answer.sentence}
      </p>
      <TabGrid
        rows={answer.rows}
        columns={columns}
        pending={false}
        error={null}
        failed=""
        empty={t('onboard.result.empty')}
        loading=""
        data="onboard-result"
      />
      <div className="flex justify-end">
        <Button variant="secondary" onClick={onAgain} data-wizard-again="">
          {t('onboard.again')}
        </Button>
      </div>
    </div>
  )
}

/**
 * Follows the connection tests `ActionSync/Locations` queued, every 2 s until each is
 * terminal or 60 s have passed (448's poll). The door names each test's command id
 * but not its batch, so each read takes the newest connection tests and picks these
 * out; one not found yet is still being tested. Leaving the page stops the poll.
 */
function useFollowedTests(ids: readonly string[]): FollowedTests | null {
  const qc = useQueryClient()
  const [state, setState] = useState<FollowedTests | null>(null)
  useEffect(() => {
    if (ids.length === 0) return
    const ctl = new AbortController()
    type Seen = Pick<SyncCommand, 'id' | 'status' | 'result'>
    const toMap = (list: Seen[]) => new Map(list.map((c) => [c.id, c]))
    const read = () =>
      syncConsoleApi
        .connectionTests()
        .then((page) => ids.map((id): Seen => page.items.find((c) => c.id === id) ?? { id, status: 'Pending', result: null }))
    setState({ commands: new Map(), timedOut: false })
    void pollUntilTerminal(read, {
      signal: ctl.signal,
      onUpdate: (list) => setState({ commands: toMap(list), timedOut: false }),
    }).then(({ outcome, commands }) => {
      if (outcome === 'aborted') return
      setState({ commands: toMap(commands), timedOut: outcome === 'timeout' })
      void qc.invalidateQueries({ queryKey: COMMANDS_KEY })
      void qc.invalidateQueries({ queryKey: FLEET_KEY })
    })
    return () => ctl.abort()
  }, [ids, qc])
  return ids.length === 0 ? null : state
}

/** A store code typed in, checked as it is typed: four capitals or digits, lowercase refused (never re-cased). */
function CodeField({ value, onChange, readOnly = false }: { value: string; onChange: (v: string) => void; readOnly?: boolean }) {
  const { t } = useTranslation('sync-console')
  const problem = codeProblem(value)
  const verdict = problem ?? 'ok'
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {t('onboard.fields.code')}
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        readOnly={readOnly}
        dir="ltr"
        // Room past four, so a long code is SEEN to fail the check rather than cut silently.
        maxLength={8}
        autoComplete="off"
        spellCheck={false}
        aria-invalid={problem !== null && problem !== 'empty'}
        className={INPUT + ' w-32 font-mono' + (problem && problem !== 'empty' ? ' border-danger' : '')}
        data-field="code"
      />
      <span
        className={'text-xs ' + (problem === null ? 'text-success-800' : problem === 'empty' ? 'text-muted-foreground' : 'text-danger-800')}
        role={problem && problem !== 'empty' ? 'alert' : undefined}
        data-code-check={verdict}
      >
        {t(`onboard.code.${verdict}`)}
      </span>
    </label>
  )
}

/** The template location: a code field, `P001` preselected, with `C011` one click away. */
function TemplateLocationField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const { t } = useTranslation('sync-console')
  return (
    <div className="flex flex-wrap items-end gap-2">
      <TextField
        label={t('onboard.fields.templateLocation')}
        value={value}
        onChange={onChange}
        data="template-location"
        ltr
      />
      <div className="flex gap-1 pb-0.5" role="group" aria-label={t('onboard.templateChoices')}>
        {LOCATION_TEMPLATE_CHOICES.map((code) => (
          <Button
            key={code}
            variant={value.trim() === code ? 'primary' : 'secondary'}
            aria-pressed={value.trim() === code}
            onClick={() => onChange(code)}
            data-template-choice={code}
          >
            <span className="font-mono">
              <Ltr>{code}</Ltr>
            </span>
            {t(`onboard.templates.${code}`)}
          </Button>
        ))}
      </div>
      <span className="w-full text-xs text-muted-foreground">{t('onboard.templateLocationHint')}</span>
    </div>
  )
}

/** The paste box and its preview grid, every bad row marked before any call. */
function PasteBox({
  text,
  onChange,
  columns,
  parsed,
}: {
  text: string
  onChange: (v: string) => void
  columns: readonly string[]
  parsed: PastedStores<string>
}) {
  const { t } = useTranslation('sync-console')
  const pasteColumns = useMemo(() => buildPasteColumns(t, columns), [t, columns])
  const marked = parsed.rows.filter((r) => r.problems.length > 0).length
  const tooMany = parsed.rows.length > PASTE_CAP
  return (
    <div className="flex flex-col gap-2">
      <label className="flex flex-col gap-1 text-xs text-muted-foreground">
        {t('onboard.paste.label', { columns: columns.map((c) => t(`onboard.fields.${c}`)).join(t('list.separator')) })}
        <textarea
          value={text}
          onChange={(e) => onChange(e.target.value)}
          rows={6}
          dir="ltr"
          spellCheck={false}
          className="rounded-md border border-border/60 bg-background px-2 py-1.5 font-mono text-xs text-foreground outline-none focus:border-primary/60"
          data-paste=""
        />
      </label>
      {parsed.rows.length > 0 && (
        <>
          <p className="text-xs" data-paste-tally={`${parsed.rows.length} ${marked}`}>
            {t('onboard.paste.tally', {
              count: parsed.rows.length,
              n: fsi(figure(parsed.rows.length)),
              marked: fsi(figure(marked)),
            })}
            {parsed.headerSkipped && (
              <>
                {' '}
                <span className="text-muted-foreground">{t('onboard.paste.headerSkipped')}</span>
              </>
            )}
          </p>
          {tooMany && (
            <p className="text-xs text-danger-800" role="alert" data-paste-too-many="">
              {t('onboard.paste.tooMany', { cap: fsi(figure(PASTE_CAP)) })}
            </p>
          )}
          <TabGrid
            rows={parsed.rows}
            columns={pasteColumns}
            pending={false}
            error={null}
            failed=""
            empty=""
            loading=""
            data="paste"
          />
        </>
      )}
    </div>
  )
}
