// @vitest-environment jsdom
import { render, renderHook, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ComparacaoDeMaquinas from '@/components/ComparacaoDeMaquinas';
import ControlesDoGrafico from '@/components/ControlesDoGrafico';
import { useResumo, useSerie } from '@/hooks/useServidorPorPeriodo';
import { buscarResumo, buscarSerie } from '@/lib/api';
import { METRICAS } from '@/lib/metricas';
import { faixaEmMinutos, serieDaMaquinaParaLinhas, serieParaLinhas } from '@/lib/periodos';

const resposta = (corpo, status = 200) => ({ ok: status < 400, status, json: async () => corpo });

const serie = {
  periodo: '1h',
  faixaSegundos: 60,
  de: 0,
  ate: 3600,
  maquinas: [
    { idMaquina: 'MAQ-01', pontos: [{ t: 120, leituras: 3, temperatura: 70, temperaturaMax: 75, vibracao: 2, vibracaoMax: 2.5, rpm: 1800 }, { t: 60, leituras: 2, temperatura: 68, temperaturaMax: 69, vibracao: 1.8, vibracaoMax: 2, rpm: 1790 }] },
    { idMaquina: 'MAQ-02', pontos: [{ t: 120, leituras: 3, temperatura: 80, temperaturaMax: 85, vibracao: 3, vibracaoMax: 3.5, rpm: 2200 }] },
  ],
};

afterEach(() => vi.unstubAllGlobals());

describe('lib/periodos', () => {
  it('junta as máquinas por faixa de tempo, em ordem, com a média da grandeza escolhida', () => {
    const linhas = serieParaLinhas(serie, 'temperaturaMotor');

    expect(linhas).toEqual([
      { timestamp: 60, 'MAQ-01': 68 },
      { timestamp: 120, 'MAQ-01': 70, 'MAQ-02': 80 },
    ]);
    expect(serieParaLinhas(serie, 'vibracao')[1]).toEqual({ timestamp: 120, 'MAQ-01': 2, 'MAQ-02': 3 });
    expect(serieParaLinhas(serie, 'rpm')[1]).toEqual({ timestamp: 120, 'MAQ-01': 1800, 'MAQ-02': 2200 });
  });

  it('série ausente, fora do formato ou grandeza desconhecida não quebra', () => {
    expect(serieParaLinhas(null, 'rpm')).toEqual([]);
    expect(serieParaLinhas([], 'rpm')).toEqual([]);
    expect(serieParaLinhas(serie, 'pressao')).toEqual([]);
  });

  it('a série de uma máquina traz média e máximo (rotação não tem máximo)', () => {
    expect(serieDaMaquinaParaLinhas(serie, 'MAQ-01', 'temperaturaMotor')).toEqual([
      { timestamp: 120, media: 70, maximo: 75 },
      { timestamp: 60, media: 68, maximo: 69 },
    ]);
    expect(serieDaMaquinaParaLinhas(serie, 'MAQ-01', 'rpm')[0]).toEqual({ timestamp: 120, media: 1800, maximo: null });
    expect(serieDaMaquinaParaLinhas(serie, 'MAQ-99', 'rpm')).toEqual([]);
  });

  it('a faixa vem em minutos', () => {
    expect(faixaEmMinutos(serie)).toBe(1);
    expect(faixaEmMinutos({ faixaSegundos: 900 })).toBe(15);
    expect(faixaEmMinutos(null)).toBeNull();
  });
});

describe('lib/api: série e resumo', () => {
  it('pede a série com período e máquina (opcional)', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(serie));
    vi.stubGlobal('fetch', fetchFalso);

    await buscarSerie('t', '6h');
    await buscarSerie('t', '24h', 'MAQ-02');
    await buscarResumo('t', '1h');

    const urls = fetchFalso.mock.calls.map(([u]) => String(u));
    expect(urls[0]).toMatch(/\/api\/sensores\/serie\?periodo=6h$/);
    expect(urls[1]).toMatch(/\/api\/sensores\/serie\?periodo=24h&maquina=MAQ-02$/);
    expect(urls[2]).toMatch(/\/api\/sensores\/resumo\?periodo=1h$/);
  });
});

describe('useSerie e useResumo', () => {
  it('com período nulo não chama a API', async () => {
    const fetchFalso = vi.fn();
    vi.stubGlobal('fetch', fetchFalso);

    const { result } = renderHook(() => useSerie('t', null, null, vi.fn()));

    expect(result.current).toEqual({ dados: null, erro: false, carregando: false });
    expect(fetchFalso).not.toHaveBeenCalled();
  });

  it('busca a série, mostra "carregando" e depois os dados', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta(serie)));
    const aoInvalidar = vi.fn();

    const { result } = renderHook(() => useSerie('t', '1h', null, aoInvalidar));
    expect(result.current.carregando).toBe(true);

    await waitFor(() => expect(result.current.dados).toEqual(serie));
    expect(result.current.carregando).toBe(false);
    expect(result.current.erro).toBe(false);
  });

  it('trocar o período some com a resposta antiga e busca a nova', async () => {
    const fetchFalso = vi.fn(async (url) => resposta({ ...serie, periodo: String(url).includes('periodo=6h') ? '6h' : '1h' }));
    vi.stubGlobal('fetch', fetchFalso);
    const aoInvalidar = vi.fn();

    const { result, rerender } = renderHook(({ periodo }) => useSerie('t', periodo, null, aoInvalidar), { initialProps: { periodo: '1h' } });
    await waitFor(() => expect(result.current.dados?.periodo).toBe('1h'));

    rerender({ periodo: '6h' });
    expect(result.current.dados).toBeNull(); // a de 1 h não aparece como se fosse a de 6 h
    await waitFor(() => expect(result.current.dados?.periodo).toBe('6h'));
  });

  it('falha da API vira erro; sessão vencida avisa o app', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({}, 500)));
    const falha = renderHook(() => useResumo('t', '1h', vi.fn()));
    await waitFor(() => expect(falha.result.current.erro).toBe(true));
    expect(falha.result.current.carregando).toBe(false);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({}, 401)));
    const aoInvalidar = vi.fn();
    renderHook(() => useResumo('t', '1h', aoInvalidar));
    await waitFor(() => expect(aoInvalidar).toHaveBeenCalled());
  });
});

describe('ControlesDoGrafico: período', () => {
  beforeEach(() => {
    localStorage.setItem('idioma', 'pt');
  });

  const montar = (extra) =>
    render(
      <ControlesDoGrafico ocultas={new Set()} onAlternar={vi.fn()} pontos={20} onPontos={vi.fn()} metrica={METRICAS[0]} onMetrica={vi.fn()} {...extra} />,
    );

  it('sem onPeriodo (como antes) não mostra o seletor de período', () => {
    montar();

    expect(screen.queryByRole('group', { name: 'Período do gráfico' })).not.toBeInTheDocument();
    expect(screen.getByRole('group', { name: 'Quantidade de pontos no gráfico' })).toBeInTheDocument();
  });

  it('com onPeriodo mostra ao vivo, 1 h, 6 h e 24 h e avisa o que foi escolhido', async () => {
    const onPeriodo = vi.fn();
    montar({ periodo: 'ao-vivo', onPeriodo });
    const grupo = screen.getByRole('group', { name: 'Período do gráfico' });

    expect(within(grupo).getAllByRole('button').map((b) => b.textContent)).toEqual(['Ao vivo', '1 hora', '6 horas', '24 horas']);
    expect(within(grupo).getByRole('button', { name: 'Ao vivo' })).toHaveAttribute('aria-pressed', 'true');

    await userEvent.setup().click(within(grupo).getByRole('button', { name: '6 horas' }));
    expect(onPeriodo).toHaveBeenCalledWith('6h');
  });

  it('num período do servidor a escolha de quantos pontos some (as faixas já definem a quantidade)', () => {
    montar({ periodo: '24h', onPeriodo: vi.fn() });

    expect(screen.queryByRole('group', { name: 'Quantidade de pontos no gráfico' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: '24 horas' })).toHaveAttribute('aria-pressed', 'true');
  });
});

describe('ComparacaoDeMaquinas', () => {
  const resumo = {
    periodo: '1h',
    maquinas: [
      { idMaquina: 'MAQ-01', leituras: 1800, temperaturaMedia: 72.34, temperaturaMax: 99.1, temperaturaMin: 65, vibracaoMedia: 1.9, vibracaoMax: 5.4, vibracaoMin: 1.1, rpmMedio: 1800, rpmMax: 1900, alertasTemperatura: 1, alertasVibracao: 2 },
      { idMaquina: 'MAQ-02', leituras: 1790, temperaturaMedia: 80.1, temperaturaMax: 88, temperaturaMin: 70, vibracaoMedia: 2.5, vibracaoMax: 3.1, vibracaoMin: 1.9, rpmMedio: 2200, rpmMax: 2300, alertasTemperatura: 0, alertasVibracao: 0 },
    ],
  };

  beforeEach(() => {
    localStorage.setItem('idioma', 'pt');
  });

  it('mostra uma linha por máquina com média, máximo e alertas', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(resumo));
    vi.stubGlobal('fetch', fetchFalso);
    render(<ComparacaoDeMaquinas token="t" onSessaoInvalida={vi.fn()} />);

    const tabela = await screen.findByRole('table', { name: 'Comparação das máquinas no período escolhido' });
    const linhas = within(tabela).getAllByRole('row');
    expect(linhas).toHaveLength(3); // cabeçalho + 2 máquinas
    expect(linhas[1]).toHaveTextContent('MAQ-01');
    expect(linhas[1]).toHaveTextContent('72,3 °C');
    expect(linhas[1]).toHaveTextContent('99,1 °C');
    expect(linhas[1]).toHaveTextContent('1.800');
    expect(linhas[1]).toHaveTextContent('3'); // 1 alerta de temperatura + 2 de vibração
    expect(linhas[2]).toHaveTextContent('MAQ-02');
    expect(String(fetchFalso.mock.calls[0][0])).toContain('/api/sensores/resumo?periodo=1h');
  });

  it('trocar o período busca o resumo daquele período', async () => {
    const fetchFalso = vi.fn().mockResolvedValue(resposta(resumo));
    vi.stubGlobal('fetch', fetchFalso);
    render(<ComparacaoDeMaquinas token="t" onSessaoInvalida={vi.fn()} />);
    await screen.findByRole('table');

    await userEvent.setup().click(screen.getByRole('button', { name: '24 horas' }));

    await waitFor(() => expect(fetchFalso.mock.calls.some(([u]) => String(u).includes('resumo?periodo=24h'))).toBe(true));
    expect(screen.getByRole('button', { name: '24 horas' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('sem leituras no período, diz isso', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({ periodo: '1h', maquinas: [] })));
    render(<ComparacaoDeMaquinas token="t" onSessaoInvalida={vi.fn()} />);

    expect(await screen.findByText('Sem leituras neste período.')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('se a API falhar, avisa', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(resposta({}, 500)));
    render(<ComparacaoDeMaquinas token="t" onSessaoInvalida={vi.fn()} />);

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar a comparação.');
  });
});
