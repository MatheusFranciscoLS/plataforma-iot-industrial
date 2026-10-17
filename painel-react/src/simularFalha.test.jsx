// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socketFalso = vi.hoisted(() => ({ on: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: () => socketFalso }));
vi.mock('@/components/GraficoTemperatura', () => ({ default: () => null }));

import App from './App';
import LinhaMaquina from '@/components/LinhaMaquina';
import { buscarEstadoDoDemo, provocarFalha } from '@/lib/api';
import { avaliarMaquina } from '@/lib/limites';

const tokenCom = (dados) => `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...dados })).replace(/=+$/, '')}.y`;
const resposta = (status, corpo = {}, cabecalhos = {}) => ({
  ok: status >= 200 && status < 300,
  status,
  json: async () => corpo,
  headers: { get: (nome) => cabecalhos[nome] ?? null },
});

afterEach(() => vi.unstubAllGlobals());

describe('lib/api: modo demonstração', () => {
  it('estado do demo: devolve o que a API diz, ou null quando a rota não existe (404)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, { simulador: true, maquinas: ['MAQ-01'], esperaEntreFalhasSegundos: 30 })));
    expect(await buscarEstadoDoDemo('t')).toEqual({ simulador: true, maquinas: ['MAQ-01'], esperaEntreFalhasSegundos: 30 });

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(404)));
    expect(await buscarEstadoDoDemo('t')).toBeNull();
  });

  it('provocar falha manda POST para a máquina certa', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(202, { maquina: 'MAQ-02', tipo: 'AMBAS', duracaoSegundos: 60 }));
    vi.stubGlobal('fetch', fetchFalso);

    expect(await provocarFalha('t', 'MAQ-02')).toEqual({ maquina: 'MAQ-02', tipo: 'AMBAS', duracaoSegundos: 60 });
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(String(url)).toContain('/api/demo/falha/MAQ-02');
    expect(opcoes.method).toBe('POST');
  });

  it('429 traz quantos segundos esperar (cabeçalho Retry-After)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(429, {}, { 'Retry-After': '17' })));

    await expect(provocarFalha('t', 'MAQ-01')).rejects.toMatchObject({ status: 429, esperarSegundos: 17 });
  });
});

describe('LinhaMaquina: botão Simular falha', () => {
  const dado = { idMaquina: 'MAQ-01', timestamp: 1, temperaturaMotor: 80, vibracao: 2, rpm: 1500, recebidoEm: 1000 };
  const montar = (extra) =>
    render(<LinhaMaquina nome="MAQ-01" dado={dado} avaliacao={avaliarMaquina(dado, 1000)} agora={1000} serie={[80]} onDetalhes={vi.fn()} {...extra} />);

  it('sem a função (fora do demo ou sem permissão) o botão não aparece', () => {
    montar();

    expect(screen.queryByRole('button', { name: /Simular falha/ })).not.toBeInTheDocument();
  });

  it('com a função, o botão avisa qual máquina', async () => {
    const onSimularFalha = vi.fn();
    montar({ onSimularFalha });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Simular falha em MAQ-01' }));

    expect(onSimularFalha).toHaveBeenCalledWith('MAQ-01');
  });
});

describe('no painel', () => {
  let demoLigado;
  let respostaDaFalha;
  let fetchFalso;

  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('idioma', 'pt');
    demoLigado = true;
    respostaDaFalha = resposta(202, { maquina: 'MAQ-02', tipo: 'AMBAS', duracaoSegundos: 60 });
    fetchFalso = vi.fn(async (url) => {
      const u = String(url);
      if (u.includes('/api/demo/estado')) return demoLigado ? resposta(200, { simulador: true, maquinas: ['MAQ-01', 'MAQ-02', 'MAQ-03'], esperaEntreFalhasSegundos: 30 }) : resposta(404);
      if (u.includes('/api/demo/falha/')) return respostaDaFalha;
      return resposta(200, u.includes('/api/alertas?') || u.includes('/api/sensores') ? [] : {});
    });
    vi.stubGlobal('fetch', fetchFalso);
  });

  async function abrirComo(perfil) {
    localStorage.setItem('token', tokenCom({ sub: 'maria', perfil }));
    render(<App />);
    await screen.findByRole('heading', { name: 'Monitoramento da fábrica' });
  }

  it('operador no modo demonstração vê o botão e, ao clicar, a falha é pedida e o aviso aparece', async () => {
    await abrirComo('OPERADOR');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Simular falha em MAQ-02' }));

    expect(await screen.findByText(/Falha simulada em MAQ-02/)).toBeInTheDocument();
    expect(fetchFalso.mock.calls.some(([u, o]) => String(u).includes('/api/demo/falha/MAQ-02') && o.method === 'POST')).toBe(true);
  });

  it('fora do modo demonstração (404) ninguém vê o botão', async () => {
    demoLigado = false;
    await abrirComo('ADMIN');
    await waitFor(() => expect(fetchFalso.mock.calls.some(([u]) => String(u).includes('/api/demo/estado'))).toBe(true));

    expect(screen.queryByRole('button', { name: /Simular falha/ })).not.toBeInTheDocument();
  });

  it('somente leitura não vê o botão, mesmo no modo demonstração', async () => {
    await abrirComo('LEITURA');
    await waitFor(() => expect(fetchFalso.mock.calls.some(([u]) => String(u).includes('/api/demo/estado'))).toBe(true));

    expect(screen.queryByRole('button', { name: /Simular falha/ })).not.toBeInTheDocument();
  });

  it('429 mostra quanto esperar', async () => {
    respostaDaFalha = resposta(429, {}, { 'Retry-After': '21' });
    await abrirComo('ADMIN');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Simular falha em MAQ-01' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('MAQ-01 acabou de falhar. Aguarde 21 s para simular de novo.');
  });

  it('403 do servidor avisa que falta permissão e não derruba a sessão', async () => {
    respostaDaFalha = resposta(403);
    await abrirComo('OPERADOR');

    await userEvent.setup().click(await screen.findByRole('button', { name: 'Simular falha em MAQ-01' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Só operadores e administradores podem simular falhas.');
    expect(screen.getByRole('heading', { name: 'Monitoramento da fábrica' })).toBeInTheDocument();
  });
});
