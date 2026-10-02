// Throwaway UI review control. Arrow keys never steal grid or form navigation.
import { useEffect } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'

export default function PrototypeSwitcher({ names, current, onChange, previousLabel, nextLabel, children }: {
  names: string[]; current: number; onChange: (index: number) => void
  previousLabel: string; nextLabel: string; children?: React.ReactNode
}) {
  useEffect(() => {
    const keydown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement
      if (target.closest('input, textarea, select, button, [contenteditable], [role="grid"], [role="dialog"]')) return
      if (event.altKey || event.ctrlKey || event.metaKey) return
      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        onChange((current + (event.key === 'ArrowRight' ? 1 : names.length - 1)) % names.length)
      }
    }
    window.addEventListener('keydown', keydown)
    return () => window.removeEventListener('keydown', keydown)
  }, [current, names.length, onChange])
  if (!import.meta.env.DEV) return null
  return <div className="prototype-switcher">
    <button aria-label={previousLabel} onClick={() => onChange((current + names.length - 1) % names.length)}><ChevronLeft size={17} /></button>
    {names.map((name, index) => <button key={name} aria-pressed={index === current} onClick={() => onChange(index)}>{name}</button>)}
    <button aria-label={nextLabel} onClick={() => onChange((current + 1) % names.length)}><ChevronRight size={17} /></button>
    {children}
  </div>
}
