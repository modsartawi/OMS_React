/**
 * The Mini POS scorecard's grant (oms 930, BackOffice 4075), read off the one permissions answer (oms 914):
 * `BackOfficeScreen[MiniPosScorecard, 03]` — role `OMS_MINIPOS_SCORECARD` (the panel), and the same grant on the
 * operations lead's `OMS_MINIPOS_ADMIN` (the weekly review). `MiniPosAdmin:03` alone does not open it.
 */
import type { Permissions } from '@/core/permissions'

/** `MiniPosScorecard:03` — the menu leaf's and the page gate's one predicate. */
export const canOpenMiniPosScorecard = (p: Permissions): boolean => p.has('MiniPosScorecard:03')
