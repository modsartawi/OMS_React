/**
 * Test-only: draw an inquiry-export component to static markup (no DOM, no effects) inside a router, a query cache
 * and an i18next instance holding the `inquiry-export` namespace in both languages. Not imported by app code.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import en from '@/locales/en/inquiry-export.json'
import ar from '@/locales/ar/inquiry-export.json'

export function drawExport(element: ReactElement, client = new QueryClient(), lng: 'en' | 'ar' = 'en'): string {
  const i18n = i18next.createInstance()
  void i18n.init({
    lng,
    fallbackLng: 'en',
    ns: ['inquiry-export'],
    defaultNS: 'inquiry-export',
    resources: { en: { 'inquiry-export': en }, ar: { 'inquiry-export': ar } },
    interpolation: { escapeValue: false },
    initAsync: false,
  })
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(I18nextProvider, { i18n }, createElement(MemoryRouter, null, element)),
    ),
  )
}

/** A query cache already holding `data` under `key`, as the screen would after its first read. */
export function seeded(entries: [readonly unknown[], unknown][]): QueryClient {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  for (const [key, data] of entries) client.setQueryData(key, data)
  return client
}
