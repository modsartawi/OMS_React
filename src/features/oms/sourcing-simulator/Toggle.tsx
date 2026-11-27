import { useId, type ComponentProps } from 'react'

/**
 * A switch with its label and an optional hint (ticket 963: the weight set's factors, reach and shape, and "everything in
 * one shipment"). A checkbox with `role="switch"`, so the control ratchet does not count it; its tick takes the primary
 * token.
 */
export default function Toggle({
  checked,
  onChange,
  label,
  hint,
  ...rest
}: { checked: boolean; onChange: (on: boolean) => void; label: string; hint?: string } & Omit<ComponentProps<'label'>, 'onChange'>) {
  const id = useId()
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2 text-xs" {...rest}>
      <input id={id} type="checkbox" role="switch" className="mt-0.5 size-3.5 accent-primary" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span className="flex flex-col">
        <span>{label}</span>
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </span>
    </label>
  )
}
