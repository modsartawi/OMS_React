import { useState } from 'react'
import { useIsMutating, useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, RotateCw } from 'lucide-react'
import { toast } from 'sonner'

import { ApiError, apiErrorMessage } from '@/core/api'
import type { LoyMember } from '@/core/models/loy'
import ErrorBanner from '@/core/ui/ErrorBanner'
import {
  MEMBER_SCOPE_KEY,
  loyCommandApi,
  memberActionsScopeKey,
  memberCommandKey,
} from './api'
import { commandRefusalText } from './member-commands'
import { PRIMARY_BUTTON, QUIET_BUTTON } from './profile-controls'
import {
  PROFILE_FIELDS,
  type ProfileDraft,
  type ProfileField,
  dirtyProfileFields,
  isStaleProfileRefusal,
  profileDraftOf,
  profileFormIsStale,
  profileProblems,
  profileRefusedField,
  profileUpdateRequest,
} from './profile-form'

/**
 * The profile **member command** (ticket 304, spec 301) — the nine editable
 * fields, a Save that is dead until something changed, and a Discard that
 * returns the member to as stored.
 *
 * The rules live in `profile-form.ts` under vitest, because they are decisions
 * and a decision inside JSX is one no test can reach while React Testing Library
 * is unbootstrapped. This file is the arrangement, and it copies ticket 303's
 * write idiom rather than inventing a second one: the refusal surfaced from the
 * envelope, the in-flight disable as the ONLY double-submit guard, and the
 * invalidation carried inside the mutation rather than in an observer.
 *
 * Four properties are this ticket's own:
 *
 * 1. 🚩 **A blank stays blank.** Nothing here demands a gender or a preferred
 *    language, and nothing sends `""` — see `profile-form.ts`, which is where
 *    the ruling and its test live.
 * 2. **Save is dead until something actually changed**, so a command that
 *    records no change cannot be written, and the **changed fields are marked
 *    before saving** — a stray keystroke in a field the analyst did not mean to
 *    touch is seen rather than silently written.
 * 3. 🚩 **A refused save keeps every edit on the form** (ticket 220's standing
 *    rule): a server refusal costs a retry, never the analyst's typing. Nothing
 *    below clears the draft on an error path — only Discard and a save that
 *    actually succeeded move it.
 * 4. 🚩 **The stale-write guard.** The form echoes the member's last-update
 *    stamp as it was opened on, and the door refuses if the member has moved.
 *    That refusal is not an error: it says the member changed underneath you,
 *    and it offers a **reload** rather than a retry.
 */
export default function ProfileForm({
  member,
  onReseed,
}: {
  member: LoyMember
  /** Replace the whole editing session with the member as currently stored —
   *  the tab shell remounts this component, which re-seeds from the live
   *  member. Discard and the stale reload both go through it, so "start again
   *  from what is stored" has exactly one meaning on this screen. */
  onReseed: () => void
}) {
  const { t } = useTranslation('loy')
  const queryClient = useQueryClient()

  /**
   * The member as this editing session opened on them — the baseline every
   * comparison is made against, and the stamp the stale-write echo carries.
   *
   * 🚩 **Seeded once and never re-synced** (ticket 302's note). The tab shell is
   * keyed on the LoyId, so a background re-read of the SAME member leaves these
   * controls holding what they were opened with while the read-only facts beside
   * them move. That is right for an analyst mid-edit — their typing is not
   * something a refetch may overwrite — and it is exactly why the stale guard has
   * to cover a draft that went stale on its own, not only two analysts racing.
   */
  const [seed, setSeed] = useState<{
    values: ProfileDraft
    lastUpdate: string | null
    /** The stamp a save that has already succeeded was made against, so the form
     *  can tell a member payload that has not caught up from one that has. */
    superseded: string | null
  }>(() => ({
    values: profileDraftOf(member),
    lastUpdate: member.lastUpdate,
    superseded: null,
  }))
  const [draft, setDraft] = useState<ProfileDraft>(seed.values)
  /** Whether the shape checks have been shown yet. They are named on the first
   *  Save attempt and live from then on, so a field being fixed clears its own
   *  wording — rather than complaining at an analyst who is still typing. */
  const [problemsShown, setProblemsShown] = useState(false)
  const [reloading, setReloading] = useState(false)

  const dirty = dirtyProfileFields(seed.values, draft)
  const problems = profileProblems(draft)

  /**
   * The stamp the echo carries. `null` means *a save has just succeeded and the
   * member's new stamp has not arrived yet* — the screen then follows the live
   * member, which is the freshest thing it knows and matches the values on the
   * form, rather than echoing a stamp it has itself made obsolete.
   */
  const openedOn = seed.lastUpdate ?? member.lastUpdate

  /**
   * 🚩 The member payload has not caught up with a save this form already made:
   * the stamp on it is the very one that save superseded. Saving again now would
   * echo a stamp the door has already moved past and be refused as stale — the
   * guard firing on a race with **itself** rather than with another analyst — so
   * Save waits for the read the write kicked off. It is the one moment the
   * invalidation's deliberate not-awaiting has to be paid for, and a briefly
   * dead Save is a far cheaper price than a refusal that reads as a colleague's
   * edit.
   */
  const awaitingStamp = seed.lastUpdate === null && member.lastUpdate === seed.superseded

  const commandKey = memberCommandKey(member.loyId)

  const save = useMutation({
    // 🚩 Keyed, so the in-flight fact lives in the MUTATION CACHE and outlives
    // this component — the tab shell mounts only the open tab (see `busy`).
    mutationKey: commandKey,
    mutationFn: async (sent: ProfileDraft) => {
      await loyCommandApi.updateProfile(member.loyId, profileUpdateRequest(sent, openedOn))

      // The invalidation is part of the command, not of this component's
      // reaction to it (ticket 303): it runs even if the analyst has switched
      // tabs while the write was in flight. Both prefixes, always — the member
      // for the header and these facts, the Actions trail because that is where
      // a **member command** becomes visible.
      //
      // 🚩 Deliberately NOT awaited: `core/api.ts` puts no timeout on `fetch`,
      // so awaiting a refetch here would hold `isPending` — and the form's
      // disabled controls with it — on a hung READ long after the write itself
      // had committed.
      void queryClient.invalidateQueries({ queryKey: MEMBER_SCOPE_KEY })
      void queryClient.invalidateQueries({ queryKey: memberActionsScopeKey(member.loyId) })
    },
    onSuccess: (_data, sent) => {
      toast.success(t('profile.updated'))
      // 🚩 The baseline becomes what was SENT, so the form is immediately
      // undirty and Save goes dead again — and the stamp becomes unknown rather
      // than the one this very save superseded, which would otherwise make the
      // form warn that it had gone stale against itself.
      setSeed({ values: sent, lastUpdate: null, superseded: openedOn })
      setProblemsShown(false)
    },
    // No `onError`: a refusal is drawn where the analyst is standing, beside the
    // Save that has to be pressed again. A toast would take the explanation away
    // from the fields that have to be corrected.
  })

  /**
   * 🚩 **Read from the mutation cache, not from `save.isPending`** — the tab
   * shell mounts only the open tab, so a control trusting its own pending flag
   * would come back armed after an analyst clicked Actions and returned
   * mid-write. With no server-side idempotency anywhere in the module, a second
   * press writes a second **member update snapshot** and a second trail row.
   * This is the only guard there is, and it has to outlive the button.
   */
  const busy = useIsMutating({ mutationKey: commandKey }) > 0
  /** A grant refusal (403) takes the command away rather than merely
   *  apologising: nothing the analyst does on this screen will change it, so an
   *  armed Save would be the retry loop the rule exists to prevent. It clears on
   *  a remount, never by pressing the same button again. */
  const grantRefused = save.error instanceof ApiError && save.error.statusCode === 403

  /** The member moved while the form was open — the clash the screen can see
   *  for itself. The server's refusal remains the authority; this is the same
   *  news arriving earlier, and it never disarms Save: a stamp the door has
   *  reformatted must not be able to strand an analyst's edits. */
  const staleNow = profileFormIsStale(seed.lastUpdate, member.lastUpdate)
  const staleRefused = isStaleProfileRefusal(save.error)

  /** The field a failure belongs against — a shape check's or the door's. Spec
   *  301 #17: an analyst fixes the field that caused it, not the form. */
  const problemFor = (field: ProfileField): string | null => {
    if (problemsShown) {
      const found = problems.find((problem) => problem.field === field)
      if (found) return t(found.key)
    }
    return profileRefusedField(save.error) === field
      ? apiErrorMessage(save.error, t('profile.saveFailed'))
      : null
  }

  /** How a refusal is said — the wave's ONE refusal reader, shared with the
   *  Status command: the server's own sentence, the screen's wording in front
   *  for a code it knows by name, and a 403 said as the grant refusal it is. */
  const refusal = (error: unknown): string =>
    commandRefusalText(error, t('profile.updateFailed'), t)

  const submit = () => {
    if (busy || grantRefused || dirty.length === 0) return
    if (problems.length > 0) {
      // Named against the fields, and nothing is sent. The draft is untouched.
      setProblemsShown(true)
      return
    }
    save.mutate(draft)
  }

  /**
   * Replace the edits with the member as stored **now**. The refetch is awaited
   * on purpose — unlike the write's invalidation, this read is the whole point
   * of the press, and re-seeding before it landed would put the analyst back on
   * the very copy they asked to leave.
   */
  const reload = async () => {
    setReloading(true)
    try {
      await queryClient.refetchQueries({ queryKey: MEMBER_SCOPE_KEY })
    } finally {
      setReloading(false)
      onReseed()
    }
  }

  const canSave = dirty.length > 0 && !busy && !grantRefused && !awaitingStamp

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
        {PROFILE_FIELDS.map(({ key, labelKey, mono }) => {
          const id = `loy-profile-${key}`
          const changed = dirty.includes(key)
          const problem = problemFor(key)
          return (
            <div key={key} className="min-w-0">
              <label
                htmlFor={id}
                className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
              >
                {t(labelKey)}
                {/* 🚩 The changed fields are visible BEFORE saving — a stray
                    keystroke in a field nobody meant to touch is seen rather
                    than silently written (spec 301 #15). */}
                {changed && (
                  <span className="rounded-full bg-primary/10 px-1.5 py-px text-[9px] font-semibold tracking-wide text-primary">
                    {t('profile.changed')}
                  </span>
                )}
              </label>
              <input
                id={id}
                type="text"
                value={draft[key]}
                disabled={busy}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [key]: event.target.value }))
                }
                autoComplete="off"
                aria-invalid={problem ? true : undefined}
                aria-describedby={problem ? `${id}-problem` : undefined}
                className={
                  'h-8 w-full rounded-md border bg-background px-2 text-sm text-foreground focus:outline-none disabled:opacity-50 ' +
                  (problem
                    ? 'border-danger-border focus:border-danger-border '
                    : 'border-border/60 focus:border-primary/50 ') +
                  (mono ? 'font-mono text-[13px]' : '')
                }
              />
              {/* Named against the field that caused it, beside that field. */}
              {problem && (
                <p id={`${id}-problem`} className="mt-1 text-[11px] text-danger-800">
                  {problem}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* 🚩 The stale news, said the moment the screen can tell — and it offers a
          reload rather than a retry. Save stays armed: the door is the authority
          on whether the member really moved. */}
      {(staleNow || staleRefused) && (
        <ErrorBanner
          title={t('profile.staleTitle')}
          message={t('profile.staleNote')}
          className="p-2.5"
        >
          <button
            type="button"
            onClick={reload}
            disabled={reloading || busy}
            className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-danger-border px-3 py-1 text-xs font-semibold transition-colors hover:bg-danger-050 disabled:opacity-50"
          >
            {reloading ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <RotateCw className="h-3 w-3" aria-hidden />
            )}
            {t('profile.reload')}
          </button>
        </ErrorBanner>
      )}

      {/* Every refusal but the stale one, which has said its piece above. */}
      {save.isError && !staleRefused && (
        <ErrorBanner message={refusal(save.error)} className="p-2.5" />
      )}
      {problemsShown && problems.length > 0 && (
        <ErrorBanner message={t('profile.fixFields')} className="p-2.5" />
      )}

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          // 🚩 Dead until something has actually changed — a command that
          // records no change must not be writable — and dead while a write is
          // in flight, which is the whole double-submit guard.
          disabled={!canSave}
          onClick={submit}
          className={PRIMARY_BUTTON}
          data-testid="loy-profile-save"
        >
          {busy && <Loader2 className="me-1.5 h-3.5 w-3.5 animate-spin" aria-hidden />}
          {t('profile.save')}
        </button>
        <button
          type="button"
          disabled={dirty.length === 0 || busy}
          onClick={onReseed}
          className={QUIET_BUTTON}
          data-testid="loy-profile-discard"
        >
          {t('profile.discard')}
        </button>
        <span className="text-xs text-muted-foreground" role="status">
          {dirty.length === 0
            ? t('profile.noChanges')
            : t('profile.changedCount', { count: dirty.length })}
        </span>
      </div>
    </div>
  )
}
