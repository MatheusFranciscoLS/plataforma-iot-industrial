import { useIdioma } from '@/i18n/idioma-contexto';
import { formatarNumero } from '@/lib/limites';
import { OPCOES_PONTOS } from '@/lib/historico';
import { METRICAS } from '@/lib/metricas';
import { SERIES } from '@/lib/series';
import { cn } from '@/lib/utils';

/**
 * Controles do gráfico: qual grandeza desenhar, quais máquinas aparecem (a legenda é clicável)
 * e quantos pontos mostrar.
 */
export default function ControlesDoGrafico({ ocultas, onAlternar, pontos, onPontos, metrica, onMetrica, limites = [metrica.limite] }) {
  const { t, locale } = useIdioma();

  return (
    <div className="flex flex-col items-start gap-3 md:items-end">
      <div role="group" aria-label={t('controles.grandeza')} className="flex flex-wrap items-center gap-2 text-sm">
        {METRICAS.map((m) => (
          <button
            key={m.id}
            type="button"
            aria-pressed={metrica.id === m.id}
            onClick={() => onMetrica(m)}
            className={cn(
              'min-h-11 rounded border px-3 font-medium',
              metrica.id === m.id ? 'border-aco bg-aco text-painel' : 'border-linha',
            )}
          >
            {t(`metrica.${m.id}`)}
          </button>
        ))}
      </div>

      <div role="group" aria-label={t('controles.maquinas')} className="flex flex-wrap items-center gap-x-2 gap-y-1">
        {SERIES.map(({ chave, cor, traco }) => {
          const oculta = ocultas.has(chave);
          return (
            <button
              key={chave}
              type="button"
              aria-pressed={!oculta}
              onClick={() => onAlternar(chave)}
              className={cn(
                'flex min-h-11 items-center gap-2 rounded border border-linha px-3 text-sm',
                oculta ? 'text-suave line-through' : 'font-medium',
              )}
            >
              <svg aria-hidden="true" width="28" height="8" viewBox="0 0 28 8" className={oculta ? 'opacity-40' : undefined}>
                <line x1="0" x2="28" y1="4" y2="4" stroke={cor} strokeWidth="3" strokeDasharray={traco} />
              </svg>
              {chave}
            </button>
          );
        })}
        {metrica.limite !== null && (
          <span className="flex items-center gap-2 px-2 text-sm text-alarme">
            <svg aria-hidden="true" width="28" height="8" viewBox="0 0 28 8">
              <line x1="0" x2="28" y1="4" y2="4" className="stroke-alarme" strokeWidth="2" strokeDasharray="6 4" />
            </svg>
            {t('controles.limite', {
              valor: limites.map((l) => formatarNumero(l, metrica.casasLimite, metrica.casasLimite, locale)).join(' / '),
              unidade: metrica.unidade,
            })}
          </span>
        )}
      </div>

      <div role="group" aria-label={t('controles.pontos')} className="flex flex-wrap items-center gap-2 text-sm">
        <span className="text-suave">{t('controles.mostrar')}</span>
        {OPCOES_PONTOS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={pontos === n}
            onClick={() => onPontos(n)}
            className={cn(
              'min-h-11 min-w-11 rounded border px-3 font-medium',
              pontos === n ? 'border-aco bg-aco text-painel' : 'border-linha',
            )}
          >
            {n}
          </button>
        ))}
        <span className="text-suave">{t('controles.pontosSufixo')}</span>
      </div>
    </div>
  );
}
