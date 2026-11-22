import { Link } from 'react-router'
import Sentence from '@/core/findings/Sentence'
import type { CcCell, CcProfileSection, CcTable, CcTarget } from '@/core/models/command-center'
import Ltr from '@/core/ui/Ltr'
import type { CcT } from './lang'

/**
 * A profile section as the server sends it (oms 949; shared with the store profile, 948): its title, then its tables
 * and fixed sentences — or, for a section the warehouse cannot fill yet, "Not available yet" with the server's reason
 * and no figure. Both profiles render every section through this one component; neither knows a section by its key.
 *
 * Every word in a section is the server's, in the asked language; the page adds only its own labels (`profile.*`).
 * A hand-rolled `<table>`, not AG Grid: the page switches direction live (decisions §3) and AG Grid reads its direction
 * once at mount (patterns §2).
 *
 * Bidi (`.claude/rules/bidi.md`): a text cell and a heading are free text (`<bdi>`); a money, count, percent, code or
 * date cell is a machine value (`Ltr`), isolated whole.
 */
export default function ProfileSection({ section, hrefOf, t }: { section: CcProfileSection; hrefOf: HrefOf; t: CcT }) {
  return (
    <section
      className="flex min-w-0 flex-col gap-3 rounded-lg border border-border/60 bg-card p-4"
      data-cc-profile-section={section.key}
      data-cc-state={section.state}
    >
      <h3 className="text-sm font-semibold tracking-tight">
        <bdi>{section.title}</bdi>
      </h3>
      {section.state === 'not-available-yet' ? (
        <NotAvailableYet reason={section.reason} t={t} />
      ) : (
        <>
          {section.tables.map((table, i) => (
            <ProfileTable key={i} table={table} hrefOf={hrefOf} t={t} />
          ))}
          {section.sentences && section.sentences.length > 0 && (
            <ul className="flex flex-col gap-1.5 text-sm" data-cc-sentences>
              {section.sentences.map((parts, i) => (
                <li key={i}>
                  <Sentence parts={parts} hrefOf={hrefOf} />
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </section>
  )
}

/** Where a cell's or a sentence's link goes: the page's choice (`targetHref` with `store: 'profile'` on a profile). */
export type HrefOf = (target: CcTarget) => string

/** A section the warehouse cannot fill yet: the page's words and the server's reason, no figure. */
export function NotAvailableYet({ reason, t }: { reason?: string; t: CcT }) {
  return (
    <div className="flex flex-col gap-1 text-sm" data-cc-not-available-yet>
      <p className="font-medium">{t('profile.notAvailableYet')}</p>
      {reason && (
        <p className="text-xs text-muted-foreground" data-cc-reason>
          <bdi>{reason}</bdi>
        </p>
      )}
    </div>
  )
}

type ColumnKind = CcTable['columns'][number]['kind']

/** Figures line up at the end; words and codes at the start. */
const alignOf = (kind: ColumnKind): string => (kind === 'money' || kind === 'count' || kind === 'percent' ? 'text-end tabular-nums' : 'text-start')

/** One server table, its columns and rows in the server's order. Money is labelled as including VAT. */
export function ProfileTable({ table, hrefOf, t }: { table: CcTable; hrefOf: HrefOf; t: CcT }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border/60 text-xs text-muted-foreground">
              {table.columns.map((column) => (
                <th key={column.key} scope="col" className={`px-2 py-1.5 font-medium ${alignOf(column.kind)}`}>
                  <bdi>{column.label}</bdi>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr
                key={i}
                className={`border-b border-border/40 last:border-b-0 ${table.cut80 === i ? 'border-t-2 border-t-primary' : ''}`}
                data-cc-cut80={table.cut80 === i ? '' : undefined}
              >
                {table.columns.map((column) => (
                  <td key={column.key} className={`px-2 py-1.5 ${alignOf(column.kind)}`}>
                    {row[column.key] && <ProfileCell cell={row[column.key]} kind={column.kind} hrefOf={hrefOf} />}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {table.cut80 !== undefined && <p className="text-xs text-muted-foreground">{t('profile.cut80')}</p>}
      {table.moneyInclVat && <p className="text-xs text-muted-foreground">{t('profile.inclVat')}</p>}
    </div>
  )
}

/** A cell as server text; a cell with a target is a link (a pharmacy, a category). */
export function ProfileCell({ cell, kind, hrefOf }: { cell: CcCell; kind: ColumnKind; hrefOf: HrefOf }) {
  const text = kind === 'text' ? <bdi>{cell.text}</bdi> : <Ltr>{cell.text}</Ltr>
  return cell.target ? (
    <Link
      to={hrefOf(cell.target)}
      className="font-medium text-primary underline-offset-2 hover:underline"
      data-cc-target={cell.target.kind}
    >
      {text}
    </Link>
  ) : (
    text
  )
}
