import { lazy, Suspense, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgora } from '@/hooks/useAgora';
import { useAlertas } from '@/hooks/useAlertas';
import { useTelemetria } from '@/hooks/useTelemetria';
import { agruparHistorico, MAX_PONTOS, serieDaMaquina } from '@/lib/historico';
import { METRICA_PADRAO } from '@/lib/metricas';
import { avaliarMaquina, LIMITE_TEMPERATURA, LIMITE_VIBRACAO, formatarNumero, MAQUINAS, resumirFabrica } from '@/lib/limites';
import AlertasRecentes from './AlertasRecentes';
import Cabecalho from './Cabecalho';
import LinhaMaquina from './LinhaMaquina';
import ResumoFabrica from './ResumoFabrica';

// O Recharts é a maior parte do código da página; ele só é baixado depois que o resto já apareceu.
const GraficoTemperatura = lazy(() => import('./GraficoTemperatura'));

export default function Painel({ token, tema, onAlternarTema, onSair, onSessaoInvalida }) {
  const [pontos, setPontos] = useState(MAX_PONTOS);
  const [metrica, setMetrica] = useState(METRICA_PADRAO);
  const { historico, leituras, statusAtual, conexao, erroHistorico } = useTelemetria(token, onSessaoInvalida, pontos);
  const historicoDoGrafico = useMemo(() => agruparHistorico(leituras, pontos, metrica.id), [leituras, pontos, metrica]);
  const { alertas, erro: erroAlertas } = useAlertas(token, onSessaoInvalida);
  const agora = useAgora();

  const avaliacoes = MAQUINAS.map((nome) => avaliarMaquina(statusAtual[nome], agora));
  const resumo = resumirFabrica(avaliacoes);
  const afetadas = MAQUINAS.filter((_, i) => (resumo.nivel === 'critico' ? avaliacoes[i].estado === 'critica' : avaliacoes[i].estado === 'sem-sinal' || avaliacoes[i].estado === 'sem-dados'));

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <Cabecalho conexao={conexao} tema={tema} onAlternarTema={onAlternarTema} onSair={onSair} />

      <main>
        <ResumoFabrica
          resumo={resumo}
          maquinasAfetadas={resumo.nivel === 'critico' || resumo.nivel === 'atencao' ? afetadas : []}
          total={MAQUINAS.length}
        />

        <div className="mt-6 flex flex-col gap-3">
          {MAQUINAS.map((nome, i) => (
            <LinhaMaquina
              key={nome}
              nome={nome}
              dado={statusAtual[nome]}
              avaliacao={avaliacoes[i]}
              agora={agora}
              serie={serieDaMaquina(historico, nome)}
            />
          ))}
        </div>

        {erroHistorico && (
          <p role="alert" className="mt-6 rounded border border-linha bg-painel px-4 py-3 text-sm">
            Não foi possível carregar o histórico. As leituras novas continuam chegando em tempo real.
          </p>
        )}

        <Suspense fallback={<Skeleton className="mt-6 h-96 w-full rounded bg-linha/60" />}>
          <GraficoTemperatura
            historico={historicoDoGrafico}
            leituras={leituras}
            metrica={metrica}
            onMetrica={setMetrica}
            pontos={pontos}
            onPontos={setPontos}
          />
        </Suspense>

        <AlertasRecentes alertas={alertas} erro={erroAlertas} />
      </main>

      <footer className="mt-8 flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-linha pt-4 text-sm text-suave">
        <p>
          Os dados vêm de um simulador de sensores. Alerta crítico acima de {LIMITE_TEMPERATURA} °C ou {formatarNumero(LIMITE_VIBRACAO, 1, 1)} mm/s.
        </p>
        <a
          className="underline underline-offset-4 hover:text-tinta"
          href="https://github.com/MatheusFranciscoLS/plataforma-iot-industrial"
          target="_blank"
          rel="noreferrer"
        >
          Código no GitHub
        </a>
      </footer>
    </div>
  );
}
