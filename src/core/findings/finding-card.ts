/**
 * The finding card's pure half (oms 946, BackOffice spec 4165): a stored colour → its tone token class. The server
 * chose the colour (spec "The routes compute no colour"); this only names the token that draws it, so no colour literal
 * reaches a component (`tools/check-palette.mjs`). The status line's run dot reads it too.
 */
import type { CcColour, CcTarget } from '@/core/models/command-center'

/**
 * Where a link in a server sentence or a profile cell goes — a pharmacy code, a category name. The caller decides
 * (`targetHref` in `@/core/command-center-routes`); the card, the sentence and the profile tables only call it.
 */
export type HrefOf = (target: CcTarget) => string

/** A stored colour's dot: the status tokens of `app/global.css`. */
export const TONE_DOT: Readonly<Record<CcColour, string>> = Object.freeze({
  green: 'bg-success',
  amber: 'bg-attention',
  red: 'bg-danger',
})
