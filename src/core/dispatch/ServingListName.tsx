import { Link } from 'react-router'
import Ltr from '@/core/ui/Ltr'
import { servingListHref, type ServingListView } from './view'

/**
 * A callout's serving list as one value (spec 3042, oms 572), shared by the board's inspector (541) and a
 * delivery's Callout sub-tab (542). The name is free text in either script (`<bdi>`); a gone list's bare id
 * is a machine value (`Ltr`); no list reads `dash` (the caller's own word). `canLink` (567's
 * `canViewServingLists`) makes it a link to the list's screen; without it, plain text.
 */
export default function ServingListName({ view, dash, canLink = false }: { view: ServingListView; dash: string; canLink?: boolean }) {
  if (view.kind === 'none') return <span data-serving-list="">{dash}</span>
  const value = view.named ? <bdi>{view.label}</bdi> : <Ltr>{view.label}</Ltr>
  return canLink ? (
    <Link to={servingListHref(view.id)} className="font-medium text-primary underline-offset-2 hover:underline" data-serving-list={view.id} data-serving-list-link="">
      {value}
    </Link>
  ) : (
    <span data-serving-list={view.id}>{value}</span>
  )
}
