import { describe, expect, it } from 'vitest';
import { adicionarLeitura, agruparHistorico, MAX_PONTOS, mesclarLeituras, serieDaMaquina, ultimasLeituras } from './historico';
import { avaliarMaquina, resumirFabrica, SEM_SINAL_APOS_S } from './limites';
import { lerExpiracao, tokenExpirado } from './token';

const leitura = (extra = {}) => ({
  idMaquina: 'MAQ-01',
  timestamp: 100,
  temperaturaMotor: 80,
  vibracao: 2,
  rpm: 1800,
  recebidoEm: 1_000_000,
  ...extra,
});

describe('avaliarMaquina', () => {
  const agora = 1_000_000;

  it('sem leitura ainda', () => {
    expect(avaliarMaquina(undefined, agora).estado).toBe('sem-dados');
  });

  it('valores dentro dos limites são normais', () => {
    expect(avaliarMaquina(leitura(), agora)).toEqual({ estado: 'normal', motivos: [] });
  });

  it('exatamente no limite ainda é normal (só passa do limite é crítico)', () => {
    const r = avaliarMaquina(leitura({ temperaturaMotor: 95, vibracao: 5.0 }), agora);
    expect(r.estado).toBe('normal');
  });

  it('temperatura acima de 95 °C é crítica e diz o motivo', () => {
    const r = avaliarMaquina(leitura({ temperaturaMotor: 95.1 }), agora);
    expect(r.estado).toBe('critica');
    expect(r.motivos).toEqual(['Temperatura acima de 95 °C']);
  });

  it('vibração acima de 5,0 mm/s é crítica e diz o motivo', () => {
    const r = avaliarMaquina(leitura({ vibracao: 5.2 }), agora);
    expect(r.estado).toBe('critica');
    expect(r.motivos).toEqual(['Vibração acima de 5,0 mm/s']);
  });

  it('os dois motivos aparecem juntos', () => {
    const r = avaliarMaquina(leitura({ temperaturaMotor: 100, vibracao: 6 }), agora);
    expect(r.motivos).toHaveLength(2);
  });

  it('leitura antiga vira "sem sinal", mesmo com valor crítico', () => {
    const velha = leitura({ temperaturaMotor: 120 });
    const r = avaliarMaquina(velha, velha.recebidoEm + (SEM_SINAL_APOS_S + 1) * 1000);
    expect(r.estado).toBe('sem-sinal');
  });
});

describe('resumirFabrica', () => {
  const av = (...estados) => estados.map((estado) => ({ estado, motivos: [] }));

  it('crítica tem prioridade', () => {
    expect(resumirFabrica(av('normal', 'critica', 'sem-sinal'))).toEqual({
      nivel: 'critico',
      texto: '1 máquina em estado crítico',
    });
  });

  it('plural quando há mais de uma', () => {
    expect(resumirFabrica(av('critica', 'critica', 'normal')).texto).toBe('2 máquinas em estado crítico');
  });

  it('máquina muda enquanto as outras funcionam não é "tudo normal"', () => {
    expect(resumirFabrica(av('normal', 'normal', 'sem-dados'))).toEqual({ nivel: 'atencao', texto: '1 máquina sem sinal' });
    expect(resumirFabrica(av('normal', 'sem-sinal', 'sem-sinal')).texto).toBe('2 máquinas sem sinal');
  });

  it('aguardando quando nenhuma máquina enviou dados', () => {
    expect(resumirFabrica(av('sem-dados', 'sem-dados', 'sem-dados')).nivel).toBe('aguardando');
  });

  it('tudo normal', () => {
    expect(resumirFabrica(av('normal', 'normal', 'normal')).texto).toBe('Tudo normal');
  });
});

describe('historico', () => {
  it('agrupa leituras do mesmo instante, ordena e limita a 20 pontos', () => {
    const registros = [];
    for (let t = 1; t <= 25; t++) {
      registros.push({ idMaquina: 'MAQ-01', timestamp: t * 5, temperaturaMotor: 70 + t });
      registros.push({ idMaquina: 'MAQ-02', timestamp: t * 5, temperaturaMotor: 60 + t });
    }
    registros.reverse(); // a API devolve do mais novo para o mais antigo

    const pontos = agruparHistorico(registros);

    expect(pontos).toHaveLength(MAX_PONTOS);
    expect(pontos[0].timestamp).toBe(30);
    expect(pontos.at(-1)).toEqual({ timestamp: 125, 'MAQ-01': 95, 'MAQ-02': 85 });
  });

  it('o histórico agrupa com a mesma regra do ao vivo (virada de segundo no meio da rodada)', () => {
    const registros = [
      { idMaquina: 'MAQ-01', timestamp: 100, temperaturaMotor: 80 },
      { idMaquina: 'MAQ-02', timestamp: 100, temperaturaMotor: 70 },
      { idMaquina: 'MAQ-03', timestamp: 101, temperaturaMotor: 75 },
    ];
    expect(agruparHistorico(registros)).toEqual([{ timestamp: 100, 'MAQ-01': 80, 'MAQ-02': 70, 'MAQ-03': 75 }]);
  });

  it('mesclarLeituras tira repetidas pelo id e guarda as leituras ao vivo que chegaram antes do histórico', () => {
    const api = [{ id: 1, idMaquina: 'MAQ-01', timestamp: 10, temperaturaMotor: 80 }, { id: 2, idMaquina: 'MAQ-01', timestamp: 12, temperaturaMotor: 81 }];
    const aoVivo = [{ id: 2, idMaquina: 'MAQ-01', timestamp: 12, temperaturaMotor: 81 }, { id: 3, idMaquina: 'MAQ-01', timestamp: 14, temperaturaMotor: 82 }];

    expect(mesclarLeituras(api, aoVivo).map((l) => l.id)).toEqual([1, 2, 3]);
  });

  it('ultimasLeituras pega a mais nova de cada máquina e usa a hora dela como recebidoEm', () => {
    const r = ultimasLeituras([
      { idMaquina: 'MAQ-01', timestamp: 20, temperaturaMotor: 82 },
      { idMaquina: 'MAQ-01', timestamp: 10, temperaturaMotor: 80 },
      { idMaquina: 'MAQ-02', timestamp: 15, temperaturaMotor: 70 },
    ]);

    expect(r['MAQ-01']).toMatchObject({ temperaturaMotor: 82, recebidoEm: 20_000 });
    expect(r['MAQ-02'].recebidoEm).toBe(15_000);
  });

  it('o limite de pontos pode ser maior que 20', () => {
    const registros = [];
    for (let t = 1; t <= 70; t++) registros.push({ idMaquina: 'MAQ-01', timestamp: t * 5, temperaturaMotor: 70 });

    expect(agruparHistorico(registros)).toHaveLength(MAX_PONTOS);
    expect(agruparHistorico(registros, 60)).toHaveLength(60);

    let h = [];
    for (const r of registros) h = adicionarLeitura(h, r, 60);
    expect(h).toHaveLength(60);
  });

  it('leitura com menos de 2 s de diferença entra no último ponto', () => {
    const base = [{ timestamp: 100, 'MAQ-01': 80 }];
    const novo = adicionarLeitura(base, { idMaquina: 'MAQ-02', timestamp: 101, temperaturaMotor: 70 });

    expect(novo).toEqual([{ timestamp: 100, 'MAQ-01': 80, 'MAQ-02': 70 }]);
    expect(base).toEqual([{ timestamp: 100, 'MAQ-01': 80 }]); // não altera o original
  });

  it('leitura com 2 s ou mais cria um ponto novo', () => {
    const base = [{ timestamp: 100, 'MAQ-01': 80 }];
    const novo = adicionarLeitura(base, { idMaquina: 'MAQ-01', timestamp: 102, temperaturaMotor: 81 });

    expect(novo).toHaveLength(2);
  });

  it('nunca passa de 20 pontos', () => {
    let h = [];
    for (let t = 0; t < 100; t += 5) {
      h = adicionarLeitura(h, { idMaquina: 'MAQ-01', timestamp: t, temperaturaMotor: 70 });
    }
    expect(h).toHaveLength(MAX_PONTOS);
  });

  it('serieDaMaquina ignora pontos sem a máquina', () => {
    const h = [{ timestamp: 1, 'MAQ-01': 70 }, { timestamp: 2, 'MAQ-02': 60 }, { timestamp: 3, 'MAQ-01': 72 }];
    expect(serieDaMaquina(h, 'MAQ-01')).toEqual([70, 72]);
  });
});

describe('token', () => {
  const montar = (payload) => `x.${btoa(JSON.stringify(payload)).replace(/=+$/, '')}.y`;

  it('lê a expiração do token', () => {
    expect(lerExpiracao(montar({ exp: 2000 }))).toBe(2000);
  });

  it('token ilegível não tem expiração e não é tratado como expirado', () => {
    expect(lerExpiracao('lixo')).toBeNull();
    expect(tokenExpirado('lixo')).toBe(false);
  });

  it('detecta token expirado e token ainda válido', () => {
    const token = montar({ exp: 2000 });
    expect(tokenExpirado(token, 2_000_000)).toBe(true);
    expect(tokenExpirado(token, 1_999_000)).toBe(false);
  });
});
