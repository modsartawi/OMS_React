import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate, useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Loader2, Search } from 'lucide-react'

import { apiErrorMessage } from '@/core/api'
import ErrorBanner from '@/core/ui/ErrorBanner'
import { formatShortDate } from '@/core/util/date-format'
import { loyApi, memberKey } from './api'
import { resolveMember } from './resolve-member'

/**
 * The Loy member lookup (ticket 233, spec 231) — slice 0 of the Loyalty area and
 * the tracer through its whole spine: area → namespace → route → envelope →
 * model → the resolution cascade → render.
 *
 * **Two states, one screen** (227, variant B). `/loy/members` is a centred field
 * and nothing else; a resolved member owns `/loy/members/:loyId` with the field
 * collapsed into a slim bar carrying **the searched key only** — the member's
 * name appears in exactly one place, the header below.
 *
 * 🚩 **The URL holds the LoyId, never what was typed.** A refresh re-reads by
 * key and does **not** replay the two-call cascade — that runs on submit only.
 * The bar shows the typed key carried in navigation state and falls back to the
 * LoyId on a cold load.
 *
 * The rule this screen exists to get right is not in this file: `resolveMember`
 * is a pure module with a vitest suite, because a cascade that treats a shut
 * door as "no member matches" is the failure that costs an agent the call
 * (224/225), and it is the only thing provable while the `LoyWeb` door is
 * unbuilt.
 *
 * No menu item yet — the route is reachable by URL only, so the screen never
 * exists in the nav ungated; ticket 234 adds the item *with* its access probe.
 * The header here is identity alone; the chips, the points block and the three
 * tabs are 235–238.
 */
export default function MemberLookupPage() {
  const { t } = useTranslation('loy')
  const { loyId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()

  // What the bar says it searched: the typed key from navigation state, falling
  // back to the LoyId on a cold load of the URL (227 decision 3).
  const searchedKey = (location.state as { typed?: string } | null)?.typed ?? loyId ?? ''

  const [typed, setTyped] = useState(searchedKey)
  // Change reopens the field IN PLACE, pre-filled — the member stays on screen
  // underneath, because a one-digit correction is not a reason to lose them.
  const [editing, setEditing] = useState(false)

  const member = useQuery({
    queryKey: memberKey(loyId ?? ''),
    queryFn: () => loyApi.byLoyId(loyId as string),
    enabled: !!loyId,
  })

  const lookup = useMutation({
    mutationFn: (text: string) => resolveMember(text, loyApi),
    onSuccess: (resolution, text) => {
      if (resolution.kind !== 'member') return
      // Seed the cache the route's own read uses, so the member is on screen the
      // instant the navigation lands rather than after a loading flash of a
      // member we are already holding. The route still re-reads in the
      // background — it is the screen's data source and no freshness policy is
      // invented here — but nothing the agent sees waits for it.
      queryClient.setQueryData(memberKey(resolution.member.loyId), resolution.member)
      setEditing(false)
      navigate(`/loy/members/${encodeURIComponent(resolution.member.loyId)}`, {
        state: { typed: text },
      })
    },
  })

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    // 🚩 Explicit submit only — Enter or the button, never debounced as-you-type,
    // which would flash the empty state accusingly while the agent is still
    // typing (225 ruling 7). A blank submit reaches `resolveMember` and is a
    // no-op there: silence is the answer, not a message.
    if (!lookup.isPending) lookup.mutate(typed)
  }

  const newLookup = () => {
    lookup.reset()
    setTyped('')
    setEditing(false)
    navigate('/loy/members')
  }

  // Only the reopened field can be cancelled — on `/loy/members` there is
  // nothing to go back to, which is the state itself.
  const onCancel = editing
    ? () => {
        lookup.reset()
        setTyped(searchedKey)
        setEditing(false)
      }
    : null

  const field = (
    <form className="flex flex-col items-center gap-2" onSubmit={submit}>
      <label className="text-sm font-medium text-foreground" htmlFor={FIELD_ID}>
        {t('search.label')}
      </label>
      <div className="flex items-center gap-2">
        <input
          id={FIELD_ID}
          type="text"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={t('search.placeholder')}
          aria-label={t('search.label')}
          autoComplete="off"
          className="h-9 w-72 rounded-md border border-border/60 bg-background px-2.5 text-sm text-foreground focus:border-primary/50 focus:outline-none"
        />
        <button
          type="submit"
          disabled={lookup.isPending}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {lookup.isPending ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Search className="h-3.5 w-3.5" aria-hidden />
          )}
          {t('search.submit')}
        </button>
      </div>
      {/* 🚩 The hint says what the field TAKES, not what it does with it. The
          two-call order is deliberately invisible to the agent (spec 231, story
          3: "the screen's internal ordering is invisible to me"), so it is not
          published in the copy. */}
      <p className="text-xs text-muted-foreground">{t('search.hint')}</p>
      {/* Change is reversible. Without this the only ways out of the reopened
          field are a successful lookup and New lookup — and New lookup is the
          bar's, which is the thing the field replaced. */}
      {onCancel && (
        <button
          type="button"
          onClick={onCancel}
          className="text-xs font-medium text-muted-foreground underline-offset-2 hover:underline"
        >
          {t('search.cancel')}
        </button>
      )}
    </form>
  )

  // The outcome of a lookup that did not land on a member. Rendered wherever the
  // field is, so a Change that misses says so next to the box it came from.
  const outcome = (
    <>
      {lookup.data && lookup.data.kind === 'noMatch' && (
        <div role="status" className="mx-auto max-w-lg text-center">
          {/* 🚩 A neutral CLIENT sentence, no toast and no red: the outcome is
              composed from two calls and each server sentence names only one of
              the things tried. A not-found is a fact, not a failure. */}
          <p className="text-sm font-medium text-foreground">
            {t('search.noMatch', { typed: lookup.data.typed })}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">{t('search.noMatchHint')}</p>
        </div>
      )}
      {lookup.data && lookup.data.kind === 'archivedRefusal' && (
        <div role="status" className="mx-auto max-w-lg text-center">
          <p className="text-sm font-medium text-foreground">
            {t('search.archived', { key: lookup.data.key })}
          </p>
        </div>
      )}
      {/* A refusal, an outage or a network failure says THAT — never "no member
          matches". The server's own sentence is the message where there is one;
          only a bare transport failure falls back to ours. */}
      {lookup.isError && (
        <ErrorBanner
          message={apiErrorMessage(lookup.error, t('search.failed'))}
          className="mx-auto max-w-lg p-3"
        />
      )}
    </>
  )

  if (!loyId) {
    return (
      <section className="flex w-full flex-col gap-4">
        <div className="mx-auto mt-12 flex w-full max-w-2xl flex-col gap-4 rounded-lg border border-border/60 bg-card/40 px-5 py-8">
          {field}
          {outcome}
        </div>
      </section>
    )
  }

  return (
    <section className="flex w-full flex-col gap-4">
      {editing ? (
        <div className="flex flex-col gap-4 rounded-lg border border-border/60 bg-card/40 px-5 py-6">
          {field}
          {outcome}
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-card/40 px-3 py-2">
            {/* The bar carries the searched key and NOT the member: the name
                lives in exactly one place, the header line below (227 #2). */}
            <span className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-background px-3 py-1 text-sm text-foreground">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">
                {t('search.searched')}
              </span>
              {searchedKey}
            </span>
            <div className="ms-auto flex items-center gap-2">
              <button
                type="button"
                onClick={() => setEditing(true)}
                className={BAR_BUTTON}
              >
                {t('search.change')}
              </button>
              <button type="button" onClick={newLookup} className={BAR_BUTTON}>
                {t('search.newLookup')}
              </button>
            </div>
          </div>
          {outcome}
        </>
      )}

      {member.isPending && (
        <div
          className="flex items-center justify-center gap-2 py-10 text-sm text-muted-foreground"
          role="status"
        >
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          {t('member.loading')}
        </div>
      )}
      {member.isError && (
        <ErrorBanner
          message={apiErrorMessage(member.error, t('member.loadFailed'))}
          className="p-3"
        />
      )}
      {member.data && (
        <div className="rounded-lg border border-border/60 bg-card/40 p-4">
          {/* Identity, once. The header is not a tab and it is not sticky — it
              scrolls away so a long grid gets the viewport (227 #4). */}
          <h1 className="text-xl font-semibold tracking-tight">
            {member.data.fullName || t('member.unnamed')}
          </h1>
          <dl className="mt-2 flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <KeyValue label={t('member.loyId')} value={member.data.loyId} />
            {/* 🚩 The stored mobile, which IS the normalised key — the screen
                shows the server's value here rather than rewriting the box. */}
            <KeyValue label={t('member.mobile')} value={member.data.mobile} />
            <KeyValue label={t('member.joined')} value={formatShortDate(member.data.joinDate)} />
            <KeyValue label={t('member.updated')} value={formatShortDate(member.data.lastUpdate)} />
          </dl>
        </div>
      )}
    </section>
  )
}

const FIELD_ID = 'loy-member-lookup'

/** The bar's two affordances are the same button in two words. */
const BAR_BUTTON =
  'inline-flex h-8 items-center rounded-full border border-border/60 px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-muted'

/** One labelled fact on the identity line. An absent value renders as absent
 *  rather than as an empty gap the eye reads as a missing label. */
function KeyValue({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation('loy')
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-xs uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className={value ? 'text-foreground' : 'text-muted-foreground'}>
        {value || t('member.absent')}
      </dd>
    </div>
  )
}
