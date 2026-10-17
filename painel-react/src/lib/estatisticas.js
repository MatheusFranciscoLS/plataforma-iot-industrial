import { motivosDaLeitura } from './limites';

function resumirCampo(leituras, campo) {
  const valores = leituras.map((l) => l[campo]).filter((v) => typeof v === 'number');
  if (valores.length === 0) return null;
  const soma = valores.reduce((total, v) => total + v, 0);
  return { min: Math.min(...valores), media: soma / valores.length, max: Math.max(...valores) };
}

/**
 * Números de uma máquina a partir das leituras dela: mínimo, média e máximo de cada grandeza,
 * o período coberto e quantas leituras passaram de algum limite. Devolve null se não há leituras.
 */
export function resumirLeituras(leituras) {
  if (leituras.length === 0) return null;

  const momentos = leituras.map((l) => l.timestamp);
  const acima = leituras.filter((l) => motivosDaLeitura(l).length > 0).length;

  return {
    quantidade: leituras.length,
    inicio: Math.min(...momentos),
    fim: Math.max(...momentos),
    temperatura: resumirCampo(leituras, 'temperaturaMotor'),
    vibracao: resumirCampo(leituras, 'vibracao'),
    rpm: resumirCampo(leituras, 'rpm'),
    acimaDoLimite: { quantidade: acima, percentual: (acima / leituras.length) * 100 },
  };
}
