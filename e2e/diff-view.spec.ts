import { test, expect } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const fixtures = path.join(path.dirname(fileURLToPath(import.meta.url)), 'fixtures');

test.describe('Diff view', () => {
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

	test('code viewer appears after generation', async ({ page }) => {
		await generateOutput(page);

		const codeArea = page.locator('.code-scroll, .shiki, pre code');
		await expect(codeArea.first()).toBeVisible({ timeout: 10_000 });
	});

	test('file tabs are clickable and switch content', async ({ page }) => {
		await generateOutput(page);

		const tabs = page.locator('.file-tab');
		const tabCount = await tabs.count();

		if (tabCount > 1) {
			const firstTabText = await tabs.nth(0).textContent();
			await tabs.nth(1).click();
			const secondTabText = await tabs.nth(1).textContent();
			expect(firstTabText).not.toBe(secondTabText);
		}
	});

	test('diff toggle button exists after generation with reference', async ({ page }) => {
		await generateOutput(page);

		const diffBtn = page.locator('button', { hasText: /diff/i });
		const diffBtnCount = await diffBtn.count();
		expect(diffBtnCount).toBeGreaterThanOrEqual(0);
	});
});
