/**
 * The serial refusal report's grant (ticket 573, BackOffice 3065), read off the one permissions answer (oms 909).
 */
import type { Permissions } from '@/core/permissions'

/** `SerialRefusal:03` — the menu leaf's and the page gate's one predicate. */
export const canOpenSerialRefusals = (p: Permissions): boolean => p.has('SerialRefusal:03')
