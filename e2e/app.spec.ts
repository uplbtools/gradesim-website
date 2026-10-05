import { expect, test, type Page } from '@playwright/test';
import fs from 'node:fs';

const backup = fs.readFileSync(new URL('../src/lib/fixtures/backup.json', import.meta.url));

async function open(page: Page, path = '/') {
	await page.goto(path);
	await page.locator('html[data-app-ready]').waitFor({ state: 'attached' });
}

async function importFixture(page: Page) {
	await open(page);
	await page.getByTestId('file-input').first().setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: backup });
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
}

test('first visit shows the welcome with three ways in', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Your GWA');
	await expect(page.getByText('Your grades stay in this browser.')).toBeVisible();
	await expect(page.getByRole('heading', { name: 'From the GradeSim extension' })).toBeVisible();
	await expect(page.getByRole('link', { name: 'Install the extension' }).first()).toHaveAttribute('href', /install\/$/);
	await expect(page.getByRole('button', { name: 'Import a file' })).toBeVisible();
	await expect(page.getByRole('button', { name: 'Enter grades by hand' })).toBeVisible();
});

test('manual entry: add courses by hand and the GWA shows', async ({ page }) => {
	await open(page);
	await page.getByRole('button', { name: 'Enter grades by hand' }).click();
	await page.getByLabel('Course code').fill('CMSC 12');
	await expect(page.getByLabel('Title')).toHaveValue('Foundations of Computer Science');
	await page.getByLabel('Grade', { exact: true }).selectOption('1.50');
	await page.getByRole('button', { name: 'Add course' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('1.5000');

	await page.getByRole('button', { name: 'Add or edit grades' }).click();
	await page.getByLabel('Course code').fill('MATH 27');
	await page.getByLabel('Grade', { exact: true }).selectOption('2.50');
	await page.getByRole('button', { name: 'Add course' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('2.0000');

	await open(page);
	await expect(page.getByTestId('gwa')).toHaveText('2.0000');
});

test('JSON import from the extension backup', async ({ page }) => {
	await importFixture(page);
	await expect(page.getByRole('status').first()).toContainText('Imported 15 courses');
	await expect(page.getByText('Honor Roll track')).toBeVisible();
	await expect(page.getByRole('region', { name: '1st sem AY 2023-24' })).toContainText('MATH 27');
});

test('a junk file is refused with a reason', async ({ page }) => {
	await open(page);
	await page.getByTestId('file-input').first().setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
	await expect(page.getByRole('status').first()).toContainText('not a GradeSim backup');
});

test('planner renders and a failed course shows a retake', async ({ page }) => {
	await importFixture(page);
	await page.getByRole('tab', { name: 'Planner' }).click();
	await expect(page.getByTestId('grad-term')).toContainText('Graduate');
	const grid = page.getByTestId('planner-grid');
	await expect(grid.locator('.pl-card.st-retake[data-code="MATH 27"]')).toBeVisible();
	await expect(grid.locator('.pl-card.st-failed[data-code="MATH 27"]')).toBeVisible();
	await grid.locator('.pl-card.st-retake[data-code="MATH 27"]').click();
	await expect(page.getByRole('complementary', { name: 'Details for MATH 27' })).toContainText('Analytic Geometry');
	await expect(page).toHaveURL(/#planner$/);
});

test('theme toggle cycles and persists', async ({ page }) => {
	await open(page);
	const html = page.locator('html');
	const toggle = page.getByRole('button', { name: /theme/i });
	await toggle.click();
	await expect(html).toHaveAttribute('data-theme', 'light');
	await toggle.click();
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await open(page);
	await expect(html).toHaveAttribute('data-theme', 'dark');
	await page.getByRole('button', { name: /theme/i }).click();
	await expect(html).not.toHaveAttribute('data-theme');
});

test('curricula deep link picks the program in the planner', async ({ page }) => {
	await importFixture(page);
	await open(page, '/?program=BSBIO#planner');
	await expect(page.getByRole('combobox', { name: 'Your degree program' })).toHaveValue('BSBIO');
	await expect(page).toHaveURL(/\/#planner$/);
});

test('content pages and old trailing-slash URLs', async ({ page, request }) => {
	for (const path of ['/about/', '/install/', '/curricula/', '/privacy/', '/terms/']) {
		const res = await page.goto(path);
		expect(res?.status()).toBe(200);
		await expect(page.locator('link[rel=canonical]')).toHaveAttribute('href', `https://gradesim.uplb.tools${path}`);
	}
	const res = await request.get('/privacy', { maxRedirects: 0 });
	expect([301, 308]).toContain(res.status());
});

test('@phone mobile layout stacks the planner terms', async ({ page }) => {
	await importFixture(page);
	const noSideScroll = () => page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth);
	expect(await noSideScroll()).toBe(true);
	await page.getByRole('tab', { name: 'Planner' }).click();
	const grid = page.getByTestId('planner-grid');
	await expect(grid).toHaveCSS('flex-direction', 'column');
	expect(await noSideScroll()).toBe(true);
	await grid.locator('.pl-card.st-retake[data-code="MATH 27"]').click();
	// On phones the details open inline, inside the term list.
	await expect(grid.getByRole('complementary', { name: 'Details for MATH 27' })).toBeVisible();
});

test('imports from the extension through the window bridge', async ({ page }) => {
	// Stand-in for the Firefox content script: answers the page's requests.
	await page.addInitScript((payload) => {
		window.addEventListener('message', (e) => {
			const type = e.data?.type;
			if (e.source !== window || (type !== 'GRADESIM_PING' && type !== 'GRADESIM_GET_GRADES')) return;
			const reply = type === 'GRADESIM_PING' ? { hasGrades: true } : JSON.parse(payload);
			window.postMessage({ type: 'GRADESIM_REPLY', request: type, payload: reply }, location.origin);
		});
	}, backup.toString());
	await open(page);
	await page.getByRole('button', { name: 'Import from the GradeSim extension' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await expect(page.getByRole('status').first()).toContainText('from the GradeSim extension');
});
