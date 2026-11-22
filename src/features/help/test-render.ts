/**
 * Test-only: draw a help component to static markup (no DOM, no effects) inside a router, a query cache and an
 * i18next instance holding the help's own namespace in both languages. Not imported by app code.
 */
import { createElement, type ReactElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import i18next from 'i18next'
import { I18nextProvider } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import help from '@/locales/en/help.json'
import helpAr from '@/locales/ar/help.json'

const i18n = i18next.createInstance()
void i18n.init({
  lng: 'en',
  fallbackLng: 'en',
  ns: ['help'],
  defaultNS: 'help',
  resources: { en: { help }, ar: { help: helpAr } },
  interpolation: { escapeValue: false },
  initAsync: false,
})

export function drawHelp(element: ReactElement, client = new QueryClient()): string {
  return renderToStaticMarkup(
    createElement(
      QueryClientProvider,
      { client },
      createElement(I18nextProvider, { i18n }, createElement(MemoryRouter, null, element)),
    ),
  )
}
