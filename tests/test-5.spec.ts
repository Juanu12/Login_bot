import { test, expect } from '@playwright/test';

test('test', async ({ page }) => {
  await page.goto('http://yeminus.softgic.co:8081/#/login');
  await page.getByRole('textbox', { name: 'Usuario' }).click();
  await page.getByRole('textbox', { name: 'Usuario' }).fill('1097783757');
  await page.getByRole('textbox', { name: 'Contraseña' }).click();
  await page.getByRole('textbox', { name: 'Contraseña' }).fill('123456');
  await page.getByRole('button', { name: 'Ingresar' }).click();
  await page.locator('#mnu44').click();
  await page.locator('#mnu60').click();
  await page.getByRole('button', { name: ' Crear' }).click();
  await page.getByRole('combobox').nth(1).click();
  await page.getByText('CEDULA DE CIUDADANIA').click();
});