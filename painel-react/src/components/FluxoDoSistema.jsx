import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';
import { useIdioma } from '@/i18n/idioma-contexto';

// O caminho de uma leitura, do sensor até a tela. Cada texto descreve o que o código do repositório faz.
const ETAPAS = ['sensores', 'api', 'fila', 'gateway', 'painel'];

export default function FluxoDoSistema() {
  const { t } = useIdioma();

  return (
    <section aria-labelledby="titulo-fluxo" className="mt-10">
      <h2 id="titulo-fluxo" className="font-condensada text-2xl font-semibold">
        {t('fluxo.titulo')}
      </h2>

      <ol className="mt-4 flex flex-col items-stretch gap-1 lg:flex-row lg:items-stretch lg:gap-0">
        {ETAPAS.map((etapa, i) => (
          <Fragment key={etapa}>
            <li className="flex-1 rounded border border-linha bg-painel p-4">
              <p className="font-condensada text-xl font-semibold">{t(`fluxo.${etapa}`)}</p>
              <p className="mt-1 text-sm text-suave">{t(`fluxo.${etapa}.detalhe`)}</p>
            </li>
            {i < ETAPAS.length - 1 && (
              <li aria-hidden="true" className="flex items-center justify-center py-0.5 text-suave lg:px-1 lg:py-0">
                <ChevronDown className="h-5 w-5 lg:hidden" />
                <ChevronRight className="hidden h-5 w-5 lg:block" />
              </li>
            )}
          </Fragment>
        ))}
      </ol>

      <p className="mt-3 text-sm text-suave">{t('fluxo.nota')}</p>
    </section>
  );
}
