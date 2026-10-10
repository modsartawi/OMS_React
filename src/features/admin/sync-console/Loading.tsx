import { Loader2 } from 'lucide-react'

/** A first read in flight: the spinner and its sentence, the one loading line of the store page. */
export default function Loading({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-8 text-sm text-muted-foreground" role="status">
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
      {label}
    </div>
  )
}
