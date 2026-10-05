import { useTranslation } from 'react-i18next'
import { INPUT } from './fields'
import type { EngineRules } from './editor'

/**
 * The Engine Rules tab (owner's verdict on 2335, option 1): the fields the engine reads and SAP's
 * screen lacks. Empty means no restriction. Max value is shown and held at 0: the validator refuses
 * it above 0 until track B's engine bump (B-03). `AllowNestedStacking` is never exposed.
 */
type ListKey = 'includes' | 'excludes' | 'originFilter' | 'stackingExcludes' | 'loyGroups' | 'loyTiers'
const LISTS: ListKey[] = ['includes', 'excludes', 'originFilter', 'stackingExcludes', 'loyGroups', 'loyTiers']
/** The column widths the validator refuses past (spec 2374: `OriginFilter` 50, the others 500). */
const LIST_MAX: Record<ListKey, number> = {
  includes: 500,
  excludes: 500,
  originFilter: 50,
  stackingExcludes: 500,
  loyGroups: 500,
  loyTiers: 500,
}

export default function EngineRulesTab({ engine, onChange }: { engine: EngineRules; onChange: (e: EngineRules) => void }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const set = (patch: Partial<EngineRules>) => onChange({ ...engine, ...patch })
  const label = 'flex flex-col gap-1 text-xs font-medium text-muted-foreground'

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t('engine.hint')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {LISTS.map((k) => (
          <label key={k} className={label}>
            {t(`engine.${k}`)}
            <input
              dir="ltr"
              className={`${INPUT} w-full font-mono`}
              value={engine[k]}
              maxLength={LIST_MAX[k]}
              onChange={(e) => set({ [k]: e.target.value } as Partial<EngineRules>)}
            />
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
