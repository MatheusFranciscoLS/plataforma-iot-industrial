import { LogOut, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import StatusConexao from './StatusConexao';

function Marca() {
  return (
    <svg aria-hidden="true" viewBox="0 0 32 32" className="h-10 w-10 shrink-0">
      <rect width="32" height="32" rx="6" className="fill-tinta" />
      <path d="M6 22a10 10 0 0 1 20 0" fill="none" strokeWidth="2.5" strokeLinecap="round" className="stroke-painel" />
      <path d="M16 22l5-8" strokeWidth="2.5" strokeLinecap="round" className="stroke-alarme" />
      <circle cx="16" cy="22" r="2" className="fill-painel" />
    </svg>
  );
}

export default function Cabecalho({ conexao, tema, onAlternarTema, onSair }) {
  const rotuloTema = tema === 'escuro' ? 'Mudar para o tema claro' : 'Mudar para o tema escuro';

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 border-b border-linha pb-4">
      <div className="flex items-center gap-3">
        <Marca />
        <div>
          <h1 className="font-condensada text-3xl font-semibold leading-none sm:text-4xl">Monitoramento da fábrica</h1>
          <p className="mt-1 text-sm text-suave">Temperatura, rotação e vibração em tempo real</p>
        </div>
      </div>

      <div className="flex items-center gap-2 sm:gap-4">
        <StatusConexao conexao={conexao} />

        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="outline" size="icon" onClick={onAlternarTema} aria-label={rotuloTema}>
              {tema === 'escuro' ? <Sun aria-hidden="true" /> : <Moon aria-hidden="true" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent>{rotuloTema}</TooltipContent>
        </Tooltip>

        <Button variant="outline" onClick={onSair}>
          <LogOut aria-hidden="true" />
          Sair
        </Button>
      </div>
    </header>
  );
}
