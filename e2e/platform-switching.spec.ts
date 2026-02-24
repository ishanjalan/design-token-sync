import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.describe('Platform switching', () => {
	test.beforeEach(async ({ page }) => {
		await page.goto('/');
		await page.waitForSelector('.platform-card', { timeout: 10_000 });
	});

	test('Web platform is selected by default', async ({ page }) => {
		const webCard = page.locator('.platform-card').first();
		await expect(webCard).toHaveClass(/platform-card--active/);
	});

	test('clicking Android selects it and deselects Web', async ({ page }) => {
		const cards = page.locator('.platform-card');
		await cards.nth(1).click();
		await expect(cards.nth(1)).toHaveClass(/platform-card--active/);
		await expect(cards.nth(0)).not.toHaveClass(/platform-card--active/);
	});

	test('clicking iOS selects it and deselects others', async ({ page }) => {
		const cards = page.locator('.platform-card');
		await cards.nth(2).click();
		await expect(cards.nth(2)).toHaveClass(/platform-card--active/);
		await expect(cards.nth(0)).not.toHaveClass(/platform-card--active/);
		await expect(cards.nth(1)).not.toHaveClass(/platform-card--active/);
	});

	test('reference file slots change with platform', async ({ page }) => {
		const cards = page.locator('.platform-card');

		// Web shows consolidated color/typography file slots
		await expect(page.locator('text=Color files')).toBeVisible();

		// Switch to iOS
		await cards.nth(2).click();
		await expect(page.locator('text=Colors.swift')).toBeVisible();
		await expect(page.locator('text=Color files')).not.toBeVisible();

		// Switch to Android
		await cards.nth(1).click();
		await expect(page.locator('text=Colors.kt')).toBeVisible();
		await expect(page.locator('text=Colors.swift')).not.toBeVisible();
	});
});
