import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIdioma } from '@/i18n/idioma-contexto';
import { baixarArquivo, gerarCsv } from '@/lib/csv';
import { formatarNumero } from '@/lib/limites';
import { SERIES } from '@/lib/series';
import ControlesDoGrafico from './ControlesDoGrafico';

function BalaoDoGrafico({ active, payload, label, metrica, limitesPorMaquina, hora, locale }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-linha bg-painel px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-semibold">{hora(label)}</p>
      {payload.map((p) => {
        const limiteDaMaquina = limitesPorMaquina?.[p.dataKey] ?? metrica.limite;
        return (
        <p key={p.dataKey} className="flex justify-between gap-4">
          <span className="text-suave">{p.dataKey}</span>
          <span className={`numero ${limiteDaMaquina !== null && p.value > limiteDaMaquina ? 'text-alarme' : ''}`}>
            {formatarNumero(p.value, metrica.casas, metrica.casas, locale)} {metrica.unidade}
          </span>
        </p>
        );
      })}
    </div>
  );
}

/**
 * Gráfico de linhas de uma grandeza (temperatura, vibração ou rotação), uma linha por máquina.
 * `limitesPorMaquina` ({ 'MAQ-01': 95, ... }) traz o limite de cada máquina; sem ele vale o limite padrão da grandeza.
 */
export default function GraficoTemperatura({ historico, leituras, metrica, limitesPorMaquina = null, onMetrica, pontos, onPontos }) {
  const { t, locale } = useIdioma();
  const hora = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString(locale);
  const grandeza = t(`metrica.${metrica.id}`);
  const vazio = historico.length === 0;
  const [ocultas, setOcultas] = useState(() => new Set());
  const { limite } = metrica;
  // Um limite por máquina: as linhas tracejadas são só as de valores diferentes (todas iguais = uma linha).
  const limites =
    limite === null ? [] : [...new Set(limitesPorMaquina ? Object.values(limitesPorMaquina) : [limite])].sort((a, b) => a - b);

  const alternar = (maquina) =>
    setOcultas((atual) => {
      const novo = new Set(atual);
      if (novo.has(maquina)) novo.delete(maquina);
      else novo.add(maquina);
      return novo;
    });

  // Com limite de alerta, o eixo sempre inclui a linha do limite; sem limite (rotação), segue só os dados.
  const { margem } = metrica;
  const arredondar = (v) => Math.round(v * 10) / 10;
  const dominio =
    limite === null
      ? [(min) => Math.max(0, Math.floor(min - margem)), (max) => Math.ceil(max + margem)]
      : [
          (min) => Math.max(0, arredondar(Math.min(min, ...limites) - margem)),
          (max) => arredondar(Math.max(max, ...limites) + margem),
        ];

  return (
    <section aria-labelledby="titulo-grafico" aria-describedby="descricao-grafico" className="mt-6 rounded border border-linha bg-painel p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="titulo-grafico" className="font-condensada text-2xl font-semibold">
            {t('grafico.titulo', { grandeza })}
          </h2>
          <Button
            variant="outline"
            size="sm"
            className="mt-2"
            disabled={leituras.length === 0}
            onClick={() => baixarArquivo('leituras.csv', gerarCsv(leituras))}
          >
            <Download aria-hidden="true" />
            {t('grafico.csv')}
          </Button>
        </div>
        <ControlesDoGrafico
          ocultas={ocultas}
          onAlternar={alternar}
          pontos={pontos}
          onPontos={onPontos}
          metrica={metrica}
          onMetrica={onMetrica}
          limites={limites}
        />
      </div>

      <p id="descricao-grafico" className="sr-only">
        {t('grafico.descricao', {
          grandeza: grandeza.toLowerCase(),
          limite:
            limite !== null
              ? t('grafico.descricaoLimite', {
                  valor: limites.map((l) => formatarNumero(l, metrica.casasLimite, metrica.casasLimite, locale)).join(' / '),
                  unidade: metrica.unidade,
                })
              : '',
        })}
      </p>

      <div className="relative mt-4 h-72 w-full md:h-96">
        {vazio && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-suave">
            {t('grafico.vazio')}
          </p>
        )}
        <ResponsiveContainer>
          <LineChart data={historico} margin={{ top: 12, right: 16, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgb(var(--linha))" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={hora}
              tickMargin={10}
              minTickGap={48}
              stroke="rgb(var(--suave))"
              tick={{ fill: 'rgb(var(--suave))', fontSize: 12 }}
            />
            <YAxis
              domain={dominio}
              tickFormatter={(v) => formatarNumero(v, metrica.casasEixo, 0, locale)}
              width={metrica.id === 'rpm' ? 52 : 44}
              stroke="rgb(var(--suave))"
              tick={{ fill: 'rgb(var(--suave))', fontSize: 12 }}
            />
            {limites.map((valor) => (
              <ReferenceLine key={valor} y={valor} stroke="rgb(var(--alarme))" strokeDasharray="6 4" strokeWidth={1.5} />
            ))}
            <Tooltip content={<BalaoDoGrafico metrica={metrica} limitesPorMaquina={limitesPorMaquina} hora={hora} locale={locale} />} cursor={{ stroke: 'rgb(var(--suave))', strokeDasharray: '3 3' }} />
            {SERIES.map(({ chave, cor, traco }) => (
              <Line
                key={chave}
                dataKey={chave}
                stroke={cor}
                strokeDasharray={traco}
                strokeWidth={2.5}
                type="monotone"
                connectNulls
                dot={false}
                activeDot={{ r: 5 }}
                isAnimationActive={false}
                hide={ocultas.has(chave)}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
