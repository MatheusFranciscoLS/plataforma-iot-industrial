import { expect, test } from '@playwright/test';

// O que uma pessoa faz ao abrir o site: clica no botão de demonstração e vê as máquinas funcionando.
async function entrarNaDemonstracao(page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'Ver o painel de demonstração' }).click();
  await expect(page.getByRole('heading', { name: 'Monitoramento da fábrica', level: 1 })).toBeVisible();
}

test('a página inicial explica o projeto e tem o botão de demonstração', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByRole('heading', { name: 'Como uma leitura chega até a tela' })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Ver o painel de demonstração' })).toBeEnabled();
});

test('senha errada mostra o erro e não entra', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Usuário').fill('admin');
  await page.getByLabel('Senha').fill('senha-errada-de-teste');
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();

  await expect(page.getByRole('alert')).toContainText('Usuário ou senha incorretos.');
});

test('o botão de demonstração abre o painel e os números mudam ao vivo', async ({ page }) => {
  await entrarNaDemonstracao(page);

  // As três máquinas aparecem, com leituras reais (simulador -> API -> fila -> gateway -> WebSocket)
  for (const maquina of ['MAQ-01', 'MAQ-02', 'MAQ-03']) {
    await expect(page.getByRole('article', { name: new RegExp(`^${maquina}:`) })).toBeVisible();
  }
  await expect(page.locator('header').getByText('Ao vivo')).toBeVisible(); // o status de conexão (o seletor de período do gráfico também tem um "Ao vivo")

  // A temperatura de MAQ-01 muda sozinha em poucos segundos (o simulador envia uma leitura nova a cada 2 s)
  const temperatura = page.getByRole('article', { name: /^MAQ-01:/ }).getByRole('meter', { name: 'Temperatura de MAQ-01' });
  const inicial = await temperatura.getAttribute('aria-valuenow');
  await expect.poll(() => temperatura.getAttribute('aria-valuenow'), { timeout: 30_000 }).not.toBe(inicial);

  await expect(page.getByRole('status', { name: 'Resumo da fábrica' })).toBeVisible();
});

test('o gráfico muda de grandeza e as leituras podem ser baixadas em CSV', async ({ page }) => {
  await entrarNaDemonstracao(page);

  await page.getByRole('button', { name: 'Vibração', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Vibração das máquinas' })).toBeVisible();
  await expect(page.getByText('Limite de 5,0 mm/s', { exact: true })).toBeVisible();

  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar leituras (CSV)' }).click();
  const arquivo = await download;

  expect(arquivo.suggestedFilename()).toBe('leituras.csv');
  const conteudo = await (await import('node:fs/promises')).readFile(await arquivo.path(), 'utf8');
  expect(conteudo.split('\n')[0]).toBe('momento,maquina,temperatura_c,vibracao_mm_s,rpm');
  expect(conteudo.split('\n').length).toBeGreaterThan(3);
});

test('sair volta para a página inicial', async ({ page }) => {
  await entrarNaDemonstracao(page);

  await page.getByRole('button', { name: 'Sair' }).click();

  await expect(page.getByRole('button', { name: 'Ver o painel de demonstração' })).toBeVisible();
});
