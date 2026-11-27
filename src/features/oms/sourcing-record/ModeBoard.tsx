import Ltr from '@/core/ui/Ltr'
import { TD, TH } from '@/core/ui/sheet-table'
import { RECORD_BANDS, type RecordNeutralWhy } from '@/core/models/sourcing-store-record'
import { formatCount, formatPair, formatRange } from '@/core/util/bidi'
import { formatFigure } from '@/core/util/number-format'
import type { BoardCell, BoardRow, ModeBoard as Board } from './store-record-model'
import { percent, useRecordWords } from './use-record-words'

/**
 * One mode's tab (ticket 969, the owner's variant C): what every store of the mode shares — the counted-from date, the
 * channels each measure counts, the like-store rate per band and the measure's failure price — said once, then a row
 * per store with each measure's rate, like stores, deliveries behind it and cost or credit.
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
                <span className="inline-flex flex-wrap gap-1" data-channels={m.channels.join(' ')}>
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
                    <span className="block text-[11px] font-normal">
                      {w.t('shared.price')} <Ltr>{w.money(m.price)}</Ltr>
                    </span>
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
                  <th key={m.measure} className={`${TH} border-s border-border/60 text-center`} colSpan={3}>
                    {w.measure(m.measure)}
                  </th>
                ))}
                <th className={`${TH} border-s border-border/60 text-end`} rowSpan={2}>
                  {w.t('col.pairCost')}
                </th>
                <th className={`${TH} text-end`} rowSpan={2}>
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
                <th className={`${TH} border-s border-border/60`} colSpan={3}>
                  {w.t('shown.title')}
                </th>
              </tr>
              <tr className="border-b border-border">
                {board.measures.map((m) => (
                  <MeasureHeads key={m.measure} />
                ))}
                <th className={`${TH} border-s border-border/60 text-end`}>{w.t('shown.lastCount')}</th>
                <th className={`${TH} text-end`}>{w.t('shown.countFactor')}</th>
                <th className={`${TH} text-end`}>{w.t('shown.donorRefusals')}</th>
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
          {isSlot && <p>{w.t('tillNote')}</p>}
          <p>{w.t('fallbackNote')}</p>
          <p>{w.t('shown.lead')}</p>
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
      <th className={`${TH} text-end`}>{w.t('col.cost')}</th>
    </>
  )
}

function StoreRow({ row, isSlot }: { row: BoardRow; isSlot: boolean }) {
  const w = useRecordWords()
  const dash = <span className="text-muted-foreground">{w.t('dash')}</span>
  return (
    <tr className="border-b border-border/60 last:border-b-0" data-store-row={row.store} data-row-neutral={row.neutral ? '' : undefined}>
      <td className={TD}>
        <Ltr>{formatPair(row.store, row.storeName)}</Ltr>
        {row.band && <span className="block text-[11px] text-muted-foreground">{w.band(row.band)}</span>}
      </td>
      <td className={`${TD} text-end tabular-nums`}>
        <Ltr>{formatFigure(row.deliveries)}</Ltr>
      </td>
      {row.cells.map((c, i) => (c ? <MeasureCells key={c.measure} cell={c} /> : <EmptyCells key={`empty-${i}`} />))}
      <td className={`${TD} border-s border-border/60 text-end font-semibold`} data-pair-cost="">
        <Money v={row.cost} />
      </td>
      <td className={`${TD} text-end tabular-nums`}>
        <Ltr>{formatFigure(row.fallbackLeftOut)}</Ltr>
      </td>
      {isSlot && (
        <>
          <td className={`${TD} border-s border-border/60 text-end tabular-nums`}>{row.slot ? <Ltr>{formatFigure(row.slot.usual)}</Ltr> : dash}</td>
          <td className={TD} data-slot-hours="">
            {row.slot && row.slot.regularHours.length > 0 ? (
              <span className="flex gap-1">
                {row.slot.regularHours.map((h) => (
                  <span key={h.from} className="rounded-sm bg-muted px-1 tabular-nums">
                    <Ltr>{formatRange(h.from, h.to)}</Ltr>
                  </span>
                ))}
              </span>
            ) : (
              <span className="text-muted-foreground">{w.t('noSlotHours')}</span>
            )}
          </td>
          <td className={`${TD} text-end tabular-nums`} data-till-moves="">
            {row.tillMoves && row.tillMoves.moves > 0 ? (
              <span className="inline-flex gap-1.5">
                <b>
                  <Ltr>{percent(row.tillMoves.customerShare)}</Ltr>
                </b>
                <span className="text-muted-foreground">
                  <Ltr>{percent(row.tillMoves.likeStores)}</Ltr>
                </span>
              </span>
            ) : (
              dash
            )}
          </td>
        </>
      )}
      <td className={`${TD} border-s border-border/60 text-end`}>{row.shown?.lastCount ? <Ltr>{row.shown.lastCount}</Ltr> : dash}</td>
      <td className={`${TD} text-end tabular-nums`}>{row.shown ? <Ltr>{row.shown.countFactor.toFixed(2)}</Ltr> : dash}</td>
      <td className={`${TD} text-end tabular-nums`}>{row.shown ? <Ltr>{formatFigure(row.shown.donorRefusals)}</Ltr> : dash}</td>
    </tr>
  )
}

function NeutralMark({ why }: { why: RecordNeutralWhy }) {
  const w = useRecordWords()
  return (
    <span className="inline-flex flex-col items-end gap-0.5" data-neutral={why}>
      <span className="inline-block rounded-full border border-border px-1.5 py-px text-[11px] whitespace-nowrap text-muted-foreground">{w.t('neutral.mark')}</span>
      <span className="text-[11px] text-muted-foreground">{w.neutral(why)}</span>
    </span>
  )
}

function MeasureCells({ cell }: { cell: BoardCell }) {
  return (
    <>
      <td className={`${TD} border-s border-border/60 text-end tabular-nums`} data-measure-cell={cell.measure}>
        {cell.neutral ? (
          <NeutralMark why={cell.neutral} />
        ) : (
          <span className="inline-flex flex-col items-end">
            <b>
              <Ltr>{percent(cell.rate)}</Ltr>
            </b>
            <span className="text-[11px] text-muted-foreground">
              <Ltr>{percent(cell.likeStores)}</Ltr>
            </span>
          </span>
        )}
      </td>
      <td className={`${TD} text-end tabular-nums`}>
        <Ltr>{formatCount(cell.bad, cell.count)}</Ltr>
      </td>
      <td className={`${TD} text-end`}>
        <Money v={cell.cost} />
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
      <td className={TD} />
    </>
  )
}

function Money({ v }: { v: number }) {
  const w = useRecordWords()
  return (
    <span className="inline-flex items-center justify-end gap-1 tabular-nums">
      <Ltr>{w.money(v)}</Ltr>
      {v < 0 && <span className="text-[11px] font-normal text-muted-foreground">{w.t('credit')}</span>}
    </span>
  )
}
