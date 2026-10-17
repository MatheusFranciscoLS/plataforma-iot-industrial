import { useCallback, useEffect, useState } from 'react';
import { buscarAlertas, contarAlertasPendentes, reconhecerAlerta, SessaoInvalidaError } from '../lib/api';

const INTERVALO_MS = 5000;
const CONTAR_A_CADA = 3; // rodadas de consulta entre uma contagem de pendentes e outra

/**
 * Alertas guardados no servidor, atualizados a cada 5 segundos enquanto o painel está aberto.
 * `filtros` ({ maquina, tipo, reconhecido }) e `limite` escolhem o que listar; `pendentes` é o total
 * ainda não reconhecido (de todos os alertas, não só dos listados); `reconhecer(id)` marca um como visto.
 */
export function useAlertas(token, onSessaoInvalida, { limite = 20, filtros = {}, intervaloMs = INTERVALO_MS } = {}) {
  const [alertas, setAlertas] = useState([]);
  const [pendentes, setPendentes] = useState(null);
  const [erro, setErro] = useState(false);
  const [erroAoReconhecer, setErroAoReconhecer] = useState(false);

  // As opções entram como texto para o efeito só rodar de novo quando o conteúdo muda, não a cada render.
  const chaveDosFiltros = JSON.stringify(filtros);

  useEffect(() => {
    let ativo = true;
    let rodada = 0;
    const filtrosAtuais = JSON.parse(chaveDosFiltros);

    async function atualizar() {
      // A contagem de pendentes muda devagar: busca na primeira rodada e a cada 3ª, para poupar a API (que é pequena).
      const contar = rodada++ % CONTAR_A_CADA === 0;
      try {
        const [lista, total] = await Promise.all([
          buscarAlertas(token, limite, filtrosAtuais),
          contar
            ? contarAlertasPendentes(token).catch((falha) => {
                if (falha instanceof SessaoInvalidaError) throw falha;
                return null; // a contagem é um extra: sem ela o painel conta pela lista
              })
            : undefined,
        ]);
        if (!ativo) return;
        setAlertas(lista);
        if (contar) setPendentes(typeof total === 'number' ? total : null);
        setErro(false);
      } catch (falha) {
        if (!ativo) return;
        if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
        else setErro(true);
      }
    }

    atualizar();
    const id = setInterval(atualizar, intervaloMs);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token, onSessaoInvalida, limite, chaveDosFiltros, intervaloMs]);

  const reconhecer = useCallback(
    async (id) => {
      try {
        const atualizado = await reconhecerAlerta(token, id);
        setAlertas((lista) => lista.map((a) => (a.id === id ? atualizado : a)));
        setPendentes((total) => (typeof total === 'number' ? Math.max(0, total - 1) : total));
        setErroAoReconhecer(false);
      } catch (falha) {
        if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
        else setErroAoReconhecer(true);
      }
    },
    [token, onSessaoInvalida],
  );

  return { alertas, pendentes, erro, erroAoReconhecer, reconhecer };
}
