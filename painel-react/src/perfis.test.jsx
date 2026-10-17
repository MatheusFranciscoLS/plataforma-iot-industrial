// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const socketFalso = vi.hoisted(() => ({ on: vi.fn(), disconnect: vi.fn() }));
vi.mock('socket.io-client', () => ({ io: () => socketFalso }));
vi.mock('@/components/GraficoTemperatura', () => ({ default: () => null }));

import App from './App';
import GerenciarUsuarios from '@/components/GerenciarUsuarios';
import { buscarAlertas, reconhecerAlerta, SemPermissaoError, SessaoInvalidaError, buscarUsuarios } from '@/lib/api';
import { lerPerfil, lerUsuario } from '@/lib/token';

const tokenCom = (dados = {}) => `x.${btoa(JSON.stringify({ exp: Math.floor(Date.now() / 1000) + 3600, ...dados })).replace(/=+$/, '')}.y`;
const resposta = (status, corpo = {}) => ({ ok: status >= 200 && status < 300, status, json: async () => corpo });

afterEach(() => vi.unstubAllGlobals());

describe('token: usuário e perfil', () => {
  it('lê o nome e o perfil do token', () => {
    const token = tokenCom({ sub: 'maria', perfil: 'ADMIN' });
    expect(lerUsuario(token)).toBe('maria');
    expect(lerPerfil(token)).toBe('ADMIN');
    expect(lerPerfil(tokenCom({ perfil: 'OPERADOR' }))).toBe('OPERADOR');
  });

  it('sem perfil, perfil desconhecido ou token ilegível valem só como leitura', () => {
    expect(lerPerfil(tokenCom({ sub: 'antigo' }))).toBe('LEITURA');
    expect(lerPerfil(tokenCom({ perfil: 'SUPERUSUARIO' }))).toBe('LEITURA');
    expect(lerPerfil('lixo')).toBe('LEITURA');
    expect(lerUsuario('lixo')).toBeNull();
  });
});

describe('api: 401 e 403', () => {
  it('403 numa ação de escrita é falta de permissão e não derruba a sessão', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(403)));

    await expect(reconhecerAlerta('t', 1)).rejects.toBeInstanceOf(SemPermissaoError);
    await expect(buscarUsuarios('t')).rejects.toBeInstanceOf(SemPermissaoError);
  });

  it('401 sempre é sessão inválida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(401)));

    await expect(reconhecerAlerta('t', 1)).rejects.toBeInstanceOf(SessaoInvalidaError);
    await expect(buscarAlertas('t')).rejects.toBeInstanceOf(SessaoInvalidaError);
  });

  it('403 numa consulta comum continua valendo como sessão inválida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(403)));

    await expect(buscarAlertas('t')).rejects.toBeInstanceOf(SessaoInvalidaError);
  });
});

describe('o que cada perfil vê no painel', () => {
  beforeEach(() => {
    localStorage.clear();
    localStorage.setItem('idioma', 'pt');
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url) =>
        resposta(
          200,
          String(url).includes('/api/alertas?')
            ? [{ id: 1, idMaquina: 'MAQ-01', timestamp: 100, tipo: 'TEMPERATURA', valor: 99, limite: 95, reconhecidoPor: null }]
            : [],
        ),
      ),
    );
  });

  async function abrirComo(perfil) {
    localStorage.setItem('token', tokenCom({ sub: 'maria', ...(perfil && { perfil }) }));
    render(<App />);
    await screen.findByRole('heading', { name: 'Monitoramento da fábrica' });
    await screen.findByText('Temperatura acima de 95 °C'); // o alerta do servidor chegou
  }

  it('administrador vê o botão de usuários, o de limites e o de reconhecer', async () => {
    await abrirComo('ADMIN');

    expect(screen.getByText('Entrou como maria (Administrador)')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usuários' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limites de alerta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconhecer o alerta de MAQ-01/ })).toBeInTheDocument();
  });

  it('operador reconhece e troca limites, mas não vê os usuários', async () => {
    await abrirComo('OPERADOR');

    expect(screen.queryByRole('button', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limites de alerta' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Reconhecer o alerta de MAQ-01/ })).toBeInTheDocument();
  });

  it('somente leitura só olha: sem usuários, sem limites, sem reconhecer', async () => {
    await abrirComo('LEITURA');

    expect(screen.getByText('Entrou como maria (Somente leitura)')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Limites de alerta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reconhecer o alerta/ })).not.toBeInTheDocument();
  });

  it('token sem perfil se comporta como somente leitura', async () => {
    await abrirComo(null);

    expect(screen.queryByRole('button', { name: 'Usuários' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reconhecer o alerta/ })).not.toBeInTheDocument();
  });
});

describe('GerenciarUsuarios', () => {
  let usuariosDoServidor;
  let fetchFalso;

  // Um servidor falso simples: lista, cria (409 se repetido), troca perfil e senha, apaga.
  beforeEach(() => {
    localStorage.setItem('idioma', 'pt');
    usuariosDoServidor = [
      { nome: 'admin', perfil: 'ADMIN' },
      { nome: 'ana', perfil: 'LEITURA' },
    ];
    fetchFalso = vi.fn(async (url, opcoes = {}) => {
      const metodo = opcoes.method ?? 'GET';
      const caminho = String(url).replace(/^https?:\/\/[^/]+/, '');
      if (caminho === '/api/usuarios' && metodo === 'GET') return resposta(200, usuariosDoServidor);
      if (caminho === '/api/usuarios' && metodo === 'POST') {
        const dados = JSON.parse(opcoes.body);
        if (usuariosDoServidor.some((u) => u.nome === dados.nome)) return resposta(409);
        usuariosDoServidor = [...usuariosDoServidor, { nome: dados.nome, perfil: dados.perfil }];
        return resposta(201, { nome: dados.nome, perfil: dados.perfil });
      }
      const alvo = caminho.match(/^\/api\/usuarios\/([^/]+)(\/senha|\/perfil)?$/);
      if (alvo && metodo === 'DELETE') {
        usuariosDoServidor = usuariosDoServidor.filter((u) => u.nome !== alvo[1]);
        return resposta(204);
      }
      if (alvo && metodo === 'PUT') return resposta(alvo[2] === '/perfil' ? 200 : 204, { nome: alvo[1], perfil: JSON.parse(opcoes.body).perfil });
      return resposta(404);
    });
    vi.stubGlobal('fetch', fetchFalso);
  });

  const abrir = (extra = {}) => {
    const props = { token: 't', usuarioAtual: 'admin', aoFechar: vi.fn(), onSessaoInvalida: vi.fn(), ...extra };
    render(<GerenciarUsuarios {...props} />);
    return props;
  };

  const chamadas = (metodo) => fetchFalso.mock.calls.filter(([, o]) => (o?.method ?? 'GET') === metodo);

  it('lista os usuários com o perfil e marca quem é você', async () => {
    abrir();

    const lista = await screen.findByRole('list');
    const itens = within(lista).getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('admin');
    expect(itens[0]).toHaveTextContent('(você)');
    expect(within(itens[1]).getByRole('combobox', { name: 'Perfil de ana' })).toHaveValue('LEITURA');
  });

  it('não deixa trocar o próprio perfil nem apagar o próprio usuário', async () => {
    abrir();
    await screen.findByRole('list');

    expect(screen.getByRole('combobox', { name: 'Perfil de admin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apagar admin' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apagar ana' })).toBeEnabled();
  });

  it('cria um usuário e ele aparece na lista', async () => {
    abrir();
    await screen.findByRole('list');
    const usuario = userEvent.setup();

    await usuario.type(screen.getByLabelText('Nome'), 'bruno');
    await usuario.type(screen.getByLabelText('Senha'), 'senha-boa-123');
    await usuario.selectOptions(screen.getByLabelText('Perfil'), 'OPERADOR');
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Usuário bruno criado.'));
    expect(JSON.parse(chamadas('POST')[0][1].body)).toEqual({ nome: 'bruno', senha: 'senha-boa-123', perfil: 'OPERADOR' });
    expect(await screen.findByRole('combobox', { name: 'Perfil de bruno' })).toHaveValue('OPERADOR');
    expect(screen.getByLabelText('Nome')).toHaveValue('');
    expect(screen.getByLabelText('Senha')).toHaveValue('');
  });

  it('nome repetido mostra o aviso em vez de criar', async () => {
    abrir();
    await screen.findByRole('list');
    const usuario = userEvent.setup();

    await usuario.type(screen.getByLabelText('Nome'), 'ana');
    await usuario.type(screen.getByLabelText('Senha'), 'senha-boa-123');
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Já existe um usuário com esse nome.');
  });

  it('troca o perfil de um usuário', async () => {
    abrir();
    await screen.findByRole('list');

    await userEvent.setup().selectOptions(screen.getByRole('combobox', { name: 'Perfil de ana' }), 'OPERADOR');

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Perfil de ana trocado.'));
    const [url, opcoes] = chamadas('PUT')[0];
    expect(String(url)).toContain('/api/usuarios/ana/perfil');
    expect(JSON.parse(opcoes.body)).toEqual({ perfil: 'OPERADOR' });
  });

  it('troca a senha de um usuário', async () => {
    abrir();
    await screen.findByRole('list');
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole('button', { name: 'Trocar a senha de ana' }));
    await usuario.type(screen.getByLabelText('Nova senha'), 'outra-senha-123');
    await usuario.click(screen.getByRole('button', { name: 'Salvar senha' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Senha de ana trocada.'));
    const [url, opcoes] = chamadas('PUT')[0];
    expect(String(url)).toContain('/api/usuarios/ana/senha');
    expect(JSON.parse(opcoes.body)).toEqual({ senha: 'outra-senha-123' });
    expect(screen.queryByLabelText('Nova senha')).not.toBeInTheDocument();
  });

  it('apagar pede confirmação antes de chamar a API', async () => {
    abrir();
    await screen.findByRole('list');
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole('button', { name: 'Apagar ana' }));
    expect(screen.getByText('Apagar ana para sempre?')).toBeInTheDocument();
    expect(chamadas('DELETE')).toHaveLength(0);

    await usuario.click(screen.getByRole('button', { name: 'Sim, apagar' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Usuário ana apagado.'));
    expect(String(chamadas('DELETE')[0][0])).toContain('/api/usuarios/ana');
    await waitFor(() => expect(screen.queryByRole('combobox', { name: 'Perfil de ana' })).not.toBeInTheDocument());
  });

  it('cancelar a confirmação não apaga nada', async () => {
    abrir();
    await screen.findByRole('list');
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole('button', { name: 'Apagar ana' }));
    await usuario.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(screen.queryByText('Apagar ana para sempre?')).not.toBeInTheDocument();
    expect(chamadas('DELETE')).toHaveLength(0);
  });

  it('sem permissão (403), avisa que só administradores podem', async () => {
    fetchFalso.mockImplementation(async () => resposta(403));
    abrir();

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar os usuários.');
  });

  it('sessão vencida (401) avisa a tela', async () => {
    fetchFalso.mockImplementation(async () => resposta(401));
    const { onSessaoInvalida } = abrir();

    await waitFor(() => expect(onSessaoInvalida).toHaveBeenCalled());
  });

  it('usuários protegidos (site de demonstração) aparecem travados: sem trocar perfil, senha nem apagar', async () => {
    usuariosDoServidor = [
      { nome: 'admin', perfil: 'ADMIN', protegido: true },
      { nome: 'demo', perfil: 'OPERADOR', protegido: true },
      { nome: 'visitante', perfil: 'LEITURA', protegido: false },
    ];
    abrir({ usuarioAtual: 'outro' });
    await screen.findByRole('list');

    expect(screen.getAllByText('(protegido)')).toHaveLength(2);
    expect(screen.getByRole('combobox', { name: 'Perfil de demo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Trocar a senha de demo' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Apagar demo' })).toBeDisabled();
    expect(screen.getByRole('combobox', { name: 'Perfil de visitante' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Apagar visitante' })).toBeEnabled();
  });

  it('423 do servidor vira o aviso do site de demonstração', async () => {
    fetchFalso.mockImplementation(async (url, opcoes = {}) =>
      (opcoes.method ?? 'GET') === 'GET' ? resposta(200, usuariosDoServidor) : resposta(423),
    );
    abrir();
    await screen.findByRole('list');
    const usuario = userEvent.setup();

    await usuario.type(screen.getByLabelText('Nome'), 'novo-admin');
    await usuario.type(screen.getByLabelText('Senha'), 'senha-boa-123');
    await usuario.selectOptions(screen.getByLabelText('Perfil'), 'ADMIN');
    await usuario.click(screen.getByRole('button', { name: 'Criar usuário' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não permitido no site de demonstração');
  });
});
