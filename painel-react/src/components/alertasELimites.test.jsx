// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import AlertasRecentes from './AlertasRecentes';
import LimitesDeAlerta from './LimitesDeAlerta';
import LinhaMaquina from './LinhaMaquina';
import { buscarAlertas } from '@/lib/api';
import { avaliarMaquina, limitesDaMaquina, LIMITES_PADRAO } from '@/lib/limites';
import { resumirLeituras } from '@/lib/estatisticas';

afterEach(() => vi.unstubAllGlobals());

const alerta = (extra = {}) => ({ id: 1, idMaquina: 'MAQ-01', timestamp: 100, tipo: 'TEMPERATURA', valor: 99, limite: 95, ...extra });

describe('limites por máquina (funções)', () => {
  const tabela = {
    padrao: { TEMPERATURA: 95, VIBRACAO: 5 },
    maquinas: [{ idMaquina: 'MAQ-02', tipo: 'TEMPERATURA', limite: 80 }],
  };

  it('a máquina com limite próprio usa o dela; as outras usam o padrão', () => {
    expect(limitesDaMaquina(tabela, 'MAQ-02')).toEqual({ temperatura: 80, vibracao: 5 });
    expect(limitesDaMaquina(tabela, 'MAQ-01')).toEqual({ temperatura: 95, vibracao: 5 });
  });

  it('sem resposta da API ou com resposta fora do formato, valem os limites do painel', () => {
    expect(limitesDaMaquina(null, 'MAQ-01')).toEqual(LIMITES_PADRAO);
    expect(limitesDaMaquina([], 'MAQ-01')).toEqual(LIMITES_PADRAO);
  });

  it('a mesma leitura é crítica com um limite mais baixo e normal com o padrão', () => {
    const dado = { temperaturaMotor: 85, vibracao: 1, rpm: 1500, recebidoEm: 1000 };
    expect(avaliarMaquina(dado, 1000).estado).toBe('normal');
    const critica = avaliarMaquina(dado, 1000, undefined, { temperatura: 80, vibracao: 5 });
    expect(critica.estado).toBe('critica');
    expect(critica.motivos).toEqual(['Temperatura acima de 80 °C']);
  });

  it('o resumo das leituras conta o que passou do limite da máquina', () => {
    const leituras = [
      { timestamp: 1, temperaturaMotor: 85, vibracao: 1, rpm: 1500 },
      { timestamp: 2, temperaturaMotor: 70, vibracao: 1, rpm: 1500 },
    ];
    expect(resumirLeituras(leituras).acimaDoLimite.quantidade).toBe(0);
    expect(resumirLeituras(leituras, { temperatura: 80, vibracao: 5 }).acimaDoLimite.quantidade).toBe(1);
  });
});

describe('cartão da máquina com limite próprio', () => {
  it('usa o limite da máquina para pintar o valor e explicar o motivo', () => {
    const dado = { idMaquina: 'MAQ-01', timestamp: 100, temperaturaMotor: 85, vibracao: 1, rpm: 1500, recebidoEm: 1000 };
    const limites = { temperatura: 80, vibracao: 5 };
    render(<LinhaMaquina nome="MAQ-01" dado={dado} avaliacao={avaliarMaquina(dado, 1000, undefined, limites)} agora={1000} serie={[80, 85]} limites={limites} />);

    expect(screen.getByRole('article', { name: 'MAQ-01: Crítica' })).toBeInTheDocument();
    expect(screen.getByText('Temperatura acima de 80 °C')).toBeInTheDocument();
  });
});

describe('buscarAlertas', () => {
  it('manda os filtros escolhidos na consulta', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetchFalso);

    await buscarAlertas('t', 50, { maquina: 'MAQ-02', tipo: 'VIBRACAO', reconhecido: false });

    const url = String(fetchFalso.mock.calls[0][0]);
    expect(url).toContain('limite=50');
    expect(url).toContain('maquina=MAQ-02');
    expect(url).toContain('tipo=VIBRACAO');
    expect(url).toContain('reconhecido=false');
  });

  it('sem filtros, só pede o limite', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => [] });
    vi.stubGlobal('fetch', fetchFalso);

    await buscarAlertas('t');

    expect(String(fetchFalso.mock.calls[0][0])).toMatch(/\/api\/alertas\?limite=20$/);
  });
});

describe('AlertasRecentes: reconhecer e filtrar', () => {
  it('alerta sem reconhecimento tem o botão e o aviso de quantos faltam', async () => {
    const onReconhecer = vi.fn();
    render(<AlertasRecentes alertas={[alerta({ id: 7 })]} erro={false} pendentes={3} onReconhecer={onReconhecer} />);

    expect(screen.getByText('3 sem reconhecer')).toBeInTheDocument();
    await userEvent.setup().click(screen.getByRole('button', { name: /Reconhecer o alerta de MAQ-01/ }));
    expect(onReconhecer).toHaveBeenCalledWith(7);
  });

  it('alerta reconhecido mostra quem viu e não tem mais o botão', () => {
    render(<AlertasRecentes alertas={[alerta({ reconhecidoPor: 'maria' })]} erro={false} pendentes={0} onReconhecer={vi.fn()} />);

    expect(screen.getByText('Reconhecido por maria')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Reconhecer o alerta/ })).not.toBeInTheDocument();
    expect(screen.queryByText(/sem reconhecer/)).not.toBeInTheDocument();
  });

  it('sem a contagem da API, conta os não reconhecidos da própria lista', () => {
    render(<AlertasRecentes alertas={[alerta({ id: 1 }), alerta({ id: 2 }), alerta({ id: 3, reconhecidoPor: 'maria' })]} erro={false} />);

    expect(screen.getByText('2 sem reconhecer')).toBeInTheDocument();
  });

  it('os filtros avisam a tela do que foi escolhido', async () => {
    const onFiltros = vi.fn();
    render(<AlertasRecentes alertas={[]} erro={false} filtros={{}} onFiltros={onFiltros} />);
    const usuario = userEvent.setup();

    await usuario.selectOptions(screen.getByLabelText('Máquina'), 'MAQ-02');
    expect(onFiltros).toHaveBeenLastCalledWith({ maquina: 'MAQ-02' });

    await usuario.selectOptions(screen.getByLabelText('Tipo'), 'VIBRACAO');
    expect(onFiltros).toHaveBeenLastCalledWith({ tipo: 'VIBRACAO' });

    await usuario.selectOptions(screen.getByLabelText('Situação'), 'Sem reconhecer');
    expect(onFiltros).toHaveBeenLastCalledWith({ reconhecido: false });
  });

  it('com filtro ativo e nada na lista, a mensagem fala dos filtros', () => {
    render(<AlertasRecentes alertas={[]} erro={false} filtros={{ maquina: 'MAQ-03' }} onFiltros={vi.fn()} />);

    expect(screen.getByText('Nenhum alerta com esses filtros.')).toBeInTheDocument();
  });

  it('falha ao reconhecer é avisada', () => {
    render(<AlertasRecentes alertas={[alerta()]} erro={false} erroAoReconhecer onReconhecer={vi.fn()} />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível reconhecer o alerta');
  });
});

describe('LimitesDeAlerta', () => {
  const padrao = { temperatura: 95, vibracao: 5 };
  const limitesDe = (maquina) => (maquina === 'MAQ-02' ? { temperatura: 80, vibracao: 5 } : padrao);

  function abrir(extra = {}) {
    const props = { token: 't', limitesDe, padrao, aoSalvar: vi.fn(), aoFechar: vi.fn(), onSessaoInvalida: vi.fn(), ...extra };
    render(<LimitesDeAlerta {...props} />);
    return props;
  }

  const campo = (maquina, chave) => screen.getByLabelText(chave === 'temperatura' ? 'Temperatura (°C)' : 'Vibração (mm/s)', { selector: `#limite-${maquina}-${chave}` });

  it('mostra o limite que vale para cada máquina', () => {
    abrir();

    expect(campo('MAQ-01', 'temperatura')).toHaveValue(95);
    expect(campo('MAQ-02', 'temperatura')).toHaveValue(80);
    expect(campo('MAQ-03', 'vibracao')).toHaveValue(5);
  });

  it('salva só o que mudou, com PUT para a máquina certa', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchFalso);
    const { aoSalvar } = abrir();
    const usuario = userEvent.setup();

    await usuario.clear(campo('MAQ-03', 'temperatura'));
    await usuario.type(campo('MAQ-03', 'temperatura'), '90');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Limites salvos.'));
    expect(fetchFalso).toHaveBeenCalledTimes(1);
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(String(url)).toContain('/api/limites/MAQ-03/TEMPERATURA');
    expect(opcoes.method).toBe('PUT');
    expect(JSON.parse(opcoes.body)).toEqual({ limite: 90 });
    expect(aoSalvar).toHaveBeenCalled();
  });

  it('voltar ao padrão e salvar apaga o limite próprio (DELETE)', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal('fetch', fetchFalso);
    abrir();
    const usuario = userEvent.setup();

    await usuario.click(screen.getByRole('button', { name: 'Voltar MAQ-02 ao limite padrão' }));
    expect(campo('MAQ-02', 'temperatura')).toHaveValue(95);
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Limites salvos.'));
    const [url, opcoes] = fetchFalso.mock.calls[0];
    expect(String(url)).toContain('/api/limites/MAQ-02/TEMPERATURA');
    expect(opcoes.method).toBe('DELETE');
  });

  it('sem mudança, não chama a API', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    abrir();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Salvar' }));

    expect(screen.getByRole('status')).toHaveTextContent('Nenhum limite foi alterado.');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('valor vazio, zero ou negativo é recusado sem chamar a API', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);
    abrir();
    const usuario = userEvent.setup();

    await usuario.clear(campo('MAQ-01', 'vibracao'));
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use só números maiores que zero.');

    await usuario.type(campo('MAQ-01', 'vibracao'), '-2');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Use só números maiores que zero.');
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('falha da API avisa e sessão vencida chama onSessaoInvalida', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    abrir();
    const usuario = userEvent.setup();
    await usuario.clear(campo('MAQ-01', 'temperatura'));
    await usuario.type(campo('MAQ-01', 'temperatura'), '90');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível salvar os limites'));
  });

  it('sessão vencida (401) avisa a tela', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    const { onSessaoInvalida } = abrir();
    const usuario = userEvent.setup();
    await usuario.clear(campo('MAQ-01', 'temperatura'));
    await usuario.type(campo('MAQ-01', 'temperatura'), '90');
    await usuario.click(screen.getByRole('button', { name: 'Salvar' }));
    await waitFor(() => expect(onSessaoInvalida).toHaveBeenCalled());
  });

  it('a descrição diz qual é o limite padrão', () => {
    abrir();

    expect(within(screen.getByRole('dialog')).getByText(/Padrão: 95 °C e 5,0 mm\/s/)).toBeInTheDocument();
  });
});
