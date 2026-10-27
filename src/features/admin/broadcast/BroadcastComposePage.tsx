import { useMemo, useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { AlertTriangle, Loader2, Lock, Send } from 'lucide-react'
import { notify } from '@/core/services/notify'
import { confirmAction } from '@/core/services/confirm'
import Ltr from '@/core/ui/Ltr'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Select from '@/core/ui/Select'
import Textarea from '@/core/ui/Textarea'
import { formatCount, formatPair, fsi } from '@/core/util/bidi'
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
              {/* `n / m` is ONE value, isolated once (spec 380 F27). */}
              <Ltr>{formatCount(form.title.length, TITLE_MAX)}</Ltr>
            </span>
          </div>
          <Input
            id="bc-title"
            type="text"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder={t('placeholder.title')}
          />
        </div>

        {/* Message */}
        <div className="flex flex-col gap-1.5">
          <div className="flex items-baseline justify-between">
            <label htmlFor="bc-body" className="text-xs font-semibold">
              {t('field.message')}
            </label>
            <span className={'text-[11px] tabular-nums ' + (form.body.length > BODY_MAX ? 'text-destructive' : 'text-muted-foreground')}>
              <Ltr>{formatCount(form.body.length, BODY_MAX)}</Ltr>
            </span>
          </div>
          <Textarea
            id="bc-body"
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder={t('placeholder.message')}
            className="min-h-[88px] resize-y"
          />
        </div>

        {/* Channel */}
        <div className="flex flex-col gap-1.5">
          <label className="text-xs font-semibold">{t('field.sendTo')}</label>
          <div className="inline-flex w-fit gap-1" role="tablist">
            {(['all', 'store'] as BroadcastChannel[]).map((ch) => (
              <Chip key={ch} variant="tab" on={form.channel === ch} onClick={() => set('channel', ch)}>
                {t(ch === 'all' ? 'channel.fleet' : 'channel.store')}
              </Chip>
            ))}
          </div>
          {form.channel === 'store' && (
            <Select
              aria-label={t('storePicker.label')}
              value={form.storeCode}
              onChange={(e) => set('storeCode', e.target.value)}
              disabled={stores.isPending}
              className="mt-1"
            >
              <option value="">{t('storePicker.placeholder')}</option>
              {storeOptions.map((s) => (
                <option key={s.code} value={s.code}>
                  {/* ONE pair string, isolated whole for the string-only <option> (F26). */}
                  {fsi(formatPair(s.code, s.city))}
                </option>
              ))}
            </Select>
          )}
        </div>

        {/* Expiry */}
        <Field
          id="bc-expires"
          label={
            <>
              {t('field.expires')} <span className="font-normal">{t('field.expiresHint')}</span>
            </>
          }
        >
          <Input type="date" value={form.expires} onChange={(e) => set('expires', e.target.value)} className="w-fit" />
        </Field>

        {/* Whole-fleet blast-radius warning (037) — shown while composing an All send. */}
        {form.channel === 'all' && (
          <div className="flex items-start gap-2 rounded-md border border-attention-border bg-attention-050 px-3 py-2.5 text-xs text-muted-foreground">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-attention" aria-hidden />
            <span>{t('warn.fleet')}</span>
          </div>
        )}

        {/* Send */}
        <div className="flex items-center gap-3">
          <Button variant="primary" onClick={onSend} disabled={!validation.valid || send.isPending}>
            <Send className="h-4 w-4" aria-hidden />
            {t('send')}
          </Button>
          <span className="text-xs text-muted-foreground">{t(`hint.${validation.hint}`)}</span>
        </div>
      </div>
    </section>
  )
}
