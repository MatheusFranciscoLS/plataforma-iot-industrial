import { useEffect, useRef, useState } from 'react';
import { mesclarLeituras, ultimasLeituras } from '../lib/historico';
import { gerarHistorico, INTERVALO_SIMULACAO_S, proximaRodada } from '../lib/simulacaoLocal';

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
      const novas = proximaRodada(estados.current, Math.floor(Date.now() / 1000));
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
