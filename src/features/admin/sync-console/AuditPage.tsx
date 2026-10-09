import { useState, type FormEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import Button from '@/core/ui/Button'
import ScreenGate from '@/core/ui/ScreenGate'
import { canOpenSyncConsole, syncConsoleAccessQuery } from './api'
import { EMPTY_AUDIT_FILTER, auditQuery, auditRangeValid, type AuditFilter } from './control-helpers'
import AuditFeed from './AuditFeed'
import ConsoleNav from './ConsoleNav'

/**
 * The fleet-wide audit feed (spec 444, ticket 447) — `/admin/sync/audit`. Every
 * control, edit and onboarding step, newest first, filtered by from / to / who /
 * code. The filters are asked when Search is pressed; an end date before the start
 * date is refused here rather than sent.
 */
export default function AuditPage() {
  const { t } = useTranslation('sync-console')
  return (
    <ScreenGate
      query={syncConsoleAccessQuery()}
      can={canOpenSyncConsole}
      ns="sync-console"
      title={t('audit.title')}
      subtitle={t('audit.subtitle')}
    >
      <Audit />
    </ScreenGate>
  )
}

const INPUT =
  'h-8 rounded-md border border-border/60 bg-background px-2 text-sm text-foreground outline-none focus:border-primary/60'

function Audit() {
  const { t } = useTranslation('sync-console')
  const [draft, setDraft] = useState<AuditFilter>(EMPTY_AUDIT_FILTER)
  const [filter, setFilter] = useState<AuditFilter>(EMPTY_AUDIT_FILTER)
  const badRange = !auditRangeValid(draft)
  const set = (field: keyof AuditFilter) => (value: string) => setDraft((d) => ({ ...d, [field]: value }))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (!badRange) setFilter(draft)
  }

  return (
    <div className="flex min-w-0 flex-col gap-3">
      <ConsoleNav />
      <form
        onSubmit={submit}
        aria-label={t('audit.filters')}
        className="flex flex-wrap items-end gap-2"
        data-audit-filters=""
      >
        <Field label={t('audit.from')}>
          <input type="date" value={draft.from} max={draft.to || undefined} onChange={(e) => set('from')(e.target.value)} className={INPUT} data-audit-from="" />
        </Field>
        <Field label={t('audit.to')}>
          <input type="date" value={draft.to} min={draft.from || undefined} onChange={(e) => set('to')(e.target.value)} className={INPUT} data-audit-to="" />
        </Field>
        <Field label={t('audit.who')}>
          <input type="text" value={draft.who} onChange={(e) => set('who')(e.target.value)} className={INPUT + ' w-40'} data-audit-who="" />
        </Field>
        <Field label={t('audit.code')}>
          <input
            type="text"
            value={draft.code}
            onChange={(e) => set('code')(e.target.value)}
            className={INPUT + ' w-28 font-mono'}
            dir="ltr"
            data-audit-code=""
          />
        </Field>
        <Button type="submit" disabled={badRange} className="h-8" data-audit-apply="">
          {t('audit.apply')}
        </Button>
        <Button
          variant="text"
          className="h-8"
          onClick={() => {
            setDraft(EMPTY_AUDIT_FILTER)
            setFilter(EMPTY_AUDIT_FILTER)
          }}
          data-audit-clear=""
        >
          {t('audit.clear')}
        </Button>
        {badRange && (
          <span className="text-xs text-danger-800" role="alert" data-audit-bad-range="">
            {t('audit.badRange')}
          </span>
        )}
      </form>
      {/* Keyed on what is asked, so a new filter starts again at page 1. */}
      <AuditFeed key={JSON.stringify(auditQuery(filter, 1))} filter={filter} empty={t('audit.empty')} />
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
