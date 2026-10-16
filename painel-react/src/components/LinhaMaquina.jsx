import { AlertTriangle, CircleDot, Clock, Unplug } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatarNumero, LIMITE_TEMPERATURA, LIMITE_VIBRACAO } from '@/lib/limites';
import Medidor from './Medidor';
import Sparkline from './Sparkline';

// Escalas das barras e do mini gráfico (só definem o tamanho do desenho, não os limites de alerta).
const TEMP = { min: 40, max: 120 };
const VIB = { min: 0, max: 8 };

const ESTADOS = {
  normal: { texto: 'Normal', Icone: CircleDot },
  critica: { texto: 'Crítica', Icone: AlertTriangle },
  'sem-sinal': { texto: 'Sem sinal', Icone: Unplug },
  'sem-dados': { texto: 'Aguardando leitura', Icone: Clock },
};

function haQuantoTempo(recebidoEm, agora) {
  const s = Math.max(0, Math.round((agora - recebidoEm) / 1000));
  if (s < 60) return `há ${s} s`;
  return `há ${Math.floor(s / 60)} min`;
}

function Metrica({ rotulo, children, className }) {
  return (
    <div className={className}>
      <p className="text-sm text-suave">{rotulo}</p>
      {children}
    </div>
  );
}

export default function LinhaMaquina({ nome, dado, avaliacao, agora, serie }) {
  const { estado, motivos } = avaliacao;
  const { texto, Icone } = ESTADOS[estado];
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
        {dado && <p className="mt-1 text-xs text-suave">Atualizada {haQuantoTempo(dado.recebidoEm, agora)}</p>}
      </div>

      {semDados ? (
        <p className="text-sm text-suave col-span-2 md:col-span-3">Os valores aparecem assim que a máquina enviar a primeira leitura.</p>
      ) : (
        <>
          <Metrica rotulo="Temperatura do motor">
            <p className={cn('numero text-4xl leading-tight', semSinal && 'text-suave', dado.temperaturaMotor > LIMITE_TEMPERATURA && 'text-alarme')}>
              {formatarNumero(dado.temperaturaMotor, 1, 1)}
              <span className="ml-1 text-lg font-medium text-suave">°C</span>
            </p>
            <Medidor valor={dado.temperaturaMotor} limite={LIMITE_TEMPERATURA} {...TEMP} rotulo={`Temperatura de ${nome}`} />
          </Metrica>

          <Metrica rotulo="Vibração">
            <p className={cn('numero text-4xl leading-tight', semSinal && 'text-suave', dado.vibracao > LIMITE_VIBRACAO && 'text-alarme')}>
              {formatarNumero(dado.vibracao, 2, 2)}
              <span className="ml-1 text-lg font-medium text-suave">mm/s</span>
            </p>
            <Medidor valor={dado.vibracao} limite={LIMITE_VIBRACAO} {...VIB} rotulo={`Vibração de ${nome}`} />
          </Metrica>

          <Metrica rotulo="Rotação">
            <p className={cn('numero text-4xl leading-tight', semSinal && 'text-suave')}>{formatarNumero(dado.rpm, 0)}</p>
            <p className="text-sm text-suave">rpm</p>
          </Metrica>
        </>
      )}

      <div className="md:justify-self-end">
        <p className="mb-1 text-sm text-suave md:sr-only">Últimas temperaturas</p>
        <Sparkline valores={serie} limite={LIMITE_TEMPERATURA} />
      </div>
    </article>
  );
}
