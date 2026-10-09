import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import ScreenGate from '@/core/ui/ScreenGate'
import { COMMAND_KINDS, COMMAND_STATUSES } from '@/core/models/sync-console'
import { canOpenSyncConsole, syncConsoleAccessQuery } from './api'
import { EMPTY_COMMANDS_FILTER, commandsQuery, type CommandsFilter } from './command-helpers'
import CommandsFeed from './CommandsFeed'
import ConsoleNav from './ConsoleNav'

/**
 * The fleet-wide commands (spec 444, ticket 448) — `/admin/sync/commands`. Every
 * one-shot command, newest first, filtered by status, batch, store code and kind;
 * a pending one can be cancelled with a reason. The filters are asked when Search
 * is pressed, as on the Audit page.
 */
export default function CommandsPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('commands.title')}
      subtitle={t('commands.subtitle')}
    >
      <Commands />
    </ScreenGate>
  )
}

const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60'

function Commands() {
  const { t } = useTranslation('sync-console')
  const [draft, setDraft] = useState<CommandsFilter>(EMPTY_COMMANDS_FILTER)
  const [filter, setFilter] = useState<CommandsFilter>(EMPTY_COMMANDS_FILTER)
  const set = <K extends keyof CommandsFilter>(field: K) => (value: CommandsFilter[K]) =>
    setDraft((d) => ({ ...d, [field]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setFilter(draft)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ConsoleNav />
      <form onSubmit={submit} aria-label={t('commands.filters')} className="flex flex-wrap items-end gap-2" data-commands-filters="">
        <Field label={t('commands.status')}>
          <select
            value={draft.status}
            onChange={(e) => set('status')(e.target.value as CommandsFilter['status'])}
            className={INPUT}
            data-commands-status=""
          >
            <option value="">{t('commands.statusAny')}</option>
            {COMMAND_STATUSES.map((s) => (
              <option key={s} value={s}>
                {t(`commandStatus.${s}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('commands.kind')}>
          <select
            value={draft.kind}
            onChange={(e) => set('kind')(e.target.value as CommandsFilter['kind'])}
            className={INPUT}
            data-commands-kind=""
          >
            <option value="">{t('commands.kindAny')}</option>
            {COMMAND_KINDS.map((k) => (
              <option key={k} value={k}>
                {t(`commandKinds.${k}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('commands.batch')}>
          <input
            type="text"
            value={draft.batch}
            onChange={(e) => set('batch')(e.target.value)}
            className={INPUT + ' w-32 font-mono'}
            dir="ltr"
            data-commands-batch=""
          />
        </Field>
        <Field label={t('commands.code')}>
          <input
            type="text"
            value={draft.code}
            onChange={(e) => set('code')(e.target.value)}
            className={INPUT + ' w-28 font-mono'}
            dir="ltr"
            data-commands-code=""
          />
        </Field>
        <Button type="submit" className="h-8" data-commands-apply="">
          {t('commands.apply')}
        </Button>
        <Button
          variant="text"
          className="h-8"
          onClick={() => {
            setDraft(EMPTY_COMMANDS_FILTER)
            setFilter(EMPTY_COMMANDS_FILTER)
          }}
          data-commands-clear=""
        >
          {t('commands.clear')}
        </Button>
      </form>
      {/* Keyed on what is asked, so a new filter starts again at page 1. */}
      <CommandsFeed key={JSON.stringify(commandsQuery(filter, 1))} filter={filter} empty={t('commands.empty')} />
    </div>
  )
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      {children}
    </label>
  )
}
