/**
 * The list's acts (ticket 401, spec 380 L14; rulings 367 §3, 365 §4–§5): Reschedule, Request
 * cancellation and Add note, in the order the inspector draws them. Each is a deep link to
 * Delivery details carrying its one-shot `open` intent — the list posts nothing, and Details
 * opens the dialog through its own gate. One record per act: its key (R / C / N, the palette
 * row and the status bar's hint), and its icon in its command family's colour, the same icon
 * its button carries on Delivery details.
 */
import { CalendarClock, Flag, Plus, type LucideIcon } from 'lucide-react'
import type { OpenIntent } from '@/core/oms/open-intent'

export interface DeliveryAct {
  intent: OpenIntent
  keys: string
  icon: LucideIcon
  /** The icon's ink: its family on Delivery details' command bar (072). */
  tone: string
}

export const DELIVERY_ACTS: readonly DeliveryAct[] = [
  { intent: 'reschedule', keys: 'KeyR', icon: CalendarClock, tone: 'text-fam-fulfilment' },
  { intent: 'request-close', keys: 'KeyC', icon: Flag, tone: 'text-fam-cancel-request' },
  { intent: 'add-note', keys: 'KeyN', icon: Plus, tone: 'text-muted-foreground' },
]
