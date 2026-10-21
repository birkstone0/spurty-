import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Dev proxy only applies during `vite dev`. Production uses VITE_API_BASE_URL.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': 'http://localhost:5000'
    }
  }
})