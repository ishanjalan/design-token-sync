import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.describe('Settings persistence', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('.platform-card', { timeout: 10_000 });
	});

	test('platform selection persists after reload', async ({ page }) => {
		const cards = page.locator('.platform-card');
		await cards.nth(2).click(); // Select iOS
		await expect(cards.nth(2)).toHaveClass(/platform-card--active/);

		await page.reload();
		await page.waitForSelector('.platform-card', { timeout: 10_000 });

		const reloadedCards = page.locator('.platform-card');
		await expect(reloadedCards.nth(2)).toHaveClass(/platform-card--active/);
	});

	test('settings panel opens from activity rail after generation', async ({ page }) => {
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

		const settingsBtn = page.locator('.rail-btn[aria-label="Settings"]');
		await settingsBtn.click();
		await expect(page.locator('input').first()).toBeVisible({ timeout: 5_000 });
	});
});
