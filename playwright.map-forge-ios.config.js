/* KELO-INDEX
 * area: QA / MAP FORGE / IOS WEBKIT
 * owner: dedicated local WebKit device profile for Map Forge entry regressions
 * purpose: run iPhone/WebKit QA without changing the global BrowserStack-aware Playwright configuration
 */
const { defineConfig, devices } = require('@playwright/test');
const iphone = { ...devices['iPhone 13'], browserName: 'webkit' };

module.exports = defineConfig({
  testDir: './tests',
  timeout: 45000,
  retries: 0,
  reporter: [['list'], ['json', { outputFile: 'playwright-map-forge-ios-report.json' }]],
  use: {
    baseURL: process.env.KELO_PAGES || 'http://127.0.0.1:4173/',
    trace: 'retain-on-failure',
    screenshot: 'on',
    video: 'off',
    ...iphone,
  },
  projects: [{ name: 'webkit-iphone', use: iphone }],
});
