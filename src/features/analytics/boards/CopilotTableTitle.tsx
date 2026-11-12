import type { CopilotAnswerTable } from '@/core/models/copilot'
import { copilotTableTitle } from './copilot-table'

/**
 * The title above a copilot answer table (ticket 878; BackOffice spec 3587 B22, ticket 3621): a part of an analysis
 * result carries one (the cut's name, "The headline"), drawn in the screen's language as an answer's view titles are —
 * free text, isolated whole. `id` lets the table's section be named by it. A plain query's table has no title: nothing
 * is drawn, and the table reads as it did.
 */
export default function CopilotTableTitle({ table, lang, id }: { table: CopilotAnswerTable; lang: string; id?: string }) {
  const title = copilotTableTitle(table, lang)
  if (!title) return null
  return (
    <span className="text-sm font-medium" id={id} data-copilot-table-title>
      <bdi>{title}</bdi>
    </span>
  )
}
