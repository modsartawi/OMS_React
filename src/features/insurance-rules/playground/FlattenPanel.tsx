import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { apiErrorCode, apiErrorMessage, isBareDenial } from '@/core/api'
import Button from '@/core/ui/Button'
import Chip from '@/core/ui/Chip'
import ErrorBanner from '@/core/ui/ErrorBanner'
import Field from '@/core/ui/Field'
import Input from '@/core/ui/Input'
import Ltr from '@/core/ui/Ltr'
import Textarea from '@/core/ui/Textarea'
import { playgroundApi } from './api'
import { FACT_TYPES } from './data-form'
import { applyFacts, FLATTEN_SOURCES, flattenBody, flattenFactsIn, type FlattenFact, type FlattenSource } from './flatten'

const KNOWN_TYPES = new Set<string>(FACT_TYPES)

/** A fact's value as text (a flag reads true / false); the payer's unit beside it, one machine value. */
const valueText = (f: FlattenFact) => {
  const v = f.value === null || f.value === undefined ? '' : typeof f.value === 'object' ? JSON.stringify(f.value) : String(f.value)
  return f.unit ? `${v} ${f.unit}` : v
}

/**
 * The Data pane's Flatten panel (ticket 685; door 3247): paste a payer's raw eligibility answer, pick the payer, give
 * the member id and policy if wanted, and **Flatten** shows the facts HQ reads from it. **Use these facts** replaces
 * the experiment's eligibility facts with them, once (`applyFacts`): an edit made afterwards is the data's own, and a
 * later Flatten changes nothing until Use is pressed again. An answer that is not JSON is said and never sent.
 */
export function FlattenPanel({ dataText, onDataText }: { dataText: string; onDataText: (text: string) => void }) {
  const { t } = useTranslation('insurance-playground')
  const [source, setSource] = useState<FlattenSource>('nphies')
  const [response, setResponse] = useState('')
  const [memberId, setMemberId] = useState('')
  const [policy, setPolicy] = useState('')
  const [invalid, setInvalid] = useState(false)
  const [used, setUsed] = useState<'used' | 'dataInvalid' | null>(null)
  const flatten = useMutation({
    mutationFn: playgroundApi.flatten,
    onMutate: () => setUsed(null),
  })
  const facts = flatten.data !== undefined ? flattenFactsIn(flatten.data) : null

  const run = () => {
    const built = flattenBody({ source, response, memberId, policy })
    setInvalid('problem' in built)
    if ('body' in built) flatten.mutate(built.body)
  }
  const use = () => {
    if (!facts) return
    const r = applyFacts(dataText, facts)
    if ('text' in r) onDataText(r.text)
    setUsed('text' in r ? 'used' : 'dataInvalid')
  }
  const error = flatten.error

  return (
    <section className="flex flex-col gap-3 rounded-md border border-border/60 p-3" aria-labelledby="playground-flatten-title" data-flatten="">
      <header>
        <h3 id="playground-flatten-title" className="text-sm font-semibold">
          {t('flatten.title')}
        </h3>
        <p className="text-xs text-muted-foreground">{t('flatten.hint')}</p>
      </header>
      <div className="flex flex-wrap items-end gap-3">
        <div className="flex flex-col gap-1">
          <span id="playground-flatten-source" className="text-xs font-medium text-muted-foreground">
            {t('flatten.source')}
          </span>
          <div role="group" aria-labelledby="playground-flatten-source" className="flex gap-1" data-flatten-source={source}>
            {FLATTEN_SOURCES.map((s) => (
              <Chip key={s} on={s === source} onClick={() => setSource(s)} data-flatten-source-pick={s}>
                {t(`flatten.sources.${s}`)}
              </Chip>
            ))}
          </div>
        </div>
        <Field label={t('flatten.memberId')}>
          <Input dir="ltr" className="font-mono" spellCheck={false} value={memberId} onChange={(e) => setMemberId(e.target.value)} data-flatten-member="" />
        </Field>
        <Field label={t('flatten.policy')}>
          <Input dir="ltr" className="font-mono" spellCheck={false} value={policy} onChange={(e) => setPolicy(e.target.value)} data-flatten-policy="" />
        </Field>
      </div>
      <Field label={t('flatten.response')} hint={t('flatten.responseHint')} invalid={invalid}>
        <Textarea
          className="min-h-32 w-full font-mono text-xs"
          dir="ltr"
          spellCheck={false}
          value={response}
          onChange={(e) => {
            setResponse(e.target.value)
            setInvalid(false)
          }}
          data-flatten-response=""
        />
      </Field>
      {invalid && (
        <p className="text-xs text-danger-800" role="alert" data-flatten-problem="invalid">
          {t('flatten.invalid')}
        </p>
      )}
      <Button variant="secondary" className="w-fit" onClick={run} disabled={flatten.isPending} data-flatten-run="">
        {flatten.isPending ? t('flatten.running') : t('flatten.run')}
      </Button>

      {error && isBareDenial(error) ? (
        <ErrorBanner className="p-3" message={t('flatten.denied')} />
      ) : error ? (
        <ErrorBanner className="p-3" title={t('flatten.refused')} message={apiErrorMessage(error, t('flatten.failed'))}>
          {apiErrorCode(error) && (
            <span className="text-xs" data-flatten-refusal={apiErrorCode(error)}>
              <Ltr>{apiErrorCode(error)}</Ltr>
            </span>
          )}
        </ErrorBanner>
      ) : facts && !flatten.isPending ? (
        <div className="flex flex-col gap-2" data-flatten-facts={facts.length}>
          <h4 className="text-xs font-medium text-muted-foreground">{t('flatten.facts')}</h4>
          {facts.length === 0 ? (
            <p className="text-xs text-muted-foreground" data-flatten-none="">
              {t('flatten.none')}
            </p>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="text-muted-foreground">
                  <th className="pe-2 text-start font-medium">{t('flatten.key')}</th>
                  <th className="pe-2 text-start font-medium">{t('flatten.type')}</th>
                  <th className="text-start font-medium">{t('flatten.value')}</th>
                </tr>
              </thead>
              <tbody>
                {facts.map((f) => (
                  <tr key={f.key} className="border-t border-border/40" data-flatten-fact={f.key}>
                    <td className="pe-2 font-mono" data-flatten-fact-key="">
                      <Ltr>{f.key}</Ltr>
                    </td>
                    <td className="pe-2" data-flatten-fact-type={f.type}>
                      {KNOWN_TYPES.has(f.type) ? t(`data.form.types.${f.type}`) : <Ltr>{f.type}</Ltr>}
                    </td>
                    <td className="font-mono" data-flatten-fact-value="">
                      <Ltr>{valueText(f)}</Ltr>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <Button className="w-fit" onClick={use} aria-describedby="playground-flatten-use-hint" data-flatten-use="">
              {t('flatten.use')}
            </Button>
            <span id="playground-flatten-use-hint" className="text-xs text-muted-foreground">
              {t('flatten.useHint')}
            </span>
          </div>
          {used && (
            <p className={`text-xs ${used === 'used' ? 'text-muted-foreground' : 'text-danger-800'}`} role="status" data-flatten-used={used}>
              {t(`flatten.${used}`)}
            </p>
          )}
        </div>
      ) : null}
    </section>
  )
}
