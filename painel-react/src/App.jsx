import { useCallback, useEffect, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import Login from '@/components/Login';
import Painel from '@/components/Painel';
import { useTema } from '@/hooks/useTema';
import { lerExpiracao, lerTokenSalvo, salvarToken } from '@/lib/token';

const AVISO_SESSAO = 'Sua sessão terminou. Entre de novo para continuar.';

export default function App() {
  const [token, setToken] = useState(lerTokenSalvo);
  const [aviso, setAviso] = useState('');
  const { tema, alternar } = useTema();

  const sair = useCallback((mensagem = '') => {
    salvarToken(null);
    setToken(null);
    setAviso(mensagem);
  }, []);

  const sessaoInvalida = useCallback(() => sair(AVISO_SESSAO), [sair]);

  const entrar = (novoToken) => {
    salvarToken(novoToken);
    setAviso('');
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
        <Login aviso={aviso} onEntrar={entrar} />
      )}
    </TooltipProvider>
  );
}
