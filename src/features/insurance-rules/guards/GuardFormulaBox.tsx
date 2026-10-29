import { useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Check, X } from 'lucide-react'
import {
  GUARD_FX_FIELDS,
  GUARD_FX_FUNCTIONS,
  GUARD_FX_OPERATORS,
  GUARD_FX_RECIPES,
  guardFieldChip,
} from '@/core/insurance-rules/guard-formula-guide'
import { parseExpr } from '@/core/rules/expr'
import FxHelper, { type FxEntry, type FxRecipeRow } from '@/core/rules/fx-helper/FxHelper'
import FxToggle from '@/core/rules/fx-helper/FxToggle'
import { useCaretInsert } from '@/core/rules/fx-helper/useCaretInsert'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'

const FIELDS: FxEntry[] = GUARD_FX_FIELDS.map((f) => ({ key: f.path, group: f.group, type: f.type, insert: guardFieldChip(f), code: f.path, words: f.words }))
const RECIPES: FxRecipeRow[] = GUARD_FX_RECIPES.map((r) => ({ key: r.key, formula: r.formula, blocked: null }))

/**
 * A guard's formula block (oms 657): the text box, the ƒx button that opens core's guided helper under it —
 * the paths a guard formula reads, its functions, guard recipes and the operator chips, each put in where
 * the cursor was — and a line saying whether the text reads (`@/core/rules/expr`). The block keeps the
 * TEXT; the wire codec (`guard-wire`) turns it into the engine's `expr` and HQ's Validate type-checks it.
 */
export default function GuardFormulaBox({ value, invalid, onValue }: { value: string; invalid: boolean; onValue: (s: string, typed: boolean) => void }) {
  const { t } = useTranslation('insurance-guards')
  const [open, setOpen] = useState(false)
  const { input, remember, track, insert } = useCaretInsert(value, (next) => onValue(next, false))
  const read = value.trim() ? parseExpr(value, { filters: [] }) : null
  return (
    <div className="flex w-full min-w-0 flex-col gap-1" data-fx-box="guard">
      <div className="flex items-center gap-1.5">
        <Input
          ref={input}
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
          className="w-96 font-mono"
          value={value}
          title={t('editor.formulaHint')}
          placeholder={t('fx.placeholder')}
          aria-invalid={invalid || (read !== null && !read.ok) || undefined}
          onChange={(e) => {
            onValue(e.target.value, true)
            track(e)
          }}
          onSelect={remember}
          onKeyUp={remember}
          onClick={remember}
          onBlur={remember}
          data-input="formula"
          data-fx-input=""
        />
        <FxToggle ns="insurance-guards" open={open} onToggle={() => setOpen((o) => !o)} onMouseDown={remember} />
      </div>
      <div aria-live="polite">
        {read === null ? (
          <p className="text-xs text-muted-foreground" data-fx-status="empty">
            {t('fx.empty')}
          </p>
        ) : !read.ok ? (
          <p className="flex items-start gap-1 text-xs font-medium text-danger-800" data-fx-status="bad">
            <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <span data-fx-error={read.problem.code}>
              <Trans t={t} i18nKey={`fx.problem.${read.problem.code}`} values={{ at: read.problem.at + 1 }} components={{ n: <Ltr /> }} />
            </span>
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-success-800" data-fx-status="ok">
            <Check className="h-3 w-3 shrink-0" aria-hidden />
            {t('fx.reads')}
          </p>
        )}
      </div>
      {open && (
        <FxHelper
          ns="insurance-guards"
          fields={FIELDS}
          functions={GUARD_FX_FUNCTIONS}
          operators={GUARD_FX_OPERATORS}
          recipes={RECIPES}
          onInsert={insert}
          onUse={(formula) => insert({ text: formula }, true)}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  )
}
