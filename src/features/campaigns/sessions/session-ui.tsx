import { Trans, useTranslation } from 'react-i18next'
import { RULE_BUDGET_EVENT_REASONS, RULE_BUDGET_MOVEMENT_KINDS, type RuleSessionBudgetEvent, type RuleSessionMovement, type RuleSessionRefusal } from '@/core/models/rule-session'
import Ltr from '@/core/ui/Ltr'
import { formatNumber } from '@/core/util/number-format'
import SaysBoth from '@/core/rules/SaysBoth'
import { momentText } from './timeline'

// The Sessions screens' small shared renderers (tickets 518, 527). Their figures are isolated
// through `<Trans>` slots, never `fsi`: they are drawn inside grid cells too.
//
// A budget's amount is in its own unit (uses, money or points), and neither a journal line nor a
// hold names that unit: the figure is shown as HQ sent it, beside the budget's id.

/** A machine value (a figure, a code, a moment) inside a sentence. */
export const V = <bdi dir="ltr" />

const MOVE_KINDS: readonly string[] = RULE_BUDGET_MOVEMENT_KINDS
const EVENT_REASONS: readonly string[] = RULE_BUDGET_EVENT_REASONS

/** A line of the budget journal: "Held 22 of budget money-cap", and a hold's expiry. */
export function MovementText({ move }: { move: Pick<RuleSessionMovement, 'kind' | 'amount' | 'budget' | 'expiresAt'> }) {
  const { t } = useTranslation('rule-sessions')
  const known = MOVE_KINDS.includes(move.kind)
  const expires = momentText(move.expiresAt)
  return (
    <>
      <Trans
        t={t}
        i18nKey={known ? `move.${move.kind}` : 'move.other'}
        values={{ amount: formatNumber(move.amount), budget: move.budget, kind: move.kind }}
        components={{ v: V }}
      />
      {expires && (
        <span className="ms-1.5 text-muted-foreground" data-move-expires="">
          <Trans t={t} i18nKey="move.expires" values={{ at: expires }} components={{ v: V }} />
        </span>
      )}
    </>
  )
}

/** A budget event: why the counter passed its limit, and its figures. */
export function BudgetEventText({ event: e }: { event: RuleSessionBudgetEvent }) {
  const { t } = useTranslation('rule-sessions')
  const known = EVENT_REASONS.includes(e.reason)
  return (
    <>
      <span className="font-medium" data-budget-event-reason={e.reason}>
        {known ? t(`budgetEvent.reason.${e.reason}`) : <Ltr>{e.reason}</Ltr>}
      </span>
      <span className="text-muted-foreground">
        <Trans
          t={t}
          i18nKey="budgetEvent.figures"
          values={{ budget: e.budget, desired: formatNumber(e.desired), awarded: formatNumber(e.awarded), used: formatNumber(e.used), limit: formatNumber(e.limit) }}
          components={{ v: V }}
        />
      </span>
    </>
  )
}

/** A refusal: its code, and its reason in both languages when HQ gave one. */
export function RefusalText({ refusal: r }: { refusal: RuleSessionRefusal }) {
  return (
    <span className="flex flex-col gap-0.5" data-refusal={r.code}>
      <code className="font-mono font-semibold">
        <Ltr>{r.code}</Ltr>
      </code>
      {r.reason && <SaysBoth says={r.reason} />}
    </span>
  )
}
