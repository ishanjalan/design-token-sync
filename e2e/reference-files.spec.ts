import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.describe('Reference files and auto-derived mode', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('.plat-btn', { timeout: 10_000 });
	});

	test('reference file slots are visible for selected platform', async ({ page }) => {
		await expect(page.locator('text=Color files')).toBeVisible();
		await expect(page.locator('text=Typography files')).toBeVisible();
	});

	test('mode indicator shows "best practices" when no reference files uploaded', async ({ page }) => {
		const indicator = page.locator('.mode-indicator');
		await expect(indicator).toContainText('best practices');
	});

	test('mode indicator switches to "match existing" after uploading a reference file', async ({ page }) => {
		const refSlots = page.locator('.ref-slot input[type="file"]');
		const refCount = await refSlots.count();
		if (refCount > 0) {
			await refSlots.first().setInputFiles(path.join(fixtures, 'light.tokens.json'));
		}

		const indicator = page.locator('.mode-indicator');
		await expect(indicator).toContainText('Matching your existing conventions');
	});

	test('generates output with auto-derived mode', async ({ page }) => {
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
	});
});
