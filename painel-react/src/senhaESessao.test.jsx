// @vitest-environment jsdom
import { render, renderHook, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socketFalso = vi.hoisted(() => ({ on: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: () => socketFalso }));
vi.mock('@/components/GraficoTemperatura', () => ({ default: () => null }));

import App from './App';
import TrocarMinhaSenha from '@/components/TrocarMinhaSenha';
import { useRenovacaoDoToken } from '@/hooks/useRenovacaoDoToken';
import { renovarToken, trocarMinhaSenha } from '@/lib/api';

const tokenCom = (dados, segundosAteVencer = 3600) =>
  `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + segundosAteVencer, ...dados })).replace(/=+$/, '')}.y`;
const resposta = (status, corpo = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo, headers: { get: () => null } });

afterEach(() => vi.unstubAllGlobals());

describe('lib/api: senha e renovação', () => {
  it('trocar a senha manda a atual e a nova por PUT', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(204));
    vi.stubGlobal('fetch', fetchFalso);

    await trocarMinhaSenha('t', 'antiga-123', 'nova-12345');

    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(String(url)).toContain('/api/auth/senha');
    expect(opcoes.method).toBe('PUT');
    expect(JSON.parse(opcoes.body)).toEqual({ senhaAtual: 'antiga-123', novaSenha: 'nova-12345' });
  });

  it('senha atual errada vira erro com status 400', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(400)));

    await expect(trocarMinhaSenha('t', 'errada', 'nova-12345')).rejects.toMatchObject({ status: 400 });
  });

  it('renovar devolve o token novo', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(200, { token: 'novo.token.aqui' }));
    vi.stubGlobal('fetch', fetchFalso);

    expect(await renovarToken('velho')).toBe('novo.token.aqui');
    expect(String(fetchFalso.mock.calls[0][0])).toContain('/api/auth/renovar');
    expect(fetchFalso.mock.calls[0][1].method).toBe('POST');
  });
});

describe('useRenovacaoDoToken', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, { token: 'token.novo.x' })));
  });

  it('token com muito tempo pela frente não é renovado', async () => {
    const aoRenovar = vi.fn();

    renderHook(() => useRenovacaoDoToken(tokenCom({}, 3600), aoRenovar));
    await new Promise((r) => setTimeout(r, 30));

    expect(fetch).not.toHaveBeenCalled();
    expect(aoRenovar).not.toHaveBeenCalled();
  });

  it('com menos de 15 minutos para vencer, pede um token novo e entrega a quem chamou', async () => {
    const aoRenovar = vi.fn();

    renderHook(() => useRenovacaoDoToken(tokenCom({}, 600), aoRenovar));

    await waitFor(() => expect(aoRenovar).toHaveBeenCalledWith('token.novo.x'));
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('se a API recusar, não faz nada e não dá erro (o token atual vale até vencer)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(401)));
    const aoRenovar = vi.fn();

    renderHook(() => useRenovacaoDoToken(tokenCom({}, 600), aoRenovar));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 30));

    expect(aoRenovar).not.toHaveBeenCalled();
  });

  it('sem token não faz nada', async () => {
    renderHook(() => useRenovacaoDoToken(null, vi.fn()));
    await new Promise((r) => setTimeout(r, 30));

    expect(fetch).not.toHaveBeenCalled();
  });
});

describe('TrocarMinhaSenha', () => {
  beforeEach(() => {
    localStorage.setItem('idioma', 'pt');
  });

  const abrir = () => {
    const props = { token: 't', aoFechar: vi.fn(), onSessaoInvalida: vi.fn() };
    render(<TrocarMinhaSenha {...props} />);
    return props;
  };

  async function preencher(atual, nova, repetida) {
    const usuario = userEvent.setup();
    await usuario.type(screen.getByLabelText('Senha atual'), atual);
    await usuario.type(screen.getByLabelText('Nova senha'), nova);
    await usuario.type(screen.getByLabelText('Repita a nova senha'), repetida);
    await usuario.click(screen.getByRole('button', { name: 'Trocar senha' }));
  }

  it('troca a senha, avisa e limpa os campos', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(204));
    vi.stubGlobal('fetch', fetchFalso);
    abrir();

    await preencher('antiga-123', 'nova-12345', 'nova-12345');

    expect(await screen.findByRole('status')).toHaveTextContent('Senha trocada.');
    expect(JSON.parse(fetchFalso.mock.calls[0][1].body)).toEqual({ senhaAtual: 'antiga-123', novaSenha: 'nova-12345' });
    expect(screen.getByLabelText('Nova senha')).toHaveValue('');
  });

  it('botão só habilita com os três campos preenchidos', async () => {
    abrir();
    expect(screen.getByRole('button', { name: 'Trocar senha' })).toBeDisabled();

    await userEvent.setup().type(screen.getByLabelText('Senha atual'), 'x');
    expect(screen.getByRole('button', { name: 'Trocar senha' })).toBeDisabled();
  });

  it('senha nova curta ou diferente da repetição nem chega na API', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    abrir();

    await preencher('antiga-123', 'curta', 'curta');
    expect(await screen.findByRole('alert')).toHaveTextContent('8 a 72 caracteres');

    await userEvent.setup().clear(screen.getByLabelText('Nova senha'));
    await userEvent.setup().clear(screen.getByLabelText('Repita a nova senha'));
    await userEvent.setup().type(screen.getByLabelText('Nova senha'), 'nova-12345');
    await userEvent.setup().type(screen.getByLabelText('Repita a nova senha'), 'nova-54321');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Trocar senha' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('não são iguais');

    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it.each([
    [400, 'A senha atual está incorreta.'],
    [423, 'protegida no site de demonstração'],
    [429, 'Muitas tentativas'],
    [500, 'Não foi possível trocar a senha agora'],
  ])('resposta %i da API vira um aviso claro', async (status, texto) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(status)));
    abrir();

    await preencher('antiga-123', 'nova-12345', 'nova-12345');

    expect(await screen.findByRole('alert')).toHaveTextContent(texto);
  });

  it('sessão vencida (401) avisa o app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(401)));
    const { onSessaoInvalida } = abrir();

    await preencher('antiga-123', 'nova-12345', 'nova-12345');

    await waitFor(() => expect(onSessaoInvalida).toHaveBeenCalled());
  });
});

describe('no painel', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('idioma', 'pt');
  });

  it('todo usuário logado tem o botão de trocar a própria senha, e ele abre a janela', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(200, [])));
    localStorage.setItem('token', tokenCom({ sub: 'ana', perfil: 'LEITURA' }));
    render(<App />);
    await screen.findByRole('heading', { name: 'Monitoramento da fábrica' });

    await userEvent.setup().click(screen.getByRole('button', { name: 'Trocar minha senha' }));

    expect(await screen.findByRole('dialog', { name: 'Trocar minha senha' })).toBeInTheDocument();
  });

  it('token perto de vencer é trocado sozinho e a tela continua no painel', async () => {
    const fetchFalso = vi.fn(async (url) => (String(url).includes('/api/auth/renovar') ? resposta(200, { token: tokenCom({ sub: 'ana', perfil: 'LEITURA' }, 7200) }) : resposta(200, [])));
    vi.stubGlobal('fetch', fetchFalso);
    const antigo = tokenCom({ sub: 'ana', perfil: 'LEITURA' }, 300);
    localStorage.setItem('token', antigo);
    render(<App />);

    await waitFor(() => expect(localStorage.getItem('token')).not.toBe(antigo));
    expect(screen.getByRole('heading', { name: 'Monitoramento da fábrica' })).toBeInTheDocument();
  });
});
