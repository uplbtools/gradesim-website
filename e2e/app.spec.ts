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

test('first visit leads with the extension and offers two other ways in', async ({ page }) => {
	await page.goto('/');
	await expect(page.getByRole('heading', { level: 1 })).toContainText('Your GWA');
	await expect(page.getByText('Your grades stay in this browser.')).toBeVisible();
	await expect(page.locator('#main').getByRole('link', { name: 'Get the extension' })).toHaveAttribute('href', /install\/$/);
	await expect(page.getByRole('button', { name: 'Load backup' })).toBeVisible();
	await expect(page.getByRole('heading', { name: 'A plan for the sems you have left' })).toBeVisible();
	await page.getByRole('link', { name: 'Add my grades' }).click();
	await expect(page.getByRole('heading', { level: 1 })).toBeInViewport();
	await expect(page.getByRole('button', { name: 'Enter grades by hand' })).toBeVisible();
});

test('unknown URLs get the branded 404', async ({ page }) => {
	const res = await page.goto('/does-not-exist/');
	expect(res?.status()).toBe(404);
	await expect(page.getByRole('heading', { level: 1 })).toHaveText("This page isn't here");
	await expect(page.getByRole('link', { name: 'Open GradeSim' })).toHaveAttribute('href', '/');
});

test('curricula opens a checklist with a link to plan it', async ({ page }) => {
	await page.goto('/curricula/');
	await page.getByRole('button', { name: 'BS Computer Science' }).click();
	await expect(page.getByAltText('BS Computer Science checklist, page 1')).toBeVisible();
	await expect(page.getByRole('link', { name: 'Plan BS Computer Science in GradeSim' })).toHaveAttribute('href', '/?program=BSCS#planner');
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
	// 1.9773 is on no Latin honor track, and Honor Roll is not one.
	await expect(page.getByText(/Honor Roll|cum laude range/i)).toHaveCount(0);
	await expect(page.getByRole('region', { name: '1st sem AY 2023-24' })).toContainText('MATH 27');
	await page.getByRole('tab', { name: 'Target' }).click();
	await expect(page.getByText('Imported 15 courses')).toHaveCount(0);
});

test('Leave out sits in edit mode and a left-out course stays marked', async ({ page }) => {
	await importFixture(page);
	await expect(page.locator('.excl')).toHaveCount(0);
	await page.getByRole('button', { name: 'Add or edit grades' }).click();
	await page.locator('.excl').first().click();
	await page.getByRole('button', { name: 'Done editing' }).click();
	await expect(page.locator('.excl')).toHaveText(['Left out']);
	await expect(page.getByTestId('gwa')).toHaveText('2.0000');
});

test('a junk file is refused with a reason', async ({ page }) => {
	await open(page);
	await page.getByTestId('file-input').first().setInputFiles({ name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"a":1}') });
	await expect(page.getByRole('status').first()).toContainText("isn't a GradeSim backup");
});

test('planner renders and a failed course shows a retake', async ({ page }) => {
	await importFixture(page);
	await page.getByRole('tab', { name: 'Planner' }).click();
	await expect(page.getByTestId('grad-term')).toContainText('Graduate');
	const sheet = page.getByTestId('planner-sheet');
	await expect(sheet.locator('.pl-row.st-retake[data-code="MATH 27"]')).toBeVisible();
	await sheet.getByText(/sems done, \d+ units passed/).click();
	await expect(sheet.locator('.pl-row.st-failed[data-code="MATH 27"]')).toBeVisible();
	await sheet.locator('.pl-row.st-retake[data-code="MATH 27"]').click();
	await expect(page.getByRole('complementary', { name: 'Details for MATH 27' })).toContainText('Analytic Geometry');
	await expect(page).toHaveURL(/#planner$/);
	await sheet.getByText(/You can also take \d+ other course/).click();
	const also = sheet.locator('[data-also]').first();
	const code = await also.getAttribute('data-also');
	await also.click();
	await expect(page.getByRole('complementary', { name: `Details for ${code}` })).toBeVisible();
	await page.getByText('Plan settings').click();
	await expect(page.locator('.pl-menu-pop')).toContainText(/With 21 units, you'd graduate|Your graduation sem is the same at any load/);
	await page.getByLabel('Min load per sem').selectOption('18');
	await expect(sheet.getByText('Under your 18-unit minimum.').first()).toBeVisible();
});

test('an old course is credited to a checklist row from the planner', async ({ page }) => {
	const data = JSON.parse(backup.toString());
	data.gradesData.student_grades['1231'].values.push({ id: 99, grade: '2.00', unit_taken: '3', course: { course_code: 'MATH 37', title: 'Mathematical Analysis II' } });
	await open(page);
	await page.getByTestId('file-input').first().setInputFiles({ name: 'backup.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(data)) });
	await page.getByRole('tab', { name: 'Planner' }).click();
	const sheet = page.getByTestId('planner-sheet');
	const retake = sheet.locator('.pl-row.st-retake[data-code="MATH 27"]');
	await retake.click();
	await page.getByText('Credit or fix this course').click();
	const credit = page.getByLabel('Credit a course you passed');
	await expect(credit.locator('option')).toHaveText(['None', 'MATH 37, 3 units, 2.00']);
	await credit.selectOption('MATH 37');
	await expect(retake).toHaveCount(0);
	await expect(page.getByRole('complementary', { name: 'Details for MATH 27' })).toContainText('It counts as MATH 27');
	await credit.selectOption('');
	await expect(retake).toBeVisible();
});

test('a checklist fix changes the plan and is listed for sending', async ({ page }) => {
	await importFixture(page);
	await page.getByRole('tab', { name: 'Planner' }).click();
	const sheet = page.getByTestId('planner-sheet');
	await sheet.locator('.pl-row[data-code="CMSC 123"]').click();
	await page.getByRole('button', { name: 'Fix this course' }).click();
	await page.getByRole('spinbutton', { name: 'Units' }).fill('5');
	await page.getByRole('button', { name: 'Save fix' }).click();
	await expect(page.getByRole('region', { name: 'Your fixes to this checklist' })).toContainText('CMSC 123 has 5 units');
	await expect(sheet.locator('.pl-row[data-code="CMSC 123"] .pl-row-units')).toHaveText('5');
	await page.getByRole('button', { name: 'Undo' }).click();
	await expect(sheet.locator('.pl-row[data-code="CMSC 123"] .pl-row-units')).toHaveText('3');
});

test('the planner says what is left', async ({ page }) => {
	await importFixture(page);
	await page.getByRole('tab', { name: 'Planner' }).click();
	await expect(page.getByText(/^\d+ sems(, \d+ midyears?)? and \d+ units left\.$/)).toBeVisible();
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

test('curricula deep link opens the planner without grades', async ({ page }) => {
	await open(page, '/?program=BSCS#planner');
	await expect(page.getByTestId('planner-sheet')).toBeVisible();
	await page.getByRole('combobox', { name: 'Your degree program' }).selectOption('BSBIO');
	await expect(page.getByText('BS Biology checklist')).toBeVisible();
	await page.reload();
	await expect(page.getByText('BS Biology checklist')).toBeVisible();
	await page.getByRole('button', { name: 'Add your grades' }).click();
	await expect(page.getByRole('link', { name: 'Get the extension' }).first()).toBeVisible();
	await page.reload();
	await expect(page.getByTestId('planner-sheet')).toHaveCount(0);
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
	const sheet = page.getByTestId('planner-sheet');
	await expect(sheet).toHaveCSS('flex-direction', 'column');
	expect(await noSideScroll()).toBe(true);
	await sheet.locator('.pl-row.st-retake[data-code="MATH 27"]').click();
	// On phones the details open inline, inside the term list.
	await expect(sheet.getByRole('complementary', { name: 'Details for MATH 27' })).toBeVisible();
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
	await page.getByRole('button', { name: 'Import from the extension' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await expect(page.getByRole('status').first()).toContainText('from the extension');
});

test('a visit from the extension popup imports the grades and opens the planner', async ({ page }) => {
	await page.addInitScript((payload) => {
		window.addEventListener('message', (e) => {
			const type = e.data?.type;
			if (e.source !== window || (type !== 'GRADESIM_PING' && type !== 'GRADESIM_GET_GRADES')) return;
			const reply = type === 'GRADESIM_PING' ? { hasGrades: true, fetchedAt: 1 } : JSON.parse(payload);
			window.postMessage({ type: 'GRADESIM_REPLY', request: type, payload: reply }, location.origin);
		});
	}, backup.toString());
	await open(page, '/?from=extension&whatif=MATH%2027#planner');
	await expect(page.getByRole('status').first()).toContainText('from the extension');
	await expect(page.getByRole('tab', { name: 'Planner' })).toHaveAttribute('aria-selected', 'true');
	await expect(page.getByText('MATH 27 is failed on your record')).toBeVisible();
	expect(new URL(page.url()).search).toBe('');
});

test('newer grades from the extension load on the next visit', async ({ page }) => {
	// The stand-in reads AMIS again once localStorage says so, and CMSC 12 comes back as 1.00.
	await page.addInitScript((payload) => {
		window.addEventListener('message', (e) => {
			const type = e.data?.type;
			if (e.source !== window || (type !== 'GRADESIM_PING' && type !== 'GRADESIM_GET_GRADES')) return;
			const fetchedAt = Number(localStorage.getItem('mockFetchedAt') ?? 1);
			const data = { ...JSON.parse(payload), fetchedAt };
			if (fetchedAt > 1) (Object.values(data.gradesData.student_grades)[0] as { values: { grade: string }[] }).values[0].grade = '1.00';
			const reply = type === 'GRADESIM_PING' ? { hasGrades: true, fetchedAt } : data;
			window.postMessage({ type: 'GRADESIM_REPLY', request: type, payload: reply }, location.origin);
		});
	}, backup.toString());
	await open(page);
	await page.getByRole('button', { name: 'Import from the extension' }).click();
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await page.reload();
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await page.evaluate(() => localStorage.setItem('mockFetchedAt', '2'));
	await page.reload();
	await expect(page.getByRole('status').first()).toContainText('newer grades from the extension');
	await expect(page.getByTestId('gwa')).not.toHaveText('1.9773');
});

test('the phone bookmark opens GradeSim with the AMIS grades in the link', async ({ page }) => {
	const { BOOKMARKLET } = await import('../src/lib/bookmarklet.ts');
	const amis = JSON.parse(backup.toString()).gradesData;
	await page.route('https://amis.uplb.edu.ph/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>AMIS</p>' }));
	const cors = {
		'access-control-allow-origin': 'https://amis.uplb.edu.ph',
		'access-control-allow-credentials': 'true',
		'access-control-allow-headers': 'authorization,x-session-id'
	};
	await page.route('https://api-amis.uplb.edu.ph/**', (r) =>
		r.request().method() === 'OPTIONS' ? r.fulfill({ status: 204, headers: cors }) : r.fulfill({ json: amis, headers: cors })
	);
	await page.goto('https://amis.uplb.edu.ph/');
	await page.evaluate(() => localStorage.setItem('auth._token.local', 'Bearer test'));
	page.once('dialog', (d) => d.dismiss());
	await page.route('https://gradesim.uplb.tools/**', (r) => r.fulfill({ contentType: 'text/html', body: '<p>GradeSim</p>' }));
	await Promise.all([page.waitForURL(/gradesim\.uplb\.tools\/#d=/), page.evaluate(decodeURIComponent(BOOKMARKLET.slice('javascript:'.length)))]);
	await open(page, '/' + new URL(page.url()).hash);
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
	await expect(page.getByRole('status').first()).toContainText('from your link');
	expect(page.url()).toMatch(/#grades$/);
});

test('a copied link opens the grades in another browser, and asks before it replaces any', async ({ page, context, browser }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await importFixture(page);
	await page.getByText('Back up or clear your data').click();
	await page.getByRole('button', { name: 'Copy a link to my grades' }).click();
	await expect(page.getByText('The link is copied.')).toBeVisible();
	const link = await page.evaluate(() => navigator.clipboard.readText());

	const other = await (await browser.newContext()).newPage();
	await other.goto(link);
	await expect(other.getByTestId('gwa')).toHaveText('1.9773');
	await other.context().close();

	let asked = '';
	page.once('dialog', (d) => {
		asked = d.message();
		d.dismiss();
	});
	await page.goto(link);
	await expect.poll(() => asked).toContain('Replace the grades');
	await expect(page.getByTestId('gwa')).toHaveText('1.9773');
});

test('a plan link opens the same plan for someone else, with no grades and nothing saved', async ({ page, context, browser }) => {
	await context.grantPermissions(['clipboard-read', 'clipboard-write']);
	await importFixture(page);
	await page.getByRole('tab', { name: 'Planner' }).click();
	const grad = await page.getByTestId('grad-term').locator('span').first().textContent();
	await page.getByText('Plan settings').click();
	await page.getByRole('button', { name: 'Copy a link to this plan' }).click();
	await expect(page.getByText('The link is copied.')).toBeVisible();
	const link = await page.evaluate(() => navigator.clipboard.readText());

	const other = await (await browser.newContext()).newPage();
	await other.goto(link);
	await expect(other.getByText('plan someone shared with you')).toBeVisible();
	await expect(other.getByTestId('grad-term').locator('span').first()).toHaveText(grad!);
	await expect(other.getByTestId('planner-sheet').locator('.pl-row[data-code="CMSC 12"]')).toHaveClass(/st-passed/);
	await expect(other.getByText('1.25')).toHaveCount(0);
	await other.waitForTimeout(200);
	expect(await other.evaluate(() => JSON.stringify(localStorage))).not.toContain('CMSC 12');
	await other.getByRole('button', { name: 'Close it' }).click();
	await expect(other.getByRole('heading', { level: 1 })).toContainText('Your GWA');
	await other.context().close();
});

test('@phone the welcome screen leads with the AMIS bookmark', async ({ page }) => {
	await page.goto('/');
	await expect(page.locator('#main').getByRole('link', { name: 'Get my grades from AMIS' })).toHaveAttribute('href', /install\/#phone$/);
	await expect(page.locator('#main').getByRole('link', { name: 'Get the extension' })).toBeHidden();
});

test('the GWA and semester cards in Wrapped are drawn in the tin frame', async ({ page }) => {
	await importFixture(page);
	await page.getByRole('tab', { name: 'Wrapped' }).click();
	const card = page.getByRole('img', { name: /drawn in a tin/ });
	await expect(card).toHaveAccessibleName(/GWA 1\.9773/);
	const blank = await card.getAttribute('src');
	await page.getByRole('textbox', { name: 'Your name on the card' }).fill('Iska');
	await expect(card).not.toHaveAttribute('src', blank!);
	await page.getByRole('button', { name: 'Next' }).click();
	await expect(card).toHaveAccessibleName(/Sem stats, Best sem/);
	await page.getByRole('button', { name: 'Next' }).click();
	await expect(card).toHaveCount(0);
});

test('courses from Room TBA land in the plan, and the next sem links back', async ({ page }) => {
	await importFixture(page);
	await open(page, '/?take=CMSC 21,NOPE 1&term=1271#planner');
	await expect(page.getByText('Room TBA put CMSC 21 in 1st sem 2027.')).toBeVisible();
	await expect(page).toHaveURL(/\/#planner$/);
	const link = page.getByRole('link', { name: 'Plan sections in Room TBA' }).first();
	await expect(link).toHaveAttribute('href', /^https:\/\/room-tba\.uplb\.tools\/planner\?plan=/);
});
