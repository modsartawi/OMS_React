import { useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import type { PlaygroundEvaluateBody, PlaygroundKind } from '@/core/insurance-rules/playground'
import { TD, TH } from '@/core/insurance-rules/parts'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import Textarea from '@/core/ui/Textarea'
import { fsi } from '@/core/util/bidi'
import RefusalBanner from './RefusalBanner'
import { playgroundApi } from './api'
import { compareDiff, sideOf, type CompareLine, type CompareSide, type Mark, type Paired } from './compare-diff'
import { evaluateBody, type DataTab } from './boxes'
import { TraceValueBadge } from './OutcomePane'
import { Shown } from './ReadLog'
import type { ReadRow } from './reads'
import { latestWins, RUN_DELAY_MS, type LatestWins, type RunSettle } from './run'
import VerdictPane from './VerdictPane'

/** The experiment's boxes at the moment Compare was turned on: B starts as a copy of them. */
export interface CompareSeed {
  dataTab: DataTab
  dataText: string
  rawText: string
  documentText: string
}

const HIGHLIGHT = 'bg-attention-050'
const lit = (m: Mark) => (m === 'same' ? '' : HIGHLIGHT)

/**
 * Compare (A/B), oms ticket 690. B is a copy of the experiment (A) taken when Compare was turned on; its data and rule
 * are edited here, while the kind and "as of" stay the experiment's (a kind switch makes a fresh copy — the page keys
 * this panel by kind). B runs through its own `latestWins`, beside A's, so the page makes TWO Evaluate calls. The two
 * outcomes are drawn side by side from `compareDiff`: a differing line, trace row, read row or verdict is highlighted,
 * and a row on one side only says so. Leaving Compare unmounts this panel: A stays the experiment, B is dropped.
 */
export default function ComparePanel({ seed, kind, asOf, a }: { seed: CompareSeed; kind: PlaygroundKind; asOf: string; a: CompareSide | null }) {
  const { t } = useTranslation('insurance-playground')
  const [raw] = useState(seed.dataTab === 'raw')
  const [dataText, setDataText] = useState(raw ? seed.rawText : seed.dataText)
  const [documentText, setDocumentText] = useState(seed.documentText)
  const built = useMemo(
    () => evaluateBody({ dataText: raw ? '' : dataText, documentText, asOf, kind, dataTab: raw ? 'raw' : 'json', rawText: raw ? dataText : '' }),
    [dataText, documentText, asOf, kind, raw],
  )

  const [pending, setPending] = useState(false)
  const [settled, setSettled] = useState<RunSettle<CompareSide> | null>(null)
  const runner = useRef<LatestWins<PlaygroundEvaluateBody> | null>(null)
  useEffect(() => {
    const r = latestWins<PlaygroundEvaluateBody, CompareSide>({
      delayMs: RUN_DELAY_MS,
      run: async (body) => sideOf(body.kind, await playgroundApi.evaluate(body), (body.document as { fields?: unknown } | undefined)?.fields),
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
  useEffect(() => runner.current?.edit(built.body), [built])

  const b = settled?.ok ? settled.value : null
  const error = settled && !settled.ok ? settled.error : null

  return (
    <section className="flex min-w-0 flex-col gap-4 rounded-lg border border-border/60 bg-card p-4" data-compare="" aria-busy={pending || undefined}>
      <header className="flex flex-wrap items-center gap-2">
        <h2 className="text-base font-semibold tracking-tight">{t('compare.title')}</h2>
        <p className="w-full text-xs text-muted-foreground">{t('compare.hint')}</p>
      </header>

      <div className="grid min-w-0 gap-4 lg:grid-cols-2">
        <BBox id="playground-b-data" box="data" label={raw ? t('compare.b.raw') : t('compare.b.data')} value={dataText} onChange={setDataText} invalid={built.problems.includes('data')} />
        <BBox id="playground-b-document" box="document" label={t('compare.b.rule')} value={documentText} onChange={setDocumentText} invalid={built.problems.includes('document')} />
      </div>

      {error ? (
        <RefusalBanner error={error} title={t('compare.b.refused')} fallback={t('outcome.failed')} />
      ) : a && b ? (
        <SideBySide a={a} b={b} />
      ) : (
        <p className="rounded-md border border-dashed border-border/60 p-4 text-sm text-muted-foreground" data-compare-waiting="">
          {t('compare.waiting')}
        </p>
      )}
    </section>
  )
}

function BBox({ id, box, label, value, onChange, invalid }: { id: string; box: 'data' | 'document'; label: string; value: string; onChange: (v: string) => void; invalid: boolean }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={id}
        className="min-h-64 w-full font-mono text-xs"
        dir="ltr"
        spellCheck={false}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={invalid ? true : undefined}
        data-b-box={box}
      />
      {invalid && (
        <p className="text-xs text-danger-800" role="alert" data-b-problem={box}>
          {t(`json.problem.${box}`)}
        </p>
      )}
    </div>
  )
}

function SideBySide({ a, b }: { a: CompareSide; b: CompareSide }) {
  const { t } = useTranslation('insurance-playground')
  const diff = useMemo(() => compareDiff(a, b), [a, b])
  return (
    <div className="flex flex-col gap-4" data-compare-diff={diff.same ? 'same' : 'differs'}>
      <p className={`rounded-md border border-border/60 px-3 py-2 text-sm ${diff.same ? '' : HIGHLIGHT}`} data-compare-summary="">
        {diff.same ? t('compare.same') : t('compare.differs')}
      </p>
      {(a.view.kind === 'errors' || b.view.kind === 'errors') && (
        <div className="grid gap-2 sm:grid-cols-2">
          {(['a', 'b'] as const).map((s) => (
            <p key={s} className="text-sm" data-compare-errors={diff[s].view.kind === 'errors' ? s : undefined}>
              <span className="font-medium">{t(`compare.side.${s}`)}</span> {diff[s].view.kind === 'errors' && t('outcome.errors.title')}
            </p>
          ))}
        </div>
      )}
      {diff.lines.map((l) => (
        <LinePair key={l.line} line={l} />
      ))}
      <section className="flex flex-col gap-2 border-t border-border/60 pt-3" data-compare-verdict={diff.verdict.mark}>
        <header className="flex flex-wrap items-center gap-2">
          <h3 className="text-sm font-semibold">{t('compare.verdict')}</h3>
          <MarkBadge mark={diff.verdict.mark} />
        </header>
        <div className={`grid gap-4 rounded-md p-2 sm:grid-cols-2 ${lit(diff.verdict.mark)}`}>
          {(['a', 'b'] as const).map((s) => (
            <div key={s} className="flex min-w-0 flex-col gap-2" data-compare-verdict-side={s}>
              <span className="text-xs font-medium text-muted-foreground">{t(`compare.side.${s}`)}</span>
              <VerdictPane view={diff[s].verdict} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

/** Same: nothing. Differs / one side only: says so. */
function MarkBadge({ mark }: { mark: Mark }) {
  const { t } = useTranslation('insurance-playground')
  if (mark === 'same') return null
  return (
    <span data-mark={mark}>
      <StatusBadge sev="warn">{t(`compare.mark.${mark}`)}</StatusBadge>
    </span>
  )
}

function Absent() {
  const { t } = useTranslation('insurance-playground')
  return (
    <span className="text-muted-foreground" data-absent="">
      {t('compare.absent')}
    </span>
  )
}

function LinePair({ line }: { line: CompareLine }) {
  const { t } = useTranslation('insurance-playground')
  const matched = (m: boolean | undefined) => (m === undefined ? <Absent /> : <StatusBadge sev={m ? 'go' : 'mute'}>{m ? t('outcome.matched') : t('outcome.notMatched')}</StatusBadge>)
  return (
    <article className="flex flex-col gap-2 border-t border-border/60 pt-3" data-compare-line={line.line} data-diff={line.mark}>
      <header className={`grid items-center gap-2 rounded-md px-2 py-1 sm:grid-cols-[1fr_1fr_1fr] ${lit(line.mark)}`}>
        <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
          {t('outcome.line', { n: fsi(line.line) })}
          <MarkBadge mark={line.mark} />
        </span>
        <span className="flex items-center gap-1 text-xs" data-side="a">
          <span className="text-muted-foreground">{t('compare.side.a')}</span> {matched(line.a?.matched)}
        </span>
        <span className="flex items-center gap-1 text-xs" data-side="b">
          <span className="text-muted-foreground">{t('compare.side.b')}</span> {matched(line.b?.matched)}
        </span>
      </header>
      {line.trace.length > 0 && (
        <table className="w-full text-xs" data-compare-trace="">
          <thead>
            <tr>
              <th className={TH}>{t('trace.rule')}</th>
              <th className={TH}>{t('trace.block')}</th>
              <th className={TH}>{t('compare.side.a')}</th>
              <th className={TH}>{t('compare.side.b')}</th>
              <th className={TH}>
                <span className="sr-only">{t('compare.markLabel')}</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {line.trace.map((r) => {
              const row = (r.a ?? r.b)!
              return (
                <tr key={r.key} className={lit(r.mark)} data-compare-trace-row={r.key} data-diff={r.mark}>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{row.ruleId}</Ltr>
                  </td>
                  <td className={`${TD} font-mono`}>
                    <Ltr>{row.blockPath}</Ltr>
                  </td>
                  <td className={TD} data-side="a">
                    {r.a ? <TraceValueBadge value={r.a.value} /> : <Absent />}
                  </td>
                  <td className={TD} data-side="b">
                    {r.b ? <TraceValueBadge value={r.b.value} /> : <Absent />}
                  </td>
                  <td className={TD}>
                    <MarkBadge mark={r.mark} />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      )}
      {line.reads.length > 0 && <ReadPairs rows={line.reads} />}
    </article>
  )
}

function ReadPairs({ rows }: { rows: Paired<ReadRow>[] }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <table className="w-full text-xs" data-compare-reads="">
      <thead>
        <tr>
          <th className={TH}>{t('reads.rule')}</th>
          <th className={TH}>{t('reads.fact')}</th>
          <th className={TH}>{t('compare.side.a')}</th>
          <th className={TH}>{t('compare.side.b')}</th>
          <th className={TH}>
            <span className="sr-only">{t('compare.markLabel')}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {rows.map((r) => {
          const row = (r.a ?? r.b)!
          return (
            <tr key={r.key} className={lit(r.mark)} data-compare-read-row={r.key} data-diff={r.mark}>
              <td className={`${TD} font-mono`}>
                <Ltr>{row.ruleId}</Ltr>
              </td>
              <td className={`${TD} font-mono`}>
                <Ltr>{row.path}</Ltr>
              </td>
              <td className={TD} data-side="a">
                {r.a ? <Shown shown={r.a.shown} /> : <Absent />}
              </td>
              <td className={TD} data-side="b">
                {r.b ? <Shown shown={r.b.shown} /> : <Absent />}
              </td>
              <td className={TD}>
                <MarkBadge mark={r.mark} />
              </td>
            </tr>
          )
        })}
      </tbody>
    </table>
  )
}
