import { ChevronDown, ChevronRight } from 'lucide-react';
import { Fragment } from 'react';

// O caminho de uma leitura, do sensor até a tela. Cada texto descreve o que o código do repositório faz.
const ETAPAS = [
  { nome: 'Sensores', detalhe: 'Python. Três máquinas enviam temperatura, rotação e vibração a cada 2 segundos.' },
  { nome: 'API', detalhe: 'Java e Spring Boot. Valida a leitura, salva no PostgreSQL e avisa a fila. Faz o login com JWT.' },
  { nome: 'Fila', detalhe: 'RabbitMQ. Guarda as leituras até o gateway buscar, então nada se perde se ele cair.' },
  { nome: 'Gateway', detalhe: 'Node.js e Socket.io. Entrega cada leitura por WebSocket, só para quem tem token válido.' },
  { nome: 'Painel', detalhe: 'React. Mostra os valores ao vivo e destaca na hora a máquina que passou do limite.' },
];

export default function FluxoDoSistema() {
  return (
    <section aria-labelledby="titulo-fluxo" className="mt-10">
      <h2 id="titulo-fluxo" className="font-condensada text-2xl font-semibold">
        Como uma leitura chega até a tela
      </h2>

      <ol className="mt-4 flex flex-col items-stretch gap-1 lg:flex-row lg:items-stretch lg:gap-0">
        {ETAPAS.map((etapa, i) => (
          <Fragment key={etapa.nome}>
            <li className="flex-1 rounded border border-linha bg-painel p-4">
              <p className="font-condensada text-xl font-semibold">{etapa.nome}</p>
              <p className="mt-1 text-sm text-suave">{etapa.detalhe}</p>
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

      <p className="mt-3 text-sm text-suave">Os dados deste demo são simulados.</p>
    </section>
  );
}
