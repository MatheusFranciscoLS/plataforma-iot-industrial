import { useMemo, useState } from 'react';
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useSerie } from '@/hooks/useServidorPorPeriodo';
import { useIdioma } from '@/i18n/idioma-contexto';
import { formatarNumero } from '@/lib/limites';
import { METRICAS } from '@/lib/metricas';
import { faixaEmMinutos, PERIODOS, serieDaMaquinaParaLinhas } from '@/lib/periodos';
import { cn } from '@/lib/utils';

function Balao({ active, payload, label, metrica, hora, locale }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded border border-linha bg-painel px-3 py-2 text-sm shadow-md">
      <p className="mb-1 font-semibold">{hora(label)}</p>
      {payload.map((p) => (
        <p key={p.dataKey} className="flex justify-between gap-4">
          <span className="text-suave">{p.name}</span>
          <span className="numero">
            {formatarNumero(p.value, metrica.casas, metrica.casas, locale)} {metrica.unidade}
          </span>
        </p>
      ))}
    </div>
  );
}

/**
 * Evolução de uma máquina em um período (1 h, 6 h ou 24 h): a média de cada faixa de tempo e, onde faz sentido,
 * o máximo, com a linha do limite da própria máquina. Os números vêm do servidor.
 */
export default function GraficoDaMaquina({ token, maquina, limites, onSessaoInvalida }) {
  const { t, locale } = useIdioma();
  const [periodo, setPeriodo] = useState('1h');
  const [metrica, setMetrica] = useState(METRICAS[0]);
  const { dados, carregando, erro } = useSerie(token, periodo, maquina, onSessaoInvalida);
  const linhas = useMemo(() => serieDaMaquinaParaLinhas(dados, maquina, metrica.id), [dados, maquina, metrica]);

  const limite = metrica.limiteDe ? limites[metrica.limiteDe] : null;
  const temMaximo = linhas.some((l) => l.maximo !== null && l.maximo !== undefined);
  const hora = (ts) => new Date(ts * 1000).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' });
  const faixa = faixaEmMinutos(dados);

  const botao = (ativo) => cn('min-h-11 rounded border px-3 text-sm font-medium', ativo ? 'border-aco bg-aco text-painel' : 'border-linha');

  return (
    <div className="mt-5">
      <h3 className="font-condensada text-xl font-semibold">{t('detalhe.graficoTitulo')}</h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-6 gap-y-2">
        <div role="group" aria-label={t('controles.periodo')} className="flex flex-wrap gap-2">
          {PERIODOS.map((p) => (
            <button key={p} type="button" aria-pressed={periodo === p} onClick={() => setPeriodo(p)} className={botao(periodo === p)}>
              {t(`periodo.${p}`)}
            </button>
          ))}
        </div>
        <div role="group" aria-label={t('controles.grandeza')} className="flex flex-wrap gap-2">
          {METRICAS.map((m) => (
            <button key={m.id} type="button" aria-pressed={metrica.id === m.id} onClick={() => setMetrica(m)} className={botao(metrica.id === m.id)}>
              {t(`metrica.${m.id}`)}
            </button>
          ))}
        </div>
      </div>

      {faixa && <p className="mt-2 text-xs text-suave">{t('grafico.mediaPorFaixa', { min: faixa })}</p>}

      <div className="relative mt-3 h-56 w-full">
        {linhas.length === 0 && (
          <p
            role={erro ? 'alert' : undefined}
            className={`absolute inset-0 z-10 flex items-center justify-center text-sm ${erro ? 'text-alarme' : 'text-suave'}`}
          >
            {erro ? t('grafico.erroPeriodo') : carregando ? t('grafico.carregandoPeriodo') : t('grafico.vazioPeriodo')}
          </p>
        )}
        <ResponsiveContainer>
          <LineChart data={linhas} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="rgb(var(--linha))" vertical={false} />
            <XAxis
              dataKey="timestamp"
              type="number"
              domain={['dataMin', 'dataMax']}
              tickFormatter={hora}
              tickMargin={8}
              minTickGap={48}
              stroke="rgb(var(--suave))"
              tick={{ fill: 'rgb(var(--suave))', fontSize: 12 }}
            />
            <YAxis
              domain={[
                (min) => Math.max(0, Math.floor(Math.min(min, limite ?? min) - metrica.margem)),
                (max) => Math.ceil(Math.max(max, limite ?? max) + metrica.margem),
              ]}
              tickFormatter={(v) => formatarNumero(v, metrica.casasEixo, 0, locale)}
              width={metrica.id === 'rpm' ? 52 : 44}
              stroke="rgb(var(--suave))"
              tick={{ fill: 'rgb(var(--suave))', fontSize: 12 }}
            />
            {limite !== null && <ReferenceLine y={limite} stroke="rgb(var(--alarme))" strokeDasharray="6 4" strokeWidth={1.5} />}
            <Tooltip content={<Balao metrica={metrica} hora={hora} locale={locale} />} cursor={{ stroke: 'rgb(var(--suave))', strokeDasharray: '3 3' }} />
            <Line dataKey="media" name={t('detalhe.media')} stroke="rgb(var(--serie-1))" strokeWidth={2.5} type="monotone" dot={false} isAnimationActive={false} />
            {temMaximo && (
              <Line dataKey="maximo" name={t('detalhe.max')} stroke="rgb(var(--serie-2))" strokeWidth={1.5} strokeDasharray="6 3" type="monotone" dot={false} isAnimationActive={false} />
            )}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
