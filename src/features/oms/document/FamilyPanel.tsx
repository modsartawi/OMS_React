import { useLayoutEffect, useMemo, useRef, useState, type RefObject } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router'
import { Trans, useTranslation } from 'react-i18next'
import { TriangleAlert } from 'lucide-react'
import { ApiError, isBareDenial } from '@/core/api'
import type { SdDocumentHeaderModel } from '@/core/models/sd-document'
import Button from '@/core/ui/Button'
import Ltr from '@/core/ui/Ltr'
import StatusBadge from '@/core/ui/StatusBadge'
import { formatPair } from '@/core/util/bidi'
import { formatDateTime } from '@/core/util/date-format'
import { documentApi, familyKey } from './api'
import Disclosure from './Disclosure'
import { familyCategory, familyTree, type FamilyTreeNode } from './family-tree'

/**
 * A failed read that draws nothing at all: a 404 (the Family route is not deployed on this host yet —
 * spec 3953 "Deployment order") or a bare 403 (the grant filter refused; the page's own gate speaks for
 * that). Any other failure is the section's one quiet line.
 */
const silentFailure = (err: unknown) => (err instanceof ApiError && err.statusCode === 404) || isBareDenial(err)

/**
 * **The Family section** (ticket 906, BackOffice spec 3953 "Family panel", ruling 3943): the
 * document's whole **document family** as an indented tree from the **family root**, first in the facts
 * column and open by default, on both Document details and Delivery details (one component). Every
 * member with a page (the server's `pageKind`) opens with one click through the router, so the page it
 * lands on records it in Recent.
 *
 * Self-contained: it asks the Family read (`documentApi.getFamily`, BackOffice 3954) once the record
 * has loaded, by the record's number and `documentCategory`. A lone document — or no answer, a 404 or a
 * bare 403 — draws nothing; any other failed read draws the section with one quiet line in it (ticket
 * 907): the section never blocks the page.
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
  const scroller = useRef<HTMLDivElement>(null)
  const scrolled = useRef(false)
  const view = useMemo(() => familyTree(read.data), [read.data])
  const expand = (key: string) => setExpanded((prev) => new Set(prev).add(key))

  // In a big family the open document is brought into view — inside the tree's own scroll box only,
  // never the window, and once per record (the panel is keyed by it): a refetch moves nothing.
  // `nearest`: a row already in view moves nothing.
  useLayoutEffect(() => {
    if (scrolled.current || read.isError || !view) return
    const box = scroller.current
    const row = openRow.current
    if (!box || !row) return
    scrolled.current = true
    const b = box.getBoundingClientRect()
    const r = row.getBoundingClientRect()
    if (r.top < b.top) box.scrollTop += r.top - b.top
    else if (r.bottom > b.bottom) box.scrollTop += r.bottom - b.bottom
  }, [view, read.isError])

  if (read.isError) {
    if (silentFailure(read.error)) return null
    return (
      <Disclosure id="doc-family" open={open} onToggle={setOpen} summary={t('family.title')}>
        <p role="status" className="m-0 text-xs text-muted-foreground" data-family-failed="">
          {t('family.failed')}
        </p>
      </Disclosure>
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
      <div ref={scroller} className="max-h-96 overflow-y-auto" data-family-scroll="">
        <ul aria-label={t('family.ariaLabel')} className="m-0 list-none p-0" data-family-tree="">
          <Member node={view.root} isRoot openRow={openRow} expanded={expanded} onExpand={expand} />
          {view.orphans.map((orphan) => (
            <Member key={orphan.key} node={orphan} openRow={openRow} expanded={expanded} onExpand={expand} />
          ))}
        </ul>
      </div>
      {view.truncated && (
        <p
          role="note"
          className="m-0 mt-2 flex items-start gap-1.5 rounded-md bg-attention-050 px-2 py-1.5 text-xs text-attention-800"
          data-family-truncated=""
        >
          <TriangleAlert aria-hidden className="mt-px size-3.5 flex-none" />
          <span className="min-w-0">{t('family.truncated')}</span>
        </p>
      )}
    </Disclosure>
  )
}

interface MemberProps {
  node: FamilyTreeNode
  /** The family root (its partner reference shows); an orphan row at depth 0 is not. */
  isRoot?: boolean
  openRow: RefObject<HTMLDivElement | null>
  /** The parents whose folded billings were expanded. */
  expanded: ReadonlySet<string>
  onExpand: (key: string) => void
}

/**
 * One member and, under it, its children — indented on the inline-start side, so it mirrors under
 * RTL. Its billings past the first are folded behind "+ N more billings", drawn right after that first
 * billing — where the folded ones appear once it is clicked, so expanding reorders nothing.
 */
function Member({ node, isRoot = false, openRow, expanded, onExpand }: MemberProps) {
  const { t } = useTranslation('document')
  const folded = node.folded.length > 0 && !expanded.has(node.key)
  const children = folded ? node.shown : node.children
  const firstBilling = folded ? node.shown.find((c) => familyCategory(c.category).billing)?.key : undefined
  return (
    <li>
      <MemberRow node={node} isRoot={isRoot} openRow={openRow} />
      {children.length > 0 && (
        <ul className="m-0 ms-3.5 list-none border-s border-border p-0 ps-2.5">
          {children.flatMap((child) => {
            const row = <Member key={child.key} node={child} openRow={openRow} expanded={expanded} onExpand={onExpand} />
            if (child.key !== firstBilling) return [row]
            return [
              row,
              <li key={`more:${node.key}`}>
                <Button variant="ghost" className="h-6 px-2 text-xs" onClick={() => onExpand(node.key)} data-family-more={node.key}>
                  <Trans t={t} i18nKey="family.moreBillings" count={node.folded.length} components={{ n: <Ltr /> }} />
                </Button>
              </li>,
            ]
          })}
        </ul>
      )}
    </li>
  )
}

/** A small dashed label beside the meta line (the till invoice, the partner reference); it gives way only after the meta line. */
const LABEL = 'min-w-0 truncate rounded border border-dashed border-border px-1.5 text-[0.6875rem] text-muted-foreground'

/**
 * A member's row: the category badge (its name as the tooltip), the number, a muted meta line cut
 * short with an ellipsis, and the status chip. The badge, number and chip never shrink, so only the
 * meta line gives way. The open document is tinted, with an accent bar on its inline-start edge and a
 * "You are here" tag, and is not a link.
 */
function MemberRow({ node, isRoot, openRow }: { node: FamilyTreeNode; isRoot: boolean; openRow: RefObject<HTMLDivElement | null> }) {
  const { t } = useTranslation('document')
  const m = node.member
  const kind = familyCategory(node.category)
  const categoryName = t(kind.nameKey)
  const type = (m.documentTypeDescription ?? '').trim() || (m.documentType ?? '').trim()
  const store = formatPair(m.storeCode, m.storeName)
  const when = formatDateTime(m.entryTime)
  const status = (m.statusDescription ?? '').trim() || (m.status ?? '').trim()
  const tillInvoice = (m.tillInvoiceNo ?? '').trim()
  // The partner reference: a pair led by the partner's name (free text), so one `<bdi>` around the whole pair.
  const partner =
    isRoot && m.partnerReference
      ? formatPair(m.partnerReference.source, (m.partnerReference.orderNo ?? '').trim() || m.partnerReference.sourceReference)
      : ''

  const body = (
    <>
      <span
        title={categoryName}
        className={`grid h-5.5 w-5.5 flex-none place-items-center rounded-[5px] text-xs font-bold ${kind.badge}`}
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
          <Trans t={t} i18nKey="family.tillInvoice" values={{ tillInvoice }} components={{ n: <Ltr /> }} />
        </span>
      )}
      {partner && (
        <span title={t('family.partnerReference')} className={LABEL} data-family-partner="">
          <bdi>{partner}</bdi>
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
  return (
    <div
      title={kind.noPageKey ? t(kind.noPageKey) : undefined}
      className={`${row} border-transparent text-muted-foreground`}
      data-family-member={node.key}
    >
      {body}
    </div>
  )
}
