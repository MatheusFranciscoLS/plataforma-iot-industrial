import { lazy, Suspense, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgora } from '@/hooks/useAgora';
import { useSimulacaoLocal } from '@/hooks/useSimulacaoLocal';
import { agruparHistorico, MAX_PONTOS, serieDaMaquina } from '@/lib/historico';
import { avaliarMaquina, LIMITES_PADRAO, MAQUINAS, resumirFabrica } from '@/lib/limites';
import { METRICA_PADRAO } from '@/lib/metricas';
import { useIdioma } from '@/i18n/idioma-contexto';
import Cabecalho from './Cabecalho';
import LinhaMaquina from './LinhaMaquina';
import ResumoFabrica from './ResumoFabrica';

const GraficoTemperatura = lazy(() => import('./GraficoTemperatura'));

/**
 * A tela de demonstração enquanto o servidor gratuito acorda: o mesmo painel (resumo, máquinas e gráfico),
 * mas com leituras simuladas aqui no navegador. Quando o login termina, o app troca esta tela pelo painel de verdade.
 */
export default function PreviaDoDemo({ tema, onAlternarTema, onSair }) {
  const i18n = useIdioma();
  const { t } = i18n;
  const agora = useAgora();
  const { leituras, statusAtual } = useSimulacaoLocal();
  const [pontos, setPontos] = useState(MAX_PONTOS);
  const [metrica, setMetrica] = useState(METRICA_PADRAO);

  const historico = useMemo(() => agruparHistorico(leituras, MAX_PONTOS), [leituras]);
  const historicoDoGrafico = useMemo(() => agruparHistorico(leituras, pontos, metrica.id), [leituras, pontos, metrica]);

  const avaliacoes = MAQUINAS.map((nome) => avaliarMaquina(statusAtual[nome], agora, i18n, LIMITES_PADRAO));
  const resumo = resumirFabrica(avaliacoes, i18n);
  const afetadas = MAQUINAS.filter((_, i) => avaliacoes[i].estado === 'critica');
  const limitesDoGrafico = metrica.limiteDe ? Object.fromEntries(MAQUINAS.map((nome) => [nome, LIMITES_PADRAO[metrica.limiteDe]])) : null;

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <Cabecalho conexao="simulado" tema={tema} onAlternarTema={onAlternarTema} onSair={onSair} />

      <main>
        <p role="status" className="mt-6 rounded border border-linha bg-painel px-4 py-3 text-sm">
          {t('previa.aviso')}
        </p>

        <ResumoFabrica resumo={resumo} maquinasAfetadas={resumo.nivel === 'critico' ? afetadas : []} total={MAQUINAS.length} />

        <div className="mt-6 flex flex-col gap-3">
          {MAQUINAS.map((nome, i) => (
            <LinhaMaquina
              key={nome}
              nome={nome}
              dado={statusAtual[nome]}
              avaliacao={avaliacoes[i]}
              agora={agora}
              serie={serieDaMaquina(historico, nome)}
              limites={LIMITES_PADRAO}
            />
          ))}
        </div>

        <Suspense fallback={<Skeleton className="mt-6 h-96 w-full rounded bg-linha/60" />}>
          <GraficoTemperatura
            historico={historicoDoGrafico}
            leituras={leituras}
            metrica={metrica}
            limitesPorMaquina={limitesDoGrafico}
            onMetrica={setMetrica}
            pontos={pontos}
            onPontos={setPontos}
          />
        </Suspense>
      </main>
    </div>
  );
}
