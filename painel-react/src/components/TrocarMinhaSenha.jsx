import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useIdioma } from '@/i18n/idioma-contexto';
import { SessaoInvalidaError, trocarMinhaSenha } from '@/lib/api';

const MINIMO = 8;
const MAXIMO = 72;

/** Janela para quem está logado trocar a própria senha. A senha atual é conferida pela API. */
export default function TrocarMinhaSenha({ token, aoFechar, onSessaoInvalida }) {
  const { t } = useIdioma();
  const [campos, setCampos] = useState({ atual: '', nova: '', repetida: '' });
  const [situacao, setSituacao] = useState('parado'); // parado | salvando | salva | curta | diferente | atualErrada | protegido | muitasTentativas | erro
  const mudar = (campo, valor) => {
    setCampos((c) => ({ ...c, [campo]: valor }));
    if (situacao !== 'salvando') setSituacao('parado');
  };

  async function salvar(evento) {
    evento.preventDefault();
    if (campos.nova.length < MINIMO || campos.nova.length > MAXIMO) return setSituacao('curta');
    if (campos.nova !== campos.repetida) return setSituacao('diferente');

    setSituacao('salvando');
    try {
      await trocarMinhaSenha(token, campos.atual, campos.nova);
      setCampos({ atual: '', nova: '', repetida: '' });
      setSituacao('salva');
    } catch (falha) {
      if (falha instanceof SessaoInvalidaError) return onSessaoInvalida();
      setSituacao({ 400: 'atualErrada', 423: 'protegido', 429: 'muitasTentativas' }[falha.status] ?? 'erro');
    }
  }

  const mensagem = {
    salva: 'senha.salva',
    curta: 'senha.curta',
    diferente: 'senha.diferente',
    atualErrada: 'senha.atualErrada',
    protegido: 'senha.protegido',
    muitasTentativas: 'senha.muitasTentativas',
    erro: 'senha.erro',
  }[situacao];

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-w-md bg-painel text-tinta">
        <DialogHeader>
          <DialogTitle className="font-condensada text-3xl font-semibold">{t('senha.titulo')}</DialogTitle>
          <DialogDescription>{t('senha.descricao')}</DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} noValidate className="space-y-4">
          {[
            ['atual', 'senha.atual', 'current-password'],
            ['nova', 'senha.nova', 'new-password'],
            ['repetida', 'senha.repetir', 'new-password'],
          ].map(([campo, rotulo, completar]) => (
            <div key={campo}>
              <label htmlFor={`minha-senha-${campo}`} className="text-sm text-suave">
                {t(rotulo)}
              </label>
              <Input
                id={`minha-senha-${campo}`}
                type="password"
                autoComplete={completar}
                className="mt-1"
                value={campos[campo]}
                onChange={(e) => mudar(campo, e.target.value)}
              />
            </div>
          ))}
          <p className="text-xs text-suave">{t('senha.dica')}</p>

          <div className="flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={situacao === 'salvando' || !campos.atual || !campos.nova || !campos.repetida}>
              {situacao === 'salvando' ? t('senha.salvando') : t('senha.salvar')}
            </Button>
            {mensagem && (
              <p role={situacao === 'salva' ? 'status' : 'alert'} className={`text-sm ${situacao === 'salva' ? 'text-suave' : 'font-medium text-alarme'}`}>
                {t(mensagem)}
              </p>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
