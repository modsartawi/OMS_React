/* PROTOTYPE — throwaway. Wayfinder ticket 379 (map 358). Branch
 * prototype/379-cc-rail, never merges.
 *
 * The customer rail's CALLER jobs, folded into one bar at the top of the centre
 * column (Far's "caller header"), above 373's sentence + ledger:
 *
 *   no caller  → the phone box (caret on open, keyed on the order — 153/165),
 *                Find, then the found member inline with Attach (165's two
 *                steps); a miss offers Sign up, whose panel opens IN FLOW under
 *                the bar (159/190), never a modal.
 *   attached   → name · tier · points · mobile · member id · the open-requests
 *                offer or the linked request (194/195) · Remove.
 *
 * The address book, "Collecting from" and the retained-address trace are NOT
 * here: the sentence's address / store words and the note under the sentence
 * carry them. Same data-cc-* handles as the rail, so drives reuse.
 */
import { useEffect, useRef, useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ExternalLink, Loader2, Search, Star, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { LoyaltyMember, SessionState } from '@/core/models/callcenter'
import Ltr from '@/core/ui/Ltr'
import { callCenterApi } from '../api'
import type { CustomerActions, RailRequests, RailSignup } from '../CustomerRail'
import { railFields } from '../rail-view'
import SignupPanel from '../SignupPanel'
import { beginSignup } from '../signup-view'

export default function CallerBar({
  state,
  member,
  actions,
  signup,
  requests,
}: {
  state: SessionState
  /** The member the attach was given — what lets the bar show tier and points. */
  member: LoyaltyMember | null
  actions: CustomerActions
  signup?: RailSignup
  requests?: RailRequests
}) {
  const customer = state.header.customer
  return customer ? (
    <Attached state={state} member={member} actions={actions} requests={requests} />
  ) : (
    <Lookup state={state} actions={actions} signup={signup} />
  )
}

function Lookup({ state, actions, signup }: { state: SessionState; actions: CustomerActions; signup?: RailSignup }) {
  const { t } = useTranslation('callcenter')
  const [mobile, setMobile] = useState('')
  const lookup = useMutation({ mutationFn: (q: string) => callCenterApi.memberByMobile(q), retry: false })
  const box = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    box.current?.focus()
  }, [state.transactionId])

  const search = (e: React.FormEvent) => {
    e.preventDefault()
    if (mobile.trim() && !lookup.isPending) lookup.mutate(mobile.trim())
  }

  return (
    <div className="shrink-0 border-b border-divider bg-card px-4 py-2" data-proto-callerbar="lookup">
      <div className="flex min-h-9 flex-wrap items-center gap-x-3 gap-y-1.5">
        <span className="text-[10.5px] font-semibold uppercase tracking-wide text-muted-foreground">{t('rail.caller')}</span>
        <form onSubmit={search} className="flex w-56 gap-1.5">
          <input
            id="cc-phone"
            ref={box}
            value={mobile}
            onChange={(e) => setMobile(e.target.value)}
            inputMode="tel"
            autoComplete="off"
            placeholder={t('rail.mobilePlaceholder')}
            aria-label={t('rail.mobile')}
            data-numeric
            className="min-w-0 flex-1 rounded-md border border-input bg-card px-2.5 py-1.5 text-sm outline-none focus:border-ring"
          />
          <button
            type="submit"
            disabled={!mobile.trim() || lookup.isPending}
            data-cc-find
            aria-label={t('rail.find')}
            title={t('rail.find')}
            className="rounded-md border border-input px-2 hover:bg-accent disabled:opacity-40"
          >
            {lookup.isPending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> : <Search className="h-4 w-4" aria-hidden />}
          </button>
        </form>

        {lookup.isSuccess && lookup.data && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-card-2 py-1 ps-2.5 pe-1" data-cc-lookup-found>
            <bdi className="text-sm font-semibold">{lookup.data.fullName}</bdi>
            <span className="text-xs text-muted-foreground" data-numeric>
              <Ltr>{lookup.data.mobile}</Ltr>
            </span>
            <button
              type="button"
              onClick={() => actions.onAttach(lookup.data!)}
              disabled={actions.busy}
              data-cc-attach
              className="rounded-md bg-primary px-2.5 py-1 text-xs font-semibold text-primary-foreground disabled:opacity-50"
            >
              {actions.busy ? t('rail.attaching') : t('rail.attach')}
            </button>
          </div>
        )}
        {lookup.isSuccess && !lookup.data && (
          <div className="flex items-center gap-2" data-cc-lookup-miss>
            <span className="text-xs text-muted-foreground">{t('rail.notFound')}</span>
            {signup && signup.state.step === 'closed' && (
              <button
                type="button"
                onClick={() => signup.actions.onChange(beginSignup(mobile.trim()))}
                data-cc-signup-open
                className="shrink-0 rounded-md border border-input px-2.5 py-1 text-xs font-medium hover:bg-accent"
              >
                {t('signup.open')}
              </button>
            )}
          </div>
        )}
        {lookup.isError && (
          <span className="text-xs text-danger-800" data-cc-lookup-error>
            {apiErrorMessage(lookup.error, t('rail.lookupFailed'))}
          </span>
        )}
        {lookup.isIdle && <span className="text-[11px] text-muted-foreground">{t('rail.emptyHint')}</span>}
      </div>
      {/* 159's signup, in flow under the bar — the caller is on the line reading
          digits back, so it may not cover the order. */}
      {signup && signup.state.step !== 'closed' && (
        <div className="max-w-md">
          <SignupPanel state={signup.state} actions={signup.actions} attaching={actions.busy} />
        </div>
      )}
    </div>
  )
}

function Attached({
  state,
  member,
  actions,
  requests,
}: {
  state: SessionState
  member: LoyaltyMember | null
  actions: CustomerActions
  requests?: RailRequests
}) {
  const { t } = useTranslation('callcenter')
  const fields = Object.fromEntries(railFields(state.header.customer, member).map((f) => [f.id, f.value]))
  return (
    <div
      className="flex min-h-11 shrink-0 flex-wrap items-center gap-x-3 gap-y-1 border-b border-divider bg-card px-4 py-1.5"
      data-proto-callerbar="attached"
      data-cc-caller
    >
      <bdi className="text-[15px] font-semibold leading-tight" data-cc-rail-field="name">
        {fields.name}
      </bdi>
      {fields.tier && (
        <span className="inline-flex items-center gap-1 rounded-full bg-attention-050 px-2 py-px text-[11px] font-semibold text-attention-800" data-cc-rail-field="tier">
          <Star className="h-3 w-3" aria-hidden />
          {fields.tier}
        </span>
      )}
      {fields.points && (
        <span className="text-xs text-muted-foreground" data-cc-rail-field="points">
          {t('rail.field.points')} <span className="font-mono text-foreground">{fields.points}</span>
        </span>
      )}
      <span className="text-xs text-muted-foreground" data-cc-rail-field="mobile">
        <Ltr>
          <span className="font-mono text-foreground">{fields.mobile}</span>
        </Ltr>
      </span>
      <span className="text-xs text-muted-foreground" data-cc-rail-field="member">
        {t('rail.field.member')} <Ltr><span className="font-mono text-foreground">{fields.member}</span></Ltr>
      </span>

      {requests?.card ? (
        <span
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card-2 px-2 py-0.5 text-xs"
          data-cc-request-card
          // PROTOTYPE: the rail card's reason / raised-at / pharmacist's note, which
          // a one-line chip has no room for — a tooltip is the cheapest stand-in.
          title={[requests.card.reason, t('request.raisedAt', { store: requests.card.storeCode }), requests.card.note && t('request.noteFrom', { note: requests.card.note })]
            .filter(Boolean)
            .join('\n')}
        >
          <span className="text-muted-foreground">{t('request.cardTitle')}</span>
          <Ltr>
            <span className="font-mono font-semibold">{requests.card.documentNo}</span>
          </Ltr>
          <a
            href={requests.card.href}
            target="_blank"
            rel="noreferrer"
            aria-label={t('request.openDocument')}
            title={t('request.openDocument')}
            className="text-muted-foreground hover:text-foreground"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
          </a>
          {requests.onUnlink && (
            <button
              type="button"
              onClick={requests.onUnlink}
              data-cc-request-unlink
              className="ms-1 rounded px-1 text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
            >
              {t('request.unlink.action')}
            </button>
          )}
        </span>
      ) : requests?.offer ? (
        <button
          type="button"
          onClick={requests.onView}
          data-cc-request-offer={String(requests.offer.count)}
          data-cc-request-view
          className="rounded-md border border-attention-border bg-attention-050 px-2 py-0.5 text-xs font-medium text-attention-800 hover:opacity-80"
        >
          {/* PROTOTYPE copy: the rail's sentence is too long for a one-line bar. */}
          {requests.offer.count} open {requests.offer.count === 1 ? 'request' : 'requests'} · View
        </button>
      ) : null}

      <span className="flex-1" />
      <button
        type="button"
        onClick={actions.onRemove}
        disabled={actions.busy}
        data-cc-remove-caller
        aria-label={t('rail.remove')}
        title={t('rail.remove')}
        className="shrink-0 rounded-full border border-input p-1 text-muted-foreground hover:bg-accent disabled:opacity-50"
      >
        <X className="h-3 w-3" aria-hidden />
      </button>
      {actions.error && <span className="basis-full text-xs text-danger-800">{actions.error}</span>}
    </div>
  )
}
