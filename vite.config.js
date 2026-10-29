import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
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
