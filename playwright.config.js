// playwright.config.js
// Configuración sin Docker para automatizar login en Yéminus

const { defineConfig, devices } = require('@playwright/test');
require('dotenv').config(); // Lee el .env con tus credenciales

module.exports = defineConfig({
  testDir: './tests', // donde estarán tus scripts o pruebas
  timeout: 60 * 1000, // 1 minuto por test
  retries: 1,
  use: {
    baseURL: process.env.URL ,
    headless: true,
    trace: 'retain-on-failure',   // guarda rastreo si algo falla
    screenshot: 'only-on-failure', // captura solo en error
    video: 'retain-on-failure',    // graba solo en error
    storageState: 'storage/auth.json', // guarda cookies de sesión
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  // Llama a tu setup global que hace login 1 sola vez antes de los tests
  globalSetup: require.resolve('./tests/global-setup'),
});
