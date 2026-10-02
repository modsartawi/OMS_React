// THROWAWAY: apply the approved steel/compact direction to the existing workflows.
import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import DocumentDetailsPage from '@/features/oms/document/DocumentDetailsPage'
import SimulationPrototypePage from '@/features/pricing/simulation/__prototype__/SimulationPrototypePage'
import ThemePreviewNav from '@/core/ui/ThemePreviewNav'
import Button from '@/core/ui/Button'
import { scenarios, scenarioRequest, type Scenario } from './simulation-scenarios'
import '@/features/oms/deliveries/__prototype__/theme-prototype.css'
import './theme-screens.css'
import '@/core/ui/theme-preview-nav.css'
export default function ThemeScreens({ screen, openedAs = 'delivery' }: { screen: 'details' | 'simulation'; openedAs?: 'document' | 'delivery' }) {
  const { t } = useTranslation('theme-preview')
  const [params, setParams] = useSearchParams()
  const [reset, setReset] = useState(0)
  const dark = params.get('mode') === 'dark'
  const rtl = params.get('dir') === 'rtl'
  const scenario = (params.get('scenario') ?? 'fired') as Scenario
  const chosen = Object.hasOwn(scenarios, scenario) ? scenario : 'fired'
  const update = (key: string, value: string) => setParams(previous => { const next = new URLSearchParams(previous); next.set(key, value); return next }, { replace: true })
  useEffect(() => {
    const root = document.documentElement
    const previous = { dark: root.classList.contains('dark'), mode: root.dataset.agThemeMode, dir: root.dir }
    root.dataset.themePrototype = 'selected'
    root.classList.toggle('dark', dark)
    root.dataset.agThemeMode = dark ? 'dark' : 'light'
    root.dir = rtl ? 'rtl' : 'ltr'
    const toggle = () => setParams(previous => { const next = new URLSearchParams(previous); next.set('mode', dark ? 'light' : 'dark'); return next }, { replace: true })
    window.addEventListener('theme-prototype-toggle', toggle)
    return () => {
      window.removeEventListener('theme-prototype-toggle', toggle)
      delete root.dataset.themePrototype
      root.classList.toggle('dark', previous.dark)
      if (previous.mode) root.dataset.agThemeMode = previous.mode
      else delete root.dataset.agThemeMode
      root.dir = previous.dir
    }
  }, [dark, rtl, setParams])
  return <div className="theme-prototype prototype-selected theme-screen-preview">
    <ThemePreviewNav />
    <div className="theme-preview-heading"><div><strong>{t('review')}</strong><p>{t(screen === 'details' ? 'fixture' : 'replay')}</p></div>
      <div className="theme-preview-controls"><Button variant="outlined" aria-pressed={dark} onClick={() => update('mode', dark ? 'light' : 'dark')}>{t(dark ? 'light' : 'dark')}</Button><Button variant="outlined" aria-pressed={rtl} onClick={() => update('dir', rtl ? 'ltr' : 'rtl')}>{t('rtl')}</Button></div>
    </div>
    {screen === 'simulation' && <div className="theme-preview-scenario"><label htmlFor="preview-scenario">{t('scenario')}</label><select id="preview-scenario" value={chosen} onChange={e => update('scenario', e.target.value)}>{Object.keys(scenarios).map(key => <option key={key} value={key}>{t(key)}</option>)}</select><Button variant="outlined" onClick={() => setReset(value => value + 1)}>{t('reset')}</Button></div>}
    <div className="theme-preview-content">{screen === 'details' ? <DocumentDetailsPage key={rtl ? 'rtl' : 'ltr'} openedAs={openedAs} /> : <SimulationPrototypePage key={`${chosen}-${reset}`} initialRequest={scenarioRequest(chosen)} />}</div>
  </div>
}
