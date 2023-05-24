
import { resolve } from 'path'
import { defineConfig } from 'vite'

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'index.html'),
        nested: resolve(__dirname, '3D.html'),
        about: resolve(__dirname, 'about.html'),
        aboutsk: resolve(__dirname, 'aboutsk.html'),

      },
    },
  },
})

