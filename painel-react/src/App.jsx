import { useCallback, useEffect, useRef, useState } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import Login from '@/components/Login';
import Painel from '@/components/Painel';
import PreviaDoDemo from '@/components/PreviaDoDemo';
import { useIdioma } from '@/i18n/idioma-contexto';
import ProvedorDeIdioma from '@/i18n/ProvedorDeIdioma';
import { useRenovacaoDoToken } from '@/hooks/useRenovacaoDoToken';
import { useTema } from '@/hooks/useTema';
import { fazerLogin } from '@/lib/api';
import { ACESSO_DEMO } from '@/lib/demo';
import { lerExpiracao, lerTokenSalvo, salvarToken } from '@/lib/token';

function Aplicacao() {
  const { t } = useIdioma();
  const [token, setToken] = useState(lerTokenSalvo);
  const [sessaoTerminou, setSessaoTerminou] = useState(false);
  // Enquanto o login da demonstração espera o servidor gratuito acordar, a tela mostra uma simulação no navegador.
  const [previa, setPrevia] = useState(false);
  const [erroDaDemo, setErroDaDemo] = useState('');
  const tentativaDaDemo = useRef(0); // sobe a cada clique e ao sair da simulação, para ignorar um login que chegou tarde
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
    setPrevia(false);
    setErroDaDemo('');
    setToken(novoToken);
  };

  async function entrarNaDemo() {
    const minha = ++tentativaDaDemo.current;
    setErroDaDemo('');
    setPrevia(true);
    try {
      const novoToken = await fazerLogin(ACESSO_DEMO.usuario, ACESSO_DEMO.senha);
      if (tentativaDaDemo.current === minha) entrar(novoToken);
    } catch (falha) {
      if (tentativaDaDemo.current !== minha) return;
      setPrevia(false);
      setErroDaDemo(t(`erro.${falha.codigo ?? 'servidor'}`));
    }
  }

  const sairDaPrevia = () => {
    tentativaDaDemo.current += 1;
    setPrevia(false);
  };

  // Antes de o token vencer, pede um novo (a pessoa que está usando o painel não é desconectada a cada 2 horas).
  // O token novo troca o antigo sem passar pelo login e sem mexer na tela.
  useRenovacaoDoToken(token, (novoToken) => {
    salvarToken(novoToken);
    setToken(novoToken);
  });

  // Quando o token vence, volta para o login sem esperar o servidor recusar.
  useEffect(() => {
    const exp = token && lerExpiracao(token);
    if (!exp) return;
    const espera = Math.max(0, exp * 1000 - Date.now());
    const id = setTimeout(sessaoInvalida, espera);
    return () => clearTimeout(id);
  }, [token, sessaoInvalida]);

  let tela;
  if (token) {
    tela = <Painel token={token} tema={tema} onAlternarTema={alternar} onSair={() => sair()} onSessaoInvalida={sessaoInvalida} />;
  } else if (previa) {
    tela = <PreviaDoDemo tema={tema} onAlternarTema={alternar} onSair={sairDaPrevia} />;
  } else {
    tela = <Login aviso={sessaoTerminou ? t('aviso.sessao') : ''} onEntrar={entrar} onDemo={entrarNaDemo} erroExterno={erroDaDemo} />;
  }

  return <TooltipProvider delayDuration={300}>{tela}</TooltipProvider>;
}

export default function App() {
  return (
    <ProvedorDeIdioma>
      <Aplicacao />
    </ProvedorDeIdioma>
  );
}
