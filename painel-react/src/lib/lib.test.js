import { describe, expect, it } from 'vitest';
import { adicionarLeitura, agruparHistorico, MAX_PONTOS, serieDaMaquina } from './historico';
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
      registros.push({ idMaquina: 'MAQ-01', timestamp: t, temperaturaMotor: 70 + t });
      registros.push({ idMaquina: 'MAQ-02', timestamp: t, temperaturaMotor: 60 + t });
    }
    registros.reverse(); // a API devolve do mais novo para o mais antigo

    const pontos = agruparHistorico(registros);

    expect(pontos).toHaveLength(MAX_PONTOS);
    expect(pontos[0].timestamp).toBe(6);
    expect(pontos.at(-1)).toEqual({ timestamp: 25, 'MAQ-01': 95, 'MAQ-02': 85 });
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
