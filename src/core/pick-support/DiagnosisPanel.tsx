import { useMemo, useState, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import { CheckCircle2, ShieldQuestion, TriangleAlert, Wrench } from 'lucide-react'
import type {
  PickDocumentLineModel,
  PickDocumentModel,
  PickSupportDiagnosis,
  PickSupportDonorRequest,
  PickSupportShapeMatch,
  PickSupportTimelineEntry,
} from '@/core/models/pick-support'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import type { Severity } from '@/core/ui/severity'
import { formatCount, formatPair, fsi } from '@/core/util/bidi'
import { Code, Section, Stamp, StampBy, TD, TH, Text, Val } from './bits'
import CopyDiagnosis from './CopyDiagnosis'
import ShapeBody from './ShapeBody'
import { filterTimeline, timelineSources, transferView, verdictView } from './diagnosis'

/**
 * **The diagnosis panel** (ticket 496, BackOffice brief 2691 "The diagnosis panel") — one component,
 * drawn by the Pick support console and by Document Details (499). Sections 1–7 of the brief:
 * verdict card, refusal sentence, store history, documents → lines → units, donor requests and
 * their transfer, the timeline, and Copy diagnosis.
 *
 * 🚩 BackOffice decides every word (rules 1–6). Every explanation, fix sentence and refusal is the
 * server's, rendered as data; shapes, verdicts, actions and states are shown AS CODES. The only
 * words here are headings, labels and the two verdict states' UI sentences.
 *
 * Apply fix (ticket 497): one button per shape card, drawn only when the caller passes
 * `onApplyFix` — `DeliveryDiagnosis` does so only with `canFixPickSupport`. HEALTHY and UNKNOWN
 * have no card, so never a button (rule 5): `verdictView` gives them no slot. The dialog lives with
 * the caller, so it outlives the card it was opened from when the fix turns the panel HEALTHY.
 *
 * Key it by the delivery, so a new delivery starts on fresh timeline filters (`DeliveryDiagnosis`'s
 * callers do).
 */
export default function DiagnosisPanel({
  diagnosis,
  onApplyFix,
}: {
  diagnosis: PickSupportDiagnosis
  /** Opens the fix dialog for one shape; absent = no Apply fix button (no `canFixPickSupport`). */
  onApplyFix?: (card: PickSupportShapeMatch) => void
}) {
  const { t } = useTranslation('pick-support')
  const view = verdictView(diagnosis)
  const escalate = view.kind === 'escalate'
  // A blank refusal is no refusal: nothing to match against the store's screenshot.
  const refusal = (diagnosis.refusalText ?? '').trim() || null

  return (
    <div className="flex flex-col gap-3" data-ps-panel={diagnosis.deliveryNo} data-ps-verdict={view.kind}>
      <header className="flex flex-wrap items-start justify-between gap-3 rounded-lg border border-border/60 bg-card p-3">
        <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-6" data-ps-facts="">
          <Fact label={t('facts.delivery')}>
            <Val value={diagnosis.deliveryNo} />
          </Fact>
          <Fact label={t('facts.order')}>
            <Val value={diagnosis.orderNo} />
          </Fact>
          <Fact label={t('facts.currentStore')}>
            <Val value={diagnosis.currentStore} />
          </Fact>
          <Fact label={t('facts.readyStatus')}>
            <Val value={diagnosis.readyStatus} />
          </Fact>
          <Fact label={t('facts.closeStatus')}>
            <Val value={diagnosis.closeStatus} />
          </Fact>
          <Fact label={t('facts.verdict')}>
            <span data-ps-verdict-code={diagnosis.verdict}>
              <StatusBadge sev={VERDICT_SEV[view.kind]}>
                <Ltr>{diagnosis.verdict || t('dash')}</Ltr>
              </StatusBadge>
            </span>
          </Fact>
        </dl>
        {/* Under UNKNOWN the copy is the escalate card's prominent action, not this one. */}
        {!escalate && <CopyDiagnosis copy={diagnosis.copy} />}
      </header>

      {/* 1. Verdict card */}
      {view.kind === 'healthy' && (
        <div className="flex items-center gap-2 rounded-lg border border-border/60 bg-card p-3 text-sm text-muted-foreground" data-ps-healthy="">
          <CheckCircle2 className="h-4 w-4 text-success-800" aria-hidden />
          {t('verdict.healthy')}
        </div>
      )}
      {view.kind === 'stuck' && view.cards.map((card, i) => <ShapeCard key={`${card.shape}-${i}`} card={card} onApplyFix={onApplyFix} />)}
      {escalate && (
        <div className="flex flex-col gap-3 rounded-lg border border-danger-border bg-danger-050 p-3" data-ps-escalate="">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-danger-800">
              <ShieldQuestion className="h-4 w-4" aria-hidden />
              {t('verdict.escalate')}
            </div>
            <CopyDiagnosis copy={diagnosis.copy} prominent />
          </div>
          <p className="text-sm text-danger-800">{t('verdict.escalateHint')}</p>
          {refusal !== null && <RefusalBlock text={refusal} />}
        </div>
      )}

      {/* 2. Refusal sentence — inside the escalate card under UNKNOWN, here otherwise. */}
      {!escalate && refusal !== null && (
        <Section name="refusal" title={t('refusal.title')}>
          <RefusalBlock text={refusal} />
        </Section>
      )}

      <StoreHistory diagnosis={diagnosis} />
      <Documents documents={diagnosis.documents ?? []} />
      <DonorRequests requests={diagnosis.donorRequests ?? []} />
      <Timeline entries={diagnosis.timeline ?? []} />
    </div>
  )
}

const VERDICT_SEV: Record<'stuck' | 'healthy' | 'escalate', Severity> = { stuck: 'warn', healthy: 'ok', escalate: 'bad' }

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="font-medium">{children}</dd>
    </div>
  )
}

/** The till's own refusal, English only, in monospace: what the store's screenshot says. */
function RefusalBlock({ text }: { text: string }) {
  return (
    <pre className="overflow-x-auto rounded-md border border-border/60 bg-muted p-2 font-mono text-xs whitespace-pre-wrap text-foreground" data-ps-refusal="">
      <bdi>{text}</bdi>
    </pre>
  )
}

/**
 * One stuck shape: its code, the server's explanation and fix (EN beside AR), its action tags, and
 * its one Apply fix button when the session may fix.
 */
function ShapeCard({ card, onApplyFix }: { card: PickSupportShapeMatch; onApplyFix?: (card: PickSupportShapeMatch) => void }) {
  const { t } = useTranslation('pick-support')
  return (
    <article className="flex flex-col gap-3 rounded-lg border border-attention-800/30 bg-attention-050 p-3" data-ps-card={card.shape}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TriangleAlert className="h-4 w-4 text-attention-800" aria-hidden />
          <Code>{card.shape}</Code>
        </div>
        {onApplyFix && (
          <Button onClick={() => onApplyFix(card)} data-ps-apply-fix={card.shape}>
            <Wrench className="h-3.5 w-3.5" aria-hidden />
            {t('fix.apply')}
          </Button>
        )}
      </div>
      <ShapeBody card={card} />
    </article>
  )
}

/** 3. Every store move of the delivery and of its order, oldest first, as sent. */
function StoreHistory({ diagnosis }: { diagnosis: PickSupportDiagnosis }) {
  const { t } = useTranslation('pick-support')
  const moves = diagnosis.storeHistory ?? []
  return (
    <Section name="history" title={t('history.title')}>
      {moves.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('history.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className={TH}>{t('history.at')}</th>
                <th className={TH}>{t('history.by')}</th>
                <th className={TH}>{t('history.action')}</th>
                <th className={TH}>{t('history.document')}</th>
                <th className={TH}>{t('history.from')}</th>
                <th className={TH}>{t('history.to')}</th>
              </tr>
            </thead>
            <tbody>
              {moves.map((m, i) => (
                <tr key={i} data-ps-move={i}>
                  <td className={TD}>
                    <Stamp value={m.at} />
                  </td>
                  <td className={TD}>
                    <Val value={m.by} />
                  </td>
                  <td className={TD}>
                    <Code>{m.actionType}</Code>
                  </td>
                  <td className={TD}>
                    <Val value={m.documentNo} />
                  </td>
                  <td className={TD} data-ps-from="">
                    <Val value={m.fromStore} />
                  </td>
                  <td className={TD} data-ps-to="">
                    <Val value={m.toStore} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

/** 4. Documents → lines → units: one expandable entry per document, OMS and DNR told apart. */
function Documents({ documents }: { documents: PickDocumentModel[] }) {
  const { t } = useTranslation('pick-support')
  return (
    <Section name="documents" title={t('documents.title')}>
      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('documents.empty')}</p>
      ) : (
        <div className="flex flex-col gap-2">
          {documents.map((d) => (
            <details key={d.documentNo} className="rounded-md border border-border/60" data-ps-document={d.documentNo}>
              <summary className="flex cursor-pointer flex-wrap items-center gap-x-4 gap-y-1 px-2 py-1.5 text-sm">
                <span className="font-medium">
                  <Val value={d.documentNo} />
                </span>
                <Code>{d.sourceType}</Code>
                <span data-ps-document-state={d.state}>
                  <StatusBadge sev="mute">
                    <Ltr>{d.state}</Ltr>
                  </StatusBadge>
                </span>
                <Inline label={t('documents.store')}>
                  <Val value={d.storeCode} />
                </Inline>
                <Inline label={t('documents.picked')}>
                  <span data-ps-count="">
                    <Ltr>{formatCount(d.picked, d.required)}</Ltr>
                  </span>
                </Inline>
                {(d.voidReason ?? '').trim() !== '' && (
                  <Inline label={t('documents.voidReason')}>
                    <Code>{d.voidReason}</Code>
                  </Inline>
                )}
                {(d.consumedByStore ?? '').trim() + (d.consumedByTrx ?? '').trim() !== '' && (
                  <Inline label={t('documents.consumedBy')}>
                    {/* `store · transaction`, one pair isolated once. */}
                    <Val value={formatPair(d.consumedByStore, d.consumedByTrx)} />
                  </Inline>
                )}
              </summary>
              <div className="flex flex-col gap-2 border-t border-border/60 p-2">
                <dl className="grid grid-cols-2 gap-x-6 gap-y-1 text-sm sm:grid-cols-3 lg:grid-cols-4">
                  <Fact label={t('documents.revision')}>
                    <Val value={d.revision} />
                  </Fact>
                  <Fact label={t('documents.consumedByStore')}>
                    <Val value={d.consumedByStore} />
                  </Fact>
                  <Fact label={t('documents.consumedByTrx')}>
                    <Val value={d.consumedByTrx} />
                  </Fact>
                  <Fact label={t('documents.created')}>
                    <StampBy at={d.createdAt} by={d.createdBy} />
                  </Fact>
                  <Fact label={t('documents.lastPick')}>
                    <StampBy at={d.lastPickAt} by={d.lastPickBy} />
                  </Fact>
                  <Fact label={t('documents.confirmed')}>
                    <StampBy at={d.confirmedAt} by={d.confirmedBy} />
                  </Fact>
                </dl>
                <Lines lines={d.lines ?? []} />
              </div>
            </details>
          ))}
        </div>
      )}
    </Section>
  )
}

function Inline({ label, children }: { label: string; children: ReactNode }) {
  return (
    <span className="inline-flex items-baseline gap-1">
      <span className="text-xs text-muted-foreground">{label}</span>
      {children}
    </span>
  )
}

/** A document's lines with picked / required, each followed by its units (serial, batch, expiry). */
function Lines({ lines }: { lines: PickDocumentLineModel[] }) {
  const { t } = useTranslation('pick-support')
  if (lines.length === 0) return <p className="text-sm text-muted-foreground">{t('documents.noLines')}</p>
  return (
    <div className="overflow-x-auto">
      <table className="text-sm">
        <thead>
          <tr>
            <th className={TH}>{t('documents.line')}</th>
            <th className={TH}>{t('documents.item')}</th>
            <th className={TH}>{t('documents.description')}</th>
            <th className={TH}>{t('documents.quantity')}</th>
            <th className={TH}>{t('documents.uom')}</th>
            <th className={TH}>{t('documents.picked')}</th>
            <th className={TH}>{t('documents.short')}</th>
            <th className={TH}>{t('documents.state')}</th>
          </tr>
        </thead>
        <tbody>
          {lines.map((l) => (
            <LineRows key={l.lineNumber} line={l} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function LineRows({ line }: { line: PickDocumentLineModel }) {
  const { t } = useTranslation('pick-support')
  const units = line.units ?? []
  return (
    <>
      <tr className="border-t border-border/40" data-ps-line={line.lineNumber}>
        <td className={TD}>
          <Val value={line.lineNumber} />
        </td>
        <td className={TD}>
          <Val value={line.itemNumber} />
        </td>
        <td className={TD}>
          <Text value={line.description} />
        </td>
        <td className={TD}>
          <Val value={line.quantity} />
        </td>
        <td className={TD}>
          <Val value={line.uom} />
        </td>
        <td className={TD} data-ps-count="">
          <Ltr>{formatCount(line.picked, line.required)}</Ltr>
        </td>
        <td className={TD}>
          {/* `quantity · reason`, one pair isolated once; no short reads the dash. */}
          <Val value={line.shortQuantity ? formatPair(line.shortQuantity, line.shortReason) : ''} />
        </td>
        <td className={TD}>
          <Code>{line.state}</Code>
        </td>
      </tr>
      {units.length > 0 && (
        <tr>
          <td />
          <td colSpan={7} className="pb-2">
            <table className="w-full text-xs" data-ps-units={line.lineNumber}>
              <thead>
                <tr>
                  <th className={TH}>{t('documents.pickIndex')}</th>
                  <th className={TH}>{t('documents.serial')}</th>
                  <th className={TH}>{t('documents.batch')}</th>
                  <th className={TH}>{t('documents.expiry')}</th>
                  <th className={TH}>{t('documents.gtin')}</th>
                  <th className={TH}>{t('documents.pickedBy')}</th>
                  <th className={TH}>{t('documents.pickedAt')}</th>
                </tr>
              </thead>
              <tbody>
                {units.map((u) => (
                  <tr key={u.pickIndex}>
                    <td className={TD}>
                      <Val value={u.pickIndex} />
                    </td>
                    <td className={TD}>
                      <Val value={u.serialNumber} />
                    </td>
                    <td className={TD}>
                      <Val value={u.batchLot} />
                    </td>
                    <td className={TD}>
                      <Val value={u.expiryDate} />
                    </td>
                    <td className={TD}>
                      <Val value={u.gtin} />
                    </td>
                    <td className={TD}>
                      <Val value={u.pickedBy} />
                    </td>
                    <td className={TD}>
                      <Stamp value={u.pickedAt} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </td>
        </tr>
      )}
    </>
  )
}

/** 5. One row per donor request: stores, state, its document, and the transfer. */
function DonorRequests({ requests }: { requests: PickSupportDonorRequest[] }) {
  const { t } = useTranslation('pick-support')
  return (
    <Section name="requests" title={t('requests.title')}>
      {requests.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('requests.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm">
            <thead>
              <tr>
                <th className={TH}>{t('requests.request')}</th>
                <th className={TH}>{t('requests.donorStore')}</th>
                <th className={TH}>{t('requests.orderStore')}</th>
                <th className={TH}>{t('requests.state')}</th>
                <th className={TH}>{t('requests.document')}</th>
                <th className={TH}>{t('requests.documentState')}</th>
                <th className={TH}>{t('requests.voidReason')}</th>
                <th className={TH}>{t('requests.picked')}</th>
                <th className={TH}>{t('requests.sto')}</th>
                <th className={TH}>{t('requests.postedAt')}</th>
                <th className={TH}>{t('requests.sapDocument')}</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((r) => {
                const transfer = transferView(r)
                return (
                  <tr key={r.requestNo} data-ps-request={r.requestNo} data-ps-transfer={transfer.kind}>
                    <td className={TD}>
                      <Val value={r.requestNo} />
                    </td>
                    <td className={TD}>
                      <Val value={r.donorStore} />
                    </td>
                    <td className={TD}>
                      <Val value={r.orderStore} />
                    </td>
                    <td className={TD}>
                      <Code>{r.state}</Code>
                    </td>
                    <td className={TD}>
                      <Val value={r.documentNo} />
                    </td>
                    <td className={TD}>
                      <Code>{r.documentState}</Code>
                    </td>
                    <td className={TD}>
                      <Code>{r.documentVoidReason}</Code>
                    </td>
                    <td className={TD} data-ps-count="">
                      <Ltr>{formatCount(r.picked, r.required)}</Ltr>
                    </td>
                    <td className={TD}>
                      <Val value={transfer.kind === 'none' ? '' : transfer.stoNo} />
                    </td>
                    <td className={TD}>
                      {transfer.kind === 'started' ? (
                        <span data-ps-started="">
                          <StatusBadge sev="go">{t('requests.started')}</StatusBadge>
                        </span>
                      ) : (
                        <Val value={transfer.kind === 'posted' ? transfer.at : ''} />
                      )}
                    </td>
                    <td className={TD}>
                      <Val value={transfer.kind === 'posted' ? transfer.sapDocumentNo : ''} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}

/** 6. The merged timeline in the server's order, a source filter and text over `key`. */
function Timeline({ entries }: { entries: PickSupportTimelineEntry[] }) {
  const { t } = useTranslation('pick-support')
  const [source, setSource] = useState('')
  const [key, setKey] = useState('')
  const sources = useMemo(() => timelineSources(entries), [entries])
  const shown = useMemo(() => filterTimeline(entries, { source, key }), [entries, source, key])

  const filters = (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      <label className="inline-flex items-center gap-1 text-muted-foreground">
        {t('timeline.source')}
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="h-7 rounded-md border border-border/60 bg-background px-1.5 text-xs text-foreground"
          data-ps-timeline-source=""
        >
          <option value="">{t('timeline.allSources')}</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {fsi(s)}
            </option>
          ))}
        </select>
      </label>
      <label className="inline-flex items-center gap-1 text-muted-foreground">
        {t('timeline.key')}
        <input
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value)}
          placeholder={t('timeline.keyPlaceholder')}
          className="h-7 w-40 rounded-md border border-border/60 bg-background px-1.5 text-xs text-foreground"
          data-ps-timeline-key=""
        />
      </label>
    </div>
  )

  return (
    <Section name="timeline" title={t('timeline.title')} end={filters}>
      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t('timeline.empty')}</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="text-sm" data-ps-timeline="">
            <thead>
              <tr>
                <th className={TH}>{t('timeline.at')}</th>
                <th className={TH}>{t('timeline.source')}</th>
                <th className={TH}>{t('timeline.key')}</th>
                <th className={TH}>{t('timeline.seq')}</th>
                <th className={TH}>{t('timeline.event')}</th>
                <th className={TH}>{t('timeline.actor')}</th>
                <th className={TH}>{t('timeline.approvedBy')}</th>
                <th className={TH}>{t('timeline.reason')}</th>
                <th className={TH}>{t('timeline.complaintRef')}</th>
                <th className={TH}>{t('timeline.detail')}</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((e, i) => (
                <tr
                  key={i}
                  className={'border-t border-border/40' + (e.reconstructed ? ' italic text-muted-foreground' : '')}
                  data-ps-timeline-row={e.key}
                  data-ps-event={e.eventType}
                  data-reconstructed={e.reconstructed ? '' : undefined}
                >
                  <td className={TD}>
                    <span className="inline-flex items-center gap-1.5">
                      <Stamp value={e.at} />
                      {e.reconstructed && (
                        <span
                          title={t('timeline.reconstructedTip')}
                          className="rounded-full border border-border px-1.5 text-[0.6875rem] not-italic"
                          data-ps-reconstructed=""
                        >
                          {t('timeline.reconstructed')}
                        </span>
                      )}
                    </span>
                  </td>
                  <td className={TD}>
                    <Code>{e.source}</Code>
                  </td>
                  <td className={TD}>
                    <Val value={e.key} />
                  </td>
                  <td className={TD}>
                    <Val value={e.seq} />
                  </td>
                  <td className={TD}>
                    <Code>{e.eventType}</Code>
                  </td>
                  <td className={TD}>
                    <Val value={e.actor} />
                  </td>
                  <td className={TD}>
                    <Val value={e.approvedBy} />
                  </td>
                  <td className={TD}>
                    <Text value={e.reason} />
                  </td>
                  <td className={TD}>
                    <Val value={e.complaintRef} />
                  </td>
                  <td className={TD}>
                    <Text value={e.detail} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Section>
  )
}
