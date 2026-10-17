import { useEffect, useMemo, useState } from 'react';
import { IdiomaContexto } from './idioma-contexto';
import { pacote } from './textos';

const CHAVE = 'idioma';

// Idioma escolhido antes (guardado no navegador) ou, na primeira visita, o do navegador: inglês se ele estiver em inglês.
function idiomaInicial() {
  try {
    const salvo = localStorage.getItem(CHAVE);
    if (salvo === 'pt' || salvo === 'en') return salvo;
  } catch {
    // Sem armazenamento: usa o idioma do navegador.
  }
  return navigator.language?.toLowerCase().startsWith('en') ? 'en' : 'pt';
}

export default function ProvedorDeIdioma({ children }) {
  const [idioma, setIdioma] = useState(idiomaInicial);

  // A página inteira avisa o leitor de tela e o navegador em que idioma está, e o título da aba acompanha.
  useEffect(() => {
    document.documentElement.lang = idioma === 'en' ? 'en' : 'pt-BR';
    document.title = pacote(idioma).t('app.titulo');
  }, [idioma]);

  const valor = useMemo(
    () => ({
      ...pacote(idioma),
      alternarIdioma: () =>
        setIdioma((atual) => {
          const novo = atual === 'pt' ? 'en' : 'pt';
          try {
            localStorage.setItem(CHAVE, novo);
          } catch {
            // Sem armazenamento: a escolha vale só até recarregar.
          }
          return novo;
        }),
    }),
    [idioma],
  );

  return <IdiomaContexto.Provider value={valor}>{children}</IdiomaContexto.Provider>;
}
