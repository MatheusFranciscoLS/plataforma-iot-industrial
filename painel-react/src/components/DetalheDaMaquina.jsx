import { useLeiturasDaMaquina } from '@/hooks/useLeiturasDaMaquina';
import { resumirLeituras } from '@/lib/estatisticas';
import { formatarNumero, motivosDaLeitura } from '@/lib/limites';
import { METRICAS } from '@/lib/metricas';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

const hora = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString('pt-BR');
const CAMPO_DO_RESUMO = { temperaturaMotor: 'temperatura', vibracao: 'vibracao', rpm: 'rpm' };

function Estatisticas({ resumo }) {
  return (
    <div className="mt-4">
      <p className="text-sm text-suave">
        {resumo.quantidade} leituras, das {hora(resumo.inicio)} às {hora(resumo.fim)}.{' '}
        <span className={resumo.acimaDoLimite.quantidade > 0 ? 'font-medium text-alarme' : undefined}>
          {resumo.acimaDoLimite.quantidade} passaram de algum limite ({formatarNumero(resumo.acimaDoLimite.percentual, 1, 1)}%).
        </span>
      </p>

      <table className="mt-3 w-full text-left text-sm">
        <caption className="sr-only">Mínimo, média e máximo de cada grandeza</caption>
        <thead>
          <tr className="border-b border-linha text-suave">
            <th scope="col" className="py-2 pr-3 font-medium">Grandeza</th>
            <th scope="col" className="py-2 pr-3 font-medium">Mínimo</th>
            <th scope="col" className="py-2 pr-3 font-medium">Média</th>
            <th scope="col" className="py-2 font-medium">Máximo</th>
          </tr>
        </thead>
        <tbody>
          {METRICAS.map((m) => {
            const linha = resumo[CAMPO_DO_RESUMO[m.id]];
            if (!linha) return null;
            const valor = (v) => `${formatarNumero(v, m.casas, m.casas)} ${m.unidade}`;
            return (
              <tr key={m.id} className="border-b border-linha">
                <th scope="row" className="py-2 pr-3 font-medium">{m.rotulo}</th>
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
  const recentes = [...leituras].sort((a, b) => b.timestamp - a.timestamp).slice(0, 10);
  return (
    <div className="mt-5">
      <h3 className="font-condensada text-xl font-semibold">Últimas leituras</h3>
      <table className="mt-2 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-linha text-suave">
            <th scope="col" className="py-2 pr-3 font-medium">Hora</th>
            <th scope="col" className="py-2 pr-3 font-medium">Temperatura</th>
            <th scope="col" className="py-2 pr-3 font-medium">Vibração</th>
            <th scope="col" className="py-2 font-medium">Rotação</th>
          </tr>
        </thead>
        <tbody>
          {recentes.map((l, i) => {
            const motivos = motivosDaLeitura(l);
            return (
              <tr key={l.id ?? i} className={cn('border-b border-linha', motivos.length > 0 && 'text-alarme')}>
                <td className="numero py-1.5 pr-3 text-base">{hora(l.timestamp)}</td>
                <td className="numero py-1.5 pr-3 text-base">{formatarNumero(l.temperaturaMotor, 1, 1)} °C</td>
                <td className="numero py-1.5 pr-3 text-base">{formatarNumero(l.vibracao, 2, 2)} mm/s</td>
                <td className="numero py-1.5 text-base">{formatarNumero(l.rpm, 0)} rpm</td>
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
  const { leituras, carregando, erro } = useLeiturasDaMaquina(token, maquina, onSessaoInvalida);
  const resumo = resumirLeituras(leituras);

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-painel text-tinta">
        <DialogHeader>
          <DialogTitle className="font-condensada text-3xl font-semibold">{maquina}</DialogTitle>
          <DialogDescription>Números das últimas leituras desta máquina, buscados na API.</DialogDescription>
        </DialogHeader>

        {carregando && <p className="text-sm text-suave">Carregando as leituras…</p>}
        {erro && <p role="alert" className="text-sm font-medium text-alarme">Não foi possível carregar as leituras desta máquina.</p>}
        {!carregando && !erro && !resumo && <p className="text-sm text-suave">Esta máquina ainda não tem leituras.</p>}
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
