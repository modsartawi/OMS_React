import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Play } from 'lucide-react'

import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import { localAsOf, type PlaygroundEvaluateBody } from '@/core/insurance-rules/playground'
import { DeniedCard, Loading } from '@/core/insurance-rules/parts'
import Button from '@/core/ui/Button'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Ltr from '@/core/ui/Ltr'
import { playgroundApi } from './api'
import { evaluateBody, SEED_DATA_TEXT, SEED_DOCUMENT_TEXT, type ExperimentBox } from './experiment'
import { JsonPane } from './JsonPane'
import OutcomePane from './OutcomePane'
import { outcomeView } from './outcome'
import { readsView } from './reads'

/**
 * Insurance rules ▸ Playground — `/insurance-rules/playground` (BackOffice spec 3243, door 3244; oms ticket 677).
 * Three panes: **Data** (the door's `data`, engine shape, as JSON) | **Rule** (a scratch mini-ruleset `document`, as
 * JSON) | **Outcome** (what the engine saw: matched lines or "nothing matched", and the trace). **Run** sends
 * `POST InsuranceRules/Playground/Evaluate` with `asOf` = local now. Writes nothing, never saves back.
 *
 * The page only wires the panes; each pane owns its drawing (`JsonPane`, `OutcomePane`) and the reply is read by the
 * pure `outcomeView`, so 678 (auto-run, kind, as of), 679 (editors beside the JSON) and 682 (form ⇄ JSON) each
 * replace one pane's insides without touching the others.
 *
 * 🚩 UNGATED like the rest of the group (607 ruling): no probe answers the grant yet; a bare 403 is said in words. 691 gates it.
 */
export default function PlaygroundPage() {
  const { t } = useTranslation('insurance-playground')
  const [dataText, setDataText] = useState(SEED_DATA_TEXT)
  const [documentText, setDocumentText] = useState(SEED_DOCUMENT_TEXT)
  const [problems, setProblems] = useState<ExperimentBox[]>([])
  const run = useMutation({ mutationFn: (body: PlaygroundEvaluateBody) => playgroundApi.evaluate(body) })

  const submit = () => {
    const r = evaluateBody({ dataText, documentText, asOf: localAsOf(new Date()) })
    setProblems(r.problems)
    if (r.body) run.mutate(r.body)
  }

  return (
    <section className="flex w-full flex-col gap-4" data-playground-page="">
      <header className="flex flex-wrap items-start gap-3">
        <div className="max-w-3xl">
          <h1 className="text-lg font-semibold tracking-tight">{t('title')}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t('lede')}</p>
        </div>
        <Button variant="primary" className="ms-auto" onClick={submit} disabled={run.isPending} data-run="">
          <Play className="h-4 w-4" aria-hidden />
          {run.isPending ? t('run.running') : t('run.run')}
        </Button>
      </header>

      <div className="grid min-w-0 gap-4 xl:grid-cols-3">
        <JsonPane box="data" title={t('data.title')} hint={t('data.hint')} value={dataText} onChange={setDataText} invalid={problems.includes('data')} />
        <JsonPane box="document" title={t('rule.title')} hint={t('rule.hint')} value={documentText} onChange={setDocumentText} invalid={problems.includes('document')} />

        <section className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card p-4" data-pane="outcome">
          <h2 className="text-base font-semibold tracking-tight">{t('outcome.title')}</h2>
          {run.isError && isBareDenial(run.error) ? (
            <DeniedCard ns="insurance-playground" hook="playground-denied" />
          ) : run.isError ? (
            <ErrorBanner className="p-3" title={t('outcome.refused')} message={apiErrorMessage(run.error, t('outcome.failed'))}>
              {apiErrorCode(run.error) && (
                <span className="text-xs" data-refusal-code={apiErrorCode(run.error)}>
                  <Ltr>{apiErrorCode(run.error)}</Ltr>
                </span>
              )}
            </ErrorBanner>
          ) : run.isPending ? (
            <Loading text={t('run.running')} />
          ) : run.isSuccess ? (
            <OutcomePane view={outcomeView(run.data)} reads={readsView(run.data, (run.variables?.document as { fields?: unknown } | undefined)?.fields)} />
          ) : (
            <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground" data-outcome-empty="">
              {t('outcome.empty')}
            </p>
          )}
        </section>
      </div>
    </section>
  )
}
