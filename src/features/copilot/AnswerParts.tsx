import { Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { saysIn } from '@/core/rules/sentence'
import { copilotViewEmbed } from '@/core/copilot-view-embed'
import type { AnalyticsLabel } from '@/core/models/analytics'
import type { CopilotReportEdit, CopilotReportRef, CopilotTraceEntry, CopilotViewRef } from '@/core/models/copilot'
import { reportDialogHref, reportEditHref } from '@/core/analytics-routes'
import { formatDateTime } from '@/core/util/date-format'
import { copilotRefusal } from './refusal'
import { COPILOT_MAX_QUESTION, inlineMarks, orderHref, orderSegments, viewHref, type AnswerBlock, type AnswerRules, type CopilotAnswerModel } from './answer'
import { COPILOT_TOOLS, toolStepKey, traceRows } from './trace'

/**
 * The answer's links, trace and provenance (ticket 736, spec 734 D10/D11), beside the answer's own
 * block rendering in `CopilotPanel`.
 *
 * Bidi: the answer text stays inside its block's `<bdi>`; each order number in it is a machine value,
 * `Ltr`, inside its link. Trace inputs, the raw name of an unknown tool and `servedBy` are `Ltr` too,
 * each whole.
 */

/**
 * A piece of answer text with its inline marks drawn (`**bold**`, `*italic*`, `` `code` ``) and every `orderRefs`
 * number linked to its delivery document.
 */
export function LinkedText({ text, orderRefs }: { text: string; orderRefs: readonly string[] }) {
  return (
    <>
      {inlineMarks(text).map((m, j) => {
        const body = <OrderLinks text={m.text} orderRefs={orderRefs} />
        if (m.mark === 'strong') return <strong key={j} className="font-semibold">{body}</strong>
        if (m.mark === 'em') return <em key={j}>{body}</em>
        if (m.mark === 'code') return <code key={j} className="rounded bg-muted px-1 font-mono text-[0.85em]">{m.text}</code>
        return <span key={j}>{body}</span>
      })}
    </>
  )
}

function OrderLinks({ text, orderRefs }: { text: string; orderRefs: readonly string[] }) {
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
  const Embed = copilotViewEmbed()
  return (
    <ul aria-label={t('answer.views')} className="flex flex-col gap-3 text-sm" data-copilot-views>
      {viewRefs.map((v) => {
        const title = saysIn(v.title, i18n.language)
        return (
          <li key={v.id} className="flex flex-col gap-1">
            {title && (
              <span className="font-medium" data-copilot-view-title>
                <bdi>{title}</bdi>
              </span>
            )}
            {Embed && (
              <Suspense fallback={null}>
                <Embed viewId={v.id} />
              </Suspense>
            )}
            <Link to={viewHref(v.id)} className="self-start text-xs font-medium text-primary underline underline-offset-2" data-copilot-view={v.id}>
              {t('answer.openView')}
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

/**
 * The reports the answer built or saved (spec 819 §D, ticket 832): the title in the reader's language, its revision,
 * and "Open in designer" (`/analytics/report/:id/edit`, by route string). The title is free text: `<bdi>`; the
 * revision a machine value.
 */
export function ReportLinks({ reportRefs }: { reportRefs: readonly CopilotReportRef[] }) {
  const { t, i18n } = useTranslation('copilot')
  if (reportRefs.length === 0) return null
  return (
    <ul aria-label={t('answer.reports')} className="flex flex-col gap-2 text-sm" data-copilot-reports>
      {reportRefs.map((r) => {
        const title = saysIn(r.title, i18n.language)
        return (
          <li key={r.id} className="flex flex-col gap-1 rounded-md border border-border/60 bg-card p-3" data-copilot-report={r.id}>
            {title && (
              <span className="font-medium" data-copilot-report-title>
                <bdi>{title}</bdi>
              </span>
            )}
            <span className="text-xs text-muted-foreground">{t('answer.reportRevision', { n: fsi(formatNumber(r.revision)) })}</span>
            <Link to={reportEditHref(r.id)} className="self-start text-xs font-medium text-primary underline underline-offset-2" data-copilot-report-open={r.id}>
              {t('answer.openInDesigner')}
            </Link>
            {/* 819 §D (story 108): the AI never shares or schedules; when the words asked, it links those steps to the report's own dialogs. */}
            {r.nextSteps && r.nextSteps.length > 0 && (
              <span className="flex flex-wrap items-center gap-3 text-xs" aria-label={t('answer.nextSteps')} data-copilot-report-steps={r.id}>
                {r.nextSteps.map((step) => (
                  <Link key={step} to={reportDialogHref(r.id, step)} className="font-medium text-primary underline underline-offset-2" data-copilot-report-step={step}>
                    {t(`answer.${step}`)}
                  </Link>
                ))}
              </span>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** What the report assumed (802 item 1), one line each, in the reader's language. Each line is the model's text: `<bdi>`. */
export function Assumptions({ assumptions }: { assumptions: readonly AnalyticsLabel[] }) {
  const { t, i18n } = useTranslation('copilot')
  if (assumptions.length === 0) return null
  return (
    <section aria-label={t('answer.assumptions')} className="flex flex-col gap-1 text-sm" data-copilot-assumptions>
      <p className="text-xs font-medium text-muted-foreground">{t('answer.assumptions')}</p>
      <ul className="list-disc ps-5">
        {assumptions.map((a, i) => (
          <li key={i} data-copilot-assumption>
            <bdi>{saysIn(a, i18n.language)}</bdi>
          </li>
        ))}
      </ul>
    </section>
  )
}

/** An edit to the report open in the designer (832): handed to it as one undo step, never saved; its note says what changed. */
export function ReportEditNote({ reportEdit }: { reportEdit: CopilotReportEdit | null }) {
  const { t, i18n } = useTranslation('copilot')
  if (!reportEdit) return null
  const note = saysIn(reportEdit.note, i18n.language)
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-card p-3 text-xs" data-copilot-report-edit={reportEdit.reportId ?? 'new'}>
      <span>{t('answer.reportEdited')}</span>
      {note && (
        <span className="text-muted-foreground">
          {t('answer.reportEditNote')} <bdi>{note}</bdi>
        </span>
      )}
    </div>
  )
}

/** Below the answer: "stopped early" when set, the collapsed trace, and who served it. */
export function AnswerProvenance({
  trace,
  stoppedEarly,
  servedBy,
  rules = null,
}: {
  trace: readonly CopilotTraceEntry[]
  stoppedEarly: boolean
  servedBy: string | null
  /** The house rules it was answered under (ticket 790): `rules vN` or the built-in rules. */
  rules?: AnswerRules | null
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
      {(servedBy || rules) && (
        <p className="text-xs text-muted-foreground" data-copilot-served-by>
          {servedBy && (
            <>
              {t('answer.servedBy')} <Ltr>{servedBy}</Ltr>
            </>
          )}
          {servedBy && rules && ' · '}
          {rules && (
            <span data-copilot-rules={rules.kind === 'version' ? rules.n : 0}>
              {rules.kind === 'version' ? (
                <Trans t={t} i18nKey="answer.rulesVersion" values={{ n: formatNumber(rules.n) }} components={{ v: <Ltr /> }} />
              ) : (
                t('answer.rulesBuiltIn')
              )}
            </span>
          )}
        </p>
      )}
    </div>
  )
}

/** One answer's body (ticket 735; moved here for the house-rules Try box, 790), its view links (781), then its trace, `servedBy` and stopped-early note (736). */
export function Answer({ model }: { model: CopilotAnswerModel }) {
  const { t } = useTranslation('copilot')
  return (
    <>
      <section data-copilot-answer aria-label={t('answer.heading')} className="flex flex-col gap-2 text-sm">
        {model.blocks.length === 0 ? (
          <p className="text-muted-foreground">{t('answer.empty')}</p>
        ) : (
          model.blocks.map((b, i) => <Block key={i} block={b} orderRefs={model.orderRefs} />)
        )}
      </section>
      <ViewLinks viewRefs={model.viewRefs} />
      <Assumptions assumptions={model.assumptions} />
      <ReportEditNote reportEdit={model.reportEdit} />
      <ReportLinks reportRefs={model.reportRefs} />
      <AnswerProvenance trace={model.trace} stoppedEarly={model.stoppedEarly} servedBy={model.servedBy} rules={model.rules} />
    </>
  )
}

/** One block of the answer's light markdown. Every piece of text is the model's: `<bdi>`. */
function Block({ block, orderRefs }: { block: AnswerBlock; orderRefs: readonly string[] }) {
  if (block.kind === 'paragraph')
    return (
      <p className="whitespace-pre-line">
        <bdi>
          <LinkedText text={block.text} orderRefs={orderRefs} />
        </bdi>
      </p>
    )
  if (block.kind === 'heading')
    return (
      <p className="mt-1 font-semibold" role="heading" aria-level={4}>
        <bdi>
          <LinkedText text={block.text} orderRefs={orderRefs} />
        </bdi>
      </p>
    )
  if (block.kind === 'list') {
    const items = block.items.map((item, i) => (
      <li key={i}>
        <bdi>
          <LinkedText text={item} orderRefs={orderRefs} />
        </bdi>
      </li>
    ))
    return block.ordered ? <ol className="list-decimal ps-5">{items}</ol> : <ul className="list-disc ps-5">{items}</ul>
  }
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse text-xs">
        <thead>
          <tr>
            {block.head.map((h, i) => (
              <th key={i} className="border-b border-border px-2 py-1 text-start font-semibold">
                <bdi>{h}</bdi>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {block.rows.map((row, r) => (
            <tr key={r}>
              {row.map((c, i) => (
                <td key={i} className="border-b border-border/60 px-2 py-1 text-start">
                  <bdi>
                    <LinkedText text={c} orderRefs={orderRefs} />
                  </bdi>
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/**
 * A refusal in its own words (D7), never its raw code. A code without words here is the server's own
 * message — free text, so a `<bdi>`. 402's reset time is a machine value: `Ltr`, through a `<Trans>` slot.
 */
export function Refusal({ err }: { err: unknown }) {
  const { t } = useTranslation('copilot')
  const view = copilotRefusal(err, t('failed'))
  return (
    <div
      role="alert"
      data-copilot-refusal
      className="rounded-2xl rounded-ss-sm border border-danger-border bg-danger-050 px-3.5 py-2.5 text-[0.8125rem] text-danger-800"
    >
      {'message' in view ? (
        <bdi>{view.message}</bdi>
      ) : view.resetAt ? (
        <Trans t={t} i18nKey={view.key} values={{ time: formatDateTime(view.resetAt) }} components={{ time: <Ltr /> }} />
      ) : (
        t(view.key, { max: fsi(formatNumber(COPILOT_MAX_QUESTION)) })
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
