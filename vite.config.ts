import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

export default defineConfig(({ mode }) => {
  // Charge .env.local (git-ignoré) pour injecter les secrets de build dans le main process.
  // LICENSE_PUBLIC_KEY est la seule variable attendue ici — la clé privée reste côté Supabase.
  const env = loadEnv(mode, process.cwd(), '')

  if (!env.LICENSE_PUBLIC_KEY) {
    console.warn('[vite.config] LICENSE_PUBLIC_KEY absent de .env.local — la vérification offline échouera au démarrage.')
  }

  return {
    plugins: [
      react(),
      electron([
        {
          entry: 'src/main/index.ts',
          vite: {
            define: {
              'process.env.LICENSE_PUBLIC_KEY':  JSON.stringify(env.LICENSE_PUBLIC_KEY  ?? ''),
              'process.env.SUPABASE_URL':        JSON.stringify(env.SUPABASE_URL        ?? ''),
              'process.env.SUPABASE_ANON_KEY':   JSON.stringify(env.SUPABASE_ANON_KEY   ?? ''),
              'process.env.GCAL_CLIENT_ID':      JSON.stringify(env.GCAL_CLIENT_ID      ?? ''),
              'process.env.GCAL_CLIENT_SECRET':  JSON.stringify(env.GCAL_CLIENT_SECRET  ?? ''),
              'process.env.OWNER_EMAILS':        JSON.stringify(env.OWNER_EMAILS        ?? ''),
            },
            build: {
              outDir: 'dist-electron/main',
              rollupOptions: {
                external: ['electron', 'better-sqlite3', 'xlsx-js-style', '@supabase/supabase-js'],
                output: {
                  // Un seul fichier bundle pour le process principal.
                  // Evite les chunks séparés dont les require() relatifs échouent
                  // dans l'app packagée (ex: patientReportService ne trouve pas settingsService).
                  inlineDynamicImports: true,
                },
              },
            },
          },
        },
        {
          entry: 'src/main/preload.ts',
          vite: {
            build: {
              outDir: 'dist-electron/preload',
            },
          },
          onstart(options) {
            options.reload()
          },
        },
      ]),
      renderer(),
    ],
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src/renderer'),
        '@shared': resolve(__dirname, 'src/shared'),
      },
    },
  }
})
