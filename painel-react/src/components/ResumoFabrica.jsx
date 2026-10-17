import { AlertTriangle, CheckCircle2, Clock, Unplug } from 'lucide-react';
import { useIdioma } from '@/i18n/idioma-contexto';
import { cn } from '@/lib/utils';

const ICONES = {
  critico: AlertTriangle,
  normal: CheckCircle2,
  atencao: Unplug,
  aguardando: Clock,
};

/**
 * A primeira coisa da tela: uma frase que diz se a fábrica está bem.
 * Fica cinza quando está tudo normal e vira uma faixa vermelha cheia quando há máquina crítica.
 */
export default function ResumoFabrica({ resumo, maquinasAfetadas, total }) {
  const { t } = useIdioma();
  const Icone = ICONES[resumo.nivel];
  const critico = resumo.nivel === 'critico';

  const detalhe =
    maquinasAfetadas.length > 0
      ? maquinasAfetadas.join(', ')
      : resumo.nivel === 'normal'
        ? t('resumo.monitoradas', { n: total })
        : null;

  return (
    <section
      role="status"
      aria-label={t('resumo.aria')}
      className={cn(
        'mt-6 flex items-center gap-4 rounded border px-5 py-4',
        critico ? 'border-alarme bg-alarme text-painel' : 'border-linha bg-painel',
      )}
    >
      <Icone aria-hidden="true" className="h-8 w-8 shrink-0" />
      <p className="font-condensada text-3xl font-semibold leading-tight sm:text-4xl">
        {resumo.texto}
        {detalhe && (
          <span className={cn('block text-xl font-medium sm:ml-4 sm:inline', critico ? 'opacity-90' : 'text-suave')}>
            {detalhe}
          </span>
        )}
      </p>
    </section>
  );
}
