/**
 * The few pieces the three weight-set screens share (ticket 967): a set named with its version, a reading's badge, a
 * shelf chance figure's name, a setting's name and value, the promise check table.
 */
import { useTranslation } from 'react-i18next'
import type { WeightSetVersionRef } from '@/core/models/sourcing-run'
import type { MarkingPromiseRow, MarkingReading } from '@/core/models/sourcing-sets'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { TD, TH } from '@/core/ui/sheet-table'
import { formatRange, fsi } from '@/core/util/bidi'
import { formatFigure, formatMoney3 } from '@/core/util/number-format'
import type { DiffRow, ShelfCell } from './version-diff-model'

export const NS = 'sourcing-sets'
export const CARD = 'rounded-lg border border-border bg-card p-4'
export const H2 = 'text-sm font-semibold'

export const count = (n: number | null | undefined) => formatFigure(n)
/** A share as sent: percent with one decimal. */
export const pct = (n: number) => `${n.toFixed(1)}%`

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

const READING_SEV: Record<MarkingReading, Severity> = {
  ENOUGH_TO_CHANGE: 'go',
  TOO_FEW: 'warn',
  NOT_STEADY: 'warn',
}

export function ReadingBadge({ reading }: { reading: string }) {
  const { t } = useTranslation(NS)
  const known = reading in READING_SEV
  return (
    <span data-reading={reading}>
      <StatusBadge sev={known ? READING_SEV[reading as MarkingReading] : 'warn'}>{known ? t(`reading.${reading}`) : <Ltr>{reading}</Ltr>}</StatusBadge>
    </span>
  )
}

/** "Dawaa Now, 1 asked, 1 left over". */
export function CellName({ cell }: { cell: ShelfCell }) {
  const { t } = useTranslation(NS)
  return (
    <span>
      {t('cell', {
        mode: t(`mode.${cell.mode}`),
        asked: fsi(cell.asked),
        left: t(`leftOver.${cell.leftOver}`),
      })}
    </span>
  )
}

export function SettingName({ row }: { row: DiffRow }) {
  const { t } = useTranslation(NS)
  if (row.cell) return <CellName cell={row.cell} />
  if (row.group === 'other') return <Ltr>{row.key}</Ltr>
  return <span>{t(`settings.${row.key}`)}</span>
}

/** A setting's value: a switch in words, riyals to three decimals, a figure isolated, a missing value as a dash. */
export function SettingValue({ row, value }: { row: DiffRow; value: unknown }) {
  const { t } = useTranslation(NS)
  if (value === undefined || value === null) return <span className="text-muted-foreground">{t('diff.notSet')}</span>
  if (typeof value === 'boolean') return <span>{t(value ? 'value.on' : 'value.off')}</span>
  if (typeof value === 'number') {
    if (row.kind === 'riyals') return <span>{t('value.riyals', { amount: fsi(formatMoney3(value)) })}</span>
    if (row.kind === 'percent') return <Ltr>{`${value.toFixed(2)}%`}</Ltr>
    return <Ltr>{String(value)}</Ltr>
  }
  return <Ltr>{typeof value === 'string' ? value : JSON.stringify(value)}</Ltr>
}

export function PromiseTable({ rows }: { rows: readonly MarkingPromiseRow[] }) {
  const { t } = useTranslation(NS)
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-xs" data-promise-table="">
        <thead className="text-muted-foreground">
          <tr>
            <th className={TH}>{t('promise.mode')}</th>
            <th className={`${TH} text-end`}>{t('promise.deliveries')}</th>
            <th className={`${TH} text-end`}>{t('promise.newVersion')}</th>
            <th className={`${TH} text-end`}>{t('promise.candidate')}</th>
            <th className={TH}>{t('promise.band')}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={`${p.mode}-${p.channelGroup ?? ''}`} data-promise-row={`${p.mode}${p.channelGroup ? `-${p.channelGroup}` : ''}`}>
              <td className={TD}>
                {t(`mode.${p.mode}`)}
                {p.channelGroup && <span className="text-muted-foreground"> {t(`group.${p.channelGroup}`)}</span>}
              </td>
              <td className={`${TD} text-end`}>
                <Ltr>{count(p.count)}</Ltr>
              </td>
              <td className={`${TD} text-end font-semibold`}>
                <Pct n={p.percent} />
              </td>
              <td className={`${TD} text-end`}>
                <Pct n={p.candidatePercent} />
              </td>
              <td className={`${TD} whitespace-normal`}>
                {p.band ? (
                  <Ltr>{`${formatRange(p.band.from, p.band.to)}%`}</Ltr>
                ) : p.targetMinutes ? (
                  <span>{t('promise.target', { minutes: fsi(p.targetMinutes) })}</span>
                ) : (
                  <span className="text-muted-foreground">{t('promise.noBand')}</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/** Orders refused by reason, and the changed plans by kind: a label and its count. */
export function CountList({ rows }: { rows: { label: string; count: number; key: string }[] }) {
  return (
    <ul className="mt-2 flex flex-col gap-0.5 text-xs">
      {rows.map((r) => (
        <li key={r.key} className="flex justify-between gap-2" data-count-row={r.key}>
          <span>{r.label}</span>
          <Ltr>{count(r.count)}</Ltr>
        </li>
      ))}
    </ul>
  )
}
