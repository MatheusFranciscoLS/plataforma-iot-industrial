// @vitest-environment jsdom
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('socket.io-client', () => ({ io: () => ({ on: vi.fn(), disconnect: vi.fn() }) }));
vi.mock('@/components/GraficoTemperatura', () => ({ default: () => null }));

import App from './App';
import Login from '@/components/Login';
import { useAlertas } from '@/hooks/useAlertas';
import { aquecerServidores } from '@/lib/api';

afterEach(() => vi.unstubAllGlobals());

describe('aquecerServidores', () => {
  it('chama a saúde da API e a do gateway sem esperar resposta', () => {
    const fetchFalso = vi.fn().mockResolvedValue({});
    vi.stubGlobal('fetch', fetchFalso);

    aquecerServidores();

    const urls = fetchFalso.mock.calls.map(([url]) => String(url));
    expect(urls.some((u) => u.endsWith('/actuator/health'))).toBe(true);
    expect(urls.some((u) => u.endsWith('/saude'))).toBe(true);
    expect(fetchFalso.mock.calls.every(([, opcoes]) => opcoes.mode === 'no-cors')).toBe(true);
  });

  it('erro de rede, servidor fora do ar ou fetch que falha na hora não quebram nada', () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    expect(() => aquecerServidores()).not.toThrow();

    vi.stubGlobal('fetch', vi.fn(() => {
      throw new Error('sem fetch');
    }));
    expect(() => aquecerServidores()).not.toThrow();
  });
});

describe('useAlertas: consulta a API com economia', () => {
  it('busca a lista a cada rodada e a contagem de pendentes só a cada 3ª', async () => {
    const fetchFalso = vi.fn(async (url) => ({ ok: true, status: 200, json: async () => (String(url).includes('/pendentes') ? { quantidade: 4 } : []) }));
    vi.stubGlobal('fetch', fetchFalso);
    const contagens = () => fetchFalso.mock.calls.filter(([url]) => String(url).includes('/pendentes')).length;
    const listas = () => fetchFalso.mock.calls.filter(([url]) => String(url).includes('/api/alertas?')).length;

    // Intervalo curto só para o teste não esperar 5 s por rodada.
    const aoInvalidar = vi.fn(); // a mesma função a cada render, como no painel (um callback estável)
    const { result, unmount } = renderHook(() => useAlertas('t', aoInvalidar, { intervaloMs: 30 }));

    await vi.waitFor(() => expect(listas()).toBeGreaterThanOrEqual(7));
    unmount();

    expect(contagens()).toBe(Math.ceil(listas() / 3)); // a contagem vem na 1ª rodada e a cada 3ª (1ª, 4ª, 7ª...)
    expect(contagens()).toBeLessThan(listas());
    expect(result.current.pendentes).toBe(4); // entre uma contagem e outra, o último valor continua na tela
  });
});

describe('quando acordar os servidores', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('idioma', 'pt');
  });

  it('a tela de login já acorda os servidores ao abrir, antes de qualquer clique', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({});
    vi.stubGlobal('fetch', fetchFalso);

    render(<Login aviso="" onEntrar={vi.fn()} />);

    await waitFor(() => expect(fetchFalso).toHaveBeenCalledTimes(2));
    expect(screen.getByRole('button', { name: 'Ver o painel de demonstração' })).toBeEnabled();
  });

  it('quem já está logado não acorda de novo (o painel já está falando com a API)', async () => {
    localStorage.setItem('token', `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600 })).replace(/=+$/, '')}.y`);
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetchFalso);

    render(<App />);
    await screen.findByRole('heading', { name: 'Monitoramento da fábrica' });

    expect(fetchFalso.mock.calls.some(([url]) => String(url).endsWith('/saude'))).toBe(false);
  });
});
