import { useEffect, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { ArrowDown, ArrowUp, Equal, Plus, Trash2 } from 'lucide-react'
import type { CampaignRule, RuleNamedValue } from '@/core/models/rule-campaign'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import { fsi } from '@/core/util/bidi'
import CheckNotes from './CheckNotes'
import { BLOCK_KEY, keyOf } from './block-keys'
import { NO_BLOCK_CHECKS } from './checks'
import { FORMULA_GUIDE } from '@/core/rules/formula-guide'
import FormulaBox from './FormulaBox'
import type { Builder } from './RuleCard'
import { addValue, deleteValue, moveValue, newValue, nextValueName, renameValue, setValueExpr, valueNameProblem, valueUses } from './value-edit'
import Input from '@/core/ui/Input'
import IconButton from '@/core/ui/IconButton'

/**
 * A rule's named values (ticket 507): each a name, "=", and its formula, written only through the
 * guided ƒx helper (its text read into the stored expression). A value reads only the values above
 * it, so they move up and down. Schema 1 reads a value by name (`"$name"`), so a rename rewrites
 * every reading of it in the rule — and only a name with no problem is taken, so the readers never
 * pass through an empty, a reserved or another value's name; a value something reads cannot be
 * deleted. Every change is a step of the builder's history (typing into one box is one).
 */
export default function RuleValues({ rule, b }: { rule: CampaignRule; b: Builder }) {
  const { t } = useTranslation('campaign-workspace')
  const count = rule.values.length

  const add = () => {
    const v = { ...newValue(nextValueName(rule, t('values.defaultName'))), [BLOCK_KEY]: b.newKey() } as RuleNamedValue
    b.edit((rs) => addValue(rs, rule.id, v))
  }

  return (
    <div className="flex flex-col gap-2">
      {count ? (
        <ul className="flex flex-col gap-3">
          {rule.values.map((v, i) => {
            const k = keyOf(v)
            const uses = valueUses(rule, k, b.catalogue)
            const notes = (b.checks.blocks.get(k) ?? NO_BLOCK_CHECKS).all
            return (
              <li key={k} className="flex flex-col gap-1 rounded-md border border-border/60 p-2" data-value-id={k} data-value-index={i}>
                <div className="flex flex-wrap items-start gap-2">
                  <ValueName rule={rule} value={v} b={b} />
                  <Equal className="mt-2 h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
                  <div className="min-w-64 flex-1">
                    <FormulaBox
                      id={`value-formula-${k}`}
                      value={v.expr ?? null}
                      onChange={(expr, typed) => b.edit((rs) => setValueExpr(rs, rule.id, k, expr), typed ? `value:${k}.expr` : undefined)}
                      expect="number"
                      rule={rule}
                      valueKey={k}
                      issues={notes.filter((m) => m.path.endsWith('.expr'))}
                      guide={FORMULA_GUIDE}
                      label={t('values.formula', { name: fsi(v.name) })}
                      data={k}
                    />
                  </div>
                  <span className="flex shrink-0 items-center gap-0.5">
                    <IconButton size="compact" label={t('values.moveUp')} disabled={i === 0} onClick={() => b.edit((rs) => moveValue(rs, rule.id, k, -1))} data-value-up="">
                      <ArrowUp className="h-3.5 w-3.5" aria-hidden />
                    </IconButton>
                    <IconButton
                      size="compact"
                      label={t('values.moveDown')}
                      disabled={i === count - 1}
                      onClick={() => b.edit((rs) => moveValue(rs, rule.id, k, 1))}
                      data-value-down=""
                    >
                      <ArrowDown className="h-3.5 w-3.5" aria-hidden />
                    </IconButton>
                    <IconButton
                      variant="danger"
                      size="compact"
                      label={t('values.delete')}
                      title={uses > 0 ? t('values.inUse', { count: uses, n: fsi(uses) }) : undefined}
                      disabled={uses > 0}
                      onClick={() => b.edit((rs) => deleteValue(rs, rule.id, k, b.catalogue))}
                      data-value-delete=""
                    >
                      <Trash2 className="h-3.5 w-3.5" aria-hidden />
                    </IconButton>
                  </span>
                </div>
                {uses > 0 && (
                  <p className="text-xs text-muted-foreground" data-value-uses={uses}>
                    <Trans t={t} i18nKey="values.usedBy" count={uses} components={{ n: <Ltr /> }} />
                  </p>
                )}
                <CheckNotes messages={notes.filter((m) => !m.path.endsWith('.expr'))} data="value" />
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

/**
 * A value's name, as typed. The rename (and every `"$name"` with it) is taken only while the text
 * has no problem; a problem is said under the box, and leaving the box goes back to the name the
 * value has.
 */
function ValueName({ rule, value: v, b }: { rule: CampaignRule; value: RuleNamedValue; b: Builder }) {
  const { t } = useTranslation('campaign-workspace')
  const k = keyOf(v)
  const [typed, setTyped] = useState<string | null>(null)
  const text = typed ?? v.name
  const problem = valueNameProblem(rule, text, k, FORMULA_GUIDE.fields)
  // An Undo or a Redo renames the value under the box: show the name it now has.
  useEffect(() => setTyped((cur) => (cur !== null && cur.trim() !== v.name && valueNameProblem(rule, cur, k, FORMULA_GUIDE.fields) === null ? null : cur)), [v.name]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="flex flex-col gap-0.5">
      <Input
        id={`value-name-${k}`}
        dir="ltr"
        spellCheck={false}
        className="w-36 font-mono font-semibold"
        value={text}
        aria-label={t('values.name')}
        aria-invalid={problem !== null || undefined}
        onChange={(e) => {
          const next = e.target.value
          setTyped(next)
          if (valueNameProblem(rule, next, k, FORMULA_GUIDE.fields) === null) b.edit((rs) => renameValue(rs, rule.id, k, next.trim()), `value:${k}.name`)
        }}
        onBlur={() => setTyped(null)}
        data-value-name=""
      />
      {problem && (
        <span className="text-xs font-medium text-danger-800" data-value-name-problem={problem}>
          {t(`values.nameProblem.${problem}`)}
        </span>
      )}
    </div>
  )
}
