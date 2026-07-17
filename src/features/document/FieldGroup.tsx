import type { FieldRow } from './fields'

/**
 * A titled, read-only label/value list — the building block for every Screen 2
 * read-only group: the Document / Status / Customer header groups, the Shipping
 * Address group, and the Status tab.
 *
 * Purely presentational: the caller supplies already-formatted rows.
 */
export default function FieldGroup({
  title,
  fields,
  className = '',
}: {
  title: string
  fields: readonly FieldRow[]
  className?: string
}) {
  return (
    <section className={`h-full rounded-md border border-border bg-card ${className}`}>
      <h2 className="rounded-t-md border-b border-border bg-muted/60 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-muted-foreground">
        {title}
      </h2>
      <dl className="grid px-2.5 py-1.5">
        {fields.map((field) => (
          <div
            key={field.label}
            className="grid grid-cols-[minmax(8.5rem,max-content)_1fr] items-baseline gap-x-3 py-0.5"
          >
            <dt className="text-xs font-semibold text-muted-foreground">{field.label}</dt>
            <dd className="m-0 break-words text-[0.8125rem] font-semibold">
              {field.href ? (
                <a
                  href={field.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  {field.value || field.href}
                </a>
              ) : (
                // An em dash, not an empty cell: it says "the server sent
                // nothing here", which a blank space cannot distinguish from a
                // rendering bug.
                field.value || '—'
              )}
            </dd>
          </div>
        ))}
      </dl>
    </section>
  )
}
