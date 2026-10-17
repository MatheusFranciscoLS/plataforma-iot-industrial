import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { Skeleton } from '@/components/ui/skeleton';
import { useAgora } from '@/hooks/useAgora';
import { useDemo } from '@/hooks/useDemo';
import { provocarFalha, SemPermissaoError, SessaoInvalidaError } from '@/lib/api';
import { useIdioma } from '@/i18n/idioma-contexto';
import { useAlertas } from '@/hooks/useAlertas';
import { useLimites } from '@/hooks/useLimites';
import { useTelemetria } from '@/hooks/useTelemetria';
import { agruparHistorico, MAX_PONTOS, serieDaMaquina } from '@/lib/historico';
import { useSerie } from '@/hooks/useServidorPorPeriodo';
import { METRICA_PADRAO } from '@/lib/metricas';
import { faixaEmMinutos, serieParaLinhas } from '@/lib/periodos';
import { avaliarMaquina, formatarNumero, MAQUINAS, resumirFabrica } from '@/lib/limites';
import { lerPerfil, lerUsuario } from '@/lib/token';
import AlertasRecentes from './AlertasRecentes';
import ComparacaoDeMaquinas from './ComparacaoDeMaquinas';
import DetalheDaMaquina from './DetalheDaMaquina';
import Cabecalho from './Cabecalho';
import GerenciarUsuarios from './GerenciarUsuarios';
import LimitesDeAlerta from './LimitesDeAlerta';
import LinhaMaquina from './LinhaMaquina';
import ResumoFabrica from './ResumoFabrica';
import TrocarMinhaSenha from './TrocarMinhaSenha';

// O Recharts é a maior parte do código da página; ele só é baixado depois que o resto já apareceu.
const GraficoTemperatura = lazy(() => import('./GraficoTemperatura'));

const ALERTAS_POR_PAGINA = 20;
const ALERTAS_MAXIMO = 200;

export default function Painel({ token, tema, onAlternarTema, onSair, onSessaoInvalida }) {
  const [pontos, setPontos] = useState(MAX_PONTOS);
  const [metrica, setMetrica] = useState(METRICA_PADRAO);
  const [maquinaAberta, setMaquinaAberta] = useState(null);
  const [limitesAbertos, setLimitesAbertos] = useState(false);
  const [usuariosAbertos, setUsuariosAbertos] = useState(false);
  const [senhaAberta, setSenhaAberta] = useState(false);
  // O perfil do token só decide o que mostrar; quem barra a ação de verdade é a API.
  const perfil = lerPerfil(token);
  const usuario = lerUsuario(token);
  const podeOperar = perfil === 'ADMIN' || perfil === 'OPERADOR';
  const [filtros, setFiltros] = useState({});
  const [quantosAlertas, setQuantosAlertas] = useState(ALERTAS_POR_PAGINA);
  const { historico, leituras, statusAtual, conexao, erroHistorico } = useTelemetria(token, onSessaoInvalida, pontos);
  // 'ao-vivo' desenha as leituras que chegam agora; '1h', '6h' e '24h' desenham as médias calculadas no servidor.
  const [periodo, setPeriodo] = useState('ao-vivo');
  const aoVivo = periodo === 'ao-vivo';
  const { dados: serie, carregando: carregandoSerie, erro: erroSerie } = useSerie(token, aoVivo ? null : periodo, null, onSessaoInvalida);
  const historicoDoGrafico = useMemo(
    () => (aoVivo ? agruparHistorico(leituras, pontos, metrica.id) : serieParaLinhas(serie, metrica.id)),
    [aoVivo, leituras, pontos, metrica, serie],
  );
  const { alertas, pendentes, erro: erroAlertas, erroAoReconhecer, reconhecer } = useAlertas(token, onSessaoInvalida, { limite: quantosAlertas, filtros });
  const { limitesDe, padrao, recarregar: recarregarLimites } = useLimites(token, onSessaoInvalida);
  const i18n = useIdioma();
  const { t, locale } = i18n;
  const agora = useAgora();

  const avaliacoes = MAQUINAS.map((nome) => avaliarMaquina(statusAtual[nome], agora, i18n, limitesDe(nome)));
  const resumo = resumirFabrica(avaliacoes, i18n);
  const afetadas = MAQUINAS.filter((_, i) => (resumo.nivel === 'critico' ? avaliacoes[i].estado === 'critica' : avaliacoes[i].estado === 'sem-sinal' || avaliacoes[i].estado === 'sem-dados'));

  // Cada máquina pode ter limites próprios; o gráfico desenha uma linha para cada valor diferente.
  const limitesDoGrafico = metrica.limiteDe ? Object.fromEntries(MAQUINAS.map((nome) => [nome, limitesDe(nome)[metrica.limiteDe]])) : null;

  const mudarFiltros = (novos) => {
    setFiltros(novos);
    setQuantosAlertas(ALERTAS_POR_PAGINA);
  };

  // Modo demonstração: operador e administrador podem provocar uma falha numa máquina para ver o alerta na hora.
  const demo = useDemo(token, onSessaoInvalida);
  const [avisoDaFalha, setAvisoDaFalha] = useState(null); // { texto, erro }
  useEffect(() => {
    if (!avisoDaFalha) return undefined;
    const id = setTimeout(() => setAvisoDaFalha(null), 10000);
    return () => clearTimeout(id);
  }, [avisoDaFalha]);

  async function simularFalha(nome) {
    try {
      const resultado = await provocarFalha(token, nome);
      setAvisoDaFalha({ texto: t('demo.falhaIniciada', { nome, seg: resultado.duracaoSegundos }), erro: false });
    } catch (falha) {
      if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
      else if (falha instanceof SemPermissaoError) setAvisoDaFalha({ texto: t('demo.falhaSemPermissao'), erro: true });
      else if (falha.status === 429) setAvisoDaFalha({ texto: t('demo.falhaAguarde', { nome, seg: falha.esperarSegundos ?? demo.esperaSegundos }), erro: true });
      else setAvisoDaFalha({ texto: t('demo.falhaErro'), erro: true });
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-8">
      <Cabecalho
        conexao={conexao}
        tema={tema}
        onAlternarTema={onAlternarTema}
        onSair={onSair}
        usuario={usuario}
        perfil={perfil}
        onUsuarios={perfil === 'ADMIN' ? () => setUsuariosAbertos(true) : undefined}
        onTrocarSenha={() => setSenhaAberta(true)}
      />

      <main>
        <ResumoFabrica
          resumo={resumo}
          maquinasAfetadas={resumo.nivel === 'critico' || resumo.nivel === 'atencao' ? afetadas : []}
          total={MAQUINAS.length}
        />

        <div aria-live="polite">
          {avisoDaFalha && (
            <p
              role={avisoDaFalha.erro ? 'alert' : 'status'}
              className={`mt-6 rounded border px-4 py-3 text-sm ${avisoDaFalha.erro ? 'border-alarme font-medium text-alarme' : 'border-linha bg-painel'}`}
            >
              {avisoDaFalha.texto}
            </p>
          )}
        </div>

        <div className="mt-6 flex flex-col gap-3">
          {MAQUINAS.map((nome, i) => (
            <LinhaMaquina
              key={nome}
              nome={nome}
              dado={statusAtual[nome]}
              avaliacao={avaliacoes[i]}
              agora={agora}
              serie={serieDaMaquina(historico, nome)}
              limites={limitesDe(nome)}
              onDetalhes={setMaquinaAberta}
              onSimularFalha={demo.ativo && podeOperar ? simularFalha : undefined}
            />
          ))}
        </div>

        {erroHistorico && (
          <p role="alert" className="mt-6 rounded border border-linha bg-painel px-4 py-3 text-sm">
            {t('painel.erroHistorico')}
          </p>
        )}

        <Suspense fallback={<Skeleton className="mt-6 h-96 w-full rounded bg-linha/60" />}>
          <GraficoTemperatura
            historico={historicoDoGrafico}
            leituras={leituras}
            metrica={metrica}
            limitesPorMaquina={limitesDoGrafico}
            onMetrica={setMetrica}
            pontos={pontos}
            onPontos={setPontos}
            periodo={periodo}
            onPeriodo={setPeriodo}
            faixaMinutos={faixaEmMinutos(serie)}
            carregando={carregandoSerie}
            erroPeriodo={erroSerie}
          />
        </Suspense>

        <ComparacaoDeMaquinas token={token} onSessaoInvalida={onSessaoInvalida} />

        <AlertasRecentes
          alertas={alertas}
          erro={erroAlertas}
          erroAoReconhecer={erroAoReconhecer}
          pendentes={pendentes}
          filtros={filtros}
          onFiltros={mudarFiltros}
          onReconhecer={podeOperar ? reconhecer : undefined}
          onMais={alertas.length >= quantosAlertas && quantosAlertas < ALERTAS_MAXIMO ? () => setQuantosAlertas((n) => Math.min(n + ALERTAS_POR_PAGINA * 4, ALERTAS_MAXIMO)) : undefined}
          onLimites={podeOperar ? () => setLimitesAbertos(true) : undefined}
        />
      </main>

      {maquinaAberta && (
        <DetalheDaMaquina
          token={token}
          maquina={maquinaAberta}
          limites={limitesDe(maquinaAberta)}
          aoFechar={() => setMaquinaAberta(null)}
          onSessaoInvalida={onSessaoInvalida}
        />
      )}

      {senhaAberta && <TrocarMinhaSenha token={token} aoFechar={() => setSenhaAberta(false)} onSessaoInvalida={onSessaoInvalida} />}

      {usuariosAbertos && (
        <GerenciarUsuarios
          token={token}
          usuarioAtual={usuario}
          aoFechar={() => setUsuariosAbertos(false)}
          onSessaoInvalida={onSessaoInvalida}
        />
      )}

      {limitesAbertos && (
        <LimitesDeAlerta
          token={token}
          limitesDe={limitesDe}
          padrao={padrao}
          aoSalvar={recarregarLimites}
          aoFechar={() => setLimitesAbertos(false)}
          onSessaoInvalida={onSessaoInvalida}
        />
      )}

      <footer className="mt-8 flex flex-wrap justify-between gap-x-6 gap-y-1 border-t border-linha pt-4 text-sm text-suave">
        <p>
          {t('painel.rodape', { temp: formatarNumero(padrao.temperatura, 1, 0, locale), vib: formatarNumero(padrao.vibracao, 1, 1, locale) })}
        </p>
        <a
          className="underline underline-offset-4 hover:text-tinta"
          href="https://github.com/MatheusFranciscoLS/plataforma-iot-industrial"
          target="_blank"
          rel="noreferrer"
        >
          {t('painel.codigo')}
        </a>
      </footer>
    </div>
  );
}
