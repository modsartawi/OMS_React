import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2, Plus } from 'lucide-react'
import { ApiError, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import type { Mode, SyncProfile } from '@/core/models/data-sync'
import { CAMPAIGNS_KEY, actionSyncApi, actionSyncFleetQuery, canOperateDataSync, dataSyncAccessQuery, dataSyncApi, profilesQuery } from './api'
import {
  applyTableSplit,
  reasonProblem,
  runApplyFlow,
  stillPausedAfterFailure,
  type ApplyOutcome,
  type ApplyStep,
  type CampaignPageState,
} from './apply-helpers'
import ApplyOutcomeView from './ApplyOutcomeView'
import ApplyPanel, { RefusalList, StoreList, useApplyReadiness } from './ApplyPanel'
import { campaignPath } from './campaign-columns'
import { buildCreateRequest, createRefusalWords, parseStoreCodes, type CreateDraft } from './create-helpers'
import RefusalBanner from './RefusalBanner'
import { groupDigits } from './helpers'

/**
 * The Campaigns page's **New campaign** button and dialog (spec 558, ticket 561).
 *
 * Absent — not disabled — without `DataSync.Operate`, and gone for the page's life after a bare 403
 * from the create door (the grant was revoked under the open page).
 */
export function NewCampaignButton() {
  const { t } = useTranslation('data-sync')
  const access = useQuery(dataSyncAccessQuery())
  const [open, setOpen] = useState(false)
  const [denied, setDenied] = useState(false)
  if (!canOperateDataSync(access.data) || denied) return null
  return (
    <>
      <Button variant="primary" onClick={() => setOpen(true)} data-create-open="">
        <Plus className="h-3.5 w-3.5" aria-hidden />
        {t('create.open')}
      </Button>
      {open && (
        <NewCampaignDialog
          onClose={() => setOpen(false)}
          onDenied={() => {
            setOpen(false)
            setDenied(true)
          }}
        />
      )}
    </>
  )
}

type TargetKind = 'fleet' | 'stores'

/**
 * Pick a profile (its tables listed, all ticked), the targets (the whole fleet, or pasted store
 * codes checked before the call), an optional name → Create. The campaign is created **Ready** and
 * the dialog closes onto its page, where Start waits. A refusal stays in the dialog, in words, so
 * nothing typed is lost.
 *
 * Apply (564) is offered when some ticked table may be written: a reason, the stores' ActionSync
 * readiness, and "pause ActionSync first" (`ApplyPanel`). Its create runs inside `runApplyFlow`
 * (pause untagged → create → re-pause tagged → Start) and ends on `ApplyOutcomeView` rather than
 * closing, so warnings and per-store refusals are read before leaving.
 */
function NewCampaignDialog({ onClose, onDenied }: { onClose: () => void; onDenied: () => void }) {
  const { t } = useTranslation('data-sync')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const profiles = useQuery(profilesQuery())

  const [profileId, setProfileId] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const [chosenMode, setChosenMode] = useState<Mode>('ReportOnly')
  const [targetKind, setTargetKind] = useState<TargetKind>('fleet')
  const [codesText, setCodesText] = useState('')
  const [name, setName] = useState('')
  const [reason, setReason] = useState('')
  const [pauseFirst, setPauseFirst] = useState(true)
  const [step, setStep] = useState<ApplyStep | null>(null)
  const [waiting, setWaiting] = useState<number | null>(null)
  const [outcome, setOutcome] = useState<ApplyOutcome | null>(null)

  const profile: SyncProfile | undefined = profiles.data?.find((p) => p.profileId === profileId)
  const profileTables = useMemo(() => profile?.tableSet.map((s) => s.table) ?? [], [profile])
  const parsed = useMemo(() => parseStoreCodes(codesText), [codesText])

  // Apply (564): only when some ticked table may be written; otherwise the run is report-only.
  const split = useMemo(() => applyTableSplit(profile?.tableSet ?? [], picked), [profile, picked])
  const canApply = split.written.length > 0
  const mode: Mode = chosenMode === 'Apply' && canApply ? 'Apply' : 'ReportOnly'
  const applying = mode === 'Apply'

  const draft: CreateDraft = {
    profileId,
    profileTables,
    pickedTables: picked,
    mode,
    targets: targetKind === 'fleet' ? { kind: 'fleet' } : { kind: 'stores', codes: parsed.codes },
    name,
    reason,
  }
  const targetsOk = targetKind === 'fleet' || (parsed.codes.length > 0 && parsed.malformed.length === 0)
  const check = useApplyReadiness(applying, draft.targets)
  // The pause runs only for a holder of ActionSync.Operate, and needs the stores' readiness to know what to pause.
  const pausing = applying && pauseFirst && check.canPause
  const applyOk = !applying || (reasonProblem(reason) === null && !check.accessPending && (!pausing || check.readiness !== null))
  const draftOk = !!profile && picked.length > 0 && targetsOk && applyOk

  const send = useMutation({
    mutationFn: () => dataSyncApi.createCampaign(buildCreateRequest(draft)),
    onSuccess: (env) => {
      // A report-only create carries no warnings; an Apply create's per-store warnings (errors[]) are 564's.
      void qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY })
      notify.success(t('create.created'))
      onClose()
      if (env.data) navigate(campaignPath(env.data.campaignId))
    },
    onError: (err) => {
      if (isBareDenial(err)) onDenied()
    },
  })
  /**
   * The Apply flow (564, the standing ruling in `runApplyFlow`): pause untagged → create → re-pause
   * tagged → Start. It never throws: what each step did comes back as the outcome. A created
   * campaign turns the dialog into its outcome; anything short of one stays on the form, naming
   * the stores left paused.
   */
  const applyRun = useMutation({
    mutationFn: () =>
      runApplyFlow(
        {
          control: (req) => actionSyncApi.control(req),
          readFleet: () => actionSyncApi.fleet(),
          create: (body) => dataSyncApi.createCampaign(body),
          start: (id) => dataSyncApi.startCampaign(id),
          // The wait's timer lives here, in the flow's driver; the decision is `ackDecision`'s.
          sleep: (ms) => new Promise((done) => setTimeout(done, ms)),
          now: () => Date.now(),
          onStep: setStep,
          onWait: (p) => setWaiting(p.waiting.length),
        },
        {
          body: buildCreateRequest(draft),
          reason,
          toPause: pausing ? (check.readiness?.toPause ?? []) : null,
          alreadySafe: check.readiness?.ready ?? [],
        },
      ),
    onMutate: () => {
      setOutcome(null)
      setWaiting(null)
    },
    onSuccess: (out) => {
      setStep(null)
      setWaiting(null)
      setOutcome(out)
      if (out.campaign) {
        void qc.invalidateQueries({ queryKey: CAMPAIGNS_KEY })
        notify.success(t('apply.outcome.title'))
      } else if (isBareDenial(out.createError) && stillPausedAfterFailure(out).length === 0) onDenied()
    },
    onError: () => {
      setStep(null)
      setWaiting(null)
    },
    // The flow paused stores: the readiness the dialog shows (and a second Create pauses from) is stale.
    onSettled: () => qc.invalidateQueries({ queryKey: actionSyncFleetQuery().queryKey }),
  })
  const created = outcome?.campaign ?? null
  const busy = send.isPending || applyRun.isPending
  const ready = draftOk && !busy
  const submit = () => {
    if (!ready) return
    if (applying) applyRun.mutate()
    else send.mutate()
  }

  const pickProfile = (id: string) => {
    setProfileId(id)
    const p = profiles.data?.find((x) => x.profileId === id)
    setPicked(p ? p.tableSet.map((s) => s.table) : [])
    send.reset()
    setOutcome(null)
  }
  /** "Drop them": the never-appliable stores leave the pasted codes (case-insensitively). */
  const dropStores = (codes: string[]) => {
    const gone = new Set(codes.map((c) => c.toUpperCase()))
    setCodesText(parsed.codes.filter((c) => !gone.has(c.toUpperCase())).join('\n'))
  }
  const toggleTable = (table: string, on: boolean) =>
    setPicked((cur) => (on ? (cur.includes(table) ? cur : [...cur, table]) : cur.filter((x) => x !== table)))

  const error = send.error ?? (outcome?.createError || null)
  const words = error ? createRefusalWords(error) : null
  const detail = error instanceof ApiError ? (error.details[0]?.errorMessage ?? '') : ''

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t('create.title')}
      width="38rem"
      footer={
        created ? (
          <>
            <Button variant="text" onClick={onClose} data-apply-close="">
              {t('apply.outcome.close')}
            </Button>
            <Button
              variant="primary"
              onClick={() => {
                onClose()
                // The create's warnings go along (router state): the campaign page shows them once.
                const state: CampaignPageState = { createWarnings: outcome?.warnings ?? [] }
                navigate(campaignPath(created.campaignId), { state })
              }}
              data-apply-open=""
            >
              {t('apply.outcome.open')}
            </Button>
          </>
        ) : (
          <>
            <Button variant="text" onClick={onClose} disabled={busy} data-create-cancel="">
              {t('create.cancel')}
            </Button>
            <Button variant="primary" disabled={!ready} onClick={submit} data-create-submit="">
              {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
              {!busy ? (
                t('create.submit')
              ) : step === 'waiting' && waiting !== null ? (
                <span data-apply-waiting={waiting}>
                  <Trans t={t} i18nKey="apply.step.waitingCount" count={waiting} values={{ figure: groupDigits(waiting) }} components={{ n: <Ltr /> }} />
                </span>
              ) : step ? (
                t(`apply.step.${step}`)
              ) : (
                t('create.submitting')
              )}
            </Button>
          </>
        )
      }
    >
      {created && outcome ? (
        <ApplyOutcomeView outcome={outcome} paused={outcome.held !== null} />
      ) : (
      <div className="flex flex-col gap-4 text-sm" data-create-dialog="">
        {/* ── Profile ── */}
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('create.profile')}
          {profiles.isPending ? (
            <span className="inline-flex items-center gap-1 font-normal text-muted-foreground" role="status">
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
              {t('create.profilesLoading')}
            </span>
          ) : (
            <Select
              value={profileId}
              onChange={(e) => pickProfile(e.target.value)}
              disabled={busy}
              className="font-normal"
              data-create-profile=""
            >
              <option value="">{t('create.profilePick')}</option>
              {profiles.data?.map((p) => (
                <option key={p.profileId} value={p.profileId}>
                  {/* A native <option> is a string-only sink: the name is free text, isolated whole with fsi. */}
                  {fsi(p.name)}
                </option>
              ))}
            </Select>
          )}
        </label>
        {profiles.isError && <ErrorBanner className="p-2" message={apiErrorMessage(profiles.error, t('create.profilesFailed'))} />}
        {profiles.data?.length === 0 && <p className="text-xs text-muted-foreground">{t('create.noProfiles')}</p>}

        {/* ── Tables ── */}
        {profile && (
          <fieldset className="flex flex-col gap-1" data-create-tables="">
            <legend className="text-xs font-medium">{t('create.tables')}</legend>
            <p className="text-xs text-muted-foreground">{t('create.tablesHint')}</p>
            <ul className="flex flex-col gap-1 rounded-md border border-border/60 p-2">
              {profile.tableSet.map((spec) => (
                <li key={spec.table}>
                  <label className="inline-flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={picked.includes(spec.table)}
                      onChange={(e) => toggleTable(spec.table, e.target.checked)}
                      disabled={busy}
                      data-create-table={spec.table}
                    />
                    <span className="font-mono text-xs">
                      <Ltr>{spec.table}</Ltr>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            {picked.length === 0 && (
              <p className="text-xs text-danger-800" data-create-tables-none="">
                {t('create.tablesNone')}
              </p>
            )}
          </fieldset>
        )}

        {/* ── Mode: report only, or Apply when some ticked table may be written (564) ── */}
        <fieldset className="flex flex-col gap-1" data-create-mode={mode}>
          <legend className="text-xs font-medium">{t('create.mode')}</legend>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="ds-create-mode"
              checked={mode === 'ReportOnly'}
              onChange={() => setChosenMode('ReportOnly')}
              disabled={busy}
              data-create-mode-pick="ReportOnly"
            />
            {t('apply.reportOnly')}
            <span className="text-xs text-muted-foreground">{t('apply.reportOnlyHint')}</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="ds-create-mode"
              checked={mode === 'Apply'}
              onChange={() => setChosenMode('Apply')}
              disabled={busy || !canApply}
              data-create-mode-pick="Apply"
            />
            {t('apply.apply')}
            <span className="text-xs text-muted-foreground">{t('apply.applyHint')}</span>
          </label>
          {profile && !canApply && (
            <p className="text-xs text-muted-foreground" data-apply-unavailable="">
              {t('apply.noApplyTables')}
            </p>
          )}
          {!applying && <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('create.reportOnlyNote')}</p>}
        </fieldset>

        {/* ── Targets ── */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-xs font-medium">{t('create.targets')}</legend>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="ds-create-target"
              checked={targetKind === 'fleet'}
              onChange={() => setTargetKind('fleet')}
              disabled={busy}
              data-create-target="fleet"
            />
            {t('create.fleet')}
            <span className="text-xs text-muted-foreground">{t('create.fleetHint')}</span>
          </label>
          <label className="inline-flex items-center gap-2">
            <input
              type="radio"
              name="ds-create-target"
              checked={targetKind === 'stores'}
              onChange={() => setTargetKind('stores')}
              disabled={busy}
              data-create-target="stores"
            />
            {t('create.stores')}
          </label>
          {targetKind === 'stores' && (
            <div className="flex flex-col gap-1 ps-6">
              <Field label={t('create.codes')} hint={t('create.codesHint')}>
                <Textarea
                  value={codesText}
                  onChange={(e) => setCodesText(e.target.value)}
                  rows={5}
                  disabled={busy}
                  dir="ltr"
                  className="font-mono"
                  data-create-codes=""
                />
              </Field>
              <p className="text-xs" data-create-codes-count={parsed.codes.length}>
                {parsed.codes.length === 0 ? (
                  <span className="text-muted-foreground">{t('create.codesNone')}</span>
                ) : (
                  <Trans t={t} i18nKey="create.codesCount" count={parsed.codes.length} values={{ figure: groupDigits(parsed.codes.length) }} components={{ n: <Ltr /> }} />
                )}
                {parsed.duplicates > 0 && (
                  <span className="ms-2 text-muted-foreground" data-create-duplicates={parsed.duplicates}>
                    <Trans t={t} i18nKey="create.duplicates" count={parsed.duplicates} values={{ figure: groupDigits(parsed.duplicates) }} components={{ n: <Ltr /> }} />
                  </span>
                )}
              </p>
              {parsed.malformed.length > 0 && (
                <div className="rounded-md border border-danger-border bg-danger-050 px-3 py-2 text-xs text-danger-800" data-create-malformed="">
                  <p className="font-medium">{t('create.malformedTitle')}</p>
                  <ul className="mt-1 flex flex-col gap-0.5">
                    {parsed.malformed.map((m, i) => (
                      <li key={i} data-malformed-line={m.line}>
                        <Trans
                          t={t}
                          i18nKey="create.malformedLine"
                          values={{ line: m.line, value: m.value }}
                          components={{ line: <Ltr />, code: <code className="font-mono"><bdi /></code> }}
                        />
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </fieldset>

        {applying && (
          <ApplyPanel
            split={split}
            reason={reason}
            onReason={setReason}
            targets={draft.targets}
            check={check}
            pauseFirst={pauseFirst}
            onPauseFirst={setPauseFirst}
            onDrop={dropStores}
            busy={busy}
          />
        )}

        {/* ── Name ── */}
        <Field label={t('create.name')}>
          <Input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            maxLength={200}
            data-create-name=""
          />
        </Field>

        <p className="text-xs text-muted-foreground">{pausing ? t('apply.flowNote') : t('create.readyNote')}</p>

        {/* ── Apply stopped before a campaign existed: what ActionSync was told, and what is still paused ── */}
        {outcome?.ackStopped && (
          <div data-apply-ack-stopped="">
            <ErrorBanner className="p-2" message={t('apply.ackStopped')} />
          </div>
        )}
        {outcome?.held?.error != null && (
          <ErrorBanner className="p-2" title={t('apply.holdFailed')} message={apiErrorMessage(outcome.held.error, t('create.failedHint'))} />
        )}
        {outcome && !outcome.campaign && (outcome.held?.refused.length ?? 0) > 0 && (
          <div className="rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs" data-apply-refusals="">
            <p className="font-medium">{t('apply.refusedTitle')}</p>
            <RefusalList refused={outcome.held?.refused ?? []} />
          </div>
        )}
        {outcome && stillPausedAfterFailure(outcome).length > 0 && (
          <div
            className="rounded-md border border-danger-border bg-danger-050 px-3 py-2 text-xs text-danger-800"
            data-apply-still-paused={stillPausedAfterFailure(outcome).length}
          >
            <p className="font-medium">{t('apply.stillPausedTitle')}</p>
            <StoreList codes={stillPausedAfterFailure(outcome)} attr="data-apply-still-paused-store" />
            <p className="mt-1">{t('apply.stillPausedHint')}</p>
          </div>
        )}

        {error != null && !isBareDenial(error) && (
          <RefusalBanner
            error={error}
            title={t('create.failed')}
            fallback={t('create.failedHint')}
            detail={detail}
            hook="create"
            words={
              words && (
                <Trans
                  t={t}
                  i18nKey={words.key}
                  values={{ store: words.store ?? t('create.refusal.someStore'), table: words.table ?? t('create.refusal.someTable') }}
                  components={{ v: <Ltr /> }}
                />
              )
            }
          />
        )}
      </div>
      )}
    </Modal>
  )
}
