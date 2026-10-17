import { useEffect, useMemo, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import { API_NODE, buscarHistorico, SessaoInvalidaError } from '../lib/api';
import { agruparHistorico, MAX_PONTOS, mesclarLeituras, ultimasLeituras } from '../lib/historico';
import { MAQUINAS } from '../lib/limites';

/**
 * Carrega o histórico e acompanha as leituras novas em tempo real.
 * `pontos` é quantos pontos o gráfico mostra; pedir mais busca um histórico maior.
 * `historico` são os pontos de temperatura (para os mini gráficos); `leituras` são as leituras soltas, para alertas e CSV.
 * `conexao`: 'conectando' | 'ao-vivo' | 'reconectando' | 'por-consulta'. Quando o tempo real fica mudo por 8 s (por exemplo,
 * a fila de mensagens fora do ar), o painel passa a buscar as leituras novas na API a cada 3 s e avisa com 'por-consulta'.
 * `onSessaoInvalida` é chamada quando o servidor recusa o token.
 */
// Reserva por consulta: depois deste silêncio do tempo real, busca na API a cada INTERVALO_RESERVA_MS.
const SILENCIO_MS = 8000;
const INTERVALO_RESERVA_MS = 3000;

export function useTelemetria(token, onSessaoInvalida, pontos = MAX_PONTOS) {
  const [leituras, setLeituras] = useState([]);
  const [statusAtual, setStatusAtual] = useState({});
  const [conexao, setConexao] = useState('conectando');
  const [erroHistorico, setErroHistorico] = useState(false);
  const [porConsulta, setPorConsulta] = useState(false);
  const ultimoAoVivo = useRef(0); // quando chegou a última leitura pelo tempo real (começa a contar ao abrir o painel)
  const idsVistos = useRef(new Set()); // leituras que o painel já tem, para a consulta não repetir

  // Histórico: busca de novo quando a pessoa pede mais pontos no gráfico.
  useEffect(() => {
    let ativo = true;

    buscarHistorico(token, pontos * MAQUINAS.length)
      .then((registros) => {
        if (!ativo) return;
        // Junta com o que já chegou ao vivo, em vez de trocar. Uma máquina que já estava muda
        // ao abrir a página aparece como "sem sinal" por causa da hora da última leitura dela.
        registros.forEach((r) => idsVistos.current.add(r.id));
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
      ultimoAoVivo.current = Date.now();
      idsVistos.current.add(dado.id);
      setPorConsulta(false);
      setStatusAtual((anterior) => ({ ...anterior, [dado.idMaquina]: { ...dado, recebidoEm: Date.now() } }));
      setLeituras((anteriores) => mesclarLeituras(anteriores, [dado]));
    });

    return () => socket.disconnect();
  }, [token, onSessaoInvalida]);

  // Reserva: se o tempo real calar (fila fora do ar, por exemplo), busca as leituras novas na API.
  useEffect(() => {
    ultimoAoVivo.current = Date.now();
    const id = setInterval(async () => {
      if (Date.now() - ultimoAoVivo.current < SILENCIO_MS) return;

      try {
        const registros = await buscarHistorico(token, MAQUINAS.length * 2);
        const novos = registros.filter((r) => !idsVistos.current.has(r.id)).sort((a, b) => a.timestamp - b.timestamp);
        if (novos.length === 0) return;

        novos.forEach((r) => idsVistos.current.add(r.id));
        const recebidoEm = Date.now();
        setLeituras((anteriores) => mesclarLeituras(anteriores, novos));
        setStatusAtual((anterior) => {
          const atual = { ...anterior };
          for (const r of novos) atual[r.idMaquina] = { ...r, recebidoEm };
          return atual;
        });
        setPorConsulta(true);
      } catch (erro) {
        if (erro instanceof SessaoInvalidaError) onSessaoInvalida();
        // Outros erros: tenta de novo na próxima rodada.
      }
    }, INTERVALO_RESERVA_MS);

    return () => clearInterval(id);
  }, [token, onSessaoInvalida]);

  const historico = useMemo(() => agruparHistorico(leituras, pontos), [leituras, pontos]);

  return { historico, leituras, statusAtual, conexao: porConsulta ? 'por-consulta' : conexao, erroHistorico };
}
