import { Trans, useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Equal, Plus, Trash2 } from 'lucide-react'
import type { CampaignRule } from '@/core/models/rule-campaign'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import { INPUT } from './builder-ui'
import CheckNotes from './CheckNotes'
import { NO_BLOCK_CHECKS } from './checks'
import FormulaBox from './FormulaBox'
import type { Builder } from './RuleCard'
import { addValue, deleteValue, moveValue, newValue, nextValueName, pinValueRefs, updateValue, valueNameProblem, valueUses } from './value-edit'

/**
 * A rule's named values (ticket 507): each a name, "=", and its formula, written only through the
 * guided ƒx helper with HQ's check always on. A value reads only the values above it, so they move
 * up and down. An effect reads a value by id, so a rename reaches it; a value an effect reads
 * cannot be deleted. Every change is a step of the builder's history (typing into one box is one).
 */
export default function RuleValues({ rule, b }: { rule: CampaignRule; b: Builder }) {
  const { t } = useTranslation('campaign-workspace')
  const count = rule.values.length

  const add = () => {
    const v = newValue(b.newId(), nextValueName(rule, t('values.defaultName')))
    b.edit((rs) => addValue(rs, rule.id, v))
  }

  return (
    <div className="flex flex-col gap-2">
      {count ? (
        <ul className="flex flex-col gap-3">
          {rule.values.map((v, i) => {
            const uses = valueUses(rule, v.id, b.catalogue)
            const problem = valueNameProblem(rule, v.name, v.id)
            const nameId = `value-name-${v.id}`
            const btn = 'rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-foreground disabled:opacity-40 disabled:hover:bg-transparent'
            return (
              <li key={v.id} className="flex flex-col gap-1 rounded-md border border-border/60 p-2" data-value-id={v.id}>
                <div className="flex flex-wrap items-start gap-2">
                  <div className="flex flex-col gap-0.5">
                    <input
                      id={nameId}
                      dir="ltr"
                      spellCheck={false}
                      className={`${INPUT} w-36 font-mono font-semibold ${problem ? 'border-danger-border' : ''}`}
                      value={v.name}
                      aria-label={t('values.name')}
                      aria-invalid={problem !== null || undefined}
                      onChange={(e) => b.edit((rs) => updateValue(pinValueRefs(rs, rule.id, v.id, b.catalogue), rule.id, v.id, { name: e.target.value }), `value:${v.id}.name`)}
                      data-value-name=""
                    />
                    {problem && (
                      <span className="text-xs font-medium text-danger-800" data-value-name-problem={problem}>
                        {t(`values.nameProblem.${problem}`)}
                      </span>
                    )}
                  </div>
                  <Equal className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-64 flex-1">
                    <FormulaBox
                      id={`value-formula-${v.id}`}
                      value={v.formula}
                      onChange={(formula, typed) => b.edit((rs) => updateValue(rs, rule.id, v.id, { formula }), typed ? `value:${v.id}.formula` : undefined)}
                      expect="number"
                      rule={rule}
                      valueId={v.id}
                      campaign={b.campaign}
                      guide={b.catalogue.formula}
                      label={t('values.formula', { name: fsi(v.name) })}
                      data={v.id}
                    />
                  </div>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <button type="button" className={btn} aria-label={t('values.moveUp')} disabled={i === 0} onClick={() => b.edit((rs) => moveValue(rs, rule.id, v.id, -1))} data-value-up="">
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={btn}
                      aria-label={t('values.moveDown')}
                      disabled={i === count - 1}
                      onClick={() => b.edit((rs) => moveValue(rs, rule.id, v.id, 1))}
                      data-value-down=""
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </button>
                    <button
                      type="button"
                      className={`${btn} hover:text-danger-800`}
                      aria-label={t('values.delete')}
                      title={uses > 0 ? t('values.inUse', { count: uses, n: fsi(uses) }) : undefined}
                      disabled={uses > 0}
                      onClick={() => b.edit((rs) => deleteValue(rs, rule.id, v.id, b.catalogue))}
                      data-value-delete=""
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </button>
                  </span>
                </div>
                {uses > 0 && (
                  <p className="text-xs text-muted-foreground" data-value-uses={uses}>
                    <Trans t={t} i18nKey="values.usedBy" count={uses} components={{ n: <Ltr /> }} />
                  </p>
                )}
                <CheckNotes messages={(b.checks.blocks.get(v.id) ?? NO_BLOCK_CHECKS).all} data="value" />
              </li>
            )
          })}
        </ul>
      ) : (
        <p className="text-sm text-muted-foreground">{t('values.none')}</p>
      )}
      <span>
        <Button variant="outlined" onClick={add} data-value-add="">
          <Plus className="h-3.5 w-3.5" aria-hidden />
          {t('values.add')}
        </Button>
      </span>
    </div>
  )
}
