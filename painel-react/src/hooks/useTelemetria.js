import { useEffect, useMemo, useState } from 'react';
import { io } from 'socket.io-client';
import { API_NODE, buscarHistorico, SessaoInvalidaError } from '../lib/api';
import { agruparHistorico, mesclarLeituras, ultimasLeituras } from '../lib/historico';

/**
 * Carrega o histórico e acompanha as leituras novas em tempo real.
 * `conexao`: 'conectando' | 'ao-vivo' | 'reconectando'.
 * `onSessaoInvalida` é chamada quando o servidor recusa o token.
 */
export function useTelemetria(token, onSessaoInvalida) {
  const [leituras, setLeituras] = useState([]);
  const [statusAtual, setStatusAtual] = useState({});
  const [conexao, setConexao] = useState('conectando');
  const [erroHistorico, setErroHistorico] = useState(false);

  useEffect(() => {
    let ativo = true;

    buscarHistorico(token)
      .then((registros) => {
        if (!ativo) return;
        // Junta com o que já chegou ao vivo, em vez de trocar. Uma máquina que já estava muda
        // ao abrir a página aparece como "sem sinal" por causa da hora da última leitura dela.
        setLeituras((atuais) => mesclarLeituras(registros, atuais));
        setStatusAtual((atual) => ({ ...ultimasLeituras(registros), ...atual }));
      })
      .catch((erro) => {
        if (!ativo) return;
        if (erro instanceof SessaoInvalidaError) onSessaoInvalida();
        else setErroHistorico(true);
      });

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

    return () => {
      ativo = false;
      socket.disconnect();
    };
  }, [token, onSessaoInvalida]);

  const historico = useMemo(() => agruparHistorico(leituras), [leituras]);

  return { historico, statusAtual, conexao, erroHistorico };
}
