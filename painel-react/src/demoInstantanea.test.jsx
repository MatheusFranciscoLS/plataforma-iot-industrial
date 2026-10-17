// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socketFalso = vi.hoisted(() => {
  const falso = { ouvintes: {}, disconnect: vi.fn() };
  falso.on = (evento, funcao) => {
    falso.ouvintes[evento] = funcao;
  };
  return falso;
});
vi.mock('socket.io-client', () => ({ io: () => socketFalso }));

// O gráfico (Recharts) precisa de medidas reais de tela, que o jsdom não tem.
vi.mock('@/components/GraficoTemperatura', () => ({ default: () => <p>gráfico</p> }));

import App from './App';
import { criarMaquina, gerarHistorico, proximaLeitura } from '@/lib/simulacaoLocal';
import { LIMITES_PADRAO, MAQUINAS } from '@/lib/limites';

// Um token de demonstração válido por uma hora (só o corpo importa: o painel lê o perfil e a expiração).
const tokenDaDemo = () => {
  const corpo = btoa(JSON.stringify({ sub: 'demo', perfil: 'OPERADOR', exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=+$/, '');
  return `x.${corpo}.y`;
};

const resposta = (corpo) => ({ ok: true, status: 200, json: async () => corpo });

beforeEach(() => {
  localStorage.clear();
  localStorage.setItem('idioma', 'pt');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('simulação local', () => {
  it('uma máquina sem falha varia pouco em volta do valor normal', () => {
    let estado = criarMaquina('MAQ-01');
    const sorteio = () => 0.9; // nunca sorteia falha e o ruído fica sempre no mesmo lado
    for (let i = 0; i < 50; i += 1) {
      const { estado: novo, leitura } = proximaLeitura('MAQ-01', estado, 1000 + i * 2, sorteio);
      estado = novo;
      expect(leitura.temperaturaMotor).toBeLessThan(LIMITES_PADRAO.temperatura);
      expect(leitura.vibracao).toBeLessThan(LIMITES_PADRAO.vibracao);
    }
  });

  it('um episódio de falha leva a máquina acima dos limites e depois ela volta ao normal', () => {
    // A primeira chamada sorteia a falha (0 < chance) e a duração; as demais não sorteiam falha.
    const valores = [0, 0.5];
    const sorteio = () => (valores.length > 0 ? valores.shift() : 0.9);
    let estado = criarMaquina('MAQ-03');
    const leituras = [];
    for (let i = 0; i < 80; i += 1) {
      const { estado: novo, leitura } = proximaLeitura('MAQ-03', estado, 1000 + i * 2, sorteio);
      estado = novo;
      leituras.push(leitura);
    }

    expect(Math.max(...leituras.map((l) => l.temperaturaMotor))).toBeGreaterThan(LIMITES_PADRAO.temperatura);
    expect(Math.max(...leituras.map((l) => l.vibracao))).toBeGreaterThan(LIMITES_PADRAO.vibracao);
    expect(leituras.at(-1).temperaturaMotor).toBeLessThan(LIMITES_PADRAO.temperatura);
  });

  it('o histórico inicial traz leituras das três máquinas, em ordem e com ids únicos', () => {
    const { leituras } = gerarHistorico(5000, 30);

    expect(leituras).toHaveLength(30 * MAQUINAS.length);
    expect(new Set(leituras.map((l) => l.id)).size).toBe(leituras.length);
    expect(leituras.at(-1).timestamp).toBe(5000);
    expect(leituras[0].timestamp).toBe(5000 - 29 * 2);
  });
});

describe('demonstração instantânea', () => {
  it('ao clicar, mostra na hora as três máquinas simuladas, avisa e troca pelo painel real quando o login responde', async () => {
    let responderLogin;
    vi.stubGlobal(
      'fetch',
      vi.fn((url) => (String(url).includes('/api/auth/login') ? new Promise((ok) => { responderLogin = () => ok(resposta({ token: tokenDaDemo() })); }) : Promise.resolve(resposta([])))),
    );
    render(<App />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver o painel de demonstração' }));

    expect(await screen.findByRole('heading', { name: 'Monitoramento da fábrica' })).toBeInTheDocument();
    for (const nome of MAQUINAS) expect(screen.getByRole('article', { name: new RegExp(`^${nome}:`) })).toBeInTheDocument();
    expect(screen.getByText('Simulação no navegador')).toBeInTheDocument();
    expect(screen.getByText(/simulação feita no seu navegador/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver detalhes de MAQ-01' })).not.toBeInTheDocument();

    act(() => responderLogin());

    await waitFor(() => expect(screen.queryByText(/simulação feita no seu navegador/)).not.toBeInTheDocument());
    expect(screen.queryByText('Simulação no navegador')).not.toBeInTheDocument();
    expect(await screen.findByRole('button', { name: 'Ver detalhes de MAQ-01' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).not.toBeNull();
  });

  it('se o login falhar, volta para a tela de entrada com o erro e deixa tentar de novo', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    render(<App />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver o painel de demonstração' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor');
    expect(screen.getByRole('button', { name: 'Ver o painel de demonstração' })).toBeEnabled();
    expect(screen.queryByText('Simulação no navegador')).not.toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('quem sai da simulação não é levado ao painel quando o login chega depois', async () => {
    let responderLogin;
    vi.stubGlobal(
      'fetch',
      vi.fn((url) => (String(url).includes('/api/auth/login') ? new Promise((ok) => { responderLogin = () => ok(resposta({ token: tokenDaDemo() })); }) : Promise.resolve(resposta([])))),
    );
    render(<App />);
    const usuario = userEvent.setup();
    await usuario.click(screen.getByRole('button', { name: 'Ver o painel de demonstração' }));
    await screen.findByText('Simulação no navegador');

    await usuario.click(screen.getByRole('button', { name: 'Sair' }));
    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();

    await act(async () => responderLogin());

    expect(screen.getByRole('heading', { name: 'Entrar' })).toBeInTheDocument();
    expect(localStorage.getItem('token')).toBeNull();
  });

  it('as leituras simuladas continuam chegando enquanto a tela espera', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // o servidor nunca responde
      render(<App />);
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Ver o painel de demonstração' }));
      const temperatura = screen.getByRole('meter', { name: 'Temperatura de MAQ-01' });
      const inicial = temperatura.getAttribute('aria-valuenow');

      await act(async () => {
        await vi.advanceTimersByTimeAsync(20000);
      });

      expect(screen.getByRole('meter', { name: 'Temperatura de MAQ-01' }).getAttribute('aria-valuenow')).not.toBe(inicial);
    } finally {
      vi.useRealTimers();
    }
  });
});
