import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import Chip from '@/core/ui/Chip'
import Ltr from '@/core/ui/Ltr'
import type { Severity } from '@/core/ui/severity'
import StatusBadge from '@/core/ui/StatusBadge'
import { fsi } from '@/core/util/bidi'
import { TD, TH } from '@/core/insurance-rules/parts'
import type { PlaygroundTraceValue } from '@/core/insurance-rules/playground'
import type { IntakeView } from './intake'
import IntakeReport from './IntakeReport'
import type { LineView, OutcomeView } from './outcome'
import { explain } from './explain'
import ExplainParagraph from './ExplainParagraph'
import ReadLog from './ReadLog'
import type { ReadsView } from './reads'
import type { VerdictView } from './verdict'
import VerdictPane from './VerdictPane'

const TAB_ID = 'playground-outcome-saw'
const LIVE_TAB_ID = 'playground-outcome-live'
const NO_READS: ReadsView = { kind: 'none' }
export type OutcomeTab = 'saw' | 'live'

/**
 * The Outcome pane (ticket 677): Tab A, "What the engine saw" — the matched lines (or "nothing matched") and each
 * line's trace; or, when the reader refused the document, only its errors. Tab B (678), "What the live check would
 * say" — the reply's verdict, drawn by `VerdictPane`. It draws view models (`./outcome`, `./verdict`) and nothing of
 * the raw reply. 686 adds the read log and the explain paragraph to Tab A.
 * A Raw experiment's intake report (684) follows the lines on Tab A; null (a data experiment) draws nothing.
 */
export default function OutcomePane({
  view,
  verdict,
  intake = null,
  reads = NO_READS,
  onBlocks = 0,
}: {
  view: OutcomeView
  verdict: VerdictView
  intake?: IntakeView | null
  reads?: ReadsView
  /** How many reader errors the Rule pane shows on their block (679); the list here holds the rest. */
  onBlocks?: number
}) {
  const { t } = useTranslation('insurance-playground')
  const [tab, setTab] = useState<OutcomeTab>('saw')
  return (
    <div className="flex flex-col gap-3" data-outcome="">
      <div role="tablist" aria-label={t('outcome.tabs.label')} className="flex gap-1">
        <Chip variant="tab" on={tab === 'saw'} id={`${TAB_ID}-tab`} aria-controls={TAB_ID} onClick={() => setTab('saw')} data-tab="saw">
          {t('outcome.tabs.saw')}
        </Chip>
        <Chip variant="tab" on={tab === 'live'} id={`${LIVE_TAB_ID}-tab`} aria-controls={LIVE_TAB_ID} onClick={() => setTab('live')} data-tab="live">
          {t('outcome.tabs.live')}
        </Chip>
      </div>
      {tab === 'saw' ? (
        <div id={TAB_ID} role="tabpanel" aria-labelledby={`${TAB_ID}-tab`} className="flex flex-col gap-3">
          {view.kind === 'errors' ? <ReaderErrors errors={view.errors} onBlocks={onBlocks} /> : <Saw matched={view.matched} lines={view.lines} />}
          {view.kind === 'outcome' && intake && <IntakeReport view={intake} />}
          {/* 686: the read log, then the paragraph that reads the outcome in words. */}
          {view.kind === 'outcome' && <ReadLog reads={reads} />}
          {view.kind === 'outcome' && <ExplainParagraph sentences={explain(view, reads)} />}
        </div>
      ) : (
        <div id={LIVE_TAB_ID} role="tabpanel" aria-labelledby={`${LIVE_TAB_ID}-tab`} className="flex flex-col gap-3">
          {view.kind === 'errors' ? <ReaderErrors errors={view.errors} onBlocks={onBlocks} /> : <VerdictPane view={verdict} />}
        </div>
      )}
    </div>
  )
}

function ReaderErrors({ errors, onBlocks }: { errors: { path: string; message: string }[]; onBlocks: number }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <div className="flex flex-col gap-2 rounded-md border border-danger-border bg-danger-050 p-3 text-sm text-danger-800" role="alert" data-reader-errors="">
      <p className="font-medium">{t('outcome.errors.title')}</p>
      {onBlocks > 0 && (
        <p className="text-xs" data-errors-on-blocks={onBlocks}>
          {t('outcome.errors.onBlocks', { n: fsi(String(onBlocks)) })}
        </p>
      )}
      <ul className="flex flex-col gap-1">
        {errors.map((e, i) => (
          <li key={i} className="flex flex-wrap gap-2" data-reader-error={e.path}>
            <code className="font-mono text-xs">
              <Ltr>{e.path}</Ltr>
            </code>
            <bdi data-error-message="">{e.message}</bdi>
          </li>
        ))}
      </ul>
    </div>
  )
}

function Saw({ matched, lines }: { matched: LineView[] | null; lines: LineView[] }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <>
      {matched === null ? (
        <p className="rounded-md border border-border/60 px-3 py-2 text-sm" data-nothing-matched="">
          {t('outcome.nothingMatched')}
        </p>
      ) : (
        <p className="flex flex-wrap items-center gap-2 text-sm" data-matched-lines={matched.map((l) => l.line).join(',')}>
          <span>{t('outcome.matchedLines')}</span>
          {matched.map((l) => (
            <span key={l.line} className="font-medium" data-matched-line={l.line}>
              <Ltr>{l.line}</Ltr>
            </span>
          ))}
        </p>
      )}
      {lines.map((l) => (
        <LineTrace key={l.line} line={l} />
      ))}
    </>
  )
}

function LineTrace({ line }: { line: LineView }) {
  const { t } = useTranslation('insurance-playground')
  return (
    <article className="flex flex-col gap-2 border-t border-border/60 pt-3" data-outcome-line={line.line} data-matched={String(line.matched)}>
      <header className="flex flex-wrap items-center gap-2">
        <span className="text-sm font-medium">{t('outcome.line', { n: fsi(line.line) })}</span>
        <StatusBadge sev={line.matched ? 'go' : 'mute'}>{line.matched ? t('outcome.matched') : t('outcome.notMatched')}</StatusBadge>
      </header>
      {line.trace.length === 0 ? (
        <p className="text-xs text-muted-foreground" data-trace-empty="">
          {t('trace.empty')}
        </p>
      ) : (
        <table className="w-full text-xs" data-trace="">
          <thead>
            <tr>
              <th className={TH}>{t('trace.rule')}</th>
              <th className={TH}>{t('trace.block')}</th>
              <th className={TH}>{t('trace.value.label')}</th>
              <th className={TH}>{t('trace.why')}</th>
            </tr>
          </thead>
          <tbody>
            {line.trace.map((r, i) => (
              <tr key={i} data-trace-row={`${r.ruleId}:${r.blockPath}`}>
                <td className={`${TD} font-mono`}>
                  <Ltr>{r.ruleId}</Ltr>
                </td>
                <td className={`${TD} font-mono`}>
                  <Ltr>{r.blockPath}</Ltr>
                </td>
                <td className={TD}>
                  <TraceValueBadge value={r.value} />
                </td>
                <td className={TD} data-why="">
                  {r.why && <bdi>{r.why}</bdi>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </article>
  )
}

const TRACE_SEV: Record<string, Severity> = { true: 'go', false: 'mute', unknown: 'warn' }

export function TraceValueBadge({ value }: { value: PlaygroundTraceValue }) {
  const { t } = useTranslation('insurance-playground')
  const key = String(value)
  return (
    <span data-trace-value={key}>
      <StatusBadge sev={TRACE_SEV[key] ?? 'mute'}>{t(`trace.value.${key}`)}</StatusBadge>
    </span>
  )
}
