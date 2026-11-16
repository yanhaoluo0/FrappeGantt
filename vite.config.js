import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;

export default defineConfig({
    root: 'src',
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: host || '127.0.0.1',
        fs: {
            allow: [resolve(__dirname), resolve(__dirname, '..', 'gantt')],
        },
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
});
