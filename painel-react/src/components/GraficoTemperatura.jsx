import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useState } from 'react';
import { formatarNumero, LIMITE_TEMPERATURA } from '@/lib/limites';
import { SERIES } from '@/lib/series';
import ControlesDoGrafico from './ControlesDoGrafico';

const hora = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString('pt-BR');

function BalaoDoGrafico({ active, payload, label }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-linha bg-painel px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-semibold">{hora(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex justify-between gap-4">
          <span className="text-suave">{p.dataKey}</span>
          <span className={`numero ${p.value > LIMITE_TEMPERATURA ? 'text-alarme' : ''}`}>{formatarNumero(p.value, 1, 1)} °C</span>
        </p>
      ))}
    </div>
  );
}

export default function GraficoTemperatura({ historico, pontos, onPontos }) {
  const vazio = historico.length === 0;
  const [ocultas, setOcultas] = useState(() => new Set());

  const alternar = (maquina) =>
    setOcultas((atual) => {
      const novo = new Set(atual);
      if (novo.has(maquina)) novo.delete(maquina);
      else novo.add(maquina);
      return novo;
    });

  return (
    <section aria-labelledby="titulo-grafico" aria-describedby="descricao-grafico" className="mt-6 rounded border border-linha bg-painel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="titulo-grafico" className="font-condensada text-2xl font-semibold">
          Temperatura das máquinas
        </h2>
        <ControlesDoGrafico ocultas={ocultas} onAlternar={alternar} pontos={pontos} onPontos={onPontos} />
      </div>

      <p id="descricao-grafico" className="sr-only">
        Gráfico de linhas com a temperatura de cada máquina nos últimos instantes e a linha do limite de {LIMITE_TEMPERATURA} °C. Os valores
        atuais estão nos cartões das máquinas.
      </p>

      <div className="relative mt-4 h-72 w-full md:h-96">
        {vazio && (
          <p className="absolute inset-0 z-10 flex items-center justify-center text-sm text-suave">
            O gráfico começa a ser desenhado quando chegarem as primeiras leituras.
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
              domain={[(min) => Math.floor(Math.min(min, LIMITE_TEMPERATURA) - 5), (max) => Math.ceil(Math.max(max, LIMITE_TEMPERATURA) + 5)]}
              tickFormatter={(v) => `${v}°`}
              width={44}
              stroke="rgb(var(--suave))"
              tick={{ fill: 'rgb(var(--suave))', fontSize: 12 }}
            />
            <ReferenceLine y={LIMITE_TEMPERATURA} stroke="rgb(var(--alarme))" strokeDasharray="6 4" strokeWidth={1.5} />
            <Tooltip content={<BalaoDoGrafico />} cursor={{ stroke: 'rgb(var(--suave))', strokeDasharray: '3 3' }} />
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
