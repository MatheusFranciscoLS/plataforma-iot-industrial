import { AlertTriangle } from 'lucide-react';
import { alertasRecentes } from '@/lib/limites';

const hora = (timestamp) => new Date(timestamp * 1000).toLocaleTimeString('pt-BR');

/** As últimas leituras que passaram de algum limite, para não depender de olhar a tela no momento exato. */
export default function AlertasRecentes({ leituras }) {
  const alertas = alertasRecentes(leituras);

  return (
    <section aria-labelledby="titulo-alertas" className="mt-6 rounded border border-linha bg-painel p-5">
      <h2 id="titulo-alertas" className="font-condensada text-2xl font-semibold">
        Alertas recentes
      </h2>

      {alertas.length === 0 ? (
        <p className="mt-3 text-sm text-suave">Nenhuma leitura passou dos limites entre as leituras carregadas.</p>
      ) : (
        <ul className="mt-3 divide-y divide-linha">
          {alertas.map(({ leitura, motivos }) => (
            <li key={`${leitura.idMaquina}-${leitura.timestamp}-${leitura.id ?? ''}`} className="flex flex-wrap items-baseline gap-x-4 gap-y-1 py-2 text-sm">
              <AlertTriangle aria-hidden="true" className="h-4 w-4 shrink-0 self-center text-alarme" />
              <span className="numero w-20 text-base">{hora(leitura.timestamp)}</span>
              <span className="numero w-16 text-base">{leitura.idMaquina}</span>
              <span className="text-alarme">{motivos.join(' e ')}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
