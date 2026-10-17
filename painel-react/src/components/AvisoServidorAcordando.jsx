import { useEffect, useState } from 'react';

const DEMORA_MS = 6000;

/**
 * O servidor do demo é gratuito e dorme quando ninguém usa; o primeiro acesso pode levar até 1 minuto.
 * Este aviso só aparece se o login demorar mais que 6 segundos, para a pessoa não achar que travou.
 * Ele só existe enquanto o login está em andamento, então some sozinho quando termina.
 */
export default function AvisoServidorAcordando() {
  const [visivel, setVisivel] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => setVisivel(true), DEMORA_MS);
    return () => clearTimeout(id);
  }, []);

  if (!visivel) return null;
  return (
    <p role="status" className="mt-3 rounded border border-linha bg-fundo px-3 py-2 text-sm">
      O servidor do demo é gratuito e dorme quando ninguém usa. Ele está acordando, o que pode levar até 1 minuto. Pode esperar nesta tela.
    </p>
  );
}
