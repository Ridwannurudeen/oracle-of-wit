import { defineConfig } from '@playwright/test';

export default defineConfig({
    testDir: './tests/e2e',
    timeout: 30000,
    use: {
        baseURL: 'http://localhost:5173',
        headless: true,
    },
    webServer: {
        command: 'npx serve -l 5173 -s .',
        port: 5173,
        reuseExistingServer: true,
        timeout: 10000,
    },
});
