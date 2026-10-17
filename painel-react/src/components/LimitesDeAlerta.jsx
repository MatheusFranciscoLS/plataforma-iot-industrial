import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useIdioma } from '@/i18n/idioma-contexto';
import { definirLimite, removerLimite, SessaoInvalidaError } from '@/lib/api';
import { formatarNumero, MAQUINAS } from '@/lib/limites';

const TIPOS = [
  { tipo: 'TEMPERATURA', chave: 'temperatura', rotulo: 'limites.temperatura' },
  { tipo: 'VIBRACAO', chave: 'vibracao', rotulo: 'limites.vibracao' },
];

// Os números que o usuário vê e digita: sem zeros sobrando (95, não 95.0).
const comoTexto = (numero) => String(Number(numero));

/** Janela para ver e trocar os limites de alerta de cada máquina. Salvar vale a partir da próxima leitura recebida. */
export default function LimitesDeAlerta({ token, limitesDe, padrao, aoSalvar, aoFechar, onSessaoInvalida }) {
  const { t, locale } = useIdioma();
  const [valores, setValores] = useState(() =>
    Object.fromEntries(MAQUINAS.map((m) => [m, Object.fromEntries(TIPOS.map(({ chave }) => [chave, comoTexto(limitesDe(m)[chave])]))])),
  );
  const [situacao, setSituacao] = useState('parado'); // 'parado' | 'salvando' | 'salvo' | 'invalido' | 'erro' | 'semMudanca'

  const mudar = (maquina, chave, valor) => {
    setValores((atual) => ({ ...atual, [maquina]: { ...atual[maquina], [chave]: valor } }));
    setSituacao('parado');
  };

  const voltarAoPadrao = (maquina) => {
    setValores((atual) => ({ ...atual, [maquina]: Object.fromEntries(TIPOS.map(({ chave }) => [chave, comoTexto(padrao[chave])])) }));
    setSituacao('parado');
  };

  async function salvar(evento) {
    evento.preventDefault();

    const mudancas = [];
    for (const maquina of MAQUINAS) {
      for (const { tipo, chave } of TIPOS) {
        const novo = Number(valores[maquina][chave]);
        if (!Number.isFinite(novo) || novo <= 0) {
          setSituacao('invalido');
          return;
        }
        if (novo !== limitesDe(maquina)[chave]) mudancas.push({ maquina, tipo, novo, volta: novo === padrao[chave] });
      }
    }
    if (mudancas.length === 0) {
      setSituacao('semMudanca');
      return;
    }

    setSituacao('salvando');
    try {
      for (const { maquina, tipo, novo, volta } of mudancas) {
        if (volta) await removerLimite(token, maquina, tipo);
        else await definirLimite(token, maquina, tipo, novo);
      }
      aoSalvar();
      setSituacao('salvo');
    } catch (falha) {
      if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
      else setSituacao('erro');
      aoSalvar(); // alguns limites podem ter sido salvos antes da falha: mostra o que valeu
    }
  }

  const mensagem = { salvo: 'limites.salvo', invalido: 'limites.invalido', erro: 'limites.erro', semMudanca: 'limites.semMudanca' }[situacao];

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-painel text-tinta">
        <DialogHeader>
          <DialogTitle className="font-condensada text-3xl font-semibold">{t('limites.titulo')}</DialogTitle>
          <DialogDescription>
            {t('limites.descricao', {
              temp: formatarNumero(padrao.temperatura, 1, 0, locale),
              vib: formatarNumero(padrao.vibracao, 1, 1, locale),
            })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={salvar} noValidate>
          <div className="space-y-4">
            {MAQUINAS.map((maquina) => (
              <fieldset key={maquina} className="rounded border border-linha p-4">
                <legend className="numero px-1 text-xl">{maquina}</legend>
                <div className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  {TIPOS.map(({ chave, rotulo }) => (
                    <div key={chave}>
                      <label htmlFor={`limite-${maquina}-${chave}`} className="text-sm text-suave">
                        {t(rotulo)}
                      </label>
                      <Input
                        id={`limite-${maquina}-${chave}`}
                        type="number"
                        inputMode="decimal"
                        step="any"
                        min="0"
                        className="mt-1"
                        value={valores[maquina][chave]}
                        onChange={(e) => mudar(maquina, chave, e.target.value)}
                      />
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" aria-label={t('limites.padraoAria', { maquina })} onClick={() => voltarAoPadrao(maquina)}>
                    {t('limites.padrao')}
                  </Button>
                </div>
              </fieldset>
            ))}
          </div>

          <div className="mt-5 flex flex-wrap items-center gap-4">
            <Button type="submit" disabled={situacao === 'salvando'}>
              {situacao === 'salvando' ? t('limites.salvando') : t('limites.salvar')}
            </Button>
            {mensagem && (
              <p role={situacao === 'salvo' || situacao === 'semMudanca' ? 'status' : 'alert'} className={`text-sm ${situacao === 'invalido' || situacao === 'erro' ? 'font-medium text-alarme' : 'text-suave'}`}>
                {t(mensagem)}
              </p>
            )}
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
