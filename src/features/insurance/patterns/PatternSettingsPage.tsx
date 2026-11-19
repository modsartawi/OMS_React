import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { CalendarClock, Loader2, RotateCcw, Save } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import type { PatternSetting, PatternSettingChange, PatternSettings } from '@/core/models/insurance-pattern-manager'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import ScreenGate from '@/core/ui/ScreenGate'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatRange, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { canManagePatterns } from './access'
import { managerApi, settingsKey } from './manager-api'
import {
  changedSettings,
  draftsOf,
  editsAfterSave,
  SETTING_NAMES,
  SETTING_RANGES,
  settingProblem,
  settingsAfterSave,
  settingsBody,
  type SettingDrafts,
  type SettingName,
  type SettingProblem,
} from './settings'
import { counted } from './words'

/**
 * **Pattern settings** (oms 924; BackOffice spec 4050, door 4055 — STUBBED, the door is not built): the insurance
 * manager tunes the seven thresholds the nightly job finds and scores multi-pharmacy cases with, and reads who changed
 * what, when. A change applies from the next run, and closed cases are never re-scored (4055) — the page says so above
 * the form.
 *
 * Each value is checked against the ONE ranges table (`./settings`) as it is typed. While any value is out of range the
 * save is held and nothing is sent; a save sends only the thresholds that changed.
 *
 * The manager's grant (`canManagePatterns`). The gate hides; the door refuses.
 */
export default function PatternSettingsPage() {
  const { t } = useTranslation('insurance-patterns')
  return (
    <ScreenGate can={canManagePatterns} ns="insurance-patterns" keyPrefix="settings.access" title={t('settings.title')} subtitle={t('settings.subtitle')}>
      <SettingsBody />
    </ScreenGate>
  )
}

const isSettingName = (name: string): name is SettingName => (SETTING_NAMES as readonly string[]).includes(name)

/** A threshold's range as one isolated value ("1–30"), for a sentence. */
const rangeText = (name: SettingName) => fsi(formatRange(SETTING_RANGES[name].min, SETTING_RANGES[name].max))

function SettingsBody() {
  const { t } = useTranslation('insurance-patterns')
  const queryClient = useQueryClient()
  const read = useQuery({ queryKey: settingsKey, queryFn: () => managerApi.settings(), retry: false })
  // Only the fields the manager typed in; every other field reads the saved value.
  const [edits, setEdits] = useState<Partial<SettingDrafts>>({})
  // An edited field shows its problem as it is typed; every field shows its own once a save was tried.
  const [tried, setTried] = useState(false)

  const save = useMutation({
    mutationFn: (sent: { drafts: SettingDrafts; saved: PatternSetting[] }) => managerApi.saveSettings(sent.drafts, sent.saved),
    onSuccess: (answer, sent) => {
      // The PUT answers like the GET, but only an answer naming every threshold is written over what is held: a partial
      // one would blank the fields it leaves out (review 6). The settings are read again either way.
      const body = settingsBody(sent.drafts, sent.saved)
      queryClient.setQueryData<PatternSettings>(settingsKey, (held) => (held && body ? settingsAfterSave(held, body, answer) : answer))
      void queryClient.invalidateQueries({ queryKey: settingsKey })
      // Only what was sent is cleared: a value typed while the save was in flight stays (review 8).
      setEdits((current) => editsAfterSave(current, sent.drafts))
      setTried(false)
      toast.success(t('settings.saved'), { description: t('settings.savedDetail') })
    },
  })

  const data = read.data
  // The whole page says the settings could not be read only when they never were (review 7).
  if (!data && read.isError) return <ErrorBanner title={t('settings.failed')} message={apiErrorMessage(read.error, t('settings.failed'))} className="p-3" />
  if (!data)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('settings.reading')}
      </p>
    )

  const saved = data.settings
  const drafts: SettingDrafts = { ...draftsOf(saved), ...edits }
  const changed = changedSettings(drafts, saved)
  const problems = Object.fromEntries(SETTING_NAMES.map((name) => [name, settingProblem(name, drafts[name])])) as Record<SettingName, SettingProblem | null>
  const anyProblem = SETTING_NAMES.some((name) => problems[name] !== null)
  const ready = changed.length > 0 && !anyProblem && !save.isPending
  // Why the save is held, as the button's title.
  const held = anyProblem ? t('settings.fixFirst') : changed.length === 0 ? t('settings.nothingChanged') : undefined

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (!ready) return
    save.mutate({ drafts, saved })
  }
  const discard = () => {
    setEdits({})
    setTried(false)
    save.reset()
  }
  const problemText = (name: SettingName, problem: SettingProblem) =>
    problem === 'outOfRange' ? t('settings.problem.outOfRange', { range: rangeText(name) }) : t(`settings.problem.${problem}`)

  return (
    <div className="flex flex-col gap-3">
      {/* A failed re-read (after a save) keeps the settings as last read, says so, and offers to read them again. */}
      {read.isError && (
        <div data-testid="pattern-settings-stale">
          <ErrorBanner title={t('settings.stale')} message={apiErrorMessage(read.error, t('settings.stale'))} className="p-2">
            <Button variant="outlined" className="mt-2" onClick={() => void read.refetch()} disabled={read.isFetching} data-testid="pattern-settings-retry">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('settings.readAgain')}
            </Button>
          </ErrorBanner>
        </div>
      )}
      <p role="note" className="flex items-start gap-2 rounded-lg border border-border/60 bg-muted/40 p-3 text-sm" data-testid="pattern-settings-next-run">
        <CalendarClock className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
        <span>{t('settings.nextRun')}</span>
      </p>

      <form
        onSubmit={submit}
        noValidate
        aria-label={t('settings.formLabel')}
        className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-3"
        data-testid="pattern-settings-form"
      >
        <div className="grid grid-cols-1 gap-x-6 gap-y-4 md:grid-cols-2 xl:grid-cols-3">
          {SETTING_NAMES.map((name) => {
            const range = SETTING_RANGES[name]
            const problem = problems[name]
            const isChanged = changed.includes(name)
            const was = saved.find((s) => s.name === name)?.value ?? null
            return (
              <Field
                key={name}
                label={t(`settings.name.${name}`)}
                hint={
                  <span className="flex flex-col gap-0.5">
                    <span>{t(`settings.help.${name}`)}</span>
                    <span data-testid="pattern-setting-range">{t('settings.range', { range: rangeText(name) })}</span>
                    {isChanged && was !== null && <span className="font-medium">{t('settings.was', { value: fsi(formatNumber(was)) })}</span>}
                  </span>
                }
                error={problem !== null && (tried || edits[name] !== undefined) ? problemText(name, problem) : undefined}
              >
                <Input
                  type="number"
                  inputMode={range.whole ? 'numeric' : 'decimal'}
                  min={range.min}
                  max={range.max}
                  step={range.step}
                  dir="ltr"
                  value={drafts[name]}
                  onChange={(e) => setEdits((ed) => ({ ...ed, [name]: e.target.value }))}
                  className={`w-36 tabular-nums ${isChanged ? 'font-semibold' : ''}`}
                  data-testid="pattern-setting"
                  data-setting={name}
                  data-changed={isChanged}
                />
              </Field>
            )
          })}
        </div>

        {save.isError && <ErrorBanner title={t('settings.notSaved')} message={apiErrorMessage(save.error, t('settings.notSaved'))} className="p-2" />}

        <div className="flex flex-wrap items-center justify-end gap-2 border-t border-border/60 pt-3">
          {changed.length > 0 && (
            <span className="me-auto text-xs text-muted-foreground" data-testid="pattern-settings-changed">
              {t('settings.changedCount', counted(changed.length))}
            </span>
          )}
          {changed.length > 0 && (
            <Button variant="text" onClick={discard} disabled={save.isPending} data-testid="pattern-settings-discard">
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              {t('settings.discard')}
            </Button>
          )}
          <Button type="submit" aria-disabled={!ready} title={held} data-testid="pattern-settings-save">
            {save.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Save className="h-3.5 w-3.5" aria-hidden />}
            {t(save.isPending ? 'settings.saving' : 'settings.save')}
          </Button>
        </div>
      </form>

      <ChangeLog changes={data.changes} />
    </div>
  )
}

/** Who changed which threshold, from what to what, and when — newest first. */
function ChangeLog({ changes }: { changes: PatternSettingChange[] }) {
  const { t } = useTranslation('insurance-patterns')
  const rows = [...changes].sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0))
  return (
    <section className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card p-3" aria-labelledby="pattern-settings-log-title" data-testid="pattern-settings-log">
      <h2 id="pattern-settings-log-title" className="text-sm font-semibold">
        {t('settings.log.title')}
      </h2>
      {rows.length === 0 ? (
        <p className="text-sm text-muted-foreground" data-testid="pattern-settings-log-none">
          {t('settings.log.none')}
        </p>
      ) : (
        <div className="overflow-auto">
          <table className="w-full text-sm">
            <thead className="text-xs text-muted-foreground">
              <tr>
                <th className={TH}>{t('settings.log.setting')}</th>
                <th className={`${TH} text-end`}>{t('settings.log.old')}</th>
                <th className={`${TH} text-end`}>{t('settings.log.new')}</th>
                <th className={TH}>{t('settings.log.by')}</th>
                <th className={TH}>{t('settings.log.at')}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((c, i) => (
                <tr key={`${c.at}-${c.name}-${i}`} className="border-t border-border/60" data-testid="pattern-settings-change" data-setting={c.name}>
                  {/* A threshold the page does not know is shown by the server's name, a machine value. */}
                  <td className={TD}>{isSettingName(c.name) ? t(`settings.name.${c.name}`) : <Ltr>{c.name}</Ltr>}</td>
                  <td className={`${TD} text-end tabular-nums`}>
                    <Ltr>{formatNumber(c.oldValue)}</Ltr>
                  </td>
                  <td className={`${TD} text-end tabular-nums`}>
                    <Ltr>{formatNumber(c.newValue)}</Ltr>
                  </td>
                  <td className={TD}>
                    <Ltr>{c.by}</Ltr>
                  </td>
                  <td className={TD}>
                    <Ltr>{formatDateTime(c.at)}</Ltr>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
