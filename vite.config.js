import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import fs from 'node:fs'
import path from 'node:path'

// Serve the static SEO pages (public/<slug>/index.html) at clean URLs in dev and preview.
// On Vercel they are served natively, so this only affects local development.
const staticPages = () => {
  const rewrite = (dir) => (req, _res, next) => {
    const [url, query] = (req.url || '').split('?')
    if (url !== '/' && !path.extname(url)) {
      const clean = url.replace(/\/$/, '')
      if (fs.existsSync(path.join(path.resolve(dir), clean, 'index.html'))) {
        req.url = clean + '/index.html' + (query ? '?' + query : '')
      }
    }
    next()
  }
  return {
    name: 'static-seo-pages',
    configureServer(server) { server.middlewares.use(rewrite('public')) },
    configurePreviewServer(server) { server.middlewares.use(rewrite('dist')) },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), staticPages()],
})
