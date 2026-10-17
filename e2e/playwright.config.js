import { defineConfig } from '@playwright/test';

// Testes no navegador da plataforma inteira rodando (docker compose up). O painel fica em http://localhost:5173.
// Localmente, E2E_CHANNEL=msedge usa o Edge instalado em vez de baixar um Chromium.
export default defineConfig({
  testDir: './tests',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: process.env.E2E_URL || 'http://localhost:5173',
    locale: 'pt-BR', // o painel escolhe o idioma pelo navegador; os testes esperam os textos em português
    channel: process.env.E2E_CHANNEL || undefined,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
});
