import { useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'

import { formatMoneyIn } from '@/core/money'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatDateTime, formatDay } from '@/core/util/date-format'
import type { AccountEntryRow, JournalDocument } from './account-projection'

/**
 * One entry's **journal** — what a till has taken against it, and what each row left
 * behind (ticket 269).
 *
 * 🔑 This is the view the whole per-branch account exists for. An accountant on the
 * phone is asked *"was my 500 used?"*, and the honest answer is a list of documents
 * with a running remainder beside them — not a netted number, which is why nothing
 * on this screen nets anything.
 *
 * ⚠️ **Stacked beneath the grid, not behind a modal** — the ruling `DepositDetail`
 * made at 256 and this screen has a stronger version of: 272 hangs the correction
 * beside this region precisely so that *what a write-off does not touch* is shown
 * rather than asserted, and a journal that closed when the correction opened could
 * not do that job.
 *
 * 🚩 **It costs no fetch.** The consumptions ride on the account response; selecting
 * another entry is a re-render.
 */
export default function EntryJournal({
  row,
  currencyKey,
}: {
  row: AccountEntryRow | null
  currencyKey: string
}) {
  const { t } = useTranslation('settlement')

  if (!row) {
    // The grid selects its first row on arrival, so this is what a CTRL-click that
    // deselected leaves behind: a sentence rather than a bare heading over nothing.
    return (
      <section
        data-region="entry-journal"
        className="rounded-lg border border-border/60 bg-card/40 p-4"
        aria-live="polite"
      >
        <h2 className="text-sm font-semibold tracking-tight">{t('account.journal.title')}</h2>
        <p className="mt-1 text-sm text-muted-foreground">{t('account.journal.noSelection')}</p>
      </section>
    )
  }

  const money = (v: number | null | undefined) => formatMoneyIn(v, currencyKey)

  return (
    <section
      data-region="entry-journal"
      data-entry={row.entryNumber}
      className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/40 p-4"
      aria-live="polite"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{t('account.journal.title')}</h2>
        {/* Which entry this region is following, said out loud: it moves with the
            selection, so a heading that never named an entry would leave the reader
            guessing which row they clicked. */}
        <span className="font-mono text-[12px] text-muted-foreground">
          {t('account.journal.forEntry', {
            number: row.entryNumber,
            kind: t(`account.kind.${row.entryKind}`),
            amount: money(row.amount),
          })}
        </span>
      </header>

      {/* ⚠️ A write-off is not a consumption and never appears below — the journal
          stays exactly as it was. Said here rather than left to be inferred from an
          absence, because 272's whole correction argument rests on it. */}
      {row.writtenOff !== null && (
        <p className="text-sm text-muted-foreground">
          {t('account.journal.writtenOff', {
            amount: money(row.writtenOff),
            // ⚠️ `closedByStaffId` and no name: D8's entry carries a name for the
            // POSTER (denormalised at post time) and only an id for the closer.
            // 272 owns the correction and will settle whether that asymmetry stands.
            by: row.closedByStaffId,
            at: formatDateTime(row.closedAt),
          })}
        </p>
      )}

      {row.journal.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {row.closure === 'cancelled'
            ? t('account.journal.emptyCancelled')
            : t('account.journal.empty')}
        </p>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs font-medium text-muted-foreground">
              <th scope="col" className="py-1.5 text-start">
                {t('account.journal.columns.what')}
              </th>
              <th scope="col" className="py-1.5 pe-6 text-end">
                {t('account.journal.columns.amount')}
              </th>
              <th scope="col" className="py-1.5 pe-6 text-end">
                {t('account.journal.columns.left')}
              </th>
              <th scope="col" className="py-1.5 text-start">
                {t('account.journal.columns.document')}
              </th>
              <th scope="col" className="py-1.5 text-start">
                {t('account.journal.columns.day')}
              </th>
              <th scope="col" className="py-1.5 text-start">
                {t('account.journal.columns.who')}
              </th>
            </tr>
          </thead>
          <tbody>
            {row.journal.map((entry) => (
              <tr
                key={entry.consumption.settlementConsumptionId}
                // The two rules, in the DOM as well as on screen, so the drive can
                // assert them without reading colours out of a stylesheet.
                data-restoration={entry.isRestoration ? 'true' : 'false'}
                data-orphan={entry.isOrphan ? 'true' : 'false'}
                className={`border-b border-border/40 last:border-b-0 ${
                  entry.isOrphan ? 'bg-attention-050' : ''
                }`}
              >
                <td className="py-1.5">
                  {/* 🔑 Rule 2. A REVERSE row is a **restoration**: this document did
                      not happen and the money went back onto the entry. Drawn as its
                      own word rather than as another "Consumed", because rendering a
                      reversal as a spend inverts the branch's position on screen. */}
                  <StatusBadge sev={entry.isRestoration ? 'ok' : 'mute'}>
                    {t(`account.journal.kind.${entry.consumption.consumptionKind}`)}
                  </StatusBadge>
                </td>
                <td className="py-1.5 pe-6 text-end tabular-nums">
                  {money(entry.consumption.amount)}
                </td>
                <td className="py-1.5 pe-6 text-end tabular-nums">
                  {/* The server's own `remainingAfter`. ⚠️ Nothing here subtracts the
                      amount from anything — see `account-projection.ts` on why this
                      screen computes no variance at all. */}
                  {money(entry.consumption.remainingAfter)}
                </td>
                <td className="py-1.5">
                  <DocumentCell document={entry.document} />
                </td>
                <td className="py-1.5 tabular-nums text-muted-foreground">
                  {formatDay(entry.consumption.businessDay)}
                </td>
                <td className="py-1.5 text-muted-foreground">
                  {/* ⚠️ The wire carries an operator **id** and no name (spec D8), so
                      the id is what is shown. Inventing a name here would be a field
                      this screen assumes rather than reads — logged for 274 in
                      `.afk/HITL-269.md`. */}
                  {t('account.journal.operator', { id: entry.consumption.consumedByOperatorId })}
                  <span className="block text-xs">
                    {formatDateTime(entry.consumption.consumedAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}

/**
 * What spent this row — **in words, always** (the ticket's rule 1).
 *
 * 🔑 The orphan case is the reason this is a component and not a `valueFormatter`:
 * a consumption with no document is either *seconds old* or *the close never
 * completed*, and the second is real money the branch handed over against a receipt
 * that will never exist. A blank cell makes it invisible; a sentence and an amber
 * ground make it the thing a reader's eye stops on — which is what 270's *wrong
 * money* lane will then let them repair.
 */
function DocumentCell({ document }: { document: JournalDocument }) {
  const { t } = useTranslation('settlement')

  switch (document.kind) {
    case 'orphan':
      return (
        <span
          className="inline-flex items-center gap-1.5 font-medium text-attention-800"
          title={t('account.journal.document.orphanHint')}
        >
          <TriangleAlert className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {t('account.journal.document.orphan')}
        </span>
      )
    case 'reversal':
      return (
        <span>
          {document.documentNumber
            ? t('account.journal.document.reversal', { number: document.documentNumber })
            : t('account.journal.document.reversalUnnumbered')}
        </span>
      )
    case 'receipt':
      return <span>{t('account.journal.document.receipt', { number: document.documentNumber })}</span>
    case 'shift-close':
      return (
        <span>
          {t('account.journal.document.shiftClose', {
            number: document.documentNumber,
            day: formatDay(document.businessDay),
          })}
        </span>
      )
  }
}
