import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  base: '/terra-imperium/',
  server: {
    port: 3000
  },
  build: {
    outDir: 'docs',  
    sourcemap: true,
    emptyOutDir: true 
  }
});