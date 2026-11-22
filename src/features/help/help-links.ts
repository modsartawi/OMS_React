/**
 * What an article's link and image targets mean (oms 951, BackOffice spec 4182 §A). Pure: no React, no i18n.
 *
 * - `screen:/analytics/boards` → a route in this app, drawn as "Open this screen".
 * - `help:boards#share` → another article of the same area (and a heading in it); `help:#x` and `#x` → a heading here.
 * - `images/boards-editor.en.png` → a file of the area's help image route, in the app's language.
 */
import { helpHref } from '@/core/help/help-routes'
import type { HelpLang } from '@/core/models/help'

export type HelpLink =
  | { kind: 'screen'; to: string }
  | { kind: 'help'; to: string }
  | { kind: 'anchor'; to: string }
  | { kind: 'external'; to: string }

const SCREEN = 'screen:'
const HELP = 'help:'

/** The link an article's `href` makes, inside `area`'s help. */
export function helpLinkOf(href: string, area: string): HelpLink {
  if (href.startsWith(SCREEN)) {
    const to = href.slice(SCREEN.length)
    // An app route only: one leading slash (`//host` would be another origin).
    return to.startsWith('/') && !to.startsWith('//') ? { kind: 'screen', to } : { kind: 'external', to: href }
  }
  if (href.startsWith(HELP)) {
    const [slug, anchor] = href.slice(HELP.length).split('#', 2)
    if (!slug) return { kind: 'anchor', to: `#${anchor ?? ''}` }
    return { kind: 'help', to: helpHref(area, slug, anchor) }
  }
  if (href.startsWith('#')) return { kind: 'anchor', to: href }
  return { kind: 'external', to: href }
}

/** `images/<file>` — one file name, no folder, no climbing out. */
const IMAGE = /^(?:\.\/)?images\/([A-Za-z0-9][A-Za-z0-9._-]*)$/

/**
 * The help image file an article's `src` names, for `lang`: `boards-editor.en.png` read in Arabic is
 * `boards-editor.ar.png` (every shot is captured in both). A file with no `.en.`/`.ar.` before its extension is
 * shared. Null for anything outside the help image folder — the help never loads another host's image.
 */
export function helpImageFile(src: string, lang: HelpLang): string | null {
  const file = IMAGE.exec(src)?.[1]
  if (!file || file.includes('..')) return null
  return file.replace(/\.(en|ar)(\.[A-Za-z0-9]+)$/, `.${lang}$2`)
}
