import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const webRoot = fileURLToPath(new URL('.', import.meta.url));
const projectRoot = path.resolve(webRoot, '../..');

export default defineConfig({
  root: webRoot,
  envDir: projectRoot,
  plugins: [react()],
  server: { port: 5173, proxy: { '/api': 'http://127.0.0.1:4100' } },
  build: { outDir: path.join(projectRoot, 'dist/web'), emptyOutDir: true }
});
