import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { toast } from 'sonner'
import { Brain, Check, Eraser, Loader2, Plus, Search, ShieldAlert, Trash2, X } from 'lucide-react'
import { apiErrorCode, apiErrorMessage } from '@/core/api'
import type { CopilotKeptReading, CopilotNamedSet, CopilotSetMember } from '@/core/models/copilot'
import { saysIn } from '@/core/rules/sentence'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Modal from '@/core/ui/Modal'
import ScreenGate from '@/core/ui/ScreenGate'
import Select from '@/core/ui/Select'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { canAskCopilot, copilotAccessQuery } from './access'
import { addMember, lookupFits, LOOKUP_MAX, removeMember, type MePage, type SetEdit } from './me'
import { COPILOT_ME_KEY, ME_FEATURE_OFF, copilotMeApi, meActions, meQuery, meRefusal } from './me-api'

/**
 * `/copilot/me` — "What the copilot knows about me" (ticket 894, BackOffice spec 3633 R25/R28/R29, doors 3689), reached
 * from the copilot panel: each kept reading with its value (change, delete), each named set with its members (edit
 * through the name lookup, delete), unused readings and gone members marked, and "Forget everything" with a confirm.
 * A change is used from the reader's next question (R29). The investigations spec's profile joins as its own section.
 *
 * Gated like `/copilot` on `canAsk`; `COPILOT-401` from any door, or a `COPILOT-430` on the read (no store on the
 * server), draws its closed state. Review of 3633: with `canChange` false (own readings do not apply) the page still
 * lists, deletes and forgets, but Change, the member edits and the lookup are hidden; a change refused with 430 is a
 * message in place. A scope choice may be one of the reader's sets (`set:<id>`), drawn by the server's label.
 * Bidi: labels and set names are free text (`<bdi>`); keys, times and counts are machine values (`Ltr`).
 */
export default function CopilotMePage() {
  const { t } = useTranslation('copilot')
  return (
    <ScreenGate query={copilotAccessQuery()} can={canAskCopilot} ns="copilot" title={t('me.title')} subtitle={t('me.subtitle')}>
      <MeScreen />
    </ScreenGate>
  )
}

type Refused = 'off' | 'grant' | null

function MeScreen() {
  const { t } = useTranslation('copilot')
  const qc = useQueryClient()
  const me = useQuery(meQuery())
  const [refused, setRefused] = useState<Refused>(null)
  const [forgetting, setForgetting] = useState(false)
  const act = meActions(qc)

  /** Any change: its door, then the redraw; a refusal is shown in the server's words. */
  const change = useMutation({
    mutationFn: (run: () => Promise<unknown>) => run(),
    onError: (err) => {
      const r = meRefusal(err, 'change')
      if (r) setRefused(r)
      else {
        toast.error(apiErrorMessage(err, t('me.failed')))
        // A change refused because own readings no longer apply: read the page again, so `canChange` follows.
        if (apiErrorCode(err) === ME_FEATURE_OFF) void qc.invalidateQueries({ queryKey: COPILOT_ME_KEY, exact: true })
      }
    },
  })
  const busy = change.isPending
  const run = (fn: () => Promise<unknown>, done: string) => change.mutate(fn, { onSuccess: () => toast.success(done) })

  const state = refused ?? meRefusal(me.error, 'read')
  if (state) return <Closed state={state} />
  if (me.isPending) {
    return (
      <div role="status" className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        {t('me.loading')}
      </div>
    )
  }
  if (!me.data) return <ErrorBanner message={apiErrorMessage(me.error, t('me.loadFailed'))} />
  const page: MePage = me.data

  return (
    <div className="flex min-h-0 max-w-4xl flex-col gap-6 pb-8" data-me-screen>
      <p className="text-sm text-muted-foreground">{t('me.hint')}</p>

      <section className="flex flex-col gap-3" data-me-readings>
        <h2 className="text-sm font-semibold">{t('me.readings.heading')}</h2>
        {page.readings.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('me.readings.none')}</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {page.readings.map((r) => (
              <ReadingRow
                key={r.kind}
                reading={r}
                canChange={page.canChange}
                busy={busy}
                onChange={(value) => run(() => act.changeReading(r.kind, value), t('me.readings.changed'))}
                onDelete={() => run(() => act.deleteReading(r.kind), t('me.readings.deleted'))}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col gap-3" data-me-sets>
        <h2 className="text-sm font-semibold">{t('me.sets.heading')}</h2>
        {page.sets.length === 0 ? (
          <p className="text-xs text-muted-foreground">{t('me.sets.none')}</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {page.sets.map((s) => (
              <SetCard
                key={s.setId}
                set={s}
                maxMembers={page.limits.maxMembers}
                canChange={page.canChange}
                busy={busy}
                onEdit={(edit, done) => {
                  if (edit.ok) run(() => act.editSet(edit.request), done)
                  else toast.error(t(`me.sets.cannot.${edit.why}`, { max: fsi(formatNumber(page.limits.maxMembers)) }))
                }}
                onDelete={() => run(() => act.deleteSet(s.setId), t('me.sets.deleted'))}
              />
            ))}
          </ul>
        )}
      </section>

      <section className="flex flex-col items-start gap-2 border-t border-border/60 pt-4" data-me-forget>
        <p className="text-xs text-muted-foreground">{t('me.forget.hint')}</p>
        <Button variant="danger" disabled={busy || page.empty} onClick={() => setForgetting(true)} data-me-forget-open>
          <Eraser className="h-3.5 w-3.5" aria-hidden />
          {t('me.forget.button')}
        </Button>
      </section>

      <Modal
        open={forgetting}
        onClose={() => setForgetting(false)}
        title={t('me.forget.confirmTitle')}
        footer={
          <>
            <Button variant="text" onClick={() => setForgetting(false)}>
              {t('me.forget.cancel')}
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={() => {
                setForgetting(false)
                change.mutate(() => act.forget(), {
                  onSuccess: (n) => toast.success(t('me.forget.done', { n: fsi(formatNumber(Number(n) || 0)) })),
                })
              }}
              data-me-forget-confirm
            >
              {t('me.forget.confirm')}
            </Button>
          </>
        }
      >
        <p className="text-sm">{t('me.forget.confirmBody')}</p>
      </Modal>
    </div>
  )
}

/** One kept reading: its kind, its value (struck through when unused), when it was kept, Change and Delete. */
function ReadingRow({
  reading,
  canChange,
  busy,
  onChange,
  onDelete,
}: {
  reading: CopilotKeptReading
  canChange: boolean
  busy: boolean
  onChange: (value: string) => void
  onDelete: () => void
}) {
  const { t, i18n } = useTranslation('copilot')
  const [picked, setPicked] = useState<string | null>(null)
  const value = picked ?? reading.value
  return (
    <li className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg border border-border/60 bg-card p-3" data-me-reading={reading.kind} data-unused={reading.unused || undefined}>
      <div className="flex min-w-0 flex-1 flex-col gap-0.5">
        <span className="text-xs font-medium text-muted-foreground">{t(`me.kind.${reading.kind}`)}</span>
        <span className="flex flex-wrap items-baseline gap-2 text-sm">
          <span className={reading.unused ? 'text-muted-foreground line-through' : 'font-medium'}>
            <bdi>{saysIn(reading.label, i18n.language)}</bdi>
          </span>
          {reading.unused && <StatusBadge sev="warn">{t('me.readings.unused')}</StatusBadge>}
        </span>
        {reading.keptAt && (
          <span className="text-xs text-muted-foreground">
            {t(`me.keptBy.${reading.keptBy}`)} <Ltr>{formatDateTime(reading.keptAt)}</Ltr>
          </span>
        )}
      </div>
      {canChange && reading.choices.length > 0 && (
        <Field label={t('me.readings.changeTo')} hideLabel>
          <Select value={value} onChange={(e) => setPicked(e.target.value)} disabled={busy} data-me-reading-choice>
            {!reading.choices.some((c) => c.value === reading.value) && <option value={reading.value}>{fsi(saysIn(reading.label, i18n.language))}</option>}
            {reading.choices.map((c) => (
              <option key={c.value} value={c.value}>
                {fsi(saysIn(c.label, i18n.language))}
              </option>
            ))}
          </Select>
        </Field>
      )}
      {canChange && (
        <Button
          variant="secondary"
          disabled={busy || value === reading.value}
          onClick={() => {
            onChange(value)
            setPicked(null)
          }}
          data-me-reading-change
        >
          <Check className="h-3.5 w-3.5" aria-hidden />
          {t('me.readings.change')}
        </Button>
      )}
      <IconButton label={t('me.readings.delete')} variant="danger" disabled={busy} onClick={onDelete} data-me-reading-delete>
        <Trash2 className="h-3.5 w-3.5" aria-hidden />
      </IconButton>
    </li>
  )
}

/** One named set: its name, its members (gone ones marked), add through the name lookup, remove, delete the set. */
function SetCard({
  set,
  maxMembers,
  canChange,
  busy,
  onEdit,
  onDelete,
}: {
  set: CopilotNamedSet
  maxMembers: number
  canChange: boolean
  busy: boolean
  onEdit: (edit: SetEdit, done: string) => void
  onDelete: () => void
}) {
  const { t, i18n } = useTranslation('copilot')
  const [text, setText] = useState('')
  const lookup = useMutation({ mutationFn: (q: string) => copilotMeApi.lookup(q) })
  const live = set.members.filter((m) => !m.gone).length
  const search = (e: FormEvent) => {
    e.preventDefault()
    if (lookupFits(text) && !lookup.isPending) lookup.mutate(text.trim())
  }
  const named = (m: CopilotSetMember) => <bdi>{saysIn(m.label, i18n.language)}</bdi>
  return (
    <li className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card p-3" data-me-set={set.setId}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-semibold">
          <bdi>{set.name}</bdi>
        </span>
        <span className="text-xs text-muted-foreground">
          {t('me.sets.members')} <Ltr>{formatCount(formatNumber(live), formatNumber(maxMembers))}</Ltr>
        </span>
        {set.gone > 0 && <StatusBadge sev="warn">{t('me.sets.goneCount', { n: fsi(formatNumber(set.gone)), count: set.gone })}</StatusBadge>}
        <span className="flex-1" />
        <Button variant="text" disabled={busy} onClick={onDelete} data-me-set-delete>
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
          {t('me.sets.delete')}
        </Button>
      </div>
      <ul className="flex flex-wrap gap-1.5">
        {set.members.map((m) => (
          <li
            key={m.key}
            className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs ${m.gone ? 'border-dashed border-border text-muted-foreground line-through' : 'border-border/60'}`}
            data-me-member={m.key}
            data-gone={m.gone || undefined}
          >
            {named(m)}
            {m.gone && <span className="no-underline">{t('me.sets.gone')}</span>}
            {canChange && (
              <IconButton
                size="compact"
                label={t('me.sets.remove')}
                disabled={busy}
                onClick={() => onEdit(removeMember(set, m.key), t('me.sets.changed'))}
                data-me-member-remove
              >
                <X className="h-3 w-3" aria-hidden />
              </IconButton>
            )}
          </li>
        ))}
      </ul>
      {set.gone > 0 && <p className="text-xs text-muted-foreground">{t('me.sets.goneHint')}</p>}
      {canChange && (
        <>
          <form onSubmit={search} className="flex flex-wrap items-end gap-2">
            <Field label={t('me.sets.lookup')} error={text.length > LOOKUP_MAX ? t('me.sets.lookupTooLong', { max: fsi(formatNumber(LOOKUP_MAX)) }) : undefined}>
              <Input dir="auto" value={text} placeholder={t('me.sets.lookupPlaceholder')} onChange={(e) => setText(e.target.value)} data-me-lookup />
            </Field>
            <Button type="submit" variant="secondary" disabled={!lookupFits(text) || lookup.isPending} data-me-lookup-run>
              {lookup.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> : <Search className="h-3.5 w-3.5" aria-hidden />}
              {t('me.sets.find')}
            </Button>
          </form>
          {lookup.isError ? (
            <ErrorBanner message={apiErrorMessage(lookup.error, t('me.sets.lookupFailed'))} />
          ) : lookup.data ? (
            lookup.data.length === 0 ? (
              <p className="text-xs text-muted-foreground">{t('me.sets.noMatch')}</p>
            ) : (
              <ul className="flex flex-col gap-1" data-me-matches>
                {lookup.data.map((m) => (
                  <li key={m.key} className="flex items-center gap-2 text-sm" data-me-match={m.key}>
                    <Button
                      variant="ghost"
                      disabled={busy || set.members.some((x) => x.key === m.key)}
                      onClick={() => onEdit(addMember(set, m, maxMembers), t('me.sets.changed'))}
                      data-me-match-add
                    >
                      <Plus className="h-3.5 w-3.5" aria-hidden />
                      {named(m)}
                    </Button>
                    <span className="text-xs text-muted-foreground">
                      <Ltr>{m.key}</Ltr>
                    </span>
                  </li>
                ))}
              </ul>
            )
          ) : null}
        </>
      )}
    </li>
  )
}

/** The server keeps nothing (no store), or the grant went while the page was open. */
function Closed({ state }: { state: 'off' | 'grant' }) {
  const { t } = useTranslation('copilot')
  return (
    <div className="mx-auto mt-16 max-w-md rounded-lg border border-border/60 bg-card p-6 text-center" role="alert" data-me-closed={state}>
      {state === 'off' ? <Brain className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden /> : <ShieldAlert className="mx-auto mb-2 h-6 w-6 text-muted-foreground" aria-hidden />}
      <div className="text-base font-semibold tracking-tight">{t(`me.closed.${state}.title`)}</div>
      <p className="mt-2 text-sm text-muted-foreground">{t(`me.closed.${state}.hint`)}</p>
    </div>
  )
}
