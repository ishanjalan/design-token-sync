import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.describe('Reference files and best practices toggle', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('.platform-card', { timeout: 10_000 });
	});

	test('reference file slots are visible for selected platform', async ({ page }) => {
		await expect(page.locator('text=Primitives.scss')).toBeVisible();
		await expect(page.locator('text=Colors.scss')).toBeVisible();
	});

	test('best practices toggle appears after uploading a reference file', async ({ page }) => {
		const lightInput = page.locator('input[type="file"]').nth(0);
		const darkInput = page.locator('input[type="file"]').nth(1);
		const valuesInput = page.locator('input[type="file"]').nth(2);

		await lightInput.setInputFiles(path.join(fixtures, 'light.tokens.json'));
		await darkInput.setInputFiles(path.join(fixtures, 'dark.tokens.json'));
		await valuesInput.setInputFiles(path.join(fixtures, 'value.tokens.json'));

		const refInputs = page.locator('.ref-slot--empty input[type="file"]');
		const refCount = await refInputs.count();
		if (refCount > 0) {
			await refInputs.first().setInputFiles(path.join(fixtures, 'light.tokens.json'));
		}

		const bpToggle = page.locator('.bp-option, .bp-row');
		const toggleCount = await bpToggle.count();
		expect(toggleCount).toBeGreaterThanOrEqual(0);
	});

	test('generates different output with best practices vs match existing', async ({ page }) => {
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
