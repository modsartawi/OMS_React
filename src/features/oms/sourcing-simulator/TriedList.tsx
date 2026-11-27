import { useMemo, useState } from 'react'
import type { AdviseReply, PlanGoal } from '@/core/models/sourcing-run'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi, formatPair } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import NotFull from './NotFull'
import { clock, keptGoals, TRIED_FIRST, triedFor } from './tried-model'
import { usePlanWords } from './use-plan-words'

const PARTS = new Set(['COMPANY_COST', 'FEES', 'WAITING', 'COVER', 'SPLIT', 'STORE_RECORD'])

/**
 * What was tried (ticket 966, spec 4354 §9; the run record 4242): pick a goal; the best whole plans the search kept
 * for it, ten at first with "show more", each with its deliveries, promise, fee, company's cost, price of waiting and
 * balanced total, and what it lost to the winner by with the part that cost it most — all as sent. The search counts
 * stand above the list.
 */
export default function TriedList({ reply }: { reply: AdviseReply }) {
  const w = usePlanWords()
  const { t } = w
  const goals = useMemo(() => keptGoals(reply), [reply])
  const [picked, setPicked] = useState<PlanGoal | null>(null)
  const [showAll, setShowAll] = useState(false)
  const goal = picked && goals.includes(picked) ? picked : goals[0]
  const tried = useMemo(() => (goal ? triedFor(reply, goal, showAll) : null), [reply, goal, showAll])
  if (!reply.search || !tried) return <NotFull />
  const money = (v: number | null) => <Ltr>{w.money(v)}</Ltr>
  const part = (p: string) => (PARTS.has(p) ? t(`solver.tried.part.${p}`) : t('solver.tried.part.unknown', { part: fsi(p) }))
  const c = tried.counts

  return (
    <div className="flex flex-col gap-3" data-solver-tried={goal}>
      {c && (
        <p className="text-xs" data-solver-counts="">
          {t('solver.tried.counts', {
            checked: fsi(formatFigure(c.plansChecked)),
            cap: fsi(formatFigure(c.cutByShipmentCap)),
            mixing: fsi(formatFigure(c.cutByMixing)),
            pins: fsi(formatFigure(c.cutByPins)),
          })}
        </p>
      )}
      <div role="group" aria-label={t('solver.tried.goalLabel')} className="flex flex-wrap gap-1">
        {goals.map((g) => (
          <Chip
            key={g}
            on={g === goal}
            onClick={() => {
              setPicked(g)
              setShowAll(false)
            }}
            data-solver-goal-pick={g}
          >
            {w.goal(g)}
          </Chip>
        ))}
      </div>
      {tried.rows.length === 0 ? (
        <p className="rounded-md border border-dashed border-border px-3 py-6 text-center text-sm text-muted-foreground" data-solver-tried-none="">
          {t('solver.tried.none')}
        </p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="border-b border-border-strong text-muted-foreground">
              <tr>
                <th className={`${TH} text-end`}>{t('solver.tried.rank')}</th>
                <th className={TH}>{t('solver.tried.plan')}</th>
                <th className={`${TH} text-end`}>{t('solver.tried.deliveries')}</th>
                <th className={`${TH} text-end`}>{t('solver.tried.promise')}</th>
                <th className={`${TH} text-end`}>{t('solver.tried.fee')}</th>
                <th className={`${TH} text-end`}>{t('solver.tried.companyCost')}</th>
                <th className={`${TH} text-end`}>{t('solver.tried.waiting')}</th>
                <th className={`${TH} text-end`}>{t('solver.tried.balanced')}</th>
                <th className={TH}>{t('solver.tried.lostBy')}</th>
              </tr>
            </thead>
            <tbody>
              {tried.rows.map((r) => (
                <tr key={r.rank} className={`border-b border-border/60 ${r.winner ? 'bg-primary-050' : ''}`} data-solver-tried-row={r.rank}>
                  <td className={`${TD} text-end tabular-nums`}>
                    <Ltr>{r.rank}</Ltr>
                  </td>
                  <td className={TD}>
                    <ul className="flex flex-col">
                      {r.shipments.map((s, i) => (
                        <li key={i} className="font-mono">
                          <Ltr>{formatPair(s.store, w.mode(s.mode))}</Ltr>
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td className={`${TD} text-end tabular-nums`}>
                    <Ltr>{r.deliveries}</Ltr>
                  </td>
                  <td className={`${TD} text-end tabular-nums`}>{r.promiseBy ? <Ltr>{clock(r.promiseBy)}</Ltr> : t('dash')}</td>
                  <td className={`${TD} text-end tabular-nums`}>{money(r.fee)}</td>
                  <td className={`${TD} text-end tabular-nums`}>{money(r.companyCost)}</td>
                  <td className={`${TD} text-end tabular-nums`}>{money(r.waiting)}</td>
                  <td className={`${TD} text-end font-semibold tabular-nums`} data-solver-tried-sum="">
                    {money(r.sum)}
                  </td>
                  <td className={TD} data-solver-lost={r.winner ? 'winner' : r.lostMostOn ?? ''}>
                    {r.winner ? (
                      <span className="rounded-full border border-primary-border px-1.5 py-px text-[11px]">{t('solver.tried.winner')}</span>
                    ) : r.lostMostOn ? (
                      t('solver.tried.lostMostly', { amount: fsi(w.money(r.lostBy)), part: part(r.lostMostOn) })
                    ) : (
                      <Ltr>{w.money(r.lostBy)}</Ltr>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {(tried.more > 0 || (showAll && tried.rows.length > TRIED_FIRST)) && (
        <div>
          <Button variant="secondary" onClick={() => setShowAll(!showAll)} data-solver-show-more={showAll ? 'fewer' : tried.more}>
            {showAll ? t('solver.tried.showFewer') : t('solver.tried.showMore', { count: fsi(formatFigure(tried.more)) })}
          </Button>
        </div>
      )}
    </div>
  )
}
