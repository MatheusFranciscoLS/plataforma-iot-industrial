import { useCallback, useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import Login from '@/components/Login';
import Painel from '@/components/Painel';
import { useIdioma } from '@/i18n/idioma-contexto';
import ProvedorDeIdioma from '@/i18n/ProvedorDeIdioma';
import { useTema } from '@/hooks/useTema';
import { lerExpiracao, lerTokenSalvo, salvarToken } from '@/lib/token';

function Aplicacao() {
  const { t } = useIdioma();
  const [token, setToken] = useState(lerTokenSalvo);
  const [sessaoTerminou, setSessaoTerminou] = useState(false);
  const { tema, alternar } = useTema();

  const sair = useCallback((sessaoVenceu = false) => {
    salvarToken(null);
    setToken(null);
    setSessaoTerminou(sessaoVenceu);
  }, []);

  const sessaoInvalida = useCallback(() => sair(true), [sair]);

  const entrar = (novoToken) => {
    salvarToken(novoToken);
    setSessaoTerminou(false);
    setToken(novoToken);
  };

  // Quando o token vence, volta para o login sem esperar o servidor recusar.
  useEffect(() => {
    const exp = token && lerExpiracao(token);
    if (!exp) return;
    const espera = Math.max(0, exp * 1000 - Date.now());
    const id = setTimeout(sessaoInvalida, espera);
    return () => clearTimeout(id);
  }, [token, sessaoInvalida]);

  return (
    <TooltipProvider delayDuration={300}>
      {token ? (
        <Painel token={token} tema={tema} onAlternarTema={alternar} onSair={() => sair()} onSessaoInvalida={sessaoInvalida} />
      ) : (
        <Login aviso={sessaoTerminou ? t('aviso.sessao') : ''} onEntrar={entrar} />
      )}
    </TooltipProvider>
  );
}

export default function App() {
  return (
    <ProvedorDeIdioma>
      <Aplicacao />
    </ProvedorDeIdioma>
  );
}
