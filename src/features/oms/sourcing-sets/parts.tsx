/**
 * The few pieces the three weight-set screens share (ticket 967): a set named with its version, a figure's evidence
 * badge, a shelf chance figure's name, a setting's name and value, a code in words, the promise check table.
 */
import { useTranslation } from 'react-i18next'
import type { WeightSetVersionRef } from '@/core/models/sourcing-run'
import type { MarkPromiseCheck, ShelfChanceEvidence } from '@/core/models/sourcing-sets'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { TD, TH } from '@/core/ui/sheet-table'
import { fsi } from '@/core/util/bidi'
import { formatFigure, formatMoney3 } from '@/core/util/number-format'
import { figureName } from './marking-model'
import type { DiffRow, ShelfCell } from './version-diff-model'

export const NS = 'sourcing-sets'
export const CARD = 'rounded-lg border border-border bg-card p-4'
export const H2 = 'text-sm font-semibold'

export const count = (n: number | null | undefined) => formatFigure(n)
/** A share as the server sends it — a fraction — written as a percent with one decimal. */
export const pct = (fraction: number) => `${(fraction * 100).toFixed(1)}%`
/** A chance (a fraction) written as a percent with two decimals. */
export const chance = (fraction: number) => `${(fraction * 100).toFixed(2)}%`

/** A share isolated as a machine value; a missing one is the screen's dash (review 2 #8: never a literal). */
export function Pct({ n }: { n: number | null | undefined }) {
  const { t } = useTranslation(NS)
  return typeof n === 'number' ? <Ltr>{pct(n)}</Ltr> : <span className="text-muted-foreground">{t('dash')}</span>
}

/** "Express margin, version 5": the free-text name and the version, each isolated in one sentence. */
export function useSetLabel() {
  const { t } = useTranslation(NS)
  return (r: WeightSetVersionRef) => t('setRef', { name: fsi(r.name), version: fsi(r.version) })
}

export function SetRef({ r, strong = false }: { r: WeightSetVersionRef; strong?: boolean }) {
  const label = useSetLabel()
  return (
    <span className={strong ? 'font-semibold' : ''} data-set-ref={`${r.name}|${r.version}`}>
      {label(r)}
    </span>
  )
}

/** A server code in the screen's words (`<prefix>.<code>`), or the code itself, isolated, when the screen has none. */
export function CodeLabel({ prefix, code }: { prefix: string; code: string }) {
  const { t, i18n } = useTranslation(NS)
  return i18n.exists(`${NS}:${prefix}.${code}`) ? <span>{t(`${prefix}.${code}`)}</span> : <Ltr>{code}</Ltr>
}

const EVIDENCE_SEV: Record<ShelfChanceEvidence, Severity> = { ENOUGH: 'go', TOO_FEW: 'warn', NOT_STEADY: 'warn' }

/** What the evidence says of a figure; "not read" while the server has no mark for it. */
export function EvidenceBadge({ evidence }: { evidence: string | null | undefined }) {
  const { t } = useTranslation(NS)
  const known = !!evidence && evidence in EVIDENCE_SEV
  return (
    <span data-evidence={evidence ?? 'none'}>
      <StatusBadge sev={known ? EVIDENCE_SEV[evidence as ShelfChanceEvidence] : 'mute'}>
        {known ? t(`evidence.${evidence}`) : evidence ? <Ltr>{evidence}</Ltr> : t('evidence.none')}
      </StatusBadge>
    </span>
  )
}

/** "2 asked, 0 left over". */
export function CellName({ cell }: { cell: ShelfCell }) {
  const { t } = useTranslation(NS)
  return <span>{t('cell', { asked: fsi(cell.asked), left: fsi(cell.leftOver) })}</span>
}

/** A shelf chance figure by the name the server gives it: a cell, a short-figure row, or the name itself. */
export function FigureLabel({ figure }: { figure: string }) {
  const { t } = useTranslation(NS)
  const f = figureName(figure)
  if (!f) return <Ltr>{figure}</Ltr>
  if (f.kind === 'shelf') return <CellName cell={f} />
  return (
    <span>
      {t('shortFigure', { mode: t(`mode.${f.mode}`, { defaultValue: fsi(f.mode) }), row: t(`shortRow.${f.row}`, { defaultValue: fsi(f.row) }) })}
    </span>
  )
}

export function SettingName({ row }: { row: DiffRow }) {
  const { t } = useTranslation(NS)
  if (row.cell) return <CellName cell={row.cell} />
  if (row.group === 'other') return <Ltr>{row.key}</Ltr>
  return <span>{t(`settings.${row.key}`)}</span>
}

/** A setting's value: a switch in words, riyals to three decimals, a chance as a percent, a figure isolated. */
export function SettingValue({ row, value }: { row: DiffRow; value: unknown }) {
  const { t } = useTranslation(NS)
  if (value === undefined || value === null) return <span className="text-muted-foreground">{t('diff.notSet')}</span>
  if (typeof value === 'boolean') return <span>{t(value ? 'value.on' : 'value.off')}</span>
  if (typeof value === 'number') {
    if (row.kind === 'riyals') return <span>{t('value.riyals', { amount: fsi(formatMoney3(value)) })}</span>
    if (row.kind === 'chance') return <Ltr>{chance(value)}</Ltr>
    return <Ltr>{String(value)}</Ltr>
  }
  return <Ltr>{typeof value === 'string' ? value : JSON.stringify(value)}</Ltr>
}

/** The promise check per mode under the trial's version: deliveries checked, within the promise, the share. */
export function PromiseTable({ rows }: { rows: readonly MarkPromiseCheck[] }) {
  const { t } = useTranslation(NS)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" data-promise-table="">
        <thead className="text-muted-foreground">
          <tr>
            <th className={TH}>{t('promise.mode')}</th>
            <th className={`${TH} text-end`}>{t('promise.checked')}</th>
            <th className={`${TH} text-end`}>{t('promise.within')}</th>
            <th className={`${TH} text-end`}>{t('promise.share')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.mode} data-promise-row={p.mode}>
              <td className={TD}>
                <CodeLabel prefix="mode" code={p.mode} />
              </td>
              <td className={`${TD} text-end`}>
                <Ltr>{count(p.checked)}</Ltr>
              </td>
              <td className={`${TD} text-end`}>
                <Ltr>{count(p.within)}</Ltr>
              </td>
              <td className={`${TD} text-end font-semibold`}>
                <Pct n={p.share} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Orders refused by reason, and the changed plans by kind: a label and its count. */
export function CountList({ rows, prefix }: { rows: readonly [string, number][]; prefix: string }) {
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-xs">
      {rows.map(([code, n]) => (
        <li key={code} className="flex justify-between gap-2" data-count-row={code}>
          <CodeLabel prefix={prefix} code={code} />
          <Ltr>{count(n)}</Ltr>
        </li>
      ))}
    </ul>
  )
}

/** The date part of the wire's local wall clock (`yyyy-MM-dd HH:mm:ss`). */
export const day = (at: string) => at.slice(0, 10)
