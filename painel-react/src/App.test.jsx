// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// O socket é falso: o teste guarda os "ouvintes" e dispara os eventos à mão.
const socketFalso = vi.hoisted(() => {
  const falso = { ouvintes: {}, disconnect: vi.fn() };
  falso.on = (evento, funcao) => {
    falso.ouvintes[evento] = funcao;
  };
  falso.emitir = (evento, ...args) => falso.ouvintes[evento]?.(...args);
  return falso;
});
vi.mock('socket.io-client', () => ({ io: () => socketFalso }));

// O gráfico (Recharts) precisa de medidas reais de tela, que o jsdom não tem.
vi.mock('@/components/GraficoTemperatura', () => ({
  default: ({ onPontos }) => <button onClick={() => onPontos(60)}>mais pontos</button>,
}));

import App from './App';

const tokenComExpiracao = (expEmSegundos) => `x.${btoa(JSON.stringify({ exp: expEmSegundos })).replace(/=+$/, '')}.y`;
const tokenValido = () => tokenComExpiracao(Math.floor(Date.now() / 1000) + 3600);

const leitura = (extra = {}) => ({
  id: 1,
  idMaquina: 'MAQ-01',
  timestamp: Math.floor(Date.now() / 1000),
  temperaturaMotor: 80,
  vibracao: 2,
  rpm: 1800,
  ...extra,
});

beforeEach(() => {
  localStorage.clear();
  socketFalso.ouvintes = {};
  socketFalso.disconnect.mockClear();
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('App', () => {
  it('sem token guardado mostra o login', () => {
    render(<App />);

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('token já vencido no navegador é descartado e mostra o login', () => {
    localStorage.setItem('token', tokenComExpiracao(Math.floor(Date.now() / 1000) - 60));

    render(<App />);

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('com token válido mostra o painel e o resumo muda quando chega uma leitura crítica', async () => {
    localStorage.setItem('token', tokenValido());
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Monitoramento da fábrica' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Resumo da fábrica' })).toHaveTextContent('Aguardando as primeiras leituras');

    act(() => socketFalso.emitir('connect'));
    act(() => socketFalso.emitir('novoRegistro', leitura({ idMaquina: 'MAQ-01', temperaturaMotor: 99 })));
    act(() => socketFalso.emitir('novoRegistro', leitura({ id: 2, idMaquina: 'MAQ-02' })));
    act(() => socketFalso.emitir('novoRegistro', leitura({ id: 3, idMaquina: 'MAQ-03' })));

    expect(screen.getByText('Ao vivo')).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Resumo da fábrica' })).toHaveTextContent('1 máquina em estado crítico');
    expect(screen.getByRole('article', { name: 'MAQ-01: Crítica' })).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'MAQ-02: Normal' })).toBeInTheDocument();
    expect(screen.getByRole('region', { name: 'Alertas recentes' })).toHaveTextContent('Temperatura acima de 95 °C');
  });

  it('pedir mais pontos no gráfico busca um histórico maior e não reconecta o tempo real', async () => {
    localStorage.setItem('token', tokenValido());
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetchFalso);
    render(<App />);

    const botao = await screen.findByRole('button', { name: 'mais pontos' });
    expect(fetchFalso.mock.calls[0][0]).toContain('/api/sensores?limite=60'); // 20 pontos x 3 máquinas

    act(() => botao.click());

    await waitFor(() => expect(fetchFalso.mock.calls.at(-1)[0]).toContain('/api/sensores?limite=180')); // 60 x 3
    expect(socketFalso.disconnect).not.toHaveBeenCalled();
  });

  it('queda de conexão aparece como "Reconectando"', async () => {
    localStorage.setItem('token', tokenValido());
    render(<App />);
    await screen.findByRole('heading', { name: 'Monitoramento da fábrica' });

    act(() => socketFalso.emitir('connect'));
    act(() => socketFalso.emitir('disconnect'));

    expect(screen.getByText('Reconectando…')).toBeInTheDocument();
  });

  it('gateway recusando o token volta para o login com aviso de sessão terminada', async () => {
    localStorage.setItem('token', tokenValido());
    render(<App />);
    await screen.findByRole('heading', { name: 'Monitoramento da fábrica' });

    act(() => socketFalso.emitir('connect_error', new Error('Acesso negado: Token inválido')));

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão terminou');
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('API recusando o token no histórico (403) também volta para o login', async () => {
    localStorage.setItem('token', tokenValido());
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 403, json: async () => ({}) }));

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
  });

  it('o botão Sair apaga o token e volta para o login', async () => {
    localStorage.setItem('token', tokenValido());
    render(<App />);
    const sair = await screen.findByRole('button', { name: 'Sair' });

    act(() => sair.click());

    await waitFor(() => expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument());
    expect(localStorage.getItem('token')).toBeNull();
    expect(socketFalso.disconnect).toHaveBeenCalled();
  });
});
