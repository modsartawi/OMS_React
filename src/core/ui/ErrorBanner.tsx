import { AlertTriangle } from 'lucide-react'

/**
 * Semantic error surface on the warm palette: a translucent red tint composited
 * over the warm canvas instead of an opaque cool `red-50` / `red-950` sheet, so
 * the banner keeps its alert chroma without going cold against the ivory/
 * warm-black surroundings. One component for every error block on Screen 2 and
 * its dialogs.
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
        'flex gap-2 rounded-lg border border-red-800/25 bg-red-700/5 text-[0.8125rem] text-red-900 ' +
        'dark:border-red-400/25 dark:bg-red-400/10 dark:text-red-200 ' +
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
