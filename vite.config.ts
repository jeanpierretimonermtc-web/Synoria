import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'
import { resolve } from 'path'

// vite-plugin-electron@0.28 tue le process Electron via `taskkill /pid X /T /F` sans jamais
// entourer cet appel d'un try/catch (contrairement à l'équivalent Mac/Linux). Si le processus
// visé s'est déjà terminé de lui-même entre-temps, taskkill retourne un code d'erreur et fait
// planter tout le process "vite" — sans lien avec le code de l'application. On neutralise
// spécifiquement cette erreur connue et inoffensive (l'intention — s'assurer que l'ancien
// process est mort — est déjà remplie) ; toute autre exception continue de faire planter
// normalement pour ne pas masquer un vrai bug.
process.on('uncaughtException', (err: any) => {
  if (typeof err?.cmd === 'string' && err.cmd.startsWith('taskkill')) {
    console.warn('[vite.config] taskkill sur un process Electron déjà terminé — ignoré.')
    return
  }
  console.error(err)
  process.exit(1)
})

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
            // Ne redémarre/recharge que si Electron tourne déjà. Au tout premier lancement,
            // l'entrée "main" s'en charge via son propre onstart par défaut — appeler reload()
            // ici aussi déclenche un second démarrage concurrent qui course avec le premier
            // et fait planter vite-plugin-electron@0.28 sur Windows (taskkill sur un PID déjà mort).
            if (process.electronApp) {
              options.reload()
            }
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
