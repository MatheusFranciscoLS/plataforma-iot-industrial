import { useEffect, useState } from 'react';
import { buscarAlertas, SessaoInvalidaError } from '../lib/api';

const INTERVALO_MS = 5000;

/** Alertas guardados no servidor, atualizados a cada 5 segundos enquanto o painel está aberto. */
export function useAlertas(token, onSessaoInvalida) {
  const [alertas, setAlertas] = useState([]);
  const [erro, setErro] = useState(false);

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      try {
        const lista = await buscarAlertas(token);
        if (!ativo) return;
        setAlertas(lista);
        setErro(false);
      } catch (falha) {
        if (!ativo) return;
        if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
        else setErro(true);
      }
    }

    atualizar();
    const id = setInterval(atualizar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token, onSessaoInvalida]);

  return { alertas, erro };
}
