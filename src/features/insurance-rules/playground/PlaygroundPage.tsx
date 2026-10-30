import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import type { PlaygroundExperiment } from '@/core/insurance-rules/experiment'
import { localAsOf, PLAYGROUND_KINDS, type PlaygroundEvaluateBody, type PlaygroundEvaluateReply, type PlaygroundKind } from '@/core/insurance-rules/playground'
import { DeniedCard, Loading } from '@/core/insurance-rules/parts'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import { playgroundApi } from './api'
import ComparePanel, { type CompareSeed } from './ComparePanel'
import { sideOf } from './compare-diff'
import { DataPane } from './DataPane'
import { evaluateBody, kindSeed, type DataTab } from './experiment'
import ExperimentBar from './ExperimentBar'
import { intakeView } from './intake'
import OutcomePane from './OutcomePane'
import { outcomeErrors, outcomeView, outcomeWithout } from './outcome'
import { readsView } from './reads'
import RulePane from './RulePane'
import { readRuleset, rulesetIssues } from './ruleset'
import { asOfText, latestWins, RUN_DELAY_MS, type LatestWins, type RunSettle } from './run'
import { verdictView } from './verdict'

/**
 * Insurance rules ▸ Playground — `/insurance-rules/playground` (BackOffice spec 3243, door 3244; oms tickets 677, 678).
 * Three panes: **Data** (the door's `data`, engine shape, as JSON) | **Rule** (a scratch mini-ruleset `document`, as
 * JSON, or a Raw text sent as it is — 684) | **Outcome** (Tab A what the engine saw: matched lines or "nothing
 * matched", and the trace; Tab B what the live check would say). Above them the experiment's **kind** (switching seeds
 * that kind's rule and data) and its **"as of"**. About 500 ms after the last edit to the data, the rule, the kind or
 * "as of", the experiment sends `POST InsuranceRules/Playground/Evaluate` by itself (678: no Run button); only the
 * NEWEST request's answer is shown (`latestWins`), and the last good outcome stays while one is in flight. Writes
 * nothing to HQ, never saves back; 687's `ExperimentBar` keeps experiments by name in this browser and as `.json`.
 *
 * The page only wires the panes; each pane owns its drawing (`JsonPane`, `OutcomePane`) and the reply is read by the
 * pure `outcomeView` / `verdictView`, so 679 (editors beside the JSON) and 682 (form ⇄ JSON) each replace one pane's
 * insides without touching the others.
 *
 * 🚩 UNGATED like the rest of the group (607 ruling): no probe answers the grant yet; a bare 403 is said in words. 691 gates it.
 */
export default function PlaygroundPage() {
  const { t } = useTranslation('insurance-playground')
  const [kind, setKind] = useState<PlaygroundKind>('guard')
  const [dataText, setDataText] = useState(() => kindSeed('guard').dataText)
  const [dataTab, setDataTab] = useState<DataTab>('json')
  const [rawText, setRawText] = useState('')
  const [documentText, setDocumentText] = useState(() => kindSeed('guard').documentText)
  // "As of": local now when the page opened; a cleared input falls back to that moment, never to a moving now.
  const [openedAt] = useState(() => new Date())
  const [asOfInput, setAsOfInput] = useState(() => localAsOf(openedAt))
  // 690: Compare (A/B). B is a copy of the boxes taken when Compare is turned on; leaving Compare keeps A.
  const [compareSeed, setCompareSeed] = useState<CompareSeed | null>(null)
  const asOf = asOfText(asOfInput, openedAt)

  const built = useMemo(
    () => evaluateBody({ dataText, documentText, asOf, kind, dataTab, rawText }),
    [dataText, documentText, asOf, kind, dataTab, rawText],
  )
  const [pending, setPending] = useState(false)
  const [settled, setSettled] = useState<RunSettle<Answer> | null>(null)
  const runner = useRef<LatestWins<PlaygroundEvaluateBody> | null>(null)

  useEffect(() => {
    const r = latestWins<PlaygroundEvaluateBody, Answer>({
      delayMs: RUN_DELAY_MS,
      run: async (body) => ({
        kind: body.kind,
        fields: (body.document as { fields?: unknown } | undefined)?.fields,
        reply: await playgroundApi.evaluate(body),
      }),
      onStart: () => setPending(true),
      onSettle: (s) => {
        setPending(false)
        setSettled(s)
      },
    })
    runner.current = r
    return () => {
      r.dispose()
      runner.current = null
    }
  }, [])
  // Every edit restarts the window; JSON that does not parse sends nothing.
  useEffect(() => runner.current?.edit(built.body), [built])

  const pickKind = (k: PlaygroundKind) => {
    if (k === kind) return
    const seed = kindSeed(k)
    setKind(k)
    setDataText(seed.dataText)
    setDocumentText(seed.documentText)
    // 690: comparing, B is copied afresh from the new kind's seed (the panel is keyed by kind)
    if (compareSeed) setCompareSeed({ dataTab, dataText: seed.dataText, rawText, documentText: seed.documentText })
  }

  // 687: an opened or imported experiment replaces the whole experiment (kind, as of, rule and data) at once.
  const loadExperiment = (e: PlaygroundExperiment) => {
    setKind(e.kind)
    setAsOfInput(e.asOf)
    setDocumentText(JSON.stringify(e.document, null, 2))
    if (e.raw !== undefined) {
      setDataTab('raw')
      setRawText(e.raw)
    } else {
      setDataTab('json')
      setDataText(JSON.stringify(e.data, null, 2))
    }
  }

  const error = settled && !settled.ok ? settled.error : null
  const answer = settled?.ok ? settled.value : null
  // 679: the reader's errors, asked for this kind, go on their block in the Rule pane; the rest stay in the outcome.
  const readerErrors = useMemo(() => (answer && answer.kind === kind ? outcomeErrors(answer.reply) : []), [answer, kind])
  const placed = useMemo(() => {
    const read = readRuleset(kind, documentText)
    return read.ok ? rulesetIssues(readerErrors, read.slots) : { perRule: [], rest: readerErrors }
  }, [kind, documentText, readerErrors])
  const onBlocks = readerErrors.length - placed.rest.length

  return (
    <section className="flex w-full flex-col gap-4" data-playground-page="">
      <header className="max-w-3xl">
        <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
      </header>

      <ExperimentBar body={built.body} onLoad={loadExperiment} />

      <div className="flex flex-wrap items-start gap-6" data-experiment-controls="">
        <div className="flex flex-col gap-1">
          <span id="playground-kind-label" className="text-xs font-medium text-muted-foreground">
            {t('kind.label')}
          </span>
          <div role="group" aria-labelledby="playground-kind-label" aria-describedby="playground-kind-hint" className="flex gap-1" data-kind-picker={kind}>
            {PLAYGROUND_KINDS.map((k) => (
              <Chip key={k} on={k === kind} onClick={() => pickKind(k)} data-kind={k}>
                {t(`kind.${k}`)}
              </Chip>
            ))}
          </div>
          <span id="playground-kind-hint" className="text-xs text-muted-foreground">
            {t('kind.hint')}
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="playground-as-of" className="text-xs font-medium text-muted-foreground">
            {t('asOf.label')}
          </label>
          <Input
            id="playground-as-of"
            type="datetime-local"
            step={1}
            dir="ltr"
            className="w-fit font-mono"
            value={asOfInput}
            onChange={(e) => setAsOfInput(e.target.value)}
            aria-describedby="playground-as-of-hint"
            data-as-of=""
          />
          <span id="playground-as-of-hint" className="flex flex-wrap gap-1 text-xs text-muted-foreground">
            <span>{t('asOf.hint')}</span>
            <span>{t('asOf.sent')}</span>
            <span className="font-mono" data-as-of-sent={asOf}>
              <Ltr>{asOf}</Ltr>
            </span>
          </span>
        </div>
        <Button
          variant="secondary"
          className="self-center"
          aria-pressed={compareSeed !== null}
          onClick={() => setCompareSeed(compareSeed ? null : { dataTab, dataText, rawText, documentText })}
          data-compare-toggle={compareSeed ? 'on' : 'off'}
        >
          {compareSeed ? t('compare.leave') : t('compare.start')}
        </Button>
      </div>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <DataPane tab={dataTab} onTab={setDataTab} dataText={dataText} onDataText={setDataText} rawText={rawText} onRawText={setRawText} invalid={built.problems.includes('data')} />
        <RulePane kind={kind} value={documentText} onChange={setDocumentText} invalid={built.problems.includes('document')} errors={readerErrors} />

        <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-pane="outcome" aria-busy={pending || undefined}>
          <header className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold tracking-tight">{t('outcome.title')}</h2>
            {pending && settled && (
              <span className="ms-auto text-xs text-muted-foreground" role="status" data-running="">
                {t('run.running')}
              </span>
            )}
          </header>
          {error && isBareDenial(error) ? (
            <DeniedCard ns="insurance-playground" hook="playground-denied" />
          ) : error ? (
            <ErrorBanner className="p-3" title={t('outcome.refused')} message={apiErrorMessage(error, t('outcome.failed'))}>
              {apiErrorCode(error) && (
                <span className="text-xs" data-refusal-code={apiErrorCode(error)}>
                  <Ltr>{apiErrorCode(error)}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ) : answer ? (
            <OutcomePane
              view={outcomeWithout(outcomeView(answer.reply), placed.rest)}
              onBlocks={onBlocks}
              verdict={verdictView(answer.kind, answer.reply?.verdict)}
              intake={intakeView(answer.reply?.intake)}
              reads={readsView(answer.reply, answer.fields)}
            />
          ) : pending ? (
            <Loading text={t('run.running')} />
          ) : (
            <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground" data-outcome-empty="">
              {t('outcome.empty')}
            </p>
          )}
        </section>
      </div>

      {compareSeed && (
        // keyed by kind: a kind switch seeds new boxes, so B is copied afresh
        <ComparePanel key={kind} seed={compareSeed} kind={kind} asOf={asOf} a={answer ? sideOf(answer.kind, answer.reply, answer.fields) : null} />
      )}
    </section>
  )
}

/** One answer and the kind it was asked for (Tab B reads the verdict as that kind, not the picker's current one). */
interface Answer {
  kind: PlaygroundKind
  /** The sent document's `fields` (686's read log reads their types). */
  fields: unknown
  reply: PlaygroundEvaluateReply | null
}
