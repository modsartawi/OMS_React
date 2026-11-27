/**
 * How a planner value reads (ticket 968): one string per value, so a grid cell, a native option and JSX all take it.
 * JSX callers isolate it (`Ltr` for a code-led value, `<bdi>` for free text — the bidi rule); a grid cell is isolated
 * by the base column definition.
 */
import { useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'

import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatPair, formatRange } from '@/core/util/bidi'
import type { PlannerChange, PlannerChangeAction, PlannerChoicesReply, PlannerCodeName, PlannerRow, PlannerTableKey, PlannerValue } from '@/core/models/sourcing-planner'
import { plannerKeys, sourcingPlannerApi } from './api'
import { TABLES } from './tables'

export const NS = 'sourcing-planner'

/** The forms' choices (stores, categories, sub-categories), read once and kept. */
export function useChoices() {
  return useQuery({ queryKey: plannerKeys.choices, queryFn: () => sourcingPlannerApi.choices(), staleTime: 5 * 60_000 })
}

const nameIn = (list: readonly PlannerCodeName[] | undefined, code: string) => list?.find((x) => x.code === code)?.name

export type Format = (table: PlannerTableKey, field: string, value: PlannerValue, row?: PlannerRow | null) => string

/** The one formatter: codes read with their names (the row's own `names` first, then the choices), codes alone else. */
export function useFormat(): Format {
  const { t } = useTranslation(NS)
  const choices = useChoices().data
  return useCallback<Format>((table, field, value, row) => format(t, choices, table, field, value, row), [t, choices])
}

function format(
  t: (k: string) => string,
  choices: PlannerChoicesReply | undefined,
  table: PlannerTableKey,
  field: string,
  value: PlannerValue,
  row?: PlannerRow | null,
): string {
  if (value == null || value === '') return ''
  const f = TABLES[table].fields.find((x) => x.key === field)
  if (!f) return String(value)
  const named = (list?: readonly PlannerCodeName[]) => {
    const code = String(value)
    const name = row?.names?.[field] ?? nameIn(list, code)
    return name ? formatPair(code, name) : code
  }
  switch (f.kind) {
    case 'bool':
      return value ? t('yes') : t('no')
    case 'select':
      return t(`opt.${f.optSet}.${String(value)}`)
    case 'store':
      return named(choices?.stores)
    case 'category':
      return named(choices?.categories)
    case 'item':
      return named()
    case 'listCode':
      return named(row?.values.kind === 'SUB_CATEGORY' ? choices?.subCategories : undefined)
    case 'storeList':
      return Array.isArray(value) ? (value as readonly string[]).join(', ') : String(value)
    case 'number':
      return table === 'confidence' ? Number(value).toFixed(2) : table === 'contracts' && field === 'rate' ? Number(value).toFixed(2) : String(value)
    default:
      if (table === 'rules' && field === 'group') return row?.names?.group ? formatPair(String(value), row.names.group) : String(value)
      return String(value)
  }
}

/** A row's name, as words around isolated values. */
export function RowLabel({ row, table }: { row: PlannerRow; table: PlannerTableKey }) {
  const { t } = useTranslation(NS)
  const fmt = useFormat()
  const v = row.values
  const val = (field: string) => fmt(table, field, v[field] ?? null, row)
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
    case 'storeModes':
      return <Ltr>{val('store')}</Ltr>
    case 'restricted':
      return <Ltr>{val('item')}</Ltr>
    case 'bulky':
      return <Ltr>{val('code')}</Ltr>
    case 'rules':
      return <Trans t={t} i18nKey="label.rules" values={{ group: val('group'), mode: val('mode') }} components={{ v: <bdi /> }} />
    case 'contracts':
      return <Trans t={t} i18nKey="label.contracts" values={{ courier: val('courier'), mode: val('mode') }} components={{ v: <Ltr /> }} />
    case 'slots':
      return (
        <Trans
          t={t}
          i18nKey="label.slots"
          values={{ slot: formatRange(String(v.from ?? ''), String(v.to ?? '')), day: val('day') }}
          components={{ v: <Ltr /> }}
        />
      )
  }
}

const ACTION_SEV: Record<PlannerChangeAction, Severity> = { ADD: 'go', CHANGE: 'go', END: 'mute', SWITCH_ON: 'ok', SWITCH_OFF: 'warn' }

/** One logged change: what was done, who, when, each field's old and new value, and the reason where one is kept. */
export function ChangeCard({ table, change, row }: { table: PlannerTableKey; change: PlannerChange; row?: PlannerRow | null }) {
  const { t } = useTranslation(NS)
  const fmt = useFormat()
  const label = (field: string) => t(`fields.${table}.${field}`)
  return (
    <article className="flex flex-col gap-1 rounded-md border border-border/60 bg-card p-2.5 text-xs" data-change={change.id} data-change-action={change.action}>
      <header className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
        <StatusBadge sev={ACTION_SEV[change.action] ?? 'mute'}>{t(`action.${change.action}`)}</StatusBadge>
        <span className="ms-auto flex items-baseline gap-2 text-muted-foreground">
          <Ltr>{change.at}</Ltr>
          <span data-change-by="">
            <Ltr>{change.by}</Ltr>
          </span>
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
                  values={{ field: label(d.field), new: fmt(table, d.field, d.new, row) || t('blank') }}
                  components={{ v: <bdi className="font-medium" /> }}
                />
              ) : (
                <Trans
                  t={t}
                  i18nKey="diff.line"
                  values={{ field: label(d.field), old: fmt(table, d.field, d.old, row) || t('blank'), new: fmt(table, d.field, d.new, row) || t('blank') }}
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
