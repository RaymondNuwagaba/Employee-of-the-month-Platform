import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    // Same-origin API keeps the session cookie first-party
    proxy: { '/api': 'http://localhost:8000' },
  },
})
