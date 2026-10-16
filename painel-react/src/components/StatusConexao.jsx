import { Loader2, WifiOff } from 'lucide-react';

const TEXTOS = {
  'ao-vivo': 'Ao vivo',
  conectando: 'Conectando…',
  reconectando: 'Reconectando…',
};

export default function StatusConexao({ conexao }) {
  return (
    <p role="status" className="flex items-center gap-2 text-sm font-medium">
      {conexao === 'ao-vivo' && (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full bg-tinta motion-safe:animate-[pulso-ao-vivo_2s_ease-in-out_infinite]"
        />
      )}
      {conexao === 'conectando' && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-suave" />}
      {conexao === 'reconectando' && <WifiOff aria-hidden="true" className="h-4 w-4 text-alarme" />}
      <span className={conexao === 'reconectando' ? 'text-alarme' : undefined}>{TEXTOS[conexao]}</span>
    </p>
  );
}
