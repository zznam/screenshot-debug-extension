import { expect } from '@playwright/test';
import type { Page } from '@playwright/test';

export const drawRectangle = async (page: Page) => {
  await expect(page.locator('[data-editor-ready="true"]')).toBeVisible();
  await page.getByRole('button', { name: 'Rectangle', exact: true }).click();
  await page.getByRole('menuitemcheckbox', { name: 'Rectangle', exact: true }).click();
  const canvas = page.locator('canvas.upper-canvas');
  const box = await canvas.boundingBox();
  if (!box) throw new Error('Canvas missing');
  await canvas.click({ trial: true, position: { x: box.width * 0.2, y: box.height * 0.2 } });
  await page.mouse.move(box.x + box.width * 0.2, box.y + box.height * 0.2);
  await page.mouse.down();
  await page.mouse.move(box.x + box.width * 0.6, box.y + box.height * 0.4, { steps: 8 });
  await page.mouse.up();
  await expect(page.getByRole('button', { name: 'Start over' })).toBeEnabled();
};
