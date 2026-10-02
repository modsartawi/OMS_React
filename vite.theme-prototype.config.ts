// THROWAWAY, development only: the real shell/auth flow receives fictional responses.
// Every /api request terminates here, so this review server cannot mutate SIS.Api.
import { defineConfig, mergeConfig } from 'vite'
import base from './vite.config'

export default mergeConfig(base, defineConfig({
  plugins: [{
    name: 'theme-prototype-fixtures',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const path = req.url.split('?')[0]
        let data: unknown = {}
        if (path === '/api/Auth/Me') data = { authenticated: true, userId: 'theme-review', displayName: 'Design review', currentStoreCode: 'P019' }
        else if (path === '/api/SdDocumentWeb/Access') data = { canOpenList: true, canOpenDetail: false }
        else if (path.endsWith('/Access')) data = {}
        else data = []
        res.setHeader('Content-Type', 'application/json')
        res.end(JSON.stringify({ statusCode: 200, success: true, message: '', errors: [], data }))
      })
    },
  }],
  server: { port: 5198, strictPort: true, host: '127.0.0.1', proxy: {} },
}))
