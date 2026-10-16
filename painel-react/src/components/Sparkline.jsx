const LARGURA = 160;
const ALTURA = 40;

/**
 * Mini gráfico das últimas temperaturas de uma máquina.
 * A escala se ajusta à própria máquina; a linha do limite só aparece quando cabe nela.
 * Só enfeita a leitura: os números já estão na tela.
 */
export default function Sparkline({ valores, limite }) {
  if (valores.length < 2) {
    return <div aria-hidden="true" className="h-10 w-40 rounded-sm border border-dashed border-linha" />;
  }

  const menor = Math.min(...valores) - 1;
  const maior = Math.max(...valores) + 1;
  const y = (v) => ALTURA - 3 - ((v - menor) / (maior - menor)) * (ALTURA - 6);
  const x = (i) => 3 + (i / (valores.length - 1)) * (LARGURA - 6);
  const pontos = valores.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  const ultimo = valores[valores.length - 1];
  const limiteVisivel = limite >= menor && limite <= maior;

  return (
    <svg aria-hidden="true" viewBox={`0 0 ${LARGURA} ${ALTURA}`} className="h-10 w-40 overflow-visible">
      {limiteVisivel && (
        <line x1="0" x2={LARGURA} y1={y(limite)} y2={y(limite)} strokeWidth="1" strokeDasharray="4 3" className="stroke-alarme/70" />
      )}
      <polyline points={pontos} fill="none" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" className="stroke-tinta" />
      <circle cx={x(valores.length - 1)} cy={y(ultimo)} r="3" className={ultimo > limite ? 'fill-alarme' : 'fill-tinta'} />
    </svg>
  );
}
