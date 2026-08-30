import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Ban, ShieldCheck } from 'lucide-react'

import type { LoyMember } from '@/core/models/loy'
import { isBlankDate, formatShortDate, toIsoDate } from '@/core/util/date-format'
import type { MemberAuthority } from './api'
import { blockedReasonKey, memberTypeKey, tierKey } from './codes'
import { memberBirthDate } from './member-header'

/**
 * The Profile tab (ticket 302, spec 301) — the whole shape of the member already
 * on screen, drawn **exactly to this session's authority**.
 *
 * It issues no read of its own: the member is the one the route already
 * resolved, and the authority is the area's ONE probe answer, read from the
 * shared cache key by the tab shell above (`MemberTabs`). Nothing here writes.
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
 * ⚠️ **The commands are inert in this slice.** 302 owns the *visibility rule*
 * and writes nothing; 303 (block/unblock), 304 (profile save), 306 (email
 * removal) and 307 (mobile removal) each wire one of them up. The note above the
 * groups says so, rather than leaving an editor clicking a button that silently
 * does nothing.
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
   * The nine editable-later fields as the member currently stands. 🚩 The
   * read-only rendering reads THIS and never the draft below: the draft is
   * frozen at mount, and a member re-read (which 303's block/unblock will
   * trigger) would otherwise leave the field list showing pre-command values
   * beside a header that had already moved on.
   *
   * 🚩 The birth date is carried as `yyyy-MM-dd` rather than as its display
   * form: a control holds the value that will be SENT, and 304 has to parse
   * this back to the wire. The sentinel `0001-01-01` is an unset birth date,
   * not a fact about the customer, so it carries as blank.
   */
  const current = {
    fullName: member.fullName ?? '',
    email: member.email ?? '',
    birthDate: isoDate(member.birthDate),
    gender: member.gender ?? '',
    nationality: member.nationality ?? '',
    nationalId: member.nationalId ?? '',
    cityCode: member.cityCode ?? '',
    preferredLanguage: member.preferredLanguage ?? '',
    insuranceCompany: member.insuranceCompany ?? '',
  }

  // The editing session's working copy. Local and unsaved by design — 304 gives
  // it dirty-tracking, a Save that is dead until something changed, and the
  // stale-write guard. Nothing leaves this tab in this slice.
  //
  // ⚠️ **It is seeded once and never re-synced**, and the shell is keyed on the
  // LoyId, so a background re-read of the SAME member leaves these controls on
  // the values they were opened with while the facts beside them move. Correct
  // for an analyst mid-edit — their typing is not something a refetch may
  // overwrite — but it means 304's stale-write guard has to cover a draft that
  // went stale without anyone touching it, not only two analysts racing.
  const [draft, setDraft] = useState(current)

  const blocked = !!member.blockedReasonCode
  const blockedReason = codeWords(
    member.blockedReasonCode,
    blockedReasonKey(member.blockedReasonCode),
    t,
  )

  /** One editable field: a control for an editor, a read fact for everyone else.
   *  ONE definition, so the two renderings cannot drift apart. */
  const editable = (
    key: keyof typeof current,
    label: string,
    { mono }: { mono?: boolean } = {},
  ) =>
    mayEdit ? (
      <Control key={key} id={`loy-profile-${key}`} label={label}>
        <input
          id={`loy-profile-${key}`}
          type="text"
          value={draft[key]}
          onChange={(event) =>
            setDraft((current) => ({ ...current, [key]: event.target.value }))
          }
          autoComplete="off"
          className={
            'h-8 w-full rounded-md border border-border/60 bg-background px-2 text-sm text-foreground focus:border-primary/50 focus:outline-none ' +
            (mono ? 'font-mono text-[13px]' : '')
          }
        />
      </Control>
    ) : (
      // 🚩 The read-only twin shows the birth date as a DATE rather than as the
      // wire value the control carries — the same fact, said the way each
      // rendering needs it.
      <Fact
        key={key}
        label={label}
        value={(key === 'birthDate' ? memberBirthDate(member.birthDate) : current[key]) || null}
        mono={mono}
      />
    )

  return (
    <div className="flex flex-col gap-5">
      {(mayEdit || mayRemoveMobile) && (
        <p className="text-xs text-muted-foreground">{t('profile.inertNote')}</p>
      )}

      <section className="flex flex-col gap-3">
        <Legend>{t('profile.section.profile')}</Legend>
        <div className="grid gap-x-6 gap-y-3 [grid-template-columns:repeat(auto-fit,minmax(12rem,1fr))]">
          {editable('fullName', t('profile.field.fullName'))}
          {editable('email', t('profile.field.email'))}
          {editable('birthDate', t('profile.field.birthDate'))}
          {/* 🚩 A code is labelled AS a code (229 clause 5) — the screen holds no
              lookup for any of these four, and a label promising a name it does
              not have is the thing that turns `0021` into a wrong city. */}
          {editable('gender', t('profile.field.genderCode'), { mono: true })}
          {editable('nationality', t('profile.field.nationalityCode'), { mono: true })}
          {editable('nationalId', t('profile.field.nationalId'))}
          {editable('cityCode', t('profile.field.cityCode'), { mono: true })}
          {editable('preferredLanguage', t('profile.field.preferredLanguage'), { mono: true })}
          {editable('insuranceCompany', t('profile.field.insuranceCompany'))}
        </div>
        {mayEdit && (
          <div className="flex items-center gap-2">
            <button type="button" disabled className={PRIMARY_BUTTON}>
              {t('profile.save')}
            </button>
            <button type="button" disabled className={QUIET_BUTTON}>
              {t('profile.discard')}
            </button>
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
            value={codeWords(member.memberType, memberTypeKey(member.memberType), t)}
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
            value={codeWords(member.tier, tierKey(member.tier), t)}
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
          <Legend>{t('profile.section.status')}</Legend>
          {/* ONE control offering whichever of the two applies — a member is
              blocked or is not, and offering both would ask the analyst to read
              the member's state off a pair of buttons (303). */}
          <div className="flex flex-wrap items-center gap-3">
            <button type="button" disabled className={QUIET_BUTTON}>
              {blocked ? (
                <ShieldCheck className="me-1.5 h-3.5 w-3.5" aria-hidden />
              ) : (
                <Ban className="me-1.5 h-3.5 w-3.5" aria-hidden />
              )}
              {blocked ? t('profile.status.unblock') : t('profile.status.block')}
            </button>
            <span className="text-xs text-muted-foreground">
              {blocked
                ? t('profile.status.blockedAs', { reason: blockedReason })
                : t('profile.status.notBlocked')}
            </span>
          </div>
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
            {mayEdit && (
              <button type="button" disabled className={QUIET_BUTTON}>
                {t('profile.removeEmail')}
              </button>
            )}
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

/**
 * A member's birth date as a control carries it — `yyyy-MM-dd`, or blank for the
 * `0001-01-01` sentinel an unset one arrives as. The blank guard is
 * `isBlankDate`'s, the same one `formatShortDate` applies, rather than a second
 * spelling of "unset".
 */
function isoDate(value: string | null | undefined): string {
  if (!value) return ''
  const date = new Date(value)
  return isBlankDate(date) ? '' : toIsoDate(date)
}

/** A code's words when its set is closed in server source, and 🚩 **the bare
 *  code when it is not** — never a raw `loy:tier.X` (229 clause 4). */
function codeWords(
  code: string | null,
  key: string | null,
  t: (k: string) => string,
): string | null {
  if (!code) return null
  return key ? t(key) : code
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

/** One read-only fact. An absent value reads as absent, not as a gap. */
function Fact({
  label,
  value,
  mono,
}: {
  label: string
  value: string | null
  mono?: boolean
}) {
  const { t } = useTranslation('loy')
  return (
    <div className="min-w-0">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </div>
      <div
        className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'} ${
          value && mono ? 'font-mono text-[13px]' : ''
        }`}
      >
        {value || t('member.absent')}
      </div>
    </div>
  )
}

/** One editable field, labelled the way its read-only twin is so the two
 *  renderings read as the same screen. */
function Control({
  id,
  label,
  children,
}: {
  id: string
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <label
        htmlFor={id}
        className="mb-1 block text-[10px] font-bold uppercase tracking-wider text-muted-foreground"
      >
        {label}
      </label>
      {children}
    </div>
  )
}

const PRIMARY_BUTTON =
  'inline-flex h-8 items-center rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50'

const QUIET_BUTTON =
  'inline-flex h-8 items-center rounded-full border border-border/60 bg-background px-3 text-sm font-medium text-foreground transition-colors hover:bg-muted disabled:cursor-not-allowed disabled:opacity-50'
