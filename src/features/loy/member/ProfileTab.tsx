import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { LoyMember } from '@/core/models/loy'
import { formatShortDate } from '@/core/util/date-format'
import type { MemberAuthority } from './api'
import { blockedReasonKey, codeWords, memberTypeKey, tierKey } from './codes'
import { memberBirthDate } from './member-header'
import { PROFILE_FIELDS, profileDraftOf } from './profile-form'
import MemberFact from './MemberFact'
import MobileCommand from './MobileCommand'
import ProfileForm from './ProfileForm'
import { QUIET_BUTTON } from './profile-controls'
import RemoveEmailCommand from './RemoveEmailCommand'
import StatusCommand from './StatusCommand'

/**
 * The Profile tab (ticket 302, spec 301) — the whole shape of the member already
 * on screen, drawn **exactly to this session's authority**.
 *
 * It issues no read of its own: the member is the one the route already
 * resolved, and the authority is the area's ONE probe answer, read from the
 * shared cache key by the tab shell above (`MemberTabs`). Every write it makes
 * lives in its own component, one per **member command**.
 *
 * Three renderings of one component, not three components — a divergence is how
 * a read-only view starts showing a field the editable one dropped (spec 301):
 *
 * - **May look** — a read-only field list. 🚩 **No controls, and no disabled
 *   ones either**, and no "you cannot edit this" banner: the analyst can already
 *   read every one of these values on the header, and this tab is a better
 *   arrangement of them and nothing else. Telling a reader what they may not do
 *   is noise on the screen they use forty times a day.
 * - **May edit** — the same fields become controls, and the Status and
 *   email-removal commands appear.
 * - **May remove a mobile** — the mobile-removal command joins the removal
 *   group, which is set visibly apart from everything else.
 *
 * 🚩 **Hiding a control is never the protection.** Every command's grant is
 * enforced server-side per route (ADR 0001); the flags decide only what is
 * *drawn*.
 *
 * ⚠️ **Only the mobile removal is still inert.** 302 owned the *visibility
 * rule* and wrote nothing; 303 wired the Status command up (`StatusCommand` —
 * block and unblock, and the write idiom the rest copy), 304 the profile itself
 * (`ProfileForm`), 305 the mobile (`MobileCommand`) and 306 the email removal
 * (`RemoveEmailCommand`). 307 (mobile removal) is still a button that does
 * nothing, and the note above the groups names **it** rather than claiming the
 * whole tab is disconnected — a note that says more than is true is how an
 * editor stops reading it.
 *
 * **Drawn nowhere:** the referral code the ticket's read-only column names —
 * `LoyMemberModel` does not carry one, so there is no field on the wire, on the
 * model, or here. Adding a model field to satisfy a table would be inventing a
 * fact about the customer.
 */
export default function ProfileTab({
  member,
  authority,
}: {
  member: LoyMember
  authority: MemberAuthority
}) {
  const { t } = useTranslation('loy')
  const { mayEdit, mayRemoveMobile } = authority

  /**
   * The nine fields as the member currently stands — what the **read-only**
   * rendering draws. 🚩 It reads the live member and never an editing draft: a
   * draft is frozen at mount, and a member re-read (a block, an unblock, a
   * profile save) would otherwise leave the field list showing pre-command
   * values beside a header that had already moved on.
   */
  const current = profileDraftOf(member)

  /**
   * Bumped to start the editing session again from the member as stored —
   * Discard, and the reload a stale form offers. The form seeds itself at mount
   * and never re-syncs (see `ProfileForm`), so **remounting it is the only way
   * to re-seed it**, and routing both through one counter keeps "start again
   * from what is stored" meaning exactly one thing on this screen.
   */
  const [formGeneration, setFormGeneration] = useState(0)

  const blockedReason = codeWords(member.blockedReasonCode, blockedReasonKey, t)

  return (
    <div className="flex flex-col gap-5">
      {/* 🚩 Said only to the session that can see the one control it is still
          true of. 306 connected the email removal, so an editor without the
          removal grant now has nothing inert on this tab — and a note claiming
          otherwise is how an analyst stops reading the notes. */}
      {mayRemoveMobile && (
        <p className="text-xs text-muted-foreground">{t('profile.inertNote')}</p>
      )}

      <section className="flex flex-col gap-3">
        <Legend>{t('profile.section.profile')}</Legend>
        {/* 🚩 ONE field list, drawn twice. Both renderings map `PROFILE_FIELDS`,
            so a field cannot exist in one and not the other — the divergence
            spec 301 names, where a read-only view starts showing a field the
            editable one dropped. A code is labelled AS a code (229 clause 5):
            the screen holds no lookup for any of the four, and a label promising
            a name it does not have is what turns `0021` into a wrong city. */}
        {mayEdit ? (
          <ProfileForm
            // 🚩 **The stored email is part of the form's identity** (ticket
            // 306). The form seeds itself once at mount and never re-syncs, and
            // a Save sends all nine fields — so a draft opened before a
            // **contact removal** still holds the removed address, and the next
            // Save would put it straight back on the wire. That is ADR 0002
            // undone by an ordinary edit: the address the customer asked to have
            // taken away, restored by the analyst who took it away, silently.
            // Keying on the value makes the form re-seed exactly when the
            // re-read lands — which is why it is the *stored* email and not a
            // counter bumped on success: the invalidation is deliberately not
            // awaited, so at the moment a removal succeeds the cache still holds
            // the old member, and a counter would re-seed from it.
            key={`${formGeneration}:${member.email ?? ''}`}
            member={member}
            onReseed={() => setFormGeneration((generation) => generation + 1)}
          />
        ) : (
          <div className="grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
            {PROFILE_FIELDS.map(({ key, labelKey, mono }) => (
              // 🚩 The read-only twin shows the birth date as a DATE rather than
              // as the wire value the control carries — the same fact, said the
              // way each rendering needs it.
              <Fact
                key={key}
                label={t(labelKey)}
                value={(key === 'birthDate' ? memberBirthDate(member.birthDate) : current[key]) || null}
                mono={mono}
              />
            ))}
          </div>
        )}
      </section>

      <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
        {/* Forever read-only, and grouped so that reads as a property of the
            fields rather than as something this session happens to lack. */}
        <Legend>{t('profile.section.facts')}</Legend>
        <div className="grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
          <Fact label={t('profile.fact.loyId')} value={member.loyId} mono />
          <Fact
            label={t('profile.fact.memberType')}
            value={codeWords(member.memberType, memberTypeKey, t)}
          />
          {/* 🚩 The mobile is read-only HERE even for an editor: it is the login
              credential and one of only two ways a member can be found, so it
              changes through its own command (305) and never as a profile
              field. */}
          <Fact label={t('profile.fact.mobile')} value={member.mobile} />
          <Fact label={t('profile.fact.pointsBalance')} value={points(member.pointsBalance)} />
          <Fact label={t('profile.fact.pendingPoints')} value={points(member.pendingPoints)} />
          <Fact
            label={t('profile.fact.tier')}
            value={codeWords(member.tier, tierKey, t)}
          />
          <Fact label={t('profile.fact.tierPoints')} value={points(member.tierPointsBalance)} />
          <Fact
            label={t('profile.fact.joinDate')}
            value={formatShortDate(member.joinDate) || null}
          />
          <Fact
            label={t('profile.fact.lastUpdate')}
            value={formatShortDate(member.lastUpdate) || null}
          />
          <Fact label={t('profile.fact.blockedReason')} value={blockedReason} />
        </div>
      </section>

      {mayEdit && (
        <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
          <Legend>{t('profile.section.mobile')}</Legend>
          {/* 🚩 Its OWN control, with its own confirmation — the login
              credential and one of only two ways a member can be found never
              changes as a side effect of fixing a name (305). */}
          <MobileCommand member={member} />
        </section>
      )}

      {mayEdit && (
        <section className="flex flex-col gap-3 border-t border-border/60 pt-4">
          <Legend>{t('profile.section.status')}</Legend>
          {/* ONE control offering whichever of the two applies — a member is
              blocked or is not, and offering both would ask the analyst to read
              the member's state off a pair of buttons (303). */}
          <StatusCommand member={member} />
        </section>
      )}

      {(mayEdit || mayRemoveMobile) && (
        // 🚩 Set visibly apart, and last. These are the commands that take a way
        // of reaching the customer away; grouping them with the ordinary edits is
        // how one gets clicked as if it were one.
        <section className="flex flex-col gap-3 rounded-lg border border-danger-border bg-danger-050/50 p-3.5">
          <Legend>{t('profile.section.removal')}</Legend>
          <p className="text-xs text-muted-foreground">{t('profile.removalNote')}</p>
          <div className="flex flex-wrap items-center gap-2">
            {/* Email removal is under *may edit*, NOT the removal grant: an
                editor can blank the field through the profile command anyway, so
                gating it higher would be an authority that looks enforced and is
                not (ADR 0001). */}
            {mayEdit && <RemoveEmailCommand member={member} />}
            {/* The third tier, and the only control behind it. Hidden entirely
                rather than disabled — a disabled button is an invitation to ask
                for a grant nobody meant to offer. */}
            {mayRemoveMobile && (
              <button type="button" disabled className={QUIET_BUTTON}>
                {t('profile.removeMobile')}
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  )
}

/** Points render grouped and without invented decimals — the same rule the
 *  header states them under. */
const points = (value: number): string =>
  Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ''

/** A section heading. Each names a consequence rather than a field group
 *  (spec 301: the commands are grouped by what they do to the member). */
function Legend({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
      {children}
    </h2>
  )
}

/** One read-only fact — `MemberFact`, shared with the mobile command's
 *  confirmation so the two cannot drift (305). */
const Fact = MemberFact
