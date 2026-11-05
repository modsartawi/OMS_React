import { useTranslation } from 'react-i18next'
import type { AnalyticsReport, AnalyticsReportBlock } from '@/core/models/analytics'
import Ltr from '@/core/ui/Ltr'
import CopilotViewEmbed from './CopilotViewEmbed'

/**
 * A copilot report as a document (CTO demo): headings, paragraphs and bullets, small tables, and charts drawn live
 * from their saved views. One rendering for the report page and its print page. The report carries its own language
 * (`lang`), so the document sets its own `dir`; every server text is free text in either script (`<bdi>` / `dir`).
 */
/** A4 at 14 mm margins is ~688 CSS px: the print page lays the report out this wide on screen and on paper alike. */
export const PAPER_PX = 680

export default function ReportDocument({ report, paper = false }: { report: AnalyticsReport; paper?: boolean }) {
  // The report's own words (its revision line, its footer) follow the REPORT's language, not the screen's.
  const { t } = useTranslation('boards', { lng: report.lang })
  const rtl = report.lang === 'ar'
  return (
    <article lang={report.lang} dir={rtl ? 'rtl' : 'ltr'} className={`mx-auto flex flex-col gap-4 bg-card text-sm leading-6 print:p-0 ${paper ? 'p-0' : 'w-full max-w-4xl p-8'}`} style={paper ? { width: PAPER_PX } : undefined} data-analytics-report={report.id}>
      <header className="flex flex-col gap-1 border-b border-border pb-4">
        <h1 className="text-2xl font-semibold tracking-tight">{report.title}</h1>
        {report.subtitle && <p className="text-base text-muted-foreground">{report.subtitle}</p>}
        <p className="text-xs text-muted-foreground">
          {t('report.meta', { n: report.revision, at: '' })}
          <Ltr>{report.updatedAt.replace('T', ' ').slice(0, 16)}</Ltr>
        </p>
      </header>
      {report.blocks.map((b, i) => (
        <Block key={i} block={b} />
      ))}
      <footer className="mt-4 border-t border-border pt-3 text-xs text-muted-foreground">{t('report.source')}</footer>
    </article>
  )
}

function Block({ block }: { block: AnalyticsReportBlock }) {
  if (block.kind === 'heading') return <h2 className="mt-2 text-lg font-semibold [break-after:avoid]">{block.text}</h2>
  if (block.kind === 'chart')
    return (
      <figure className="block space-y-1 [break-inside:avoid] [page-break-inside:avoid]" data-report-chart={block.viewId}>
        <CopilotViewEmbed viewId={block.viewId} />
        {block.caption && <figcaption className="text-xs text-muted-foreground">{block.caption}</figcaption>}
      </figure>
    )
  if (block.kind === 'table')
    return (
      <div className="overflow-x-auto [break-inside:avoid]">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              {block.head.map((h, i) => (
                <th key={i} className="border-b border-border px-2 py-1 text-start font-medium">
                  <bdi>{h}</bdi>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {block.rows.map((row, r) => (
              <tr key={r}>
                {row.map((c, i) => (
                  <td key={i} className="border-b border-border/50 px-2 py-1">
                    <bdi>{c}</bdi>
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
  return <TextBlock text={block.text} />
}

const BULLET = /^\s*[-*•]\s+/

/** Paragraphs and "- " bullet runs, as the copilot writes them. */
function TextBlock({ text }: { text: string }) {
  const parts: { list: boolean; lines: string[] }[] = []
  for (const line of text.replace(/\r\n?/g, '\n').split('\n')) {
    if (line.trim() === '') {
      parts.push({ list: false, lines: [] })
      continue
    }
    const list = BULLET.test(line)
    const last = parts[parts.length - 1]
    if (last && last.list === list && (list || last.lines.length > 0)) last.lines.push(list ? line.replace(BULLET, '') : line)
    else parts.push({ list, lines: [list ? line.replace(BULLET, '') : line] })
  }
  return (
    <>
      {parts
        .filter((p) => p.lines.length > 0)
        .map((p, i) =>
          p.list ? (
            <ul key={i} className="list-disc ps-6">
              {p.lines.map((l, j) => (
                <li key={j}>{l}</li>
              ))}
            </ul>
          ) : (
            <p key={i}>{p.lines.join(' ')}</p>
          ),
        )}
    </>
  )
}
