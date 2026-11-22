import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useQueries } from '@tanstack/react-query'
import { Link, useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import { Printer } from 'lucide-react'
import { apiErrorMessage } from '@/core/api'
import { helpArticleQuery, useHelpContents } from '@/core/help/help-api'
import { helpDir } from '@/core/help/help-lang'
import { helpPath } from '@/core/help/help-routes'
import Button from '@/core/ui/Button'
import { buttonClass } from '@/core/ui/control-classes'
import ErrorBanner from '@/core/ui/ErrorBanner'
import HelpPrintDocument from './HelpPrintDocument'
import { inReadingOrder } from './help-contents'
import { contentsPageNumbers, helpPrintLang, printReady, type PrintBlock } from './help-print'

// A4 (210 × 297 mm) less the page margins below: the paper is exactly this wide on screen too, so what the page
// measures on screen is what prints (CSS millimetres are the same length on both).
const MARGIN = { top: 14, side: 14, bottom: 16 }
const PAPER_WIDTH = `${210 - 2 * MARGIN.side}mm`
const PAGE_HEIGHT_MM = 297 - MARGIN.top - MARGIN.bottom
const PX_PER_MM = 96 / 25.4

// Route-scoped (an imported stylesheet's global `@page` would never unload — see collection's print-page-rule). The
// footer's page number is a CSS counter in the page's bottom margin box; the cover carries none.
const PAGE_RULE = [
  `@page { size: A4; margin: ${MARGIN.top}mm ${MARGIN.side}mm ${MARGIN.bottom}mm;`,
  "  @bottom-center { content: counter(page); font-family: 'IBM Plex Sans', 'IBM Plex Sans Arabic', sans-serif; font-size: 9pt; } }",
  '@page :first { @bottom-center { content: none; } }',
  '@media print { html, body { background: var(--card) !important; } }',
].join('\n')

// Walked into, not measured whole: a block of the paper made of smaller blocks the printer can break between.
const CONTAINERS = new Set(['DIV', 'SECTION', 'UL', 'OL', 'TABLE', 'THEAD', 'TBODY', 'TFOOT', 'BLOCKQUOTE'])

/**
 * A run of the paper (an article, the contents) as the blocks Chromium fragments it into on paper (`pagesOfBlocks`),
 * in px from its top: a list's items, a table's rows, each paragraph, heading, picture and code block. A block that
 * must not split is one with `break-inside: avoid` or one holding such a block (a paragraph with a picture); a heading
 * (`break-after: avoid`) and a table's header row keep with their next; anything else is text breaking between its lines.
 */
function printBlocks(run: Element | null): PrintBlock[] {
  if (!run) return []
  const origin = run.getBoundingClientRect().top
  const avoids = (el: Element) => getComputedStyle(el).breakInside === 'avoid'
  const walk = (el: Element): PrintBlock[] =>
    [...el.children].flatMap((child) => {
      const style = getComputedStyle(child)
      if (style.display === 'none' || style.position === 'absolute' || style.position === 'fixed') return []
      // A table's header row: Chromium never leaves it at a page bottom without a body row.
      const keepWithNext = style.breakAfter === 'avoid' || child.parentElement?.tagName === 'THEAD'
      const whole = style.breakInside === 'avoid'
      if (!whole && !keepWithNext && CONTAINERS.has(child.tagName) && child.children.length > 0) return walk(child)
      const box = child.getBoundingClientRect()
      const block: PrintBlock = { top: box.top - origin, height: box.height, keepWithNext }
      if (whole || [...child.querySelectorAll('*')].some(avoids)) return [block]
      const line = parseFloat(style.lineHeight)
      return [{ ...block, line: Number.isFinite(line) ? line : parseFloat(style.fontSize) * 1.2 }]
    })
  return walk(run)
}

/**
 * The whole help on paper (oms 953, BackOffice spec 4182 §D) at `/<area>/print/help?lang=en|ar`, a sibling of the
 * report's and the catalog's print pages: outside the shell, A4, one language (`?lang=`, never the app's) and its
 * direction; the Arabic text takes the app's Arabic font through `--font-sans`.
 *
 * It says it is ready (`data-print-ready`) once every article is in, every picture has loaded or failed and the
 * contents' page numbers are laid out (`help-print.ts`), so a headless renderer can print it later. It never opens the
 * print dialog itself: the launch PDFs are the browser's Save as PDF (BO 4187).
 *
 * Reconciled with BackOffice pricing2 @ 98f9a5ad9 (4183/4184/4188): the wire shapes are in `@/core/models/help`.
 */
export default function HelpPrintPage({ area }: { area: string }) {
  const [search] = useSearchParams()
  const lang = helpPrintLang(search)
  const { t } = useTranslation('help', { lng: lang })
  const contents = useHelpContents(area, lang)
  const ordered = useMemo(() => inReadingOrder(contents.data?.articles ?? []), [contents.data])
  const reads = useQueries({
    queries: ordered.map((a) => ({ ...helpArticleQuery(area, a.slug, lang), retry: false })),
    // A failed article is null: printed with its heading only, never holding the paper back.
    combine: (rs) => rs.map((r) => (r.data ? r.data : r.isError ? null : undefined)),
  })
  const articles = reads.flatMap((a) => (a ? [a] : []))
  // A stable fingerprint of what has arrived (`combine` hands back a new array each render).
  const arrived = reads.map((a) => (a === undefined ? '…' : a === null ? '!' : a.slug)).join('|')

  const [settled, setSettled] = useState<ReadonlySet<string>>(() => new Set())
  const onImageSettled = useCallback((file: string) => setSettled((s) => (s.has(file) ? s : new Set(s).add(file))), [])

  // The paper takes the print language's direction (the app's own is a boot fact) and gives it back on the way out.
  useLayoutEffect(() => {
    const root = document.documentElement
    const was = { dir: root.dir, lang: root.lang }
    root.dir = helpDir(lang)
    root.lang = lang
    return () => {
      root.dir = was.dir
      root.lang = was.lang
    }
  }, [lang])

  useEffect(() => {
    const style = document.createElement('style')
    style.dataset.printPage = 'help'
    style.textContent = PAGE_RULE
    document.head.appendChild(style)
    return () => style.remove()
  }, [])

  // Once everything has drawn, measure the blocks at the paper's width and paginate them for the contents' page numbers.
  const paperRef = useRef<HTMLDivElement>(null)
  const drawn = contents.isSuccess && printReady({ articles: reads, settled, lang, paged: true })
  const [pageNumbers, setPageNumbers] = useState<number[] | null>(null)
  useEffect(() => {
    if (!drawn) return
    const frame = window.requestAnimationFrame(() => {
      const paper = paperRef.current
      if (!paper) return
      setPageNumbers(
        contentsPageNumbers({
          pageHeight: PAGE_HEIGHT_MM * PX_PER_MM,
          contents: printBlocks(paper.querySelector('[data-help-print-contents]')),
          articles: [...paper.querySelectorAll('[data-help-print-article]')].map(printBlocks),
        }),
      )
    })
    return () => window.cancelAnimationFrame(frame)
  }, [drawn, arrived, settled])
  const ready = drawn && printReady({ articles: reads, settled, lang, paged: pageNumbers !== null })

  const [printedOn] = useState(() => new Date().toLocaleDateString('en-CA'))

  return (
    <div
      className="min-h-screen bg-muted/40 py-6 print:bg-card print:py-0"
      data-help-print-state={ready ? 'ready' : 'waiting'}
      {...(ready ? { 'data-print-ready': '' } : {})}
    >
      <div dir={helpDir(lang)} className="mx-auto mb-4 flex justify-end gap-2 print:hidden" style={{ width: PAPER_WIDTH }}>
        <Link to={helpPath(area)} className={buttonClass('secondary')} data-help-print-back>
          {t('print.back')}
        </Link>
        <Button onClick={() => window.print()} disabled={!ready}>
          <Printer className="size-3.5" aria-hidden />
          {t('print.printNow')}
        </Button>
      </div>
      <div ref={paperRef} className="mx-auto bg-card ring-8 ring-card print:ring-0" style={{ width: PAPER_WIDTH }}>
        {contents.isError ? (
          <ErrorBanner title={t('state.contentsFailed')} message={apiErrorMessage(contents.error, t('state.contentsFailed'))} className="px-3 py-2" />
        ) : !contents.data ? (
          <p className="p-8 text-sm text-muted-foreground" role="status">
            {t('state.loading')}
          </p>
        ) : (
          <HelpPrintDocument area={area} lang={lang} contents={contents.data} articles={articles} pageNumbers={pageNumbers} printedOn={printedOn} onImageSettled={onImageSettled} />
        )}
      </div>
    </div>
  )
}
