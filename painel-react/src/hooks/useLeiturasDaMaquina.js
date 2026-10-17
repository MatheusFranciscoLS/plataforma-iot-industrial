import { useEffect, useState } from 'react';
import { buscarHistorico, SessaoInvalidaError } from '../lib/api';

const LIMITE = 500; // o máximo que a API devolve

/** Leituras de uma máquina só (as 500 mais recentes), buscadas quando a tela de detalhes abre. */
export function useLeiturasDaMaquina(token, maquina, onSessaoInvalida) {
  const [estado, setEstado] = useState({ maquina: null, leituras: [], erro: false });

  useEffect(() => {
    let ativo = true;

    buscarHistorico(token, LIMITE, maquina)
      .then((leituras) => ativo && setEstado({ maquina, leituras, erro: false }))
      .catch((falha) => {
        if (!ativo) return;
        if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
        else setEstado({ maquina, leituras: [], erro: true });
      });

    return () => {
      ativo = false;
    };
  }, [token, maquina, onSessaoInvalida]);

  // Enquanto a resposta não chega (ou se a máquina mudou), está carregando.
  return { ...estado, carregando: estado.maquina !== maquina };
}
