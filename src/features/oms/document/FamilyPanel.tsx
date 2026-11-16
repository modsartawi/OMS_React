import { useEffect, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { documentApi } from './api'
import Disclosure from './Disclosure'
import { FAMILY_MEMBER_CAP, familyCategoryKey, familyKey, familyTree, type FamilyTreeNode } from './family-tree'

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
 * has loaded, by the record's number and `documentCategory`. A lone document — or no answer — draws
 * nothing; a failed read draws one quiet line (ticket 907): the section never blocks the page.
 *
 * Ticket 907: a parent's billings past the first fold behind "+ N more billings" when it has more than
 * two (the model's `shown`/`folded`), expanded in place; a truncated answer warns under the tree.
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
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(() => new Set())
  const openRow = useRef<HTMLDivElement>(null)
  const view = read.isError ? null : familyTree(read.data)
  const expand = (key: string) => setExpanded((prev) => new Set(prev).add(key))

  // In a big family the open document is scrolled into view — `nearest`, so a row already on
  // screen moves nothing.
  useEffect(() => {
    openRow.current?.scrollIntoView?.({ block: 'nearest' })
  }, [view?.count, no])

  if (read.isError) {
    const message = apiErrorMessage(read.error, '').trim()
    return (
      <p
        role="status"
        className="m-0 min-w-0 truncate rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground"
        data-family-failed=""
      >
        {message ? (
          <Trans t={t} i18nKey="family.failedWithReason" values={{ message }} components={{ m: <bdi /> }} />
        ) : (
          t('family.failed')
        )}
      </p>
    )
  }
  if (!view) return null
  return (
    <Disclosure
      id="doc-family"
      open={open}
      onToggle={setOpen}
      summary={<Trans t={t} i18nKey="family.heading" count={view.count} components={{ n: <Ltr /> }} />}
    >
      <ul aria-label={t('family.ariaLabel')} className="m-0 list-none p-0" data-family-tree="">
        <Member node={view.root} openRow={openRow} expanded={expanded} onExpand={expand} />
      </ul>
      {view.truncated && (
        <p
          role="note"
          className="m-0 mt-2 flex items-start gap-1.5 rounded-md bg-attention-050 px-2 py-1.5 text-xs text-attention-800"
          data-family-truncated=""
        >
          <TriangleAlert aria-hidden className="mt-px size-3.5 flex-none" />
          <span className="min-w-0">
            <Trans t={t} i18nKey="family.truncated" values={{ cap: FAMILY_MEMBER_CAP }} components={{ n: <Ltr /> }} />
          </span>
        </p>
      )}
    </Disclosure>
  )
}

interface MemberProps {
  node: FamilyTreeNode
  openRow: RefObject<HTMLDivElement | null>
  /** The parents whose folded billings were expanded. */
  expanded: ReadonlySet<string>
  onExpand: (key: string) => void
}

/**
 * One member and, under it, its children — indented on the inline-start side, so it mirrors under
 * RTL. Its billings past the first are folded behind "+ N more billings" until that is clicked.
 */
function Member({ node, openRow, expanded, onExpand }: MemberProps) {
  const { t } = useTranslation('document')
  const folded = node.folded.length > 0 && !expanded.has(node.key)
  const children = folded ? node.shown : node.children
  return (
    <li>
      <MemberRow node={node} openRow={openRow} />
      {children.length > 0 && (
        <ul className="m-0 ms-3.5 list-none border-s border-border p-0 ps-2.5">
          {children.map((child) => (
            <Member key={child.key} node={child} openRow={openRow} expanded={expanded} onExpand={onExpand} />
          ))}
          {folded && (
            <li>
              <Button variant="ghost" className="h-6 px-2 text-xs" onClick={() => onExpand(node.key)} data-family-more={node.key}>
                <Trans t={t} i18nKey="family.moreBillings" count={node.folded.length} components={{ n: <Ltr /> }} />
              </Button>
            </li>
          )}
        </ul>
      )}
    </li>
  )
}

/** The tooltip of a member with no page: a billing's, or a memo's (C, V). */
const NO_PAGE: Record<string, string> = { B: 'family.noPage.billing', C: 'family.noPage.memo', V: 'family.noPage.memo' }

/** A small dashed label beside the meta line (the till invoice, the partner reference); it gives way only after the meta line. */
const LABEL = 'min-w-0 truncate rounded border border-dashed border-border px-1.5 text-[0.6875rem] text-muted-foreground'

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
  const tillInvoice = (m.tillInvoiceNo ?? '').trim()
  const partner = m.partnerReference
    ? formatPair(m.partnerReference.source, (m.partnerReference.orderNo ?? '').trim() || m.partnerReference.sourceReference)
    : ''

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
      {tillInvoice && (
        <span title={t('family.tillInvoiceTitle')} className={LABEL} data-family-till="">
          {t('family.tillInvoice')} <Ltr>{tillInvoice}</Ltr>
        </span>
      )}
      {partner && (
        <span title={t('family.partnerReference')} className={LABEL} data-family-partner="">
          <Ltr>{partner}</Ltr>
        </span>
      )}
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
  const noPage = NO_PAGE[node.category]
  return (
    <div
      title={noPage ? t(noPage) : undefined}
      className={`${row} border-transparent text-muted-foreground`}
      data-family-member={node.key}
    >
      {body}
    </div>
  )
}
