import { useEffect, useState } from 'react';

/** Hora atual em ms, atualizada a cada segundo (para "há 3 s" e "sem sinal" andarem sozinhos). */
export function useAgora() {
  const [agora, setAgora] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  return agora;
}
