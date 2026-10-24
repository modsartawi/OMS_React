import { useTranslation } from 'react-i18next'
import Ltr from '@/core/ui/Ltr'
import { codeWord } from './code-words'

/**
 * A machine code drawn in JSX: its word (`data-sync:<prefix>.<code>`), else the raw code isolated
 * as a machine value in `Ltr` (`./code-words`). `className` styles the raw fallback only.
 */
export default function CodeWord({ prefix, code, className }: { prefix: string; code: string; className?: string }) {
  const { t } = useTranslation('data-sync')
  const word = codeWord(t, prefix, code)
  if (word) return <>{word}</>
  return (
    <span className={className}>
      <Ltr>{code}</Ltr>
    </span>
  )
}
