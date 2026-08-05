import { useState } from 'react'
import type { TFunction } from 'i18next'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronRight } from 'lucide-react'

import type { LoyMember } from '@/core/models/loy'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatShortDate } from '@/core/util/date-format'
import { formatMoney } from '@/core/util/number-format'
import { memberBirthDate, memberChips, type MemberChip } from './member-header'

/**
 * The member header (ticket 235, drawn by [227's prototype], variant B).
 *
 * The pane an agent actually reads on a call: identity, the chips, the points
 * block, and the long tail of member fields behind one disclosure. It is **not a
 * tab and not sticky** — it scrolls away so a long grid gets the viewport, and
 * the grid's own header is what sticks (227 #4).
 *
 * What it says is decided in `member-header.ts` and `codes.ts`, both pure and
 * both under vitest; this file is the thin renderer that decision feeds. The
 * split is deliberate: a chip rule that lives in JSX is a rule no test can reach
 * while RTL is unbootstrapped (spec 231's testing decisions).
 *
 * **Drawn nowhere, on purpose:** `profile` (a dead constant `"W|D"`),
 * `accrualFactor`, `redemptionFactor`, `exchangeRate`, `pointsExpireSoonDays` (a
 * never-assigned constant `30`) and `profileUpdated`. Engine machinery, not the
 * member — they are absent from the model too, so this is not a filter but a
 * shape.
 */
export default function MemberHeader({ member }: { member: LoyMember }) {
  const { t } = useTranslation('loy')
  // 🚩 Shut by default, confirmed at the prototype review against open-by-default
  // and promote-some-fields-up: a screen opened forty times a day should not be
  // forty screens of PII nobody asked for.
  const [open, setOpen] = useState(false)

  const chips = memberChips(member)
  const birthDate = memberBirthDate(member.birthDate)

  return (
    <div className="overflow-hidden rounded-lg border border-border/60 bg-card">
      <div className="flex flex-wrap items-start gap-x-8 gap-y-4 p-4">
        <div className="min-w-0 flex-1 basis-64">
          {/* Identity, once — the largest thing on the screen after the balance,
              and the ONLY place the member's name appears (227 #2). */}
          <h1 className="text-xl font-semibold tracking-tight">
            {member.fullName || t('member.unnamed')}
          </h1>
          <dl className="mt-1.5 flex flex-wrap gap-x-5 gap-y-1 text-sm tabular-nums">
            <KeyValue label={t('member.loyId')} value={member.loyId} />
            {/* 🚩 The stored mobile, which IS the normalised key — the screen
                shows the server's value here rather than rewriting the box. */}
            <KeyValue label={t('member.mobile')} value={member.mobile} />
            <KeyValue label={t('member.joined')} value={formatShortDate(member.joinDate)} />
            <KeyValue label={t('member.updated')} value={formatShortDate(member.lastUpdate)} />
          </dl>
          {chips.length > 0 && (
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {chips.map((chip) => (
                <StatusBadge key={chip.kind} sev={chip.sev}>
                  {chipLabel(chip, t)}
                </StatusBadge>
              ))}
            </div>
          )}
        </div>

        {/* The points block. ONE headline figure (227 #5) — every other number
            here is at label size, so the question an agent is asked most often is
            answered before anything else is read. */}
        <div className="flex flex-wrap items-start gap-x-7 gap-y-3">
          <Figure label={t('member.points.balance')}>
            <span className="text-2xl font-bold tracking-tight tabular-nums">
              {formatPoints(member.pointsBalance)}
            </span>
            <span className="ms-1 text-xs font-semibold text-muted-foreground">
              {t('member.points.unit')}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('member.points.amount', {
                amount: formatMoney(member.pointsBalanceAmount),
                currency: member.pointsBalanceAmountCurrency,
              })}
            </span>
          </Figure>
          <Figure label={t('member.points.pending')}>
            <span className="text-[15px] font-semibold tabular-nums">
              {formatPoints(member.pendingPoints)}
            </span>
          </Figure>
          <Figure label={t('member.points.expiring')}>
            {/* 🚩 The only tinted figure on the screen, and only when non-zero:
                "nothing is expiring" must be quiet, or the tint stops meaning
                anything on the member where it does expire. */}
            <span
              className={`text-[15px] font-semibold tabular-nums ${
                member.pointsExpireSoon !== 0 ? 'text-attention-800' : ''
              }`}
            >
              {formatPoints(member.pointsExpireSoon)}
            </span>
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {t('member.points.expiringWithin')}
            </span>
          </Figure>
          <Figure label={t('member.points.tierPoints')}>
            <span className="text-[15px] font-semibold tabular-nums">
              {formatPoints(member.tierPointsBalance)}
            </span>
          </Figure>
        </div>
      </div>

      {open && (
        <dl className="grid gap-x-6 gap-y-2.5 border-t border-border/60 bg-card/40 px-4 pb-3.5 pt-3 [grid-template-columns:repeat(auto-fit,minmax(11rem,1fr))]">
          <Detail label={t('member.details.email')} value={member.email} />
          <Detail label={t('member.details.birthDate')} value={birthDate} />
          {/* 🚩 A code is labelled AS a code (229 clause 5). WPF writes "City"
              over a raw `0021`; that label promises a name the screen does not
              have. Code values render mono so they read as keys, not words. */}
          <Detail label={t('member.details.genderCode')} value={member.gender} mono />
          <Detail label={t('member.details.nationalId')} value={member.nationalId} />
          <Detail label={t('member.details.nationalityCode')} value={member.nationality} mono />
          <Detail label={t('member.details.cityCode')} value={member.cityCode} mono />
          <Detail
            label={t('member.details.preferredLanguage')}
            value={member.preferredLanguage}
            mono
          />
          <Detail label={t('member.details.insuranceCompany')} value={member.insuranceCompany} />
        </dl>
      )}

      <div className="border-t border-border/60 px-4 py-2">
        <button
          type="button"
          onClick={() => setOpen(!open)}
          aria-expanded={open}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline"
        >
          {open ? (
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          ) : (
            <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" aria-hidden />
          )}
          {open ? t('member.details.hide') : t('member.details.show')}
        </button>
      </div>
    </div>
  )
}

/**
 * A chip's words: the translation when the code's set is closed in server
 * source, and 🚩 **the bare code when it is not** — never a raw `loy:tier.X`.
 * The blocked chip alone wraps its reason, because "Blocked" is the fact and the
 * reason is why (230).
 */
function chipLabel(chip: MemberChip, t: TFunction): string {
  const words = chip.labelKey ? t(chip.labelKey) : chip.code
  return chip.kind === 'blocked' ? t('chip.blocked', { reason: words }) : words
}

/** Points render grouped, and never with invented decimals — a whole balance is
 *  a whole number and a fractional accrual keeps what it has. */
const formatPoints = (value: number): string =>
  Number.isFinite(value) ? value.toLocaleString(undefined, { maximumFractionDigits: 2 }) : ''

/** One labelled fact on the identity line. */
function KeyValue({ label, value }: { label: string; value: string | null }) {
  const { t } = useTranslation('loy')
  return (
    <div className="flex items-baseline gap-1.5">
      <dt className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">
        {label}
      </dt>
      <dd className={value ? 'font-medium text-foreground' : 'text-muted-foreground'}>
        {value || t('member.absent')}
      </dd>
    </div>
  )
}

/** One figure in the points block: a label above, the number below. Size is the
 *  caller's — there is exactly one big figure and this component does not decide
 *  which. */
function Figure({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <span className="block text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </div>
  )
}

/** One field in the disclosure. An absent value reads as absent, not as a gap. */
function Detail({
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
      <dt className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {label}
      </dt>
      <dd
        className={`text-sm ${value ? 'text-foreground' : 'text-muted-foreground'} ${
          value && mono ? 'font-mono text-[13px]' : ''
        }`}
      >
        {value || t('member.absent')}
      </dd>
    </div>
  )
}
