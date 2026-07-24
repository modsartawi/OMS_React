import { AlertTriangle } from 'lucide-react'

/**
 * Semantic error surface on the danger family (ticket 088): the `danger-050`
 * ground with `danger-border` and `danger-800` ink is one string valid in both
 * themes — `-050` / `-800` are roles that swap lightness (global.css R4), so the
 * banner keeps its alert chroma light or dark with no `dark:` twin. One component
 * for every error block on Screen 2 and its dialogs.
 *
 * Sizing (height / padding) is the call site's business via `className`;
 * `center` switches between the centered fixed-height form and the top-aligned
 * title + detail form.
 */
export default function ErrorBanner({
  title,
  message,
  center = false,
  className = '',
}: {
  title?: string
  message: string
  center?: boolean
  className?: string
}) {
  return (
    <div
      role="alert"
      className={
        'flex gap-2 rounded-lg border border-danger-border bg-danger-050 text-[0.8125rem] text-danger-800 ' +
        (center ? 'items-center justify-center ' : 'items-start ') +
        className
      }
    >
      <AlertTriangle className={(title ? 'mt-0.5 ' : '') + 'h-4 w-4 shrink-0'} aria-hidden />
      {title ? (
        <div>
          <p className="font-semibold">{title}</p>
          <p>{message}</p>
        </div>
      ) : (
        <span>{message}</span>
      )}
    </div>
  )
}
