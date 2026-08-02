import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Loader2, TriangleAlert } from 'lucide-react'

import type { NphiesSessionInsurance } from '@/core/models/nphies'
import {
  DEDUCTIBLE_GROUPS,
  insuranceChanged,
  insuranceToDraft,
  readInsuranceDraft,
  type DeductibleGroupKey,
  type InsuranceDraft,
  type InsuranceRefusal,
} from './line-rules'

/**
 * **The header deductible block** — two of the agent's five inputs (ticket 218,
 * spec 209 stories 38–41, contract v1.0 §4).
 *
 * Three groups, three boxes each: the **rate**, its **cap**, and **paid-outside**.
 * All nine are inherited from the coverage and then correctable, because the
 * terms the engine landed are the payer's own and the agent is the one who finds
 * out they are wrong — that correction is precisely what the audit trail exists
 * to catch.
 *
 * 🚩 **One edit re-prices the whole request.** `setInsurance` answers the entire
 * state (law 3) and `UpdateDeductible` never touches `request.Items`, so every
 * line amount is recomputed by the engine and stays *derived* rather than half
 * hand-set (story 39). Nothing in this component multiplies a rate by anything.
 *
 * 🚩 **Paid-outside is an input and is persisted** (story 41). A stored cap of
 * 300 cannot be told from a 500 cap with 200 already spent, and the agent's entry
 * is exactly the part that would vanish — which is why it sits in the same block
 * as the cap it qualifies rather than somewhere a later reader has to correlate.
 */
export default function DeductibleTerms({
  insurance,
  onCommit,
  busy,
  disabled,
}: {
  insurance: NphiesSessionInsurance
  /** The block, whole — `setInsurance` takes all three groups (§1.2). */
  onCommit: (next: NphiesSessionInsurance) => void
  busy: boolean
  disabled: boolean
}) {
  const { t } = useTranslation('authorizations')
  const [draft, setDraft] = useState<InsuranceDraft>(() => insuranceToDraft(insurance))
  const [refusals, setRefusals] = useState<InsuranceRefusal[]>([])

  // The engine's answer is the truth: when the state comes back — its own
  // rounding applied, or a cap the server adjusted — the boxes follow it rather
  // than keeping what was typed.
  useEffect(() => {
    setDraft(insuranceToDraft(insurance))
    setRefusals([])
  }, [insurance])

  /**
   * Commit on blur and on Enter, never on a keystroke: a verb per digit would
   * re-price the whole basket for `2`, then `20`, and the second answer would
   * arrive over the first.
   */
  function commit() {
    const read = readInsuranceDraft(draft)
    if (!read.ok) {
      setRefusals(read.refusals)
      return
    }
    setRefusals([])
    if (!insuranceChanged(insurance, read.insurance)) return
    onCommit(read.insurance)
  }

  const refusalFor = (group: DeductibleGroupKey, field: 'rate' | 'max' | 'paid') =>
    refusals.find((r) => r.group === group && r.field === field) ?? null

  return (
    <section className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold tracking-tight">{t('form.insurance.title')}</h2>
        {busy && (
          <span
            className="inline-flex items-center gap-1 text-xs text-muted-foreground"
            role="status"
          >
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            {t('form.insurance.repricing')}
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground">{t('form.insurance.hint')}</p>

      <div className="overflow-x-auto">
        <table
          aria-label={t('form.insurance.tableLabel')}
          className="w-full min-w-[34rem] border-collapse text-sm"
        >
          <thead>
            <tr className="border-b border-border/60 text-xs font-medium text-muted-foreground">
              <th className="px-2 py-1.5 text-start font-medium">{t('form.insurance.group')}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t('form.insurance.rate')}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t('form.insurance.max')}</th>
              <th className="px-2 py-1.5 text-start font-medium">{t('form.insurance.paid')}</th>
            </tr>
          </thead>
          <tbody>
            {DEDUCTIBLE_GROUPS.map((group) => (
              <tr key={group} className="border-b border-border/40 last:border-b-0">
                <td className="px-2 py-2 text-xs font-medium">
                  {t(`form.insurance.groups.${group}`)}
                </td>
                {(['rate', 'max', 'paid'] as const).map((field) => (
                  <td key={field} className="px-2 py-2">
                    <TermBox
                      value={draft[group][field]}
                      label={t(`form.insurance.boxLabel.${field}`, {
                        group: t(`form.insurance.groups.${group}`),
                      })}
                      refusal={refusalFor(group, field)}
                      disabled={disabled || busy}
                      onChange={(next) =>
                        setDraft((held) => ({
                          ...held,
                          [group]: { ...held[group], [field]: next },
                        }))
                      }
                      onCommit={commit}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Each refused box marks itself; this states what is wrong in words, once,
          rather than repeating a sentence beside nine inputs. */}
      {refusals.length > 0 && (
        <p
          role="alert"
          className="flex items-start gap-2 text-xs text-attention-800"
        >
          <TriangleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
          <span>
            {refusals
              .map((r) =>
                t(`form.insurance.refusal.${r.reason}`, {
                  group: t(`form.insurance.groups.${r.group}`),
                  field: t(`form.insurance.fields.${r.field}`),
                }),
              )
              .join(' ')}
          </span>
        </p>
      )}
    </section>
  )
}

/** One of the nine boxes. A number input, marked when it holds what was refused. */
function TermBox({
  value,
  label,
  refusal,
  disabled,
  onChange,
  onCommit,
}: {
  value: string
  label: string
  refusal: InsuranceRefusal | null
  disabled: boolean
  onChange: (next: string) => void
  onCommit: () => void
}) {
  return (
    <input
      type="number"
      min={0}
      step="any"
      value={value}
      aria-label={label}
      aria-invalid={refusal !== null}
      disabled={disabled}
      onChange={(e) => onChange(e.target.value)}
      onBlur={onCommit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          e.preventDefault()
          onCommit()
        }
      }}
      className={
        'h-7 w-24 rounded-md border bg-background px-2 text-sm tabular-nums text-foreground disabled:opacity-50 ' +
        (refusal ? 'border-danger-border' : 'border-input')
      }
    />
  )
}
