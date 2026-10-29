import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { CampaignRule } from '@/core/models/rule-campaign'
import type { RuleFormulaExpect, RuleFormulaGuide } from '@/core/rules/formula-guide'
import CoreFxHelper, { type FxEntry, type FxRecipeRow } from '@/core/rules/fx-helper/FxHelper'
import type { Chip } from '@/core/rules/fx-helper/insert'
import { fsi } from '@/core/util/bidi'
import { fxFields, recipeFormula, recipeNeedsCurrent, recipeNeedsFilter } from './fx'
import Select from '@/core/ui/Select'

/**
 * The guided ƒx helper (ticket 507) of a promotion rule's formula box: core's helper
 * (`@/core/rules/fx-helper`, oms 657) given this rule's filters and the values above the one being
 * written, then what a rule may read, and the recipes with the rule's filter in them. Everything a
 * click inserts comes from the client's guide; the words are the `campaign-workspace` bundle's.
 */
export default function FxHelper({
  guide,
  rule,
  valueKey,
  expect,
  current,
  onInsert,
  onUse,
  onDone,
}: {
  guide: RuleFormulaGuide
  rule: CampaignRule
  valueKey: string | null
  expect: RuleFormulaExpect
  /** The box's formula as written — a cap recipe wraps it. */
  current: string
  /** Puts a chip where the cursor was. */
  onInsert: (chip: Chip) => void
  /** Writes a recipe's formula in place of the box's. */
  onUse: (formula: string) => void
  onDone: () => void
}) {
  const { t } = useTranslation('campaign-workspace')
  const [filterId, setFilterId] = useState(rule.filters[0]?.id ?? '')
  const filter = rule.filters.find((f) => f.id === filterId) ?? rule.filters[0]

  const fields = fxFields(guide, rule, valueKey).map(
    (f): FxEntry =>
      f.kind === 'field'
        ? { key: f.key, group: f.group, type: f.type, insert: { text: f.insert }, code: f.insert, words: f.insert }
        : { key: f.key, group: f.group, type: f.type, insert: { text: f.insert }, code: f.insert, label: t(`fx.kind.${f.kind}`, { name: fsi(f.insert) }), desc: t(`fx.kindHint.${f.kind}`) },
  )
  const name = filter ? fsi(filter.name) : ''
  const recipes = guide.recipes
    .filter((r) => r.expect === expect)
    .map((r): FxRecipeRow => {
      const blocked = recipeNeedsFilter(r) && !filter ? 'filter' : recipeNeedsCurrent(r) && !current.trim() ? 'current' : null
      return {
        key: r.key,
        formula: recipeFormula(r, filter?.name ?? '', current),
        blocked: blocked === 'filter' ? 'recipeNeedsFilter' : blocked === 'current' ? 'recipeNeedsCurrent' : null,
        hideDesc: blocked === 'filter',
        descValues: { filter: name },
      }
    })

  return (
    <CoreFxHelper
      ns="campaign-workspace"
      fields={fields}
      functions={guide.functions}
      operators={guide.operators}
      recipes={recipes}
      recipesHeader={
        rule.filters.length > 0 && (
          <label className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            {t('fx.recipeFilter')}
            <Select value={filter?.id ?? ''} onChange={(e) => setFilterId(e.target.value)} data-fx-recipe-filter="">
              {rule.filters.map((f) => (
                <option key={f.id} value={f.id}>
                  {fsi(f.name)}
                </option>
              ))}
            </Select>
          </label>
        )
      }
      onInsert={onInsert}
      onUse={onUse}
      onDone={onDone}
    />
  )
}
