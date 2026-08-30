import { useState } from 'react'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Smartphone } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Modal from '@/core/ui/Modal'
import {
  MEMBER_SCOPE_KEY,
  loyCommandApi,
  memberActionsScopeKey,
  memberCommandKey,
} from './api'
import MemberFact from './MemberFact'
import { commandRefusalText } from './member-commands'
import { mobileChangeVerdict, mobileProblemKey } from './mobile-command'
import { PRIMARY_BUTTON } from './profile-controls'

/**
 * The mobile **member command** (ticket 305, spec 301) — the number the member
 * signs in with, changed on its own and behind its own confirmation.
 *
 * 🚩 **Deliberately not a field on the profile form.** The mobile is the
 * programme's login credential and one of only **two** ways a member can be
 * found at all, so it must never change as a side effect of fixing a name — which
 * is why spec 301 ruled the commands act-shaped and why this control lives beside
 * the form rather than inside it.
 *
 * The rules live in `mobile-command.ts` under vitest; this file is the
 * arrangement, and it copies ticket 303's write idiom rather than inventing a
 * second one: the refusal surfaced from the envelope, the in-flight disable as
 * the ONLY double-submit guard, and the invalidation carried inside the mutation
 * rather than in an observer.
 *
 * Three properties are this ticket's own:
 *
 * 1. 🚩 **Three refusals, each named as itself.** A number held by another
 *    member is a *collision*, not a format problem; the number the member
 *    already has is a no-op that must write no **member update snapshot**; an
 *    unparseable one is a typo. The map is `member-commands.ts`'s, and an
 *    unrecognised code still speaks in the server's own words.
 * 2. 🚩 **A refusal changes nothing.** The delegated handler refuses a
 *    collision rather than taking the number from its current holder — the
 *    wipe-the-other-member path exists only on the customer-driven OTP flow —
 *    so the member is never left half-edited, and the analyst stays in the
 *    confirmation with the number they typed.
 * 3. ⚠️ **The confirmation says what is true about verification.** This path
 *    marks the new number verified with **no OTP at all**; the analyst asserts
 *    it on the customer's behalf. That is existing server behaviour, unchanged
 *    by spec 301 and flagged for an owner ruling — so the dialog states it
 *    rather than implying a confirmation that never happens.
 */
export default function MobileCommand({ member }: { member: LoyMember }) {
  const { t } = useTranslation('loy')
  const queryClient = useQueryClient()

  /**
   * ⚠️ **The carried-over question from ticket 304, settled rather than fixed.**
   * `MemberTabs` mounts only the OPEN tab, so typing here does not survive a
   * click on Actions and back — and 304's review pointed the question at this
   * ticket because each command adds form state to the same shell.
   *
   * It stays local, deliberately. Somewhere for a draft to outlive its tab is a
   * change to the tab shell, not to a command — and the cost is asymmetric: what
   * is lost here is ONE field an analyst is mid-way through typing, where the
   * profile form loses nine. Giving this control a store of its own would settle
   * nothing for the form and would leave the screen with two answers to one
   * question. The honest fix is one place for every draft, and it is a change to
   * `MemberTabs` that no command's ticket owns.
   */
  const [typed, setTyped] = useState('')
  const [dialogOpen, setDialogOpen] = useState(false)

  /**
   * 🚩 **The verdict IS the request.** The confirm is armed off the same value
   * that goes on the wire, so the control cannot check one number and send
   * another — and the number leaves compacted, exactly as the member reads
   * already send one, because normalisation is the door's.
   */
  const verdict = mobileChangeVerdict(typed, member.mobile)
  const problemKey = mobileProblemKey(verdict)

  const commandKey = memberCommandKey(member.loyId, 'mobile')

  const run = useMutation({
    // Keyed, so the in-flight fact lives in the MUTATION CACHE rather than in
    // this component — the tab shell mounts only the open tab (see `busy`).
    mutationKey: commandKey,
    mutationFn: async (mobile: string) => {
      await loyCommandApi.changeMobile(member.loyId, mobile)
      // The invalidation is part of the command and not of the component's
      // reaction to it (303's idiom): both keys, always, and neither awaited —
      // the header's number and every page of the Actions trail move with no
      // reload, and a hung READ never holds the dialog open over a write that
      // has already committed.
      void queryClient.invalidateQueries({ queryKey: MEMBER_SCOPE_KEY })
      void queryClient.invalidateQueries({ queryKey: memberActionsScopeKey(member.loyId) })
    },
    onSuccess: () => {
      toast.success(t('profile.mobile.changed'))
      // 🚩 Cleared only on a write that actually happened. A refusal keeps the
      // number the analyst typed — theirs to correct or to retry — and Cancel
      // keeps it too; a field emptied by a failure is the analyst's typing
      // taken away by the server (ticket 220's rule).
      setTyped('')
      close()
    },
    // No `onError`: a refusal is drawn where the analyst is standing — inside
    // the confirmation, beside the number that caused it.
  })

  const close = () => {
    setDialogOpen(false)
    run.reset()
  }

  /**
   * 🚩 Read from the mutation cache, not from `run.isPending` — the guard has to
   * outlive the control. The tab shell mounts only the OPEN tab, so a control
   * trusting its own pending flag would come back armed after an analyst clicked
   * Actions and returned mid-write, and a second press would write a second
   * **member update snapshot** and a second trail row. There is no server-side
   * idempotency anywhere in the module; this is the only guard there is.
   */
  const busy = useIsMutating({ mutationKey: commandKey }) > 0

  /**
   * How this failure is said — the wave's ONE refusal reader
   * (`commandRefusalText`): the server's own sentence, with the screen's wording
   * in front for a code it knows by name, and a 403 said as the grant refusal it
   * is. Spelled exactly as `StatusCommand`'s, because it IS the same thing.
   */
  const refusal = (error: unknown): string =>
    commandRefusalText(error, t('profile.mobile.failed'), t)

  /**
   * 🚩 A grant refusal takes the command away, not just the words: a 403 is a
   * fact about the session, and pressing again is the retry loop the rule exists
   * to prevent. It clears on Cancel or a remount, never on a second press.
   */
  const grantRefused = run.error instanceof ApiError && run.error.statusCode === 403
  const writable = verdict.state === 'writable'
  const cannotConfirm = busy || !writable || grantRefused

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-muted-foreground">{t('profile.mobile.note')}</p>

      <div className="flex flex-wrap items-end gap-3">
        <div className="min-w-0">
          <label
            htmlFor={MOBILE_ID}
            className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
          >
            {t('profile.mobile.label')}
          </label>
          <input
            id={MOBILE_ID}
            type="text"
            value={typed}
            disabled={busy}
            onChange={(event) => setTyped(event.target.value)}
            autoComplete="off"
            inputMode="tel"
            aria-invalid={problemKey ? true : undefined}
            aria-describedby={problemKey ? `${MOBILE_ID}-problem` : undefined}
            className={
              'h-8 w-56 rounded-md border bg-background px-2 font-mono text-[13px] text-foreground focus:outline-none disabled:opacity-50 ' +
              (problemKey
                ? 'border-danger-border focus:border-danger-border'
                : 'border-border/60 focus:border-primary/50')
            }
            data-testid="loy-mobile-input"
          />
        </div>
        <button
          type="button"
          // Dead until the screen has a number it can honestly send, and dead
          // while a write is in flight — the confirmation cannot be reopened
          // over an unfinished one.
          disabled={!writable || busy}
          onClick={() => setDialogOpen(true)}
          className={PRIMARY_BUTTON}
          data-testid="loy-mobile-command"
        >
          {busy ? (
            <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
          ) : (
            <Smartphone className="me-1.5 h-3.5 w-3.5" aria-hidden />
          )}
          {t('profile.mobile.change')}
        </button>
      </div>

      {/* Said against the field that caused it — each problem as itself, and
          only once the analyst has typed something. */}
      {problemKey && (
        <p id={`${MOBILE_ID}-problem`} role="alert" className="text-[11px] text-danger-800">
          {t(problemKey)}
        </p>
      )}

      {dialogOpen && (
        <Modal
          open
          onClose={() => !busy && close()}
          title={t('profile.mobile.dialogTitle')}
          width="30rem"
          footer={
            <>
              <Button
                variant="text"
                onClick={() => !busy && close()}
                aria-disabled={busy || undefined}
              >
                {t('profile.mobile.cancel')}
              </Button>
              <Button
                variant="primary"
                data-testid="loy-mobile-confirm"
                aria-disabled={cannotConfirm || undefined}
                onClick={() =>
                  !cannotConfirm && verdict.state === 'writable' && run.mutate(verdict.mobile)
                }
              >
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />}
                {t('profile.mobile.confirm')}
              </Button>
            </>
          }
        >
          <div className="flex flex-col gap-3 text-sm">
            <p className="text-muted-foreground">{t('profile.mobile.dialogNote')}</p>

            <div className="grid gap-x-6 gap-y-2 [grid-template-columns:repeat(auto-fit,minmax(9rem,1fr))]">
              <MemberFact label={t('profile.mobile.now')} value={member.mobile || null} mono />
              <MemberFact
                label={t('profile.mobile.after')}
                value={verdict.state === 'writable' ? verdict.mobile : null}
                mono
              />
            </div>

            {/* ⚠️ What is TRUE about verification on this path, said plainly. The
                admin change marks the number verified with no code sent to the
                customer; a dialog implying otherwise would have the analyst
                assert something they did not do. */}
            <p className="rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
              {t('profile.mobile.verifiedNote')}
            </p>

            {/* 🚩 A refusal keeps the analyst HERE, with the number they typed
                (ticket 220's rule) — and it changed nothing on the member. */}
            {run.isError && <ErrorBanner message={refusal(run.error)} className="p-2.5" />}
          </div>
        </Modal>
      )}
    </div>
  )
}

const MOBILE_ID = 'loy-mobile-new'
