import { useMemo } from 'react'
import { useTranslation } from 'react-i18next'

import { formatMoneyIn } from '@/core/money'
import { formatDateTime } from '@/core/util/date-format'
import type { AccountEntryRow } from './account-projection'
import { auditColumn, type AuditFact, type AuditWhere } from './audit'

/**
 * **The audit pane** — the entry and its consumptions as **one column of time**
 * (ticket 272, spec 267 D6).
 *
 * 🔑 **The entry IS the audit.** Posting, consumption, void, repair and correction
 * are already stamped with who and when on the two arrays the account door returned,
 * so this pane is a projection and not a query: no new storage, no new door, no
 * fetch. It borrows the authz admin pane's **shape** — a stack of one-line facts,
 * time first, actor named — and deliberately nothing else.
 *
 * ⚠️ **It stores nothing in the authz audit table and reads nothing from it.**
 * `UaAdminAudit.Timestamp` is UTC and every settlement timestamp is local wall
 * clock; mixing them would put a three-hour lie beside a branch manager's own row in
 * this same list. The pane says so at the bottom, because a reader has no other way
 * to know which clock they are looking at.
 *
 * 🚩 **Nothing here parses or converts a time.** `formatDateTime` reads the local
 * stamp back as it arrived, exactly as the grid and the journal do.
 */
export default function EntryAudit({
  row,
  currencyKey,
}: {
  row: AccountEntryRow | null
  currencyKey: string
}) {
  const { t } = useTranslation('settlement')
  const facts = useMemo(() => auditColumn(row), [row])

  if (!row) return null

  return (
    <section
      data-region="entry-audit"
      data-entry={row.entryNumber}
      className="flex flex-col gap-2 rounded-lg border border-border/60 bg-card/40 p-4"
      aria-live="polite"
    >
      <header className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 className="text-sm font-semibold tracking-tight">{t('audit.title')}</h2>
        <span className="font-mono text-[12px] text-muted-foreground">
          {t('audit.forEntry', { number: row.entryNumber })}
        </span>
      </header>

      <ol className="flex flex-col gap-1.5 text-sm">
        {facts.map((fact) => (
          <li
            key={fact.id}
            data-fact={fact.kind}
            className="rounded-lg border border-border/60 bg-muted/40 px-2.5 py-1.5"
          >
            <Fact fact={fact} currencyKey={currencyKey} />
          </li>
        ))}
      </ol>

      {/* ⚠️ Which clock, said out loud. Every stamp above is the branch's own local
          time as the server wrote it — this pane converts nothing and borrows
          nothing from the admin audit, whose stamps are UTC. */}
      <p className="text-xs text-muted-foreground">{t('audit.localTime')}</p>
    </section>
  )
}

/**
 * One fact: **when · what · how much · from where · why.**
 *
 * The five parts are the same five on every row, whatever kind it is — that
 * sameness is what makes the column readable as one story rather than as five lists
 * interleaved.
 */
function Fact({ fact, currencyKey }: { fact: AuditFact; currencyKey: string }) {
  const { t } = useTranslation('settlement')

  return (
    <>
      {/* Time first, monospaced, so a column of them scans as a column. */}
      <span className="tabular-nums text-muted-foreground">{formatDateTime(fact.at)}</span>{' '}
      <b>{t(`audit.kind.${fact.kind}`)}</b>
      {fact.amount !== null && (
        <span className="tabular-nums"> {formatMoneyIn(fact.amount, currencyKey)}</span>
      )}{' '}
      <Where where={fact.where} />
      {fact.remainingAfter !== null && (
        // The server's own figure for what the entry had left after this fact —
        // never a subtraction (269's rule 3).
        <span className="text-muted-foreground">
          {' '}
          · {t('audit.left', { amount: formatMoneyIn(fact.remainingAfter, currencyKey) })}
        </span>
      )}
      {/* 🔑 269's rule 1, carried into this pane by the SAME description the journal
          uses: an undocumented consumption is named in words here too, because a
          history in which real money has no document behind it must not read as an
          ordinary line. */}
      {fact.document?.kind === 'orphan' && (
        <span className="font-medium text-attention-800">
          {' '}
          · {t('account.journal.document.orphan')}
        </span>
      )}
      {fact.note && (
        // Server text — the poster's reason, the closer's — passed through
        // unlocalised and `dir="auto"`, because it is routinely Arabic.
        //
        // 🚩 **The separator is OUTSIDE the `dir="auto"` span, and that is a fix
        // rather than a style.** With the dash inside it, an Arabic reason reorders
        // the whole run: the dash lands at the far end and the note collides with
        // the name that precedes it (`…Al-Qahtani18-06-2026 عجز تسليم —`). Found by
        // looking at the pane, not by any assertion — the same way 269's two
        // spacing defects were.
        <>
          <span className="text-muted-foreground"> — </span>
          <span dir="auto" className="text-muted-foreground">
            {fact.note}
          </span>
        </>
      )}
    </>
  )
}

/**
 * 🔑 **"From where"** — the store code for a consumption, the poster's name for a
 * posting, a staff id for a correction.
 *
 * ⚠️ There is no address and no IP, and none is owed: a browser IP on an internal
 * app names a desk, not a person, and the person is already on the row. *Which
 * branch spent this* is the audit question that actually gets asked, and the
 * consumption knows its own store.
 */
function Where({ where }: { where: AuditWhere }) {
  const { t } = useTranslation('settlement')

  switch (where.kind) {
    case 'store':
      return <span className="font-mono text-[12px]">{t('audit.where.store', { store: where.storeId })}</span>
    case 'person':
      return <span>{t('audit.where.person', { name: where.name })}</span>
    case 'staff':
      // 🚩 The wire carries `closedByStaffId` and no name (D8 denormalises a name
      // for the POSTER only). Inventing one here would be a field this screen
      // assumes rather than reads — logged for 274 in `.afk/HITL-272.md`.
      return <span className="font-mono text-[12px]">{t('audit.where.staff', { id: where.staffId })}</span>
  }
}
