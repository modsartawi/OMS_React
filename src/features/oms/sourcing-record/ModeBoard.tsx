import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { RECORD_BANDS } from '@/core/models/sourcing-store-record'
import { formatCount } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import type { BoardCell, BoardRow, ModeBoard as Board } from './store-record-model'
import { percent, useRecordWords } from './use-record-words'

/**
 * One mode's tab (ticket 969, the owner's variant C): what every store of the mode shares — the counted-from date, the
 * channels each measure counts, the like-store rate per band — said once, then a row per store with each measure's
 * steadied rate, like stores and the bad endings out of the deliveries behind it (BackOffice 4373's figures, as sent).
 *
 * SERVER GAP (spec 4354): the door sends no store name, no failure price and no cost or credit per measure or pair, and
 * nothing "shown, not charged"; the row names the store by its code and city, and the cost is a run's (its money).
 */
export default function ModeBoard({ board }: { board: Board }) {
  const w = useRecordWords()
  const isSlot = board.mode === 'SLOT'
  return (
    <div className="flex flex-col gap-3" data-mode-board={board.mode}>
      <section className="grid gap-4 rounded-lg border border-border bg-card p-4 lg:grid-cols-[20rem_minmax(0,1fr)]" data-mode-shared="">
        <div className="flex flex-col gap-2 text-xs">
          <p className="flex flex-wrap gap-x-1" data-counted-from={board.countedFrom ?? ''}>
            <span className="text-muted-foreground">{w.t('shared.countedFrom')}</span>
            <b>{board.countedFrom ? <Ltr>{board.countedFrom}</Ltr> : w.t('dash')}</b>
            <span className="text-muted-foreground">{w.t('shared.countedFromNote')}</span>
          </p>
          <div className="flex flex-col gap-1">
            <span className="text-muted-foreground">{w.t('shared.channels')}</span>
            {board.measures.map((m) => (
              <span key={m.measure} className="flex flex-wrap items-center gap-1.5" data-measure-channels={m.measure}>
                <span>{w.measure(m.measure)}</span>
                <span className="inline-flex flex-wrap gap-1" data-channels={m.channels.join('|')}>
                  {m.channels.map((c) => (
                    <span key={c} className="rounded-sm border border-border px-1 text-[11px] text-muted-foreground">
                      {w.channel(c)}
                    </span>
                  ))}
                </span>
              </span>
            ))}
          </div>
          <p className="text-[11px] text-muted-foreground">{w.t('costPerMeasure')}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="text-xs" data-like-stores="">
            <thead className="border-b border-border text-muted-foreground">
              <tr>
                <th className={TH}>{w.t('shared.likeStores')}</th>
                {board.measures.map((m) => (
                  <th key={m.measure} className={`${TH} text-end`}>
                    {w.measure(m.measure)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {RECORD_BANDS.map((b) => (
                <tr key={b} className="border-b border-border/60 last:border-b-0" data-band={b}>
                  <td className={TD}>{w.band(b)}</td>
                  {board.measures.map((m) => {
                    const v = m.likeByBand[b]
                    return (
                      <td key={m.measure} className={`${TD} text-end tabular-nums`}>
                        {v === null ? <span className="text-muted-foreground">{w.t('dash')}</span> : <Ltr>{percent(v)}</Ltr>}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <div className="overflow-x-auto rounded-lg border border-border bg-card">
        {board.rows.length === 0 ? (
          <p className="p-4 text-sm text-muted-foreground">{w.t('noStores')}</p>
        ) : (
          <table className="w-full text-xs" data-store-rows="">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border/60">
                <th className={TH} rowSpan={2}>
                  {w.t('col.store')}
                </th>
                <th className={`${TH} text-end`} rowSpan={2}>
                  {w.t('col.deliveries')}
                </th>
                {board.measures.map((m) => (
                  <th key={m.measure} className={`${TH} border-s border-border/60 text-center`} colSpan={2}>
                    {w.measure(m.measure)}
                  </th>
                ))}
                <th className={`${TH} border-s border-border/60 text-end`} rowSpan={2}>
                  {w.t('col.fallback')}
                </th>
                {isSlot && (
                  <>
                    <th className={`${TH} border-s border-border/60 text-end`} rowSpan={2}>
                      {w.t('col.usualSlot')}
                    </th>
                    <th className={TH} rowSpan={2}>
                      {w.t('col.regularHours')}
                    </th>
                    <th className={`${TH} text-end`} rowSpan={2}>
                      {w.t('col.tillMoves')}
                    </th>
                  </>
                )}
              </tr>
              <tr className="border-b border-border">
                {board.measures.map((m) => (
                  <MeasureHeads key={m.measure} />
                ))}
              </tr>
            </thead>
            <tbody>
              {board.rows.map((r) => (
                <StoreRow key={r.store} row={r} isSlot={isSlot} />
              ))}
            </tbody>
          </table>
        )}
        <div className="flex flex-col gap-0.5 border-t border-border px-2 py-1.5 text-[11px] text-muted-foreground">
          <p>{w.t('rateNote')}</p>
          {isSlot && <p>{w.t('tillNote')}</p>}
          <p>{w.t('fallbackNote')}</p>
        </div>
      </div>
    </div>
  )
}

function MeasureHeads() {
  const w = useRecordWords()
  return (
    <>
      <th className={`${TH} border-s border-border/60 text-end`}>{w.t('col.thisStore')}</th>
      <th className={`${TH} text-end`}>{w.t('col.badEndings')}</th>
    </>
  )
}

function StoreRow({ row, isSlot }: { row: BoardRow; isSlot: boolean }) {
  const w = useRecordWords()
  const dash = <span className="text-muted-foreground">{w.t('dash')}</span>
  return (
    <tr className="border-b border-border/60 last:border-b-0" data-store-row={row.store} data-row-neutral={row.neutral ? '' : undefined}>
      <td className={TD}>
        <Ltr>{row.store}</Ltr>
        {row.city && (
          <span className="block text-[11px] text-muted-foreground">
            <Ltr>{row.city}</Ltr>
          </span>
        )}
      </td>
      <td className={`${TD} text-end tabular-nums`}>
        <Ltr>{formatFigure(row.deliveries)}</Ltr>
      </td>
      {row.cells.map((c, i) => (c ? <MeasureCells key={c.measure} cell={c} /> : <EmptyCells key={`empty-${i}`} />))}
      <td className={`${TD} border-s border-border/60 text-end tabular-nums`} data-fallback="">
        <Ltr>{formatFigure(row.fallback)}</Ltr>
      </td>
      {isSlot && (
        <>
          <td className={`${TD} border-s border-border/60 text-end tabular-nums`}>{row.slot?.usual ? <Ltr>{formatFigure(row.slot.usual)}</Ltr> : dash}</td>
          <td className={TD} data-slot-hours="">
            {row.slot && row.slot.regularHours.length > 0 ? (
              <span className="flex gap-1">
                {row.slot.regularHours.map((h) => (
                  <span key={h} className="rounded-sm bg-muted px-1 tabular-nums">
                    <Ltr>{`${h.padStart(2, '0')}:00`}</Ltr>
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">{w.t('noSlotHours')}</span>
            )}
          </td>
          <td className={`${TD} text-end tabular-nums`} data-till-moves="">
            {row.slot && row.slot.tillMoves > 0 ? <Ltr>{formatCount(row.slot.tillMovesCustomer, row.slot.tillMoves)}</Ltr> : dash}
          </td>
        </>
      )}
    </tr>
  )
}

function NeutralMark() {
  const w = useRecordWords()
  return (
    <span className="inline-flex flex-col items-end gap-0.5" data-neutral="NO_DELIVERIES">
      <span className="inline-block rounded-full border border-border px-1.5 py-px text-[11px] whitespace-nowrap text-muted-foreground">{w.t('neutral.mark')}</span>
      <span className="text-[11px] text-muted-foreground">{w.neutral('NO_DELIVERIES')}</span>
    </span>
  )
}

function MeasureCells({ cell }: { cell: BoardCell }) {
  return (
    <>
      <td className={`${TD} border-s border-border/60 text-end tabular-nums`} data-measure-cell={cell.measure}>
        {cell.neutral ? (
          <NeutralMark />
        ) : (
          <span className="inline-flex flex-col items-end">
            <b>
              <Ltr>{percent(cell.steadied)}</Ltr>
            </b>
            <span className="text-[11px] text-muted-foreground">
              <Ltr>{percent(cell.like)}</Ltr>
            </span>
          </span>
        )}
      </td>
      <td className={`${TD} text-end tabular-nums`}>
        <Ltr>{formatCount(cell.bad, cell.deliveries)}</Ltr>
      </td>
    </>
  )
}

function EmptyCells() {
  const w = useRecordWords()
  return (
    <>
      <td className={`${TD} border-s border-border/60 text-end text-muted-foreground`}>{w.t('dash')}</td>
      <td className={TD} />
    </>
  )
}
