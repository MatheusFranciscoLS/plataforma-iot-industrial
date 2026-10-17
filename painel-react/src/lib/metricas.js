import { LIMITE_TEMPERATURA, LIMITE_VIBRACAO } from './limites';

// As três grandezas que o gráfico sabe desenhar.
// - limite: limite padrão de alerta (rotação não tem limite de alerta); limiteDe: de qual limite da máquina ele vem
//   (cada máquina pode ter o seu, ver limitesDaMaquina em limites.js);
// - casas: casas decimais dos valores; casasLimite: casas decimais ao escrever o limite;
// - margem: folga em volta dos dados no eixo vertical; casasEixo: casas decimais nos números do eixo.
export const METRICAS = [
  { id: 'temperaturaMotor', unidade: '°C', limite: LIMITE_TEMPERATURA, limiteDe: 'temperatura', casas: 1, casasLimite: 0, margem: 5, casasEixo: 0 },
  { id: 'vibracao', unidade: 'mm/s', limite: LIMITE_VIBRACAO, limiteDe: 'vibracao', casas: 2, casasLimite: 1, margem: 0.5, casasEixo: 1 },
  { id: 'rpm', unidade: 'rpm', limite: null, limiteDe: null, casas: 0, casasLimite: 0, margem: 50, casasEixo: 0 },
];

export const METRICA_PADRAO = METRICAS[0];
