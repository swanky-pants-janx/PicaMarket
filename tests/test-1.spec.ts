import { test, expect } from '@playwright/test';

test('organiser signup and create market', async ({ page }) => {
  await page.goto('https://market-index-git-playwright-test-swanky-pants-janxs-projects.vercel.app/');

  // Enter app via the Organiser card (ensures organiser signup context)
  await page.getByRole('link', { name: 'Log in as Organiser' }).click();

  // Switch to signup form and wait for it to appear
  await page.getByText('Create account').click();
  await expect(page.getByRole('textbox', { name: 'e.g. Picnic & Thrift' })).toBeVisible();

  // Fill signup form
  await page.getByRole('textbox', { name: 'e.g. Picnic & Thrift' }).fill("Janco's Market");
  await page.getByRole('textbox', { name: 'e.g. Sarah' }).fill('Janco');
  await page.getByRole('textbox', { name: 'you@example.com' }).fill('jancouyscareer@gmail.com');
  await page.getByRole('textbox', { name: 'At least 8 characters' }).fill('CornetteU1@');
  await page.getByRole('textbox', { name: 'Repeat password' }).fill('CornetteU1@');
  await page.getByRole('button', { name: 'Create account' }).click();

  // Onboarding steps
  await page.getByRole('button', { name: 'Next' }).click();
  await page.getByRole('button', { name: 'Finish setup' }).click();

  // Create a market
  await page.getByRole('button', { name: 'Markets' }).click();
  await page.getByRole('button', { name: '+ New market' }).click();
  await page.getByRole('textbox', { name: 'e.g. Centurion Night Market' }).fill("Janco's Market");
  await page.getByRole('button', { name: 'Save market' }).click();
  await page.getByRole('button', { name: 'Publish' }).click();
});
