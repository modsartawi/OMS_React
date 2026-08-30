import { useState } from 'react'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, PhoneOff } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'
import {
  MEMBER_SCOPE_KEY,
  loyCommandApi,
  memberActionsScopeKey,
  memberCommandKey,
} from './api'
import {
  CASE_REFERENCE_MAX_LENGTH,
  mobileRemovalVerdict,
  removalProblem,
} from './contact-removal'
import CaseReferenceField from './CaseReferenceField'
import MemberCommandDialog from './MemberCommandDialog'
import MemberFact from './MemberFact'
import { commandRefusalText } from './member-commands'
import { QUIET_BUTTON, removalFieldClass } from './profile-controls'
import { forgetRemovedMobileInSession } from './recent-searches'

/**
 * The mobile **contact removal** (ticket 307, spec 301) — the command this whole
 * wave was requested for, and the only one behind the third tier of authority.
 *
 * A customer asks to be made unreachable. Their number goes, and with it their
 * ability to sign in and the estate's ability to find them by anything except a
 * loyalty id.
 *
 * The rules live in `contact-removal.ts` under vitest; this file is the
 * arrangement, and it copies 306's removal ceremony rather than inventing a
 * second one — the same case reference, the same shell (`MemberCommandDialog`),
 * the same refusal reader, the same in-flight guard.
 *
 * Four things are this command's own:
 *
 * 1. 🚩 **The loyalty id is retyped, exactly.** The failure being designed
 *    against is not a mis-click but the **wrong member** — two members open in
 *    two tabs — and a confirmation dialog does not prevent that, because people
 *    click through dialogs. A retyped id does, because the wrong id is on screen
 *    and will not match. Not trimmed and not case-folded: see the module.
 * 2. 🚩 **The confirmation says three things, and the third is not optional.**
 *    The member cannot sign in; the member cannot be found by number; and
 *    everything else about them **remains**. The third exists so an analyst does
 *    not promise a customer more than has happened — `CONTEXT.md` lists three
 *    words against **contact removal** for exactly this reason, and none of them
 *    appears in this screen's copy.
 * 3. 🚩 **The member's chip is dropped from recent searches.** Those chips are
 *    the *typed key* — a customer's mobile number — held in `sessionStorage` on a
 *    shared workstation. Left alone, the number the analyst was just asked to
 *    remove sits in their session as a chip that no longer resolves.
 * 4. **There is no undo, and the screen does not pretend otherwise.** ADR 0002:
 *    the old values survive only in the *preceding* **member update snapshot**,
 *    which no portal read exposes, so a reversal is a support task — and not a
 *    simple restore anyway, since reattaching a number must re-run the collision
 *    check because someone else may hold it by now.
 *
 * 🚩 **Drawn only for a session that holds *may remove a mobile*** — and hidden
 * entirely rather than disabled, because a disabled control is an invitation to
 * ask for a grant nobody meant to offer. `ProfileTab` owns that rule; the grant
 * itself is enforced server-side per route (ADR 0001).
 */
export default function RemoveMobileCommand({ member }: { member: LoyMember }) {
  const { t } = useTranslation('loy')
  const queryClient = useQueryClient()

  const [dialogOpen, setDialogOpen] = useState(false)
  const [caseReference, setCaseReference] = useState('')
  const [typedLoyId, setTypedLoyId] = useState('')

  /** 🚩 The verdict IS the request: the only way to obtain a `ContactRemoval`,
   *  and it takes both halves of the ceremony at once, so the control cannot be
   *  armed by a reference alone or by an id alone. */
  const verdict = mobileRemovalVerdict(caseReference, typedLoyId, member.loyId)
  const problem = removalProblem(verdict)
  /** Only the id's own problem belongs under the id field. */
  const idProblem = problem?.field === 'loyId' ? problem : null

  /** Nothing to remove is a fact about the member, said where the control is —
   *  a removal of nothing would still block them and still write a trail row
   *  saying a customer asked for something that had already happened. */
  const number = member.mobile?.trim() || null

  const commandKey = memberCommandKey(member.loyId, 'remove-mobile')

  const run = useMutation({
    mutationKey: commandKey,
    mutationFn: async (reference: string) => {
      const armed = mobileRemovalVerdict(reference, typedLoyId, member.loyId)
      // The precondition again, at the last possible moment — what makes the
      // removal unconstructable rather than merely unreachable through a button.
      if (armed.state !== 'removable') throw new Error('a mobile removal needs a reference and the id')
      await loyCommandApi.removeMobile(member.loyId, armed.removal)

      /**
       * 🚩 **The chip goes with the number, and it goes here** — inside the
       * command, beside the write, rather than in an observer that does not fire
       * if the analyst has switched tabs. The rule and the session write both
       * live in `recent-searches`, which owns the bar; the lookup page that
       * displays it is not mounted, and its own `useState(readRecents)` re-reads
       * on the way back.
       *
       * ⚠️ **It matches what the browser can see is the same number, and no
       * more.** A chip typed `0555000111` against a stored `966555000111` is the
       * same customer and this cannot tell — normalisation is the door's
       * (`LoyMobileNumbers.NormaliseTyped`) and a second spelling of it here is
       * how the two start to disagree (decision 225 ruling 4). The chips die with
       * the tab either way; the miss is a number left in one agent's session, and
       * the honest fix is the door returning what it normalised, which is a
       * question for map 1396.
       */
      forgetRemovedMobileInSession(number)

      // Both keys, always, and neither awaited (303's idiom): the header's
      // number and blocked chip and every page of the Actions trail move with no
      // reload, and a hung READ never holds the dialog open over a write that has
      // already committed.
      void queryClient.invalidateQueries({ queryKey: MEMBER_SCOPE_KEY })
      void queryClient.invalidateQueries({ queryKey: memberActionsScopeKey(member.loyId) })
    },
    onSuccess: () => {
      // Says both halves of what happened. A toast naming only the removal would
      // leave the analyst to discover the block from the header.
      toast.success(t('profile.removeMobile.removed'))
      setCaseReference('')
      setTypedLoyId('')
      close()
    },
    // No `onError`: a refusal is drawn inside the confirmation, beside what
    // caused it.
  })

  const close = () => {
    setDialogOpen(false)
    run.reset()
  }

  /** 🚩 From the mutation cache, not `run.isPending` — the tab shell mounts only
   *  the open tab, so a control trusting its own flag comes back armed after a
   *  tab switch mid-write, and there is no server-side idempotency anywhere in
   *  the module to catch the second press. */
  const busy = useIsMutating({ mutationKey: commandKey }) > 0

  const refusal = (error: unknown): string =>
    commandRefusalText(error, t('profile.removeMobile.failed'), t)

  /** 🚩 A grant refusal takes the command away rather than only apologising —
   *  and on this command in particular, since a 403 here says the session does
   *  not hold *may remove a mobile*, which no amount of pressing will change. */
  const grantRefused = run.error instanceof ApiError && run.error.statusCode === 403
  const removable = verdict.state === 'removable'
  const cannotConfirm = busy || !removable || grantRefused

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        type="button"
        disabled={busy || !number}
        onClick={() => setDialogOpen(true)}
        className={QUIET_BUTTON}
        data-testid="loy-remove-mobile"
      >
        {busy ? (
          <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />
        ) : (
          <PhoneOff className="me-1.5 h-3.5 w-3.5" aria-hidden />
        )}
        {t('profile.removeMobile.action')}
      </button>
      {!number && (
        <span className="text-xs text-muted-foreground">{t('profile.removeMobile.none')}</span>
      )}

      {dialogOpen && (
        <MemberCommandDialog
          title={t('profile.removeMobile.dialogTitle')}
          width="34rem"
          busy={busy}
          cannotConfirm={cannotConfirm}
          confirmVariant="danger"
          confirmLabel={t('profile.removeMobile.confirm')}
          cancelLabel={t('profile.removeMobile.cancel')}
          confirmTestId="loy-remove-mobile-confirm"
          error={run.isError ? refusal(run.error) : null}
          onClose={close}
          onConfirm={() =>
            verdict.state === 'removable' && run.mutate(verdict.removal.caseReference)
          }
        >
          <p className="text-muted-foreground">{t('profile.removeMobile.dialogNote')}</p>

          {/* 🚩 The three things, drawn as three things. A paragraph would be
              read as one claim and skimmed as none; the third — what the customer
              KEEPS — is the one an analyst has to be able to repeat back. */}
          <ol className="flex list-decimal flex-col gap-1.5 ps-5 text-xs text-muted-foreground">
            <li>{t('profile.removeMobile.consequence.signIn')}</li>
            <li>{t('profile.removeMobile.consequence.findable')}</li>
            <li className="text-foreground">{t('profile.removeMobile.consequence.keeps')}</li>
          </ol>

          {/* The number is SHOWN and not sent — seeing which one is about to go
              is how an analyst catches the wrong member, and the retyped id below
              is what stops them if they do not. */}
          <MemberFact label={t('profile.removeMobile.current')} value={number} mono />

          {/* 🚩 The block, said before it happens and not discovered on the
              header afterwards — including that it REPLACES whatever reason the
              member is blocked under now. */}
          <p className="rounded-md border border-border/60 bg-muted/40 p-2.5 text-xs text-muted-foreground">
            {t('profile.removeMobile.blockNote')}
          </p>

          {/* 🚩 The SAME field the email removal asks for, in the same words —
              the reference is the whole of a removal's *why* (ADR 0002), so what
              it is called cannot differ between the two commands. */}
          <CaseReferenceField
            id={REFERENCE_ID}
            value={caseReference}
            onChange={setCaseReference}
            disabled={busy}
            problem={
              problem?.field === 'caseReference'
                ? t(problem.key, { max: CASE_REFERENCE_MAX_LENGTH })
                : null
            }
            testId="loy-mobile-case-reference"
          />

          <div className="flex flex-col gap-1">
            <label
              htmlFor={LOYID_ID}
              className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
            >
              {t('profile.removeMobile.idLabel')}
            </label>
            <input
              id={LOYID_ID}
              type="text"
              value={typedLoyId}
              disabled={busy}
              onChange={(event) => setTypedLoyId(event.target.value)}
              autoComplete="off"
              aria-invalid={idProblem ? true : undefined}
              aria-describedby={`${LOYID_ID}-hint`}
              placeholder={t('profile.removeMobile.idPlaceholder')}
              className={removalFieldClass(!!idProblem)}
              data-testid="loy-retyped-loyid"
            />
            <p id={`${LOYID_ID}-hint`} className="text-[11px] text-muted-foreground">
              {t('profile.removeMobile.idHint', { loyId: member.loyId })}
            </p>
            {/* 🚩 Said under the field that caused it, and only once the
                analyst has typed something — an id half-entered is not a wrong
                id. Which field a problem belongs under is `removalProblem`'s to
                say: an over-long case reference reported here would have an
                analyst hunting the wrong input. */}
            {idProblem && (
              <p role="alert" className="text-[11px] text-danger-800">
                {t(idProblem.key)}
              </p>
            )}
          </div>

          {/* Why the control is dead, named for whichever half is still missing —
              the analyst is looking at a button that will not press. */}
          {!removable && !problem && (
            <p className="text-xs text-muted-foreground" role="status">
              {verdict.state === 'noReference'
                ? t('profile.caseReference.required')
                : t('profile.removeMobile.idRequired')}
            </p>
          )}
        </MemberCommandDialog>
      )}
    </div>
  )
}

const REFERENCE_ID = 'loy-remove-mobile-case'
const LOYID_ID = 'loy-remove-mobile-loyid'
