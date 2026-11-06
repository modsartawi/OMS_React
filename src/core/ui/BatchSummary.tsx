import { refusalText, type BatchResult, type RefusalWords } from '@/core/util/batch-runner'
import Ltr from './Ltr'

export interface BatchSummaryProps {
  result: BatchResult<string>
  /** The summary line ("2 added, 1 refused"), worded by the caller from the counts. */
  summary: (done: number, refused: number) => string
  /** The refusal sentence's words: the fallback, and what a bare 403 is called. */
  refusal: RefusalWords
  /** A refused item's name (an `id · name` pair, a role code), drawn isolated LTR once; defaults to the item. */
  nameOf?: (item: string) => string
  'data-testid'?: string
}

/**
 * A batch's result, under the batch picker it ran from (spec 805): "N done, M refused", then each
 * refused item named with the server's sentence (a bare 403 named by the caller's words). The words
 * are the caller's — each feature owns its namespace — as `ChecklistPicker`'s are.
 */
export default function BatchSummary({ result, summary, refusal, nameOf = (item) => item, 'data-testid': testId }: BatchSummaryProps) {
  const refused = result.outcomes.flatMap((o) => (o.status === 'refused' ? [o] : []))
  return (
    <div
      role="status"
      className={
        'rounded-lg border p-2.5 text-xs ' +
        (result.refused > 0 ? 'border-danger-border bg-danger-050 text-danger-800' : 'border-border/60 bg-muted/40')
      }
      data-testid={testId}
    >
      <p className="font-semibold">{summary(result.done, result.refused)}</p>
      {refused.length > 0 && (
        <ul className="mt-1 flex flex-col gap-0.5">
          {refused.map((o) => (
            <li key={o.item} className="flex flex-wrap gap-x-2" data-refused={o.item}>
              <span className="font-semibold">
                <Ltr>{nameOf(o.item)}</Ltr>
              </span>
              <bdi>{refusalText(o.error, refusal)}</bdi>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
