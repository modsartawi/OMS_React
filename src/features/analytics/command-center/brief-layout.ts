/**
 * The brief's layout, pure (oms 946, BackOffice spec 4165): which sections stand open and which fold under "More in
 * today's brief". The server says which (`folded`) and in what order; this splits and keeps that order. It computes no
 * figure, colour or order (ticket 946).
 */
import type { CcBrief, CcSection } from '@/core/models/command-center'

export interface BriefLayout {
  /** The headline, what changed overnight, the top risks and the top opportunities — as the server ordered them. */
  open: CcSection[]
  /** The four folded sections, each shown by its one-line summary. */
  folded: CcSection[]
}

export const briefLayout = (brief: CcBrief): BriefLayout => ({
  open: brief.sections.filter((s) => !s.folded),
  folded: brief.sections.filter((s) => s.folded),
})
