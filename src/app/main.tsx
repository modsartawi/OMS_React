import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { RouterProvider } from 'react-router'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import '@/core/i18n'
import '@/app/global.css'
import { router } from '@/app/router'
import { ConfirmHost } from '@/core/services/confirm'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
})

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
      <Toaster position="top-right" richColors closeButton duration={6000} />
      {/* One app-wide confirm dialog — what lets `confirmAction()` be awaited
          from anywhere without a component in scope. */}
      <ConfirmHost />
    </QueryClientProvider>
  </StrictMode>,
)
