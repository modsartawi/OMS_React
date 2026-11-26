/**
 * The figure an underlined number stands for, and the one value the orders door is asked for it with (ticket 971,
 * results ticket decision 5: "every underlined figure opens one").
 *
 * PROVISIONAL (spec 4354: not specified) — the encoding: `segment:<SEGMENT>`, `class:<VIEW>:<CLASS>`,
 * `promise:<MODE>[:<GROUP>]`, `mark:<MARK>`, `runNotEnded`, `notRun`. Ticket 972 adds its tabs' figures.
 */
import type { ResultsFigure } from '@/core/models/sourcing-results'

export function encodeFigure(f: ResultsFigure): string {
  switch (f.kind) {
    case 'segment':
      return `segment:${f.segment}`
    case 'class':
      return `class:${f.view}:${f.cls}`
    case 'promise':
      return f.channelGroup ? `promise:${f.mode}:${f.channelGroup}` : `promise:${f.mode}`
    case 'mark':
      return `mark:${f.mark}`
    case 'runNotEnded':
    case 'notRun':
      return f.kind
  }
}
