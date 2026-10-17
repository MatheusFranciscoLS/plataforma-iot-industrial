import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

// Confere a acessibilidade com o axe-core: nenhuma violação das regras WCAG 2.1 níveis A e AA
// (contraste de cores, nomes de botões e campos, hierarquia de títulos, papéis ARIA, etc.).
const REGRAS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'];

async function conferir(page) {
  // Espera as transições de cor terminarem, senão o axe mede o contraste no meio da animação.
  await page.waitForTimeout(800);
  const { violations } = await new AxeBuilder({ page }).withTags(REGRAS).analyze();
  // Mostra no erro o que quebrou e onde, em vez de só "diferente de zero".
  const resumo = violations.map((v) => ({
    regra: v.id,
    impacto: v.impact,
    ajuda: v.help,
    elementos: v.nodes.slice(0, 3).map((n) => n.target.join(" ")),
  }));
  expect(resumo).toEqual([]);
}

for (const esquema of ['light', 'dark']) {
  test.describe(`tema ${esquema === 'light' ? 'claro' : 'escuro'}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: esquema });
    });

    test('página inicial (login)', async ({ page }) => {
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Ver o painel de demonstração' })).toBeVisible();
      await conferir(page);
    });

    test('painel com as máquinas', async ({ page }) => {
      await page.goto('/');
      await page.getByRole('button', { name: 'Ver o painel de demonstração' }).click();
      await expect(page.getByRole('article', { name: /^MAQ-01:/ })).toBeVisible();
      await expect(page.getByRole('heading', { name: 'Monitoramento da fábrica', level: 1 })).toBeVisible();
      await conferir(page);
    });
  });
}
