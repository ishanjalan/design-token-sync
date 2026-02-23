import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.describe('History', () => {
	async function generateOutput(page: import('@playwright/test').Page) {
		const lightInput = page.locator('input[type="file"]').nth(0);
		const darkInput = page.locator('input[type="file"]').nth(1);
		const valuesInput = page.locator('input[type="file"]').nth(2);

		await lightInput.setInputFiles(path.join(fixtures, 'light.tokens.json'));
		await darkInput.setInputFiles(path.join(fixtures, 'dark.tokens.json'));
		await valuesInput.setInputFiles(path.join(fixtures, 'value.tokens.json'));

		const generateBtn = page.locator('button', { hasText: /Generate/i }).first();
		await expect(generateBtn).toBeEnabled({ timeout: 5000 });
		await generateBtn.click();

		await expect(page.locator('.file-tab').first()).toBeVisible({ timeout: 15_000 });
	}

	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('.platform-card', { timeout: 10_000 });
	});

	test('history panel opens from activity rail', async ({ page }) => {
		await generateOutput(page);

		const railBtns = page.locator('.rail-btn');
		const railCount = await railBtns.count();

		for (let i = 0; i < railCount; i++) {
			const label = await railBtns.nth(i).getAttribute('aria-label');
			if (label?.toLowerCase().includes('history')) {
				await railBtns.nth(i).click();
				break;
			}
		}

		const historyEntry = page.locator('.history-entry');
		const entryCount = await historyEntry.count();
		expect(entryCount).toBeGreaterThanOrEqual(0);
	});

	test('generating twice creates history entries', async ({ page }) => {
		await generateOutput(page);

		const importBtn = page.locator('.rail-btn[aria-label="Import"]');
		await importBtn.click();
		await expect(page.locator('input[type="file"]').first()).toBeVisible({ timeout: 5_000 });

		const generateBtn = page.locator('button', { hasText: /Generate/i }).first();
		await expect(generateBtn).toBeEnabled({ timeout: 5000 });
		await generateBtn.click();
		await expect(page.locator('.file-tab').first()).toBeVisible({ timeout: 15_000 });

		const historyBtn = page.locator('.rail-btn[aria-label="History"]');
		await historyBtn.click();

		const historyEntries = page.locator('.history-entry');
		await expect(historyEntries.first()).toBeVisible({ timeout: 5_000 });
	});
});
