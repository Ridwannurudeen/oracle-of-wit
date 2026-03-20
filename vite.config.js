import { defineConfig } from 'vitest/config';
import preact from '@preact/preset-vite';

export default defineConfig({
    plugins: [preact()],
    // Build configuration
    root: '.',
    build: {
        outDir: 'dist',
        rollupOptions: {
            input: 'index.html',
        },
    },
    server: {
        proxy: {
            '/api': 'http://localhost:3000',
        },
    },
    esbuild: {
        jsxFactory: 'h',
        jsxFragment: 'Fragment',
    },
    // Test configuration
    test: {
        exclude: ['tests/e2e/**', 'node_modules/**'],
        coverage: {
            provider: 'v8',
            reporter: ['text', 'text-summary'],
            include: ['api/**/*.js', 'js/**/*.js'],
            exclude: ['tests/**', 'node_modules/**', 'dist/**', '*.config.js'],
            thresholds: {
                statements: 40,
                branches: 45,
                functions: 40,
                lines: 40,
            },
        },
    },
});
