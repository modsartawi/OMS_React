import { ChartColumn, FileText, LayoutDashboard, ListChecks, type LucideIcon } from 'lucide-react'
import type { AnalyticsItem } from '@/core/models/analytics'

/** An item's icon in the library and on the home (926: an item list's beside a board's, a report's and a view's). */
const KIND_ICON: Record<AnalyticsItem['kind'], LucideIcon> = { view: ChartColumn, board: LayoutDashboard, report: FileText, itemlist: ListChecks }

export const kindIcon = (kind: AnalyticsItem['kind']): LucideIcon => KIND_ICON[kind] ?? ChartColumn
