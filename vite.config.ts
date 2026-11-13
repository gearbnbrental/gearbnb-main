import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ORGANIZATION_JSON_LD, OG_IMAGE_PATH, OG_IMAGE_VERSION, PRERENDERED_PAGES, SITE_NAME, SITE_URL, type PageMeta } from './src/config/pageMeta.ts'

/**
 * Keeps the CSP `script-src` hash in the emitted _headers/.htaccess equal to the inline script
 * actually present in the built index.html. A hash is over the script's exact text as the browser
 * parses it — and the HTML parser normalizes CRLF to LF — so it is computed from the LF-normalized
 * text, never the raw file bytes (a Windows checkout with CRLF endings otherwise pins a hash the
 * browser never computes, blocking the script in production).
 */
function cspInlineScriptHash(): Plugin {
  let outDir = 'dist'
  let hashes: string[] = []
  return {
    name: 'csp-inline-script-hash',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        hashes = [...html.matchAll(/<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g)].map(
          (m) => 'sha256-' + createHash('sha256').update(m[1].replace(/\r\n?/g, '\n')).digest('base64'),
        )
        return html
      },
    },
    closeBundle() {
      for (const name of ['_headers', '.htaccess']) {
        const file = resolve(outDir, name)
        if (!existsSync(file)) continue
        let updated = false
        const next = readFileSync(file, 'utf8')
          .split('\n')
          .map((line) => {
            if (!line.includes('Content-Security-Policy')) return line
            updated = true
            return line.replace(/script-src[^;"]*/, (directive) => {
              const base = directive.replace(/\s*'sha256-[^']+'/g, '')
              return base + hashes.map((h) => ` '${h}'`).join('')
            })
          })
          .join('\n')
        if (!updated) throw new Error(`csp-inline-script-hash: no Content-Security-Policy line found in ${name}`)
        writeFileSync(file, next)
      }
    },
  }
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** URL path -> file name inside dist/_pages ("/catalog/build-your-own" -> "catalog--build-your-own.html"). */
const pageFileName = (path: string) => (path === '/' ? 'home' : path.slice(1).replace(/\//g, '--')) + '.html'

/** The built index.html with one page's own title, description, canonical URL and social preview
 * (Open Graph / Twitter) tags swapped in. The head must contain the default <title> and
 * <meta name="description"> that index.html ships with. */
function withPageMeta(html: string, path: string, meta: PageMeta): string {
  const url = SITE_URL + (path === '/' ? '/' : path)
  // The version makes Facebook and Hostinger's CDN fetch the image again: both cache by URL for
  // days, so a replaced picture under the same file name kept showing the old one. Bump it
  // whenever a share image changes.
  const image = SITE_URL + (meta.image ?? OG_IMAGE_PATH) + '?v=' + OG_IMAGE_VERSION
  const title = escapeHtml(meta.title)
  const description = escapeHtml(meta.description)

  if (!/<title>[\s\S]*?<\/title>/.test(html) || !/<meta name="description"[^>]*>/.test(html)) {
    throw new Error('prerender-route-meta: index.html is missing its default <title> or <meta name="description">')
  }
  return html
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${title}</title>`)
    .replace(
      /<meta name="description"[^>]*>/,
      [
        `<meta name="description" content="${description}" />`,
        `<link rel="canonical" href="${url}" />`,
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${SITE_NAME}" />`,
        `<meta property="og:title" content="${title}" />`,
        `<meta property="og:description" content="${description}" />`,
        `<meta property="og:url" content="${url}" />`,
        `<meta property="og:image" content="${image}" />`,
        `<meta property="og:image:width" content="1200" />`,
        `<meta property="og:image:height" content="630" />`,
        `<meta property="og:image:alt" content="${title}" />`,
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${title}" />`,
        `<meta name="twitter:description" content="${description}" />`,
        `<meta name="twitter:image" content="${image}" />`,
        `<script type="application/ld+json">${JSON.stringify(ORGANIZATION_JSON_LD)}</script>`,
        ...(meta.jsonLd ? [`<script type="application/ld+json">${JSON.stringify(meta.jsonLd)}</script>`] : []),
        ...(meta.robots ? [`<meta name="robots" content="${escapeHtml(meta.robots)}" />`] : []),
      ].join('\n    '),
    )
}

/**
 * Gives every public page its own <title>, description, canonical URL and link-preview tags in the
 * HTML itself, not only after JavaScript runs. The app is a single-page app, so without this every
 * address returns the same index.html — and a crawler or a Facebook/Messenger link preview (which
 * don't run scripts) sees the HOME page's title on every page.
 *
 * After the build it writes one file per page into dist/_pages/ (the home page is index.html
 * itself) and adds a rewrite rule per page to dist/.htaccess and dist/_redirects, so
 * /about-us is answered with about-us's own file while the address stays /about-us. Unknown
 * paths still fall back to index.html as before. Titles/descriptions come from
 * src/config/pageMeta.ts, the same source the pages themselves use.
 */
/**
 * Renders every PRERENDERED_PAGES page to full HTML (navbar, headings, copy, FAQ answers, links,
 * product cards, footer) with src/prerender.tsx, loaded through a throwaway Vite server the same
 * way the app loads its TSX. Production mode, so it reads the live RMS and Supabase with the
 * public key from .env.production/.env.local, exactly like the deployed site. Crawlers and link
 * previews that don't run scripts (Facebook's app review checks the Privacy Policy and data
 * deletion URLs this way) then see the real page; when the app loads it replaces this markup with
 * the live page.
 */
async function renderPages(root: string): Promise<Map<string, string>> {
  const server = await createServer({
    root,
    mode: 'production',
    configFile: false,
    logLevel: 'error',
    appType: 'custom',
    server: { middlewareMode: true, hmr: false, ws: false },
    plugins: [react()],
  })
  try {
    const prerender = await server.ssrLoadModule('/src/prerender.tsx')
    const catalog = await prerender.fetchPrerenderCatalog()
    for (const warning of catalog.warnings as string[]) console.warn(`prerender-route-meta: ${warning}`)
    console.log(
      `prerender-route-meta: catalog at build time: ${catalog.kits.length} packages, ${catalog.gearKinds.length} gear kinds`,
    )
    const rendered = new Map<string, string>()
    for (const { path } of PRERENDERED_PAGES) {
      const markup: string = prerender.renderPage(path, catalog)
      if (markup.length < 1000) throw new Error(`prerender-route-meta: ${path} rendered almost nothing`)
      rendered.set(path, markup)
    }
    return rendered
  } finally {
    await server.close()
  }
}

function prerenderRouteMeta(): Plugin {
  let outDir = 'dist'
  let root = process.cwd()
  return {
    name: 'prerender-route-meta',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
      root = config.root
    },
    async closeBundle() {
      const indexFile = resolve(outDir, 'index.html')
      const baseHtml = readFileSync(indexFile, 'utf8')
      const pageContent = await renderPages(root)

      mkdirSync(resolve(outDir, '_pages'), { recursive: true })
      const apacheRules: string[] = []
      const netlifyRules: string[] = []
      for (const { path, meta } of PRERENDERED_PAGES) {
        const shell = withPageMeta(baseHtml, path, meta)
        if (!shell.includes('<div id="root"></div>')) throw new Error('prerender-route-meta: empty #root not found')
        const html = shell.replace('<div id="root"></div>', `<div id="root">${pageContent.get(path)}</div>`)
        if (path === '/') {
          // index.html stays an empty shell (home page tags, no content): it is also the fallback
          // for /cart, /login, /checkout and every other unlisted path, which must not flash the
          // home page's content before the app loads. "/" itself gets the full page via home.html.
          writeFileSync(indexFile, shell)
        }
        writeFileSync(resolve(outDir, '_pages', pageFileName(path)), html)
        apacheRules.push(`  RewriteRule ^${path === '/' ? '' : `${path.slice(1)}/?`}$ /_pages/${pageFileName(path)} [L]`)
        netlifyRules.push(`${path}    /_pages/${pageFileName(path)}   200`)
      }

      const htaccess = resolve(outDir, '.htaccess')
      if (existsSync(htaccess)) {
        const anchor = '  RewriteRule ^index\\.html$ - [L]'
        const text = readFileSync(htaccess, 'utf8')
        if (!text.includes(anchor)) throw new Error('prerender-route-meta: anchor rule not found in .htaccess')
        writeFileSync(
          htaccess,
          text.replace(anchor, `${anchor}\n\n  # Per-page HTML (own title/description/preview tags) — generated by prerenderRouteMeta.\n${apacheRules.join('\n')}`),
        )
      }

      const redirects = resolve(outDir, '_redirects')
      if (existsSync(redirects)) {
        writeFileSync(redirects, `${netlifyRules.join('\n')}\n${readFileSync(redirects, 'utf8')}`)
      }
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cspInlineScriptHash(), prerenderRouteMeta()],
server: {
  port: 5177,
  strictPort: true,
  allowedHosts: ['latinas-bond-elections-fighting.trycloudflare.com'],
  // Dev only, opt-in: lets `vite dev` read the LIVE RMS (prices, catalog, availability, promo)
  // without a local RMS. The live RMS only allows gearbnbrental.com in a browser, so requests go
  // through this dev server instead. Turn on with VITE_RMS_DEV_API_URL=/rms-live in
  // .env.development.local. Read-only on purpose: anything that could create or change real data
  // (bookings, payment proofs, uploads, inquiries) is refused here.
  proxy: {
    '/rms-live': {
      target: 'https://admin.gearbnbrental.com',
      changeOrigin: true,
      rewrite: (path) => path.replace(/^\/rms-live/, ''),
      bypass(req, res) {
        const path = (req.url ?? '').replace(/^\/rms-live/, '').split('?')[0]
        const readOnlyPost = path === '/api/customer/availability' || path === '/api/customer/promo/quote'
        if (req.method === 'GET' || req.method === 'OPTIONS' || (req.method === 'POST' && readOnlyPost)) return undefined
        res?.writeHead(403, { 'Content-Type': 'application/json' })
        res?.end(JSON.stringify({ error: 'Blocked in local dev: this would change real data in the live RMS.' }))
        return false
      },
    },
  },
}
})
