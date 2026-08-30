import { useTranslation } from 'react-i18next'

/**
 * One read-only fact about the member on screen.
 *
 * It lives in its own module for the reason `profile-controls.ts` does: the
 * Profile tab's field list and the mobile command's confirmation both draw a
 * label-above-value pair, inches apart, and one copy of the class string in each
 * would look identical today and drift the first time the type scale moves.
 *
 * 🚩 **An absent value reads as absent, not as a gap** — and that rule lives
 * here, once, rather than at each call site. A blank cell is a screen that has
 * forgotten to say something; `—` is a screen saying the member has no such
 * fact recorded.
 *
 * `mono` marks a value that is a **code** or a **number** with no lookup on this
 * screen: it is set in the mono face so a reader can compare it digit by digit
 * (229 clause 5).
 */
export default function MemberFact({
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
