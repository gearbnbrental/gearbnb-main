import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { ORGANIZATION_JSON_LD, OG_IMAGE_PATH, PRERENDERED_PAGES, SITE_NAME, SITE_URL, type PageMeta } from './src/config/pageMeta.ts'

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
const pageFileName = (path: string) => path.slice(1).replace(/\//g, '--') + '.html'

/** The built index.html with one page's own title, description, canonical URL and social preview
 * (Open Graph / Twitter) tags swapped in. The head must contain the default <title> and
 * <meta name="description"> that index.html ships with. */
function withPageMeta(html: string, path: string, meta: PageMeta): string {
  const url = SITE_URL + (path === '/' ? '/' : path)
  const image = SITE_URL + OG_IMAGE_PATH
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
        `<meta name="twitter:card" content="summary_large_image" />`,
        `<meta name="twitter:title" content="${title}" />`,
        `<meta name="twitter:description" content="${description}" />`,
        `<meta name="twitter:image" content="${image}" />`,
        `<script type="application/ld+json">${JSON.stringify(ORGANIZATION_JSON_LD)}</script>`,
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
function prerenderRouteMeta(): Plugin {
  let outDir = 'dist'
  return {
    name: 'prerender-route-meta',
    apply: 'build',
    configResolved(config) {
      outDir = resolve(config.root, config.build.outDir)
    },
    closeBundle() {
      const indexFile = resolve(outDir, 'index.html')
      const baseHtml = readFileSync(indexFile, 'utf8')

      mkdirSync(resolve(outDir, '_pages'), { recursive: true })
      const apacheRules: string[] = []
      const netlifyRules: string[] = []
      for (const { path, meta } of PRERENDERED_PAGES) {
        const html = withPageMeta(baseHtml, path, meta)
        if (path === '/') {
          writeFileSync(indexFile, html)
          continue
        }
        writeFileSync(resolve(outDir, '_pages', pageFileName(path)), html)
        apacheRules.push(`  RewriteRule ^${path.slice(1)}/?$ /_pages/${pageFileName(path)} [L]`)
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
}
})
