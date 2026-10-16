import { useCallback, useState } from 'react';

function temaAtual() {
  return document.documentElement.dataset.tema === 'escuro' ? 'escuro' : 'claro';
}

/** Tema claro/escuro. A escolha fica salva no navegador; sem escolha, vale a do sistema (veja index.html). */
export function useTema() {
  const [tema, setTema] = useState(temaAtual);

  const alternar = useCallback(() => {
    const novo = temaAtual() === 'escuro' ? 'claro' : 'escuro';
    if (novo === 'escuro') document.documentElement.dataset.tema = 'escuro';
    else delete document.documentElement.dataset.tema;
    try {
      localStorage.setItem('tema', novo);
    } catch {
      // Sem armazenamento: o tema vale só até recarregar a página.
    }
    setTema(novo);
  }, []);

  return { tema, alternar };
}
