import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Trans, useTranslation } from 'react-i18next'
import { HelpCircle, Loader2, MessageSquarePlus, Send, Sparkles } from 'lucide-react'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Textarea from '@/core/ui/Textarea'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import type { CopilotAskRequest } from '@/core/models/copilot'
import { copilotApi } from './api'
import { COPILOT_MAX_QUESTION, copilotAnswerModel, questionFits, type AnswerBlock, type CopilotAnswerModel } from './answer'
import { EMPTY_CONVERSATION, askBody, canAskMore, withAnswer, withRefusal, type CopilotTurn } from './conversation'
import { copilotRefusal } from './refusal'
import { AnswerProvenance, LinkedText, WorkingStep } from './AnswerParts'
import { useCopilotConversation } from './conversation-store'

/**
 * The copilot panel (ticket 735, spec 734 D11) — the ONE body both the top bar's side sheet and the
 * `/copilot` page render: the two D12 examples while it is empty, the question box with its
 * 1,000-character limit, the working state for the whole (non-streaming) call, and the answer.
 *
 * The answer is free text from the model, in either script: every block's text is a `<bdi>` (bidi
 * rule). The count under the box is a machine value: `Ltr`, built as one string.
 *
 * Ticket 737 (D5, D7): the panel holds a conversation — a thread numbered by `questionNo`, whose id
 * every follow-up sends back. "New conversation" drops both. At question 10, or on `COPILOT-406`, the
 * box gives way to the offer of a new conversation. A refusal joins the thread in its own words.
 */
export default function CopilotPanel() {
  const { t } = useTranslation('copilot')
  const [question, setQuestion] = useState('')
  // Held in the store, not here: the sheet unmounts the panel when an order link navigates (736).
  const { conv, setConv } = useCopilotConversation()
  const box = useRef<HTMLTextAreaElement>(null)
  const ask = useMutation({
    mutationFn: (body: CopilotAskRequest) => copilotApi.ask(body),
    onSuccess: (reply, body) => setConv((c) => withAnswer(c, body.question, reply)),
    onError: (err, body) => setConv((c) => withRefusal(c, body.question, err)),
  })

  const tooLong = question.length > COPILOT_MAX_QUESTION
  const canSend = questionFits(question) && !ask.isPending

  const send = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    ask.mutate(askBody(conv, question.trim()))
    setQuestion('')
  }
  /** "New conversation": no id, no thread, an empty box. */
  const startNew = () => {
    setConv(EMPTY_CONVERSATION)
    ask.reset()
    setQuestion('')
    requestAnimationFrame(() => box.current?.focus())
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  /** An example fills the box; the order placeholder is selected, so typing the number replaces it. */
  const fillExample = (text: string, select?: string) => {
    setQuestion(text)
    requestAnimationFrame(() => {
      const el = box.current
      if (!el) return
      el.focus()
      const at = select ? text.indexOf(select) : -1
      if (at >= 0 && select) el.setSelectionRange(at, at + select.length)
      else el.setSelectionRange(text.length, text.length)
    })
  }

  const empty = conv.turns.length === 0 && !ask.isPending
  const open = canAskMore(conv)

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-copilot-panel>
      {!empty && (
        <div className="flex shrink-0 items-center justify-between gap-2" data-copilot-thread-bar>
          <div className="text-xs font-medium text-muted-foreground">{t('thread.heading')}</div>
          <Button variant="ghost" onClick={startNew} disabled={ask.isPending} data-copilot-new>
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            {t('thread.new')}
          </Button>
        </div>
      )}

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto">
        {empty && (
          <div data-copilot-examples className="flex flex-col gap-2">
            <div className="text-xs font-medium text-muted-foreground">{t('examples.heading')}</div>
            <div className="flex flex-col items-start gap-1.5">
              {[
                { text: t('examples.late'), select: t('examples.lateSelect') },
                { text: t('examples.hungerstation') },
              ].map((ex) => (
                <Button
                  key={ex.text}
                  variant="secondary"
                  className="h-auto min-h-7 py-1 text-start"
                  data-copilot-example
                  onClick={() => fillExample(ex.text, ex.select)}
                >
                  <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                  <span>{ex.text}</span>
                </Button>
              ))}
            </div>
          </div>
        )}

        {conv.turns.length > 0 && (
          <ol className="flex flex-col gap-4" data-copilot-thread>
            {conv.turns.map((turn, i) => (
              <Turn key={i} turn={turn} />
            ))}
          </ol>
        )}

        {ask.isPending && ask.variables !== undefined && <Asked question={ask.variables.question} questionNo={null} />}

        {ask.isPending && (
          <div role="status" data-copilot-working className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('working')}
            <WorkingStep />
          </div>
        )}
      </div>

      {open ? (
        <form onSubmit={send} className="flex shrink-0 flex-col gap-2 border-t border-border/60 pt-3" data-copilot-form>
          <Field
            label={t('box.label')}
            error={tooLong ? t('box.tooLong', { max: fsi(formatNumber(COPILOT_MAX_QUESTION)) }) : undefined}
            hint={
              <span data-copilot-count>
                {t('box.chars')} <Ltr>{formatCount(formatNumber(question.length), formatNumber(COPILOT_MAX_QUESTION))}</Ltr>
              </span>
            }
          >
            <Textarea
              ref={box}
              rows={3}
              value={question}
              placeholder={t('box.placeholder')}
              onChange={(e) => setQuestion(e.target.value)}
              onKeyDown={onKeyDown}
              className="w-full resize-y"
              data-copilot-question
            />
          </Field>
          <div className="flex justify-end">
            <Button type="submit" disabled={!canSend} data-copilot-send>
              <Send className="h-3.5 w-3.5" aria-hidden />
              {t('box.send')}
            </Button>
          </div>
        </form>
      ) : (
        <div className="flex shrink-0 flex-col items-start gap-2 border-t border-border/60 pt-3 text-sm" data-copilot-offer>
          <p>
            {t(conv.over ? 'thread.over' : 'thread.full')} {t('thread.offer')}
          </p>
          <Button onClick={startNew} data-copilot-offer-new>
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            {t('thread.new')}
          </Button>
        </div>
      )}
    </div>
  )
}

/** The question as it was asked, under its `questionNo` once the server has numbered it. */
function Asked({ question, questionNo }: { question: string; questionNo: number | null }) {
  const { t } = useTranslation('copilot')
  return (
    <div className="text-sm">
      <div className="text-xs text-muted-foreground">
        {questionNo !== null ? (
          <span data-copilot-turn-no>
            {t('thread.questionNo')} <Ltr>{formatNumber(questionNo)}</Ltr>
          </span>
        ) : (
          t('answer.question')
        )}
      </div>
      <div data-copilot-asked>
        <p className="whitespace-pre-line">
          <bdi>{question}</bdi>
        </p>
      </div>
    </div>
  )
}

/** One question in the thread, with its answer or its refusal. `cannot-answer` is not an error. */
function Turn({ turn }: { turn: CopilotTurn }) {
  const { t } = useTranslation('copilot')
  const outcome = turn.reply ? (turn.reply.outcome ?? 'answered') : 'refused'
  return (
    <li className="flex flex-col gap-2" data-copilot-turn data-copilot-outcome={outcome}>
      <Asked question={turn.question} questionNo={turn.questionNo} />
      {!turn.reply ? (
        <Refusal err={turn.refusal} />
      ) : outcome === 'cannot-answer' ? (
        <div
          className="flex flex-col gap-1.5 rounded-lg border border-dashed border-border bg-muted/40 px-3 py-2"
          data-copilot-cannot-answer
        >
          <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
            <HelpCircle className="h-3.5 w-3.5" aria-hidden />
            {t('answer.cannotAnswer')}
          </div>
          <Answer model={copilotAnswerModel(turn.reply)} />
        </div>
      ) : (
        <Answer model={copilotAnswerModel(turn.reply)} />
      )}
    </li>
  )
}

/** One answer's body (ticket 735), then its trace, `servedBy` and stopped-early note (736). */
function Answer({ model }: { model: CopilotAnswerModel }) {
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
      <AnswerProvenance trace={model.trace} stoppedEarly={model.stoppedEarly} servedBy={model.servedBy} />
    </>
  )
}

/**
 * A refusal in its own words (D7), never its raw code. A code without words here is the server's own
 * message — free text, so a `<bdi>`. 402's reset time is a machine value: `Ltr`, through a `<Trans>` slot.
 */
function Refusal({ err }: { err: unknown }) {
  const { t } = useTranslation('copilot')
  const view = copilotRefusal(err, t('failed'))
  return (
    <div
      role="alert"
      data-copilot-refusal
      className="rounded-lg border border-danger-border bg-danger-050 px-3 py-2 text-[0.8125rem] text-danger-800"
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
  if (block.kind === 'list')
    return (
      <ul className="list-disc ps-5">
        {block.items.map((item, i) => (
          <li key={i}>
            <bdi>
              <LinkedText text={item} orderRefs={orderRefs} />
            </bdi>
          </li>
        ))}
      </ul>
    )
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
