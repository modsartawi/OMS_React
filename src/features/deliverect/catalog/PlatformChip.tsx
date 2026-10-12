import Ltr from '@/core/ui/Ltr'

/** A platform key as a chip — its own isolate, so each key reads left-to-right under RTL. */
export default function PlatformChip({ platformKey, muted = false }: { platformKey: string; muted?: boolean }) {
  return (
    <span
      className={
        'inline-flex h-5 items-center rounded-full border px-2 font-mono text-[11px] ' +
        (muted ? 'border-dashed border-border bg-muted text-muted-foreground' : 'border-transparent bg-attention-050 text-attention-800')
      }
      data-platform-chip={platformKey}
    >
      <Ltr>{platformKey}</Ltr>
    </span>
  )
}
