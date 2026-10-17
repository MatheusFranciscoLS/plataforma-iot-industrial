import { AlertTriangle, CheckCheck, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useIdioma } from '@/i18n/idioma-contexto';
import { descreverAlerta, MAQUINAS } from '@/lib/limites';

const TIPOS = ['TEMPERATURA', 'VIBRACAO'];

function Filtro({ id, rotulo, valor, onChange, children }) {
  return (
    <div>
      <label htmlFor={id} className="block text-xs text-suave">
        {rotulo}
      </label>
      <select
        id={id}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 h-9 rounded border border-linha bg-fundo px-2 text-sm text-tinta focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
      >
        {children}
      </select>
    </div>
  );
}

/** Estado do filtro "reconhecido" na tela ('' = todos, 'nao' = sem reconhecer, 'sim' = reconhecidos) → o que a API espera. */
const RECONHECIDO = { nao: false, sim: true };

/**
 * Os alertas guardados no servidor: continuam aí depois de recarregar a página.
 * Cada passada de limite gera um alerta (enquanto a máquina segue acima do limite, não repete).
 * Os recursos extras só aparecem quando a tela recebe a função correspondente:
 * `onReconhecer` (botão de reconhecer), `onFiltros` (filtros), `onMais` (mostrar mais) e `onLimites` (abrir os limites).
 */
export default function AlertasRecentes({
  alertas,
  erro,
  pendentes = null,
  erroAoReconhecer = false,
  filtros = {},
  onReconhecer,
  onFiltros,
  onMais,
  onLimites,
}) {
  const i18n = useIdioma();
  const { t, locale } = i18n;
  const hora = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString(locale);

  const semReconhecer = pendentes ?? alertas.filter((a) => !a.reconhecidoPor).length;
  const filtrando = Boolean(filtros.maquina || filtros.tipo || typeof filtros.reconhecido === 'boolean');
  const estado = filtros.reconhecido === false ? 'nao' : filtros.reconhecido === true ? 'sim' : '';

  const mudar = (campo, valor) => onFiltros({ ...filtros, [campo]: valor === '' ? undefined : valor });

  return (
    <section aria-labelledby="titulo-alertas" className="mt-6 rounded border border-linha bg-painel p-5">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h2 id="titulo-alertas" className="font-condensada text-2xl font-semibold">
            {t('alertas.titulo')}
          </h2>
          {semReconhecer > 0 && (
            <span className="rounded border border-alarme px-2 py-0.5 text-sm font-medium text-alarme">
              {t('alertas.pendentes', { n: semReconhecer })}
            </span>
          )}
        </div>
        {onLimites && (
          <Button variant="outline" size="sm" onClick={onLimites}>
            <SlidersHorizontal aria-hidden="true" />
            {t('alertas.limites')}
          </Button>
        )}
      </div>

      {onFiltros && (
        <div role="group" aria-label={t('alertas.filtros')} className="mt-4 flex flex-wrap gap-x-4 gap-y-3">
          <Filtro id="filtro-maquina" rotulo={t('alertas.filtro.maquina')} valor={filtros.maquina ?? ''} onChange={(v) => mudar('maquina', v)}>
            <option value="">{t('alertas.filtro.todas')}</option>
            {MAQUINAS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </Filtro>
          <Filtro id="filtro-tipo" rotulo={t('alertas.filtro.tipo')} valor={filtros.tipo ?? ''} onChange={(v) => mudar('tipo', v)}>
            <option value="">{t('alertas.filtro.todos')}</option>
            {TIPOS.map((tipo) => (
              <option key={tipo} value={tipo}>
                {t(`alertas.tipo.${tipo}`)}
              </option>
            ))}
          </Filtro>
          <Filtro
            id="filtro-estado"
            rotulo={t('alertas.filtro.estado')}
            valor={estado}
            onChange={(v) => mudar('reconhecido', RECONHECIDO[v])}
          >
            <option value="">{t('alertas.filtro.todos')}</option>
            <option value="nao">{t('alertas.estado.pendentes')}</option>
            <option value="sim">{t('alertas.estado.reconhecidos')}</option>
          </Filtro>
        </div>
      )}

      {erro && (
        <p role="alert" className="mt-3 text-sm text-alarme">
          {t('alertas.erro')}
        </p>
      )}
      {erroAoReconhecer && (
        <p role="alert" className="mt-3 text-sm text-alarme">
          {t('alertas.erroReconhecer')}
        </p>
      )}

      {alertas.length === 0 ? (
        <p className="mt-3 text-sm text-suave">{filtrando ? t('alertas.vazioFiltro') : t('alertas.vazio')}</p>
      ) : (
        <ul className="mt-3 divide-y divide-linha">
          {alertas.map((alerta) => {
            const { motivo, valor } = descreverAlerta(alerta, i18n);
            return (
              <li key={alerta.id} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 text-sm">
                <AlertTriangle aria-hidden="true" className={`h-4 w-4 shrink-0 self-center ${alerta.reconhecidoPor ? 'text-suave' : 'text-alarme'}`} />
                <span className="numero w-24 text-base">{hora(alerta.timestamp)}</span>
                <span className="numero w-16 text-base">{alerta.idMaquina}</span>
                <span className={alerta.reconhecidoPor ? 'text-suave' : 'text-alarme'}>{motivo}</span>
                <span className="numero text-base">{valor}</span>
                {alerta.reconhecidoPor ? (
                  <span className="flex items-center gap-1 text-suave sm:ml-auto">
                    <CheckCheck aria-hidden="true" className="h-4 w-4" />
                    {t('alertas.reconhecidoPor', { nome: alerta.reconhecidoPor })}
                  </span>
                ) : (
                  onReconhecer && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="sm:ml-auto"
                      aria-label={t('alertas.reconhecerAria', { maquina: alerta.idMaquina, hora: hora(alerta.timestamp) })}
                      onClick={() => onReconhecer(alerta.id)}
                    >
                      {t('alertas.reconhecer')}
                    </Button>
                  )
                )}
              </li>
            );
          })}
        </ul>
      )}

      {onMais && (
        <Button variant="outline" size="sm" className="mt-3" onClick={onMais}>
          {t('alertas.maisAlertas')}
        </Button>
      )}
    </section>
  );
}
