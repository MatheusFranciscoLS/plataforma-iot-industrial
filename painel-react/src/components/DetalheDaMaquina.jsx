import { useIdioma } from '@/i18n/idioma-contexto';
import { useLeiturasDaMaquina } from '@/hooks/useLeiturasDaMaquina';
import { resumirLeituras } from '@/lib/estatisticas';
import { formatarNumero, motivosDaLeitura } from '@/lib/limites';
import { METRICAS } from '@/lib/metricas';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const CAMPO_DO_RESUMO = { temperaturaMotor: 'temperatura', vibracao: 'vibracao', rpm: 'rpm' };

function Estatisticas({ resumo }) {
  const { t, locale } = useIdioma();
  const hora = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString(locale);

  return (
    <div className="mt-4">
      <p className="text-sm text-suave">
        {t('detalhe.resumo', { n: resumo.quantidade, inicio: hora(resumo.inicio), fim: hora(resumo.fim) })}{' '}
        <span className={resumo.acimaDoLimite.quantidade > 0 ? 'font-medium text-alarme' : undefined}>
          {t('detalhe.acima', {
            n: resumo.acimaDoLimite.quantidade,
            pct: formatarNumero(resumo.acimaDoLimite.percentual, 1, 1, locale),
          })}
        </span>
      </p>

      <table className="mt-3 w-full text-left text-sm">
        <caption className="sr-only">{t('detalhe.legenda')}</caption>
        <thead>
          <tr className="border-b border-linha text-suave">
            <th scope="col" className="py-2 pr-3 font-medium">{t('detalhe.grandeza')}</th>
            <th scope="col" className="py-2 pr-3 font-medium">{t('detalhe.min')}</th>
            <th scope="col" className="py-2 pr-3 font-medium">{t('detalhe.media')}</th>
            <th scope="col" className="py-2 font-medium">{t('detalhe.max')}</th>
          </tr>
        </thead>
        <tbody>
          {METRICAS.map((m) => {
            const linha = resumo[CAMPO_DO_RESUMO[m.id]];
            if (!linha) return null;
            const valor = (v) => `${formatarNumero(v, m.casas, m.casas, locale)} ${m.unidade}`;
            return (
              <tr key={m.id} className="border-b border-linha">
                <th scope="row" className="py-2 pr-3 font-medium">{t(`metrica.${m.id}`)}</th>
                <td className="numero py-2 pr-3 text-base">{valor(linha.min)}</td>
                <td className="numero py-2 pr-3 text-base">{valor(linha.media)}</td>
                <td className={cn('numero py-2 text-base', m.limite !== null && linha.max > m.limite && 'text-alarme')}>{valor(linha.max)}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function UltimasLeituras({ leituras }) {
  const i18n = useIdioma();
  const { t, locale } = i18n;
  const recentes = [...leituras].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);

  return (
    <div className="mt-5">
      <h3 className="font-condensada text-xl font-semibold">{t('detalhe.ultimas')}</h3>
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-linha text-suave">
            <th scope="col" className="py-2 pr-3 font-medium">{t('detalhe.hora')}</th>
            <th scope="col" className="py-2 pr-3 font-medium">{t('metrica.temperaturaMotor')}</th>
            <th scope="col" className="py-2 pr-3 font-medium">{t('metrica.vibracao')}</th>
            <th scope="col" className="py-2 font-medium">{t('metrica.rpm')}</th>
          </tr>
        </thead>
        <tbody>
          {recentes.map((l, i) => {
            const motivos = motivosDaLeitura(l, i18n);
            return (
              <tr key={l.id ?? i} className={cn('border-b border-linha', motivos.length > 0 && 'text-alarme')}>
                <td className="numero py-1.5 pr-3 text-base">{new Date(l.timestamp * 1000).toLocaleTimeString(locale)}</td>
                <td className="numero py-1.5 pr-3 text-base">{formatarNumero(l.temperaturaMotor, 1, 1, locale)} °C</td>
                <td className="numero py-1.5 pr-3 text-base">{formatarNumero(l.vibracao, 2, 2, locale)} mm/s</td>
                <td className="numero py-1.5 text-base">{formatarNumero(l.rpm, 0, 0, locale)} rpm</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/** Janela com os números de uma máquina: estatísticas das últimas leituras e a lista das mais recentes. */
export default function DetalheDaMaquina({ token, maquina, aoFechar, onSessaoInvalida }) {
  const { t } = useIdioma();
  const { leituras, carregando, erro } = useLeiturasDaMaquina(token, maquina, onSessaoInvalida);
  const resumo = resumirLeituras(leituras);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-painel text-tinta">
        <DialogHeader>
          <DialogTitle className="font-condensada text-3xl font-semibold">{maquina}</DialogTitle>
          <DialogDescription>{t('detalhe.descricao')}</DialogDescription>
        </DialogHeader>

        {carregando && <p className="text-sm text-suave">{t('detalhe.carregando')}</p>}
        {erro && <p role="alert" className="text-sm font-medium text-alarme">{t('detalhe.erro')}</p>}
        {!carregando && !erro && !resumo && <p className="text-sm text-suave">{t('detalhe.vazio')}</p>}
        {resumo && (
          <>
            <Estatisticas resumo={resumo} />
            <UltimasLeituras leituras={leituras} />
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
