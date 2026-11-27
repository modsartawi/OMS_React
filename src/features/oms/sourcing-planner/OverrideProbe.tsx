/**
 * "Which override applies?" (ticket 968, spec 4354 §5): for a store, an item and the item's merchandise category, the
 * override the next run uses today — the most specific of the four levels in force — or none, when the computed buffer
 * stands. The category is asked because the screen holds no item master; without it no category row can match. Codes
 * are typed: no planner door names a store or a category.
 */
import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'

import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import { NS, RowLabel } from './display'
import { overrideThatApplies } from './override-form-model'
import type { PlannerRow } from './wire'

export default function OverrideProbe({ rows, today }: { rows: readonly PlannerRow[]; today: string }) {
  const { t } = useTranslation(NS)
  const [store, setStore] = useState('')
  const [item, setItem] = useState('')
  const [category, setCategory] = useState('')
  const asked = store.trim() !== '' || item.trim() !== '' || category.trim() !== ''
  const hit = asked ? overrideThatApplies(rows, { store: store.trim(), item: item.trim(), category: category.trim() }, today) : null

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-md border border-dashed border-border bg-card p-2.5" data-override-probe="">
      <span className="self-center text-xs font-semibold">{t('probe.title')}</span>
      <Field label={t('fields.overrides.store')} className="w-36">
        <Input value={store} dir="ltr" className="font-mono" onChange={(e) => setStore(e.target.value)} data-probe="store" />
      </Field>
      <Field label={t('fields.overrides.item')} className="w-36">
        <Input value={item} dir="ltr" className="font-mono" onChange={(e) => setItem(e.target.value)} data-probe="item" />
      </Field>
      <Field label={t('probe.category')} className="w-36">
        <Input value={category} dir="ltr" className="font-mono" onChange={(e) => setCategory(e.target.value)} data-probe="category" />
      </Field>
      <p className="min-w-72 flex-1 self-center text-xs" data-probe-result={!asked ? 'idle' : hit ? String(hit.values.level) : 'none'}>
        {!asked ? (
          t('probe.idle')
        ) : hit ? (
          <>
            <Trans t={t} i18nKey="probe.applies" values={{ level: t(`opt.level.${String(hit.values.level)}`) }} components={{ b: <b /> }} />{' '}
            <span className="font-medium" data-probe-row={hit.id}>
              <RowLabel row={hit} table="overrides" />
            </span>
          </>
        ) : (
          t('probe.none')
        )}
      </p>
    </div>
  )
}
