import { defineConfig } from 'tsup';

export default defineConfig({
    entry: ['src/index.ts'],
    format: ['cjs', 'esm'],
    dts: true,
    splitting: false,
    sourcemap: true,
    clean: true,
    external: ['react', 'react-dom', 'jwt-decode'],
    minify: false,
    target: 'es2020',
    esbuildOptions(options) {
        options.jsx = 'automatic';
    },
});