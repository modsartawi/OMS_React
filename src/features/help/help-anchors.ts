/**
 * An article's heading anchors, as BackOffice reads them (`SIS.Api/Endpoints/Help/HelpArticleParser.cs`, pricing2 @
 * 98f9a5ad9) — so a `help:slug#anchor` link, and a Copilot help link's `anchor`, land on the heading the server means.
 * Pure: no React.
 *
 * - Only `##` and `###` headings outside a code fence (``` or ~~~) are sections.
 * - A heading may end with `{#anchor}`: that is its anchor, the same in both languages, and it is not part of the words
 *   the reader sees.
 * - Otherwise the anchor is the heading's letters and digits (any script), lower-cased, joined by single hyphens, marks
 *   dropped (`Slugify`); a repeat gets `-2`, `-3`… (`Unique`, against every anchor before it, explicit ones included).
 */
import type { HelpSection } from '@/core/models/help'

const HEADING = /^(#{2,3})\s+(.+?)\s*$/
const EXPLICIT = /\s*\{#([^}\s]+)\}$/
const FENCE = /^\s*(```|~~~)/

/** The server's `Slugify`: letters and digits of any script, lower case, single hyphens; non-spacing marks and format characters dropped. */
export function helpSlugify(heading: string): string {
  let slug = ''
  for (const c of heading.toLowerCase()) {
    if (/[\p{Mn}\p{Cf}]/u.test(c)) continue
    if (/[\p{L}\p{Nd}]/u.test(c)) slug += c
    else if (slug !== '' && !slug.endsWith('-')) slug += '-'
  }
  return slug.replace(/-+$/, '')
}

/** One `##` / `###` heading: its level, its words without the `{#anchor}`, its anchor. */
export interface HeadingAnchor {
  level: number
  heading: string
  anchor: string
}

/** Calls `visit` for each section heading line outside a fence, with its index; `visit` may return a replacement line. */
function eachHeading(markdown: string, visit: (match: RegExpExecArray) => string | void): string {
  let fenced = false
  return markdown
    .split('\n')
    .map((line) => {
      if (FENCE.test(line)) fenced = !fenced
      const match = fenced ? null : HEADING.exec(line)
      return (match && visit(match)) ?? line
    })
    .join('\n')
}

/** Every section heading of `markdown` with its anchor, in order — what the server's section outline holds after its intro. */
export function headingAnchors(markdown: string): HeadingAnchor[] {
  const used = new Set<string>()
  const out: HeadingAnchor[] = []
  eachHeading(markdown, (m) => {
    const words = m[2]
    const explicit = EXPLICIT.exec(words)
    let anchor: string
    let heading: string
    if (explicit) {
      heading = words.slice(0, explicit.index).trim()
      anchor = explicit[1]
      used.add(anchor)
    } else {
      heading = words
      const slug = helpSlugify(words)
      anchor = slug
      for (let n = 2; used.has(anchor); n++) anchor = `${slug}-${n}`
      used.add(anchor)
    }
    out.push({ level: m[1].length, heading, anchor })
  })
  return out
}

/** `markdown` with each section heading's `{#anchor}` taken off the words the reader sees. */
export const withoutHeadingAnchors = (markdown: string): string =>
  eachHeading(markdown, (m) => {
    const explicit = EXPLICIT.exec(m[2])
    return explicit ? `${m[1]} ${m[2].slice(0, explicit.index).trim()}` : undefined
  })

/**
 * The renderer's `slugify`: each heading's words → the anchor the server gave it — the section outline when the server
 * sent one, else worked out the same way here. Headings are met in document order, so repeats of the same words take
 * their anchors in turn. Make one per render: it is used up as the document is drawn.
 */
export function anchorSlugifier(markdown: string, sections?: readonly HelpSection[]): (text: string) => string {
  const outline = sections && sections.length > 0 ? sections.filter((s) => s.anchor !== '') : headingAnchors(markdown)
  const queue = new Map<string, string[]>()
  for (const s of outline) {
    const key = helpSlugify(s.heading)
    queue.set(key, [...(queue.get(key) ?? []), s.anchor])
  }
  return (text) => {
    const key = helpSlugify(text)
    return queue.get(key)?.shift() ?? key
  }
}
