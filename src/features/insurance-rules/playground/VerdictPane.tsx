import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import type { Severity } from '@/core/ui/severity'
import StatusBadge from '@/core/ui/StatusBadge'
import { GuardSeverityBadge, RuleId } from '@/core/insurance-rules/badges'
import { TD, TH } from '@/core/insurance-rules/parts'
import { formatMoney, formatNumber } from '@/core/util/number-format'
import { fsi } from '@/core/util/bidi'
import type { CategoryVerdictLine, CoverageCell, GuardVerdictLine, VerdictView } from './verdict'

/**
 * Tab B, "What the live check would say" (ticket 678): the reply's `verdict` as the experiment's kind reads it —
 * guard: each line's outcome and the rules that fired; coverage: each value per line and for the invoice, with who
 * set it; category: each line's category, group, who set it and the rule, and the rules that could not decide.
 * Draws a view model (`./verdict`) only. Money through `formatMoney`; codes and numbers isolated (`Ltr`).
 */
export default function VerdictPane({ view }: { view: VerdictView }) {
  const { t } = useTranslation('insurance-playground')
  if (view.kind === 'none')
    return (
      <p className="rounded-md border border-border/60 px-3 py-2 text-sm text-muted-foreground" data-verdict="none">
        {t('verdict.none')}
      </p>
    )
  return (
    <div className="flex flex-col gap-3" data-verdict={view.kind}>
      {view.kind === 'guard' && view.lines.map((l) => <GuardLine key={l.line} line={l} />)}
      {view.kind === 'coverage' && (
        <>
          {view.lines.map((l) => (
            <CoverageTable key={l.line} hook={`line-${l.line}`} title={t('outcome.line', { n: fsi(l.line) })} cells={l.values} />
          ))}
          <CoverageTable hook="invoice" title={t('verdict.coverage.invoice')} cells={view.invoice} />
        </>
      )}
      {view.kind === 'category' && <CategoryTable lines={view.lines} />}
    </div>
  )
}

const OUTCOME_SEV: Record<string, Severity> = { pass: 'go', refuse: 'bad', override: 'warn', warn: 'warn', exception: 'mute', unknown: 'mute' }

function GuardLine({ line }: { line: GuardVerdictLine }) {
  const { t, i18n } = useTranslation('insurance-playground')
  const outcome = line.outcome ?? 'unknown'
  const ar = i18n.language.startsWith('ar')
  return (
    <article className="flex flex-col gap-2 border-t border-border/60 pt-3 first:border-t-0 first:pt-0" data-verdict-line={line.line} data-outcome={outcome}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('outcome.line', { n: fsi(line.line) })}</span>
        <span className="text-xs text-muted-foreground">{t('verdict.outcome.label')}</span>
        <StatusBadge sev={OUTCOME_SEV[outcome] ?? 'mute'}>{t(`verdict.outcome.${outcome}`)}</StatusBadge>
      </header>
      {line.fired.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-fired-none="">
          {t('verdict.fired.none')}
        </p>
      ) : (
        <div className="flex flex-col gap-1">
          <p className="text-xs font-medium text-muted-foreground">{t('verdict.fired.label')}</p>
          <ul className="flex flex-col gap-1">
            {line.fired.map((f, i) => (
              <li key={`${f.ruleId}-${i}`} className="flex flex-wrap items-center gap-2 text-sm" data-fired={f.ruleId}>
                <RuleId id={f.ruleId} />
                {f.severity && <GuardSeverityBadge severity={f.severity} />}
                {f.message && <bdi data-fired-message="">{(ar ? f.message.ar : f.message.en) || f.message.en || f.message.ar}</bdi>}
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  )
}

function CoverageTable({ hook, title, cells }: { hook: string; title: string; cells: CoverageCell[] }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <section className="flex flex-col gap-1" data-coverage={hook}>
      <h3 className="text-sm font-medium">{title}</h3>
      <table className="w-full text-xs">
        <thead>
          <tr>
            <th className={TH}>{t('verdict.coverage.field')}</th>
            <th className={TH}>{t('verdict.coverage.value')}</th>
            <th className={TH}>{t('verdict.coverage.source')}</th>
          </tr>
        </thead>
        <tbody>
          {cells.map((c) => (
            <tr key={c.key} data-coverage-value={c.key} data-source={c.source ?? 'unknown'}>
              <td className={TD}>{t(`verdict.coverage.values.${c.key}`)}</td>
              <td className={TD} data-value="">
                <CellValue cell={c} />
              </td>
              <td className={TD}>
                <span className="inline-flex flex-wrap items-center gap-2">
                  <span>{t(`verdict.coverage.sources.${c.source ?? 'unknown'}`)}</span>
                  {c.ruleId && <RuleId id={c.ruleId} />}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  )
}

function CellValue({ cell }: { cell: CoverageCell }) {
  const { t } = useTranslation('insurance-playground')
  const v = cell.value
  if (v === null) return <span className="text-muted-foreground">{t('verdict.coverage.blank')}</span>
  if (typeof v === 'boolean') return <span>{t(v ? 'verdict.coverage.yes' : 'verdict.coverage.no')}</span>
  if (typeof v === 'string')
    return (
      <span className="font-mono">
        <Ltr>{v}</Ltr>
      </span>
    )
  const text = cell.type === 'money' ? formatMoney(v) : cell.type === 'percent' ? t('verdict.percent', { n: formatNumber(v) }) : formatNumber(v)
  return (
    <span className="tabular-nums">
      <Ltr>{text}</Ltr>
    </span>
  )
}

function CategoryTable({ lines }: { lines: CategoryVerdictLine[] }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <table className="w-full text-xs" data-category-verdict="">
      <thead>
        <tr>
          <th className={TH}>{t('verdict.category.line')}</th>
          <th className={TH}>{t('verdict.category.category')}</th>
          <th className={TH}>{t('verdict.category.group')}</th>
          <th className={TH}>{t('verdict.category.source')}</th>
          <th className={TH}>{t('verdict.category.rule')}</th>
          <th className={TH}>{t('verdict.category.unknowns')}</th>
        </tr>
      </thead>
      <tbody>
        {lines.map((l) => (
          <tr key={l.line} data-category-line={l.line} data-source={l.source}>
            <td className={TD}>
              <Ltr>{l.line}</Ltr>
            </td>
            <td className={TD} data-category={l.category ?? ''}>
              {l.category && <Ltr>{l.category}</Ltr>}
            </td>
            <td className={`${TD} font-mono`} data-group={l.group ?? ''}>
              {l.group && <Ltr>{l.group}</Ltr>}
            </td>
            <td className={TD}>{t(`verdict.category.sources.${l.source}`)}</td>
            <td className={TD}>{l.ruleId && <RuleId id={l.ruleId} />}</td>
            <td className={TD} data-unknowns={l.unknowns.join(',')}>
              <span className="inline-flex flex-wrap gap-1">
                {l.unknowns.map((u) => (
                  <RuleId key={u} id={u} />
                ))}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  )
}
