import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { saysIn } from '@/core/rules/sentence'
import type { CopilotTraceEntry, CopilotViewRef } from '@/core/models/copilot'
import { orderHref, orderSegments, viewHref } from './answer'
import { COPILOT_TOOLS, toolStepKey, traceRows } from './trace'

/**
 * The answer's links, trace and provenance (ticket 736, spec 734 D10/D11), beside the answer's own
 * block rendering in `CopilotPanel`.
 *
 * Bidi: the answer text stays inside its block's `<bdi>`; each order number in it is a machine value,
 * `Ltr`, inside its link. Trace inputs, the raw name of an unknown tool and `servedBy` are `Ltr` too,
 * each whole.
 */

/** A piece of answer text with every `orderRefs` number linked to its delivery document. */
export function LinkedText({ text, orderRefs }: { text: string; orderRefs: readonly string[] }) {
  return (
    <>
      {orderSegments(text, orderRefs).map((s, i) =>
        s.kind === 'text' ? (
          s.text
        ) : (
          <Link key={i} to={orderHref(s.no)} className="text-primary underline underline-offset-2" data-copilot-order={s.no}>
            <Ltr>{s.no}</Ltr>
          </Link>
        ),
      )}
    </>
  )
}

/**
 * The views the answer created (spec 766 D, ticket 781): one "Open view" link each to
 * `/analytics/view/:id`, by route string. The title is free text in either script, so a `<bdi>`.
 */
export function ViewLinks({ viewRefs }: { viewRefs: readonly CopilotViewRef[] }) {
  const { t, i18n } = useTranslation('copilot')
  if (viewRefs.length === 0) return null
  return (
    <ul aria-label={t('answer.views')} className="flex flex-col gap-1 text-sm" data-copilot-views>
      {viewRefs.map((v) => {
        const title = saysIn(v.title, i18n.language)
        return (
          <li key={v.id} className="flex flex-wrap items-baseline gap-2">
            <Link to={viewHref(v.id)} className="font-medium text-primary underline underline-offset-2" data-copilot-view={v.id}>
              {t('answer.openView')}
            </Link>
            {title && (
              <span className="text-muted-foreground" data-copilot-view-title>
                <bdi>{title}</bdi>
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Below the answer: "stopped early" when set, the collapsed trace, and who served it. */
export function AnswerProvenance({
  trace,
  stoppedEarly,
  servedBy,
}: {
  trace: readonly CopilotTraceEntry[]
  stoppedEarly: boolean
  servedBy: string | null
}) {
  const { t } = useTranslation('copilot')
  const rows = traceRows(trace)
  return (
    <div className="flex flex-col gap-2" data-copilot-provenance>
      {stoppedEarly && (
        <p role="note" className="text-xs text-muted-foreground" data-copilot-stopped-early>
          {t('answer.stoppedEarly')}
        </p>
      )}
      {rows.length > 0 && (
        <details className="rounded-lg border border-border p-2" data-copilot-trace>
          <summary className="cursor-pointer select-none text-xs font-medium text-muted-foreground">
            {t('trace.heading', { count: rows.length, n: fsi(formatNumber(rows.length)) })}
          </summary>
          <ol className="mt-2 flex flex-col gap-1.5 text-xs">
            {rows.map((r, i) => (
              <li key={i} className="flex flex-col gap-0.5" data-copilot-trace-row data-failed={r.failed || undefined}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium" data-copilot-trace-label>
                    {r.labelKey ? t(r.labelKey) : <Ltr>{r.tool}</Ltr>}
                  </span>
                  {r.failed && <StatusBadge sev="bad">{t('trace.failed')}</StatusBadge>}
                  {r.rows !== null && (
                    <span className="text-muted-foreground" data-copilot-trace-rows>
                      {t('trace.rows', { count: r.rows, n: fsi(formatNumber(r.rows)) })}
                    </span>
                  )}
                </div>
                {r.inputs.length > 0 && (
                  <ul className="flex flex-wrap gap-x-3 gap-y-0.5 text-muted-foreground">
                    {r.inputs.map((input) => (
                      <li key={input.key} data-copilot-trace-input>
                        <Ltr>{`${input.key}: ${input.value}`}</Ltr>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ol>
        </details>
      )}
      {servedBy && (
        <p className="text-xs text-muted-foreground" data-copilot-served-by>
          {t('answer.servedBy')} <Ltr>{servedBy}</Ltr>
        </p>
      )}
    </div>
  )
}

const STEP_MS = 1500

/**
 * The working state's step (D11): there is no streaming, so the panel cannot know which tool runs —
 * it walks the same tool → label map's generic steps while the one call is out.
 */
export function WorkingStep() {
  const { t } = useTranslation('copilot')
  const [i, setI] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setI((n) => (n + 1) % COPILOT_TOOLS.length), STEP_MS)
    return () => clearInterval(id)
  }, [])
  return (
    <span className="text-xs" data-copilot-working-step>
      {t(toolStepKey(COPILOT_TOOLS[i]))}
    </span>
  )
}
