/**
 * HQ prescription sessions' grants (BackOffice 3459, oms 852), read off the one permissions answer (oms 909).
 */
import type { Permissions } from '@/core/permissions'

/** `PrescriptionSessionHq:03` — the leaf's predicate. */
export const canViewPrescriptionSessions = (p: Permissions): boolean => p.has('PrescriptionSessionHq:03')
