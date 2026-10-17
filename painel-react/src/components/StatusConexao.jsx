import { Loader2, RefreshCw, WifiOff } from 'lucide-react';

const TEXTOS = {
  'ao-vivo': 'Ao vivo',
  conectando: 'Conectando…',
  reconectando: 'Reconectando…',
  'por-consulta': 'Atualizando por consulta',
};

export default function StatusConexao({ conexao }) {
  return (
    <p
      role="status"
      title={conexao === 'por-consulta' ? 'O tempo real não está chegando; o painel busca as leituras novas na API a cada 3 segundos.' : undefined}
      className="flex items-center gap-2 text-sm font-medium"
    >
      {conexao === 'ao-vivo' && (
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full bg-tinta motion-safe:animate-[pulso-ao-vivo_2s_ease-in-out_infinite]"
        />
      )}
      {conexao === 'conectando' && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin text-suave" />}
      {conexao === 'por-consulta' && <RefreshCw aria-hidden="true" className="h-4 w-4 text-suave" />}
      {conexao === 'reconectando' && <WifiOff aria-hidden="true" className="h-4 w-4 text-alarme" />}
      <span className={conexao === 'reconectando' ? 'text-alarme' : undefined}>{TEXTOS[conexao]}</span>
    </p>
  );
}
