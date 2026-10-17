import { useEffect, useRef, useState, type ReactNode } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { RotateCw } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Loader2 } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { RuleDraftSave } from '@/core/models/rule-campaign'
import { rememberSavedDraft, ruleCampaignApi, ruleCampaignKey } from '@/core/rules/api'
import { notify } from '@/core/services/notify'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { useWorkspace } from './context'
import LeaveGuard from './LeaveGuard'
import type { SettingsPageKey } from './menu'
import { draftAfterReread } from './settings-form'

// What every Settings page shares (ticket 509): its draft, its Save, its heading, its own Cancel /
// Save, HQ's refusal, and the question before leaving it with unsaved changes.

/**
 * A page's draft of its part of the campaign, and whether it differs from what HQ last saved.
 *
 * A new read of the campaign replaces the draft only when the draft had no unsaved change, or when
 * it is the answer to this page's own Save (`adoptNext`, called by `useSettingsSave`). A re-read in
 * the background (a refetch on focus, another page's save) never drops what the marketer typed.
 */
export function useSettingsDraft<T>(saved: T) {
  const key = JSON.stringify(saved)
  const [draft, setDraft] = useState<T>(saved)
  /** The saved value the draft is compared with; `saved` is a fresh object on each read. */
  const base = useRef(key)
  const adopt = useRef(false)
  useEffect(() => {
    if (key === base.current) return
    const was = base.current
    const take = adopt.current
    base.current = key
    adopt.current = false
    setDraft((d) => draftAfterReread(d, was, saved, take))
    // `key` stands for `saved`: the effect runs when the value changes, not the object.
  }, [key])
  return {
    draft,
    setDraft,
    dirty: JSON.stringify(draft) !== key,
    reset: () => setDraft(saved),
    adoptNext: () => {
      adopt.current = true
    },
  }
}

/**
 * A page's Save (ticket 522): the page's part goes into the loaded draft and the WHOLE draft is
 * saved at its revision (`Rules/Authoring/Drafts/Save`; `toSave` builds the body with `draftSave`).
 * HQ answers the draft one revision higher with its validation, remembered as a saved draft is —
 * every page reads it, the checks and the offline verdict with it. The page's draft takes HQ's
 * answer (`adoptNext`) — trimmed, normalised, as saved.
 */
export function useSettingsSave<B>(page: SettingsPageKey, toSave: (body: B) => RuleDraftSave, adoptNext: () => void) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: B) => ruleCampaignApi.save(toSave(body)),
    onSuccess: (draft) => {
      adoptNext()
      rememberSavedDraft(queryClient, draft)
      notify.success(t(`settings.${page}.saved`))
    },
  })
}

/** A Settings page: its title and what it is for, then its fields. */
export function SettingsFrame({ page, children }: { page: SettingsPageKey; children: ReactNode }) {
  const { t } = useTranslation('campaign-workspace')
  return (
    <section className="flex flex-col gap-4" data-settings={page}>
      <header>
        <h1 className="text-lg font-semibold tracking-tight">{t(`settings.${page}.title`)}</h1>
        <p className="mt-1 max-w-3xl text-sm text-muted-foreground">{t(`settings.${page}.lede`)}</p>
      </header>
      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-4">{children}</div>
    </section>
  )
}

/** A label beside its control, on the page's two-column grid. */
export function SettingsField({ id, label, hint, children }: { id?: string; label: string; hint?: ReactNode; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 sm:grid-cols-[12rem_1fr] sm:gap-3">
      {id ? (
        <label htmlFor={id} className="pt-1.5 text-xs font-medium text-muted-foreground">
          {label}
        </label>
      ) : (
        <span className="pt-1.5 text-xs font-medium text-muted-foreground">{label}</span>
      )}
      <div className="flex min-w-0 flex-col gap-1">
        {children}
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
    </div>
  )
}

/** The two draft refusals a save can meet, said in the page's own words (ticket 522). */
export const DRAFT_STALE = 'RULES_DRAFT_STALE'
export const DRAFT_PENDING = 'RULES_DRAFT_PENDING'

/**
 * A stale draft (409 `RULES_DRAFT_STALE`): someone saved it since this page read it. The page offers
 * to read it again; the reader's unsaved change is then lost, which the words say: `onReload` drops
 * it (and the refusal) before the read, so the page takes the draft as it now is.
 */
export function StaleDraft({ code: campaign, onReload }: { code: string; onReload?: () => void }) {
  const { t } = useTranslation('campaign-workspace')
  const queryClient = useQueryClient()
  return (
    <div data-draft-stale="">
      <ErrorBanner className="p-2.5" title={t('draft.staleTitle')} message={t('draft.stale')}>
        <Button
          variant="outlined"
          className="mt-2"
          onClick={() => {
            onReload?.()
            void queryClient.refetchQueries({ queryKey: ruleCampaignKey(campaign) })
          }}
          data-draft-reload=""
        >
          <RotateCw className="h-3.5 w-3.5" aria-hidden />
          {t('draft.reload')}
        </Button>
      </ErrorBanner>
    </div>
  )
}

/** HQ's refusal: the envelope's own message, and its code; a stale or a frozen draft in our words.
 *  `onReload` is what a stale draft's Reload drops first: the page's unsaved change and its refusal. */
export function Refusal({ title, fallback, error, onReload }: { title: string; fallback: string; error: unknown; onReload?: () => void }) {
  const { t } = useTranslation('campaign-workspace')
  const { draft } = useWorkspace()
  const code = apiErrorCode(error)
  if (code === DRAFT_STALE) return <StaleDraft code={draft.code} onReload={onReload} />
  if (code === DRAFT_PENDING) return <ErrorBanner className="p-2.5" title={t('draft.pendingTitle')} message={t('draft.pending')} />
  return (
    <ErrorBanner className="p-2.5" title={title} message={apiErrorMessage(error, fallback)}>
      {code && (
        <p className="mt-1 text-xs" data-refusal-code={code}>
          {t('settings.refusalCode')}{' '}
          <span className="font-mono">
            <Ltr>{code}</Ltr>
          </span>
        </p>
      )}
    </ErrorBanner>
  )
}

/**
 * The page's Cancel / Save, HQ's refusal above them, and — while the page has unsaved changes — the
 * question before leaving it. Cancel goes back to what HQ last saved; both wait for a change.
 */
export function SaveRow({
  page,
  dirty,
  blocked = false,
  pending,
  error,
  onCancel,
  onSave,
}: {
  page: SettingsPageKey
  dirty: boolean
  /** A problem on the page holds Save back; the page says which, at its field. */
  blocked?: boolean
  pending: boolean
  error: unknown
  onCancel: () => void
  onSave: () => void
}) {
  const { t } = useTranslation('campaign-workspace')
  // A draft waiting for an approver is frozen (409 `RULES_DRAFT_PENDING`): nothing is saved.
  const frozen = useWorkspace().draft.state === 'pending'
  return (
    <>
      {frozen && (
        <p className="text-xs text-muted-foreground" data-settings-frozen="">
          {t('draft.pending')}
        </p>
      )}
      {error != null && (
        <div data-settings-refusal={page}>
          <Refusal title={t('settings.refusedTitle')} fallback={t('settings.refused')} error={error} onReload={onCancel} />
        </div>
      )}
      <div className="flex flex-wrap items-center justify-end gap-2">
        {dirty && (
          <span className="me-auto text-xs text-muted-foreground" data-settings-dirty="">
            {t('settings.unsaved')}
          </span>
        )}
        <Button variant="text" disabled={!dirty || pending} onClick={onCancel} data-settings-cancel="">
          {t('settings.cancel')}
        </Button>
        <Button variant="primary" disabled={!dirty || blocked || pending || frozen} onClick={onSave} data-settings-save="">
          {pending && <Loader2 className="size-3.5 animate-spin" aria-hidden />}
          {dirty ? t('settings.save') : t('settings.unchanged')}
        </Button>
      </div>
      <LeaveGuard dirty={dirty} words="settings.leave" />
    </>
  )
}

/** A toggle pill (a weekday, a country, a channel): pressed or not. */
export const togglePill = (on: boolean) =>
  'rounded-full border px-2.5 py-1 text-xs transition-colors ' +
  (on ? 'border-primary-border bg-primary-050 font-medium text-primary-800' : 'border-border/60 text-foreground hover:bg-accent')

/** A date, time or select control in the settings' look. */
export const SETTINGS_CONTROL =
  'h-9 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none'

/** A text input in the settings' look; the caller adds its border colour (a problem paints it). */
export const SETTINGS_INPUT = 'h-9 w-full max-w-md rounded-md border bg-background px-2.5 text-sm text-foreground focus:outline-none'
