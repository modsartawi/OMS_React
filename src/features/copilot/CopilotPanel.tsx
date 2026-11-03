import { useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Loader2, Send, Sparkles } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Ltr from '@/core/ui/Ltr'
import Textarea from '@/core/ui/Textarea'
import { formatCount, fsi } from '@/core/util/bidi'
import { formatNumber } from '@/core/util/number-format'
import { copilotApi } from './api'
import { COPILOT_MAX_QUESTION, copilotAnswerModel, questionFits, type AnswerBlock } from './answer'
import { AnswerProvenance, LinkedText, WorkingStep } from './AnswerParts'

/**
 * The copilot panel (ticket 735, spec 734 D11) — the ONE body both the top bar's side sheet and the
 * `/copilot` page render: the two D12 examples while it is empty, the question box with its
 * 1,000-character limit, the working state for the whole (non-streaming) call, and the answer.
 *
 * The answer is free text from the model, in either script: every block's text is a `<bdi>` (bidi
 * rule). The count under the box is a machine value: `Ltr`, built as one string.
 */
export default function CopilotPanel() {
  const { t } = useTranslation('copilot')
  const [question, setQuestion] = useState('')
  const box = useRef<HTMLTextAreaElement>(null)
  const ask = useMutation({ mutationFn: (q: string) => copilotApi.ask({ question: q }) })

  const tooLong = question.length > COPILOT_MAX_QUESTION
  const canSend = questionFits(question) && !ask.isPending

  const send = (e?: FormEvent) => {
    e?.preventDefault()
    if (!canSend) return
    ask.mutate(question.trim())
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

  const empty = ask.isIdle
  const model = ask.isSuccess ? copilotAnswerModel(ask.data) : null

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3" data-copilot-panel>
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

        {!empty && ask.variables !== undefined && (
          <div className="text-sm" data-copilot-asked>
            <div className="text-xs text-muted-foreground">{t('answer.question')}</div>
            <p className="whitespace-pre-line">
              <bdi>{ask.variables}</bdi>
            </p>
          </div>
        )}

        {ask.isPending && (
          <div role="status" data-copilot-working className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
            {t('working')}
            <WorkingStep />
          </div>
        )}

        {ask.isError && <ErrorBanner message={apiErrorMessage(ask.error, t('failed'))} className="px-3 py-2" />}

        {model && (
          <section data-copilot-answer aria-label={t('answer.heading')} className="flex flex-col gap-2 text-sm">
            {model.blocks.length === 0 ? (
              <p className="text-muted-foreground">{t('answer.empty')}</p>
            ) : (
              model.blocks.map((b, i) => <Block key={i} block={b} orderRefs={model.orderRefs} />)
            )}
          </section>
        )}
        {model && <AnswerProvenance trace={model.trace} stoppedEarly={model.stoppedEarly} servedBy={model.servedBy} />}
      </div>

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
