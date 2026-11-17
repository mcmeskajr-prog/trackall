import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Carimbo da versão (aparece nas Definições): no Vercel vem do commit; em desenvolvimento diz «dev»
const BUILD = `${(process.env.VERCEL_GIT_COMMIT_SHA || 'dev').slice(0, 7)} · ${new Date().toISOString().slice(0, 10)}`

export default defineConfig({
  define: { __APP_BUILD__: JSON.stringify(BUILD) },
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // React e Supabase ficam em ficheiros próprios: mudam raramente, por isso o telemóvel guarda-os em cache
        // e, a cada deploy, só volta a descarregar o código da app (muito mais pequeno).
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (/node_modules\/(react|react-dom|scheduler)\//.test(id)) return 'react'
          if (id.includes('@supabase')) return 'supabase'
        },
      },
    },
  },
})
