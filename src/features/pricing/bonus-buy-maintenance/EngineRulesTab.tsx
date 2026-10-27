import { useTranslation } from 'react-i18next'
import { formatCount, fsi } from '@/core/util/bidi'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Textarea from '@/core/ui/Textarea'
import LoyGroupPicker from '@/core/loy-groups/LoyGroupPicker'
import { RefusalList } from './ActReport'
import { ENGINE_LISTS, type EngineListKey, type EngineRules, engineListMeter, type LoyGroupFindings } from './editor'

/**
 * The Engine Rules tab (owner's verdict on 2335, option 1): the fields the engine reads and SAP's
 * screen lacks. Empty means no restriction. Max value caps a % discount each time it applies, 0 is
 * no cap; the engine copies the capped rate per application since SIS.Pricing.Core 26.4.47 (B-03),
 * so the validator takes any cap of 0 or more. `AllowNestedStacking` is never exposed.
 *
 * The six lists are multi-line paste boxes (ticket 420, spec 2396 stories 35-37): a pasted Excel
 * column keeps its newlines, and each box shows how many codes it holds and its stored length
 * against the cap, both read from the list as the server stores it. No `maxLength`: a browser cap
 * would silently cut a pasted column, which is the loss this box exists to stop.
 */
export default function EngineRulesTab({
  engine,
  onChange,
  loyFindings = NO_FINDINGS,
}: {
  engine: EngineRules
  onChange: (e: EngineRules) => void
  /** The last Check or Save's loyalty-group refusals and warnings (636), listed under that field. */
  loyFindings?: LoyGroupFindings
}) {
  const { t } = useTranslation('bonus-buy-maintenance')
  const set = (patch: Partial<EngineRules>) => onChange({ ...engine, ...patch })

  return (
    <div className="flex flex-col gap-3">
      <p className="text-xs text-muted-foreground">{t('engine.hint')}</p>
      <p className="text-xs text-muted-foreground">{t('engine.listHint')}</p>
      <div className="grid gap-3 md:grid-cols-2">
        {ENGINE_LISTS.map((k) =>
          k === 'loyGroups' ? (
            <div key={k} className="flex min-w-0 flex-col gap-1" data-testid="bby-engine-loyGroups-field">
              <Field
                label={t('engine.loyGroups')}
                hint={<ListMeter list={k} value={engine.loyGroups} />}
                invalid={loyFindings.refusals.length > 0}
              >
                <LoyGroupPicker
                  label={t('engine.loyGroups')}
                  value={engine.loyGroups}
                  data-testid="bby-engine-loyGroups"
                  onChange={(loyGroups) => set({ loyGroups })}
                />
              </Field>
              <p className="text-[11px] leading-snug text-muted-foreground">{t('engine.loyGroupsHint')}</p>
              <LoyFindings findings={loyFindings} />
            </div>
          ) : (
          <Field key={k} label={t(`engine.${k}`)} hint={<ListMeter list={k} value={engine[k]} />}>
            <Textarea
              dir="ltr"
              rows={3}
              className="w-full resize-y font-mono"
              value={engine[k]}
              data-testid={`bby-engine-${k}`}
              onChange={(e) => set({ [k]: e.target.value } as Partial<EngineRules>)}
            />
          </Field>
          ),
        )}
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <label className="flex h-7 items-center gap-2 text-sm">
          <input type="checkbox" checked={engine.isStackable} onChange={(e) => set({ isStackable: e.target.checked })} />
          {t('engine.isStackable')}
        </label>
        <Field label={t('engine.score')}>
          <Input
            type="number"
            min={0}
            step={1}
            className="w-28 text-end"
            value={engine.score}
            onChange={(e) => set({ score: e.target.value })}
          />
        </Field>
        <Field label={t('engine.maxValue')} hint={t('engine.maxValueHint')}>
          <Input
            type="number"
            min={0}
            step={0.001}
            className="w-28 text-end"
            value={engine.maxValue}
            data-testid="bby-engine-maxValue"
            onChange={(e) => set({ maxValue: e.target.value })}
          />
        </Field>
      </div>
      <div className="flex flex-wrap items-end gap-4">
        <Field label={t('engine.timeFrom')}>
          <Input
            type="time"
            step={1}
            className="w-36"
            value={engine.validFromTime}
            onChange={(e) => set({ validFromTime: e.target.value })}
          />
        </Field>
        <Field label={t('engine.timeTo')}>
          <Input
            type="time"
            step={1}
            className="w-36"
            value={engine.validToTime}
            onChange={(e) => set({ validToTime: e.target.value })}
          />
        </Field>
        <p className="pb-2 text-xs text-muted-foreground">{t('engine.timeHint')}</p>
      </div>
    </div>
  )
}

const NO_FINDINGS: LoyGroupFindings = { refusals: [], warnings: [] }

/** The Loyalty groups field's own findings (BackOffice 3179): the refusal in the danger tone, the warning beside it. */
function LoyFindings({ findings }: { findings: LoyGroupFindings }) {
  const { t } = useTranslation('bonus-buy-maintenance')
  if (findings.refusals.length === 0 && findings.warnings.length === 0) return null
  return (
    <div className="flex flex-col gap-1" data-testid="bby-engine-loyGroups-findings">
      {findings.refusals.length > 0 && (
        <div className="rounded-md border border-danger-border bg-danger-050 px-2 py-1 text-danger-800" data-finding="refused">
          <span className="text-[11px] font-medium">{t('engine.loyFindings.refused')}</span>
          <RefusalList refusals={findings.refusals} />
        </div>
      )}
      {findings.warnings.length > 0 && (
        <div className="rounded-md border border-border/60 bg-muted px-2 py-1" data-finding="warned">
          <span className="text-[11px] font-medium">{t('engine.loyFindings.warned')}</span>
          <RefusalList refusals={findings.warnings} />
        </div>
      )}
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
