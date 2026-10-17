// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import AlertasRecentes from '@/components/AlertasRecentes';
import ControlesDoGrafico from '@/components/ControlesDoGrafico';
import LinhaMaquina from '@/components/LinhaMaquina';
import Login from '@/components/Login';
import ResumoFabrica from '@/components/ResumoFabrica';
import StatusConexao from '@/components/StatusConexao';
import { avaliarMaquina, resumirFabrica } from '@/lib/limites';
import { METRICAS } from '@/lib/metricas';
import ProvedorDeIdioma from './ProvedorDeIdioma';
import { pacote, TEXTOS, traduzir } from './textos';

const marcas = (texto) => [...texto.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

describe('dicionários', () => {
  it('português e inglês têm exatamente as mesmas chaves', () => {
    expect(Object.keys(TEXTOS.en).sort()).toEqual(Object.keys(TEXTOS.pt).sort());
  });

  it('cada texto usa os mesmos {valores} nos dois idiomas', () => {
    for (const chave of Object.keys(TEXTOS.pt)) {
      expect(marcas(TEXTOS.en[chave]), chave).toEqual(marcas(TEXTOS.pt[chave]));
    }
  });

  it('nenhum texto em inglês ficou igual ao português por esquecimento (fora nomes próprios e siglas)', () => {
    const iguaisPermitidos = new Set(['fluxo.api', 'fluxo.gateway', 'estado.normal']);
    const iguais = Object.keys(TEXTOS.pt).filter((c) => TEXTOS.pt[c] === TEXTOS.en[c] && !iguaisPermitidos.has(c));
    expect(iguais).toEqual([]);
  });

  it('traduzir troca os {valores}, cai no português se faltar e devolve a chave se não existir', () => {
    expect(traduzir('pt', 'resumo.critica.varios', { n: 3 })).toBe('3 máquinas em estado crítico');
    expect(traduzir('en', 'resumo.critica.varios', { n: 3 })).toBe('3 machines in critical state');
    expect(traduzir('en', 'chave.que.nao.existe')).toBe('chave.que.nao.existe');
    expect(traduzir('pt', 'resumo.monitoradas', {})).toBe('{n} máquinas monitoradas'); // valor faltando fica à vista
  });
});

describe('escolha do idioma', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.restoreAllMocks());

  const idiomaNaTela = () => document.documentElement.lang;

  it('na primeira visita segue o idioma do navegador: inglês para quem usa inglês, português para o resto', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-GB');
    const { unmount } = render(<ProvedorDeIdioma><Login aviso="" onEntrar={vi.fn()} /></ProvedorDeIdioma>);
    expect(screen.getByRole('button', { name: 'See the demo dashboard' })).toBeInTheDocument();
    unmount();

    vi.spyOn(navigator, 'language', 'get').mockReturnValue('pt-BR');
    render(<ProvedorDeIdioma><Login aviso="" onEntrar={vi.fn()} /></ProvedorDeIdioma>);
    expect(screen.getByRole('button', { name: 'Ver o painel de demonstração' })).toBeInTheDocument();
  });

  it('a escolha guardada vale mais que o idioma do navegador', () => {
    vi.spyOn(navigator, 'language', 'get').mockReturnValue('en-US');
    localStorage.setItem('idioma', 'pt');

    render(<ProvedorDeIdioma><Login aviso="" onEntrar={vi.fn()} /></ProvedorDeIdioma>);

    expect(screen.getByRole('button', { name: 'Ver o painel de demonstração' })).toBeInTheDocument();
  });

  it('o botão de idioma troca todos os textos, guarda a escolha e avisa o navegador (lang e título da aba)', async () => {
    localStorage.setItem('idioma', 'pt');
    render(<ProvedorDeIdioma><Login aviso="" onEntrar={vi.fn()} /></ProvedorDeIdioma>);
    expect(idiomaNaTela()).toBe('pt-BR');
    expect(document.title).toBe('Monitoramento da fábrica');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Mudar para inglês' }));

    expect(screen.getByRole('heading', { name: 'Factory monitoring', level: 1 })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How a reading reaches the screen' })).toBeInTheDocument();
    expect(screen.getByLabelText('Username')).toBeInTheDocument();
    expect(localStorage.getItem('idioma')).toBe('en');
    expect(idiomaNaTela()).toBe('en');
    expect(document.title).toBe('Factory monitoring');

    await userEvent.setup().click(screen.getByRole('button', { name: 'Switch to Portuguese' }));
    expect(screen.getByLabelText('Usuário')).toBeInTheDocument();
    expect(localStorage.getItem('idioma')).toBe('pt');
  });
});

describe('o painel em inglês', () => {
  beforeEach(() => localStorage.setItem('idioma', 'en'));
  afterEach(() => localStorage.clear());

  const leitura = (extra = {}) => ({
    id: 1,
    idMaquina: 'MAQ-01',
    timestamp: 1_700_000_000,
    temperaturaMotor: 99.5,
    vibracao: 5.25,
    rpm: 2112,
    recebidoEm: 1_000_000,
    ...extra,
  });
  const i18n = pacote('en');
  const comIdioma = (el) => <ProvedorDeIdioma>{el}</ProvedorDeIdioma>;

  it('a máquina crítica mostra estado, motivos e números no formato inglês', () => {
    const dado = leitura();
    render(comIdioma(<LinhaMaquina nome="MAQ-01" dado={dado} avaliacao={avaliarMaquina(dado, 1_000_000, i18n)} agora={1_000_000} serie={[90, 99]} onDetalhes={vi.fn()} />));

    expect(screen.getByRole('article', { name: 'MAQ-01: Critical' })).toBeInTheDocument();
    expect(screen.getByText('Temperature above 95 °C')).toBeInTheDocument();
    expect(screen.getByText('Vibration above 5.0 mm/s')).toBeInTheDocument();
    expect(screen.getByText('99.5')).toBeInTheDocument(); // ponto decimal
    expect(screen.getByText('2,112')).toBeInTheDocument(); // vírgula como separador de milhar
    expect(screen.getByText('Updated 0 s ago')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'View details for MAQ-01' })).toBeInTheDocument();
    expect(screen.getByRole('meter', { name: 'Temperature of MAQ-01' })).toBeInTheDocument();
  });

  it('o resumo da fábrica usa o plural certo em inglês', () => {
    const av = (...estados) => estados.map((estado) => ({ estado, motivos: [] }));

    expect(resumirFabrica(av('critica', 'normal'), i18n).texto).toBe('1 machine in critical state');
    expect(resumirFabrica(av('critica', 'critica'), i18n).texto).toBe('2 machines in critical state');
    expect(resumirFabrica(av('normal', 'normal'), i18n).texto).toBe('All normal');

    render(comIdioma(<ResumoFabrica resumo={resumirFabrica(av('normal', 'normal', 'normal'), i18n)} maquinasAfetadas={[]} total={3} />));
    expect(screen.getByRole('status', { name: 'Factory summary' })).toHaveTextContent('3 machines monitored');
  });

  it('os alertas guardados no servidor aparecem em inglês, com hora no formato inglês', () => {
    const alerta = { id: 1, idMaquina: 'MAQ-02', timestamp: 1_700_000_000, tipo: 'VIBRACAO', valor: 5.6, limite: 5 };
    render(comIdioma(<AlertasRecentes alertas={[alerta]} erro={false} />));

    expect(screen.getByRole('heading', { name: 'Recent alerts' })).toBeInTheDocument();
    const item = screen.getByRole('listitem');
    expect(item).toHaveTextContent('Vibration above 5.0 mm/s');
    expect(item).toHaveTextContent('5.60 mm/s');
    expect(item).toHaveTextContent(/(AM|PM)/);
  });

  it('o status de conexão e os controles do gráfico também', () => {
    const { rerender } = render(comIdioma(<StatusConexao conexao="ao-vivo" />));
    expect(screen.getByText('Live')).toBeInTheDocument();
    rerender(comIdioma(<StatusConexao conexao="por-consulta" />));
    expect(screen.getByText('Updating by polling')).toBeInTheDocument();

    rerender(comIdioma(<ControlesDoGrafico ocultas={new Set()} onAlternar={vi.fn()} pontos={20} onPontos={vi.fn()} metrica={METRICAS[1]} onMetrica={vi.fn()} />));
    expect(screen.getByRole('button', { name: 'Vibration' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByText('Limit: 5.0 mm/s')).toBeInTheDocument();
    expect(screen.getByText('Show the last')).toBeInTheDocument();
  });

  it('o erro de login aparece em inglês', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    render(comIdioma(<Login aviso="" onEntrar={vi.fn()} />));

    await userEvent.setup().type(screen.getByLabelText('Username'), 'admin');
    await userEvent.setup().type(screen.getByLabelText('Password'), 'x');
    await userEvent.setup().click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Wrong username or password.');
    vi.unstubAllGlobals();
  });
});
