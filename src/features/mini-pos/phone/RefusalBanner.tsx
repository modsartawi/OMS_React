import { AlertTriangle } from 'lucide-react'
import type { ShownRefusal } from './refusal'

/**
 * A refusal in the server's own words: English, and Arabic beside it when the server sent it (the Mini POS door's
 * refusals carry both). Each line is free text in its own script, so each is isolated with its own direction.
 */
export default function RefusalBanner({ refusal }: { refusal: ShownRefusal }) {
  return (
    <div
      role="alert"
      data-refusal={refusal.code ?? ''}
      className="flex gap-2 rounded-lg border border-danger-border bg-danger-050 p-3 text-sm text-danger-800"
    >
      <AlertTriangle className="mt-0.5 size-4 shrink-0" aria-hidden />
      <div className="flex min-w-0 flex-col gap-1">
        <p lang="en">
          <bdi dir="ltr">{refusal.english}</bdi>
        </p>
        {refusal.arabic && (
          <p lang="ar">
            <bdi dir="rtl">{refusal.arabic}</bdi>
          </p>
        )}
      </div>
    </div>
  )
}
