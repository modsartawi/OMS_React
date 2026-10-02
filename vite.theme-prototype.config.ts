// THROWAWAY, development only: the real shell/auth flow receives fictional responses.
// Every /api request terminates here, so this review server cannot mutate SIS.Api.
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'
import delivery from './src/app/__prototype__/delivery-fixture.json'
import { scenarios } from './src/app/__prototype__/simulation-scenarios'

export default mergeConfig(base, defineConfig({
  define: { 'import.meta.env.VITE_THEME_PROTOTYPE': 'true' },
  plugins: [{
    name: 'theme-prototype-fixtures',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const path = req.url.split('?')[0]
        const reply = (data: unknown, message = '') => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ statusCode: message ? 400 : 200, success: !message, message, errors: [], data }))
        }
        if (path === '/api/Pricing/Simulate') {
          let body = ''
          for await (const chunk of req) body += chunk
          const request = JSON.parse(body)
          // Compare every input; never present a recorded total as a fresh calculation.
          const canonical = (value: unknown): string => {
            if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
            if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, val]) => `${JSON.stringify(key)}:${canonical(val)}`).join(',')}}`
            return JSON.stringify(value)
          }
          const match = Object.values(scenarios).find(scenario => canonical(scenario._capture.request) === canonical(request))
          await new Promise(resolve => setTimeout(resolve, 350))
          reply(match?.response.data ?? null, match ? '' : 'This preview replays captured baskets only. Use Reset sample or choose another sample basket, then Process.')
          return
        }
        if (req.method !== 'GET' && req.method !== 'HEAD') {
          reply(null, 'Preview only: this command has not changed the delivery. Close the dialog to continue reviewing.')
          return
        }
        let data: unknown = {}
        if (path === '/api/Auth/Me') data = { authenticated: true, userId: 'theme-review', displayName: 'Design review', currentStoreCode: 'P019' }
        else if (path === '/api/SdDocumentWeb/Access') data = { canOpenList: true, canOpenDetail: true }
        else if (path === '/api/Pricing/Access') data = { canOpen: true }
        else if (path === '/api/Pricing/CacheAccess') data = { canClear: false }
        else if (/^\/api\/SdDocumentWeb\/(Delivery|Document)\/[^/]+$/.test(path)) {
          const id = path.split('/').at(-1)!
          const index = Math.max(0, Math.min(47, 8000048 - Number(id)))
          const customerName = ['Reem Al-Harbi', 'Omar Al-Qahtani', 'Noura Al-Salem', 'Fahad Al-Otaibi', 'Lina Al-Dossari', 'Abdullah Al-Zahrani'][index % 6]
          const customerPhone = `050000${String(index + 1).padStart(4, '0')}`
          const netTotal = Math.round((92.5 + index * 17.35) * 100) / 100
          const amountDue = index % 4 === 0 ? 72.5 : 0
          const status = ['Ready', 'Delivered', 'Pending', 'Ready', 'Cancelled', 'Delivered'][index % 6]
          data = {
            ...delivery, documentNo: id, orderNo: String(1000080421 - index), storeCode: ['P019', 'P042', 'P107'][index % 3],
            documentTypeDescription: ['Call Center', 'Web Order', 'Store Order'][index % 3],
            documentSourceDescription: ['Call center', 'Web', 'Store'][index % 3],
            netTotal, amountDue, paidAmount: netTotal - amountDue,
            customer: { ...delivery.customer, customerName, customerPhone },
            shippingAddress: { ...delivery.shippingAddress, name1: customerName, phone1: customerPhone, cityName: ['Riyadh', 'Dammam', 'Khobar'][index % 3] },
            status: { ...delivery.status, lastActionDescription: status, readyStatus: status === 'Ready' ? 'R' : '', readyStatusDescription: status === 'Ready' ? 'Ready' : '', paymentStatusDescription: amountDue ? 'Partially paid' : 'Paid' },
            // Keep header and line totals consistent for every inquiry row.
            lines: delivery.lines.map((line, lineIndex) => {
              const total = line.netAmount + (lineIndex === 0 ? netTotal - delivery.netTotal : 0)
              const tax = Math.round((total - total / 1.15) * 100) / 100
              return { ...line, unitPrice: total / line.quantity, netAmount: total, grossAmount: total - tax, vatAmount: tax }
            }),
            conditions: delivery.conditions.map(condition => ({ ...condition, condDocumentNumber: id, condValue: netTotal - amountDue, condAmount: netTotal - amountDue })),
          }
        }
        else if (path.endsWith('/Logs')) data = [
          { logNo: '1', actionTypeDescription: 'Created', entryTime: '2026-10-01T09:15:00', entryUser: 'Demo operator', note: 'Fictional delivery created' },
          { logNo: '2', actionTypeDescription: 'Ready for delivery', entryTime: '2026-10-01T09:30:00', entryUser: 'Demo operator', note: 'Items checked and packed' },
        ]
        else if (path.endsWith('/Outbox')) data = [
          { outboxId: '1', actionTypeDescription: 'Create', outboxStatus: 'C', attemptCount: 1 },
          { outboxId: '2', actionTypeDescription: 'Notify', outboxStatus: 'F', attemptCount: 3, errorMessage: 'Sample notification failure' },
        ]
        else if (path.endsWith('/Access')) data = {}
        else data = []
        reply(data)
      })
    },
  }],
  server: { port: 5198, strictPort: true, host: '127.0.0.1', proxy: {} },
}))
