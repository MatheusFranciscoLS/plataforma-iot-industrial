import { useEffect, useRef } from 'react';
import { renovarToken } from '../lib/api';
import { lerExpiracao } from '../lib/token';

const CONFERIR_A_CADA_MS = 60000;
const RENOVAR_QUANDO_FALTAR_MS = 15 * 60 * 1000;

/**
 * Renova o token sozinho: a cada minuto confere quanto falta para vencer e, com menos de 15 minutos, pede um novo
 * à API e entrega a `aoRenovar`. Assim quem está com o painel aberto não é desconectado a cada 2 horas.
 * Se a API recusar (a sessão passou do limite de horas desde o login, o usuário foi apagado, ou ela está fora do ar),
 * não faz nada: o token atual vale até o fim e o app volta ao login quando ele vencer.
 */
export function useRenovacaoDoToken(token, aoRenovar) {
  const aoRenovarAtual = useRef(aoRenovar);
  useEffect(() => {
    aoRenovarAtual.current = aoRenovar;
  });

  useEffect(() => {
    if (!token) return undefined;
    let ativo = true;
    let renovando = false;

    async function conferir() {
      const exp = lerExpiracao(token);
      if (renovando || exp === null || exp * 1000 - Date.now() > RENOVAR_QUANDO_FALTAR_MS) return;
      renovando = true;
      try {
        const novo = await renovarToken(token);
        if (ativo && novo) aoRenovarAtual.current(novo);
      } catch {
        // tenta de novo no próximo minuto, até o token vencer
      } finally {
        renovando = false;
      }
    }

    conferir();
    const id = setInterval(conferir, CONFERIR_A_CADA_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token]);
}
