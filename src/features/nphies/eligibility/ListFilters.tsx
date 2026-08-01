import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'

import type { NphiesProvider } from '@/core/models/nphies'
import { ELIGIBILITY_LIST_REQUEST_STATES, ELIGIBILITY_VERDICTS } from '@/core/nphies/status'
import { isDefaultWindow, setWindowBound, type EligibilityListCriteria } from './list-params'

/**
 * The eligibility list's filter panel and — the point of ticket 212 — the
 * **window chip**.
 *
 * The chip is not decoration. The underlying read is an unordered bulk take, so a
 * list that quietly showed a week would read as *"that's everything"*. Rendering
 * the window as a removable pill is what lets an agent see what they are looking
 * at and widen it deliberately, and its ✕ **removes** the window rather than
 * substituting a wider one.
 *
 * Draft-then-apply, like the BBY inquiry toolbar: typing does not refetch, Search
 * commits. The chip is the one exception and applies immediately — it shows the
 * window that is *in force*, so a ✕ that only queued a change would be showing
 * something false until the agent pressed something else.
 */
interface Props {
  /** The live draft — what the panel's controls are bound to. */
  draft: EligibilityListCriteria
  /** The window actually in force, which is what the chip states. */
  appliedWindow: EligibilityListCriteria['window']
  providers: NphiesProvider[]
  onChange: (patch: Partial<EligibilityListCriteria>) => void
  onSearch: () => void
  onReset: () => void
  /** The chip's ✕ — drops the window from the applied query at once. */
  onRemoveWindow: () => void
  /** The day the screen opened on, so "is this still the default window?" is
   *  asked against the same date the default was built from. */
  today: Date
}

export default function ListFilters({
  draft,
  appliedWindow,
  providers,
  onChange,
  onSearch,
  onReset,
  onRemoveWindow,
  today,
}: Props) {
  const { t } = useTranslation('eligibility')

  return (
    <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-3">
      {/* What window is in force, in words, above the controls that change it. */}
      <div className="flex flex-wrap items-center gap-2">
        {appliedWindow ? (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            {/* 🚩 The chip names the window it is ACTUALLY showing. Only a window
                that still is the default says "Last 7 days" — a widened one that
                kept the phrase would be a seven-month result set labelled as a
                week, which is the very lie the chip exists to prevent, with the
                chip itself telling it. */}
            {t(
              isDefaultWindow(appliedWindow, today) ? 'list.window.chipDefault' : 'list.window.chip',
              {
                from: appliedWindow.fromDate || t('list.window.openStart'),
                to: appliedWindow.toDate || t('list.window.openEnd'),
              },
            )}
            <button
              type="button"
              onClick={onRemoveWindow}
              aria-label={t('list.window.remove')}
              title={t('list.window.remove')}
              className="rounded-full p-0.5 transition-colors hover:bg-primary/20"
            >
              <X className="h-3 w-3" aria-hidden />
            </button>
          </span>
        ) : (
          // Removed, and saying so. Silence here would put the screen straight
          // back into the state the chip exists to prevent — an agent unable to
          // tell "everything" from "everything this week".
          <span
            role="status"
            className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs font-medium text-muted-foreground"
          >
            {t('list.window.removed')}
          </span>
        )}
      </div>

      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(e) => {
          e.preventDefault()
          onSearch()
        }}
      >
        <Field label={t('list.filters.patientId')}>
          <input
            type="text"
            value={draft.patientId}
            onChange={(e) => onChange({ patientId: e.target.value })}
            aria-label={t('list.filters.patientId')}
            className={`w-40 ${CONTROL}`}
          />
        </Field>
        <Field label={t('list.filters.payerCode')}>
          <input
            type="text"
            value={draft.payerCode}
            onChange={(e) => onChange({ payerCode: e.target.value })}
            aria-label={t('list.filters.payerCode')}
            className={`w-32 ${CONTROL}`}
          />
        </Field>
        <Field label={t('list.filters.providerCode')}>
          <select
            value={draft.providerCode}
            onChange={(e) => onChange({ providerCode: e.target.value })}
            aria-label={t('list.filters.providerCode')}
            className={`w-48 ${CONTROL}`}
          >
            {/* 🚩 ALL providers is the default and the first option — the
                opposite of the till, which is pinned to its own store. This is a
                back-office screen and the agent is looking at the estate's work.
                Nothing seeds this from the acting store. */}
            <option value="">{t('list.filters.allProviders')}</option>
            {providers.map((p) => (
              <option key={p.providerCode} value={p.providerCode}>
                {t('form.providerOption', { code: p.providerCode, license: p.license })}
              </option>
            ))}
          </select>
        </Field>

        {/* The two axes, filtering independently — either alone is a legal
            question, so neither select gates the other. */}
        <Field label={t('list.filters.request')}>
          <select
            value={draft.request}
            onChange={(e) => onChange({ request: e.target.value })}
            aria-label={t('list.filters.request')}
            className={`w-36 ${CONTROL}`}
          >
            <option value="">{t('list.filters.anyRequest')}</option>
            {/* Two, not four. `Cancelled` because there is no cancel act on an
                eligibility check; `Pending` because the state is not persisted at
                all (`NEligibility` has no `Outcome` column) — see
                `deriveStoredEligibilityAxes`. Offering either would read as
                "there are none this week" and send the agent to widen a window
                that cannot help. */}
            {ELIGIBILITY_LIST_REQUEST_STATES.map((state) => (
              <option key={state} value={state}>
                {t(`request.${state}`)}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('list.filters.verdict')}>
          <select
            value={draft.verdict}
            onChange={(e) => onChange({ verdict: e.target.value })}
            aria-label={t('list.filters.verdict')}
            className={`w-36 ${CONTROL}`}
          >
            <option value="">{t('list.filters.anyVerdict')}</option>
            {ELIGIBILITY_VERDICTS.map((verdict) => (
              <option key={verdict} value={verdict}>
                {t(`verdict.${verdict}`)}
              </option>
            ))}
          </select>
        </Field>

        {/* The window's own controls — how it is widened rather than removed. */}
        <Field label={t('list.filters.fromDate')}>
          <input
            type="date"
            value={draft.window?.fromDate ?? ''}
            onChange={(e) => onChange({ window: setWindowBound(draft.window, 'fromDate', e.target.value) })}
            aria-label={t('list.filters.fromDate')}
            className={`w-40 ${CONTROL}`}
          />
        </Field>
        <Field label={t('list.filters.toDate')}>
          <input
            type="date"
            value={draft.window?.toDate ?? ''}
            onChange={(e) => onChange({ window: setWindowBound(draft.window, 'toDate', e.target.value) })}
            aria-label={t('list.filters.toDate')}
            className={`w-40 ${CONTROL}`}
          />
        </Field>

        <button
          type="submit"
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
        >
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('list.filters.search')}
        </button>
        <button
          type="button"
          onClick={onReset}
          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-border/60 px-4 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted"
        >
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('list.filters.reset')}
        </button>
      </form>
    </div>
  )
}

/** Same control chrome as the check form — one height, one border, one ring. */
const CONTROL =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  )
}
