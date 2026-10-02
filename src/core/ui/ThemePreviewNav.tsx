// THROWAWAY navigation between the selected-theme specimens.
import { useLocation } from 'react-router'
import { useTranslation } from 'react-i18next'
import i18n from '@/core/i18n'
import copy from './theme-preview-copy.json'
i18n.addResourceBundle('en', 'theme-preview', copy, true, true)
export default function ThemePreviewNav() {
  const { t } = useTranslation('theme-preview')
  const location = useLocation()
  const params = new URLSearchParams(location.search)
  params.set('variant', 'selected')
  params.delete('scenario')
  params.delete('review')
  return <nav className="theme-preview-nav" aria-label={t('nav')}>
    {([['inquiry', '/oms/deliveries'], ['details', '/oms/delivery/8000048'], ['simulation', '/pricing/simulation']] as const).map(([key, path]) =>
      <a key={key} href={`${path}?${params}`} aria-current={location.pathname === path && !new URLSearchParams(location.search).has('review') ? 'page' : undefined}>{t(key)}</a>)}
    <a href={`/oms/deliveries?${params}&review=states`} aria-current={new URLSearchParams(location.search).get('review') === 'states' ? 'page' : undefined}>{t('states')}</a>
  </nav>
}
