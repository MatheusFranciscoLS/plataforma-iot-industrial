import { AlertTriangle } from 'lucide-react';
import { useIdioma } from '@/i18n/idioma-contexto';
import { descreverAlerta } from '@/lib/limites';

/**
 * Os alertas mais recentes, guardados no servidor: continuam aí depois de recarregar a página.
 * Cada passada de limite gera um alerta (enquanto a máquina segue acima do limite, não repete).
 */
export default function AlertasRecentes({ alertas, erro }) {
  const i18n = useIdioma();
  const { t, locale } = i18n;
  const hora = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString(locale);

  return (
    <section aria-labelledby="titulo-alertas" className="mt-6 rounded border border-linha bg-painel p-5">
      <h2 id="titulo-alertas" className="font-condensada text-2xl font-semibold">
        {t('alertas.titulo')}
      </h2>

      {erro && (
        <p role="alert" className="mt-3 text-sm text-alarme">
          {t('alertas.erro')}
        </p>
      )}

      {alertas.length === 0 ? (
        <p className="mt-3 text-sm text-suave">{t('alertas.vazio')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-linha">
          {alertas.map((alerta) => {
            const { motivo, valor } = descreverAlerta(alerta, i18n);
            return (
              <li key={alerta.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 text-sm">
                <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 self-center text-alarme" />
                <span className="numero w-24 text-base">{hora(alerta.timestamp)}</span>
                <span className="numero w-16 text-base">{alerta.idMaquina}</span>
                <span className="text-alarme">{motivo}</span>
                <span className="numero text-base">{valor}</span>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
