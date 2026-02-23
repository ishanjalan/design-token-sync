import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.describe('Dark mode toggle', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('.platform-card', { timeout: 10_000 });
	});

	test('toggles between light, dark, and auto themes', async ({ page }) => {
		const html = page.locator('html');
		const themeBtn = page.locator('.theme-toggle');

		const initialMode = await html.getAttribute('data-color-mode');
		expect(['light', 'dark', 'auto']).toContain(initialMode);

		await themeBtn.click();
		const secondMode = await html.getAttribute('data-color-mode');
		expect(secondMode).not.toBe(initialMode);
	});

	test('theme persists after reload', async ({ page }) => {
		const html = page.locator('html');
		const themeBtn = page.locator('.theme-toggle');

		await themeBtn.click();
		const modeAfterClick = await html.getAttribute('data-color-mode');

		await page.reload();
		await page.waitForSelector('.platform-card', { timeout: 10_000 });

		const modeAfterReload = await html.getAttribute('data-color-mode');
		expect(modeAfterReload).toBe(modeAfterClick);
	});
});
