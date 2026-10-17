import { useCallback, useEffect, useState } from 'react';
import { buscarLimites, SessaoInvalidaError } from '../lib/api';
import { limitesDaMaquina, limitesPadrao } from '../lib/limites';

const INTERVALO_MS = 30000;

/**
 * Os limites de alerta da API (o padrão e o de cada máquina). Enquanto a resposta não chega, ou se ela falhar,
 * o painel usa os limites padrão. `recarregar()` busca de novo, por exemplo depois de editar um limite.
 */
export function useLimites(token, onSessaoInvalida) {
  const [tabela, setTabela] = useState(null);
  const [versao, setVersao] = useState(0);

  useEffect(() => {
    let ativo = true;

    async function atualizar() {
      try {
        const resposta = await buscarLimites(token);
        if (ativo) setTabela(resposta);
      } catch (falha) {
        if (ativo && falha instanceof SessaoInvalidaError) onSessaoInvalida();
        // outra falha: segue com o que já tem (ou com os limites padrão)
      }
    }

    atualizar();
    const id = setInterval(atualizar, INTERVALO_MS);
    return () => {
      ativo = false;
      clearInterval(id);
    };
  }, [token, onSessaoInvalida, versao]);

  const limitesDe = useCallback((maquina) => limitesDaMaquina(tabela, maquina), [tabela]);
  const recarregar = useCallback(() => setVersao((v) => v + 1), []);

  return { tabela, limitesDe, padrao: limitesPadrao(tabela), recarregar };
}
