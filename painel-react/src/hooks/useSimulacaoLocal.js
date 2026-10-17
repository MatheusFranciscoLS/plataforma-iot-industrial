import { useEffect, useRef, useState } from 'react';
import { mesclarLeituras, ultimasLeituras } from '../lib/historico';
import { MAQUINAS } from '../lib/limites';
import { gerarHistorico, INTERVALO_SIMULACAO_S, proximaLeitura } from '../lib/simulacaoLocal';

const RODADAS_INICIAIS = 30; // 1 minuto de histórico já pronto

/**
 * Leituras simuladas no navegador, no mesmo formato que o painel recebe do servidor.
 * Devolve `leituras` (para o gráfico) e `statusAtual` (a última leitura de cada máquina, com `recebidoEm`).
 */
export function useSimulacaoLocal() {
  const [inicial] = useState(() => gerarHistorico(Math.floor(Date.now() / 1000), RODADAS_INICIAIS));
  const [leituras, setLeituras] = useState(inicial.leituras);
  const [statusAtual, setStatusAtual] = useState(() => {
    const agora = Date.now();
    return Object.fromEntries(Object.entries(ultimasLeituras(inicial.leituras)).map(([nome, l]) => [nome, { ...l, recebidoEm: agora }]));
  });
  const estados = useRef(inicial.estados);

  useEffect(() => {
    const id = setInterval(() => {
      const timestamp = Math.floor(Date.now() / 1000);
      const novas = MAQUINAS.map((nome) => {
        const { estado, leitura } = proximaLeitura(nome, estados.current[nome], timestamp);
        estados.current[nome] = estado;
        return { ...leitura, id: `local-${nome}-${timestamp}` };
      });
      const recebidoEm = Date.now();
      setLeituras((anteriores) => mesclarLeituras(anteriores, novas));
      setStatusAtual((anterior) => {
        const atual = { ...anterior };
        for (const l of novas) atual[l.idMaquina] = { ...l, recebidoEm };
        return atual;
      });
    }, INTERVALO_SIMULACAO_S * 1000);
    return () => clearInterval(id);
  }, []);

  return { leituras, statusAtual };
}
