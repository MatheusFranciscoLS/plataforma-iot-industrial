import { useEffect, useRef, useState } from 'react';
import { buscarResumo, buscarSerie, SessaoInvalidaError } from '../lib/api';

const INTERVALO_MS = 30000;

/**
 * Busca no servidor, a cada 30 s, algo calculado por período. `chave` identifica o que está sendo pedido
 * (período, máquina...); quando ela muda, a resposta antiga some e uma nova é buscada. Com `chave` nula não faz nada.
 * `buscar(token)` devolve a resposta. Devolve `{ dados, carregando, erro }`.
 */
function usePeriodico(token, chave, buscar, onSessaoInvalida) {
  const [estado, setEstado] = useState({ chave: null, dados: null, erro: false });

  // A função de busca muda a cada render (ela fecha sobre período e máquina); o efeito usa sempre a mais nova
  // sem reiniciar o relógio de 30 s por isso.
  const buscarAtual = useRef(buscar);
  useEffect(() => {
    buscarAtual.current = buscar;
  });

  useEffect(() => {
    if (!chave) return undefined;
    let ativo = true;

    async function atualizar() {
      try {
        const dados = await buscarAtual.current(token);
        if (ativo) setEstado({ chave, dados, erro: false });
      } catch (falha) {
        if (!ativo) return;
        if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
        else setEstado((atual) => ({ chave, dados: atual.chave === chave ? atual.dados : null, erro: true }));
      }
    }

    atualizar();
    const id = setInterval(atualizar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token, chave, onSessaoInvalida]);

  // Enquanto a resposta do pedido novo não chega, não mostra a do antigo.
  const atual = estado.chave === chave;
  const dados = atual ? estado.dados : null;
  const erro = atual && estado.erro;
  return { dados, erro, carregando: Boolean(chave) && dados === null && !erro };
}

/** Série do período (média e máximo por faixa de tempo), de todas as máquinas ou só de `maquina`. `periodo` nulo = não busca. */
export function useSerie(token, periodo, maquina, onSessaoInvalida) {
  return usePeriodico(token, periodo ? `serie|${periodo}|${maquina ?? ''}` : null, (tk) => buscarSerie(tk, periodo, maquina), onSessaoInvalida);
}

/** Resumo por máquina no período (leituras, média, máximo, mínimo e alertas). `periodo` nulo = não busca. */
export function useResumo(token, periodo, onSessaoInvalida) {
  return usePeriodico(token, periodo ? `resumo|${periodo}` : null, (tk) => buscarResumo(tk, periodo), onSessaoInvalida);
}
