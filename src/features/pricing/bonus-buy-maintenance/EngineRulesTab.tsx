import { useTranslation } from 'react-i18next'
import { formatCount, fsi } from '@/core/util/bidi'
import { INPUT } from './fields'
import { ENGINE_LISTS, type EngineListKey, type EngineRules, engineListMeter } from './editor'

/**
 * The Engine Rules tab (owner's verdict on 2335, option 1): the fields the engine reads and SAP's
 * screen lacks. Empty means no restriction. Max value is shown and held at 0: the validator refuses
 * it above 0 until track B's engine bump (B-03). `AllowNestedStacking` is never exposed.
 *
 * The six lists are multi-line paste boxes (ticket 420, spec 2396 stories 35-37): a pasted Excel
 * column keeps its newlines, and each box shows how many codes it holds and its stored length
 * against the cap, both read from the list as the server stores it. No `maxLength`: a browser cap
 * would silently cut a pasted column, which is the loss this box exists to stop.
 */
const LIST_BOX =
  'w-full resize-y rounded-md border border-border/60 bg-background px-2.5 py-1.5 font-mono text-sm text-foreground ' +
  'focus:border-primary/50 focus:outline-none disabled:cursor-not-allowed disabled:opacity-50'

export default function EngineRulesTab({ engine, onChange }: { engine: EngineRules; onChange: (e: EngineRules) => void }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const set = (patch: Partial<EngineRules>) => onChange({ ...engine, ...patch })
  const label = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t('engine.hint')}</p>
      <p className="text-xs text-muted-foreground">{t('engine.listHint')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {ENGINE_LISTS.map((k) => (
          <label key={k} className={label}>
            {t(`engine.${k}`)}
            <textarea
              dir="ltr"
              rows={3}
              className={LIST_BOX}
              value={engine[k]}
              data-testid={`bby-engine-${k}`}
              onChange={(e) => set({ [k]: e.target.value } as Partial<EngineRules>)}
            />
            <ListMeter list={k} value={engine[k]} />
          </label>
        ))}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex h-8 items-center gap-2 text-sm">
          <input type="checkbox" checked={engine.isStackable} onChange={(e) => set({ isStackable: e.target.checked })} />
          {t('engine.isStackable')}
        </label>
        <label className={label}>
          {t('engine.score')}
          <input
            type="number"
            min={0}
            step={1}
            className={`${INPUT} w-28 text-end`}
            value={engine.score}
            onChange={(e) => set({ score: e.target.value })}
          />
        </label>
        <label className={label}>
          {t('engine.maxValue')}
          <input type="number" disabled className={`${INPUT} w-28 text-end`} value={engine.maxValue} readOnly />
          <span className="font-normal">{t('engine.maxValueUnavailable')}</span>
        </label>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className={label}>
          {t('engine.timeFrom')}
          <input
            type="time"
            step={1}
            className={`${INPUT} w-36`}
            value={engine.validFromTime}
            onChange={(e) => set({ validFromTime: e.target.value })}
          />
        </label>
        <label className={label}>
          {t('engine.timeTo')}
          <input
            type="time"
            step={1}
            className={`${INPUT} w-36`}
            value={engine.validToTime}
            onChange={(e) => set({ validToTime: e.target.value })}
          />
        </label>
        <p className="pb-2 text-xs text-muted-foreground">{t('engine.timeHint')}</p>
      </div>
    </div>
  )
}

/** How many codes the box holds and its stored length against the cap; past the cap in the danger tone. */
function ListMeter({ list, value }: { list: EngineListKey; value: string }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const m = engineListMeter(list, value)
  return (
    <span
      className={`flex flex-wrap gap-x-3 font-normal ${m.over ? 'text-danger' : ''}`}
      data-testid={`bby-engine-meter-${list}`}
      data-over={m.over}
    >
      <span>{t('engine.codeCount', { count: m.count, n: fsi(String(m.count)) })}</span>
      <span>{t('engine.length', { used: fsi(formatCount(m.length, m.max)) })}</span>
      {m.over && <span>{t('engine.overCap', { max: fsi(String(m.max)) })}</span>}
    </span>
  )
}
