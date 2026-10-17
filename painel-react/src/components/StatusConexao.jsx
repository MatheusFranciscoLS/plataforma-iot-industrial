import { Loader2, RefreshCw, WifiOff } from 'lucide-react';
import { useIdioma } from '@/i18n/idioma-contexto';

const CHAVES = {
  'ao-vivo': 'conexao.aoVivo',
  conectando: 'conexao.conectando',
  reconectando: 'conexao.reconectando',
  'por-consulta': 'conexao.porConsulta',
};

export default function StatusConexao({ conexao }) {
  const { t } = useIdioma();

  return (
    <p
      role="status"
      title={conexao === 'por-consulta' ? t('conexao.porConsulta.dica') : undefined}
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
      <span className={conexao === 'reconectando' ? 'text-alarme' : undefined}>{t(CHAVES[conexao])}</span>
    </p>
  );
}
