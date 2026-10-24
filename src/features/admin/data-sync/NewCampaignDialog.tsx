import { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router'
import { Loader2, Plus } from 'lucide-react'
import { ApiError, apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { notify } from '@/core/services/notify'
import { fsi } from '@/core/util/bidi'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import type { Mode, SyncProfile } from '@/core/models/data-sync'
import { CAMPAIGNS_KEY, canOperateDataSync, dataSyncAccessQuery, dataSyncApi, profilesQuery } from './api'
import { campaignPath } from './campaign-columns'
import { buildCreateRequest, createRefusalWords, parseStoreCodes, type CreateDraft } from './create-helpers'
import { figure } from './helpers'

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
 * 🔌 564 adds Apply here: `mode` is already the draft's (fixed to ReportOnly in this slice; its
 * switch replaces the note), `reason` already travels through `buildCreateRequest`, and the create
 * call is one `mutationFn` that 564's pause-before / re-pause-after steps can wrap.
 */
function NewCampaignDialog({ onClose, onDenied }: { onClose: () => void; onDenied: () => void }) {
  const { t } = useTranslation('data-sync')
  const qc = useQueryClient()
  const navigate = useNavigate()
  const profiles = useQuery(profilesQuery())

  const [profileId, setProfileId] = useState('')
  const [picked, setPicked] = useState<string[]>([])
  const mode: Mode = 'ReportOnly'
  const [targetKind, setTargetKind] = useState<TargetKind>('fleet')
  const [codesText, setCodesText] = useState('')
  const [name, setName] = useState('')
  const reason = ''

  const profile: SyncProfile | undefined = profiles.data?.find((p) => p.profileId === profileId)
  const profileTables = useMemo(() => profile?.tableSet.map((s) => s.table) ?? [], [profile])
  const parsed = useMemo(() => parseStoreCodes(codesText), [codesText])

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
  const draftOk = !!profile && picked.length > 0 && targetsOk

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
  const busy = send.isPending
  const ready = draftOk && !busy

  const pickProfile = (id: string) => {
    setProfileId(id)
    const p = profiles.data?.find((x) => x.profileId === id)
    setPicked(p ? p.tableSet.map((s) => s.table) : [])
    send.reset()
  }
  const toggleTable = (table: string, on: boolean) =>
    setPicked((cur) => (on ? (cur.includes(table) ? cur : [...cur, table]) : cur.filter((x) => x !== table)))

  const error = send.error
  const code = error ? apiErrorCode(error) : null
  const words = error ? createRefusalWords(error) : null
  const detail = error instanceof ApiError ? (error.details[0]?.errorMessage ?? '') : ''

  return (
    <Modal
      open
      onClose={() => !busy && onClose()}
      title={t('create.title')}
      width="38rem"
      footer={
        <>
          <Button variant="text" onClick={onClose} disabled={busy} data-create-cancel="">
            {t('create.cancel')}
          </Button>
          <Button variant="primary" disabled={!ready} onClick={() => ready && send.mutate()} data-create-submit="">
            {busy && <Loader2 className="h-3 w-3 animate-spin" aria-hidden />}
            {busy ? t('create.submitting') : t('create.submit')}
          </Button>
        </>
      }
    >
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
            <select
              value={profileId}
              onChange={(e) => pickProfile(e.target.value)}
              disabled={busy}
              className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm font-normal"
              data-create-profile=""
            >
              <option value="">{t('create.profilePick')}</option>
              {profiles.data?.map((p) => (
                <option key={p.profileId} value={p.profileId}>
                  {/* A native <option> is a string-only sink: the name is free text, isolated whole with fsi. */}
                  {fsi(p.name)}
                </option>
              ))}
            </select>
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

        {/* ── Mode (564 turns this note into the ReportOnly / Apply switch) ── */}
        <div className="flex flex-col gap-1" data-create-mode={mode}>
          <span className="text-xs font-medium">{t('create.mode')}</span>
          <p className="rounded-md bg-muted px-3 py-2 text-xs text-muted-foreground">{t('create.reportOnlyNote')}</p>
        </div>

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
              <label className="flex flex-col gap-1 text-xs font-medium">
                {t('create.codes')}
                <textarea
                  value={codesText}
                  onChange={(e) => setCodesText(e.target.value)}
                  rows={5}
                  disabled={busy}
                  dir="ltr"
                  className="rounded-md border border-border/60 bg-background px-2 py-1.5 font-mono text-sm font-normal text-foreground outline-none focus:border-primary/60"
                  data-create-codes=""
                />
              </label>
              <p className="text-xs text-muted-foreground">{t('create.codesHint')}</p>
              <p className="text-xs" data-create-codes-count={parsed.codes.length}>
                {parsed.codes.length === 0 ? (
                  <span className="text-muted-foreground">{t('create.codesNone')}</span>
                ) : (
                  <Trans t={t} i18nKey="create.codesCount" count={parsed.codes.length} values={{ figure: figure(parsed.codes.length) }} components={{ n: <Ltr /> }} />
                )}
                {parsed.duplicates > 0 && (
                  <span className="ms-2 text-muted-foreground" data-create-duplicates={parsed.duplicates}>
                    <Trans t={t} i18nKey="create.duplicates" count={parsed.duplicates} values={{ figure: figure(parsed.duplicates) }} components={{ n: <Ltr /> }} />
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

        {/* ── Name ── */}
        <label className="flex flex-col gap-1 text-xs font-medium">
          {t('create.name')}
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={busy}
            maxLength={200}
            className="h-8 rounded-md border border-border/60 bg-background px-2 text-sm font-normal"
            data-create-name=""
          />
        </label>

        <p className="text-xs text-muted-foreground">{t('create.readyNote')}</p>

        {error != null && !isBareDenial(error) && (
          <ErrorBanner className="p-2" title={t('create.failed')} message={apiErrorMessage(error, t('create.failedHint'))}>
            {words && (
              <p className="mt-1 text-xs" data-create-refusal="">
                <Trans
                  t={t}
                  i18nKey={words.key}
                  values={{ store: words.store ?? t('create.refusal.someStore'), table: words.table ?? t('create.refusal.someTable') }}
                  components={{ v: <Ltr /> }}
                />
              </p>
            )}
            {detail && (
              <p className="mt-1 text-xs" data-create-detail="">
                <bdi>{detail}</bdi>
              </p>
            )}
            {code && (
              <span className="font-mono text-xs" data-create-error={code}>
                <Ltr>{code}</Ltr>
              </span>
            )}
          </ErrorBanner>
        )}
      </div>
    </Modal>
  )
}
