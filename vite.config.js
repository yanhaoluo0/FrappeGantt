import { defineConfig } from 'vite';

const host = process.env.TAURI_DEV_HOST;
const appDirectory = import.meta.dirname;

export default defineConfig({
    root: 'src',
    clearScreen: false,
    server: {
        port: 1420,
        strictPort: true,
        host: host || '127.0.0.1',
        fs: {
            allow: [appDirectory, `${appDirectory}\\..\\gantt`],
        },
    },
    build: {
        outDir: '../dist',
        emptyOutDir: true,
    },
});
