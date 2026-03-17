import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
  // Load .env / .env.local values so we can use them in vite config
  const env = loadEnv(mode, process.cwd(), '')

  /**
   * TENANT_HOST controls which PostgreSQL schema django-tenants routes to.
   *
   * In development set this in frontend/client/.env.local:
   *   TENANT_HOST=happy-kid-.localhost
   *
   * Each client gets their own .env.local with their own subdomain.
   * In production this is not needed — the real browser Host header is used.
   */
  const tenantHost = env.TENANT_HOST || 'happy-kid-.localhost'

  return {
    plugins: [react()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },
    server: {
      port: Number(env.PORT) || 5174,
      proxy: {
        '/api': {
          target: env.API_TARGET || 'http://127.0.0.1:8000',
          changeOrigin: false,
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq, req) => {
              // /api/v1/tenants/domains/ must hit public schema (Domain is shared)
              const path = (req.url || req.path || '').split('?')[0]
              if (path.includes('/tenants/domains')) {
                proxyReq.setHeader('Host', 'localhost')
                return
              }
              // Use the browser's Host so django-tenants picks the right schema per client
              const incomingHost = req.headers.host
              const hostWithoutPort = incomingHost ? String(incomingHost).split(':')[0] : ''
              const isTenantSubdomain = hostWithoutPort && hostWithoutPort !== 'localhost' && hostWithoutPort !== '127.0.0.1'
              proxyReq.setHeader('Host', isTenantSubdomain ? hostWithoutPort : tenantHost)
            })
          },
        },
      },
    },
  }
})
