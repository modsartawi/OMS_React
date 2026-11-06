import { useEffect, useLayoutEffect, useRef, useState, type FormEvent, type KeyboardEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { History, HelpCircle, Loader2, MessageSquarePlus, Send, Sparkles, X } from 'lucide-react'
import Button from '@/core/ui/Button'
import Field from '@/core/ui/Field'
import IconButton from '@/core/ui/IconButton'
import Ltr from '@/core/ui/Ltr'
import Textarea from '@/core/ui/Textarea'
import { useCopilotPanel } from '@/core/copilot-panel'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { formatNumber } from '@/core/util/number-format'
import { COPILOT_MAX_QUESTION, copilotAnswerModel, questionFits } from './answer'
import { COPILOT_MAX_QUESTIONS, canAskMore, type CopilotConversation, type CopilotTurn } from './conversation'
import { Answer, Refusal, WorkingStep } from './AnswerParts'
import { useCopilotConversation, type PastConversation } from './conversation-store'
import { DEMO_ORDER_NO, lateExample } from './demo'

/** How close to the end of the thread still counts as "at the end" (px), so new content keeps it there. */
const AT_END = 32

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
 *
 * The question in flight is the store's, not this panel's (review item 2): every mounted panel shows
 * it and locks its box, and its reply lands even when this panel has unmounted. "New conversation"
 * stays open while it is in flight: it abandons the question, whose late reply is then dropped.
 *
 * Ticket 782: a question handed over through the shell's opener (`@/core/copilot-panel`, the ask box
 * on `/analytics`) is taken ONCE and sent through this same conversation. When it cannot be sent now
 * (one in flight, the conversation closed, too long) it waits in the box instead of being lost.
 *
 * CTO demo pass:
 * - The thread opens at its end, and stays there while answers' charts load, until the user scrolls up. A question
 *   sent scrolls to it; an answer that lands scrolls to its start, so a long one is read from the top.
 * - Each turn is set apart: its number on a rule, the question as a bubble on the inline end, the answer as a card.
 * - Past conversations (`history`): beside the thread when the panel is `wide` (full view, `/copilot`), behind a
 *   History toggle otherwise. Opening one brings it back as the conversation.
 */
export default function CopilotPanel({ wide = false }: { wide?: boolean }) {
  const { t } = useTranslation('copilot')
  const [question, setQuestion] = useState('')
  const [showHistory, setShowHistory] = useState(false)
  // Held in the store, not here: the sheet unmounts the panel when an order link navigates (736).
  const conv = useCopilotConversation((s) => s.conv)
  const pending = useCopilotConversation((s) => s.pending)
  const epoch = useCopilotConversation((s) => s.epoch)
  const history = useCopilotConversation((s) => s.history)
  const ask = useCopilotConversation((s) => s.ask)
  const clear = useCopilotConversation((s) => s.startNew)
  const resume = useCopilotConversation((s) => s.resume)
  const box = useRef<HTMLTextAreaElement>(null)
  const working = pending !== null

  const handed = useCopilotPanel((s) => s.question)
  useEffect(() => {
    if (handed === null) return
    const q = useCopilotPanel.getState().takeQuestion()
    if (q === null) return
    if (!questionFits(q) || ask(q) === null) setQuestion(q)
  }, [handed, ask])

  // ── Where the thread is scrolled ───────────────────────────────────────────────────────────────
  const scroller = useRef<HTMLDivElement>(null)
  const content = useRef<HTMLDivElement>(null)
  /** Following the end: true on open and after a question is sent, false once the user scrolls up. */
  const stick = useRef(true)
  const toEnd = () => {
    const el = scroller.current
    if (el) el.scrollTop = el.scrollHeight
  }
  const turnCount = conv.turns.length
  const seen = useRef(turnCount)
  const listing = showHistory && !wide
  // Opening the panel, a new conversation, one brought back from the history, or back from the list: start at its end.
  useLayoutEffect(() => {
    stick.current = true
    seen.current = turnCount
    toEnd()
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only when the conversation itself changes
  }, [epoch, listing])
  // A question sent: follow it to the end, where it waits.
  useLayoutEffect(() => {
    if (pending === null) return
    stick.current = true
    toEnd()
  }, [pending])
  // An answer landed: show it from its start.
  useLayoutEffect(() => {
    if (turnCount > seen.current) {
      const turns = content.current?.querySelectorAll<HTMLElement>('[data-copilot-turn]')
      const last = turns?.[turns.length - 1]
      const el = scroller.current
      if (last && el) {
        el.scrollTop = Math.max(0, last.offsetTop - 8)
        stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < AT_END
      }
    }
    seen.current = turnCount
  }, [turnCount])
  // Answers draw their charts after they mount: while following the end, keep to it as they grow.
  useEffect(() => {
    const inner = content.current
    if (!inner || typeof ResizeObserver === 'undefined') return
    const watch = new ResizeObserver(() => {
      if (stick.current) toEnd()
    })
    watch.observe(inner)
    return () => watch.disconnect()
  }, [listing])
  const onScroll = () => {
    const el = scroller.current
    if (el) stick.current = el.scrollHeight - el.scrollTop - el.clientHeight < AT_END
  }

  const tooLong = question.length > COPILOT_MAX_QUESTION
  const canSend = questionFits(question) && !working

  const send = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    if (ask(question.trim()) !== null) setQuestion('')
    // Sent by the Send button, the focus sits on a button that is now disabled: give it back to the box.
    box.current?.focus()
  }
  /** "New conversation": no id, no thread, nothing in flight, an empty box. The one left goes to the history. */
  const startNew = () => {
    clear()
    setQuestion('')
    setShowHistory(false)
    requestAnimationFrame(() => box.current?.focus())
  }
  const open = (index: number) => {
    resume(index)
    setShowHistory(false)
  }
  const onKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      send()
    }
  }

  /** An example fills the box; the order placeholder is selected, so typing the number replaces it. */
  const fillExample = (text: string, select: string | null) => {
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

  const empty = conv.turns.length === 0 && !working
  const canAsk = canAskMore(conv)
  const late = lateExample(DEMO_ORDER_NO, t('examples.latePlaceholder'))

  return (
    <div className="flex min-h-0 flex-1 gap-4" data-copilot-panel data-copilot-wide={wide ? 'yes' : 'no'}>
      {wide && (
        <aside className="flex w-64 shrink-0 flex-col gap-2 border-e border-border/60 pe-4" data-copilot-history-aside>
          <Button variant="secondary" onClick={startNew} disabled={empty} data-copilot-new>
            <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
            {t('thread.new')}
          </Button>
          <HistoryList current={empty ? null : conv} history={history} onOpen={open} />
        </aside>
      )}

      <div className={`flex min-h-0 min-w-0 flex-1 flex-col gap-3 ${wide ? 'mx-auto max-w-4xl' : ''}`}>
        {(!empty || history.length > 0) && !wide && (
          <div className="flex shrink-0 items-center justify-between gap-2" data-copilot-thread-bar>
            <div className="text-xs font-medium text-muted-foreground">{listing ? t('history.heading') : t('thread.heading')}</div>
            <div className="flex items-center gap-1">
              {history.length > 0 && (
                <Button variant="ghost" onClick={() => setShowHistory((v) => !v)} aria-pressed={showHistory} data-copilot-history-toggle>
                  <History className="h-3.5 w-3.5" aria-hidden />
                  {listing ? t('history.back') : t('history.open', { n: fsi(formatNumber(history.length)) })}
                </Button>
              )}
              {!empty && (
                <Button variant="ghost" onClick={startNew} data-copilot-new>
                  <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
                  {t('thread.new')}
                </Button>
              )}
            </div>
          </div>
        )}

        {listing ? (
          <div className="min-h-0 flex-1 overflow-y-auto">
            <HistoryList current={null} history={history} onOpen={open} titled={false} />
          </div>
        ) : (
          <div
            ref={scroller}
            onScroll={onScroll}
            className="relative min-h-0 flex-1 overflow-y-auto rounded-xl border border-primary-border/60 bg-primary-050 p-3"
            data-copilot-scroller
          >
            <div ref={content} className="flex flex-col gap-4">
              {empty && (
                <div data-copilot-examples className="flex flex-col gap-2">
                  <div className="text-xs font-medium text-muted-foreground">{t('examples.heading')}</div>
                  <div className="flex flex-col items-start gap-1.5">
                    {/* The example IS the question the box will send, so its order number is not isolated with
                        `fsi`: those characters would ride into the question. The label is a `<bdi>` instead. */}
                    {[
                      { text: t('examples.late', { orderNo: late.orderNo }), select: late.select },
                      { text: t('examples.hungerstation'), select: null },
                    ].map((ex) => (
                      <Button
                        key={ex.text}
                        variant="secondary"
                        className="h-auto min-h-7 py-1 text-start"
                        data-copilot-example
                        onClick={() => fillExample(ex.text, ex.select)}
                      >
                        <Sparkles className="h-3.5 w-3.5 shrink-0" aria-hidden />
                        <span>
                          <bdi>{ex.text}</bdi>
                        </span>
                      </Button>
                    ))}
                  </div>
                </div>
              )}

              {conv.turns.length > 0 && (
                <ol className="flex flex-col gap-5" data-copilot-thread>
                  {conv.turns.map((turn, i) => (
                    <Turn key={i} turn={turn} />
                  ))}
                </ol>
              )}

              {working && (
                <div className="flex flex-col gap-3" data-copilot-pending>
                  <TurnRule label={t('answer.question')} />
                  <Asked question={pending} />
                  <AnswerRow>
                    <div role="status" data-copilot-working className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                      {t('working')}
                      <WorkingStep />
                    </div>
                  </AnswerRow>
                </div>
              )}
            </div>
          </div>
        )}

        {listing ? null : canAsk ? (
          <form onSubmit={send} className="flex shrink-0 flex-col gap-2" data-copilot-form>
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
                // Never disabled while an answer is out: disabling the focused box drops the focus to the page.
                // The next question can be typed meanwhile; Send (and Enter) wait for the answer.
                aria-busy={working || undefined}
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
          <div className="flex shrink-0 flex-col items-start gap-2 text-sm" data-copilot-offer>
            <p>
              {conv.over ? t('thread.over') : t('thread.full', { max: fsi(formatNumber(COPILOT_MAX_QUESTIONS)) })} {t('thread.offer')}
            </p>
            <Button onClick={startNew} data-copilot-offer-new>
              <MessageSquarePlus className="h-3.5 w-3.5" aria-hidden />
              {t('thread.new')}
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}

/**
 * The past conversations, most recent first: each by its first question, how many it asked and when it was left.
 * `current` (full view) heads the list, marked as the one open. Opening one brings it back; the X forgets it.
 */
function HistoryList({
  current,
  history,
  onOpen,
  titled = true,
}: {
  current: CopilotConversation | null
  history: readonly PastConversation[]
  onOpen: (index: number) => void
  /** Its own heading; off where the thread bar above already says it. */
  titled?: boolean
}) {
  const { t } = useTranslation('copilot')
  const forget = useCopilotConversation((s) => s.forget)
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-1 overflow-y-auto" data-copilot-history>
      {titled && <div className="px-1 text-xs font-medium text-muted-foreground">{t('history.heading')}</div>}
      {current && (
        <div className="rounded-lg bg-primary-050 px-3 py-2 ring-1 ring-primary-border" data-copilot-history-current>
          <div className="text-[11px] font-semibold text-primary-800">{t('history.current')}</div>
          <div className="truncate text-sm">
            <bdi>{current.turns[0]?.question ?? ''}</bdi>
          </div>
        </div>
      )}
      {history.length === 0 && <p className="px-1 text-xs text-muted-foreground">{t('history.none')}</p>}
      <ul className="flex flex-col gap-1">
        {history.map((p, i) => (
          <li key={`${p.at}-${i}`} className="group flex items-start gap-1" data-copilot-history-item>
            <Button
              variant="ghost"
              className="h-auto min-w-0 flex-1 flex-col items-start gap-0.5 rounded-lg py-2 text-start"
              onClick={() => onOpen(i)}
            >
              <span className="w-full truncate text-sm font-normal text-foreground">
                <bdi>{p.conv.turns[0]?.question ?? ''}</bdi>
              </span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {t('history.questions', { count: p.conv.turns.length, n: fsi(formatNumber(p.conv.turns.length)) })}
                {' · '}
                <Ltr>{formatDateTime(new Date(p.at).toISOString())}</Ltr>
              </span>
            </Button>
            <IconButton
              label={t('history.forget')}
              onClick={() => forget(i)}
              className="mt-1.5 opacity-60 group-hover:opacity-100"
              data-copilot-forget
            >
              <X className="h-3.5 w-3.5" aria-hidden />
            </IconButton>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** The rule that opens a turn: its label ("Question 3") on a line across the thread. */
function TurnRule({ label }: { label: ReactNode }) {
  return (
    <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wide text-primary-800">
      <span className="shrink-0">{label}</span>
      <span className="h-px flex-1 bg-primary-border" aria-hidden />
    </div>
  )
}

/** The question as it was asked: a bubble on the inline end, in the primary tint. */
function Asked({ question }: { question: string }) {
  return (
    <div className="flex justify-end" data-copilot-asked>
      <p className="max-w-[85%] whitespace-pre-line rounded-2xl rounded-se-sm bg-primary px-3.5 py-2 text-sm text-primary-foreground shadow-sm">
        <bdi>{question}</bdi>
      </p>
    </div>
  )
}

/** The copilot's side of a turn: its mark, then the answer in a card (or, `plain`, a refusal in its own frame). */
function AnswerRow({ children, plain = false }: { children: ReactNode; plain?: boolean }) {
  return (
    <div className="flex items-start gap-2.5">
      <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-gold text-gold-foreground shadow-sm" aria-hidden>
        <Sparkles className="size-3.5" />
      </span>
      <div
        className={`flex min-w-0 flex-1 flex-col gap-2 ${plain ? '' : 'rounded-2xl rounded-ss-sm border border-primary-border bg-card px-3.5 py-2.5 shadow-sm'}`}
      >
        {children}
      </div>
    </div>
  )
}

/** One question in the thread, with its answer or its refusal. `cannot-answer` is not an error. */
function Turn({ turn }: { turn: CopilotTurn }) {
  const { t } = useTranslation('copilot')
  const outcome = turn.reply ? (turn.reply.outcome ?? 'answered') : 'refused'
  return (
    <li className="flex flex-col gap-3" data-copilot-turn data-copilot-outcome={outcome}>
      <TurnRule
        label={
          turn.questionNo !== null ? (
            <span data-copilot-turn-no>
              {t('thread.questionNo')} <Ltr>{formatNumber(turn.questionNo)}</Ltr>
            </span>
          ) : (
            t('answer.question')
          )
        }
      />
      <Asked question={turn.question} />
      {!turn.reply ? (
        <AnswerRow plain>
          <Refusal err={turn.refusal} />
        </AnswerRow>
      ) : outcome === 'cannot-answer' ? (
        <AnswerRow plain>
          <div
            className="flex flex-col gap-1.5 rounded-2xl rounded-ss-sm border border-dashed border-border bg-card/60 px-3.5 py-2.5"
            data-copilot-cannot-answer
          >
            <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
              <HelpCircle className="h-3.5 w-3.5" aria-hidden />
              {t('answer.cannotAnswer')}
            </div>
            <Answer model={copilotAnswerModel(turn.reply)} />
          </div>
        </AnswerRow>
      ) : (
        <AnswerRow>
          <Answer model={copilotAnswerModel(turn.reply)} />
        </AnswerRow>
      )}
    </li>
  )
}
