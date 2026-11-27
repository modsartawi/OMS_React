import { useMemo } from 'react'
import type { TFunction } from 'i18next'
import StageBar from '@/core/charts/StageBar'
import type { AdviseRemovedPair, AdviseReply } from '@/core/models/sourcing-run'
import Ltr from '@/core/ui/Ltr'
import { fsi, formatPair } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import { funnelOf, type FunnelRow } from './funnel-model'
import NotFull from './NotFull'
import { usePlanWords } from './use-plan-words'

/** The codes with a rule name of their own (4281 decision 29, the filter family and the cut). */
const RULES = new Set([
  'MODE_OFF',
  'NOT_MODE_STORE',
  'LEFT_OUT',
  'NO_LOCATION',
  'OUT_OF_REACH',
  'CLOSED_NOW',
  'CLOSES_BEFORE_PICK',
  'PAST_CUTOFF',
  'NO_SLOT',
  'PRODUCT_RULE',
  'NO_STOCK',
  'STOCK_NOT_READ',
  'NO_STOCK_ROW',
  'PINNED_OUT',
  'OVER_PAIR_CAP',
])

/**
 * The funnel (ticket 966, spec 4354 §4): a bar per step with the pairs still standing, the pairs it removed beside it,
 * and under each step a disclosure listing every pair the record names with the rule's words — the screen writes the
 * sentence from the code and its figures (4281 decision 30). A run with a cut says so above the bars.
 */
export default function FunnelDiagram({ reply }: { reply: AdviseReply }) {
  const w = usePlanWords()
  const { t } = w
  const funnel = useMemo(() => funnelOf(reply), [reply])
  if (!funnel) return <NotFull />
  const rule = (code: string) => (RULES.has(code) ? t(`solver.funnel.rule.${code}`) : t('solver.funnel.rule.unknown', { code: fsi(code) }))

  return (
    <div className="flex flex-col gap-3" data-solver-funnel="">
      {funnel.cut && (
        <p
          className={
            funnel.cut.pairs > 0
              ? 'rounded-md border border-attention-border bg-attention-050 px-3 py-2 text-xs text-attention-800'
              : 'text-xs text-muted-foreground'
          }
          data-solver-cut={funnel.cut.pairs}
          data-solver-cut-code={funnel.cut.code}
        >
          {funnel.cut.pairs > 0
            ? funnel.cut.cap !== null
              ? t('solver.funnel.cutSome', { cap: fsi(formatFigure(funnel.cut.cap)), pairs: fsi(formatFigure(funnel.cut.pairs)), code: fsi(funnel.cut.code) })
              : t('solver.funnel.cutSomeNoCap', { pairs: fsi(formatFigure(funnel.cut.pairs)), code: fsi(funnel.cut.code) })
            : t('solver.funnel.cutNone', { cap: fsi(formatFigure(funnel.cut.cap)) })}
        </p>
      )}
      <ol className="flex flex-col gap-2">
        {funnel.rows.map((row, i) => (
          <Step key={`${row.step}-${i}`} row={row} rule={row.code ? rule(row.code) : t('solver.funnel.all')} />
        ))}
      </ol>
      <p className="text-xs font-medium" data-solver-offered={funnel.offered}>
        {t('solver.funnel.offered', { count: fsi(formatFigure(funnel.offered)) })}
      </p>
      <p className="text-xs text-muted-foreground">{t('solver.funnel.hint')}</p>
    </div>
  )
}

function Step({ row, rule: ruleName }: { row: FunnelRow; rule: string }) {
  const w = usePlanWords()
  const { t } = w
  const numbered = row.step !== 'ALL' && row.step !== 'CUT'
  return (
    <li className="flex flex-col gap-1" data-solver-step={String(row.step)} data-solver-step-code={row.code ?? undefined}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-baseline gap-x-3 text-xs">
        <span className={row.step === 'ALL' ? 'font-semibold' : ''}>
          {numbered && <span className="me-2 text-muted-foreground">{t('solver.funnel.step', { step: fsi(row.step) })}</span>}
          {ruleName}
        </span>
        <span className="tabular-nums font-semibold" title={t('solver.funnel.standing')} data-solver-standing="">
          <Ltr>{formatFigure(row.standing)}</Ltr>
        </span>
        <span className="w-12 text-end tabular-nums text-muted-foreground" title={t('solver.funnel.removed')} data-solver-removed-count={row.removedCount}>
          {row.removedCount > 0 && <Ltr>{`−${formatFigure(row.removedCount)}`}</Ltr>}
        </span>
      </div>
      <StageBar fraction={row.fraction} colour={row.step === 'ALL' ? 'var(--primary)' : undefined} />
      {row.removedCount > 0 && (
        <details className="text-xs" data-solver-removed="">
          <summary className="cursor-pointer text-muted-foreground">{t('solver.funnel.removedHere', { count: fsi(formatFigure(row.removedCount)) })}</summary>
          {row.removed.length === 0 ? (
            <p className="mt-1 text-muted-foreground">{t('solver.funnel.noneListed')}</p>
          ) : (
            <>
              {row.removed.length < row.removedCount && (
                <p className="mt-1 text-muted-foreground">{t('solver.funnel.listed', { count: fsi(formatFigure(row.removed.length)) })}</p>
              )}
              <ul className="mt-1 flex flex-col gap-0.5">
                {row.removed.map((r, k) => (
                  <li key={`${r.store}-${r.mode}-${r.lineNo ?? ''}-${k}`} className="flex flex-wrap gap-x-2" data-solver-removed-pair={`${r.store}:${r.mode}`}>
                    <span className="font-mono">
                      <Ltr>{formatPair(r.store, w.mode(r.mode))}</Ltr>
                    </span>
                    <span className="text-muted-foreground">{why(t, row.code ?? '', r) ?? ruleName}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </details>
      )}
    </li>
  )
}

/** The rule's words for one removed pair, from its code and the figures it carries; `null` when only the rule's name fits. */
function why(t: TFunction, code: string, r: AdviseRemovedPair): string | null {
  const n = (v: number) => fsi(v.toFixed(1))
  if (code === 'OUT_OF_REACH' && r.km !== undefined && r.reachKm !== undefined) return t('solver.funnel.why.OUT_OF_REACH', { km: n(r.km), reachKm: n(r.reachKm) })
  if (code === 'OVER_PAIR_CAP' && r.km !== undefined) return t('solver.funnel.why.OVER_PAIR_CAP', { km: n(r.km) })
  if (code === 'NO_STOCK' && r.lineNo !== undefined && r.offered !== undefined && r.asked !== undefined)
    return t('solver.funnel.why.NO_STOCK', { lineNo: fsi(r.lineNo), offered: fsi(formatFigure(r.offered)), asked: fsi(formatFigure(r.asked)) })
  if (r.lineNo !== undefined) return `${t('solver.funnel.why.line', { lineNo: fsi(r.lineNo) })} ${RULES.has(code) ? t(`solver.funnel.rule.${code}`) : ''}`.trim()
  return null
}
