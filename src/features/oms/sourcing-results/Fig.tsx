import type { ReactNode } from 'react'
import Ltr from '@/core/ui/Ltr'

/**
 * A machine value inside a `<Trans>` sentence, isolated whole (`.claude/rules/bidi.md`). It draws its own `value` and
 * ignores the children `<Trans>` hands it, so the locale may write the slot self-closing (`<orders/>`).
 */
export default function Fig({ value, bold = false }: { value: string; bold?: boolean; children?: ReactNode }) {
  return bold ? (
    <b>
      <Ltr>{value}</Ltr>
    </b>
  ) : (
    <Ltr>{value}</Ltr>
  )
}
