// @vitest-environment jsdom
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import Login from './Login';
import { ACESSO_DEMO } from '@/lib/demo';
import LinhaMaquina from './LinhaMaquina';
import ResumoFabrica from './ResumoFabrica';
import ControlesDoGrafico from './ControlesDoGrafico';
import AlertasRecentes from './AlertasRecentes';
import DetalheDaMaquina from './DetalheDaMaquina';
import { METRICAS } from '@/lib/metricas';
import { avaliarMaquina, resumirFabrica } from '@/lib/limites';

const AGORA = 1_000_000;

const leitura = (extra = {}) => ({
  idMaquina: 'MAQ-01',
  timestamp: 100,
  temperaturaMotor: 80.5,
  vibracao: 2.25,
  rpm: 1800,
  recebidoEm: AGORA,
  ...extra,
});

function linha(dado, agora = AGORA) {
  return render(
    <LinhaMaquina nome="MAQ-01" dado={dado} avaliacao={avaliarMaquina(dado, agora)} agora={agora} serie={[70, 75, 80]} />,
  );
}

describe('LinhaMaquina', () => {
  it('máquina normal mostra os valores com vírgula e o estado Normal', () => {
    linha(leitura());

    expect(screen.getByRole('heading', { name: 'MAQ-01' })).toBeInTheDocument();
    expect(screen.getByText('Normal')).toBeInTheDocument();
    expect(screen.getByText('80,5')).toBeInTheDocument();
    expect(screen.getByText('2,25')).toBeInTheDocument();
    expect(screen.getByText('1.800')).toBeInTheDocument();
    expect(screen.queryByText(/acima de/)).not.toBeInTheDocument();
  });

  it('máquina crítica mostra o estado e o motivo de cada limite ultrapassado', () => {
    linha(leitura({ temperaturaMotor: 99, vibracao: 5.5 }));

    expect(screen.getByText('Crítica')).toBeInTheDocument();
    expect(screen.getByText('Temperatura acima de 95 °C')).toBeInTheDocument();
    expect(screen.getByText('Vibração acima de 5,0 mm/s')).toBeInTheDocument();
    expect(screen.getByRole('article', { name: 'MAQ-01: Crítica' })).toBeInTheDocument();
  });

  it('leitura antiga vira "Sem sinal" e diz há quanto tempo foi a última', () => {
    linha(leitura(), AGORA + 20_000);

    expect(screen.getByText('Sem sinal')).toBeInTheDocument();
    expect(screen.getByText(/há 20 s/)).toBeInTheDocument();
  });

  it('sem nenhuma leitura mostra que está aguardando', () => {
    linha(undefined);

    expect(screen.getByText('Aguardando leitura')).toBeInTheDocument();
    expect(screen.getByText(/primeira leitura/)).toBeInTheDocument();
  });

  it('os medidores têm nome e valor para leitores de tela', () => {
    linha(leitura());

    expect(screen.getByRole('meter', { name: 'Temperatura de MAQ-01' })).toHaveAttribute('aria-valuenow', '80.5');
    expect(screen.getByRole('meter', { name: 'Vibração de MAQ-01' })).toBeInTheDocument();
  });
});

describe('ResumoFabrica', () => {
  const estados = (...lista) => lista.map((estado) => ({ estado, motivos: [] }));

  it('tudo normal diz quantas máquinas são monitoradas', () => {
    render(<ResumoFabrica resumo={resumirFabrica(estados('normal', 'normal', 'normal'))} maquinasAfetadas={[]} total={3} />);

    expect(screen.getByRole('status', { name: 'Resumo da fábrica' })).toHaveTextContent('Tudo normal');
    expect(screen.getByRole('status', { name: 'Resumo da fábrica' })).toHaveTextContent('3 máquinas monitoradas');
  });

  it('máquina crítica aparece no resumo com o nome dela', () => {
    render(<ResumoFabrica resumo={resumirFabrica(estados('critica', 'normal', 'normal'))} maquinasAfetadas={['MAQ-01']} total={3} />);

    expect(screen.getByRole('status', { name: 'Resumo da fábrica' })).toHaveTextContent('1 máquina em estado crítico');
    expect(screen.getByRole('status', { name: 'Resumo da fábrica' })).toHaveTextContent('MAQ-01');
  });
});

describe('ControlesDoGrafico', () => {
  it('cada máquina é um botão que mostra ou esconde a linha, e diz se está ligada', async () => {
    const onAlternar = vi.fn();
    render(<ControlesDoGrafico ocultas={new Set(['MAQ-02'])} onAlternar={onAlternar} pontos={20} onPontos={vi.fn()} metrica={METRICAS[0]} onMetrica={vi.fn()} />);

    expect(screen.getByRole('button', { name: 'MAQ-01' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'MAQ-02' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.setup().click(screen.getByRole('button', { name: 'MAQ-03' }));
    expect(onAlternar).toHaveBeenCalledWith('MAQ-03');
  });

  it('mostra as opções de pontos, marca a atual e avisa quando outra é escolhida', async () => {
    const onPontos = vi.fn();
    render(<ControlesDoGrafico ocultas={new Set()} onAlternar={vi.fn()} pontos={20} onPontos={onPontos} metrica={METRICAS[0]} onMetrica={vi.fn()} />);

    expect(screen.getByRole('button', { name: '20' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: '60' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.setup().click(screen.getByRole('button', { name: '160' }));
    expect(onPontos).toHaveBeenCalledWith(160);
  });

  it('a legenda lembra o limite da grandeza escolhida, e rotação não tem limite', () => {
    const controles = (metrica) => (
      <ControlesDoGrafico ocultas={new Set()} onAlternar={vi.fn()} pontos={20} onPontos={vi.fn()} metrica={metrica} onMetrica={vi.fn()} />
    );
    const { rerender } = render(controles(METRICAS[0]));
    expect(screen.getByText('Limite de 95 °C')).toBeInTheDocument();

    rerender(controles(METRICAS[1]));
    expect(screen.getByText('Limite de 5,0 mm/s')).toBeInTheDocument();

    rerender(controles(METRICAS[2]));
    expect(screen.queryByText(/Limite de/)).not.toBeInTheDocument();
  });

  it('escolher outra grandeza avisa o app', async () => {
    const onMetrica = vi.fn();
    render(<ControlesDoGrafico ocultas={new Set()} onAlternar={vi.fn()} pontos={20} onPontos={vi.fn()} metrica={METRICAS[0]} onMetrica={onMetrica} />);

    expect(screen.getByRole('button', { name: 'Temperatura' })).toHaveAttribute('aria-pressed', 'true');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Vibração' }));

    expect(onMetrica).toHaveBeenCalledWith(METRICAS[1]);
  });
});

describe('AlertasRecentes', () => {
  const alerta = (extra = {}) => ({ id: 1, idMaquina: 'MAQ-01', timestamp: 100, tipo: 'TEMPERATURA', valor: 99, limite: 95, ...extra });

  it('lista os alertas do servidor com hora, máquina, motivo e valor', () => {
    render(
      <AlertasRecentes
        alertas={[alerta({ id: 2, idMaquina: 'MAQ-02', tipo: 'VIBRACAO', valor: 5.6, limite: 5 }), alerta()]}
        erro={false}
      />,
    );

    const itens = screen.getAllByRole('listitem');
    expect(itens).toHaveLength(2);
    expect(itens[0]).toHaveTextContent('MAQ-02');
    expect(itens[0]).toHaveTextContent('Vibração acima de 5,0 mm/s');
    expect(itens[0]).toHaveTextContent('5,60 mm/s');
    expect(itens[1]).toHaveTextContent('Temperatura acima de 95 °C');
    expect(itens[1]).toHaveTextContent('99,0 °C');
  });

  it('sem alertas, diz isso em vez de mostrar uma lista vazia', () => {
    render(<AlertasRecentes alertas={[]} erro={false} />);

    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText(/Nenhuma máquina passou dos limites/)).toBeInTheDocument();
  });

  it('se não conseguir atualizar, avisa e continua mostrando os últimos alertas', () => {
    render(<AlertasRecentes alertas={[alerta()]} erro />);

    expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível atualizar os alertas');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
  });
});

describe('DetalheDaMaquina', () => {
  const leiturasDaApi = [
    { id: 3, idMaquina: 'MAQ-01', timestamp: 130, temperaturaMotor: 100, vibracao: 2, rpm: 2000 },
    { id: 2, idMaquina: 'MAQ-01', timestamp: 120, temperaturaMotor: 80, vibracao: 2.5, rpm: 1800 },
    { id: 1, idMaquina: 'MAQ-01', timestamp: 110, temperaturaMotor: 60, vibracao: 1.5, rpm: 1600 },
  ];
  const mockarApi = (resposta) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta));

  it('busca as leituras só daquela máquina e mostra mínimo, média e máximo', async () => {
    mockarApi({ ok: true, status: 200, json: async () => leiturasDaApi });
    render(<DetalheDaMaquina token="t" maquina="MAQ-01" aoFechar={vi.fn()} onSessaoInvalida={vi.fn()} />);

    const janela = await screen.findByRole('dialog', { name: 'MAQ-01' });
    expect(await screen.findByText(/3 leituras/)).toBeInTheDocument();
    expect(fetch.mock.calls[0][0]).toContain('maquina=MAQ-01');
    expect(fetch.mock.calls[0][0]).toContain('limite=500');

    const temperatura = screen.getByRole('row', { name: /^Temperatura\s+\d/ });
    expect(temperatura).toHaveTextContent('60,0 °C'); // mínimo
    expect(temperatura).toHaveTextContent('80,0 °C'); // média
    expect(temperatura).toHaveTextContent('100,0 °C'); // máximo
    expect(janela).toHaveTextContent('1 passaram de algum limite (33,3%)');
  });

  it('lista as últimas leituras, da mais nova para a mais antiga', async () => {
    mockarApi({ ok: true, status: 200, json: async () => leiturasDaApi });
    render(<DetalheDaMaquina token="t" maquina="MAQ-01" aoFechar={vi.fn()} onSessaoInvalida={vi.fn()} />);

    await screen.findByText(/3 leituras/);
    const tabela = screen.getByRole('heading', { name: 'Últimas leituras' }).parentElement;
    const linhas = tabela.querySelectorAll('tbody tr');
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toHaveTextContent('100,0 °C'); // a de timestamp 130
    expect(linhas[2]).toHaveTextContent('60,0 °C');
  });

  it('sem leituras, diz isso', async () => {
    mockarApi({ ok: true, status: 200, json: async () => [] });
    render(<DetalheDaMaquina token="t" maquina="MAQ-02" aoFechar={vi.fn()} onSessaoInvalida={vi.fn()} />);

    expect(await screen.findByText('Esta máquina ainda não tem leituras.')).toBeInTheDocument();
  });

  it('se a API falhar, mostra o erro', async () => {
    mockarApi({ ok: false, status: 500, json: async () => ({}) });
    render(<DetalheDaMaquina token="t" maquina="MAQ-01" aoFechar={vi.fn()} onSessaoInvalida={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar as leituras desta máquina');
  });

  it('se o token não vale mais, avisa o app para voltar ao login', async () => {
    mockarApi({ ok: false, status: 403, json: async () => ({}) });
    const onSessaoInvalida = vi.fn();
    render(<DetalheDaMaquina token="t" maquina="MAQ-01" aoFechar={vi.fn()} onSessaoInvalida={onSessaoInvalida} />);

    await waitFor(() => expect(onSessaoInvalida).toHaveBeenCalled());
  });

  it('fecha com a tecla Esc', async () => {
    mockarApi({ ok: true, status: 200, json: async () => leiturasDaApi });
    const aoFechar = vi.fn();
    render(<DetalheDaMaquina token="t" maquina="MAQ-01" aoFechar={aoFechar} onSessaoInvalida={vi.fn()} />);
    await screen.findByText(/3 leituras/);

    await userEvent.setup().keyboard('{Escape}');

    expect(aoFechar).toHaveBeenCalled();
  });
});

describe('Login', () => {
  const mockarResposta = (resposta) => vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta));
  const mockarFalhaDeRede = () => vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));

  async function preencherEEnviar(user) {
    await user.type(screen.getByLabelText('Usuário'), 'admin');
    await user.type(screen.getByLabelText('Senha'), 'qualquer');
    await user.click(screen.getByRole('button', { name: 'Entrar' }));
  }

  it('login certo entrega o token para o app', async () => {
    mockarResposta({ ok: true, status: 200, json: async () => ({ token: 'abc.def.ghi' }) });
    const onEntrar = vi.fn();
    render(<Login aviso="" onEntrar={onEntrar} />);

    await preencherEEnviar(userEvent.setup());

    await waitFor(() => expect(onEntrar).toHaveBeenCalledWith('abc.def.ghi'));
  });

  it('senha errada mostra a mensagem e não entra', async () => {
    mockarResposta({ ok: false, status: 401, json: async () => ({}) });
    const onEntrar = vi.fn();
    render(<Login aviso="" onEntrar={onEntrar} />);

    await preencherEEnviar(userEvent.setup());

    expect(await screen.findByRole('alert')).toHaveTextContent('Usuário ou senha incorretos.');
    expect(onEntrar).not.toHaveBeenCalled();
  });

  it('servidor fora do ar mostra uma mensagem de conexão', async () => {
    mockarFalhaDeRede();
    render(<Login aviso="" onEntrar={vi.fn()} />);

    await preencherEEnviar(userEvent.setup());

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor');
  });

  it('o botão de demonstração entra com o acesso de demonstração, sem digitar nada', async () => {
    const fetchFalso = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ token: 'tok.demo.x' }) });
    vi.stubGlobal('fetch', fetchFalso);
    const onEntrar = vi.fn();
    render(<Login aviso="" onEntrar={onEntrar} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver o painel de demonstração' }));

    await waitFor(() => expect(onEntrar).toHaveBeenCalledWith('tok.demo.x'));
    expect(JSON.parse(fetchFalso.mock.calls.find(([url]) => String(url).includes("/api/auth/login"))[1].body)).toEqual(ACESSO_DEMO);
  });

  it('se a demonstração falhar (servidor fora do ar), mostra o erro e deixa tentar de novo', async () => {
    mockarFalhaDeRede();
    render(<Login aviso="" onEntrar={vi.fn()} />);

    await userEvent.setup().click(screen.getByRole('button', { name: 'Ver o painel de demonstração' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor');
    expect(screen.getByRole('button', { name: 'Ver o painel de demonstração' })).toBeEnabled();
  });

  it('a página explica o caminho da leitura, do sensor até o painel', () => {
    render(<Login aviso="" onEntrar={vi.fn()} />);

    const etapas = screen.getByRole('heading', { name: 'Como uma leitura chega até a tela' }).parentElement;
    for (const nome of ['Sensores', 'API', 'Fila', 'Gateway', 'Painel']) {
      expect(etapas).toHaveTextContent(nome);
    }
    expect(screen.getByText('Os dados deste demo são simulados.')).toBeInTheDocument();
  });

  it('se o login demorar (servidor gratuito acordando), explica a espera depois de 6 segundos', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {}))); // o servidor ainda não respondeu
      render(<Login aviso="" onEntrar={vi.fn()} />);

      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Ver o painel de demonstração' }));
      expect(screen.queryByText(/dorme quando ninguém usa/)).not.toBeInTheDocument();

      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500);
      });

      expect(screen.getByRole('status')).toHaveTextContent('dorme quando ninguém usa');
      expect(screen.getByRole('status')).toHaveTextContent('até 1 minuto');
    } finally {
      vi.useRealTimers();
    }
  });

  it('o aviso de espera some quando o login termina com erro', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    try {
      let falhar;
      vi.stubGlobal('fetch', vi.fn(() => new Promise((_, rejeitar) => { falhar = () => rejeitar(new TypeError('Failed to fetch')); })));
      render(<Login aviso="" onEntrar={vi.fn()} />);
      await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Ver o painel de demonstração' }));
      await act(async () => {
        await vi.advanceTimersByTimeAsync(6500);
      });
      expect(screen.getByRole('status')).toHaveTextContent('dorme quando ninguém usa');

      await act(async () => falhar());

      expect(screen.queryByText(/dorme quando ninguém usa/)).not.toBeInTheDocument();
      expect(screen.getByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor');
    } finally {
      vi.useRealTimers();
    }
  });

  it('mostra o aviso de sessão terminada vindo do app', () => {
    render(<Login aviso="Sua sessão terminou. Entre de novo para continuar." onEntrar={vi.fn()} />);

    expect(screen.getByRole('status')).toHaveTextContent('Sua sessão terminou');
  });

  it('os campos têm rótulo, para leitores de tela e para quem usa só o teclado', () => {
    render(<Login aviso="" onEntrar={vi.fn()} />);

    expect(screen.getByLabelText('Usuário')).toBeRequired();
    expect(screen.getByLabelText('Senha')).toHaveAttribute('type', 'password');
  });
});
