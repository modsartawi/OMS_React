import { Suspense, useEffect, useState } from 'react'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { saysIn } from '@/core/rules/sentence'
import { copilotTableEmbed, copilotViewEmbed } from '@/core/copilot-view-embed'
import type { CopilotAnswerTable, CopilotBoardEdit, CopilotReadingOffer, CopilotReportEdit, CopilotReportRef, CopilotStatedReading, CopilotTraceEntry, CopilotViewRef } from '@/core/models/copilot'
import { reportDialogHref, reportEditHref } from '@/core/analytics-routes'
import { formatDateTime } from '@/core/util/date-format'
import { copilotRefusal } from './refusal'
import { Check, ChevronDown, Copy } from 'lucide-react'
import Button from '@/core/ui/Button'
import { notify } from '@/core/services/notify'
import { copyText } from '@/core/util/copy-text'
import { COPILOT_MAX_QUESTION, answerLayout, answerPlainText, answerTableKey, assumptionRows, type AnswerPart, inlineMarks, orderHref, orderSegments, viewHref, type AnswerBlock, type AnswerRules, type CopilotAnswerModel } from './answer'
import { COPILOT_TOOLS, toolStepKey, traceRows } from './trace'
import { copilotApi } from './api'
import { pollSteps } from './steps'
import type { ReadingOfferState } from './conversation-store'

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
 * The answer's tables (ticket 868, BackOffice spec 3558 D5), under its summary: each the analytics table form through
 * the core bridge (the copilot never imports analytics). None, or no embed registered: nothing, as before. 878: in the
 * order sent, each under its own title when it has one (an analysis result's parts), told apart by place as well as step.
 */
export function AnswerTables({ tables }: { tables: readonly CopilotAnswerTable[] }) {
  const { t } = useTranslation('copilot')
  const Embed = copilotTableEmbed()
  if (tables.length === 0 || !Embed) return null
  return (
    <div aria-label={t('answer.tables')} className="flex min-w-0 flex-col gap-3" data-copilot-tables>
      {tables.map((table, i) => (
        <Suspense key={answerTableKey(table, i)} fallback={null}>
          <Embed table={table} index={i} />
        </Suspense>
      ))}
    </div>
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

/**
 * What a thread answer can do with its readings (892, BackOffice 3685/3686). Only the panel's thread passes it: the
 * house-rules Try box draws its lines plain and no offer.
 */
export interface AnswerReadings {
  /** A tapped line's choice: the answer's question asked again with that reading stated. */
  choose: (reading: CopilotStatedReading) => void
  /** False while a question is in flight or the conversation is over: the choices show, disabled. */
  canChoose: boolean
  offer: ReadingOfferState
  keep: () => void
  notNow: () => void
}

/**
 * What the answer assumed (802 item 1; any answer since 870), one line each, in the reader's language, under the answer
 * and apart from it. Each line is free text: `<bdi>`, drawn as the server wrote it ("as you prefer" included). A line the
 * server offers other readings for (892, 3685) opens them on a tap; choosing one asks the question again with it.
 */
export function Assumptions({ model, readings }: { model: CopilotAnswerModel; readings?: AnswerReadings }) {
  const { t, i18n } = useTranslation('copilot')
  const [open, setOpen] = useState<number | null>(null)
  if (model.assumptions.length === 0) return null
  return (
    <section aria-label={t('answer.assumptions')} className="flex flex-col gap-1 text-sm" data-copilot-assumptions>
      <p className="text-xs font-medium text-muted-foreground">{t('answer.assumptions')}</p>
      <ul className="list-disc ps-5">
        {assumptionRows(model, i18n.language).map((row, i) =>
          row.choice && readings ? (
            <li key={i} data-copilot-assumption data-copilot-assumption-kind={row.choice.kind}>
              <Button
                variant="text"
                className="h-auto px-0 text-start text-sm"
                aria-expanded={open === i}
                onClick={() => setOpen(open === i ? null : i)}
                data-copilot-assumption-tap
              >
                <bdi>{row.text}</bdi>
                <ChevronDown className="h-3.5 w-3.5 shrink-0" aria-hidden />
              </Button>
              {open === i && (
                <div className="mt-1 flex flex-wrap items-center gap-1.5" role="group" aria-label={t('reading.readAs')} data-copilot-assumption-choices>
                  <span className="text-xs text-muted-foreground">{t('reading.readAs')}</span>
                  {row.choice.choices.map((c) => (
                    <Button
                      key={c.value}
                      variant="outlined"
                      disabled={!readings.canChoose}
                      onClick={() => {
                        setOpen(null)
                        readings.choose({ kind: row.choice!.kind, value: c.value })
                      }}
                      data-copilot-assumption-choice={c.value}
                    >
                      <bdi>{c.text}</bdi>
                    </Button>
                  ))}
                </div>
              )}
            </li>
          ) : (
            <li key={i} data-copilot-assumption>
              <bdi>{row.text}</bdi>
            </li>
          ),
        )}
      </ul>
    </section>
  )
}

/**
 * The offer under a corrected answer (892, BackOffice 3686 R16/R17): the server's question with Keep and Not now. Keep
 * puts the server's confirmation in place of the buttons, with the way to "What the copilot knows about me"; Not now
 * hides the line. An offer no longer open keeps its words and loses its buttons.
 */
export function ReadingOfferLine({ offer, readings }: { offer: CopilotReadingOffer; readings: AnswerReadings }) {
  const { t, i18n } = useTranslation('copilot')
  const s = readings.offer
  if (s.state === 'dismissed') return null
  if (s.state === 'kept')
    return (
      <section aria-label={t('reading.offer')} className="flex flex-col gap-1 text-sm" data-copilot-reading-offer="kept">
        <p className="flex items-center gap-1.5">
          <Check className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
          <bdi>{saysIn(s.line, i18n.language)}</bdi>
        </p>
        <Link to="/copilot/me" className="self-start text-xs font-medium text-primary underline underline-offset-2" data-copilot-reading-me>
          {t('reading.seeMine')}
        </Link>
      </section>
    )
  const busy = s.state === 'busy'
  return (
    <section aria-label={t('reading.offer')} className="flex flex-col gap-1.5 text-sm" data-copilot-reading-offer={s.state}>
      <p>
        <bdi>{saysIn(offer.offer, i18n.language)}</bdi>
      </p>
      {s.state === 'closed' ? (
        <p className="text-xs text-muted-foreground" data-copilot-reading-closed>
          {s.message || t('reading.closed')}
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-1.5">
          <Button variant="primary" disabled={busy} onClick={readings.keep} data-copilot-reading-keep>
            {t('reading.keep')}
          </Button>
          <Button variant="text" disabled={busy} onClick={readings.notNow} data-copilot-reading-not-now>
            {t('reading.notNow')}
          </Button>
          {s.state === 'failed' && (
            <span className="text-xs text-destructive" role="alert">
              {t('reading.failed')}
            </span>
          )}
        </div>
      )}
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

/** An edit to the board open in its editor (836): handed to it as one undo step, never saved. */
export function BoardEditNote({ boardEdit }: { boardEdit: CopilotBoardEdit | null }) {
  const { t, i18n } = useTranslation('copilot')
  if (!boardEdit) return null
  const note = saysIn(boardEdit.note, i18n.language)
  return (
    <div className="flex flex-col gap-1 rounded-md border border-border/60 bg-card p-3 text-xs" data-copilot-board-edit={boardEdit.boardId}>
      <span>{t('answer.boardEdited')}</span>
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
  copy,
  lookupsOpen = false,
}: {
  /** The lookups ("How I got this") start open: a figures-only answer's sentence says they are listed below (870). */
  lookupsOpen?: boolean
  /** The answer's text for its Copy button; no button when absent. */
  copy?: string
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
        <details open={lookupsOpen || undefined} className="rounded-lg border border-border p-2" data-copilot-trace>
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
      {(copy !== undefined || servedBy || rules) && (
        <div className="flex flex-col items-start gap-1.5" data-copilot-answer-footer>
          {copy !== undefined && <CopyAnswer text={copy} />}
          {(servedBy || rules) && (
            // A small tag under the answer: who served it, and under which house rules.
            <p
              className="inline-flex w-fit flex-wrap items-center gap-1 rounded-full border border-border/60 bg-card px-2 py-0.5 text-[11px] leading-4 text-muted-foreground"
              data-copilot-served-by
            >
              {servedBy && (
                <span>
                  {t('answer.servedBy')} <Ltr>{servedBy}</Ltr>
                </span>
              )}
              {servedBy && rules && <span aria-hidden>·</span>}
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
      )}
    </div>
  )
}

/** Copy: the answer's text on the clipboard (clean, see `answerPlainText`); the button says Copied for a moment. */
function CopyAnswer({ text }: { text: string }) {
  const { t } = useTranslation('copilot')
  const [done, setDone] = useState(false)
  useEffect(() => {
    if (!done) return
    const timer = setTimeout(() => setDone(false), 2000)
    return () => clearTimeout(timer)
  }, [done])
  const put = async () => {
    if ((await copyText(text)) === 'copied') setDone(true)
    else notify.error(t('answer.copyFailed'))
  }
  return (
    <Button variant="ghost" className="h-7 px-2 text-xs" onClick={() => void put()} disabled={text === ''} data-copilot-copy={done ? 'done' : ''}>
      {done ? <Check className="h-3.5 w-3.5" aria-hidden /> : <Copy className="h-3.5 w-3.5" aria-hidden />}
      {done ? t('answer.copied') : t('answer.copy')}
    </Button>
  )
}

/** One answer's body (ticket 735; moved here for the house-rules Try box, 790), its view links (781), then its trace, `servedBy` and stopped-early note (736). */
export function Answer({ model, readings }: { model: CopilotAnswerModel; readings?: AnswerReadings }) {
  const { t } = useTranslation('copilot')
  const layout = answerLayout(model)
  const part = (p: AnswerPart) => {
    switch (p) {
      case 'text':
        return (
          <section key={p} data-copilot-answer data-copilot-figures-only={layout.figuresOnly || undefined} aria-label={t('answer.heading')} className="flex flex-col gap-2 text-sm">
            {model.blocks.length === 0 ? (
              <p className="text-muted-foreground">{t('answer.empty')}</p>
            ) : (
              model.blocks.map((b, i) => <Block key={i} block={b} orderRefs={model.orderRefs} />)
            )}
          </section>
        )
      case 'tables':
        return <AnswerTables key={p} tables={model.tables} />
      case 'views':
        return <ViewLinks key={p} viewRefs={model.viewRefs} />
      case 'assumptions':
        return <Assumptions key={p} model={model} readings={readings} />
      case 'readingOffer':
        return model.readingOffer && readings ? <ReadingOfferLine key={p} offer={model.readingOffer} readings={readings} /> : null
      case 'reportEdit':
        return <ReportEditNote key={p} reportEdit={model.reportEdit} />
      case 'boardEdit':
        return <BoardEditNote key={p} boardEdit={model.boardEdit} />
      case 'reports':
        return <ReportLinks key={p} reportRefs={model.reportRefs} />
    }
  }
  return (
    <>
      {layout.parts.map(part)}
      <AnswerProvenance
        trace={model.trace}
        lookupsOpen={layout.lookups === 'open'}
        stoppedEarly={model.stoppedEarly}
        servedBy={model.servedBy}
        rules={model.rules}
        copy={answerPlainText(model.blocks)}
      />
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
 * The question in flight's live step (ticket 869, spec 3558 D12, D17): the latest step's key while `requestId` is set,
 * polled about every second; `null` until a step is read (a 404 keeps it null). Polling stops when the id clears (the
 * answer landed, Stop, a new conversation) and when the panel unmounts (closed).
 */
function useLiveStep(requestId: string | null): string | null {
  const [step, setStep] = useState<{ id: string; key: string } | null>(null)
  useEffect(() => {
    if (requestId === null) return
    return pollSteps(requestId, copilotApi.steps, (key) => setStep({ id: requestId, key }))
  }, [requestId])
  return step !== null && step.id === requestId ? step.key : null
}

/**
 * The working state's step. With live steps (869) it is the step the server is on, in the panel's own words. With none
 * (a 404: the switch off, or nothing recorded yet) it is today's (D11): the panel cannot know which tool runs, so it
 * walks the same tool → label map's generic steps while the one call is out.
 */
export function WorkingStep({ requestId = null }: { requestId?: string | null }) {
  const { t } = useTranslation('copilot')
  const live = useLiveStep(requestId)
  const [i, setI] = useState(0)
  useEffect(() => {
    if (live !== null) return
    const id = setInterval(() => setI((n) => (n + 1) % COPILOT_TOOLS.length), STEP_MS)
    return () => clearInterval(id)
  }, [live])
  return (
    <span className="text-xs" data-copilot-working-step data-copilot-live-step={live !== null || undefined}>
      {t(live ?? toolStepKey(COPILOT_TOOLS[i]))}
    </span>
  )
}
