import { useState } from 'react'
import { useIsMutating, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Ban, Loader2, RotateCw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError, apiErrorMessage } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import {
  BLOCKED_REASONS_KEY,
  loyCommandApi,
  MEMBER_SCOPE_KEY,
  memberActionsScopeKey,
  memberCommandKey,
} from './api'
import { blockedReasonKey, codeWords } from './codes'
import { commandRefusalText, selectableBlockedReasons, statusCommand } from './member-commands'
import { QUIET_BUTTON } from './profile-controls'

/**
 * The Status **member command** (ticket 303, spec 301) — the first write on this
 * screen, and the idiom 304–307 copy rather than reinvent.
 *
 * **ONE control, offering whichever command applies**: Block for an unblocked
 * member, Unblock for a blocked one. Never two buttons one of which is always
 * wrong. Which state the member is in is `statusCommand`'s to say, under vitest,
 * because it is a rule and not an arrangement.
 *
 * Three properties land here as the wave's idiom:
 *
 * 1. 🚩 **A refusal is surfaced from the envelope, never flattened.** The
 *    server's own sentence always speaks, and the screen adds its own wording for
 *    the codes it recognises (`commandRefusalKey`). A refusal keeps the analyst
 *    exactly where they were — in the dialog, with the reason still chosen — per
 *    `.claude/rules/api-envelope.md` and ticket 220's standing rule.
 * 2. 🚩 **The control disables itself while in flight, and that is the ONLY
 *    guard there is.** Spec 301: no server-side idempotency exists anywhere in
 *    the module — the correlation id is pass-through and the trail service mints
 *    its own — so a double submit writes two **member update snapshots** and two
 *    trail rows. Nothing server-side will save us.
 * 3. **Success invalidates the member AND every page of the Actions cache.** The
 *    Actions tab is where a **member command** becomes visible; a write that did
 *    not refresh it would look like it had not happened. The header's blocked
 *    chip and the tab both move with no reload.
 *
 * 🚩 **A grant refusal (403) is not an outage and offers no retry** — and it
 * offers none as an *affordance*, not only in words: the command goes dead where
 * it stands. It says the session no longer holds the authority — the same
 * distinction the page's own access backstop draws (ticket 234), for the same
 * reason: "try again in a moment" against a permanently shut door invites a retry
 * loop. **401 is untouched**; `core/api.ts` owns it.
 */
export default function StatusCommand({ member }: { member: LoyMember }) {
  const { t } = useTranslation('loy')
  const queryClient = useQueryClient()
  const command = statusCommand(member)

  const [dialogOpen, setDialogOpen] = useState(false)
  const [reason, setReason] = useState('')

  /**
   * The selectable reasons. Fetched **when the dialog opens** and not before — a
   * Profile tab drawn for an editor who is reading should not spend a call on a
   * list nobody is about to choose from — and cached area-wide, because the list
   * is seed data shared by every member rather than a fact about this one.
   *
   * `retry: false` for the reason the area's probe carries it: a failed read is
   * said once, with its own Retry, rather than after three silent round trips.
   *
   * 🚩 **An answer with rows in it is never re-asked; an EMPTY one always is.**
   * Seed data does not move, so a filled list is worth holding for the session —
   * but "no blocked reason is available" is a sentence that tells an analyst to go
   * and have one configured, and caching it forever would make reopening the
   * dialog show the same dead end after the administrator had done exactly that.
   */
  const reasons = useQuery({
    queryKey: BLOCKED_REASONS_KEY,
    queryFn: () => loyCommandApi.blockedReasons(),
    enabled: dialogOpen,
    staleTime: (query) => (query.state.data?.length ? Infinity : 0),
    retry: false,
  })
  // 🚩 The projection, not the payload. The door filters **system reasons** too,
  // but this is the line that makes the removal reason unofferable *here*, and it
  // is the one under test.
  const offered = selectableBlockedReasons(reasons.data)

  const commandKey = memberCommandKey(member.loyId, 'status')

  const run = useMutation({
    // 🚩 Keyed, so the in-flight fact lives in the MUTATION CACHE rather than in
    // this component. See `busy` below.
    mutationKey: commandKey,
    mutationFn: async (next: { kind: 'block'; reason: string } | { kind: 'unblock' }) => {
      if (next.kind === 'block') await loyCommandApi.block(member.loyId, next.reason)
      else await loyCommandApi.unblock(member.loyId)

      // 🚩 **The invalidation is part of the command, not of the component's
      // reaction to it.** `onSuccess` belongs to this control's observer and does
      // not fire if the analyst has switched tabs while the write was in flight —
      // and a command whose refresh can be skipped by a click is the "it looks
      // like it did not happen" failure the rule exists to prevent. Here it runs
      // whatever the tab shell has mounted.
      //
      // Both keys, always: the member prefix refreshes the header chip and this
      // very control; the Actions prefix refreshes every page of the trail, so an
      // analyst on page 2 is not left reading a trail that has moved on.
      //
      // 🚩 Deliberately NOT awaited. `core/api.ts` puts no timeout on `fetch`, so
      // awaiting a refetch here would hold `isPending` — and with it the dialog
      // that cannot be dismissed while busy — open on a hung READ long after the
      // write itself had committed.
      void queryClient.invalidateQueries({ queryKey: MEMBER_SCOPE_KEY })
      void queryClient.invalidateQueries({ queryKey: memberActionsScopeKey(member.loyId) })
    },
    onSuccess: (_data, next) => {
      toast.success(
        next.kind === 'block' ? t('profile.status.blocked') : t('profile.status.unblocked'),
      )
      close()
    },
    // No `onError`: a refusal is drawn where the analyst is standing — inside the
    // dialog, or beside the control. A toast would take the explanation away from
    // the thing that has to be corrected.
  })

  const close = () => {
    setDialogOpen(false)
    setReason('')
    run.reset()
  }

  /**
   * How this failure is said — the wave's ONE refusal reader
   * (`commandRefusalText`): the server's own sentence, with the screen's
   * wording in front for a code it knows by name, and a 403 said as the grant
   * refusal it is. Only the fallback differs between the two commands here.
   */
  const refusal = (error: unknown): string =>
    commandRefusalText(
      error,
      command === 'block' ? t('profile.status.blockFailed') : t('profile.status.unblockFailed'),
      t,
    )

  /**
   * 🚩 **Read from the mutation cache, not from `run.isPending`.** The tab shell
   * mounts only the open tab, so a control that trusted its own pending flag
   * would come back armed after an analyst clicked Actions and returned mid-write
   * — and a second press would write a second **member update snapshot** and a
   * second trail row, because no server-side idempotency exists anywhere in the
   * module. This is the ticket's only guard; it has to outlive the button.
   */
  const busy = useIsMutating({ mutationKey: commandKey }) > 0
  /**
   * 🚩 **A grant refusal takes the command away, not just the words.** Saying
   * "retrying will not help" while leaving the button armed is the retry loop the
   * rule exists to prevent — a 403 is a fact about the session, and nothing an
   * analyst does on this screen will change it. It clears on a remount — Cancel
   * on the block path, and leaving the tab or reloading on either — never by
   * pressing the same button again, which is the loop the rule names. A **coded**
   * 403 disarms too: on this door a 403 is a guard denial whatever sentence rides
   * with it.
   */
  const grantRefused = run.error instanceof ApiError && run.error.statusCode === 403
  const cannotConfirm = busy || !reason || grantRefused

  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          // 🚩 The in-flight disable. It is the whole double-submit guard, for
          // both commands: the block opens a dialog rather than writing, but the
          // button still goes dead the moment the write leaves, so the dialog
          // cannot be reopened over an unfinished one.
          disabled={busy || grantRefused}
          onClick={() =>
            command === 'block' ? setDialogOpen(true) : run.mutate({ kind: 'unblock' })
          }
          className={QUIET_BUTTON}
          data-testid="loy-status-command"
        >
          {busy ? (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : command === 'unblock' ? (
            <ShieldCheck className="me-1.5 h-3.5 w-3.5" aria-hidden />
          ) : (
            <Ban className="me-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {command === 'unblock' ? t('profile.status.unblock') : t('profile.status.block')}
        </button>
        <span className="text-xs text-muted-foreground">
          {command === 'unblock'
            ? t('profile.status.blockedAs', { reason: codeWords(member.blockedReasonCode, blockedReasonKey, t) ?? '' })
            : t('profile.status.notBlocked')}
        </span>
      </div>

      {/* An unblock has no dialog to keep the analyst in, so its refusal is said
          here — beside the control that is still there to press again. */}
      {run.isError && !dialogOpen && <ErrorBanner message={refusal(run.error)} className="p-2.5" />}

      {dialogOpen && (
        <Modal
          open
          onClose={() => !busy && close()}
          title={t('profile.status.dialogTitle')}
          width="30rem"
          footer={
            <>
              <Button
                variant="text"
                onClick={() => !busy && close()}
                aria-disabled={busy || undefined}
              >
                {t('profile.status.cancel')}
              </Button>
              <Button
                variant="primary"
                data-testid="loy-status-confirm"
                aria-disabled={cannotConfirm || undefined}
                onClick={() => !cannotConfirm && run.mutate({ kind: 'block', reason })}
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t('profile.status.confirm')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">{t('profile.status.dialogNote')}</p>

            <div className="flex flex-col gap-1">
              <label
                htmlFor={REASON_ID}
                className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {t('profile.status.reasonLabel')}
              </label>
              {reasons.isPending ? (
                <span
                  className="flex items-center gap-2 text-xs text-muted-foreground"
                  role="status"
                >
                  <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
                  {t('profile.status.reasonsLoading')}
                </span>
              ) : reasons.isError ? (
                <ErrorBanner
                  title={t('profile.status.reasonsFailed')}
                  message={apiErrorMessage(reasons.error, t('common:errors.server'))}
                  className="p-2.5"
                >
                  <button
                    type="button"
                    onClick={() => reasons.refetch()}
                    disabled={reasons.isFetching}
                    className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-danger-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-danger-050 disabled:opacity-50"
                  >
                    <RotateCw className="h-3 w-3" aria-hidden />
                    {t('profile.status.reasonsRetry')}
                  </button>
                </ErrorBanner>
              ) : offered.length === 0 ? (
                // 🚩 An empty list renders as an empty LIST. Nothing is offerable,
                // which is a fact about the seed data and not a failure — and the
                // confirm stays unpressable rather than sending a blank reason.
                <p className="text-xs text-muted-foreground" role="status">
                  {t('profile.status.reasonsEmpty')}
                </p>
              ) : (
                <select
                  id={REASON_ID}
                  value={reason}
                  disabled={busy}
                  onChange={(event) => setReason(event.target.value)}
                  className="h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none disabled:opacity-50"
                >
                  <option value="">{t('profile.status.reasonPlaceholder')}</option>
                  {offered.map((option) => (
                    <option key={option.code} value={option.code}>
                      {/* The server's own words where it sent any, and the bare
                          code where it did not — never an invented description. */}
                      {option.description ?? option.code}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 🚩 A refusal keeps the analyst HERE, with the reason still chosen
                (ticket 220's rule). Nothing is cleared and nothing is closed. */}
            {run.isError && <ErrorBanner message={refusal(run.error)} className="p-2.5" />}
          </div>
        </Modal>
      )}
    </div>
  )
}

const REASON_ID = 'loy-block-reason'
