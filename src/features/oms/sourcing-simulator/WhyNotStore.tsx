import { useMemo, useState } from 'react'
import type { AdvisePlan, AdviseReply } from '@/core/models/sourcing-run'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Select from '@/core/ui/Select'
import { formatPair, fsi } from '@/core/util/bidi'
import { usePlanWords } from './use-plan-words'
import { whyNotAnswer, whyNotStores, type WhyNotLine } from './why-not-model'

/**
 * "Why not another store?" (ticket 965, spec 4354 story 28): pick a store and get, per mode, the rule that removed it,
 * or the best plan that uses it — its balanced total beside this plan's and what it costs more, part by part. Read off
 * the full-level reply on screen (its `search.whyNot` and `filterSteps`, BackOffice 4379): the server answers every
 * pair's "why not" in the record and has no door of its own for it.
 */
export default function WhyNotStore({ reply, plan }: { reply: AdviseReply; plan: AdvisePlan }) {
  const w = usePlanWords()
  const { t } = w
  const [store, setStore] = useState('')
  const stores = whyNotStores(reply)
  const lines = useMemo(() => (store ? whyNotAnswer(reply, store, plan) : null), [reply, store, plan])
  return (
    <div className="flex flex-col gap-2 text-xs" data-why-not="">
      <Field label={t('why.whyNot.store')} className="w-72">
        <Select value={store} onChange={(e) => setStore(e.target.value)} data-why-not-store="">
          <option value="">{t('why.whyNot.choose')}</option>
          {stores.map((s) => (
            <option key={s.store} value={s.store}>
              {fsi(s.name ? formatPair(s.store, s.name) : s.store)}
            </option>
          ))}
        </Select>
      </Field>
      {store !== '' && !reply.search && <p className="text-muted-foreground" data-why-not-not-full="">{t('why.whyNot.notFull')}</p>}
      {lines && (
        <ul className="flex flex-col gap-1.5" data-why-not-answer={store}>
          {lines.length === 0 && <li className="text-muted-foreground">{t('why.whyNot.nothing')}</li>}
          {lines.map((l) => (
            <WhyNotItem key={l.mode} line={l} />
          ))}
        </ul>
      )}
    </div>
  )
}

function WhyNotItem({ line }: { line: WhyNotLine }) {
  const w = usePlanWords()
  const { t } = w
  return (
    <li className="flex flex-col gap-0.5 rounded-md border border-border/70 px-3 py-2" data-why-not-mode={line.mode} data-why-not-kind={line.kind}>
      <span className="font-semibold">{w.mode(line.mode)}</span>
      {line.kind === 'inPlan' && <span>{t('why.whyNot.inPlan')}</span>}
      {line.kind === 'noPlan' && (
        <span data-why-not-code={line.code}>{t(`why.whyNot.noPlan.${line.code}`, { defaultValue: t('why.whyNot.noPlan.unknown') })}</span>
      )}
      {line.kind === 'removed' && (
        <span className="flex flex-wrap gap-1.5" data-why-not-code={line.code}>
          <span className="text-muted-foreground">{line.step === null ? t('why.whyNot.removed') : t('why.whyNot.removedAt', { step: fsi(line.step) })}</span>
          <span>{t(`why.filter.${line.code}`, { defaultValue: t('why.filter.unknown') })}</span>
          <code className="font-mono text-[11px] text-muted-foreground">
            <Ltr>{line.code}</Ltr>
          </code>
        </span>
      )}
      {line.kind === 'standing' && (
        <>
          <span className="flex flex-wrap gap-1.5" data-why-not-sums="">
            <span>{t('why.whyNot.bestThrough')}</span>
            <span className="font-semibold tabular-nums">
              <Ltr>{w.money(line.sum)}</Ltr>
            </span>
            <span>{t('why.whyNot.against')}</span>
            <span className="tabular-nums">
              <Ltr>{w.money(line.planSum)}</Ltr>
            </span>
            {line.lostBy !== null && (
              <span className="text-muted-foreground" data-why-not-lost-by="">
                {t('why.whyNot.lostBy', { amount: w.money(line.lostBy) })}
              </span>
            )}
          </span>
          {line.difference.length > 0 && (
            <ul className="flex flex-col gap-0.5">
              {line.difference.map((d) => (
                <li key={d.part} className="flex flex-wrap gap-1.5" data-why-not-part={d.part}>
                  <span className="text-muted-foreground">{t(`why.part.${d.part}`, { defaultValue: d.part })}</span>
                  <span className="tabular-nums">{t(d.amount < 0 ? 'why.whyNot.less' : 'why.whyNot.more', { amount: w.money(Math.abs(d.amount)) })}</span>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </li>
  )
}
