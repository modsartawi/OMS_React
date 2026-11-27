import type { PlanColumn } from './plans-table-model'
import { usePlanWords } from './use-plan-words'

/**
 * A plan's head, on a card and atop a table column (ticket 962): the server's label in the screen's language, a tag for
 * each other goal the same plan answers ("Recommended · also fewest deliveries"), and its flags — the simple plan, the
 * best found when the work budget ran out, a trial set.
 */
export default function PlanHead({ column }: { column: PlanColumn }) {
  const w = usePlanWords()
  const { t } = w
  const flags = [column.fallback && 'fallback', column.bestFound && 'bestFound', column.trialSet && 'trialSet'].filter((f): f is string => !!f)
  return (
    <div className="flex flex-wrap items-center gap-1.5" data-plan-head={column.goal}>
      <bdi className="text-sm font-semibold">{w.said(column.label)}</bdi>
      {column.tags.map((g) => (
        <span key={g} className="rounded-full bg-muted px-2 py-px text-[11px] text-muted-foreground" data-plan-tag={g}>
          {t(`tag.${g}`, { defaultValue: g })}
        </span>
      ))}
      {flags.map((f) => (
        <span key={f} className="rounded-full border border-attention-border bg-attention-050 px-2 py-px text-[11px] text-attention-800" data-plan-flag={f}>
          {t(`flag.${f}`)}
        </span>
      ))}
    </div>
  )
}
