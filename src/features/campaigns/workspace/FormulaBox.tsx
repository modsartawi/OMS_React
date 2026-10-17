import { useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { Check, Loader2, TriangleAlert, X } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { CampaignRule, RuleCampaign, RuleFormulaCheckRequest, RuleFormulaExpect, RuleFormulaGuide, RuleFormulaType } from '@/core/models/rule-campaign'
import { ruleFormulaCheckQuery } from '@/core/rules/api'
import { campaignCurrency, moneyText } from '@/core/rules/sentence'
import Ltr from '@/core/ui/Ltr'
import { formatNumber } from '@/core/util/number-format'
import { useDebounced } from '@/core/util/use-debounced'
import { INPUT } from './builder-ui'
import FxHelper from './FxHelper'
import { checkRequest, insertAtCursor, readFormulaCheck, type Chip, type FormulaReading, type Selection } from './fx'

/** How long typing must stop before the formula goes to HQ's check. */
const CHECK_DEBOUNCE_MS = 300

export interface FormulaBoxProps {
  id: string
  value: string
  /** `typed` is a keystroke — a run of them is ONE step of the history; an insert is a step of its own. */
  onChange: (formula: string, typed: boolean) => void
  expect: RuleFormulaExpect
  rule: CampaignRule
  /** The named value being written (it reads only the values above it); null for the formula condition. */
  valueId: string | null
  campaign: Pick<RuleCampaign, 'id' | 'audience'>
  guide: RuleFormulaGuide
  /** The input's accessible name, where no `<label>` points at it. */
  label?: string
  data: string
}

/**
 * A formula, written with the guided ƒx helper (ticket 507): the input, the ƒx button that opens
 * the helper — Fields, Functions, Recipes and operator chips, each put in where the cursor was —
 * and the validator, always on. The validator is HQ's (BackOffice 2758): 300 ms after typing stops
 * the formula goes to the check door with the rule as it is on screen, and the box shows HQ's
 * answer — the error with the bad word underlined, or what the formula gives on the sample basket.
 * The client never parses the formula (ADR 0089).
 */
export default function FormulaBox({ id, value, onChange, expect, rule, valueId, campaign, guide, label, data }: FormulaBoxProps) {
  const { t } = useTranslation('campaign-workspace')
  const [open, setOpen] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  /** Where the cursor was when the input last had it. */
  const selection = useRef<Selection | null>(null)
  /** Where the caret goes once an insert has reached the input. */
  const caretAfter = useRef<number | null>(null)

  const request = checkRequest(campaign.id, rule, valueId, expect, value)
  const key = JSON.stringify(request)
  const settledKey = useDebounced(key, CHECK_DEBOUNCE_MS)
  const settled = useMemo(() => JSON.parse(settledKey) as RuleFormulaCheckRequest, [settledKey])
  const check = useQuery({ ...ruleFormulaCheckQuery(settled), enabled: settled.formula.trim() !== '' })
  const current = settledKey === key

  const reading: FormulaReading | null = current && check.data ? readFormulaCheck(value, check.data) : null
  const bad = reading?.state === 'bad'

  useEffect(() => {
    const el = input.current
    const caret = caretAfter.current
    if (!el || caret === null) return
    caretAfter.current = null
    el.focus()
    el.setSelectionRange(caret, caret)
    selection.current = { start: caret, end: caret }
  }, [value])

  const remember = () => {
    const el = input.current
    if (el && el.selectionStart !== null && el.selectionEnd !== null) selection.current = { start: el.selectionStart, end: el.selectionEnd }
  }

  const insert = (chip: Chip, replaceAll = false) => {
    const at = replaceAll ? { start: 0, end: value.length } : selection.current
    const next = insertAtCursor(value, at, chip)
    caretAfter.current = next.caret
    if (next.formula === value) {
      // Nothing changed (the same recipe again): the caret still goes where it was asked to.
      input.current?.focus()
      input.current?.setSelectionRange(next.caret, next.caret)
      caretAfter.current = null
      return
    }
    onChange(next.formula, false)
  }

  const statusId = `${id}-status`
  return (
    <div className="flex w-full min-w-0 flex-col gap-1" data-fx-box={data}>
      <div className="flex items-center gap-1.5">
        <input
          ref={input}
          id={id}
          dir="ltr"
          spellCheck={false}
          autoComplete="off"
          className={`${INPUT} min-w-0 flex-1 font-mono ${bad ? 'border-danger-border' : ''}`}
          value={value}
          placeholder={t(`fx.placeholder.${expect}`)}
          aria-label={label}
          aria-invalid={bad || undefined}
          aria-describedby={statusId}
          onChange={(e) => {
            onChange(e.target.value, true)
            selection.current = { start: e.target.selectionStart ?? e.target.value.length, end: e.target.selectionEnd ?? e.target.value.length }
          }}
          onSelect={remember}
          onKeyUp={remember}
          onClick={remember}
          onBlur={remember}
          data-fx-input=""
        />
        <button
          type="button"
          className={
            'h-8 shrink-0 rounded-md border px-2.5 font-serif text-sm font-semibold italic ' +
            (open ? 'border-primary/50 bg-primary-050 text-primary-800' : 'border-border/60 text-muted-foreground hover:bg-accent hover:text-foreground')
          }
          aria-expanded={open}
          aria-label={t('fx.toggle')}
          title={t('fx.toggle')}
          onMouseDown={remember}
          onClick={() => setOpen((o) => !o)}
          data-fx-toggle=""
        >
          {t('fx.symbol')}
        </button>
      </div>
      {reading?.state === 'bad' && reading.underline && (
        // The formula again, in the input's font and padding, so the mark sits under the bad word.
        <div dir="ltr" className="overflow-x-auto border border-transparent px-2 font-mono text-sm whitespace-pre text-muted-foreground" aria-hidden data-fx-underline="">
          {reading.underline.before}
          <mark className="rounded-sm bg-danger-050 text-danger-800 underline decoration-danger-800 decoration-wavy">{reading.underline.bad}</mark>
          {reading.underline.after}
        </div>
      )}
      <div id={statusId} aria-live="polite">
        <Status value={value} expect={expect} reading={reading} pending={!current || check.isFetching} error={check.isError && current ? check.error : null} currency={campaignCurrency(campaign.audience)} />
      </div>
      {open && (
        <FxHelper
          guide={guide}
          rule={rule}
          valueId={valueId}
          expect={expect}
          current={value}
          onInsert={insert}
          onUse={(formula) => insert({ text: formula }, true)}
          onDone={() => setOpen(false)}
        />
      )}
    </div>
  )
}

/** What the validator says: nothing written yet, checking, HQ's answer, or that the check could not be made. */
function Status({
  value,
  expect,
  reading,
  pending,
  error,
  currency,
}: {
  value: string
  expect: RuleFormulaExpect
  reading: FormulaReading | null
  pending: boolean
  error: unknown
  currency: string | null
}) {
  const { t } = useTranslation('campaign-workspace')
  if (!value.trim())
    return (
      <p className="text-xs text-muted-foreground" data-fx-status="empty">
        {t(`fx.empty.${expect}`)}
      </p>
    )
  if (error)
    return (
      <p className="flex items-center gap-1 text-xs text-attention-800" role="alert" data-fx-status="failed">
        <TriangleAlert className="h-3 w-3 shrink-0" aria-hidden />
        <bdi>{apiErrorMessage(error, t('fx.checkFailed'))}</bdi>
      </p>
    )
  if (pending || !reading)
    return (
      <p className="flex items-center gap-1 text-xs text-muted-foreground" data-fx-status="checking">
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
        {t('fx.checking')}
      </p>
    )
  if (reading.state === 'bad')
    return (
      <div className="flex flex-col gap-0.5 text-xs font-medium text-danger-800" data-fx-status="bad">
        <p className="flex items-start gap-1" data-fx-error="">
          <X className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <bdi>{reading.message || t('fx.invalid')}</bdi>
        </p>
        {reading.more.map((m, i) => (
          <p key={i} className="flex items-start gap-1 ps-4">
            <bdi>{m}</bdi>
          </p>
        ))}
      </div>
    )
  return (
    <div className="flex flex-col gap-0.5 text-xs" data-fx-status="ok">
      <p className="flex flex-wrap items-center gap-x-1 text-success-800">
        <Check className="h-3 w-3 shrink-0" aria-hidden />
        <span>{t(`fx.valid.${validKind(reading.type)}`)}</span>
        {reading.result !== null && (
          <span className="text-muted-foreground">
            <Trans
              t={t}
              i18nKey="fx.onSample"
              components={{
                result: (
                  <b className="text-foreground" data-fx-result="">
                    <Result value={reading.result} money={reading.type === 'money'} currency={currency} />
                  </b>
                ),
              }}
            />
          </span>
        )}
      </p>
      {reading.warnings.map((w, i) => (
        <p key={i} className="flex items-start gap-1 text-attention-800" data-fx-warning="">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" aria-hidden />
          <bdi>{w}</bdi>
        </p>
      ))}
    </div>
  )
}

/** What a valid formula gives, as the status names it: money reads as a number. */
const validKind = (type: RuleFormulaType | null) => (type === 'bool' || type === 'text' || type === 'date' || type === 'items' ? type : 'number')

/** A result on the sample basket, by its kind: money in the campaign's currency (code and figure, isolated once), a number, yes / no, or text. */
function Result({ value, money, currency }: { value: number | boolean | string; money: boolean; currency: string | null }) {
  const { t } = useTranslation('campaign-workspace')
  if (typeof value === 'boolean') return <>{t(value ? 'fx.yes' : 'fx.no')}</>
  if (typeof value === 'string') return <bdi>{value}</bdi>
  if (money) return <Ltr>{moneyText({ amount: value, currency })}</Ltr>
  return <Ltr>{formatNumber(value)}</Ltr>
}
