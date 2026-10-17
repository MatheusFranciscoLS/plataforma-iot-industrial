import { createContext, useContext } from 'react';
import { I18N_PT } from './textos';

// Sem provedor (por exemplo, num teste de um componente solto), vale o português.
export const IdiomaContexto = createContext({ ...I18N_PT, alternarIdioma: () => {} });

/** { idioma, t, locale, alternarIdioma } do idioma escolhido. */
export function useIdioma() {
  return useContext(IdiomaContexto);
}
