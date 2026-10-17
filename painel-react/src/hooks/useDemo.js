import { useEffect, useState } from 'react';
import { buscarEstadoDoDemo, SessaoInvalidaError } from '../lib/api';

/**
 * Descobre uma vez se a API está em modo demonstração (é ele que permite o botão "Simular falha").
 * Se a consulta falhar por outro motivo, o painel simplesmente não oferece o botão.
 */
export function useDemo(token, onSessaoInvalida) {
  const [estado, setEstado] = useState({ ativo: false, esperaSegundos: 30 });

  useEffect(() => {
    let ativo = true;
    buscarEstadoDoDemo(token)
      .then((resposta) => {
        if (ativo && resposta?.simulador) setEstado({ ativo: true, esperaSegundos: resposta.esperaEntreFalhasSegundos ?? 30 });
      })
      .catch((falha) => {
        if (ativo && falha instanceof SessaoInvalidaError) onSessaoInvalida();
      });
    return () => {
      ativo = false;
    };
  }, [token, onSessaoInvalida]);

  return estado;
}
