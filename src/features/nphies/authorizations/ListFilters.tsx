import { useTranslation } from 'react-i18next'
import { RotateCcw, Search, X } from 'lucide-react'

import type { NphiesProvider } from '@/core/models/nphies'
import { AUTH_VERDICTS, REQUEST_STATES } from '@/core/nphies/status'
import { isDefaultWindow, setWindowBound } from '@/core/nphies/list-window'
import type { AuthListCriteria } from './list-params'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'

/**
 * The authorization list's filter panel and its **window chip** — the same shape
 * the eligibility list opens on (212), over this list's own filter set.
 *
 * The chip is not decoration. The underlying read is an unordered bulk take, so a
 * list that quietly showed a week would read as *"that's everything"*. Rendering
 * the window as a removable pill is what lets an agent see what they are looking
 * at and widen it deliberately, and its ✕ **removes** the window rather than
 * substituting a wider one. The rule it obeys — `isDefaultWindow` — is the shared
 * one in `@/core/nphies/list-window`, so the two lists cannot disagree about what
 * "Last 7 days" means; only this markup and its namespace are local.
 *
 * Draft-then-apply: typing does not refetch, Search commits. The chip is the one
 * exception and applies immediately — it shows the window that is *in force*, so
 * a ✕ that only queued a change would be showing something false until the agent
 * pressed something else.
 */
interface Props {
  /** The live draft — what the panel's controls are bound to. */
  draft: AuthListCriteria
  /** The window actually in force, which is what the chip states. */
  appliedWindow: AuthListCriteria['window']
  providers: NphiesProvider[]
  onChange: (patch: Partial<AuthListCriteria>) => void
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
  const { t } = useTranslation('authorizations')

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
            <IconButton variant="danger" size="compact" label={t('list.window.remove')} onClick={onRemoveWindow}>
              <X className="h-3 w-3" aria-hidden />
            </IconButton>
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
          <Input
            type="text"
            value={draft.patientId}
            onChange={(e) => onChange({ patientId: e.target.value })}
            className="w-40"
          />
        </Field>
        {/* The one filter the eligibility list cannot offer: an eligibility check
            has no preauthorization reference, because none has been raised yet. */}
        <Field label={t('list.filters.preAuthRef')}>
          <Input
            type="text"
            value={draft.preAuthRef}
            onChange={(e) => onChange({ preAuthRef: e.target.value })}
            className="w-44"
          />
        </Field>
        <Field label={t('list.filters.payerCode')}>
          <Input
            type="text"
            value={draft.payerCode}
            onChange={(e) => onChange({ payerCode: e.target.value })}
            className="w-32"
          />
        </Field>
        <Field label={t('list.filters.providerCode')}>
          <Select
            value={draft.providerCode}
            onChange={(e) => onChange({ providerCode: e.target.value })}
            className="w-48"
          >
            {/* 🚩 ALL providers is the default and the first option — the
                opposite of the till, which is pinned to its own store. */}
            <option value="">{t('list.filters.allProviders')}</option>
            {providers.map((p) => (
              <option key={p.providerCode} value={p.providerCode}>
                {t('list.filters.providerOption', { code: p.providerCode, license: p.license })}
              </option>
            ))}
          </Select>
        </Field>

        {/* The two axes, filtering independently — either alone is a legal
            question, so neither select gates the other. */}
        <Field label={t('list.filters.request')}>
          <Select
            value={draft.request}
            onChange={(e) => onChange({ request: e.target.value })}
            className="w-36"
          >
            <option value="">{t('list.filters.anyRequest')}</option>
            {/* All FOUR, unlike the eligibility list's two: `Cancelled` is a real
                column here (`NAuth.Cancelled`) and `Queued` /
                `ClaimProcessingCodes` are persisted, so every value is reachable
                on a stored row. */}
            {REQUEST_STATES.map((state) => (
              <option key={state} value={state}>
                {t(`request.${state}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field label={t('list.filters.verdict')}>
          <Select
            value={draft.verdict}
            onChange={(e) => onChange({ verdict: e.target.value })}
            className="w-40"
          >
            <option value="">{t('list.filters.anyVerdict')}</option>
            {AUTH_VERDICTS.map((verdict) => (
              <option key={verdict} value={verdict}>
                {t(`verdict.${verdict}`)}
              </option>
            ))}
          </Select>
        </Field>

        {/* The window's own controls — how it is widened rather than removed. */}
        <Field label={t('list.filters.fromDate')}>
          <Input
            type="date"
            value={draft.window?.fromDate ?? ''}
            onChange={(e) => onChange({ window: setWindowBound(draft.window, 'fromDate', e.target.value) })}
            className="w-40"
          />
        </Field>
        <Field label={t('list.filters.toDate')}>
          <Input
            type="date"
            value={draft.window?.toDate ?? ''}
            onChange={(e) => onChange({ window: setWindowBound(draft.window, 'toDate', e.target.value) })}
            className="w-40"
          />
        </Field>

        <Button type="submit" variant="primary">
          <Search className="h-3.5 w-3.5" aria-hidden />
          {t('list.filters.search')}
        </Button>
        <Button type="button" variant="outlined" onClick={onReset}>
          <RotateCcw className="h-3.5 w-3.5" aria-hidden />
          {t('list.filters.reset')}
        </Button>
      </form>
    </div>
  )
}
