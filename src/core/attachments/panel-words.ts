import type { ReactNode } from 'react'

/**
 * **The caller's words** for the shared attachments panel (ticket 326) — every
 * sentence that names what the files ARE (a store day's slips, an order's
 * prescriptions) or where they are shown (a drawer, a tab). Each caller resolves them
 * through its own namespace and hands them in, so the panel's own `attachments`
 * namespace holds only words that name no owner.
 *
 * Plain strings, a function where the sentence carries the file's name, and one node
 * where the caller's sentence carries a link. Types only: no React at run time, no i18n.
 */
export interface AttachmentsPanelWords {
  /**
   * The caller's heading over the panel, drawn as given, or absent for none. The order
   * tab's "Filed on order \<no\>" on a delivery's page, its number a link (329); the
   * slip's drawer has none.
   */
  heading?: ReactNode

  /** The list is loading — the shimmer's accessible name. */
  loading: string
  /** No stored file. */
  empty: string
  /** ByOwner answered a bare 403: the probe said yes, the door says no. */
  listRefused: string
  /** ByOwner failed with no message of its own. */
  listFailed: string
  /** The source column's heading (the slip's "Till"). */
  sourceColumn: string
  /** The preview region's accessible name. */
  previewRegion: string
  /** Files listed, none selected yet: the preview's prompt. */
  noSelection: string
  /** A file's bytes are loading — the shimmer's accessible name. */
  previewLoading: string
  /** The image's `alt` and the PDF frame's `title`. */
  previewAlt: (fileName: string) => string
  /** `/Content` failed with no message of its own. */
  previewFailed: string

  /** Add's region name. */
  addRegion: string
  /** Add's button. */
  addButton: string
  /** An upload refused with no message of its own. */
  addFailed: string
  /** The caption field's label — read only when the caller's Add takes a caption (330). */
  addCaptionLabel?: string
  /** Under the caption field — read only when the caller's Add takes a caption (330). */
  addCaptionHint?: string

  /** The withdraw dialog's title. */
  withdrawTitle: string
  /** "A withdrawal is final…" */
  withdrawFinal: string
  /** Under the note, when the picked reason needs one. */
  withdrawNoteRequired: string
  /** The confirm button. */
  withdrawConfirm: string
  /** A withdraw refused with no message of its own. */
  withdrawFailed: string
  /** A withdraw answered 404: no longer a stored file this session may withdraw. */
  withdrawGone: (fileName: string) => string
  /** A bare 403 took Withdraw away for the rest of this visit. */
  withdrawForbidden: string
}
