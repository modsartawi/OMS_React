import { useState } from 'react'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, MailX } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'
import {
  MEMBER_SCOPE_KEY,
  loyCommandApi,
  memberActionsScopeKey,
  memberCommandKey,
} from './api'
import { CASE_REFERENCE_MAX_LENGTH, emailRemovalVerdict, removalProblem } from './contact-removal'
import CaseReferenceField from './CaseReferenceField'
import MemberCommandDialog from './MemberCommandDialog'
import MemberFact from './MemberFact'
import { commandRefusalText } from './member-commands'
import { QUIET_BUTTON } from './profile-controls'

/**
 * The email **contact removal** (ticket 306, spec 301) — the first of the two
 * removals, and the ceremony 307 then reuses.
 *
 * A customer telephones and asks to stop being emailed. The analyst removes the
 * address, and the trail records that **a person asked**.
 *
 * The rules live in `contact-removal.ts` under vitest; this file is the
 * arrangement, and it copies ticket 303's write idiom rather than inventing a
 * second one: the refusal surfaced from the envelope, the in-flight disable as
 * the ONLY double-submit guard, and the invalidation carried inside the mutation
 * rather than in an observer.
 *
 * Four properties are this ticket's own:
 *
 * 1. 🚩 **The Remove control is dead until a case reference is typed**, and dead
 *    is not the same as discouraged: an unaccountable removal must be
 *    *impossible* (spec 301 #39). The verdict IS the request
 *    (`emailRemovalVerdict`), so the confirm cannot be armed off one reference
 *    and send another.
 * 2. 🚩 **The removed address is recorded nowhere new.** The body carries the
 *    reference alone. The Actions tab renders free-form command data verbatim to
 *    anyone holding the read grant, so writing the old address there would
 *    republish the very thing the customer asked to have taken away (ADR 0002).
 *    The dialog *shows* the address — it is already on the tab behind it, and
 *    seeing which address is about to go is how an analyst catches the wrong
 *    member — but nothing shown here is sent.
 * 3. 🚩 **It records intent, not exclusivity.** A *may edit* holder can also
 *    blank the Email field through the profile form, which records as an
 *    ordinary profile update — so removal counts read off this command's trail
 *    are a **floor, not a total**. The bypass is deliberately not closed: ADR
 *    0001 rules that gating this higher would be an authority that looks
 *    enforced and is not.
 * 4. **It costs the customer nothing else.** No block, no lost login, no lost
 *    points, no lost history — and the confirmation says so, in the words
 *    `CONTEXT.md` permits. *Erasure*, *deletion* and *anonymisation* are listed
 *    against **contact removal** precisely because each claims more than this
 *    command does.
 *
 * 🚩 **No retyped loyalty id here.** That guard belongs to 307, where the
 * removal cannot be undone by hand. An email an analyst removed by mistake is an
 * edit they can simply redo, and the friction would buy nothing.
 */
export default function RemoveEmailCommand({ member }: { member: LoyMember }) {
  const { t } = useTranslation('loy')
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [caseReference, setCaseReference] = useState('')

  /** 🚩 The verdict IS the request — the only way to obtain a `ContactRemoval`,
   *  so the control cannot arm off a reference the precondition never saw. */
  const verdict = emailRemovalVerdict(caseReference)
  const problem = removalProblem(verdict)

  /** Nothing to remove is not a refusal — it is a fact about the member, said
   *  where the control is rather than discovered after a round trip that would
   *  write a trail row saying a person asked to remove nothing. */
  const address = member.email?.trim() || null

  const commandKey = memberCommandKey(member.loyId, 'remove-email')

  const run = useMutation({
    // Keyed, so the in-flight fact lives in the MUTATION CACHE rather than in
    // this component — the tab shell mounts only the open tab (see `busy`).
    mutationKey: commandKey,
    mutationFn: async (reference: string) => {
      const armed = emailRemovalVerdict(reference)
      // The precondition again, at the last possible moment. Not defensiveness:
      // it is what makes the removal *unconstructable* without a reference
      // rather than merely unreachable through the button.
      if (armed.state !== 'removable') throw new Error('an email removal needs a case reference')
      await loyCommandApi.removeEmail(member.loyId, armed.removal)
      // The invalidation is part of the command and not of the component's
      // reaction to it (303's idiom): both keys, always, and neither awaited —
      // the profile's Email field and every page of the Actions trail move with
      // no reload, and a hung READ never holds the dialog open over a write that
      // has already committed.
      void queryClient.invalidateQueries({ queryKey: MEMBER_SCOPE_KEY })
      void queryClient.invalidateQueries({ queryKey: memberActionsScopeKey(member.loyId) })
    },
    onSuccess: () => {
      toast.success(t('profile.removeEmail.removed'))
      // 🚩 Cleared only on a write that actually happened. A refusal keeps the
      // reference the analyst named — theirs to correct or to retry — because a
      // field emptied by a failure is the analyst's typing taken away by the
      // server (ticket 220's rule).
      setCaseReference('')
      close()
    },
    // No `onError`: a refusal is drawn where the analyst is standing — inside
    // the confirmation, beside the reference they named.
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
   * removal and a second trail row. There is no server-side idempotency anywhere
   * in the module; this is the only guard there is.
   */
  const busy = useIsMutating({ mutationKey: commandKey }) > 0

  /**
   * How this failure is said — the wave's ONE refusal reader
   * (`commandRefusalText`): the server's own sentence, with the screen's wording
   * in front for a code it knows by name, and a 403 said as the grant refusal it
   * is. Spelled exactly as the other commands', because it IS the same thing.
   */
  const refusal = (error: unknown): string =>
    commandRefusalText(error, t('profile.removeEmail.failed'), t)

  /** 🚩 A grant refusal takes the command away, not just the words: a 403 is a
   *  fact about the session, and pressing again is the retry loop the rule
   *  exists to prevent. It clears on Cancel or a remount, never on a second
   *  press. */
  const grantRefused = run.error instanceof ApiError && run.error.statusCode === 403
  const removable = verdict.state === 'removable'
  const cannotConfirm = busy || !removable || grantRefused

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        // Dead while a write is in flight, so the confirmation cannot be
        // reopened over an unfinished one — and dead when there is no address,
        // because a removal of nothing is a trail row saying a customer asked
        // for something that had already happened.
        disabled={busy || !address}
        onClick={() => setDialogOpen(true)}
        className={QUIET_BUTTON}
        data-testid="loy-remove-email"
      >
        {busy ? (
          <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <MailX className="me-1.5 h-3.5 w-3.5" aria-hidden />
        )}
        {t('profile.removeEmail.action')}
      </button>
      {!address && (
        <span className="text-xs text-muted-foreground">{t('profile.removeEmail.none')}</span>
      )}

      {dialogOpen && (
        <MemberCommandDialog
          title={t('profile.removeEmail.dialogTitle')}
          width="32rem"
          busy={busy}
          cannotConfirm={cannotConfirm}
          // 🚩 The terminal tier's colour, unlike the other two commands': this
          // is the one control on the tab that takes a way of reaching the
          // customer away.
          confirmVariant="danger"
          confirmLabel={t('profile.removeEmail.confirm')}
          cancelLabel={t('profile.removeEmail.cancel')}
          confirmTestId="loy-remove-email-confirm"
          error={run.isError ? refusal(run.error) : null}
          onClose={close}
          onConfirm={() =>
            verdict.state === 'removable' && run.mutate(verdict.removal.caseReference)
          }
        >
        {/* 🚩 What the removal does AND what it does not. The member keeps
            their login, their points and their history, and the copy says so
            in the words CONTEXT.md permits — never erasure, deletion or
            anonymisation, each of which claims more than this command does. */}
        <p className="text-muted-foreground">{t('profile.removeEmail.dialogNote')}</p>

        {/* The address is SHOWN and not sent — seeing which one is about to
            go is how an analyst catches the wrong member. */}
        <MemberFact label={t('profile.removeEmail.current')} value={address} />

        {/* The shared half of the ceremony — one field, asked for in one set of
            words by both removals (`CaseReferenceField`). */}
        <CaseReferenceField
          id={REFERENCE_ID}
          value={caseReference}
          onChange={setCaseReference}
          disabled={busy}
          problem={problem ? t(problem.key, { max: CASE_REFERENCE_MAX_LENGTH }) : null}
          testId="loy-case-reference"
        />

        {/* 🚩 ADR 0002, said to the analyst rather than only to the reviewer:
            the reference is what the trail keeps, and the address is not. */}
        <p className="rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
          {t('profile.removeEmail.recordNote')}
        </p>

        {/* Why the control is dead — said once, where the analyst is looking
            for the button that is not working. */}
        {!removable && !problem && (
          <p className="text-xs text-muted-foreground" role="status">
            {t('profile.caseReference.required')}
          </p>
        )}

        {/* The refusal is drawn by the shell, last in the body — it keeps the
            analyst HERE, with the reference they typed (ticket 220's rule),
            and it changed nothing on the member. */}
        </MemberCommandDialog>
      )}
    </div>
  )
}

const REFERENCE_ID = 'loy-remove-email-case'
