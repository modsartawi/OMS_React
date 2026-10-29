import { useEffect, useRef, useState } from 'react'
import { Trans, useTranslation } from 'react-i18next'
import { Check, TriangleAlert, X } from 'lucide-react'
import type { CampaignRule, RuleExpr, RuleIssue } from '@/core/models/rule-campaign'
import type { RuleFormulaExpect, RuleFormulaGuide } from '@/core/rules/formula-guide'
import Ltr from '@/core/ui/Ltr'
import { severityOf } from './checks'
import FxToggle from '@/core/rules/fx-helper/FxToggle'
import { useCaretInsert } from '@/core/rules/fx-helper/useCaretInsert'
import FxHelper from './FxHelper'
import { boxOf, readBox } from './fx'
import Input from '@/core/ui/Input'

export interface FormulaBoxProps {
  id: string
  /** The stored expression (schema 1's JSON); null when none is written. */
  value: RuleExpr
  /** `typed` is a keystroke — a run of them is ONE step of the history; an insert is a step of its own. */
  onChange: (expr: RuleExpr, typed: boolean) => void
  expect: RuleFormulaExpect
  rule: CampaignRule
  /** The named value being written (it reads only the values above it), by its builder key; null for the formula condition. */
  valueKey?: string | null
  /** HQ's issues at this expression's path — of the rules on screen once they settle (`Rules/Authoring/Validate`, 523), else of the saved draft — the validator (there is no per-formula door). */
  issues: RuleIssue[]
  guide: RuleFormulaGuide
  /** The input's accessible name, where no `<label>` points at it. */
  label?: string
  data: string
}

/**
 * A formula, written with the guided ƒx helper (ticket 507): the input, the ƒx button that opens
 * the helper — Fields, Functions, Recipes and operator chips, each put in where the cursor was — and
 * the validator line. The box holds TEXT (ticket 522): the codec (`@/core/rules/expr`) reads it
 * into the JSON expression HQ stores, and only text that reads is stored; until then the text stays
 * in the box with what is wrong and where. A stored expression the codec cannot print shows as its
 * JSON and is edited as JSON. HQ's issues at this expression's path (Validate's, ticket 523) show below.
 */
export default function FormulaBox({ id, value, onChange, expect, rule, valueKey = null, issues, guide, label, data }: FormulaBoxProps) {
  const { t } = useTranslation('campaign-workspace')
  const [open, setOpen] = useState(false)
  const stored = boxOf(value, rule)
  /** The text as typed, while it differs from what is stored (it may not read yet). */
  const [typed, setTyped] = useState<string | null>(null)
  const text = typed ?? stored.text
  const reading = readBox(text, stored.json, rule)
  const bad = !reading.ok

  // An Undo, a Redo or a Cancel changes the expression under the box: show it as it now is.
  const storedJson = JSON.stringify(value ?? null)
  useEffect(() => {
    setTyped((cur) => {
      if (cur === null) return null
      const r = readBox(cur, stored.json, rule)
      return r.ok && JSON.stringify(r.expr) === storedJson ? cur : null
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storedJson])

  // The same expression printed anew (a filter it reads was renamed): the typed text named the old
  // filter and no longer reads, so the box shows the expression as it now prints.
  const printedFor = useRef(storedJson)
  useEffect(() => {
    if (printedFor.current === storedJson) setTyped(null)
    printedFor.current = storedJson
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stored.text])

  const write = (next: string, keystroke: boolean) => {
    setTyped(next)
    const r = readBox(next, stored.json, rule)
    if (r.ok && JSON.stringify(r.expr) !== storedJson) onChange(r.expr, keystroke)
  }

  // An insert is a step of its own, not a keystroke.
  const { input, remember, track, insert } = useCaretInsert(text, (next) => write(next, false))

  const statusId = `${id}-status`
  return (
    <div className="flex w-full min-w-0 flex-col gap-1" data-fx-box={data} data-fx-json={stored.json ? '' : undefined}>
      <div className="flex items-center gap-1.5">
        <Input
          ref={input}
          id={id}
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
          className="min-w-0 flex-1 font-mono"
          value={text}
          placeholder={t(`fx.placeholder.${expect}`)}
          aria-label={label}
          aria-invalid={bad || undefined}
          aria-describedby={statusId}
          onChange={(e) => {
            write(e.target.value, true)
            track(e)
          }}
          onSelect={remember}
          onKeyUp={remember}
          onClick={remember}
          onBlur={remember}
          data-fx-input=""
        />
        {!stored.json && (
          <FxToggle ns="campaign-workspace" open={open} onToggle={() => setOpen((o) => !o)} onMouseDown={remember} />
        )}
      </div>
      {!reading.ok && reading.underline && (
        <div dir="ltr" className="overflow-x-auto border border-transparent px-2 font-mono text-sm whitespace-pre text-muted-foreground" aria-hidden data-fx-underline="">
          {reading.underline.before}
          <mark className="rounded-sm bg-danger-050 text-danger-800 underline decoration-danger-800 decoration-wavy">{reading.underline.bad}</mark>
          {reading.underline.after}
        </div>
      )}
      <div id={statusId} aria-live="polite" className="flex flex-col gap-0.5">
        {stored.json && <p className="text-xs text-muted-foreground" data-fx-status="json">{t('fx.asJson')}</p>}
        {!text.trim() ? (
          <p className="text-xs text-muted-foreground" data-fx-status="empty">
            {t(`fx.empty.${expect}`)}
          </p>
        ) : !reading.ok ? (
          <p className="flex items-start gap-1 text-xs font-medium text-danger-800" data-fx-status="bad">
            <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            {reading.problem ? (
              <span data-fx-error={reading.problem.code}>
                <Trans
                  t={t}
                  i18nKey={`fx.problem.${reading.problem.code}`}
                  values={{ at: reading.problem.at + 1 }}
                  components={{ n: <Ltr />, w: <code className="font-mono" /> }}
                />
              </span>
            ) : (
              <span data-fx-error="json">{t('fx.problem.json')}</span>
            )}
          </p>
        ) : (
          <p className="flex items-center gap-1 text-xs text-success-800" data-fx-status="ok">
            <Check className="h-3 w-3 shrink-0" aria-hidden />
            {t('fx.reads')}
          </p>
        )}
        {issues.map((m, i) => (
          <p key={i} className={'flex items-start gap-1 text-xs ' + (severityOf(m) === 'error' ? 'text-danger-800' : 'text-attention-800')} data-fx-issue={severityOf(m)}>
            <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
            <Trans t={t} i18nKey={`fx.issue.${severityOf(m)}`} values={{ message: m.message }} components={{ msg: <bdi /> }} />
          </p>
        ))}
      </div>
      {open && (
        <FxHelper
          guide={guide}
          rule={rule}
          valueKey={valueKey}
          expect={expect}
          current={text}
          onInsert={insert}
          onUse={(formula) => insert({ text: formula }, true)}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  )
}
