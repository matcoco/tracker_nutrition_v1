import { defineConfig } from 'vitest/config';

export default defineConfig({
    test: {
        environment: 'jsdom',
        globals: true,
        include: ['tests/**/*.test.js'],
        setupFiles: ['./tests/setup/setup.js'],
        environmentOptions: {
            jsdom: {
                url: 'http://localhost:5501/',
                pretendToBeVisual: true,
            },
        },
        restoreMocks: true,
        clearMocks: true,
        reporters: ['default'],
        coverage: {
            provider: 'v8',
            reportsDirectory: './coverage',
            include: ['js/**/*.js'],
            exclude: ['js/app.js'],
        },
    },
});
