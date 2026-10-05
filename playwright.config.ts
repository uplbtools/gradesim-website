import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	webServer: { command: 'npm run build && npm run preview -- --port 4173 --strictPort', port: 4173, reuseExistingServer: false },
	use: { baseURL: 'http://localhost:4173', serviceWorkers: 'block' },
	projects: [
		{ name: 'desktop', use: { ...devices['Desktop Chrome'] }, grepInvert: /@phone/ },
		{ name: 'phone', use: { ...devices['Pixel 7'] }, grep: /@phone/ }
	]
});
