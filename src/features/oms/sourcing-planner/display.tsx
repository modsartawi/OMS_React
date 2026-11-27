/**
 * How a planner value reads (ticket 968): one string per value, so a grid cell, a native option and JSX all take it.
 * JSX callers isolate it (`Ltr` for a code-led value, `<bdi>` for free text — the bidi rule); a grid cell is isolated
 * by the base column definition. Codes read as codes: no planner door names a store, an item or a category.
 */
import { useCallback } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatRange } from '@/core/util/bidi'
import { TABLES } from './tables'
import type { PlannerChange, PlannerChangeAction, PlannerRow, PlannerTableKey, PlannerValue } from './wire'

export const NS = 'sourcing-planner'

export type Format = (table: PlannerTableKey, field: string, value: PlannerValue) => string

/** The one formatter: a switch in words, a code's option label, a list of codes joined, a figure as sent. */
export function useFormat(): Format {
  const { t } = useTranslation(NS)
  return useCallback<Format>((table, field, value) => format(t, table, field, value), [t])
}

function format(t: (k: string) => string, table: PlannerTableKey, field: string, value: PlannerValue): string {
  if (value == null || value === '') return ''
  const f = TABLES[table].fields.find((x) => x.key === field)
  if (!f) return String(value)
  switch (f.kind) {
    case 'bool':
      return value ? t('yes') : t('no')
    case 'select':
      return t(`opt.${f.optSet}.${String(value)}`)
    case 'codeList':
      return Array.isArray(value) ? (value as readonly string[]).join(', ') : String(value)
    case 'number':
      return table === 'confidence' || (table === 'contracts' && field === 'rate') ? Number(value).toFixed(2) : String(value)
    default:
      return String(value)
  }
}

/** A row's name, as words around isolated values. */
export function RowLabel({ row, table }: { row: PlannerRow; table: PlannerTableKey }) {
  const { t } = useTranslation(NS)
  const fmt = useFormat()
  const v = row.values
  const val = (field: string) => fmt(table, field, v[field] ?? null)
  switch (table) {
    case 'overrides':
      return (
        <Trans
          t={t}
          i18nKey={`label.overrides.${String(v.level)}`}
          values={{ store: val('store'), item: val('item'), category: val('category') }}
          components={{ v: <Ltr /> }}
        />
      )
    case 'confidence':
      return <Ltr>{val('store')}</Ltr>
    case 'restricted':
      return <Ltr>{val('code')}</Ltr>
    case 'bulky':
      return <Trans t={t} i18nKey="label.bulky" values={{ kind: val('kind'), code: val('code') }} components={{ v: <Ltr /> }} />
    case 'rules':
      return v.value ? (
        <Trans t={t} i18nKey="label.rules" values={{ group: val('group'), value: val('value'), mode: val('mode') || t('label.anyMode') }} components={{ v: <bdi /> }} />
      ) : (
        <Trans t={t} i18nKey="label.rulesNoValue" values={{ group: val('group'), mode: val('mode') || t('label.anyMode') }} />
      )
    case 'storeModes':
      return <Trans t={t} i18nKey="label.storeModes" values={{ store: val('store'), mode: val('mode') }} components={{ v: <Ltr /> }} />
    case 'contracts':
      return <Trans t={t} i18nKey="label.contracts" values={{ contract: val('contract'), mode: val('mode') }} components={{ v: <Ltr /> }} />
    case 'slots':
      return v.kind === 'SLOT' ? (
        <Trans t={t} i18nKey="label.slots" values={{ slot: formatRange(String(v.from ?? ''), String(v.to ?? '')) }} components={{ v: <Ltr /> }} />
      ) : (
        <Trans t={t} i18nKey="label.nextDayAfter" values={{ from: String(v.from ?? '') }} components={{ v: <Ltr /> }} />
      )
  }
}

const ACTION_SEV: Record<PlannerChangeAction, Severity> = { ADD: 'go', CHANGE: 'go', END: 'mute', SWITCH_ON: 'ok', SWITCH_OFF: 'warn' }

/** One change: what was done, who, when, each field's old and new value, and the reason where one is kept. */
export function ChangeCard({ table, change }: { table: PlannerTableKey; change: PlannerChange }) {
  const { t } = useTranslation(NS)
  const fmt = useFormat()
  const label = (field: string) => t(`fields.${table}.${field}`)
  return (
    <article className="flex flex-col gap-1 rounded-md border border-border/60 bg-card p-2.5 text-xs" data-change={change.id} data-change-action={change.action}>
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <StatusBadge sev={ACTION_SEV[change.action] ?? 'mute'}>{t(`action.${change.action}`)}</StatusBadge>
        <span className="ms-auto flex items-baseline gap-2 text-muted-foreground">
          <Ltr>{change.at}</Ltr>
          <span data-change-by="">{change.by ? <Ltr>{change.by}</Ltr> : t('seed')}</span>
        </span>
      </header>
      {change.diffs.length > 0 && (
        <ul className="flex flex-col gap-0.5">
          {change.diffs.map((d) => (
            <li key={d.field} data-diff={d.field}>
              {d.old == null || d.old === '' ? (
                <Trans
                  t={t}
                  i18nKey="diff.set"
                  values={{ field: label(d.field), new: fmt(table, d.field, d.new) || t('blank') }}
                  components={{ v: <bdi className="font-medium" /> }}
                />
              ) : (
                <Trans
                  t={t}
                  i18nKey="diff.line"
                  values={{ field: label(d.field), old: fmt(table, d.field, d.old) || t('blank'), new: fmt(table, d.field, d.new) || t('blank') }}
                  components={{ o: <bdi className="text-muted-foreground line-through" />, v: <bdi className="font-medium" /> }}
                />
              )}
            </li>
          ))}
        </ul>
      )}
      {change.reason ? (
        <p data-change-reason="">
          <span className="text-muted-foreground">{t('reason.short')} </span>
          <bdi>{change.reason}</bdi>
        </p>
      ) : (
        !TABLES[table].reasonKept && <p className="text-muted-foreground">{t('reason.notKept')}</p>
      )}
    </article>
  )
}
