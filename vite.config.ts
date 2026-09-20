import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

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

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), cspInlineScriptHash()],
server: {
  port: 5177,
  strictPort: true,
  allowedHosts: ['latinas-bond-elections-fighting.trycloudflare.com'],
}
})
