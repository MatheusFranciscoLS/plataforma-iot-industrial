import { AlertTriangle, CircleDot, Clock, Unplug, Zap } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIdioma } from '@/i18n/idioma-contexto';
import { cn } from '@/lib/utils';
import { formatarNumero, LIMITES_PADRAO } from '@/lib/limites';
import Medidor from './Medidor';
import Sparkline from './Sparkline';

// Escalas das barras e do mini gráfico (só definem o tamanho do desenho, não os limites de alerta).
const TEMP = { min: 40, max: 120 };
const VIB = { min: 0, max: 8 };

const ESTADOS = {
  normal: { chave: 'estado.normal', Icone: CircleDot },
  critica: { chave: 'estado.critica', Icone: AlertTriangle },
  'sem-sinal': { chave: 'estado.semSinal', Icone: Unplug },
  'sem-dados': { chave: 'estado.semDados', Icone: Clock },
};

function haQuantoTempo(t, recebidoEm, agora) {
  const s = Math.max(0, Math.round((agora - recebidoEm) / 1000));
  if (s < 60) return t('maquina.haSegundos', { n: s });
  return t('maquina.haMinutos', { n: Math.floor(s / 60) });
}

function Metrica({ rotulo, children, className }) {
  return (
    <div className={className}>
      <p className="text-sm text-suave">{rotulo}</p>
      {children}
    </div>
  );
}

/**
 * `onDetalhes` mostra o botão "Ver detalhes"; `onSimularFalha` (só no modo demonstração, para operador e administrador)
 * mostra o botão "Simular falha".
 */
export default function LinhaMaquina({ nome, dado, avaliacao, agora, serie, limites = LIMITES_PADRAO, onDetalhes, onSimularFalha }) {
  const { t, locale } = useIdioma();
  const { estado, motivos } = avaliacao;
  const { chave, Icone } = ESTADOS[estado];
  const texto = t(chave);
  const critica = estado === 'critica';
  const semDados = estado === 'sem-dados';
  const semSinal = estado === 'sem-sinal';

  return (
    <article
      aria-label={`${nome}: ${texto}`}
      className={cn(
        'relative grid grid-cols-2 gap-x-6 gap-y-4 rounded border py-4 pl-6 pr-5 md:grid-cols-[minmax(10rem,1.1fr)_1.5fr_1.5fr_6rem_auto] md:items-center',
        critica && 'border-alarme bg-alarme-fundo',
        !critica && 'border-linha bg-painel',
        semSinal && 'border-dashed',
      )}
    >
      <span
        aria-hidden="true"
        className={cn('absolute inset-y-0 left-0 w-1.5 rounded-l', critica ? 'bg-alarme' : 'bg-linha')}
      />

      <div className="col-span-2 md:col-span-1">
        <h2 className="numero text-3xl leading-none">{nome}</h2>
        <p className={cn('mt-2 flex items-center gap-1.5 text-sm font-semibold', critica && 'text-alarme', (semSinal || semDados) && 'text-suave')}>
          <Icone aria-hidden="true" className="h-4 w-4" />
          {texto}
        </p>
        {critica && (
          <ul className="mt-1 text-sm font-medium text-alarme">
            {motivos.map((m) => (
              <li key={m}>{m}</li>
            ))}
          </ul>
        )}
        {dado && <p className="mt-1 text-xs text-suave">{t('maquina.atualizada', { quando: haQuantoTempo(t, dado.recebidoEm, agora) })}</p>}
        <div className="mt-2 flex flex-wrap gap-2">
          {onDetalhes && (
            <Button variant="outline" size="sm" onClick={() => onDetalhes(nome)} aria-label={t('maquina.detalhesAria', { nome })}>
              {t('maquina.detalhes')}
            </Button>
          )}
          {onSimularFalha && (
            <Button variant="outline" size="sm" onClick={() => onSimularFalha(nome)} aria-label={t('maquina.simularFalhaAria', { nome })}>
              <Zap aria-hidden="true" />
              {t('maquina.simularFalha')}
            </Button>
          )}
        </div>
      </div>

      {semDados ? (
        <p className="text-sm text-suave col-span-2 md:col-span-3">{t('maquina.semDados')}</p>
      ) : (
        <>
          <Metrica rotulo={t('maquina.temperatura')}>
            <p className={cn('numero text-4xl leading-tight', semSinal && 'text-suave', dado.temperaturaMotor > limites.temperatura && 'text-alarme')}>
              {formatarNumero(dado.temperaturaMotor, 1, 1, locale)}
              <span className="ml-1 text-lg font-medium text-suave">°C</span>
            </p>
            <Medidor valor={dado.temperaturaMotor} limite={limites.temperatura}{...TEMP} rotulo={t('maquina.temperaturaDe', { nome })} />
          </Metrica>

          <Metrica rotulo={t('maquina.vibracao')}>
            <p className={cn('numero text-4xl leading-tight', semSinal && 'text-suave', dado.vibracao > limites.vibracao && 'text-alarme')}>
              {formatarNumero(dado.vibracao, 2, 2, locale)}
              <span className="ml-1 text-lg font-medium text-suave">mm/s</span>
            </p>
            <Medidor valor={dado.vibracao} limite={limites.vibracao}{...VIB} rotulo={t('maquina.vibracaoDe', { nome })} />
          </Metrica>

          <Metrica rotulo={t('maquina.rotacao')}>
            <p className={cn('numero text-4xl leading-tight', semSinal && 'text-suave')}>{formatarNumero(dado.rpm, 0, 0, locale)}</p>
            <p className="text-sm text-suave">rpm</p>
          </Metrica>
        </>
      )}

      <div className="md:justify-self-end">
        <p className="mb-1 text-sm text-suave md:sr-only">{t('maquina.ultimasTemperaturas')}</p>
        <Sparkline valores={serie} limite={limites.temperatura} />
      </div>
    </article>
  );
}
