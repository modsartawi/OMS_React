import { useEffect, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { documentApi } from './api'
import Disclosure from './Disclosure'
import { familyCategoryKey, familyKey, familyTree, type FamilyTreeNode } from './family-tree'

/**
 * A category badge's tint, by category. Categorical, not a severity: an order reads blue, a
 * delivery green, a return red, and a member with no page (a billing, a memo) neutral — the
 * prototype's palette (3943), on the theme's own tokens, never a literal.
 */
const BADGE: Record<string, string> = {
  Q: 'bg-attention-050 text-attention-800',
  O: 'bg-primary-050 text-primary-800',
  X: 'bg-primary-050 text-primary-800',
  D: 'bg-success-050 text-success-800',
  R: 'bg-danger-050 text-danger-800',
  E: 'bg-danger-050 text-danger-800',
  T: 'bg-danger-050 text-danger-800',
}
const BADGE_NEUTRAL = 'bg-muted text-muted-foreground'

/**
 * **The Family section** (ticket 906, BackOffice spec 3953 "Family panel", ruling 3943): the
 * document's whole family as an indented tree from the family root, first in the facts column and
 * open by default, on both Document details and Delivery details (one component). Every member with
 * a page opens with one click through the router, so the page it lands on records it in Recent.
 *
 * Self-contained: it asks the Family read (`documentApi.getFamily`, BackOffice 3954) once the record
 * has loaded, by the record's number and `documentCategory`. A lone document — or no answer, or a
 * failed read — draws nothing: the section never blocks the page.
 */
export default function FamilyPanel({ document }: { document: Pick<SdDocumentHeaderModel, 'documentNo' | 'documentCategory'> }) {
  const { t } = useTranslation('document')
  const no = (document.documentNo ?? '').trim()
  const category = (document.documentCategory ?? '').trim()
  const read = useQuery({
    queryKey: familyKey(no, category),
    queryFn: () => documentApi.getFamily(no, category),
    enabled: no !== '' && category !== '',
    retry: false,
  })
  const [open, setOpen] = useState(true)
  const openRow = useRef<HTMLDivElement>(null)
  const view = read.isError ? null : familyTree(read.data)

  // In a big family the open document is scrolled into view — `nearest`, so a row already on
  // screen moves nothing.
  useEffect(() => {
    openRow.current?.scrollIntoView?.({ block: 'nearest' })
  }, [view?.count, no])

  if (!view) return null
  return (
    <Disclosure
      id="doc-family"
      open={open}
      onToggle={setOpen}
      summary={<Trans t={t} i18nKey="family.heading" count={view.count} components={{ n: <Ltr /> }} />}
    >
      <ul aria-label={t('family.ariaLabel')} className="m-0 list-none p-0" data-family-tree="">
        <Member node={view.root} openRow={openRow} />
      </ul>
    </Disclosure>
  )
}

/** One member and, under it, its children — indented on the inline-start side, so it mirrors under RTL. */
function Member({ node, openRow }: { node: FamilyTreeNode; openRow: RefObject<HTMLDivElement | null> }) {
  return (
    <li>
      <MemberRow node={node} openRow={openRow} />
      {node.children.length > 0 && (
        <ul className="m-0 ms-3.5 list-none border-s border-border p-0 ps-2.5">
          {node.children.map((child) => (
            <Member key={child.key} node={child} openRow={openRow} />
          ))}
        </ul>
      )}
    </li>
  )
}

/**
 * A member's row: the category badge (its name as the tooltip), the number, a muted meta line cut
 * short with an ellipsis, and the status chip. The badge, number and chip never shrink, so only the
 * meta line gives way. The open document is tinted, with an accent bar on its inline-start edge and a
 * "You are here" tag, and is not a link.
 */
function MemberRow({ node, openRow }: { node: FamilyTreeNode; openRow: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation('document')
  const m = node.member
  const categoryName = t(familyCategoryKey(node.category))
  const type = (m.documentTypeDescription ?? '').trim() || (m.documentType ?? '').trim()
  const store = formatPair(m.storeCode, m.storeName)
  const when = formatDateTime(m.entryTime)
  const status = (m.statusDescription ?? '').trim() || (m.status ?? '').trim()

  const body = (
    <>
      <span
        title={categoryName}
        className={`grid h-5.5 w-5.5 flex-none place-items-center rounded-[5px] text-xs font-bold ${BADGE[node.category] ?? BADGE_NEUTRAL}`}
        data-family-category={node.category}
      >
        <Ltr>{node.category}</Ltr>
      </span>
      <span
        className={
          'flex-none font-mono font-semibold tabular-nums' +
          (node.link ? ' text-primary underline underline-offset-2' : '')
        }
        data-family-no=""
      >
        <Ltr>{node.no}</Ltr>
      </span>
      <span className="min-w-0 flex-1 truncate text-xs text-muted-foreground" data-family-meta="">
        {categoryName}
        {type && (
          <>
            {' · '}
            <bdi>{type}</bdi>
          </>
        )}
        {store && (
          <>
            {' · '}
            <Ltr>{store}</Ltr>
          </>
        )}
        {when && (
          <>
            {' · '}
            <Ltr>{when}</Ltr>
          </>
        )}
      </span>
      {status && (
        <span className="flex-none" data-family-status="">
          <StatusBadge sev="mute">
            <bdi>{status}</bdi>
          </StatusBadge>
        </span>
      )}
      {node.isOpen && (
        <span className="flex-none text-[0.625rem] font-bold tracking-wide text-primary uppercase" data-family-here="">
          {t('family.youAreHere')}
        </span>
      )}
    </>
  )

  const row = 'flex min-w-0 items-center gap-2 rounded-md border-s-[3px] px-2 py-1 text-[0.8125rem]'
  if (node.isOpen)
    return (
      <div ref={openRow} aria-current="page" className={`${row} border-primary bg-primary-050`} data-family-member={node.key} data-family-open="">
        {body}
      </div>
    )
  if (node.link)
    return (
      <Link to={node.link} className={`${row} border-transparent hover:bg-primary-050`} data-family-member={node.key}>
        {body}
      </Link>
    )
  return (
    <div className={`${row} border-transparent text-muted-foreground`} data-family-member={node.key}>
      {body}
    </div>
  )
}
