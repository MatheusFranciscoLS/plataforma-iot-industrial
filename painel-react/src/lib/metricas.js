import { LIMITE_TEMPERATURA, LIMITE_VIBRACAO } from './limites';

// As três grandezas que o gráfico sabe desenhar.
// - limite: valor a partir do qual o painel dá alerta (rotação não tem limite de alerta);
// - casas: casas decimais dos valores; casasLimite: casas decimais ao escrever o limite;
// - margem: folga em volta dos dados no eixo vertical; casasEixo: casas decimais nos números do eixo.
export const METRICAS = [
  { id: 'temperaturaMotor', rotulo: 'Temperatura', unidade: '°C', limite: LIMITE_TEMPERATURA, casas: 1, casasLimite: 0, margem: 5, casasEixo: 0 },
  { id: 'vibracao', rotulo: 'Vibração', unidade: 'mm/s', limite: LIMITE_VIBRACAO, casas: 2, casasLimite: 1, margem: 0.5, casasEixo: 1 },
  { id: 'rpm', rotulo: 'Rotação', unidade: 'rpm', limite: null, casas: 0, casasLimite: 0, margem: 50, casasEixo: 0 },
];

export const METRICA_PADRAO = METRICAS[0];
