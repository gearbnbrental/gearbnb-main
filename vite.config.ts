import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { createServer, defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import {
  CLIENT_ONLY_PATHS,
  ORGANIZATION_JSON_LD,
  OG_IMAGE_PATH,
  OG_IMAGE_VERSION,
  PAGE_META,
  PRERENDERED_PAGES,
  SITE_NAME,
  SITE_URL,
  type PageMeta,
} from './src/config/pageMeta.ts'

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

/** URL path -> file name (no extension) in dist/_pages and dist/_md ("/catalog/build-your-own" -> "catalog--build-your-own"). */
const pageFileBase = (path: string) => (path === '/' ? 'home' : path.slice(1).replace(/\//g, '--'))
const markdownPathFor = (path: string) => `/_md/${pageFileBase(path)}.md`

/** The built index.html with one page's own title, description, canonical URL, social preview
 * (Open Graph / Twitter) tags, schema.org data and Markdown alternate swapped in. The head must
 * contain the default <title> and <meta name="description"> that index.html ships with. The 404
 * page passes `canonical: false`: it answers every unknown address, so it has no address of its own. */
function withPageMeta(html: string, path: string, meta: PageMeta, { canonical = true, markdown = true } = {}): string {
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
        ...(canonical ? [`<link rel="canonical" href="${url}" />`] : []),
        ...(markdown ? [`<link rel="alternate" type="text/markdown" href="${markdownPathFor(path)}" />`] : []),
        `<meta property="og:type" content="website" />`,
        `<meta property="og:site_name" content="${SITE_NAME}" />`,
        `<meta property="og:title" content="${title}" />`,
        `<meta property="og:description" content="${description}" />`,
        ...(canonical ? [`<meta property="og:url" content="${url}" />`] : []),
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

/** A page as the build writes it: its HTML (inside #root) and its Markdown version. */
interface BuiltPage {
  path: string
  meta: PageMeta
  html: string
  markdown: string
}

/** What src/prerender.tsx's productPages returns (loaded through Vite, so untyped here). */
interface ProductPage {
  path: string
  meta: PageMeta
  name: string
  summary: string
  render: () => string
}

/** The source files behind each page, for the sitemap's last-changed date (see lastChanged). */
const PAGE_SOURCES: Record<string, string[]> = {
  '/': ['src/pages/LandingPage.tsx', 'src/config/homeFaq.ts'],
  '/catalog/camping-packages': ['src/pages/PathACatalog.tsx'],
  '/catalog/build-your-own': ['src/pages/PathBCatalog.tsx'],
  '/plan-an-event': ['src/pages/EventPlan.tsx'],
  '/about-us': ['src/pages/AboutUs.tsx'],
  '/privacy-policy': ['src/pages/PrivacyPolicy.tsx'],
  '/terms': ['src/pages/Terms.tsx'],
  '/terms-of-service': ['src/pages/TermsOfService.tsx'],
  '/data-deletion': ['src/pages/DataDeletion.tsx'],
}
const PACKAGE_PAGE_SOURCES = ['src/components/PackageDetailsDialog.tsx', 'src/config/productMeta.ts', 'src/utils/packageFaq.ts']
const GEAR_PAGE_SOURCES = ['src/components/GearDetailsDialog.tsx', 'src/config/productMeta.ts', 'src/utils/gearFaq.ts']

/** YYYY-MM-DD the page's source last changed: today when it has uncommitted changes, otherwise
 *  its last commit. Today when git isn't available. */
function lastChanged(root: string, files: string[]): string {
  const today = new Date().toISOString().slice(0, 10)
  try {
    const git = (...args: string[]) => execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
    if (git('status', '--porcelain', '--', ...files)) return today
    return git('log', '-1', '--format=%cs', '--', ...files) || today
  } catch {
    return today
  }
}

/**
 * Renders the whole public site with src/prerender.tsx, loaded through a throwaway Vite server
 * the same way the app loads its TSX: every PRERENDERED_PAGES page, one page per package and per
 * Build Your Own gear kind, and the 404 page, each with its Markdown version (src/agentFiles.ts),
 * plus /llms.txt. Production mode, so it reads the live RMS and Supabase with the public key from
 * .env.production/.env.local, exactly like the deployed site. Crawlers and link previews that
 * don't run scripts (Facebook's app review checks the Privacy Policy and data deletion URLs this
 * way) then see the real page; when the app loads it replaces this markup with the live page.
 */
async function renderSite(root: string) {
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
    const agent = await server.ssrLoadModule('/src/agentFiles.ts')
    const catalog = await prerender.fetchPrerenderCatalog()
    for (const warning of catalog.warnings as string[]) console.warn(`prerender-route-meta: ${warning}`)
    console.log(
      `prerender-route-meta: catalog at build time: ${catalog.kits.length} packages, ${catalog.gearKinds.length} gear kinds`,
    )

    const products: ProductPage[] = prerender.productPages(catalog)
    const catalogJsonLd: Record<string, object> = prerender.catalogPagesJsonLd(products)
    const agentPage = (path: string, meta: PageMeta) => ({ path, meta, markdownPath: markdownPathFor(path) })
    const agentProducts = (base: string) =>
      products
        .filter((product) => product.path.startsWith(`${base}/`))
        .map((product) => ({ ...agentPage(product.path, product.meta), name: product.name, summary: product.summary }))
    // A catalog's Markdown is its product list (the page itself is mostly date pickers and filters).
    const catalogHeadings: Record<string, string> = {
      '/catalog/camping-packages': 'Choose a Camping Package',
      '/catalog/build-your-own': 'Build Your Own Camping Setup',
    }

    const pages: BuiltPage[] = []
    const fullPage = (path: string) => {
      const markup: string = prerender.renderPage(path, catalog)
      if (markup.length < 1000) throw new Error(`prerender-route-meta: ${path} rendered almost nothing`)
      return markup
    }
    for (const { path, meta: baseMeta } of PRERENDERED_PAGES) {
      const meta = catalogJsonLd[path] ? { ...baseMeta, jsonLd: catalogJsonLd[path] } : baseMeta
      const listed = catalogHeadings[path] ? agentProducts(path) : []
      const markdown: string = listed.length
        ? agent.catalogMarkdown(agentPage(path, meta), catalogHeadings[path], meta.description, listed)
        : agent.pageMarkdown(agentPage(path, meta), prerender.renderPage(path, catalog, { chrome: false }))
      pages.push({ path, meta, html: fullPage(path), markdown })
    }
    for (const product of products) {
      pages.push({
        path: product.path,
        meta: product.meta,
        html: fullPage(product.path),
        markdown: agent.pageMarkdown(agentPage(product.path, product.meta), product.render()),
      })
    }

    const llmsTxt: string = agent.llmsTxt({
      pages: pages.map((page) => agentPage(page.path, page.meta)),
      packages: agentProducts('/catalog/camping-packages'),
      gear: agentProducts('/catalog/build-your-own'),
    })
    return { pages, notFoundHtml: fullPage(prerender.NOT_FOUND_PATH) as string, llmsTxt }
  } finally {
    await server.close()
  }
}

/** sitemap.xml: every indexable page, with the date its content last changed. */
function sitemapXml(root: string, pages: BuiltPage[]): string {
  const sources = (path: string) =>
    PAGE_SOURCES[path] ??
    (path.startsWith('/catalog/camping-packages/') ? PACKAGE_PAGE_SOURCES : path.startsWith('/catalog/build-your-own/') ? GEAR_PAGE_SOURCES : null)
  const urls = pages
    .filter((page) => !page.meta.robots?.includes('noindex'))
    .map((page) => {
      const files = sources(page.path)
      if (!files) throw new Error(`prerender-route-meta: no PAGE_SOURCES entry for ${page.path}`)
      const loc = SITE_URL + (page.path === '/' ? '/' : page.path)
      return `  <url>\n    <loc>${escapeHtml(loc)}</loc>\n    <lastmod>${lastChanged(root, files)}</lastmod>\n  </url>`
    })
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`
}

/** "^catalog/build-your-own/?$" for "/catalog/build-your-own"; "^$" for the home page. */
const apachePattern = (path: string) => (path === '/' ? '^$' : `^${path.slice(1).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}/?$`)

/**
 * Gives every public page, including one per product, its own HTML file in dist/_pages with its
 * own <title>, description, canonical URL, link-preview tags and schema.org data, so crawlers and
 * Facebook/Messenger link previews (which don't run scripts) see the right page instead of the
 * home page. Also writes, for AI agents, each page's Markdown version in dist/_md, /llms.txt, and
 * sitemap.xml with last-changed dates.
 *
 * Then rewrites dist/.htaccess (and dist/_redirects for Netlify-style hosts) so only known
 * addresses are answered: each pre-built page (its Markdown instead when the request asks for
 * text/markdown), the app-only pages (/cart, /login, ...) with index.html, and real files.
 * Anything else gets the 404 page with a real 404 status. Titles/descriptions come from
 * src/config/pageMeta.ts and src/config/productMeta.ts, the same sources the pages use.
 */
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
      const { pages, notFoundHtml, llmsTxt } = await renderSite(root)
      const fill = (shell: string, markup: string) => {
        if (!shell.includes('<div id="root"></div>')) throw new Error('prerender-route-meta: empty #root not found')
        return shell.replace('<div id="root"></div>', `<div id="root">${markup}</div>`)
      }

      mkdirSync(resolve(outDir, '_pages'), { recursive: true })
      mkdirSync(resolve(outDir, '_md'), { recursive: true })
      const markdownRules: string[] = []
      const pageRules: string[] = []
      const headerRules: string[] = []
      const netlifyRules: string[] = []
      for (const { path, meta, html, markdown } of pages) {
        const base = pageFileBase(path)
        const shell = withPageMeta(baseHtml, path, meta)
        if (path === '/') {
          // index.html stays an empty shell (home page tags, no content): it is also what /cart,
          // /login, /checkout and the other app-only pages get, which must not flash the home
          // page's content before the app loads. "/" itself gets the full page via home.html.
          writeFileSync(indexFile, withPageMeta(baseHtml, path, meta, { markdown: false }))
        }
        writeFileSync(resolve(outDir, '_pages', `${base}.html`), fill(shell, html))
        writeFileSync(resolve(outDir, '_md', `${base}.md`), markdown)
        markdownRules.push(`  RewriteCond %{HTTP:Accept} text/markdown [NC]`, `  RewriteRule ${apachePattern(path)} /_md/${base}.md [L]`)
        pageRules.push(`  RewriteRule ${apachePattern(path)} /_pages/${base}.html [L]`)
        headerRules.push(
          `  <Files "${base}.html">`,
          `    Header always set Link "<${markdownPathFor(path)}>; rel=\\"alternate\\"; type=\\"text/markdown\\", </llms.txt>; rel=\\"describedby\\"; type=\\"text/plain\\""`,
          `    Header always merge Vary Accept`,
          `  </Files>`,
        )
        netlifyRules.push(`${path}    /_pages/${base}.html   200`)
      }
      const notFoundMeta = PAGE_META.notFound
      writeFileSync(
        resolve(outDir, '_pages', '404.html'),
        fill(withPageMeta(baseHtml, '/404', notFoundMeta, { canonical: false, markdown: false }), notFoundHtml),
      )
      writeFileSync(resolve(outDir, 'llms.txt'), llmsTxt)
      writeFileSync(resolve(outDir, 'sitemap.xml'), sitemapXml(root, pages))

      const clientOnly = CLIENT_ONLY_PATHS.map((path) => path.slice(1)).join('|')
      const htaccess = resolve(outDir, '.htaccess')
      if (existsSync(htaccess)) {
        const anchor = '  RewriteRule ^index\\.html$ - [L]'
        const text = readFileSync(htaccess, 'utf8')
        if (!text.includes(anchor)) throw new Error('prerender-route-meta: anchor rule not found in .htaccess')
        const rewrites = [
          anchor,
          '',
          '  # Generated by prerenderRouteMeta (vite.config.ts).',
          '  # A page asked for as Markdown (Accept: text/markdown) gets its Markdown version.',
          ...markdownRules,
          '',
          '  # Each pre-built page (its own title, description, preview tags and content).',
          ...pageRules,
          '',
          '  # App-only pages: the app shell.',
          `  RewriteRule ^(${clientOnly})/?$ /index.html [L]`,
        ].join('\n')
        const headers = [
          '',
          '# Generated by prerenderRouteMeta (vite.config.ts): every page points AI agents at its',
          '# Markdown version and /llms.txt. The Markdown files themselves stay out of search results.',
          '<IfModule mod_headers.c>',
          ...headerRules,
          '  <FilesMatch "\\.md$">',
          '    Header always set X-Robots-Tag "noindex"',
          '    Header always merge Vary Accept',
          '  </FilesMatch>',
          '</IfModule>',
          '',
        ].join('\n')
        writeFileSync(htaccess, text.replace(anchor, rewrites) + headers)
      }

      const redirects = resolve(outDir, '_redirects')
      if (existsSync(redirects)) {
        const appOnly = CLIENT_ONLY_PATHS.map((path) => `${path}    /index.html   200`)
        writeFileSync(redirects, `${[...netlifyRules, ...appOnly].join('\n')}\n${readFileSync(redirects, 'utf8')}`)
      }
      console.log(`prerender-route-meta: ${pages.length} pages, ${pages.length - PRERENDERED_PAGES.length} of them products`)
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
