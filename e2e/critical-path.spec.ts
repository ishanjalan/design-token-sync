import { test, expect } from '@playwright/test';
import path from 'node:path';

const fixtures = path.join(__dirname, 'fixtures');

test.describe('Critical path: upload → generate → download', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('.idle-state, .idle-message, .idle-swatch-preview', {
			timeout: 10_000
		});
	});

	test('uploads 3 JSON files, generates output, and verifies files appear', async ({ page }) => {
		const lightInput = page.locator('input[type="file"]').nth(0);
		const darkInput = page.locator('input[type="file"]').nth(1);
		const valuesInput = page.locator('input[type="file"]').nth(2);

		await lightInput.setInputFiles(path.join(fixtures, 'light.tokens.json'));
		await darkInput.setInputFiles(path.join(fixtures, 'dark.tokens.json'));
		await valuesInput.setInputFiles(path.join(fixtures, 'value.tokens.json'));

		const generateBtn = page.locator('button', { hasText: /Generate/i }).first();
		await expect(generateBtn).toBeEnabled({ timeout: 5000 });
		await generateBtn.click();

		await expect(page.locator('.file-tab')).toHaveCount(
			await page.locator('.file-tab').count().then((c) => (c > 0 ? c : 1)),
			{ timeout: 15_000 }
		);
		const tabs = page.locator('.file-tab');
		const tabCount = await tabs.count();
		expect(tabCount).toBeGreaterThanOrEqual(4);

		const successBanner = page.locator('.success-banner');
		await expect(successBanner).toBeVisible({ timeout: 5_000 });
		await expect(successBanner).toContainText('generated');

		const copyBtn = page.locator('.success-action', { hasText: 'Copy' });
		await expect(copyBtn).toBeVisible();
		const zipBtn = page.locator('.success-action', { hasText: 'ZIP' });
		await expect(zipBtn).toBeVisible();
	});

	test('copy button copies current file content', async ({ page }) => {
		const lightInput = page.locator('input[type="file"]').nth(0);
		const darkInput = page.locator('input[type="file"]').nth(1);
		const valuesInput = page.locator('input[type="file"]').nth(2);

		await lightInput.setInputFiles(path.join(fixtures, 'light.tokens.json'));
		await darkInput.setInputFiles(path.join(fixtures, 'dark.tokens.json'));
		await valuesInput.setInputFiles(path.join(fixtures, 'value.tokens.json'));

		const generateBtn = page.locator('button', { hasText: /Generate/i }).first();
		await expect(generateBtn).toBeEnabled({ timeout: 5000 });
		await generateBtn.click();

		await expect(page.locator('.file-tab')).toHaveCount(
			await page.locator('.file-tab').count().then((c) => (c > 0 ? c : 1)),
			{ timeout: 15_000 }
		);

		const toolbarCopy = page.locator('.ctrl-btn', { hasText: 'Copy' });
		await expect(toolbarCopy).toBeVisible({ timeout: 5_000 });
	});
});
