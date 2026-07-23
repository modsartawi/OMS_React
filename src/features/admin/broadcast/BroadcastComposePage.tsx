import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Lock, Send } from 'lucide-react'
import { notify } from '@/core/services/notify'
import { confirmAction } from '@/core/services/confirm'
import { lookupQueries } from '@/core/services/lookups'
import { broadcastApi } from './api'
import {
  EMPTY_FORM,
  TITLE_MAX,
  BODY_MAX,
  validateCompose,
  toCreateRequest,
  type ComposeForm,
  type BroadcastChannel,
} from './helpers'

// Send Broadcast screen (spec 031, features/admin). Soft-gates on the
// NotificationBroadcast grant (038): the page runs the same access probe as the
// shell's permission-aware nav (shared cache key). Denied ⇒ a soft gate naming
// the grant; granted (or an absent/unknown probe) ⇒ the compose card. The server
// Create stays authoritative — a lost grant still refuses on send (NC_FORBIDDEN).
export default function BroadcastComposePage() {
  const { t } = useTranslation('broadcast')
  const access = useQuery({
    queryKey: ['broadcast', 'access'],
    queryFn: () => broadcastApi.access(),
  })

  if (access.isPending) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center gap-2 text-sm text-muted-foreground" role="status">
        <Loader2 className="h-4 w-4 animate-spin" />
        {t('access.checking')}
      </div>
    )
  }

  // A definitive denial (endpoint answered, grant absent) shows the gate. An
  // absent/unknown probe (probed=false) or a transient error degrades to showing
  // the screen — the server refuses on send if the grant is truly missing.
  const denied = access.data ? access.data.probed && !access.data.allowed : false
  if (denied) {
    return (
      <div className="mx-auto mt-16 max-w-lg rounded-lg border border-border/60 bg-card p-8 text-center" role="alert">
        <Lock className="mx-auto mb-3 h-10 w-10 text-muted-foreground/60" aria-hidden />
        <h2 className="text-base font-semibold tracking-tight">{t('denied.title')}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t('denied.hint')}</p>
      </div>
    )
  }

  return <ComposeCard />
}

// The compose form itself. Title + message with live counters, a Whole-fleet /
// One-store segmented channel, the existing open-stores picker for a store
// target, and an optional expiry. Send is disabled until valid (with an inline
// validity hint). A single-store send posts straight through; an all-fleet send
// confirms first (037).
function ComposeCard() {
  const { t } = useTranslation('broadcast')
  const [form, setForm] = useState<ComposeForm>(EMPTY_FORM)

  const stores = useQuery(lookupQueries.storeDetails())
  const storeOptions = useMemo(
    () =>
      (stores.data ?? [])
        .map((s) => ({ code: (s.storeCode ?? '').trim(), city: (s.city ?? '').trim() }))
        .filter((s) => s.code)
        .sort((a, b) => a.code.localeCompare(b.code)),
    [stores.data],
  )

  const validation = validateCompose(form, Date.now())

  const send = useMutation({
    mutationFn: () => broadcastApi.create(toCreateRequest(form)),
    onSuccess: () => {
      const target = form.channel === 'all' ? t('target.fleet') : form.storeCode
      notify.success(t('toast.sentTitle'), t('toast.sentDetail', { target }))
      setForm(EMPTY_FORM)
    },
    // api-envelope: surface the server's refusal message (e.g. NC_FORBIDDEN) via
    // apiErrorMessage rather than a generic error.
    onError: (err) => notify.apiError(t('toast.failed'), err),
  })

  function set<K extends keyof ComposeForm>(key: K, value: ComposeForm[K]) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  // A whole-fleet send raises the blast radius, so it earns a confirm dialog
  // (037). A single-store send goes straight through — a low-blast-radius message
  // isn't nagged. Cancel returns to the form unchanged.
  async function onSend() {
    if (!validation.valid || send.isPending) return
    if (form.channel === 'all') {
      const ok = await confirmAction(
        t('confirm.fleetBody', { title: form.title.trim() }),
        t('confirm.fleetTitle'),
      )
      if (!ok) return
    }
    send.mutate()
  }

  return (
    <section className="mx-auto flex max-w-2xl flex-col gap-4">
      <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>

      <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card p-5">
        {/* Title */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="bc-title" className="text-xs font-semibold">
              {t('field.title')}
            </label>
            <span className={'text-[11px] tabular-nums ' + (form.title.length > TITLE_MAX ? 'text-destructive' : 'text-muted-foreground')}>
              {t('counter', { current: form.title.length, max: TITLE_MAX })}
            </span>
          </div>
          <input
            id="bc-title"
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={t('placeholder.title')}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Message */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="bc-body" className="text-xs font-semibold">
              {t('field.message')}
            </label>
            <span className={'text-[11px] tabular-nums ' + (form.body.length > BODY_MAX ? 'text-destructive' : 'text-muted-foreground')}>
              {t('counter', { current: form.body.length, max: BODY_MAX })}
            </span>
          </div>
          <textarea
            id="bc-body"
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder={t('placeholder.message')}
            className="min-h-[88px] resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Channel */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold">{t('field.sendTo')}</label>
          <div className="inline-flex w-fit gap-1 rounded-full bg-muted p-1" role="tablist">
            {(['all', 'store'] as BroadcastChannel[]).map((ch) => (
              <button
                key={ch}
                type="button"
                role="tab"
                aria-selected={form.channel === ch}
                onClick={() => set('channel', ch)}
                className={
                  'rounded-full px-4 py-1.5 text-sm font-medium transition-colors ' +
                  (form.channel === ch ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground')
                }
              >
                {t(ch === 'all' ? 'channel.fleet' : 'channel.store')}
              </button>
            ))}
          </div>
          {form.channel === 'store' && (
            <select
              aria-label={t('storePicker.label')}
              value={form.storeCode}
              onChange={(e) => set('storeCode', e.target.value)}
              disabled={stores.isPending}
              className="mt-1 rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring disabled:opacity-60"
            >
              <option value="">{t('storePicker.placeholder')}</option>
              {storeOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.city ? `${s.code} · ${s.city}` : s.code}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Expiry */}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="bc-expires" className="text-xs font-semibold">
            {t('field.expires')} <span className="font-normal text-muted-foreground">{t('field.expiresHint')}</span>
          </label>
          <input
            id="bc-expires"
            type="date"
            value={form.expires}
            onChange={(e) => set('expires', e.target.value)}
            className="w-fit rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Whole-fleet blast-radius warning (037) — shown while composing an All send. */}
        {form.channel === 'all' && (
          <div className="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" aria-hidden />
            <span>{t('warn.fleet')}</span>
          </div>
        )}

        {/* Send */}
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onSend}
            disabled={!validation.valid || send.isPending}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2 text-sm font-semibold text-primary-foreground hover:bg-primary/85 disabled:pointer-events-none disabled:opacity-45"
          >
            <Send className="h-4 w-4" aria-hidden />
            {t('send')}
          </button>
          <span className="text-xs text-muted-foreground">{t(`hint.${validation.hint}`)}</span>
        </div>
      </div>
    </section>
  )
}
