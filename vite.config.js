import { defineConfig } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

// On Vercel, link previews (LinkedIn, WhatsApp, X) need an absolute image URL.
// Vercel exposes the production domain at build time, so we fill it in here.
function absoluteShareUrls() {
  const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.VERCEL_URL;
  return {
    name: 'absolute-share-urls',
    transformIndexHtml(html) {
      if (!host) return html;
      const origin = `https://${host}`;
      return html
        .replace('content="/og.jpg"', `content="${origin}/og.jpg"`)
        .replace('</title>', `</title>\n  <link rel="canonical" href="${origin}/">\n  <meta property="og:url" content="${origin}/">`);
    },
  };
}

// `npm run build`        -> dist/ (what Vercel serves)
// `npm run build:single` -> dist-single/index.html (one self-contained file for previews)
export default defineConfig(({ mode }) =>
  mode === 'single'
    ? {
        plugins: [viteSingleFile({ removeViteModuleLoader: true })],
        build: { outDir: 'dist-single', assetsInlineLimit: 100_000_000, cssCodeSplit: false, chunkSizeWarningLimit: 4000 },
      }
    : {
        plugins: [absoluteShareUrls()],
        build: { outDir: 'dist', assetsInlineLimit: 4096, chunkSizeWarningLimit: 1200 },
      },
);
