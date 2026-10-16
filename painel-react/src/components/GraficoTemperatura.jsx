import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { formatarNumero, LIMITE_TEMPERATURA, MAQUINAS } from '@/lib/limites';

// Cada máquina tem uma cor cinza-azulada e um tipo de traço, para dar para separar as linhas sem depender só da cor.
const SERIES = [
  { chave: MAQUINAS[0], cor: 'rgb(var(--serie-1))', traco: undefined },
  { chave: MAQUINAS[1], cor: 'rgb(var(--serie-2))', traco: '8 4' },
  { chave: MAQUINAS[2], cor: 'rgb(var(--serie-3))', traco: '2 3' },
];

const hora = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString('pt-BR');

function Legenda() {
  return (
    <ul className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
      {SERIES.map(({ chave, cor, traco }) => (
        <li key={chave} className="flex items-center gap-2">
          <svg aria-hidden="true" width="28" height="8" viewBox="0 0 28 8">
            <line x1="0" x2="28" y1="4" y2="4" stroke={cor} strokeWidth="3" strokeDasharray={traco} />
          </svg>
          {chave}
        </li>
      ))}
      <li className="flex items-center gap-2 text-alarme">
        <svg aria-hidden="true" width="28" height="8" viewBox="0 0 28 8">
          <line x1="0" x2="28" y1="4" y2="4" className="stroke-alarme" strokeWidth="2" strokeDasharray="6 4" />
        </svg>
        Limite de {LIMITE_TEMPERATURA} °C
      </li>
    </ul>
  );
}

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

export default function GraficoTemperatura({ historico }) {
  const vazio = historico.length === 0;

  return (
    <section aria-labelledby="titulo-grafico" className="mt-6 rounded border border-linha bg-painel p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2">
        <h2 id="titulo-grafico" className="font-condensada text-2xl font-semibold">
          Temperatura das máquinas
        </h2>
        <Legenda />
      </div>

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
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </section>
  );
}
