import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { API_NODE, buscarHistorico, SessaoInvalidaError } from '../lib/api';
import { agruparHistorico, MAX_PONTOS, mesclarLeituras, ultimasLeituras } from '../lib/historico';
import { MAQUINAS } from '../lib/limites';

/**
 * Carrega o histórico e acompanha as leituras novas em tempo real.
 * `pontos` é quantos pontos o gráfico mostra; pedir mais busca um histórico maior.
 * `historico` são os pontos de temperatura (para os mini gráficos); `leituras` são as leituras soltas, para alertas e CSV.
 * `conexao`: 'conectando' | 'ao-vivo' | 'reconectando'.
 * `onSessaoInvalida` é chamada quando o servidor recusa o token.
 */
export function useTelemetria(token, onSessaoInvalida, pontos = MAX_PONTOS) {
  const [leituras, setLeituras] = useState([]);
  const [statusAtual, setStatusAtual] = useState({});
  const [conexao, setConexao] = useState('conectando');
  const [erroHistorico, setErroHistorico] = useState(false);

  // Histórico: busca de novo quando a pessoa pede mais pontos no gráfico.
  useEffect(() => {
    let ativo = true;

    buscarHistorico(token, pontos * MAQUINAS.length)
      .then((registros) => {
        if (!ativo) return;
        // Junta com o que já chegou ao vivo, em vez de trocar. Uma máquina que já estava muda
        // ao abrir a página aparece como "sem sinal" por causa da hora da última leitura dela.
        setLeituras((atuais) => mesclarLeituras(registros, atuais));
        setStatusAtual((atual) => ({ ...ultimasLeituras(registros), ...atual }));
        setErroHistorico(false);
      })
      .catch((erro) => {
        if (!ativo) return;
        if (erro instanceof SessaoInvalidaError) onSessaoInvalida();
        else setErroHistorico(true);
      });

    return () => {
      ativo = false;
    };
  }, [token, pontos, onSessaoInvalida]);

  // Tempo real: uma conexão por login, independente do tamanho do gráfico.
  useEffect(() => {
    const socket = io(API_NODE, { transports: ['websocket'], auth: { token } });

    socket.on('connect', () => setConexao('ao-vivo'));
    socket.on('disconnect', () => setConexao('reconectando'));
    socket.on('connect_error', (erro) => {
      // O gateway recusa tokens ausentes, inválidos ou vencidos com "Acesso negado".
      if (erro.message?.startsWith('Acesso negado')) {
        socket.disconnect();
        onSessaoInvalida();
      } else {
        setConexao('reconectando');
      }
    });

    socket.on('novoRegistro', (dado) => {
      setStatusAtual((anterior) => ({ ...anterior, [dado.idMaquina]: { ...dado, recebidoEm: Date.now() } }));
      setLeituras((anteriores) => mesclarLeituras(anteriores, [dado]));
    });

    return () => socket.disconnect();
  }, [token, onSessaoInvalida]);

  const historico = useMemo(() => agruparHistorico(leituras, pontos), [leituras, pontos]);

  return { historico, leituras, statusAtual, conexao, erroHistorico };
}
