import { useState } from 'react';
import { useResumo } from '@/hooks/useServidorPorPeriodo';
import { useIdioma } from '@/i18n/idioma-contexto';
import { formatarNumero } from '@/lib/limites';
import { PERIODOS } from '@/lib/periodos';
import { cn } from '@/lib/utils';

/** Uma barra proporcional ao maior valor da coluna: dá para ver de relance qual máquina trabalha mais quente, vibra mais... */
function Barra({ valor, maximo }) {
  const largura = maximo > 0 ? Math.max(2, Math.round((valor / maximo) * 100)) : 0;
  return (
    <span aria-hidden="true" className="mt-1 block h-1.5 w-full rounded bg-linha">
      <span className="block h-full rounded bg-aco" style={{ width: `${largura}%` }} />
    </span>
  );
}

/**
 * Tabela que compara as máquinas em um período (1 h, 6 h ou 24 h), com os números calculados no servidor:
 * média e máximo de temperatura e vibração, rotação média e quantos alertas cada uma teve.
 */
export default function ComparacaoDeMaquinas({ token, onSessaoInvalida }) {
  const { t, locale } = useIdioma();
  const [periodo, setPeriodo] = useState('1h');
  const { dados, carregando, erro } = useResumo(token, periodo, onSessaoInvalida);
  const maquinas = Array.isArray(dados?.maquinas) ? dados.maquinas : [];

  const numero = (v, casas) => formatarNumero(v, casas, casas, locale);
  const maior = (campo) => Math.max(0, ...maquinas.map((m) => m[campo]));
  const maiorMedia = { temperatura: maior('temperaturaMedia'), vibracao: maior('vibracaoMedia'), rpm: maior('rpmMedio') };

  return (
    <section aria-labelledby="titulo-comparacao" className="mt-6 rounded border border-linha bg-painel p-5">
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="titulo-comparacao" className="font-condensada text-2xl font-semibold">
            {t('comparacao.titulo')}
          </h2>
          <p className="mt-1 text-sm text-suave">{t('comparacao.descricao')}</p>
        </div>
        <div role="group" aria-label={t('controles.periodo')} className="flex flex-wrap items-center gap-2 text-sm">
          {PERIODOS.map((p) => (
            <button
              key={p}
              type="button"
              aria-pressed={periodo === p}
              onClick={() => setPeriodo(p)}
              className={cn('min-h-11 rounded border px-3 font-medium', periodo === p ? 'border-aco bg-aco text-painel' : 'border-linha')}
            >
              {t(`periodo.${p}`)}
            </button>
          ))}
        </div>
      </div>

      {erro && (
        <p role="alert" className="mt-4 text-sm text-alarme">
          {t('comparacao.erro')}
        </p>
      )}
      {carregando && <p className="mt-4 text-sm text-suave">{t('comparacao.carregando')}</p>}
      {!carregando && !erro && maquinas.length === 0 && <p className="mt-4 text-sm text-suave">{t('comparacao.vazio')}</p>}

      {maquinas.length > 0 && (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full min-w-[34rem] text-left text-sm">
            <caption className="sr-only">{t('comparacao.legenda')}</caption>
            <thead>
              <tr className="border-b border-linha text-suave">
                <th scope="col" className="py-2 pr-3 font-medium">{t('comparacao.maquina')}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{t('comparacao.leituras')}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{t('comparacao.temperatura')}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{t('comparacao.vibracao')}</th>
                <th scope="col" className="py-2 pr-3 font-medium">{t('comparacao.rotacao')}</th>
                <th scope="col" className="py-2 font-medium">{t('comparacao.alertas')}</th>
              </tr>
            </thead>
            <tbody>
              {maquinas.map((m) => {
                const alertas = m.alertasTemperatura + m.alertasVibracao;
                return (
                  <tr key={m.idMaquina} className="border-b border-linha align-top">
                    <th scope="row" className="numero py-2 pr-3 text-base font-normal">{m.idMaquina}</th>
                    <td className="numero py-2 pr-3 text-base">{numero(m.leituras, 0)}</td>
                    <td className="py-2 pr-3">
                      <span className="numero text-base">{numero(m.temperaturaMedia, 1)} °C</span>
                      <span className="text-suave"> / {numero(m.temperaturaMax, 1)} °C</span>
                      <Barra valor={m.temperaturaMedia} maximo={maiorMedia.temperatura} />
                    </td>
                    <td className="py-2 pr-3">
                      <span className="numero text-base">{numero(m.vibracaoMedia, 2)} mm/s</span>
                      <span className="text-suave"> / {numero(m.vibracaoMax, 2)} mm/s</span>
                      <Barra valor={m.vibracaoMedia} maximo={maiorMedia.vibracao} />
                    </td>
                    <td className="py-2 pr-3">
                      <span className="numero text-base">{numero(m.rpmMedio, 0)} rpm</span>
                      <Barra valor={m.rpmMedio} maximo={maiorMedia.rpm} />
                    </td>
                    <td className={cn('numero py-2 text-base', alertas > 0 && 'font-medium text-alarme')}>{numero(alertas, 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
