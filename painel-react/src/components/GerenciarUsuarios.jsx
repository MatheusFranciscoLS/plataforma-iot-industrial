import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { useIdioma } from '@/i18n/idioma-contexto';
import {
  apagarUsuario,
  buscarUsuarios,
  criarUsuario,
  SemPermissaoError,
  SessaoInvalidaError,
  trocarPerfilDoUsuario,
  trocarSenhaDoUsuario,
} from '@/lib/api';

const PERFIS = ['ADMIN', 'OPERADOR', 'LEITURA'];

const classeDoSelect =
  'h-9 rounded border border-linha bg-fundo px-2 text-sm text-tinta focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:opacity-50';

/** Janela do administrador: quem pode entrar no painel, com qual perfil, e a criação, troca de senha e remoção de usuários. */
export default function GerenciarUsuarios({ token, usuarioAtual, aoFechar, onSessaoInvalida }) {
  const { t } = useIdioma();
  const [usuarios, setUsuarios] = useState(null); // null = carregando
  const [erroAoCarregar, setErroAoCarregar] = useState(false);
  const [versao, setVersao] = useState(0);
  const [mensagem, setMensagem] = useState(null); // { texto, erro }
  const [trocandoSenha, setTrocandoSenha] = useState(null); // nome do usuário com o campo de senha aberto
  const [confirmandoApagar, setConfirmandoApagar] = useState(null);
  const [novaSenha, setNovaSenha] = useState('');
  const [novo, setNovo] = useState({ nome: '', senha: '', perfil: 'LEITURA' });
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    let ativo = true;
    buscarUsuarios(token)
      .then((lista) => {
        if (!ativo) return;
        setUsuarios(lista);
        setErroAoCarregar(false);
      })
      .catch((falha) => {
        if (!ativo) return;
        if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
        else setErroAoCarregar(true);
      });
    return () => {
      ativo = false;
    };
  }, [token, onSessaoInvalida, versao]);

  const textoDoErro = useCallback(
    (falha, aoCriar = false) => {
      if (falha instanceof SemPermissaoError) return t('usuarios.erroPermissao');
      if (falha.status === 409) return t(aoCriar ? 'usuarios.erroNomeExiste' : 'usuarios.erroConflito');
      if (falha.status === 400) return t('usuarios.erroInvalido');
      return t('usuarios.erro');
    },
    [t],
  );

  /** Roda uma ação, mostra o resultado e recarrega a lista. */
  async function executar(acao, textoDeSucesso, aoCriar = false) {
    setOcupado(true);
    setMensagem(null);
    try {
      await acao();
      setMensagem({ texto: textoDeSucesso, erro: false });
      setVersao((v) => v + 1);
      return true;
    } catch (falha) {
      if (falha instanceof SessaoInvalidaError) onSessaoInvalida();
      else setMensagem({ texto: textoDoErro(falha, aoCriar), erro: true });
      return false;
    } finally {
      setOcupado(false);
    }
  }

  async function criar(evento) {
    evento.preventDefault();
    const criado = await executar(() => criarUsuario(token, novo), t('usuarios.criado', { nome: novo.nome }), true);
    if (criado) setNovo({ nome: '', senha: '', perfil: 'LEITURA' });
  }

  async function salvarSenha(evento, nome) {
    evento.preventDefault();
    const trocada = await executar(() => trocarSenhaDoUsuario(token, nome, novaSenha), t('usuarios.senhaTrocada', { nome }));
    if (trocada) {
      setTrocandoSenha(null);
      setNovaSenha('');
    }
  }

  return (
    <Dialog open onOpenChange={(aberto) => !aberto && aoFechar()}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto bg-painel text-tinta">
        <DialogHeader>
          <DialogTitle className="font-condensada text-3xl font-semibold">{t('usuarios.titulo')}</DialogTitle>
          <DialogDescription>{t('usuarios.descricao')}</DialogDescription>
        </DialogHeader>

        <div aria-live="polite" className="min-h-5">
          {mensagem && (
            <p role={mensagem.erro ? 'alert' : 'status'} className={`text-sm ${mensagem.erro ? 'font-medium text-alarme' : 'text-suave'}`}>
              {mensagem.texto}
            </p>
          )}
        </div>

        {erroAoCarregar && (
          <p role="alert" className="text-sm font-medium text-alarme">
            {t('usuarios.erroCarregar')}
          </p>
        )}
        {usuarios === null && !erroAoCarregar && <p className="text-sm text-suave">{t('usuarios.carregando')}</p>}

        {usuarios && (
          <ul className="divide-y divide-linha rounded border border-linha">
            {usuarios.map(({ nome, perfil }) => {
              const eVoce = nome === usuarioAtual;
              return (
                <li key={nome} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-3">
                  <span className="numero min-w-28 text-lg">
                    {nome}
                    {eVoce && <span className="ml-2 font-sans text-sm text-suave">{t('usuarios.voce')}</span>}
                  </span>

                  <select
                    aria-label={t('usuarios.perfilDe', { nome })}
                    className={classeDoSelect}
                    value={perfil}
                    disabled={ocupado || eVoce}
                    onChange={(e) => executar(() => trocarPerfilDoUsuario(token, nome, e.target.value), t('usuarios.perfilTrocado', { nome }))}
                  >
                    {PERFIS.map((p) => (
                      <option key={p} value={p}>
                        {t(`perfil.${p}`)}
                      </option>
                    ))}
                  </select>

                  <span className="flex flex-wrap gap-2 sm:ml-auto">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ocupado}
                      aria-label={t('usuarios.trocarSenhaDe', { nome })}
                      onClick={() => {
                        setTrocandoSenha(trocandoSenha === nome ? null : nome);
                        setConfirmandoApagar(null);
                        setNovaSenha('');
                      }}
                    >
                      {t('usuarios.trocarSenha')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={ocupado || eVoce}
                      aria-label={t('usuarios.apagarDe', { nome })}
                      onClick={() => {
                        setConfirmandoApagar(confirmandoApagar === nome ? null : nome);
                        setTrocandoSenha(null);
                      }}
                    >
                      {t('usuarios.apagar')}
                    </Button>
                  </span>

                  {trocandoSenha === nome && (
                    <form className="flex w-full flex-wrap items-end gap-3" onSubmit={(e) => salvarSenha(e, nome)}>
                      <div className="min-w-48 flex-1">
                        <label htmlFor={`senha-de-${nome}`} className="text-sm text-suave">
                          {t('usuarios.novaSenha')}
                        </label>
                        <Input
                          id={`senha-de-${nome}`}
                          type="password"
                          autoComplete="new-password"
                          minLength={8}
                          maxLength={72}
                          required
                          className="mt-1"
                          value={novaSenha}
                          onChange={(e) => setNovaSenha(e.target.value)}
                        />
                      </div>
                      <Button type="submit" size="sm" disabled={ocupado}>
                        {t('usuarios.salvarSenha')}
                      </Button>
                    </form>
                  )}

                  {confirmandoApagar === nome && (
                    <div className="flex w-full flex-wrap items-center gap-3">
                      <p className="text-sm font-medium text-alarme">{t('usuarios.confirmarApagar', { nome })}</p>
                      <Button
                        type="button"
                        size="sm"
                        disabled={ocupado}
                        onClick={async () => {
                          if (await executar(() => apagarUsuario(token, nome), t('usuarios.apagado', { nome }))) setConfirmandoApagar(null);
                        }}
                      >
                        {t('usuarios.simApagar')}
                      </Button>
                      <Button type="button" variant="outline" size="sm" onClick={() => setConfirmandoApagar(null)}>
                        {t('usuarios.cancelar')}
                      </Button>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}

        <form onSubmit={criar} className="rounded border border-linha p-4">
          <h3 className="font-condensada text-xl font-semibold">{t('usuarios.novo')}</h3>
          <div className="mt-3 grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="novo-nome" className="text-sm text-suave">
                {t('usuarios.nome')}
              </label>
              <Input
                id="novo-nome"
                autoComplete="off"
                required
                minLength={3}
                maxLength={50}
                pattern="[A-Za-z0-9._\-]{3,50}"
                title={t('usuarios.nomeDica')}
                className="mt-1"
                value={novo.nome}
                onChange={(e) => setNovo({ ...novo, nome: e.target.value })}
              />
              <p className="mt-1 text-xs text-suave">{t('usuarios.nomeDica')}</p>
            </div>
            <div>
              <label htmlFor="novo-senha" className="text-sm text-suave">
                {t('usuarios.senha')}
              </label>
              <Input
                id="novo-senha"
                type="password"
                autoComplete="new-password"
                required
                minLength={8}
                maxLength={72}
                className="mt-1"
                value={novo.senha}
                onChange={(e) => setNovo({ ...novo, senha: e.target.value })}
              />
              <p className="mt-1 text-xs text-suave">{t('usuarios.senhaDica')}</p>
            </div>
          </div>
          <div className="mt-4 flex flex-wrap items-end gap-4">
            <div>
              <label htmlFor="novo-perfil" className="block text-sm text-suave">
                {t('usuarios.perfil')}
              </label>
              <select id="novo-perfil" className={`${classeDoSelect} mt-1 h-11`} value={novo.perfil} onChange={(e) => setNovo({ ...novo, perfil: e.target.value })}>
                {PERFIS.map((p) => (
                  <option key={p} value={p}>
                    {t(`perfil.${p}`)}
                  </option>
                ))}
              </select>
            </div>
            <Button type="submit" disabled={ocupado}>
              {t('usuarios.criar')}
            </Button>
          </div>
          <p className="mt-3 text-xs text-suave">{t('usuarios.perfis')}</p>
        </form>
      </DialogContent>
    </Dialog>
  );
}
